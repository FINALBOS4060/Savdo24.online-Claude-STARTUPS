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
  getReferralCount,
  authenticateToken,
  trackEvent,
  createNotification,
  getSetting,
  AuthRequest,
  TELEGRAM_BOT_INTERNAL_SECRET,
  notifyAdminTelegram
} from "../lib/context";
import { safeCompare } from "../lib/pure-helpers";

const router = Router();

// GET /api/telegram/internal/bot-token — TUZATISH: avval TELEGRAM_BOT_TOKEN
// admin panelda tahrirlansa, bu FAQAT bazaga (Setting jadvaliga) yozilardi.
// Haqiqiy botni ishga tushiradigan alohida process (telegram-bot/index.ts)
// esa tokenni FAQAT .env'dan, jarayon boshlanganda bir marta o'qir edi —
// bazadagi o'zgarish unga umuman ta'sir qilmasdi va admin bu haqda hech
// qanday ogohlantirish olmasdi. Endi telegram-bot/index.ts ishga
// tushishdan oldin shu endpoint orqali bazadagi qiymatni so'raydi (agar
// server allaqachon ishlab turgan bo'lsa) va uni ustun qo'yadi; server
// ishlamasa yoki bazada qiymat bo'lmasa, jim ravishda .env'ga qaytadi
// (token manbai — bot ishga tushmasligi emas). Boshqa /api/telegram/*
// endpointlar bilan bir xil ichki maxfiy kalit (x-telegram-bot-secret)
// bilan himoyalangan — faqat botning o'zi chaqira oladi.
// 🆕 ?bot=subscriber — "obunachi yig'ish" boti (telegram-bot/subscriber-bot/
// index.ts) o'zining TELEGRAM_SUBSCRIBER_BOT_TOKEN qiymatini shu bitta
// endpoint orqali, faqat query parametr bilan so'raydi (alohida endpoint
// ochish shart emas — ikkalasi ham bir xil ichki maxfiy kalit bilan
// himoyalangan). Parametr bo'lmasa yoki boshqa qiymat bo'lsa, asosiy bot
// tokeni qaytariladi (eski xatti-harakat o'zgarmadi).
router.get("/internal/bot-token", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const isSubscriberBot = req.query.bot === "subscriber";
    const token = isSubscriberBot
      ? (await getSetting("TELEGRAM_SUBSCRIBER_BOT_TOKEN")) || null
      : (await getSetting("TELEGRAM_BOT_TOKEN")) || (await getSetting("TELEGRAM_BOT_API_TOKEN")) || null;
    res.json({ token });
  } catch (err: unknown) {
    logger.error({ err }, "Internal bot-token so'rovida xatolik");
    res.status(500).json({ error: "Tokenni olishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/internal/main-bot-username — TUZATISH: MAIN_BOT_USERNAME
// endi ham admin panelda (Setting jadvalida) tahrirlanadi (qarang:
// admin-settings.ts ALL_KEYS), lekin "obunachi yig'ish" boti (alohida
// process) buni avval FAQAT process.env'dan o'qirdi — bazadagi o'zgarish
// unga umuman ta'sir qilmasdi. Bot-token bilan bir xil naqsh: avval
// bazadagi qiymat so'raladi, topilmasa .env'ga qaytiladi.
router.get("/internal/main-bot-username", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }
  try {
    const username = (await getSetting("MAIN_BOT_USERNAME")) || process.env.MAIN_BOT_USERNAME || null;
    res.json({ username });
  } catch (err: unknown) {
    logger.error({ err }, "Internal main-bot-username so'rovida xatolik");
    res.status(500).json({ error: "Qiymatni olishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/track-event — bot o'zining tugma bosishlari/
// funksiya ishlatilishini shu orqali qayd qiladi (4-so'rov: "Bot
// faolligi statistikasi" uchun xom ma'lumot). Faqat bot chaqira oladi
// (ichki maxfiy kalit talab qilinadi, boshqa /api/telegram/* endpointlar
// bilan bir xil naqsh).
router.post("/track-event", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const { event, telegramUserId, payload } = req.body;
    if (!event || typeof event !== "string") {
      return res.status(400).json({ error: "event majburiy." });
    }

    let userId: number | undefined;
    if (telegramUserId) {
      const user = await prisma.user.findFirst({
        where: { telegramUserId: String(telegramUserId) },
        select: { id: true }
      });
      userId = user?.id;
    }

    // TUZATILDI: ixtiyoriy `payload` (masalan /start'ning deep-link
    // parametri) endi metadata'ga qo'shiladi — "obunachi yig'ish" boti
    // kabi referal manba muhim bo'lgan holatlar uchun.
    const metadata: Record<string, unknown> = { telegramUserId };
    if (payload && typeof payload === "string") metadata.payload = payload;

    await trackEvent(event, userId, undefined, "telegram_bot", metadata);
    res.json({ success: true });
  } catch (err: unknown) {
    // Statistika bitta yo'qolgan hodisa tufayli botning asosiy funksiyasini
    // buzmasligi kerak — shu sabab har doim 200 qaytariladi, faqat log qilinadi.
    logger.warn({ err }, "Telegram track-event error (e'tiborsiz qoldirildi)");
    res.json({ success: false });
  }
});



// POST /api/telegram/unlink — foydalanuvchi SAYTDAN Telegram hisobini
// uzadi (bot maxfiy kaliti bilan emas, oddiy login orqali himoyalangan).
// GET /api/telegram/language/:telegramUserId — botning o'zi (ichki maxfiy
// kalit bilan) foydalanuvchining saqlangan til tanlovini so'raydi. Yozuv
// mavjud bo'lmasa (foydalanuvchi hali til tanlamagan), standart "uz"
// qaytariladi — bazada bo'sh yozuv yaratilmaydi.
router.get("/language/:telegramUserId", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }
  try {
    const record = await prisma.telegramBotUser.findUnique({
      where: { telegramUserId: String(req.params.telegramUserId) },
      select: { language: true }
    });
    res.json({ language: record?.language || "uz" });
  } catch (err: unknown) {
    logger.warn({ err }, "GET /telegram/language error (uz standart qaytariladi)");
    res.json({ language: "uz" });
  }
});

// POST /api/telegram/language — foydalanuvchi til almashtirganda bot shu
// yerga yozadi (upsert — birinchi marta bo'lsa yaratiladi).
router.post("/language", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }
  const { telegramUserId, language } = req.body;
  if (!telegramUserId || (language !== "uz" && language !== "en")) {
    return res.status(400).json({ error: "telegramUserId va language ('uz' | 'en') majburiy." });
  }
  try {
    await prisma.telegramBotUser.upsert({
      where: { telegramUserId: String(telegramUserId) },
      update: { language },
      create: { telegramUserId: String(telegramUserId), language }
    });
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "POST /telegram/language error");
    res.status(500).json({ error: "Tilni saqlashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/session/:telegramUserId — bot grammy session'ini
// DOIMIY saqlashi uchun (avval jarayon xotirasida saqlanardi, bot qayta
// ishga tushirilganda — masalan har bir avtomatik deploy'da — butunlay
// yo'qolib ketardi). Yozuv topilmasa (foydalanuvchi hali sessiyaga ega
// bo'lmagan), 200 bilan `data: null` qaytariladi — bu grammy uchun
// "sessiya yo'q" degani (u keyin `initial()` bilan yangisini yaratadi).
router.get("/session/:telegramUserId", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }
  try {
    const record = await prisma.telegramBotSession.findUnique({
      where: { telegramUserId: String(req.params.telegramUserId) },
      select: { data: true }
    });
    res.json({ data: record?.data ?? null });
  } catch (err: unknown) {
    logger.error({ err }, "GET /telegram/session error");
    res.status(500).json({ error: "Sessiyani olishda xatolik yuz berdi." });
  }
});

// PUT /api/telegram/session — sessiya har yangilanishda shu yerga
// yoziladi (upsert). `data` — bot tomonida JSON.stringify qilingan
// butun sessiya obyekti (grammy sxemasi vaqt o'tishi bilan o'zgarishi
// mumkin bo'lgani uchun, bu yerda strukturaga bog'lanmaymiz).
router.put("/session", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }
  const { telegramUserId, data } = req.body;
  if (!telegramUserId || typeof data !== "string") {
    return res.status(400).json({ error: "telegramUserId va data (string) majburiy." });
  }
  try {
    await prisma.telegramBotSession.upsert({
      where: { telegramUserId: String(telegramUserId) },
      update: { data },
      create: { telegramUserId: String(telegramUserId), data }
    });
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "PUT /telegram/session error");
    res.status(500).json({ error: "Sessiyani saqlashda xatolik yuz berdi." });
  }
});

