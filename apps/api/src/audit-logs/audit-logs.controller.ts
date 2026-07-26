import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { listAuditLogsQuerySchema } from '@docmax/shared';
import { Roles } from '../auth/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuditLogsService } from './audit-logs.service';

/** TZ-2 §2.7 — faqat ADMIN ko'radi (audit_logs butun org faoliyatini ochadi). */
@Roles('ADMIN')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listAuditLogsQuerySchema)) query: unknown) {
    return this.auditLogs.list(query as never);
  }

  @Get('export.csv')
  async exportCsv(@Query(new ZodValidationPipe(listAuditLogsQuerySchema)) query: unknown, @Res({ passthrough: true }) res: Response) {
    const csv = await this.auditLogs.exportCsv(query as never);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="audit-log.csv"');
    return csv;
  }
}
