// BIR MARTALIK TUZATISH SKRIPTI (2026-08-17 bug uchun).
//
// src/routes/exchange-channels.ts'dagi /confirm-subscribe endpointi
// ILGARI (tuzatishdan oldin) kanalni HALI /browse navbatiga umuman
// chiqmagan bo'lsa ham (lastOfferedAt=NULL) suspend qilib qo'yardi.
// Kod endi tuzatildi (qarang: scripts/verify-exchange-queue-fix.ts),
// LEKIN bu — faqat KELAJAKDAGI hodisalarga taalluqli. Bazada bu bug
// tufayli ALLAQACHON suspend bo'lib qolgan kanallar (masalan "Online
// dars") kod tuzatilgani bilan o'zi qayta faollashmaydi — chunki hech
// narsa ularni qayta tekshirmaydi.
//
// Bu skript aynan o'sha holatdagi kanallarni topib, QAYTA FAOLLASHTIRADI:
//   isActive = false
//   suspendedDueToLapse = false   (qoidabuzarlik tufayli emas)
//   blockedByAdmin = false        (admin qo'lda bloklamagan)
//   lastOfferedAt IS NULL         (hech qachon navbatga chiqmagan)
//   suspendedReason = aynan shu bug tufayli qo'yiladigan matn
//
// Bu 5 shart bir vaqtda bajarilgan kanal FAQAT shu bug qurboni bo'lishi
// mumkin — chunki boshqa hech qanday yo'l bilan (referal, admin blok,
// lapse) kanal shu aniq matn bilan suspend bo'lmaydi.
//
// Ishlatish (avval --dry-run bilan ko'rib chiqish tavsiya etiladi):
//   npx tsx scripts/repair-never-offered-suspended-channels.ts --dry-run
//   npx tsx scripts/repair-never-offered-suspended-channels.ts
import { PrismaClient as PGClient } from "@prisma/client";
import { PrismaClient as SQLiteClient } from "../src/generated/sqlite-client/index.js";
import dotenv from "dotenv";

dotenv.config();

const isPostgres = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"));
const prisma: any = isPostgres
  ? new PGClient()
  : new SQLiteClient({
      datasources: {
        db: {
          url: "file:./dev.db"
        }
      }
    });

const BUG_SUSPEND_REASON = "Boshqa kanalga obuna bo'lganingiz uchun obunachi qo'shildi va navbatdan olib tashlandi.";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`Baza turi: ${isPostgres ? "PostgreSQL (DATABASE_URL orqali)" : "SQLite (prisma/dev.db)"}`);
  console.log(DRY_RUN ? "Rejim: --dry-run (hech narsa o'zgartirilmaydi, faqat ko'rsatiladi)" : "Rejim: HAQIQIY tuzatish (bazaga yoziladi)");
  console.log("");

  const affected = await prisma.exchangeChannel.findMany({
    where: {
      isActive: false,
      suspendedDueToLapse: false,
      blockedByAdmin: false,
      lastOfferedAt: null,
      suspendedReason: BUG_SUSPEND_REASON
    }
  });

  if (affected.length === 0) {
    console.log("✅ Bug qurboni bo'lgan kanal topilmadi — tuzatishga hojat yo'q.");
    return;
  }

  console.log(`Topildi: ${affected.length} ta kanal — bug tufayli hech qachon navbatga chiqmasdan suspend bo'lgan:`);
  console.log("");
  for (const c of affected) {
    console.log(`  #${c.id}  "${c.title}"  (egasi: ${c.ownerTelegramId}, qo'shilgan: ${c.createdAt})`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("Haqiqiy tuzatish uchun --dry-run bayrog'isiz qayta ishga tushiring.");
    return;
  }

  const result = await prisma.exchangeChannel.updateMany({
    where: {
      id: { in: affected.map((c: any) => c.id) }
    },
    data: {
      isActive: true,
      suspendedReason: null
    }
  });

  console.log(`✅ ${result.count} ta kanal qayta faollashtirildi (isActive=true, suspendedReason=null).`);
  console.log("   Ular endi /browse navbatida ko'rina boshlaydi (lastOfferedAt hali NULL bo'lgani uchun");
  console.log("   navbatning eng boshida, birinchi navbatda taklif qilinadi).");
}

main()
  .catch((err) => {
    console.error("Kutilmagan xatolik:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
