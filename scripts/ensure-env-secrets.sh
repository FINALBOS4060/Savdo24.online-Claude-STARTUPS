#!/usr/bin/env bash
# ============================================================
# scripts/ensure-env-secrets.sh
#
# .env faylida MAJBURIY maxfiy kalitlar (JWT_SECRET, ENCRYPTION_KEY)
# va asosiy production sozlamalari (NODE_ENV, APP_URL,
# TELEGRAM_BOT_INTERNAL_SECRET) mavjudligini ta'minlaydi.
#
# Nega bu fayl kerak: avvalgi versiyada faqat deploy-bootstrap.sh
# (BIR MARTALIK server sozlash skripti) bu kalitlarni generatsiya
# qilardi. Lekin haqiqiy deploy'lar deploy.sh yoki watch-deploy.sh
# orqali (har safar yangi zip tashlanganda) bo'lib o'tadi — va ular
# eski .env'ni shunchaki ko'chirib qo'yardi, hech narsani
# tekshirmasdi. Agar biror sababdan .env'da JWT_SECRET bo'lmasa
# (masalan qo'lda tahrirlashda o'chib qolgan bo'lsa), server.ts
# ichidagi getSecret() funksiyasi buni "process.exit" bilan emas,
# balki HAR SAFAR YANGI tasodifiy vaqtinchalik kalit generatsiya
# qilib jimgina davom etardi — bu esa har deploy'da barcha
# foydalanuvchi sessiyalarini (JWT) yoki shifrlangan sozlamalarni
# (ENCRYPTION_KEY) buzib qo'yardi, hech qanday aniq xato bermasdan.
#
# Shu skript endi HAR BIR deploy yo'lida (bootstrap, deploy.sh,
# watch-deploy.sh) ishga tushadi: agar kalit .env'da yo'q yoki bo'sh
# bo'lsa — bir marta xavfsiz tasodifiy qiymat generatsiya qilib
# .env'ga yozadi. Agar kalit ALLAQACHON mavjud bo'lsa — HECH QACHON
# unga tegmaydi (shuning uchun keyingi barcha deploy'larda xuddi shu
# qiymat ishlatiladi, sessiyalar buzilmaydi).
#
# Ishlatish:
#   bash scripts/ensure-env-secrets.sh /path/to/.env [domain]
# ============================================================
set -uo pipefail

ENV_FILE="${1:-.env}"
DOMAIN="${2:-savdo24.online}"

if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
fi

CHANGED=0

# ------------------------------------------------------------
# 0) .env faylini SINTAKTIK jihatdan tuzatish (qiymatlarga TEGILMAYDI)
#
# Bu bo'lim faqat quyidagi turdagi "texnik" buzilishlarni avtomatik
# tuzatadi — hech qanday KALIT QIYMATINI o'zgartirmaydi yoki
# o'chirmaydi, faqat qator formatini to'g'rilaydi:
#   • BOM (Byte Order Mark) va Windows (CRLF) qator oxirlari
#   • Ikki xil kalit bitta qatorga yopishib qolgan holat, masalan
#     `DATABASE_URL="..."JWT_SECRET="..."` — bularni ikkita alohida
#     qatorga ajratadi (qiymatlarning o'zi o'zgarmaydi)
#   • Bitta kalit bir necha marta takrorlangan bo'lsa (masalan avvalgi
#     buzilgan urinishdan qolgan eski nusxa) — faqat ENG OXIRGI
#     (fayldagi eng so'nggi, demak eng yangi deb hisoblanadigan)
#     qatorni qoldiradi, boshqalarini olib tashlaydi
#
# Har qanday o'zgartirishdan OLDIN faylning to'liq nusxasi
# (.env.bak.<timestamp>) saqlanadi — shu bilan biror narsa noto'g'ri
# tuzatilgan taqdirda ham qo'lda tiklash imkoni bo'ladi. Bu bosqich
# ma'lumotlar bazasiga HECH QANDAY aloqasi yo'q — faqat shu bitta
# matn faylining formatini tuzatadi.
if [ -s "$ENV_FILE" ]; then
  ENV_BEFORE_FIX=$(cat "$ENV_FILE")

  # BOM'ni olib tashlash
  sed -i '1s/^\xEF\xBB\xBF//' "$ENV_FILE" 2>/dev/null || true
  # CRLF -> LF
  sed -i 's/\r$//' "$ENV_FILE"

  # Bir qatorga yopishib qolgan `..."KEY2="..."` juftliklarini
  # alohida qatorga ajratish (faqat qator chegarasi qo'shiladi,
  # qiymatlar bir xilligicha qoladi).
  if command -v perl >/dev/null 2>&1; then
    perl -0777 -pi -e 's/(["\x27])[ \t]*([A-Z][A-Z0-9_]*=)/$1\n$2/g' "$ENV_FILE" 2>/dev/null || true
  fi

  # Takrorlangan kalitlarni tozalash — har bir kalitdan faqat ENG
  # OXIRGI qatorni qoldiradi, izoh/bo'sh qatorlarga tegilmaydi.
  awk '
    /^[A-Za-z_][A-Za-z0-9_]*=/ {
      split($0, a, "=");
      last[a[1]] = NR;
    }
    { lines[NR] = $0 }
    END {
      for (i = 1; i <= NR; i++) {
        line = lines[i];
        if (line ~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
          split(line, a, "=");
          if (last[a[1]] != i) continue;
        }
        print line;
      }
    }
  ' "$ENV_FILE" > "${ENV_FILE}.__norm_tmp" && mv "${ENV_FILE}.__norm_tmp" "$ENV_FILE"

  ENV_AFTER_FIX=$(cat "$ENV_FILE")
  if [ "$ENV_BEFORE_FIX" != "$ENV_AFTER_FIX" ]; then
    BACKUP_FILE="${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
    printf '%s' "$ENV_BEFORE_FIX" > "$BACKUP_FILE"
    echo "  🛠️  .env faylida formatlash xatosi(lar)i topildi va avtomatik tuzatildi."
    echo "      (Eski nusxa xavfsizlik uchun saqlandi: $BACKUP_FILE)"
    # Faqat oxirgi 5 ta zaxira faylini saqlab qolamiz.
    ls -1t "${ENV_FILE}.bak."* 2>/dev/null | tail -n +6 | xargs -r rm -f
    CHANGED=1
  fi
