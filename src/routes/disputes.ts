import { Router, Response } from "express";
import { financialActionLimiter } from "../lib/rateLimiters";
import { logger } from "../lib/logger";
// 112-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (POST/GET/PATCH /api/disputes bloki).
// Naqsh auth.ts/support.ts/sponsor-channels.ts/b2b.ts bilan bir xil.
import {
  prisma,
  authenticateToken,
  requireAdmin,
  createNotification,
  notifyUserTelegram,
  notifyAdminTelegram,
  sendEmail,
  AuthRequest
} from "../lib/context";
import { escapeHtml } from "../lib/pure-helpers";

const router = Router();

// POST /api/disputes — Nizo ochish
router.post("/", authenticateToken, financialActionLimiter, async (req: AuthRequest, res: Response) => {
  const { paymentId, reason, description } = req.body;

  if (!paymentId || !reason || !description) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment || payment.userId !== req.user?.id) {
      return res.status(403).json({ error: "Siz faqat o'zingiz to'lagan buyurtmalar bo'yicha nizo ocha olasiz." });
    }

    if (payment.status !== "completed") {
      return res.status(400).json({ error: "Nizo ochish uchun to'lov to'liq muvaffaqiyatli amalga oshirilgan bo'lishi shart." });
    }

    const existingDispute = await prisma.dispute.findFirst({
      where: { paymentId }
    });

    if (existingDispute) {
      return res.status(409).json({ error: "Ushbu buyurtma bo'yicha allaqachon nizo ochilgan." });
    }

    const dispute = await prisma.dispute.create({
      data: {
        paymentId,
        buyerId: req.user!.id,
        reason,
        description,
        status: "open"
      }
    });

    notifyAdminTelegram(`⚖️ Yangi nizo ochildi (#${dispute.id}). Sabab: ${reason}`);

    res.status(201).json(dispute);
  } catch (err: unknown) {
    logger.error({ err }, "Create dispute error");
    res.status(500).json({ error: "Nizo ochishda xatolik yuz berdi." });
  }
});

// GET /api/disputes — Barcha nizolarni olish (Admin)
router.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string || "1");
    const limit = parseInt(req.query.limit as string || "20");
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * safeLimit;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          payment: {
            include: {
              startup: {
                select: {
                  id: true,
                  name: true,
                  price: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        skip
      }),
      prisma.dispute.count()
    ]);

    res.json({
      data: disputes,
      total,
      page,
      totalPages: Math.ceil(total / safeLimit)
    });
  } catch (err: unknown) {
    logger.error({ err }, "Get disputes error");
    res.status(500).json({ error: "Nizolarni olishda xatolik yuz berdi." });
  }
});

const ALLOWED_DISPUTE_STATUSES = ["open", "reviewing", "resolved", "rejected"];

// PATCH /api/disputes/:id — Nizoni yangilash (Admin)
router.patch("/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const disputeId = parseInt(req.params.id, 10);
  if (isNaN(disputeId)) {
    return res.status(400).json({ error: "Yaroqsiz Nizo ID." });
  }
  const { status, adminNote } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status ko'rsatilishi lozim." });
  }

  if (!ALLOWED_DISPUTE_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Yaroqsiz status qiymati." });
  }

  try {
    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        adminNote: adminNote || null,
        resolvedAt: status === "resolved" || status === "rejected" ? new Date() : null
      },
      include: {
        payment: { include: { startup: true } }
      }
    });

    // Notify both parties about dispute resolution
    const disputeTitle = "Nizo hal qilindi";
    const disputeMsg = `"${updated.payment.startup?.name}" bo'yicha nizo ${status === 'resolved' ? 'hal qilindi' : 'rad etildi'}. Admin izohi: ${adminNote || 'Izohsiz'}`;

    // MUAMMO: `Dispute` modelida `sellerId` maydoni UMUMAN YO'Q (faqat
    // `buyerId` bor) — shu sabab `updated.sellerId` doim `undefined` bo'lib,
    // sotuvchiga ilova ichidagi bildirishnoma HECH QACHON yuborilmasdi
    // (faqat quyidagi email jo'natish qismi to'g'ri manbadan — startup
    // egasidan — foydalangani uchun email ishlar edi). Sotuvchi ID'sini ham
    // xuddi shu to'g'ri manbadan olib, bildirishnomani TUZATILDI:
    const sellerUserId = updated.payment.startup?.userId;
    if (updated.buyerId) await createNotification(updated.buyerId, "SYSTEM", disputeTitle, disputeMsg, `/profile?tab=purchases`);
    if (sellerUserId) await createNotification(sellerUserId, "SYSTEM", disputeTitle, disputeMsg, `/profile?tab=earnings`);
    if (updated.buyerId) notifyUserTelegram(updated.buyerId, `⚖️ <b>${disputeTitle}</b>\n\n${disputeMsg}`, `/profile?tab=purchases`);
    if (sellerUserId) notifyUserTelegram(sellerUserId, `⚖️ <b>${disputeTitle}</b>\n\n${disputeMsg}`, `/profile?tab=earnings`);

    // Send Emails
    const buyer = await prisma.user.findUnique({ where: { id: updated.buyerId } });
    const seller = sellerUserId ? await prisma.user.findUnique({ where: { id: sellerUserId } }) : null;

    const disputeMsgHtml = `"${escapeHtml(updated.payment.startup?.name)}" bo'yicha nizo ${status === 'resolved' ? 'hal qilindi' : 'rad etildi'}. Admin izohi: ${escapeHtml(adminNote) || 'Izohsiz'}`;
    if (buyer) await sendEmail(buyer.email, disputeTitle, `<p>${disputeMsgHtml}</p>`);
    if (seller) await sendEmail(seller.email, disputeTitle, `<p>${disputeMsgHtml}</p>`);

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: status === "resolved" ? "resolve_dispute" : "reject_dispute",
        targetId: String(disputeId),
        details: adminNote ? `Nizo statusi: ${status}. Izoh: ${adminNote}` : `Nizo statusi: ${status}`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json(updated);
  } catch (err: unknown) {
    logger.error({ err }, "Update dispute error");
    res.status(500).json({ error: "Nizoni yangilashda xatolik yuz berdi." });
  }
});

export default router;
