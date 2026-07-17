import { z } from 'zod';
import { uuidSchema } from './schemas';

// TZ-1 §1.4 — Versiyalash + avtomatik taqqoslama shabloni.
// Oqim: "Yangi versiya" -> versiya turi tanlanadi -> shablon generatsiyasi (diff.generate,
// fon vazifa) -> user shablonni yuklab olib to'ldiradi -> yangi PDF + Word + to'ldirilgan
// taqqoslama bilan versiya yaratiladi (bitta tranzaksiyada, CLAUDE.md 5-qoida).

/** MINOR: v1.0 -> v1.1 (o'zgartirish) · MAJOR: v1.x -> v2.0 (yangi tahrir) */
export const VERSION_TYPES = ['MINOR', 'MAJOR'] as const;
export type VersionType = (typeof VERSION_TYPES)[number];

export const createDocumentVersionSchema = z.object({
  versionType: z.enum(VERSION_TYPES),
  pdfFileId: uuidSchema,
  docxFileId: uuidSchema.nullable().optional(),
  diffFileId: uuidSchema.nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});
export type CreateDocumentVersionInput = z.infer<typeof createDocumentVersionSchema>;

export const comparisonTemplateSchema = z.object({
  versionType: z.enum(VERSION_TYPES),
});
export type ComparisonTemplateInput = z.infer<typeof comparisonTemplateSchema>;

export interface ComparisonTemplateJob {
  jobId: string;
}

export interface ComparisonTemplateStatus {
  state: 'waiting' | 'active' | 'completed' | 'failed';
  fileId?: string;
  /** true — eski versiyada docx yo'q, shablon PDF matnidan yasaldi (formatlash yo'qolgan bo'lishi mumkin) */
  fromPdfFallback?: boolean;
  error?: string;
}

/** Joriy yorliqdan keyingi versiya yorlig'ini hisoblaydi (front va back bitta manba). */
export function nextVersionLabel(current: string | null, type: VersionType): string {
  const match = current?.match(/^v(\d+)(?:\.(\d+))?$/);
  if (!match) return 'v1.0';
  const major = Number(match[1]);
  const minor = Number(match[2] ?? 0);
  return type === 'MAJOR' ? `v${major + 1}.0` : `v${major}.${minor + 1}`;
}
