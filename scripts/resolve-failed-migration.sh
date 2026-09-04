#!/usr/bin/env bash
# ============================================================
# scripts/resolve-failed-migration.sh
#
# Prisma "P3009 — failed migrations found" xatosini XAVFSIZ hal qiladi.
#
# Bu xato shuni bildiradi: bazada muvaffaqiyatsiz tugagan (yarim
# bajarilgan bo'lishi mumkin bo'lgan) migratsiya yozuvi bor, va Prisma
# nima qilishni bilmay to'xtaydi. Buni "prisma migrate resolve
# --rolled-back" bilan ko'r-ko'rona hal qilish XAVFLI: agar migratsiya
# aslida QISMAN bajarilgan bo'lsa (masalan 3ta ustundan 2tasi qo'shilib,
# 3-chisida xato chiqqan bo'lsa), qayta ishga tushirish "column already
# exists" bilan yana yiqiladi yoki ustunlarni ikki marta yaratishga
# urinadi.
#
# Shu skript o'rniga: migratsiyaning SQL faylini o'qib, undagi har bir
# ustun/indeks/constraint HAQIQATDA bazada bor-yo'qligini o'zi
# tekshiradi (information_schema orqali), keyin:
#   - HECH BIRI yo'q bo'lsa      → xavfsiz: --rolled-back (qayta ishlaydi)
#   - HAMMASI bor bo'lsa         → xavfsiz: --applied (allaqachon bajarilgan)
#   - ARALASH (ba'zilari bor)    → TO'XTAYDI, hech narsani taxmin qilmaydi,
#                                   aniq qaysi ustun/indeks bor-yo'qligini
#                                   ko'rsatadi — bu holat qo'lda ko'rib
#                                   chiqishni talab qiladi (baza yaxlitligi
#                                   avtomatlashtirishdan muhimroq).
#
# Ishlatish:
#   bash scripts/resolve-failed-migration.sh <migration_nomi> [.env yo'li]
# ============================================================
set -uo pipefail

MIGRATION_NAME="${1:?Migratsiya nomini bering, masalan: 20260804000000_add_category_approval}"
ENV_FILE="${2:-.env}"
MIGRATION_SQL="prisma/migrations/${MIGRATION_NAME}/migration.sql"

if [ ! -f "$MIGRATION_SQL" ]; then
  echo "✘ Migratsiya fayli topilmadi: $MIGRATION_SQL"
  exit 1
fi

DATABASE_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [ -z "$DATABASE_URL" ]; then
  echo "✘ DATABASE_URL topilmadi ($ENV_FILE)"
  exit 1
fi

# Prisma connection-string'ida "?schema=public" kabi query parametrlar
# bo'lishi mumkin — bular faqat Prisma uchun tushunarli, native "psql"
# ularni TANIMAYDI va "invalid URI query parameter" xatosi bilan
# to'xtaydi. Shu skript psql orqali to'g'ridan-to'g'ri bazaga ulanadi,
# shuning uchun query qismini (agar bo'lsa) olib tashlaymiz — bu faqat
# psql chaqiruvlari uchun ishlatiladi, .env fayliga yozilmaydi va
# Prisma buyruqlariga (masalan "prisma migrate deploy") ta'sir qilmaydi.
PSQL_DATABASE_URL="${DATABASE_URL%%\?*}"

psql_check() {
  # STDOUT'ni STDERR'dan ajratib olamiz — agar psql o'zi ulanolmasa yoki
  # so'rov xato bersa, buni "ustun yo'q" deb XATO tushunmasligimiz kerak.
  # (Aynan shu xato ilgari yuz berdi: ulanish xatosi jimgina yutilib,
  # bor ustun "yo'q" deb noto'g'ri xulosaga kelindi — bu esa productionda
  # allaqachon mavjud "status" ustunini qayta yaratishga urinishga va
  # haqiqiy xatoga olib keldi.)
  local out err rc
  err=$(mktemp)
  out=$(psql "$PSQL_DATABASE_URL" -tAc "$1" 2>"$err")
  rc=$?
  if [ $rc -ne 0 ] || ! echo "$out" | tr -d '[:space:]' | grep -qE '^[tf]$'; then
    echo "PSQL_ERROR::$(cat "$err")"
    rm -f "$err"
    return 1
  fi
  rm -f "$err"
  echo "$out" | tr -d '[:space:]'
}

PRESENT=0
MISSING=0
declare -a REPORT
declare -a MISSING_DDL

