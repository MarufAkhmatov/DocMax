import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { createDocumentTypeSchema, updateDocumentTypeSchema } from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DocumentTypesService } from './document-types.service';

/** O'qish barcha rollarga ochiq (wizard/filtrlar shundan foydalanadi), mutatsiyalar faqat ADMIN. */
@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly types: DocumentTypesService) {}

  @Get()
  list() {
    return this.types.list();
  }

  @Roles('ADMIN')
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createDocumentTypeSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.types.create(user.orgId, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'CREATE',
      entityType: 'DocumentType',
      entityId: result.id,
    });
    return result;
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDocumentTypeSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.types.update(id, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'UPDATE',
      entityType: 'DocumentType',
      entityId: id,
    });
    return result;
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.types.remove(id);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'DELETE',
      entityType: 'DocumentType',
      entityId: id,
    });
  }
}
