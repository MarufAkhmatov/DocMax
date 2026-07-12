import type {
  AcceptInviteInput,
  ApiError,
  AuthUser,
  CreateFolderInput,
  FolderNode,
  ForgotPasswordInput,
  InviteInput,
  LoginInput,
  MoveFolderInput,
  ResetPasswordInput,
  SetupInput,
  UpdateFolderInput,
  UpdateProfileInput,
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
