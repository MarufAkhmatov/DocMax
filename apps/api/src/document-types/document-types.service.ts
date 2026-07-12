import { Injectable } from '@nestjs/common';
import type { CreateDocumentTypeInput, DocumentTypeSummary, UpdateDocumentTypeInput } from '@docmax/shared';
import { conflict, notFound } from '../common/api-error';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

function toSummary(row: {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): DocumentTypeSummary {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Admin Panel — hujjat turlari (enum o'rniga, TZ-1 §1.3 kengaytmasi). */
@Injectable()
export class DocumentTypesService {
  constructor(private readonly tenant: TenantPrismaService) {}

  private get documentType() {
    return this.tenant.client.documentType;
  }

  async list(): Promise<DocumentTypeSummary[]> {
    const rows = await this.documentType.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return rows.map(toSummary);
  }

  async create(orgId: string, input: CreateDocumentTypeInput): Promise<DocumentTypeSummary> {
    const existing = await this.documentType.findFirst({ where: { name: input.name } });
    if (existing) {
      throw conflict('Bu nomli hujjat turi allaqachon mavjud');
    }
    const created = await this.documentType.create({
      data: { orgId, name: input.name, color: input.color ?? null, sortOrder: input.sortOrder ?? 0 },
    });
    return toSummary(created);
  }

  async update(id: string, input: UpdateDocumentTypeInput): Promise<DocumentTypeSummary> {
    const existing = await this.documentType.findFirst({ where: { id } });
    if (!existing) {
      throw notFound('Hujjat turi topilmadi');
    }
    if (input.name) {
      const nameTaken = await this.documentType.findFirst({ where: { name: input.name, NOT: { id } } });
      if (nameTaken) {
        throw conflict('Bu nomli hujjat turi allaqachon mavjud');
      }
    }
    const updated = await this.documentType.update({ where: { id }, data: input });
    return toSummary(updated);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.documentType.findFirst({ where: { id } });
    if (!existing) {
      throw notFound('Hujjat turi topilmadi');
    }
    const inUse = await this.tenant.client.document.count({ where: { docTypeId: id, deletedAt: null } });
    if (inUse > 0) {
      throw conflict("Shu turdagi hujjatlar mavjud — avval ularning turini o'zgartiring");
    }
    await this.documentType.delete({ where: { id } });
  }
}
