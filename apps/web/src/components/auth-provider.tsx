'use client';

import { useEffect } from 'react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

/**
 * Sahifa yuklanganda refresh cookie orqali sessiyani tiklashga urinadi (accessToken
 * faqat xotirada saqlanadi, sahifa yangilanganda yo'qoladi — TZ-0 §4).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await authApi.refresh();
      if (token && !cancelled) {
        try {
          const user = await authApi.me();
          if (!cancelled) {
            useAuthStore.getState().setSession(user, token);
          }
          return;
        } catch {
          // token yaroqli emas — quyida bootstrap yakunlanadi
        }
      }
      if (!cancelled) {
        useAuthStore.getState().finishBootstrap();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
