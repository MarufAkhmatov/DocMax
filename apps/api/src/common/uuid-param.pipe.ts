import { PipeTransform } from '@nestjs/common';
import { uuidSchema } from '@docmax/shared';
import { badRequest } from './api-error';

/** UUID path-param'lari uchun — noto'g'ri qiymat Prisma'gacha yetmasdan 400 qaytaradi (500 emas). */
export class UuidParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const result = uuidSchema.safeParse(value);
    if (!result.success) {
      throw badRequest("Identifikator UUID formatida bo'lishi kerak");
    }
    return result.data;
  }
}
