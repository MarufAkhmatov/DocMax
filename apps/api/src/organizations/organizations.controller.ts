import { Body, Controller, Delete, Get, Patch, Req } from '@nestjs/common';
import { updateOrgLogoSchema } from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest, RequestUser } from '../auth/types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrganizationsService } from './organizations.service';

/** O'qish barcha rollarga ochiq (Rail sidebar'da logotip shundan foydalanadi), mutatsiya faqat ADMIN. */
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('branding')
  getBranding(@CurrentUser() user: RequestUser) {
    return this.organizations.getBranding(user.orgId);
  }

  @Roles('ADMIN')
  @Patch('branding/logo')
  async setLogo(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateOrgLogoSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const { fileId } = body as { fileId: string };
    const result = await this.organizations.setLogo(user.orgId, fileId);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: user.orgId,
      meta: { logo: true },
    });
    return result;
  }

  @Roles('ADMIN')
  @Delete('branding/logo')
  async removeLogo(@CurrentUser() user: RequestUser, @Req() req: AuthenticatedRequest) {
    const result = await this.organizations.removeLogo(user.orgId);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: user.orgId,
      meta: { logo: false },
    });
    return result;
  }
}
