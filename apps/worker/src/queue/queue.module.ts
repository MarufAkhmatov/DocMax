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

const WORKERS = 'WORKERS';

@Module({
  imports: [FileIndexModule],
  providers: [
    {
      provide: WORKERS,
      inject: [ConfigService, FileIndexService],
      useFactory: (config: ConfigService, fileIndexService: FileIndexService) => {
        const logger = new Logger('Queue');
        const connection: ConnectionOptions = {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        };

        // file.index — 5-milestone (haqiqiy implementatsiya, docs/START.md).
        // diff.generate — 6-milestone, hozircha stub.
        const fileIndex = new Worker<FileIndexJobData>(
          QUEUE_FILE_INDEX,
          async (job) => {
            await fileIndexService.process(job.data);
          },
          { connection },
        );

        const diffGenerate = new Worker<DiffGenerateJobData>(
          QUEUE_DIFF_GENERATE,
          async (job) => {
            logger.log(`[${QUEUE_DIFF_GENERATE}] job ${job.id} qabul qilindi (stub)`);
          },
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
