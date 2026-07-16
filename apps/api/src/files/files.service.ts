import { Injectable } from '@nestjs/common';
import type {
  ConfirmFileInput,
  FileDownloadResult,
  FileSummary,
  PresignFileInput,
  PresignResult,
} from '@docmax/shared';
import { badRequest, notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';

const PRESIGN_TTL_SECONDS = 600;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  private get file() {
    return this.tenant.client.file;
  }

  /** TZ-1 §1.3 qabul mezoni: bir xil sha256'li fayl qayta yuklanmaydi — mavjud file_id qaytadi. */
  async presign(orgId: string, input: PresignFileInput): Promise<PresignResult> {
    const existing = await this.file.findFirst({
      where: { sha256: input.sha256, status: { not: 'FAILED' } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return { dedup: true, file: await this.toSummary(existing) };
    }

    const objectKey = this.storage.objectKeyFor(orgId, input.sha256, input.mime);
    const uploadUrl = await this.storage.getPresignedUploadUrl(objectKey, input.mime, PRESIGN_TTL_SECONDS);
    return { dedup: false, uploadUrl, objectKey, expiresIn: PRESIGN_TTL_SECONDS };
  }

  async confirm(orgId: string, userId: string, input: ConfirmFileInput): Promise<FileSummary> {
    // Parallel confirm so'rovlarida race — hash bo'yicha yana tekshiramiz.
    const existing = await this.file.findFirst({
      where: { sha256: input.sha256, status: { not: 'FAILED' } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.toSummary(existing);
    }

    const head = await this.storage.headObject(input.objectKey);
    if (!head || head.sizeBytes !== input.sizeBytes) {
      throw badRequest("Fayl MinIO'ga to'liq yuklanmagan yoki hajmi mos kelmadi");
    }

    // Server-tomonlama hash tekshiruvi (TZ-1 "hash tekshiruv"): klient da'vo qilgan
    // sha256'ga ishonilmaydi — mos kelmasa obyekt o'chiriladi va so'rov rad etiladi.
    // Aks holda buzilgan da'vo dedup'ni zaharlashi mumkin edi (istalgan kontent
    // boshqa hash ostida ro'yxatga olinib, keyingi haqiqiy yuklashlar unga ulanadi).
    const actualSha256 = await this.storage.computeObjectSha256(input.objectKey);
    if (actualSha256 !== input.sha256.toLowerCase()) {
      await this.storage.removeObject(input.objectKey).catch(() => undefined);
      throw badRequest("Fayl hash tekshiruvdan o'tmadi — yuklashni qayta urinib ko'ring");
    }

    const created = await this.prisma.file.create({
      data: {
        orgId,
        bucket: this.storage.bucketName,
        objectKey: input.objectKey,
        originalName: input.originalName,
        mime: input.mime,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256,
        uploadedBy: userId,
        status: 'PENDING',
      },
    });

    await this.queue.addFileIndexJob({ fileId: created.id, orgId });

    return this.toSummary(created);
  }

  /** Jadval chip'lari bosilganda yangi presigned URL beradi (VIEW/DOWNLOAD auditi controller'da). */
  async downloadUrl(id: string, inline: boolean): Promise<FileDownloadResult> {
    const file = await this.file.findFirst({ where: { id } });
    if (!file) {
      throw notFound('Fayl topilmadi');
    }
    const url = await this.storage.getPresignedDownloadUrl(file.objectKey, PRESIGN_TTL_SECONDS, {
      filename: file.originalName,
      inline,
    });
    return { url, expiresIn: PRESIGN_TTL_SECONDS };
  }

  private async toSummary(file: {
    id: string;
    originalName: string;
    mime: string;
    sizeBytes: bigint;
    status: string;
    objectKey: string;
  }): Promise<FileSummary> {
    return {
      id: file.id,
      originalName: file.originalName,
      mime: file.mime,
      sizeBytes: Number(file.sizeBytes),
      status: file.status as FileSummary['status'],
      downloadUrl: await this.storage.getPresignedDownloadUrl(file.objectKey, PRESIGN_TTL_SECONDS),
    };
  }
}
