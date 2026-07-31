// ESLATMA: Bu avtomatik Telegram-tiklash tizimi faqat ZAXIRA
// himoya vositasi. Asosiy himoya — PostgreSQL bazasini ilova
// serveridan alohida, doimiy saqlanadigan joyda ushlab turish.
// Batafsil: README.md dagi "Ma'lumotlar xavfsizligi" bo'limiga qarang.

import express, { Request, Response, NextFunction } from "express";
import { JwtPayload } from "./src/types";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import rateLimit from "express-rate-limit";
import { execSync } from "child_process";
import helmet from "helmet";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient as PGClient } from "@prisma/client";
import { createRequire } from 'module';
import compression from "compression";
const _require = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
const SQLiteClient = _require(path.join(process.cwd(), "src/generated/sqlite-client/index.js")).PrismaClient;
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import multer from "multer";
import sharp from "sharp";
import QRCode from "qrcode";
import crypto from "crypto";
import { Bot } from "grammy";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import cron from "node-cron";
import dotenv from "dotenv";
import { logger } from "./src/lib/logger";
import { z } from "zod";
import {
  ideaLimiter,
  upvoteLimiter,
  reportLimiter, supportLimiter,
  uploadLimiter,
  paymentStatusLimiter,
  globalLimiter,
  authLimiter,
  clientErrorLimiter
} from "./src/lib/rateLimiters";
import { splitAmount, roundToCents, PLATFORM_FEE_PERCENT } from "./src/lib/money";
import { CATEGORY_FIELDS } from "./src/categoryFields";
import { createBotMetaHandler } from "./src/lib/botMetaHandler";

dotenv.config();

export async function getTransporter() {
  const service = await getSetting("SMTP_SERVICE") || process.env.SMTP_SERVICE;
  const host = await getSetting("SMTP_HOST") || process.env.SMTP_HOST;
  const port = parseInt(await getSetting("SMTP_PORT") || process.env.SMTP_PORT || "587");
  const user = await getSetting("SMTP_USER") || process.env.SMTP_USER;
  const pass = await getSetting("SMTP_PASS") || process.env.SMTP_PASS;

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
        from: "\"Savdo24\" <noreply@savdo24.online>",
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    success = await send();
  }

  if (!success && isCritical) {
    await notifyAdminTelegram(`⚠️ Kritik email yuborilmadi: ${to}, mavzu: ${subject}`);
  }
}

// Newsletter functionality moved down after app declaration

export async function getStripe() {
  const key = await getSetting("STRIPE_SECRET_KEY") || process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2025-01-27' as any });
}
import { encryptSecret, decryptSecret } from "./src/lib/crypto";
import { OAuth2Client } from "google-auth-library";

// 12-MUAMMO: Kutilmagan unhandledRejection xatolarini Telegram orqali adminga yuborish va serverni saqlab qolish
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Ushlanmagan promise xatosi");
  notifyAdminTelegram(`🔴 <b>KUTILMAGAN SERVER XATOSI (unhandledRejection)</b>\n\n<code>${String(reason).slice(0, 3500)}</code>`).catch(() => {});
});
// 12-MUAMMO: Kutilmagan uncaughtException xatolarini Telegram orqali adminga yuborish va serverni saqlab qolish
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Ushlanmagan istisno");
  notifyAdminTelegram(`🔴 <b>KUTILMAGAN SERVER XATOSI (uncaughtException)</b>\n\n<code>${(err?.stack || String(err)).slice(0, 3500)}</code>`).catch(() => {});
});

// Environment variable validation
function getSecret(envVar: string, minLength: number): string {
  const value = process.env[envVar];
  if (value && value.length >= minLength) {
    return value;
  }

  if (process.env.NODE_ENV === "production" && !process.env.SANDBOX_MODE) {
    logger.warn(`⚠️ OGOHLANTIRISH: Production muhitida "${envVar}" o'zgaruvchisi sozlanmagan yoki uning uzunligi yetarli emas (kamida ${minLength} ta belgi kutilmoqda). Avto-kalitdan foydalaniladi.`);
  }

  // Local fallback file to ensure container/server startup stability when env variables are not provided
  try {
    const secretFilePath = path.join(process.cwd(), `.secret_${envVar}`);
    if (fs.existsSync(secretFilePath)) {
      const savedSecret = fs.readFileSync(secretFilePath, "utf8").trim();
      if (savedSecret && savedSecret.length >= minLength) {
        logger.warn(`⚠️ OGOHLANTIRISH: "${envVar}" topilmadi — saqlangan fayldan avto-kalit yuklandi (${secretFilePath}).`);
        return savedSecret;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFilePath, generated, "utf8");
    logger.warn(`⚠️ OGOHLANTIRISH: "${envVar}" muhit o'zgaruvchisi sozlanmagan — yangi tasodifiy kalit generatsiya qilindi va kelajakda barqaror ulanish uchun quyidagi faylda saqlandi:\n👉 ${secretFilePath}\n`);
    return generated;
  } catch (fileErr) {
    logger.warn({ fileErr }, `⚠️ OGOHLANTIRISH: "${envVar}" avto-kalit faylini yaratishda xatolik yuz berdi:`);
  }

  logger.warn(`⚠️ OGOHLANTIRISH: "${envVar}" topilmadi — vaqtinchalik tasodifiy kalit generatsiya qilindi.`);
  return crypto.randomBytes(32).toString('hex');
}

// 122-bosqich: escapeHtml/getReferralTier/safeCompare src/lib/pure-helpers.ts'ga
// ko'chirildi (sof funksiyalar, DB'ga bog'liq emas — avtomatik test yozish
// uchun). Bu yerda faqat qayta eksport qilinadi, boshqa fayllardagi
// `from "../../server"` importlari o'zgarishsiz ishlayveradi.
import { escapeHtml, getReferralTier, safeCompare, PUBLIC_USER_SELECT } from "./src/lib/pure-helpers";
export { escapeHtml, getReferralTier, safeCompare, PUBLIC_USER_SELECT };

export const JWT_SECRET = getSecret("JWT_SECRET", 32);
const ENCRYPTION_KEY = getSecret("ENCRYPTION_KEY", 32);

// Telegram file URL cache
const fileUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Coingate production check
if (process.env.NODE_ENV === "production" && !process.env.COINGATE_API_TOKEN) {
  logger.warn("⚠️ DIQQAT: Production muhitida COINGATE_API_TOKEN topilmadi. To'lov tizimi ishlamaydi!");
}

let googleClient: OAuth2Client | null = null;
function getGoogleClient() {
  if (!googleClient) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      logger.warn("GOOGLE_CLIENT_ID topilmadi. Google bilan kirish ishlamasligi mumkin.");
      return null;
    }
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
}

const app = express();
app.set('trust proxy', 1);
app.use(compression());
app.use('/api', globalLimiter);

// Newsletter logic moved down
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: { origin: process.env.APP_URL || "https://savdo24.online" }
});

// requireAdmin middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  if (authReq.user?.role !== "Admin") {
    return res.status(403).json({ error: "Ruxsat etilmagan. Admin ruxsati talab qilinadi." });
  }
  next();
}

export const isPostgres = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"));

if (process.env.NODE_ENV === "production" && !isPostgres) {
  logger.warn("⚠️ OGOOHLANTIRISH: Production muhitida DATABASE_URL to'g'ri PostgreSQL ulanish satri bilan sozlanmagan! SQLite ulanishidan foydalaniladi.");
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

async function getDynamicGoogleClientId(): Promise<string | null> {
  const dbId = await getSetting("GOOGLE_CLIENT_ID");
  if (dbId) return dbId;
  return process.env.GOOGLE_CLIENT_ID || null;
}

export async function trackEvent(event: string, userId?: number, targetId?: string, source?: string, metadata: any = {}) {
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

// 96-band (KATTA MUAMMO): bir foydalanuvchi uchun /api/referrals/generate faqat
// BITTA doimiy Referral qatorini yaratadi (ko'p do'stga bir xil kod ulashish
// uchun), lekin shu qatorning refereeId maydoni faqat BITTA foydalanuvchini
// ushlab turadi — har safar kimdir shu kod orqali xarid yakunlaganda
// (finalizeCompletedPayment) refereeId qayta yozib qo'yilardi (oldingi
// referal "unutilardi"). Natijada referralCount hech qachon 1 dan oshmasdi,
// va tarif darajasi (Referral Star/King) hech kimga hech qachon yetib
// bo'lmasdi. ReferralReward esa har bir muvaffaqiyatli referal xaridi uchun
// alohida qator yaratadi (hech qachon qayta yozilmaydi) — shu sabab haqiqiy
// referal sonini o'lchash uchun undan foydalanish kerak, Referral.refereeId
// emas.
export async function getReferralCount(referrerId: number): Promise<number> {
  return prisma.referralReward.count({ where: { referral: { referrerId } } });
}

// GET /api/admin/cron/newsletter — Haftalik newsletter yuborish (Internal/Admin)
app.get("/api/admin/cron/newsletter", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  await sendWeeklyNewsletter();
  res.json({ message: "Newsletter yuborish boshlandi." });
});

// GET /api/admin/cron/escrow-release — Escrow to'lovlarini avtomatik ozod qilish
app.get("/api/admin/cron/escrow-release", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  await autoReleaseEscrows();
  res.json({ message: "Escrow auto-release jarayoni yakunlandi." });
});

async function autoReleaseEscrows() {
  try {
    // 11-MUAMMO: holdEndDate maydoni bo'yicha haqiqiy muddati tugagan escrowlarni ozod qilish
    const escrowsToRelease = await prisma.escrowPayment.findMany({
      where: {
        status: "held",
        holdEndDate: { lt: new Date() }
      },
      include: {
        payment: {
          include: {
            startup: {
              include: { user: true }
            }
          }
        }
      }
    });

    logger.info(`Checking ${escrowsToRelease.length} escrows for auto-release...`);

    const paymentIds = escrowsToRelease.map((e: any) => e.paymentId);
    const activeDisputes = await prisma.dispute.findMany({
      where: {
        paymentId: { in: paymentIds },
        status: { in: ["open", "reviewing"] }
      }
    });

    const disputedPaymentIds = new Set(activeDisputes.map((d: any) => d.paymentId));

    const nonDisputedEscrows = escrowsToRelease.filter((escrow: any) => !disputedPaymentIds.has(escrow.paymentId));

    if (nonDisputedEscrows.length > 0) {
      // Chunk processing (concurrency limit 5) to optimize N+1 operations and avoid external API flood
      const CONCURRENCY_LIMIT = 5;
      const chunks: any[][] = [];
      for (let i = 0; i < nonDisputedEscrows.length; i += CONCURRENCY_LIMIT) {
        chunks.push(nonDisputedEscrows.slice(i, i + CONCURRENCY_LIMIT));
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (escrow) => {
          try {
            // Auto release
            await prisma.escrowPayment.update({
              where: { id: escrow.id },
              data: {
                status: "released",
                releasedAt: new Date()
              }
            });

            // Notify seller
            const seller = escrow.payment.startup?.user;
            if (seller) {
              await createNotification(
                seller.id,
                "SYSTEM",
                "Mablag' ozod qilindi",
                `Sizning '${escrow.payment.startup.name}' loyihangiz uchun escrow to'lovi 7 kunlik muddatdan so'ng avtomatik ozod qilindi.`,
                "/profile"
              );

              await sendEmail(
                seller.email,
                "Escrow to'lovi ozod qilindi",
                `<p>Tabriklaymiz! <b>${escapeHtml(escrow.payment.startup.name)}</b> loyihasi uchun escrow to'lovi 7 kundan so'ng avtomatik ravishda ozod qilindi va balansingizga o'tkazildi.</p>`
              );
            }
            
            logger.info(`Auto-released escrow for payment ${escrow.paymentId}`);
          } catch (itemErr) {
            logger.error({ itemErr }, `Error auto-releasing escrow for payment ${escrow.paymentId}:`);
          }
        }));
      }
    }
  } catch (err) {
    logger.error({ err }, "Escrow auto-release error");
  }
}

async function checkPendingRefunds() {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const [overdueRefunds, overdueRewards] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: "refund_required",
          updatedAt: { lt: threeDaysAgo }
        }
      }),
      prisma.referralReward.findMany({
        where: {
          status: { in: ["pending", "earned"] },
          createdAt: { lt: threeDaysAgo }
        }
      })
    ]);

    if (overdueRefunds.length > 0 || overdueRewards.length > 0) {
      const admins = await prisma.user.findMany({ where: { role: "Admin" } });
      for (const admin of admins) {
        if (overdueRefunds.length > 0) {
          await createNotification(
            admin.id,
            "SYSTEM",
            "Eslatma: Kechiktirilgan qaytarishlar",
            `${overdueRefunds.length} ta to'lov 3 kundan ortiq vaqtdan beri qaytarishni (refund) kutmoqda. Iltimos CoinGate orqali tekshiring.`,
            "/admin"
          );
        }
        if (overdueRewards.length > 0) {
          await createNotification(
            admin.id,
            "SYSTEM",
            "Eslatma: Kechiktirilgan referral mukofotlari",
            `${overdueRewards.length} ta referral mukofoti 3 kundan ortiq vaqtdan beri to'lanishni kutmoqda.`,
            "/admin"
          );
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "checkPendingRefunds error");
  }
}

async function expireTopBoosts() {
  try {
    const result = await prisma.startup.updateMany({
      where: {
        isTop: true,
        topExpiresAt: { lt: new Date() }
      },
      data: {
        isTop: false
      }
    });
    if (result.count > 0) {
      logger.info(`[CRON] Expired ${result.count} top boosts.`);
    }
  } catch (err) {
    logger.error({ err }, "Error in expireTopBoosts");
  }
}

