# DESIGN.md — NormaVault dizayn tizimi

Manba: `design/normavault-ui-v3.html` (interaktiv etalon). Bu hujjat undan token va qoidalarni ajratib beradi.

## 1. Ranglar (CSS variables → Tailwind theme)

| Token | Dark | Light | Ishlatilishi |
|---|---|---|---|
| `--green` | `#68E78E` | `#68E78E` | Asosiy aksent, CTA, aktiv holat |
| `--green-deep` | `#2FA45B` | `#2FA45B` | Light rejimda matnli aksent (kontrast uchun) |
| `--green-soft` | `rgba(104,231,142,.14)` | `rgba(47,164,91,.12)` | Aktiv fon, badge fon |
| `--bg` | `#000B1A` (Blue Charcoal) | `#EDF2EF` | Sahifa foni |
| `--glass` | `rgba(255,255,255,.06)` | `rgba(255,255,255,.68)` | Karta/panel foni + `backdrop-blur(16px)` |
| `--glass-brd` | `rgba(255,255,255,.10)` | `rgba(10,30,25,.10)` | Barcha chegara chiziqlari |
| `--txt / --txt2 / --txt3` | `#EDF3F0 / #8FA0A8 / #5B6B74` | `#0B1A16 / #5C6E68 / #93A29C` | Matn 3 darajasi |
| `--paper` | `#F4F7F5` | `#FFFFFF` | "Qog'oz" elementlar (hujjat preview, varaqlar) |
| Semantik | `--amber #F0C24B` (kutish/diqqat) · `--blue #6BB4F5` (info/buyruq) · `--red #F07A6B` (xavf/o'chirish) · `--violet #B39CF5` (teg/reglament) | | |

**Qoida:** dark rejimda yashil matn `--green`, light rejimda `--green-deep` (oq fonda och yashil o'qilmaydi).

## 2. Tipografika

- **Sora** — h1–h3, karta sarlavhalari, raqamlar (stat). Vazn 600, letter-spacing -0.5px katta o'lchamlarda.
- **Manrope** — body, tugma, jadval. Vazn 600–800 (bu dizayn yupqa vaznlarni ishlatmaydi).
- O'lchamlar: h1 25–26px · karta sarlavha 15px · body 13px · meta/badge 11–12px · overline 10.5px UPPERCASE ls .7px.

## 3. Shakl va effekt

- Radiuslar: karta `20px`, ichki element `12–14px`, pill `999px`.
- Shisha effekt: `background: var(--glass); border: 1px solid var(--glass-brd); backdrop-filter: blur(16px)`.
- Soya faqat hover/ko'tarilgan holatda: `0 24px 60px rgba(0,0,0,.5)` (dark) / `0 20px 50px rgba(20,50,40,.13)` (light).
- Fon nafasi: sahifa orqasida 2 ta radial yashil gradient dog' (body::before), harakatsiz.
- Hoverda karta `translateY(-4px)` + soya. Barcha o'tishlar 150–350ms ease.

## 4. Imzo komponentlar (etalondagi class nomlari bilan)

| Komponent | Etalonda | Tavsif |
|---|---|---|
| Papka kartasi | `.folder` | Shisha karta + tepada tab (::before) + orqasidan 3 qiya "qog'oz varaq" (.sheet). Aktiv: yashil gradient (.acc). ACL: qulf ikonkasi |
| Papka veeri | `.fan .ff` | Dashboard hero: perspective 900px, rotateY(42deg), hoverda oldinga chiqadi |
| Holat badge | `.st.a/.e/.d/.r` | Pill + nuqta: Aktiv (yashil) / Kuchini yo'qotgan (kulrang) / Loyiha-kutish (amber) / Xavf (qizil) |
| Command palette | `.cmdk` | ⌘K, markazda 620px, amallar+hujjatlar seksiyalari, footer'da klaviatura hintlari |
| Bulk bar | `.bulk` | Tanlov > 0 bo'lsa pastdan suzib chiqadi, amallar toast bilan javob beradi |
| Diff jadval | `.dtable` | 3 ustun (№/eski/yangi), o'zgargan qator amber fon, `<del>` qizil, `<ins>` yashil |
| Drawer | `.drawer` | O'ngdan 360px, xabarnomalar, har biri deep-link |
| Toast | `.toast` | O'ng-past, 3.2s, yashil nuqta |
| Wizard modal | `.modal .steps` | 3 qadam progress chiziq, drop-zone, "hash tekshirildi" feedback |

## 5. UX qoidalari

- Har ro'yxat sahifasida: chips-filtrlar (URL'da saqlanadi) + saqlangan filtrlar sidebar'da.
- Har destruktiv amal: toast'da tiklash haqida eslatma ("30 kun ichida tiklash mumkin").
- Bo'sh holatlar (empty state) majburiy: ikonka + 1 jumla + asosiy amal tugmasi.
- Skeleton loaderlar — spinner emas.
- Klaviatura: ⌘K palette, Esc hamma overlay'ni yopadi.
- Monitoring o'xshashlik foizi yonida doim disclaimer: "o'xshashlik ≠ ziddiyat".

## 6. Tailwind'ga ko'chirish

`globals.css`da yuqoridagi CSS variables ikkala theme uchun e'lon qilinadi; Tailwind config `colors: { green: 'var(--green)', ... }` ko'rinishida ulanadi. shadcn/ui komponentlari shu tokenlarga remap qilinadi (default slate palitrasi ishlatilmaydi).
