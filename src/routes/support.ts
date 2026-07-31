import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import { 
  prisma, 
  sendEmail, 
  notifyAdminTelegram, 
  authenticateToken, 
  requireAdmin, 
  AuthRequest 
} from "../lib/context";
import { escapeHtml } from "../lib/pure-helpers";
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
      "admin@savdo24.online",
      `Yangi qo'llab-quvvatlash chiptasi: ${escapeHtml(subject)}`,
      `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Yangi qo'llab-quvvatlash chiptasi</h2>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Mavzu:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Xabar:</strong></p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
          ${escapeHtml(message).replace(/\n/g, '<br>')}
        </div>
        <hr/>
        <p>ID: ${ticket.id}</p>
      </div>
      `
    );

    await notifyAdminTelegram(
      `📩 <b>Yangi murojaat/shikoyat</b>\n\n<b>Email:</b> ${escapeHtml(email)}\n<b>Mavzu:</b> ${escapeHtml(subject)}\n<b>Xabar:</b>\n${escapeHtml(message)}\n\n<b>Ticket ID:</b> ${ticket.id}`
    );

    res.json({ success: true, message: "Xabaringiz muvaffaqiyatli yuborildi. Tez orada siz bilan bog'lanamiz." });
  } catch (err: any) {
    logger.error({ err }, "Support ticket error");
    res.status(500).json({ error: "Xabarni yuborishda xatolik yuz berdi." });
  }
});

// ESLATMA: avval shu yerda GET /api/support (admin uchun) alohida endpoint
// bor edi, lekin u hech qayerdan (frontendda) chaqirilmasdi — GET
// /api/admin/support-tickets (pastda) aynan bir xil ma'lumotni qaytaradi
// va AdminPage.tsx haqiqatda shuni ishlatadi. Duplikat o'lik endpoint
// olib tashlandi (94-band bilan bir xil turdagi tozalash).

// GET /api/admin/support-tickets
router.get("/admin/support-tickets", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (err) {
    logger.error({ err }, "Get support tickets error");
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

    // Boshqa admin amallari kabi (reports, users va h.k.) bu o'zgarish ham
    // audit logga yozilishi kerak — avval bu yerda unutilgan edi.
    const adminUser = (req as any).user;
    await prisma.auditLog.create({
      data: {
        adminId: adminUser?.id || 0,
        adminEmail: adminUser?.email,
        action: "update_support_ticket_status",
        targetType: "SupportTicket",
        targetId: String(ticket.id),
        details: `Support ticket status updated to ${result.data.status}`
      }
    }).catch((auditErr: any) => {
      logger.error({ err: auditErr }, "Audit log yozishda xatolik (support ticket)");
    });

    res.json(ticket);
  } catch (err) {
    logger.error({ err }, "Update ticket error");
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// POST /api/reports — Shikoyat qilish
// 122-band: avval bu yerda supportLimiter HAM qo'shilgan edi (reportLimiter
// bilan bir vaqtda) — ikkalasi bir xil sozlamaga ega (max=5/15min), shu
// sabab ikkinchisi sof ortiqcha edi (funksional farq yo'q, faqat keraksiz
// ikkinchi hisoblagich). reportLimiter o'zi maqsadli va yetarli.
router.post("/reports", authenticateToken, reportLimiter, async (req: AuthRequest, res: Response) => {
  const result = reportSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues.map((e: any) => e.message).join(" ") });
  }

  const { targetType, targetId, reason, description } = result.data;

  try {
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: req.user?.id || 0,
        targetId,
        targetType
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
      `<b>Nishon turi:</b> ${escapeHtml(targetType)}\n` +
      `<b>Nishon ID:</b> ${escapeHtml(targetId)}\n` +
      `<b>Sabab:</b> ${escapeHtml(reason)}\n` +
      `<b>Tafsilotlar:</b> ${description ? escapeHtml(description) : 'Yo\'q'}\n\n` +
      `<b>Report ID:</b> ${report.id}`
    );

    res.status(201).json(report);
  } catch (err: any) {
    // Yangi qo'shilgan @@unique([reporterId, targetId, targetType]) cheklovi
    // poyga holatida (ikkita bir vaqtdagi so'rov) ishga tushishi mumkin —
    // bu holatda ham foydalanuvchiga tushunarli xabar ko'rsatamiz, xom 500
    // xatosi emas.
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Siz ushbu e'lon yoki izoh bo'yicha allaqachon shikoyat qoldirgansiz." });
    }
    logger.error({ err }, "Create report error");
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
    logger.error({ err }, "Get reports error");
    res.status(500).json({ error: "Shikoyatlarni olishda xatolik yuz berdi." });
  }
});

// PATCH /api/reports/:id/status — Shikoyat statusini yangilash (Admin)
router.patch("/reports/:id/status", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Yaroqsiz Report ID" });
  }
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
        adminEmail: req.user?.email,
        action: result.data.status === "reviewed" ? "resolve_report" : "reject_report",
        targetType: "Report",
        targetId: String(id),
        details: `Report status updated to ${result.data.status}`
      }
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update report status error");
    res.status(500).json({ error: "Shikoyatni yangilashda xatolik yuz berdi." });
  }
});

export default router;
