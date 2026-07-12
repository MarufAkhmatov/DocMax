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
import type { AccessTokenPayload } from '@docmax/shared';
import { AppModule } from '../app.module';
import { hashToken } from './token.util';

/**
 * TZ-1 §1.1 qabul mezonlari:
 *  1. Muddati o'tgan invite havolasi aniq xato beradi
 *  2. Refresh token o'g'irlanganda rotation reuse-detection sessiyani bekor qiladi
 *  3. VIEWER hech qanday mutatsion (ADMIN/EDITOR-only) endpointga kira olmaydi
 *
 * Eslatma: /setup faqat bo'sh bazada ishlaydi, lekin lokal dev DB'da demo-seed org
 * allaqachon mavjud — shuning uchun bu yerda /setup'ning "allaqachon sozlangan"
 * (409) shoxobchasi tekshiriladi; bo'sh-baza ssenariysi milestone 2 seed oqimi
 * orqali qo'lda tasdiqlangan.
 *
 * Login endpoint 5/min/IP bilan cheklangan (TZ-0 §7) — shuning uchun faqat LOGIN'ning
 * o'zini tekshiradigan testlar haqiqiy POST /auth/login chaqiradi; boshqa testlar uchun
 * kerakli foydalanuvchi token'i to'g'ridan-to'g'ri JwtService bilan imzolanadi.
 */
describe('Auth (e2e) — TZ-1 §1.1', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let jwt: JwtService;
  let config: ConfigService;
  let orgId: string;
  const password = 'Password123!';
  const testEmailSuffix = `e2e-${randomUUID()}.test.docmax.local`;

  const http = () => request(app.getHttpServer());

  async function createUser(role: 'ADMIN' | 'EDITOR' | 'VIEWER', label: string): Promise<User> {
    const email = `${label}-${randomUUID()}@${testEmailSuffix}`;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    return db.user.create({ data: { orgId, email, passwordHash, fullName: `E2E ${label}`, role } });
  }

  async function signToken(user: Pick<User, 'id' | 'orgId' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, orgId: user.orgId, role: user.role };
    return jwt.signAsync(payload, {
      secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
  }

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
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { contains: testEmailSuffix } } });
    await db.$disconnect();
    await app.close();
  });

  describe('/setup', () => {
    it("org allaqachon mavjud bo'lsa 409 CONFLICT qaytaradi", async () => {
      const res = await http()
        .post('/api/v1/auth/setup')
        .send({
          orgName: 'Test Org',
          orgSlug: `x-${randomUUID()}`,
          fullName: 'X Y',
          email: `x-${randomUUID()}@${testEmailSuffix}`,
          password,
        });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('login', () => {
    it("to'g'ri email+parol bilan accessToken va refresh cookie qaytaradi", async () => {
      const user = await createUser('EDITOR', 'login-ok');
      const res = await http().post('/api/v1/auth/login').send({ email: user.email, password });

      expect(res.status).toBe(200);
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.headers['set-cookie']?.[0]).toMatch(/docmax_refresh=/);
    });

    it("noto'g'ri parol bilan 401 UNAUTHORIZED qaytaradi", async () => {
      const user = await createUser('EDITOR', 'login-bad');
      const res = await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'notthepassword' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('refresh token — rotation + reuse detection', () => {
    it("ishlatilgan (revoked) refresh token qayta yuborilsa butun sessiya oilasi bekor qilinadi", async () => {
      const user = await createUser('EDITOR', 'refresh');
      const loginRes = await http().post('/api/v1/auth/login').send({ email: user.email, password });
      const originalCookies = loginRes.headers['set-cookie'] as unknown as string[];

      const firstRefresh = await http().post('/api/v1/auth/refresh').set('Cookie', originalCookies);
      expect(firstRefresh.status).toBe(200);
      const rotatedCookies = firstRefresh.headers['set-cookie'] as unknown as string[];

      // Eski (allaqachon rotatsiya qilingan) token bilan qayta urinish — reuse
      const reuseAttempt = await http().post('/api/v1/auth/refresh').set('Cookie', originalCookies);
      expect(reuseAttempt.status).toBe(401);

      // Reuse aniqlangach, YANGI (legitim) token ham endi ishlamasligi kerak —
      // butun familyId bekor qilingan bo'lishi shart
      const afterReuseDetected = await http().post('/api/v1/auth/refresh').set('Cookie', rotatedCookies);
      expect(afterReuseDetected.status).toBe(401);
    });
  });

  describe("invite — muddati o'tgan havola", () => {
    it('aniq EXPIRED xatosi beradi (410)', async () => {
      const admin = await createUser('ADMIN', 'invite-admin');
      const adminToken = await signToken(admin);
      const inviteEmail = `invitee-${randomUUID()}@${testEmailSuffix}`;

      await http()
        .post('/api/v1/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: inviteEmail, fullName: 'Invitee', role: 'EDITOR' })
        .expect(201);

      const rawToken = `e2e-${randomUUID()}`;
      const invitedUser = await db.user.findFirstOrThrow({ where: { email: inviteEmail } });
      await db.user.update({
        where: { id: invitedUser.id },
        data: { inviteToken: hashToken(rawToken), inviteExpiresAt: new Date(Date.now() - 1000) },
      });

      const validateRes = await http().get(`/api/v1/auth/invite/${rawToken}`);
      expect(validateRes.status).toBe(410);
      expect(validateRes.body.error.code).toBe('EXPIRED');

      const acceptRes = await http()
        .post(`/api/v1/auth/invite/${rawToken}/accept`)
        .send({ password: 'AnotherPassword123!' });
      expect(acceptRes.status).toBe(410);
      expect(acceptRes.body.error.code).toBe('EXPIRED');
    });
  });

  describe('ruxsat matritsasi — VIEWER (TZ-1 §1.1)', () => {
    it('VIEWER ADMIN-only mutatsion endpointga (invite) kira olmaydi — 403', async () => {
      const viewer = await createUser('VIEWER', 'viewer-blocked');
      const viewerToken = await signToken(viewer);

      const res = await http()
        .post('/api/v1/auth/invite')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ email: `x-${randomUUID()}@${testEmailSuffix}`, fullName: 'X', role: 'EDITOR' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it("VIEWER o'z profilini yangilay oladi (o'z-o'ziga xizmat, matritsada cheklanmagan)", async () => {
      const viewer = await createUser('VIEWER', 'viewer-self');
      const viewerToken = await signToken(viewer);

      const res = await http()
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ locale: 'ru' });

      expect(res.status).toBe(200);
      expect(res.body.locale).toBe('ru');
    });

    it("token'siz mutatsion endpointga kirish 401 qaytaradi", async () => {
      const res = await http().patch('/api/v1/auth/profile').send({ locale: 'en' });
      expect(res.status).toBe(401);
    });
  });
});
