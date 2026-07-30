import { Router, Request, Response } from "express";
import { financialActionLimiter } from "../lib/rateLimiters";
import { logger } from "../lib/logger";
// 126-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (GET /api/escrow/my-purchases, POST
// /api/escrow/release, POST /api/escrow/dispute, GET+PATCH
// /api/admin/escrow-disputes*). Mantiq AYNAN o'zgarishsiz (62/63-band
// nizo-himoyasi, 115-band refund_required tuzatishi ham shu bilan
// birga ko'chirildi). b2b.ts/referrals.ts naqshi bilan bir xil: bitta
// router "/api" ostiga mount qilinadi (yo'llar o'zida to'liq yozilgan,
// chunki ikki xil prefiks — /api/escrow va /api/admin/escrow-disputes —
// bitta faylda).
import {
  prisma,
  authenticateToken,
  requireAdmin,
  createNotification,
  AuthRequest
} from "../../server";

const router = Router();

router.get("/escrow/my-purchases", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const escrows = await prisma.escrowPayment.findMany({
      where: { payment: { userId: req.user?.id } },
      include: { payment: true }
    });
    res.json(escrows);
  } catch (err) {
    res.status(500).json({ error: "Escrow ma'lumotlarini yuklashda xatolik." });
  }
});

router.post("/escrow/release", authenticateToken, financialActionLimiter, async (req: AuthRequest, res: Response) => {
  const { paymentId } = req.body;
  try {
    const escrow = await prisma.escrowPayment.findUnique({
      where: { paymentId },
      include: { payment: { include: { startup: true } } }
    });

    if (!escrow || escrow.payment.userId !== req.user?.id) {
      return res.status(403).json({ error: "Ruxsat etilmagan." });
    }

    if (escrow.status !== "held") {
      return res.status(400).json({ error: "Escrow holati noto'g'ri." });
    }

    // 62-band: xaridor DetailPage'dan "Nizo ochish" orqali umumiy Dispute
    // yaratganda EscrowPayment.status "held" bo'lib qolaveradi (faqat
    // /api/escrow/dispute uni "disputed" qiladi) — shu sabab xaridor
    // ochiq nizo turgan holda ham mablag'ni qo'lda ozod qila olardi,
    // avtomatik ozod qilish (autoReleaseEscrows) esa buni to'g'ri
    // bloklardi. Endi ikkalasi bir xil tekshiruvdan foydalanadi.
    const openDispute = await prisma.dispute.findFirst({
      where: { paymentId, status: { in: ["open", "reviewing"] } }
    });
    if (openDispute) {
      return res.status(400).json({ error: "Bu to'lov bo'yicha ochiq nizo mavjud. Avval nizo hal qilinishi kerak." });
    }

    const updated = await prisma.escrowPayment.updateMany({
      where: { id: escrow.id, status: "held" },
      data: { status: "released", releasedAt: new Date() }
    });

    if (updated.count === 0) {
      return res.status(409).json({ error: "Bu mablag' allaqachon ozod qilingan yoki holati o'zgargan." });
    }

    // Notify seller
    if (escrow.payment.startup?.userId) {
      await createNotification(
        escrow.payment.startup.userId,
        "SYSTEM",
        "Mablag' ozod qilindi!",
        `Sizning "${escrow.payment.startup.name}" loyihangiz uchun mablag' xaridor tomonidan tasdiqlandi va ozod qilindi.`,
        `/profile`
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Mablag'ni ozod qilishda xatolik." });
  }
});

router.post("/escrow/dispute", authenticateToken, financialActionLimiter, async (req: AuthRequest, res: Response) => {
  const { paymentId, reason, evidence } = req.body;
  try {
    const escrow = await prisma.escrowPayment.findUnique({
      where: { paymentId },
      include: { payment: true }
    });

    if (!escrow || escrow.payment.userId !== req.user?.id) {
      return res.status(403).json({ error: "Ruxsat etilmagan." });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "Nizo sababini kiriting." });
    }

    if (escrow.status !== "held") {
      return res.status(400).json({ error: "Bu to'lov bo'yicha nizo ochib bo'lmaydi (mablag' allaqachon ozod qilingan yoki nizo mavjud)." });
    }

    // Race-safe: faqat hali "held" holatidagi yozuvni "disputed"ga o'tkazamiz
    const updated = await prisma.escrowPayment.updateMany({
      where: { id: escrow.id, status: "held" },
      data: { status: "disputed" }
    });

    if (updated.count === 0) {
      return res.status(409).json({ error: "Bu to'lov holati o'zgardi. Qaytadan urinib ko'ring." });
    }

    await prisma.disputeResolution.create({
      data: {
        escrowId: escrow.id,
        reason,
        evidence: JSON.stringify(evidence || [])
      }
    });

    // 5-MUAMMO: Hardcoded admin ID (1) o'rniga barcha haqiqiy adminlarni topib, ularga bildirishnoma yuborish
    const admins = await prisma.user.findMany({ where: { role: "Admin" } });
    await Promise.all(admins.map((admin: any) =>
      createNotification(
        admin.id,
        "SYSTEM",
        "Yangi Escrow Nizosi",
        `To'lov #${paymentId} bo'yicha nizo ochildi.`,
        // 93-band: "/admin/disputes" haqiqiy route emas edi (faqat "/admin" bor,
        // "*" catch-all uni "/" ga qaytarardi) — endi mavjud "/admin" route +
        // AdminPage o'zi o'qiydigan ?tab= query orqali to'g'ri tabga o'tkaziladi.
        `/admin?tab=disputes`
      )
    ));

    res.json({ success: true, message: "Nizo qabul qilindi. Admin ko'rib chiqadi." });
  } catch (err) {
    res.status(500).json({ error: "Nizo ochishda xatolik." });
  }
});

