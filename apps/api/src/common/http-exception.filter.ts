import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody, ApiErrorCode } from './api-error';

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'EXPIRED',
  429: 'RATE_LIMITED',
};

/** Har qanday chiqarilgan xatoni TZ-0 §4 formatiga ({ error: {...} }) o'rab qaytaradi. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody = { code: 'INTERNAL', message: 'Kutilmagan xato yuz berdi' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      if (raw && typeof raw === 'object' && 'code' in raw) {
        body = raw as ApiErrorBody;
      } else {
        const message =
          raw && typeof raw === 'object' && 'message' in raw
            ? (raw as { message: string | string[] }).message
            : exception.message;
        body = {
          code: STATUS_TO_CODE[status] ?? 'INTERNAL',
          message: Array.isArray(message) ? message.join('; ') : message,
        };
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({ error: body });
  }
}
