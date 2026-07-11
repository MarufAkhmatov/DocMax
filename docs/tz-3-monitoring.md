# TZ-3. BOSQICH 3 — MONITORING (cbu.uz / lex.uz), VECTOR, TAHLIL
*Muddat bahosi: 3–4 hafta · Bog'liq: TZ-0..2*

**Maqsad:** tashqi normativ aktlar monitoringi, xabarnomalar, semantik solishtirish. **Arxitektura printsipi:** LLM — yoqib/o'chirib bo'ladigan alohida modul; monitoring, vectorlash va o'xshashlik qidiruvi LLM'siz to'liq avtonom ishlaydi.

---

## 3.1. Scraper moduli (worker ichida)

**Manbalar:**
- **lex.uz** — yangi qabul qilingan hujjatlar bo'limi/RSS mavjud bo'lsa RSS, aks holda HTML parsing (ro'yxat sahifasi → hujjat sahifasi → matn).
- **cbu.uz** — Markaziy bank normativ aktlari va press-relizlar bo'limi.

**Ishlash:**
- Cron: har 2 soatda (sozlanadi). Har manba alohida job, mustaqil xatolashadi.
- Dedup: `(source, external_id)` unique; external_id — sayt ID yoki URL hash.
- Yangi akt: `external_acts` yozuv (NEW) → matn yuklab olinadi (`raw_text`) → embedding vazifasi → status PROCESSED.
- Hurmatli scraping: 1 req/2s, User-Agent, retry/backoff; sayt strukturasi o'zgarsa — admin'ga "scraper failed" alert (3 ketma-ket xato).
- Admin sozlamalarida: manbalarni yoqish/o'chirish, kalit so'z filtrlari (masalan faqat "bank", "kredit" sohasidagi aktlar).

**Qabul mezonlari:**
- [ ] Bir akt ikki marta saqlanmaydi (parallel job testi)
- [ ] Sayt yotganida navbat to'planmaydi, keyingi cron'da davom etadi

## 3.2. Xabarnomalar

- Yangi akt kelganda: **in-app** notification + **Telegram** (org'ning bot/kanal sozlamasi: bot token + chat_id admin panelda) + **email** (kunlik digest yoki darhol — user tanlaydi).
- Xabar tarkibi: manba, sarlavha, raqam, sana, havola + (3.4 tayyor bo'lsa) "aloqador ichki hujjatlar: N ta" havolasi.
- Obuna sozlamalari user profilida: qaysi manba, qaysi kanal, darhol/digest.

## 3.3. Vectorlash (LLM'siz, lokal)

- **Embedding model:** `intfloat/multilingual-e5-base` (768d) — o'zbek/rus/ingliz matnlarni qo'llaydi. Worker ichida ONNX runtime yoki alohida Python microservice (`apps/embedder`, FastAPI, faqat ichki tarmoq) — tanlov implementatsiyada, tashqi API'siz.
- **Chunking:** 500 token, 50 overlap; band raqamlari saqlanadi (chunk metadata: band ko'rsatkichi).
- **Nima vectorlanadi:** (a) barcha ichki hujjatlarning joriy versiyalari (`extracted_text`), (b) barcha yangi external_acts. Yangi versiya yuklanganda eski chunklar o'chirilib qayta indekslash.
- Backfill buyruq: mavjud bazani bir martada indekslash (progress bilan).

## 3.4. Semantik solishtirish va qidiruv

- **Yangi akt oqimi:** akt vectorlanadi → har chunk bo'yicha ichki hujjatlar chunklariga cosine qidiruv → hujjat darajasida agregatsiya (top-k, threshold sozlanadi, default 0.82) → natija: "Ushbu aktga aloqador ichki hujjatlar" ro'yxati (o'xshashlik % va mos band-chunklar bilan) → akt sahifasida ko'rsatiladi + xabarnomaga qo'shiladi.
- **Semantik qidiruv (ichki):** global qidiruvda "ma'no bo'yicha" rejim — so'rov embedding → chunk qidiruv → hujjatlar ro'yxati snippet bilan.
- **External act sahifasi:** `/monitoring` ro'yxat (filtr: manba, sana, status) + akt sahifasi (matn, aloqadorlar, `BASED_ON` relation yaratish tugmasi — ichki hujjatni tashqi aktga bog'lash).

**Muhim cheklov (UI'da ochiq yoziladi):** o'xshashlik ≠ ziddiyat. Ro'yxat "tekshirish tavsiya etiladi" degan ma'noda; yakuniy hukm — yurist yoki (yoqilgan bo'lsa) LLM tahlili.

## 3.5. LLM ziddiyat tahlili (ixtiyoriy modul, toggle)

- Admin panelda: **OFF (default)** / Lokal LLM (Ollama endpoint: Qwen/Llama) / Tashqi API (Anthropic — API key org sozlamasida).
- Oqim (yoqilganda): yangi akt + top-aloqador ichki hujjat chunklari → prompt: "quyidagi ichki hujjat bandlari yangi aktga zidmi? Har band uchun: ZID / ZID EMAS / ANIQ EMAS + qisqa asos" → natija `conflict_reviews` jadvaliga (act_id, document_id, verdict, reasoning, model_name) → akt sahifasida "Tahlil" tab.
- Har xulosada disclaimer: "Bu dastlabki avtomatik tahlil, yuridik xulosa emas".
- OFF holatda tizimning boshqa hech bir funksiyasi buzilmaydi (qat'iy test).

## 3.6. Bosqich yakuni mezoni

- [ ] LLM OFF holatda to'liq oqim: scraper → yangi akt → telegram xabar → akt sahifasida aloqador ichki hujjatlar ro'yxati
- [ ] Semantik qidiruv o'zbek va rus so'rovlarda mantiqiy natija beradi (sinov to'plami bilan baholanadi)
- [ ] Embedding servis o'chib qolsa tizim yiqilmaydi — vazifalar navbatda kutadi
