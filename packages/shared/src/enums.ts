// TZ-0 §3 dagi enum'lar — Prisma sxema va frontend bitta manbadan foydalanadi.
// Enum'lar hozirdan to'liq (SUPER_ADMIN/CONTRIBUTOR Bosqich 2'da faollashadi, TZ-1 §1.1).

export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'CONTRIBUTOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const DOC_TYPES = [
  'ORDER',
  'REGULATION',
  'POLICY',
  'INSTRUCTION',
  'PROTOCOL',
  'OTHER',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_STATUSES = ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'EXPIRED'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const PLANS = ['free', 'pro', 'enterprise'] as const;
export type Plan = (typeof PLANS)[number];

export const LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uz';

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const FILE_STATUSES = ['PENDING', 'READY', 'FAILED'] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export const RELATION_TYPES = [
  'RELATED',
  'PARENT_CHILD',
  'AMENDS',
  'REPLACES',
  'BASED_ON',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const PERMISSION_SUBJECT_TYPES = ['ROLE', 'USER', 'ORG_UNIT'] as const;
export type PermissionSubjectType = (typeof PERMISSION_SUBJECT_TYPES)[number];

export const AUDIT_ACTIONS = [
  'VIEW',
  'DOWNLOAD',
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'LOGIN',
  'LOGOUT',
  'PERMISSION_CHANGE',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const EXTERNAL_SOURCES = ['CBU', 'LEX'] as const;
export type ExternalSource = (typeof EXTERNAL_SOURCES)[number];

export const EXTERNAL_ACT_STATUSES = ['NEW', 'PROCESSED'] as const;
export type ExternalActStatus = (typeof EXTERNAL_ACT_STATUSES)[number];

export const EMBEDDING_ENTITY_TYPES = ['DOCUMENT_VERSION', 'EXTERNAL_ACT'] as const;
export type EmbeddingEntityType = (typeof EMBEDDING_ENTITY_TYPES)[number];
