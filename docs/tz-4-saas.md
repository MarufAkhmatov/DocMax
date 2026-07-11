# TZ-4. BOSQICH 4 — SAAS PARDOZI VA PRODUCTION
*Muddat bahosi: 2–3 hafta · Bog'liq: TZ-0..3*

**Maqsad:** ko'p mijozli to'liq SaaS: tariflar, kuchaytirilgan xavfsizlik, eksport/import, ishlab chiqarish infratuzilmasi.

---

## 4.1. Multi-tenant va tariflar

- Org ro'yxatdan o'tish ochiq: `/register` → org + Super Admin → email tasdiqlash → trial 14 kun.
- Tariflar (konfiguratsiyada, kodda hardcode emas):
  | | Free | Pro | Enterprise |
  |---|---|---|---|
  | Userlar | 5 | 50 | cheksiz |
  | Disk | 2 GB | 50 GB | kelishilgan |
  | Monitoring (TZ-3) | ❌ | ✅ | ✅ |
  | LLM tahlil | ❌ | ixtiyoriy | ✅ |
  | ACL, audit eksport | ❌ | ✅ | ✅ |
- Limit oshganda: yumshoq bloklash (yangi yuklash taqiqlanadi, mavjudlar ishlaydi) + banner.
- Billing integratsiya nuqtasi: Payme/Click (O'zbekiston) — provider-agnostic interfeys, birinchi bosqichda invoys/qo'lda faollashtirish ham yetarli.

## 4.2. Xavfsizlik kuchaytirish

- **2FA (TOTP):** ixtiyoriy per-user; ADMIN'larga org sozlamasida majburiy qilish opsiyasi. Recovery kodlar.
- **ClamAV:** yuklangan har fayl skan (worker), infected → fayl REJECTED, xabar.
- **Session boshqaruvi:** profil sahifasida aktiv sessiyalar ro'yxati, uzoqdan yopish.
- **IP allowlist** (Enterprise): org darajasida.
- Parol siyosati sozlamalari (min uzunlik, murakkablik) per-org.

## 4.3. API tokenlar (tashqi integratsiya)

- Admin panel: `nv_...` prefiksli tokenlar, scope'lar (read:documents, write:documents, read:acts), muddat, oxirgi ishlatilgan vaqt, bekor qilish.
- Rate limit per-token. Audit'da token harakatlari alohida ko'rinadi.
- OpenAPI (Swagger) hujjati avtogeneratsiya, `/api/docs` (faqat login bilan).

## 4.4. Eksport / Import / Backup

- **Eksport:** org bo'yicha to'liq arxiv (ZIP): papka strukturasi = katalog strukturasi, fayllar + `manifest.json` (metadata, relations, versiyalar). Fon vazifa, tayyor bo'lganda havola (24 soat).
- **Import:** o'sha formatdagi arxivni yuklash (migratsiya/ko'chirish uchun), konflikt strategiyasi: skip/rename.
- **Backup UI (Super Admin, self-hosted rejim):** oxirgi backuplar holati, qo'lda ishga tushirish. Fon: kunlik pg_dump + MinIO mirror, 30 kun retensiya, oyda bir restore-test skripti.

## 4.5. Production infratuzilma

- Muhitlar: dev / staging / prod. CI/CD (GitHub Actions): lint → test → build → docker image → deploy (staging avto, prod qo'lda tasdiq).
- Monitoring: healthcheck endpointlar, Sentry (xatolar, front+back), Prometheus metrikalar (navbat uzunligi, scraper holati, disk), Grafana dashboard, alertlar Telegram'ga.
- Loglar: strukturali JSON, so'rov ID (correlation id) end-to-end.
- Nginx/Caddy: HTTPS (Let's Encrypt), gzip/brotli, fayllar uchun presigned to'g'ridan-to'g'ri MinIO (backend orqali proxy qilinmaydi).
- Load test: 100 parallel user, hujjat ro'yxati va upload oqimida SLA buzilmasligi.

## 4.6. Qo'shimcha sayqal

- Onboarding: yangi org uchun namunaviy struktura + demo hujjatlar yaratish taklifi.
- Klaviatura: Cmd+K qidiruv, J/K navigatsiya ro'yxatda.
- Email shablonlari brendlangan (org logosi).
- Til to'liqligi auditi: uz/ru/en 100% qamrov.
- Yordam markazi sahifasi + rollar bo'yicha qisqa qo'llanma (keyin video).

## 4.7. Bosqich yakuni mezoni

- [ ] Ikki alohida org bir instansiyada — ma'lumot izolyatsiyasi penetration-style testdan o'tadi
- [ ] Trial → Pro faollashtirish → limitlar ishlashi oqimi to'liq
- [ ] Staging'da restore-test: backup'dan to'liq tiklangan tizim ishlaydi
- [ ] Sentry'da 0 kritik xato bilan 1 hafta staging soak-test
