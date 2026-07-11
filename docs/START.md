# START.md — Claude Code bilan ishni boshlash

Bu fayl siz uchun: qaysi tartibda, qanday promptlar bilan ishlashni ko'rsatadi. Har promptni Claude Code'ga ketma-ket bering, natijani tekshirib keyingisiga o'ting.

## 0. Tayyorgarlik

```bash
mkdir normavault && cd normavault
# shu starter-kit ichidagi CLAUDE.md, docs/, design/ papkalarni shu yerga ko'chiring
claude   # Claude Code'ni ishga tushiring
```

Claude Code `CLAUDE.md`ni avtomatik o'qiydi — barcha qoidalar shu orqali unga yetadi.

## 1-milestone · Skelet (1-prompt)

> docs/tz-0-umumiy.md ni to'liq o'qi. TZ-0 §2 bo'yicha pnpm+turbo monorepo skeletini yarat: apps/web (Next.js 15, TS, Tailwind 4, shadcn init), apps/api (NestJS 11), apps/worker (NestJS standalone + BullMQ), packages/db (Prisma), packages/shared (zod). docker-compose.yml: postgres:16 (ltree, pg_trgm, pgvector extension'lari bilan init skript), minio, redis, mailpit. `pnpm dev` hammasini ko'tarsin, README'ga ishga tushirish yo'riqnomasini yoz. Hech qanday biznes-logika hali yozma.

Tekshiruv: `docker compose up -d && pnpm install && pnpm dev` xatosiz.

## 2-milestone · Baza va seed

> docs/tz-0-umumiy.md §3 dagi barcha jadvallarni packages/db/prisma/schema.prisma da yarat (embeddings va external_acts ham — bo'sh tursin). ltree uchun folders.path ni Unsupported("ltree") bilan + qo'lda migratsiya SQL. Tenant izolyatsiya uchun Prisma client extension yoz (org_id avtomatik filter) — bu CLAUDE.md 1-qoidasi. Seed: 1 org, 3 user (ADMIN/EDITOR/VIEWER), TZ-1 dagi demo papka daraxti va 10 hujjat.

## 3-milestone · Auth (TZ-1 §1.1)

> docs/tz-1-mvp.md §1.1 ni o'qi va to'liq bajar: /setup oqimi, invite orqali ro'yxat, login, JWT 15min + refresh rotation (httpOnly cookie, reuse-detection), parol tiklash (mailpit), profil. Ruxsat matritsasidagi guard'lar. §1.1 qabul mezonlari uchun e2e testlar yoz va o'tkaz.

## 4-milestone · Papkalar (TZ-1 §1.2)

> docs/tz-1-mvp.md §1.2: folders tree API (ltree, move tranzaksiyasi, avlod ichiga ko'chirish taqiqi) + frontend chap panel tree (lazy-load, drag&drop). UI ko'rinishi uchun design/normavault-ui-v3.html dagi .tree blokini etalon qilib ol, tokenlar docs/DESIGN.md da. Qabul mezonlari testlari.

## 5-milestone · Hujjatlar (TZ-1 §1.3)

> docs/tz-1-mvp.md §1.3: fayl yuklash oqimi (presign→MinIO→confirm→hash), documents CRUD, 3 qadamli yaratish wizard'i (etalon: v3.html dagi .modal), Vault sahifasi — papka kartalari (.folder), jadval, chips-filtrlar (URL'da), holat badge'lari. Worker'da file.index vazifasi (pdf-parse/mammoth → extracted_text → search_vector).

## 6-milestone · Versiyalash + avtomatik shablon (TZ-1 §1.4)

> docs/tz-1-mvp.md §1.4 ni bajar: versiya tranzaksiyasi, timeline UI (etalon: .vitem), va diff.generate worker vazifasi — eski docx'ni mammoth bilan paragraflarga ajratib, docx npm bilan 3 ustunli taqqoslama shablon yasa. Formatning aniq namunasi: design/taqqoslama-jadval-namuna.docx — sarlavha, meta qator, jadval (№ / eski tahrir kulrang fonda / yangi tahrir bo'sh), pastda izoh. 50 betlik faylda test qil.

Shu yerda **Bosqich 1 Definition of Done** (tz-1 §1.7) checklistini yugurting.

## Keyingi bosqichlar

Har biri uchun prompt shablon bir xil:
> docs/tz-2-relations.md §X.Y ni o'qi va bajar. UI etalon: design/normavault-ui-v3.html dagi [komponent]. Qabul mezonlari testlari bilan.

Tartib: TZ-2 (relations → workflow canvas → graf → struktura → ACL → admin) → TZ-3 (scraper → xabarnoma → embedding → semantik) → TZ-4.
Graf va workflow uchun etalonda tayyor: canvas graf (initGraph) va rang kodlari. Monitoring sahifasi ham (.mrow).

## Maslahatlar

- Bir promptda bitta milestone. Katta promptlar sifatni tushiradi.
- Har milestone'dan keyin: `pnpm lint && pnpm test`, keyin commit.
- Claude Code xato qilsa — xatoni to'liq nusxalab bering, "tuzat" deb emas.
- UI chiqqach dizaynni o'zingiz Figma'da yaxshilab, "shu screenshot bo'yicha X sahifani yangila" deb berishingiz mumkin.
- Kontekst uzayib ketsa `/compact`, yangi mavzuda `/clear` — CLAUDE.md baribir qayta o'qiladi.
