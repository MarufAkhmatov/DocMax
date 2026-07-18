import type {
  AcceptInviteInput,
  ApiError,
  AuthUser,
  BulkDocumentsInput,
  BulkDocumentsResult,
  CanvasLayout,
  ComparisonTemplateInput,
  ComparisonTemplateJob,
  ComparisonTemplateStatus,
  ConfirmFileInput,
  CreateDocumentInput,
  CreateDocumentRelationInput,
  CreateDocumentVersionInput,
  CreateDocumentTypeInput,
  CreateFolderInput,
  DashboardStats,
  DocumentDetail,
  DocumentRelationSummary,
  DocumentTypeSummary,
  FileDownloadResult,
  GraphData,
  GraphQuery,
  FileSummary,
  FolderNode,
  ForgotPasswordInput,
  InviteInput,
  ListAuditLogsQuery,
  ListDocumentsQuery,
  LoginInput,
  MoveFolderInput,
  NotificationsList,
  OrganizationBranding,
  PaginatedAuditLogs,
  PaginatedDocuments,
  PresignFileInput,
  PresignResult,
  ResetPasswordInput,
  SaveCanvasLayoutInput,
  SetupInput,
  TagSummary,
  TrashItem,
  UpdateDocumentInput,
  UpdateDocumentTypeInput,
  UpdateFolderInput,
  UpdateProfileInput,
  UpdateTagInput,
} from '@docmax/shared';
import { useAuthStore } from '@/stores/auth';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001/api/v1';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError['error'],
  ) {
    super(body.message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Refresh muvaffaqiyatsiz bo'lsa qayta urinmaslik (refresh so'rovining o'zi uchun) */
  skipAuthRetry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function rawFetch(path: string, options: RequestOptions, accessToken: string | null) {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return res;
}

/** Refresh cookie orqali yangi accessToken so'raydi — parallel so'rovlar bitta refresh'ni ulashadi. */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await rawFetch('/auth/refresh', { method: 'POST', skipAuthRetry: true }, null);
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken: string };
        useAuthStore.getState().setAccessToken(data.accessToken);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/** 401 kelsa bir marta refresh qilib qayta urinadigan API client (CLAUDE.md 4-qoida — shared sxemalar bilan mos DTO'lar). */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let accessToken = useAuthStore.getState().accessToken;
  let res = await rawFetch(path, options, accessToken);

  if (res.status === 401 && !options.skipAuthRetry) {
    accessToken = await refreshAccessToken();
    if (accessToken) {
      res = await rawFetch(path, options, accessToken);
    }
  }

  if (!res.ok) {
    let body: ApiError['error'] = { code: 'INTERNAL', message: 'Kutilmagan xato yuz berdi' };
    try {
      const json = (await res.json()) as ApiError;
      body = json.error;
    } catch {
      // javob JSON emas — default xabar ishlatiladi
    }
    if (res.status === 401) {
      useAuthStore.getState().clearSession();
    }
    throw new ApiRequestError(res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const authApi = {
  setup: (input: SetupInput) =>
    apiFetch<{ org: { id: string; name: string; slug: string }; user: AuthUser }>('/auth/setup', {
      method: 'POST',
      body: input,
      skipAuthRetry: true,
    }),

  login: (input: LoginInput) =>
    apiFetch<{ accessToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: input,
      skipAuthRetry: true,
    }),

  logout: () => apiFetch<{ success: boolean }>('/auth/logout', { method: 'POST', skipAuthRetry: true }),

  refresh: refreshAccessToken,

  me: () => apiFetch<AuthUser>('/auth/me'),

  updateProfile: (input: UpdateProfileInput) =>
    apiFetch<AuthUser>('/auth/profile', { method: 'PATCH', body: input }),

  validateInvite: (token: string) =>
    apiFetch<{ email: string; fullName: string }>(`/auth/invite/${token}`, { skipAuthRetry: true }),

  acceptInvite: (token: string, input: AcceptInviteInput) =>
    apiFetch<{ success: boolean }>(`/auth/invite/${token}/accept`, {
      method: 'POST',
      body: input,
      skipAuthRetry: true,
    }),

  invite: (input: InviteInput) =>
    apiFetch<{ id: string; email: string; role: string }>('/auth/invite', { method: 'POST', body: input }),

  forgotPassword: (input: ForgotPasswordInput) =>
    apiFetch<{ success: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: input,
      skipAuthRetry: true,
    }),

  resetPassword: (token: string, input: ResetPasswordInput) =>
    apiFetch<{ success: boolean }>(`/auth/reset-password/${token}`, {
      method: 'POST',
      body: input,
      skipAuthRetry: true,
    }),
};

export const foldersApi = {
  tree: (params: { parentId?: string | null; q?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.parentId) search.set('parentId', params.parentId);
    if (params.q) search.set('q', params.q);
    const qs = search.toString();
    return apiFetch<FolderNode[]>(`/folders/tree${qs ? `?${qs}` : ''}`);
  },

  create: (input: CreateFolderInput) =>
    apiFetch<FolderNode>('/folders', { method: 'POST', body: input }),

  update: (id: string, input: UpdateFolderInput) =>
    apiFetch<FolderNode>(`/folders/${id}`, { method: 'PATCH', body: input }),

  move: (id: string, input: MoveFolderInput) =>
    apiFetch<FolderNode>(`/folders/${id}/move`, { method: 'POST', body: input }),

  remove: (id: string) => apiFetch<void>(`/folders/${id}`, { method: 'DELETE' }),
};

/** Fayl bayt'laridan sha256 hex — dedup uchun (TZ-1 §1.3 qabul mezoni). */
export async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const filesApi = {
  presign: (input: PresignFileInput) =>
    apiFetch<PresignResult>('/files/presign', { method: 'POST', body: input }),

  confirm: (input: ConfirmFileInput) =>
    apiFetch<FileSummary>('/files/confirm', { method: 'POST', body: input }),

  /** Bosilgan paytda yangi presigned URL — jadval chip'lari uchun (VIEW/DOWNLOAD audit backend'da). */
  downloadUrl: (id: string, disposition: 'inline' | 'attachment' = 'attachment') =>
    apiFetch<FileDownloadResult>(`/files/${id}/download?disposition=${disposition}`),

  /** presign → (kerak bo'lsa) to'g'ridan-to'g'ri MinIO'ga PUT → confirm (CLAUDE.md 6-qoida). */
  upload: async (file: File): Promise<FileSummary> => {
    const sha256 = await sha256File(file);
    const presigned = await filesApi.presign({
      filename: file.name,
      mime: file.type as PresignFileInput['mime'],
      sizeBytes: file.size,
      sha256,
    });

    if (presigned.dedup && presigned.file) {
      return presigned.file;
    }
    if (!presigned.uploadUrl || !presigned.objectKey) {
      throw new Error('Presigned URL olinmadi');
    }

    const putRes = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error("Faylni MinIO'ga yuklashda xato yuz berdi");
    }

    return filesApi.confirm({
      objectKey: presigned.objectKey,
      sha256,
      originalName: file.name,
      mime: file.type as PresignFileInput['mime'],
      sizeBytes: file.size,
    });
  },
};

