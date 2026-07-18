import { z } from 'zod';
import { relationTypeSchema, uuidSchema } from './schemas';
import type { DocStatus, RelationType } from './enums';

// TZ-2 — Hujjatlar orasidagi bog'lanishlar (workflow + graf uchun asos).
// DocumentRelation modeli TZ-0 sxemasida allaqachon mavjud edi.

export const createDocumentRelationSchema = z.object({
  targetDocumentId: uuidSchema,
  type: relationTypeSchema,
  note: z.string().max(1000).nullable().optional(),
  /** REPLACES yaratilganda: target hujjatni ham EXPIRED qilishni so'raydi (TZ-2 §2.1). */
  alsoExpireTarget: z.boolean().optional(),
});
export type CreateDocumentRelationInput = z.infer<typeof createDocumentRelationSchema>;

export interface RelatedDocumentSummary {
  id: string;
  title: string;
  docNumber: string | null;
  docTypeName: string;
  status: DocStatus;
}

export interface DocumentRelationSummary {
  id: string;
  type: RelationType;
  note: string | null;
  direction: 'OUTGOING' | 'INCOMING';
  document: RelatedDocumentSummary;
  createdAt: string;
}
