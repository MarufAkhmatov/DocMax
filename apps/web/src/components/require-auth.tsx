'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const router = useRouter();

  useEffect(() => {
    if (!isBootstrapping && !user) {
      router.replace('/login');
    }
  }, [isBootstrapping, user, router]);

  if (isBootstrapping || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13px] font-semibold text-txt3">Yuklanmoqda...</p>
      </div>
    );
  }

  return <>{children}</>;
}
