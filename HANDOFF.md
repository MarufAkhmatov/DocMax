# DocMax — Handoff

*Oxirgi yangilanish: 2026-07-24 (Docker deploy — api+worker+web konteynerlashtirildi, to'liq stack ishga tushirilib brauzerda tasdiqlandi) · kanonik branch: **`claude/handoff-ni-oqi-va-m9-e0ad4d`** (= `claude/handoff-update-f121b2`ning barcha commit'lari, ff-merge orqali + M9 + M10 qisman + Docker)*

Bu fayl har sessiya boshida o'qilishi SHART. Loyihaning joriy holati, nima qilingani va keyingi qadamlar shu yerda.

---

## 0. MUHIM — branch tarixi va kanonik holat

**2026-07-16/17 sessiyasida jiddiy chalkashlik topilib tuzatildi:** `main` (2d36d06) juda orqada qolgan, eng so'nggi ish `claude/vibrant-davinci-9d583f`da edi, lekin yangi sessiya `main` asosidagi eski handoff bilan boshlangan va milestone 5'ni PARALLEL qayta qurgan. Bu parallel ish `backup/hand-off-milestone5-parallel` branch'ida saqlanadi (ishlatilmaydi, faqat tarix).

**2026-07-18 sessiyasida XUDDI SHU turdagi chalkashlik YANA yuz berdi** (ikkinchi marta!): bitta bazadan (`bb7a6b8`) ikkita parallel sessiya alohida ishladi — biri (`claude/hand-off-task-c339c9`) faqat kichik i18n tuzatish qildi, ikkinchisi (`claude/handoff-update-f121b2`) shu ustiga to'liq M7+M8'ni qurdi. Bu sessiya `claude/handoff-ni-oqi-va-m9-e0ad4d` branch'ida boshlangan edi (yana `bb7a6b8`dan, xabarsiz) — ff-merge bilan `handoff-update-f121b2`ning ishi qabul qilindi, keyin M9 shu ustiga qurildi. **Xulosa: har sessiya boshida `git log --oneline --graph --all` bilan barcha branch'larni solishtirib, eng oldinda turganini tanlash SHART** — faqat HANDOFF.md'dagi yozuvga ishonmaslik kerak (u eski bo'lishi mumkin).

**Hozirgi kanonik holat**: `claude/handoff-ni-oqi-va-m9-e0ad4d` = `handoff-update-f121b2`ning barcha commit'lari (M7+M8 shu ichida) + shu sessiyaning M9 commit'i. **Keyingi sessiya SHU branch'dan davom etsin.** `claude/hand-off-task-c339c9` va `claude/handoff-update-f121b2` endi orqada qolgan, kerak emas (bu branch ikkalasini ham qamrab oladi — birinchisining kichik i18n tuzatishi bu branch'da yo'q, lekin keyinroq to'liqroq versiya bilan qoplangan).

**DB drift ogohlantirishi**: dev Postgres bitta (docker `docmax-postgres`, port 5433) — turli worktree'lar turli migratsiya to'plamlari bilan almashib ishlasa drift bo'ladi. Hozir bazaga 10 migratsiya (M9'dagi `acl_enabled`/`org_structure_snapshots`/`permission_subject_id_text` bilan) qo'llangan — shu branch bilan mos. **Boshqa worktree'ning API dev serveri (masalan eski `handoff-update-f121b2`) shu bazaga ulangan holda uzoq vaqt ishlab tursa, port 3001'ni band qilib qo'yishi mumkin** — shunday holatda vaqtincha boshqa port (`.env`dagi `API_PORT` + `.claude/launch.json`dagi `api.port` + `apps/web/.env.local`dagi `VITE_API_URL`) bilan ishlab, ishni tugatgach 3001'ga qaytaring (canonik qiymat).

---

## 1. Umumiy holat

