// org_id maydoniga ega modellar ro'yxati — tenant-client.ts shu ro'yxat asosida
// har bir so'rovga avtomatik org_id filtri qo'shadi (CLAUDE.md 1-qoida).
//
// Eslatma: document_tags, folder_shortcuts va external_acts bu ro'yxatda YO'Q —
// ularda to'g'ridan-to'g'ri org_id ustuni yo'q (TZ-0 §3), tegishlilik ota-model
// orqali (document_id/folder_id) aniqlanadi. Bunday jadvallarga tenant-xavfsiz
// kirish uchun servis qatlamida avval egasi tekshiriladi (keyingi bosqichlar).
export const TENANT_SCOPED_MODELS = [
  'User',
  'OrgUnit',
  'Folder',
  'Document',
  'File',
  'DocumentRelation',
  'Tag',
  'Permission',
  'AuditLog',
  'Notification',
  'Embedding',
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

export function isTenantScopedModel(model: string): model is TenantScopedModel {
  return (TENANT_SCOPED_MODELS as readonly string[]).includes(model);
}
