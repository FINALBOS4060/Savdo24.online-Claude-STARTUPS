import { Router, Response } from "express";
// 111-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (--- B2B WHOLESALE --- va --- ADMIN B2B ---
// bloklari). Naqsh auth.ts/support.ts/sponsor-channels.ts bilan bir xil.
import {
  prisma,
  authenticateToken,
  requireAdmin,
  createNotification,
  AuthRequest
} from "../../server";

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
        // umuman yo'q (HALI QILINMAGAN ro'yxatidagi ma'lum kamchilik) — hozircha
        // mavjud "/admin" (dashboard)ga yo'naltiriladi, xato sahifaga
        // tashlab yuborilmaydi.
        `/admin`
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

adminB2bRouter.patch("/:id/verify", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { verified } = req.body;

  try {
    const b2b = await prisma.b2BAccount.update({
      where: { id },
      data: { verified }
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
    res.status(500).json({ error: "B2B tasdiqlashda xatolik." });
  }
});
