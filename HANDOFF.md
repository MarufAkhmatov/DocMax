# DocMax — Handoff

*Oxirgi yangilanish: 2026-07-18 (M8 — Workflow canvas + Relations yakuni bilan) · kanonik branch: **`main`** (= `claude/hand-off-task-c339c9` + real ⌘K/bulk/graf + M7-M12 yo'l xaritasi + Pre-M7 i18n + M7 + M8; c339c9 endi orqada qolgan, kerak emas)*

Bu fayl har sessiya boshida o'qilishi SHART. Loyihaning joriy holati, nima qilingani va keyingi qadamlar shu yerda.

---

## 0. MUHIM — branch tarixi va kanonik holat

**2026-07-16/17 sessiyasida jiddiy chalkashlik topilib tuzatildi:** `main` (2d36d06) juda orqada qolgan, eng so'nggi ish `claude/vibrant-davinci-9d583f`da edi, lekin yangi sessiya `main` asosidagi eski handoff bilan boshlangan va milestone 5'ni PARALLEL qayta qurgan. Bu parallel ish `backup/hand-off-milestone5-parallel` branch'ida saqlanadi (ishlatilmaydi, faqat tarix).

**Hozirgi kanonik holat**: `claude/hand-off-task-c339c9` = vibrant-davinci'ning barcha 11 commit'i + shu sessiyaning 4 commit'i (seed-fix, security, fayl-chip'lar, handoff). **Keyingi sessiya SHU branch'dan davom etsin. `main`ni shu branch'ga fast-forward qilish tavsiya etiladi** (foydalanuvchi roziligi bilan):
```bash
git checkout main && git merge --ff-only claude/hand-off-task-c339c9
```
Eski `claude/vibrant-davinci-9d583f` branch/worktree endi kerak emas (bu branch uni to'liq o'z ichiga oladi).

**DB drift ogohlantirishi**: dev Postgres bitta (docker `docmax-postgres`, port 5433) — turli worktree'lar turli migratsiya to'plamlari bilan almashib ishlasa drift bo'ladi. Hozir bazaga 5 migratsiya (document_types bilan) qo'llangan — shu branch bilan mos.

---

## 1. Umumiy holat