export const documentsApi = {
  list: (query: Partial<ListDocumentsQuery> = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    return apiFetch<PaginatedDocuments>(`/documents${qs ? `?${qs}` : ''}`);
  },

  create: (input: CreateDocumentInput) =>
    apiFetch<DocumentDetail>('/documents', { method: 'POST', body: input }),

  get: (id: string) => apiFetch<DocumentDetail>(`/documents/${id}`),

  update: (id: string, input: UpdateDocumentInput) =>
    apiFetch<DocumentDetail>(`/documents/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) => apiFetch<void>(`/documents/${id}`, { method: 'DELETE' }),

  bulk: (input: BulkDocumentsInput) =>
    apiFetch<BulkDocumentsResult>('/documents/bulk', { method: 'POST', body: input }),

  // TZ-1 §1.4 — versiyalash + taqqoslama shabloni
  createVersion: (id: string, input: CreateDocumentVersionInput) =>
    apiFetch<DocumentDetail>(`/documents/${id}/versions`, { method: 'POST', body: input }),

  requestComparisonTemplate: (id: string, input: ComparisonTemplateInput) =>
    apiFetch<ComparisonTemplateJob>(`/documents/${id}/comparison-template`, { method: 'POST', body: input }),

  templateJobStatus: (jobId: string) =>
    apiFetch<ComparisonTemplateStatus>(`/documents/template-jobs/${jobId}`),

  /** TZ-2 §2.7 — DocDetail audit paneli (org-darajasidagi to'liq /audit-logs'dan farqli, ADMIN cheklovsiz). */
  audit: (id: string) => apiFetch<PaginatedAuditLogs>(`/documents/${id}/audit`),
};

export const graphApi = {
  get: (query: Partial<GraphQuery> = {}) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const qs = search.toString();
    return apiFetch<GraphData>(`/graph${qs ? `?${qs}` : ''}`);
  },
};

export const documentTypesApi = {
  list: () => apiFetch<DocumentTypeSummary[]>('/document-types'),

  create: (input: CreateDocumentTypeInput) =>
    apiFetch<DocumentTypeSummary>('/document-types', { method: 'POST', body: input }),

  update: (id: string, input: UpdateDocumentTypeInput) =>
    apiFetch<DocumentTypeSummary>(`/document-types/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) => apiFetch<void>(`/document-types/${id}`, { method: 'DELETE' }),
};

