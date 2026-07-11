import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Worker HTTP server emas — standalone application context (TZ-0 §1)
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  Logger.log('Worker ishga tushdi, navbatlarni kutmoqda', 'Bootstrap');
}

void bootstrap();
