import { Injectable } from '@nestjs/common';
import { TRASH_RETENTION_DAYS, type TrashItem } from '@docmax/shared';
import { notFound } from '../common/api-error';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

function purgeAt(deletedAt: Date): string {
  const d = new Date(deletedAt);
  d.setDate(d.getDate() + TRASH_RETENTION_DAYS);
  return d.toISOString();
}

/** TZ-2 §2.7 — Trash: Document/Folder'ning mavjud `deletedAt` soft-delete'ini ro'yxatlaydi
 * va tiklaydi. 30 kunlik butunlay o'chirish — apps/worker'dagi repeatable cron. */
@Injectable()
export class TrashService {
  constructor(private readonly tenant: TenantPrismaService) {}

  async list(): Promise<TrashItem[]> {
    const [docs, folders] = await Promise.all([
      this.tenant.client.document.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true, title: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
      this.tenant.client.folder.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);

    const items: TrashItem[] = [
      ...docs.map((d) => ({
        id: d.id,
        type: 'document' as const,
        title: d.title,
        deletedAt: d.deletedAt!.toISOString(),
        purgeAt: purgeAt(d.deletedAt!),
      })),
      ...folders.map((f) => ({
        id: f.id,
        type: 'folder' as const,
        title: f.name,
        deletedAt: f.deletedAt!.toISOString(),
        purgeAt: purgeAt(f.deletedAt!),
      })),
    ];
    return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  async restoreDocument(id: string): Promise<void> {
    const doc = await this.tenant.client.document.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!doc) {
      throw notFound('Hujjat chiqindilar qutisida topilmadi');
    }
    await this.tenant.client.document.update({ where: { id }, data: { deletedAt: null } });
  }

  async restoreFolder(id: string): Promise<void> {
    const folder = await this.tenant.client.folder.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!folder) {
      throw notFound('Papka chiqindilar qutisida topilmadi');
    }
    await this.tenant.client.folder.update({ where: { id }, data: { deletedAt: null } });
  }
}
