# TZ-2. BOSQICH 2 — BOG'LANISHLAR, STRUKTURA, BOSHQARUV
*Muddat bahosi: 3–4 hafta · Bog'liq: TZ-0, TZ-1 yakunlangan*

**Maqsad:** hujjatlar orasidagi munosabatlar (workflow + graf), korxona strukturasi, papka darajasidagi ruxsatlar, to'liq admin panel.

---

## 2.1. Bog'lanishlar (Relations)

**Turlari va mantiqiy qoidalari:**
| Tur | Ma'no | Qoida |
|---|---|---|
| RELATED | O'zaro bog'liq | Simmetrik ko'rsatiladi |
| PARENT_CHILD | Asosiy ↔ bo'ysunuvchi | Sikl taqiqlanadi (DFS tekshiruv) |
| AMENDS | O'zgartirish kiritadi | Source yangi, target eski |
| REPLACES | O'rnini bosadi | Yaratilganda modal: "Target'ni EXPIRED qilaylikmi?" (ixtiyoriy) |
| BASED_ON | Asosida ishlab chiqilgan | Bosqich 3'da external_act'ga ham ulanadi |

**UI:**
- Hujjat sahifasida "Bog'lanishlar" bloki: guruhlab ro'yxat (turi bo'yicha), qo'shish tugmasi → hujjat qidiruv (typeahead) + tur + izoh.
- Bog'lanishni o'chirish — tasdiq bilan, audit'ga yoziladi.

**API:** `GET/POST/DELETE /documents/:id/relations`, `GET /graph?filters...`

## 2.2. Workflow canvas (n8n uslubi) — `/relations/workflow`

- React Flow. Node turlari: **papka** (ichidagi hujjatlar soni bilan) va **hujjat** (nom, raqam, holat badge).
- Chap panel: papka/hujjat qidiruv → canvas'ga drag qilib qo'shish.
- Node'lar orasiga chiziq tortish = relation yaratish (modal: tur+izoh). Chiziq o'chirish = relation o'chirish.
- Edge ranglari tur bo'yicha (legend bilan): RELATED kulrang, AMENDS sariq, REPLACES qizil, PARENT_CHILD ko'k, BASED_ON yashil.
- Canvas layout foydalanuvchi uchun saqlanadi (`user_canvas_layouts`: user_id, node positions jsonb).
- Zoom/pan/minimap/fit. Node dblclick → hujjat sahifasi.

**Qabul mezonlari:**
- [ ] 200 node + 400 edge'da silliq ishlaydi (virtualizatsiya/level-of-detail)
- [ ] Layout qayta kirganda tiklanadi

## 2.3. Graf ko'rinishi (Obsidian uslubi) — `/relations/graph`

- react-force-graph-2d. Node = hujjat; o'lcham = bog'lanish soni; rang rejimi toggle: tur bo'yicha / podrazdeleniye bo'yicha / holat bo'yicha.
- Hover: nom tooltip + qo'shnilarni highlight, qolganini xiralashtirish. Click: yon panelda hujjat kartochkasi (metadata + "ochish").
- Filtrlar paneli: holat, tur, podrazdeleniye, teg, yil — graf real vaqtda qayta chiziladi.
- Yolg'iz (bog'lanishsiz) node'larni ko'rsatish/yashirish toggle.

## 2.4. Korxona strukturasi — `/structure`

- Org-unit daraxti: CRUD, drag&drop, rahbar biriktirish, kod.
- Har unit'ga papka mapping ko'rsatiladi (folders.org_unit_id).
- **Remapping wizard** (struktura o'zgarganda):
  1. O'zgarish qilinadi (unit ko'chirildi/qo'shildi/yopildi)
  2. Wizard ta'sirlangan papkalarni ro'yxatlaydi: "Yuridik bo'lim papkasi → yangi joy: Boshqaruv > Huquq departamenti"
  3. Tasdiqlangach papkalar bitta tranzaksiyada ko'chiriladi; hujjat ID, linklar, relations o'zgarmaydi
- Unit yopilganda: papkasi "Arxiv strukturalar" tizim papkasiga ko'chirish taklifi.
- Struktura snapshot: har o'zgarishda `org_structure_snapshots` (jsonb) — "2025-yil holati" ko'rish uchun (faqat read-only ko'rinish).

## 2.5. Papka darajasidagi ruxsatlar (ACL)

- Papka sozlamalarida "Kirishni cheklash" yoqiladi → subject qo'shish: rol / user / org_unit; huquqlar: ko'rish, tahrirlash, yuklab olish (alohida checkbox).
- Meros: pastki papkalar yuqoridagini oladi (`inherit=true`), papkada override mumkin.
- ACL yoqilgan papka tree'da qulf ikonkasi bilan; ruxsatsiz userga papka umuman ko'rinmaydi.
- **Yuklab olish taqiqlangan rejim:** preview ochiladi, download tugmasi yo'q, presign endpoint 403; preview'da fon watermark (user email) — oddiy himoya sifatida.

**Qabul mezonlari:**
- [ ] Ruxsat tekshiruvi bitta joyda (guard/servis), barcha endpointlar qamrovda — permission matrix e2e testi
- [ ] ACL papkadagi hujjat qidiruvda ham ruxsatsizga chiqmaydi

## 2.6. Full-text qidiruv

- Global qidiruv (header, Cmd+K): nom/raqam bo'yicha instant + "fayl ichidan qidirish" rejimi (`search_vector`, `websearch_to_tsquery`, rus/o'zbek matnlar uchun `simple` config + pg_trgm fallback).
- Natijada snippet (`ts_headline`), hujjatga o'tish.

## 2.7. Admin panel to'liqlashtirish

- **Audit log sahifasi:** filtr (user, amal, sana, entity), eksport CSV. Faqat ADMIN+.
- **Trash:** o'chirilgan hujjat/papkalar 30 kun; tiklash; 30 kundan keyin cron tozalaydi (fayllar MinIO'dan ham).
- **Rollar:** CONTRIBUTOR faollashadi (yuklaydi → DRAFT, ACTIVE qila olmaydi; EDITOR/ADMIN tasdiqlaydi — oddiy bir bosqichli tasdiq).
- **Statistika dashboard:** hujjatlar soni dinamikasi, bo'limlar kesimi, aktiv/expired nisbati, eng faol userlar, disk hajmi.
- **Notifications markazi:** in-app qo'ng'iroqcha; hodisalar: menga hujjat biriktirildi, tasdiq kutmoqda, shablon tayyor, versiya yangilandi (obuna bo'lingan hujjatlar — "kuzatish" tugmasi).

## 2.8. Bosqich yakuni mezoni

- [ ] Ssenariy: struktura o'zgartirildi → wizard bilan papkalar ko'chdi → linklar/relations sog'
- [ ] Workflow'da yaratilgan relation graf'da va hujjat sahifasida ko'rinadi (bitta manba)
- [ ] ACL matritsasi e2e testlari yashil, audit har mutatsiyani qamragan
