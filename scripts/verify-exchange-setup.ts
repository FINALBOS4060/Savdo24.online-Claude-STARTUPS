// Bu skript "obunachi yig'ish" (kanal almashish) funksiyasi ishlashi
// uchun kerakli baza jadvallari HAQIQATAN mavjudligini tekshiradi —
// deploy qilishdan OLDIN yoki muammo davom etsa keyin ham ishga
// tushirib ko'rish mumkin.
//
// Ishlatish:
//   npx tsx scripts/verify-exchange-setup.ts
//
// .env faylidagi DATABASE_URL'ga qarab avtomatik Postgres yoki SQLite
// klientini tanlaydi (loyihaning boshqa skriptlari — masalan
// make-admin.ts — bilan bir xil uslub).
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

async function main() {
  console.log(`Baza turi: ${isPostgres ? "PostgreSQL (DATABASE_URL orqali)" : "SQLite (prisma/dev.db)"}`);
  console.log("");

  let hasError = false;

  // 1) ExchangeChannel jadvali mavjudmi va yozish/o'qish ishlaydimi?
  try {
    const count = await prisma.exchangeChannel.count();
    console.log(`✅ ExchangeChannel jadvali mavjud (hozircha ${count} ta kanal bor).`);
  } catch (err: unknown) {
    hasError = true;
    console.error("❌ ExchangeChannel jadvali TOPILMADI yoki so'rov xatoga uchradi:");
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
    console.error("   YECHIM: quyidagi buyruqni ishga tushiring:");
    console.error(
      isPostgres
        ? "   npx prisma migrate deploy --schema=prisma/schema.prisma"
        : "   npx prisma db push --schema=prisma/schema.sqlite.prisma"
    );
  }

  // 2) ExchangeSubscription jadvali mavjudmi?
  try {
    const count = await prisma.exchangeSubscription.count();
    console.log(`✅ ExchangeSubscription jadvali mavjud (hozircha ${count} ta obuna bor).`);
  } catch (err: unknown) {
    hasError = true;
    console.error("❌ ExchangeSubscription jadvali TOPILMADI yoki so'rov xatoga uchradi:");
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2b) ExchangeReferral / ExchangeReferralCredit jadvallari mavjudmi?
  // (referal tizimi shu ikkitasiz umuman ishlamaydi)
  try {
    const count = await prisma.exchangeReferral.count();
    console.log(`✅ ExchangeReferral jadvali mavjud (hozircha ${count} ta referal bor).`);
  } catch (err: unknown) {
    hasError = true;
    console.error("❌ ExchangeReferral jadvali TOPILMADI yoki so'rov xatoga uchradi:");
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
    console.error(
      isPostgres
        ? "   npx prisma migrate deploy --schema=prisma/schema.prisma"
        : "   npx prisma db push --schema=prisma/schema.sqlite.prisma"
    );
  }
  try {
    const count = await prisma.exchangeReferralCredit.count();
    console.log(`✅ ExchangeReferralCredit jadvali mavjud (hozircha ${count} ta yozuv bor).`);
  } catch (err: unknown) {
    hasError = true;
    console.error("❌ ExchangeReferralCredit jadvali TOPILMADI yoki so'rov xatoga uchradi:");
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2c) ExchangeChannelReport jadvali mavjudmi? (kanaldan shikoyat qilish)
  try {
    const count = await prisma.exchangeChannelReport.count();
    console.log(`✅ ExchangeChannelReport jadvali mavjud (hozircha ${count} ta shikoyat bor).`);
  } catch (err: unknown) {
    hasError = true;
    console.error("❌ ExchangeChannelReport jadvali TOPILMADI yoki so'rov xatoga uchradi:");
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
    console.error(
      isPostgres
        ? "   npx prisma migrate deploy --schema=prisma/schema.prisma"
        : "   npx prisma db push --schema=prisma/schema.sqlite.prisma"
    );
  }

  // 3) haqiqiy yozib-o'chirish orqali to'liq tekshiruv (yozish huquqi,
  //    unique constraint, va h.k. ham ishlashini tasdiqlaydi — faqat
  //    "count" o'qish huquqi yetarli emas, chunki yozish alohida
  //    muammo bo'lishi mumkin, masalan SQLite fayliga yozish ruxsati).
  if (!hasError) {
    const testOwnerId = "verify-script-test-owner";
    const testChannelId = `verify-script-test-${Date.now()}`;
    try {
      const created = await prisma.exchangeChannel.create({
        data: {
          ownerTelegramId: testOwnerId,
          channelId: testChannelId,
          title: "Tekshiruv uchun vaqtinchalik yozuv"
        }
      });
      // 3b) "Har soatda kanal egasiga bildirishnoma" funksiyasi uchun
      // qo'shilgan lastJoinNotifiedAt ustuni ham TO'LIQ ishlashini
      // (yozish/o'qish) tekshiramiz — yuqoridagi oddiy create bu
      // ustunni UMUMAN qo'zg'atmaydi (Postgres qatnashmagan ustunni
      // e'tiborsiz qoldiraveradi), shu sabab migratsiya bajarilmagan
      // holatni faqat shu aniq update orqaligina aniqlash mumkin.
      await prisma.exchangeChannel.update({
        where: { id: created.id },
        data: { lastJoinNotifiedAt: new Date() }
      });
      // 3c) TUZATILDI (tizim tekshiruvi paytida topilgan haqiqiy bug
      // sababli qo'shildi): lastInactivityReminderAt ustuni ham xuddi
      // lastJoinNotifiedAt kabi — oddiy create uni umuman qo'zg'atmaydi,
      // faqat aniq update orqaligina migratsiya bajarilmagan holatni
      // aniqlash mumkin. Aynan shu ustunga migratsiya YOZILMAGANI
      // (qarang: 20260817010000_add_exchange_inactivity_reminder)
      // /inactivity-reminder-report endpointini production'da jimgina
      // butunlay ishlamay qo'ygan edi — bu skript o'shanda buni
      // TUTMAGAN, chunki faqat lastJoinNotifiedAt tekshirilardi.
      await prisma.exchangeChannel.update({
        where: { id: created.id },
        data: { lastInactivityReminderAt: new Date() }
      });
      await prisma.exchangeChannel.delete({ where: { id: created.id } });
      console.log("✅ Yozish/o'chirish (create/delete) ham to'g'ri ishlayapti.");
      console.log("✅ lastJoinNotifiedAt ustuni (soatlik bildirishnoma kursori) ham to'g'ri ishlayapti.");
      console.log("✅ lastInactivityReminderAt ustuni (faollik eslatmasi kursori) ham to'g'ri ishlayapti.");
    } catch (err: unknown) {
      hasError = true;
      console.error("❌ Jadval bor, lekin yozishda xatolik chiqdi (ehtimol lastJoinNotifiedAt ustuni yo'q):");
      console.error(`   ${err instanceof Error ? err.message : String(err)}`);
      console.error("   YECHIM: quyidagi buyruqni ishga tushiring:");
      console.error(
        isPostgres
          ? "   npx prisma migrate deploy --schema=prisma/schema.prisma"
          : "   npx prisma db push --schema=prisma/schema.sqlite.prisma"
      );
    }
  }

  console.log("");
  if (hasError) {
    console.error("NATIJA: ❌ Obuna almashish tizimi HALI TO'LIQ ishlamaydi. Yuqoridagi yechimni bajaring.");
    process.exit(1);
  } else {
    console.log("NATIJA: ✅ Obuna almashish tizimi uchun baza tomoni to'liq TAYYOR.");
    console.log("   Agar botda hali ham xatolik chiqsa, sabab endi boshqa joyda (masalan bot token,");
    console.log("   TELEGRAM_BOT_INTERNAL_SECRET, yoki APP_URL sozlamalarida) — server loglarini tekshiring.");
  }
}

main()
  .catch((err) => {
    console.error("Kutilmagan xatolik:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
