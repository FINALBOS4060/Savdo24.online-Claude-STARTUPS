#!/bin/bash
set -e

echo "🚀 Deploying Savdo24 to production..."

# 1. Pull latest changes from git
echo "📥 Pulling latest changes from Git..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 3. Build the application (TypeScript -> JavaScript & Vite React build)
echo "🏗️ Building the application..."
npm run build

# 4. Prisma DB Migration / Generation (Optional but recommended)
echo "🗄️ Generating Prisma client..."
npx prisma generate --schema=prisma/schema.prisma
# npx prisma db push --schema=prisma/schema.prisma # Agar db tuzilishi o'zgargan bo'lsa ishlatish mumkin

# 5. Restart PM2 process
echo "🔄 Restarting application via PM2..."
# Process name can be "savdo24" or whatever name was used initially. 
# PM2 will start using the "start" script defined in package.json.
# Package.json dagi "start": "NODE_ENV=production node dist/server.cjs" ishga tushadi
pm2 restart savdo24 || pm2 start npm --name "savdo24" -- run start

echo "✅ Deployment completed successfully!"
