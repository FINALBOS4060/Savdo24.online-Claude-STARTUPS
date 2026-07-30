import { Router, Request, Response } from "express";
import crypto from "crypto";
// 115-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (--- TOP BOOST --- va --- VIP --- bloklari,
// shu jumladan faqat shu yerda ishlatiladigan calculateTopPrice/
// calculateVipPrice helper funksiyalari). Naqsh b2b.ts bilan bir xil,
// lekin ikkalasi ham /api ostiga bitta router bilan mount qilinadi
// (yo'llar o'zida to'liq: /top-boost/..., /vip/...).
import {
  prisma,
  authenticateToken,
  getSetting,
  AuthRequest
} from "../../server";

const router = Router();

// TOP narxini talabga qarab hisoblash (dinamik narx)
async function calculateTopPrice(days: number) {
  // 6-MUAMMO: "days" parametrining ichki xavfsizlik tekshiruvi (musbat butun son va 1-365 chegarasida ekanligi)
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error("Kunlar soni 1 dan 365 gacha butun son bo'lishi kerak.");
  }

  const basePrice = parseFloat(await getSetting("TOP_BASE_PRICE_PER_DAY") || "1");
  const maxSlots = parseInt(await getSetting("TOP_MAX_CONCURRENT_SLOTS") || "20");
  const activeCount = await prisma.startup.count({
    where: {
      isTop: true,
      topExpiresAt: { gt: new Date() }
    }
  });

  // Talab ko'p bo'lsa (faol TOP'lar ko'p bo'lsa) — narx oshadi
  const demandMultiplier = 1 + (activeCount / maxSlots);
  return Math.round(basePrice * demandMultiplier * days * 100) / 100;
}

// GET /api/top-boost/price
router.get("/top-boost/price", async (req: Request, res: Response) => {
  const { days } = req.query;
  if (!days) return res.status(400).json({ error: "Kunlar soni ko'rsatilmadi." });

  // 6-MUAMMO: "days" parametrini validatsiya qilish (1 dan 365 gacha butun son bo'lishi kerak)
  const daysNum = parseInt(days as string, 10);
  if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 365) {
    return res.status(400).json({ error: "Kunlar soni 1 dan 365 gacha butun son bo'lishi kerak." });
  }

  const price = await calculateTopPrice(daysNum);
  res.json({ price });
});

// POST /api/top-boost/create
router.post("/top-boost/create", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { startupId, days } = req.body;
  if (!startupId || !days) return res.status(400).json({ error: "StartupId va kunlar soni ko'rsatilmadi." });

  // 6-MUAMMO: "days" parametrini validatsiya qilish (1 dan 365 gacha butun son bo'lishi kerak)
  const daysNum = parseInt(days as string, 10);
  if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 365) {
    return res.status(400).json({ error: "Kunlar soni 1 dan 365 gacha butun son bo'lishi kerak." });
  }

  try {
    const startup = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startup) return res.status(404).json({ error: "Startap topilmadi." });

    // 91-band: faqat egasi/admin top qila oladi (/upgrade endpointidagi kabi)
    if (startup.userId !== req.user?.id && req.user?.role !== "Admin") {
      return res.status(403).json({ error: "Faqat o'z loyihangizni top qila olasiz." });
    }

    const coingateToken = await getSetting("COINGATE_API_TOKEN");
    const appUrlSetting = await getSetting("APP_URL") || "http://localhost:3000";

    // 7-MUAMMO: COINGATE_API_TOKEN sozlanmagan bo'lsa va production bo'lsa, oldindan xatolik qaytarish (muvaffaqiyatsiz to'lov simulyatoriga tushib qolmaslik uchun)
    if (process.env.NODE_ENV === "production" && !coingateToken) {
      console.error("COINGATE_API_TOKEN sozlanmagan (production)");
      return res.status(503).json({ error: "To'lov tizimi vaqtincha mavjud emas." });
    }

    const price = await calculateTopPrice(daysNum);
    const orderId = `TOP-${daysNum}-` + crypto.randomBytes(4).toString('hex').toUpperCase();
    const secureToken = crypto.randomBytes(24).toString('hex');

    await prisma.payment.create({
      data: {
        id: orderId,
        amount: price,
        status: "pending",
        source: "top_boost",
        currency: "USDT",
        userId: req.user!.id,
        startupId: startupId,
        callbackToken: secureToken,
        platformFeeAmount: 0,
        sellerPayoutAmount: 0
      },
    });

    let paymentUrl = "";

    if (coingateToken) {
      try {
        const response = await fetch("https://api.coingate.com/v2/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Token ${coingateToken}`,
          },
          body: new URLSearchParams({
            order_id: orderId,
            price_amount: price.toFixed(2),
            price_currency: "USD",
            receive_currency: "USDT",
            callback_url: `${appUrlSetting}/api/payments/webhook?token=${secureToken}`,
            success_url: `${appUrlSetting}/checkout/success`,
            cancel_url: `${appUrlSetting}/checkout/cancel`,
            title: `TOP Boost: ${startup.name} (${daysNum} kun)`,
          }),
        });

        if (response.ok) {
          const orderData: any = await response.json();
          paymentUrl = orderData.payment_url;
        }
      } catch (err) {
        console.error("CoinGate error in top boost create:", err);
      }
    }

    if (!paymentUrl) {
      paymentUrl = `${appUrlSetting}/api/payments/coingate-simulator?orderId=${orderId}&token=${secureToken}&amount=${price.toFixed(2)}&title=${encodeURIComponent("TOP Boost: " + startup.name)}`;
    }

    res.json({ paymentUrl });
  } catch (err) {
    console.error("TOP boost create error:", err);
    res.status(500).json({ error: "To'lov yaratishda xatolik." });
  }
});

