import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  // CORS faqat frontend domeni (TZ-0 §7)
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  const port = config.get<number>('API_PORT', 3001);
  await app.listen(port);
  Logger.log(`API ishga tushdi: http://localhost:${port}/api/v1`, 'Bootstrap');
}

void bootstrap();
