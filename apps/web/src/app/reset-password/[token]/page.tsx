'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { resetPasswordSchema } from '@docmax/shared';
import { ApiRequestError, authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, FormError } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string>();
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);

    if (password !== confirmPassword) {
      setError("Parollar mos kelmadi");
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Parolni tekshiring");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, parsed.data);
      router.push('/login?reset=success');
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 410) {
        setExpired(true);
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'Xato yuz berdi');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        {expired ? (
          <>
            <h1 className="text-[20px]">Havola muddati tugagan</h1>
            <p className="mt-2 text-[13px] font-semibold text-txt2">
              Parol tiklash havolasi (1 soat) muddati tugagan. Qaytadan so&apos;rang.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[20px]">Yangi parol</h1>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <FormError message={error} />
              <div>
                <Label htmlFor="password">Yangi parol</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Parolni takrorlang</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saqlanmoqda...' : 'Parolni saqlash'}
              </Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
