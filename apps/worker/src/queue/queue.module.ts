import { Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type ConnectionOptions } from 'bullmq';
import {
  QUEUE_FILE_INDEX,
  QUEUE_DIFF_GENERATE,
  type FileIndexJobData,
  type DiffGenerateJobData,
} from '@docmax/shared';
import { FileIndexModule } from '../file-index/file-index.module';
import { FileIndexService } from '../file-index/file-index.service';
import { DiffGenerateModule } from '../diff-generate/diff-generate.module';
import { DiffGenerateService } from '../diff-generate/diff-generate.service';

const WORKERS = 'WORKERS';

@Module({
  imports: [FileIndexModule, DiffGenerateModule],
  providers: [
    {
      provide: WORKERS,
      inject: [ConfigService, FileIndexService, DiffGenerateService],
      useFactory: (
        config: ConfigService,
        fileIndexService: FileIndexService,
        diffGenerateService: DiffGenerateService,
      ) => {
        const logger = new Logger('Queue');
        const connection: ConnectionOptions = {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        };

        // file.index — 5-milestone, diff.generate — 6-milestone (TZ-1 §1.4/§1.5).
        const fileIndex = new Worker<FileIndexJobData>(
          QUEUE_FILE_INDEX,
          async (job) => {
            await fileIndexService.process(job.data);
          },
          { connection },
        );

        const diffGenerate = new Worker<DiffGenerateJobData>(
          QUEUE_DIFF_GENERATE,
          async (job) => diffGenerateService.process(job.data),
          { connection },
        );

        for (const w of [fileIndex, diffGenerate]) {
          w.on('ready', () => logger.log(`"${w.name}" navbati Redis'ga ulandi`));
          w.on('failed', (job, err) =>
            logger.error(`"${w.name}" job ${job?.id} xato: ${err.message}`),
          );
        }

        return [fileIndex, diffGenerate];
      },
    },
  ],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(@Inject(WORKERS) private readonly workers: Worker[]) {}

  async onApplicationShutdown() {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
