#!/usr/bin/env bash
# ============================================================
# scripts/verify-migrations-cover-schema.sh
#
# NEGA KERAK (2026-08-14 voqeasi asosida):
# Server butunlay tozalanib, bo'sh bazaga "prisma migrate deploy"
# ishlatilganda, "20260802000000_add_review_dispute_unique_constraints"
# migratsiyasi "Review"/"Dispute" jadvallariga UNIQUE INDEX qo'shishga
# urindi — lekin bu ikki jadvalning O'ZI hech qanday migratsiyada
# yaratilmagan edi (ular eski serverda "prisma db push" bilan,
# migratsiyasiz qo'shilgan edi — buni prisma/migrations/README_MIGRATIONS.md
# ochiq yozgan: "faqat 6/30 model"). Bo'sh serverda bu darhol P3009 bilan
# to'xtaydi. Eski (tozalanmagan) serverda esa muammo yashiringan edi,
# chunki jadvallar "db push" orqali allaqachon bor edi.
#
# Bu skript "deploy.sh" HAR SAFAR "migrate deploy"ni ishga tushirishdan
# OLDIN chaqiradi: schema.prisma'dagi HAR BIR model uchun, migrations/
# papkasidagi biror migration.sql faylida "CREATE TABLE "ModelNomi""
# borligini tekshiradi. Agar biror model uchun bunday qator topilmasa —
# demak migratsiya tarixi to'liq emas va "migrate deploy" bo'sh (yoki
# qisman bo'sh) bazada muvaffaqiyatsiz tugaydi (yoki battarrog'i — eski,
# tozalanmagan bazada situatsiyani "yashirib" qo'yadi).
#
# Bunday holatda skript "migrate deploy"ga YO'L BERMAYDI (exit 1) va
# prisma/migrations/README_MIGRATIONS.md'da yozilgan tiklash yo'lini
# ko'rsatadi — taxmin qilib avtomatik davom etmaydi, chunki noto'g'ri
# taxmin production bazani buzishi mumkin.
#
# Ishlatish:
#   bash scripts/verify-migrations-cover-schema.sh [schema yo'li] [migrations papkasi]
# ============================================================
set -uo pipefail

SCHEMA="${1:-prisma/schema.prisma}"
MIGRATIONS_DIR="${2:-prisma/migrations}"

if [ ! -f "$SCHEMA" ]; then
  echo "✘ Schema fayli topilmadi: $SCHEMA"
  exit 1
fi
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "✘ Migratsiyalar papkasi topilmadi: $MIGRATIONS_DIR"
  exit 1
fi

# Eslatma: bu tekshiruv @@map(...) bilan boshqacha jadval nomi
# berilgan modellarni hisobga OLMAYDI (hozircha loyihada @@map
# ishlatilmagan — agar kelajakda qo'shilsa, shu skriptni yangilang).
mapfile -t MODELS < <(grep -E '^model[[:space:]]+[A-Za-z0-9_]+[[:space:]]*\{' "$SCHEMA" | sed -E 's/^model[[:space:]]+([A-Za-z0-9_]+).*/\1/')

if [ "${#MODELS[@]}" -eq 0 ]; then
  echo "✘ schema.prisma'da hech qanday model topilmadi — tekshiruv o'zi buzilgan bo'lishi mumkin."
  exit 1
fi

declare -a MISSING
for model in "${MODELS[@]}"; do
  if ! grep -rqE "CREATE TABLE \"${model}\"" "$MIGRATIONS_DIR"/*/migration.sql 2>/dev/null; then
    MISSING+=("$model")
  fi
done

TOTAL="${#MODELS[@]}"
MISSING_COUNT="${#MISSING[@]}"
FOUND_COUNT=$((TOTAL - MISSING_COUNT))

if [ "$MISSING_COUNT" -eq 0 ]; then
  echo "✅ Migratsiya tarixi to'liq: barcha ${TOTAL} model uchun CREATE TABLE mavjud."
  exit 0
fi

echo "❌ MIGRATSIYA TARIXI TO'LIQ EMAS: ${FOUND_COUNT}/${TOTAL} model migratsiyada yaratilgan."
echo ""
echo "   Quyidagi modellar uchun HECH QANDAY migration.sql'da"
echo "   \"CREATE TABLE\" topilmadi (ehtimol ular eski serverda"
echo "   'prisma db push' bilan migratsiyasiz qo'shilgan edi):"
echo ""
for m in "${MISSING[@]}"; do
  echo "     ✘ $m"
done
echo ""
echo "   Bo'sh (yoki qisman bo'sh) bazada 'prisma migrate deploy' bu"
echo "   modellarga tayanadigan keyingi migratsiyalarda (masalan indeks"
echo "   yoki FK qo'shadigan) muvaffaqiyatsiz to'xtaydi (P3009)."
echo ""
echo "   TO'XTATILDI — avtomatik taxmin qilinmadi. Tiklash yo'li uchun"
echo "   qarang: prisma/migrations/README_MIGRATIONS.md"
echo "   (qisqacha: avval 'npx prisma db push' bilan bazani schema.prisma'ga"
echo "   to'liq tenglashtiring, so'ng har bir eski migratsiyani"
echo "   'npx prisma migrate resolve --applied <nomi>' bilan tarixga"
echo "   qo'lda belgilang — shundan keyingina 'migrate deploy' xavfsiz.)"
exit 1
