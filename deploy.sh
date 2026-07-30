#!/bin/bash
set -e

echo "🚀 Deploying Savdo24 to production..."

# 1. Pull latest changes from git
echo "📥 Pulling latest changes from Git..."
git pull origin main || git pull origin master

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
# baseline migration yaratildi (bir martalik, qo'lda, SSH orqali).
# Shundan buyon "migrate deploy" ishlatiladi: bu faqat YANGI migration
# fayllarini qo'llaydi, mavjud ustun/jadvalga tegmaydi — xavfsizroq.
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