export const organizationsApi = {
  branding: () => apiFetch<OrganizationBranding>('/organizations/branding'),

  setLogo: (fileId: string) =>
    apiFetch<OrganizationBranding>('/organizations/branding/logo', { method: 'PATCH', body: { fileId } }),

  removeLogo: () => apiFetch<OrganizationBranding>('/organizations/branding/logo', { method: 'DELETE' }),
};

export const relationsApi = {
  list: (documentId: string) => apiFetch<DocumentRelationSummary[]>(`/documents/${documentId}/relations`),

  create: (documentId: string, input: CreateDocumentRelationInput) =>
    apiFetch<DocumentRelationSummary>(`/documents/${documentId}/relations`, { method: 'POST', body: input }),

  remove: (documentId: string, relationId: string) =>
    apiFetch<void>(`/documents/${documentId}/relations/${relationId}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: (unreadOnly = false) =>
    apiFetch<NotificationsList>(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`),

  markRead: (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () => apiFetch<void>('/notifications/read-all', { method: 'PATCH' }),
};

export const statsApi = {
  dashboard: () => apiFetch<DashboardStats>('/stats/dashboard'),
};

export const trashApi = {
  list: () => apiFetch<TrashItem[]>('/trash'),

  restoreDocument: (id: string) => apiFetch<void>(`/trash/documents/${id}/restore`, { method: 'POST' }),

  restoreFolder: (id: string) => apiFetch<void>(`/trash/folders/${id}/restore`, { method: 'POST' }),
};

export const auditLogsApi = {
  list: (query: Partial<ListAuditLogsQuery> = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    return apiFetch<PaginatedAuditLogs>(`/audit-logs${qs ? `?${qs}` : ''}`);
  },

  /** Bearer auth kerak bo'lgani uchun to'g'ridan-to'g'ri href emas — blob sifatida olib,
   * clientda vaqtinchalik <a download> orqali saqlanadi. */
  exportCsv: async (query: Partial<ListAuditLogsQuery> = {}): Promise<Blob> => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    const accessToken = useAuthStore.getState().accessToken;
    const res = await fetch(`${API_URL}/audit-logs/export.csv${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) {
      throw new Error('CSV eksportida xato yuz berdi');
    }
    return res.blob();
  },
};

export const tagsApi = {
  list: () => apiFetch<TagSummary[]>('/tags'),

  update: (id: string, input: UpdateTagInput) => apiFetch<TagSummary>(`/tags/${id}`, { method: 'PATCH', body: input }),

  remove: (id: string) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' }),
};

export const workflowApi = {
  getLayout: () => apiFetch<CanvasLayout>('/workflow/layout'),

  saveLayout: (input: SaveCanvasLayoutInput) => apiFetch<CanvasLayout>('/workflow/layout', { method: 'PUT', body: input }),
};
