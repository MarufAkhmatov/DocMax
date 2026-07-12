import type { AuditAction } from '@docmax/shared';
import type { AuthenticatedRequest } from '../auth/types';

export interface AuditContext {
  orgId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
}

const AUDIT_CONTEXT_KEY = '__auditContext';

interface RequestWithAudit extends AuthenticatedRequest {
  [AUDIT_CONTEXT_KEY]?: AuditContext;
}

/**
 * Servislar audit_logs'ga TO'G'RIDAN-TO'G'RI yozmaydi (CLAUDE.md 3-qoida) — faqat
 * shu funksiya orqali "nima sodir bo'ldi"ni belgilaydi; haqiqiy yozuvni markaziy
 * AuditInterceptor amalga oshiradi.
 */
export function setAuditContext(request: AuthenticatedRequest, ctx: AuditContext) {
  (request as RequestWithAudit)[AUDIT_CONTEXT_KEY] = ctx;
}

export function getAuditContext(request: AuthenticatedRequest): AuditContext | undefined {
  return (request as RequestWithAudit)[AUDIT_CONTEXT_KEY];
}