async function sendWeeklyNewsletter() {
  try {
    // FIX: avval barcha emailVerified foydalanuvchilarga (obuna bo'lmagan bo'lsa ham)
    // yuborilardi — buyurtmasiz marketing xat edi. Endi faqat /api/newsletter/subscribe
    // orqali roziligini bergan Subscriber jadvalidagi manzillarga yuboriladi.
    const subscribers = await prisma.subscriber.findMany();
    const users = subscribers.map((s: any) => ({ email: s.email }));
    
    const newListings = await prisma.startup.findMany({
      where: { 
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        status: "active"
      },
      orderBy: { updatedAt: "desc" },
      take: 5
    });
    
    const topListings = await prisma.startup.findMany({
      where: { isTop: true, topExpiresAt: { gt: new Date() } },
      take: 3
    });

    if (newListings.length === 0 && topListings.length === 0) return;
    
    // KELAJAKDA: Foydalanuvchilar soni juda ko'p bo'lsa (masalan, >10k),
    // ushbu tizimni BullMQ yoki boshqa xabarlar navbati (Message Queue) orqali background worker'ga ko'chirish lozim.
    const CONCURRENCY_LIMIT = 5;
    const chunks: any[][] = [];
    for (let i = 0; i < users.length; i += CONCURRENCY_LIMIT) {
      chunks.push(users.slice(i, i + CONCURRENCY_LIMIT));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (user) => {
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0b1426; color: white; padding: 30px; border-radius: 20px;">
            <h2 style="color: #f3ba2f; text-align: center;">Savdo24 Haftalik Digest</h2>
            <p style="text-align: center; color: #8892b0;">Platformadagi eng so'nggi va eng yaxshi takliflar</p>
            
            ${newListings.length > 0 ? `
              <h3 style="border-bottom: 1px solid #ffffff10; padding-bottom: 10px; margin-top: 30px;">📬 Yangi Elonlar</h3>
              ${newListings.map((s: any) => `
                <div style="margin-bottom: 15px; padding: 15px; background: #ffffff05; border-radius: 12px;">
                  <h4 style="margin: 0; color: #f3ba2f;">${escapeHtml(s.name)}</h4>
                  <p style="margin: 5px 0; font-size: 14px; color: #8892b0;">${escapeHtml(s.slogan)}</p>
                  <p style="margin: 0; font-weight: bold; color: #10b981;">$${escapeHtml(s.price)}</p>
                </div>
              `).join('')}
            ` : ''}

            ${topListings.length > 0 ? `
              <h3 style="border-bottom: 1px solid #ffffff10; padding-bottom: 10px; margin-top: 30px;">🔥 TOP Deals</h3>
              ${topListings.map((s: any) => `
                <div style="margin-bottom: 15px; padding: 15px; background: #f3ba2f10; border: 1px solid #f3ba2f30; border-radius: 12px;">
                  <h4 style="margin: 0; color: #f3ba2f;">${escapeHtml(s.name)} (TOP)</h4>
                  <p style="margin: 5px 0; font-size: 14px; color: #8892b0;">${escapeHtml(s.slogan)}</p>
                  <p style="margin: 0; font-weight: bold; color: #10b981;">$${escapeHtml(s.price)}</p>
                </div>
              `).join('')}
            ` : ''}

            <div style="margin-top: 40px; text-align: center;">
              <a href="https://savdo24.online/browse" style="background: #f3ba2f; color: black; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold;">Barchasini Ko'rish</a>
            </div>
          </div>
        `;
        try {
          await sendEmail(user.email, "📬 Savdo24 Haftalik Digest", html);
        } catch (emailErr) {
          logger.error({ emailErr }, `Error sending weekly digest to ${user.email}:`);
        }
      }));
    }

    logger.info(`Weekly newsletter sent to ${users.length} users.`);
  } catch (err) {
    logger.error({ err }, "Newsletter error");
  }
}

io.use((socket, next) => {
  const authToken = socket.handshake.auth.token;
  let cookieToken: string | undefined;
  if (socket.handshake.headers.cookie) {
    const cookies = socket.handshake.headers.cookie.split(';').reduce((acc: any, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});
    cookieToken = cookies.token;
  }

  // 105-band: kirish tokeni (accessToken) atigi 15 daqiqa amal qiladi. Frontend
  // (MessagesPage.tsx) socket'ni faqat sahifa ochilganda BIR MARTA localStorage'dagi
  // tokenni o'qib ulanadi — agar shu payt localStorage'dagi token allaqachon eskirgan
  // bo'lsa-yu, httpOnly cookie esa (masalan boshqa so'rov orqali) yangilangan bo'lsa,
  // avvalgi kod faqat `auth.token` MAVJUD BO'LMAGANDA cookie'ga qaytardi — mavjud lekin
  // ESKIRGAN tokenni cookie bilan almashtirmasdi, natijada ulanish "Yaroqsiz token"
  // xatosi bilan butunlay muvaffaqiyatsiz tugardi (chat ishlamay qolardi). Endi avval
  // auth.token tekshiriladi, muvaffaqiyatsiz bo'lsa cookie'dagi token bilan qayta
  // urinib ko'riladi.
  jwt.verify(authToken || '', JWT_SECRET, (err: any, decoded: any) => {
    if (!err) {
      socket.data.user = decoded;
      return next();
    }
    if (!cookieToken || cookieToken === authToken) {
      return next(new Error("Autentifikatsiya xatosi: Yaroqsiz token"));
    }
    jwt.verify(cookieToken, JWT_SECRET, (cookieErr: any, cookieDecoded: any) => {
      if (cookieErr) return next(new Error("Autentifikatsiya xatosi: Yaroqsiz token"));
      socket.data.user = cookieDecoded;
      next();
    });
  });
});
io.on("connection", (socket) => {
  socket.join(`user:${socket.data.user.id}`);
});



const PORT = 3000;

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: isPostgres ? 'postgresql' : 'sqlite', timestamp: new Date() });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// POST /api/payments/stripe-webhook — Stripe orqali to'lovni yakunlash
// MUHIM: bu marshrut global express.json() dan OLDIN ro'yxatdan o'tkazilishi kerak,
// chunki Stripe imzo tekshiruvi (signature verification) uchun XOM (raw) so'rov tanasi kerak.
app.post("/api/payments/stripe-webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = await getSetting("STRIPE_WEBHOOK_SECRET") || process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    logger.error("Stripe webhook: STRIPE_WEBHOOK_SECRET yoki stripe-signature header topilmadi.");
    return res.status(400).json({ error: "Webhook not configured." });
  }

  const stripe = await getStripe();
  if (!stripe) {
    return res.status(503).json({ error: "Stripe sozlanmagan." });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
  } catch (err: any) {
    logger.error({ errMsg: err.message }, "Stripe webhook signature tekshiruvi muvaffaqiyatsiz:");
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        logger.error({ sessionId: session.id }, "Stripe webhook: session.metadata.orderId topilmadi.");
        return res.json({ received: true });
      }

      const payment = await prisma.payment.findUnique({ where: { id: orderId } });
      if (!payment) {
        logger.error({ orderId }, "Stripe webhook: to'lov topilmadi:");
        return res.json({ received: true });
      }

      // Idempotentlik — Stripe ham webhook'ni bir necha marta qayta yuborishi mumkin
      if (payment.status === "completed" || payment.status === "refund_required") {
        return res.json({ received: true, idempotent: true });
      }

      if (session.payment_status !== "paid") {
        return res.json({ received: true, status: "not_paid_yet" });
      }

      // To'langan summa haqiqatan ham kutilgan summaga mos kelishini tekshirish
      const paidAmount = (session.amount_total ?? 0) / 100;
      if (Math.abs(paidAmount - Number(payment.amount)) > 0.01) {
        logger.warn(`Stripe webhook: summa mos kelmadi. Kutilgan: ${payment.amount}, Kelgan: ${paidAmount}`);
        return res.status(400).json({ error: "Payment amount mismatch." });
      }

      await finalizeCompletedPayment(payment);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook processing error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Security Headers & CORS
const isProdEnv = process.env.NODE_ENV === "production";
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // 1-USTUVORLIK: Production muhitida unsafe-inline va unsafe-eval'ni butunlay olib tashlaymiz
      scriptSrc: isProdEnv 
        ? ["'self'", "https://accounts.google.com", "https://*.stripe.com"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com", "https://*.stripe.com"],
      connectSrc: [
        "'self'", 
        "https://api.dicebear.com", 
        "https://lh3.googleusercontent.com", 
        "https://accounts.google.com", 
        "https://*.stripe.com", 
        "https://*.coingate.com",
        "ws:", 
        "wss:"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.stripe.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'", 
        "data:", 
        "blob:",
        "https://lh3.googleusercontent.com", 
        "https://api.dicebear.com", 
        "https://*.stripe.com", 
        "https://*.coingate.com"
      ],
      frameSrc: ["'self'", "https://accounts.google.com", "https://*.stripe.com"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = [
  'https://savdo24.online',
  'https://www.savdo24.online',
  'http://savdo24.online',
  'http://www.savdo24.online',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow non-browser requests (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // 2. Check if origin is allowed
    const isAllowed = 
      allowedOrigins.includes(origin) || 
      (process.env.APP_URL && origin === process.env.APP_URL) ||
      origin.endsWith('.savdo24.online') || 
      (process.env.NODE_ENV !== 'production' && (
        origin.endsWith('.run.app') || 
        origin.startsWith('http://localhost:') || 
        origin.startsWith('http://127.0.0.1:')
      ));

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'X-Redirect-Origin']
}));

// Multer & Contabo S3 Configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Faqat rasm fayllari (JPEG, PNG, WEBP, GIF) qabul qilinadi.'));
    }
  }
});

// Helper to sanitize database Startup record to Frontend Startup structure
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
      milestones: JSON.parse(dbStartup.milestones || "[]"),
    };
    // Hide deliveryUrl from general viewing. It should only be accessible to the verified buyer on payment status check.
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

// Helper to create notifications
export async function createNotification(userId: number, type: string, title: string, message: string, link?: string) {
  try {
    // 1. Save to database first
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, link }
    });
    // 2. Only emit AFTER database confirms
    io.to(`user:${userId}`).emit("new_notification", notification);
    return notification;
  } catch (err) {
    console.error("Error creating notification:", err);
    return null;
  }
}

// Automatic Database Seeding
async function seedDatabase() {
  try {
    const categoryCount = await prisma.category.count();

    // One-time migration for listingType
    const countToUpdate = await prisma.startup.count({ where: { listingType: "Butunlay sotiladi" } });
    if (countToUpdate > 0) {
      console.log(`Migrating ${countToUpdate} startups with old listingType...`);
      await prisma.startup.updateMany({
        where: { listingType: "Butunlay sotiladi" },
        data: { listingType: "To'liq loyiha (manba kodi bilan)" }
      });
    }

    if (categoryCount === 0) {
      console.log("Seeding categories...");
      const categories = [
        { 
          id: "startups", 
          name: "Startaplar", 
          icon: "rocket_launch",
          fields: JSON.stringify(CATEGORY_FIELDS["startups"] || [])
        },
        { 
          id: "ai-prompts", 
          name: "AI Promptlar", 
          icon: "auto_awesome",
          fields: JSON.stringify(CATEGORY_FIELDS["ai-prompts"] || [])
        },
        { 
          id: "ai-models", 
          name: "AI Modellar/Botlar", 
          icon: "smart_toy",
          fields: JSON.stringify(CATEGORY_FIELDS["ai-models"] || [])
        },
        { 
          id: "sites-apps", 
          name: "Saytlar/Ilovalar", 
          icon: "web",
          fields: JSON.stringify(CATEGORY_FIELDS["sites-apps"] || [])
        },
        { 
          id: "other-digital", 
          name: "Boshqa raqamli mahsulotlar", 
          icon: "category",
          fields: JSON.stringify(CATEGORY_FIELDS["other-digital"] || [])
        },
      ];
      for (const cat of categories) {
        await prisma.category.create({ data: cat });
      }
    }
  } catch (err) {
    console.error("Failed to automatically seed database:", err);
  }
}

// Authentication Middleware
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

async function sendTelegramMessage(telegramUserId: string, text: string) {
  try {
    const botToken = await getSetting("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      console.warn("TELEGRAM_BOT_TOKEN is not set, skipping notification.");
      return;
    }
    const bot = new Bot(botToken);
    await bot.api.sendMessage(telegramUserId, text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Error sending Telegram message:", err);
  }
}

// 12-MUAMMO: Har qanday jiddiy server xatoligi va foydalanuvchi murojaatlari haqida Telegram adminga xabar yuborish
export async function notifyAdminTelegram(message: string) {
  try {
    const botToken = await getSetting("TELEGRAM_BOT_TOKEN") || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn("TELEGRAM_BOT_TOKEN sozlanmagan, admin ogohlantirishini yuborib bo'lmadi.");
      return;
    }
    const adminChatId = await getSetting("TELEGRAM_ADMIN_CHAT_ID") || process.env.TELEGRAM_ADMIN_CHAT_ID || "8780300373";
    if (!adminChatId) {
      console.warn("TELEGRAM_ADMIN_CHAT_ID sozlanmagan, admin ogohlantirishini yuborib bo'lmadi.");
      return;
    }
    const bot = new Bot(botToken);
    
    // Truncate message to avoid Telegram API limit
    const truncatedMessage = message.substring(0, 4096);
    
    await bot.api.sendMessage(adminChatId, truncatedMessage, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Admin Telegram ogohlantirishini yuborishda xatolik:", err);
  }
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

// ---------------- API ENDPOINTS ----------------

app.post("/api/newsletter/subscribe", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: "Noto'g'ri elektron pochta." });
  }

  try {
    const existing = await prisma.subscriber.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Siz allaqachon obuna bo'lgansiz." });
    }
    await prisma.subscriber.create({
      data: { email }
    });
    return res.json({ message: "Obunangiz muvaffaqiyatli rasmiylashtirildi!" });
  } catch (err) {
    console.error("Newsletter error:", err);
    return res.status(500).json({ error: "Xatolik yuz berdi. Iltimos qayta urinib ko'ring." });
  }
});

// Refresh Token Helper
export async function generateRefreshToken(userId: number, req: Request): Promise<string> {
  const tokenValue = `${crypto.randomBytes(40).toString("hex")}-${userId}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  await prisma.refreshToken.create({
    data: {
      token: tokenValue,
      userId,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      expiresAt,
    },
  });

  return tokenValue;
}

// Lazy load auth router to prevent circular dependencies
import authRouter from "./src/routes/auth";
app.use("/api/auth", authRouter);

import supportRouter from "./src/routes/support";
app.use("/api", supportRouter);

app.get("/api/auth/google-client-id", async (req: Request, res: Response) => {
  try {
    const clientId = await getDynamicGoogleClientId();
    res.json({ clientId });
  } catch (err) {
    res.status(500).json({ error: "Google client ID yuklashda xatolik." });
  }
});

// 9-MUAMMO: Google orqali kirishda refreshToken xavfsiz saqlash uchun cookie o'rnatish helper funktsiyasi
function setAuthCookiesLocal(res: Response, accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === "production";
  const domain = isProd ? ".savdo24.online" : undefined;

  res.cookie("token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: "/",
    domain: domain
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    domain: domain
  });
}

app.post("/api/auth/google", authLimiter, async (req: Request, res: Response) => {
  const { credential } = req.body;
  const clientId = await getDynamicGoogleClientId();
  if (!clientId) {
    return res.status(500).json({ error: "Google Auth konfiguratsiyasi serverda mavjud emas." });
  }
  const client = new OAuth2Client(clientId);
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(400).json({ error: "Google email topilmadi." });

    let user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (user && user.isBanned) {
      return res.status(403).json({ error: "Sizning hisobingiz bloklangan. Qo'shimcha ma'lumot uchun qo'llab-quvvatlash xizmatiga murojaat qiling." });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || payload.email.split("@")[0],
          googleId: payload.sub,
          authProvider: "google",
          emailVerified: true,
          role: "Xaridor",
          joinDate: new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long" }) + "-yil",
          avatarUrl: payload.picture || `/default-avatar.jpg`,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, emailVerified: true },
      });
    }

    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = await generateRefreshToken(user.id, req);

    // 9-MUAMMO: Google orqali kirishda refreshToken xavfsiz saqlash uchun setAuthCookiesLocal chaqirildi, refreshToken javob body-sidan olib tashlandi.
    setAuthCookiesLocal(res, accessToken, refreshToken);

    res.json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Google orqali kirish muvaffaqiyatsiz bo'ldi." });
  }
});