| Qatlam | Holat |
|---|---|
| **Backend (apps/api)** | Auth (m3, CONTRIBUTOR bilan) + Papkalar (m4) + Hujjatlar/Fayllar (m5) + Admin Panel (dinamik hujjat turlari) + Bog'lanishlar+Graf (TZ-2 §2.1/§2.3) + Kompaniya logotipi + Notifications/Trash/Audit-logs/Stats (M7) + **security hardening** + **GET /files/:id/download (VIEW/DOWNLOAD audit bilan)** |
| **DB (packages/db)** | 5 migratsiya (oxirgisi `document_types`), tenant-izolyatsiya extension, **seed yangi sxemaga moslangan** (6 default tur + 10 demo hujjat) |
| **Worker (apps/worker)** | `file.index` real (pdf-parse@1.1.1/mammoth, 3x retry→FAILED). `diff.generate` real (M6) + TEMPLATE_READY bildirishnoma (M7) |
| **Frontend (apps/web)** | React+Vite (router YO'Q — App.tsx view-switching). Login, Dashboard (real statistika+faollik+bildirishnoma), Vault (papka grid + daraxt sidebar, hover-CRUD), Hujjatlar jadvali (PDF/DOCX fayl-chip'lar), 3-qadamli wizard, DocDetail (PDF iframe, Word mammoth, tahrirlash, holat o'zgartirish, bog'lanishlar, real audit), real Graf, Admin Panel (turlar+logo+**Trash**+**Audit log**), i18n (uz/ru/en, deyarli to'liq). Monitoring/Workflow-canvas/Struktura hali yo'q yoki mock |

Batafsil tarix uchun: `git log --oneline` — har commit xabarida nima qilingani yozilgan.

## 1.1. Shu sessiyada qilinganlar (2026-07-16/17)

1. **Branch konsolidatsiyasi** (§0) — eng katta ish; endi bitta kanonik chiziq bor.
2. **`packages/db/prisma/seed.ts` tuzatildi** — document_types migratsiyasidan keyin seed butunlay singan edi (eski enum bilan yozilgan). Endi `pnpm db:seed` yana ishlaydi.
3. **Security audit + tuzatishlar** (butun loyiha ko'lamida):
   - `POST /files/confirm` endi hash'ni MinIO'dagi obyektdan **server tomonda qayta hisoblaydi** — klient da'vosiga ishonilmaydi (dedup-zaharlanish yopildi)
   - `forgot-password`ga ThrottlerGuard (5/min/IP)
   - Barcha `:id`/`:documentId`/`:relationId` param'lar `UuidParamPipe` bilan (400, 500 emas)
   - Auditda tasdiqlangan kuchli joylar: argon2id, hash'langan refresh-token + rotation/reuse-detection, tenant-izolyatsiya (raw SQL joylari ham), append-only audit_logs (DB-darajasida REVOKE), helmet+CORS, sekretlar `.env`da
4. **Fayl-chip'lar** (foydalanuvchi so'rovi): Vault jadvalida FAYLLAR ustuni — PDF/DOCX chip, hover'da Eye/Download/Pencil/Trash amallar. Yangi `GET /files/:id/download?disposition=` endpoint — bosilganda yangi presigned URL + **VIEW/DOWNLOAD audit yozuvlari** (birinchi marta ishlatilmoqda).
5. **HANDOFF.md endi git ichida** (repo ildizida, commit qilinadi) — worktree'lar orasida adashmasligi uchun.
6. **Brendli fayl ikonkalari** — FAYLLAR ustunida matn o'rniga SVG fayl shakli (`FileTypeIcon`: PDF qizil, Word ko'k), hover amallari saqlangan.
7. **Kartochka + Timeline** vault ko'rinishlari ishga tushirildi (avval faqat Jadval ishlar edi) — karta grid va oy bo'yicha guruhlangan xronologiya.
8. **Kalendar** — yangi nav bandi (`CalendarView.tsx`): Oy/Hafta/Yil rejimlari, tasdiqlangan/yuklangan sana almashtirgichi, holat-rangli pill'lar (bosilsa hujjat ochiladi), bugungi kun halqasi, yil ko'rinishida 12 mini-oy. Backend: `listDocumentsQuerySchema`ga `dateField`/`from`/`to`. Eslatma: kalendar bitta so'rovda max 100 hujjat oladi (pagination cheklovi) — juda katta davrda kam ko'rsatishi mumkin.

## 1.2. Shu sessiyada qilinganlar (2026-07-18) — Pre-M7 i18n tuzatish

Foydalanuvchi so'rovi bilan: "frontga chiqadigan barcha tekstlar uz/ru/en'da lokalizatsiya qilinsin, ba'zi joylar (papka nomlari va h.k.) qolib ketayapti" — tekshirilib tuzatildi:

