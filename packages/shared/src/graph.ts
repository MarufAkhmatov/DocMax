import { z } from 'zod';
import { docStatusSchema, uuidSchema } from './schemas';
import type { DocStatus, RelationType } from './enums';

// TZ-2 §2.3 — Bog'lanishlar grafi: hujjatlar (node) + relations (edge), filtrlar bilan.

export const graphQuerySchema = z.object({
  status: docStatusSchema.optional(),
  docTypeId: uuidSchema.optional(),
  folderId: uuidSchema.optional(),
  /** Yolg'iz (bog'lanishsiz) node'larni ham qaytarish (default: faqat bog'langanlar + shu filtrga tushganlar) */
  includeIsolated: z.coerce.boolean().default(true),
});
export type GraphQuery = z.infer<typeof graphQuerySchema>;

export interface GraphNode {
  id: string;
  title: string;
  docNumber: string | null;
  docTypeName: string;
  status: DocStatus;
  degree: number; // bog'lanishlar soni — node o'lchami uchun
  /** Hujjat papkasining org-unit'i (TZ-2 §2.3 — "podrazdeleniye bo'yicha" rang rejimi). */
  orgUnitId: string | null;
  orgUnitName: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: RelationType;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
