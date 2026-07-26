import { Injectable } from '@nestjs/common';
import type { CreateDocumentRelationInput, DocumentRelationSummary } from '@docmax/shared';
import { badRequest, conflict, notFound } from '../common/api-error';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const RELATED_DOCUMENT_SELECT = {
  id: true,
  title: true,
  docNumber: true,
  status: true,
  docType: { select: { name: true } },
} as const;

type RelatedDocumentRow = {
  id: string;
  title: string;
  docNumber: string | null;
  status: string;
  docType: { name: string };
};

function toDocumentSummary(doc: RelatedDocumentRow) {
  return {
    id: doc.id,
    title: doc.title,
    docNumber: doc.docNumber,
    docTypeName: doc.docType.name,
    status: doc.status as DocumentRelationSummary['document']['status'],
  };
}

/** TZ-2 — hujjatlar orasidagi bog'lanishlar (ASOS/BOLA/O'ZGARTIRADI/O'RNINI BOSADI/BOG'LIQ). */
@Injectable()
export class DocumentRelationsService {
  constructor(private readonly tenant: TenantPrismaService) {}

  private get relation() {
    return this.tenant.client.documentRelation;
  }

  private get document() {
    return this.tenant.client.document;
  }

  async list(documentId: string): Promise<DocumentRelationSummary[]> {
    const rows = await this.relation.findMany({
      where: { OR: [{ sourceDocumentId: documentId }, { targetDocumentId: documentId }] },
      include: {
        sourceDocument: { select: RELATED_DOCUMENT_SELECT },
        targetDocument: { select: RELATED_DOCUMENT_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => {
      const outgoing = row.sourceDocumentId === documentId;
      return {
        id: row.id,
        type: row.type as DocumentRelationSummary['type'],
        note: row.note,
        direction: outgoing ? 'OUTGOING' : 'INCOMING',
        document: toDocumentSummary(outgoing ? row.targetDocument : row.sourceDocument),
        createdAt: row.createdAt.toISOString(),
      } satisfies DocumentRelationSummary;
    });
  }

  /** PARENT_CHILD sikl tekshiruvi (DFS, TZ-2 §2.1): `newTargetId`dan boshlab mavjud
   * PARENT_CHILD chiziqlarini yurib, `newSourceId`ga qaytib kelinsa — sikl bo'ladi. */
  private async wouldCreateCycle(newSourceId: string, newTargetId: string): Promise<boolean> {
    const visited = new Set<string>([newTargetId]);
    const stack = [newTargetId];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === newSourceId) {
        return true;
      }
      const children = await this.relation.findMany({
        where: { sourceDocumentId: current, type: 'PARENT_CHILD' },
        select: { targetDocumentId: true },
      });
      for (const c of children) {
        if (!visited.has(c.targetDocumentId)) {
          visited.add(c.targetDocumentId);
          stack.push(c.targetDocumentId);
        }
      }
    }
    return false;
  }

  async create(orgId: string, userId: string, documentId: string, input: CreateDocumentRelationInput): Promise<DocumentRelationSummary> {
    if (documentId === input.targetDocumentId) {
      throw badRequest("Hujjatni o'zi bilan bog'lash mumkin emas");
    }
    const [source, target] = await Promise.all([
      this.document.findFirst({ where: { id: documentId, deletedAt: null }, select: RELATED_DOCUMENT_SELECT }),
      this.document.findFirst({ where: { id: input.targetDocumentId, deletedAt: null }, select: RELATED_DOCUMENT_SELECT }),
    ]);
    if (!source) {
      throw notFound('Hujjat topilmadi');
    }
    if (!target) {
      throw notFound('Bog\'lanadigan hujjat topilmadi');
    }
    const existing = await this.relation.findFirst({
      where: { sourceDocumentId: documentId, targetDocumentId: input.targetDocumentId, type: input.type },
    });
    if (existing) {
      throw conflict("Bu turdagi bog'lanish allaqachon mavjud");
    }
    if (input.type === 'PARENT_CHILD' && (await this.wouldCreateCycle(documentId, input.targetDocumentId))) {
      throw badRequest("Bu bog'lanish PARENT_CHILD siklini hosil qiladi");
    }

    const created = await this.relation.create({
      data: {
        orgId,
        sourceDocumentId: documentId,
        targetDocumentId: input.targetDocumentId,
        type: input.type,
        note: input.note ?? null,
        createdBy: userId,
      },
    });

    return {
      id: created.id,
      type: created.type as DocumentRelationSummary['type'],
      note: created.note,
      direction: 'OUTGOING',
      document: toDocumentSummary(target),
      createdAt: created.createdAt.toISOString(),
    };
  }

  async remove(id: string): Promise<void> {
    const existing = await this.relation.findFirst({ where: { id } });
    if (!existing) {
      throw notFound("Bog'lanish topilmadi");
    }
    await this.relation.delete({ where: { id } });
  }
}
