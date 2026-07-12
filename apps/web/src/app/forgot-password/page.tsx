'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { forgotPasswordSchema } from '@docmax/shared';
import { ApiRequestError, authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, FormError, FormSuccess } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError("To'g'ri email kiriting");
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPassword(parsed.data);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Xato yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="text-[20px]">Parolni tiklash</h1>
        <p className="mt-1 text-[13px] font-semibold text-txt2">
          Email manzilingizni kiriting — tiklash havolasini yuboramiz
        </p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <FormSuccess message="Agar bu email tizimda mavjud bo'lsa, tiklash havolasi yuborildi." />
            <Link href="/login" className="block text-center text-[12.5px] font-bold text-green-text hover:underline">
              Kirish sahifasiga qaytish
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <FormError message={error} />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Yuborilmoqda...' : 'Havola yuborish'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
