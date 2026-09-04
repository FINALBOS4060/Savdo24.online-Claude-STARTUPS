import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import { prisma, authenticateToken, requireAdmin, getSetting, AuthRequest, encryptSecret } from "../lib/context";
import logger from "../lib/logger";

const router = Router();

const BOT_KEYS = [
  "RSS_URL",
  "MAX_PER_RUN",
  "TELEGRAM_CHAT",
  "TELEGRAM_BOT_TOKEN",
  "GOOGLE_AI_STUDIO_KEY",
  "POLLINATIONS_MODEL"
];

function maskValue(val: string | null | undefined) {
  if (!val) return "";
  if (val.length <= 4) return "••••";
  return "••••••••" + val.slice(-4);
}

// GET /api/admin/bot — Get bot settings and posted items
router.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const settings: Record<string, any> = {};
    for (const key of BOT_KEYS) {
      const val = await getSetting(key);
      const isSecret = ["TELEGRAM_BOT_TOKEN", "GOOGLE_AI_STUDIO_KEY"].includes(key);
      settings[key] = { value: val || "", masked: isSecret ? maskValue(val) : val };
    }

    // Try to read posted.json from a few likely locations
    const possiblePaths = [
      path.resolve(process.cwd(), "posted.json"),
      path.resolve(process.cwd(), "data/posted.json"),
      path.resolve(__dirname, "../../posted.json")
    ];

    let posted: string[] = [];
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, "utf8");
          const json = JSON.parse(content);
          if (Array.isArray(json.urls)) posted = json.urls;
          break;
        }
      } catch (e) {
        // ignore and try next
      }
    }

    res.json({ settings, posted });
  } catch (err: any) {
    logger.error({ err }, "Get admin bot settings error");
    res.status(500).json({ error: "Bot sozlamalarini olishda xatolik yuz berdi." });
  }
});

// PUT /api/admin/bot/settings — Update a bot setting
router.put("/settings/:key", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!BOT_KEYS.includes(key)) {
    return res.status(400).json({ error: "Noto'g'ri sozlama kaliti." });
  }

  if (value === undefined) return res.status(400).json({ error: "Qiymat kiritilishi shart." });

  try {
    // If the key is secret we encrypt before saving
    const toSave = ["TELEGRAM_BOT_TOKEN", "GOOGLE_AI_STUDIO_KEY"].includes(key) ? encryptSecret(value) : value;

    await prisma.setting.upsert({
      where: { key },
      update: { value: toSave, updatedById: req.user?.id || 0 },
      create: { key, value: toSave, updatedById: req.user?.id || 0 }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "update_bot_setting",
        targetId: key,
        details: `Admin ${req.user?.name || req.user?.email} updated bot setting ${key}`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Update bot setting error");
    res.status(500).json({ error: "Sozlamani yangilashda xatolik yuz berdi." });
  }
});

// POST /api/admin/bot/run — Request a manual run (creates audit log and sets a DB trigger)
router.post("/run", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Save a trigger timestamp in settings so background runner (or deploy hooks) can pick it up
    const ts = new Date().toISOString();
    await prisma.setting.upsert({
      where: { key: "BOT_MANUAL_RUN_REQUEST" },
      update: { value: ts, updatedById: req.user?.id || 0 },
      create: { key: "BOT_MANUAL_RUN_REQUEST", value: ts, updatedById: req.user?.id || 0 }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "manual_bot_run",
        targetId: "",
        details: `Admin ${req.user?.email} requested manual bot run at ${ts}`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json({ success: true, requestedAt: ts });
  } catch (err: any) {
    logger.error({ err }, "Manual bot run request error");
    res.status(500).json({ error: "Botni qo'lda ishga tushirish so'rovida xatolik yuz berdi." });
  }
});

export default router;
