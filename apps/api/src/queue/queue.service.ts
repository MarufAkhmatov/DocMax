import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type ConnectionOptions } from 'bullmq';
import { QUEUE_FILE_INDEX, QUEUE_DIFF_GENERATE, type FileIndexJobData, type DiffGenerateJobData } from '@docmax/shared';

/** API tarafidagi navbat producer'i — worker consumer sifatida ishlaydi (apps/worker/src/queue). */
@Injectable()
export class QueueService implements OnApplicationShutdown {
  private readonly fileIndexQueue: Queue<FileIndexJobData>;
  private readonly diffGenerateQueue: Queue<DiffGenerateJobData>;

  constructor(config: ConfigService) {
    const connection: ConnectionOptions = {
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    };
    this.fileIndexQueue = new Queue(QUEUE_FILE_INDEX, { connection });
    this.diffGenerateQueue = new Queue(QUEUE_DIFF_GENERATE, { connection });
  }

  addFileIndexJob(data: FileIndexJobData) {
    return this.fileIndexQueue.add(QUEUE_FILE_INDEX, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  addDiffGenerateJob(data: DiffGenerateJobData) {
    return this.diffGenerateQueue.add(QUEUE_DIFF_GENERATE, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  /** Frontend polling uchun — shablon job holati + natijasi (returnvalue). */
  getDiffGenerateJob(jobId: string) {
    return this.diffGenerateQueue.getJob(jobId);
  }

  async onApplicationShutdown() {
    await Promise.all([this.fileIndexQueue.close(), this.diffGenerateQueue.close()]);
  }
}
