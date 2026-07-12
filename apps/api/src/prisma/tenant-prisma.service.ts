import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { forOrg } from '@docmax/db';
import { unauthorized } from '../common/api-error';
import { PrismaService } from './prisma.service';
import type { AuthenticatedRequest } from '../auth/types';

/**
 * So'rov-darajali (request-scoped), joriy foydalanuvchining org_id'i bilan
 * cheklangan Prisma client (CLAUDE.md 1-qoida — packages/db/src/tenant-client.ts).
 *
 * `.client` LAZY getter sifatida yozilgan: NestJS request-scoped provider'larni
 * controller uchun konstruktor bosqichida tayyorlaydi — bu global guard'lar
 * (JwtAuthGuard) `req.user`ni to'ldirishidan OLDIN sodir bo'lishi mumkin. Shuning
 * uchun `req.user` tekshiruvi konstruktorda emas, faqat `.client` haqiqatan
 * ishlatilganda (har doim guard'lardan keyin, controller metodi ichida) bajariladi.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly prisma: PrismaService,
  ) {}

  get client(): ReturnType<typeof forOrg> {
    const user = (this.request as AuthenticatedRequest).user;
    if (!user) {
      throw unauthorized();
    }
    return forOrg(this.prisma, user.orgId);
  }
}
