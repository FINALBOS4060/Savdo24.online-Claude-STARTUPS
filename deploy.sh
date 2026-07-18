#!/bin/bash
set -e

echo "🚀 Deploying Savdo24 to production..."

# 1. Pull latest changes from git
echo "📥 Pulling latest changes from Git..."
# git pull origin main || git pull origin master

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 3. Build the application (TypeScript -> JavaScript & Vite React build)
echo "🏗️ Building the application..."
npm run build

# 4. Prisma DB Migration / Generation
echo "🗄️ Generating Prisma client..."
npx prisma generate --schema=prisma/schema.prisma
echo "🗄️ Applying database migrations..."
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss || npx prisma migrate deploy

# 5. Restart PM2 process
echo "🔄 Restarting application via PM2..."
# Ecosystem faylidan foydalanib restart qilamiz yoki start qilamiz
pm2 restart ecosystem.config.js --update-env || pm2 start ecosystem.config.js

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