// POST /api/auth/forgot-password and reset-password are handled by authRouter

// PATCH /api/users/me — Profilni tahrirlash
app.patch("/api/users/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    // XAVFSIZLIK: `role` bu yerdan qasddan qabul qilinmaydi. Foydalanuvchi o'zini
    // shu endpoint orqali admin/vip roliga o'zgartira olmasligi kerak (privilege escalation).
    // Rolni faqat /api/admin/users/:id/role (requireAdmin) orqaligina o'zgartirish mumkin.
    const { name, avatarUrl, coverUrl } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        avatarUrl,
        coverUrl
      },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, coverUrl: true, isVip: true }
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Profilni saqlashda xatolik yuz berdi." });
  }
});

// POST /api/users/me/telegram-link-code — Telegram bilan bog'lash kodini generatsiya qilish
app.post("/api/users/me/telegram-link-code", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramLinkCode: code,
        telegramLinkCodeExpires: expiresAt
      }
    });
    
    res.json({ code });
  } catch (err) {
    console.error("Generate telegram link code error:", err);
    res.status(500).json({ error: "Kod generatsiya qilishda xatolik yuz berdi." });
  }
});

// GET /api/users/me/earnings — Foydalanuvchining daromadlari
app.get("/api/users/me/earnings", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const completedSales = await prisma.payment.findMany({
      where: {
        status: "completed",
        startup: { userId: userId }
      },
      include: { startup: true },
      orderBy: { createdAt: "desc" }
    });

    const totalEarnings = completedSales.reduce((acc: number, p: any) => acc + (p.sellerPayoutAmount ? Number(p.sellerPayoutAmount) : 0), 0);

    res.json({
      totalEarnings,
      sales: completedSales.map((p: any) => ({
        id: p.id,
        date: p.createdAt,
        projectName: p.startup?.name,
        amount: p.amount,
        payout: p.sellerPayoutAmount
      }))
    });
  } catch (err: any) {
    console.error("Get earnings error:", err);
    res.status(500).json({ error: "Daromadlarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/users/me/reviews-given — Men yozgan sharhlar
app.get("/api/users/me/reviews-given", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const reviews = await prisma.review.findMany({
      where: { buyerId: userId },
      include: { startup: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(reviews);
  } catch (err: any) {
    console.error("Get reviews given error:", err);
    res.status(500).json({ error: "Yozilgan sharhlarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/users/me/reviews-received — Menga yozilgan sharhlar
app.get("/api/users/me/reviews-received", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const reviews = await prisma.review.findMany({
      where: { sellerId: userId },
      include: {
        buyer: { select: PUBLIC_USER_SELECT },
        startup: true
      },
      orderBy: { createdAt: "desc" }
    });
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { averageRating: true, totalReviews: true }
    });

    res.json({
      reviews,
      averageRating: user?.averageRating || 0,
      totalReviews: user?.totalReviews || 0
    });
  } catch (err: any) {
    console.error("Get reviews received error:", err);
    res.status(500).json({ error: "Qabul qilingan sharhlarni yuklashda xatolik yuz berdi." });
  }
});

// --- ERROR REPORTING ---
app.post("/api/client-error-report", clientErrorLimiter, async (req: Request, res: Response) => {
  const { message, stack, componentStack, url, browser } = req.body;
  const errorMsg = `🔴 <b>FRONTEND XATOSI</b>\n\n<b>URL:</b> ${escapeHtml(url)}\n<b>Brauzer:</b> ${escapeHtml(browser)}\n<b>Xato:</b> <code>${escapeHtml(String(message).slice(0, 300))}</code>\n<b>Stack:</b> <code>${escapeHtml(String(stack).slice(0, 300))}</code>\n<b>Komponent:</b> <code>${escapeHtml(String(componentStack).slice(0, 300))}</code>`;
  await notifyAdminTelegram(errorMsg).catch(() => {});
  res.sendStatus(200);
});

// --- ANALYTICS ---

app.post("/api/analytics/track", async (req: Request, res: Response) => {
  const { event, targetId, source, metadata } = req.body;
  // Get userId from token if exists
  // MUHIM: loyihada autentifikatsiya `token` cookie orqali ishlaydi
  // (authenticateToken'ga qarang), frontend HECH QACHON Authorization header
  // yubormaydi — shuning uchun bu yerda faqat header tekshirilgani sabab
  // kirgan foydalanuvchilarning analytics hodisalari ham doim userId=undefined
  // bilan yozilardi — endi cookie ham tekshiriladi.
  let userId: number | undefined;
  const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      userId = decoded.id;
    } catch {}
  }

  await trackEvent(event, userId, targetId, source, metadata);
  res.json({ success: true });
});

// --- AI FEATURES ---

app.get("/api/ai/price-suggestion", async (req: Request, res: Response) => {
  const { category, features } = req.query;
  let featuresList: any[] = [];
  if (typeof features === 'string') {
    try {
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) featuresList = parsed;
    } catch {
      // Yaroqsiz JSON kelsa xato tashlamasdan bo'sh ro'yxat bilan davom etamiz
      featuresList = [];
    }
  }

  try {
    const similar = await prisma.startup.findMany({
      where: { 
        category: category as string,
        price: { gt: 0 },
        soldStatus: "sotildi"
      },
      orderBy: { price: "desc" },
      take: 10
    });

    let avgPrice = 100; // base price
    if (similar.length > 0) {
      avgPrice = similar.reduce((sum: number, s: any) => sum + Number(s.price), 0) / similar.length;
    }

    const featureBoost = featuresList.length * 50; 
    const suggestedPrice = Math.round((avgPrice + featureBoost) / 10) * 10;
    
    res.json({
      suggestedPrice,
      range: { min: Math.round(suggestedPrice * 0.8), max: Math.round(suggestedPrice * 1.2) },
      similarCount: similar.length
    });
  } catch (err) {
    res.status(500).json({ error: "Narx taklifini hisoblashda xatolik." });
  }
});

// --- ESCROW (126-bosqich: src/routes/escrow.ts'ga ko'chirildi) ---
import escrowRouter from "./src/routes/escrow";
app.use("/api", escrowRouter);

// --- B2B WHOLESALE (111-bosqich: src/routes/b2b.ts'ga ko'chirildi) ---
import b2bRouter, { adminB2bRouter } from "./src/routes/b2b";
app.use("/api/b2b", b2bRouter);
app.use("/api/admin/b2b", adminB2bRouter);

app.get("/api/social-proof", async (req: Request, res: Response) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stats = {
      sales24h: await prisma.payment.count({ 
        where: { status: "completed", createdAt: { gte: last24h } } 
      }),
      newUsers24h: await prisma.user.count({ 
        where: { joinDate: { gte: last24h.toISOString() } } 
      }),
      newListings24h: await prisma.startup.count({ 
        where: { dateCreated: { gte: last24h.toISOString() } } 
      }),
      topSeller: await prisma.user.findFirst({
        where: { role: "Sotuvchi" },
        include: { _count: { select: { startups: true } } },
        orderBy: { startups: { _count: "desc" } },
        take: 1
      }),
      topRated: await prisma.review.findFirst({
        where: { rating: 5 },
        orderBy: { createdAt: "desc" },
        include: { buyer: { select: { name: true } } }
      })
    };
    
    res.json(stats);
  } catch (err) {
    console.error("Social proof error:", err);
    res.status(500).json({ error: "Social proof yuklashda xatolik." });
  }
});

// GET /api/listings/tiers — Mavjud tierlar
app.get("/api/listings/tiers", async (req: Request, res: Response) => {
  try {
    const tiers = await prisma.listingTier.findMany({
      orderBy: { pricePerDay: "asc" }
    });
    
    if (tiers.length === 0) {
      // Seed default tiers if none exist
      const defaultTiers = [
        { tier: "standard", displayName: "Standard", pricePerDay: 0, durationDays: 30, features: JSON.stringify({ visibility: "normal" }) },
        { tier: "featured", displayName: "Featured (TOP)", pricePerDay: 2, durationDays: 7, features: JSON.stringify({ visibility: "high", boost: true }) },
        { tier: "premium", displayName: "Premium Plus", pricePerDay: 5, durationDays: 14, features: JSON.stringify({ visibility: "highest", boost: true, badge: "VIP" }) }
      ];
      for (const t of defaultTiers) {
        await prisma.listingTier.create({ data: t });
      }
      return res.json(defaultTiers);
    }
    
    res.json(tiers);
  } catch (err) {
    res.status(500).json({ error: "Tierlarni yuklashda xatolik." });
  }
});

// POST /api/listings/:id/upgrade — Upgrade to tier
app.post("/api/listings/:id/upgrade", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { tierId } = req.body;

  try {
    const startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup || (startup.userId !== req.user?.id && req.user?.role !== "Admin")) {
      return res.status(403).json({ error: "Sizda bu amal uchun ruxsat yo'q." });
    }

    const tier = await prisma.listingTier.findUnique({ where: { id: tierId } });
    if (!tier) return res.status(404).json({ error: "Tier topilmadi." });

    if (tier.pricePerDay === 0) {
      // Standard is free
      await prisma.startup.update({
        where: { id },
        data: { currentTier: tier.tier }
      });
      return res.json({ success: true, message: "Standard tierga o'tildi." });
    }

    // In a real app, this would redirect to payment
    // For now, let's create a payment record and return a simulation URL or similar
    const totalAmount = Number(tier.pricePerDay) * tier.durationDays;
    const orderId = "UPG-" + crypto.randomBytes(4).toString('hex').toUpperCase();
    const secureToken = crypto.randomBytes(24).toString('hex');

    const payment = await prisma.payment.create({
      data: {
        id: orderId,
        amount: totalAmount,
        status: "pending",
        currency: "USDT",
        userId: req.user?.id,
        startupId: id,
        callbackToken: secureToken,
        gateway: "coingate"
      }
    });

    // Create listing subscription record (pending)
    await prisma.listingSubscription.create({
      data: {
        startupId: id,
        tierId: tier.id,
        paymentId: orderId,
        expiresAt: new Date(Date.now() + tier.durationDays * 24 * 60 * 60 * 1000)
      }
    });

    res.json({ orderId, amount: totalAmount, message: "To'lov kutilmoqda." });
  } catch (err) {
    res.status(500).json({ error: "Upgrade qilishda xatolik." });
  }
});

// 114-bosqich: referrals route'lari src/routes/referrals.ts'ga ko'chirildi.
import referralsRouter, { adminReferralsRouter } from "./src/routes/referrals";
app.use("/api/referrals", referralsRouter);
app.use("/api/admin/referrals", adminReferralsRouter);

app.get("/api/admin/analytics", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || "day";
    const days = period === "day" ? 1 : period === "week" ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const stats = {
      totalListings: await prisma.startup.count(),
      activeUsers: await prisma.user.count({ where: { isBanned: false } }),
      newUsers: await prisma.user.count({ where: { joinDate: { gte: startDate.toISOString() } } }), // Note: joinDate is String in schema, might need better date handling
      totalSales: await prisma.payment.count({ 
        where: { status: "completed", createdAt: { gte: startDate } } 
      }),
      totalRevenue: (await prisma.payment.aggregate({
        where: { status: "completed", createdAt: { gte: startDate } },
        _sum: { platformFeeAmount: true }
      }))._sum.platformFeeAmount || 0,
      topCategories: await prisma.startup.groupBy({
        by: ["category"],
        where: { createdAt: { gte: startDate.toISOString() } }, // image/gallery use string dates sometimes
        _count: true,
        orderBy: { _count: { id: "desc" } as any },
        take: 5
      }),
      dailyRevenue: await prisma.payment.groupBy({
        by: ["createdAt"],
        where: { status: "completed", createdAt: { gte: startDate } },
        _sum: { platformFeeAmount: true },
        orderBy: { createdAt: "asc" }
      })
    };
    
    res.json(stats);
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Analitika ma'lumotlarini yuklashda xatolik." });
  }
});

// 118-bosqich: admin/users route'lari src/routes/admin-users.ts'ga
// ko'chirildi.
import adminUsersRouter from "./src/routes/admin-users";
app.use("/api/admin/users", adminUsersRouter);

// JWT AUTH: Get Profile (Me), Refresh Token, Logout, and Resend Verification are handled by authRouter

