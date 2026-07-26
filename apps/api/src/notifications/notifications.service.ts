import { Injectable } from '@nestjs/common';
import type { Prisma } from '@docmax/db';
import type { NotificationSummary, NotificationType, NotificationsList } from '@docmax/shared';
import { notFound } from '../common/api-error';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const LIST_LIMIT = 50;

function toSummary(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  meta: Prisma.JsonValue;
  createdAt: Date;
}): NotificationSummary {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: row.isRead,
    meta: (row.meta ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}

/** TZ-2 §2.7 — Bildirishnomalar markazi. Boshqa servislar `notifyUsers()` orqali
 * hodisa yuz berganda yozuv yaratadi (documents.service, document-relations.service). */
@Injectable()
export class NotificationsService {
  constructor(private readonly tenant: TenantPrismaService) {}

  private get notification() {
    return this.tenant.client.notification;
  }

  async list(userId: string, unreadOnly: boolean): Promise<NotificationsList> {
    const [rows, unreadCount] = await Promise.all([
      this.notification.findMany({
        where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
      }),
      this.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items: rows.map(toSummary), unreadCount };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const existing = await this.notification.findFirst({ where: { id, userId } });
    if (!existing) {
      throw notFound('Bildirishnoma topilmadi');
    }
    await this.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }

  /** Hodisaga obuna bo'lgan userlarga bildirishnoma yaratadi. `orgId` boshqa tenant-scoped
   * modellardagi kabi (masalan Tag.upsert) qo'lda beriladi — extension buni runtime'da
   * qayta yozadi, lekin Prisma'ning generatsiya qilingan tipi bu maydonni majburiy deb biladi. */
  async notifyUsers(
    orgId: string,
    userIds: string[],
    data: { type: NotificationType; title: string; body: string; link?: string | null; meta?: Record<string, unknown> },
  ): Promise<void> {
    const targets = [...new Set(userIds)];
    if (!targets.length) {
      return;
    }
    await this.notification.createMany({
      data: targets.map((userId) => ({
        orgId,
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link ?? null,
        meta: (data.meta ?? {}) as Prisma.InputJsonValue,
      })),
    });
  }
}
