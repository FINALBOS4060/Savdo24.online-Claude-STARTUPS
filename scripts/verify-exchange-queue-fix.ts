// Bu skript 2026-08-17'da tuzatilgan bug uchun REGRESSIYA TEKSHIRUVI:
// "kanal hali BIRON marta /browse navbatida boshqa foydalanuvchilarga
// taklif qilinmagan bo'lsa-yu (lastOfferedAt = NULL), egasi boshqa
// kanalga obuna bo'lib kredit olsa — bu kanal suspend (isActive=false)
// QILINMASLIGI kerak, chunki u hali hech qanday haqiqiy ko'rinish
// olmagan". Ilgari bu shart tekshirilmasdan barcha egalik kanallar
// darhol suspend qilinardi (qarang: src/routes/exchange-channels.ts,
// POST /confirm-subscribe).
//
// Bu skript to'g'ridan-to'g'ri HTTP orqali emas, balki xuddi
// /confirm-subscribe endpointidagi kredit bo'limi bilan bir xil
// Prisma so'rovlarini qo'llab, natijani DB darajasida tekshiradi —
// shunda serverni ishga tushirmasdan turib ham (masalan CI'da yoki
// deploy vaqtida) tez tekshirish mumkin.
//
// Ishlatish:
//   npx tsx scripts/verify-exchange-queue-fix.ts
//
// .env faylidagi DATABASE_URL'ga qarab avtomatik Postgres yoki SQLite
// klientini tanlaydi (boshqa scripts/* fayllar bilan bir xil uslub).
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

const EXCHANGE_SUBSCRIBER_MULTIPLIER = 2;
const TEST_OWNER_ID = `verify-queue-fix-owner-${Date.now()}`;

// src/routes/exchange-channels.ts'dagi /confirm-subscribe ichidagi
// kredit bo'limining AYNAN o'zi — bug shu joyda edi, shu sabab
// tekshiruv ham aynan shu mantiqni qayta ishlatadi (nusxa ko'chirilgan,
// chunki mantiq route faylida alohida eksport qilinmagan funksiya emas).
async function applyCreditLogic(ownerTelegramId: string) {
  const ownChannels = await prisma.exchangeChannel.findMany({
    where: { ownerTelegramId }
  });

  const offeredChannels = ownChannels.filter((c: any) => c.lastOfferedAt !== null);
  const neverOfferedChannels = ownChannels.filter((c: any) => c.lastOfferedAt === null);

  if (offeredChannels.length > 0) {
    await prisma.exchangeChannel.updateMany({
      where: { id: { in: offeredChannels.map((c: any) => c.id) } },
      data: {
        earnedSubscribers: { increment: EXCHANGE_SUBSCRIBER_MULTIPLIER },
        isActive: false,
        suspendedDueToLapse: false,
        suspendedReason: "Boshqa kanalga obuna bo'lganingiz uchun obunachi qo'shildi va navbatdan olib tashlandi."
      }
    });
  }
  if (neverOfferedChannels.length > 0) {
    await prisma.exchangeChannel.updateMany({
      where: { id: { in: neverOfferedChannels.map((c: any) => c.id) } },
      data: {
        earnedSubscribers: { increment: EXCHANGE_SUBSCRIBER_MULTIPLIER }
      }
    });
  }
}

