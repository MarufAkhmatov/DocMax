import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import type { PermissionSubjectType } from '@docmax/shared';
import { forbidden, notFound, unauthorized } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';

interface FolderPathRow {
  id: string;
  path: string;
}

interface PermissionRow {
  subjectType: PermissionSubjectType;
  subjectId: string;
  canView: boolean;
  canEdit: boolean;
  canDownload: boolean;
  inherit: boolean;
}

/**
 * TZ-2 §2.5 — markazlashtirilgan ACL tekshiruvi (CLAUDE.md 1-qoidadagi
 * TenantPrismaService bilan bir xil request-scoped lazy naqsh — "ruxsat tekshiruvi
 * bitta joyda" qabul mezoni shu servis orqali ta'minlanadi).
 *
 * Algoritm:
 * 1) Org ichida `acl_enabled=true` bo'lgan barcha papkalar ("chegaralar") so'rov
 *    boshida bir marta yuklanadi va keshlanadi — ACL hech qayerda yoqilmagan bo'lsa
 *    (bugungi holat) darhol bo'sh qaytadi, hech qanday xatti-harakat o'zgarmaydi va
 *    qo'shimcha so'rov ketmaydi.
 * 2) Har bir candidate papka uchun ENG YAQIN chegara (o'zi yoki eng chuqur ajdodi)
 *    ltree path prefiksi bo'yicha JS'da (qo'shimcha SQL'siz) topiladi.
 * 3) Chegara papkaning subject'ga mos Permission qatorlari OR qilinadi (ROLE/USER/ORG_UNIT);
 *    chegara candidate'ning O'ZI bo'lmasa (ya'ni meros orqali kelayotgan bo'lsa), faqat
 *    `inherit=true` qatorlar hisobga olinadi ("papkada override mumkin" — TZ-2 §2.5).
 * 4) ADMIN/SUPER_ADMIN har doim to'liq huquqqa ega (bypass) — ACL faqat shu rollar
 *    tomonidan boshqariladi, noto'g'ri konfiguratsiya o'zini qulflab qo'ymasligi uchun.
 * 5) canView=false — 404 (mavjudligi sizib chiqmasin); canView=true lekin canEdit/
 *    canDownload=false — 403 (mavjudligi allaqachon ma'lum).
 */
