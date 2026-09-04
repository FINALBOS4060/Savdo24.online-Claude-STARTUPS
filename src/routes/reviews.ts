import { Router, Request, Response } from "express";
import { financialActionLimiter } from "../lib/rateLimiters";
import { logger } from "../lib/logger";
// 113-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (POST /api/reviews va GET /api/users/:id/reviews).
// Naqsh support.ts bilan bir xil: router "/api" ostiga mount qilinadi,
// ichida to'liq yo'llar ko'rsatiladi (chunki ikkala route boshqa-boshqa
// prefiks ostida: /reviews va /users/:id/reviews).
import {
  prisma,
  authenticateToken,
  createNotification,
  notifyUserTelegram,
  sendEmail,
  AuthRequest
} from "../lib/context";
import { escapeHtml } from "../lib/pure-helpers";

const router = Router();

// POST /api/reviews — Sharh qoldirish
router.post("/reviews", authenticateToken, financialActionLimiter, async (req: AuthRequest, res: Response) => {
  const { rating, comment, startupId } = req.body;

  if (!rating || !comment || !startupId) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
  }

  if (comment.length > 1000) {
    return res.status(400).json({ error: "Sharh matni 1000 belgidan oshmasligi kerak." });
  }

  const ratingInt = parseInt(rating, 10);
  if (isNaN(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    return res.status(400).json({ error: "Reyting 1 dan 5 gacha bo'lishi kerak." });
  }

  try {
    // Check if the buyer indeed completed a payment for this startup
    const completedPayment = await prisma.payment.findFirst({
      where: {
        startupId,
        userId: req.user?.id,
        status: "completed"
      }
    });

    if (!completedPayment) {
      return res.status(403).json({ error: "Siz ushbu loyihani sotib olmagansiz yoki to'lov yakunlanmagan. Sharh qoldira olmaysiz." });
    }

    // Check if they already left a review for this startup to prevent duplicates
    const existingReview = await prisma.review.findFirst({
      where: {
        startupId,
        buyerId: req.user?.id
      }
    });

    if (existingReview) {
      return res.status(409).json({ error: "Siz ushbu loyiha uchun allaqachon sharh qoldirgansiz." });
    }

    const startup = await prisma.startup.findUnique({
      where: { id: startupId }
    });

    if (!startup || !startup.userId) {
      return res.status(404).json({ error: "Loyiha yoki uning sotuvchisi topilmadi." });
    }

    const review = await prisma.review.create({
      data: {
        rating: ratingInt,
        comment,
        startupId,
        buyerId: req.user!.id,
        sellerId: startup.userId
      }
    });

    // Notify seller
    // MUHIM: avval `tab=sales` yuborilardi, lekin ProfilePage'da bunday tab yo'q — haqiqiy nomi "earnings" (tuzatildi).
    await createNotification(
      startup.userId,
      "REVIEW",
      "Yangi sharh",
      `"${startup.name}" loyihangiz uchun yangi ${ratingInt} yulduzli sharh qoldirildi.`,
      `/profile?tab=earnings`
    );
    notifyUserTelegram(
      startup.userId,
      `⭐ "<b>${escapeHtml(startup.name)}</b>" loyihangiz uchun yangi ${ratingInt} yulduzli sharh qoldirildi.`,
      `/profile?tab=earnings`
    );

    const seller = await prisma.user.findUnique({ where: { id: startup.userId } });
    if (seller) {
      await sendEmail(
        seller.email,
        "Yangi sharh qoldirildi",
        `<p>Sizning <b>${escapeHtml(startup.name)}</b> loyihangizga yangi sharh qoldirildi:</p><blockquote>${escapeHtml(comment)}</blockquote><p>Reyting: ${ratingInt} ball</p>`
      );
    }

    // Recalculate seller's rating metrics
    const sellerReviews = await prisma.review.findMany({
      where: { sellerId: startup.userId }
    });

    const totalReviews = sellerReviews.length;
    const sum = sellerReviews.reduce((acc: number, r: any) => acc + r.rating, 0);
    const averageRating = totalReviews > 0 ? parseFloat((sum / totalReviews).toFixed(1)) : 0;

    await prisma.user.update({
      where: { id: startup.userId },
      data: {
        averageRating,
        totalReviews
      }
    });

    res.status(201).json(review);
  } catch (err: unknown) {
    // 132-bosqich: Review(startupId, buyerId) endi @@unique — agar ikkita so'rov
    // AYNAN bir vaqtda kelib, yuqoridagi existingReview tekshiruvidan ikkalasi
    // ham o'tib ketsa (poyga holati), Prisma shu yerda P2002 tashlaydi. Buni
    // umumiy "Serverda xatolik" (500) o'rniga tushunarli xabar bilan qaytaramiz.
    if (err && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "P2002") {
      return res.status(409).json({ error: "Siz ushbu loyiha uchun allaqachon sharh qoldirgansiz." });
    }
    logger.error({ err }, "Create review error");
    res.status(500).json({ error: "Sharh yozishda xatolik yuz berdi." });
  }
});

// GET /api/users/:id/reviews — Foydalanuvchining sharhlarini olish
router.get("/users/:id/reviews", async (req: Request, res: Response) => {
  const sellerId = parseInt(req.params.id, 10);
  if (isNaN(sellerId)) {
    return res.status(400).json({ error: "Yaroqsiz foydalanuvchi ID." });
  }

  try {
    const reviews = await prisma.review.findMany({
      where: { sellerId },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        startup: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    const user = await prisma.user.findUnique({
      where: { id: sellerId },
      select: {
        averageRating: true,
        totalReviews: true,
        name: true
      }
    });

    res.json({
      reviews,
      averageRating: user?.averageRating || 0,
      totalReviews: user?.totalReviews || 0,
      sellerName: user?.name || "Noma'lum"
    });
  } catch (err: unknown) {
    logger.error({ err }, "Get reviews error");
    res.status(500).json({ error: "Sharhlarni olishda xatolik yuz berdi." });
  }
});

export default router;
