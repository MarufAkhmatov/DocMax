# DocMax

Korxona ichki normativ hujjatlarini (nizom, buyruq, reglament, siyosat) boshqaruvchi multi-tenant SaaS: ierarxik papkalar, versiyalash + avtomatik taqqoslama shabloni, hujjatlar orasidagi bog'lanishlar (workflow + graf), tashqi manbalar (cbu.uz, lex.uz) monitoringi va semantik solishtirish.

Texnik topshiriq: [docs/tz-0-umumiy.md](docs/tz-0-umumiy.md) (arxitektura) → [docs/tz-1-mvp.md](docs/tz-1-mvp.md) … [docs/tz-4-saas.md](docs/tz-4-saas.md) (bosqichlar). Dizayn tizimi: [docs/DESIGN.md](docs/DESIGN.md), vizual etalon: `design/docmax-ui-v3.html`.

## Stack

Next.js 15 (App Router, TS) · Tailwind 4 + shadcn/ui · TanStack Query + Zustand · NestJS 11 · Prisma 6 · PostgreSQL 16 (ltree, pg_trgm, pgvector) · MinIO · Redis + BullMQ · pnpm workspaces + turbo

## Monorepo

```
apps/web        Next.js frontend            → http://localhost:3000
apps/api        NestJS REST API             → http://localhost:3001/api/v1
apps/worker     BullMQ consumer (file.index, diff.generate)
packages/db     Prisma schema, migratsiyalar, seed
packages/shared zod sxemalar, DTO, enum'lar (front+back bitta manba)
```

## Talablar

- Node.js ≥ 20 (pnpm corepack orqali: `corepack enable pnpm`)
- Docker (Desktop yoki Engine)

## Ishga tushirish

```bash
# 1. Muhit sozlamalari
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env

# 2. Infratuzilma (postgres, minio, redis, mailpit)
docker compose up -d

# 3. Bog'liqliklar
pnpm install

# 4. Baza migratsiyasi va demo-data
pnpm db:deploy
pnpm db:seed

# 5. Hamma app parallel (web + api + worker)
pnpm dev
```

Servislar:

| Servis | Manzil |
|---|---|
| Web | http://localhost:3000 |
| API health | http://localhost:3001/api/v1/health |
| MinIO konsol | http://localhost:9001 (docmax / docmax-secret) |
| Mailpit UI | http://localhost:8025 |
| Postgres | localhost:5433 (5432 emas — hostda band bo'lishi mumkin) |

## Demo login (seed)

`pnpm db:seed` dan keyin (auth 3-milestone'da qo'shiladi, hozircha faqat DB'da):

| Rol | Email | Parol |
|---|---|---|
| ADMIN | admin@demo.docmax.local | Password123! |
| EDITOR | editor@demo.docmax.local | Password123! |
| VIEWER | viewer@demo.docmax.local | Password123! |

## Buyruqlar

```bash
pnpm dev          # hamma app parallel
pnpm build        # production build
pnpm db:deploy    # prisma migrate deploy — mavjud migratsiyalarni qo'llaydi (setup/CI, interaktivsiz)
pnpm db:migrate   # prisma migrate dev — yangi migratsiya yaratish (faqat sxema ustida ishlaganda)
pnpm db:seed      # demo-data (org, 3 rol user, papkalar, 10 hujjat)
pnpm test         # vitest
pnpm lint         # eslint
```

> **Nega `db:deploy`, `db:migrate` emas?** `embeddings.vector` ustunidagi HNSW indeksi (pgvector) Prisma sxema tilida ifodalanmaydi (faqat BTree/Hash/Gist/Gin/SpGist/Brin qo'llab-quvvatlanadi) — shuning uchun u qo'lda SQL migratsiyada qo'shilgan (`packages/db/prisma/migrations/*_vector_index_and_app_role`). Bu bitta indeks tufayli `prisma migrate dev` doim "drift" deb hisoblab yangi migratsiya nomini so'raydi (interaktiv). Mavjud loyihani ishga tushirish/CI uchun `prisma migrate deploy` ishlatiladi — u faqat `prisma/migrations/`dagi fayllarni ketma-ket qo'llaydi, hech qanday diff/prompt yo'q. `db:migrate`ni faqat sxemaga YANGI o'zgarish qo'shayotganda, natijani har doim `--create-only` bilan ko'rib chiqib ishlating.

## Loyiha holati

- [x] **1-milestone** — monorepo skelet (web, api, worker, db, shared, docker compose)
- [x] **2-milestone** — to'liq DB sxema, tenant-izolyatsiya, seed
- [ ] **3-milestone** — auth (TZ-1 §1.1)
- [ ] **4-milestone** — papkalar (TZ-1 §1.2)
- [ ] **5-milestone** — hujjatlar (TZ-1 §1.3)
- [ ] **6-milestone** — versiyalash + taqqoslama shablon (TZ-1 §1.4)
