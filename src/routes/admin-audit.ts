import { Router, Response } from "express";
// 120-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (GET /api/admin/audit-logs va GET /api/admin/stats).
// Naqsh auth.ts/support.ts/sponsor-channels.ts/b2b.ts/disputes.ts bilan bir xil.
// Ikkalasi ham faqat o'qish (read-only), start() TASHQARISIDA edi — eng kam
// xavfli guruh sifatida tanlandi.
import {
  prisma,
  authenticateToken,
  requireAdmin,
  getSetting,
  AuthRequest
} from "../../server";

const router = Router();

// GET /api/admin/audit-logs — Admin amallari tarixi (Admin)
router.get("/audit-logs", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string || "1");
    const limit = parseInt(req.query.limit as string || "20");
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * safeLimit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        skip,
        include: { admin: { select: { name: true } } }
      }),
      prisma.auditLog.count()
    ]);

    res.json({
      data: logs,
      total,
      page,
      totalPages: Math.ceil(total / safeLimit)
    });
  } catch (err: any) {
    console.error("Get audit logs error:", err);
    res.status(500).json({ error: "Audit loglarni olishda xatolik yuz berdi." });
  }
});

// GET /api/admin/stats — Platforma komissiyasi va sotuvlar statistikasi (Admin)
router.get("/stats", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalActiveStartups,
      stats,
      monthlyStats,
      lastDisputes,
      lastReports
    ] = await Promise.all([
      prisma.user.count(),
      prisma.startup.count({ where: { status: "active", soldStatus: "sotuvda" } }),
      prisma.payment.aggregate({
        where: { status: "completed" },
        _sum: { amount: true, platformFeeAmount: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: {
          status: "completed",
          createdAt: { gte: firstDayOfMonth }
        },
        _sum: { platformFeeAmount: true }
      }),
      prisma.dispute.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { buyer: true }
      }),
      prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: "desc" }
      })
    ]);

    const totalVolume = stats._sum.amount || 0;
    const totalCommission = stats._sum.platformFeeAmount || 0;
    const monthlyCommission = monthlyStats._sum.platformFeeAmount || 0;

    const openDisputes = await prisma.dispute.count({ where: { status: "open" } });

    // MUHIM: aslida to'lov yaratilganda (createPaymentOrder) kalit avval DB
    // sozlamasidan (getSetting), keyin process.env'dan olinadi — lekin bu
    // yerda faqat process.env tekshirilardi. Natijada admin kalitni
    // Sozlamalar panelidan (DB'ga) kiritsa ham, dashboard "to'lov tizimi
    // sozlanmagan" degan noto'g'ri ogohlantirishni ko'rsatishda davom etardi.
    const coingateTokenConfigured = !!((await getSetting("COINGATE_API_TOKEN")) || process.env.COINGATE_API_TOKEN);

    res.json({
      totalUsers,
      totalActiveStartups,
      totalCompletedSales: stats._count || 0,
      totalCommission,
      monthlyCommission,
      totalVolume,
      openDisputes,
      lastDisputes: lastDisputes.map((d: any) => ({
        id: d.id,
        buyer: d.buyer?.name,
        reason: d.reason,
        status: d.status,
        date: d.createdAt
      })),
      lastReports: lastReports.map((r: any) => ({
        id: r.id,
        targetType: r.targetType,
        reason: r.reason,
        status: r.status,
        date: r.createdAt
      })),
      systemStatus: {
        coingateConfigured: coingateTokenConfigured,
        isProduction: process.env.NODE_ENV === "production",
        envWarnings: (process.env.NODE_ENV === "production" && !coingateTokenConfigured) ? ["To'lov tizimi sozlanmagan (COINGATE_API_TOKEN topilmadi)"] : []
      }
    });
  } catch (err: any) {
    console.error("Get stats error:", err);
    res.status(500).json({ error: "Statistikani olishda xatolik yuz berdi." });
  }
});

export default router;
