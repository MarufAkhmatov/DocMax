import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import {
  closeOrgUnitSchema,
  createOrgUnitSchema,
  moveOrgUnitSchema,
  remapApplySchema,
  saveOrgCanvasLayoutSchema,
  setFolderOrgUnitSchema,
  updateOrgUnitSchema,
  type CloseOrgUnitInput,
  type CreateOrgUnitInput,
  type MoveOrgUnitInput,
  type RemapApplyInput,
  type SaveOrgCanvasLayoutInput,
  type SetFolderOrgUnitInput,
  type UpdateOrgUnitInput,
} from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrgUnitsService } from './org-units.service';
import { OrgStructureSnapshotsService } from './org-structure-snapshots.service';
import { OrgStructureCanvasService } from './org-structure-canvas.service';

/** TZ-2 §2.4 — korxona strukturasi. O'qish barcha rollarga (papka mapping ko'rinishi
 * uchun), mutatsiya faqat ADMIN — folders.controller.ts bilan bir xil naqsh. */
@Controller('org-units')
export class OrgUnitsController {
  constructor(
    private readonly orgUnits: OrgUnitsService,
    private readonly snapshots: OrgStructureSnapshotsService,
    private readonly canvas: OrgStructureCanvasService,
  ) {}

  /** `all=true` — canvas (n8n-uslubidagi vizualizatsiya) uchun BUTUN struktura bir
   * so'rovda; aks holda mavjud lazy-per-level xatti-harakat (daraxt ko'rinishi). */
  @Get('tree')
  getTree(@CurrentUser() user: RequestUser, @Query('parentId') parentId?: string, @Query('q') q?: string, @Query('all') all?: string) {
    if (all === 'true') {
      return this.orgUnits.getAllFlat(user.orgId);
    }
    return this.orgUnits.getTree(user.orgId, parentId ?? null, q);
  }

  /** Canvas joylashuvi — har userniki, shaxsiy UI holati (workflow.controller.ts bilan
   * bir xil falsafa: rol cheklovisiz, audit shart emas). */
  @Get('canvas-layout')
  getCanvasLayout(@CurrentUser() user: RequestUser) {
    return this.canvas.getLayout(user.orgId, user.sub);
  }

  @Put('canvas-layout')
  saveCanvasLayout(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(saveOrgCanvasLayoutSchema)) body: unknown) {
    return this.canvas.saveLayout(user.orgId, user.sub, body as SaveOrgCanvasLayoutInput);
  }

  /** Papkani org-unit'ga bog'lash/uzish — canvas'da chiziq tortish/o'chirish shu endpoint'ga tushadi. */
  @Roles('ADMIN')
  @Patch('folders/:folderId/link')
  async setFolderLink(
    @CurrentUser() user: RequestUser,
    @Param('folderId', new UuidParamPipe()) folderId: string,
    @Body(new ZodValidationPipe(setFolderOrgUnitSchema)) body: unknown,
  ) {
    const input = body as SetFolderOrgUnitInput;
    await this.orgUnits.setFolderLink(user.orgId, folderId, input.orgUnitId, user.sub);
  }

  @Roles('ADMIN')
  @Get('snapshots')
  listSnapshots(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.snapshots.list(Number(page) || 1, Math.min(Number(limit) || 20, 100));
  }

  @Roles('ADMIN')
  @Get('snapshots/at')
  snapshotAt(@Query('date') date: string) {
    return this.snapshots.atDate(date);
  }

  @Roles('ADMIN')
  @Post()
  async create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(createOrgUnitSchema)) body: unknown, @Req() req: AuthenticatedRequest) {
    const result = await this.orgUnits.create(user.orgId, body as CreateOrgUnitInput, user.sub);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'CREATE', entityType: 'OrgUnit', entityId: result.id });
    return result;
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(updateOrgUnitSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.orgUnits.update(user.orgId, id, body as UpdateOrgUnitInput, user.sub);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'UPDATE', entityType: 'OrgUnit', entityId: id });
    return result;
  }

  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post(':id/move')
  async move(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(moveOrgUnitSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.orgUnits.move(user.orgId, id, body as MoveOrgUnitInput, user.sub);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'UPDATE', entityType: 'OrgUnit', entityId: id, meta: { move: true } });
    return result;
  }

  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post(':id/close')
  async close(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(closeOrgUnitSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.orgUnits.close(user.orgId, id, body as CloseOrgUnitInput, user.sub);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'UPDATE', entityType: 'OrgUnit', entityId: id, meta: { closed: true } });
    return result;
  }

  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post(':id/reopen')
  async reopen(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string, @Req() req: AuthenticatedRequest) {
    const result = await this.orgUnits.reopen(user.orgId, id, user.sub);
    setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'UPDATE', entityType: 'OrgUnit', entityId: id, meta: { reopened: true } });
    return result;
  }

  @Roles('ADMIN')
  @Get(':id/remap-preview')
  remapPreview(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string) {
    return this.orgUnits.remapPreview(user.orgId, id);
  }

  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post(':id/remap-apply')
  async remapApply(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(remapApplySchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = body as RemapApplyInput;
    await this.orgUnits.remapApply(user.orgId, id, input.moves, user.sub);
    for (const move of input.moves) {
      setAuditContext(req, { orgId: user.orgId, userId: user.sub, action: 'UPDATE', entityType: 'Folder', entityId: move.folderId, meta: { remap: true } });
    }
  }
}
