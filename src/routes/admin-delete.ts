import { Router, Response } from "express";
import { prisma, authenticateToken, requireAdmin, AuthRequest } from "../../server";

const router = Router();

// DELETE /api/admin/startups/:id — Loyihani o'chirish (Admin, kaskad transaction)
router.delete("/startups/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.$transaction(async (tx: any) => {
      await tx.review.deleteMany({ where: { startupId: id } });

      const ideas = await tx.idea.findMany({ where: { startupId: id } });
      const ideaIds = ideas.map((i: any) => i.id);
      await tx.ideaVote.deleteMany({ where: { ideaId: { in: ideaIds } } });
      await tx.idea.deleteMany({ where: { startupId: id } });

      const payments = await tx.payment.findMany({ where: { startupId: id } });
      const paymentIds = payments.map((p: any) => p.id);

      await tx.dispute.deleteMany({ where: { paymentId: { in: paymentIds } } });
      await tx.escrowPayment.deleteMany({ where: { paymentId: { in: paymentIds } } });

      const conversations = await tx.conversation.findMany({ where: { startupId: id } });
      for (const conv of conversations) {
        await tx.message.deleteMany({ where: { conversationId: conv.id } });
      }
      await tx.conversation.deleteMany({ where: { startupId: id } });

      await tx.listingSubscription.deleteMany({ where: { startupId: id } });
      await tx.topBoost.deleteMany({ where: { startupId: id } });
      await tx.payment.deleteMany({ where: { startupId: id } });

      await tx.startup.delete({ where: { id } });
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: "delete_startup",
        targetId: id,
        details: `Startup and all related records deleted`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json({ success: true, message: "Loyiha va unga tegishli barcha ma'lumotlar muvaffaqiyatli o'chirildi." });
  } catch (err: any) {
    console.error("Delete startup error:", err);
    res.status(500).json({ error: "E'lonni o'chirishda xatolik yuz berdi." });
  }
});

// DELETE /api/admin/ideas/:id — G'oya/Izohni o'chirish (Admin)
router.delete("/ideas/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Yaroqsiz ID." });
  }
  try {
    await prisma.ideaVote.deleteMany({ where: { ideaId: id } });
    await prisma.idea.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: "delete_idea",
        targetId: String(id),
        details: `Idea ${id} and its votes deleted`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json({ success: true, message: "Izoh muvaffaqiyatli o'chirildi." });
  } catch (err) {
    console.error("Admin delete idea error:", err);
    res.status(500).json({ error: "Izohni o'chirishda xatolik yuz berdi." });
  }
});

export default router;
