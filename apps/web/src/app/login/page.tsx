'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginSchema } from '@docmax/shared';
import { ApiRequestError, authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, FormError } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Email va parolni to'g'ri kiriting");
      return;
    }

    setLoading(true);
    try {
      const { accessToken, user } = await authApi.login(parsed.data);
      useAuthStore.getState().setSession(user, accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Kirishda xato yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="text-[25px] tracking-[-0.5px]">DocMax</h1>
        <p className="mt-1 text-[13px] font-semibold text-txt2">Tizimga kirish</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <FormError message={error} />

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Parol</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Kirilmoqda...' : 'Kirish'}
          </Button>

          <p className="text-center text-[12px] font-semibold text-txt3">
            <Link href="/forgot-password" className="text-green-text hover:underline">
              Parolni unutdingizmi?
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
