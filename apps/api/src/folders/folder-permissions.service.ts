import { Injectable } from '@nestjs/common';
import type { FolderPermissionsSummary, PermissionEntry, SetFolderPermissionsInput } from '@docmax/shared';
import { notFound } from '../common/api-error';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMIN: 'Admin',
  EDITOR: 'Muharrir',
  CONTRIBUTOR: "Hissa qo'shuvchi",
  VIEWER: "Ko'ruvchi",
};

/** TZ-2 §2.5 — folder.acl_enabled + Permission qatorlarini boshqarish (CRUD, ADMIN-only).
 * Ruxsat TEKSHIRUVI FolderAccessService'da — bu servis faqat konfiguratsiyani o'qish/yozish. */
@Injectable()
export class FolderPermissionsService {
  constructor(private readonly tenant: TenantPrismaService) {}

  async get(folderId: string): Promise<FolderPermissionsSummary> {
    const folder = await this.tenant.client.folder.findFirst({ where: { id: folderId, deletedAt: null } });
    if (!folder) {
      throw notFound('Papka topilmadi');
    }
    const rows = await this.tenant.client.permission.findMany({ where: { folderId }, orderBy: { createdAt: 'asc' } });
    const entries = await this.toEntries(rows);
    return { folderId, aclEnabled: folder.aclEnabled, entries };
  }

  /** `orgId` boshqa tenant-scoped createMany chaqiruvlaridagi kabi (NotificationsService.notifyUsers)
   * qo'lda beriladi — extension buni runtime'da qayta yozadi, lekin Prisma generatsiya qilingan
   * tipi bu maydonni majburiy deb biladi. */
  async set(orgId: string, folderId: string, input: SetFolderPermissionsInput): Promise<FolderPermissionsSummary> {
    const folder = await this.tenant.client.folder.findFirst({ where: { id: folderId, deletedAt: null } });
    if (!folder) {
      throw notFound('Papka topilmadi');
    }

    await this.tenant.client.$transaction([
      this.tenant.client.folder.update({ where: { id: folderId }, data: { aclEnabled: input.enabled } }),
      this.tenant.client.permission.deleteMany({ where: { folderId } }),
      ...(input.entries.length
        ? [
            this.tenant.client.permission.createMany({
              data: input.entries.map((e) => ({
                orgId,
                folderId,
                subjectType: e.subjectType,
                subjectId: e.subjectId,
                canView: e.canView,
                canEdit: e.canEdit,
                canDownload: e.canDownload,
                inherit: e.inherit,
              })),
            }),
          ]
        : []),
    ]);

    return this.get(folderId);
  }

  private async toEntries(
    rows: { id: string; subjectType: 'ROLE' | 'USER' | 'ORG_UNIT'; subjectId: string; canView: boolean; canEdit: boolean; canDownload: boolean; inherit: boolean }[],
  ): Promise<PermissionEntry[]> {
    const userIds = rows.filter((r) => r.subjectType === 'USER').map((r) => r.subjectId);
    const orgUnitIds = rows.filter((r) => r.subjectType === 'ORG_UNIT').map((r) => r.subjectId);
    const [users, orgUnits] = await Promise.all([
      userIds.length ? this.tenant.client.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
      orgUnitIds.length
        ? this.tenant.client.orgUnit.findMany({ where: { id: { in: orgUnitIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    const userNameMap = new Map(users.map((u) => [u.id, u.fullName]));
    const orgUnitNameMap = new Map(orgUnits.map((u) => [u.id, u.name]));

    return rows.map((r) => ({
      id: r.id,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      subjectLabel:
        r.subjectType === 'ROLE'
          ? (ROLE_LABELS[r.subjectId] ?? r.subjectId)
          : r.subjectType === 'USER'
            ? (userNameMap.get(r.subjectId) ?? r.subjectId)
            : (orgUnitNameMap.get(r.subjectId) ?? r.subjectId),
      canView: r.canView,
      canEdit: r.canEdit,
      canDownload: r.canDownload,
      inherit: r.inherit,
    }));
  }
}
