'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';

export function HomeAuthLinks() {
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  if (isBootstrapping) {
    return null;
  }

  return (
    <div className="mt-6 flex items-center justify-between border-t border-glass-brd pt-5">
      {user ? (
        <>
          <span className="text-[12.5px] font-semibold text-txt2">{user.fullName}</span>
          <Link href="/settings/profile" className="text-[12.5px] font-bold text-green-text hover:underline">
            Profil →
          </Link>
        </>
      ) : (
        <Link href="/login" className="text-[12.5px] font-bold text-green-text hover:underline">
          Tizimga kirish →
        </Link>
      )}
    </div>
  );
}
