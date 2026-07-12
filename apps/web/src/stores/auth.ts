import { create } from 'zustand';
import type { AuthUser } from '@docmax/shared';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  /** Sahifa yuklanganda refresh cookie orqali sessiya tiklanayotgani (FOUC'ni oldini olish uchun) */
  isBootstrapping: boolean;
  setSession: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  finishBootstrap: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isBootstrapping: true,
  setSession: (user, accessToken) => set({ user, accessToken, isBootstrapping: false }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ user: null, accessToken: null, isBootstrapping: false }),
  finishBootstrap: () => set({ isBootstrapping: false }),
}));
