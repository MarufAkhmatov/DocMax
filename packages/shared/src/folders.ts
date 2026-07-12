import { z } from 'zod';
import { uuidSchema } from './schemas';

// TZ-1 §1.2 — Papkalar (ierarxiya). Front va back shu sxemalardan foydalanadi (CLAUDE.md 4-qoida).

export const createFolderSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: uuidSchema.nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  color: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
});
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

export const moveFolderSchema = z.object({
  parentId: uuidSchema.nullable(),
  sortOrder: z.number().int().min(0),
});
export type MoveFolderInput = z.infer<typeof moveFolderSchema>;

export interface FolderNode {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  isSystem: boolean;
  hasChildren: boolean;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbEntry {
  id: string;
  name: string;
}
