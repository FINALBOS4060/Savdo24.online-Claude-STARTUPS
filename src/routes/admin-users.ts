import { Router, Response } from "express";
// 118-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (Admin foydalanuvchilarni boshqarish: ro'yxat,
// bloklash, tafsilot, VIP berish, rol o'zgartirish, o'chirish). Router
// "/api/admin/users" ostiga mount qilinadi, yo'llar nisbiy yozilgan.
import {
  prisma,
  authenticateToken,
  requireAdmin,
  isPostgres,
  AuthRequest
} from "../../server";

const router = Router();

// GET /api/admin/users — Barcha foydalanuvchilar (Admin)
router.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      const mode = isPostgres ? "insensitive" : undefined;
      const orConds: any[] = [
        { name: { contains: String(search), mode } },
        { email: { contains: String(search), mode } }
      ];
      // 97-band: User.id Int bo'lgani uchun `contains` ishlamaydi — shu sabab
      // avval reports'dan kelgan foydalanuvchi ID orqali qidirish imkonsiz edi.
      const asId = parseInt(String(search), 10);
      if (!isNaN(asId) && String(asId) === String(search).trim()) {
        orConds.push({ id: asId });
      }
      where.OR = orConds;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          _count: {
            select: { startups: true, payments: true }
          }
        },
        orderBy: { joinDate: "desc" },
        skip,
        take: Number(limit)
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users: users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        joinDate: u.joinDate,
        isBanned: u.isBanned,
        totalStartups: u._count.startups,
        totalPayments: u._count.payments
      })),
      total,
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err: any) {
    console.error("Get admin users error:", err);
    res.status(500).json({ error: "Foydalanuvchilarni yuklashda xatolik yuz berdi." });
  }
});

// PATCH /api/admin/users/:id/ban — Foydalanuvchini bloklash/ochish (Admin)
router.patch("/:id/ban", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isBanned } = req.body;

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { isBanned }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        adminEmail: req.user?.email,
        action: isBanned ? "ban_user" : "unban_user",
        targetId: String(id),
        details: `User ${user.email} was ${isBanned ? 'banned' : 'unbanned'}`
      }
    });

    res.json({ success: true, isBanned: user.isBanned });
  } catch (err: any) {
    console.error("Ban user error:", err);
    res.status(500).json({ error: "Amalni bajarishda xatolik yuz berdi." });
  }
});

// GET /api/admin/users/:id — Foydalanuvchi haqida to'liq tafsilot (Admin)
router.get("/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      include: {
        _count: {
          select: { startups: true, payments: true }
        }
      }
    });

    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: String(id) },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { admin: { select: { name: true } } }
    });

    const totalSoldAmount = await prisma.payment.aggregate({
      where: {
        startup: { userId: Number(id) },
        status: "completed"
      },
      _sum: { amount: true }
    });

    const reviews = await prisma.review.findMany({
      where: { sellerId: Number(id) }
    });

    const avgRating = reviews.length > 0
      ? reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length
      : 0;

    res.json({
      user: {
        ...user,
        password: "", // Hide password
        totalStartups: user._count.startups,
        totalPurchases: user._count.payments,
        totalSoldAmount: totalSoldAmount._sum.amount || 0,
        averageRating: avgRating,
      },
      auditLogs
    });
  } catch (err) {
    console.error("Admin get user details error:", err);
    res.status(500).json({ error: "Ma'lumotlarni yuklashda xatolik." });
  }
});

// PATCH /api/admin/users/:id/vip — Qo'lda VIP berish (Admin)
router.patch("/:id/vip", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isVip, vipExpiresAt } = req.body;
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { isVip, vipExpiresAt: vipExpiresAt ? new Date(vipExpiresAt) : null }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        adminEmail: req.user?.email,
        action: "manual_vip_update",
        targetId: String(id),
        details: `User ${user.email} VIP set to ${isVip} until ${vipExpiresAt}`
      }
    });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "VIP yangilashda xatolik." });
  }
});

// PATCH /api/admin/users/:id/role — Rolni o'zgartirish (Admin)
router.patch("/:id/role", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ["Sotuvchi", "Xaridor", "Admin"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Yaroqsiz rol qiymati. Ruxsat berilgan rollar: Sotuvchi, Xaridor, Admin" });
    }

    if (Number(id) === req.user!.id) {
      return res.status(400).json({ error: "O'z rolingizni o'zgartira olmaysiz." });
    }

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { role }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        adminEmail: req.user?.email,
        action: "change_user_role",
        targetId: String(id),
        details: `User ${user.email} role changed to ${role}`
      }
    });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Rolni o'zgartirishda xatolik." });
  }
});

// DELETE /api/admin/users/:id — Hisobni o'chirish (Admin)
router.delete("/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Yaroqsiz foydalanuvchi ID." });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    if (userId === req.user!.id) {
      return res.status(400).json({ error: "O'z hisobingizni o'chira olmaysiz." });
    }

    if (user.role === "Admin") {
      const adminCount = await prisma.user.count({ where: { role: "Admin" } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Tizimda oxirgi qolgan Admin hisobini o'chirib bo'lmaydi. Avval boshqa foydalanuvchiga Admin huquqini bering." });
      }
    }

    // MUHIM: sxemada User'ga majburiy (cascade bo'lmagan) tashqi kalit bilan
    // bog'langan juda ko'p jadval bor (RefreshToken, Review, Dispute,
    // Conversation/Message, VipSubscription, B2BAccount/B2BOrder, Referral/
    // ReferralReward, AuditLog, TopBoost). Prisma'da majburiy bog'lanishlar
    // uchun standart xatti-harakat RESTRICT bo'lgani sabab, avval shu bog'liq
    // yozuvlarni to'g'ri tartibda tozalamasdan turib `prisma.user.delete()`
    // chaqirilsa — deyarli har qanday faol foydalanuvchini (hatto bir marta
    // tizimga kirgan bo'lsa ham, chunki bu RefreshToken yaratadi) o'chirishga
    // urinish xatoga uchraydi.
    const userConversationIds = (
      await prisma.conversation.findMany({
        where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
        select: { id: true }
      })
    ).map((c: any) => c.id);

    const userB2BAccount = await prisma.b2BAccount.findUnique({ where: { userId } });
    const userReferralIds = (
      await prisma.referral.findMany({ where: { referrerId: userId }, select: { id: true } })
    ).map((r: any) => r.id);

    await prisma.$transaction([
      ...(userConversationIds.length > 0
        ? [prisma.message.deleteMany({ where: { conversationId: { in: userConversationIds } } })]
        : []),
      ...(userConversationIds.length > 0
        ? [prisma.conversation.deleteMany({ where: { id: { in: userConversationIds } } })]
        : []),
      ...(userB2BAccount
        ? [prisma.b2BOrder.deleteMany({ where: { b2bId: userB2BAccount.id } })]
        : []),
      ...(userB2BAccount
        ? [prisma.b2BAccount.delete({ where: { userId } })]
        : []),
      ...(userReferralIds.length > 0
        ? [prisma.referralReward.deleteMany({ where: { referralId: { in: userReferralIds } } })]
        : []),
      prisma.referral.deleteMany({ where: { referrerId: userId } }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.review.deleteMany({ where: { buyerId: userId } }),
      prisma.dispute.deleteMany({ where: { buyerId: userId } }),
      prisma.vipSubscription.deleteMany({ where: { userId } }),
      prisma.topBoost.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        adminEmail: req.user?.email,
        action: "delete_user_account",
        targetId: String(id),
        details: `User ${user.email} account deleted permanently`
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Hisobni o'chirishda xatolik." });
  }
});

export default router;
