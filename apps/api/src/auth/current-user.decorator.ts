import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { unauthorized } from '../common/api-error';
import type { AuthenticatedRequest } from './types';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) {
    throw unauthorized();
  }
  return request.user;
});
