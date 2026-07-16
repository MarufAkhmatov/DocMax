import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { createDocumentSchema, listDocumentsQuerySchema, updateDocumentSchema } from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DocumentsService } from './documents.service';

/** O'qish barcha rollarga ochiq, mutatsiyalar ADMIN+EDITOR (TZ-1 §1.1 ruxsat matritsasi). */
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(listDocumentsQuerySchema)) query: unknown) {
    return this.documents.list(user.orgId, query as never);
  }

  @Get(':id')
  getById(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string) {
    return this.documents.getById(user.orgId, id);
  }

  @Roles('ADMIN', 'EDITOR')
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createDocumentSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.documents.create(user.orgId, user.sub, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'CREATE',
      entityType: 'Document',
      entityId: result.id,
    });
    return result;
  }

  @Roles('ADMIN', 'EDITOR')
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.documents.update(user.orgId, id, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'UPDATE',
      entityType: 'Document',
      entityId: id,
    });
    return result;
  }

  @Roles('ADMIN', 'EDITOR')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string, @Req() req: AuthenticatedRequest) {
    await this.documents.remove(id);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'DELETE',
      entityType: 'Document',
      entityId: id,
    });
  }
}
