import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  inviteSchema,
  loginSchema,
  resetPasswordSchema,
  setupSchema,
  updateProfileSchema,
} from '@docmax/shared';
import { setAuditContext } from '../audit/audit-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import type { AuthenticatedRequest, RequestUser } from './types';
import { AuthService, REFRESH_COOKIE_NAME } from './auth.service';

function requestMeta(req: AuthenticatedRequest) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('setup')
  async setup(@Body(new ZodValidationPipe(setupSchema)) body: unknown, @Req() req: AuthenticatedRequest) {
    const result = await this.auth.setup(body as never);
    setAuditContext(req, {
      orgId: result.org.id,
      userId: result.user.id,
      action: 'CREATE',
      entityType: 'Organization',
      entityId: result.org.id,
    });
    return result;
  }

  @Roles('ADMIN')
  @Post('invite')
  async invite(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(inviteSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.auth.invite(user, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'CREATE',
      entityType: 'User',
      entityId: result.id,
      meta: { invitedEmail: result.email, role: result.role },
    });
    return result;
  }

  @Public()
  @Get('invite/:token')
  validateInvite(@Param('token') token: string) {
    return this.auth.validateInvite(token);
  }

  @Public()
  @Post('invite/:token/accept')
  acceptInvite(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: unknown,
  ) {
    return this.auth.acceptInvite(token, body as never);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body as never, requestMeta(req), res);
    setAuditContext(req, {
      orgId: result.user.orgId,
      userId: result.user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: result.user.id,
    });
    return result;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const rawToken = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE_NAME];
    return this.auth.refresh(rawToken, requestMeta(req), res);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const rawToken = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE_NAME];
    const result = await this.auth.logout(rawToken, res);
    if (req.user) {
      setAuditContext(req, {
        orgId: req.user.orgId,
        userId: req.user.sub,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: req.user.sub,
      });
    }
    return result;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: unknown) {
    return this.auth.forgotPassword(body as never);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password/:token')
  resetPassword(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: unknown,
  ) {
    return this.auth.resetPassword(token, body as never);
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.sub);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.auth.updateProfile(user.sub, body as never);
    setAuditContext(req, {
      orgId: user.orgId,
      userId: user.sub,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.sub,
    });
    return result;
  }
}
