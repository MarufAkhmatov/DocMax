import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import argon2 from 'argon2';
import { PrismaClient, type User } from '@docmax/db';
import type { AccessTokenPayload, FolderNode } from '@docmax/shared';
import { AppModule } from '../app.module';

/**
 * TZ-2 §2.5 qabul mezonlari:
 *  1. Ruxsat tekshiruvi bitta joyda (FolderAccessService), barcha endpointlar qamrovda
 *  2. ACL'd papkadagi hujjat qidiruvda/graf'da ham ruxsatsizga chiqmaydi
 * Matritsa: subject turi (ROLE/USER/ORG_UNIT/hech kim mos kelmaydi) x huquq
 * (view/edit/download) x meros (inherit t/f) x override (bola papka o'ziniki bilan).
 */
describe('Folder ACL / permission matrix (e2e) — TZ-2 §2.5', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let jwt: JwtService;
  let config: ConfigService;
  let orgId: string;
  let docTypeId: string;
  const password = 'Password123!';
  const testTag = `e2e-acl-${randomUUID()}`;

  const http = () => request(app.getHttpServer());

  async function signToken(user: Pick<User, 'id' | 'orgId' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, orgId: user.orgId, role: user.role };
    return jwt.signAsync(payload, { secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' });
  }

  let adminToken: string;
  let adminUserId: string;
  let editorToken: string;
  let viewerToken: string;
  let viewerUserId: string;
  let outsiderToken: string; // hech qanday ACL'ga mos kelmaydigan VIEWER
  let orgUnitId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();

    jwt = app.get(JwtService);
    config = app.get(ConfigService);

    db = new PrismaClient();
    const org = await db.organization.findFirstOrThrow();
    orgId = org.id;
    const docType = await db.documentType.findFirstOrThrow({ where: { orgId } });
    docTypeId = docType.id;

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const admin = await db.user.create({
      data: { orgId, email: `admin-${testTag}@test.docmax.local`, passwordHash, fullName: 'ACL Admin', role: 'ADMIN' },
    });
    const editor = await db.user.create({
      data: { orgId, email: `editor-${testTag}@test.docmax.local`, passwordHash, fullName: 'ACL Editor', role: 'EDITOR' },
    });
    const unit = await db.orgUnit.create({ data: { orgId, name: `unit-${testTag}` } });
    orgUnitId = unit.id;
    const viewer = await db.user.create({
      data: {
        orgId,
        email: `viewer-${testTag}@test.docmax.local`,
        passwordHash,
        fullName: 'ACL Viewer',
        role: 'VIEWER',
        orgUnitId,
      },
    });
    const outsider = await db.user.create({
      data: { orgId, email: `outsider-${testTag}@test.docmax.local`, passwordHash, fullName: 'ACL Outsider', role: 'VIEWER' },
    });

    adminToken = await signToken(admin);
    adminUserId = admin.id;
    editorToken = await signToken(editor);
    viewerToken = await signToken(viewer);
    viewerUserId = viewer.id;
    outsiderToken = await signToken(outsider);
  });

  afterAll(async () => {
    await db.documentVersion.deleteMany({ where: { document: { title: { contains: testTag } } } });
    await db.document.deleteMany({ where: { orgId, title: { contains: testTag } } });
    await db.file.deleteMany({ where: { orgId, originalName: { contains: testTag } } });
    await db.permission.deleteMany({ where: { orgId, folder: { name: { contains: testTag } } } });
    await db.folder.deleteMany({ where: { orgId, name: { contains: testTag } } });
    await db.orgUnit.deleteMany({ where: { orgId, name: { contains: testTag } } });
    await db.user.deleteMany({ where: { email: { contains: testTag } } });
    await db.$disconnect();
    await app.close();
  });

  async function createFolder(name: string, parentId: string | null = null): Promise<FolderNode> {
    const res = await http()
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${name}-${testTag}`, parentId });
    expect(res.status).toBe(201);
    return res.body as FolderNode;
  }

  async function createDocumentIn(folderId: string, title: string): Promise<{ documentId: string; fileId: string }> {
    const file = await db.file.create({
      data: {
        orgId,
        bucket: 'docmax',
        objectKey: `test/${testTag}/${randomUUID()}.pdf`,
        originalName: `${title}-${testTag}.pdf`,
        mime: 'application/pdf',
        sizeBytes: 100,
        sha256: randomUUID().replaceAll('-', ''),
        uploadedBy: adminUserId,
        status: 'READY',
      },
    });
    const documentId = randomUUID();
    const versionId = randomUUID();
    await db.document.create({
      data: { id: documentId, orgId, folderId, title: `${title}-${testTag}`, docTypeId, authorUserId: adminUserId, status: 'ACTIVE' },
    });
    await db.documentVersion.create({
      data: { id: versionId, documentId, versionLabel: 'v1.0', versionNo: 1, pdfFileId: file.id, createdBy: adminUserId, isCurrent: true },
    });
    await db.document.update({ where: { id: documentId }, data: { currentVersionId: versionId } });
    return { documentId, fileId: file.id };
  }

  type AclEntry = { subjectType: 'ROLE' | 'USER' | 'ORG_UNIT'; subjectId: string; canView: boolean; canEdit: boolean; canDownload: boolean; inherit: boolean };

  async function setPermissions(folderId: string, enabled: boolean, entries: AclEntry[]) {
    const res = await http()
      .put(`/api/v1/folders/${folderId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled, entries });
    expect(res.status).toBe(200);
    return res.body;
  }

  describe('ADMIN bypass', () => {
    it('ADMIN har doim to\'liq huquqqa ega — ACL hech kimga ruxsat bermasa ham', async () => {
      const folder = await createFolder('admin-bypass');
      await setPermissions(folder.id, true, []);
      const { documentId } = await createDocumentIn(folder.id, 'admin-bypass-doc');

      const treeRes = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${adminToken}`);
      expect(treeRes.body.some((f: FolderNode) => f.id === folder.id)).toBe(true);

      const docRes = await http().get(`/api/v1/documents/${documentId}`).set('Authorization', `Bearer ${adminToken}`);
      expect(docRes.status).toBe(200);
    });
  });

  describe('USER subject — aniq ruxsat', () => {
    it('grantee USER ko\'ra oladi, boshqa VIEWER (outsider) mutlaqo ko\'rmaydi', async () => {
      const folder = await createFolder('user-grant');
      await setPermissions(folder.id, true, [
        { subjectType: 'USER', subjectId: viewerUserId, canView: true, canEdit: false, canDownload: false, inherit: true },
      ]);
      const { documentId, fileId } = await createDocumentIn(folder.id, 'user-grant-doc');

      const grantedTree = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${viewerToken}`);
      expect(grantedTree.body.some((f: FolderNode) => f.id === folder.id)).toBe(true);

      const outsiderTree = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${outsiderToken}`);
      expect(outsiderTree.body.some((f: FolderNode) => f.id === folder.id)).toBe(false);

      const grantedDoc = await http().get(`/api/v1/documents/${documentId}`).set('Authorization', `Bearer ${viewerToken}`);
      expect(grantedDoc.status).toBe(200);

      const outsiderDoc = await http().get(`/api/v1/documents/${documentId}`).set('Authorization', `Bearer ${outsiderToken}`);
      expect(outsiderDoc.status).toBe(404);

      const grantedList = await http()
        .get(`/api/v1/documents?folderId=${folder.id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(grantedList.body.items.some((d: { id: string }) => d.id === documentId)).toBe(true);

      const outsiderList = await http()
        .get(`/api/v1/documents?folderId=${folder.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(outsiderList.body.items.length).toBe(0);

      const grantedGraph = await http().get('/api/v1/graph').set('Authorization', `Bearer ${viewerToken}`);
      expect(grantedGraph.body.nodes.some((n: { id: string }) => n.id === documentId)).toBe(true);

      const outsiderGraph = await http().get('/api/v1/graph').set('Authorization', `Bearer ${outsiderToken}`);
      expect(outsiderGraph.body.nodes.some((n: { id: string }) => n.id === documentId)).toBe(false);

      // canView=true, canDownload=false: inline ko'rish ishlaydi, attachment 403
      const inlineRes = await http()
        .get(`/api/v1/files/${fileId}/download?disposition=inline`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(inlineRes.status).toBe(200);

      const attachmentRes = await http()
        .get(`/api/v1/files/${fileId}/download?disposition=attachment`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(attachmentRes.status).toBe(403);

      const outsiderInline = await http()
        .get(`/api/v1/files/${fileId}/download?disposition=inline`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(outsiderInline.status).toBe(404);
    });
  });

  describe('ROLE subject', () => {
    it('rolga berilgan ruxsat shu rolning barcha userlariga ta\'sir qiladi, boshqa rolga emas', async () => {
      const folder = await createFolder('role-grant');
      await setPermissions(folder.id, true, [
        { subjectType: 'ROLE', subjectId: 'EDITOR', canView: true, canEdit: true, canDownload: true, inherit: true },
      ]);

      const editorRes = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${editorToken}`);
      expect(editorRes.body.some((f: FolderNode) => f.id === folder.id)).toBe(true);

      const viewerRes = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerRes.body.some((f: FolderNode) => f.id === folder.id)).toBe(false);
    });
  });

  describe('ORG_UNIT subject', () => {
    it('org-unit a\'zosi ko\'ra oladi, boshqa org-unit/org-unitsiz user ko\'rmaydi', async () => {
      const folder = await createFolder('org-unit-grant');
      await setPermissions(folder.id, true, [
        { subjectType: 'ORG_UNIT', subjectId: orgUnitId, canView: true, canEdit: false, canDownload: false, inherit: true },
      ]);

      const memberRes = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${viewerToken}`);
      expect(memberRes.body.some((f: FolderNode) => f.id === folder.id)).toBe(true);

      const nonMemberRes = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${outsiderToken}`);
      expect(nonMemberRes.body.some((f: FolderNode) => f.id === folder.id)).toBe(false);
    });
  });

  describe('Meros (inherit) va override', () => {
    it('inherit=true — bola papka (o\'z ACL\'isiz) ota-papka ruxsatini oladi', async () => {
      const parent = await createFolder('inherit-parent');
      await setPermissions(parent.id, true, [
        { subjectType: 'USER', subjectId: viewerUserId, canView: true, canEdit: false, canDownload: false, inherit: true },
      ]);
      const child = await createFolder('inherit-child', parent.id);

      const res = await http().get('/api/v1/folders/tree?parentId=' + parent.id).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.body.some((f: FolderNode) => f.id === child.id)).toBe(true);
    });

    it('inherit=false — bola papkaga pastga tushmaydi (chegara faqat o\'zida)', async () => {
      const parent = await createFolder('noinherit-parent');
      await setPermissions(parent.id, true, [
        { subjectType: 'USER', subjectId: viewerUserId, canView: true, canEdit: false, canDownload: false, inherit: false },
      ]);
      const child = await createFolder('noinherit-child', parent.id);

      // parent'ning o'zi ko'rinadi (inherit maydoni faqat pastga tushishga ta'sir qiladi)
      const parentTree = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${viewerToken}`);
      expect(parentTree.body.some((f: FolderNode) => f.id === parent.id)).toBe(true);

      // child — parent ACL chegarasi ostida, lekin inherit=false bo'lgani uchun hech qanday
      // qator mos kelmaydi -> ko'rinmaydi
      const childTree = await http().get(`/api/v1/folders/tree?parentId=${parent.id}`).set('Authorization', `Bearer ${viewerToken}`);
      expect(childTree.body.some((f: FolderNode) => f.id === child.id)).toBe(false);
    });

    it('bola papka o\'z ACL\'ini yoqsa — ota-papka ruxsatini bekor qiladi (override)', async () => {
      const parent = await createFolder('override-parent');
      await setPermissions(parent.id, true, [
        { subjectType: 'USER', subjectId: viewerUserId, canView: true, canEdit: false, canDownload: false, inherit: true },
      ]);
      const child = await createFolder('override-child', parent.id);
      // child o'zining ACL'ini yoqadi — faqat outsider'ga ruxsat, viewer'ga YO'Q
      await setPermissions(child.id, true, [
        { subjectType: 'USER', subjectId: adminUserId, canView: true, canEdit: false, canDownload: false, inherit: true },
      ]);

      const viewerChild = await http().get(`/api/v1/folders/tree?parentId=${parent.id}`).set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerChild.body.some((f: FolderNode) => f.id === child.id)).toBe(false);
    });
  });

  describe('PERMISSION_CHANGE audit', () => {
    it('PUT /folders/:id/permissions bitta PERMISSION_CHANGE audit yozuvi qoldiradi', async () => {
      const folder = await createFolder('audit-check');
      await setPermissions(folder.id, true, [
        { subjectType: 'ROLE', subjectId: 'VIEWER', canView: true, canEdit: false, canDownload: false, inherit: true },
      ]);
      const logs = await db.auditLog.findMany({ where: { entityType: 'Folder', entityId: folder.id, action: 'PERMISSION_CHANGE' } });
      expect(logs.length).toBe(1);
    });
  });

  describe('ACL yoqilmagan (bugungi standart holat)', () => {
    it('hech qanday folder aclEnabled bo\'lmasa VIEWER ham hamma narsani ko\'radi (xatti-harakat o\'zgarmagan)', async () => {
      const folder = await createFolder('no-acl');
      const { documentId } = await createDocumentIn(folder.id, 'no-acl-doc');

      const tree = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${outsiderToken}`);
      expect(tree.body.some((f: FolderNode) => f.id === folder.id)).toBe(true);

      const doc = await http().get(`/api/v1/documents/${documentId}`).set('Authorization', `Bearer ${outsiderToken}`);
      expect(doc.status).toBe(200);
    });
  });
});
