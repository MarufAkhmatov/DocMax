import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  NotFound,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
};

/**
 * MinIO/S3 client (CLAUDE.md 6-qoida — fayl backend orqali oqmaydi, faqat presigned
 * URL orqali to'g'ridan-to'g'ri). MinIO S3-mos bo'lgani uchun @aws-sdk/client-s3
 * `forcePathStyle` bilan ishlatiladi.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  /** Lokal/self-hosted MinIO'da bucket oldindan mavjud bo'lmasligi mumkin — idempotent yaratish. */
  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`MinIO bucket "${this.bucket}" yaratildi`);
    }
  }

  get bucketName(): string {
    return this.bucket;
  }

  objectKeyFor(orgId: string, sha256: string, mime: string): string {
    const ext = EXT_BY_MIME[mime] ?? '';
    return `org-${orgId}/${sha256}${ext}`;
  }

  getPresignedUploadUrl(objectKey: string, mime: string, expiresIn = 600): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, ContentType: mime });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  getPresignedDownloadUrl(objectKey: string, expiresIn = 600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /** confirm bosqichida haqiqatan yuklanganini tekshirish uchun — topilmasa null. */
  async headObject(objectKey: string): Promise<{ sizeBytes: number } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      return { sizeBytes: res.ContentLength ?? 0 };
    } catch (err) {
      if (err instanceof NotFound) {
        return null;
      }
      throw err;
    }
  }
}
