import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@docmax/db';
import type {
  CreateDocumentInput,
  DocumentDetail,
  DocumentSummary,
  DocumentVersionSummary,
  FileSummary,
  ListDocumentsQuery,
  PaginatedDocuments,
  UpdateDocumentInput,
} from '@docmax/shared';
import { badRequest, notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { StorageService } from '../storage/storage.service';

const SORTABLE_FIELDS = ['approvedAt', 'createdAt', 'title'] as const;
const DOWNLOAD_URL_TTL_SECONDS = 600;

// Document.orgUnitId'ga mos Prisma relation() yo'q (faqat FK ustuni) — orgUnit
// nomi alohida so'rov bilan (orgUnitNamesFor) olib, xaritaga qarab to'ldiriladi.
// docTypeId esa haqiqiy relation() (DocumentType) — to'g'ridan-to'g'ri include qilinadi.
const DOCUMENT_LIST_INCLUDE = {
  author: { select: { fullName: true } },
  currentVersion: {
    select: {
      versionLabel: true,
      pdfFile: { select: { id: true, originalName: true } },
      docxFile: { select: { id: true, originalName: true } },
    },
  },
  tags: { include: { tag: { select: { name: true } } } },
  docType: { select: { name: true } },
} satisfies Prisma.DocumentInclude;

type DocumentWithRelations = Prisma.DocumentGetPayload<{ include: typeof DOCUMENT_LIST_INCLUDE }>;

function toSummary(doc: DocumentWithRelations, orgUnitNames: Map<string, string>): DocumentSummary {
  return {
    id: doc.id,
    title: doc.title,
    docNumber: doc.docNumber,
    docTypeId: doc.docTypeId,
    docTypeName: doc.docType.name,
    status: doc.status,
    approvedAt: doc.approvedAt?.toISOString() ?? null,
    effectiveFrom: doc.effectiveFrom?.toISOString() ?? null,
    effectiveTo: doc.effectiveTo?.toISOString() ?? null,
    authorName: doc.author.fullName,
    orgUnitId: doc.orgUnitId,
    orgUnitName: doc.orgUnitId ? (orgUnitNames.get(doc.orgUnitId) ?? null) : null,
    folderId: doc.folderId,
    currentVersionLabel: doc.currentVersion?.versionLabel ?? null,
    pdfFile: doc.currentVersion?.pdfFile ?? null,
    docxFile: doc.currentVersion?.docxFile ?? null,
    tags: doc.tags.map((t) => t.tag.name),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
    private readonly storage: StorageService,
  ) {}

  private get document() {
    return this.tenant.client.document;
  }

  async list(orgId: string, query: ListDocumentsQuery): Promise<PaginatedDocuments> {
    const where: Prisma.DocumentWhereInput = { deletedAt: null };
    if (query.folderId) where.folderId = query.folderId;
    if (query.docTypeId) where.docTypeId = query.docTypeId;
    if (query.status) where.status = query.status;
    if (query.orgUnitId) where.orgUnitId = query.orgUnitId;
    if (query.authorUserId) where.authorUserId = query.authorUserId;
    if (query.tag) where.tags = { some: { tag: { name: query.tag } } };
    if (query.year) {
      where.approvedAt = {
        gte: new Date(Date.UTC(query.year, 0, 1)),
        lt: new Date(Date.UTC(query.year + 1, 0, 1)),
      };
    }
    // Kalendar oralig'i: dateField bo'yicha [from, to). approvedAt'da year filtri bilan
    // birga kelsa oxirgi qo'yilgani ustun bo'ladi — kalendar year'ni ishlatmaydi.
    if (query.from || query.to) {
      where[query.dateField] = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lt: query.to } : {}),
      };
    }
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { docNumber: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const sortField = (query.sort && (SORTABLE_FIELDS as readonly string[]).includes(query.sort)
      ? query.sort
      : 'approvedAt') as (typeof SORTABLE_FIELDS)[number];
    const orderBy: Prisma.DocumentOrderByWithRelationInput = { [sortField]: query.order };

    const [rows, total] = await Promise.all([
      this.document.findMany({
        where,
        include: DOCUMENT_LIST_INCLUDE,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.document.count({ where }),
    ]);

    const orgUnitNames = await this.orgUnitNamesFor(rows.map((r) => r.orgUnitId));
    return { items: rows.map((r) => toSummary(r, orgUnitNames)), total, page: query.page, limit: query.limit };
  }

  async getById(orgId: string, id: string): Promise<DocumentDetail> {
    const doc = await this.document.findFirst({
      where: { id, deletedAt: null },
      include: { ...DOCUMENT_LIST_INCLUDE, folder: { select: { name: true } } },
    });
    if (!doc) {
      throw notFound('Hujjat topilmadi');
    }
    const orgUnitNames = await this.orgUnitNamesFor([doc.orgUnitId]);

    // document_versions org_id ustuniga ega emas (tenant-scope.ts) — documentId
    // yuqorida tenant-client orqali tekshirilgani uchun bu yerda xavfsiz.
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: id },
      include: { pdfFile: true, docxFile: true, creator: { select: { fullName: true } } },
      orderBy: { versionNo: 'desc' },
    });

    const versionSummaries: DocumentVersionSummary[] = await Promise.all(
      versions.map(async (v) => ({
        id: v.id,
        versionLabel: v.versionLabel,
        versionNo: v.versionNo,
        isCurrent: v.isCurrent,
        note: v.note,
        approvedAt: v.approvedAt?.toISOString() ?? null,
        createdAt: v.createdAt.toISOString(),
        createdByName: v.creator.fullName,
        pdf: await this.toFileSummary(v.pdfFile),
        docx: v.docxFile ? await this.toFileSummary(v.docxFile) : null,
      })),
    );

    return { ...toSummary(doc, orgUnitNames), folderName: doc.folder.name, versions: versionSummaries };
  }

  private async orgUnitNamesFor(orgUnitIds: (string | null)[]): Promise<Map<string, string>> {
    const ids = [...new Set(orgUnitIds.filter((id): id is string => id !== null))];
    if (!ids.length) {
      return new Map();
    }
    const rows = await this.tenant.client.orgUnit.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** TZ-1 §1.3 — versiya yaratish bilan bitta tranzaksiyada (CLAUDE.md 5-qoida). */
  async create(orgId: string, authorUserId: string, input: CreateDocumentInput): Promise<DocumentDetail> {
    const [folder, pdfFile, docType] = await Promise.all([
      this.tenant.client.folder.findFirst({ where: { id: input.folderId, deletedAt: null } }),
      this.tenant.client.file.findFirst({ where: { id: input.pdfFileId } }),
      this.tenant.client.documentType.findFirst({ where: { id: input.docTypeId } }),
    ]);
    if (!folder) {
      throw notFound('Papka topilmadi');
    }
    if (!pdfFile) {
      throw notFound('PDF fayl topilmadi');
    }
    if (!docType) {
      throw notFound('Hujjat turi topilmadi');
    }
    if (input.docxFileId) {
      const docxFile = await this.tenant.client.file.findFirst({ where: { id: input.docxFileId } });
      if (!docxFile) {
        throw notFound('Word fayl topilmadi');
      }
    }

    const tagIds = await this.resolveTagIds(orgId, input.tagNames ?? []);

    const documentId = randomUUID();
    const versionId = randomUUID();

    await this.prisma.$transaction([
      this.prisma.document.create({
        data: {
          id: documentId,
          orgId,
          folderId: input.folderId,
          title: input.title,
          docNumber: input.docNumber ?? null,
          docTypeId: input.docTypeId,
          status: 'DRAFT',
          approvedAt: input.approvedAt ?? null,
          effectiveFrom: input.effectiveFrom ?? null,
          authorUserId,
          orgUnitId: input.orgUnitId ?? null,
        },
      }),
      this.prisma.documentVersion.create({
        data: {
          id: versionId,
          documentId,
          versionLabel: 'v1.0',
          versionNo: 1,
          pdfFileId: input.pdfFileId,
          docxFileId: input.docxFileId ?? null,
          createdBy: authorUserId,
          isCurrent: true,
        },
      }),
      this.prisma.document.update({ where: { id: documentId }, data: { currentVersionId: versionId } }),
      ...(tagIds.length
        ? [this.prisma.documentTag.createMany({ data: tagIds.map((tagId) => ({ documentId, tagId })) })]
        : []),
    ]);

    return this.getById(orgId, documentId);
  }

  async update(orgId: string, id: string, input: UpdateDocumentInput): Promise<DocumentDetail> {
    const existing = await this.document.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw notFound('Hujjat topilmadi');
    }
    if (input.status === 'EXPIRED' && (!input.effectiveTo || !input.statusChangeNote)) {
      throw badRequest("EXPIRED holatiga o'tkazishda kuchga to'xtash sanasi va izoh majburiy");
    }
    if (input.docTypeId) {
      const docType = await this.tenant.client.documentType.findFirst({ where: { id: input.docTypeId } });
      if (!docType) {
        throw notFound('Hujjat turi topilmadi');
      }
    }

    await this.document.update({
      where: { id },
      data: {
        title: input.title,
        docNumber: input.docNumber,
        docTypeId: input.docTypeId,
        approvedAt: input.approvedAt,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        orgUnitId: input.orgUnitId,
        status: input.status,
      },
    });

    if (input.tagNames) {
      const tagIds = await this.resolveTagIds(orgId, input.tagNames);
      await this.prisma.$transaction([
        this.prisma.documentTag.deleteMany({ where: { documentId: id } }),
        ...(tagIds.length
          ? [this.prisma.documentTag.createMany({ data: tagIds.map((tagId) => ({ documentId: id, tagId })) })]
          : []),
      ]);
    }

    return this.getById(orgId, id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.document.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw notFound('Hujjat topilmadi');
    }
    await this.document.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async resolveTagIds(orgId: string, names: string[]): Promise<string[]> {
    const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const ids: string[] = [];
    for (const name of cleaned) {
      const tag = await this.tenant.client.tag.upsert({
        where: { orgId_name: { orgId, name } },
        create: { orgId, name },
        update: {},
      });
      ids.push(tag.id);
    }
    return ids;
  }

  private async toFileSummary(file: {
    id: string;
    originalName: string;
    mime: string;
    sizeBytes: bigint;
    status: string;
    objectKey: string;
  }): Promise<FileSummary> {
    return {
      id: file.id,
      originalName: file.originalName,
      mime: file.mime,
      sizeBytes: Number(file.sizeBytes),
      status: file.status as FileSummary['status'],
      downloadUrl: await this.storage.getPresignedDownloadUrl(file.objectKey, DOWNLOAD_URL_TTL_SECONDS),
    };
  }
}
