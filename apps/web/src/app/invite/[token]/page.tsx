'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { acceptInviteSchema } from '@docmax/shared';
import { ApiRequestError, authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, FormError } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ValidationState =
  | { status: 'loading' }
  | { status: 'expired' }
  | { status: 'invalid' }
  | { status: 'valid'; email: string; fullName: string };

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<ValidationState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authApi
      .validateInvite(token)
      .then(({ email, fullName }) => setState({ status: 'valid', email, fullName }))
      .catch((err: unknown) => {
        setState(err instanceof ApiRequestError && err.status === 410 ? { status: 'expired' } : { status: 'invalid' });
      });
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);

    if (password !== confirmPassword) {
      setError("Parollar mos kelmadi");
      return;
    }
    const parsed = acceptInviteSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Parolni tekshiring");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.acceptInvite(token, parsed.data);
      router.push('/login?invite=accepted');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Xato yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        {state.status === 'loading' && <p className="text-[13px] font-semibold text-txt2">Tekshirilmoqda...</p>}

        {state.status === 'invalid' && (
          <>
            <h1 className="text-[20px]">Havola topilmadi</h1>
            <p className="mt-2 text-[13px] font-semibold text-txt2">
              Bu taklif havolasi yaroqsiz. Administratoringizga murojaat qiling.
            </p>
          </>
        )}

        {state.status === 'expired' && (
          <>
            <h1 className="text-[20px]">Havola muddati tugagan</h1>
            <p className="mt-2 text-[13px] font-semibold text-txt2">
              Bu taklif havolasining amal qilish muddati (72 soat) tugagan. Administratoringizdan qayta taklif
              so&apos;rang.
            </p>
          </>
        )}

        {state.status === 'valid' && (
          <>
            <h1 className="text-[25px] tracking-[-0.5px]">DocMax&apos;ga xush kelibsiz</h1>
            <p className="mt-1 text-[13px] font-semibold text-txt2">
              {state.fullName} ({state.email}) — parolingizni o&apos;rnating
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <FormError message={error} />

              <div>
                <Label htmlFor="password">Parol</Label>
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

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "O'rnatilmoqda..." : "Parolni o'rnatish"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
