import { Body, Controller, Post } from '@nestjs/common';
import { confirmFileSchema, presignFileSchema } from '@docmax/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { RequestUser } from '../auth/types';
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
}
