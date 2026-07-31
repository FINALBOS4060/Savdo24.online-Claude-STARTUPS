import { Request, Response, NextFunction } from "express";
import { PrismaClient as PGClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { Bot } from "grammy";
import { createRequire } from "module";
import { JwtPayload } from "../types";
import { logger } from "./logger";
import { decryptSecret } from "./crypto";
import { PUBLIC_USER_SELECT } from "./pure-helpers";

const _require = typeof require !== "undefined" ? require : createRequire(import.meta.url);
const SQLiteClient = _require(path.join(process.cwd(), "src/generated/sqlite-client/index.js")).PrismaClient;

// Environment variable validation helper
export function getSecret(envVar: string, minLength: number): string {
  const value = process.env[envVar];
  if (value && value.length >= minLength) {
    return value;
  }

  if (process.env.NODE_ENV === "production" && !process.env.SANDBOX_MODE) {
    logger.warn(
      `⚠️ OGOHLANTIRISH: Production muhitida "${envVar}" o'zgaruvchisi sozlanmagan yoki uning uzunligi yetarli emas (kamida ${minLength} ta belgi kutilmoqda). Avto-kalitdan foydalaniladi.`
    );
  }

  try {
    const secretFilePath = path.join(process.cwd(), `.secret_${envVar}`);
    if (fs.existsSync(secretFilePath)) {
      const savedSecret = fs.readFileSync(secretFilePath, "utf8").trim();
      if (savedSecret && savedSecret.length >= minLength) {
        logger.warn(`⚠️ OGOHLANTIRISH: "${envVar}" topilmadi — saqlangan fayldan avto-kalit yuklandi (${secretFilePath}).`);
        return savedSecret;
      }
    }
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretFilePath, generated, "utf8");
    logger.warn(
      `⚠️ OGOHLANTIRISH: "${envVar}" muhit o'zgaruvchisi sozlanmagan — yangi tasodifiy kalit generatsiya qilindi va kelajakda barqaror ulanish uchun quyidagi faylda saqlandi:\n👉 ${secretFilePath}\n`
    );
    return generated;
  } catch (fileErr) {
    logger.warn({ fileErr }, `⚠️ OGOHLANTIRISH: "${envVar}" avto-kalit faylini yaratishda xatolik yuz berdi:`);
  }

  logger.warn(`⚠️ OGOHLANTIRISH: "${envVar}" topilmadi — vaqtinchalik tasodifiy kalit generatsiya qilindi.`);
  return crypto.randomBytes(32).toString("hex");
}

export const JWT_SECRET = getSecret("JWT_SECRET", 32);

export const isPostgres = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"));

if (process.env.NODE_ENV === "production" && !isPostgres) {
  logger.warn(
    "⚠️ OGOHLANTIRISH: Production muhitida DATABASE_URL to'g'ri PostgreSQL ulanish satri bilan sozlanmagan! SQLite ulanishidan foydalaniladi."
  );
}

export const prisma: any = isPostgres
  ? new PGClient()
  : new SQLiteClient({
      datasources: {
        db: {
          url: "file:./dev.db"
        }
      }
    });

export async function getSetting(key: string): Promise<string | null> {
  try {
    if (prisma && prisma.setting) {
      const dbSetting = await prisma.setting.findUnique({ where: { key } });
      if (dbSetting) {
        try {
          const decrypted = decryptSecret(dbSetting.value);
          return decrypted;
        } catch (decryptErr) {
          logger.error({ decryptErr }, `Error decrypting setting ${key}:`);
        }
      }
    }
  } catch (err) {
    logger.error({ err }, `Error in getSetting for ${key}:`);
  }
  return process.env[key] || null;
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    isVip: boolean;
    vipExpiresAt?: string;
  };
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Kirish ruxsati berilmadi. Token topilmadi." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.isBanned) {
      return res.status(403).json({ error: "Sizning hisobingiz bloklangan yoki topilmadi." });
    }

    // VIP Expiry check
    if (user.isVip && user.vipExpiresAt && user.vipExpiresAt < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVip: false }
      });
      user.isVip = false;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVip: user.isVip,
      vipExpiresAt: user.vipExpiresAt ? user.vipExpiresAt.toISOString() : undefined
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Yaroqsiz yoki muddati o'tgan token." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  if (authReq.user?.role !== "Admin") {
    return res.status(403).json({ error: "Ruxsat etilmagan. Admin ruxsati talab qilinadi." });
  }
  next();
}

