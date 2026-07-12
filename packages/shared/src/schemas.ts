import { z } from 'zod';
import { DOC_STATUSES, DOC_TYPES, LOCALES, ROLES, THEMES } from './enums';

// Baza zod sxemalar (CLAUDE.md 4-qoida: validatsiya faqat zod, front+back bitta manba).
// Endpoint'larga bog'liq DTO'lar tegishli milestone'larda shu yerga qo'shiladi.

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export const roleSchema = z.enum(ROLES);
export const docTypeSchema = z.enum(DOC_TYPES);
export const docStatusSchema = z.enum(DOC_STATUSES);
export const localeSchema = z.enum(LOCALES);
export const themeSchema = z.enum(THEMES);

export const emailSchema = z.string().email().max(320);
export const passwordSchema = z.string().min(8).max(128);

/** API xato javobi formati (TZ-0 §4) */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'FORBIDDEN',
      'UNAUTHORIZED',
      'CONFLICT',
      'EXPIRED',
      'RATE_LIMITED',
      'INTERNAL',
    ]),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