// GET /api/startups - barcha startaplarni olish (filter: kategoriya, status, qidiruv, listingType va sahifalash bo'yicha)
app.get("/api/startups", async (req: Request, res: Response) => {
  const { category, status, search, listingType, page, limit, onlyActive, isTop, includeMine } = req.query;

  // MUHIM (4-BOSQICH): bu endpoint hech qanday autentifikatsiyasiz, butunlay
  // ochiq (public) — lekin `status` filtri berilmasa, moderatsiyadan
  // o'tmagan ("pending") va rad etilgan ("rejected") e'lonlarni ham qaytarib
  // yuborardi. Bu ma'lumotlar faqat Admin panelidagi moderatsiya ro'yxati
  // uchun mo'ljallangan edi, lekin App.tsx uni HAR BIR tashrif buyuruvchi
  // (mehmonlar ham) uchun cheklovsiz chaqiradi — natijada tasdiqlanmagan
  // e'lonlar butun saytga (va Telegram bot orqali ham) oshkor bo'lardi.
  // Endi faqat Admin (haqiqiy JWT token bilan) "pending"/"rejected"
  // statusini so'rashi mumkin; qolgan barcha hollarda faqat "active"
  // e'lonlar qaytariladi.
  let isRequestingAdmin = false;
  let requestingUserId: number | null = null;
  try {
    let adminCheckToken = req.cookies?.token;
    if (!adminCheckToken) {
      const authHeader = req.headers["authorization"];
      adminCheckToken = authHeader && authHeader.split(" ")[1];
    }
    if (adminCheckToken) {
      const decoded = jwt.verify(adminCheckToken, JWT_SECRET) as JwtPayload;
      if (decoded?.role === "Admin") isRequestingAdmin = true;
      if (decoded?.id) requestingUserId = decoded.id;
    }
  } catch {
    // Yaroqsiz/eskirgan token — mehmon sifatida davom etiladi (xato tashlanmaydi)
  }

  try {
    const filter: any = {};
    const andConditions: any[] = [];
    if (category) filter.category = category as string;
    if (status && isRequestingAdmin) {
      filter.status = status as string;
    } else if (!isRequestingAdmin) {
      // 45-MUAMMO: yuqoridagi (4/5-bosqich) fix "o'ziniki" e'lonlarni HAR QANDAY
      // /api/startups chaqiruviga (parametrsiz ham) qo'shib yuborardi — bu
      // Profilga mo'ljallangan edi, lekin BrowsePage.tsx ham xuddi shu
      // endpointdan (o'z sahifalash/filtrlari bilan) foydalanganda, tizimga
      // kirgan sotuvchining hali tasdiqlanmagan/rad etilgan e'loni hech qanday
      // belgisiz umumiy ommaviy katalogga (va totalCount/totalPages'ga ham)
      // aralashib qolardi. Endi "o'ziniki"ni qo'shish faqat aniq so'ralganda
      // (includeMine=true — App.tsx buni Profil uchun yuboradi) ishlaydi;
      // BrowsePage kabi ommaviy so'rovlar hamon faqat "active"ni ko'radi.
      if (includeMine === "true" && requestingUserId) {
        andConditions.push({
          OR: [{ status: "active" }, { userId: requestingUserId }],
        });
      } else {
        filter.status = "active";
      }
    }
    if (listingType && listingType !== "All") filter.listingType = listingType as string;
    if (onlyActive === "true") {
      filter.soldStatus = "sotuvda";
    }

    if (isTop === "true") {
      filter.isTop = true;
      filter.topExpiresAt = { gt: new Date() };
    } else if (isTop === "false") {
      filter.isTop = false;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      // 1. Limit length for performance and DOS prevention
      const rawSearch = search.trim().substring(0, 100);
      
      // 2. Sanitize XSS/injection characters (keep only alphanumeric, spaces, hyphens, Uzbek/Cyrillic letters)
      const sanitized = rawSearch.replace(/[^a-zA-Z0-9\s\-\u0400-\u04FFʻʼ'’]/g, '').trim();
      
      // 3. Prevent tiny empty string or whitespace queries
      if (sanitized.length >= 2) {
        const mode = isPostgres ? "insensitive" : undefined;
        andConditions.push({
          OR: [
            { name: { contains: sanitized, mode } },
            { description: { contains: sanitized, mode } },
            { category: { contains: sanitized, mode } },
            { id: { contains: sanitized, mode } },
          ],
        });
      }
    }

    if (andConditions.length > 0) filter.AND = andConditions;

    const parsedPage = parseInt(page as string, 10);
    const pageNum = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const parsedLimit = parseInt(limit as string, 10);
    let limitNum = isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit;
    if (limitNum > 100) limitNum = 100; // Max limit 100 for security
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await prisma.startup.count({ where: filter });
    const totalPages = Math.ceil(totalCount / limitNum);

    const startupsList = await prisma.startup.findMany({
      where: filter,
      orderBy: [
        { isTop: "desc" },
        { id: "desc" }
      ],
      skip,
      take: limitNum,
      include: { user: { select: { name: true, isVip: true, avatarUrl: true } } }
    });

    // XATO: formatStartup() deliveryUrl'ni HAMMA uchun (hatto egasi uchun ham)
    // o'chirib tashlaydi — natijada SellPage'da "Tahrirlash" ochilganda sotuvchi
    // o'zining saqlangan maxfiy yetkazish havolasini ko'ra olmasdi. Egasi yoki
    // admin uchun bu maydon qaytarib tiklanadi.
    const formatted = startupsList.map((s: any) => {
      const f = formatStartup(s);
      if (isRequestingAdmin || (requestingUserId && s.userId === requestingUserId)) {
        f.deliveryUrl = s.deliveryUrl || '';
      }
      return f;
    });
    res.json({ startups: formatted, totalCount, totalPages });
  } catch (err: any) {
    console.error("GET /api/startups error:", err);
    res.status(500).json({ error: "Startaplarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/startups/:id - bitta startap tafsiloti
app.get("/api/startups/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const startupRecord = await prisma.startup.findUnique({
      where: { id },
    });

    if (!startupRecord) {
      return res.status(404).json({ error: "Startap topilmadi." });
    }

    let currentUser = null;
    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers["authorization"];
      token = authHeader && authHeader.split(" ")[1];
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        currentUser = await prisma.user.findUnique({ where: { id: decoded.id } });
      } catch (err) {}
    }

    const isOwner = !!(currentUser && currentUser.id === startupRecord.userId);
    const isAdmin = !!(currentUser && currentUser.role === "Admin");

    // Visibility Check
    if (startupRecord.status !== "active") {
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ error: "Startap topilmadi." }); // Return 404 for privacy
      }
    }

    // XATO: formatStartup() deliveryUrl'ni hamma uchun o'chiradi — egasi/admin
    // uchun tiklanadi (Tahrirlash sahifasida ko'rinishi kerak).
    const formatted = formatStartup(startupRecord);
    if (isOwner || isAdmin) {
      formatted.deliveryUrl = startupRecord.deliveryUrl || '';
      formatted.contactEmail = startupRecord.contactEmail || '';
      formatted.contactPhone = startupRecord.contactPhone || '';
      formatted.contactTelegram = startupRecord.contactTelegram || '';
    }

    res.json(formatted);
  } catch (err: any) {
    console.error("GET /api/startups/:id error:", err);
    res.status(500).json({ error: "Startapni yuklashda xatolik yuz berdi." });
  }
});

// 115-bosqich: top-boost/vip route'lari src/routes/top-boost-vip.ts'ga ko'chirildi.
import topBoostVipRouter from "./src/routes/top-boost-vip";
app.use("/api", topBoostVipRouter);

// Startups validation schemas
const techStackPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}, z.array(z.string()).max(100, "Texnologiyalar soni juda ko'p").optional().nullable());

const galleryPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}, z.array(z.string()).max(10, "Galereya ko'pi bilan 10 ta rasm bo'lishi kerak").optional().nullable());

const teamPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}, z.array(z.any()).max(10, "Jamoa a'zolari ko'pi bilan 10 ta bo'lishi kerak").optional().nullable());

const milestonesPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}, z.array(z.any()).max(20, "Bosqichlar ko'pi bilan 20 ta bo'lik bo'lishi kerak").optional().nullable());

// Faqat http/https protokolli URL'larni qabul qiladi (javascript:, data: va h.k. XSS vektorlarini bloklaydi)
const safeUrl = z.string().max(2000).refine((val) => {
  if (!val) return true;
  try {
    const parsed = new URL(val);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}, { message: "Havola http:// yoki https:// bilan boshlanishi va to'g'ri formatda bo'lishi kerak." }).optional().nullable().or(z.literal(""));

const createStartupSchema = z.object({
  name: z.string().min(1, "Nomi kamida 1 ta belgidan iborat bo'lishi kerak").max(150, "Nomi ko'pi bilan 150 ta belgidan iborat bo'lishi kerak"),
  
  slogan: z.string().max(200, "Slogan ko'pi bilan 200 ta belgidan iborat bo'lishi kerak").optional().nullable().or(z.literal("")),
  
  description: z.string().min(1, "Tavsifi kamida 1 ta belgidan iborat bo'lishi kerak").max(500, "Tavsifi ko'pi bilan 500 ta belgidan iborat bo'lishi kerak"),
  
  longDescription: z.string().max(5000, "Batafsil tavsif ko'pi bilan 5000 ta belgidan iborat bo'lishi kerak").optional().nullable().or(z.literal("")),
  
  category: z.string().min(1, "Kategoriya kiritilishi shart"),
  
  price: z.union([z.number(), z.string()]).refine((val) => {
    const parsed = parseFloat(String(val));
    return !isNaN(parsed) && parsed > 0;
  }, {
    message: "Narx musbat son bo'lishi shart."
  }).refine((val) => {
    const parsed = parseFloat(String(val));
    return parsed <= 1000000;
  }, {
    message: "Narx 1000000 dan oshmasligi kerak."
  }).transform((val) => parseFloat(String(val))),
  
  listingType: z.string().optional().nullable(),
  techStack: techStackPreprocess,
  demoUrl: safeUrl,
  deliveryUrl: safeUrl,
  githubUrl: safeUrl,
  repoIncluded: z.union([z.boolean(), z.string()]).optional().nullable().transform((val) => val === true || val === "true"),
  image: z.string().optional().nullable(),
  gallery: galleryPreprocess,
  team: teamPreprocess,
  milestones: milestonesPreprocess,
  contactEmail: z.string().optional().nullable().or(z.literal("")),
  contactPhone: z.string().optional().nullable().or(z.literal("")),
  contactTelegram: z.string().optional().nullable().or(z.literal("")),
  attributes: z.string().optional().nullable(),
});

const patchStartupSchema = createStartupSchema.partial();

// POST /api/startups — yangi startap qo'shish
app.post("/api/startups", authenticateToken, async (req: AuthRequest, res: Response) => {
  const parsed = createStartupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const {
    name,
    slogan,
    description,
    longDescription,
    category,
    price: parsedPrice,
    listingType,
    techStack,
    demoUrl,
    githubUrl,
    repoIncluded,
    image,
    gallery,
    team,
    milestones,
    contactEmail,
    contactPhone,
    contactTelegram,
    deliveryUrl,
    attributes,
  } = parsed.data;

  const validCategory = await prisma.category.findFirst({
    where: { id: category }
  });
  if (!validCategory) {
    return res.status(400).json({ error: "Yaroqsiz kategoriya tanlandi." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id } });
    if (user && !user.emailVerified) {
      return res.status(403).json({ error: "Startap e'lon qilish uchun iltimos avval email manzilingizni tasdiqlang." });
    }

    // Generate unique slug (optimized high-performance generation)
    let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!baseSlug) baseSlug = 'startup';
    
    let slug = baseSlug;
    const existing = await prisma.startup.findUnique({ where: { id: slug } });
    if (existing) {
      slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
      const existingSecond = await prisma.startup.findUnique({ where: { id: slug } });
      if (existingSecond) {
        slug = `${baseSlug}-${crypto.randomBytes(4).toString('hex')}`;
      }
    }

    const newStartup = await prisma.startup.create({
      data: {
        id: slug,
        name,
        slogan: slogan || "",
        description,
        longDescription: longDescription || description,
        category,
        price: parsedPrice,
        listingType: listingType || "To'liq loyiha (manba kodi bilan)",
        techStack: JSON.stringify(techStack || []),
        demoUrl: demoUrl || "",
        githubUrl: githubUrl || "",
        deliveryUrl: deliveryUrl || "",
        repoIncluded: repoIncluded === true,
        soldStatus: "sotuvda",
        status: "pending", // default is pending
        proposalsCount: 0,
        image: image || "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800",
        gallery: JSON.stringify(gallery || []),
        team: JSON.stringify(team || []),
        milestones: JSON.stringify(milestones || []),
        contactEmail: contactEmail || req.user?.email || "",
        contactPhone: contactPhone || "",
        contactTelegram: contactTelegram || "",
        attributes: attributes || "{}",
        dateCreated: new Date().toISOString().split("T")[0],
        userId: req.user?.id,
      },
    });

    res.status(201).json(formatStartup(newStartup));
  } catch (err: any) {
    console.error("POST /api/startups error:", err);
    res.status(500).json({ error: "Loyiha yaratishda xatolik yuz berdi." });
  }
});

