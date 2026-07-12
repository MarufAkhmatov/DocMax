import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@docmax/db';

/**
 * Worker uchun Prisma client — APP_DATABASE_URL orqali ulanadi (apps/api/src/prisma
 * bilan bir xil naqsh). Worker request-scoped emas: navbat orqali keladigan
 * job'lar allaqachon ishonchli (API tomonidan yaratilgan), shuning uchun
 * tenant-scope extension shart emas — orgId job data'da keladi.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    super({
      datasources: {
        db: { url: config.getOrThrow<string>('APP_DATABASE_URL') },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma ulandi (APP_DATABASE_URL)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
