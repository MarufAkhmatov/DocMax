import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
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
  /** Presigned URL generatsiyasi uchun alohida client — hech qanday tarmoq so'rovi
   * qilmaydi (imzo mahalliy hisoblanadi), shuning uchun endpoint faqat URL matnida
   * ko'rinadi. Docker'da `S3_ENDPOINT` konteyner ichi xost nomi (masalan `http://minio:9000`)
   * bo'lishi mumkin — brauzer buni yecha olmaydi; shu holatda `S3_PUBLIC_ENDPOINT`
   * (brauzer ko'radigan manzil, masalan `http://localhost:9000`) ishlatiladi. Lokal
   * (docker'siz) devda ikkalasi bir xil, shuning uchun `S3_PUBLIC_ENDPOINT` ixtiyoriy. */
  private readonly publicClient: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    const region = config.get<string>('S3_REGION', 'us-east-1');
    const credentials = {
      accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
      secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
    };
    this.client = new S3Client({ endpoint, region, forcePathStyle: true, credentials });
    const publicEndpoint = config.get<string>('S3_PUBLIC_ENDPOINT', endpoint);
    this.publicClient =
      publicEndpoint === endpoint
        ? this.client
        : new S3Client({ endpoint: publicEndpoint, region, forcePathStyle: true, credentials });
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
    return getSignedUrl(this.publicClient, command, { expiresIn });
  }

  getPresignedDownloadUrl(
    objectKey: string,
    expiresIn = 600,
    opts?: { filename?: string; inline?: boolean },
  ): Promise<string> {
    const disposition = opts?.filename
      ? `${opts.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(opts.filename)}`
      : undefined;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ResponseContentDisposition: disposition,
    });
    return getSignedUrl(this.publicClient, command, { expiresIn });
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

  /** confirm'dagi server-tomonlama hash tekshiruvi uchun — obyektni stream qilib SHA-256 hisoblaydi
   * (TZ-1 "hash tekshiruv": klient da'vo qilgan qiymatga ishonilmaydi). */
  async computeObjectSha256(objectKey: string): Promise<string> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    const stream = res.Body as Readable;
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      stream.on('data', (chunk) => hash.update(chunk as Buffer));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /** Hash mos kelmagan (yaroqsiz deb topilgan) obyektni tozalash uchun. */
  async removeObject(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}
