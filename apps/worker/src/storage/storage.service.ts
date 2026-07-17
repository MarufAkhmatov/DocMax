import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

/** apps/api/src/storage bilan bir xil MinIO ulanish naqshi — file.index o'qiydi,
 * diff.generate esa yasalgan taqqoslama shablonini yozadi. */
@Injectable()
export class StorageService {
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

  async getObjectBuffer(objectKey: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    // AWS SDK v3'ning SdkStreamMixin'i Node.js muhitida shu helper'ni ta'minlaydi.
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: body, ContentType: contentType }),
    );
  }

  get bucketName(): string {
    return this.bucket;
  }
}