fi

# Fayl bo'sh emas va oxirida yangi qator (\n) yo'q bo'lsa — avval shuni
# qo'shamiz. Aks holda pastdagi `>>` bilan appendlangan yangi kalit oldingi
# qatorning oxiriga yopishib qolib, ikkalasini ham buzadi (masalan
# `DATABASE_URL="..."JWT_SECRET=` kabi bitta qatorga qo'shilib ketishi —
# bu xato ilgari shu loyihada aynan shunday buzilishga olib kelgan edi).
if [ -s "$ENV_FILE" ] && [ "$(tail -c1 "$ENV_FILE" | wc -l)" -eq 0 ]; then
  echo >> "$ENV_FILE"
fi

set_if_empty() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    local current
    current=$(grep -E "^${key}=" "$ENV_FILE" | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -z "$current" ]; then
      sed -i "s#^${key}=.*#${key}=\"${val}\"#" "$ENV_FILE"
      echo "  🔑 ${key} avtomatik generatsiya qilindi va .env'ga yozildi"
      CHANGED=1
    fi
  else
    echo "${key}=\"${val}\"" >> "$ENV_FILE"
    echo "  🔑 ${key} avtomatik generatsiya qilindi va .env'ga qo'shildi"
    CHANGED=1
  fi
}

set_if_empty "JWT_SECRET" "$(openssl rand -hex 32)"
set_if_empty "ENCRYPTION_KEY" "$(openssl rand -hex 32)"
set_if_empty "TELEGRAM_BOT_INTERNAL_SECRET" "$(openssl rand -hex 24)"
set_if_empty "NODE_ENV" "production"
set_if_empty "APP_URL" "https://${DOMAIN}"

# DATABASE_URL'ni formatini tekshirish (parolni bu yerda tiklay olmaymiz —
# bu faqat deploy-bootstrap.sh'da, PostgreSQL'ga kirish huquqi bor joyda
# qilinadi). Bu yerda faqat aniq buzilgan holatni (masalan boshqa qatorga
# yopishib qolgan qiymatni) ogohlantiramiz, hech narsani o'zgartirmaymiz.
CURRENT_DB_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
case "$CURRENT_DB_URL" in
  postgresql://*|postgres://*) : ;;
  *)
    echo "  ⚠️  DATABASE_URL noto'g'ri formatda yoki bo'sh — bootstrap skripti (deploy-bootstrap.sh) buni avtomatik tuzatadi."
    ;;
esac

if [ "$CHANGED" = "1" ]; then
  echo "  ⚠️  Eslatma: yuqoridagi tuzatish(lar) endi ${ENV_FILE} faylida saqlangan va BUNDAN BUYON HAR DOIM shu holat ishlatiladi — mavjud qiymatlar qayta generatsiya qilinmaydi."
else
  echo "  ✔ .env formati va barcha majburiy kalitlar joyida — hech narsa o'zgartirilmadi."
fi

exit 0
