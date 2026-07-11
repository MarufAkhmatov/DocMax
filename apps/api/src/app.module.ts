import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // turbo dev'da cwd = apps/api, shuning uchun root .env ham qamrab olinadi
      envFilePath: ['../../.env', '.env'],
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
