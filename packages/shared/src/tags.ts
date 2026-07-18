import { z } from 'zod';

// TZ-2 §2.1 qoldig'i — teg boshqaruvi (ro'yxat/typeahead + Admin Panel'da rename/delete).
// Tag modeli TZ-0 sxemasida allaqachon mavjud edi (documents.service.ts orqali yaratiladi).

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().nullable().optional(),
});
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export interface TagSummary {
  id: string;
  name: string;
  color: string | null;
  documentCount: number;
}
