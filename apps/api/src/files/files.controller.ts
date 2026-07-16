import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { confirmFileSchema, fileDownloadQuerySchema, presignFileSchema } from '@docmax/shared';
import type { FileDownloadQuery } from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FilesService } from './files.service';

/** Hujjat yaratish/tahrirlash bilan bir xil ruxsat darajasi (TZ-1 §1.1 ruxsat matritsasi). */
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Roles('ADMIN', 'EDITOR')
  @Post('presign')
  presign(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(presignFileSchema)) body: unknown,
  ) {
    return this.files.presign(user.orgId, body as never);
  }

  @Roles('ADMIN', 'EDITOR')
  @Post('confirm')
  confirm(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(confirmFileSchema)) body: unknown,
  ) {
    return this.files.confirm(user.orgId, user.sub, body as never);
  }

  /** Ko'rish/yuklab olish — barcha rollarga (TZ-1 §1.1 matritsasi); VIEW/DOWNLOAD audit yoziladi. */
  @Get(':id/download')
  async download(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Query(new ZodValidationPipe(fileDownloadQuerySchema)) query: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const q = query as FileDownloadQuery;
    const result = await this.files.downloadUrl(id, q.disposition === 'inline');
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: q.disposition === 'inline' ? 'VIEW' : 'DOWNLOAD',
      entityType: 'File',
      entityId: id,
    });
    return result;
  }
}
