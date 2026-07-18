import { Injectable } from '@nestjs/common';
import type { TagSummary, UpdateTagInput } from '@docmax/shared';
import { notFound } from '../common/api-error';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/** TZ-2 §2.1 qoldig'i — teg ro'yxati (typeahead uchun) + Admin Panel boshqaruvi. */
@Injectable()
export class TagsService {
  constructor(private readonly tenant: TenantPrismaService) {}

  private get tag() {
    return this.tenant.client.tag;
  }

  async list(): Promise<TagSummary[]> {
    const rows = await this.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { documents: true } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, documentCount: r._count.documents }));
  }

  async update(id: string, input: UpdateTagInput): Promise<TagSummary> {
    const existing = await this.tag.findFirst({ where: { id } });
    if (!existing) {
      throw notFound('Teg topilmadi');
    }
    const updated = await this.tag.update({
      where: { id },
      data: { name: input.name, color: input.color },
      include: { _count: { select: { documents: true } } },
    });
    return { id: updated.id, name: updated.name, color: updated.color, documentCount: updated._count.documents };
  }

  async remove(id: string): Promise<void> {
    const existing = await this.tag.findFirst({ where: { id } });
    if (!existing) {
      throw notFound('Teg topilmadi');
    }
    await this.tag.delete({ where: { id } });
  }
}