// 13-MUAMMO (asl izoh saqlangan): POST /api/escrow/dispute orqali
// DisputeResolution yozuvi yaratilar edi va admin "Yangi Escrow Nizosi"
// bildirishnomasi bilan /admin/disputes'ga yo'naltirilardi, LEKIN
// /admin/disputes aslida faqat alohida `Dispute` modelini (umumiy to'lov
// nizolari) ko'rsatadi — Escrow nizolari (`DisputeResolution` + tegishli
// `EscrowPayment.status = "disputed"`) uchun ularni ko'rish/hal qilish
// uchun hech qanday endpoint mavjud emas edi. Quyidagi ikki endpoint shu
// funksiyani yakunlaydi:
router.get("/admin/escrow-disputes", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const disputes = await prisma.disputeResolution.findMany({
      where: { resolution: "pending" },
      include: {
        escrow: {
          include: {
            payment: {
              include: {
                startup: { select: { id: true, name: true, price: true, userId: true } },
                user: { select: { id: true, name: true, email: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(disputes);
  } catch (err: any) {
    logger.error({ err }, "Get escrow disputes error");
    res.status(500).json({ error: "Escrow nizolarini olishda xatolik yuz berdi." });
  }
});

router.patch("/admin/escrow-disputes/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { resolution, adminNote } = req.body;

  if (resolution !== "released" && resolution !== "refunded") {
    return res.status(400).json({ error: "Qaror faqat 'released' yoki 'refunded' bo'lishi mumkin." });
  }

  try {
    const disputeResolution = await prisma.disputeResolution.findUnique({
      where: { id },
      include: {
        escrow: { include: { payment: { include: { startup: true } } } }
      }
    });

    if (!disputeResolution) {
      return res.status(404).json({ error: "Nizo topilmadi." });
    }

    if (disputeResolution.resolution !== "pending") {
      return res.status(409).json({ error: "Bu nizo allaqachon hal qilingan." });
    }

    // Race-safe: faqat hali "disputed" holatidagi escrow'ni yangilaymiz
    const updatedEscrow = await prisma.escrowPayment.updateMany({
      where: { id: disputeResolution.escrowId, status: "disputed" },
      data: { status: resolution, releasedAt: new Date() }
    });

    if (updatedEscrow.count === 0) {
      return res.status(409).json({ error: "Escrow holati o'zgargan, qaytadan urinib ko'ring." });
    }

    // 115-band: to'lov CoinGate orqali amalga oshirilgan (haqiqiy escrow
    // hamyoni emas, faqat ilova ichidagi status). Shu sabab "refunded"
    // deb belgilash HALI HAQIQIY pul qaytarilishini anglatmaydi — buni
    // admin/moliya CoinGate panelida QO'LDA amalga oshirishi kerak.
    // Payment.status ham "refund_required"ga o'tkaziladi (bu status
    // allaqachon boshqa joyda ham xuddi shu ma'noda ishlatiladi), admin
    // buni kuzatib qo'lda qaytarishni yakunlashi kerak.
    if (resolution === "refunded") {
      await prisma.payment.update({
        where: { id: disputeResolution.escrow.paymentId },
        data: { status: "refund_required" }
      }).catch((e: any) => logger.error({ err: e }, "Payment status refund_required'ga o'tkazishda xatolik"));
    }

    await prisma.disputeResolution.update({
      where: { id },
      data: { resolution, adminNote: adminNote || null, resolvedAt: new Date() }
    });

    const startup = disputeResolution.escrow.payment.startup;
    const buyerId = disputeResolution.escrow.payment.userId;
    const sellerId = startup?.userId;
    const resultText = resolution === "released"
      ? "sotuvchiga ozod qilindi"
      : "xaridorga qaytarish uchun admin tomonidan tasdiqlandi (CoinGate orqali qo'lda qayta ishlanadi)";

    if (buyerId) {
      await createNotification(buyerId, "SYSTEM", "Escrow nizosi hal qilindi",
        `"${startup?.name}" bo'yicha nizo hal qilindi: mablag' ${resultText}.`, `/profile?tab=purchases`);
    }
    if (sellerId) {
      await createNotification(sellerId, "SYSTEM", "Escrow nizosi hal qilindi",
        `"${startup?.name}" bo'yicha nizo hal qilindi: mablag' ${resultText}.`, `/profile?tab=earnings`);
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: resolution === "released" ? "release_escrow_dispute" : "refund_escrow_dispute",
        targetId: String(disputeResolution.id),
        details: `Escrow nizosi (to'lov ID: ${disputeResolution.paymentId}) hal qilindi: ${resolution}.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Resolve escrow dispute error");
    res.status(500).json({ error: "Nizoni hal qilishda xatolik yuz berdi." });
  }
});

// GET /api/admin/escrow-refunds (pending refunds)
router.get("/admin/escrow-refunds", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: "refund_required" },
      include: {
        startup: { select: { id: true, name: true, price: true } },
        user: { select: { id: true, name: true, email: true } },
        escrow: true
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(payments);
  } catch (err: any) {
    logger.error({ err }, "Get pending escrow refunds error");
    res.status(500).json({ error: "Qaytarish talab qilinadigan to'lovlarni olishda xatolik." });
  }
});

// POST /api/admin/escrow-refunds/:paymentId/complete (mark refund as completed)
router.post("/admin/escrow-refunds/:paymentId/complete", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { paymentId } = req.params;
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { startup: true }
    });

    if (!payment) {
      return res.status(404).json({ error: "To'lov topilmadi." });
    }

    if (payment.status !== "refund_required") {
      return res.status(400).json({ error: "Bu to'lov qaytarish talab qilinadigan holatda emas." });
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "refund_completed" }
    });

    if (payment.userId) {
      await createNotification(
        payment.userId,
        "SYSTEM",
        "Pul qaytarildi (Refund)",
        `"${payment.startup?.name || 'Mahsulot'}" uchun CoinGate orqali mablag'ingiz muvaffaqiyatli qaytarildi.`,
        `/profile?tab=purchases`
      );
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "complete_escrow_refund",
        targetId: paymentId,
        details: `To'lov (ID: ${paymentId}) bo'yicha pul qaytarish CoinGate'da bajarildi deb belgilandi.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json({ success: true, message: "Pul qaytarish yakunlandi deb belgilandi." });
  } catch (err: any) {
    logger.error({ err }, "Complete escrow refund error");
    res.status(500).json({ error: "Pul qaytarishni yakunlashda xatolik." });
  }
});

export default router;
