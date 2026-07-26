import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { listNotificationsQuerySchema } from '@docmax/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { UuidParamPipe } from '../common/uuid-param.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { NotificationsService } from './notifications.service';

/** TZ-2 §2.7 — har kim faqat o'z bildirishnomalarini ko'radi/o'qigan qiladi (audit shart emas — UI holati). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: { unreadOnly: boolean },
  ) {
    return this.notifications.list(user.sub, query.unreadOnly);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@CurrentUser() user: RequestUser, @Param('id', new UuidParamPipe()) id: string) {
    await this.notifications.markRead(user.sub, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser() user: RequestUser) {
    await this.notifications.markAllRead(user.sub);
  }
}
