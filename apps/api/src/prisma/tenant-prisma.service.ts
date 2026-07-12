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
 * Faqat JwtAuthGuard'dan o'tgan (req.user mavjud) yo'llarda inject qilinadi.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  public readonly client: ReturnType<typeof forOrg>;

  constructor(@Inject(REQUEST) request: Request, prisma: PrismaService) {
    const user = (request as AuthenticatedRequest).user;
    if (!user) {
      throw unauthorized();
    }
    this.client = forOrg(prisma, user.orgId);
  }
}
