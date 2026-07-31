import { Router, Response } from "express";
import { logger } from "../lib/logger";
// 110-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi. Naqsh auth.ts/support.ts bilan bir xil —
// umumiy prisma/middleware'lar "../../server"'dan import qilinadi.
import {
  prisma,
  authenticateToken,
  requireAdmin,
  AuthRequest
} from "../lib/context";

const router = Router();

// GET /api/admin/sponsor-channels — Barcha sponsor kanallarni olish (Admin)
router.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const channels = await prisma.sponsorChannel.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(channels);
  } catch (err: any) {
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
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.status(201).json(channel);
  } catch (err: any) {
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
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json(updated);
  } catch (err: any) {
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
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Delete sponsor channel error");
    res.status(500).json({ error: "Sponsor kanalni o'chirishda xatolik yuz berdi." });
  }
});

export default router;
