import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
// 116-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (Telegram bot bilan ishlaydigan 5 endpoint:
// link, user-stats, verify, sponsor-channels, deliver). Router
// "/api/telegram" ostiga mount qilinadi, yo'llar nisbiy yozilgan.
// Eslatma: /api/telegram/create-payment bu yerga ko'chirilmadi — u
// to'lov yaratish oqimiga (payments/create) yaqinroq, server.ts'da
// qoldirildi.
import {
  prisma,
  getSetting,
  safeCompare,
  getReferralCount
} from "../../server";

const router = Router();

// POST /api/telegram/link — User hisobini bot bilan bog'lash
router.post("/link", async (req: Request, res: Response) => {
  try {
    const secret = req.headers["x-telegram-bot-secret"];
    const internalSecret = await getSetting("TELEGRAM_BOT_INTERNAL_SECRET") || process.env.TELEGRAM_BOT_INTERNAL_SECRET;
    if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
      return res.status(403).json({ error: "Ruxsat etilmagan." });
    }

    const { code, telegramUserId } = req.body;
    if (!code || !telegramUserId) {
      return res.status(400).json({ error: "Kod va telegramUserId majburiy." });
    }

    const user = await prisma.user.findFirst({
      where: { telegramLinkCode: code }
    });

    if (!user) {
      return res.status(404).json({ error: "Noto'g'ri kod." });
    }

    if (user.telegramLinkCodeExpires && new Date() > user.telegramLinkCodeExpires) {
      return res.status(400).json({ error: "Kodning amal qilish muddati tugagan." });
    }

    // Foydalanuvchini yangilash
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramUserId: telegramUserId.toString(),
        telegramLinkCode: null,
        telegramLinkCodeExpires: null,
        verified: true,
        emailVerified: true
      }
    });

    res.json({ success: true, name: user.name });
  } catch (err: any) {
    logger.error({ err }, "Telegram link error");
    res.status(500).json({ error: "Hisobni bog'lashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/user-stats/:telegramUserId — Bot uchun user stats
router.get("/user-stats/:telegramUserId", async (req: Request, res: Response) => {
  const { telegramUserId } = req.params;
  const secret = req.headers["x-telegram-bot-secret"];

  const internalSecret = await getSetting("TELEGRAM_BOT_INTERNAL_SECRET") || process.env.TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { telegramUserId: telegramUserId.toString() },
      include: {
        referrals: {
          include: { rewards: { where: { status: "earned" } } }
        }
      }
    });

    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    const referral = await prisma.referral.findFirst({ where: { referrerId: user.id, isActive: true } });
    const referralCount = await getReferralCount(user.id);
    const totalEarned = user.referrals.reduce((sum: number, r: any) => sum + r.rewards.reduce((s: number, rw: any) => s + Number(rw.rewardAmount), 0), 0);

    // MUHIM: `User` modelida "balance" degan maydon UMUMAN mavjud emas (prisma/schema.prisma'ni
    // tekshiring) — shuning uchun avval bu yerda ishlatilgan `user.balance` doim `undefined`
    // qaytarardi, va Telegram bot buni foydalanuvchiga to'g'ridan-to'g'ri "Balans: undefined USDT"
    // (yoki bo'sh) qilib ko'rsatardi. Endi /api/users/me/earnings endpointidagi kabi, sotuvchining
    // haqiqiy umumiy daromadi (tugallangan to'lovlardagi sellerPayoutAmount yig'indisi) hisoblanadi.
    const completedSales = await prisma.payment.findMany({
      where: { status: "completed", startup: { userId: user.id } }
    });
    const balance = completedSales.reduce((sum: number, p: any) => sum + (p.sellerPayoutAmount ? Number(p.sellerPayoutAmount) : 0), 0);

    res.json({
      name: user.name,
      email: user.email,
      balance,
      referralCode: referral?.code,
      referralCount,
      totalEarned
    });
  } catch (err) {
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// GET /api/telegram/verify/:token
// 14-MUAMMO: endpoint umuman himoyasiz edi, endi faqat bot chaqira oladi.
router.get("/verify/:token", async (req: Request, res: Response) => {
  // Ichki maxfiy kalitni tekshir (faqat bot chaqira olishi uchun)
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = await getSetting("TELEGRAM_BOT_INTERNAL_SECRET") || process.env.TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat berilmagan." });
  }

  try {
    const { token } = req.params;
    const delivery = await prisma.telegramDelivery.findUnique({ where: { token } });
    if (!delivery || delivery.used || new Date() > delivery.expiresAt) {
      return res.status(400).json({ error: "Havola eskirgan yoki noto'g'ri" });
    }
    res.json({ success: true, startupId: delivery.startupId });
  } catch (err: any) {
    logger.error({ err }, "Verify telegram token error");
    res.status(500).json({ error: "Havolani tasdiqlashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/sponsor-channels
router.get("/sponsor-channels", async (req: Request, res: Response) => {
  try {
    const channels = await prisma.sponsorChannel.findMany({
      where: {
        isActive: true,
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } }
        ]
      },
      select: {
        id: true,
        channelId: true,
        channelUsername: true,
        displayName: true
      }
    });
    res.json(channels);
  } catch (err: any) {
    logger.error({ err }, "Get sponsor channels error");
    res.status(500).json({ error: "Sponsor kanallarni yuklashda xatolik yuz berdi." });
  }
});

// POST /api/telegram/deliver/:token
// 13-MUAMMO: endpoint hech qanday himoyasiz edi — token'ni bilgan har kim
// botning "kanalga majburiy obuna" tekshiruvini chetlab o'tishi mumkin edi.
router.post("/deliver/:token", async (req: Request, res: Response) => {
  // Ichki maxfiy kalitni tekshir (faqat bot chaqira olishi uchun — kanalga
  // majburiy obuna tekshiruvi shu endpointni chaqirishdan oldin bot tomonidan
  // bajariladi, shuning uchun endpointning o'zi ham faqat botdan kelgan
  // so'rovlarni qabul qilishi shart, aks holda token bilganlar obunani chetlab o'tishi mumkin)
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = await getSetting("TELEGRAM_BOT_INTERNAL_SECRET") || process.env.TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat berilmagan." });
  }

  try {
    const { token } = req.params;
    const { telegramUserId } = req.body;
    const delivery = await prisma.telegramDelivery.findUnique({ where: { token } });
    if (!delivery || new Date() > delivery.expiresAt) {
      return res.status(400).json({ error: "Havola eskirgan yoki noto'g'ri" });
    }

    const updated = await prisma.telegramDelivery.updateMany({
      where: { token, used: false },
      data: { used: true, telegramUserId: String(telegramUserId) }
    });

    if (updated.count === 0) {
      return res.status(400).json({ error: "Bu havola allaqachon ishlatilgan." });
    }

    // Get delivery URL
    const startup = await prisma.startup.findUnique({ where: { id: delivery.startupId } });
    res.json({ deliveryUrl: startup?.deliveryUrl });
  } catch (err: any) {
    logger.error({ err }, "Deliver telegram error");
    res.status(500).json({ error: "Loyiha havolasini yuborishda xatolik yuz berdi." });
  }
});

export default router;
