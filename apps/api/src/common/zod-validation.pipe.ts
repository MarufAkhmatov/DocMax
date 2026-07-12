import { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { badRequest } from './api-error';

/** CLAUDE.md 4-qoida: validatsiya faqat zod (packages/shared'dagi sxemalar). */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw badRequest('Validatsiya xatosi', result.error.flatten());
    }
    return result.data;
  }
}