// PATCH /api/startups/:id — startapni tahrirlash
app.patch("/api/startups/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const parsed = patchStartupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const validatedData = parsed.data;

  if (validatedData.category) {
    const validCategory = await prisma.category.findFirst({
      where: { id: validatedData.category }
    });
    if (!validCategory) {
      return res.status(400).json({ error: "Yaroqsiz kategoriya tanlandi." });
    }
  }

  try {
    const startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup) {
      return res.status(404).json({ error: "Startap topilmadi." });
    }

    if (startup.userId !== req.user?.id && req.user?.role !== "Admin") {
      return res.status(403).json({ error: "Siz faqat o'z startaplaringizni tahrirlashingiz mumkin." });
    }

    const updatedData: any = {};
    if (validatedData.name !== undefined) updatedData.name = validatedData.name;
    if (validatedData.price !== undefined) updatedData.price = validatedData.price;
    if (validatedData.description !== undefined) updatedData.description = validatedData.description;
    if (validatedData.longDescription !== undefined) updatedData.longDescription = validatedData.longDescription;
    if (validatedData.category !== undefined) updatedData.category = validatedData.category;
    if (validatedData.listingType !== undefined) updatedData.listingType = validatedData.listingType;
    if (validatedData.demoUrl !== undefined) updatedData.demoUrl = validatedData.demoUrl;
    if (validatedData.githubUrl !== undefined) updatedData.githubUrl = validatedData.githubUrl;
    if (validatedData.image !== undefined) updatedData.image = validatedData.image;
    if (validatedData.gallery !== undefined) {
      updatedData.gallery = JSON.stringify(validatedData.gallery || []);
    }
    if (validatedData.techStack !== undefined) {
      updatedData.techStack = JSON.stringify(validatedData.techStack || []);
    }
    if (validatedData.team !== undefined) {
      updatedData.team = JSON.stringify(validatedData.team || []);
    }
    if (validatedData.milestones !== undefined) {
      updatedData.milestones = JSON.stringify(validatedData.milestones || []);
    }
    if (validatedData.contactEmail !== undefined) updatedData.contactEmail = validatedData.contactEmail;
    if (validatedData.contactPhone !== undefined) updatedData.contactPhone = validatedData.contactPhone;
    if (validatedData.contactTelegram !== undefined) updatedData.contactTelegram = validatedData.contactTelegram;
    if (validatedData.deliveryUrl !== undefined) updatedData.deliveryUrl = validatedData.deliveryUrl;
    if (validatedData.attributes !== undefined) updatedData.attributes = validatedData.attributes;
    // 43-MUAMMO: SellPage.tsx tahrirlashda repoIncluded'ni ham yuborardi
    // (listingType'dan hisoblanadi), lekin bu yerda updatedData'ga
    // qo'shilmagani uchun bazada eskirgan qiymat qolib ketardi — listingType
    // o'zgarsa ham "Repo + Kod" / "Faqat litsenziya" ko'rsatkichi eskicha
    // qolardi (BrowsePage/DetailPage).
    if (validatedData.repoIncluded !== undefined) updatedData.repoIncluded = validatedData.repoIncluded;
    
    // Agar faol bo'lsa, moderatsiyaga qaytarsin (Xavfsizlik)
    if (startup.status === "active") {
        updatedData.status = "pending";
    }

    const updated = await prisma.startup.update({
      where: { id },
      data: updatedData,
    });

    res.json(formatStartup(updated));
  } catch (err: any) {
    console.error("PATCH /api/startups/:id error:", err);
    res.status(500).json({ error: "Startapni tahrirlashda xatolik yuz berdi." });
  }
});

// PATCH /api/startups/:id/status — admin tomonidan tasdiqlash/rad etish
app.patch("/api/startups/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // active, pending, sold, rejected etc.

  if (!status) {
    return res.status(400).json({ error: "Status taqdim etilishi shart." });
  }

  // Check if admin
  if (req.user?.role !== "Admin") {
    // Only allow founders to mark their own startups as sold
    if (status !== "sold") {
      return res.status(403).json({ error: "Siz faqat o'z startapingizni 'sold' holatiga o'tkaza olasiz." });
    }
    const startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup || startup.userId !== req.user?.id) {
      return res.status(403).json({ error: "Ushbu amalni bajarish uchun sizda ruxsat yo'q." });
    }
  }

  try {
    const updated = await prisma.startup.update({
      where: { id },
      data: { status },
    });

    // Notify founder
    if (updated.userId) {
      const title = status === "active" ? "Loyiha tasdiqlandi" : "Loyiha rad etildi";
      const message = status === "active" 
        ? `Sizning "${updated.name}" loyihangiz adminlar tomonidan tasdiqlandi va sotuvga qo'yildi.`
        : `Sizning "${updated.name}" loyihangiz rad etildi. Iltimos qoidalarni qayta ko'ring.`;
      await createNotification(updated.userId, "SYSTEM", title, message, `/startup/${id}`);
      
      const user = await prisma.user.findUnique({ where: { id: updated.userId } });
      if (user && status === "active") {
        await sendEmail(
          user.email,
          "Loyihangiz tasdiqlandi!",
          `<p>Tabriklaymiz! <b>${escapeHtml(updated.name)}</b> loyihangiz admin tomonidan ko'rib chiqildi va tasdiqlandi.</p><p>Endi u platformada sotuvda ko'rinadi.</p>`
        );
      }
    }

    if (req.user?.role === "Admin") {
      await prisma.auditLog.create({
        data: {
          adminId: req.user?.id || 0,
          adminEmail: req.user?.email,
          action: status === "active" ? "approve_startup" : "reject_startup",
          targetId: id,
          details: `Startup status updated to ${status}`
        }
      }).catch((e: any) => console.error("Audit log error:", e));
    }

    res.json(formatStartup(updated));
  } catch (err: any) {
    console.error("PATCH /api/startups/:id/status error:", err);
    res.status(500).json({ error: "Statusni yangilashda xatolik yuz berdi." });
  }
});

// GET /api/ideas/top — barcha elonlar bo'yicha eng yuqori reytingli g'oyalar ro'yxati (startap nomi bilan birga), sahifalash bilan (?limit=20&page=1)
app.get("/api/ideas/top", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const { category, time } = req.query;

    const where: any = {
      // XAVFSIZLIK: bu endpoint auth'siz ochiq — faqat tasdiqlangan (active)
      // e'lonlarga tegishli g'oyalar ko'rsatiladi, aks holda pending/rejected
      // startap nomi/kategoriyasi ommaviy reytingda oshkor bo'lib qolardi.
      startup: { status: "active" },
    };

    if (category && category !== "all") {
      where.startup = {
        ...where.startup,
        category: category as string,
      };
    }

    if (time && time !== "all") {
      const now = new Date();
      let startDate: Date | null = null;
      if (time === "today") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (time === "week") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      if (startDate) {
        where.createdAt = {
          gte: startDate,
        };
      }
    }

    const [ideas, total] = await Promise.all([
      prisma.idea.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { upvotes: "desc" },
          { createdAt: "desc" }
        ],
        include: {
          startup: {
            select: {
              name: true,
              category: true,
            }
          }
        }
      }),
      prisma.idea.count({ where })
    ]);

    res.json({
      ideas,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error("GET top ideas error:", err);
    res.status(500).json({ error: "Yuqori reytingli g'oyalarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/startups/:id/ideas — shu elonga tegishli barcha g'oyalarni olish (eng ko'p ovoz olgani birinchi bo'lib chiqsin)
app.get("/api/startups/:id/ideas", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ideas = await prisma.idea.findMany({
      where: { startupId: id },
      orderBy: [
        { upvotes: "desc" },
        { createdAt: "desc" }
      ],
    });
    res.json(ideas);
  } catch (err: any) {
    console.error("GET ideas error:", err);
    res.status(500).json({ error: "G'oyalarni yuklashda xatolik yuz berdi." });
  }
});

// POST /api/startups/:id/ideas — yangi g'oya qo'shish (mehmon yoki login qilgan foydalanuvchi)
app.post("/api/startups/:id/ideas", ideaLimiter, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, authorName } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "G'oya matni bo'sh bo'lmasligi kerak." });
  }

  if (content.length > 500) {
    return res.status(400).json({ error: "G'oya matni 500 belgidan oshmasligi kerak." });
  }

  try {
    let userId: number | undefined = undefined;
    let finalAuthorName = authorName?.trim();

    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers["authorization"];
      token = authHeader && authHeader.split(" ")[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        userId = decoded.id;
        if (!finalAuthorName) {
          finalAuthorName = decoded.name;
        }
      } catch (authErr) {
        // Token validation failed, fallback to guest
      }
    }

    if (!finalAuthorName) {
      finalAuthorName = "Mehmon";
    }

    const newIdea = await prisma.idea.create({
      data: {
        content: content.trim(),
        startupId: id,
        userId,
        authorName: finalAuthorName,
        upvotes: 0,
      },
    });

    res.status(201).json(newIdea);
  } catch (err: any) {
    console.error("POST idea error:", err);
    res.status(500).json({ error: "Xatolik yuz berdi, keyinroq qayta urinib ko'ring." });
  }
});

// POST /api/ideas/:id/upvote — g'oyaga ovoz berish (+1)
app.post("/api/ideas/:id/upvote", upvoteLimiter, async (req: Request, res: Response) => {
  const { id } = req.params;
  const ideaIdNum = parseInt(id);

  if (isNaN(ideaIdNum)) {
    return res.status(400).json({ error: "Noto'g'ri g'oya ID si." });
  }

  // Identify voter
  let voterKey = "";
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id) {
        voterKey = "user-" + decoded.id;
      }
    } catch (err) {
      // ignore decoding error and fallback to guest
    }
  }

  if (!voterKey) {
    let guestId = req.cookies?.guest_id;
    if (!guestId) {
      guestId = crypto.randomUUID();
      res.cookie("guest_id", guestId, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: "lax" });
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const rawKey = `guest-${guestId}-${ip}-${userAgent}`;
    voterKey = crypto.createHash("sha256").update(rawKey).digest("hex");
  }

  try {
    // Check if voter already voted
    const existingVote = await prisma.ideaVote.findUnique({
      where: {
        ideaId_voterKey: {
          ideaId: ideaIdNum,
          voterKey: voterKey,
        }
      }
    });

    if (existingVote) {
      return res.status(409).json({ error: "Siz allaqachon ovoz bergansiz" });
    }

    // Try to record the vote
    try {
      await prisma.ideaVote.create({
        data: {
          ideaId: ideaIdNum,
          voterKey: voterKey,
        }
      });
    } catch (createErr: any) {
      if (createErr.code === 'P2002' || createErr.message?.includes('Unique constraint failed')) {
        return res.status(409).json({ error: "Siz allaqachon ovoz bergansiz" });
      }
      throw createErr;
    }

    const updatedIdea = await prisma.idea.update({
      where: { id: ideaIdNum },
      data: {
        upvotes: { increment: 1 }
      }
    });
    res.json(updatedIdea);
  } catch (err: any) {
    console.error("Upvote idea error:", err);
    res.status(500).json({ error: "Ovoz berishda xatolik yuz berdi." });
  }
});

