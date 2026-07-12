import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import type { FileIndexJobData } from '@docmax/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * TZ-1 §1.5 — yuklangan fayldan matn ajratish (PDF: pdf-parse, DOCX: mammoth),
 * files.extracted_text va documents.search_vector'ni yangilaydi.
 */
@Injectable()
export class FileIndexService {
  private readonly logger = new Logger(FileIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async process({ fileId, orgId }: FileIndexJobData): Promise<void> {
    const file = await this.prisma.file.findFirst({ where: { id: fileId, orgId } });
    if (!file) {
      this.logger.warn(`Fayl topilmadi: ${fileId}`);
      return;
    }

    try {
      const buffer = await this.storage.getObjectBuffer(file.objectKey);
      const text = await this.extractText(buffer, file.mime);

      await this.prisma.file.update({
        where: { id: fileId },
        data: { extractedText: text, status: 'READY' },
      });

      await this.updateSearchVector(fileId, orgId, text);
      this.logger.log(`Indekslandi: ${fileId} (${text.length} belgi)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Indekslashda xato (${fileId}): ${message}`);
      await this.prisma.file.update({ where: { id: fileId }, data: { status: 'FAILED' } }).catch(() => {});
      throw err; // BullMQ retry (3 marta, exponential backoff)
    }
  }

  private async extractText(buffer: Buffer, mime: string): Promise<string> {
    if (mime === 'application/pdf') {
      const result = await pdfParse(buffer);
      return result.text;
    }
    if (mime === DOCX_MIME) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    return '';
  }

  /** Faqat shu fayl biror hujjatning JORIY versiyasi (pdf) bo'lsa search_vector yangilanadi. */
  private async updateSearchVector(fileId: string, orgId: string, extractedText: string): Promise<void> {
    const docs = await this.prisma.$queryRaw<{ id: string; title: string; docNumber: string | null }[]>`
      SELECT d.id, d.title, d.doc_number as "docNumber"
      FROM documents d
      JOIN document_versions dv ON dv.id = d.current_version_id
      WHERE dv.pdf_file_id = ${fileId}::uuid AND d.org_id = ${orgId}::uuid
    `;
    for (const doc of docs) {
      await this.prisma.$executeRaw`
        UPDATE documents
        SET search_vector = to_tsvector('simple', ${doc.title} || ' ' || coalesce(${doc.docNumber}, '') || ' ' || coalesce(${extractedText}, ''))
        WHERE id = ${doc.id}::uuid
      `;
    }
  }
}
