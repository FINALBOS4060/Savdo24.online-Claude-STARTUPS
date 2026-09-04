import { Router, Response } from "express";
import { logger } from "../lib/logger";
// 110-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi. Naqsh auth.ts/support.ts bilan bir xil —
// umumiy prisma/middleware'lar "../../server"'dan import qilinadi.
import {
  prisma,
  authenticateToken,
  requireAdmin,
  AuthRequest,
  getSetting
} from "../lib/context";

const router = Router();

// TUZATILDI (ILDIZ SABAB — "sponsor kanal tizimida muammo bor"):
// avval admin sponsor kanal qo'shganda/tahrirlaganda channelId va
// channelUsername HECH QANDAY tekshiruvsiz to'g'ridan-to'g'ri bazaga
// yozilardi — masalan username xato terilsa (yoki eski/o'chirilgan
// kanal qoldirilsa), bu darhol sezilmasdi. Natija: BUTUN bot HAMMA
// foydalanuvchi uchun bloklanib qolardi (sponsor-gate.ts — majburiy
// obuna) va faqat foydalanuvchilar shikoyat qilgandan keyingina
// bilinardi. Endi kanal saqlanishidan OLDIN Telegram Bot API orqali
// (getChat) chindan ham mavjudligi tekshiriladi — kanal aniq
// topilmasa, saqlash rad etiladi va admin darhol xato xabarini ko'radi.
// Bot hali kanalga admin qilib qo'shilmagan bo'lishi mumkin (masalan
// kanal yangi yaratilgan, admin keyinroq qo'shadi) — shu sabab "admin
// emasligi" bloklanmaydi, faqat ogohlantirish sifatida qaytariladi;
// bloklanadigan yagona holat — kanal Telegram'da UMUMAN topilmayapti
// (masalan noto'g'ri username/ID).
async function verifySponsorChannelExists(channelId: string): Promise<
  { verified: true; exists: boolean; isBotAdmin: boolean } | { verified: false }
> {
  const tokens = (
    await Promise.all([getSetting("TELEGRAM_BOT_TOKEN"), getSetting("TELEGRAM_SUBSCRIBER_BOT_TOKEN")])
  ).filter((tok): tok is string => !!tok && typeof tok === "string");

  if (tokens.length === 0) return { verified: false };

  let sawNetworkError = false;

  for (const token of tokens) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const chatRes = await fetch(
        `https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(channelId)}`,
        { signal: controller.signal }
      );
      const chatData: any = await chatRes.json().catch(() => null);
      clearTimeout(timer);

      if (!chatRes.ok || !chatData?.ok) {
        // Telegram aniq javob berdi ({ok:false}) — kanal topilmadi/bot
        // kira olmaydi. Tarmoq xatosi emas, davom etib boshqa tokenni
        // ham sinab ko'ramiz (ehtimol ikkinchi bot admin bo'lishi mumkin).
        continue;
      }

      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meData: any = await meRes.json().catch(() => null);
      let isBotAdmin = false;
      if (meData?.ok && meData.result?.id) {
        try {
          const memberRes = await fetch(
            `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(channelId)}&user_id=${meData.result.id}`
          );
          const memberData: any = await memberRes.json().catch(() => null);
          isBotAdmin = !!(memberData?.ok && ["administrator", "creator"].includes(memberData.result?.status));
        } catch {
          // aniqlab bo'lmadi — isBotAdmin=false qoladi, bloklanmaydi
        }
      }
      return { verified: true, exists: true, isBotAdmin };
    } catch (err) {
      sawNetworkError = true;
      logger.warn({ err, channelId }, "verifySponsorChannelExists: Telegram so'rovida xato");
    }
  }

  if (sawNetworkError) return { verified: false };
  return { verified: true, exists: false, isBotAdmin: false };
}

// GET /api/admin/sponsor-channels — Barcha sponsor kanallarni olish (Admin)
router.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const channels = await prisma.sponsorChannel.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(channels);
  } catch (err: unknown) {
    logger.error({ err }, "Get sponsor channels error");
    res.status(500).json({ error: "Sponsor kanallarni olishda xatolik yuz berdi." });
  }
});

