import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  createFolderSchema,
  moveFolderSchema,
  setFolderPermissionsSchema,
  updateFolderSchema,
  type SetFolderPermissionsInput,
} from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FolderAccessService } from './folder-access.service';
import { FolderPermissionsService } from './folder-permissions.service';
import { FoldersService } from './folders.service';

@Controller('folders')
export class FoldersController {
  constructor(
    private readonly folders: FoldersService,
    private readonly access: FolderAccessService,
    private readonly permissions: FolderPermissionsService,
  ) {}

  /** Barcha rollarga ochiq (o'qish) — lazy-load: parentId bo'lsa shu tugunning bolalari,
   * bo'lmasa ildiz darajasi; q bo'lsa butun org bo'yicha nom qidiruvi (TZ-1 §1.2).
   * TZ-2 §2.5: ruxsatsiz papkalar bu yerda BUTUNLAY chiqarib tashlanadi (locked ko'rsatish
   * emas — "umuman ko'rinmaydi"), qolganlariga haqiqiy `locked` (qulf ikonkasi) qo'yiladi. */
  @Get('tree')
  async getTree(
    @CurrentUser() user: RequestUser,
    @Query('parentId') parentId?: string,
    @Query('q') q?: string,
  ) {
    const nodes = await this.folders.getTree(user.orgId, parentId ?? null, q);
    const visible = await this.access.visibleFolderIds(nodes.map((n) => n.id));
    const filtered = nodes.filter((n) => visible.has(n.id));
    const locked = await this.access.lockedFolderIds(filtered.map((n) => n.id));
    return filtered.map((n) => ({ ...n, locked: locked.has(n.id) }));
  }

  /** Yagona papka — frontend'da URL'dan deep-link breadcrumb qayta qurish uchun
   * (ota-bola zanjiri bo'yicha yuqoriga yurish). ACL: ko'ra olmasa 404 (umuman ko'rinmaydi). */
  @Get(':id')
  async getById(@Param('id', new UuidParamPipe()) id: string) {
    await this.access.assertView(id);
    return this.folders.getById(id);
  }

  /** Joriy foydalanuvchining shu papkadagi effektiv huquqlari — ACL drawer/preview uchun
   * yengil endpoint (barcha rollarga ochiq, ADMIN-only to'liq konfiguratsiyadan farqli). */
  @Get(':id/access')
  async getAccess(@Param('id', new UuidParamPipe()) id: string) {
    const [effective, locked] = await Promise.all([this.access.effective(id), this.access.isLocked(id)]);
    return { ...effective, locked };
  }

  @Roles('ADMIN')
  @Get(':id/permissions')
  getPermissions(@Param('id', new UuidParamPipe()) id: string) {
    return this.permissions.get(id);
  }

  @Roles('ADMIN')
  @Put(':id/permissions')
  async setPermissions(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(setFolderPermissionsSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.permissions.set(user.orgId, id, body as SetFolderPermissionsInput);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'PERMISSION_CHANGE',
      entityType: 'Folder',
      entityId: id,
      meta: { enabled: result.aclEnabled, subjectCount: result.entries.length },
    });
    return result;
  }

  @Roles('ADMIN')
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createFolderSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.folders.create(user.orgId, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'CREATE',
      entityType: 'Folder',
      entityId: result.id,
    });
    return result;
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(updateFolderSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.folders.update(id, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'UPDATE',
      entityType: 'Folder',
      entityId: id,
    });
    return result;
  }

  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post(':id/move')
  async move(
    @CurrentUser() user: RequestUser,
    @Param('id', new UuidParamPipe()) id: string,
    @Body(new ZodValidationPipe(moveFolderSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.folders.move(user.orgId, id, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'UPDATE',
      entityType: 'Folder',
      entityId: id,
      meta: { move: true },
    });
    return result;
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string, @Req() req: AuthenticatedRequest) {
    await this.folders.remove(id);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'DELETE',
      entityType: 'Folder',
      entityId: id,
    });
  }
}
