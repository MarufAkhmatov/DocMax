import { Injectable } from '@nestjs/common';
import type { OrgUnit, Prisma } from '@docmax/db';
import type {
  CloseOrgUnitInput,
  CreateOrgUnitInput,
  MoveOrgUnitInput,
  OrgUnitFolderSummary,
  OrgUnitNode,
  RemapPreviewEntry,
  UpdateOrgUnitInput,
} from '@docmax/shared';
import { FoldersService } from '../folders/folders.service';
import { conflict, notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrgStructureSnapshotsService } from './org-structure-snapshots.service';

const ARCHIVE_FOLDER_NAME = 'Arxiv strukturalar';

function toOrgUnitNode(
  unit: OrgUnit,
  hasChildren: boolean,
  headUserName: string | null,
  folders: OrgUnitFolderSummary[],
): OrgUnitNode {
  return {
    id: unit.id,
    orgId: unit.orgId,
    parentId: unit.parentId,
    name: unit.name,
    code: unit.code,
    headUserId: unit.headUserId,
    headUserName,
    sortOrder: unit.sortOrder,
    isActive: unit.isActive,
    hasChildren,
    folders,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrgUnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
    private readonly folders: FoldersService,
    private readonly snapshots: OrgStructureSnapshotsService,
  ) {}

  private get unit() {
    return this.tenant.client.orgUnit;
  }

  async getTree(orgId: string, parentId: string | null, q?: string): Promise<OrgUnitNode[]> {
    const units = q
      ? await this.unit.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, orderBy: { name: 'asc' } })
      : await this.unit.findMany({ where: { parentId }, orderBy: { sortOrder: 'asc' } });

    if (units.length === 0) {
      return [];
    }

    const ids = units.map((u) => u.id);
    const headUserIds = units.map((u) => u.headUserId).filter((id): id is string => !!id);

    const [childRows, headUsers, mappedFolders] = await Promise.all([
      this.unit.findMany({ where: { parentId: { in: ids } }, select: { parentId: true }, distinct: ['parentId'] }),
      headUserIds.length
        ? this.tenant.client.user.findMany({ where: { id: { in: headUserIds } }, select: { id: true, fullName: true } })
        : Promise.resolve([]),
      this.tenant.client.folder.findMany({
        where: { orgUnitId: { in: ids }, deletedAt: null },
        select: { id: true, name: true, orgUnitId: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const hasChildrenSet = new Set(childRows.map((c) => c.parentId));
    const headNameMap = new Map(headUsers.map((u) => [u.id, u.fullName]));
    const docCounts = await this.tenant.client.document.groupBy({
      by: ['folderId'],
      where: { folderId: { in: mappedFolders.map((f) => f.id) }, deletedAt: null },
      _count: { _all: true },
    });
    const docCountMap = new Map(docCounts.map((d) => [d.folderId, d._count._all]));
    const foldersByUnit = new Map<string, OrgUnitFolderSummary[]>();
    for (const f of mappedFolders) {
      const list = foldersByUnit.get(f.orgUnitId as string) ?? [];
      list.push({ id: f.id, name: f.name, documentCount: docCountMap.get(f.id) ?? 0 });
      foldersByUnit.set(f.orgUnitId as string, list);
    }

    return units.map((u) =>
      toOrgUnitNode(u, hasChildrenSet.has(u.id), u.headUserId ? (headNameMap.get(u.headUserId) ?? null) : null, foldersByUnit.get(u.id) ?? []),
    );
  }

  private async assertHeadUserBelongsToOrg(headUserId?: string | null): Promise<void> {
    if (!headUserId) {
      return;
    }
    const user = await this.tenant.client.user.findFirst({ where: { id: headUserId } });
    if (!user) {
      throw notFound('Rahbar sifatida tanlangan foydalanuvchi topilmadi');
    }
  }

  async create(orgId: string, input: CreateOrgUnitInput, triggeredBy: string): Promise<OrgUnitNode> {
    if (input.parentId) {
      const parent = await this.unit.findFirst({ where: { id: input.parentId } });
      if (!parent) {
        throw notFound("Ota bo'linma topilmadi");
      }
    }
    await this.assertHeadUserBelongsToOrg(input.headUserId);

    const maxSort = await this.unit.aggregate({ where: { parentId: input.parentId ?? null }, _max: { sortOrder: true } });
    const created = await this.unit.create({
      data: {
        orgId,
        parentId: input.parentId ?? null,
        name: input.name,
        code: input.code ?? null,
        headUserId: input.headUserId ?? null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    await this.snapshots.capture(orgId, 'UNIT_CREATED', triggeredBy, created.id);
    return toOrgUnitNode(created, false, null, []);
  }

  async update(orgId: string, id: string, input: UpdateOrgUnitInput, triggeredBy: string): Promise<OrgUnitNode> {
    const existing = await this.unit.findFirst({ where: { id } });
    if (!existing) {
      throw notFound("Bo'linma topilmadi");
    }
    await this.assertHeadUserBelongsToOrg(input.headUserId);

    const updated = await this.unit.update({
      where: { id },
      data: {
        name: input.name,
        code: input.code,
        headUserId: input.headUserId,
      },
    });
    await this.snapshots.capture(orgId, 'UNIT_UPDATED', triggeredBy, id);

    const childCount = await this.unit.count({ where: { parentId: id } });
    const headName = updated.headUserId
      ? ((await this.tenant.client.user.findFirst({ where: { id: updated.headUserId }, select: { fullName: true } }))?.fullName ?? null)
      : null;
    return toOrgUnitNode(updated, childCount > 0, headName, []);
  }

  /** Ancestor bo'ylab yurib sikl (unit o'z avlodiga ko'chirilishi) borligini tekshiradi. */
  private async wouldCreateCycle(id: string, newParentId: string | null): Promise<boolean> {
    if (!newParentId) {
      return false;
    }
    if (newParentId === id) {
      return true;
    }
    let cursor: string | null = newParentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === id) {
        return true;
      }
      if (seen.has(cursor)) {
        break; // xavfsizlik: buzilgan ma'lumotda cheksiz aylanishning oldini olish
      }
      seen.add(cursor);
      const row: { parentId: string | null } | null = await this.unit.findFirst({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = row?.parentId ?? null;
    }
    return false;
  }

  async move(orgId: string, id: string, input: MoveOrgUnitInput, triggeredBy: string): Promise<OrgUnitNode> {
    const existing = await this.unit.findFirst({ where: { id } });
    if (!existing) {
      throw notFound("Bo'linma topilmadi");
    }
    if (input.parentId) {
      const parent = await this.unit.findFirst({ where: { id: input.parentId } });
      if (!parent) {
        throw notFound("Yangi ota bo'linma topilmadi");
      }
    }
    if (await this.wouldCreateCycle(id, input.parentId)) {
      throw conflict("Bo'linmani o'z avlodi ichiga ko'chirish mumkin emas");
    }

    const updated = await this.unit.update({ where: { id }, data: { parentId: input.parentId, sortOrder: input.sortOrder } });
    await this.snapshots.capture(orgId, 'UNIT_MOVED', triggeredBy, id);

    const childCount = await this.unit.count({ where: { parentId: id } });
    return toOrgUnitNode(updated, childCount > 0, null, []);
  }

  private async findOrCreateArchiveFolder(orgId: string): Promise<string> {
    const existing = await this.tenant.client.folder.findFirst({
      where: { parentId: null, isSystem: true, name: ARCHIVE_FOLDER_NAME, deletedAt: null },
    });
    if (existing) {
      return existing.id;
    }
    const created = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO folders (id, org_id, parent_id, name, path, sort_order, is_system, created_at, updated_at)
      VALUES (
        gen_random_uuid(), ${orgId}::uuid, NULL, ${ARCHIVE_FOLDER_NAME},
        ('arxiv_strukturalar_' || substr(md5(random()::text), 1, 8))::ltree,
        (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM folders WHERE org_id = ${orgId}::uuid AND parent_id IS NULL AND deleted_at IS NULL),
        true, now(), now()
      )
      RETURNING id
    `;
    return created[0].id;
  }

  async close(orgId: string, id: string, input: CloseOrgUnitInput, triggeredBy: string): Promise<OrgUnitNode> {
    const existing = await this.unit.findFirst({ where: { id } });
    if (!existing) {
      throw notFound("Bo'linma topilmadi");
    }

    if (input.moveFoldersToArchive) {
      const archiveId = await this.findOrCreateArchiveFolder(orgId);
      const mapped = await this.tenant.client.folder.findMany({
        where: { orgUnitId: id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      if (mapped.length > 0) {
        const maxSort = await this.tenant.client.folder.aggregate({
          where: { parentId: archiveId, deletedAt: null },
          _max: { sortOrder: true },
        });
        let nextSort = (maxSort._max.sortOrder ?? -1) + 1;
        for (const folder of mapped) {
          await this.folders.move(orgId, folder.id, { parentId: archiveId, sortOrder: nextSort++ });
          await this.tenant.client.folder.update({ where: { id: folder.id }, data: { orgUnitId: null } });
        }
      }
    }

    const updated = await this.unit.update({ where: { id }, data: { isActive: false } });
    await this.snapshots.capture(orgId, 'UNIT_CLOSED', triggeredBy, id);
    return toOrgUnitNode(updated, false, null, []);
  }

  async reopen(orgId: string, id: string, triggeredBy: string): Promise<OrgUnitNode> {
    const existing = await this.unit.findFirst({ where: { id } });
    if (!existing) {
      throw notFound("Bo'linma topilmadi");
    }
    const updated = await this.unit.update({ where: { id }, data: { isActive: true } });
    await this.snapshots.capture(orgId, 'UNIT_REOPENED', triggeredBy, id);
    return toOrgUnitNode(updated, false, null, []);
  }

  // ---------- Remapping wizard (TZ-2 §2.4) ----------

  /** Har unit uchun "vakil" papka — bir nechta mapping bo'lsa eng birinchi yaratilgani
   * (odatiy holatda unit<->papka 1:1). Soddalashtirish qasddan — TZ matnida ko'p-ko'p
   * mapping ssenariysi tavsiflanmagan. */
  private async loadCanonicalFolderByUnit(): Promise<Map<string, { id: string; name: string; parentId: string | null }>> {
    const folders = await this.tenant.client.folder.findMany({
      where: { orgUnitId: { not: null }, deletedAt: null },
      select: { id: true, name: true, parentId: true, orgUnitId: true },
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, { id: string; name: string; parentId: string | null }>();
    for (const f of folders) {
      const unitId = f.orgUnitId as string;
      if (!map.has(unitId)) {
        map.set(unitId, { id: f.id, name: f.name, parentId: f.parentId });
      }
    }
    return map;
  }

  private buildFolderBreadcrumb(folderId: string | null, foldersById: Map<string, { name: string; parentId: string | null }>): string {
    if (!folderId) {
      return 'Vault (ildiz)';
    }
    const names: string[] = [];
    let cursor: string | null = folderId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const f = foldersById.get(cursor);
      if (!f) {
        break;
      }
      names.unshift(f.name);
      cursor = f.parentId;
    }
    return names.join(' > ') || 'Vault (ildiz)';
  }

  async remapPreview(orgId: string, id: string): Promise<RemapPreviewEntry[]> {
    const root = await this.unit.findFirst({ where: { id } });
    if (!root) {
      throw notFound("Bo'linma topilmadi");
    }

    const [allUnits, canonicalFolderByUnit, allFolders] = await Promise.all([
      this.unit.findMany({ select: { id: true, parentId: true } }),
      this.loadCanonicalFolderByUnit(),
      this.tenant.client.folder.findMany({ where: { deletedAt: null }, select: { id: true, name: true, parentId: true } }),
    ]);
    const foldersById = new Map(allFolders.map((f) => [f.id, { name: f.name, parentId: f.parentId }]));
    const unitParentMap = new Map(allUnits.map((u) => [u.id, u.parentId]));

    // U + barcha avlodlari (BFS)
    const subtree = new Set<string>([id]);
    let frontier = [id];
    while (frontier.length > 0) {
      const children = allUnits.filter((u) => u.parentId && frontier.includes(u.parentId)).map((u) => u.id);
      frontier = children.filter((c) => !subtree.has(c));
      frontier.forEach((c) => subtree.add(c));
    }

    const entries: RemapPreviewEntry[] = [];
    for (const unitId of subtree) {
      const folder = canonicalFolderByUnit.get(unitId);
      if (!folder) {
        continue;
      }
      // Nearest ancestor (unit tree) with a mapped folder — starting from this unit's parent.
      let cursor = unitParentMap.get(unitId) ?? null;
      let proposed: { id: string; name: string; parentId: string | null } | undefined;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const candidate = canonicalFolderByUnit.get(cursor);
        if (candidate) {
          proposed = candidate;
          break;
        }
        cursor = unitParentMap.get(cursor) ?? null;
      }

      const proposedParentId = proposed?.id ?? null;
      entries.push({
        folderId: folder.id,
        folderName: folder.name,
        currentParentId: folder.parentId,
        currentPathLabel: this.buildFolderBreadcrumb(folder.parentId, foldersById),
        proposedParentId,
        proposedPathLabel: this.buildFolderBreadcrumb(proposedParentId, foldersById),
        unchanged: folder.parentId === proposedParentId,
      });
    }

    return entries;
  }

  async remapApply(orgId: string, id: string, moves: { folderId: string; newParentId: string | null }[], triggeredBy: string): Promise<void> {
    const existing = await this.unit.findFirst({ where: { id } });
    if (!existing) {
      throw notFound("Bo'linma topilmadi");
    }

    const sortCounters = new Map<string, number>();
    const allStatements: Prisma.PrismaPromise<unknown>[] = [];
    for (const move of moves) {
      const key = move.newParentId ?? '__root__';
      if (!sortCounters.has(key)) {
        const agg = await this.tenant.client.folder.aggregate({
          where: { parentId: move.newParentId, deletedAt: null },
          _max: { sortOrder: true },
        });
        sortCounters.set(key, agg._max.sortOrder ?? -1);
      }
      const nextSort = (sortCounters.get(key) ?? -1) + 1;
      sortCounters.set(key, nextSort);

      const statements = await this.folders.buildMoveStatements(orgId, move.folderId, {
        parentId: move.newParentId,
        sortOrder: nextSort,
      });
      allStatements.push(...statements);
    }

    await this.prisma.$transaction(allStatements);
    await this.snapshots.capture(orgId, 'REMAP_APPLIED', triggeredBy, id);
  }
}
