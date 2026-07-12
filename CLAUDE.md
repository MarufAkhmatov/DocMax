# CLAUDE.md — DocMax loyihasi

Bu fayl Claude Code uchun doimiy kontekst. Har sessiyada shu qoidalarga amal qil.

## Loyiha nima

**DocMax** — korxona ichki normativ hujjatlarini (nizom, buyruq, reglament, siyosat) boshqaruvchi multi-tenant SaaS:
ierarxik papkalar, versiyalash + avtomatik taqqoslama shabloni, hujjatlar orasidagi bog'lanishlar (workflow + graf),
tashqi manbalar (cbu.uz, lex.uz) monitoringi va semantik solishtirish.

**Hujjatlar (o'qish tartibi):**
1. `docs/tz-0-umumiy.md` — arxitektura, to'liq DB sxema, API konvensiyalar, xavfsizlik. **Har doim shu asosda ishla.**
2. `docs/tz-1-mvp.md` … `docs/tz-4-saas.md` — bosqichma-bosqich funksional TZ, har birida qabul mezonlari.
3. `docs/DESIGN.md` — dizayn tizimi (tokenlar, komponentlar).
4. `design/docmax-ui-v3.html` — **vizual etalon.** Yangi UI komponent yasashdan oldin shu faylni ochib, mos komponentning ko'rinishi va o'lchamlarini ol.

## Stack (o'zgartirilmaydi, TZ-0 §1)

Next.js 15 (App Router, TS) · Tailwind 4 + shadcn/ui · TanStack Query · Zustand ·
NestJS 11 · Prisma 6 · PostgreSQL 16 (ltree, pg_trgm, pgvector) · MinIO · Redis + BullMQ ·
React Flow (@xyflow/react) · react-force-graph-2d · mammoth (docx o'qish) · docx npm (docx yozish).

## Monorepo

```
apps/web      — Next.js frontend
apps/api      — NestJS REST API  (/api/v1)
apps/worker   — BullMQ consumer: file.index, diff.generate, scraper.*
packages/db     — Prisma schema, migratsiyalar, seed
packages/shared — zod sxemalar, DTO, enum'lar (front+back bitta manba)
```

Boshqaruv: pnpm workspaces + turbo. Lokal muhit: `docker compose up -d` (postgres, minio, redis, mailpit).

## Qat'iy qoidalar

1. **Tenant izolyatsiya:** har query `org_id` bilan cheklanadi. Prisma client extension orqali markazlashtirilgan — hech qachon qo'lda unutilmaydi. Bu qoidani buzadigan kod merge qilinmaydi.
2. **Fayllar immutable:** yuklangan fayl hech qachon o'zgartirilmaydi/o'chirilmaydi (trash sikli bundan mustasno). Yangi versiya = yangi fayl. Har faylga SHA-256.
3. **Audit interceptor orqali:** mutatsion endpointlar audit_log'ni avtomatik yozadi, servislar ichida qo'lda emas. audit_logs — append-only.
4. **Validatsiya faqat zod** (packages/shared). API DTO va front form bitta sxemadan.
5. **Versiyalash tranzaksiyada:** yangi versiya insert + eski `is_current=false` + `documents.current_version_id` yangilash — bitta tranzaksiya.
6. **Fayl yuklash:** presigned URL → to'g'ridan-to'g'ri MinIO → confirm → worker indekslaydi. Fayl backend orqali oqmaydi.
7. **i18n:** UI matnlar faqat next-intl lug'atida (uz default, ru, en). Hardcode matn taqiqlanadi.
8. **LLM ixtiyoriy modul:** monitoring/vector qismi LLM'siz to'liq ishlashi shart (TZ-3). LLM tahlil default OFF.
9. TypeScript strict, ESLint+Prettier. Sekretlar faqat .env.

## Buyruqlar (o'rnatilgach shu nomlarda bo'lsin)

```
pnpm dev          # hamma app parallel
pnpm db:migrate   # prisma migrate dev
pnpm db:seed      # demo-data (org, 3 rol user, papkalar, 10 hujjat)
pnpm test         # vitest
pnpm lint
```

## UI qoidalari

- Dizayn tokenlari `docs/DESIGN.md`da — Tailwind config va globals.css shundan generatsiya qilinadi.
- Dark default, light to'liq qo'llanadi (next-themes, system-aware).
- Komponent yasashda etalon: `design/docmax-ui-v3.html` (shisha papka kartalari, cmd+K palette, bulk bar, diff jadval, drawer, toast — barchasining tayyor ko'rinishi bor).
- Sana formati: DD.MM.YYYY. Font: Sora (sarlavha), Manrope (matn).

## Ish tartibi

- Har vazifa oldidan tegishli TZ bo'limini o'qi va qabul mezonlarini rejaga kirit.
- Katta o'zgarishlar feature branch + conventional commits.
- Har bosqich yakunida TZ'dagi "Definition of Done" checklistini yugurtir.
- Noaniqlik bo'lsa taxmin qilma — TZ'da javob bo'lmasa, savolni ro'yxatlab foydalanuvchidan so'ra.
