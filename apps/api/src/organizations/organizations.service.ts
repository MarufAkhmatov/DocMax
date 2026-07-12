import { Injectable } from '@nestjs/common';
import type { OrganizationBranding } from '@docmax/shared';
import { notFound } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { StorageService } from '../storage/storage.service';

// Logotip uzoq vaqt (Rail sidebar'da doim ko'rinadi) ko'rsatiladi — hujjat
// yuklab olishdagi 600s presigned URL'dan farqli, bu yerda 1 soat yetarli.
const LOGO_URL_TTL_SECONDS = 3600;

/** Admin Panel — no-code brend sozlamalari (kompaniya logotipi, TZ-2 kengaytmasi). */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
    private readonly storage: StorageService,
  ) {}

  async getBranding(orgId: string): Promise<OrganizationBranding> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { logoFileId: true },
    });
    if (!org?.logoFileId) {
      return { logoUrl: null };
    }
    const file = await this.prisma.file.findUnique({ where: { id: org.logoFileId } });
    if (!file) {
      return { logoUrl: null };
    }
    return { logoUrl: await this.storage.getPresignedDownloadUrl(file.objectKey, LOGO_URL_TTL_SECONDS) };
  }

  async setLogo(orgId: string, fileId: string): Promise<OrganizationBranding> {
    const file = await this.tenant.client.file.findFirst({ where: { id: fileId } });
    if (!file) {
      throw notFound('Fayl topilmadi');
    }
    await this.prisma.organization.update({ where: { id: orgId }, data: { logoFileId: fileId } });
    return this.getBranding(orgId);
  }

  async removeLogo(orgId: string): Promise<OrganizationBranding> {
    await this.prisma.organization.update({ where: { id: orgId }, data: { logoFileId: null } });
    return { logoUrl: null };
  }
}
