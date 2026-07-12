import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs';
import type { Prisma } from '@docmax/db';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/types';
import { getAuditContext } from './audit-context';

/**
 * Mutatsion endpointlar audit_log'ni avtomatik yozadi (CLAUDE.md 3-qoida) —
 * servislar `setAuditContext()` bilan niyatni belgilaydi, haqiqiy INSERT shu
 * yerda, bitta joyda amalga oshadi. audit_logs append-only bo'lgani uchun bu
 * yerda faqat create ishlatiladi.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      tap(() => {
        const ctx = getAuditContext(request);
        if (!ctx) {
          return;
        }
        this.prisma.auditLog
          .create({
            data: {
              orgId: ctx.orgId,
              userId: ctx.userId,
              action: ctx.action,
              entityType: ctx.entityType,
              entityId: ctx.entityId,
              meta: (ctx.meta ?? {}) as Prisma.InputJsonValue,
              ip: request.ip,
              userAgent: request.headers['user-agent'],
            },
          })
          .catch((err: unknown) => {
            // Audit yozib bo'lmasligi asosiy so'rov natijasini to'xtatmasin.
            this.logger.error(`Audit yozib bo'lmadi: ${String(err)}`);
          });
      }),
    );
  }
}