| Qatlam | Holat |
|---|---|
| **Backend (apps/api)** | Auth (m3, CONTRIBUTOR bilan) + Papkalar (m4) + Hujjatlar/Fayllar (m5) + Admin Panel (dinamik hujjat turlari) + Bog'lanishlar+Graf+Workflow (TZ-2 §2.1/§2.2/§2.3) + Kompaniya logotipi + Notifications/Trash/Audit-logs/Stats (M7) + **Org-units + struktura snapshot + remapping wizard + folder ACL (M9, TZ-2 §2.4/§2.5)** + security hardening + `GET /files/:id/download` (VIEW/DOWNLOAD audit) |
| **DB (packages/db)** | 10 migratsiya (oxirgisi `permission_subject_id_text`), tenant-izolyatsiya extension (endi `OrgStructureSnapshot` ham), seed yangi sxemaga moslangan (6 default tur + 10 demo hujjat) |
| **Worker (apps/worker)** | `file.index` real (pdf-parse@1.1.1/mammoth, 3x retry→FAILED). `diff.generate` real (M6) + TEMPLATE_READY bildirishnoma (M7) |
| **Frontend (apps/web)** | React+Vite (router YO'Q — App.tsx view-switching). Login, Dashboard (real statistika+faollik+bildirishnoma), Vault (papka grid + daraxt sidebar, hover-CRUD, **ACL "Kirishni cheklash" modali + qulf ikonkasi**), Hujjatlar jadvali (PDF/DOCX fayl-chip'lar), 3-qadamli wizard, DocDetail (PDF iframe, Word mammoth, tahrirlash, holat o'zgartirish, bog'lanishlar, real audit, **yuklab-olish-taqiq rejimi + watermark**), real Graf/Workflow, **`/structure` — org-unit daraxti + remapping wizard + snapshot viewer (M9)**, Admin Panel (turlar+logo+Trash+Audit log+Teglar), i18n (uz/ru/en, to'liq — barcha 327 kalit uch tilda mos). Monitoring hali mock |

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

## 1.5. Shu sessiyada qilinganlar (2026-07-18) — M9: Struktura + ACL (TZ-2 §2.4 + §2.5)

**Schema** (`packages/db/prisma/schema.prisma`, 3 migratsiya): `Folder.aclEnabled` (ACL chegarasi belgisi), `OrgStructureSnapshot` (org-unit daraxti + papka-mapping snapshot, jsonb, faqat o'qish), `Permission.subjectId` **uuid'dan text'ga o'zgartirildi** (ROLE turi uchun qiymat "EDITOR" kabi Role enum, uuid emas — bu birinchi marta shu jadval real ishlatilganda topilgan sxema xatosi edi) + `Permission`ga `@@unique([folderId, subjectType, subjectId])`.

Backend:
- **`apps/api/src/org-units/*`** — `GET tree`, CRUD, `POST :id/move` (DFS sikl tekshiruvi — `OrgUnit`da ltree yo'q, app-darajasida ajdodlar bo'ylab yurish), `POST :id/close` (`moveFoldersToArchive` bayrog'i bilan — "Arxiv strukturalar" tizim papkasi birinchi yopishda lazy yaratiladi, `FoldersService.move()` qayta ishlatiladi), `POST :id/reopen`, `GET :id/remap-preview` (mutatsiyasiz — eng yaqin "mapped" ajdod-unit'ni topib yangi joy taklif qiladi), `POST :id/remap-apply` (bir nechta papka ko'chirishini **BITTA tranzaksiyada** — `FoldersService.move()`dan yangi `buildMoveStatements()` metodi ajratib olindi, chaqiruvchi statement'larni yig'ib bitta `$transaction`ga beradi). Snapshot har mutatsiyadan KEYIN yoziladi (audit kabi best-effort, mutatsiya bilan bitta tranzaksiyada emas).
- **`apps/api/src/folders/folder-access.service.ts`** — markazlashtirilgan ACL tekshiruvi (`TenantPrismaService`dagi kabi request-scoped lazy naqsh): org ichidagi `aclEnabled=true` chegaralarni bir marta yuklaydi (ACL hech qayerda yoqilmagan bo'lsa — bugungi standart holat — 0 qo'shimcha so'rov), har candidate uchun eng yaqin chegarani ltree path prefiksi orqali JS'da topadi, subject (ROLE/USER/ORG_UNIT) + `inherit` mantig'ini qo'llaydi. ADMIN/SUPER_ADMIN bypass. `canView=false`→404, `canEdit`/`canDownload=false`→403.
  - **Muhim: 1000 papkali tree perf testi buzilib, tuzatildi** — dastlabki versiya har node uchun alohida `pathOf()` so'rovi qilardi (N+1); `nearestBoundariesBatch()` bilan bitta `= ANY(...)` so'rovga birlashtirildi (`visibleFolderIds`/`lockedFolderIds`/`deniedFolderIds` barchasi shu orqali).
  - Ulangan joylar: `FoldersController.getTree` (ko'rinmas papkalar butunlay chiqarib tashlanadi + `locked` maydoni), `DocumentsService` (list/getById/create/createVersion/update/remove/bulk/comparison-template), `GraphService.build`, `FilesService.downloadUrl` (`inline`→canView, `attachment`→canDownload, aks holda 403).
  - Yangi: `GET/PUT /folders/:id/permissions` (ADMIN, `PERMISSION_CHANGE` audit — enum birinchi marta ishlatildi), `GET /folders/:id/access` (istalgan user, joriy effektiv huquqlar — frontend watermark/qulf uchun).
- **`GET /auth/users`** (ADMIN) — org-unit rahbar tanlash va ACL USER-subject tanlash uchun yengil userlar ro'yxati (avval bunday endpoint yo'q edi).

Frontend:
- **`apps/web/src/app/StructureView.tsx`** (yangi) — org-unit daraxti (`FolderTreeNode`dagi hover-reveal naqshi bilan bir xil — React state, CSS `:hover` emas), native HTML5 drag&drop bilan reparent, rahbar tanlash (select), bog'langan papkalar ko'rinishi, remapping wizard modali (preview→checkbox bilan tanlab apply), struktura snapshot ko'rinishi (sana bo'yicha, faqat o'qish). App.tsx'ga ulandi: `View` ittifoqiga `"struct"` qo'shildi, rail'dagi **ilgari ishlatilmagan `GitBranch` ikonka slot'i** (`id`siz edi) shu maqsadga ishlatildi, ViewBar+breadcrumb yangilandi.
- Papka ACL: `FolderTreeNode`ga yangi `Settings` hover-amali → `FolderAclModal` (yangi, App.tsx ichida) — toggle + subject qo'shish (rol/user/bo'linma) + 3 checkbox + inherit. `FolderNode.locked`/`aclEnabled` real backend'dan — `FolderCard`/`FolderTreeNode`dagi eski hardcoded `locked: false` olib tashlandi, haqiqiy qulf ikonkasi ko'rinadi.
- DocDetail: `GET /folders/:id/access` orqali joriy hujjat papkasining huquqlari olinadi; `canDownload=false` bo'lsa — Yuklab olish tugmasi yashiriladi, PDF iframe/Word HTML ustiga takrorlanuvchi email watermark (`WatermarkOverlay`, yangi) chiziladi.

**Testlar**: `apps/api/src/folders/folder-permissions.e2e.test.ts` (9 ta — ADMIN bypass, ROLE/USER/ORG_UNIT subject, inherit/override, PERMISSION_CHANGE audit, ACL yo'q holat), `apps/api/src/org-units/org-units.e2e.test.ts` (5 ta — sikl bloklash, snapshot yozilishi, close+archive+hujjat-ID saqlanishi, remap-preview mutatsiyasiz, remap-apply bitta tranzaksiyada+rollback). Jami 29/29 test yashil (mavjud folders/auth e2e'lar bilan birga, regressiyasiz).

**Brauzerda sinaldi** (Chrome preview + curl, chunki `computer` screenshot bu sessiyada doim timeout berdi — `read_page`/`get_page_text`/`javascript_tool`/tarmoq so'rovlari orqali tekshirildi): org-unit yaratish/rahbar tayinlash, ACL yoqish+subject qo'shish+saqlash (haqiqiy `PUT /folders/:id/permissions` 200), keyin uch turli rol (ADMIN/VIEWER-grantli/EDITOR-grantsiz) bilan `folders/tree`+`documents`ni solishtirib ruxsat mantig'i tasdiqlandi, remap wizard ochilishi, DocDetail'da yuklab olish tugmasi ACL yo'q papkada normal ko'rinishi.

**Eslatma keyingi sessiyaga**: `computer` action `key: "Return"` inputlarda ba'zan yetib bormaydi (Enter bosilgan hodisa React'ga tarqalmaydi) — `javascript_tool` bilan `dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}))` ishonchli muqobil. `computer` action `screenshot` bu sessiyada barqaror timeout berdi — vizual tekshiruv kerak bo'lsa avval qisqa `zoom` bilan sinab ko'ring yoki matn-asosidagi tekshiruvga tayaning.

## 1.6. Shu sessiyada qilinganlar (2026-07-24) — M10 qisman: vite build tuzatildi + pdf.js

M10 ("Sifat/texnik qarz") 7 ta mustaqil bandga bo'lingan edi; foydalanuvchi shulardan ikkitasini tanladi — **`vite build` tuzatish** va **pdf.js integratsiyasi**. Qolgan 5 band (pastda) hali tegilmagan.

**1) `vite build` production'da singan edi — tuzatildi.** Ildiz sabab avvalgi sessiyalarda o'ylanganidan kengroq ekan: yolg'iz `RELATION_TYPES` emas — `packages/shared`ning BUTUN CJS chiqishi (`export * from './x'` orqali `__exportStar` bilan) Rollup uchun statik ko'rinmaydi, shuning uchun QAYSI nomlangan export birinchi ishlatilsa o'shanda xato beradi (`AUDIT_ACTIONS`, keyin `RELATION_TYPES`, va h.k. — istalgan kelgusi export ham xuddi shunday sinadi). Yechim: `packages/shared` endi **ikkita chiqish** beradi —
  - `tsconfig.build.json` → `dist/` (CJS, `module:"commonjs"` — apps/api/worker `require()` bilan ishlatadi, o'zgarmagan)
  - **yangi** `tsconfig.esm.json` → `dist/esm/` (haqiqiy ESM, `module:"ES2022"`, `moduleResolution:"bundler"`) — Rollup/Vite buni statik tahlil qila oladi
  - `package.json`: `"module"` maydoni + `"exports"."."`ga `"import"`/`"require"` shartlari qo'shildi (avval faqat `"default"` bor edi — ikkalasi ham bitta CJS faylga ishora qilardi, shu Rollup'ni chalkashtirgan asosiy sabab).
  - `pnpm --filter @docmax/web build` endi **muvaffaqiyatli** (tekshirildi: `vite preview` bilan ishga tushirib, login sahifasi konsolda xatosiz yuklandi).
  - apps/api/apps/worker `nest build` ham sinaldi — CJS chiqish o'zgarmagani uchun regressiyasiz.

**2) pdf.js integratsiyasi** — yangi `apps/web/src/app/PdfViewer.tsx`: sahifama-sahifa navigatsiya (◀/▶ + N/M ko'rsatkich) + zoom (60%–240%), `pdfjs-dist@4` bilan. DocDetail'dagi eski oddiy `<iframe>` shu component bilan almashtirildi (watermark `overlay` prop orqali saqlanadi — TZ-2 §2.5 bilan bir xil ishlaydi).
  - **MUHIM topilma**: MinIO presigned URL'lar CORS'ni **avtomatik** qo'llab-quvvatlaydi (so'rovchi Origin'ni qaytarib beradi) — pdf.js'ning `fetch`/Range so'rovlari uchun qo'shimcha CORS sozlash SHART emas edi (dev muhitida tasdiqlangan; productionda boshqa S3-mos backend ishlatilsa buni qayta tekshirish kerak).
  - **MUHIM xavfsizlik to'ri qo'shildi**: shu sessiyaning avtomatlashtirilgan brauzer muhitida `page.render()` **hech qachon tugamasligi** kuzatildi (hujjat yuklash/sahifa metadata/oddiy Canvas2D chizish — bularning barchasi ishladi, faqat pdf.js'ning ichki render pipeline'i osilib qoldi; hatto qo'lda yasalgan minimal "Hello PDF" bilan ham, ham worker bilan, ham `disableWorker:true` bilan — demak PDF mazmuniga bog'liq emas, balki shu avtomatlashtirilgan brauzer nusxasining pdf.js render bosqichi bilan moslashmasligi ehtimoli katta). Sababi noaniq qolgani uchun **`PdfViewer` endi 8 soniyalik render-timeout'ga ega**: agar `page.render()` shu muddatda tugallanmasa, komponent avtomatik ravishda brauzerning o'z native PDF ko'rinishiga (oddiy `<iframe>`, eski yagona yondashuv) tushadi — foydalanuvchi hech qachon cheksiz spinner ko'rmaydi. Bu fallback shu sessiyada haqiqatan ishga tushib, to'g'ri ishlashi tasdiqlandi.
  - Haqiqiy Chrome/Firefox'da (bu avtomatlashtirilgan muhitdan tashqarida) pdf.js render qanday ishlashini **keyingi sessiya odatiy brauzerda qo'lda tekshirishi tavsiya etiladi** — agar u yerda ham osilsa, muammo koddan emas (standart pdf.js API namunasiga mos yozilgan), balki boshqa sabab (masalan pdfjs-dist versiyasi/GPU) qidirilishi kerak.

**Qolgan M10 bandlar (hali tegilmagan, foydalanuvchi tanlamagan)**: apps/web eslint+vitest (hozir stub), versioning e2e testlari (TZ-0 §6: auth/permissions/versioning 100% test talabi — auth+permissions bor, versioning yo'q), documents/files/graph uchun kengroq e2e qamrov, router/URL holati (view+folder+hujjat URL'da aks etmaydi — faqat hujjat filtrlari URL'da saqlanadi), graf uchun podrazdeleniye rang rejimi (status/tur rejimi bor, uchinchi rejim kerak), `seed.ts` — hech bir hujjatga versiya yaratmaydi (TZ-1 DoD: "1 hujjatga 3 versiya" ssenariysi hali seed orqali avtomatik emas).

## 1.7. Shu sessiyada qilinganlar (2026-07-24) — Docker deploy (api+worker+web)

Foydalanuvchi so'rovi: loyiha git repo/lokal/docker uchtasida ham sinxron yurishi kerak, "docker'ga o'tkazgandan keyin qaysi milestone ishlamay qoldi — tekshir va tuzat". Tekshiruv natijasi: repoda **hech qanday app-darajasidagi Dockerfile yo'q edi** (faqat infra uchun `docker-compose.yml`: postgres/minio/redis/mailpit) — demak "docker'ga o'tkazish" hali umuman qilinmagan edi. AskUserQuestion orqali aniqlashtirilib, foydalanuvchi **"Dockerfile'larni hozir yarat"** variantini tanladi — shu sessiyada noldan qurildi.

**Yaratilgan fayllar:**
- `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile` (+ `apps/web/nginx.conf`) — barchasi `node:22-alpine` (pnpm@11.11.0 Node ≥22.13 talab qiladi — `node:20-alpine` bilan sinab ko'rilganda `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` xatosi berdi). Multi-stage: `base`(pnpm o'rnatish) → `build`(`pnpm install --frozen-lockfile` + tegishli filter'lar bilan build) → `runtime`. `api`ning CMD'i konteyner ichida `prisma migrate deploy` qilib keyin serverni ishga tushiradi (avtomatik migratsiya). `web` — Vite build'ni `nginx:alpine`ga ko'chiradi.
- `.dockerignore` (repo ildizida) — `node_modules`/`.git`/`dist` va h.k.
- `docker-compose.yml` — mavjud 4 infra xizmatidan keyin **`api`/`worker`/`web`** qo'shildi (`depends_on: condition: service_healthy` zanjiri bilan). App xizmatlari ichki tarmoqda bir-biriga **Docker service nomlari** orqali ulanadi (`postgres`/`redis`/`minio`/`mailpit`), `localhost` orqali EMAS.

**Docker'ga o'tkazishda topilgan va tuzatilgan 2 ta HAQIQIY bug** (`pnpm dev` bilan lokal ishlaganda hech qachon ko'rinmagan, faqat konteynerlashtirilgan tarmoq orqali chiqadi):

1. **Presigned URL — brauzer "minio" xost nomini yecha olmaydi.** `StorageService` presigned URL'larni `S3_ENDPOINT` (`http://minio:9000`, konteyner-ichi DNS nomi) bilan generatsiya qilardi — API ichida ishlaydi, lekin brauzerga qaytarilgan URL sifatida butunlay yaroqsiz. Tuzatish: `apps/api/src/storage/storage.service.ts`ga ikkinchi `publicClient` qo'shildi (faqat imzolash uchun, tarmoq so'rovi qilmaydi) — yangi `S3_PUBLIC_ENDPOINT` env orqali (`docker-compose.yml`da `api` xizmatiga `${S3_PUBLIC_ENDPOINT:-http://localhost:9000}` beriladi). `getPresignedUploadUrl`/`getPresignedDownloadUrl` endi shu client bilan imzolaydi. Lokal (docker'siz) devda `S3_PUBLIC_ENDPOINT` berilmasa `S3_ENDPOINT` bilan bir xil bo'lib qoladi — orqaga mos.
2. **nginx `.mjs` uchun noto'g'ri Content-Type.** nginx standart `mime.types`ida `.mjs` yo'q → `application/octet-stream` bo'lib beriladi → pdf.js'ning `new Worker(url, {type:"module"})` (M10'da qo'shilgan) buni rad etadi ("Setting up fake worker" ogohlantirishi bilan sekin/soxta ishlash rejimiga tushadi). Tuzatish: `apps/web/nginx.conf`ga **faqat shu kengaytmaga cheklangan** `location ~* \.mjs$ { default_type application/javascript; }` bloki (butun `types{}` jadvalini almashtiradigan variant ATAYLAB ishlatilmadi — aks holda css/js/font'lar sitewide buzilardi).

**pdf.js — qo'shimcha topilma (Docker orqali chiqqan, lekin Docker'ga xos emas):** MIME tuzatilgandan keyin ham `pdfjsLib.getDocument(url).promise` konteynerlashtirilgan/production build muhitida rad etilgan holat kuzatildi (M10'da avval topilgan `page.render()` osilib qolish muammosidan FARQLI — bu holatda hujjat yuklashning o'zi muvaffaqiyatsiz tugaydi). Ikkalasi ham "avtomatlashtirilgan/notinch muhitga xos pdf.js muammosi" degan gipotezani mustahkamlaydi. Himoya choralari kuchaytirildi: `apps/web/src/app/PdfViewer.tsx`dagi `.catch()` endi xato xabari ko'rsatish o'rniga to'g'ridan-to'g'ri `fallback`(native `<iframe>`) holatiga o'tadi — 8 soniyalik render-timeout fallback bilan bir xil falsafa, foydalanuvchi hech qachon o'lik-oxirli xato ko'rmaydi.
  - **Brauzerda to'liq tasdiqlandi** (`docmax-web` konteyneri, real production build orqali `http://localhost:3000`): hujjatga kirilganda PDF **to'g'ri presigned MinIO URL** (`http://localhost:9000/...`, imzoli) bilan `<iframe>` fallback'ga tushib toza render qildi — konsolda xato yo'q, tarmoq so'rovi 200 OK.

**Ishga tushirish** (yangi, infra+app hammasi bitta buyruqda):
```bash
docker compose -p docmax up -d --build
```
**MUHIM — har doim `-p docmax` bilan ishlatilsin.** Compose loyiha nomi standart holda joriy papka nomidan olinadi (masalan worktree papkasi `vibrant-davinci-9d583f` bo'lsa, konteyner nomlari `docmax-postgres` kabi qattiq yozilgan bo'lsa ham, compose loyiha darajasida boshqa nom bilan yangi (bo'sh) resurslar yaratishga urinadi va mavjud `docmax-*` konteynerlar bilan nom to'qnashuvi beradi: "Conflict: container name already in use"). `-p docmax` doim mavjud named volume'lar (`docmax_postgres-data` va h.k.)ni qayta ishlatishini ta'minlaydi — **ma'lumot yo'qolmaydi**, tasdiqlangan (rebuild oldidan/keyin DB ichidagi qatorlar soni solishtirildi).

Web `:3000` (nginx, production build) · API `:3001` · Postgres `:5433` · MinIO `:9000`/`:9001` · Mailpit `:8025` — barchasi bitta `docmax` tarmog'ida.

**Docker vs `pnpm dev` — ikkalasi ham qo'llab-quvvatlanadi:** kundalik ishlab chiqish uchun hamon `pnpm dev` (HANDOFF §3) tavsiya etiladi (tezroq HMR). Docker — production-o'xshash tekshiruv/deploy uchun. **Ikkalasini bir vaqtda 3000-portda ishlatmang** — agar `pnpm --filter @docmax/web dev` ALLAQACHON 3000-portda ishlab tursa-yu, Docker `web` konteyneri ham shu portga bog'lansa, Windows/Docker Desktop (WSL2) ikkalasini alohida IP oilasida (IPv4 `0.0.0.0` docker uchun, IPv6 `[::1]` lokal dev uchun) qabul qilib ketishi mumkin — `http://localhost:3000` qaysi biriga borishi DNS/browser xatti-harakatiga bog'liq bo'lib qoladi, tekshirish paytida adashtirib yuboradi (shu sessiyada aynan shu holat yuz berdi: brauzer eski Vite dev-server ulanishini ko'rsatib turdi, Docker build tekshirilyapti deb o'ylangan). Ikkalovidan qaysi biriga ulanayotganingizni aniqlash uchun: `document.scripts[0].src` — agar `/assets/index-XXXX.js` bo'lsa Docker (build), agar `/src/...` yoki `@vite/client` ko'rinsa — lokal dev server.

## 2. Yo'l xaritasi (2026-07-17 auditi asosida)

**Bajarilgan:** TZ-1 to'liq (m1–m6) · TZ-2 to'liq: §2.1 Relations, §2.2 Workflow canvas, §2.3 Graf, §2.4 Struktura (M9), §2.5 Papka ACL (M9), §2.6 ⌘K nom/raqam qidiruv, §2.7 Boshqaruv yakuni · bulk amallar · kalendar · kartochka/timeline · Admin Panel (turlar+logo+teglar) · i18n (to'liq) · security hardening · **`vite build` production tuzatildi + pdf.js (M10 qisman)** · **Docker deploy (api+worker+web, §1.7)**.

**Keyingi milestonelar (tavsiya tartibi):**

- **M10 qoldig'i — Sifat/texnik qarz (TZ-0 §6 talabi)**: apps/web eslint+vitest (hozir stub), versioning e2e testlari (TZ-0 §6 aniq talabi), documents/files/graph uchun kengroq e2e, TZ-1 DoD checklist yugurtirish (`seed.ts`ga versiya fixture'lari kerak), router/URL holati (view+folder), graf uchun podrazdeleniye rang rejimi.
- **M11 — TZ-3 Monitoring**: scraper (lex.uz/cbu.uz, cron 2 soat) → external_acts + /monitoring real sahifa → xabarnomalar (in-app/Telegram/email) → embedding (multilingual-e5, LLM'siz) → semantik solishtirish/qidiruv → LLM toggle (default OFF). O'z ichida 3–4 kichik bosqich.
- **M12 — TZ-4 SaaS**: ochiq /register + trial, tariflar/limitlar, 2FA, ClamAV, API tokenlar, eksport/import/backup, CI/CD + monitoring infra.

**Mayda qoldiqlar (istalgan payt):** ⌘K'da klaviatura navigatsiyasi (↑↓/↵ hozir faqat hint), bulk uchun server ZIP, kalendarda 100+ hujjat sahifalash, ACL — bir nechta papka bitta org-unit'ga mapping bo'lganda remap-preview faqat "birinchi yaratilgan" papkani vakil sifatida oladi (kam uchraydigan holat, kodda izohlangan).

## 3. Ishga tushirish

**A) Lokal dev (tavsiya, kundalik ish uchun — tezroq HMR):**
```bash
docker compose -p docmax up -d postgres minio redis mailpit   # faqat infra
pnpm install && pnpm db:generate
pnpm db:deploy && pnpm db:seed                             # birinchi marta yoki baza yangilanganda
pnpm exec turbo run dev --filter=@docmax/api --filter=@docmax/worker   # backend (bitta terminal)
pnpm --filter @docmax/web dev                              # web :3000 (yoki Claude Preview "web")
```

**B) To'liq Docker (production-o'xshash, §1.7):**
```bash
docker compose -p docmax up -d --build   # infra + api + worker + web, hammasi konteynerda
```
Ikkalasini bir vaqtda 3000-portda ishlatmang (§1.7 oxiridagi eslatmaga qarang).

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
- **Bash'da dotenv**: `pnpm exec dotenv -e ../../.env -- ...` (global dotenv binary xato beradi) — **lekin faqat skript o'zi dotenv talab qilsa** (masalan `db:seed`/`db:migrate`). `apps/api`/`apps/worker`ning `dev` skripti (`nest start --watch`) `.env`ni **o'zi** `ConfigModule.forRoot({envFilePath:[...]})` orqali yuklaydi — bularni `pnpm exec dotenv -e ...` bilan o'rab qo'yish shart EMAS va aksincha global `dotenv` (Python paketi, boshqa CLI) bilan to'qnashib xato berishi mumkin (`Invalid value for '-e'/'--export'`). Xato ko'rinsa — avval skript o'zi dotenv kerak qiladimi tekshiring.
- **Yangi worktree'da**: `pnpm install` + `pnpm db:generate` + `.env`ni `.env.example`dan nusxalash — uchchalasi ham kerak.
- **CDP orqali CSS `:hover` sinab bo'lmaydi** — hover-reveal UI'lar React state bilan qilinadi (FolderTreeNode va FileChip shu naqshda), sinovda `mouseover` dispatch ishlaydi.
- **`computer` action `key:"Return"` React controlled input'larda ba'zan yetib bormaydi** (M9 sessiyasida topildi) — `javascript_tool` bilan qo'lda `input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}))` ishonchli muqobil. `computer` action `screenshot` ham shu sessiyada barqaror timeout berdi — `read_page`/`get_page_text`/tarmoq so'rovlari orqali tekshiring, screenshot shart bo'lmasa ishlatmang.
- **Prisma tenant-client extension `createMany`/`create`da ham `orgId`ni qo'lda talab qiladi** (runtime'da extension qayta yozadi, lekin Prisma generatsiya qilingan tipi buni bilmaydi) — naqsh: `NotificationsService.notifyUsers`/`FolderPermissionsService.set` kabi joylarga qarang.
- **Yangi Prisma modelida polimorfik `subjectId`/`entityId` kabi maydon bo'lsa — DIQQAT: `@db.Uuid` cheklovini oldindan tekshiring** (M9'da `Permission.subjectId` ROLE uchun "EDITOR" kabi enum qiymat saqlashi kerak edi, lekin `@db.Uuid` edi — jadval bo'sh bo'lgani uchun oson tuzatildi, lekin productionda data bo'lsa qiyin bo'lardi).
- Preview serverlar uzoq sessiyada o'z-o'zidan to'xtab qolishi mumkin — `preview_start` bilan qayta ko'tarish kifoya.
- **`docker compose` har doim `-p docmax` bilan ishlatilsin** (worktree papka nomidan avtomatik olinadigan standart loyiha nomi bilan EMAS) — aks holda mavjud `docmax-postgres` va h.k. konteynerlar bilan nom to'qnashuvi ("Conflict: container name already in use"). Tafsilot §1.7da.
- **`localhost:3000`ga bir vaqtda ham Docker `web` konteyneri, ham `pnpm --filter @docmax/web dev` ulanmasin** — ikkalasi ham shu portni turli IP oilalarida (IPv4/IPv6) egallab, brauzer qaysi biriga ulanayotgani noaniq bo'lib qoladi (§1.7 oxiri). Qaysi biriga ulanganini `document.scripts[0].src` bilan tekshiring: `/assets/index-*.js` = Docker build, `/src/...` yoki `@vite/client` = lokal dev.

