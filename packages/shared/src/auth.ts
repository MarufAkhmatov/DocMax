import { z } from 'zod';
import { localeSchema, themeSchema, emailSchema, passwordSchema } from './schemas';
import { ROLES } from './enums';

// TZ-1 §1.1 — Autentifikatsiya. Front va back shu sxemalardan foydalanadi (CLAUDE.md 4-qoida).

/** /setup — faqat bo'sh bazada: org + birinchi (ADMIN) akkaunt (TZ-1 §1.1) */
export const setupSchema = z.object({
  orgName: z.string().min(2).max(200),
  orgSlug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Faqat kichik lotin harflari, raqam va '-' bo'lishi mumkin"),
  fullName: z.string().min(2).max(200),
  email: emailSchema,
  password: passwordSchema,
});
export type SetupInput = z.infer<typeof setupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Faqat ADMIN chaqiradi (TZ-1 §1.1 ruxsat matritsasi) */
export const inviteSchema = z.object({
  email: emailSchema,
  fullName: z.string().min(2).max(200),
  role: z.enum(ROLES).exclude(['SUPER_ADMIN']),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const acceptInviteSchema = z.object({
  password: passwordSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  locale: localeSchema.optional(),
  theme: themeSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** JWT access token payload (15 daqiqa, TZ-0 §4) */
export interface AccessTokenPayload {
  sub: string; // user id
  orgId: string;
  role: (typeof ROLES)[number];
}

export interface AuthUser {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: (typeof ROLES)[number];
  locale: string;
  theme: string;
}
