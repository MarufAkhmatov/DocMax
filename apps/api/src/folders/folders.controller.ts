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
  Query,
  Req,
} from '@nestjs/common';
import { createFolderSchema, moveFolderSchema, updateFolderSchema } from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FoldersService } from './folders.service';

@Controller('folders')
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  /** Barcha rollarga ochiq (o'qish) — lazy-load: parentId bo'lsa shu tugunning bolalari,
   * bo'lmasa ildiz darajasi; q bo'lsa butun org bo'yicha nom qidiruvi (TZ-1 §1.2). */
  @Get('tree')
  getTree(
    @CurrentUser() user: RequestUser,
    @Query('parentId') parentId?: string,
    @Query('q') q?: string,
  ) {
    return this.folders.getTree(user.orgId, parentId ?? null, q);
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
    @Param('id') id: string,
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
    @Param('id') id: string,
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
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
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
