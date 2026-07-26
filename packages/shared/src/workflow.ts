import { z } from 'zod';
import { uuidSchema } from './schemas';

// TZ-2 §2.2 — Workflow canvas (n8n uslubi). Node = papka yoki hujjat, foydalanuvchi
// chap paneldan qidirib canvas'ga drag qiladi; joylashuv + asosiy ma'lumot (label/meta)
// qo'shilgan paytda saqlanadi — alohida "hujjat/papka tafsilotini olish" so'rovi shart emas.

export const canvasNodeSchema = z.object({
  id: uuidSchema,
  kind: z.enum(['folder', 'document']),
  x: z.number(),
  y: z.number(),
  label: z.string().max(500),
  meta: z.string().max(200).optional(),
});
export type CanvasNode = z.infer<typeof canvasNodeSchema>;

export const saveCanvasLayoutSchema = z.object({
  nodes: z.array(canvasNodeSchema).max(500),
});
export type SaveCanvasLayoutInput = z.infer<typeof saveCanvasLayoutSchema>;

export interface CanvasLayout {
  nodes: CanvasNode[];
}
