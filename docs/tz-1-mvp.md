# TZ-1. BOSQICH 1 — MVP
*Muddat bahosi: 4–6 hafta · Bog'liq: TZ-0*

**Maqsad:** auth, papkalar, hujjatlar, versiyalash va avtomatik taqqoslama shabloni bilan ishlaydigan yadro.

---

## 1.1. Autentifikatsiya va foydalanuvchilar

**Funksiyalar:**
- Ro'yxatdan o'tish faqat taklif (invite) orqali: Admin email kiritadi → token'li havola (72 soat) → user parol o'rnatadi.
- Birinchi org yaratish: alohida `/setup` oqimi (org nomi + Super Admin akkaunt) — faqat bo'sh bazada.
- Login (email+parol), logout, refresh rotation, parolni tiklash (email orqali, mailpit lokalda).
- Profil: ism, avatar, til, theme o'zgartirish.

**Rollar (MVP'da soddalashtirilgan):** ADMIN, EDITOR, VIEWER. (CONTRIBUTOR va SUPER_ADMIN Bosqich 2'da faollashadi, enum hozirdan to'liq.)

**Ruxsat matritsasi (MVP, global):**
| Amal | ADMIN | EDITOR | VIEWER |
|---|---|---|---|
| Papka CRUD | ✅ | ❌ | ❌ |
| Hujjat yaratish/tahrirlash/versiya | ✅ | ✅ | ❌ |
| Hujjat ko'rish/yuklab olish | ✅ | ✅ | ✅ |
| User taklif qilish, rol berish | ✅ | ❌ | ❌ |

**Qabul mezonlari:**
- [ ] Muddati o'tgan invite havolasi aniq xato beradi
- [ ] Refresh token o'g'irlanganda rotation reuse-detection sessiyani bekor qiladi
- [ ] VIEWER hech qanday mutatsion endpointga kira olmaydi (e2e test)

## 1.2. Papkalar (ierarxiya)

**Funksiyalar:**
- Tree CRUD: yaratish, nomlash, rang/ikonka/tavsif, o'chirish (faqat bo'sh papka; aks holda xato).
- Drag & drop: boshqa papka ichiga ko'chirish va bir daraja ichida tartiblash (`sort_order`).
- Chap panelda tree: lazy-load (bolalari ochilganda), qidiruv bo'yicha filtrlanish, joriy papka highlight.
- Breadcrumb navigatsiya.

**API:** `GET /folders/tree`, `POST /folders`, `PATCH /folders/:id`, `POST /folders/:id/move {parentId, sortOrder}`, `DELETE /folders/:id`

**Qabul mezonlari:**
- [ ] 5+ daraja chuqurlikda ko'chirish path'larni to'g'ri yangilaydi (ltree test)
- [ ] Papkani o'z avlodi ichiga ko'chirish taqiqlanadi (409)
- [ ] 1000 papkali tree < 500ms yuklanadi

## 1.3. Hujjatlar (CRUD + metadata)

**Yaratish wizard (3 qadam):**
1. **Fayllar:** tasdiqlangan PDF (majburiy) + Word (ixtiyoriy, tavsiya etiladi). Drag&drop upload, progress, hash tekshiruv.
2. **Metadata:** nom, raqam, tur, tasdiqlangan sana, kuchga kirish sanasi, holat, podrazdeleniye, teglar (yaratish inline).
3. **Ko'rib chiqish** → saqlash → hujjat sahifasiga o'tish.

