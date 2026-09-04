# Savdo24 — Production Deployment Guide

Ushbu hujjat loyihani production muhitiga deploy qilish bo'yicha yo'riqnoma.

## ✅ Endi hammasi avtomatik

Quyidagilar endi **QO'LDA HECH NARSA QILMASDAN** avtomatik amalga oshadi:

- **JWT_SECRET, ENCRYPTION_KEY, TELEGRAM_BOT_INTERNAL_SECRET** — birinchi deploy'da avtomatik xavfsiz tasodifiy qiymat bilan generatsiya qilinib `.env` fayliga yoziladi (`scripts/ensure-env-secrets.sh`). Bir marta yozilgach, keyingi HAR BIR deploy'da (yangi zip tashlaganingizda ham) xuddi shu qiymat qayta ishlatiladi — hech qachon o'zgartirilmaydi, shuning uchun foydalanuvchi sessiyalari va shifrlangan sozlamalar buzilmaydi.
- **PostgreSQL baza va foydalanuvchi** — birinchi ishga tushirishda avtomatik yaratiladi, tasodifiy parol bilan.
- **npm install, build, Prisma migratsiya, PM2 qayta ishga tushirish** — har safar avtomatik.
- **Nginx + SSL (Let's Encrypt)** — domen shu serverga to'g'ri yo'naltirilgan bo'lsa, avtomatik sozlanadi.

Sizga qolgan ISH: to'lov, email, Telegram, Google OAuth kabi ixtiyoriy xizmatlarning API kalitlarini **Admin panel → Sozlamalar** bo'limidan kiritish. Bular kod ichida emas, ma'lumotlar bazasida shifrlangan holda saqlanadi va serverni qayta ishga tushirmasdan yangilanadi.

## 🚀 Birinchi marta serverga qo'yish (bitta buyruq)

```bash
scp deploy-bootstrap.sh root@SERVER_IP:/root/savdo24/
ssh root@SERVER_IP
cd /root/savdo24
bash deploy-bootstrap.sh
```

Bu skript: kerakli tizim paketlarini (Node.js, PostgreSQL, Nginx, PM2, Certbot) o'rnatadi, bazani yaratadi, `.env`dagi barcha majburiy kalitlarni generatsiya qiladi, build qiladi, migratsiyalarni qo'llaydi, PM2 orqali ishga tushiradi, Nginx+SSL sozlaydi va kelajakdagi avtomatik deploy tizimini (`deploy-watcher`) o'rnatadi. Skript idempotent — xato bo'lib qayta ishga tushirsangiz, allaqachon bajarilgan qadamlarni buzmaydi.

## 🔄 Keyingi yangilanishlar (yangi kod)

deploy-watcher o'rnatilgach, yangilanish uchun FAQAT shu kerak:

```bash
scp My_Projekt.zip root@SERVER_IP:/root/deploy-incoming/
```

Zip serverga tushishi bilan avtomatik: joriy versiya zaxiralanadi → `.env`/`uploads/` saqlab qolinadi → majburiy kalitlar tekshiriladi (yo'q bo'lsa to'ldiriladi, bor bo'lsa tegilmaydi) → `npm install` → `npm run build` → Prisma migratsiya → PM2 qayta ishga tushadi → sog'lomlik tekshiruvi. Har qanday bosqichda xato chiqsa — avtomatik ROLLBACK qilinadi va (agar Telegram bot sozlangan bo'lsa) xabar keladi.

Muqobil variant — serverda git orqali ishlayotgan bo'lsangiz, `./deploy.sh` xuddi shu tekshiruvlar bilan ishlaydi (`git pull` → kalitlarni tekshirish → build → migratsiya → PM2 restart).

## 🛠️ Nosozliklarni aniqlash (Troubleshooting)

```bash
pm2 logs savdo24                                  # jonli loglar
journalctl -u savdo24-deploy-watcher -f           # deploy-watcher jonli logi
tail -f /var/log/savdo24-deploy.log               # deploy tarixi
systemctl status savdo24-deploy-watcher           # watcher xizmati holati
```

Agar ilova ishlamasa, avvalo `pm2 status` orqali holatini, keyin `pm2 logs savdo24 --lines 100` orqali oxirgi xatoni tekshiring. Deploy muvaffaqiyatsiz bo'lsa, watcher avtomatik oldingi versiyaga qaytaradi — sayt hech qachon "yarim buzilgan" holatda qolmaydi.
