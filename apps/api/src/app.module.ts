import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './mailer/mailer.module';
import { AuthModule } from './auth/auth.module';
import { FoldersModule } from './folders/folders.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { FilesModule } from './files/files.module';
import { DocumentsModule } from './documents/documents.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DocumentRelationsModule } from './document-relations/document-relations.module';
import { GraphModule } from './graph/graph.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { TrashModule } from './trash/trash.module';
import { StatsModule } from './stats/stats.module';
import { TagsModule } from './tags/tags.module';
import { WorkflowModule } from './workflow/workflow.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AllExceptionsFilter } from './common/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // turbo dev'da cwd = apps/api, shuning uchun root .env ham qamrab olinadi
      envFilePath: ['../../.env', '.env'],
    }),
    // Default limit 5/min/IP (TZ-0 §7) — global guard sifatida EMAS, faqat
    // login endpoint'ida @UseGuards(ThrottlerGuard) bilan qo'llaniladi.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    JwtModule.register({}),
    PrismaModule,
    StorageModule,
    QueueModule,
    MailerModule,
    AuthModule,
    FoldersModule,
    FilesModule,
    DocumentsModule,
    DocumentTypesModule,
    OrganizationsModule,
    DocumentRelationsModule,
    GraphModule,
    NotificationsModule,
    AuditLogsModule,
    TrashModule,
    StatsModule,
    TagsModule,
    WorkflowModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Tartib muhim: avval JWT (req.user'ni to'ldiradi), keyin rol tekshiruvi
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