export async function generateRefreshToken(userId: number, req: Request): Promise<string> {
  const tokenValue = `${crypto.randomBytes(40).toString("hex")}-${userId}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: tokenValue,
      userId,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      expiresAt
    }
  });

  return tokenValue;
}

export async function notifyAdminTelegram(message: string) {
  try {
    const botToken = (await getSetting("TELEGRAM_BOT_TOKEN")) || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn("TELEGRAM_BOT_TOKEN sozlanmagan, admin ogohlantirishini yuborib bo'lmadi.");
      return;
    }
    const adminChatId =
      (await getSetting("TELEGRAM_ADMIN_CHAT_ID")) || process.env.TELEGRAM_ADMIN_CHAT_ID || "8780300373";
    if (!adminChatId) {
      console.warn("TELEGRAM_ADMIN_CHAT_ID sozlanmagan, admin ogohlantirishini yuborib bo'lmadi.");
      return;
    }
    const bot = new Bot(botToken);
    const truncatedMessage = message.substring(0, 4096);
    await bot.api.sendMessage(adminChatId, truncatedMessage, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Admin Telegram ogohlantirishini yuborishda xatolik:", err);
  }
}

export async function getTransporter() {
  const service = (await getSetting("SMTP_SERVICE")) || process.env.SMTP_SERVICE;
  const host = (await getSetting("SMTP_HOST")) || process.env.SMTP_HOST;
  const port = parseInt((await getSetting("SMTP_PORT")) || process.env.SMTP_PORT || "587");
  const user = (await getSetting("SMTP_USER")) || process.env.SMTP_USER;
  const pass = (await getSetting("SMTP_PASS")) || process.env.SMTP_PASS;

  if (service) {
    return nodemailer.createTransport({
      service,
      auth: { user, pass }
    });
  }

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendEmail(to: string, subject: string, html: string, isCritical: boolean = false) {
  const send = async () => {
    try {
      const transporter = await getTransporter();
      if (!transporter) return false;
      await transporter.sendMail({
        from: '"Savdo24" <noreply@savdo24.online>',
        to,
        subject,
        html
      });
      return true;
    } catch (err) {
      logger.error({ err }, `Email yuborishda xatolik: ${subject}`);
      return false;
    }
  };

  let success = await send();

  if (!success && isCritical) {
    logger.warn(`Email yuborilmadi, qayta urinilmoqda: ${subject}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    success = await send();
  }

  if (!success && isCritical) {
    await notifyAdminTelegram(`⚠️ Kritik email yuborilmadi: ${to}, mavzu: ${subject}`);
  }
}

export async function getStripe() {
  const key = (await getSetting("STRIPE_SECRET_KEY")) || process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-01-27" as any });
}

export function formatStartup(dbStartup: any) {
  try {
    const formatted = {
      ...dbStartup,
      price: dbStartup.price || 0,
      listingType: dbStartup.listingType || "To'liq loyiha (manba kodi bilan)",
      techStack: JSON.parse(dbStartup.techStack || "[]"),
      demoUrl: dbStartup.demoUrl || "",
      githubUrl: dbStartup.githubUrl || "",
      repoIncluded: dbStartup.repoIncluded ?? false,
      soldStatus: dbStartup.soldStatus || "sotuvda",
      proposalsCount: dbStartup.proposalsCount || 0,
      gallery: JSON.parse(dbStartup.gallery || "[]"),
      team: JSON.parse(dbStartup.team || "[]"),
      milestones: JSON.parse(dbStartup.milestones || "[]")
    };
    delete formatted.deliveryUrl;
    delete formatted.contactEmail;
    delete formatted.contactPhone;
    delete formatted.contactTelegram;
    return formatted;
  } catch (err) {
    console.error("Error formatting startup:", err);
    return dbStartup;
  }
}

let socketIoInstance: any = null;
export function setSocketIoInstance(instance: any) {
  socketIoInstance = instance;
}

export const io = {
  to: (room: string) => {
    if (socketIoInstance) {
      return socketIoInstance.to(room);
    }
    return { emit: () => {} };
  },
  emit: (event: string, data: any) => {
    if (socketIoInstance) {
      socketIoInstance.emit(event, data);
    }
  }
};

export async function createNotification(userId: number, type: string, title: string, message: string, link?: string) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, link }
    });
    if (socketIoInstance) {
      socketIoInstance.to(`user:${userId}`).emit("new_notification", notification);
    }
    return notification;
  } catch (err) {
    console.error("Error creating notification:", err);
  }
}

export async function trackEvent(
  event: string,
  userId?: number,
  targetId?: string,
  source?: string,
  metadata: any = {}
) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        event,
        userId,
        targetId,
        source,
        metadata: JSON.stringify(metadata)
      }
    });
  } catch (err) {
    logger.error({ err }, "Analytics tracking error");
  }
}

export async function getReferralCount(referrerId: number): Promise<number> {
  return prisma.referralReward.count({ where: { referral: { referrerId } } });
}
