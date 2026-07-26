import { z } from 'zod';
import { permissionSubjectTypeSchema, uuidSchema } from './schemas';
import { ROLES } from './enums';
import type { PermissionSubjectType } from './enums';

// TZ-2 §2.5 — Papka darajasidagi ruxsatlar (ACL). subjectId: ROLE bo'lsa Role
// qiymati ("EDITOR"), USER/ORG_UNIT bo'lsa uuid — shuning uchun discriminatsiya refine bilan.

const permissionEntryInputSchema = z
  .object({
    subjectType: permissionSubjectTypeSchema,
    subjectId: z.string().min(1).max(100),
    canView: z.boolean(),
    canEdit: z.boolean(),
    canDownload: z.boolean(),
    inherit: z.boolean(),
  })
  .refine((entry) => entry.subjectType !== 'ROLE' || (ROLES as readonly string[]).includes(entry.subjectId), {
    message: "subjectId ROLE turi uchun mavjud rol bo'lishi kerak",
    path: ['subjectId'],
  })
  .refine((entry) => entry.subjectType === 'ROLE' || uuidSchema.safeParse(entry.subjectId).success, {
    message: 'subjectId USER/ORG_UNIT turi uchun uuid boʻlishi kerak',
    path: ['subjectId'],
  });
export type PermissionEntryInput = z.infer<typeof permissionEntryInputSchema>;

export const setFolderPermissionsSchema = z.object({
  enabled: z.boolean(),
  entries: z.array(permissionEntryInputSchema).max(200),
});
export type SetFolderPermissionsInput = z.infer<typeof setFolderPermissionsSchema>;

export interface PermissionEntry {
  id: string;
  subjectType: PermissionSubjectType;
  subjectId: string;
  subjectLabel: string;
  canView: boolean;
  canEdit: boolean;
  canDownload: boolean;
  inherit: boolean;
}

export interface FolderPermissionsSummary {
  folderId: string;
  aclEnabled: boolean;
  entries: PermissionEntry[];
}

/** Joriy foydalanuvchining shu papkadagi effektiv huquqlari (drawer/preview uchun yengil endpoint). */
export interface FolderAccessResult {
  canView: boolean;
  canEdit: boolean;
  canDownload: boolean;
  locked: boolean;
}