// POST /api/admin/sponsor-channels — Yangi sponsor kanal qo'shish (Admin)
router.post("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { channelId, channelUsername, displayName, advertiserContact, pricePerMonth, startDate, endDate } = req.body;

  if (!channelId || !channelUsername || !displayName) {
    return res.status(400).json({ error: "Kanal ID, username va ko'rinadigan nom majburiy." });
  }

  const verification = await verifySponsorChannelExists(channelId);
  if (verification.verified && !verification.exists) {
    return res.status(400).json({
      error: `Telegram'da "${channelId}" ID'li kanal topilmadi. Kanal ID/username'ni tekshiring (masalan -100 bilan boshlanadigan raqamli ID yoki @username).`
    });
  }

  try {
    const channel = await prisma.sponsorChannel.create({
      data: {
        channelId,
        channelUsername,
        displayName,
        advertiserContact,
        pricePerMonth: pricePerMonth ? parseFloat(pricePerMonth) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "create_sponsor_channel",
        targetId: String(channel.id),
        details: `Yangi sponsor kanal qo'shildi: ${displayName} (@${channelUsername})`
      }
    }).catch((e: unknown) => logger.error({ err: e }, "Audit log error"));

    const botAdminWarning =
      verification.verified && verification.exists && !verification.isBotAdmin
        ? "DIQQAT: kanal topildi, lekin bot(lar) hali bu kanalda ADMIN emas — obuna tekshiruvi ishlamaydi, bot(lar)ni kanalga admin qilib qo'shing."
        : undefined;

    res.status(201).json({ ...channel, botAdminWarning });
  } catch (err: unknown) {
    logger.error({ err }, "Create sponsor channel error");
    res.status(500).json({ error: "Sponsor kanalni qo'shishda xatolik yuz berdi." });
  }
});

// PATCH /api/admin/sponsor-channels/:id — Sponsor kanalni yangilash (Admin)
router.patch("/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Yaroqsiz Sponsor Kanal ID." });
  }
  const { isActive, channelId, channelUsername, displayName, advertiserContact, pricePerMonth, startDate, endDate } = req.body;

  // TUZATILDI: xuddi POST'dagi kabi — agar admin channelId'ni O'ZGARTIRSA
  // (yoki uni birinchi marta to'ldirsa), yangi qiymat saqlanishidan oldin
  // Telegram'da haqiqatan mavjudligi tekshiriladi. Agar channelId bu
  // so'rovda YO'Q bo'lsa (masalan admin faqat isActive/narxni
  // o'zgartirayotgan bo'lsa), tekshiruv chetlab o'tiladi — har bir
  // kichik tahrirlash uchun qayta Telegram so'rovi yubormaslik uchun.
  let botAdminWarning: string | undefined;
  if (channelId) {
    const verification = await verifySponsorChannelExists(channelId);
    if (verification.verified && !verification.exists) {
      return res.status(400).json({
        error: `Telegram'da "${channelId}" ID'li kanal topilmadi. Kanal ID/username'ni tekshiring (masalan -100 bilan boshlanadigan raqamli ID yoki @username).`
      });
    }
    if (verification.verified && verification.exists && !verification.isBotAdmin) {
      botAdminWarning = "DIQQAT: kanal topildi, lekin bot(lar) hali bu kanalda ADMIN emas — obuna tekshiruvi ishlamaydi, bot(lar)ni kanalga admin qilib qo'shing.";
    }
  }

  try {
    const updated = await prisma.sponsorChannel.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : undefined,
        channelId,
        channelUsername,
        displayName,
        advertiserContact,
        pricePerMonth: pricePerMonth !== undefined ? (pricePerMonth ? parseFloat(pricePerMonth) : null) : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "update_sponsor_channel",
        targetId: String(id),
        details: `Sponsor kanal yangilandi (ID: ${id})`
      }
    }).catch((e: unknown) => logger.error({ err: e }, "Audit log error"));

    res.json({ ...updated, botAdminWarning });
  } catch (err: unknown) {
    logger.error({ err }, "Update sponsor channel error");
    res.status(500).json({ error: "Sponsor kanalni yangilashda xatolik yuz berdi." });
  }
});

// DELETE /api/admin/sponsor-channels/:id — Sponsor kanalni o'chirish (Admin)
router.delete("/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Yaroqsiz Sponsor Kanal ID." });
  }

  try {
    await prisma.sponsorChannel.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "delete_sponsor_channel",
        targetId: String(id),
        details: `Sponsor kanal o'chirildi (ID: ${id})`
      }
    }).catch((e: unknown) => logger.error({ err: e }, "Audit log error"));

    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "Delete sponsor channel error");
    res.status(500).json({ error: "Sponsor kanalni o'chirishda xatolik yuz berdi." });
  }
});

export default router;
