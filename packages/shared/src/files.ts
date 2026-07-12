import { z } from 'zod';
import type { FileStatus } from './enums';

// TZ-1 §1.3 / TZ-0 §4 — Fayl yuklash: presign → to'g'ridan-to'g'ri MinIO → confirm →
// worker indekslaydi (CLAUDE.md 6-qoida). Front va back shu sxemalardan foydalanadi.

export const UPLOADABLE_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Admin Panel — kompaniya logotipi (no-code brend sozlamasi).
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
] as const;

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB (wizard'dagi ko'rsatma bilan mos)

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, 'sha256 hex bo\'lishi kerak');

export const presignFileSchema = z.object({
  filename: z.string().min(1).max(255),
  mime: z.enum(UPLOADABLE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_SIZE_BYTES),
  sha256: sha256Schema,
});
export type PresignFileInput = z.infer<typeof presignFileSchema>;

export const confirmFileSchema = z.object({
  objectKey: z.string().min(1),
  sha256: sha256Schema,
  originalName: z.string().min(1).max(255),
  mime: z.enum(UPLOADABLE_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_SIZE_BYTES),
});
export type ConfirmFileInput = z.infer<typeof confirmFileSchema>;

export interface FileSummary {
  id: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  status: FileStatus;
  downloadUrl: string;
}

export interface PresignResult {
  dedup: boolean;
  file?: FileSummary; // dedup=true bo'lsa — mavjud fayl (qayta yuklanmaydi)
  uploadUrl?: string; // dedup=false bo'lsa — presigned PUT
  objectKey?: string;
  expiresIn?: number;
}
