import { Router, Response } from "express";
import { logger } from "../lib/logger";
// 111-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (--- B2B WHOLESALE --- va --- ADMIN B2B ---
// bloklari). Naqsh auth.ts/support.ts/sponsor-channels.ts bilan bir xil.
import {
  prisma,
  authenticateToken,
  requireAdmin,
  createNotification,
  AuthRequest
} from "../lib/context";

import { parsePagination } from "../lib/pagination";

const router = Router();

router.post("/onboard", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { companyName, taxId } = req.body;
  if (!companyName || !String(companyName).trim()) {
    return res.status(400).json({ error: "Kompaniya nomi kiritilishi shart." });
  }
  try {
    const existing = await prisma.b2BAccount.findUnique({ where: { userId: req.user?.id || 0 } });
    if (existing) {
      return res.status(400).json({ error: "Sizda allaqachon B2B hisob mavjud." });
    }
    const b2b = await prisma.b2BAccount.create({
      data: {
        userId: req.user?.id || 0,
        companyName,
        taxId,
        verified: false, // Admin needs to verify
        discount: 20
      }
    });

    // 5-MUAMMO: Hardcoded admin ID (1) o'rniga barcha haqiqiy adminlarni topib, ularga bildirishnoma yuborish
    const admins = await prisma.user.findMany({ where: { role: "Admin" } });
    await Promise.all(admins.map((admin: any) =>
      createNotification(
        admin.id,
        "SYSTEM",
        "Yangi B2B So'rov",
        `"${companyName}" kompaniyasi B2B hisob uchun so'rov yubordi.`,
        // 93-band: "/admin/b2b" ham route emas edi, ham AdminPage'da B2B tabi
        // umuman yo'q (HALI QILINMAGAN ro'yxatidagi ma'lum kamchilik) — to'g'ridan-to'g'ri
        // yangi B2B tabiga yo'naltiriladi.
        `/admin?tab=b2b`
      )
    ));

    res.json(b2b);
  } catch (err) {
    res.status(500).json({ error: "B2B hisob yaratishda xatolik." });
  }
});

router.get("/profile", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const b2b = await prisma.b2BAccount.findUnique({
      where: { userId: req.user?.id || 0 },
      include: { orders: true }
    });
    if (!b2b) return res.status(404).json({ error: "B2B hisob topilmadi." });
    res.json(b2b);
  } catch (err) {
    res.status(500).json({ error: "B2B ma'lumotlarini yuklashda xatolik." });
  }
});

export default router;

export const adminB2bRouter = Router();

// GET /api/admin/b2b — Barcha B2B hisoblarni olish (Admin)
adminB2bRouter.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 50, 100);

    const [b2bAccounts, totalCount] = await Promise.all([
      prisma.b2BAccount.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.b2BAccount.count()
    ]);

    res.json({
      b2bAccounts,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    });
  } catch (err) {
    logger.error({ err }, "Fetch admin b2b accounts error");
    res.status(500).json({ error: "B2B hisoblarni yuklashda xatolik." });
  }
});

adminB2bRouter.patch("/:id/verify", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { verified } = req.body;

  try {
    const b2b = await prisma.b2BAccount.update({
      where: { id },
      data: { verified },
      include: { user: { select: { id: true, email: true, name: true } } }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        adminEmail: req.user?.email,
        action: verified ? "verify_b2b" : "reject_b2b",
        targetId: String(id),
        details: `B2B account for company "${b2b.companyName}" (${b2b.user?.email}) was ${verified ? 'verified' : 'unverified/rejected'}`
      }
    });

    await createNotification(
      b2b.userId,
      "SYSTEM",
      verified ? "B2B hisobingiz tasdiqlandi!" : "B2B hisobingiz bekor qilindi.",
      verified ? "Endi siz ulgurji chegirmalardan foydalanishingiz mumkin." : "Qo'shimcha ma'lumot uchun admin bilan bog'laning.",
      `/profile`
    );

    res.json(b2b);
  } catch (err) {
    logger.error({ err }, "Verify B2B error");
    res.status(500).json({ error: "B2B tasdiqlashda xatolik." });
  }
});
