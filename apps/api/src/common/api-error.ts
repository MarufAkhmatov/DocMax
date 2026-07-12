import { HttpException } from '@nestjs/common';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'EXPIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

/** TZ-0 §4 xato formati: { error: { code, message, details? } } */
export class ApiException extends HttpException {
  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super({ code, message, details } satisfies ApiErrorBody, status);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiException(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = "Avtorizatsiyadan o'tilmagan") =>
  new ApiException(401, 'UNAUTHORIZED', message);
export const forbidden = (message = "Ruxsat yo'q") => new ApiException(403, 'FORBIDDEN', message);
export const notFound = (message = 'Topilmadi') => new ApiException(404, 'NOT_FOUND', message);
export const conflict = (message: string, details?: unknown) =>
  new ApiException(409, 'CONFLICT', message, details);
export const expired = (message: string) => new ApiException(410, 'EXPIRED', message);
export const tooManyRequests = (message = "Juda ko'p urinish, keyinroq qayta urinib ko'ring") =>
  new ApiException(429, 'RATE_LIMITED', message);
