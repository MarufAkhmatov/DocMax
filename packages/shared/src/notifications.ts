import { z } from 'zod';

// TZ-2 §2.7 — Bildirishnomalar markazi. Notification modeli TZ-0 sxemasida
// allaqachon mavjud (org_id/user_id bilan tenant-scoped).

export const NOTIFICATION_TYPES = [
  'DOCUMENT_ASSIGNED',
  'APPROVAL_PENDING',
  'TEMPLATE_READY',
  'VERSION_UPDATED',
  'STATUS_CHANGED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationsList {
  items: NotificationSummary[];
  unreadCount: number;
}
