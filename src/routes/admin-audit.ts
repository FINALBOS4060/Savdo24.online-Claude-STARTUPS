import { Router, Response } from "express";
import { PUBLIC_USER_SELECT, APP_TIMEZONE, formatDateInTimezone, getStartOfDayInTimezone } from "../lib/pure-helpers";
import { logger } from "../lib/logger";
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
} from "../lib/context";

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
  } catch (err: unknown) {
    logger.error({ err }, "Get audit logs error");
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
        include: { buyer: { select: PUBLIC_USER_SELECT } }
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
  } catch (err: unknown) {
    logger.error({ err }, "Get stats error");
    res.status(500).json({ error: "Statistikani olishda xatolik yuz berdi." });
  }
});

// GET /api/admin/telegram-stats — Bot faolligi statistikasi (4-so'rov: Admin
// Dashboard uchun). Nechta ulangan foydalanuvchi, bugungi harakatlar soni,
// eng ko'p ishlatilgan funksiyalar va oxirgi 7 kunlik faollik grafigi.
// Hodisalar src/routes/telegram-integration.ts'dagi POST /api/telegram/track-event
// orqali botning o'zi tomonidan AnalyticsEvent(source="telegram_bot")
// sifatida yoziladi.
router.get("/telegram-stats", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    // TUZATISH: kun chegaralari endi server protsessining mahalliy vaqt
    // zonasiga (UTC bo'lishi ham, boshqa narsa bo'lishi ham mumkin edi)
    // emas, doim belgilangan APP_TIMEZONE'ga (Asia/Tashkent) nisbatan
    // hisoblanadi — qarang: src/lib/pure-helpers.ts. Bu "Bugun" ko'rsatkichi
    // va 7 kunlik grafikning haqiqiy mahalliy kunlarga mos kelishini
    // ta'minlaydi, server qanday TZ'da ishga tushirilishidan qat'iy nazar.
    const todayStart = getStartOfDayInTimezone(now, APP_TIMEZONE);
    // Asia/Tashkent doimiy UTC+5 (yozgi vaqtga o'tish yo'q) bo'lgani uchun
    // aniq 24 soatlik qadamlar bilan orqaga surish xavfsiz — DST bo'lgan
    // zonalarda bu taxminni qayta ko'rib chiqish kerak bo'lardi.
    const sevenDaysAgoStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    // TUZATISH: "obunachi yig'ish" boti (telegram-bot/subscriber-bot/
    // index.ts) o'z hodisalarini (subscriber_bot_start,
    // subscriber_bot_gate_passed) bir xil "telegram_bot" source ostida
    // yozadi — shu sabab pastdagi topFeatures/actionsToday ichida
    // ko'rinardi, lekin alohida "necha kishi /start bosdi, nechtasi
    // obuna bo'lib o'tdi" konversiya ko'rsatkichi yo'q edi. Endi bu
    // ikkisi (jami, hamma vaqt bo'yicha) alohida hisoblanadi.
    const [linkedUsersCount, eventsToday, topEventsRaw, recentEvents, subscriberBotStarts, subscriberBotGatePassed] = await Promise.all([
      prisma.user.count({ where: { telegramUserId: { not: null } } }),
      prisma.analyticsEvent.count({ where: { source: "telegram_bot", createdAt: { gte: todayStart } } }),
      prisma.analyticsEvent.groupBy({
        by: ["event"],
        where: { source: "telegram_bot", createdAt: { gte: sevenDaysAgoStart } },
        _count: { event: true },
        orderBy: { _count: { event: "desc" } },
        take: 6
      }),
      // SQLite (lokal) va PostgreSQL (production) orasida mos keladigan sanaga
      // ko'ra guruhlash uchun xom SQL o'rniga sodda JS guruhlash ishlatiladi —
      // 7 kunlik oyna kichik hajmda bo'lgani uchun bu yetarlicha samarali.
      prisma.analyticsEvent.findMany({
        where: { source: "telegram_bot", createdAt: { gte: sevenDaysAgoStart } },
        select: { createdAt: true }
      }),
      prisma.analyticsEvent.count({ where: { source: "telegram_bot", event: "subscriber_bot_start" } }),
      prisma.analyticsEvent.count({ where: { source: "telegram_bot", event: "subscriber_bot_gate_passed" } })
    ]);

    const dailyCounts = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgoStart.getTime() + i * 24 * 60 * 60 * 1000);
      dailyCounts.set(formatDateInTimezone(d, APP_TIMEZONE), 0);
    }
    for (const e of recentEvents) {
      // TUZATISH: ilgari `toISOString().slice(0,10)` (har doim UTC) bilan
      // guruhlanardi — endi yuqoridagi kunlar bilan bir xil TZ (Asia/Tashkent)
      // bo'yicha, shuning uchun kalitlar har doim mos tushadi.
      const key = formatDateInTimezone(new Date(e.createdAt), APP_TIMEZONE);
      if (dailyCounts.has(key)) dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
    }

    res.json({
      linkedUsersCount,
      actionsToday: eventsToday,
      topFeatures: topEventsRaw.map((e: any) => ({ event: e.event, count: e._count.event })),
      dailySeries: Array.from(dailyCounts.entries()).map(([day, count]) => ({ day, count })),
      subscriberBotFunnel: {
        starts: subscriberBotStarts,
        gatePassed: subscriberBotGatePassed,
        conversionRate: subscriberBotStarts > 0 ? Math.round((subscriberBotGatePassed / subscriberBotStarts) * 1000) / 10 : 0
      }
    });
  } catch (err: unknown) {
    logger.error({ err }, "Get telegram stats error");
    res.status(500).json({ error: "Bot statistikasini yuklashda xatolik yuz berdi." });
  }
});

export default router;
