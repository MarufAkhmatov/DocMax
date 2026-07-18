// TZ-2 §2.7 — Trash: o'chirilgan hujjat/papkalar 30 kun saqlanadi, tiklash mumkin,
// muddati o'tgach worker cron'i butunlay o'chiradi (fayllar MinIO'dan ham).

export const TRASH_RETENTION_DAYS = 30;

export interface TrashItem {
  id: string;
  type: 'document' | 'folder';
  title: string;
  deletedAt: string;
  purgeAt: string;
}
