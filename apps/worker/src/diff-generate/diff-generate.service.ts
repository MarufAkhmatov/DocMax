import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import {
  AlignmentType,
  Document as DocxDocument,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { DiffGenerateJobData, DiffGenerateResult } from '@docmax/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const GRAY_FILL = 'E8E8E8'; // eski tahrir ustuni foni (TZ-1 §1.4: kulrang fon)
const FONT_BODY = 'Times New Roman'; // TZ-1 §1.4: Times New Roman 11
const SIZE_BODY = 22; // docx half-points: 11pt

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * TZ-1 §1.4 — diff.generate: eski versiya docx'ini mammoth bilan paragraflarga
 * ajratib (bo'sh paragraflar tashlanadi, jadvallar hujayra matni sifatida),
 * docx npm bilan 3 ustunli taqqoslama shablon yasaydi. Formatning tasdiqlangan
 * namunasi: design/taqqoslama-jadval-namuna.docx.
 * Eski versiyada docx bo'lmasa — PDF matnidan (extracted_text) yasaladi,
 * fromPdfFallback=true bilan ("formatlash yo'qolgan bo'lishi mumkin" ogohlantirishi).
 */
@Injectable()
export class DiffGenerateService {
  private readonly logger = new Logger(DiffGenerateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async process(data: DiffGenerateJobData): Promise<DiffGenerateResult> {
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: data.oldVersionId, documentId: data.documentId },
      include: {
        pdfFile: true,
        docxFile: true,
        document: { select: { orgId: true, title: true, docNumber: true } },
      },
    });
    if (!version || version.document.orgId !== data.orgId) {
      throw new Error(`Versiya topilmadi: ${data.oldVersionId}`);
    }

    // 1. Eski tahrir matnini olish
    let sourceText: string;
    let fromPdfFallback = false;
    if (version.docxFile) {
      const buffer = await this.storage.getObjectBuffer(version.docxFile.objectKey);
      const result = await mammoth.extractRawText({ buffer });
      sourceText = result.value;
    } else if (version.pdfFile.extractedText) {
      sourceText = version.pdfFile.extractedText;
      fromPdfFallback = true;
    } else {
      // extracted_text hali indekslanmagan bo'lishi mumkin — PDF'ni to'g'ridan-to'g'ri o'qish
      const buffer = await this.storage.getObjectBuffer(version.pdfFile.objectKey);
      const parsed = await pdfParse(buffer);
      sourceText = parsed.text;
      fromPdfFallback = true;
    }

    const paragraphs = sourceText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) {
      throw new Error("Eski versiyadan matn ajratib bo'lmadi");
    }

    // 2. Shablon docx'ini yig'ish (namuna: design/taqqoslama-jadval-namuna.docx)
    const doc = version.document;
    const approvedLine = version.approvedAt
      ? ` (${fmtDate(version.approvedAt)} da tasdiqlangan)`
      : '';

    const headerCell = (text: string, width: number) =>
      new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        shading: { fill: 'D9D9D9' },
        children: [
          new Paragraph({
            children: [new TextRun({ text, bold: true, font: FONT_BODY, size: SIZE_BODY })],
          }),
        ],
      });

    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('№', 6),
          headerCell(`ESKI TAHRIR — ${version.versionLabel}${approvedLine}`, 47),
          headerCell(`YANGI TAHRIR — ${data.newVersionLabel} (loyiha)`, 47),
        ],
      }),
      ...paragraphs.map(
        (text, i) =>
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(i + 1), font: FONT_BODY, size: SIZE_BODY })],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill: GRAY_FILL },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text, font: FONT_BODY, size: SIZE_BODY })],
                  }),
                ],
              }),
              new TableCell({ children: [new Paragraph({ children: [] })] }),
            ],
          }),
      ),
    ];

    const docx = new DocxDocument({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ text: 'TAQQOSLAMA JADVAL', bold: true, size: 32, font: FONT_BODY })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: `${doc.title}${doc.docNumber ? ` (${doc.docNumber})` : ''}`,
                  bold: true,
                  font: FONT_BODY,
                  size: SIZE_BODY,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
              children: [
                new TextRun({
                  text: `Shakllantirilgan sana: ${fmtDate(new Date())} · Tizim tomonidan avtomatik yaratildi${fromPdfFallback ? ' · PDF matnidan (formatlash yo‘qolgan bo‘lishi mumkin)' : ''}`,
                  italics: true,
                  font: FONT_BODY,
                  size: 20,
                }),
              ],
            }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
            new Paragraph({ spacing: { before: 300 }, children: [] }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Izoh: chap ustun eski versiyadan avtomatik ko'chirilgan. O'zgartirilayotgan bandlar ro'parasiga yangi tahrirni yozing; o'zgarmagan bandlar ro'parasi bo'sh qoldirilsa, tizim ularni “o'zgarishsiz” deb belgilaydi.",
                  italics: true,
                  font: FONT_BODY,
                  size: 20,
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = Buffer.from(await Packer.toBuffer(docx));
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    // 3. MinIO'ga yozish + File yozuvi (sha bo'yicha dedup)
    const existing = await this.prisma.file.findFirst({
      where: { orgId: data.orgId, sha256, status: { not: 'FAILED' } },
    });
    if (existing) {
      this.logger.log(`Shablon dedup: ${existing.id}`);
      return { fileId: existing.id, fromPdfFallback };
    }

    const objectKey = `org-${data.orgId}/${sha256}.docx`;
    await this.storage.putObject(objectKey, buffer, DOCX_MIME);

    const safeTitle = doc.title.replaceAll(/[\\/:*?"<>|]/g, '').slice(0, 80);
    const file = await this.prisma.file.create({
      data: {
        orgId: data.orgId,
        bucket: this.storage.bucketName,
        objectKey,
        originalName: `Taqqoslama_${safeTitle}_${version.versionLabel}_${data.newVersionLabel}.docx`,
        mime: DOCX_MIME,
        sizeBytes: BigInt(buffer.length),
        sha256,
        uploadedBy: data.requestedBy,
        status: 'READY',
      },
    });

    this.logger.log(
      `Taqqoslama shablon tayyor: ${file.id} (${paragraphs.length} band, ${version.versionLabel} -> ${data.newVersionLabel}${fromPdfFallback ? ', PDF fallback' : ''})`,
    );
    return { fileId: file.id, fromPdfFallback };
  }
}
