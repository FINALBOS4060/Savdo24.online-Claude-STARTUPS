# Savdo24 - Biznes va Startaplar Savdosi Maydonchasi

Bu platforma O'zbekistonda biznes va startaplarni sotish hamda sotib olish uchun xizmat qiladi.

## Ma'lumotlar xavfsizligi va tiklash

Loyihada ma'lumotlarni yo'qotishdan himoya qilish uchun ko'p bosqichli zaxiralash tizimi joriy etilgan.

### 1. Avtomatik Zaxiralash (Backup)
- **Har kuni:** Server har kuni soat 04:00 da bazaning to'liq zaxirasini (SQL dump yoki JSON) yaratadi.
- **Telegram:** Zaxira fayli AES-256-GCM algoritmi bilan shifrlanadi va maxsus Telegram kanaliga yuboriladi.
- **Cloud S3:** Agar sozlangan bo'lsa, zaxira nusxasi Contabo S3 Object Storage'ga ham yuklanadi.
- **Deploy:** Har bir yangi versiya serverga yuklanishidan oldin (GitHub Actions orqali) avtomatik zaxira olinadi.

**Qo'lda zaxira olish:**
```bash
npm run backup
```

### 2. Avtomatik Tiklash (Auto-Restore)
Server ishga tushganda bazani tekshiradi. Agar baza butunlay bo'sh bo'lsa (masalan, server qayta o'rnatilganda), u oxirgi muvaffaqiyatli zaxirani Telegram'dan avtomatik yuklab olib, tiklashga urinadi.

### 3. Qo'lda Tiklash (Manual Restore)
Agar avtomatik tiklash ishlamasa yoki ma'lum bir fayldan tiklash kerak bo'lsa:

**Oxirgi zaxiradan tiklash:**
```bash
npm run restore
```

**Maxsus Telegram fayl ID orqali tiklash:**
```bash
npm run restore <file_id>
```

### Muhim Xavfsizlik Eslatmasi
Bu Telegram-zaxira tizimi faqat qo'shimcha himoya qatlami (safety net) hisoblanadi. Ma'lumotlar xavfsizligini ta'minlashning eng ishonchli yo'li — PostgreSQL bazasini ilova serveridan alohida, boshqariladigan (managed) ma'lumotlar bazasi xizmatida saqlashdir.

## Texnologiyalar
- **Frontend:** React, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend:** Node.js, Express, Prisma (PostgreSQL / SQLite)
- **Monitoring:** Telegram Bot API
- **Deployment:** GitHub Actions, PM2, Docker