# ALTER TABLE "X" ADD COLUMN "y" — ustunlar
while IFS= read -r line; do
  table=$(echo "$line" | sed -E 's/ALTER TABLE "([^"]+)".*/\1/')
  col=$(echo "$line" | sed -E 's/.*ADD COLUMN "([^"]+)".*/\1/')
  exists=$(psql_check "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${col}')")
  if [[ "$exists" == PSQL_ERROR::* ]]; then
    echo "✘ Bazaga ulanib bo'lmadi yoki so'rov xato berdi — bu holatda HECH NARSANI TAXMIN QILMAYMIZ."
    echo "   psql xatosi: ${exists#PSQL_ERROR::}"
    echo "   Iltimos avval bazaga qo'lda ulanishni tekshiring: psql \"$PSQL_DATABASE_URL\""
    exit 3
  elif [ "$exists" = "t" ]; then
    PRESENT=$((PRESENT+1)); REPORT+=("  ✔ ustun ${table}.${col} — MAVJUD")
  else
    MISSING=$((MISSING+1)); REPORT+=("  ✘ ustun ${table}.${col} — YO'Q")
    MISSING_DDL+=("$line")
  fi
done < <(grep -E '^ALTER TABLE .* ADD COLUMN ' "$MIGRATION_SQL")

# CREATE INDEX "x" — indekslar
while IFS= read -r line; do
  idx=$(echo "$line" | sed -E 's/CREATE (UNIQUE )?INDEX "([^"]+)".*/\2/')
  exists=$(psql_check "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='${idx}')")
  if [[ "$exists" == PSQL_ERROR::* ]]; then
    echo "✘ Bazaga ulanib bo'lmadi yoki so'rov xato berdi — bu holatda HECH NARSANI TAXMIN QILMAYMIZ."
    echo "   psql xatosi: ${exists#PSQL_ERROR::}"
    echo "   Iltimos avval bazaga qo'lda ulanishni tekshiring: psql \"$PSQL_DATABASE_URL\""
    exit 3
  elif [ "$exists" = "t" ]; then
    PRESENT=$((PRESENT+1)); REPORT+=("  ✔ indeks ${idx} — MAVJUD")
  else
    MISSING=$((MISSING+1)); REPORT+=("  ✘ indeks ${idx} — YO'Q")
    MISSING_DDL+=("$line")
  fi
done < <(grep -E '^CREATE (UNIQUE )?INDEX ' "$MIGRATION_SQL")

# ADD CONSTRAINT "x" — cheklovlar (FK, unique va h.k.)
while IFS= read -r line; do
  cons=$(echo "$line" | sed -E 's/.*ADD CONSTRAINT "([^"]+)".*/\1/')
  exists=$(psql_check "SELECT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='${cons}')")
  if [[ "$exists" == PSQL_ERROR::* ]]; then
    echo "✘ Bazaga ulanib bo'lmadi yoki so'rov xato berdi — bu holatda HECH NARSANI TAXMIN QILMAYMIZ."
    echo "   psql xatosi: ${exists#PSQL_ERROR::}"
    echo "   Iltimos avval bazaga qo'lda ulanishni tekshiring: psql \"$PSQL_DATABASE_URL\""
    exit 3
  elif [ "$exists" = "t" ]; then
    PRESENT=$((PRESENT+1)); REPORT+=("  ✔ constraint ${cons} — MAVJUD")
  else
    MISSING=$((MISSING+1)); REPORT+=("  ✘ constraint ${cons} — YO'Q")
    MISSING_DDL+=("$line")
  fi
done < <(grep -E 'ADD CONSTRAINT ' "$MIGRATION_SQL")

echo "📋 Migratsiya '${MIGRATION_NAME}' bazadagi haqiqiy holati:"
printf '%s\n' "${REPORT[@]}"
echo ""

if [ "$MISSING" -eq 0 ] && [ "$PRESENT" -gt 0 ]; then
  echo "✔ Barcha o'zgarishlar bazada ALLAQACHON mavjud — migratsiya 'applied' deb belgilanadi (qayta ishga tushirilmaydi)."
  npx prisma migrate resolve --applied "$MIGRATION_NAME" --schema=prisma/schema.prisma
  exit $?
elif [ "$PRESENT" -eq 0 ] && [ "$MISSING" -gt 0 ]; then
  echo "✔ Hech qanday o'zgarish bazaga tushmagan — migratsiya 'rolled-back' deb belgilanadi (keyingi 'migrate deploy'da qaytadan toza bajariladi)."
  npx prisma migrate resolve --rolled-back "$MIGRATION_NAME" --schema=prisma/schema.prisma
  exit $?
else
  echo "⚠️  ARALASH HOLAT: ba'zi o'zgarishlar bazada bor, ba'zilari yo'q."
  echo "    Bu avtomatik hal qilinmaydi — baza yaxlitligini buzish xavfi bor."
  echo ""
  echo "    Yo'q deb topilgan qismlar uchun quyidagi SQL'ni QO'LDA, DIQQAT BILAN"
  echo "    ko'rib chiqib, kerak bo'lsa psql orqali qo'llang:"
  echo ""
  printf '    %s\n' "${MISSING_DDL[@]}"
  echo ""
  echo "    Shundan keyin migratsiyani bajarilgan deb belgilang:"
  echo "      npx prisma migrate resolve --applied ${MIGRATION_NAME} --schema=prisma/schema.prisma"
  exit 2
fi
