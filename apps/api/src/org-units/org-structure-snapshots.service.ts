import { Injectable } from '@nestjs/common';
import type { Prisma } from '@docmax/db';
import type { OrgStructureSnapshotDetail, OrgStructureSnapshotSummary } from '@docmax/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/** TZ-2 §2.4 — har bir strukturaviy o'zgarishdan KEYIN (mutatsiya committed bo'lgach)
 * to'liq org-unit daraxti + papka mapping holati saqlanadi (faqat o'qish uchun,
 * tiklash yo'q). Audit yozuvi kabi best-effort: mutatsiya bilan bitta tranzaksiyada
 * emas (AuditInterceptor ham xuddi shunday — asosiy amaldan alohida). */
@Injectable()
export class OrgStructureSnapshotsService {
  constructor(private readonly tenant: TenantPrismaService) {}

  async capture(orgId: string, reason: string, triggeredBy?: string, orgUnitId?: string): Promise<void> {
    const data = await this.buildPayload();
    await this.tenant.client.orgStructureSnapshot.create({
      data: {
        orgId,
        reason,
        triggeredBy,
        orgUnitId,
        data: data as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async buildPayload() {
    const [orgUnits, folders] = await Promise.all([
      this.tenant.client.orgUnit.findMany({
        select: { id: true, parentId: true, name: true, code: true, headUserId: true, sortOrder: true, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.tenant.client.folder.findMany({
        where: { orgUnitId: { not: null }, deletedAt: null },
        select: { id: true, name: true, orgUnitId: true },
      }),
    ]);
    return {
      orgUnits,
      folderMappings: folders.map((f) => ({ folderId: f.id, folderName: f.name, orgUnitId: f.orgUnitId as string })),
    };
  }

  async list(page: number, limit: number): Promise<{ items: OrgStructureSnapshotSummary[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.tenant.client.orgStructureSnapshot.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { triggeredByUser: { select: { fullName: true } } },
      }),
      this.tenant.client.orgStructureSnapshot.count(),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        reason: r.reason,
        orgUnitId: r.orgUnitId,
        triggeredByName: r.triggeredByUser?.fullName ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  }

  /** `date` (YYYY-MM-DD) kuni oxiriga qadar yaratilgan ENG SO'NGGI snapshot — "N-sana holati". */
  async atDate(date: string): Promise<OrgStructureSnapshotDetail | null> {
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    const row = await this.tenant.client.orgStructureSnapshot.findFirst({
      where: { createdAt: { lte: endOfDay } },
      orderBy: { createdAt: 'desc' },
      include: { triggeredByUser: { select: { fullName: true } } },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      reason: row.reason,
      orgUnitId: row.orgUnitId,
      triggeredByName: row.triggeredByUser?.fullName ?? null,
      createdAt: row.createdAt.toISOString(),
      data: row.data as unknown as OrgStructureSnapshotDetail['data'],
    };
  }
}
