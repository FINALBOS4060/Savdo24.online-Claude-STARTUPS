# Savdo24 — Production Deployment Guide

Ushbu hujjat loyihani production muhitiga muvaffaqiyatli va xavfsiz deploy qilish bo'yicha yo'riqnoma va talablarni o'z ichiga oladi.

## 🛑 MUHIM XAVFSIZLIK TALABI (Pre-deployment Checklist)

Deploy qilishdan oldin albatta `.env` faylida yoki serverning muhit o'zgaruvchilarida quyidagi ikki o'zgaruvchini qo'lda va mustahkam o'rnatishingiz shart. 

> [!WARNING]
> **JWT_SECRET** va **ENCRYPTION_KEY** qiymatlarini hech qachon yo'qotmasligingiz kerak! Agar ushbu kalitlar o'zgarib qolsa yoki yo'qolsa:
> 1. Tizimdagi shifrlangan barcha ma'lumotlar va sozlamalar (masalan, API kalitlari, to'lov sozlamalari va b.) **butunlay qayta tiklab bo'lmaydigan holatga keladi** (shifrdan ochib bo'lmaydi).
> 2. Foydalanuvchilarning barcha joriy seanslari va JWT tokenlari bekor qilinadi.

Production muhitida (`NODE_ENV=production`) agar ushbu o'zgaruvchilar o'rnatilmagan bo'lsa, **server xato berib ishga tushishdan darhol to'xtaydi** (`process.exit(1)`). Bu xavfsiz bo'lmagan avto-generatsiyaning oldini olish uchun joriy etilgan qat'iy xavfsizlik chorasidir.

### 1. Kalitlarni generatsiya qilish

Har bir kalit kamida **32 ta belgidan** iborat bo'lishi shart. Kalitlarni xavfsiz generatsiya qilish uchun quyidagi terminal buyruqlaridan foydalanishingiz mumkin:

```bash
# JWT_SECRET uchun:
openssl rand -hex 32

# ENCRYPTION_KEY uchun:
openssl rand -hex 32
```

### 2. .env faylini sozlash

Yaratilgan qiymatlarni `.env` fayliga yozing:

```env
# Database & Auth
DATABASE_URL="postgresql://user:password@host:5432/db_name?schema=public"
JWT_SECRET="siz_generatsiya_qilgan_mustahkam_jwt_secret_kaliti_32_belgi"
ENCRYPTION_KEY="siz_generatsiya_qilgan_mustahkam_shifrlash_kaliti_32_belgi"
```

---

## 🚀 Deploy Bosqichlari (PM2 & Git yordamida)

Loyiha serverda `deploy.sh` skripti orqali deploy qilinadi.

1. **Serverga ulaning va loyiha papkasiga o'ting:**
   ```bash
   cd /var/www/savdo24
   ```

2. **Deploy skriptini ishga tushiring:**
   ```bash
   ./deploy.sh
   ```

   `deploy.sh` quyidagi amallarni avtomatik bajaradi:
   - Git orqali oxirgi o'zgarishlarni yuklaydi (`git pull`).
   - Bazaning zaxira nusxasini oladi (`npm run backup`).
   - Barcha dependencies yuklanadi (`npm install`).
   - Frontend build qilinadi (`npm run build`).
   - Prisma migratsiyalari yoki db push qo'llaniladi (`npx prisma db push`).
   - PM2 orqali backend va bot jarayonlari qayta ishga tushiriladi (`pm2 reload all`).

---

## 🛠️ Nosozliklarni aniqlash (Troubleshooting)

Agar server ishga tushmayotgan bo'lsa, PM2 loglarini tekshiring:

```bash
pm2 logs savdo24-backend
```

Agar xatoliklar orasida quyidagi yozuvni ko'rsangiz:
`❌ XATOLIK: Production muhitida "JWT_SECRET" o'zgaruvchisi sozlanmagan...`

Bu sizning `.env` faylingiz to'g'ri o'qilmaganini yoki kalitlar yetarlicha uzun emasligini ko'rsatadi. `.env` faylini tekshiring, undagi bo'shliqlarni olib tashlang va kalitlar uzunligi kamida 32 ta belgidan iborat ekaniga ishonch hosil qiling.
