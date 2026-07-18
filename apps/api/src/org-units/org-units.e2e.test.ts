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
import type { AccessTokenPayload, OrgUnitNode } from '@docmax/shared';
import { AppModule } from '../app.module';

/**
 * TZ-2 §2.4 qabul mezonlari:
 *  - Struktura o'zgartirilganda snapshot yoziladi
 *  - Bo'linmani o'z avlodiga ko'chirish taqiqlanadi
 *  - Yopishda "Arxiv strukturalar"ga ko'chirish hujjat ID/relationlarga tegmaydi
 *  - Remapping wizard: preview — mutatsiyasiz, apply — bitta tranzaksiyada (rollback ham)
 */
describe('Org units — struktura (e2e) — TZ-2 §2.4', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let jwt: JwtService;
  let config: ConfigService;
  let orgId: string;
  const password = 'Password123!';
  const testTag = `e2e-orgunits-${randomUUID()}`;

  const http = () => request(app.getHttpServer());

  async function signToken(user: Pick<User, 'id' | 'orgId' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, orgId: user.orgId, role: user.role };
    return jwt.signAsync(payload, { secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' });
  }

  let adminToken: string;

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

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const admin = await db.user.create({
      data: { orgId, email: `admin-${testTag}@test.docmax.local`, passwordHash, fullName: 'OrgUnits Admin', role: 'ADMIN' },
    });
    adminToken = await signToken(admin);
  });

  afterAll(async () => {
    await db.document.deleteMany({ where: { orgId, title: { contains: testTag } } });
    await db.folder.deleteMany({ where: { orgId, name: { contains: testTag } } });
    await db.orgStructureSnapshot.deleteMany({ where: { orgId, orgUnitId: { not: null } } }).catch(() => undefined);
    await db.orgUnit.deleteMany({ where: { orgId, name: { contains: testTag } } });
    await db.user.deleteMany({ where: { email: { contains: testTag } } });
    await db.$disconnect();
    await app.close();
  });

  async function createUnit(name: string, parentId: string | null = null): Promise<OrgUnitNode> {
    const res = await http()
      .post('/api/v1/org-units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${name}-${testTag}`, parentId });
    expect(res.status).toBe(201);
    return res.body as OrgUnitNode;
  }

  async function createFolder(name: string, parentId: string | null = null): Promise<{ id: string }> {
    const res = await http()
      .post('/api/v1/folders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${name}-${testTag}`, parentId });
    expect(res.status).toBe(201);
    return res.body;
  }

  it("bo'linmani o'z avlodi ichiga ko'chirish taqiqlanadi — 409", async () => {
    const parent = await createUnit('cycle-parent');
    const child = await createUnit('cycle-child', parent.id);

    const res = await http()
      .post(`/api/v1/org-units/${parent.id}/move`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentId: child.id, sortOrder: 0 });
    expect(res.status).toBe(409);
  });

  it('har mutatsiya OrgStructureSnapshot yozadi', async () => {
    const before = await db.orgStructureSnapshot.count({ where: { orgId } });
    await createUnit('snapshot-check');
    const after = await db.orgStructureSnapshot.count({ where: { orgId } });
    expect(after).toBeGreaterThan(before);
  });

  it("yopish (moveFoldersToArchive) papkani 'Arxiv strukturalar'ga ko'chiradi, hujjat ID o'zgarmaydi", async () => {
    const unit = await createUnit('close-unit');
    const folder = await createFolder('close-folder');
    await db.folder.update({ where: { id: folder.id }, data: { orgUnitId: unit.id } });

    const docType = await db.documentType.findFirstOrThrow({ where: { orgId } });
    const admin = await db.user.findFirstOrThrow({ where: { email: { contains: testTag } } });
    const doc = await db.document.create({
      data: { orgId, folderId: folder.id, title: `close-doc-${testTag}`, docTypeId: docType.id, authorUserId: admin.id, status: 'DRAFT' },
    });

    const res = await http()
      .post(`/api/v1/org-units/${unit.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ moveFoldersToArchive: true });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    const archive = await db.folder.findFirstOrThrow({ where: { orgId, name: 'Arxiv strukturalar', parentId: null } });
    const movedFolder = await db.folder.findUniqueOrThrow({ where: { id: folder.id } });
    expect(movedFolder.parentId).toBe(archive.id);
    expect(movedFolder.orgUnitId).toBeNull();

    // Hujjat ID/folderId FK o'zgarmadi (faqat papka ko'chdi, hujjat papka ICHIDA qoldi)
    const stillThere = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(stillThere.id).toBe(doc.id);
    expect(stillThere.folderId).toBe(folder.id);
  });

  it("remap-preview mutatsiyasiz — faqat taklif qiladi", async () => {
    const parentUnit = await createUnit('remap-parent-unit');
    const childUnit = await createUnit('remap-child-unit', parentUnit.id);
    const parentFolder = await createFolder('remap-parent-folder');
    const childFolder = await createFolder('remap-child-folder');
    await db.folder.update({ where: { id: parentFolder.id }, data: { orgUnitId: parentUnit.id } });
    await db.folder.update({ where: { id: childFolder.id }, data: { orgUnitId: childUnit.id } });

    const beforeCount = await db.folder.count({ where: { orgId } });
    const res = await http().get(`/api/v1/org-units/${parentUnit.id}/remap-preview`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const afterCount = await db.folder.count({ where: { orgId } });
    expect(afterCount).toBe(beforeCount); // hech narsa o'zgarmadi

    const childEntry = res.body.find((e: { folderId: string }) => e.folderId === childFolder.id);
    expect(childEntry).toBeDefined();
    // child unit parentUnit ostida, parentUnit papkasi bor -> proposedParentId = parentFolder.id
    expect(childEntry.proposedParentId).toBe(parentFolder.id);
  });

  it('remap-apply bitta tranzaksiyada ko\'chiradi; noto\'g\'ri entry butun amalni bekor qiladi (rollback)', async () => {
    const unit = await createUnit('remap-apply-unit');
    const folderA = await createFolder('remap-apply-a');
    const folderB = await createFolder('remap-apply-b');
    const targetFolder = await createFolder('remap-apply-target');

    const beforeA = await db.folder.findUniqueOrThrow({ where: { id: folderA.id } });
    const beforeB = await db.folder.findUniqueOrThrow({ where: { id: folderB.id } });

    const badRes = await http()
      .post(`/api/v1/org-units/${unit.id}/remap-apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        moves: [
          { folderId: folderA.id, newParentId: targetFolder.id },
          { folderId: folderB.id, newParentId: randomUUID() }, // mavjud bo'lmagan papka -> xato
        ],
      });
    expect(badRes.status).toBeGreaterThanOrEqual(400);

    const afterA = await db.folder.findUniqueOrThrow({ where: { id: folderA.id } });
    const afterB = await db.folder.findUniqueOrThrow({ where: { id: folderB.id } });
    // Rollback: A ham o'zgarmagan bo'lishi kerak (garchi ro'yxatda birinchi va "to'g'ri" bo'lsa ham)
    expect(afterA.parentId).toBe(beforeA.parentId);
    expect(afterB.parentId).toBe(beforeB.parentId);

    const goodRes = await http()
      .post(`/api/v1/org-units/${unit.id}/remap-apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ moves: [{ folderId: folderA.id, newParentId: targetFolder.id }] });
    expect(goodRes.status).toBe(200);
    const movedA = await db.folder.findUniqueOrThrow({ where: { id: folderA.id } });
    expect(movedA.parentId).toBe(targetFolder.id);
  });
});
