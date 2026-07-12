import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

// CLAUDE.md 3-qoida: audit_logs — append-only. Bu DB darajasida REVOKE orqali
// majburlanadi (packages/db/prisma/migrations/*_unsupported_indexes_and_locks) —
// jadval egasi (DATABASE_URL) emas, balki runtime roli (APP_DATABASE_URL) orqali
// tekshiriladi, chunki Postgres'da jadval egasiga REVOKE ta'sir qilmaydi.
describe('audit_logs — append-only DB cheklovi', () => {
  const owner = new PrismaClient();
  const app = new PrismaClient({ datasources: { db: { url: process.env.APP_DATABASE_URL } } });
  const orgId = randomUUID();

  beforeAll(async () => {
    await owner.organization.create({
      data: { id: orgId, name: 'Audit Lock Test Org', slug: `audit-lock-test-${orgId}` },
    });
  });

  afterAll(async () => {
    await owner.auditLog.deleteMany({ where: { orgId } });
    await owner.organization.delete({ where: { id: orgId } });
    await owner.$disconnect();
    await app.$disconnect();
  });

  it('normavault_app roli audit_logs\'ga INSERT qila oladi', async () => {
    const log = await app.auditLog.create({
      data: { orgId, action: 'LOGIN', entityType: 'Organization', entityId: orgId },
    });

    expect(log.id).toBeDefined();
  });

  it('normavault_app roli audit_logs\'ni UPDATE qila olmaydi (permission denied)', async () => {
    const log = await owner.auditLog.create({
      data: { orgId, action: 'LOGIN', entityType: 'Organization', entityId: orgId },
    });

    await expect(
      app.auditLog.update({ where: { id: log.id }, data: { ip: '1.1.1.1' } }),
    ).rejects.toThrow();
  });

  it('normavault_app roli audit_logs\'ni DELETE qila olmaydi (permission denied)', async () => {
    const log = await owner.auditLog.create({
      data: { orgId, action: 'LOGIN', entityType: 'Organization', entityId: orgId },
    });

    await expect(app.auditLog.delete({ where: { id: log.id } })).rejects.toThrow();
  });
});
