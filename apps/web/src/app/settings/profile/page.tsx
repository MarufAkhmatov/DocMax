'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, THEMES, updateProfileSchema, type Locale, type Theme } from '@docmax/shared';
import { ApiRequestError, authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { Card, FormError, FormSuccess } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ProfileForm() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const [fullName, setFullName] = useState(user.fullName);
  const [locale, setLocale] = useState<Locale>(user.locale as Locale);
  const [theme, setTheme] = useState<Theme>(user.theme as Theme);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSuccess(false);

    const parsed = updateProfileSchema.safeParse({ fullName, locale, theme });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring");
      return;
    }

    setLoading(true);
    try {
      const updated = await authApi.updateProfile(parsed.data);
      useAuthStore.getState().setSession(updated, useAuthStore.getState().accessToken!);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Xato yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      useAuthStore.getState().clearSession();
      router.push('/login');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="text-[20px]">Profil sozlamalari</h1>
        <p className="mt-1 text-[13px] font-semibold text-txt2">{user.email}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <FormError message={error} />
          <FormSuccess message={success ? 'Saqlandi' : undefined} />

          <div>
            <Label htmlFor="fullName">Ism familiya</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="locale">Til</Label>
              <select
                id="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="h-11 w-full rounded-[12px] border border-glass-brd bg-glass px-3 text-[13px] text-txt outline-none focus:border-green/60 focus:ring-2 focus:ring-green/20"
              >
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="theme">Mavzu</Label>
              <select
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className="h-11 w-full rounded-[12px] border border-glass-brd bg-glass px-3 text-[13px] text-txt outline-none focus:border-green/60 focus:ring-2 focus:ring-green/20"
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? 'Chiqilmoqda...' : 'Chiqish'}
          </Button>
        </form>
      </Card>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileForm />
    </RequireAuth>
  );
}