**Hujjat sahifasi:**
- Metadata bloki (inline tahrir — EDITOR+)
- Tablar: **PDF preview** (pdf.js) · **Word preview** (mammoth→HTML) · **Taqqoslama** (agar bor) · **Versiyalar** (timeline)
- Yuklab olish tugmalari (har fayl uchun), holat badge (ACTIVE yashil / EXPIRED kulrang / DRAFT sariq / IN_REVIEW ko'k)
- Holatni o'zgartirish: EXPIRED qilishda sabab so'raladi (`effective_to` + izoh)

**Ro'yxat sahifasi (Vault):**
- Ko'rinishlar: jadval / kartochka grid (toggle, saqlanadi)
- Ustunlar: nom, raqam, tur, holat, tasdiqlangan sana, podrazdeleniye, versiya, muallif
- Filtrlar: yil (approved_at bo'yicha), tur, holat, podrazdeleniye, teg, muallif — kombinatsiyalanadi, URL'da saqlanadi
- Guruhlash: yil / podrazdeleniye / tur bo'yicha (collapse guruhlar)
- Qidiruv: nom + raqam bo'yicha (ILIKE + pg_trgm), debounce 300ms

**Qabul mezonlari:**
- [ ] PDF'siz hujjat yaratib bo'lmaydi
- [ ] Bir xil sha256'li fayl qayta yuklanmaydi (dedup — mavjud file_id qaytadi)
- [ ] Filtr kombinatsiyasi URL orqali ulashiladi va aynan tiklanadi

## 1.4. Versiyalash + avtomatik taqqoslama shabloni

**Oqim:**
1. Hujjat sahifasida **"Yangi versiya"** tugmasi (EDITOR+).
2. Tizim so'raydi: versiya turi — *O'zgartirish (v1.0→v1.1)* yoki *Yangi tahrir (v1→v2)*.
3. **Shablon generatsiyasi:** worker eski versiyaning docx'ini oladi → paragraflarga ajratadi (mammoth; bo'sh paragraflar tashlanadi, jadvallar hujayra matni sifatida) → yangi Word fayl yaratadi:
   - Sarlavha: "TAQQOSLAMA JADVAL", hujjat nomi + raqami, versiyalar, generatsiya sanasi
   - 3 ustunli jadval: **№** · **Eski tahrir** (avtomatik to'liq, kulrang fon, Times New Roman 11) · **Yangi tahrir** (bo'sh)
   - Pastda izoh: bo'sh qator = o'zgarishsiz
   - (Tasdiqlangan namuna: `taqqoslama-jadval-namuna.docx`)
4. User shablonni yuklab oladi → to'ldiradi → yangi versiya wizard'ida: yangi PDF + yangi Word + **to'ldirilgan taqqoslama** yuklaydi.
5. Saqlashda: yangi `document_versions` yozuvi, `is_current` almashadi, eski versiya arxivda.
6. Agar eski versiyada docx bo'lmasa: shablon PDF matnidan (extracted_text) generatsiya qilinadi, ogohlantirish bilan ("formatlash yo'qolgan bo'lishi mumkin").

**Versiyalar timeline'i:** har versiya — sana, kim, label, note, 3 fayl havolasi; joriy versiya belgilangan; istalgan eski versiyani ochish/yuklab olish mumkin.

**Qabul mezonlari:**
- [ ] 50 betlik docx'dan shablon < 30 soniyada generatsiya bo'ladi (fon vazifa, tayyor bo'lganda notification)
- [ ] Generatsiya qilingan fayl Word 2016+ va LibreOffice'da buzilmasdan ochiladi
- [ ] Versiya raqamlash per-document, race condition'siz (tranzaksiya testi)

## 1.5. Worker (fon vazifalar)

- `file.index`: yuklangan fayldan matn ajratish (PDF: pdf-parse; DOCX: mammoth) → `files.extracted_text`, `documents.search_vector` yangilash
- `diff.generate`: taqqoslama shablon generatsiyasi (yuqorida)
- Navbat: BullMQ, retry 3 marta exponential, dead-letter log

## 1.6. UI sahifalar (Bosqich 1)

`/setup`, `/login`, `/invite/[token]`, `/forgot-password`, `/` (dashboard: sonlar + oxirgi hujjatlar), `/vault` (+papka ichi), `/documents/[id]`, `/documents/new`, `/settings/profile`, `/settings/users` (admin)

Light/dark to'liq. Skeleton loaderlar. Bo'sh holatlar (empty states) dizayn bilan.

## 1.7. Bosqich yakuni mezoni (Definition of Done)

- [ ] Yangi org: setup → 3 rol'da userlar → papka daraxti → 10 hujjat → 1 hujjatga 3 versiya (shablon oqimi bilan) — to'liq ssenariy xatosiz
- [ ] e2e testlar yashil, seed skript demo-data yaratadi
- [ ] Docker compose'da bir buyruqda ishga tushadi
