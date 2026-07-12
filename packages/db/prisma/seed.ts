import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';
const ADMIN_EMAIL = 'admin@docmax.local';
const ADMIN_PASSWORD = 'Admin2026';

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
    docType: 'ORDER' | 'REGULATION' | 'POLICY' | 'INSTRUCTION' | 'PROTOCOL' | 'OTHER';
    status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'EXPIRED';
    authorUserId: string;
    approvedAt?: Date;
    effectiveFrom?: Date;
  }> = [
    { folderId: buyruqlarId, title: 'Ish vaqti tartibi to\'g\'risida', docNumber: '№12', docType: 'ORDER', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2025-02-10'), effectiveFrom: new Date('2025-02-15') },
    { folderId: buyruqlarId, title: 'Masofaviy ish tartibi', docNumber: '№15', docType: 'ORDER', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2025-03-01'), effectiveFrom: new Date('2025-03-05') },
    { folderId: buyruqlarId, title: 'Kadrlar zaxirasi to\'g\'risida', docNumber: '№9', docType: 'ORDER', status: 'DRAFT', authorUserId: editor.id },
    { folderId: buyruqlarId, title: 'Yillik ta\'til jadvali', docNumber: '№21', docType: 'ORDER', status: 'IN_REVIEW', authorUserId: editor.id },
    { folderId: nizomlarId, title: 'Tashkilot nizomi', docNumber: '№1', docType: 'REGULATION', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2024-01-12'), effectiveFrom: new Date('2024-01-20') },
    { folderId: nizomlarId, title: 'Axborot xavfsizligi siyosati', docNumber: '№4', docType: 'POLICY', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2024-06-01'), effectiveFrom: new Date('2024-06-10') },
    { folderId: nizomlarId, title: 'Mehnat muhofazasi yo\'riqnomasi', docNumber: '№7', docType: 'INSTRUCTION', status: 'ACTIVE', authorUserId: editor.id, approvedAt: new Date('2024-09-15'), effectiveFrom: new Date('2024-09-20') },
    { folderId: moliyaId, title: 'Byudjet reglamenti', docNumber: '№3', docType: 'REGULATION', status: 'ACTIVE', authorUserId: admin.id, approvedAt: new Date('2025-01-05'), effectiveFrom: new Date('2025-01-10') },
    { folderId: moliyaId, title: 'Xarid protokoli', docNumber: '№4', docType: 'PROTOCOL', status: 'EXPIRED', authorUserId: editor.id, approvedAt: new Date('2023-05-01'), effectiveFrom: new Date('2023-05-05') },
    { folderId: moliyaId, title: 'Moliyaviy hisobot tartibi', docNumber: '№8', docType: 'POLICY', status: 'DRAFT', authorUserId: editor.id },
  ];

  await prisma.document.createMany({
    data: documents.map((doc) => ({
      orgId: org.id,
      folderId: doc.folderId,
      title: doc.title,
      docNumber: doc.docNumber,
      docType: doc.docType,
      status: doc.status,
      authorUserId: doc.authorUserId,
      approvedAt: doc.approvedAt,
      effectiveFrom: doc.effectiveFrom,
    })),
  });
  console.log(`${documents.length} ta demo hujjat yaratildi.`);

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
