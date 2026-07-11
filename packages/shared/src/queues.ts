// BullMQ navbat nomlari — producer (api) va consumer (worker) bitta konstantadan foydalanadi.
export const QUEUE_FILE_INDEX = 'file.index';
export const QUEUE_DIFF_GENERATE = 'diff.generate';

export const ALL_QUEUES = [QUEUE_FILE_INDEX, QUEUE_DIFF_GENERATE] as const;

export interface FileIndexJobData {
  fileId: string;
  orgId: string;
}

export interface DiffGenerateJobData {
  documentId: string;
  oldVersionId: string;
  orgId: string;
}