- `apps/web/src/i18n/locales/{uz,ru,en}.json`ga yangi `errors.*` bo'limi (21 kalit) — `App.tsx`, `AdminPanel.tsx`, `CalendarView.tsx`, `GraphView.tsx` bo'ylab barcha runtime xato/toast xabarlari (avval hardcoded o'zbekcha, `t()`dan tashqarida) shu kalitlarga o'tkazildi.
- `FolderTreeNode` komponenti (`App.tsx`) `useTranslation` hook'ini butunlay ishlatmas edi — endi qo'shildi; papka o'chirish tasdiq matni (`vault.folderDeleteConfirm`, interpolatsiya bilan), "+ Yangi papka"/"Tahrirlash"/"O'chirish" tooltip'lari (`common.edit`/`common.delete` yangi kalitlar), papka nomi placeholder — barchasi mavjud kalitlarga ulandi.
- Teg input placeholder'lari (wizard + tahrirlash formasi) `wizard.fieldTagsPlaceholder`ga o'tkazildi.
- **Ataylab tegilmagan**: Dashboard "Oxirgi faollik"/"E'tibor talab qiladi" va Monitoring sahifasidagi to'liq mock ma'lumotlar (masalan "CBU qarori № 145/2026", "482 hujjat") — bular M7 (real dashboard statistikasi) va M11 (real monitoring)da butunlay haqiqiy ma'lumot bilan almashtiriladi, hozir tarjima qilish bekor ish bo'lardi. "PDF"/"Word" tab yorliqlari ham (universal qisqartma, tarjima shart emas).
- Uch tilda brauzerda sinaldi (locale-toggle orqali uz→ru→en aylanish): nav/vault/wizard chrome to'liq tarjima bo'ladi, konsolda xato yo'q.
- **Yon topilma**: `pnpm --filter @docmax/web build` (production Rollup build) `packages/shared`dan `RELATION_TYPES` named export'ini topolmayapti — CJS `tsc` chiqishi (`__createBinding` interop)ni Rollup'ning statik export-aniqlashi yeta olmayapti. Bu **oldindan mavjud** muammo (import qatori `64ee6ba`da qo'shilgan, shu sessiyada tegilmagan) — loyiha hozirgacha faqat `pnpm dev` (Vite dev server) bilan ishlatilgan, `vite build` hech qachon sinalmagan. M10 (texnik qarz) doirasida hal qilinishi kerak — masalan `packages/shared`ni ESM'ga o'tkazish yoki tsconfig'da `module: "esnext"`.

## 1.3. Shu sessiyada qilinganlar (2026-07-18) — M7: Boshqaruv yakuni (TZ-2 §2.7)

Backend — yangi modullar, barchasi mavjud naqshga mos (`TenantPrismaService`, `@Roles()`, `setAuditContext`):
- **`apps/api/src/notifications/*`** — `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`. `NotificationsService.notifyUsers()` boshqa servislar tomonidan chaqiriladi (documents.service versiya/status o'zgarishida, worker diff-generate shablon tayyor bo'lganda).
- **`apps/api/src/trash/*`** — `GET /trash` (Document/Folder'ning mavjud `deletedAt` soft-delete'ini ro'yxatlaydi, `purgeAt` = deletedAt+30 kun), `POST /trash/documents/:id/restore`, `POST /trash/folders/:id/restore`. **Eslatma: 30-kunlik avtomatik tozalash cron'i HALI YO'Q** — faqat qo'lda tiklash ishlaydi, muddati o'tganini avtomatik o'chirish keyingi ishga qoldi (worker'da BullMQ repeatable job kerak).
- **`apps/api/src/audit-logs/*`** — `GET /audit-logs` (filtr: user/action/entityType/entityId/sana, sahifalash), `GET /audit-logs/export.csv`. Ikkalasi ham faqat ADMIN. `apps/api/src/documents/`ga qo'shilgan **`GET /documents/:id/audit`** — torroq, hujjatni ko'ra oladigan har kimga ochiq (DocDetail audit paneli uchun, org-darajasidagi to'liq logdan farqli).
- **`apps/api/src/stats/*`** — `GET /stats/dashboard`: haqiqiy hujjat/papka soni, aktiv/tasdiq-kutayotgan hisoblar, `audit_logs`dan olingan real "oxirgi faollik" ro'yxati.
- **CONTRIBUTOR roli faollashdi** — `documents.service.ts`ga rol tekshiruvi: faqat o'z DRAFT hujjatini tahrirlaydi, faqat IN_REVIEW'ga yubora oladi (ACTIVE/EXPIRED — EDITOR/ADMIN). E2e sinaldi: invite→accept→login→ownership 403 va business-404 (403 emas) create'da tasdiqlandi.

Frontend (`App.tsx`, `AdminPanel.tsx`):
- Dashboard: statistik kartalar, "Oxirgi faollik" va "E'tibor talab qiladi" (endi joriy user'ning o'qilmagan bildirishnomalari) — barchasi real API'ga ulandi. Fan-vizualizatsiya (dekorativ) ataylab mock qoldirildi.
- Bildirishnoma drawer + bell badge — real `notificationsApi` (list/markRead/markAllRead).
- DocDetail "Audit" paneli — `documentsApi.audit()` orqali real.
- Admin Panel'ga ikkita yangi bo'lim: **Chiqindilar qutisi** (ro'yxat + tiklash) va **Audit log** (filtr + sahifalash + CSV eksport).
- Barcha yangi matnlar uz/ru/en'da.

Brauzerda to'liq sinaldi (curl bilan API + Chrome preview bilan UI): status-change → bildirishnoma real userga keladi, Dashboard/Audit log/Trash sahifalari real ma'lumot bilan ishlaydi, pagination/CSV/CONTRIBUTOR cheklovlari tasdiqlandi, konsolda xato yo'q.

## 1.4. Shu sessiyada qilinganlar (2026-07-18) — M8: Workflow canvas + Relations yakuni (TZ-2 §2.2 + §2.1 qoldiqlari)

Backend:
- **`document-relations.service.ts`**: PARENT_CHILD uchun DFS sikl tekshiruvi (`wouldCreateCycle` — target'dan boshlab mavjud PARENT_CHILD zanjirini yurib, source'ga qaytishni tekshiradi; topilsa 400). E2e sinaldi: A→B PARENT_CHILD yaratilgach B→A urinish to'g'ri bloklandi.
- **REPLACES + avtomatik EXPIRED**: `createDocumentRelationSchema`ga `alsoExpireTarget?: boolean`; `document-relations.controller.ts` shu bayroq bilan `documentsService.update(...)`ni chaqirib target'ni EXPIRED qiladi (effectiveTo=now). E2e sinaldi: target ACTIVE→EXPIRED, audit trailda ikkalasi (relation CREATE + document UPDATE) ko'rindi.
- **Audit context array'ga o'tkazildi** (`audit-context.ts`/`audit.interceptor.ts`): bitta so'rovda bir nechta `setAuditContext()` chaqiruvi endi HAMMASI yoziladi (avval oxirgisi avvalgilarini bosib qolar edi) — REPLACES+EXPIRE kabi bir so'rovda ikki entity o'zgaradigan holatlar uchun zarur, orqaga mos (bitta chaqiruv — bitta yozuv, eski xatti-harakat saqlangan).
- **`apps/api/src/tags/*`** — `GET /tags` (ro'yxat+documentCount, typeahead uchun), `PATCH /tags/:id` / `DELETE /tags/:id` (ADMIN, Admin Panel boshqaruvi uchun).
- **`apps/api/src/workflow/*`** + yangi **`UserCanvasLayout`** modeli/migratsiyasi (`user_canvas_layouts`, org+user bo'yicha unique) — `GET/PUT /workflow/layout`.

Frontend:
- DocDetail bog'lanishlar: tur bo'yicha guruhlangan ro'yxat, o'chirishda tasdiq (`window.confirm`), REPLACES tanlanganda "eski hujjatni ham EXPIRED qilish" checkbox'i.
- Admin Panel'ga **Teglar** bo'limi (rename/delete, hujjat soni bilan).
- **`WorkflowView.tsx`** (yangi, `@xyflow/react` asosida) — Graf sahifasida "Graf/Workflow" rejim almashtirgichi (mavjud `graph.modeGraph`/`modeWorkflow` kalitlari ishlatildi). Chap panel qidiruv (papka/hujjat) → canvas'ga drag&drop; ikki hujjat node'ini ulash → tur+izoh modali → real relation yaratadi; edge o'chirish (tanlab Delete) → relation o'chadi; joylashuv 600ms debounce bilan avtomatik saqlanadi; mavjud bog'lanishlar sahifa ochilganda avtomatik edge sifatida chiziladi.
  - **Muhim topilma/tuzatish**: `@xyflow/react` v12 dinamik qo'shilgan node'lar uchun edge'larni ResizeObserver orqali handle o'lchamlari aniqlanmaguncha chizmaydi (`isNodeInitialized` — `internals.handleBounds` yoki statik `node.handles` talab qiladi); bu loyihada ResizeObserver "yetarlicha tez" ishlamas edi. Yechim: har node'ga statik `width/height/measured` + `handles` massivi (top/bottom, sabit x/y) qo'lda beriladi — ResizeObserver'ni butunlay chetlab o'tadi. Kelgusida shu componentga node qo'shilsa, xuddi shu naqshga amal qilinsin.

E2e sinaldi (curl + brauzer + JS orqali drag&drop/connect/delete simulyatsiyasi): cikl bloklash, REPLACES+EXPIRE+audit, canvas'ga node qo'shish+saqlash+qayta yuklash, mavjud relation avtomatik edge sifatida chizilishi, edge o'chirish → backend'da relation ham o'chishi — barchasi tasdiqlandi.

## 2. Yo'l xaritasi (2026-07-17 auditi asosida)

**Bajarilgan:** TZ-1 to'liq (m1–m6) · TZ-2 qisman: §2.1 Relations (to'liq — M8), §2.2 Workflow canvas (to'liq — M8), §2.3 Graf (real), §2.6 ⌘K nom/raqam qidiruv, §2.7 to'liq (M7) · bulk amallar · kalendar · kartochka/timeline · Admin Panel (turlar+logo+teglar) · i18n · security hardening.

**Keyingi milestonelar (tavsiya tartibi):**

- **M9 — Struktura + ACL (TZ-2 §2.4 + §2.5)**: org-units daraxti UI (CRUD, drag&drop, rahbar), remapping wizard + snapshots, papka ACL (guard bitta joyda, qulf ikonkalari, yuklab-olish-taqiq rejimi watermark bilan), permission-matrix e2e.
- **M10 — Sifat/texnik qarz (TZ-0 §6 talabi)**: apps/web eslint+vitest (hozir stub), documents/files/versions/graph e2e testlari (TZ: versioning 100% test), TZ-1 DoD checklist yugurtirish, pdf.js integratsiyasi (hozir iframe), router/URL holati (view+folder), graf uchun podrazdeleniye rang rejimi.
- **M11 — TZ-3 Monitoring**: scraper (lex.uz/cbu.uz, cron 2 soat) → external_acts + /monitoring real sahifa → xabarnomalar (in-app/Telegram/email) → embedding (multilingual-e5, LLM'siz) → semantik solishtirish/qidiruv → LLM toggle (default OFF). O'z ichida 3–4 kichik bosqich.
- **M12 — TZ-4 SaaS**: ochiq /register + trial, tariflar/limitlar, 2FA, ClamAV, API tokenlar, eksport/import/backup, CI/CD + monitoring infra.

**Mayda qoldiqlar (istalgan payt):** ⌘K'da klaviatura navigatsiyasi (↑↓/↵ hozir faqat hint), bulk uchun server ZIP, kalendarda 100+ hujjat sahifalash.

## 3. Ishga tushirish

```bash
docker compose up -d                                       # postgres(5433)/minio/redis/mailpit
pnpm install && pnpm db:generate
pnpm db:deploy && pnpm db:seed                             # birinchi marta yoki baza yangilanganda
pnpm exec turbo run dev --filter=@docmax/api --filter=@docmax/worker   # backend (bitta terminal)
pnpm --filter @docmax/web dev                              # web :3000 (yoki Claude Preview "web")
```

| Rol | Email | Parol |
|---|---|---|
| ADMIN | `admin@docmax.local` | `Admin2026` |
| EDITOR | `editor@demo.docmax.local` | `Password123!` |
| VIEWER | `viewer@demo.docmax.local` | `Password123!` |

Web `:3000` · API `:3001/api/v1` · MinIO konsol `:9001` (docmax/docmax-secret) · Mailpit `:8025`.
**Worker ishlamasa fayllar indekslanmaydi** (status PENDING'da qoladi). `.claude/launch.json`da "web" (port 3000, autoPort:false — CORS/WEB_ORIGIN shu portga bog'liq) bor; worker portsiz — oddiy background Bash bilan.

## 4. Muhim texnik eslatmalar (takrorlamaslik uchun)

- **`prisma migrate dev` interaktiv so'raydi** (pgvector HNSW indeksi drift deb ko'rinadi) — onboarding/CI uchun **doim `pnpm db:deploy`**. Yangi migratsiya yaratilganda migration.sql'dan spurious `DROP INDEX "embeddings_vector_hnsw_idx";` qatorini qo'lda o'chirish SHART.
- **`prisma migrate reset` Claude'dan bloklanadi** — foydalanuvchi aniq roziligidan keyin `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<rozilik matni>"` env bilan ishlaydi.
- **`@docmax/shared`ga yangi RUNTIME export qo'shilsa** — Vite `optimizeDeps.include: ['@docmax/shared']` allaqachon joyida (oq ekran bug'i tuzatilgan); lekin **api/worker uchun `pnpm --filter @docmax/shared build` + nest'ni qayta ishga tushirish kerak** (turbo filter rejimida shared watcher ishlamaydi, nest node_modules o'zgarishini ko'rmaydi).
- **Windows: api/worker ishlab turganda `db:generate`/`db build` EPERM beradi** (query engine DLL band) — avval jarayonlarni to'xtatish.
- **pdf-parse@1.1.1'da qat'iy qoling** (2.x butunlay boshqa API). Test PDF: `node_modules/.pnpm/pdf-parse@1.1.1/.../test/data/04-valid.pdf` (qo'lda yasalgan minimal PDF'lar "bad XRef entry" beradi).
- **`docker exec ... psql` heredoc'iga `-i` flag shart**, aks holda jim chiqadi.
- **Bash'da dotenv**: `pnpm exec dotenv -e ../../.env -- ...` (global dotenv binary xato beradi).
- **Yangi worktree'da**: `pnpm install` + `pnpm db:generate` + `.env`ni `.env.example`dan nusxalash — uchchalasi ham kerak.
- **CDP orqali CSS `:hover` sinab bo'lmaydi** — hover-reveal UI'lar React state bilan qilinadi (FolderTreeNode va FileChip shu naqshda), sinovda `mouseover` dispatch ishlaydi.
- Preview serverlar uzoq sessiyada o'z-o'zidan to'xtab qolishi mumkin — `preview_start` bilan qayta ko'tarish kifoya.

## 5. Fayl xaritasi (qisqa)

```
apps/web/src/app/App.tsx      ← BARCHA UI (~2700 qator): view-switching, Vault, DocDetail, wizard, FileChip, FolderTreeNode
apps/web/src/app/Login.tsx    ← Login ekrani;  AdminPanel.tsx ← Admin Panel (brend + hujjat turlari)
apps/web/src/lib/api.ts       ← authApi, foldersApi, filesApi(+downloadUrl), documentsApi, documentTypesApi, organizationsApi, relationsApi
apps/web/src/i18n/            ← uz(asosiy)/ru/en lug'atlar
apps/api/src/{auth,folders,files,documents,document-types,document-relations,organizations,storage,queue,audit,common,prisma,mailer}/
apps/worker/src/{file-index,queue,prisma,storage}/
packages/db/prisma/           ← schema + 5 migratsiya + seed (document_types bilan mos)
packages/shared/src/          ← barcha zod sxemalar/DTO (front+back bitta manba)
```