@Injectable({ scope: Scope.REQUEST })
export class FolderAccessService {
  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
  ) {}

  private get user(): RequestUser {
    const user = (this.request as AuthenticatedRequest).user;
    if (!user) {
      throw unauthorized();
    }
    return user;
  }

  private isAdmin(): boolean {
    return this.user.role === 'ADMIN' || this.user.role === 'SUPER_ADMIN';
  }

  private orgUnitIdPromise?: Promise<string | null>;
  private currentUserOrgUnitId(): Promise<string | null> {
    this.orgUnitIdPromise ??= this.tenant.client.user
      .findFirst({ where: { id: this.user.sub }, select: { orgUnitId: true } })
      .then((u: { orgUnitId: string | null } | null) => u?.orgUnitId ?? null);
    return this.orgUnitIdPromise;
  }

  private boundariesPromise?: Promise<FolderPathRow[]>;
  private boundaries(): Promise<FolderPathRow[]> {
    this.boundariesPromise ??= this.prisma.$queryRaw<FolderPathRow[]>`
      SELECT id, path::text as path FROM folders
      WHERE org_id = ${this.user.orgId}::uuid AND acl_enabled = true AND deleted_at IS NULL
    `;
    return this.boundariesPromise;
  }

  private permRowsCache = new Map<string, Promise<PermissionRow[]>>();
  private permRowsFor(folderId: string): Promise<PermissionRow[]> {
    let cached = this.permRowsCache.get(folderId);
    if (!cached) {
      cached = this.tenant.client.permission.findMany({
        where: { folderId },
        select: { subjectType: true, subjectId: true, canView: true, canEdit: true, canDownload: true, inherit: true },
      });
      this.permRowsCache.set(folderId, cached);
    }
    return cached;
  }

  private pathCache = new Map<string, Promise<string | null>>();
  private pathOf(folderId: string): Promise<string | null> {
    let cached = this.pathCache.get(folderId);
    if (!cached) {
      cached = this.prisma
        .$queryRaw<{ path: string }[]>`SELECT path::text as path FROM folders WHERE id = ${folderId}::uuid`
        .then((rows) => rows[0]?.path ?? null);
      this.pathCache.set(folderId, cached);
    }
    return cached;
  }

  /** Bir nechta candidate uchun eng yaqin chegarani BITTA `= ANY(...)` so'rovda topadi —
   * `nearestBoundary`ni har bir id uchun alohida chaqirish 1000 papkali daraxtda 1000 ta
   * round-trip beradi (aniqlangan regressiya); bu yerda 0 yoki 1 ta qo'shimcha so'rov. */
  private async nearestBoundariesBatch(candidateIds: string[]): Promise<Map<string, { id: string; isSelf: boolean } | null>> {
    const result = new Map<string, { id: string; isSelf: boolean } | null>();
    if (candidateIds.length === 0) {
      return result;
    }
    const boundaries = await this.boundaries();
    if (boundaries.length === 0) {
      candidateIds.forEach((id) => result.set(id, null));
      return result;
    }
    const rows = await this.prisma.$queryRaw<FolderPathRow[]>`
      SELECT id, path::text as path FROM folders WHERE id = ANY(${candidateIds}::uuid[])
    `;
    const pathById = new Map(rows.map((r) => [r.id, r.path]));
    for (const id of candidateIds) {
      const path = pathById.get(id);
      this.pathCache.set(id, Promise.resolve(path ?? null));
      if (!path) {
        result.set(id, null);
        continue;
      }
      let best: FolderPathRow | null = null;
      for (const b of boundaries) {
        const isAncestorOrSelf = b.path === path || path.startsWith(`${b.path}.`);
        if (!isAncestorOrSelf) {
          continue;
        }
        if (!best || b.path.length > best.path.length) {
          best = b;
        }
      }
      result.set(id, best ? { id: best.id, isSelf: best.id === id } : null);
    }
    return result;
  }

  private async nearestBoundary(folderId: string): Promise<{ id: string; isSelf: boolean } | null> {
    const boundaries = await this.boundaries();
    if (boundaries.length === 0) {
      return null;
    }
    const path = await this.pathOf(folderId);
    if (!path) {
      return null;
    }
    let best: FolderPathRow | null = null;
    for (const b of boundaries) {
      const isAncestorOrSelf = b.path === path || path.startsWith(`${b.path}.`);
      if (!isAncestorOrSelf) {
        continue;
      }
      if (!best || b.path.length > best.path.length) {
        best = b;
      }
    }
    return best ? { id: best.id, isSelf: best.id === folderId } : null;
  }

  private matchesSubject(row: PermissionRow, isSelf: boolean, orgUnitId: string | null): boolean {
    if (!isSelf && !row.inherit) {
      return false;
    }
    if (row.subjectType === 'ROLE') {
      return row.subjectId === this.user.role;
    }
    if (row.subjectType === 'USER') {
      return row.subjectId === this.user.sub;
    }
    return orgUnitId !== null && row.subjectId === orgUnitId; // ORG_UNIT
  }

  async effective(folderId: string): Promise<{ canView: boolean; canEdit: boolean; canDownload: boolean }> {
    if (this.isAdmin()) {
      return { canView: true, canEdit: true, canDownload: true };
    }
    const boundary = await this.nearestBoundary(folderId);
    if (!boundary) {
      return { canView: true, canEdit: true, canDownload: true };
    }
    const [rows, orgUnitId] = await Promise.all([this.permRowsFor(boundary.id), this.currentUserOrgUnitId()]);
    const matching = rows.filter((r) => this.matchesSubject(r, boundary.isSelf, orgUnitId));
    return {
      canView: matching.some((r) => r.canView),
      canEdit: matching.some((r) => r.canEdit),
      canDownload: matching.some((r) => r.canDownload),
    };
  }

  async assertView(folderId: string): Promise<void> {
    const { canView } = await this.effective(folderId);
    if (!canView) {
      throw notFound();
    }
  }

  async assertEdit(folderId: string): Promise<void> {
    await this.assertView(folderId);
    const { canEdit } = await this.effective(folderId);
    if (!canEdit) {
      throw forbidden();
    }
  }

  async assertDownload(folderId: string): Promise<void> {
    await this.assertView(folderId);
    const { canDownload } = await this.effective(folderId);
    if (!canDownload) {
      throw forbidden();
    }
  }

  /** Qulf ikonkasi uchun: shu papka yoki bironta ajdodi ACL chegarasimi. */
  async isLocked(folderId: string): Promise<boolean> {
    return (await this.nearestBoundary(folderId)) !== null;
  }

  /** `isLocked`ning ko'p papkalik (folder-tree render) varianti — batch so'rov ishlatadi. */
  async lockedFolderIds(candidateIds: string[]): Promise<Set<string>> {
    const boundaryMap = await this.nearestBoundariesBatch(candidateIds);
    const locked = new Set<string>();
    for (const [id, boundary] of boundaryMap) {
      if (boundary) {
        locked.add(id);
      }
    }
    return locked;
  }

  /** Berilgan candidate id'lar orasidan joriy foydalanuvchi ko'ra oladigan (canView) id'lar. */
  async visibleFolderIds(candidateIds: string[]): Promise<Set<string>> {
    if (this.isAdmin() || candidateIds.length === 0) {
      return new Set(candidateIds);
    }
    const boundaryMap = await this.nearestBoundariesBatch(candidateIds);
    const orgUnitId = await this.currentUserOrgUnitId();
    const visible = new Set<string>();
    for (const id of candidateIds) {
      const boundary = boundaryMap.get(id) ?? null;
      if (!boundary) {
        visible.add(id);
        continue;
      }
      const rows = await this.permRowsFor(boundary.id);
      const canView = rows.some((r) => this.matchesSubject(r, boundary.isSelf, orgUnitId) && r.canView);
      if (canView) {
        visible.add(id);
      }
    }
    return visible;
  }

  /** Documents/graph list so'rovlarida `where.folderId = { notIn: ... }` uchun: org ichidagi
   * barcha ko'rinmaydigan papka id'lari. ACL hech qayerda yoqilmagan bo'lsa bo'sh massiv —
   * qo'shimcha xarajatsiz (bugungi kundagi standart holat). */
  async deniedFolderIds(): Promise<string[]> {
    if (this.isAdmin()) {
      return [];
    }
    const boundaries = await this.boundaries();
    if (boundaries.length === 0) {
      return [];
    }
    const boundaryIds = boundaries.map((b) => b.id);
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT f.id FROM folders f
      WHERE f.org_id = ${this.user.orgId}::uuid AND f.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM folders b WHERE b.id = ANY(${boundaryIds}::uuid[]) AND b.path @> f.path
        )
    `;
    const ids = rows.map((r) => r.id);
    const visible = await this.visibleFolderIds(ids);
    return ids.filter((id) => !visible.has(id));
  }
}
