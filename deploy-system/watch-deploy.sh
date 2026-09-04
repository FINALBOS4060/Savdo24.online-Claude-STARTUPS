#!/bin/bash
# ============================================================
# Savdo24 — avtomatik deploy kuzatuvchisi (watcher)
# /root/deploy-incoming/ papkasiga tashlangan har qanday .zip
# faylni avtomatik ravishda deploy qiladi.
#
# Ishlatish: bu skript systemd xizmati sifatida doimiy fonda
# ishlab turadi (o'rnatish uchun install.sh'ga qarang).
# ============================================================

set -uo pipefail

PROJECT_DIR="/root/savdo24"
INCOMING_DIR="/root/deploy-incoming"
BACKUPS_DIR="/root/savdo24_backups"
LOG_FILE="/var/log/savdo24-deploy.log"
PROCESSED_DIR="/root/deploy-incoming/.processed"

mkdir -p "$INCOMING_DIR" "$BACKUPS_DIR" "$PROCESSED_DIR"
touch "$LOG_FILE"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Telegram orqali xabar yuborish (agar .env ichida TELEGRAM_ADMIN_CHAT_ID va bot token bo'lsa)
notify() {
  local message="$1"
  if [ -f "$PROJECT_DIR/.env" ]; then
    local BOT_TOKEN
    local CHAT_ID
    BOT_TOKEN=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$PROJECT_DIR/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    CHAT_ID=$(grep -E "^TELEGRAM_ADMIN_CHAT_ID=" "$PROJECT_DIR/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
      curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -d chat_id="${CHAT_ID}" \
        -d text="🚀 Savdo24 Deploy: ${message}" > /dev/null 2>&1 || true
    fi
  fi
}

deploy_one() {
  local ZIP_PATH="$1"
  local ZIP_NAME
  ZIP_NAME=$(basename "$ZIP_PATH")
  local TIMESTAMP
  TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

  log "=============================================="
  log "🔎 Yangi fayl aniqlandi: $ZIP_NAME"

  # Fayl to'liq yuklanguncha kutamiz (scp davom etayotgan bo'lishi mumkin)
  local PREV_SIZE=-1
  local CUR_SIZE=0
  for i in $(seq 1 60); do
    CUR_SIZE=$(stat -c%s "$ZIP_PATH" 2>/dev/null || echo 0)
    if [ "$CUR_SIZE" = "$PREV_SIZE" ] && [ "$CUR_SIZE" != "0" ]; then
      break
    fi
    PREV_SIZE=$CUR_SIZE
    sleep 2
  done
  log "📦 Fayl hajmi barqaror: ${CUR_SIZE} bayt. Deploy boshlanmoqda..."
  notify "Yangi kod aniqlandi (${ZIP_NAME}), deploy boshlandi..."

  # ZIP butunligini tekshirish
  if ! unzip -tq "$ZIP_PATH" > /dev/null 2>&1; then
    log "❌ XATO: ZIP fayl buzilgan yoki to'liq yuklanmagan. Bekor qilinmoqda."
    notify "❌ Deploy bekor qilindi: ZIP fayl buzilgan (${ZIP_NAME})"
    mv "$ZIP_PATH" "$PROCESSED_DIR/FAILED_corrupt_${TIMESTAMP}_${ZIP_NAME}"
    return 1
  fi

  # 1) Joriy loyihani to'liq zaxiralash
  local BACKUP_PATH="$BACKUPS_DIR/backup_${TIMESTAMP}"
  if [ -d "$PROJECT_DIR" ]; then
    log "💾 Joriy loyiha zaxiralanmoqda: $BACKUP_PATH"
    cp -a "$PROJECT_DIR" "$BACKUP_PATH"
  fi

  # 2) Yangi kodni vaqtinchalik papkaga ochish
  local EXTRACT_DIR="/root/_deploy_extract_${TIMESTAMP}"
  rm -rf "$EXTRACT_DIR"
  mkdir -p "$EXTRACT_DIR"
  unzip -oq "$ZIP_PATH" -d "$EXTRACT_DIR"

  # Agar zip ichida bitta subfolder bo'lsa, uni ishlatamiz
  local INNER
  INNER=$(find "$EXTRACT_DIR" -maxdepth 1 -mindepth 1 -type d | head -1)
  local NEW_CODE_DIR="$EXTRACT_DIR"
  if [ -n "$INNER" ] && [ "$(find "$EXTRACT_DIR" -maxdepth 1 -mindepth 1 | wc -l)" = "1" ]; then
    NEW_CODE_DIR="$INNER"
  fi

  # 3) .env va uploads'ni eskisidan saqlab qolish (agar yangisida bo'lmasa yoki mavjud config saqlanishi kerak bo'lsa)
  if [ -f "$PROJECT_DIR/.env" ]; then
    log "🔐 .env eskisidan ko'chirilmoqda (production sirlar saqlanadi)"
    cp "$PROJECT_DIR/.env" "$NEW_CODE_DIR/.env"
  fi
  if [ -d "$PROJECT_DIR/uploads" ]; then
    log "🖼️  uploads/ papkasi eskisidan ko'chirilmoqda"
    rm -rf "$NEW_CODE_DIR/uploads"
    cp -a "$PROJECT_DIR/uploads" "$NEW_CODE_DIR/uploads"
  fi

  # 3.5) Majburiy .env kalitlarini tekshirish (JWT_SECRET, ENCRYPTION_KEY va h.k.)
  #      MUHIM: bu qadam shu yerda, .env ko'chirilgandan keyin va build'dan oldin
  #      turishi shart. Agar bu qadam bo'lmasa: .env'da biror sabab bilan
  #      JWT_SECRET yo'q bo'lib qolsa, server har safar ishga tushganda YANGI
  #      tasodifiy kalit generatsiya qilib jimgina davom etadi (xato bermaydi) —
  #      bu esa har deploy'da barcha foydalanuvchilarni tizimdan chiqarib
  #      yuboradi. Bu yerda bir marta generatsiya qilinib .env'ga yozilgach,
  #      shu .env keyingi barcha deploy'larga ham ko'chib boraveradi.
  if [ -f "$NEW_CODE_DIR/scripts/ensure-env-secrets.sh" ]; then
    log "🔑 .env kalitlari tekshirilmoqda..."
    bash "$NEW_CODE_DIR/scripts/ensure-env-secrets.sh" "$NEW_CODE_DIR/.env" >> "$LOG_FILE" 2>&1
  fi

  # 4) Bog'liqliklarni o'rnatish
  log "📥 npm install --include=dev ..."
  if ! (cd "$NEW_CODE_DIR" && npm install --include=dev >> "$LOG_FILE" 2>&1); then
    log "❌ XATO: npm install muvaffaqiyatsiz. Eski versiya saqlanadi."
    notify "❌ Deploy muvaffaqiyatsiz: npm install xato berdi. Sayt eski versiyada ishlashda davom etmoqda."
    rm -rf "$EXTRACT_DIR"
    mv "$ZIP_PATH" "$PROCESSED_DIR/FAILED_install_${TIMESTAMP}_${ZIP_NAME}"
    return 1
  fi

  # 5) Build
  log "🔨 npm run build ..."
  if ! (cd "$NEW_CODE_DIR" && npm run build >> "$LOG_FILE" 2>&1); then
    log "❌ XATO: build muvaffaqiyatsiz. Eski versiya saqlanadi, hech narsa almashtirilmaydi."
    notify "❌ Deploy muvaffaqiyatsiz: build xato berdi. Sayt eski versiyada ishlashda davom etmoqda. Log: $LOG_FILE"
    rm -rf "$EXTRACT_DIR"
    mv "$ZIP_PATH" "$PROCESSED_DIR/FAILED_build_${TIMESTAMP}_${ZIP_NAME}"
    return 1
  fi

  # 6) Eski kodni yangisiga almashtirish
  log "🔄 Kod almashtirilmoqda: $PROJECT_DIR"
  rm -rf "$PROJECT_DIR"
  mv "$NEW_CODE_DIR" "$PROJECT_DIR"
  rm -rf "$EXTRACT_DIR"

  # 7) Migratsiyalarni qo'llash
  log "🗄️  Baza migratsiyalari qo'llanmoqda..."
  if ! (cd "$PROJECT_DIR" && npx prisma migrate deploy --schema=prisma/schema.prisma >> "$LOG_FILE" 2>&1); then
    log "❌ XATO: migratsiya muvaffaqiyatsiz. Zaxiradan qaytarilmoqda (rollback)..."
    notify "❌ Deploy muvaffaqiyatsiz: migratsiya xato berdi. Avtomatik ROLLBACK qilinmoqda..."
    rm -rf "$PROJECT_DIR"
    if [ -d "$BACKUP_PATH" ]; then
      cp -a "$BACKUP_PATH" "$PROJECT_DIR"
      (cd "$PROJECT_DIR" && pm2 restart ecosystem.config.cjs --update-env >> "$LOG_FILE" 2>&1) || true
      notify "↩️ Rollback yakunlandi. Sayt oldingi versiyada ishlamoqda."
    fi
    mv "$ZIP_PATH" "$PROCESSED_DIR/FAILED_migrate_${TIMESTAMP}_${ZIP_NAME}"
    return 1
  fi

  # 8) PM2 orqali qayta ishga tushirish
  log "♻️  PM2 qayta ishga tushirilmoqda..."
  if ! (cd "$PROJECT_DIR" && pm2 restart ecosystem.config.cjs --update-env >> "$LOG_FILE" 2>&1); then
    log "❌ XATO: PM2 qayta ishga tushmadi. Zaxiradan qaytarilmoqda (rollback)..."
    notify "❌ Deploy muvaffaqiyatsiz: PM2 xato berdi. Avtomatik ROLLBACK qilinmoqda..."
    rm -rf "$PROJECT_DIR"
    if [ -d "$BACKUP_PATH" ]; then
      cp -a "$BACKUP_PATH" "$PROJECT_DIR"
      (cd "$PROJECT_DIR" && pm2 restart ecosystem.config.cjs --update-env >> "$LOG_FILE" 2>&1) || true
      notify "↩️ Rollback yakunlandi. Sayt oldingi versiyada ishlamoqda."
    fi
    mv "$ZIP_PATH" "$PROCESSED_DIR/FAILED_pm2_${TIMESTAMP}_${ZIP_NAME}"
    return 1
  fi

  # 9) Sog'lomlik tekshiruvi (health check)
  sleep 5
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    log "✅ Deploy MUVAFFAQIYATLI yakunlandi. Sayt ishlamoqda."
    notify "✅ Deploy muvaffaqiyatli yakunlandi! Sayt yangi versiyada ishlamoqda."
  else
    log "⚠️  Ogohlantirish: /api/health javob bermadi, lekin jarayon ishga tushdi. Qo'lda tekshiring: pm2 logs savdo24"
    notify "⚠️ Deploy tugadi, lekin health-check javob bermadi. Iltimos qo'lda tekshiring (pm2 logs savdo24)."
  fi

  mv "$ZIP_PATH" "$PROCESSED_DIR/OK_${TIMESTAMP}_${ZIP_NAME}"

  # Eski zaxiralardan faqat oxirgi 5 tasini saqlab qolamiz (disk to'lib ketmasligi uchun)
  ls -1dt "$BACKUPS_DIR"/backup_* 2>/dev/null | tail -n +6 | xargs -r rm -rf

  log "=============================================="
}

log "👁️  Savdo24 deploy-watcher ishga tushdi. Kuzatilayotgan papka: $INCOMING_DIR"

# inotifywait orqali papkani doimiy kuzatish
inotifywait -m -e close_write -e moved_to --format '%f' "$INCOMING_DIR" 2>/dev/null | while read -r FILENAME; do
  case "$FILENAME" in
    *.zip)
      FULL_PATH="$INCOMING_DIR/$FILENAME"
      if [ -f "$FULL_PATH" ]; then
        deploy_one "$FULL_PATH"
      fi
      ;;
    *)
      ;;
  esac
done
