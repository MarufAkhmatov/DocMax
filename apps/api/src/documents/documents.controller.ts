import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  bulkDocumentsSchema,
  comparisonTemplateSchema,
  createDocumentSchema,
  createDocumentVersionSchema,
  listDocumentsQuerySchema,
  updateDocumentSchema,
} from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DocumentsService } from './documents.service';

/** O'qish barcha rollarga ochiq, mutatsiyalar ADMIN+EDITOR (TZ-1 §1.1 ruxsat matritsasi). */
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

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

  /** Bulk amallar (delete/move/tag) — Vault tanlash bar. ':id'dan oldin (statik prefiks). */
  @Roles('ADMIN', 'EDITOR')
  @Post('bulk')
  async bulk(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(bulkDocumentsSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = body as import('@docmax/shared').BulkDocumentsInput;
    const result = await this.documents.bulk(user.orgId, input);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: input.action === 'delete' ? 'DELETE' : 'UPDATE',
      entityType: 'Document',
      entityId: input.documentIds[0],
      meta: { bulk: input.action, count: result.affected, ...(input.folderId ? { folderId: input.folderId } : {}), ...(input.tagName ? { tagName: input.tagName } : {}) },
    });
    return result;
  }

  @Get(':id')
  getById(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string) {
    return this.documents.getById(user.orgId, id);
  }

  /** TZ-2 §2.7 — DocDetail audit paneli: shu hujjatga oid faoliyat, hujjatni ko'ra oladigan
   * har kimga ochiq (org-darajasidagi to'liq /audit-logs ADMIN'ga cheklangan, bu esa torroq). */
  @Get(':id/audit')
  async documentAudit(@Param('id', new UuidParamPipe()) id: string) {
    await this.documents.assertVisible(id);
    return this.auditLogs.list({ entityType: 'Document', entityId: id, page: 1, limit: 10, order: 'desc' });
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

  @Roles('ADMIN', 'EDITOR', 'CONTRIBUTOR')
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

  @Roles('ADMIN', 'EDITOR', 'CONTRIBUTOR')
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.documents.update(user.orgId, user.sub, user.role, id, body as never);
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
