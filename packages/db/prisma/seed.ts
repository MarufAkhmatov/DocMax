import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { nextVersionLabel } from '@docmax/shared';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';
const ADMIN_EMAIL = 'admin@docmax.local';
const ADMIN_PASSWORD = 'Admin2026';

// TZ-1 DoD — "1 hujjatga 3 versiya" ssenariysi uchun MinIO'ga haqiqiy demo-fayl yuklanadi
// (faqat DB metadata bo'lsa, "yuklab olish" 404 berardi). Fixture — pdf-parse'ning o'z test
// PDF'i (node_modules ichidan emas, mo'rt yo'ldan qochish uchun repo ichiga nusxalangan) —
// worker'ning file.index vazifasi (pdf-parse) uni tekshirilgan holda o'qiy oladi (HANDOFF.md
// §4 eslatmasi: qo'lda yasalgan minimal PDF'lar "bad XRef entry" beradi).
const DEMO_PDF_PATH = join(__dirname, 'fixtures', 'demo-version.pdf');

function s3ClientFromEnv(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'docmax',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'docmax-secret',
    },
  });
}

async function upsertFolder(params: {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  path: string;
  sortOrder: number;
  isSystem?: boolean;
}) {
  const { id, orgId, parentId, name, path, sortOrder, isSystem = false } = params;
  // folders.path — ltree (Unsupported), Prisma Client orqali yozib bo'lmaydi (packages/db/prisma/schema.prisma izohi).
  await prisma.$executeRaw`
    INSERT INTO folders (id, org_id, parent_id, name, path, sort_order, is_system, created_at, updated_at)
    VALUES (${id}::uuid, ${orgId}::uuid, ${parentId}::uuid, ${name}, ${path}::ltree, ${sortOrder}, ${isSystem}, now(), now())
    ON CONFLICT (id) DO NOTHING
  `;
}