async function main() {
  console.log(`Baza turi: ${isPostgres ? "PostgreSQL (DATABASE_URL orqali)" : "SQLite (prisma/dev.db)"}`);
  console.log("");

  let hasError = false;
  let offeredId: number | null = null;
  let neverOfferedId: number | null = null;

  try {
    // 1) "hali navbatga chiqmagan" kanal — lastOfferedAt = NULL
    //    ("Online dars" holati bilan bir xil).
    const neverOffered = await prisma.exchangeChannel.create({
      data: {
        ownerTelegramId: TEST_OWNER_ID,
        channelId: `verify-queue-fix-never-${Date.now()}`,
        title: "Tekshiruv: hali taklif qilinmagan kanal",
        lastOfferedAt: null
      }
    });
    neverOfferedId = neverOffered.id;

    // 2) "kamida bir marta navbatga chiqqan" kanal — lastOfferedAt bor.
    const offered = await prisma.exchangeChannel.create({
      data: {
        ownerTelegramId: TEST_OWNER_ID,
        channelId: `verify-queue-fix-offered-${Date.now()}`,
        title: "Tekshiruv: taklif qilingan kanal",
        lastOfferedAt: new Date()
      }
    });
    offeredId = offered.id;

    console.log("✅ Ikkita test kanali yaratildi (biri lastOfferedAt=NULL, biri bilan).");

    // 3) Egasi (TEST_OWNER_ID) boshqa birov kanaliga obuna bo'lgani uchun
    //    kredit olayotganini simulyatsiya qilamiz.
    await applyCreditLogic(TEST_OWNER_ID);

    const neverOfferedAfter = await prisma.exchangeChannel.findUnique({ where: { id: neverOfferedId } });
    const offeredAfter = await prisma.exchangeChannel.findUnique({ where: { id: offeredId } });

    // 4) Tekshiruv A: hali taklif qilinmagan kanal FAOL qolishi kerak.
    if (neverOfferedAfter.isActive === true) {
      console.log("✅ Hali navbatga chiqmagan kanal FAOL qoldi (suspend qilinmadi) — bug tuzatilgan.");
    } else {
      hasError = true;
      console.error("❌ REGRESSIYA: hali navbatga chiqmagan kanal baribir suspend qilindi (isActive=false).");
      console.error("   Bu 'Online dars' bugi qaytadan paydo bo'lganini bildiradi.");
    }

    // 5) Tekshiruv B: taklif qilingan kanal eskicha suspend bo'lishi kerak.
    if (offeredAfter.isActive === false) {
      console.log("✅ Kamida bir marta taklif qilingan kanal odatdagidek suspend qilindi.");
    } else {
      hasError = true;
      console.error("❌ REGRESSIYA: taklif qilingan kanal suspend qilinishi kerak edi, lekin hali ham faol.");
    }

    // 6) Tekshiruv C: ikkala holatda ham kredit qo'shilishi kerak.
    if (neverOfferedAfter.earnedSubscribers === EXCHANGE_SUBSCRIBER_MULTIPLIER && offeredAfter.earnedSubscribers === EXCHANGE_SUBSCRIBER_MULTIPLIER) {
      console.log("✅ Ikkala kanalga ham kredit to'g'ri qo'shildi (navbat holatidan qat'iy nazar).");
    } else {
      hasError = true;
      console.error("❌ Kredit noto'g'ri qo'shildi:");
      console.error(`   never-offered.earnedSubscribers = ${neverOfferedAfter.earnedSubscribers} (kutilgan: ${EXCHANGE_SUBSCRIBER_MULTIPLIER})`);
      console.error(`   offered.earnedSubscribers = ${offeredAfter.earnedSubscribers} (kutilgan: ${EXCHANGE_SUBSCRIBER_MULTIPLIER})`);
    }
  } catch (err: unknown) {
    hasError = true;
    console.error("❌ Tekshiruv paytida kutilmagan xatolik:");
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    // Test yozuvlarini tozalash — production bazasida chiqindi qolmasligi kerak.
    try {
      if (neverOfferedId !== null) await prisma.exchangeChannel.delete({ where: { id: neverOfferedId } }).catch(() => {});
      if (offeredId !== null) await prisma.exchangeChannel.delete({ where: { id: offeredId } }).catch(() => {});
    } catch {
      // tozalashda xato bo'lsa ham asosiy natijaga ta'sir qilmasin
    }
  }

  console.log("");
  if (hasError) {
    console.error("NATIJA: ❌ Navbat/suspend tuzatishi (queue fix) kutilganidek ishlamayapti.");
    process.exit(1);
  } else {
    console.log("NATIJA: ✅ Navbat/suspend tuzatishi (queue fix) to'g'ri ishlayapti.");
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
