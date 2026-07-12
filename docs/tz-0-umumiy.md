# TZ-0. UMUMIY TEXNIK TOPSHIRIQ
## DocMax — arxitektura, standartlar, ma'lumotlar bazasi
*Versiya 1.0 · 11.07.2026 · Barcha bosqichlar uchun asos*

---

## 1. Texnologik stack (qat'iy)

| Qatlam | Texnologiya | Versiya |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | 15.x |
| UI | Tailwind CSS + shadcn/ui | 4.x |
| State/Data | TanStack Query + Zustand | latest |
| Workflow canvas | React Flow (@xyflow/react) | 12.x |
| Graf | react-force-graph-2d | latest |
| Backend | NestJS + TypeScript | 11.x |
| ORM | Prisma | 6.x |
| Baza | PostgreSQL (+ ltree, pg_trgm, pgvector) | 16 |
| Fayl ombori | MinIO (S3 API) | latest |
| Kesh/Navbat | Redis + BullMQ | 7.x |
| Worker | NestJS standalone app (BullMQ consumer) | — |
| Docx bilan ishlash | mammoth (o'qish), docx npm (yozish) | — |
| PDF matn ajratish | pdf-parse / poppler | — |

## 2. Monorepo strukturasi

```
docmax/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # NestJS REST API
│   └── worker/       # Fon vazifalar (fayl indekslash, docx generatsiya, scraper)
├── packages/
│   ├── db/           # Prisma schema + migratsiyalar + seed
│   ├── shared/       # Umumiy tiplar, DTO, konstantalar, zod sxemalar
│   └── ui/           # Umumiy UI komponentlar (agar kerak bo'lsa)
├── docker-compose.yml   # postgres + minio + redis + mailpit
├── turbo.json
└── .env.example
```

**Ishga tushirish:** `docker compose up -d` → `pnpm install` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`. Bitta buyruqlar zanjiri bilan lokal muhit ko'tarilishi shart.

## 3. Ma'lumotlar bazasi sxemasi (to'liq)

> Prisma'da yoziladi; quyida mantiqiy tavsif. Barcha jadvalar: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`. Multi-tenant: deyarli barcha jadvallarda `org_id` (indeksli).

### organizations
`name, slug (unique), logo_file_id?, settings jsonb, plan (enum: free/pro/enterprise, default free), is_active`

### users
`org_id, email (unique per org), password_hash, full_name, avatar_file_id?, role (enum: SUPER_ADMIN/ADMIN/EDITOR/CONTRIBUTOR/VIEWER), org_unit_id?, locale (uz/ru/en, default uz), theme (light/dark/system), is_active, last_login_at, invited_by?, invite_token?, invite_expires_at?`

### org_units  (korxona strukturasi)
`org_id, parent_id? (self-ref), name, code?, head_user_id?, sort_order int, is_active`
- Cheksiz chuqurlik. O'chirish faqat soft (is_active=false) va bolalari bo'lmasa.

### folders
`org_id, parent_id?, name, path ltree, org_unit_id?, color?, icon?, description?, sort_order int, is_system bool default false, deleted_at?`
- `path` — ltree (`root.dep_yur.buyruqlar`). Ko'chirishda subtree path'lari bitta tranzaksiyada yangilanadi.
- Indeks: `GIST(path)`, `(org_id, parent_id, sort_order)`.

### documents
`org_id, folder_id, title, doc_number?, doc_type (enum: ORDER/REGULATION/POLICY/INSTRUCTION/PROTOCOL/OTHER), status (enum: DRAFT/IN_REVIEW/ACTIVE/EXPIRED), approved_at?, effective_from?, effective_to?, author_user_id, org_unit_id?, current_version_id?, search_vector tsvector, deleted_at?`
- Indeks: `GIN(search_vector)`, `(org_id, folder_id)`, `(org_id, status)`, `(org_id, doc_type)`.

### document_versions
`document_id, version_label (masalan "v1.0"), version_no int (auto-increment per document), pdf_file_id, docx_file_id?, diff_file_id?, note?, approved_at?, created_by, is_current bool`
- Yangi versiya insert → eskisining `is_current=false`, `documents.current_version_id` yangilanadi (tranzaksiya).

### files
`org_id, bucket, object_key, original_name, mime, size_bytes, sha256, extracted_text? (worker to'ldiradi), uploaded_by, status (enum: PENDING/READY/FAILED)`
- Immutable: fayl yozilgach hech qachon o'zgartirilmaydi.

### relations
`org_id, source_document_id, target_document_id, type (enum: RELATED/PARENT_CHILD/AMENDS/REPLACES/BASED_ON), note?, created_by`
- Unique: `(source, target, type)`. Self-link taqiqlanadi. `REPLACES` yaratilganda target hujjat statusini `EXPIRED` qilishni taklif qiluvchi flag qaytariladi (avtomatik emas, tasdiq bilan).

### tags / document_tags
`tags: org_id, name (unique per org), color` · `document_tags: document_id, tag_id`

### folder_shortcuts  (hujjatning boshqa papkada "soya"si)
`document_id, folder_id` — unique juftlik.

### permissions  (papka darajasidagi ACL, Bosqich 2)
`org_id, folder_id, subject_type (ROLE/USER/ORG_UNIT), subject_id, can_view, can_edit, can_download, inherit bool default true`
- Mantiq: aniq ruxsat > merosxo'r ruxsat > global rol. Deny-by-default faqat ACL yoqilgan papkalarda.

### audit_logs  (append-only)
`org_id, user_id?, action (enum: VIEW/DOWNLOAD/CREATE/UPDATE/DELETE/RESTORE/LOGIN/PERMISSION_CHANGE/...), entity_type, entity_id, meta jsonb, ip, user_agent`
- UPDATE/DELETE'ga DB darajasida REVOKE. Faqat INSERT.

### notifications
`org_id, user_id, type, title, body, link?, is_read, meta jsonb`

### external_acts  (Bosqich 3)
`source (CBU/LEX), external_id, url, title, act_number?, published_at, fetched_at, raw_text?, status (NEW/PROCESSED)`
- Unique: `(source, external_id)`.

### embeddings  (Bosqich 3)
`org_id?, entity_type (DOCUMENT_VERSION/EXTERNAL_ACT), entity_id, chunk_index int, chunk_text, vector vector(768), model_name`
- Indeks: HNSW `vector_cosine_ops`.

## 4. API konvensiyalari

- Baza yo'l: `/api/v1/...`. REST, JSON.
- Auth: `Authorization: Bearer <access_jwt>` (15 min) + httpOnly refresh cookie (14 kun, rotation).
- Javob formati: muvaffaqiyat — to'g'ridan-to'g'ri resurs yoki `{ items, total, page, limit }`; xato — `{ error: { code, message, details? } }` (kodlar: `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, ...).
- Validatsiya: zod (shared package) — front va back bitta sxemadan foydalanadi.
- Fayl yuklash oqimi: `POST /files/presign` → client to'g'ridan-to'g'ri MinIO'ga PUT → `POST /files/confirm` (hash tekshiruv, worker'ga indekslash vazifasi).
- Barcha ro'yxat endpointlari: pagination (`page`, `limit` max 100), `sort`, `order`.
- Har mutatsiya audit_log yozadi (interceptor orqali, qo'lda emas).

## 5. Frontend standartlari

- App Router, server components default, interaktiv joylarda client components.
- Dizayn tokenlari `globals.css`'da CSS variables: `--radius`, ranglar palitrasi light/dark juftlikda. Theme: `next-themes`, system-aware, FOUC'siz.
- i18n: `next-intl`, tillar uz (default) / ru / en. Barcha matnlar lug'atda, hardcode taqiqlanadi.
- Ikonkalar: lucide-react. Sana format: `DD.MM.YYYY`.
- Dizayn fayllari buyurtmachidan keladi (Figma); komponentlar shadcn asosida, token bilan moslashtiriladi.

## 6. Sifat talablari

- TypeScript strict. ESLint + Prettier, CI'da tekshiruv.
- Testlar: API'da servis-darajali unit testlar (Vitest) + kritik oqimlar uchun e2e (auth, upload, versioning). Minimal qamrov: auth, permissions, versioning mantiqlari 100% test bilan.
- Git: `main` himoyalangan, feature branch + PR. Conventional commits.
- Sekretlar faqat `.env`, repoda `.env.example`.
- Performance: hujjatlar ro'yxati 10 000 yozuvda < 300ms (indekslar bilan), fayl preview lazy.

## 7. Xavfsizlik (barcha bosqichlarda majburiy)

- Parol: argon2id. Rate limit: login 5/min/IP.
- Har so'rovda `org_id` guard (tenant izolyatsiya) — servis qatlamida, unutish imkonsiz bo'lgan arxitektura (Prisma extension yoki repository pattern).
- Presigned URL muddati 10 min, faqat kutilgan mime/size.
- Yuklangan fayllar antivirus-skan uchun kengaytma nuqtasi (Bosqich 4'da ClamAV).
- CORS faqat frontend domeni. Helmet, CSRF (cookie oqimlari uchun).
