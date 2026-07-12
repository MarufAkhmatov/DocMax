import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@docmax/db';

/**
 * Runtime Prisma client — APP_DATABASE_URL orqali ulanadi (egasi emas, "docmax_app"
 * roli). Shu sababdan audit_logs'dagi UPDATE/DELETE REVOKE runtime'da haqiqatan
 * kuchga ega (packages/db/prisma/migrations/*_vector_index_and_app_role).
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
    this.logger.log('Prisma ulandi (APP_DATABASE_URL, docmax_app roli)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
