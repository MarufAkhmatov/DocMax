import type { AuditAction } from './enums';

// TZ-2 §2.7 — Dashboard statistika (avval hardcoded mock raqamlar edi).

export interface RecentActivityItem {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  userName: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalDocuments: number;
  totalFolders: number;
  activeDocuments: number;
  activeDocumentsThisMonth: number;
  pendingApproval: number;
  pendingApprovalOverdue: number;
  newExternalActs: number;
  recentActivity: RecentActivityItem[];
}
