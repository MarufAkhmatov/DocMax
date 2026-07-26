import { Injectable } from '@nestjs/common';
import type { AuditAction, DashboardStats, RecentActivityItem } from '@docmax/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const RECENT_ACTIVITY_LIMIT = 8;
const OVERDUE_DAYS = 5;
const RECENT_ACTIVITY_ENTITY_TYPES = ['Document', 'DocumentVersion', 'DocumentRelation'];

/** TZ-2 §2.7 — Dashboard statistikasi (avval hardcoded 482/396 raqamlar edi). */
@Injectable()
export class StatsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  async dashboard(): Promise<DashboardStats> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const overdueThreshold = new Date(now.getTime() - OVERDUE_DAYS * 24 * 60 * 60 * 1000);

    const [
      totalDocuments,
      totalFolders,
      activeDocuments,
      activeDocumentsThisMonth,
      pendingApproval,
      pendingApprovalOverdue,
      newExternalActs,
      recentActivityRows,
    ] = await Promise.all([
      this.tenant.client.document.count({ where: { deletedAt: null } }),
      this.tenant.client.folder.count({ where: { deletedAt: null } }),
      this.tenant.client.document.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.tenant.client.document.count({
        where: { deletedAt: null, status: 'ACTIVE', updatedAt: { gte: monthStart } },
      }),
      this.tenant.client.document.count({ where: { deletedAt: null, status: 'IN_REVIEW' } }),
      this.tenant.client.document.count({
        where: { deletedAt: null, status: 'IN_REVIEW', updatedAt: { lte: overdueThreshold } },
      }),
      // external_acts org-scoped emas (tenant-scope.ts) — barcha org uchun umumiy, M11 scraper qo'shilgach real qiymat beradi.
      this.prisma.externalAct.count({ where: { status: 'NEW' } }),
      this.tenant.client.auditLog.findMany({
        where: { entityType: { in: RECENT_ACTIVITY_ENTITY_TYPES }, action: { in: ['CREATE', 'UPDATE'] } },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
      }),
    ]);

    const recentActivity: RecentActivityItem[] = recentActivityRows.map((r) => ({
      id: r.id,
      action: r.action as AuditAction,
      entityType: r.entityType,
      entityId: r.entityId,
      userName: r.user?.fullName ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      totalDocuments,
      totalFolders,
      activeDocuments,
      activeDocumentsThisMonth,
      pendingApproval,
      pendingApprovalOverdue,
      newExternalActs,
      recentActivity,
    };
  }
}
