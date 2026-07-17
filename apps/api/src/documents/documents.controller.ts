import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  comparisonTemplateSchema,
  createDocumentSchema,
  createDocumentVersionSchema,
  listDocumentsQuerySchema,
  updateDocumentSchema,
} from '@docmax/shared';
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

  /** MUHIM: statik prefiksli route ':id'dan OLDIN e'lon qilinadi (Nest tartib bo'yicha moslaydi). */
  @Roles('ADMIN', 'EDITOR')
  @Get('template-jobs/:jobId')
  templateJobStatus(@CurrentUser() user: RequestUser, @Param('jobId') jobId: string) {
    return this.documents.comparisonTemplateStatus(user.orgId, jobId);
  }

  @Get(':id')
  getById(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string) {
    return this.documents.getById(user.orgId, id);
  }

  /** TZ-1 §1.4 — yangi versiya (tranzaksiyada, race'siz raqamlash). */
  @Roles('ADMIN', 'EDITOR')
  @Post(':id/versions')
  async createVersion(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(createDocumentVersionSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.documents.createVersion(user.orgId, user.sub, id, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'CREATE',
      entityType: 'DocumentVersion',
      entityId: result.versions[0]?.id ?? id,
      meta: { documentId: id, versionLabel: result.currentVersionLabel },
    });
    return result;
  }

  /** TZ-1 §1.4 — taqqoslama shablonini fon vazifada yaratish (diff.generate). */
  @Roles('ADMIN', 'EDITOR')
  @Post(':id/comparison-template')
  @HttpCode(HttpStatus.ACCEPTED)
  requestTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(comparisonTemplateSchema)) body: unknown,
  ) {
    return this.documents.requestComparisonTemplate(user.orgId, user.sub, id, body as never);
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
