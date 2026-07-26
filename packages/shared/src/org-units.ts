import { z } from 'zod';
import { uuidSchema } from './schemas';

// TZ-2 §2.4 — Korxona strukturasi (org-units daraxti + remapping wizard + snapshot).

export const createOrgUnitSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(50).nullable().optional(),
  parentId: uuidSchema.nullable().optional(),
  headUserId: uuidSchema.nullable().optional(),
});
export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;

export const updateOrgUnitSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).nullable().optional(),
  headUserId: uuidSchema.nullable().optional(),
});
export type UpdateOrgUnitInput = z.infer<typeof updateOrgUnitSchema>;

export const moveOrgUnitSchema = z.object({
  parentId: uuidSchema.nullable(),
  sortOrder: z.number().int().min(0),
});
export type MoveOrgUnitInput = z.infer<typeof moveOrgUnitSchema>;

export const closeOrgUnitSchema = z.object({
  moveFoldersToArchive: z.boolean(),
});
export type CloseOrgUnitInput = z.infer<typeof closeOrgUnitSchema>;

/** Papkani org-unit'ga bog'lash/uzish (n8n-uslubidagi canvas'da chiziq tortish/o'chirish orqali) — `folder.orgUnitId`. */
export const setFolderOrgUnitSchema = z.object({
  orgUnitId: uuidSchema.nullable(),
});
export type SetFolderOrgUnitInput = z.infer<typeof setFolderOrgUnitSchema>;

export const remapApplySchema = z.object({
  moves: z
    .array(
      z.object({
        folderId: uuidSchema,
        newParentId: uuidSchema.nullable(),
      }),
    )
    .min(1),
});
export type RemapApplyInput = z.infer<typeof remapApplySchema>;

export interface OrgUnitFolderSummary {
  id: string;
  name: string;
  documentCount: number;
}

export interface OrgUnitNode {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  headUserId: string | null;
  headUserName: string | null;
  sortOrder: number;
  isActive: boolean;
  hasChildren: boolean;
  folders: OrgUnitFolderSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface RemapPreviewEntry {
  folderId: string;
  folderName: string;
  currentParentId: string | null;
  currentPathLabel: string;
  proposedParentId: string | null;
  proposedPathLabel: string;
  unchanged: boolean;
}

export interface OrgStructureSnapshotSummary {
  id: string;
  reason: string;
  orgUnitId: string | null;
  triggeredByName: string | null;
  createdAt: string;
}

export interface OrgStructureSnapshotDetail extends OrgStructureSnapshotSummary {
  data: {
    orgUnits: Array<{
      id: string;
      parentId: string | null;
      name: string;
      code: string | null;
      headUserId: string | null;
      sortOrder: number;
      isActive: boolean;
    }>;
    folderMappings: Array<{ folderId: string; folderName: string; orgUnitId: string }>;
  };
}
