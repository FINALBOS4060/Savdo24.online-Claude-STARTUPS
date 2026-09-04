#!/usr/bin/env bash
# ============================================================
# Savdo24 — BITTA BUYRUQ bilan to'liq server sozlash va deploy
# Ishlatish:
#   /root/savdo24 papkasiga (zip ochilgan joyga) shu faylni tashlang, so'ng:
#   bash deploy-bootstrap.sh
#
# Ixtiyoriy: domenni o'zgartirish uchun
#   DOMAIN=mening-domenim.com bash deploy-bootstrap.sh
#
# Skript idempotent — qayta ishga tushirsangiz, allaqachon
# bajarilgan qadamlarni buzmaydi, faqat qolganini tugallaydi.
# ============================================================
set -uo pipefail

DOMAIN="${DOMAIN:-savdo24.online}"
DB_NAME="${DB_NAME:-savdo24}"
DB_USER="${DB_USER:-savdo24_user}"
PROJECT_DIR="/root/savdo24"

C_BLUE='\033[1;36m'; C_GREEN='\033[1;32m'; C_YELLOW='\033[1;33m'; C_RED='\033[1;31m'; C_RESET='\033[0m'
log()  { echo -e "\n${C_BLUE}▶ $1${C_RESET}"; }
ok()   { echo -e "${C_GREEN}✔ $1${C_RESET}"; }
warn() { echo -e "${C_YELLOW}⚠ $1${C_RESET}"; }
fail() { echo -e "${C_RED}✘ $1${C_RESET}"; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Iltimos root sifatida ishga tushiring: sudo bash deploy-bootstrap.sh"
  exit 1
fi

SUMMARY=()

# ------------------------------------------------------------
# 0. Fayllar joyini tekshirish va ichma-ich papkani tuzatish
# ------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f package.json ]; then
  log "package.json shu papkada topilmadi — ichki papkani qidiryapman..."
  NESTED=$(find . -maxdepth 2 -name package.json -not -path "*/node_modules/*" | head -n1 || true)
  if [ -n "$NESTED" ]; then
    NESTED_DIR="$(dirname "$NESTED")"
    ok "Topildi: $NESTED_DIR — fayllarni yuqoriga ko'chiryapman"
    shopt -s dotglob nullglob
    for f in "$NESTED_DIR"/*; do
      mv -n "$f" . 2>/dev/null || true
    done
    shopt -u dotglob nullglob
    rmdir "$NESTED_DIR" 2>/dev/null || true
  else
    fail "package.json hech qayerda topilmadi. Zip fayl to'g'ri yuklanganini tekshiring."
    exit 1
  fi
fi

if [ ! -f package.json ]; then
  fail "package.json hali ham topilmadi — qo'lda tekshiring: ls -la $SCRIPT_DIR"
  exit 1
fi
ok "Loyiha fayllari joyida: $SCRIPT_DIR"

# Agar biz kutilgan PROJECT_DIR'da bo'lmasak, faqat ogohlantiramiz
# (ecosystem.config.cjs va deploy-watcher /root/savdo24'ni kutadi)
if [ "$SCRIPT_DIR" != "$PROJECT_DIR" ]; then
  warn "Skript $PROJECT_DIR emas, $SCRIPT_DIR ichida ishlayapti."
  warn "deploy-system avtomatik yangilanish tizimi /root/savdo24'ni kutadi."
  PROJECT_DIR="$SCRIPT_DIR"
fi

# ------------------------------------------------------------
# 1. Tizim paketlari (faqat yo'q bo'lsa o'rnatiladi)
# ------------------------------------------------------------
log "Tizim paketlarini tekshiryapman..."
apt update -qq

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]; then
  log "Node.js 22 LTS o'rnatilyapti..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt install -y nodejs >/dev/null
  ok "Node.js $(node -v) o'rnatildi"
else
  ok "Node.js $(node -v) allaqachon bor"
fi

if ! command -v psql >/dev/null 2>&1; then
  log "PostgreSQL o'rnatilyapti..."
  apt install -y postgresql postgresql-contrib >/dev/null
  ok "PostgreSQL o'rnatildi"
else
  ok "PostgreSQL allaqachon bor"
fi
systemctl enable --now postgresql >/dev/null 2>&1 || true

# TUZATILDI: yuqoridagi tekshiruv faqat `psql` mavjudligini tekshirardi —
# lekin kunlik backup (scripts/backup-db.ts) va admin panel eksporti
# (src/routes/admin-backup.ts) `pg_dump`ga tayanadi, va production
# loglarida "pg_dump was not successful (it may not be installed)" doimiy
# ko'rinib turgani aniqlandi. `psql` va `pg_dump` odatda bir xil paketda
# keladi, lekin xavfsizlik uchun ikkalasini ham ALOHIDA aniq tekshiramiz —
# shunda `psql` allaqachon boshqa manbadan (masalan mijoz kutubxonasi
# sifatida) o'rnatilgan, lekin `pg_dump` yo'q holatlar ham qamrab olinadi.
if ! command -v pg_dump >/dev/null 2>&1; then
  log "pg_dump topilmadi — postgresql-client o'rnatilyapti..."
  apt install -y postgresql-client >/dev/null
  ok "postgresql-client (pg_dump) o'rnatildi"
else
  ok "pg_dump allaqachon bor"
fi

if ! command -v nginx >/dev/null 2>&1; then
  log "Nginx o'rnatilyapti..."
  apt install -y nginx >/dev/null
  ok "Nginx o'rnatildi"
else
  ok "Nginx allaqachon bor"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  log "PM2 o'rnatilyapti..."
  npm install -g pm2 >/dev/null 2>&1
  ok "PM2 o'rnatildi"
else
  ok "PM2 allaqachon bor"
fi

if ! command -v certbot >/dev/null 2>&1; then
  log "Certbot o'rnatilyapti..."
  apt install -y certbot python3-certbot-nginx >/dev/null
  ok "Certbot o'rnatildi"
else
  ok "Certbot allaqachon bor"
fi

if ! command -v ufw >/dev/null 2>&1; then
  apt install -y ufw >/dev/null
fi
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
if ! ufw status | grep -q "Status: active"; then
  ufw --force enable >/dev/null 2>&1 || true
fi
ok "Firewall (ufw) sozlandi"

# ------------------------------------------------------------
# 2. PostgreSQL baza va foydalanuvchi (idempotent)
# ------------------------------------------------------------
log "PostgreSQL bazasini tekshiryapman..."
DB_ALREADY_EXISTED=true
DB_NEW_PASS=""

USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null || echo "")
if [ "$USER_EXISTS" != "1" ]; then
  DB_ALREADY_EXISTED=false
  DB_NEW_PASS="$(openssl rand -hex 16)"
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_NEW_PASS}';" >/dev/null
  ok "PostgreSQL foydalanuvchisi '${DB_USER}' yaratildi"
else
  ok "PostgreSQL foydalanuvchisi '${DB_USER}' allaqachon bor"
fi

DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null || echo "")
if [ "$DB_EXISTS" != "1" ]; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null
  ok "Baza '${DB_NAME}' yaratildi"
else
  ok "Baza '${DB_NAME}' allaqachon bor"
fi

# ------------------------------------------------------------
# 3. .env faylini sozlash
# ------------------------------------------------------------
log ".env faylini tekshiryapman..."
cd "$PROJECT_DIR"

# TUZATILDI (O'LIK KOD + YOLG'ON "MUVAFFAQIYAT" XABARI): oldin bu yerda
# `.env.example`dan nusxa olinardi — lekin bu fayl loyihada UMUMAN mavjud
# emas (dizayn TELEGRAM/Stripe/SMTP/Google kabi kalitlarni endi Admin
# panel orqali bazada saqlash tomon o'zgargan — pastdagi eslatmaga qarang),
# shuning uchun `cp .env.example .env` HAR DOIM muvaffaqiyatsiz tugardi,
# lekin `set -e` yo'qligi sababli skript to'xtamasdi va shunga qaramay
# keyingi qator SHARTSIZ ".env .env.example asosida yaratildi" deb
# yolg'on xabar chiqarardi. Haqiqiy .env yaratish va majburiy kalitlarni
# to'ldirish ishi to'liq pastdagi `ensure-env-secrets.sh`ga tegishli —
# u fayl mavjud bo'lmasa o'zi yaratadi (`touch`), shuning uchun bu yerda
# alohida bosqichga hojat yo'q.
if [ ! -f .env ]; then
  touch .env
  ok ".env fayli yaratildi (bo'sh) — majburiy kalitlar keyingi qadamda to'ldiriladi"
fi

# JWT_SECRET/ENCRYPTION_KEY/NODE_ENV/APP_URL/TELEGRAM_BOT_INTERNAL_SECRET —
# umumiy skript orqali ta'minlanadi (deploy.sh va watch-deploy.sh ham xuddi
# shu skriptni ishlatadi, shunda barcha deploy yo'llarida bir xil, izchil
# xulq-atvor bo'ladi, hech qaysi birida kalit "unutilib" qolmaydi).
bash scripts/ensure-env-secrets.sh .env "$DOMAIN"

set_env_if_empty() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" .env 2>/dev/null; then
    local current
    current=$(grep -E "^${key}=" .env | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -z "$current" ]; then
      sed -i "s#^${key}=.*#${key}=\"${val}\"#" .env
      echo "  → ${key} o'rnatildi"
    fi
  else
    echo "${key}=\"${val}\"" >> .env
    echo "  → ${key} qo'shildi"
  fi
}

# DATABASE_URL faqat bo'sh/noto'g'ri bo'lsa sozlanadi. Agar PostgreSQL
# foydalanuvchisi ALLAQACHON mavjud bo'lsa-yu, DATABASE_URL bo'sh yoki
# noto'g'ri formatda bo'lsa (masalan avvalgi urinishda buzilib qolgan
# bo'lsa, yoki hali hech qachon to'ldirilmagan bo'lsa) — eski parolni
# bilishimiz shart emas: PostgreSQL foydalanuvchisi paroli xavfsiz tarzda
# QAYTA O'RNATILADI (bu ma'lumotlar bazasidagi hech qanday jadval yoki
# qatorga tegmaydi, faqat kirish parolini yangilaydi) va yangi parol bilan
# ishlaydigan DATABASE_URL yoziladi.
CURRENT_DB_URL=$(grep -E "^DATABASE_URL=" .env 2>/dev/null | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DB_URL_VALID=false
case "$CURRENT_DB_URL" in
  postgresql://*|postgres://*) DB_URL_VALID=true ;;
esac

if [ "$DB_URL_VALID" = "false" ]; then
  if [ -z "$DB_NEW_PASS" ]; then
    warn "DATABASE_URL bo'sh yoki noto'g'ri formatda — PostgreSQL foydalanuvchisi '${DB_USER}' paroli xavfsiz tarzda qayta o'rnatilyapti (baza ma'lumotlariga tegilmaydi)..."
    DB_NEW_PASS="$(openssl rand -hex 16)"
    sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_NEW_PASS}';" >/dev/null
    ok "PostgreSQL foydalanuvchisi '${DB_USER}' paroli yangilandi"
  fi
  NEW_URL="postgresql://${DB_USER}:${DB_NEW_PASS}@localhost:5432/${DB_NAME}?schema=public"
  if grep -qE "^DATABASE_URL=" .env 2>/dev/null; then
    sed -i "s#^DATABASE_URL=.*#DATABASE_URL=\"${NEW_URL}\"#" .env
  else
    echo "DATABASE_URL=\"${NEW_URL}\"" >> .env
  fi
  ok "DATABASE_URL yangilandi"
fi
ok ".env tayyor"

# ------------------------------------------------------------
# 4. Build va migratsiya
# ------------------------------------------------------------
log "npm install (bu biroz vaqt olishi mumkin)..."
npm install --include=dev
if [ $? -ne 0 ]; then fail "npm install muvaffaqiyatsiz tugadi"; exit 1; fi
ok "Dependencies o'rnatildi"

log "Build qilinyapti..."
npm run build
if [ $? -ne 0 ]; then fail "Build muvaffaqiyatsiz tugadi"; exit 1; fi
ok "Build tugadi"

log "Prisma migratsiyalari qo'llanilyapti..."
MIGRATE_OUT="$(npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1)"
MIGRATE_STATUS=$?
echo "$MIGRATE_OUT"

if [ $MIGRATE_STATUS -ne 0 ]; then
  # P3009 = bazada muvaffaqiyatsiz/yarim bajarilgan migratsiya yozuvi bor.
  # Buni ko'r-ko'rona qayta urinish yoki e'tiborsiz qoldirish XAVFLI —
  # shuning uchun scripts/resolve-failed-migration.sh orqali bazadagi
  # HAQIQIY holatni tekshiramiz va faqat aniq xavfsiz bo'lganda o'zi
  # tuzatib, migratsiyani BIR MARTA qayta urinib ko'ramiz.
  if echo "$MIGRATE_OUT" | grep -q "P3009"; then
    warn "Bazada yarim qolgan migratsiya topildi — avtomatik xavfsiz tekshiruv boshlanmoqda..."
    FAILED_MIGRATIONS=$(echo "$MIGRATE_OUT" | grep -oE "The \`[0-9_A-Za-z]+\` migration" | sed -E 's/The `([^`]+)` migration/\1/' | sort -u)
    if [ -n "$FAILED_MIGRATIONS" ] && [ -f scripts/resolve-failed-migration.sh ]; then
      RESOLVE_OK=true
      for m in $FAILED_MIGRATIONS; do
        log "Tekshirilyapti: $m"
        if ! bash scripts/resolve-failed-migration.sh "$m" .env; then
          RESOLVE_OK=false
        fi
      done
      if [ "$RESOLVE_OK" = "true" ]; then
        log "Migratsiya qayta urinilmoqda..."
        npx prisma migrate deploy --schema=prisma/schema.prisma
        MIGRATE_STATUS=$?
      fi
    fi
  fi
fi

if [ $MIGRATE_STATUS -ne 0 ]; then
  fail "Migratsiya muvaffaqiyatsiz tugadi. Agar yuqorida 'ARALASH HOLAT' ogohlantirishi bo'lsa, bazani qo'lda ko'rib chiqish kerak (batafsil yuqoridagi chiqishda). Aks holda .env'dagi DATABASE_URL to'g'riligini tekshiring."
  exit 1
fi
ok "Migratsiya tugadi"

# ------------------------------------------------------------
# 4-b. Obuna almashish ("obunachi yig'ish") jadvallarini tekshirish
# ------------------------------------------------------------
# Bu qadam har bir deploy'da AVTOMATIK ishga tushadi — shunda "kanal
# qo'shish ishlaydimi-yo'qmi" degan savolga botni qayta sinamasdan
# turib, deploy jarayonining o'zida aniq javob olinadi. Muvaffaqiyatsiz
# bo'lsa deploy TO'XTATILMAYDI (bu asosiy funksiyani bloklamasligi
# kerak), faqat ANIQ ogohlantirish chiqariladi.
if [ -f scripts/verify-exchange-setup.ts ]; then
  log "Obuna almashish (kanal qo'shish) jadvallari tekshirilyapti..."
  if npx tsx scripts/verify-exchange-setup.ts; then
    ok "Obuna almashish tizimi uchun baza tayyor"
  else
    warn "Obuna almashish (kanal qo'shish) jadvallarida muammo bor — yuqoridagi chiqishni ko'ring."
    warn "Deploy DAVOM ETADI, lekin bot orqali kanal qo'shish hozircha ishlamasligi mumkin."
  fi
fi

# ------------------------------------------------------------
# 4-c. Navbat/suspend tuzatishi (queue fix) regressiya tekshiruvi
# ------------------------------------------------------------
# 2026-08-17'da tuzatilgan bug uchun: hali /browse navbatiga BIR MARTA
# HAM chiqmagan (lastOfferedAt=NULL) kanal, egasi boshqa kanalga obuna
# bo'lib kredit olganda ENDI suspend qilinmasligi kerak. Bu qadam har
# deploy'da avtomatik shu xatti-harakatni tasdiqlaydi, shunda kelajakda
# kimdir shu qismni qayta o'zgartirib, bugni bilmasdan qaytarib qo'ysa —
# deploy paytidayoq ANIQ ogohlantirish chiqadi. Muvaffaqiyatsiz bo'lsa
# ham deploy TO'XTATILMAYDI (yuqoridagi 4-b bilan bir xil siyosat).
if [ -f scripts/verify-exchange-queue-fix.ts ]; then
  log "Navbat/suspend tuzatishi (queue fix) tekshirilyapti..."
  if npx tsx scripts/verify-exchange-queue-fix.ts; then
    ok "Navbat/suspend tuzatishi to'g'ri ishlayapti"
  else
    warn "Navbat/suspend tuzatishida muammo bor — yuqoridagi chiqishni ko'ring."
    warn "Bu 'Online dars' bugi qaytadan paydo bo'lgan bo'lishi mumkin (src/routes/exchange-channels.ts)."
  fi
fi

# ------------------------------------------------------------
# 5. PM2 orqali ishga tushirish
# ------------------------------------------------------------
log "PM2 orqali ilova ishga tushirilyapti..."
if pm2 describe savdo24 >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root 2>/dev/null | tail -n1 | grep -E '^sudo|^env' | bash || true
ok "PM2 sozlandi"

sleep 3
# TUZATILDI (foydalanuvchi talabi — "Health-check javob bermadi" xabari
# chiqqanda diagnostika qulay bo'lishi kerak): avval bu yerda FAQAT 3
# soniya kutilib, BIR MARTA tekshirilardi — agar server sekinroq
# ko'tarilsa (masalan migratsiya/sozlamalarni qayta shifrlash kabi
# ishlar sabab), health-check hali tayyor bo'lmasa ham darhol
# "javob bermadi" deb yozilardi, garchi bir necha soniyadan keyin
# ishga tushib ketsa ham. Va ogohlantirish faqat "pm2 logs savdo24"ni
# QO'LDA ishga tushirishni TAVSIYA qilardi — sababni ko'rish uchun
# qo'shimcha qadam kerak bo'lardi.
#
# Endi: (1) bir martalik tekshirish o'rniga, jami 30 soniyagacha, har
# 2 soniyada qayta urinib ko'riladi — sekin ko'tarilgan holatlarni
# soxta xato deb hisoblamaslik uchun; (2) agar shundan keyin ham javob
# bo'lmasa, "pm2 logs" ni QO'LDA ishga tushirishni kutish o'rniga,
# so'nggi xato-log satrlari SHU YERNING O'ZIDA avtomatik chiqariladi —
# muammoni tashxislash uchun qo'shimcha buyruq kiritish shart emas.
HEALTH_OK=0
for i in $(seq 1 15); do
  if curl -sf http://localhost:3000/api/health >/dev/null; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done

if [ "$HEALTH_OK" -eq 1 ]; then
  ok "API health-check muvaffaqiyatli (localhost:3000)"
else
  warn "Health-check 30 soniya ichida javob bermadi. Oxirgi xato-loglar (pm2 logs savdo24):"
  echo -e "${C_YELLOW}--------------------------------------------------------------${C_RESET}"
  # PM2 xato-log fayli odatda ~/.pm2/logs/<app-nomi>-error-<instance>.log
  # yo'lida bo'ladi. Aniq nomni pm2 o'zidan so'raymiz (fayl nomi PM2
  # versiyasi/sozlamasiga qarab sal farq qilishi mumkin), topilmasa
  # "pm2 logs" buyrug'ining o'zini (bufer bo'yicha, 3 soniya kutib)
  # ishlatamiz — ikkalasi ham ishlamasa, foydalanuvchiga qo'lda
  # tekshirish kerakligini aniq aytamiz.
  ERROR_LOG=$(pm2 jlist 2>/dev/null | grep -o '"pm_err_log_path":"[^"]*"' | head -n1 | cut -d'"' -f4)
  if [ -n "$ERROR_LOG" ] && [ -f "$ERROR_LOG" ]; then
    tail -n 40 "$ERROR_LOG"
  else
    timeout 3 pm2 logs savdo24 --lines 40 --nostream 2>/dev/null || true
  fi
  echo -e "${C_YELLOW}--------------------------------------------------------------${C_RESET}"
  warn "To'liq/jonli logni ko'rish uchun: pm2 logs savdo24"
fi

# ------------------------------------------------------------
# 6. Nginx reverse proxy
# ------------------------------------------------------------
log "Nginx konfiguratsiyasi sozlanyapti..."
NGINX_CONF="/etc/nginx/sites-available/savdo24"
if [ ! -f "$NGINX_CONF" ]; then
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/savdo24
  rm -f /etc/nginx/sites-enabled/default
  ok "Nginx konfiguratsiyasi yaratildi"
else
  ok "Nginx konfiguratsiyasi allaqachon bor"
fi

if nginx -t >/dev/null 2>&1; then
  systemctl reload nginx
  ok "Nginx qayta yuklandi"
else
  fail "Nginx konfiguratsiyasida xato bor — 'nginx -t' orqali tekshiring"
fi

# ------------------------------------------------------------
# 7. SSL (Let's Encrypt) — faqat domen shu serverga yo'naltirilgan bo'lsa
# ------------------------------------------------------------
log "Domen DNS holatini tekshiryapman..."
SERVER_IP=$(curl -s https://api.ipify.org || echo "")
DOMAIN_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1 || echo "")

if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  ok "SSL sertifikat allaqachon mavjud"
elif [ -n "$SERVER_IP" ] && [ "$SERVER_IP" = "$DOMAIN_IP" ]; then
  log "Domen serverga to'g'ri yo'naltirilgan — SSL o'rnatilyapti..."
  # TUZATILDI: oldin certbot'ning haqiqiy natijasi TEKSHIRILMASDAN, har
  # doim shartsiz "ok" xabari chiqarilardi ("(yoki certbot chiqishini
  # tekshiring)" degan ehtiyot-shart matni buning o'zi ham muallifning
  # bunga ishonchi komil emasligini bildirardi). Endi boshqa barcha
  # bosqichlar (npm install, build, migratsiya, nginx -t) bilan bir xil
  # izchillikda, certbot'ning haqiqiy chiqish kodi (pipe ichida bo'lgani
  # uchun PIPESTATUS orqali) tekshiriladi.
  certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect 2>&1 | tail -n5
  CERTBOT_STATUS=${PIPESTATUS[0]}
  if [ "$CERTBOT_STATUS" -eq 0 ]; then
    ok "SSL sozlandi"
  else
    warn "SSL sozlashda xatolik yuz berdi (certbot chiqish kodi: $CERTBOT_STATUS) — yuqoridagi chiqishni ko'ring. Qo'lda qayta urinib ko'rishingiz mumkin: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
  fi
else
  warn "Domen (${DOMAIN}) hozircha shu server IP'siga (${SERVER_IP:-nomaʼlum}) yo'naltirilmagan."
  warn "DNS to'g'ri sozlangandan keyin qo'lda ishga tushiring:"
  warn "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
fi

# ------------------------------------------------------------
# 8. Kelajakdagi yangilanishlar uchun avtomatik deploy tizimi
# ------------------------------------------------------------
log "Avtomatik deploy-watcher tizimini tekshiryapman..."
if [ -f /etc/systemd/system/savdo24-deploy-watcher.service ]; then
  ok "deploy-watcher allaqachon o'rnatilgan"
elif [ -d "$PROJECT_DIR/deploy-system" ]; then
  apt install -y inotify-tools >/dev/null 2>&1 || true
  (cd "$PROJECT_DIR/deploy-system" && bash install.sh) || warn "deploy-watcher o'rnatilmadi, qo'lda tekshiring: $PROJECT_DIR/deploy-system/install.sh"
  ok "deploy-watcher o'rnatildi — endi yangi zip'ni /root/deploy-incoming/ ga scp qilsangiz bo'ldi"
else
  warn "deploy-system papkasi topilmadi, bu qadam o'tkazib yuborildi"
fi

# ------------------------------------------------------------
# Yakuniy hisobot
# ------------------------------------------------------------
echo -e "\n${C_GREEN}============================================${C_RESET}"
echo -e "${C_GREEN}✅ DEPLOY TUGADI${C_RESET}"
echo -e "${C_GREEN}============================================${C_RESET}"
echo "Sayt:        http://${DOMAIN} (SSL bo'lsa https://)"
echo "PM2 holati:  pm2 status"
echo "Loglar:      pm2 logs savdo24"
if [ -n "$DB_NEW_PASS" ]; then
  echo -e "${C_YELLOW}Yangi baza paroli yaratildi va .env'ga yozildi — buni alohida joyda ham saqlab qo'ying:${C_RESET}"
  echo "  DB user: ${DB_USER}"
  echo "  DB pass: ${DB_NEW_PASS}"
fi
echo -e "${C_YELLOW}Eslatma:${C_RESET} SECURITY.md'ga ko'ra TELEGRAM_BOT_TOKEN'ni @BotFather orqali /revoke qilib, yangisini .env'ga yozishni unutmang."