// --- FILE UPLOAD (TELEGRAM STORAGE) ---
app.post("/api/upload", authenticateToken, uploadLimiter, upload.single("file"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Fayl yuklanmadi." });
    }

    const isVip = req.user?.isVip;
    const maxSizeMB = isVip ? 6 : 2;

    if (req.file.size > maxSizeMB * 1024 * 1024) {
      return res.status(400).json({ error: `Fayl hajmi ${maxSizeMB}MB dan oshmasligi kerak. VIP a'zolar uchun 6MB gacha ruxsat etiladi.` });
    }

    let finalBuffer = req.file.buffer;
    let finalContentType = req.file.mimetype;
    let finalExt = path.extname(req.file.originalname) || ".jpg";

    // 8-MUAMMO: sharp yordamida haqiqiy rasm turi (magic bytes) va butunligini tekshirish
    let metadata: any;
    try {
      metadata = await sharp(req.file.buffer).metadata();
    } catch (err) {
      console.error("Fayl tarkibini tekshirishda xatolik (Sharp metadata):", err);
      return res.status(400).json({ error: "Fayl formati noto'g'ri yoki buzilgan." });
    }

    const allowedFormats = ["jpeg", "png", "webp", "gif", "jpg"];
    if (!metadata || !metadata.format || !allowedFormats.includes(metadata.format)) {
      return res.status(400).json({ error: "Faqat rasm fayllari (JPEG, PNG, WEBP, GIF) qabul qilinadi." });
    }

    // Compress images using sharp, strip EXIF metadata, and auto-rotate
    if (metadata.format === "gif") {
      // Preserve GIF animation
      finalBuffer = req.file.buffer;
      finalContentType = "image/gif";
      finalExt = ".gif";
    } else {
      try {
        finalBuffer = await sharp(req.file.buffer)
          .rotate() // Auto-rotate from EXIF orientation
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true, progressive: true })
          .toBuffer();
        finalContentType = "image/jpeg";
        finalExt = ".jpg";
      } catch (err) {
        console.error("Sharp processing error:", err);
        return res.status(400).json({ error: "Fayl formati noto'g'ri yoki buzilgan." });
      }
    }

    const telegramBotToken = await getSetting("TELEGRAM_BOT_TOKEN");
    const storageChannelId = await getSetting("TELEGRAM_STORAGE_CHANNEL_ID");

    if (!telegramBotToken || !storageChannelId) {
      return res.status(500).json({ error: "Telegram storage sozlamalari (TOKEN yoki CHANNEL_ID) kiritilmagan." });
    }

    // Telegram'ga fayl yuborish with secured/generic filename
    const formData = new FormData();
    formData.append('chat_id', storageChannelId);
    
    // Create Blob for FormData with unique randomized filename
    const genericFilename = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${finalExt}`;
    const blob = new Blob([finalBuffer], { type: finalContentType });
    formData.append('document', blob, genericFilename);

    const tgResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const tgData: any = await tgResponse.json();
    if (!tgData.ok) {
      console.error("Telegram upload error:", tgData);
      return res.status(500).json({ error: "Xatolik yuz berdi, keyinroq qayta urinib ko'ring." });
    }

    const fileId = tgData.result.document?.file_id || tgData.result.photo?.[tgData.result.photo.length - 1]?.file_id;
    if (!fileId) {
      return res.status(500).json({ error: "Telegram'dan File ID olib bo'lmadi." });
    }

    const publicUrl = `/api/files/${fileId}`;

    return res.json({
      url: publicUrl,
      message: "Rasm Telegram'ga muvaffaqiyatli yuklandi."
    });
  } catch (err: any) {
    console.error("POST /api/upload error:", err);
    res.status(500).json({ error: "Xatolik yuz berdi, keyinroq qayta urinib ko'ring." });
  }
});

// Proxy endpoint to retrieve files from Telegram
app.get("/api/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    let fileUrl = "";
    const cached = fileUrlCache.get(fileId);
    if (cached && cached.expiresAt > Date.now()) {
      fileUrl = cached.url;
    } else {
      const telegramBotToken = await getSetting("TELEGRAM_BOT_TOKEN");
      
      if (!telegramBotToken) {
        return res.status(500).send("Telegram Bot Token kiritilmagan.");
      }

      // 1. Get file path from Telegram
      const pathRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`);
      const pathData: any = await pathRes.json();
      
      if (!pathData.ok) {
        logger.error({ pathData }, "Telegram getFile error");
        return res.status(404).send("Fayl Telegram'da topilmadi.");
      }

      fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${pathData.result.file_path}`;
      
      // Set cache (expires in 50 minutes)
      fileUrlCache.set(fileId, { url: fileUrl, expiresAt: Date.now() + 50 * 60 * 1000 });
    }

    // 2. Fetch the actual file URL and stream it to the client
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      logger.error({ status: fileRes.status, statusText: fileRes.statusText }, "Error fetching file from Telegram");
      return res.status(fileRes.status).send("Faylni yuklab olishda xatolik yuz berdi.");
    }

    const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
    const contentLength = fileRes.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    // Set caching headers for the client browser
    res.setHeader("Cache-Control", "public, max-age=31536000");

    if (fileRes.body) {
      const { Readable } = await import("stream");
      Readable.fromWeb(fileRes.body as any).pipe(res);
    } else {
      res.status(500).send("Fayl tarkibi bo'sh.");
    }
  } catch (err) {
    logger.error({ err }, "GET /api/files/:fileId error");
    res.status(500).send("Faylni yuklab olishda xatolik.");
  }
});

// Internal helper to create a payment order (used by web and telegram)
async function createPaymentOrder(userId: number, startupId: string, referralCode?: string, source: string = "web") {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user && !user.emailVerified && source === "web") {
    throw new Error("Xaridni amalga oshirish uchun iltimos avval email manzilingizni tasdiqlang.");
  }

  const startupRecord = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!startupRecord || !startupRecord.price) {
    throw new Error("Loyiha topilmadi yoki narx belgilanmagan.");
  }
  if (startupRecord.soldStatus === "sotildi") {
    throw new Error("Bu loyiha allaqachon sotilgan.");
  }
  // 91-band: o'z loyihasini sotib olishni oldini olish (soxta "sotilgan" holat/pul aylanishi)
  if (startupRecord.userId === userId) {
    throw new Error("O'z loyihangizni sotib ololmaysiz.");
  }

  let basePrice = Number(startupRecord.price);
  let realAmount = basePrice;
  let discountApplied = 0;
  let referralId = null;

  // 1) B2B hisobni tekshirish (verified === true bo'lsa)
  const b2bAccount = await prisma.b2BAccount.findUnique({ where: { userId } });
  let b2bDiscountPercent = 0;
  if (b2bAccount && b2bAccount.verified) {
    b2bDiscountPercent = Number(b2bAccount.discount) || 0;
  }

  // 2) Referral kodni tekshirish
  let referralDiscountPercent = 0;
  let referralObj: any = null;

  if (referralCode) {
    const referral = await prisma.referral.findUnique({
      where: { code: referralCode.trim().toUpperCase(), isActive: true }
    });
    
    if (!referral) {
      throw new Error("Referral code topilmadi yoki faol emas.");
    }
    
    // Prevent self-referral
    if (referral.referrerId === userId) {
      throw new Error("O'zingizning referral kodingizdan foydalana olmaysiz.");
    }
    
    // Prevent repeat use
    const alreadyUsed = await prisma.referral.findFirst({
      where: { 
        code: referralCode.trim().toUpperCase(),
        refereeId: userId 
      }
    });
    
    if (alreadyUsed) {
      throw new Error("Siz bu referral koddan allaqachon foydalangansiz.");
    }
    
    // Check referrer is not banned
    const referrer = await prisma.user.findUnique({
      where: { id: referral.referrerId }
    });
    
    if (!referrer || referrer.isBanned) {
      throw new Error("Ushbu referral kodning egasi faol emas.");
    }

    referralDiscountPercent = Number(referral.discountPercent) || 0;
    referralObj = referral;
  }

  // 3) Kattaroq chegirmani tanlash (B2B vs Referral)
  let chosenDiscountPercent = 0;
  let discountType: "b2b" | "referral" | null = null;

  if (referralDiscountPercent > b2bDiscountPercent && referralDiscountPercent > 0) {
    chosenDiscountPercent = referralDiscountPercent;
    discountType = "referral";
    referralId = referralObj ? referralObj.id : null;
  } else if (b2bDiscountPercent > 0) {
    chosenDiscountPercent = b2bDiscountPercent;
    discountType = "b2b";
    referralId = null;
  }

  if (chosenDiscountPercent > 0) {
    discountApplied = (basePrice * chosenDiscountPercent) / 100;
    realAmount = basePrice - discountApplied;
  }

  let paymentSource = source;
  if (discountType === "b2b") {
    paymentSource = "b2b_discount";
  } else if (discountType === "referral") {
    paymentSource = "referral_discount";
  }

  const orderId = "CG-" + crypto.randomBytes(4).toString('hex').toUpperCase();
  const secureToken = crypto.randomBytes(24).toString('hex');

  // MUHIM: har safar checkout sahifasi qayta ochilsa yoki referral kod
  // qo'llanganda payment qayta yaratilsa, oldingi "pending" buyurtma
  // hech qachon yopilmasdi — bazada abadiy "pending" holatda qolib
  // ketardi (agar kimdir eski CoinGate havolasini keyinroq to'lasa,
  // finalizeCompletedPayment uni "refund_required"ga o'tkazadi, ammo
  // bu qo'lda qaytarish talab qiladi). Endi shu userId+startupId uchun
  // eski "pending" buyurtmalar yangisi yaratilishidan oldin "cancelled"
  // qilinadi.
  await prisma.payment.updateMany({
    where: { userId, startupId, status: "pending" },
    data: { status: "cancelled" }
  }).catch(() => {});

  await prisma.payment.create({
    data: {
      id: orderId,
      amount: realAmount,
      status: "pending",
      currency: "USDT",
      userId: userId,
      startupId: startupId,
      callbackToken: secureToken,
      gateway: "coingate",
      source: paymentSource,
      referralId: referralId
    },
  });

  let paymentUrl = "";
  let useStripe = false;
  let usedGateway = "coingate";

  const coingateToken = await getSetting("COINGATE_API_TOKEN");
  const appUrlSetting = await getSetting("APP_URL") || "http://localhost:3000";

  if (coingateToken) {
    try {
      const response = await fetch("https://api.coingate.com/v2/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Token ${coingateToken}`,
        },
        body: new URLSearchParams({
          order_id: orderId,
          price_amount: realAmount.toFixed(2),
          price_currency: "USD",
          receive_currency: "USDT",
          callback_url: `${appUrlSetting}/api/payments/webhook?token=${secureToken}`,
          success_url: `${appUrlSetting}/checkout/success`,
          cancel_url: `${appUrlSetting}/checkout/cancel`,
          title: startupRecord.name,
        }),
      });

      if (response.ok) {
        const orderData: any = await response.json();
        paymentUrl = orderData.payment_url;
      } else {
        useStripe = true;
      }
    } catch (coinGateErr: any) {
      useStripe = true;
    }
  } else {
    useStripe = true;
  }

  if (useStripe) {
    const stripe = await getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: startupRecord.name },
              unit_amount: Math.round(realAmount * 100),
            },
            quantity: 1,
          }],
          mode: "payment",
          success_url: `${appUrlSetting}/checkout/success?paymentId=${orderId}`,
          cancel_url: `${appUrlSetting}/checkout/cancel`,
          metadata: { orderId, secureToken }
        });
        
        paymentUrl = session.url!;
        await prisma.payment.update({
          where: { id: orderId },
          // NOTE: previously this also set `id: session.id`, which overwrote the
          // payment's primary key. That broke /api/payments/status/:id polling on
          // the frontend (CheckoutPage.tsx polls using the original orderId, so the
          // lookup returned 404 the moment this ran). Keep orderId as the stable id;
          // metadata.orderId already carries it through to Stripe for correlation.
          data: { gateway: "stripe" }
        });
        usedGateway = "stripe";
      } catch (stripeErr) {
        console.error("Stripe fallback error:", stripeErr);
      }
    }
  }

  let apiKeysMissing = false;
  if (!paymentUrl) {
    const stripeKey = await getSetting("STRIPE_SECRET_KEY") || process.env.STRIPE_SECRET_KEY;
    if (!coingateToken && !stripeKey && process.env.NODE_ENV === "production") {
      throw new Error("To'lov tizimi vaqtincha mavjud emas, keyinroq urinib ko'ring.");
    }
    apiKeysMissing = true;
    paymentUrl = `${appUrlSetting}/api/payments/coingate-simulator?orderId=${orderId}&token=${secureToken}&amount=${realAmount.toFixed(2)}&title=${encodeURIComponent(startupRecord.name)}`;
  }

  return {
    orderId,
    paymentUrl,
    amount: realAmount,
    apiKeysMissing,
    gateway: usedGateway,
    discountPercent: chosenDiscountPercent,
    discountType
  };
}

// POST /api/payments/create — to'lov buyurtmasi yaratish
app.post("/api/payments/create", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { startupId, referralCode } = req.body;

  if (!startupId) {
    return res.status(400).json({ error: "Loyiha ID si ko'rsatilishi shart." });
  }

  try {
    const { orderId, paymentUrl, amount, apiKeysMissing, gateway, discountPercent, discountType } = await createPaymentOrder(req.user!.id, startupId, referralCode, "web");

    res.status(201).json({
      id: orderId,
      amount: amount,
      status: "pending",
      currency: "USDT",
      paymentUrl,
      api_keys_missing: apiKeysMissing,
      gateway,
      discountPercent: discountPercent || 0,
      discountType: discountType || null
    });
  } catch (err: any) {
    console.error("POST /api/payments/create error:", err);
    res.status(err.message.includes("tasdiqlang") ? 403 : 400).json({ error: err.message || "To'lov buyurtmasini yaratib bo'lmadi." });
  }
});

// Telegram-specific payment endpoint
app.post("/api/telegram/create-payment", async (req: Request, res: Response) => {
  // Ichki maxfiy kalitni tekshir (faqat bot chaqira olishi uchun)
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = await getSetting("TELEGRAM_BOT_INTERNAL_SECRET") || process.env.TELEGRAM_BOT_INTERNAL_SECRET;
  
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat berilmagan." });
  }

  const { telegramUserId, startupId } = req.body;
  if (!telegramUserId || !startupId) {
    return res.status(400).json({ error: "Majburiy maydonlar to'ldirilmagan." });
  }

  try {
    // telegramUserId orqali bog'langan foydalanuvchini top
    const user = await prisma.user.findFirst({ where: { telegramUserId: telegramUserId.toString() } });
    if (!user) {
      return res.status(404).json({
        error: "Hisobingiz Telegram bilan bog'lanmagan. Avval /bogla {kod} buyrug'ini ishlating."
      });
    }

    const { orderId, paymentUrl } = await createPaymentOrder(user.id, startupId, undefined, "telegram");

    // QR-kod yaratish
    const qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, { width: 400, margin: 2 });

    res.json({ paymentUrl, orderId, qrCode: qrCodeDataUrl });
  } catch (err: any) {
    console.error("POST /api/telegram/create-payment error:", err);
    res.status(400).json({ error: err.message || "To'lov yaratishda xatolik." });
  }
});

// Mock Interactive Payment gateway to test Webhook easily

