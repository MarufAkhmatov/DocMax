import { Injectable } from '@nestjs/common';
import type { Prisma } from '@docmax/db';
import type { AuditAction, AuditLogEntry, ListAuditLogsQuery, PaginatedAuditLogs } from '@docmax/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const AUDIT_LOG_INCLUDE = { user: { select: { fullName: true } } } satisfies Prisma.AuditLogInclude;
type AuditLogWithUser = Prisma.AuditLogGetPayload<{ include: typeof AUDIT_LOG_INCLUDE }>;

function toEntry(row: AuditLogWithUser): AuditLogEntry {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user?.fullName ?? null,
    action: row.action as AuditAction,
    entityType: row.entityType,
    entityId: row.entityId,
    meta: (row.meta ?? {}) as Record<string, unknown>,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  };
}

/** TZ-2 §2.7 — Audit log sahifasi (faqat ADMIN, controller darajasida cheklangan). */
@Injectable()
export class AuditLogsService {
  constructor(private readonly tenant: TenantPrismaService) {}

  private get auditLog() {
    return this.tenant.client.auditLog;
  }

  private buildWhere(query: ListAuditLogsQuery): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lt: query.to } : {}),
      };
    }
    return where;
  }

  async list(query: ListAuditLogsQuery): Promise<PaginatedAuditLogs> {
    const where = this.buildWhere(query);
    const [rows, total] = await Promise.all([
      this.auditLog.findMany({
        where,
        include: AUDIT_LOG_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.auditLog.count({ where }),
    ]);
    return { items: rows.map(toEntry), total, page: query.page, limit: query.limit };
  }

  /** CSV eksport — sahifalashsiz, maks 10 000 qator (himoya sifatida). */
  async exportCsv(query: ListAuditLogsQuery): Promise<string> {
    const where = this.buildWhere(query);
    const rows = await this.auditLog.findMany({
      where,
      include: AUDIT_LOG_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });
    const header = 'created_at,user,action,entity_type,entity_id,ip';
    const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(),
        csvEscape(r.user?.fullName ?? ''),
        r.action,
        r.entityType,
        r.entityId,
        csvEscape(r.ip ?? ''),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }
}
