#!/bin/bash
# ============================================================
# Savdo24 avtomatik deploy tizimini o'rnatish
# Ishlatish: serverga yuklab, BIR MARTA ishga tushiring:
#   bash install.sh
# ============================================================
set -e

echo "1) inotify-tools va postgresql-client o'rnatilmoqda..."
# TUZATILDI: ilgari faqat inotify-tools o'rnatilardi — postgresql-client
# (pg_dump) hech qachon o'rnatilmagan, shu sabab kunlik backup cron doim
# "pg_dump was not successful (it may not be installed)" ogohlantirishi
# bilan Method 2 (JSON fallback)ga tushib ketardi (haqiqiy SQL dump hech
# qachon olinmasdi). Endi ikkalasi ham shu yerda o'rnatiladi.
apt update -qq && apt install -y inotify-tools postgresql-client

echo "2) Skript papkasi tayyorlanmoqda..."
mkdir -p /root/deploy-scripts
cp watch-deploy.sh /root/deploy-scripts/watch-deploy.sh
chmod +x /root/deploy-scripts/watch-deploy.sh

echo "3) Kirish papkasi yaratilmoqda: /root/deploy-incoming/"
mkdir -p /root/deploy-incoming
mkdir -p /root/savdo24_backups

echo "4) systemd xizmati o'rnatilmoqda..."
cp savdo24-deploy-watcher.service /etc/systemd/system/savdo24-deploy-watcher.service
systemctl daemon-reload
systemctl enable savdo24-deploy-watcher
systemctl restart savdo24-deploy-watcher

echo ""
echo "✅ TAYYOR!"
echo ""
echo "Bundan buyon yangi kodni deploy qilish uchun FAQAT shu buyruqni yozing:"
echo ""
echo "   scp \"C:\\Users\\alexs\\Downloads\\loyiha.zip\" root@169.58.9.59:/root/deploy-incoming/"
echo ""
echo "ZIP fayl serverga tushishi bilan avtomatik: zaxira olinadi -> .env/uploads saqlanadi ->"
echo "kod almashtiriladi -> npm install -> build -> migratsiya -> PM2 qayta ishga tushadi."
echo "Xato chiqsa, avtomatik ROLLBACK qilinadi va Telegram orqali xabar keladi (agar bot sozlangan bo'lsa)."
echo ""
echo "Holatni kuzatish uchun:"
echo "   journalctl -u savdo24-deploy-watcher -f     # jonli log"
echo "   tail -f /var/log/savdo24-deploy.log         # deploy tarixi"
echo "   systemctl status savdo24-deploy-watcher     # xizmat holati"
