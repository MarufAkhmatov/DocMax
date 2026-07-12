import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Folder } from '@docmax/db';
import type { CreateFolderInput, FolderNode, MoveFolderInput, UpdateFolderInput } from '@docmax/shared';
import { conflict, notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

function toFolderNode(folder: Folder, hasChildren: boolean, documentCount: number): FolderNode {
  return {
    id: folder.id,
    orgId: folder.orgId,
    parentId: folder.parentId,
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
    description: folder.description,
    sortOrder: folder.sortOrder,
    isSystem: folder.isSystem,
    hasChildren,
    documentCount,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

/** folders.path — ltree segmenti sifatida papka o'z UUID'ini ishlatadi (nomdan mustaqil,
 * shuning uchun rename ltree'ga tegmaydi va Unicode nomlar bilan muammo bo'lmaydi). */
function pathSegment(id: string): string {
  return id.replaceAll('-', '_');
}

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
  ) {}

  private get folder() {
    return this.tenant.client.folder;
  }

  async getTree(orgId: string, parentId: string | null, q?: string): Promise<FolderNode[]> {
    const folders = q
      ? await this.folder.findMany({
          where: { name: { contains: q, mode: 'insensitive' }, deletedAt: null },
          orderBy: { name: 'asc' },
        })
      : await this.folder.findMany({ where: { parentId, deletedAt: null }, orderBy: { sortOrder: 'asc' } });

    if (folders.length === 0) {
      return [];
    }

    const ids = folders.map((f) => f.id);
    const [childRows, docCounts] = await Promise.all([
      this.folder.findMany({
        where: { parentId: { in: ids }, deletedAt: null },
        select: { parentId: true },
        distinct: ['parentId'],
      }),
      this.tenant.client.document.groupBy({
        by: ['folderId'],
        where: { folderId: { in: ids }, deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const hasChildrenSet = new Set(childRows.map((c) => c.parentId));
    const docCountMap = new Map(docCounts.map((d) => [d.folderId, d._count._all]));

    return folders.map((f) => toFolderNode(f, hasChildrenSet.has(f.id), docCountMap.get(f.id) ?? 0));
  }

  private async pathOf(id: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ path: string }[]>`
      SELECT path::text as path FROM folders WHERE id = ${id}::uuid
    `;
    if (rows.length === 0) {
      throw notFound('Papka topilmadi');
    }
    return rows[0].path;
  }

  async create(orgId: string, input: CreateFolderInput): Promise<FolderNode> {
    let parentPath: string | null = null;
    if (input.parentId) {
      const parent = await this.folder.findFirst({ where: { id: input.parentId, deletedAt: null } });
      if (!parent) {
        throw notFound('Ota papka topilmadi');
      }
      parentPath = await this.pathOf(input.parentId);
    }

    const id = randomUUID();
    const path = parentPath ? `${parentPath}.${pathSegment(id)}` : pathSegment(id);

    const maxSort = await this.folder.aggregate({
      where: { parentId: input.parentId ?? null, deletedAt: null },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    // folders.path — ltree (Unsupported), Prisma Client orqali yozib bo'lmaydi.
    await this.prisma.$executeRaw`
      INSERT INTO folders (id, org_id, parent_id, name, path, color, icon, description, sort_order, is_system, created_at, updated_at)
      VALUES (
        ${id}::uuid, ${orgId}::uuid, ${input.parentId ?? null}::uuid, ${input.name}, ${path}::ltree,
        ${input.color ?? null}, ${input.icon ?? null}, ${input.description ?? null}, ${sortOrder}, false, now(), now()
      )
    `;

    const created = await this.folder.findUniqueOrThrow({ where: { id } });
    return toFolderNode(created, false, 0);
  }

  async update(id: string, input: UpdateFolderInput): Promise<FolderNode> {
    const existing = await this.folder.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw notFound('Papka topilmadi');
    }
    const updated = await this.folder.update({ where: { id }, data: input });
    const [childCount, docCount] = await Promise.all([
      this.folder.count({ where: { parentId: id, deletedAt: null } }),
      this.tenant.client.document.count({ where: { folderId: id, deletedAt: null } }),
    ]);
    return toFolderNode(updated, childCount > 0, docCount);
  }

  /** TZ-1 §1.2 qabul mezoni: papkani o'z avlodi (yoki o'zi) ichiga ko'chirish taqiqlanadi (409). */
  async move(orgId: string, id: string, input: MoveFolderInput): Promise<FolderNode> {
    const folder = await this.folder.findFirst({ where: { id, deletedAt: null } });
    if (!folder) {
      throw notFound('Papka topilmadi');
    }

    const oldPath = await this.pathOf(id);
    let newParentPath = '';

    if (input.parentId) {
      if (input.parentId === id) {
        throw conflict("Papkani o'ziga ko'chirish mumkin emas");
      }
      const newParent = await this.folder.findFirst({ where: { id: input.parentId, deletedAt: null } });
      if (!newParent) {
        throw notFound('Yangi ota papka topilmadi');
      }
      const parentPath = await this.pathOf(input.parentId);
      const isDescendant = parentPath === oldPath || parentPath.startsWith(`${oldPath}.`);
      if (isDescendant) {
        throw conflict("Papkani o'z avlodi ichiga ko'chirish mumkin emas");
      }
      newParentPath = parentPath;
    }

    const newPath = newParentPath ? `${newParentPath}.${pathSegment(id)}` : pathSegment(id);

    await this.prisma.$transaction([
      // Ko'chirilayotgan papka + barcha avlodlari: eski prefiks yangisiga almashtiriladi,
      // har bir tugunning o'z (nisbiy) segmentlari saqlanadi. subpath(path, offset) offset
      // == nlevel(path) bo'lganda xato beradi (ltree cheklovi) — shuning uchun ko'chirilayotgan
      // papkaning O'ZI (path = oldPath) alohida holat sifatida ajratiladi.
      this.prisma.$executeRaw`
        UPDATE folders
        SET path = CASE
          WHEN path = ${oldPath}::ltree THEN ${newPath}::ltree
          ELSE ${newPath}::ltree || subpath(path, nlevel(${oldPath}::ltree))
        END,
        updated_at = now()
        WHERE org_id = ${orgId}::uuid AND path <@ ${oldPath}::ltree
      `,
      this.prisma.$executeRaw`
        UPDATE folders
        SET parent_id = ${input.parentId ?? null}::uuid, sort_order = ${input.sortOrder}
        WHERE id = ${id}::uuid AND org_id = ${orgId}::uuid
      `,
    ]);

    const updated = await this.folder.findFirstOrThrow({ where: { id } });
    const childCount = await this.folder.count({ where: { parentId: id, deletedAt: null } });
    const docCount = await this.tenant.client.document.count({ where: { folderId: id, deletedAt: null } });
    return toFolderNode(updated, childCount > 0, docCount);
  }

  /** TZ-1 §1.2 qabul mezoni: faqat bo'sh papka o'chiriladi (bolasi yoki hujjati bo'lmasa). */
  async remove(id: string): Promise<void> {
    const folder = await this.folder.findFirst({ where: { id, deletedAt: null } });
    if (!folder) {
      throw notFound('Papka topilmadi');
    }

    const [childCount, docCount] = await Promise.all([
      this.folder.count({ where: { parentId: id, deletedAt: null } }),
      this.tenant.client.document.count({ where: { folderId: id, deletedAt: null } }),
    ]);
    if (childCount > 0 || docCount > 0) {
      throw conflict("Bo'sh bo'lmagan papkani o'chirib bo'lmaydi");
    }

    await this.folder.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
