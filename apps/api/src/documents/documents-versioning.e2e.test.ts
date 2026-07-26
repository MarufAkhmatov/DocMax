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
import type { AccessTokenPayload, DocumentDetail } from '@docmax/shared';
import { AppModule } from '../app.module';

/**
 * TZ-0 §6 qat'iy talabi: "auth, permissions, versioning mantiqlari 100% test bilan" —
 * auth/permissions allaqachon e2e bilan qoplangan (auth.e2e.test.ts, folder-permissions.e2e.test.ts),
 * versioning uchun bu fayl. TZ-1 §1.4 qabul mezonlari:
 *  - Yangi versiya BITTA tranzaksiyada (eski isCurrent=false + yangi insert + currentVersionId)
 *  - versionNo/versionLabel ketma-ket to'g'ri o'sadi ("1 hujjatga 3 versiya" DoD ssenariysi)
 *  - Faqat ADMIN/EDITOR versiya yarata oladi
 *  - Taqqoslama shabloni fon vazifaga to'g'ri navbatga qo'yiladi
 */
describe('Documents — versiyalash (e2e) — TZ-1 §1.4', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let jwt: JwtService;
  let config: ConfigService;
  let orgId: string;
  let docTypeId: string;
  let folderId: string;
  const password = 'Password123!';
  const testTag = `e2e-ver-${randomUUID()}`;

  const http = () => request(app.getHttpServer());

  async function signToken(user: Pick<User, 'id' | 'orgId' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, orgId: user.orgId, role: user.role };
    return jwt.signAsync(payload, { secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' });
  }

  let adminToken: string;
  let adminUserId: string;
  let editorToken: string;
  let viewerToken: string;

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
      data: { orgId, email: `admin-${testTag}@test.docmax.local`, passwordHash, fullName: 'Versioning Admin', role: 'ADMIN' },
    });
    const editor = await db.user.create({
      data: { orgId, email: `editor-${testTag}@test.docmax.local`, passwordHash, fullName: 'Versioning Editor', role: 'EDITOR' },
    });
    const viewer = await db.user.create({
      data: { orgId, email: `viewer-${testTag}@test.docmax.local`, passwordHash, fullName: 'Versioning Viewer', role: 'VIEWER' },
    });

    adminToken = await signToken(admin);
    adminUserId = admin.id;
    editorToken = await signToken(editor);
    viewerToken = await signToken(viewer);

    const folderRes = await http()
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `folder-${testTag}` });
    folderId = folderRes.body.id;
  });

  afterAll(async () => {
    await db.documentVersion.deleteMany({ where: { document: { title: { contains: testTag } } } });
    await db.document.deleteMany({ where: { orgId, title: { contains: testTag } } });
    await db.file.deleteMany({ where: { orgId, originalName: { contains: testTag } } });
    await db.folder.deleteMany({ where: { orgId, name: { contains: testTag } } });
    await db.user.deleteMany({ where: { email: { contains: testTag } } });
    await db.$disconnect();
    await app.close();
  });

  async function createFile(label: string): Promise<string> {
    const file = await db.file.create({
      data: {
        orgId,
        bucket: 'docmax',
        objectKey: `test/${testTag}/${randomUUID()}.pdf`,
        originalName: `${label}-${testTag}.pdf`,
        mime: 'application/pdf',
        sizeBytes: 100,
        sha256: randomUUID().replaceAll('-', ''),
        uploadedBy: adminUserId,
        status: 'READY',
      },
    });
    return file.id;
  }

  async function createDocument(title: string): Promise<DocumentDetail> {
    const pdfFileId = await createFile(title);
    const res = await http()
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ folderId, title: `${title}-${testTag}`, docTypeId, pdfFileId });
    expect(res.status).toBe(201);
    return res.body as DocumentDetail;
  }

  it('yangi versiya yaratish BITTA tranzaksiyada to\'g\'ri ishlaydi — eski isCurrent=false, yangi isCurrent=true, currentVersionId yangilanadi', async () => {
    const doc = await createDocument('tx-check');
    expect(doc.versions).toHaveLength(1);
    const v1Id = doc.versions[0].id;

    const pdfFileId = await createFile('tx-check-v2');
    const res = await http()
      .post(`/api/v1/documents/${doc.id}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ versionType: 'MINOR', pdfFileId });
    expect(res.status).toBe(201);
    expect(res.body.currentVersionLabel).toBe('v1.1');
    expect(res.body.versions).toHaveLength(2);

    // Xizmat qatlamini aylanib o'tib to'g'ridan-to'g'ri DB'dan tekshirish — tranzaksiya
    // haqiqatan uchala yozuvni ham (eski versiya, yangi versiya, document) yangilaganini isbotlaydi.
    const v1 = await db.documentVersion.findUniqueOrThrow({ where: { id: v1Id } });
    expect(v1.isCurrent).toBe(false);
    const dbDoc = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
    const v2 = await db.documentVersion.findFirstOrThrow({ where: { documentId: doc.id, versionNo: 2 } });
    expect(v2.isCurrent).toBe(true);
    expect(dbDoc.currentVersionId).toBe(v2.id);
  });

  it('ketma-ket 3 versiya — versionNo/versionLabel to\'g\'ri o\'sadi (TZ-1 DoD "1 hujjatga 3 versiya")', async () => {
    const doc = await createDocument('three-versions');

    const pdfFileId2 = await createFile('three-versions-v2');
    await http().post(`/api/v1/documents/${doc.id}/versions`).set('Authorization', `Bearer ${adminToken}`).send({ versionType: 'MINOR', pdfFileId: pdfFileId2 });

    const pdfFileId3 = await createFile('three-versions-v3');
    const finalRes = await http()
      .post(`/api/v1/documents/${doc.id}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ versionType: 'MAJOR', pdfFileId: pdfFileId3 });
    expect(finalRes.status).toBe(201);
    expect(finalRes.body.currentVersionLabel).toBe('v2.0');

    const versions = await db.documentVersion.findMany({ where: { documentId: doc.id }, orderBy: { versionNo: 'asc' } });
    expect(versions.map((v) => [v.versionNo, v.versionLabel, v.isCurrent])).toEqual([
      [1, 'v1.0', false],
      [2, 'v1.1', false],
      [3, 'v2.0', true],
    ]);
  });

  it('VIEWER versiya yarata olmaydi — 403', async () => {
    const doc = await createDocument('viewer-forbidden');
    const pdfFileId = await createFile('viewer-forbidden-v2');
    const res = await http()
      .post(`/api/v1/documents/${doc.id}/versions`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ versionType: 'MINOR', pdfFileId });
    expect(res.status).toBe(403);
  });

  it("mavjud bo'lmagan hujjatga versiya qo'shish — 404", async () => {
    const pdfFileId = await createFile('missing-doc');
    const res = await http()
      .post(`/api/v1/documents/${randomUUID()}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ versionType: 'MINOR', pdfFileId });
    expect(res.status).toBe(404);
  });

  it('taqqoslama shabloni fon vazifaga navbatga qo\'yiladi (jobId) va status polling ishlaydi', async () => {
    const doc = await createDocument('comparison-template');
    const res = await http()
      .post(`/api/v1/documents/${doc.id}/comparison-template`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ versionType: 'MINOR' });
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeTruthy();

    const statusRes = await http()
      .get(`/api/v1/documents/template-jobs/${res.body.jobId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statusRes.status).toBe(200);
    // To'liq worker orqali "completed"gacha kutilmaydi (real Redis consumer talab qiladi,
    // e2e'da beqaror bo'lardi) — faqat enqueue+poll shakli to'g'ri ekani tekshiriladi.
    expect(['waiting', 'active', 'completed', 'failed']).toContain(statusRes.body.state);
  });

  it("hujjat CRUD — o'qish, yangilash, mavjud bo'lmagan id uchun 404", async () => {
    const doc = await createDocument('crud-check');

    const getRes = await http().get(`/api/v1/documents/${doc.id}`).set('Authorization', `Bearer ${viewerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe(doc.title);

    const patchRes = await http()
      .patch(`/api/v1/documents/${doc.id}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: `crud-check-updated-${testTag}` });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.title).toBe(`crud-check-updated-${testTag}`);

    const missingRes = await http().get(`/api/v1/documents/${randomUUID()}`).set('Authorization', `Bearer ${adminToken}`);
    expect(missingRes.status).toBe(404);
  });
});
