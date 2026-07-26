import { Body, Controller, Get, Put } from '@nestjs/common';
import { saveCanvasLayoutSchema } from '@docmax/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkflowService } from './workflow.service';

/** TZ-2 §2.2 — Workflow canvas joylashuvi, har user o'ziniki (audit shart emas — UI holati). */
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('layout')
  getLayout(@CurrentUser() user: RequestUser) {
    return this.workflow.getLayout(user.orgId, user.sub);
  }

  @Put('layout')
  saveLayout(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(saveCanvasLayoutSchema)) body: unknown) {
    return this.workflow.saveLayout(user.orgId, user.sub, body as never);
  }
}
