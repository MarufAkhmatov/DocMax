import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import type { Response } from 'express';
import type { User } from '@docmax/db';
import type {
  AccessTokenPayload,
  AcceptInviteInput,
  AuthUser,
  ForgotPasswordInput,
  InviteInput,
  LoginInput,
  ResetPasswordInput,
  SetupInput,
  UpdateProfileInput,
} from '@docmax/shared';
import { conflict, expired, notFound, unauthorized } from '../common/api-error';
import { MailerService } from '../mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from './types';
import { addDays, addHours, generateRawToken, hashToken } from './token.util';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 14;
const INVITE_TTL_HOURS = 72;
const RESET_TTL_HOURS = 1;

export const REFRESH_COOKIE_NAME = 'docmax_refresh';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    locale: user.locale,
    theme: user.theme,
  };
}

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  private get webOrigin(): string {
    return this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000');
  }

  private async signAccessToken(user: Pick<User, 'id' | 'orgId' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, orgId: user.orgId, role: user.role };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });
  }

  private setRefreshCookie(res: Response, rawToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private async issueSession(
    user: Pick<User, 'id' | 'orgId' | 'role'>,
    familyId: string,
    meta: RequestMeta,
  ) {
    const accessToken = await this.signAccessToken(user);
    const rawRefreshToken = generateRawToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: addDays(new Date(), REFRESH_TOKEN_TTL_DAYS),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return { accessToken, rawRefreshToken };
  }

  /** /setup — faqat bo'sh bazada (TZ-1 §1.1). MVP: rol ADMIN (SUPER_ADMIN Bosqich 2'da faollashadi). */
  async setup(input: SetupInput) {
    const orgCount = await this.prisma.organization.count();
    if (orgCount > 0) {
      throw conflict('Tizim allaqachon sozlangan');
    }
    const slugTaken = await this.prisma.organization.findUnique({ where: { slug: input.orgSlug } });
    if (slugTaken) {
      throw conflict("Bu slug band, boshqa nom tanlang");
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const org = await this.prisma.organization.create({
      data: { name: input.orgName, slug: input.orgSlug },
    });
    const user = await this.prisma.user.create({
      data: {
        orgId: org.id,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: 'ADMIN',
      },
    });
    return { org: { id: org.id, name: org.name, slug: org.slug }, user: toAuthUser(user) };
  }

  /** Faqat ADMIN (RolesGuard) — TZ-1 §1.1 ruxsat matritsasi */
  async invite(actingUser: RequestUser, input: InviteInput) {
    const existing = await this.prisma.user.findFirst({
      where: { orgId: actingUser.orgId, email: input.email },
    });
    if (existing) {
      throw conflict("Bu email bilan foydalanuvchi allaqachon mavjud");
    }

    const rawToken = generateRawToken();
    const user = await this.prisma.user.create({
      data: {
        orgId: actingUser.orgId,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        invitedBy: actingUser.sub,
        inviteToken: hashToken(rawToken),
        inviteExpiresAt: addHours(new Date(), INVITE_TTL_HOURS),
      },
    });

    await this.mailer.sendInvite(input.email, input.fullName, `${this.webOrigin}/invite/${rawToken}`);
    return { id: user.id, email: user.email, role: user.role };
  }

  /** Havola haqiqiyligini tekshiradi — muddati o'tgan bo'lsa aniq EXPIRED xatosi (qabul mezoni) */
  async validateInvite(rawToken: string) {
    const user = await this.prisma.user.findFirst({ where: { inviteToken: hashToken(rawToken) } });
    if (!user) {
      throw notFound('Taklif havolasi topilmadi');
    }
    if (!user.inviteExpiresAt || user.inviteExpiresAt.getTime() < Date.now()) {
      throw expired("Taklif havolasining muddati tugagan, admin'dan qayta taklif so'rang");
    }
    return { email: user.email, fullName: user.fullName };
  }

  async acceptInvite(rawToken: string, input: AcceptInviteInput) {
    const user = await this.prisma.user.findFirst({ where: { inviteToken: hashToken(rawToken) } });
    if (!user) {
      throw notFound('Taklif havolasi topilmadi');
    }
    if (!user.inviteExpiresAt || user.inviteExpiresAt.getTime() < Date.now()) {
      throw expired("Taklif havolasining muddati tugagan, admin'dan qayta taklif so'rang");
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, inviteToken: null, inviteExpiresAt: null },
    });
    return { success: true };
  }

  async login(input: LoginInput, meta: RequestMeta, res: Response) {
    // MVP soddalashtirish: email global qidiriladi (bitta org context taxmin qilinadi).
    // Multi-org login (subdomain/org tanlash) TZ-4'da qo'shiladi.
    const user = await this.prisma.user.findFirst({ where: { email: input.email } });
    if (!user || !user.passwordHash || !user.isActive) {
      throw unauthorized("Email yoki parol noto'g'ri");
    }
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw unauthorized("Email yoki parol noto'g'ri");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { accessToken, rawRefreshToken } = await this.issueSession(user, randomUUID(), meta);
    this.setRefreshCookie(res, rawRefreshToken);
    return { accessToken, user: toAuthUser(user) };
  }

  /**
   * Rotating refresh token + reuse-detection (TZ-1 §1.1 qabul mezoni): agar
   * allaqachon ishlatilgan (revoked) token qayta yuborilsa — token o'g'irlangan
   * deb hisoblanadi va butun sessiya oilasi (familyId) bekor qilinadi.
   */
  async refresh(rawToken: string | undefined, meta: RequestMeta, res: Response) {
    if (!rawToken) {
      throw unauthorized();
    }
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record) {
      throw unauthorized();
    }

    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw unauthorized('Sessiya buzilgan deb topildi — qayta kiring');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw unauthorized('Sessiya muddati tugagan');
    }
    if (!record.user.isActive) {
      throw unauthorized();
    }

    const newRawToken = generateRawToken();
    const newTokenHash = hashToken(newRawToken);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date(), replacedByHash: newTokenHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: record.userId,
          familyId: record.familyId,
          tokenHash: newTokenHash,
          expiresAt: addDays(new Date(), REFRESH_TOKEN_TTL_DAYS),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      }),
    ]);

    const accessToken = await this.signAccessToken(record.user);
    this.setRefreshCookie(res, newRawToken);
    return { accessToken };
  }

  async logout(rawToken: string | undefined, res: Response) {
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return { success: true };
  }

  /** Foydalanuvchi mavjudligini oshkor qilmaslik uchun har doim bir xil javob qaytaradi. */
  async forgotPassword(input: ForgotPasswordInput) {
    const user = await this.prisma.user.findFirst({ where: { email: input.email, isActive: true } });
    if (user) {
      const rawToken = generateRawToken();
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: addHours(new Date(), RESET_TTL_HOURS) },
      });
      await this.mailer.sendPasswordReset(user.email, `${this.webOrigin}/reset-password/${rawToken}`);
    }
    return { success: true };
  }

  async resetPassword(rawToken: string, input: ResetPasswordInput) {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw expired('Havola yaroqsiz yoki muddati tugagan');
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Parol tiklanganda barcha mavjud sessiyalar bekor qilinadi (xavfsizlik)
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId } });
    return toAuthUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: input });
    return toAuthUser(user);
  }
}
