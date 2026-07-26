import { z } from 'zod';
import { uuidSchema } from './schemas';

// TZ-2 §2.4 — Org-struktura canvas (n8n uslubi). `workflow.ts`dagi canvasNodeSchema'ga
// o'xshash, lekin ALOHIDA joylashuv jadvaliga saqlanadi (`org_unit_canvas_layouts`) —
// bitta userning workflow (hujjat-bog'lanish) canvas'i bilan org-struktura canvas'i
// mustaqil, bir-birini bosib qolmasligi kerak.

export const orgCanvasNodeSchema = z.object({
  id: uuidSchema,
  kind: z.enum(['unit', 'folder']),
  x: z.number(),
  y: z.number(),
  label: z.string().max(500),
  meta: z.string().max(200).optional(),
});
export type OrgCanvasNode = z.infer<typeof orgCanvasNodeSchema>;

export const saveOrgCanvasLayoutSchema = z.object({
  nodes: z.array(orgCanvasNodeSchema).max(500),
});
export type SaveOrgCanvasLayoutInput = z.infer<typeof saveOrgCanvasLayoutSchema>;

export interface OrgCanvasLayout {
  nodes: OrgCanvasNode[];
}
