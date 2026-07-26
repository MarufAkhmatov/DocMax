import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { TrashService } from './trash.service';

/** TZ-2 §2.7 — o'chirish bilan bir xil ruxsat: ADMIN+EDITOR. */
@Roles('ADMIN', 'EDITOR')
@Controller('trash')
export class TrashController {
  constructor(private readonly trash: TrashService) {}

  @Get()
  list() {
    return this.trash.list();
  }

  @Post('documents/:id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreDocument(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string, @Req() req: AuthenticatedRequest) {
    await this.trash.restoreDocument(id);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'RESTORE', entityType: 'Document', entityId: id });
  }

  @Post('folders/:id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restoreFolder(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string, @Req() req: AuthenticatedRequest) {
    await this.trash.restoreFolder(id);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'RESTORE', entityType: 'Folder', entityId: id });
  }
}
