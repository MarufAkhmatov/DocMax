import { z } from 'zod';
import { paginationSchema, uuidSchema } from './schemas';
import { AUDIT_ACTIONS } from './enums';
import type { AuditAction } from './enums';

// TZ-2 §2.7 — Audit log sahifasi: filtr (user, amal, sana, entity) + CSV eksport.

export const listAuditLogsQuerySchema = paginationSchema.extend({
  userId: uuidSchema.optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.string().optional(),
  entityId: uuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  meta: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}
