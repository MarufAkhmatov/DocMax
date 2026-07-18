import { Injectable } from '@nestjs/common';
import type { Prisma } from '@docmax/db';
import type { GraphData, GraphEdge, GraphNode, GraphQuery, RelationType } from '@docmax/shared';
import { FolderAccessService } from '../folders/folder-access.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/** TZ-2 §2.3 — bog'lanishlar grafi: hujjatlar (node) + relations (edge). Tenant-scoped. */
@Injectable()
export class GraphService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly folderAccess: FolderAccessService,
  ) {}

  async build(query: GraphQuery): Promise<GraphData> {
    const where: Prisma.DocumentWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.docTypeId) where.docTypeId = query.docTypeId;
    if (query.folderId) where.folderId = query.folderId;

    // TZ-2 §2.5 — ACL'd papkadagi hujjatlar ruxsatsizga graf'da ham chiqmaydi.
    const denied = await this.folderAccess.deniedFolderIds();
    const finalWhere: Prisma.DocumentWhereInput = denied.length ? { AND: [where, { folderId: { notIn: denied } }] } : where;

    const docs = await this.tenant.client.document.findMany({
      where: finalWhere,
      select: {
        id: true,
        title: true,
        docNumber: true,
        status: true,
        docType: { select: { name: true } },
      },
    });
    const idSet = new Set(docs.map((d) => d.id));

    // Faqat filtrga tushgan hujjatlar orasidagi bog'lanishlar (ikkala uchi ham to'plamda)
    const relations = await this.tenant.client.documentRelation.findMany({
      where: {
        sourceDocumentId: { in: [...idSet] },
        targetDocumentId: { in: [...idSet] },
      },
      select: { sourceDocumentId: true, targetDocumentId: true, type: true },
    });

    const degree = new Map<string, number>();
    const edges: GraphEdge[] = relations.map((r) => {
      degree.set(r.sourceDocumentId, (degree.get(r.sourceDocumentId) ?? 0) + 1);
      degree.set(r.targetDocumentId, (degree.get(r.targetDocumentId) ?? 0) + 1);
      return { source: r.sourceDocumentId, target: r.targetDocumentId, type: r.type as RelationType };
    });

    let nodes: GraphNode[] = docs.map((d) => ({
      id: d.id,
      title: d.title,
      docNumber: d.docNumber,
      docTypeName: d.docType.name,
      status: d.status,
      degree: degree.get(d.id) ?? 0,
    }));

    if (!query.includeIsolated) {
      nodes = nodes.filter((n) => n.degree > 0);
    }

    return { nodes, edges };
  }
}
