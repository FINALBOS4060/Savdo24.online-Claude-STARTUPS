# Savdo24 - Biznes va Startaplar Savdosi Maydonchasi

Bu platforma O'zbekistonda biznes va startaplarni sotish hamda sotib olish uchun xizmat qiladi.

## Ma'lumotlar xavfsizligi va tiklash

Loyihada ma'lumotlarni yo'qotishdan himoya qilish uchun ko'p bosqichli zaxiralash tizimi joriy etilgan.

### 1. Avtomatik Zaxiralash (Backup)
- **Har kuni:** Serverning ichki `node-cron` vazifasi (`server.ts`) har kuni soat 04:00 da bazaning to'liq zaxirasini (SQL dump yoki JSON) yaratadi.
- **Telegram:** Zaxira fayli AES-256-GCM algoritmi bilan shifrlanadi va maxsus Telegram kanaliga yuboriladi.
- **Cloud S3:** Agar sozlangan bo'lsa, zaxira nusxasi Contabo S3 Object Storage'ga ham yuklanadi.
- **Google Drive:** Agar sozlangan bo'lsa, zaxira nusxasi Google Drive papkasiga ham avtomatik yuklanadi.
- **Deploy:** `deploy.sh` skripti bazaga `prisma db push` qo'llashdan oldin `npm run backup` ni avtomatik chaqirib, xavfsizlik zaxirasini oladi (agar zaxira muvaffaqiyatsiz bo'lsa, deploy davom etishdan oldin tasdiq so'raydi).

**Qo'lda zaxira olish:**
```bash
npm run backup
```

### 2. Avtomatik Tiklash (Auto-Restore)
Server ishga tushganda bazani tekshiradi. Agar baza butunlay bo'sh bo'lsa (masalan, server qayta o'rnatilganda), u oxirgi muvaffaqiyatli zaxirani avtomatik yuklab olib, tiklashga urinadi: avval Telegram manbasi tekshiriladi, agar u sozlanmagan/topilmasa, Contabo S3'dagi eng so'nggi zaxira qidiriladi.

### 3. Qo'lda Tiklash (Manual Restore)
Agar avtomatik tiklash ishlamasa yoki ma'lum bir fayldan tiklash kerak bo'lsa:

**Oxirgi zaxiradan tiklash (avval Telegram, topilmasa Contabo S3):**
```bash
npm run restore
```

**Maxsus Telegram fayl ID orqali tiklash:**
```bash
npm run restore <file_id>
```

### Muhim Xavfsizlik Eslatmasi
Bu Telegram-zaxira tizimi faqat qo'shimcha himoya qatlami (safety net) hisoblanadi. Ma'lumotlar xavfsizligini ta'minlashning eng ishonchli yo'li — PostgreSQL bazasini ilova serveridan alohida, boshqariladigan (managed) ma'lumotlar bazasi xizmatida saqlashdir.

## Avtomatik testlar
Loyihada `node:test` (Node.js'ning o'zida o'rnatilgan, tashqi paket kerak
emas) asosida boshlang'ich test to'plami bor — hozircha faqat DB'ga
bog'liq bo'lmagan sof funksiyalar (`escapeHtml`, `getReferralTier`,
`safeCompare`, `encryptSecret`/`decryptSecret`) qamrab olingan.

```bash
npm run test
```

Bu server.ts'ni to'liq ishga tushirmaydi (DB/tarmoq kerak emas), shu sabab
CI'da yoki tarmoqsiz muhitda ham ishlaydi. `tests/` papkasiga yangi test
qo'shishda: agar tekshiriladigan funksiya DB/Express'ga bog'liq bo'lsa,
avval uni sof (DB'siz) qismga ajratib olish tavsiya etiladi (`escapeHtml`
va h.k. `src/lib/pure-helpers.ts`ga ko'chirilgani kabi).

## Versiyalash (Git)
124-bosqichgacha loyiha faqat zip fayllar orqali uzatilardi — `.git`
umuman yo'q edi, ya'ni bosqichlar orasidagi farqni solishtirish yoki
xato bosqichni orqaga qaytarish imkonsiz edi. Endi loyiha ichida
mahalliy git repozitoriysi bor, boshlang'ich commit bilan.

**MUHIM CHEKLOV:** bu repoda hozircha **remote (masalan GitHub) yo'q** —
faqat mahalliy tarix. Buning sababi shu: bu kod sandbox muhitida (tarmoq
yo'q) tayyorlanadi, shu sabab `git push` bu yerdan bajarilolmaydi. Haqiqiy
zaxira/hamkorlik uchun bu repo(ni) haqiqiy GitHub/GitLab'ga ulash kerak:

```bash
# loyiha papkasida (serverda yoki mahalliy kompyuterda), bir martalik:
git remote add origin <sizning-repo-manzilingiz>
git push -u origin main
```

Shundan keyin har bir keyingi zip (yangi bosqich) shu repo ustiga
`git add -A && git commit -m "..."` qilib qo'shilishi, keyin `git push`
qilinishi tavsiya etiladi — shundagina bosqichlar orasidagi haqiqiy
`git diff`/`git log` tarixi saqlanadi va noto'g'ri versiyani serverga
tashlab qo'yish xavfi kamayadi.

## Ijtimoiy tarmoqlar uchun havola oldindan ko'rinishi (Link Preview / Bot Meta Handler)
Loyihada individual startap sahifalari (`/startup/:id`) Telegram, Facebook, WhatsApp kabi ijtimoiy tarmoqlar orqali ulashilganda to'g'ri `og:title`, `og:description` va `og:image` preview ko'rsatishi uchun **Bot Meta Handler** mexanizmi joriy etildi (`src/lib/botMetaHandler.ts`).

### Nima uchun to'liq SSR emas, shu yondashuv tanlandi?
1. **Oddiylik va Barqarorlik:** Butun React ilovasini SSR qilish (Next.js yoki Remix'ga o'tish) mavjud Express + Vite SPA arxitekturasini tubdan o'zgartirishni talab qiladi va murakkablikni keskin oshiradi.
2. **Botlar uchun Maqsadli Render:** Telegrambot, facebookexternalhit, Twitterbot kabi ijtimoiy tarmoq crawler'lari sahifani so'raganda, bazadan loyiha ma'lumotlari olinib, statik `index.html` ichidagi `og:*` teglari dinamik to'ldirib yuboriladi. Oddiy foydalanuvchilar esa odatdagidek tezkor va to'liq SPA ilovasini qabul qiladi.
3. **Xavfsizlik (XSS Himoyasi):** Bazadan keluvchi har qanday foydalanuvchi kiritgan ma'lumot (`startup.name`, `startup.description`) HTML'ga qo'shilishidan oldin `escapeHtml()` orqali qat'iy tozalanadi (sanitized), bu esa Stored XSS zaifliklarining oldini oladi.

## Texnologiyalar
- **Frontend:** React, Tailwind CSS, Lucide Icons, Motion (`motion/react`)
- **Backend:** Node.js, Express, Prisma (PostgreSQL / SQLite)
- **Monitoring:** Telegram Bot API
- **Deployment:** `deploy.sh` (git pull → build → prisma db push → PM2 restart) yordamida server ustida, yoki `render.yaml` orqali Render.com'da. Docker ishlatilmaydi. `.github/workflows/ci.yml` mavjud (123-bosqich) — lekin bu FAQAT tekshiruv (har push/PR'da haqiqiy `npm ci`+tsc+build+test), deployni avtomatlashtirmaydi; deploy hamon qo'lda (`deploy.sh`/FileZilla).
