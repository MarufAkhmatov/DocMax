'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { setupSchema } from '@docmax/shared';
import { ApiRequestError, authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, FormError } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function SetupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  function onOrgNameChange(value: string) {
    setOrgName(value);
    if (!slugTouched) {
      setOrgSlug(slugify(value));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);

    const parsed = setupSchema.safeParse({ orgName, orgSlug, fullName, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring");
      return;
    }

    setLoading(true);
    try {
      await authApi.setup(parsed.data);
      router.push('/login?setup=success');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Sozlashda xato yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <h1 className="text-[25px] tracking-[-0.5px]">DocMax sozlash</h1>
        <p className="mt-1 text-[13px] font-semibold text-txt2">
          Birinchi tashkilot va administrator akkauntini yarating
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <FormError message={error} />

          <div>
            <Label htmlFor="orgName">Tashkilot nomi</Label>
            <Input id="orgName" value={orgName} onChange={(e) => onOrgNameChange(e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="orgSlug">Manzil (slug)</Label>
            <Input
              id="orgSlug"
              value={orgSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setOrgSlug(e.target.value);
              }}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fullName">Ismingiz</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sozlanmoqda...' : 'Sozlash'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
