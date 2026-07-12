import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import argon2 from 'argon2';
import { Prisma, PrismaClient, type User } from '@docmax/db';
import type { AccessTokenPayload, FolderNode } from '@docmax/shared';
import { AppModule } from '../app.module';

/**
 * TZ-1 §1.2 qabul mezonlari:
 *  1. 5+ daraja chuqurlikda ko'chirish path'larni to'g'ri yangilaydi (ltree test)
 *  2. Papkani o'z avlodi ichiga ko'chirish taqiqlanadi (409)
 *  3. 1000 papkali tree < 500ms yuklanadi
 * Qo'shimcha: bo'sh bo'lmagan papka o'chmaydi, faqat ADMIN mutatsiya qiladi.
 */
describe('Folders (e2e) — TZ-1 §1.2', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let jwt: JwtService;
  let config: ConfigService;
  let orgId: string;
  const password = 'Password123!';
  const testTag = `e2e-folders-${randomUUID()}`;

  const http = () => request(app.getHttpServer());

  async function signToken(user: Pick<User, 'id' | 'orgId' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, orgId: user.orgId, role: user.role };
    return jwt.signAsync(payload, {
      secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
  }

  let adminToken: string;
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

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const admin = await db.user.create({
      data: { orgId, email: `admin-${testTag}@test.docmax.local`, passwordHash, fullName: 'E2E Admin', role: 'ADMIN' },
    });
    const viewer = await db.user.create({
      data: { orgId, email: `viewer-${testTag}@test.docmax.local`, passwordHash, fullName: 'E2E Viewer', role: 'VIEWER' },
    });
    adminToken = await signToken(admin);
    viewerToken = await signToken(viewer);
  });

  afterAll(async () => {
    await db.folder.deleteMany({ where: { orgId, name: { contains: testTag } } });
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

  describe('CRUD + ruxsat matritsasi', () => {
    it('VIEWER papka yarata olmaydi — 403', async () => {
      const res = await http()
        .post('/api/v1/folders')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: `viewer-blocked-${testTag}` });
      expect(res.status).toBe(403);
    });

    it('ADMIN papka yaratadi, GET tree bilan ko\'rinadi', async () => {
      const folder = await createFolder('crud-root');
      const res = await http()
        .get('/api/v1/folders/tree')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.some((f: FolderNode) => f.id === folder.id)).toBe(true);
    });

    it("bo'sh bo'lmagan papka o'chmaydi — 409, bo'sh papka o'chadi — 204", async () => {
      const parent = await createFolder('del-parent');
      const child = await createFolder('del-child', parent.id);

      const blockedRes = await http()
        .delete(`/api/v1/folders/${parent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(blockedRes.status).toBe(409);

      const okRes = await http()
        .delete(`/api/v1/folders/${child.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(okRes.status).toBe(204);
    });
  });

  describe("ko'chirish (move) — ltree", () => {
    it("5+ daraja chuqurlikdagi subtree'ni ko'chirish barcha avlodlar path'ini to'g'ri yangilaydi", async () => {
      // A > B > C > D > E > F (6 daraja) + A > G (aka'si)
      const a = await createFolder('deep-a');
      const b = await createFolder('deep-b', a.id);
      const c = await createFolder('deep-c', b.id);
      const d = await createFolder('deep-d', c.id);
      const e = await createFolder('deep-e', d.id);
      const f = await createFolder('deep-f', e.id);
      const g = await createFolder('deep-g', a.id);

      // C (D,E,F avlodlari bilan) — B ostidan G ostiga ko'chiriladi
      const moveRes = await http()
        .post(`/api/v1/folders/${c.id}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parentId: g.id, sortOrder: 0 });
      expect(moveRes.status).toBe(200);
      expect(moveRes.body.parentId).toBe(g.id);

      const rows = await db.$queryRaw<{ id: string; path: string }[]>`
        SELECT id, path::text as path FROM folders WHERE id = ANY(${[c.id, d.id, e.id, f.id]}::uuid[])
      `;
      const byId = new Map(rows.map((r) => [r.id, r.path]));

      const gPath = (
        await db.$queryRaw<{ path: string }[]>`SELECT path::text as path FROM folders WHERE id = ${g.id}::uuid`
      )[0].path;
      const cSeg = c.id.replaceAll('-', '_');
      const dSeg = d.id.replaceAll('-', '_');
      const eSeg = e.id.replaceAll('-', '_');
      const fSeg = f.id.replaceAll('-', '_');

      expect(byId.get(c.id)).toBe(`${gPath}.${cSeg}`);
      expect(byId.get(d.id)).toBe(`${gPath}.${cSeg}.${dSeg}`);
      expect(byId.get(e.id)).toBe(`${gPath}.${cSeg}.${dSeg}.${eSeg}`);
      expect(byId.get(f.id)).toBe(`${gPath}.${cSeg}.${dSeg}.${eSeg}.${fSeg}`);

      // D hali ham C'ning bolasi sifatida ko'rinadi (parent_id o'zgarmagan)
      const childrenRes = await http()
        .get(`/api/v1/folders/tree?parentId=${c.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(childrenRes.body.map((x: FolderNode) => x.id)).toEqual([d.id]);
    });

    it("papkani o'z avlodi ichiga ko'chirish taqiqlanadi — 409", async () => {
      const parent = await createFolder('cycle-parent');
      const child = await createFolder('cycle-child', parent.id);

      const res = await http()
        .post(`/api/v1/folders/${parent.id}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parentId: child.id, sortOrder: 0 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it("papkani o'ziga ko'chirish taqiqlanadi — 409", async () => {
      const folder = await createFolder('self-move');
      const res = await http()
        .post(`/api/v1/folders/${folder.id}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parentId: folder.id, sortOrder: 0 });
      expect(res.status).toBe(409);
    });
  });

  describe('unumdorlik', () => {
    it('1000 papkali tree 500ms dan kam vaqtda yuklanadi', async () => {
      const perfTag = `perf-${testTag}`;
      const rows = Array.from({ length: 1000 }, (_, n) => {
        const id = randomUUID();
        const seg = id.replaceAll('-', '_');
        return Prisma.sql`(${id}::uuid, ${orgId}::uuid, ${`${perfTag}-${n}`}, ${seg}::ltree, ${n}, now(), now())`;
      });
      await db.$executeRaw`
        INSERT INTO folders (id, org_id, name, path, sort_order, created_at, updated_at)
        VALUES ${Prisma.join(rows)}
      `;

      const start = performance.now();
      const res = await http().get('/api/v1/folders/tree').set('Authorization', `Bearer ${adminToken}`);
      const durationMs = performance.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1000);
      expect(durationMs).toBeLessThan(500);

      await db.folder.deleteMany({ where: { name: { contains: perfTag } } });
    });
  });
});
