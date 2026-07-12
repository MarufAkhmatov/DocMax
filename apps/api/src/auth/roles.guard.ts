import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@docmax/shared';
import { forbidden, unauthorized } from '../common/api-error';
import { ROLES_KEY } from './roles.decorator';
import type { AuthenticatedRequest } from './types';

/**
 * TZ-1 §1.1 ruxsat matritsasi bitta joyda majburlanadi (CLAUDE.md ruhi — audit
 * interceptor kabi markazlashtirilgan). @Roles() belgilanmagan endpoint — faqat
 * autentifikatsiya yetarli, rol cheklovi yo'q.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw unauthorized();
    }
    if (!requiredRoles.includes(request.user.role)) {
      throw forbidden();
    }
    return true;
  }
}
