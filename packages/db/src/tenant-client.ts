import type { PrismaClient } from '@prisma/client';
import { isTenantScopedModel } from './tenant-scope';

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
  'upsert',
]);

// Umumiy Prisma extension query-argumentlari model bo'yicha turlicha bo'lgani uchun
// (findMany'ning where'i update'nikidan farq qiladi), $allOperations darajasida
// generik `Record<string, unknown>` bilan ishlash Prisma'ning rasmiy multi-tenant
// cookbook namunasida ham qo'llaniladi: https://pris.ly/d/client-extensions-tenant
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Berilgan org bilan cheklangan Prisma Client. `tenant-scope.ts`da ro'yxatlangan
 * barcha org_id maydonli modellarga o'qish/yozish avtomatik shu org bilan
 * cheklanadi (CLAUDE.md 1-qoida — "har query org_id bilan cheklanadi... hech
 * qachon qo'lda unutilmaydi").
 *
 * Muhim: `$queryRaw`/`$executeRaw` (masalan folders.path — ltree — bilan ishlashda
 * kerak bo'ladi) bu extension'dan o'tmaydi; bunday joylarda org_id filtri
 * QO'LDA qo'shilishi SHART.
 */
export function forOrg(client: PrismaClient, orgId: string) {
  return client.$extends({
    name: `tenant-scope:${orgId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantScopedModel(model)) {
            return query(args);
          }

          const a = args as Record<string, any>;
          // Bu extension barcha CRUD amallarni qamraydi, lekin Prisma'ning $allOperations
          // tipi kontekstga qarab torayib qolishi mumkin — shuning uchun `op` string
          // sifatida kengaytiriladi (Prisma'ning rasmiy tenant-isolation namunasidagi kabi).
          const op = operation as string;

          if (op === 'create') {
            a.data = { ...a.data, orgId };
          } else if (op === 'createMany' || op === 'createManyAndReturn') {
            a.data = Array.isArray(a.data)
              ? a.data.map((row: Record<string, unknown>) => ({ ...row, orgId }))
              : a.data;
          } else if (op === 'upsert') {
            a.where = { ...a.where, orgId };
            a.create = { ...a.create, orgId };
          } else if (WHERE_OPERATIONS.has(op)) {
            a.where = { ...a.where, orgId };
          }

          return query(a);
        },
      },
    },
  });
}

/* eslint-enable @typescript-eslint/no-explicit-any */
