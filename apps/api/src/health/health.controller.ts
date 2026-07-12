import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'docmax-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
