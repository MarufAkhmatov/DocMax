# NormaVault

Korxona ichki normativ hujjatlarini (nizom, buyruq, reglament, siyosat) boshqaruvchi multi-tenant SaaS: ierarxik papkalar, versiyalash + avtomatik taqqoslama shabloni, hujjatlar orasidagi bog'lanishlar (workflow + graf), tashqi manbalar (cbu.uz, lex.uz) monitoringi va semantik solishtirish.

Texnik topshiriq: [docs/tz-0-umumiy.md](docs/tz-0-umumiy.md) (arxitektura) → [docs/tz-1-mvp.md](docs/tz-1-mvp.md) … [docs/tz-4-saas.md](docs/tz-4-saas.md) (bosqichlar). Dizayn tizimi: [docs/DESIGN.md](docs/DESIGN.md), vizual etalon: `design/normavault-ui-v3.html`.

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
pnpm db:migrate
pnpm db:seed

# 5. Hamma app parallel (web + api + worker)
pnpm dev
```

Servislar:

| Servis | Manzil |
|---|---|
| Web | http://localhost:3000 |
| API health | http://localhost:3001/api/v1/health |
| MinIO konsol | http://localhost:9001 (normavault / normavault-secret) |
| Mailpit UI | http://localhost:8025 |

## Buyruqlar

```bash
pnpm dev          # hamma app parallel
pnpm build        # production build
pnpm db:migrate   # prisma migrate dev
pnpm db:seed      # demo-data (org, 3 rol user, papkalar, 10 hujjat)
pnpm test         # vitest
pnpm lint         # eslint
```

## Loyiha holati

- [x] **1-milestone** — monorepo skelet (web, api, worker, db, shared, docker compose)
- [ ] **2-milestone** — to'liq DB sxema, tenant-izolyatsiya, seed
- [ ] **3-milestone** — auth (TZ-1 §1.1)
- [ ] **4-milestone** — papkalar (TZ-1 §1.2)
- [ ] **5-milestone** — hujjatlar (TZ-1 §1.3)
- [ ] **6-milestone** — versiyalash + taqqoslama shablon (TZ-1 §1.4)
