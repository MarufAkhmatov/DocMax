import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';

/** TZ-2 §2.7 — Dashboard uchun agregatsiya, barcha rollarga ochiq (o'qish). */
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('dashboard')
  dashboard() {
    return this.stats.dashboard();
  }
}
