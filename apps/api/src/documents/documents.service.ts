import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@docmax/db';
import type {
  BulkDocumentsInput,
  BulkDocumentsResult,
  ComparisonTemplateInput,
  ComparisonTemplateJob,
  ComparisonTemplateStatus,
  CreateDocumentInput,
  CreateDocumentVersionInput,
  DiffGenerateResult,
  DocumentDetail,
  DocumentSummary,
  DocumentVersionSummary,
  FileSummary,
  ListDocumentsQuery,
  PaginatedDocuments,
  Role,
  UpdateDocumentInput,
} from '@docmax/shared';
import { nextVersionLabel } from '@docmax/shared';
import { badRequest, conflict, forbidden, notFound } from '../common/api-error';
import { FolderAccessService } from '../folders/folder-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';

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
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
    private readonly folderAccess: FolderAccessService,
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

    // TZ-2 §2.5 qabul mezoni: ACL'd papkadagi hujjatlar ruxsatsizga list/qidiruvda chiqmaydi.
    const denied = await this.folderAccess.deniedFolderIds();
    const finalWhere: Prisma.DocumentWhereInput = denied.length ? { AND: [where, { folderId: { notIn: denied } }] } : where;

    const [rows, total] = await Promise.all([
      this.document.findMany({
        where: finalWhere,
        include: DOCUMENT_LIST_INCLUDE,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.document.count({ where: finalWhere }),
    ]);

    const orgUnitNames = await this.orgUnitNamesFor(rows.map((r) => r.orgUnitId));
    return { items: rows.map((r) => toSummary(r, orgUnitNames)), total, page: query.page, limit: query.limit };
  }

  /** DocDetail audit paneli (`GET /documents/:id/audit`) ACL tekshiruvi uchun — hujjatning
   * o'zini to'liq yuklamasdan faqat ko'rish huquqini tasdiqlaydi. */
  async assertVisible(id: string): Promise<void> {
    const doc = await this.document.findFirst({ where: { id, deletedAt: null }, select: { folderId: true } });
    if (!doc) {
      throw notFound('Hujjat topilmadi');
    }
    await this.folderAccess.assertView(doc.folderId);
  }

  async getById(orgId: string, id: string): Promise<DocumentDetail> {
    const doc = await this.document.findFirst({
      where: { id, deletedAt: null },
      include: { ...DOCUMENT_LIST_INCLUDE, folder: { select: { name: true } } },
    });
    if (!doc) {
      throw notFound('Hujjat topilmadi');
    }
    await this.folderAccess.assertView(doc.folderId);
    const orgUnitNames = await this.orgUnitNamesFor([doc.orgUnitId]);

    // document_versions org_id ustuniga ega emas (tenant-scope.ts) — documentId
    // yuqorida tenant-client orqali tekshirilgani uchun bu yerda xavfsiz.
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: id },
      include: { pdfFile: true, docxFile: true, diffFile: true, creator: { select: { fullName: true } } },
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
        diff: v.diffFile ? await this.toFileSummary(v.diffFile) : null,
      })),
    );

    return { ...toSummary(doc, orgUnitNames), folderName: doc.folder.name, versions: versionSummaries };
  }

  /** TZ-1 §1.4 — yangi versiya BITTA tranzaksiyada: insert + eski is_current=false +
   * documents.current_version_id yangilash (CLAUDE.md 5-qoida). Raqamlash per-document,
   * race'da @@unique(documentId, versionNo) himoya qiladi (P2002 -> 409). */
  async createVersion(
    orgId: string,
    userId: string,
    documentId: string,
    input: CreateDocumentVersionInput,
  ): Promise<DocumentDetail> {
    const doc = await this.document.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) {
      throw notFound('Hujjat topilmadi');
    }
    await this.folderAccess.assertEdit(doc.folderId);

    // Set — bitta fayl ikki rolda kelishi mumkin (masalan to'ldirilgan taqqoslama ham docx, ham diff)
    const fileIds = [
      ...new Set([input.pdfFileId, input.docxFileId, input.diffFileId].filter((v): v is string => Boolean(v))),
    ];
    const files = await this.tenant.client.file.findMany({ where: { id: { in: fileIds } } });
    if (files.length !== fileIds.length) {
      throw notFound('Yuklangan fayl(lar) topilmadi');
    }
    if (files.some((f) => f.status === 'FAILED')) {
      throw badRequest('Yaroqsiz (FAILED) fayl versiyaga biriktirilmaydi');
    }

    const current = await this.prisma.documentVersion.findFirst({
      where: { documentId, isCurrent: true },
      orderBy: { versionNo: 'desc' },
    });
    const maxNo = await this.prisma.documentVersion.aggregate({
      where: { documentId },
      _max: { versionNo: true },
    });
    const versionNo = (maxNo._max.versionNo ?? 0) + 1;
    const versionLabel = nextVersionLabel(current?.versionLabel ?? null, input.versionType);
    const versionId = randomUUID();

    try {
      await this.prisma.$transaction([
        ...(current
          ? [
              this.prisma.documentVersion.update({
                where: { id: current.id },
                data: { isCurrent: false },
              }),
            ]
          : []),
        this.prisma.documentVersion.create({
          data: {
            id: versionId,
            documentId,
            versionLabel,
            versionNo,
            pdfFileId: input.pdfFileId,
            docxFileId: input.docxFileId ?? null,
            diffFileId: input.diffFileId ?? null,
            note: input.note ?? null,
            createdBy: userId,
            isCurrent: true,
          },
        }),
        this.prisma.document.update({
          where: { id: documentId },
          data: { currentVersionId: versionId },
        }),
      ]);
    } catch (err) {
      // Parallel yaratishda versionNo to'qnashuvi — foydalanuvchi qayta urinsin
      if ((err as { code?: string }).code === 'P2002') {
        throw conflict("Versiya raqami band (parallel yaratish) — qayta urinib ko'ring");
      }
      throw err;
    }

    if (doc.authorUserId !== userId) {
      await this.notifications.notifyUsers(orgId, [doc.authorUserId], {
        type: 'VERSION_UPDATED',
        title: `${doc.title} — ${versionLabel}`,
        body: `Yangi versiya yaratildi (${versionLabel})`,
        meta: { documentId },
      });
    }

    return this.getById(orgId, documentId);
  }

  /** Taqqoslama shablonini fon vazifada generatsiya qilishni boshlaydi (TZ-1 §1.4 3-qadam). */
  async requestComparisonTemplate(
    orgId: string,
    userId: string,
    documentId: string,
    input: ComparisonTemplateInput,
  ): Promise<ComparisonTemplateJob> {
    const doc = await this.document.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) {
      throw notFound('Hujjat topilmadi');
    }
    await this.folderAccess.assertEdit(doc.folderId);
    const current = await this.prisma.documentVersion.findFirst({
      where: { documentId, isCurrent: true },
    });
    if (!current) {
      throw badRequest("Hujjatda hali versiya yo'q — shablon uchun joriy versiya kerak");
    }

    const job = await this.queue.addDiffGenerateJob({
      documentId,
      oldVersionId: current.id,
      orgId,
      requestedBy: userId,
      newVersionLabel: nextVersionLabel(current.versionLabel, input.versionType),
    });
    return { jobId: String(job.id) };
  }

  /** Frontend polling: shablon job holati (BullMQ returnvalue orqali fileId). */
  async comparisonTemplateStatus(orgId: string, jobId: string): Promise<ComparisonTemplateStatus> {
    const job = await this.queue.getDiffGenerateJob(jobId);
    // Tenant izolyatsiya: job data'dagi orgId so'rovchi bilan mos bo'lishi shart
    if (!job || job.data.orgId !== orgId) {
      throw notFound('Shablon vazifasi topilmadi');
    }
    const state = await job.getState();
    if (state === 'completed') {
      const result = job.returnvalue as DiffGenerateResult;
      return { state: 'completed', fileId: result.fileId, fromPdfFallback: result.fromPdfFallback };
    }
    if (state === 'failed') {
      return { state: 'failed', error: job.failedReason ?? 'Generatsiya xatosi' };
    }
    return { state: state === 'active' ? 'active' : 'waiting' };
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
    await this.folderAccess.assertEdit(input.folderId);
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

  /** TZ-2 §2.7 — CONTRIBUTOR faqat o'z DRAFT hujjatini tahrirlaydi va faqat IN_REVIEW'ga
   * yuboradi (ACTIVE/EXPIRED qila olmaydi — EDITOR/ADMIN tasdiqlaydi). */
  async update(
    orgId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
    input: UpdateDocumentInput,
  ): Promise<DocumentDetail> {
    const existing = await this.document.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw notFound('Hujjat topilmadi');
    }
    await this.folderAccess.assertEdit(existing.folderId);
    if (actorRole === 'CONTRIBUTOR') {
      if (existing.authorUserId !== actorUserId) {
        throw forbidden("Faqat o'zingiz yuklagan hujjatni tahrirlay olasiz");
      }
      if (existing.status !== 'DRAFT') {
        throw forbidden("Faqat DRAFT holatidagi hujjatni tahrirlay olasiz");
      }
      if (input.status && input.status !== 'DRAFT' && input.status !== 'IN_REVIEW') {
        throw forbidden("Faqat tasdiq uchun yuborish (IN_REVIEW) mumkin — ACTIVE/EXPIRED EDITOR/ADMIN tomonidan belgilanadi");
      }
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

    if (input.status && input.status !== existing.status) {
      await this.notifyStatusChange(orgId, actorUserId, existing.authorUserId, existing.title, input.status);
    }

    return this.getById(orgId, id);
  }

  private async notifyStatusChange(
    orgId: string,
    actorUserId: string,
    authorUserId: string,
    title: string,
    newStatus: string,
  ): Promise<void> {
    if (newStatus === 'IN_REVIEW') {
      const approvers = await this.tenant.client.user.findMany({
        where: { role: { in: ['ADMIN', 'EDITOR'] }, id: { not: actorUserId }, isActive: true },
        select: { id: true },
      });
      await this.notifications.notifyUsers(
        orgId,
        approvers.map((a) => a.id),
        { type: 'APPROVAL_PENDING', title, body: 'Tasdiq kutmoqda' },
      );
    } else if ((newStatus === 'ACTIVE' || newStatus === 'EXPIRED') && authorUserId !== actorUserId) {
      await this.notifications.notifyUsers(orgId, [authorUserId], {
        type: 'STATUS_CHANGED',
        title,
        body: newStatus === 'ACTIVE' ? 'ACTIVE holatga o\'tdi' : 'Kuchini yo\'qotdi',
      });
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.document.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw notFound('Hujjat topilmadi');
    }
    await this.folderAccess.assertEdit(existing.folderId);
    await this.document.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Bulk amallar (TZ-1 §1.3 UI — Vault tanlash bar): delete/move/tag. Tenant-scope
   * client bo'lgani uchun documentIds avtomatik org bilan cheklanadi (boshqa org'niki tegmaydi). */
  async bulk(orgId: string, input: BulkDocumentsInput): Promise<BulkDocumentsResult> {
    // Faqat shu org'ga tegishli va o'chirilmagan hujjatlar (tenant client filtrlaydi)
    const docs = await this.document.findMany({
      where: { id: { in: input.documentIds }, deletedAt: null },
      select: { id: true, folderId: true },
    });
    const ids = docs.map((d) => d.id);
    if (ids.length === 0) {
      return { affected: 0 };
    }
    // TZ-2 §2.5 — har manba papka uchun tahrirlash huquqi (bitta joyda tekshiruv talabi
    // bulk amallarni ham qamrab olishi kerak).
    const sourceFolderIds = [...new Set(docs.map((d) => d.folderId))];
    await Promise.all(sourceFolderIds.map((folderId) => this.folderAccess.assertEdit(folderId)));

    if (input.action === 'delete') {
      await this.document.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
      return { affected: ids.length };
    }

    if (input.action === 'move') {
      const folder = await this.tenant.client.folder.findFirst({
        where: { id: input.folderId!, deletedAt: null },
      });
      if (!folder) {
        throw notFound('Papka topilmadi');
      }
      await this.folderAccess.assertEdit(input.folderId!);
      await this.document.updateMany({ where: { id: { in: ids } }, data: { folderId: input.folderId! } });
      return { affected: ids.length };
    }

    // action === 'tag' — mavjud teglarga qo'shadi (almashtirmaydi), dublikat o'tkazib yuboriladi
    const [tagId] = await this.resolveTagIds(orgId, [input.tagName!]);
    await this.prisma.documentTag.createMany({
      data: ids.map((documentId) => ({ documentId, tagId })),
      skipDuplicates: true,
    });
    return { affected: ids.length };
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
