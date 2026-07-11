import { Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type ConnectionOptions } from 'bullmq';
import {
  QUEUE_FILE_INDEX,
  QUEUE_DIFF_GENERATE,
  type FileIndexJobData,
  type DiffGenerateJobData,
} from '@normavault/shared';

const WORKERS = 'WORKERS';

@Module({
  providers: [
    {
      provide: WORKERS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Queue');
        const connection: ConnectionOptions = {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        };

        // Handler'lar hozircha stub — biznes-logika tegishli milestone'larda
        // (file.index — 5-milestone, diff.generate — 6-milestone, docs/START.md).
        const fileIndex = new Worker<FileIndexJobData>(
          QUEUE_FILE_INDEX,
          async (job) => {
            logger.log(`[${QUEUE_FILE_INDEX}] job ${job.id} qabul qilindi (stub)`);
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