async function calculateVipPrice(days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error("Kunlar soni 1 dan 365 gacha butun son bo'lishi kerak.");
  }
  const basePricePerDay = parseFloat(await getSetting("VIP_PRICE_PER_DAY") || "0.5");
  const discountPercent = parseFloat(await getSetting("VIP_DISCOUNT_PERCENT") || "40");
  const totalBasePrice = basePricePerDay * days;
  return Math.round(totalBasePrice * (1 - discountPercent / 100) * 100) / 100;
}

// GET /api/vip/price — narxni oldindan ko'rsatish uchun (ProfilePage VIP tab'i
// avval buni chaqirmasdan, VIP_PRICE_PER_DAY/VIP_DISCOUNT_PERCENT admin
// sozlamalaridan mustaqil ravishda qattiq kodlangan 0.5/40% formula bilan
// narxni hisoblardi — admin bu sozlamalarni o'zgartirsa, foydalanuvchiga
// ko'rsatilgan narx bilan /api/vip/create orqali haqiqatda undiriladigan
// narx mos kelmay qolardi.
router.get("/vip/price", async (req: Request, res: Response) => {
  const { days } = req.query;
  if (!days) return res.status(400).json({ error: "Kunlar soni ko'rsatilmadi." });

  const daysNum = parseInt(days as string, 10);
  if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 365) {
    return res.status(400).json({ error: "Kunlar soni 1 dan 365 gacha butun son bo'lishi kerak." });
  }

  try {
    const price = await calculateVipPrice(daysNum);
    const discountPercent = parseFloat(await getSetting("VIP_DISCOUNT_PERCENT") || "40");
    res.json({ price, discountPercent });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Narxni hisoblashda xatolik." });
  }
});

// POST /api/vip/create
router.post("/vip/create", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { days } = req.body;
  if (!days) return res.status(400).json({ error: "Kunlar soni ko'rsatilmadi." });

  // 6-MUAMMO: "days" parametrini validatsiya qilish (1 dan 365 gacha butun son bo'lishi kerak)
  const daysNum = parseInt(days as string, 10);
  if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 365) {
    return res.status(400).json({ error: "Kunlar soni 1 dan 365 gacha butun son bo'lishi kerak." });
  }

  try {
    const price = await calculateVipPrice(daysNum);

    const coingateToken = await getSetting("COINGATE_API_TOKEN");
    const appUrlSetting = await getSetting("APP_URL") || "http://localhost:3000";

    // 7-MUAMMO: COINGATE_API_TOKEN sozlanmagan bo'lsa va production bo'lsa, oldindan xatolik qaytarish (muvaffaqiyatsiz to'lov simulyatoriga tushib qolmaslik uchun)
    if (process.env.NODE_ENV === "production" && !coingateToken) {
      console.error("COINGATE_API_TOKEN sozlanmagan (production)");
      return res.status(503).json({ error: "To'lov tizimi vaqtincha mavjud emas." });
    }

    const orderId = `VIP-${daysNum}-` + crypto.randomBytes(4).toString('hex').toUpperCase();
    const secureToken = crypto.randomBytes(24).toString('hex');

    await prisma.payment.create({
      data: {
        id: orderId,
        amount: price,
        status: "pending",
        source: "vip_subscription",
        currency: "USDT",
        userId: req.user!.id,
        callbackToken: secureToken,
        platformFeeAmount: 0,
        sellerPayoutAmount: 0
      },
    });

    let paymentUrl = "";

    if (coingateToken) {
      try {
        const response = await fetch("https://api.coingate.com/v2/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Token ${coingateToken}`,
          },
          body: new URLSearchParams({
            order_id: orderId,
            price_amount: price.toFixed(2),
            price_currency: "USD",
            receive_currency: "USDT",
            callback_url: `${appUrlSetting}/api/payments/webhook?token=${secureToken}`,
            success_url: `${appUrlSetting}/checkout/success`,
            cancel_url: `${appUrlSetting}/checkout/cancel`,
            title: `VIP Subscription (${daysNum} kun)`,
          }),
        });

        if (response.ok) {
          const orderData: any = await response.json();
          paymentUrl = orderData.payment_url;
        }
      } catch (err) {
        console.error("CoinGate error in vip create:", err);
      }
    }

    if (!paymentUrl) {
      paymentUrl = `${appUrlSetting}/api/payments/coingate-simulator?orderId=${orderId}&token=${secureToken}&amount=${price.toFixed(2)}&title=${encodeURIComponent("VIP Subscription")}`;
    }

    res.json({ paymentUrl });
  } catch (err) {
    console.error("VIP create error:", err);
    res.status(500).json({ error: "To'lov yaratishda xatolik." });
  }
});

export default router;
