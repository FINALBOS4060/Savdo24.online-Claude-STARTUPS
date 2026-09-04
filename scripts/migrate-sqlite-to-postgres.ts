// scripts/migrate-sqlite-to-postgres.ts
//
// SQLite (dev.db) ichidagi HAQIQIY foydalanuvchilar/e'lonlar/to'lovlar
// ma'lumotlarini yangi sozlangan PostgreSQL bazasiga ko'chiradi.
//
// NEGA KERAK: DATABASE_URL sozlanmagan bo'lsa, server avtomatik SQLite
// (dev.db) rejimida ishlaydi (server.ts, "isPostgres" tekshiruvi). Agar
// DATABASE_URL'ni shunchaki PostgreSQL'ga sozlab qo'ysangiz-u, bu skriptni
// ishlatmasangiz — sayt YANGI, BO'SH bazadan boshlaydi va SQLite'dagi
// mavjud foydalanuvchilaringiz/e'lonlaringiz saytda "yo'qolgandek" ko'rinadi
// (aslida dev.db faylida saqlanib qoladi, lekin server endi uni o'qimaydi).
//
// QANDAY ISHLATISH (batafsil qadamlar chat javobida berilgan):
//   1) PostgreSQL o'rnatilgan va DATABASE_URL .env'da sozlangan bo'lishi
//      kerak (lekin server HALI PostgreSQL rejimida ishga tushirilmagan
//      bo'lishi kerak — ya'ni buni ishga tushirishdan oldin bazani bo'sh
//      holda tayyor qilib, faqat jadvallarni yaratib qo'ying):
//        npx prisma migrate deploy --schema=prisma/schema.prisma
//   2) Shu skriptni ishga tushiring:
//        npx tsx scripts/migrate-sqlite-to-postgres.ts
//   3) Skript oxirida chiqqan hisobotni SQLite'dagi asl sonlar bilan
//      solishtirib tekshiring.
//   4) Faqat shundan keyin serverni PostgreSQL rejimida qayta ishga
//      tushiring (pm2 restart).
//
// XAVFSIZLIK: bu skript SQLite faylini o'zgartirmaydi/o'chirmaydi — faqat
// o'qiydi. PostgreSQL tarafida esa faqat `create` qiladi (agar allaqachon
// bir xil ID mavjud bo'lsa, o'sha yozuv o'tkazib yuboriladi — ya'ni
// skriptni ikki marta ishga tushirish xavfsiz, dublikat yaratmaydi).

import path from "path";
import { createRequire } from "module";
import { PrismaClient as PostgresClient } from "@prisma/client";

const _require = createRequire(import.meta.url);
const SQLiteClient = _require(path.join(process.cwd(), "src/generated/sqlite-client/index.js")).PrismaClient;

const sqlite = new SQLiteClient();
const pg = new PostgresClient();

// FK bog'liqligiga ko'ra XAVFSIZ tartib (avval ota, keyin bola yozuvlar) —
// prisma/schema.prisma'dagi @relation(fields: ...) satrlaridan qo'lda
// chiqarilgan.
const MODELS_IN_ORDER = [
  "user",
  "category",
  "startup",
  "subscriber",
  "telegramDelivery",
  "sponsorChannel",
  "setting",
  "listingTier",
  "analyticsEvent",
  "supportTicket",
  "payment",
  "idea",
  "ideaVote",
  "review",
  "dispute",
  "refreshToken",
  "report",
  "auditLog",
  "topBoost",
  "vipSubscription",
  "conversation",
  "message",
  "referral",
  "referralReward",
  "listingSubscription",
  "escrowPayment",
  "disputeResolution",
  "b2BAccount",
  "b2BOrder",
  "notification"
];

async function migrateModel(modelName: string) {
  const sqliteModel = (sqlite as any)[modelName];
  const pgModel = (pg as any)[modelName];

  if (!sqliteModel || !pgModel) {
    console.warn(`⚠️  "${modelName}" modeli topilmadi (client'da yo'q) — o'tkazib yuborildi.`);
    return { model: modelName, sourceCount: 0, migrated: 0, skipped: 0, failed: 0 };
  }

  const rows = await sqliteModel.findMany();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await pgModel.create({ data: row });
      migrated++;
    } catch (err: any) {
      // P2002: unique constraint (ID allaqachon mavjud) — bu skript qayta
      // ishga tushirilganda kutilgan holat, xato emas.
      if (err?.code === "P2002") {
        skipped++;
      } else {
        failed++;
        console.error(`❌ ${modelName} ID=${row.id ?? "?"} ko'chirilmadi:`, err?.message || err);
      }
    }
  }

  return { model: modelName, sourceCount: rows.length, migrated, skipped, failed };
}

async function main() {
  console.log("🚀 SQLite -> PostgreSQL ma'lumotlarini ko'chirish boshlandi...\n");

  const results = [];
  for (const model of MODELS_IN_ORDER) {
    const result = await migrateModel(model);
    results.push(result);
    console.log(
      `  ${result.model.padEnd(22)} manba: ${String(result.sourceCount).padStart(5)}` +
      `  ko'chirildi: ${String(result.migrated).padStart(5)}` +
      `  o'tkazildi (mavjud): ${String(result.skipped).padStart(5)}` +
      (result.failed > 0 ? `  ❌ XATO: ${result.failed}` : "")
    );
  }

  const totalFailed = results.reduce((acc, r) => acc + r.failed, 0);
  console.log("\n" + "=".repeat(60));
  if (totalFailed > 0) {
    console.log(`⚠️  Ko'chirish tugadi, lekin ${totalFailed} ta yozuvda xato bor edi — yuqoridagi loglarni tekshiring.`);
  } else {
    console.log("✅ Barcha ma'lumotlar muvaffaqiyatli ko'chirildi.");
  }
  console.log("Endi PostgreSQL'dagi sonlarni yuqoridagi 'manba' ustuni bilan solishtirib tekshiring.");
}

main()
  .catch((err) => {
    console.error("🔴 Ko'chirishda kutilmagan xatolik:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await pg.$disconnect();
  });
