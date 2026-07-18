import { Injectable } from '@nestjs/common';
import type { Prisma } from '@docmax/db';
import type { CanvasLayout, SaveCanvasLayoutInput } from '@docmax/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/** TZ-2 §2.2 — Workflow canvas: har user o'z joylashuvini ko'radi/saqlaydi. */
@Injectable()
export class WorkflowService {
  constructor(private readonly tenant: TenantPrismaService) {}

  private get canvasLayout() {
    return this.tenant.client.userCanvasLayout;
  }

  async getLayout(orgId: string, userId: string): Promise<CanvasLayout> {
    const row = await this.canvasLayout.findFirst({ where: { userId } });
    return { nodes: (row?.positions as CanvasLayout['nodes']) ?? [] };
  }

  async saveLayout(orgId: string, userId: string, input: SaveCanvasLayoutInput): Promise<CanvasLayout> {
    await this.canvasLayout.upsert({
      where: { orgId_userId: { orgId, userId } },
      create: { orgId, userId, positions: input.nodes as unknown as Prisma.InputJsonValue },
      update: { positions: input.nodes as unknown as Prisma.InputJsonValue },
    });
    return { nodes: input.nodes };
  }
}