async function main() {
  console.log('Seed boshlandi...');

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'DocMax Demo', slug: 'demo', plan: 'pro' },
  });
  console.log(`Organization: ${org.name} (${org.id})`);

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  const adminPasswordHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: ADMIN_EMAIL } },
    update: {},
    create: {
      orgId: org.id,
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      fullName: 'Alisher Administrator',
      role: 'ADMIN',
    },
  });
  const editor = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'editor@demo.docmax.local' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'editor@demo.docmax.local',
      passwordHash,
      fullName: 'Dilnoza Editor',
      role: 'EDITOR',
    },
  });
  const viewer = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'viewer@demo.docmax.local' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'viewer@demo.docmax.local',
      passwordHash,
      fullName: 'Sardor Viewer',
      role: 'VIEWER',
    },
  });
  console.log(`Userlar: ${admin.email} (${ADMIN_PASSWORD}) / ${editor.email} / ${viewer.email} (parol: ${DEMO_PASSWORD})`);

  // Papka daraxti va hujjatlar: papka id'lari har seed ishga tushganda tasodifiy
  // generatsiya qilingani uchun (ltree path Prisma orqali izlanmaydi), butun blok
  // "org'da papka bor-yo'qligi" bo'yicha bitta joyda gate qilinadi — aks holda
  // qayta ishga tushirilganda papka daraxti takrorlanib qoladi.
  const existingFolders = await prisma.folder.count({ where: { orgId: org.id } });
  if (existingFolders > 0) {
    console.log(`Papkalar allaqachon mavjud (${existingFolders} ta) — papka/hujjat seed o'tkazib yuborildi.`);
    console.log('Seed yakunlandi. Login ma\'lumotlari:');
    console.log(`  ADMIN:  ${admin.email} / ${ADMIN_PASSWORD}`);
    console.log(`  EDITOR: ${editor.email} / ${DEMO_PASSWORD}`);
    console.log(`  VIEWER: ${viewer.email} / ${DEMO_PASSWORD}`);
    return;
  }

  // Hujjat turlari endi org-darajali jadval (20260712143930_document_types migratsiyasi) —
  // enum o'chirilgan, har org o'z turlarini Admin Panel'da boshqaradi. Seed default to'plamni beradi.
  const typeNames = ['Buyruq', 'Nizom', 'Siyosat', "Yo'riqnoma", 'Protokol', 'Boshqa'] as const;
  const typeIds = new Map<string, string>();
  for (const [i, name] of typeNames.entries()) {
    const docType = await prisma.documentType.upsert({
      where: { orgId_name: { orgId: org.id, name } },
      update: {},
      create: { orgId: org.id, name, sortOrder: i },
    });
    typeIds.set(name, docType.id);
  }
  console.log(`${typeNames.length} ta hujjat turi yaratildi.`);

  const rootId = randomUUID();
  const boshqaruvId = randomUUID();
  const buyruqlarId = randomUUID();
  const yuridikId = randomUUID();
  const nizomlarId = randomUUID();
  const moliyaId = randomUUID();

  await upsertFolder({ id: rootId, orgId: org.id, parentId: null, name: 'Barcha hujjatlar', path: 'root', sortOrder: 0, isSystem: true });
  await upsertFolder({ id: boshqaruvId, orgId: org.id, parentId: rootId, name: 'Boshqaruv', path: 'root.boshqaruv', sortOrder: 0 });
  await upsertFolder({ id: buyruqlarId, orgId: org.id, parentId: boshqaruvId, name: 'Buyruqlar', path: 'root.boshqaruv.buyruqlar', sortOrder: 0 });
  await upsertFolder({ id: yuridikId, orgId: org.id, parentId: rootId, name: "Yuridik bo'lim", path: 'root.yuridik', sortOrder: 1 });
  await upsertFolder({ id: nizomlarId, orgId: org.id, parentId: yuridikId, name: 'Nizomlar', path: 'root.yuridik.nizomlar', sortOrder: 0 });
  await upsertFolder({ id: moliyaId, orgId: org.id, parentId: rootId, name: "Moliya bo'limi", path: 'root.moliya', sortOrder: 2 });
  console.log('Papka daraxti yaratildi: root > (boshqaruv > buyruqlar), (yuridik > nizomlar), moliya');

  const documents: Array<{
    folderId: string;
    title: string;
    docNumber: string;
    typeName: (typeof typeNames)[number];
    status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'EXPIRED';
    authorUserId: string;
    approvedAt?: Date;
    effectiveFrom?: Date;
  }> = [
    { folderId: buyruqlarId, title: 'Ish vaqti tartibi to\'g\'risida', docNumber: '№12', typeName: 'Buyruq', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2025-02-10'), effectiveFrom: new Date('2025-02-15') },
    { folderId: buyruqlarId, title: 'Masofaviy ish tartibi', docNumber: '№15', typeName: 'Buyruq', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2025-03-01'), effectiveFrom: new Date('2025-03-05') },
    { folderId: buyruqlarId, title: 'Kadrlar zaxirasi to\'g\'risida', docNumber: '№9', typeName: 'Buyruq', status: 'DRAFT', authorUserId: editor.id },
    { folderId: buyruqlarId, title: 'Yillik ta\'til jadvali', docNumber: '№21', typeName: 'Buyruq', status: 'IN_REVIEW', authorUserId: editor.id },
    { folderId: nizomlarId, title: 'Tashkilot nizomi', docNumber: '№1', typeName: 'Nizom', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2024-01-12'), effectiveFrom: new Date('2024-01-20') },
    { folderId: nizomlarId, title: 'Axborot xavfsizligi siyosati', docNumber: '№4', typeName: 'Siyosat', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2024-06-01'), effectiveFrom: new Date('2024-06-10') },
    { folderId: nizomlarId, title: 'Mehnat muhofazasi yo\'riqnomasi', docNumber: '№7', typeName: "Yo'riqnoma", status: 'ACTIVE', authorUserId: editor.id, approvedAt: new Date('2024-09-15'), effectiveFrom: new Date('2024-09-20') },
    { folderId: moliyaId, title: 'Byudjet reglamenti', docNumber: '№3', typeName: 'Nizom', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2025-01-05'), effectiveFrom: new Date('2025-01-10') },
    { folderId: moliyaId, title: 'Xarid protokoli', docNumber: '№4', typeName: 'Protokol', status: 'EXPIRED', authorUserId: editor.id, approvedAt: new Date('2023-05-01'), effectiveFrom: new Date('2023-05-05') },
    { folderId: moliyaId, title: 'Moliyaviy hisobot tartibi', docNumber: '№8', typeName: 'Siyosat', status: 'DRAFT', authorUserId: editor.id },
  ];

  // Birinchi hujjat alohida yaratiladi (id'i kerak — 3 versiyali demo ssenariysi uchun),
  // qolganlari avvalgidek createMany bilan (versiyasiz).
  const [versionedDoc, ...restDocuments] = documents;

  await prisma.document.createMany({
    data: restDocuments.map((doc) => ({
      orgId: org.id,
      folderId: doc.folderId,
      title: doc.title,
      docNumber: doc.docNumber,
      docTypeId: typeIds.get(doc.typeName)!,
      status: doc.status,
      authorUserId: doc.authorUserId,
      approvedAt: doc.approvedAt,
      effectiveFrom: doc.effectiveFrom,
    })),
  });
  console.log(`${restDocuments.length} ta demo hujjat yaratildi.`);

  const createdVersionedDoc = await prisma.document.create({
    data: {
      orgId: org.id,
      folderId: versionedDoc.folderId,
      title: versionedDoc.title,
      docNumber: versionedDoc.docNumber,
      docTypeId: typeIds.get(versionedDoc.typeName)!,
      status: versionedDoc.status,
      authorUserId: versionedDoc.authorUserId,
      approvedAt: versionedDoc.approvedAt,
      effectiveFrom: versionedDoc.effectiveFrom,
    },
  });

  // 3-versiyali demo: bitta MinIO obyekti (mazmuni bir xil — maqsad UI/versiya tarixi
  // ssenariysini ko'rsatish, real diff kontenti emas), 3 ta alohida File+DocumentVersion qatori.
  const pdfBuffer = readFileSync(DEMO_PDF_PATH);
  const sha256 = createHash('sha256').update(pdfBuffer).digest('hex');
  const bucket = process.env.S3_BUCKET ?? 'docmax';
  const objectKey = `org-${org.id}/${sha256}.pdf`;
  const s3 = s3ClientFromEnv();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: pdfBuffer, ContentType: 'application/pdf' }));

  let versionLabel: string | null = null;
  let currentVersionId = '';
  for (const versionType of ['MINOR', 'MINOR', 'MAJOR'] as const) {
    versionLabel = nextVersionLabel(versionLabel, versionType);
    const file = await prisma.file.create({
      data: {
        orgId: org.id,
        bucket,
        objectKey,
        originalName: `${versionedDoc.title} ${versionLabel}.pdf`,
        mime: 'application/pdf',
        sizeBytes: BigInt(pdfBuffer.length),
        sha256,
        uploadedBy: versionedDoc.authorUserId,
        status: 'READY',
      },
    });
    const maxVersionNo = await prisma.documentVersion.aggregate({
      where: { documentId: createdVersionedDoc.id },
      _max: { versionNo: true },
    });
    const versionNo = (maxVersionNo._max.versionNo ?? 0) + 1;
    if (versionNo > 1) {
      await prisma.documentVersion.updateMany({ where: { documentId: createdVersionedDoc.id, isCurrent: true }, data: { isCurrent: false } });
    }
    const version = await prisma.documentVersion.create({
      data: {
        documentId: createdVersionedDoc.id,
        versionLabel,
        versionNo,
        pdfFileId: file.id,
        createdBy: versionedDoc.authorUserId,
        isCurrent: true,
      },
    });
    currentVersionId = version.id;
  }
  await prisma.document.update({ where: { id: createdVersionedDoc.id }, data: { currentVersionId } });
  console.log(`1 ta demo hujjat 3 versiya bilan yaratildi ("${versionedDoc.title}", oxirgi: ${versionLabel}).`);

  console.log('Seed yakunlandi. Login ma\'lumotlari:');
  console.log(`  ADMIN:  ${admin.email} / ${ADMIN_PASSWORD}`);
  console.log(`  EDITOR: ${editor.email} / ${DEMO_PASSWORD}`);
  console.log(`  VIEWER: ${viewer.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
