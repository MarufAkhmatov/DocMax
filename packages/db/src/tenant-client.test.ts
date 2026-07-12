import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { forOrg } from './tenant-client';

// CLAUDE.md 1-qoida: "har query org_id bilan cheklanadi... hech qachon qo'lda unutilmaydi".
// Bu testlar shu kafolatni Tag modeli ustida tekshiradi (eng sodda org_id-scoped model —
// Unsupported maydonlari yo'q, shuning uchun to'g'ridan-to'g'ri Prisma Client orqali yoziladi).
describe('forOrg — tenant izolyatsiya extension', () => {
  const db = new PrismaClient();
  const orgAId = randomUUID();
  const orgBId = randomUUID();

  beforeAll(async () => {
    await db.organization.create({
      data: { id: orgAId, name: 'Tenant Test Org A', slug: `tenant-test-a-${orgAId}` },
    });
    await db.organization.create({
      data: { id: orgBId, name: 'Tenant Test Org B', slug: `tenant-test-b-${orgBId}` },
    });
  });

  afterAll(async () => {
    await db.tag.deleteMany({ where: { orgId: { in: [orgAId, orgBId] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await db.$disconnect();
  });

  it('create() avtomatik joriy org_id bilan yozadi', async () => {
    const scopedA = forOrg(db, orgAId);
    const tag = await scopedA.tag.create({ data: { name: 'Buyruq' } });

    expect(tag.orgId).toBe(orgAId);
  });

  it('findMany() faqat joriy orgning yozuvlarini qaytaradi', async () => {
    const scopedA = forOrg(db, orgAId);
    const scopedB = forOrg(db, orgBId);
    await scopedA.tag.create({ data: { name: 'Nizom' } });
    await scopedB.tag.create({ data: { name: 'Reglament' } });

    const aTags = await scopedA.tag.findMany();
    const bTags = await scopedB.tag.findMany();

    expect(aTags.every((t) => t.orgId === orgAId)).toBe(true);
    expect(bTags.every((t) => t.orgId === orgBId)).toBe(true);
    expect(aTags.some((t) => t.orgId === orgBId)).toBe(false);
  });

  it('findUnique() boshqa orgga tegishli yozuvni id bo\'yicha ham qaytarmaydi', async () => {
    const scopedA = forOrg(db, orgAId);
    const scopedB = forOrg(db, orgBId);
    const bTag = await scopedB.tag.create({ data: { name: 'Siyosat' } });

    const leaked = await scopedA.tag.findUnique({ where: { id: bTag.id } });

    expect(leaked).toBeNull();
  });

  it('boshqa orgga tegishli yozuvni yangilay olmaydi', async () => {
    const scopedA = forOrg(db, orgAId);
    const scopedB = forOrg(db, orgBId);
    const bTag = await scopedB.tag.create({ data: { name: 'Ko\'rsatma' } });

    const result = await scopedA.tag.updateMany({
      where: { id: bTag.id },
      data: { color: '#ff0000' },
    });

    expect(result.count).toBe(0);
  });

  it('caller data.orgId bilan aralashishga urinsa ham, haqiqiy org ustunlik qiladi', async () => {
    const scopedA = forOrg(db, orgAId);
    const tag = await scopedA.tag.create({ data: { name: 'Xavfli', orgId: orgBId } });

    expect(tag.orgId).toBe(orgAId);
  });
});
