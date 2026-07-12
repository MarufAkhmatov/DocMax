import { z } from 'zod';
import { uuidSchema } from './schemas';

// Admin Panel — no-code brend sozlamalari (kompaniya logotipi). Fayl o'zi
// files.ts'dagi umumiy presign/confirm oqimi orqali yuklanadi, bu yerda faqat
// Organization.logoFileId'ni o'sha fileId'ga bog'lash/uzish uchun sxema bor.

export const updateOrgLogoSchema = z.object({
  fileId: uuidSchema,
});
export type UpdateOrgLogoInput = z.infer<typeof updateOrgLogoSchema>;

export interface OrganizationBranding {
  logoUrl: string | null;
}
