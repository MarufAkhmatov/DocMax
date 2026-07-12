import type { Request } from 'express';
import type { AccessTokenPayload } from '@docmax/shared';

export type RequestUser = AccessTokenPayload;

export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
}