## 5. Fayl xaritasi (qisqa)

```
apps/web/src/app/App.tsx      ← BARCHA asosiy UI (~3000+ qator): view-switching, Vault, DocDetail, wizard,
                                 FileChip, FolderTreeNode, FolderAclModal, WatermarkOverlay
apps/web/src/app/StructureView.tsx ← M9: org-unit daraxti, remapping wizard, snapshot viewer
apps/web/src/app/Login.tsx    ← Login ekrani;  AdminPanel.tsx ← Admin Panel (brend + hujjat turlari + teglar + trash + audit)
apps/web/src/lib/api.ts       ← authApi(+listUsers), foldersApi(+access), permissionsApi, orgUnitsApi, filesApi, documentsApi, ...
apps/web/src/i18n/            ← uz(asosiy)/ru/en lug'atlar — 327 kalit, uchchalasida bir xil
apps/api/src/{auth,folders(+folder-access,folder-permissions),files,documents,document-types,document-relations,
  organizations,org-units,storage,queue,audit,common,prisma,mailer}/
apps/worker/src/{file-index,queue,prisma,storage}/
packages/db/prisma/           ← schema + 10 migratsiya + seed (document_types bilan mos)
packages/shared/src/          ← barcha zod sxemalar/DTO (front+back bitta manba) — org-units.ts, permissions.ts (M9)
apps/{api,worker,web}/Dockerfile, apps/web/nginx.conf, docker-compose.yml, .dockerignore  ← Docker deploy (§1.7)
```
