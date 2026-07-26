import { Injectable } from '@nestjs/common';
import type { Prisma } from '@docmax/db';
import type { OrgCanvasLayout, SaveOrgCanvasLayoutInput } from '@docmax/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/** TZ-2 §2.4 — org-struktura canvas: har user o'z joylashuvini ko'radi/saqlaydi.
 * `apps/api/src/workflow/workflow.service.ts` bilan bir xil naqsh, alohida jadval
 * (`org_unit_canvas_layouts`) — workflow canvas'ining joylashuvi bilan aralashmaydi. */
@Injectable()
export class OrgStructureCanvasService {
  constructor(private readonly tenant: TenantPrismaService) {}

  private get canvasLayout() {
    return this.tenant.client.orgUnitCanvasLayout;
  }

  async getLayout(orgId: string, userId: string): Promise<OrgCanvasLayout> {
    const row = await this.canvasLayout.findFirst({ where: { userId } });
    return { nodes: (row?.positions as OrgCanvasLayout['nodes']) ?? [] };
  }

  async saveLayout(orgId: string, userId: string, input: SaveOrgCanvasLayoutInput): Promise<OrgCanvasLayout> {
    await this.canvasLayout.upsert({
      where: { orgId_userId: { orgId, userId } },
      create: { orgId, userId, positions: input.nodes as unknown as Prisma.InputJsonValue },
      update: { positions: input.nodes as unknown as Prisma.InputJsonValue },
    });
    return { nodes: input.nodes };
  }
}
