import { Router, Request, Response } from "express";
import { z } from "zod";
import { 
  prisma, 
  sendEmail, 
  notifyAdminTelegram, 
  authenticateToken, 
  requireAdmin, 
  AuthRequest 
} from "../../server";
import { supportLimiter, reportLimiter } from "../lib/rateLimiters";

const router = Router();

// Zod schemas for input validation
const supportSchema = z.object({
  email: z.string().email("Xato: Elektron pochta manzili noto'g'ri."),
  subject: z.string().min(1, "Xato: Mavzu kiritilishi shart."),
  message: z.string().min(5, "Xato: Xabar juda qisqa (kamida 5 ta belgi bo'lishi shart).")
});

const reportSchema = z.object({
  targetType: z.string().min(1, "Xato: Nishon turi kiritilishi shart."),
  targetId: z.union([z.string(), z.number()]).transform(val => String(val)),
  reason: z.string().min(1, "Xato: Sabab kiritilishi shart."),
  description: z.string().optional().nullable()
});

const statusSchema = z.object({
  status: z.string().min(1, "Xato: Status ko'rsatilishi lozim.")
});

// POST /api/support — Yangi murojaat chiptasi
router.post("/support", supportLimiter, async (req: Request, res: Response) => {
  const result = supportSchema.safeParse(req.body);
  if (!result.success) {
    const errorMsg = result.error.issues.map((e: any) => e.message).join(" ");
    return res.status(400).json({ error: errorMsg });
  }

  const { email, subject, message } = result.data;

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        email,
        subject,
        message,
        status: "pending"
      }
    });

    await sendEmail(
      "admin@savdo24.uz",
      `Yangi qo'llab-quvvatlash chiptasi: ${subject}`,
      `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Yangi qo'llab-quvvatlash chiptasi</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mavzu:</strong> ${subject}</p>
        <p><strong>Xabar:</strong></p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        <hr/>
        <p>ID: ${ticket.id}</p>
      </div>
      `
    );

    await notifyAdminTelegram(
      `📩 <b>Yangi murojaat/shikoyat</b>\n\n<b>Email:</b> ${email}\n<b>Mavzu:</b> ${subject}\n<b>Xabar:</b>\n${message}\n\n<b>Ticket ID:</b> ${ticket.id}`
    );

    res.json({ success: true, message: "Xabaringiz muvaffaqiyatli yuborildi. Tez orada siz bilan bog'lanamiz." });
  } catch (err: any) {
    console.error("Support ticket error:", err);
    res.status(500).json({ error: "Xabarni yuborishda xatolik yuz berdi." });
  }
});

// GET /api/support — Barcha chiptalarni olish (Admin uchun)
router.get("/support", authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || user.role !== "Admin") {
    return res.status(403).json({ error: "Faqat adminlar uchun ruxsat etilgan." });
  }

  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: "Chiptalarni yuklashda xatolik." });
  }
});

// GET /api/admin/support-tickets
router.get("/admin/support-tickets", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (err) {
    console.error("Get support tickets error:", err);
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// PATCH /api/admin/support-tickets/:id/status
router.patch("/admin/support-tickets/:id/status", authenticateToken, requireAdmin, async (req, res) => {
  const result = statusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues.map((e: any) => e.message).join(" ") });
  }

  try {
    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status: result.data.status }
    });
    res.json(ticket);
  } catch (err) {
    console.error("Update ticket error:", err);
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// POST /api/reports — Shikoyat qilish
router.post("/reports", authenticateToken, reportLimiter, supportLimiter, async (req: AuthRequest, res: Response) => {
  const result = reportSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues.map((e: any) => e.message).join(" ") });
  }

  const { targetType, targetId, reason, description } = result.data;

  try {
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: req.user?.id || 0,
        targetId
      }
    });

    if (existingReport) {
      return res.status(409).json({ error: "Siz ushbu e'lon yoki izoh bo'yicha allaqachon shikoyat qoldirgansiz." });
    }

    const report = await prisma.report.create({
      data: {
        targetType,
        targetId,
        reporterId: req.user?.id || 0,
        reason,
        description,
        status: "pending"
      }
    });

    await notifyAdminTelegram(
      `⚠️ <b>Yangi shikoyat (Report) yaratildi</b>\n\n` +
      `<b>Shikoyat qiluvchi (User ID):</b> ${req.user?.id || 'Noma\'lum'}\n` +
      `<b>Nishon turi:</b> ${targetType}\n` +
      `<b>Nishon ID:</b> ${targetId}\n` +
      `<b>Sabab:</b> ${reason}\n` +
      `<b>Tafsilotlar:</b> ${description || 'Yo\'q'}\n\n` +
      `<b>Report ID:</b> ${report.id}`
    );

    res.status(201).json(report);
  } catch (err) {
    console.error("Create report error:", err);
    res.status(500).json({ error: "Shikoyat yuborishda xatolik yuz berdi." });
  }
});

// GET /api/reports — Barcha shikoyatlarni olish (Admin)
router.get("/reports", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string || "1");
    const limit = parseInt(req.query.limit as string || "20");
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * safeLimit;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        skip
      }),
      prisma.report.count()
    ]);

    res.json({
      data: reports,
      total,
      page,
      totalPages: Math.ceil(total / safeLimit)
    });
  } catch (err) {
    console.error("Get reports error:", err);
    res.status(500).json({ error: "Shikoyatlarni olishda xatolik yuz berdi." });
  }
});

// PATCH /api/reports/:id/status — Shikoyat statusini yangilash (Admin)
router.patch("/reports/:id/status", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = statusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues.map((e: any) => e.message).join(" ") });
  }

  try {
    const updated = await prisma.report.update({
      where: { id },
      data: { status: result.data.status }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: result.data.status === "reviewed" ? "resolve_report" : "reject_report",
        targetType: "Report",
        targetId: String(id),
        details: `Report status updated to ${result.data.status}`
      }
    });

    res.json(updated);
  } catch (err) {
    console.error("Update report status error:", err);
    res.status(500).json({ error: "Shikoyatni yangilashda xatolik yuz berdi." });
  }
});

export default router;
