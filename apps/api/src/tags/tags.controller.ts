import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Req } from '@nestjs/common';
import { updateTagSchema } from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TagsService } from './tags.service';

/** O'qish barcha rollarga ochiq (typeahead), boshqaruv (rename/delete) faqat ADMIN. */
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list() {
    return this.tags.list();
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(updateTagSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.tags.update(id, body as never);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'UPDATE', entityType: 'Tag', entityId: id });
    return result;
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string, @Req() req: AuthenticatedRequest) {
    await this.tags.remove(id);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'DELETE', entityType: 'Tag', entityId: id });
  }
}
