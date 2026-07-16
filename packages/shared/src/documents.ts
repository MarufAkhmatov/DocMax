import { z } from 'zod';
import { uuidSchema, paginationSchema, docStatusSchema } from './schemas';
import type { DocStatus } from './enums';
import type { FileSummary } from './files';

// TZ-1 §1.3 — Hujjatlar (CRUD + metadata). Front va back shu sxemalardan foydalanadi
// (CLAUDE.md 4-qoida). Versiyalash/taqqoslama (TZ-1 §1.4) keyingi bosqichda.
// Hujjat turi — Admin Panel orqali tashkilot o'zi belgilaydigan DocumentType'ga
// ishora (docTypeId), qattiq enum emas (packages/shared/src/document-types.ts).

export const createDocumentSchema = z.object({
  folderId: uuidSchema,
  title: z.string().min(1).max(500),
  docNumber: z.string().max(100).nullable().optional(),
  docTypeId: uuidSchema,
  approvedAt: z.coerce.date().nullable().optional(),
  effectiveFrom: z.coerce.date().nullable().optional(),
  orgUnitId: uuidSchema.nullable().optional(),
  pdfFileId: uuidSchema,
  docxFileId: uuidSchema.nullable().optional(),
  tagNames: z.array(z.string().min(1).max(50)).max(20).optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

/** Holatni EXPIRED qilishda effectiveTo + statusChangeNote talab qilinadi (TZ-1 §1.3). */
export const updateDocumentSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    docNumber: z.string().max(100).nullable().optional(),
    docTypeId: uuidSchema.optional(),
    approvedAt: z.coerce.date().nullable().optional(),
    effectiveFrom: z.coerce.date().nullable().optional(),
    effectiveTo: z.coerce.date().nullable().optional(),
    orgUnitId: uuidSchema.nullable().optional(),
    status: docStatusSchema.optional(),
    statusChangeNote: z.string().max(1000).optional(),
    tagNames: z.array(z.string().min(1).max(50)).max(20).optional(),
  })
  .refine((v) => v.status !== 'EXPIRED' || (v.effectiveTo && v.statusChangeNote), {
    message: "EXPIRED holatiga o'tkazishda kuchga to'xtash sanasi va izoh majburiy",
    path: ['statusChangeNote'],
  });
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const listDocumentsQuerySchema = paginationSchema.extend({
  folderId: uuidSchema.optional(),
  docTypeId: uuidSchema.optional(),
  status: docStatusSchema.optional(),
  orgUnitId: uuidSchema.optional(),
  authorUserId: uuidSchema.optional(),
  tag: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  q: z.string().optional(),
});
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

/** Ro'yxat jadvalidagi fayl-chip uchun yengil havola — presigned URL emas (muddati o'tib
 * qolmasligi uchun URL bosilganda GET /files/:id/download orqali yangisi olinadi). */
export interface DocumentFileRef {
  id: string;
  originalName: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  docNumber: string | null;
  docTypeId: string;
  docTypeName: string;
  status: DocStatus;
  approvedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  authorName: string;
  orgUnitId: string | null;
  orgUnitName: string | null;
  folderId: string;
  currentVersionLabel: string | null;
  pdfFile: DocumentFileRef | null;
  docxFile: DocumentFileRef | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionSummary {
  id: string;
  versionLabel: string;
  versionNo: number;
  isCurrent: boolean;
  note: string | null;
  approvedAt: string | null;
  createdAt: string;
  createdByName: string;
  pdf: FileSummary;
  docx: FileSummary | null;
}

export interface DocumentDetail extends DocumentSummary {
  folderName: string;
  versions: DocumentVersionSummary[];
}

export interface PaginatedDocuments {
  items: DocumentSummary[];
  total: number;
  page: number;
  limit: number;
}
