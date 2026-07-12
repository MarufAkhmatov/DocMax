import { z } from 'zod';

// Admin Panel — hujjat turlari (enum o'rniga, har bir tashkilot o'zi belgilaydi).
// Front va back shu sxemalardan foydalanadi (CLAUDE.md 4-qoida).

export const createDocumentTypeSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateDocumentTypeInput = z.infer<typeof createDocumentTypeSchema>;

export const updateDocumentTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateDocumentTypeInput = z.infer<typeof updateDocumentTypeSchema>;

export interface DocumentTypeSummary {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