app.get("/api/payments/my", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payments = await prisma.payment.findMany({
      where: {
        userId: req.user.id,
        status: "completed",
      },
      include: {
        startup: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return res.json({ payments });
  } catch (err) {
    console.error("GET /api/payments/my error:", err);
    return res.status(500).json({ error: "Xatolik yuz berdi" });
  }
});

app.get("/api/payments/coingate-simulator", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Forbidden: Mock gateway is only available in development mode." });
  }

  const { orderId, token, amount, title } = req.query;

  if (!orderId || !token) {
    return res.status(400).send("Buyurtma ID si yoki token yo'q.");
  }

  const safeOrderId = JSON.stringify(String(orderId));
  const safeToken = JSON.stringify(String(token));
  const safeAmount = JSON.stringify(String(amount || ""));

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Savdo24 CoinGate Simulator</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', sans-serif;
            background: #0d131a;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: #18202c;
            border-radius: 20px;
            padding: 36px;
            text-align: center;
            max-width: 440px;
            width: 100%;
            border: 1px solid #2d3848;
            box-shadow: 0 15px 40px rgba(0,0,0,0.6);
          }
          h2 { color: #10b981; margin-top: 0; font-size: 24px; font-weight: 800; }
          .logo { color: #10b981; font-size: 32px; font-weight: 900; margin-bottom: 20px; letter-spacing: -1px; }
          .order-id { font-size: 13px; color: #a0aec0; margin-bottom: 12px; font-family: monospace; }
          .amount { font-size: 36px; font-weight: 900; color: #ffffff; margin: 20px 0; }
          .currency { font-size: 18px; color: #10b981; }
          .info-text { font-size: 13px; color: #718096; line-height: 1.6; margin-bottom: 30px; }
          button {
            background: #10b981;
            color: #ffffff;
            border: none;
            padding: 14px 28px;
            font-weight: 700;
            font-size: 16px;
            border-radius: 12px;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(16,185,129,0.2);
          }
          button:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(16,185,129,0.3);
          }
          button:active {
            transform: translateY(0);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">CoinGate</div>
          <h2>To'lov Shlyuzi (Simulyator)</h2>
          <p class="order-id">Buyurtma ID: <strong>${escapeHtml(String(orderId))}</strong></p>
          <p style="color: #cbd5e0; font-size: 15px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(String(title || "Loyiha xaridi"))}</p>
          <div class="amount">${escapeHtml(String(amount || ""))} <span class="currency">USDT</span></div>
          <p class="info-text">Bu CoinGate to'lov tizimining integratsiyasini va webhook qayta qo'ng'iroqlarini tekshirish uchun maxsus simulyatordir.</p>
          <button onclick="pay()">To'lovni tasdiqlash</button>
        </div>
        <script>
          async function pay() {
            try {
              const params = new URLSearchParams();
              params.append('order_id', ${safeOrderId});
              params.append('status', 'paid');
              params.append('price_amount', ${safeAmount});
              params.append('price_currency', 'USD');
              params.append('id', 'CG-' + Math.floor(Math.random() * 1000000));

              const res = await fetch('/api/payments/webhook?token=' + encodeURIComponent(${safeToken}), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
              });

              if (res.ok) {
                alert("To'lov muvaffaqiyatli amalga oshirildi! CoinGate Webhook yuborildi.");
                window.close();
                document.body.innerHTML = \`
                  <div class="card">
                    <div class="logo">CoinGate</div>
                    <h2 style="color: #10b981;">✓ To'lov tasdiqlandi!</h2>
                    <p style="color: #cbd5e0;">Muvaffaqiyatli yakunlandi. Endi ushbu oynani yopishingiz mumkin.</p>
                  </div>
                \`;
              } else {
                const text = await res.text();
                alert("To'lov webhook xatosi: " + text);
              }
            } catch(err) {
              alert("Xatolik: " + err.message);
            }
          }
        </script>
      </body>
    </html>
  `);
});

// POST /api/payments/webhook — CoinGate webhook callback qabul qilish
async function finalizeCompletedPayment(payment: any): Promise<string> {
    let updatedStatus = "completed";

    if (payment.startupId) {
      const startup = await prisma.startup.findUnique({ where: { id: payment.startupId } });
      if (startup && startup.soldStatus === "sotildi") {
        updatedStatus = "refund_required";
        console.log(`Startup ${payment.startupId} is already sold. Setting payment ${payment.id} to 'refund_required'.`);
      }
    }

    const numAmount = Number(payment.amount);
    let platformFeeAmount = null;
    let sellerPayoutAmount = null;
    if (updatedStatus === "completed") {
      const { fee, payout } = splitAmount(numAmount, PLATFORM_FEE_PERCENT);
      platformFeeAmount = fee;
      sellerPayoutAmount = payout;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { 
        status: updatedStatus,
        platformFeeAmount,
        sellerPayoutAmount
      },
    });

    if (updatedStatus === "completed" && payment.referralId) {
      const referral = await prisma.referral.findUnique({
        where: { id: payment.referralId }
      });
      if (referral) {
        // Eslatma: refereeId shu yerda faqat "oxirgi referal qilingan
        // foydalanuvchi" sifatida ma'lumot uchun yoziladi — bitta doimiy
        // referral qatori ko'p marta ishlatilishi mumkinligi sabab, haqiqiy
        // referal soni endi getReferralCount() (ReferralReward asosida)
        // orqali hisoblanadi, bu maydon orqali emas.
        await prisma.referral.update({
          where: { id: referral.id },
          data: { refereeId: payment.userId || 0 }
        });
        
        const rewardAmount = roundToCents((numAmount * Number(referral.commissionPercent)) / 100);
        await prisma.referralReward.create({
          data: {
            referralId: referral.id,
            paymentId: payment.id,
            rewardAmount,
            status: "earned"
          }
        });
        
        await createNotification(
          referral.referrerId,
          "SYSTEM",
          "Referral mukofoti!",
          `Tabriklaymiz! Sizning referralingiz orqali xarid amalga oshirildi. Sizga $${rewardAmount.toFixed(2)} miqdorida mukofot hisoblandi.`,
          `/profile`
        );

        // 96-band: referralCount endi to'g'ri hisoblanadi (yuqoriga qarang),
        // lekin referral qatoridagi discountPercent/commissionPercent hali ham
        // faqat kod BIRINCHI marta yaratilganda (referralCount=0, Tier 1)
        // o'rnatilib, keyin hech qachon yangilanmasdi — ya'ni 6/21+ referaldan
        // keyin ham foydalanuvchi abadiy Tier 1 (5%) da qolib ketardi. Endi har
        // bir muvaffaqiyatli referaldan so'ng daraja qayta hisoblanadi va
        // o'zgargan bo'lsa (keyingi referallar uchun) yangilanadi.
        const newReferralCount = await getReferralCount(referral.referrerId);
        const newTier = getReferralTier(newReferralCount);
        if (newTier.discount !== Number(referral.discountPercent) || newTier.commission !== Number(referral.commissionPercent)) {
          await prisma.referral.update({
            where: { id: referral.id },
            data: { discountPercent: newTier.discount, commissionPercent: newTier.commission }
          }).catch((tierErr: any) => console.error("Referral tier update error:", tierErr));
        }
      }
    }

    if (updatedStatus === "completed" && payment.startupId && !payment.id.startsWith("TOP-") && !payment.id.startsWith("UPG-")) {
      // Create Escrow Payment
      await prisma.escrowPayment.upsert({
        where: { paymentId: payment.id },
        update: {},
        create: {
          paymentId: payment.id,
          status: "held",
          holdEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    }

    // FIX: TOP-/UPG- to'lovlarida ham startupId bor (boost/upgrade o'zi shu startap uchun),
    // lekin bu "startapni sotib oldim" emas — email faqat haqiqiy xariddan keyin yuborilishi kerak.
    if (updatedStatus === "completed" && !payment.id.startsWith("TOP-") && !payment.id.startsWith("UPG-")) {
      const buyer = await prisma.user.findUnique({ where: { id: payment.userId } });
      const startup = await prisma.startup.findUnique({ where: { id: payment.startupId }, include: { user: true } });
      
      if (buyer && startup) {
        // To Buyer
        await sendEmail(
          buyer.email,
          "Xarid muvaffaqiyatli yakunlandi",
          `<p>Tabriklaymiz! Siz <b>${escapeHtml(startup.name)}</b> loyihasini muvaffaqiyatli sotib oldingiz.</p><p>Loyiha fayllari va tafsilotlari tez orada sizga yetkaziladi.</p>`,
          true
        );
        // To Seller
        if (startup.user) {
          await sendEmail(
            startup.user.email,
            "Loyihangiz sotildi!",
            `<p>Tabriklaymiz! Sizning <b>${escapeHtml(startup.name)}</b> loyihangiz sotib olindi.</p><p>To'lov qabul qilindi. Tafsilotlar uchun dashboardni ko'ring.</p>`,
            true
          );
        }
      }
    }

    if (updatedStatus === "completed" && payment.startupId && !payment.id.startsWith("TOP-") && !payment.id.startsWith("UPG-")) {
      await prisma.telegramDelivery.create({
        data: {
          token: crypto.randomBytes(24).toString('hex'),
          paymentId: payment.id,
          startupId: payment.startupId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    }

    // If successful payment, dynamically update soldStatus on the specific startup (ikki marta sotilishning oldini olgan holda)
    if (updatedStatus === "completed" && payment.startupId && !payment.id.startsWith("TOP-") && !payment.id.startsWith("UPG-")) {
      const startup = await prisma.startup.findUnique({ where: { id: payment.startupId } });
      if (startup && startup.soldStatus !== "sotildi") {
        await prisma.startup.update({
          where: { id: payment.startupId },
          data: {
            soldStatus: "sotildi",
            proposalsCount: { increment: 1 },
          },
        });
        console.log(`Updated soldStatus for startup ${payment.startupId} to 'sotildi'`);

        // If from telegram, notify user via bot
        if (payment.source === "telegram" && payment.userId) {
          const buyer = await prisma.user.findUnique({ where: { id: payment.userId } });
          const startup = await prisma.startup.findUnique({ where: { id: payment.startupId } });
          if (buyer && buyer.telegramUserId && startup) {
            await sendTelegramMessage(
              buyer.telegramUserId, 
              `✅ To'lovingiz muvaffaqiyatli qabul qilindi! "${startup.name}" endi sizniki.`
            );
          }
        }
      }
    }

    // Listing Tier Upgrade logic
    if (updatedStatus === "completed" && payment.id.startsWith("UPG-")) {
      const subscription = await prisma.listingSubscription.findFirst({
        where: { paymentId: payment.id },
        include: { tier: true }
      });
      if (subscription && payment.startupId) {
        // MUHIM: eski expiresAt to'lov "pending" holatda yaratilgan paytda
        // hisoblangan edi — to'lov (ayniqsa CoinGate) tasdiqlanishi soatlab
        // cho'zilsa, sotib olingan muddat jimgina qisqarib qolardi. Endi
        // muddat aynan to'lov tasdiqlangan shu paytdan hisoblanadi.
        const realExpiresAt = new Date(Date.now() + subscription.tier.durationDays * 24 * 60 * 60 * 1000);
        await prisma.listingSubscription.update({
          where: { id: subscription.id },
          data: { expiresAt: realExpiresAt }
        });
        await prisma.startup.update({
          where: { id: payment.startupId },
          data: { 
            currentTier: subscription.tier.tier,
            isTop: subscription.tier.tier !== "standard",
            topExpiresAt: realExpiresAt
          }
        });
        console.log(`Upgraded startup ${payment.startupId} to ${subscription.tier.tier}`);
        
        await createNotification(
          payment.userId || 0,
          "SYSTEM",
          "Loyiha upgrade qilindi!",
          `Sizning loyihangiz muvaffaqiyatli ${subscription.tier.displayName} darajasiga ko'tarildi.`,
          `/startup/${payment.startupId}`
        );
      }
    }

    // TOP and VIP activations
    if (updatedStatus === "completed") {
      if (payment.id.startsWith("TOP-") && payment.startupId && payment.userId) {
        const days = parseInt(payment.id.split("-")[1]);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        await prisma.startup.update({
          where: { id: payment.startupId },
          data: {
            isTop: true,
            topExpiresAt: expiresAt
          }
        });
        
        await prisma.topBoost.create({
          data: {
            startupId: payment.startupId,
            userId: payment.userId,
            days,
            pricePaid: payment.amount,
            expiresAt
          }
        });
      } else if (payment.id.startsWith("VIP-") && payment.userId) {
        const days = parseInt(payment.id.split("-")[1]);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        await prisma.user.update({
          where: { id: payment.userId },
          data: {
            isVip: true,
            vipExpiresAt: expiresAt
          }
        });
        
        await prisma.vipSubscription.create({
          data: {
            userId: payment.userId,
            days,
            pricePaid: payment.amount,
            expiresAt
          }
        });
      }
    }

  return updatedStatus;
}

app.post("/api/payments/webhook", async (req: Request, res: Response) => {
  const token = req.query.token as string;
  const { order_id, status, price_amount, price_currency, id } = req.body;

  if (!order_id || !status) {
    return res.status(400).json({ error: "Missing required webhook parameters." });
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { id: order_id } });
    if (!payment) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    // Kelgan token query parametrini bazadagi saqlangan callbackToken bilan constant-time solishtir
    const savedToken = payment.callbackToken;
    if (!token || !savedToken || !safeCompare(token, savedToken)) {
      console.warn("Secure token verification failed for order_id:", order_id);
      return res.status(401).json({ error: "Unauthorized: Token mismatch or missing." });
    }

    // IDEMPOTENTLIK: to'lov tizimlari (CoinGate/Stripe) bir xil webhook'ni bir necha marta
    // qayta yuborishi mumkin (retry). Agar bu buyurtma allaqachon yakuniy holatga o'tgan
    // bo'lsa, butun jarayonni qayta ishlamasdan darhol muvaffaqiyatli javob qaytaramiz —
    // aks holda referral mukofoti, email/bildirishnomalar va TOP/VIP muddati har safar
    // qayta hisoblanib, foydalanuvchiga bir necha marta pul/bonus berilib ketishi mumkin edi.
    if (payment.status === "completed" || payment.status === "refund_required") {
      return res.json({ success: true, orderId: order_id, status: payment.status, idempotent: true });
    }

    // Token mos kelsa ham, CoinGate'ning GET Order endpointiga qo'shimcha so'rov yuborib qayta tekshir
    let verifiedStatus = status;
    let verifiedAmount = price_amount;

    const coingateToken = await getSetting("COINGATE_API_TOKEN");

    if (coingateToken && id) {
      try {
        const checkResponse = await fetch(`https://api.coingate.com/v2/orders/${id}`, {
          method: "GET",
          headers: {
            "Authorization": `Token ${coingateToken}`
          }
        });
        if (checkResponse.ok) {
          const checkData: any = await checkResponse.json();
          verifiedStatus = checkData.status;
          verifiedAmount = checkData.price_amount;
          console.log("Verified Order via CoinGate API GET check:", checkData);
        } else {
          console.error("CoinGate GET Order check failed with status:", checkResponse.status);
          return res.status(400).json({ error: "CoinGate API verification failed." });
        }
      } catch (apiErr: any) {
        console.error("Failed to connect to CoinGate GET Order API:", apiErr.message);
        return res.status(500).json({ error: "CoinGate API connection failed." });
      }
    }

    if (!coingateToken || !id) {
      logger.warn({ order_id }, "Webhook COINGATE_API_TOKEN yoki id yo'qligi sababli mustaqil tasdiqlanmadi — faqat callback token bilan cheklanmoqda.");
    }

    // CoinGate statuses: paid or completed mean successful payment
    const isCompleted = verifiedStatus === "paid" || verifiedStatus === "completed";

    if (!isCompleted) {
      const localStatus = (verifiedStatus === "expired" || verifiedStatus === "canceled" || verifiedStatus === "invalid") ? "failed" : "pending";
      await prisma.payment.update({
        where: { id: order_id },
        data: { status: localStatus }
      });
      return res.json({ success: true, orderId: order_id, status: localStatus });
    }

    // Qayta tekshirilgan summa to'g'ri kelishini solishtir
    if (Math.abs(parseFloat(verifiedAmount) - payment.amount) > 0.01) {
      console.warn(`Payment amount mismatch. Expected: ${payment.amount}, Got: ${verifiedAmount}`);
      return res.status(400).json({ error: "Payment amount mismatch." });
    }

    const updatedStatus = await finalizeCompletedPayment(payment);

    res.json({ success: true, orderId: order_id, status: updatedStatus });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

// 116-bosqich: telegram-integratsiya route'lari
// src/routes/telegram-integration.ts'ga ko'chirildi.
import telegramIntegrationRouter from "./src/routes/telegram-integration";
app.use("/api/telegram", telegramIntegrationRouter);


// 117-bosqich: conversations/messaging route'lari
// src/routes/conversations.ts'ga ko'chirildi.
import conversationsRouter from "./src/routes/conversations";
app.use("/api/conversations", conversationsRouter);

// GET /api/payments/status/:id — to'lov holatini tekshirish
app.get("/api/payments/status/:id", authenticateToken, paymentStatusLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { startup: true }
    });
    if (!payment) {
      return res.status(404).json({ error: "To'lov topilmadi." });
    }

    // Ownership check
    if (payment.userId !== req.user?.id && req.user?.role !== "Admin") {
      return res.status(403).json({ error: "Ruxsat etilmagan. Faqat o'z to'lovlaringizni ko'rishingiz mumkin." });
    }
    
    if (payment.status === "completed" && payment.startup) {
      const delivery = await prisma.telegramDelivery.findFirst({ where: { paymentId: id } });
      return res.json({
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        deliveryUrl: payment.startup.deliveryUrl || "",
        sellerContact: payment.startup.contactTelegram || payment.startup.contactEmail || payment.startup.contactPhone || "Sotuvchi aloqa ma'lumoti kiritilmagan",
        repoUrl: payment.startup.deliveryUrl || "",
        telegramToken: delivery?.token
      });
    }
    
    res.json({ id: payment.id, status: payment.status, amount: payment.amount });
  } catch (err: any) {
    console.error("Get payment status error:", err);
    res.status(500).json({ error: "To'lov holatini olishda xatolik yuz berdi." });
  }
});

// 113-bosqich: reviews route'lari src/routes/reviews.ts'ga ko'chirildi.
import reviewsRouter from "./src/routes/reviews";
app.use("/api", reviewsRouter);

// 112-bosqich: disputes route'lari src/routes/disputes.ts'ga ko'chirildi.
import disputesRouter from "./src/routes/disputes";
app.use("/api/disputes", disputesRouter);

// 120-bosqich: audit-logs+stats route'lari src/routes/admin-audit.ts'ga ko'chirildi.
import adminAuditRouter from "./src/routes/admin-audit";
app.use("/api/admin", adminAuditRouter);


// DELETE /api/admin/startups/:id — E'lonni o'chirish (Admin)
// 121-bosqich: admin startup/idea delete route'lari src/routes/admin-delete.ts'ga
// ko'chirildi (sponsor-channels.ts naqshi bilan bir xil).
import adminDeleteRouter from "./src/routes/admin-delete";
app.use("/api/admin", adminDeleteRouter);

// 119-bosqich: admin/settings route'lari src/routes/admin-settings.ts'ga
// ko'chirildi.
import adminSettingsRouter from "./src/routes/admin-settings";
app.use("/api/admin/settings", adminSettingsRouter);

// 110-bosqich: sponsor-channels routes src/routes/sponsor-channels.ts'ga
// ko'chirildi (auth.ts/support.ts naqshi bilan bir xil).
import sponsorChannelsRouter from "./src/routes/sponsor-channels";
app.use("/api/admin/sponsor-channels", sponsorChannelsRouter);

async function seedSettings() {
  const defaults = [
    { key: "TOP_BASE_PRICE_PER_DAY", value: "1" },
    { key: "TOP_MAX_CONCURRENT_SLOTS", value: "20" },
    { key: "VIP_PRICE_PER_DAY", value: "0.5" },
    { key: "VIP_DISCOUNT_PERCENT", value: "40" },
    { key: "TELEGRAM_STORAGE_CHANNEL_ID", value: "" },
    { key: "TELEGRAM_ADMIN_CHAT_ID", value: "" },
    { key: "TELEGRAM_BOT_INTERNAL_SECRET", value: "" }
  ];

  for (const s of defaults) {
    try {
      const exists = await prisma.setting.findUnique({ where: { key: s.key } });
      if (!exists) {
        await prisma.setting.create({
          data: {
            key: s.key,
            value: encryptSecret(s.value)
          }
        });
        console.log(`Seeded setting: ${s.key}`);
      }
    } catch (err) {
      console.error(`Error seeding ${s.key}:`, err);
    }
  }
}

// Initialize Express + Vite Setup
async function start() {
  console.log(isPostgres ? "✅ PostgreSQL bazasiga ulanildi (production)" : "⚠️  SQLite (dev.db) ishlatilyapti — bu faqat lokal rivojlantirish uchun!");
  
  if (isPostgres) {
    try {
      console.log("DATABASE_URL found. Deploying PostgreSQL migrations...");
      execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", { stdio: "inherit" });
      console.log("PostgreSQL migrations deployed successfully.");
    } catch (migrateErr) {
      console.error("PostgreSQL migration deployment failed on startup:", migrateErr);
    }
    try {
      console.log("DATABASE_URL found. Syncing PostgreSQL schema with db push...");
      execSync("npx prisma db push --schema=prisma/schema.prisma --accept-data-loss", { stdio: "inherit" });
      console.log("PostgreSQL schema synced successfully.");
    } catch (pushErr) {
      console.error("PostgreSQL db push failed on startup:", pushErr);
    }
  } else {
    try {
      console.log("Using SQLite. Syncing database schema...");
      execSync("npx prisma db push --schema=prisma/schema.sqlite.prisma --accept-data-loss", { stdio: "inherit" });
      console.log("SQLite database synced successfully.");
    } catch (pushErr) {
      console.error("SQLite database sync failed on startup:", pushErr);
    }
  }

  // Auto-restore if database is empty with critical error handling
  async function checkAndAutoRestore() {
    try {
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        console.warn("⚠️ Database is empty - attempting auto-restore from backup...");
        
        const lastBackupFileId = await getSetting("last_backup_file_id");
        const fallbackPath = path.join(process.cwd(), 'last_backup.json');
        const hasFallback = fs.existsSync(fallbackPath);
        // 69-MUAMMO: bu yerda faqat Telegram manbalari (last_backup_file_id/
        // last_backup.json) tekshirilardi — faqat Contabo S3 sozlangan
        // loyihalarda (Telegram sozlanmagan) bu ikkalasi ham hech qachon
        // yozilmaydi, shu sabab haqiqiy zaxira mavjud bo'lsa ham "toza
        // o'rnatish" deb xato xulosaga kelinardi. Endi S3 sozlamalari ham
        // tekshiriladi.
        const hasS3Config = !!(await getSetting("CONTABO_S3_ENDPOINT")) && !!(await getSetting("CONTABO_BUCKET_NAME"));

        if (!lastBackupFileId && !hasFallback && !hasS3Config) {
          console.log("ℹ️ No previous backup file ID found in settings or fallback. This is a clean installation. Proceeding with clean database.");
          return;
        }

        try {
          const { restoreFromLatestBackup } = await import("./scripts/restore-db");
          await restoreFromLatestBackup();
          
          // Verify restore
          const verifyCount = await prisma.user.count();
          if (verifyCount === 0) {
            throw new Error("Restore completed but database is still empty");
          }
          console.log("✅ Database restored successfully from backup!");
        } catch (restoreErr: any) {
          const errorMsg = `🔴 CRITICAL: Database restore FAILED\n${restoreErr?.message || String(restoreErr)}`;
          console.error(errorMsg);
          
          try {
            await notifyAdminTelegram(errorMsg);
          } catch (notifyErr) {
            console.error("Also failed to notify admin:", notifyErr);
          }
          
          console.error("❌ Server warning: empty/broken database restore attempted with errors.");
        }
      }
    } catch (checkErr: any) {
      console.error("⚠️ Database check warning:", checkErr);
    }
  }

  await checkAndAutoRestore();

  await seedSettings();

  await seedDatabase();

// --- NOTIFICATIONS ---
app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" }
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Bildirishnomalarni yuklashda xatolik." });
  }
});

app.patch("/api/notifications/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    if (isNaN(notifId)) return res.status(400).json({ error: "Yaroqsiz bildirishnoma ID." });

    await prisma.notification.update({
      where: { id: notifId, userId: req.user!.id },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

app.patch("/api/notifications/read-all", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// --- CATEGORIES (ADMIN) ---
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json(categories.map((c: any) => ({ ...c, fields: JSON.parse(c.fields || "[]") })));
  } catch (err) {
    res.status(500).json({ error: "Kategoriyalarni yuklashda xatolik." });
  }
});

app.post("/api/admin/categories", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, name, icon, fields } = req.body;
    const category = await prisma.category.create({
      data: { id, name, icon, fields: JSON.stringify(fields || []) }
    });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "Kategoriya yaratishda xatolik." });
  }
});

