import { Router, Response } from "express";
import crypto from "crypto";
import { financialActionLimiter } from "../lib/rateLimiters";
import { PUBLIC_USER_SELECT } from "../lib/pure-helpers";
import { logger } from "../lib/logger";
// 114-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (referrals/generate, /apply, /my-stats,
// admin/referrals bloklari). Naqsh b2b.ts bilan bir xil (ikkita router:
// default oddiy /api/referrals uchun, named export admin/referrals uchun).
import {
  prisma,
  authenticateToken,
  requireAdmin,
  getReferralTier,
  getReferralCount,
  AuthRequest
} from "../../server";

const router = Router();

// POST /api/referrals/generate — Unique kod yaratish
router.post("/generate", authenticateToken, financialActionLimiter, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Avtorizatsiyadan o'ting." });

  try {
    const existing = await prisma.referral.findFirst({
      where: { referrerId: req.user.id, isActive: true }
    });

    if (existing) {
      return res.json({ code: existing.code });
    }

    const referralCount = await getReferralCount(req.user.id);
    const tier = getReferralTier(referralCount);

    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const referral = await prisma.referral.create({
      data: {
        referrerId: req.user.id,
        code,
        discountPercent: tier.discount,
        commissionPercent: tier.commission,
      }
    });

    res.json({ code: referral.code });
  } catch (err) {
    logger.error({ err }, "Referral generate error");
    res.status(500).json({ error: "Referral kod yaratishda xatolik." });
  }
});

// GET /api/referrals/apply — Kodni tekshirish
router.get("/apply", authenticateToken, async (req: AuthRequest, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).json({ error: "Kod yuborilmadi." });

  try {
    const referral = await prisma.referral.findUnique({
      where: { code, isActive: true },
      include: { referrer: { select: PUBLIC_USER_SELECT } }
    });

    if (!referral) {
      return res.status(404).json({ error: "Noto'g'ri yoki faol bo'lmagan referral kod." });
    }

    if (referral.referrerId === req.user?.id) {
      return res.status(400).json({ error: "O'zingizning referral kodingizdan foydalana olmaysiz." });
    }

    res.json({
      discountPercent: referral.discountPercent,
      referrerName: referral.referrer.name
    });
  } catch (err) {
    res.status(500).json({ error: "Kodni tekshirishda xatolik." });
  }
});

// GET /api/referrals/my-stats — Foydalanuvchi stats
router.get("/my-stats", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Avtorizatsiyadan o'ting." });

  try {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: req.user.id },
      include: {
        _count: { select: { rewards: true } },
        rewards: { where: { status: "earned" } }
      }
    });

    const totalEarned = referrals.reduce((sum: number, r: any) => sum + r.rewards.reduce((s: number, rw: any) => s + Number(rw.rewardAmount), 0), 0);
    const referralCount = await getReferralCount(req.user.id);
    const tier = getReferralTier(referralCount);

    res.json({
      referralCount,
      totalEarned,
      tier,
      referrals: referrals.map((r: any) => ({
        code: r.code,
        isActive: r.isActive,
        rewardCount: r._count.rewards
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Ma'lumotlarni yuklashda xatolik." });
  }
});

export default router;

export const adminReferralsRouter = Router();

// GET /api/admin/referrals — Admin stats
adminReferralsRouter.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const allReferrals = await prisma.referral.findMany({
      include: {
        referrer: { select: { name: true, email: true } },
        referee: { select: { name: true, email: true } },
        rewards: true
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(allReferrals);
  } catch (err) {
    res.status(500).json({ error: "Admin ma'lumotlarini yuklashda xatolik." });
  }
});

// GET /api/admin/referrals/rewards-pending — Pending or earned referral rewards awaiting payout
adminReferralsRouter.get("/rewards-pending", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pendingRewards = await prisma.referralReward.findMany({
      where: { status: { in: ["pending", "earned"] } },
      include: {
        referral: {
          include: {
            referrer: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
    res.json(pendingRewards);
  } catch (err) {
    res.status(500).json({ error: "Kutilayotgan mukofotlarni yuklashda xatolik." });
  }
});

// POST /api/admin/referrals/rewards/:id/complete — Mark referral reward as paid_out
adminReferralsRouter.post("/rewards/:id/complete", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await prisma.referralReward.update({
      where: { id },
      data: { status: "paid_out" }
    });
    res.json({ success: true, reward: updated });
  } catch (err) {
    res.status(500).json({ error: "Mukofotni to'langan deb belgilashda xatolik." });
  }
});
