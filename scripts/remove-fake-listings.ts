// Bir martalik tozalash skripti: bazada allaqachon yaratilgan 12 ta soxta demo
// e'lonni (va ularga bog'liq har qanday test ma'lumotlarini) butunlay o'chiradi.
// Kategoriyalarga tegmaydi — ular real sayt uchun kerakli tuzilma.
//
// Ishga tushirish:
//   npx tsx scripts/remove-fake-listings.ts          (SQLite/lokal uchun)
//   npx tsx scripts/remove-fake-listings.ts --prod   (PostgreSQL/production uchun)

import dotenv from "dotenv";
dotenv.config();

const FAKE_STARTUP_IDS = [
  "ecoflow-systems",
  "neuralpath-ai",
  "greenhorizon",
  "pulsemetrics",
  "quantumpay-ai",
  "greenlogistics",
  "retroarcade-io",
  "ecommerce-prompts",
  "design-kit-3d",
  "uztranslate-ai-bot",
  "midjourney-realistic-prompts",
  "notion-pm-template",
];

async function main() {
  const useProd = process.argv.includes("--prod");
  const { PrismaClient } = useProd
    ? await import("@prisma/client")
    : await import("../src/generated/sqlite-client/index.js" as any);

  const prisma = new PrismaClient();

  try {
    console.log(`Quyidagi ${FAKE_STARTUP_IDS.length} ta soxta e'lon o'chirilmoqda...`);

    const where = { startupId: { in: FAKE_STARTUP_IDS } };

    // Bog'liq yozuvlarni avval o'chiramiz (foreign key xatosiga yo'l qo'ymaslik uchun)
    const deletedMessages = await prisma.message.deleteMany({
      where: { conversation: { startupId: { in: FAKE_STARTUP_IDS } } },
    }).catch(() => ({ count: 0 }));
    const deletedConversations = await prisma.conversation.deleteMany({ where }).catch(() => ({ count: 0 }));
    const deletedReviews = await prisma.review.deleteMany({ where }).catch(() => ({ count: 0 }));
    // MUHIM: IdeaVote.ideaId oddiy Int (FK emas), shuning uchun avval shu
    // g'oyalarga tegishli ovozlarni o'chirmasak, Idea o'chirilganda xato ham
    // chiqmasdi va soxta g'oyalarga qo'yilgan "etim" IdeaVote yozuvlari
    // bazada abadiy qolib ketardi (TelegramDelivery'dagi bilan bir xil muammo).
    const fakeIdeaIds = (
      await prisma.idea.findMany({ where, select: { id: true } })
    ).map((i: { id: number }) => i.id);
    const deletedIdeaVotes = fakeIdeaIds.length
      ? await prisma.ideaVote.deleteMany({ where: { ideaId: { in: fakeIdeaIds } } }).catch(() => ({ count: 0 }))
      : { count: 0 };
    const deletedIdeas = await prisma.idea.deleteMany({ where }).catch(() => ({ count: 0 }));
    const deletedTopBoosts = await prisma.topBoost.deleteMany({ where }).catch(() => ({ count: 0 }));
    const deletedSubs = await prisma.listingSubscription.deleteMany({ where }).catch(() => ({ count: 0 }));
    // TelegramDelivery Startup bilan qattiq (relation) tashqi kalit orqali
    // bog'lanmagan (shunchaki startupId String maydoni), shuning uchun uni
    // tozalamasak ham startapni o'chirishda xatolik chiqmaydi — lekin bu
    // fayldagi maqsad ("bog'liq har qanday test ma'lumotlarini o'chirish")
    // buzilib, soxta e'lonlarga tegishli "etim" Telegram token yozuvlari
    // bazada abadiy qolib ketardi. Endi ular ham tozalanadi.
    const deletedTelegramDeliveries = await prisma.telegramDelivery.deleteMany({ where }).catch(() => ({ count: 0 }));
    // MUHIM: Dispute.paymentId va EscrowPayment.paymentId — Payment ga majburiy
    // (cascade bo'lmagan) tashqi kalitlar. DisputeResolution esa EscrowPayment
    // ga bog'liq. Shuning uchun quyidagi tartib SHART: avval DisputeResolution,
    // keyin EscrowPayment va Dispute, ENG OXIRIDA Payment — aks holda to'lovni
    // o'chirish xatoga uchraydi (jimgina yutilib, keyinroq startapni o'chirishda
    // umumiy skript butunlay to'xtab qolishiga sabab bo'ladi).
    const deletedDisputeResolutions = await prisma.disputeResolution.deleteMany({
      where: { escrow: { payment: { startupId: { in: FAKE_STARTUP_IDS } } } },
    }).catch(() => ({ count: 0 }));
    const deletedEscrows = await prisma.escrowPayment.deleteMany({
      where: { payment: { startupId: { in: FAKE_STARTUP_IDS } } },
    }).catch(() => ({ count: 0 }));
    const deletedDisputes = await prisma.dispute.deleteMany({
      where: { payment: { startupId: { in: FAKE_STARTUP_IDS } } },
    }).catch(() => ({ count: 0 }));
    // MUHIM (71-band): ReferralReward.paymentId ham Payment'ga oddiy maydon
    // (FK emas, IdeaVote/TelegramDelivery'dagi bilan bir xil muammo) —
    // to'lovlar pastda o'chirilganda bu yozuvlar "etim" bo'lib bazada
    // abadiy qolib ketardi. Avval shu to'lovlarga tegishli mukofotlarni
    // topib o'chiramiz.
    const fakePaymentIds = (
      await prisma.payment.findMany({ where, select: { id: true } })
    ).map((p: { id: string }) => p.id);
    const deletedReferralRewards = fakePaymentIds.length
      ? await prisma.referralReward.deleteMany({ where: { paymentId: { in: fakePaymentIds } } }).catch(() => ({ count: 0 }))
      : { count: 0 };
    const deletedPayments = await prisma.payment.deleteMany({ where }).catch(() => ({ count: 0 }));

    const deletedStartups = await prisma.startup.deleteMany({
      where: { id: { in: FAKE_STARTUP_IDS } },
    });

    console.log("Tozalash yakunlandi:");
    console.log(`  - ${deletedStartups.count} ta e'lon o'chirildi`);
    console.log(`  - ${deletedPayments.count} ta to'lov yozuvi o'chirildi`);
    console.log(`  - ${deletedIdeas.count} ta g'oya, ${deletedIdeaVotes.count} ta g'oya ovozi o'chirildi`);
    console.log(`  - ${deletedReviews.count} ta sharh o'chirildi`);
    console.log(`  - ${deletedConversations.count} ta suhbat, ${deletedMessages.count} ta xabar o'chirildi`);
    console.log(`  - ${deletedTopBoosts.count} ta TOP-boost, ${deletedSubs.count} ta obuna o'chirildi`);
    console.log(`  - ${deletedTelegramDeliveries.count} ta Telegram yetkazib berish tokeni o'chirildi`);
    console.log(`  - ${deletedReferralRewards.count} ta referral mukofoti o'chirildi`);
    console.log(`  - ${deletedDisputes.count} ta nizo o'chirildi`);
    console.log(`  - ${deletedEscrows.count} ta escrow to'lovi, ${deletedDisputeResolutions.count} ta escrow nizosi o'chirildi`);
    console.log("✅ Sayt endi faqat real e'lonlarni ko'rsatadi.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Tozalashda xatolik yuz berdi:", err);
  process.exit(1);
});
