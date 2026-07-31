import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { PUBLIC_USER_SELECT } from "../lib/pure-helpers";
import { logger } from "../lib/logger";
// 117-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (conversations/messaging: create, list,
// messages tarixi, xabar yuborish, o'qilgan deb belgilash). Router
// "/api/conversations" ostiga mount qilinadi, yo'llar nisbiy yozilgan.
import {
  prisma,
  authenticateToken,
  createNotification,
  io,
  AuthRequest
} from "../lib/context";

const router = Router();

// POST /api/conversations — yangi suhbat boshlash
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { startupId, sellerId } = req.body;
    const buyerId = req.user!.id;
    const sellerIdNum = parseInt(sellerId, 10);

    if (isNaN(sellerIdNum)) {
      return res.status(400).json({ error: "Yaroqsiz sotuvchi ID." });
    }

    if (buyerId === sellerIdNum) {
      return res.status(400).json({ error: "O'zingiz bilan suhbat ocha olmaysiz." });
    }

    // Check if startup and seller exist
    const startup = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startup) {
      return res.status(404).json({ error: "Loyiha topilmadi." });
    }
    const seller = await prisma.user.findUnique({ where: { id: sellerIdNum } });
    if (!seller) {
      return res.status(404).json({ error: "Sotuvchi topilmadi." });
    }

    let conversation = await prisma.conversation.findUnique({
      where: { startupId_buyerId_sellerId: { startupId, buyerId, sellerId: sellerIdNum } }
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { startupId, buyerId, sellerId: sellerIdNum }
      });
    }
    res.json(conversation);
  } catch (err: any) {
    logger.error({ err }, "Create conversation error");
    res.status(500).json({ error: "Suhbat boshlashda xatolik yuz berdi." });
  }
});

// GET /api/conversations — barcha suhbatlar
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: {
        buyer: { select: PUBLIC_USER_SELECT },
        seller: { select: PUBLIC_USER_SELECT },
        startup: true
      },
      orderBy: { lastMessageAt: "desc" }
    });
    res.json(conversations);
  } catch (err: any) {
    logger.error({ err }, "Get conversations error");
    res.status(500).json({ error: "Suhbatlarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/conversations/:id/messages — suhbat tarixi
router.get("/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const before = req.query.before as string;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
      return res.status(403).json({ error: "Siz bu suhbat ishtirokchisi emassiz." });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    res.json({
      messages: messages.reverse(),
      hasMore: messages.length === 50
    });
  } catch (err: any) {
    logger.error({ err }, "Get messages error");
    res.status(500).json({ error: "Xabarlarni yuklashda xatolik yuz berdi." });
  }
});

// POST /api/conversations/:id/messages — yangi xabar yuborish
router.post("/:id/messages", authenticateToken, rateLimit({ windowMs: 60 * 1000, max: 20 }), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const messageSchema = z.object({
      content: z.string().trim().min(1, "Xabar matni bo'sh bo'lishi mumkin emas").max(3000, "Xabar matni 3000 ta belgidan oshmasligi kerak")
    });

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { content } = parsed.data;
    const senderId = req.user!.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        buyer: { select: PUBLIC_USER_SELECT },
        seller: { select: PUBLIC_USER_SELECT }
      }
    });
    if (!conversation || (conversation.buyerId !== senderId && conversation.sellerId !== senderId)) return res.status(403).json({ error: "Siz bu suhbat ishtirokchisi emassiz" });

    const message = await prisma.message.create({
      data: { conversationId: id, senderId, content }
    });
    await prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });

    const recipientId = senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
    io.to(`user:${recipientId}`).emit("new_message", message);

    // Create persistent notification for new message
    const senderName = senderId === conversation.buyerId ? conversation.buyer.name : conversation.seller.name;
    await createNotification(
      recipientId,
      "MESSAGE",
      "Yangi xabar",
      `${senderName} sizga yangi xabar yubordi: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
      `/messages`
    );

    res.json(message);
  } catch (err: any) {
    logger.error({ err }, "Post message error");
    res.status(500).json({ error: "Xabar yuborishda xatolik yuz berdi." });
  }
});

// PATCH /api/conversations/:id/read — xabarlarni o'qilgan deb belgilash
router.patch("/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
      return res.status(403).json({ error: "Siz bu suhbat ishtirokchisi emassiz." });
    }

    await prisma.message.updateMany({
      where: { conversationId: id, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() }
    });
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Read messages error");
    res.status(500).json({ error: "Xabarlarni o'qilgan deb belgilashda xatolik yuz berdi." });
  }
});

export default router;
