import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { createDocumentRelationSchema, type CreateDocumentRelationInput } from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DocumentsService } from '../documents/documents.service';
import { DocumentRelationsService } from './document-relations.service';

/** O'qish barcha rollarga ochiq, mutatsiyalar ADMIN+EDITOR (documents bilan bir xil ruxsat). */
@Controller('documents/:documentId/relations')
export class DocumentRelationsController {
  constructor(
    private readonly relations: DocumentRelationsService,
    private readonly documents: DocumentsService,
  ) {}

  @Get()
  list(@Param('documentId', new UuidParamPipe()) documentId: string) {
    return this.relations.list(documentId);
  }

  @Roles('ADMIN', 'EDITOR')
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Param('documentId', new UuidParamPipe()) documentId: string,
    @Body(new ZodValidationPipe(createDocumentRelationSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = body as CreateDocumentRelationInput;
    const result = await this.relations.create(user.orgId, user.sub, documentId, input);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'CREATE',
      entityType: 'DocumentRelation',
      entityId: result.id,
    });

    // TZ-2 §2.1 — REPLACES yaratilganda ixtiyoriy: target'ni ham EXPIRED qilish.
    if (input.type === 'REPLACES' && input.alsoExpireTarget) {
      await this.documents.update(user.orgId, user.sub, user.role, input.targetDocumentId, {
        status: 'EXPIRED',
        effectiveTo: new Date(),
        statusChangeNote: "REPLACES bog'lanish orqali avtomatik EXPIRED qilindi",
      });
      setAuditContext(req, {
        orgId: user.orgId,
        userId: user.sub,
        action: 'UPDATE',
        entityType: 'Document',
        entityId: input.targetDocumentId,
        meta: { reason: 'replaces_auto_expire' },
      });
    }

    return result;
  }

  @Roles('ADMIN', 'EDITOR')
  @Delete(':relationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('relationId', new UuidParamPipe()) relationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.relations.remove(relationId);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'DELETE',
      entityType: 'DocumentRelation',
      entityId: relationId,
    });
  }
}