// DELETE /api/telegram/session/:telegramUserId — grammy StorageAdapter
// interfeysining `delete` metodi uchun (masalan sessiya bo'sh holatga
// qaytarilganda ishlatilishi mumkin).
router.delete("/session/:telegramUserId", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }
  try {
    await prisma.telegramBotSession.delete({ where: { telegramUserId: String(req.params.telegramUserId) } }).catch(() => {});
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "DELETE /telegram/session error");
    res.status(500).json({ error: "Sessiyani o'chirishda xatolik yuz berdi." });
  }
});

router.post("/unlink", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { telegramUserId: null }
    });
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram unlink error");
    res.status(500).json({ error: "Uzishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/link — User hisobini bot bilan bog'lash
router.post("/link", async (req: Request, res: Response) => {
  try {
    const secret = req.headers["x-telegram-bot-secret"];
    const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
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
  } catch (err: unknown) {
    logger.error({ err }, "Telegram link error");
    res.status(500).json({ error: "Hisobni bog'lashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/user-stats/:telegramUserId — Bot uchun user stats
router.get("/user-stats/:telegramUserId", async (req: Request, res: Response) => {
  const { telegramUserId } = req.params;
  const secret = req.headers["x-telegram-bot-secret"];

  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
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
      totalEarned,
      telegramBroadcastOptOut: user.telegramBroadcastOptOut
    });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram user-stats error");
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// GET /api/telegram/user-activity/:telegramUserId — bot profilidagi
// "🧾 Faoliyat tarixi" uchun YAGONA, universal lenta: xarid, sotuv,
// nizo, sharh, escrow, obuna-almashish va h.k. — tizimdagi deyarli
// BARCHA muhim hodisalar allaqachon createNotification() orqali
// Notification jadvaliga yozilib boriladi, shu sabab bu yerda ularni
// shunchaki vaqt bo'yicha teskari tartibda o'qib qaytaramiz — alohida
// har bir modulni (Payment/Dispute/Review/...) qayta so'rash shart emas.
router.get("/user-activity/:telegramUserId", async (req: Request, res: Response) => {
  const { telegramUserId } = req.params;
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const user = await prisma.user.findFirst({ where: { telegramUserId: String(telegramUserId) }, select: { id: true } });
    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    const limit = Math.min(parseInt(String(req.query.limit || "15"), 10) || 15, 30);
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } })
    ]);

    res.json({
      unreadCount,
      items: items.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        createdAt: n.createdAt,
        isRead: n.isRead
      }))
    });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram user-activity error");
    res.status(500).json({ error: "Faoliyat tarixini olishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/user-purchases/:telegramUserId — bot uchun "Xaridlarim"
// (Profilga xaridlar tarixi qo'shish). MUHIM: avval faqat "completed"
// to'lovlar qaytarilardi — foydalanuvchi hali to'lamagan yoki qaytarish
// kutilayotgan buyurtmalarini bot ichida umuman ko'ra olmasdi ("💸 To'lov
// holatini kuzatish" qulayligi uchun endi barcha statuslar qaytariladi,
// har biriga status matni qo'shiladi).
router.get("/user-purchases/:telegramUserId", async (req: Request, res: Response) => {
  const { telegramUserId } = req.params;
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const user = await prisma.user.findFirst({ where: { telegramUserId: telegramUserId.toString() } });
    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    const purchases = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { startup: { select: { id: true, name: true } } }
    });

    res.json({
      purchases: purchases.map((p: any) => ({
        id: p.id,
        startupId: p.startupId,
        name: p.startup?.name || "O'chirilgan mahsulot",
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt
      }))
    });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram user-purchases error");
    res.status(500).json({ error: "Xaridlar tarixini yuklashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/user-sales/:telegramUserId — bot uchun "Sotuvlarim"
// (o'z e'lonlaridan qilingan tugallangan sotuvlar ro'yxati).
router.get("/user-sales/:telegramUserId", async (req: Request, res: Response) => {
  const { telegramUserId } = req.params;
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const user = await prisma.user.findFirst({ where: { telegramUserId: telegramUserId.toString() } });
    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    const sales = await prisma.payment.findMany({
      where: { status: "completed", startup: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { startup: { select: { id: true, name: true } } }
    });

    res.json({
      sales: sales.map((p: any) => ({
        id: p.id,
        startupId: p.startupId,
        name: p.startup?.name || "O'chirilgan mahsulot",
        amount: p.sellerPayoutAmount ?? p.amount,
        currency: p.currency,
        createdAt: p.createdAt
      }))
    });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram user-sales error");
    res.status(500).json({ error: "Sotuvlar tarixini yuklashda xatolik yuz berdi." });
  }
});

// PATCH /api/telegram/notification-settings — bot ichidan bevosita
// bildirishnoma (reklama/broadcast) sozlamasini o'zgartirish. Saytdagi
// PATCH /api/users/me/telegram-notifications JWT (authenticateToken) talab
// qiladi — botda foydalanuvchining JWT tokeni yo'q, faqat telegramUserId
// bor, shuning uchun boshqa /api/telegram/* endpointlar bilan bir xil
// ichki-maxfiy-kalit naqshiga asoslangan alohida endpoint kerak bo'ldi.
router.patch("/notification-settings", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const { telegramUserId, telegramBroadcastOptOut } = req.body;
    if (!telegramUserId || typeof telegramBroadcastOptOut !== "boolean") {
      return res.status(400).json({ error: "telegramUserId va telegramBroadcastOptOut (boolean) majburiy." });
    }
    const user = await prisma.user.findFirst({ where: { telegramUserId: telegramUserId.toString() } });
    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { telegramBroadcastOptOut },
      select: { telegramBroadcastOptOut: true }
    });
    res.json({ success: true, telegramBroadcastOptOut: updated.telegramBroadcastOptOut });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram notification-settings error");
    res.status(500).json({ error: "Bildirishnoma sozlamasini yangilashda xatolik yuz berdi." });
  }
});

// POST /api/telegram/reviews — ⭐ bot ichidan sharh/reyting qoldirish.
// Saytdagi POST /api/reviews JWT (authenticateToken) talab qiladi — botda
// buning o'rniga telegramUserId + ichki maxfiy kalit ishlatiladi, qolgan
// tekshiruvlar (haqiqatan sotib olinganmi, takroriy sharh emasmi) xuddi
// saytdagi kabi saqlanadi.
router.post("/reviews", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const { telegramUserId, startupId, rating, comment } = req.body;
    if (!telegramUserId || !startupId || !rating || !comment) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
    }
    if (String(comment).length > 1000) {
      return res.status(400).json({ error: "Sharh matni 1000 belgidan oshmasligi kerak." });
    }
    const ratingInt = parseInt(rating, 10);
    if (isNaN(ratingInt) || ratingInt < 1 || ratingInt > 5) {
      return res.status(400).json({ error: "Reyting 1 dan 5 gacha bo'lishi kerak." });
    }

    const user = await prisma.user.findFirst({ where: { telegramUserId: telegramUserId.toString() } });
    if (!user) return res.status(404).json({ error: "Avval hisobingizni ulashingiz kerak." });

    const completedPayment = await prisma.payment.findFirst({
      where: { startupId, userId: user.id, status: "completed" }
    });
    if (!completedPayment) {
      return res.status(403).json({ error: "Siz ushbu loyihani sotib olmagansiz yoki to'lov yakunlanmagan." });
    }

    const existingReview = await prisma.review.findFirst({ where: { startupId, buyerId: user.id } });
    if (existingReview) {
      return res.status(409).json({ error: "Siz ushbu loyiha uchun allaqachon sharh qoldirgansiz." });
    }

    const startup = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startup || !startup.userId) {
      return res.status(404).json({ error: "Loyiha yoki uning sotuvchisi topilmadi." });
    }

    await prisma.review.create({
      data: { rating: ratingInt, comment, startupId, buyerId: user.id, sellerId: startup.userId }
    });

    await createNotification(
      startup.userId,
      "REVIEW",
      "Yangi sharh",
      `"${startup.name}" loyihangiz uchun yangi ${ratingInt} yulduzli sharh qoldirildi.`,
      `/profile?tab=earnings`
    );

    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram reviews error");
    res.status(500).json({ error: "Sharh qoldirishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/support-ticket — 🆘 bot ichidan qo'llab-quvvatlashga
// murojaat yaratish. Saytdagi POST /api/support bilan bir xil modelga
// yoziladi (SupportTicket), faqat kirish nuqtasi bot va autentifikatsiya
// usuli boshqacha. Foydalanuvchi email hisobga ulangan bo'lsa ishlatiladi.
router.post("/support-ticket", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const { telegramUserId, subject, message } = req.body;
    if (!subject || !message || String(message).trim().length < 5) {
      return res.status(400).json({ error: "Mavzu va xabar (kamida 5 belgi) majburiy." });
    }

    let email = "telegram-bot@savdo24.online";
    if (telegramUserId) {
      const user = await prisma.user.findFirst({ where: { telegramUserId: telegramUserId.toString() } });
      if (user?.email) email = user.email;
    }

    const ticket = await prisma.supportTicket.create({
      data: { email, subject: String(subject).slice(0, 200), message: String(message).slice(0, 2000) }
    });

    res.json({ success: true, ticketId: ticket.id });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram support-ticket error");
    res.status(500).json({ error: "Murojaat yuborishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/seller-stats/:telegramUserId — 📊 sotuvchi uchun
// bot ichida qisqacha statistika: e'lonlar soni, jami ko'rishlar
// (AnalyticsEvent "listing_view" hodisalari) va tugallangan sotuvlar soni.
router.get("/seller-stats/:telegramUserId", async (req: Request, res: Response) => {
  const { telegramUserId } = req.params;
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const user = await prisma.user.findFirst({ where: { telegramUserId: telegramUserId.toString() } });
    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    const startups = await prisma.startup.findMany({
      where: { userId: user.id },
      select: { id: true, status: true, soldStatus: true }
    });
    const startupIds = startups.map((s: any) => s.id);

    const totalViews = startupIds.length
      ? await prisma.analyticsEvent.count({ where: { event: "listing_view", targetId: { in: startupIds } } })
      : 0;

    const completedSalesCount = await prisma.payment.count({
      where: { status: "completed", startup: { userId: user.id } }
    });

    res.json({
      totalListings: startups.length,
      activeListings: startups.filter((s: any) => s.status === "active").length,
      soldListings: startups.filter((s: any) => s.soldStatus === "sotildi").length,
      totalViews,
      completedSalesCount
    });
  } catch (err: unknown) {
    logger.error({ err }, "Telegram seller-stats error");
    res.status(500).json({ error: "Statistikani yuklashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/verify/:token
// 14-MUAMMO: endpoint umuman himoyasiz edi, endi faqat bot chaqira oladi.
router.get("/verify/:token", async (req: Request, res: Response) => {
  // Ichki maxfiy kalitni tekshir (faqat bot chaqira olishi uchun)
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
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
  } catch (err: unknown) {
    logger.error({ err }, "Verify telegram token error");
    res.status(500).json({ error: "Havolani tasdiqlashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/sponsor-channels
// TUZATILDI (XAVFSIZLIK): bu endpoint ilgari HECH QANDAY himoyasiz edi —
// shu fayldagi barcha boshqa /api/telegram/* endpointlari (track-event,
// verify, deliver va h.k.) ichki maxfiy kalit (x-telegram-bot-secret)
// talab qilsa-da, aynan shu marshrut istisno bo'lib qolgan edi. Bu
// endpoint faqat botning o'zi (index.ts -> checkSubscription) tomonidan
// chaqiriladi va frontend'da HECH QAYERDA ishlatilmaydi (admin panel
// sponsor kanallarni /api/admin/sponsor-channels orqali, alohida
// autentifikatsiya bilan oladi) — shu sabab uni ochiq qoldirishning
// hech qanday amaliy sababi yo'q edi. Endi shu faylning qolgan qismi
// bilan bir xil naqsh qo'llanildi.
router.get("/sponsor-channels", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

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
  } catch (err: unknown) {
    logger.error({ err }, "Get sponsor channels error");
    res.status(500).json({ error: "Sponsor kanallarni yuklashda xatolik yuz berdi." });
  }
});

// 🆕 POST /api/telegram/sponsor-channels/report-issue
// TUZATILDI (KO'RINMAS DARVOZA MUAMMOSI — "sponsor kanal tizimida
// muammo bor"): sponsor-gate.ts'dagi checkSubscription bir kanal uchun
// getChatMember bir necha marta KETMA-KET muvaffaqiyatsiz bo'lganda
// (kanal o'chirilgan/username noto'g'ri/bot admin emas) shu endpointga
// murojaat qiladi. Ilgari bunday holat FAQAT server logiga yozilardi —
// hech kim kuzatib turmagani uchun, MAJBURIY obuna darvozasi butun
// botni HAMMA foydalanuvchi uchun (kanal admin tomonidan qo'lda
// tuzatilmaguncha) cheksiz vaqt bloklab qo'yardi, admin esa bundan
// asosan foydalanuvchilar shikoyat qilgandagina bilib olardi. Endi
// admin darhol Telegram orqali aniq xabar oladi. Kanal ATAYLAB
// avtomatik o'chirilmaydi/nofaol qilinmaydi — sponsor kanallar odatda
// pullik reklama joylashuvi (pricePerMonth/advertiserContact maydonlariga
// qarang), uni faqat admin qo'lda hal qilishi kerak (masalan
// ExchangeChannel'dagi isSponsor uchun xuddi shunday qilingan — qarang:
// exchange-channels.ts "/deactivate-channel").
router.post("/sponsor-channels/report-issue", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  const { channelId, channelUsername, displayName } = req.body || {};
  if (!channelId) {
    return res.status(400).json({ error: "channelId majburiy." });
  }

  const label = displayName ? `${displayName} (${channelUsername || channelId})` : (channelUsername || channelId);
  notifyAdminTelegram(
    `🚨 <b>Majburiy obuna (sponsor kanal) tizimida muammo</b>\n\n` +
    `Kanal: <b>${label}</b>\nID: <code>${channelId}</code>\n\n` +
    `Bot bu kanalda getChatMember so'rovini bir necha marta ketma-ket bajara olmadi — ehtimoliy sabablar:\n` +
    `• Bot bu kanalda ADMIN emas (yoki chiqarib yuborilgan)\n` +
    `• Kanal username/ID noto'g'ri kiritilgan yoki kanal o'chirilgan\n\n` +
    `⚠️ Bu kanal MAJBURIY obuna ro'yxatida turgani uchun, muammo hal bo'lguncha BOTNING BARCHA foydalanuvchilari uchun to'siq bo'lib qolmoqda. Iltimos, Admin panel → Sponsor kanallar bo'limida tekshirib, tuzating yoki vaqtincha o'chirib qo'ying.`
  ).catch((err: unknown) => logger.warn({ err, channelId }, "sponsor-channels/report-issue: admin notify failed"));

  res.json({ success: true });
});

// GET /api/telegram/subscriber-referral-stats/:telegramUserId
// 🆕 "Obunachi yig'ish" boti uchun: foydalanuvchi shu botga o'z referal
// havolasi (?start=<uning_telegram_id>) orqali nechta ODAM taklif qilib
// keltirganini qaytaradi. AnalyticsEvent.metadata JSON matn sifatida
// saqlangani sabab (schema.prisma: metadata String), to'g'ridan-to'g'ri
// JSON-filtri (Prisma'da bu ustun uchun mavjud emas) o'rniga oldin
// `contains` bilan tez qidiruv qilinadi, so'ng har bir yozuv JSON.parse
// qilinib ANIQ moslik (`meta.payload === referrerId`) tekshiriladi va
// bir xil foydalanuvchi bir necha marta /start bosgan bo'lsa ham FAQAT
// BIR marta hisoblanishi uchun (metadata.telegramUserId bo'yicha) Set
// ishlatiladi.
router.get("/subscriber-referral-stats/:telegramUserId", async (req: Request, res: Response) => {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const referrerId = String(req.params.telegramUserId);
    const events = await prisma.analyticsEvent.findMany({
      where: {
        event: "subscriber_bot_start",
        metadata: { contains: `"payload":"${referrerId}"` }
      },
      select: { metadata: true }
    });

    const invitedUserIds = new Set<string>();
    for (const e of events) {
      try {
        const meta = JSON.parse(e.metadata);
        if (meta?.payload === referrerId && meta?.telegramUserId) {
          invitedUserIds.add(String(meta.telegramUserId));
        }
      } catch {
        // Buzilgan/eski metadata yozuvi — jim o'tkaziladi.
      }
    }
    // O'zini-o'zi taklif qilish holatini (masalan sinov paytida) hisobga
    // olmaslik uchun.
    invitedUserIds.delete(referrerId);

    res.json({ invitedCount: invitedUserIds.size });
  } catch (err: unknown) {
    logger.error({ err }, "subscriber-referral-stats error");
    res.status(500).json({ error: "Statistikani yuklashda xatolik yuz berdi." });
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
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
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
  } catch (err: unknown) {
    logger.error({ err }, "Deliver telegram error");
    res.status(500).json({ error: "Loyiha havolasini yuborishda xatolik yuz berdi." });
  }
});

export default router;
