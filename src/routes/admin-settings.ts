import { Router, Response } from "express";
import { encryptSecret } from "../lib/crypto";
import { logger } from "../lib/logger";
// 119-bosqich (server.ts modullashtirish, ARXITEKTURA 3-band): bu fayl
// server.ts'dan ko'chirildi (Admin sozlamalarni ko'rish/yangilash).
// maskValue faqat shu yerda ishlatilgani sabab birga ko'chirildi.
// Router "/api/admin/settings" ostiga mount qilinadi.
import {
  prisma,
  authenticateToken,
  requireAdmin,
  getSetting,
  AuthRequest
} from "../../server";

const router = Router();

const ALL_KEYS = [
  "COINGATE_API_TOKEN",
  "CONTABO_S3_ENDPOINT",
  "CONTABO_ACCESS_KEY",
  "CONTABO_SECRET_KEY",
  "CONTABO_BUCKET_NAME",
  "CDN_DOMAIN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_STORAGE_CHANNEL_ID",
  "TELEGRAM_BACKUP_CHAT_ID",
  "BACKUP_GITHUB_TOKEN",
  "BACKUP_GITHUB_REPO",
  "BACKUP_GITHUB_EMAIL",
  "BACKUP_GITHUB_NAME",
  "APP_URL",
  "GOOGLE_CLIENT_ID",
  "SMTP_SERVICE",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TELEGRAM_ADMIN_CHAT_ID",
  "TELEGRAM_BOT_INTERNAL_SECRET",
  "TOP_BASE_PRICE_PER_DAY",
  "TOP_MAX_CONCURRENT_SLOTS",
  "VIP_DISCOUNT_PERCENT",
  "VIP_PRICE_PER_DAY"
];

const SECRET_KEYS = [
  "COINGATE_API_TOKEN",
  "CONTABO_ACCESS_KEY",
  "CONTABO_SECRET_KEY",
  "SMTP_PASS",
  "TELEGRAM_BOT_TOKEN",
  "BACKUP_GITHUB_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TELEGRAM_BOT_INTERNAL_SECRET"
];

const PLAIN_CONFIG_KEYS = [
  "TOP_BASE_PRICE_PER_DAY",
  "TOP_MAX_CONCURRENT_SLOTS",
  "VIP_DISCOUNT_PERCENT",
  "VIP_PRICE_PER_DAY"
];

function maskValue(val: string): string {
  if (!val) return "";
  if (val.length <= 4) return "••••";
  return "••••••••" + val.slice(-4);
}

// GET /api/admin/settings — Barcha sozlamalarni qisman yashirgan holda olish (Admin)
router.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const results = [];
    for (const key of ALL_KEYS) {
      const val = await getSetting(key);
      const isSecret = SECRET_KEYS.includes(key);
      results.push({
        key,
        value: val ? (isSecret ? maskValue(val) : val) : "",
        hasValue: !!val,
        isSecret
      });
    }
    res.json(results);
  } catch (err: any) {
    logger.error({ err }, "Get admin settings error");
    res.status(500).json({ error: "Sozlamalarni olishda xatolik yuz berdi." });
  }
});

// PUT /api/admin/settings/:key — Sozlama qiymatini yangilash (Admin)
router.put("/:key", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!ALL_KEYS.includes(key)) {
    return res.status(400).json({ error: "Noto'g'ri sozlama kaliti." });
  }

  if (value === undefined || value === null) {
    return res.status(400).json({ error: "Qiymat kiritilishi shart." });
  }

  try {
    const encrypted = encryptSecret(value);

    await prisma.setting.upsert({
      where: { key },
      update: {
        value: encrypted,
        updatedById: req.user?.id || 0
      },
      create: {
        key,
        value: encrypted,
        updatedById: req.user?.id || 0
      }
    });

    const adminName = req.user?.name || `Admin #${req.user?.id}`;
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "update_setting",
        targetId: key,
        details: `Admin ${adminName}, ${key} sozlamasini yangiladi.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json({ success: true, key, value: maskValue(value) });
  } catch (err: any) {
    logger.error({ err, key }, "Save setting error");
    res.status(500).json({ error: "Sozlamani saqlashda xatolik yuz berdi." });
  }
});

export default router;
