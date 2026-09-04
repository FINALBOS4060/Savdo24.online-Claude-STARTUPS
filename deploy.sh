#!/bin/bash
set -e

echo "🚀 Deploying Savdo24 to production..."

# 1. Pull latest changes from git
echo "📥 Pulling latest changes from Git..."
git pull origin main || git pull origin master

# 1.5. Majburiy .env kalitlarini tekshirish (JWT_SECRET, ENCRYPTION_KEY va h.k.)
#      Agar yo'q yoki bo'sh bo'lsa — avtomatik generatsiya qilinadi va .env'ga
#      yoziladi; agar allaqachon mavjud bo'lsa — tegilmaydi (sessiyalar buzilmasin).
echo "🔑 .env kalitlari tekshirilmoqda..."
bash scripts/ensure-env-secrets.sh .env

# 2. Install dependencies
echo "📦 Installing dependencies..."
# MUHIM: NODE_ENV=production o'rnatilgan bo'lsa npm devDependencies'ni
# o'tkazib yuboradi — build uchun kerak bo'lgan vite/esbuild/prisma/
# typescript/tsx devDependencies-only, shuning uchun --include=dev SHART
# (bu joy avval ham buzilgan edi, ehtiyot bo'lish kerak).
npm install --include=dev

# 3. Build the application (TypeScript -> JavaScript & Vite React build)
echo "🏗️ Building the application..."
npm run build

# 4. Prisma DB Migration / Generation
echo "🗄️ Generating Prisma client..."
npx prisma generate --schema=prisma/schema.prisma

# 4.5. Pre-deploy safety backup
# MUHIM: "db push" quyida bazaga to'g'ridan-to'g'ri (migrationsiz) schema
# o'zgarishlarini qo'llaydi, bu operatsiya qaytarib bo'lmaydigan tarzda
# ustun/jadval yo'qotishi mumkin. Shu sababli har bir deploy'dan oldin
# to'liq zaxira olinadi (README.md'dagi "Deploy'dan oldin avtomatik zaxira
# olinadi" degan kafolatni haqiqatda bajaradi).
echo "💾 Deploy oldidan xavfsizlik zaxirasi olinmoqda..."
if npm run backup; then
  echo "✅ Pre-deploy zaxira muvaffaqiyatli yaratildi."
else
  echo "⚠️ OGOHLANTIRISH: Pre-deploy zaxira muvaffaqiyatsiz tugadi!"
  read -p "Zaxirasiz davom etishni xohlaysizmi? (ha/yo'q): " confirm_no_backup
  if [ "$confirm_no_backup" != "ha" ]; then
    echo "❌ Deploy to'xtatildi (zaxira yo'q)."
    exit 1
  fi
  echo "⚠️ Foydalanuvchi tasdiqladi: zaxirasiz davom etilmoqda..."
fi

# 108-bosqich (tuzatish.txt, 2-band): eski migrations papkasi
# schema.prisma'dan orqada qolgani uchun "db push" ishlatilardi — bu
# migrationsiz to'g'ridan-to'g'ri bazaga tegadigan, qaytarib bo'lmaydigan
# xavfli operatsiya edi. Baza bo'sh ekanligi tasdiqlangach yangi to'liq
# baseline migration yaratilgan DEB O'YLANGAN edi — lekin 2026-08-14'da
# server butunlay tozalanganda (baza haqiqatan bo'sh holatda) ma'lum
# bo'ldiki, bu baseline hech qachon prisma/migrations/ papkasiga
# qo'shilmagan: papka haliyam faqat 6/30 modelni yaratadi (batafsil:
# prisma/migrations/README_MIGRATIONS.md). Shu sababli "migrate deploy"
# "Review"/"Dispute" kabi hech qachon migratsiyada yaratilmagan
# jadvallarga tayangan keyingi migratsiyada P3009 bilan to'xtab qolgan.
#
# Shuning uchun endi "migrate deploy"ga ishonishdan OLDIN, migratsiya
# tarixi haqiqatan HAM schema.prisma'dagi barcha modellarni qamrab
# olishini avtomatik tekshiramiz. Bu ayniqsa bo'sh (yangi/tozalangan)
# serverlarda muhim — eski, hech qachon tozalanmagan serverda "db push"
# bilan yashiringan bo'lishi mumkin bo'lgan farqni ham fosh qiladi.
echo "🔎 Migratsiya tarixi schema.prisma'ni to'liq qamrab olishini tekshirilmoqda..."
if ! bash scripts/verify-migrations-cover-schema.sh prisma/schema.prisma prisma/migrations; then
  echo ""
  echo "❌ DEPLOY TO'XTATILDI: migratsiya tarixi to'liq emas (yuqoridagi ro'yxatga qarang)."
  echo "   Bu holatda 'migrate deploy' bo'sh yoki qisman bo'sh bazada muvaffaqiyatsiz"
  echo "   tugaydi (yoki eski bazada muammoni yanada yashiradi) — shuning uchun avval"
  echo "   qo'lda hal qilinishi shart (qarang: prisma/migrations/README_MIGRATIONS.md)."
  exit 1
fi

echo "🗄️ Applying database migrations (migrate deploy)..."
npx prisma migrate deploy --schema=prisma/schema.prisma

# 5. Restart PM2 process
echo "🔄 Restarting application via PM2..."
# Ecosystem faylidan foydalanib restart qilamiz yoki start qilamiz
pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs

# 6. Verification
echo "--- Verifying deployment ---"
sleep 5

echo "🔍 Checking PM2 status..."
pm2 describe savdo24 | grep "status" | grep "online" || (echo "❌ Ilova online emas!" && exit 1)
pm2 describe savdo24 | grep "NODE_ENV" | grep "production" || (echo "⚠️ OGOHLANTIRISH: NODE_ENV production emas!" && exit 1)

echo "🔍 Checking API Health..."
# Localhost orqali health checkni tekshiramiz
curl -f http://localhost:3000/api/health || (echo "❌ Health check muvaffaqiyatsiz!" && exit 1)

echo "--- Deployment Finished ---"
echo "✅ DEPLOY MUVAFFAQIYATLI YAKUNLANDI!"
