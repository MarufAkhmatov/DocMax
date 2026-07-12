import { createHash, randomBytes } from 'node:crypto';

/** Xom (foydalanuvchiga yuboriladigan) token — DB'da hech qachon xom holda saqlanmaydi. */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
  return addHours(date, days * 24);
}