app.patch("/api/admin/categories/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, icon, fields } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, icon, fields: JSON.stringify(fields || []) }
    });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "Kategoriyani tahrirlashda xatolik." });
  }
});

app.delete("/api/admin/categories/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    // Check if category is used by any startups
    const startupCount = await prisma.startup.count({
      where: { category: id }
    });

    if (startupCount > 0) {
      return res.status(400).json({ 
        error: `Bu kategoriyada ${startupCount} ta e'lon mavjud. Avval ularni boshqa kategoriyaga ko'chiring yoki o'chiring.` 
      });
    }

    await prisma.category.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/categories/:id error:", err);
    res.status(500).json({ error: "Kategoriyani o'chirishda xatolik." });
  }
});

// --- SECURITY SETTINGS ---
app.get("/api/auth/sessions", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // XAVFSIZLIK: avval butun qator (shu jumladan haqiqiy `token` qiymati —
    // amal qiluvchi refresh token, bazada oddiy matn holida saqlanadi)
    // to'g'ridan-to'g'ri javobga qaytarilardi — bu seans o'g'irlash uchun
    // ishlatsa bo'ladigan maxfiy tokenni frontendga (va Network panyeliga)
    // oshkor qilardi. Endi faqat xavfsiz metama'lumotlar tanlanadi.
    const sessions = await prisma.refreshToken.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, userAgent: true, ip: true, expiresAt: true, createdAt: true }
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Sessiyalarni yuklashda xatolik." });
  }
});

app.delete("/api/auth/sessions/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) return res.status(400).json({ error: "Yaroqsiz sessiya ID." });

    await prisma.refreshToken.delete({
      where: { id: sessionId, userId: req.user!.id }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Sessiyani o'chirishda xatolik." });
  }
});

app.delete("/api/auth/sessions", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user!.id }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Barcha sessiyalardan chiqishda xatolik." });
  }
});

// Dinamik sitemap.xml generatsiya qiluvchi endpoint
app.get("/sitemap.xml", async (req: Request, res: Response) => {
  try {
    const startups = await prisma.startup.findMany({
      where: { status: "active" },
      select: { id: true, updatedAt: true }
    });

    const appUrl = await getSetting("APP_URL") || "https://savdo24.online";
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${appUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${appUrl}/ideas-rating</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`;

    for (const startup of startups) {
      const lastMod = startup.updatedAt ? new Date(startup.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      xml += `
  <url>
    <loc>${appUrl}/startup/${startup.id}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }

    xml += `
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error("Sitemap generation error:", err);
    res.status(500).end();
  }
});

// Dynamic SEO for Startup Pages
app.get("/startup/:id", createBotMetaHandler(prisma, getSetting));

  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 12-MUAMMO: Global API xatolarini Telegram orqali adminga yuborish
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error({ err }, "Kutilmagan server xatosi");
    notifyAdminTelegram(`🔴 <b>API XATOSI</b>\n\n<b>Yo'l:</b> ${req.method} ${req.originalUrl}\n<b>Xato:</b> <code>${(err?.stack || String(err)).slice(0, 3000)}</code>`);
    res.status(500).json({ error: "Kutilmagan xatolik yuz berdi. Iltimos qaytadan urinib ko'ring." });
  });

  if (process.env.NODE_ENV !== "test" && !process.argv.includes("--test")) {
    httpServer.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      // Darhol bir marta tekshirib qo'yamiz
      expireTopBoosts();
    });
  } else {
    logger.info("Test mode: Skipping httpServer.listen to avoid EADDRINUSE.");
  }

  // Scheduled Tasks (Internal Cron)
  // Har soatda muddati o'tgan Top boostlarni o'chirish
  cron.schedule("0 * * * *", () => {
    logger.info("[CRON] Running expireTopBoosts...");
    expireTopBoosts();
  });

  // Har kuni soat 03:00 da escrow to'lovlarini tekshirish
  cron.schedule("0 3 * * *", () => {
    logger.info("[CRON] Running autoReleaseEscrows...");
    autoReleaseEscrows();
  });

  // Har kuni soat 08:00 da kechiktirilgan refundlarni tekshirish
  cron.schedule("0 8 * * *", () => {
    logger.info("[CRON] Running checkPendingRefunds...");
    checkPendingRefunds();
  });

  // Har haftalik newsletter yuborish (Dushanba kuni 09:00)
  cron.schedule("0 9 * * 1", () => {
    logger.info("[CRON] Running sendWeeklyNewsletter...");
    sendWeeklyNewsletter();
  });

  // Har soatda Telegram fayl keshini tozalash
  cron.schedule("0 * * * *", () => {
    logger.info("[CRON] Cleaning fileUrlCache...");
    const now = Date.now();
    for (const [key, value] of fileUrlCache.entries()) {
      if (value.expiresAt < now) {
        fileUrlCache.delete(key);
      }
    }
    if (fileUrlCache.size > 5000) {
      const keysToDelete = Array.from(fileUrlCache.keys()).slice(0, fileUrlCache.size - 5000);
      keysToDelete.forEach(key => fileUrlCache.delete(key));
    }
  });

  // Har kuni soat 04:00 da tunda ma'lumotlar bazasini zaxiralash
  cron.schedule("0 4 * * *", async () => {
    logger.info("[CRON] Running daily database backup...");
    try {
      const { runBackup } = await import("./scripts/backup-db");
      await runBackup();
      logger.info("[CRON] Daily backup completed successfully.");
    } catch (err) {
      logger.error({ err }, "[CRON] Daily backup failed");
    }
  });

  // 70-MUAMMO: export-to-github.ts o'zini "Weekly Data Export" deb atardi va
  // BACKUP_GITHUB_* sozlamalari mavjud bo'lsa ham, uni hech qanday cron
  // chaqirmasdi — faqat "npm run export-github" orqali qo'lda ishga
  // tushirilardi. Haftalik statistik zaxira hech qachon avtomatik
  // yuborilmasdi. Endi har yakshanba soat 02:00 da avtomatik ishga tushadi.
  cron.schedule("0 2 * * 0", async () => {
    logger.info("[CRON] Running weekly GitHub stats export...");
    try {
      const { exportToGithub } = await import("./scripts/export-to-github");
      await exportToGithub();
      logger.info("[CRON] Weekly GitHub export completed.");
    } catch (err) {
      logger.error({ err }, "[CRON] Weekly GitHub export failed");
    }
  });
}

start();

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, closing server...");
  process.exit(0);
});
process.on("SIGINT", () => {
  logger.info("SIGINT received, closing server...");
  process.exit(0);
});
