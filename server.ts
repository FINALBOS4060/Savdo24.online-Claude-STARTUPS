// ESLATMA: Bu avtomatik Telegram-tiklash tizimi faqat ZAXIRA
// himoya vositasi. Asosiy himoya — PostgreSQL bazasini ilova
// serveridan alohida, doimiy saqlanadigan joyda ushlab turish.
// Batafsil: README.md dagi "Ma'lumotlar xavfsizligi" bo'limiga qarang.

// dotenv/config MUST be the very first import: ES module imports are
// evaluated in declaration order (depth-first), so any local module below
// that reads `process.env.*` at its own top level (e.g. src/lib/context.ts's
// `isPostgres`) needs .env already loaded before it runs. Previously
// `dotenv.config()` was called *after* `./src/lib/context` was imported,
// which meant .env values were not yet visible to that module's top-level
// code (masked in production only because PM2/Render inject env vars
// directly, without relying on a .env file).
import "dotenv/config";

import express, { Request, Response, NextFunction } from "express";
import { JwtPayload } from "./src/types";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import rateLimit from "express-rate-limit";
import { execSync, spawn } from "child_process";
import helmet from "helmet";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
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
import nodemailer from "nodemailer";
import Stripe from "stripe";
import cron from "node-cron";
import { logger } from "./src/lib/logger";
import {
  prisma,
  isPostgres,
  JWT_SECRET,
  getSecret,
  getSetting,
  authenticateToken,
  requireAdmin,
  generateRefreshToken,
  notifyAdminTelegram,
  getTransporter,
  sendEmail,
  getStripe,
  formatStartup,
  createNotification,
  trackEvent,
  getReferralCount,
  setSocketIoInstance,
  sendTelegramMessage
} from "./src/lib/context";
export {
  prisma,
  isPostgres,
  JWT_SECRET,
  getSecret,
  getSetting,
  authenticateToken,
  requireAdmin,
  generateRefreshToken,
  notifyAdminTelegram,
  getTransporter,
  sendEmail,
  getStripe,
  formatStartup,
  createNotification,
  trackEvent,
  getReferralCount
};
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
import { CATEGORY_FIELDS } from "./src/categoryFields";
import { createBotMetaHandler } from "./src/lib/botMetaHandler";
import { encryptSecret, decryptSecret } from "./src/lib/crypto";
import { OAuth2Client } from "google-auth-library";

// 122-bosqich: escapeHtml/getReferralTier/safeCompare src/lib/pure-helpers.ts'ga
// ko'chirildi (sof funksiyalar, DB'ga bog'liq emas — avtomatik test yozish
// uchun). Bu yerda faqat qayta eksport qilinadi, boshqa fayllardagi
// `from "../../server"` importlari o'zgarishsiz ishlayveradi.
import { escapeHtml, getReferralTier, safeCompare, PUBLIC_USER_SELECT, getErrorMessage } from "./src/lib/pure-helpers";
export { escapeHtml, getReferralTier, safeCompare, PUBLIC_USER_SELECT };

// Route routers. These used to be `import`ed one by one, scattered right
// before each `app.use(...)` call further down the file (originally to
// "prevent circular dependencies" — but none of these routers import
// anything from server.ts itself, they all get shared instances from
// ./src/lib/context, so that risk doesn't actually apply here). Consolidated
// to one place so the full set of mounted routers is visible at a glance;
// the corresponding `app.use(...)` calls stay where they were, since mount
// order still matters for middleware.
import authRouter, { setAuthCookies } from "./src/routes/auth";
import supportRouter from "./src/routes/support";
import escrowRouter from "./src/routes/escrow";
import b2bRouter, { adminB2bRouter } from "./src/routes/b2b";
import referralsRouter, { adminReferralsRouter } from "./src/routes/referrals";
import adminUsersRouter from "./src/routes/admin-users";
import adminBackupRouter from "./src/routes/admin-backup";
import adminRebuildRouter from "./src/routes/admin-rebuild";
import startupsRouter from "./src/routes/startups";
import topBoostVipRouter from "./src/routes/top-boost-vip";
import { finalizeCompletedPayment } from "./src/lib/payments";
import paymentsRouter from "./src/routes/payments";
import telegramIntegrationRouter from "./src/routes/telegram-integration";
import conversationsRouter from "./src/routes/conversations";
import reviewsRouter from "./src/routes/reviews";
import disputesRouter from "./src/routes/disputes";
import adminAuditRouter from "./src/routes/admin-audit";
import adminDeleteRouter from "./src/routes/admin-delete";
import adminSettingsRouter from "./src/routes/admin-settings";
import sponsorChannelsRouter from "./src/routes/sponsor-channels";
import exchangeChannelsRouter, { exchangeAdminRouter, exchangeSiteRouter } from "./src/routes/exchange-channels";

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
setSocketIoInstance(io);

async function getDynamicGoogleClientId(): Promise<string | null> {
  const dbId = await getSetting("GOOGLE_CLIENT_ID");
  if (dbId) return dbId;
  return process.env.GOOGLE_CLIENT_ID || null;
}

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

// 2-so'rov: "VIP/TOP muddati tugashi haqida eslatma". Ikkita holatni
// tekshiradi: (a) 1-2 kun ichida tugaydiganlar — oldindan eslatma +
// "Yangilash" tugmasi bilan; (b) allaqachon tugaganlar — qayta faollashtirish
// taklifi. Har ikkisi ham *Notified maydonlari orqali faqat BIR MARTA
// yuboriladi (soatlik cron shu funksiyani chaqirsa ham spam bo'lmaydi).
async function notifyExpiringVipAndTop() {
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 kun ichida
  const appUrl = process.env.APP_URL || "https://savdo24.online";
  const renewButton = (path: string, label: string) => ({
    inline_keyboard: [[{ text: label, url: `${appUrl}${path}` }]]
  });

  try {
    // --- VIP: tugashiga 1-2 kun qolganlar ---
    const vipExpiringSoon = await prisma.user.findMany({
      where: {
        isVip: true,
        telegramUserId: { not: null },
        vipExpiresAt: { gt: now, lte: soon },
        vipExpiryNotifiedAt: null
      },
      select: { id: true, name: true, telegramUserId: true, vipExpiresAt: true }
    });
    for (const u of vipExpiringSoon) {
      const daysLeft = Math.max(1, Math.ceil((u.vipExpiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      const sent = await sendTelegramMessage(
        u.telegramUserId!,
        `⏳ <b>VIP obunangiz tugashiga ${daysLeft} kun qoldi!</b>\n\n` +
        `Salom, ${u.name}! VIP imtiyozlaringiz (katta fayl yuklash, maxsus belgi va h.k.) tez orada tugaydi.\n\n` +
        `Uzilishlarsiz davom ettirish uchun hozir yangilang 👇`,
        { replyMarkup: renewButton("/profile?tab=vip", "⭐ VIP'ni yangilash") }
      );
      if (sent) {
        await prisma.user.update({ where: { id: u.id }, data: { vipExpiryNotifiedAt: now } }).catch(() => {});
      }
    }

    // --- VIP: allaqachon tugagan (va hali reaktivatsiya taklifi yuborilmagan) ---
    const vipExpired = await prisma.user.findMany({
      where: {
        isVip: true,
        telegramUserId: { not: null },
        vipExpiresAt: { lte: now },
        vipExpiredNotifiedAt: null
      },
      select: { id: true, name: true, telegramUserId: true }
    });
    for (const u of vipExpired) {
      const sent = await sendTelegramMessage(
        u.telegramUserId!,
        `😔 <b>VIP obunangiz tugadi</b>\n\n` +
        `Salom, ${u.name}! VIP muddatingiz tugagani sababli maxsus imtiyozlar vaqtincha o'chirildi.\n\n` +
        `Istagan payt qayta faollashtirishingiz mumkin 👇`,
        { replyMarkup: renewButton("/profile?tab=vip", "⭐ Qayta faollashtirish") }
      );
      if (sent) {
        await prisma.user.update({ where: { id: u.id }, data: { vipExpiredNotifiedAt: now, isVip: false } }).catch(() => {});
      }
    }

    // --- TOP: tugashiga 1-2 kun qolgan e'lonlar (sotuvchiga xabar) ---
    const topExpiringSoon = await prisma.startup.findMany({
      where: {
        isTop: true,
        topExpiresAt: { gt: now, lte: soon },
        topExpiryNotifiedAt: null,
        userId: { not: null }
      },
      select: { id: true, name: true, topExpiresAt: true, user: { select: { telegramUserId: true } } }
    });
    for (const s of topExpiringSoon) {
      if (!s.user?.telegramUserId) continue;
      const daysLeft = Math.max(1, Math.ceil((s.topExpiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      const sent = await sendTelegramMessage(
        s.user.telegramUserId,
        `⏳ <b>"${escapeHtml(s.name)}" e'loningizning TOP muddati ${daysLeft} kundan keyin tugaydi</b>\n\n` +
        `TOP holatida qolish uchun (yuqori ko'rinuvchanlik, ko'proq xaridor) hozir uzaytiring 👇`,
        { replyMarkup: renewButton("/profile?tab=startups", "🔥 TOP'ni uzaytirish") }
      );
      if (sent) {
        await prisma.startup.update({ where: { id: s.id }, data: { topExpiryNotifiedAt: now } }).catch(() => {});
      }
    }

    // --- TOP: allaqachon tugagan e'lonlar (qayta faollashtirish taklifi) ---
    // ESLATMA: isTop ni o'zi soatlik expireTopBoosts() cron'i tomonidan false
    // qilinadi — bu yerda faqat topExpiresAt allaqachon o'tgan va hali xabar
    // yuborilmagan (isTop true yoki endigina false bo'lgan) yozuvlar qidiriladi.
    const topExpired = await prisma.startup.findMany({
      where: {
        topExpiresAt: { lte: now, not: null },
        topExpiredNotifiedAt: null,
        userId: { not: null }
      },
      select: { id: true, name: true, user: { select: { telegramUserId: true } } }
    });
    for (const s of topExpired) {
      if (!s.user?.telegramUserId) continue;
      const sent = await sendTelegramMessage(
        s.user.telegramUserId,
        `😔 <b>"${escapeHtml(s.name)}" e'loningizning TOP muddati tugadi</b>\n\n` +
        `E'loningiz endi oddiy ro'yxatda ko'rsatiladi. Ko'rinuvchanlikni oshirish uchun qayta TOP qilishingiz mumkin 👇`,
        { replyMarkup: renewButton("/profile?tab=startups", "🔥 Qayta TOP qilish") }
      );
      if (sent) {
        await prisma.startup.update({ where: { id: s.id }, data: { topExpiredNotifiedAt: now } }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, "notifyExpiringVipAndTop error");
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
  } catch (err: unknown) {
    const errMsg = getErrorMessage(err);
    logger.error({ errMsg }, "Stripe webhook signature tekshiruvi muvaffaqiyatsiz:");
    return res.status(400).json({ error: `Webhook signature error: ${errMsg}` });
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
  } catch (err: unknown) {
    logger.error({ err: err }, "Stripe webhook processing error");
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

// Skaner/bot himoyasi: haqiqiy ilovada mavjud bo'lmagan, lekin hujumchilar
// tez-tez sinab ko'radigan yo'llarga (masalan /query, /graphql, /.env,
// /wp-admin) kelgan so'rovlarni CORS bosqichigacha yetib bormasdan darhol
// rad etamiz va shubhali IP'ni cheklab qo'yamiz. Bu haqiqiy foydalanuvchilarga
// ta'sir qilmaydi, chunki bizning ilovamiz faqat /api/... yo'llaridan
// foydalanadi.
const SUSPICIOUS_PATHS = [
  "/query", "/graphql", "/.env", "/wp-admin", "/wp-login.php",
  "/phpmyadmin", "/.git/config", "/xmlrpc.php", "/actuator", "/console"
];

const scannerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 daqiqa
  max: 5, // shu oynada shubhali yo'llarga 5 tadan ortiq so'rov yuborsa
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const isSuspicious = SUSPICIOUS_PATHS.some(
    (p) => req.path === p || req.path.startsWith(p + "/")
  );
  if (isSuspicious) {
    logger.warn(`[Scanner Blocked] ${req.method} ${req.path} from IP ${req.ip}`);
    return scannerLimiter(req, res, () => {
      // Route umuman mavjud emas — CORS xatosi o'rniga to'g'ridan-to'g'ri 404
      res.status(404).json({ error: "Not found" });
    });
  }
  next();
});

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
      logger.warn(`[CORS Blocked] Origin not allowed: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'X-Redirect-Origin']
}));

// Yuklangan fayllar (rasmlar) serverning o'z diskida saqlanadi — bu papka
// `dist`dan tashqarida bo'lgani uchun qayta build/deploy qilinganda o'chib
// ketmaydi.
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

// TUZATISH: bu ikki cron endpoint ilgari yuqorida, cookieParser()/helmet()/cors()
// o'rnatilishidan OLDIN ro'yxatdan o'tkazilgan edi. authenticateToken avval
// req.cookies.token'ni tekshiradi — lekin cookieParser() hali ishlamagani sabab
// req.cookies doim undefined bo'lib, admin panelidagi (browser, httpOnly cookie
// orqali) sessiya bilan bu ikki endpoint'ga kirish imkonsiz edi (faqat qo'lda
// Authorization: Bearer sarlavhasi bilan chaqirilganda ishlardi — ilovadagi
// authenticateToken bilan himoyalangan boshqa BARCHA marshrutlardan farqli
// o'laroq). Endi middleware to'liq o'rnatilgandan keyin ro'yxatdan o'tkaziladi.

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

// Automatic Database Seeding
async function seedDatabase() {
  try {
    const categoryCount = await prisma.category.count();

    // One-time migration for listingType
    const countToUpdate = await prisma.startup.count({ where: { listingType: "Butunlay sotiladi" } });
    if (countToUpdate > 0) {
      logger.info({ countToUpdate }, "Migrating startups with old listingType");
      await prisma.startup.updateMany({
        where: { listingType: "Butunlay sotiladi" },
        data: { listingType: "To'liq loyiha (manba kodi bilan)" }
      });
    }

    if (categoryCount === 0) {
      logger.info("Seeding categories...");
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
    logger.error({ err: err }, "Failed to automatically seed database");
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
    logger.error({ err: err }, "Newsletter error");
    return res.status(500).json({ error: "Xatolik yuz berdi. Iltimos qayta urinib ko'ring." });
  }
});

app.use("/api/auth", authRouter);
app.use("/api", supportRouter);

app.get("/api/auth/google-client-id", async (req: Request, res: Response) => {
  try {
    const clientId = await getDynamicGoogleClientId();
    res.json({ clientId });
  } catch (err) {
    res.status(500).json({ error: "Google client ID yuklashda xatolik." });
  }
});

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
          joinDate: new Date(),
          avatarUrl: payload.picture || `/default-avatar.svg`,
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

    // 9-MUAMMO: Google orqali kirishda refreshToken xavfsiz saqlash uchun setAuthCookies chaqirildi, refreshToken javob body-sidan olib tashlandi.
    // Endi auth.ts dagi bitta umumiy setAuthCookies() funksiyasi ishlatiladi (ilgari bu yerda
    // ajratilgan nusxasi bor edi va sameSite qiymati dev muhitida "lax", auth.ts'da esa doim
    // "strict" edi — ikkita kirish usuli orasida nomuvofiqlikka olib kelardi).
    setAuthCookies(res, accessToken, refreshToken);

    res.json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    logger.error({ err: err }, "Google auth error");
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
    logger.error({ err: err }, "Update profile error");
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
    logger.error({ err: err }, "Generate telegram link code error");
    res.status(500).json({ error: "Kod generatsiya qilishda xatolik yuz berdi." });
  }
});

// PATCH /api/users/me/telegram-notifications — Telegram bildirishnoma sozlamalari
// (1-so'rov: "Bildirishnomalarni boshqarish (opt-out)"). Faqat reklama/broadcast
// xabarlaridan chiqishga ruxsat beradi — xarid/nizo kabi muhim xabarlar bunga
// bog'liq emas va har doim yuboriladi (notifyUserTelegram orqali, bu maydonni tekshirmaydi).
app.patch("/api/users/me/telegram-notifications", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { telegramBroadcastOptOut } = req.body;
    if (typeof telegramBroadcastOptOut !== "boolean") {
      return res.status(400).json({ error: "telegramBroadcastOptOut boolean bo'lishi kerak." });
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { telegramBroadcastOptOut },
      select: { id: true, telegramBroadcastOptOut: true }
    });
    res.json(updatedUser);
  } catch (err) {
    logger.error({ err: err }, "Update telegram notification settings error");
    res.status(500).json({ error: "Sozlamalarni saqlashda xatolik yuz berdi." });
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
  } catch (err: unknown) {
    logger.error({ err: err }, "Get earnings error");
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
  } catch (err: unknown) {
    logger.error({ err: err }, "Get reviews given error");
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
  } catch (err: unknown) {
    logger.error({ err: err }, "Get reviews received error");
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
app.use("/api", escrowRouter);

// --- B2B WHOLESALE (111-bosqich: src/routes/b2b.ts'ga ko'chirildi) ---
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
        where: { joinDate: { gte: last24h } } 
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
    logger.error({ err: err }, "Social proof error");
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
app.use("/api/referrals", referralsRouter);
app.use("/api/admin/referrals", adminReferralsRouter);

app.get("/api/admin/analytics", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || "day";
    const days = period === "day" ? 1 : period === "week" ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // TUZATISH: avval bu yerda `prisma.payment.groupBy({ by: ["createdAt"] })`
    // ishlatilardi — lekin createdAt millisekund aniqligidagi DateTime bo'lgani
    // uchun bu deyarli hech qachon ikkita to'lovni bir guruhga birlashtirmaydi
    // (har bir to'lov o'zining aniq vaqt belgisiga ega). Natijada "Daromad
    // Grafigi" kunlik tendensiya o'rniga deyarli har bir to'lov uchun alohida
    // nuqta chizardi — ayniqsa "Oylik" ko'rinishda foydasiz va tushunarsiz
    // grafik hosil qilardi. Endi to'lovlar JS tarafida kun (YYYY-MM-DD)
    // bo'yicha guruhlanadi.
    const revenuePayments = await prisma.payment.findMany({
      where: { status: "completed", createdAt: { gte: startDate } },
      select: { createdAt: true, platformFeeAmount: true },
      orderBy: { createdAt: "asc" }
    });
    const dailyRevenueMap = new Map<string, number>();
    for (const p of revenuePayments) {
      const dayKey = p.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      dailyRevenueMap.set(dayKey, (dailyRevenueMap.get(dayKey) || 0) + Number(p.platformFeeAmount || 0));
    }
    const dailyRevenue = Array.from(dailyRevenueMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));

    const stats = {
      totalListings: await prisma.startup.count(),
      activeUsers: await prisma.user.count({ where: { isBanned: false } }),
      newUsers: await prisma.user.count({ where: { joinDate: { gte: startDate } } }),
      totalSales: await prisma.payment.count({ 
        where: { status: "completed", createdAt: { gte: startDate } } 
      }),
      totalRevenue: (await prisma.payment.aggregate({
        where: { status: "completed", createdAt: { gte: startDate } },
        _sum: { platformFeeAmount: true }
      }))._sum.platformFeeAmount || 0,
      topCategories: await prisma.startup.groupBy({
        by: ["category"],
        where: { dateCreated: { gte: startDate.toISOString() } }, // Startup modelida haqiqiy createdAt yo'q, faqat dateCreated (string)
        _count: true,
        orderBy: { _count: { id: "desc" } as any },
        take: 5
      }),
      dailyRevenue
    };
    
    res.json(stats);
  } catch (err) {
    logger.error({ err: err }, "Analytics error");
    res.status(500).json({ error: "Analitika ma'lumotlarini yuklashda xatolik." });
  }
});

// 118-bosqich: admin/users route'lari src/routes/admin-users.ts'ga
// ko'chirildi.
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/backup", adminBackupRouter);
app.use("/api/admin/rebuild", adminRebuildRouter);

// JWT AUTH: Get Profile (Me), Refresh Token, Logout, and Resend Verification are handled by authRouter

// 127-bosqich: startup CRUD va ideas/upvote route'lari src/routes/startups.ts'ga ko'chirildi.
app.use("/api", startupsRouter);

// 115-bosqich: top-boost/vip route'lari src/routes/top-boost-vip.ts'ga ko'chirildi.
app.use("/api", topBoostVipRouter);

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
      logger.error({ err: err }, "Fayl tarkibini tekshirishda xatolik (Sharp metadata)");
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
        logger.error({ err: err }, "Sharp processing error");
        return res.status(400).json({ error: "Fayl formati noto'g'ri yoki buzilgan." });
      }
    }

    // Faylni serverning o'z diskidagi persistent /uploads papkasiga yozamiz
    // (ilgari Telegram kanaliga yuborilardi — endi shart emas).
    const genericFilename = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${finalExt}`;
    await fs.promises.writeFile(path.join(UPLOADS_DIR, genericFilename), finalBuffer);

    const publicUrl = `/uploads/${genericFilename}`;

    return res.json({
      url: publicUrl,
      message: "Rasm muvaffaqiyatli yuklandi."
    });
  } catch (err: unknown) {
    logger.error({ err: err }, "POST /api/upload error");
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

// 128-bosqich (server.ts modullashtirish davomi): createPaymentOrder() va
// finalizeCompletedPayment() src/lib/payments.ts'ga, ularni ishlatgan barcha
// to'lov route'lari (create, telegram/create-payment, my, coingate-simulator,
// webhook, status) src/routes/payments.ts'ga ko'chirildi. finalizeCompletedPayment
// bu yerda ham import qilinadi, chunki uni /api/payments/stripe-webhook (pastda)
// ham chaqiradi — u xom (raw) so'rov tanasi kerakligi sabab global express.json()'dan
// OLDIN shu faylda qolishi shart.
app.use("/api", paymentsRouter);

// 116-bosqich: telegram-integratsiya route'lari
// src/routes/telegram-integration.ts'ga ko'chirildi.
app.use("/api/telegram", telegramIntegrationRouter);


// 117-bosqich: conversations/messaging route'lari
// src/routes/conversations.ts'ga ko'chirildi.
app.use("/api/conversations", conversationsRouter);

// 113-bosqich: reviews route'lari src/routes/reviews.ts'ga ko'chirildi.
app.use("/api", reviewsRouter);

// 112-bosqich: disputes route'lari src/routes/disputes.ts'ga ko'chirildi.
app.use("/api/disputes", disputesRouter);

// 120-bosqich: audit-logs+stats route'lari src/routes/admin-audit.ts'ga ko'chirildi.
app.use("/api/admin", adminAuditRouter);


// DELETE /api/admin/startups/:id — E'lonni o'chirish (Admin)
// 121-bosqich: admin startup/idea delete route'lari src/routes/admin-delete.ts'ga
// ko'chirildi (sponsor-channels.ts naqshi bilan bir xil).
app.use("/api/admin", adminDeleteRouter);

// 119-bosqich: admin/settings route'lari src/routes/admin-settings.ts'ga
// ko'chirildi.
app.use("/api/admin/settings", adminSettingsRouter);

// 110-bosqich: sponsor-channels routes src/routes/sponsor-channels.ts'ga
// ko'chirildi (auth.ts/support.ts naqshi bilan bir xil).
app.use("/api/admin/sponsor-channels", sponsorChannelsRouter);
app.use("/api/telegram/exchange", exchangeChannelsRouter);
app.use("/api/admin/exchange-channels", exchangeAdminRouter);
app.use("/api/exchange", exchangeSiteRouter);

async function seedSettings() {
  const defaults = [
    { key: "TOP_BASE_PRICE_PER_DAY", value: "1" },
    { key: "TOP_MAX_CONCURRENT_SLOTS", value: "20" },
    { key: "VIP_PRICE_PER_DAY", value: "0.5" },
    { key: "VIP_DISCOUNT_PERCENT", value: "40" },
    { key: "TELEGRAM_STORAGE_CHANNEL_ID", value: "" },
    { key: "TELEGRAM_ADMIN_CHAT_ID", value: "" }
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
        logger.info({ key: s.key }, "Seeded setting");
        continue;
      }

      // TUZATILDI (foydalanuvchi talabi — admin panelda "⚠️ SHIFRLASHDA
      // XATOLIK — qiymatni qayta kiriting" ko'rinishi tuzatildi): agar
      // qator ALLAQACHON mavjud bo'lsa, avval bu yerda HECH NARSA
      // tekshirilmasdi. Lekin ba'zi eski qatorlar (odatda ENCRYPTION_KEY
      // avval boshqacha bo'lgan yoki .env'da umuman sozlanmagan paytda,
      // vaqtinchalik tasodifiy dev-kalit bilan shifrlangan) hozirgi
      // ENCRYPTION_KEY bilan DESHIFRLANMAY qoladi — admin panelda doimiy
      // xato ko'rsatib turadi, garchi bu FAQAT standart (seedSettings)
      // sozlamalar bo'lsa ham (ya'ni admin hali qo'lda maxsus qiymat
      // kiritmagan). Endi shu holat avtomatik ANIQLANADI va standart
      // qiymat bilan JORIY kalit ostida QAYTA shifrlab qo'yiladi — admin
      // keyin xohlasa buni oddiy tahrirlaydi, lekin doimiy xato ko'rinib
      // turmaydi.
      try {
        decryptSecret(exists.value);
      } catch (decryptErr) {
        await prisma.setting.update({
          where: { key: s.key },
          data: { value: encryptSecret(s.value) }
        });
        logger.warn(
          { key: s.key },
          "Sozlama eski/mos kelmaydigan ENCRYPTION_KEY bilan shifrlangan edi — standart qiymat bilan joriy kalit ostida qayta shifrlandi."
        );
      }
    } catch (err) {
      logger.error({ err: err }, `Error seeding ${s.key}`);
    }
  }

  // Tozalash: TELEGRAM_BOT_INTERNAL_SECRET ilgari bazada (admin panel
  // orqali) saqlanardi va bu qiymat telegram-bot processi ko'radigan
  // .env qiymatidan farq qilib qolsa, botning HAR BIR so'rovi doimiy
  // "403 Ruxsat etilmagan" xatosi bilan rad etilardi (chunki server
  // bazadagi qiymatni ustun qo'yardi, bot esa umuman bazani ko'rmaydi).
  // Endi bu kalit FAQAT src/lib/context.ts'dagi getSecret() orqali
  // (.env yoki avto-generatsiya qilingan umumiy fayldan) olinadi, shu
  // sabab bazada qolib ketgan har qanday eski qiymat endi zararli —
  // uni har server ishga tushganda avtomatik o'chirib tashlaymiz.
  try {
    const stale = await prisma.setting.findUnique({ where: { key: "TELEGRAM_BOT_INTERNAL_SECRET" } });
    if (stale) {
      await prisma.setting.delete({ where: { key: "TELEGRAM_BOT_INTERNAL_SECRET" } });
      logger.warn(
        "🔧 Bazada eskirgan TELEGRAM_BOT_INTERNAL_SECRET topildi va avtomatik o'chirildi " +
        "(bot bilan mos kelmay, doimiy \"Ruxsat etilmagan\" xatosiga sabab bo'lishi mumkin edi)."
      );
    }
  } catch (err) {
    logger.error({ err }, "Error cleaning up stale TELEGRAM_BOT_INTERNAL_SECRET setting");
  }
}

// Initialize Express + Vite Setup
async function start() {
  logger.info(isPostgres ? "PostgreSQL bazasiga ulanildi (production)" : "SQLite (dev.db) ishlatilyapti — bu faqat lokal rivojlantirish uchun!");

  // MUHIM ("qayta build qilinganda foydalanuvchilar yo'qoladi" muammosi):
  // DATABASE_URL sozlanmagan bo'lsa (SQLite rejimi), pastdagi kod
  // `prisma db push --accept-data-loss` orqali dev.db faylini qayta
  // yaratadi. Ko'pchilik hosting platformalarida (Render, Railway va h.k.)
  // doimiy disk ulanmagan bo'lsa, konteyner har bir qayta build/deploy'da
  // TOZA fayl tizimidan boshlanadi — ya'ni dev.db har safar bo'shdan
  // yaratiladi va barcha foydalanuvchilar/e'lonlar YO'QOLADI. Bundan ham
  // yomoni: butun backup/auto-restore tizimi (backup-db.ts, restore-db.ts,
  // admin-backup.ts) ATAYLAB faqat PostgreSQL (DATABASE_URL) bilan ishlaydi
  // — SQLite rejimida na zaxira olinadi, na tiklash ishlaydi, shuning uchun
  // pastdagi checkAndAutoRestore() ham yordam bera olmaydi. Oldin bu holat
  // faqat bitta log qatorida ("faqat lokal rivojlantirish uchun") jim
  // aytilardi — production'da buni ko'rish deyarli mumkin emas edi. Endi
  // production-o'xshash muhitda (NODE_ENV=production yoki hosting
  // platformasi belgilaydigan standart o'zgaruvchilar mavjud bo'lsa) bu
  // holat KRITIK deb belgilanadi va adminga Telegram orqali darhol
  // ogohlantirish yuboriladi — HAQIQIY YECHIM esa DATABASE_URL'ni haqiqiy
  // PostgreSQL ulanish satriga sozlash (masalan Render Postgres, Neon,
  // yoki Supabase) va qayta deploy qilishdir.
  if (!isPostgres) {
    const looksLikeProduction = !!(
      process.env.NODE_ENV === "production" ||
      process.env.RENDER ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.FLY_APP_NAME
    );
    if (looksLikeProduction) {
      const criticalMsg =
        "🔴 KRITIK: DATABASE_URL sozlanmagan — server SQLite (dev.db) rejimida " +
        "ishlamoqda! Bu muhit vaqtinchalik (ephemeral) diskka ega bo'lsa, HAR " +
        "BIR qayta build/deploy'da barcha foydalanuvchilar va e'lonlar " +
        "YO'QOLADI, chunki: (1) SQLite fayli doimiy diskda saqlanmaydi va " +
        "(2) zaxira/tiklash tizimi (Telegram/S3/Google Drive backup) faqat " +
        "PostgreSQL bilan ishlaydi, SQLite'da hech narsa zaxiralanmaydi. " +
        "YECHIM: hosting platformangizda (Render/Railway/Fly va h.k.) " +
        "DATABASE_URL muhit o'zgaruvchisini haqiqiy PostgreSQL ulanish " +
        "satriga sozlang va qayta deploy qiling.";
      logger.error(criticalMsg);
      try {
        await notifyAdminTelegram(criticalMsg);
      } catch (notifyErr) {
        logger.error({ err: notifyErr }, "SQLite production ogohlantirishini Telegram orqali yuborib bo'lmadi");
      }
    }
  }

  if (isPostgres) {
    try {
      logger.info("DATABASE_URL found. Deploying PostgreSQL migrations...");
      execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", { stdio: "inherit" });
      logger.info("PostgreSQL migrations deployed successfully.");
    } catch (migrateErr) {
      logger.error({ err: migrateErr }, "PostgreSQL migration deployment failed on startup");
    }
    try {
      logger.info("DATABASE_URL found. Syncing PostgreSQL schema with db push...");
      execSync("npx prisma db push --schema=prisma/schema.prisma --accept-data-loss", { stdio: "inherit" });
      logger.info("PostgreSQL schema synced successfully.");
    } catch (pushErr) {
      logger.error({ err: pushErr }, "PostgreSQL db push failed on startup");
    }
  } else {
    try {
      logger.info("Using SQLite. Syncing database schema...");
      execSync("npx prisma db push --schema=prisma/schema.sqlite.prisma --accept-data-loss", { stdio: "inherit" });
      logger.info("SQLite database synced successfully.");
    } catch (pushErr) {
      logger.error({ err: pushErr }, "SQLite database sync failed on startup");
    }
  }

  // Auto-restore if database is empty with critical error handling
  async function checkAndAutoRestore() {
    try {
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        logger.warn("⚠️ Database is empty - attempting auto-restore from backup...");
        
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
        // MUHIM: Google Drive orqali ham zaxira sozlangan bo'lishi mumkin —
        // avval bu yerda tekshirilmasdi, ya'ni faqat Google Drive sozlangan
        // (Telegram va S3 sozlanmagan) loyihalarda ham noto'g'ri "toza
        // o'rnatish" deb xulosaga kelinardi.
        const hasGDriveConfig = !!(await getSetting("GOOGLE_DRIVE_CLIENT_EMAIL")) && !!(await getSetting("GOOGLE_DRIVE_PRIVATE_KEY"));

        if (!lastBackupFileId && !hasFallback && !hasS3Config && !hasGDriveConfig) {
          logger.info("No previous backup file ID found in settings or fallback. This is a clean installation. Proceeding with clean database.");
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
          logger.info("Database restored successfully from backup!");
        } catch (restoreErr: unknown) {
          const errorMsg = `🔴 CRITICAL: Database restore FAILED\n${getErrorMessage(restoreErr)}`;
          logger.error(errorMsg);
          
          try {
            await notifyAdminTelegram(errorMsg);
          } catch (notifyErr) {
            logger.error({ err: notifyErr }, "Also failed to notify admin");
          }
          
          logger.error("❌ Server warning: empty/broken database restore attempted with errors.");
        }
      }
    } catch (checkErr: unknown) {
      logger.error({ err: checkErr }, "⚠️ Database check warning");
    }
  }

  await checkAndAutoRestore();

  await seedSettings();

  await seedDatabase();

  // "Obunachi yig'ish" (ExchangeChannel/ExchangeSubscription) jadvallari
  // migratsiya qilinganini serverni ISHGA TUSHIRISH paytida tekshiramiz —
  // avval bu faqat foydalanuvchi kanal qo'shishga uringanda, jim
  // ("Kanalni qo'shishda xatolik yuz berdi") aniqlanardi. Endi muammo
  // bo'lsa DARHOL (deploy paytidayoq) loglanadi va adminga xabar boradi,
  // shunda "ishladimi-yo'qmi" deb kutish shart emas.
  try {
    await prisma.exchangeChannel.count();
    logger.info("✅ Obuna almashish (ExchangeChannel) jadvali bazada mavjud.");
  } catch (schemaErr: unknown) {
    const errMsg = schemaErr instanceof Error ? schemaErr.message : String(schemaErr);
    logger.error(
      { err: schemaErr },
      "❌ KRITIK: ExchangeChannel jadvali bazada topilmadi — obuna almashish (kanal qo'shish) ishlamaydi!"
    );
    notifyAdminTelegram(
      "🚨 <b>Obuna almashish jadvali topilmadi!</b>\n\n" +
      "Server ishga tushdi, lekin ExchangeChannel jadvali bazada yo'q. " +
      "\"Kanal qo'shish\" funksiyasi ishlamaydi. Sabab: migratsiya " +
      "(\"prisma db push\" / \"prisma migrate deploy\") hali ishga tushmagan yoki " +
      "eskirgan build ishlatilmoqda — qayta deploy qiling.\n\n" +
      `Xato: <code>${errMsg.substring(0, 500).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`
    ).catch(() => {});
  }

// --- NOTIFICATIONS ---
app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50
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

// --- CATEGORIES ---
// Ommaviy ro'yxat — faqat admin tasdiqlagan ("active") kategoriyalar ko'rinadi,
// "pending" (tasdiq kutayotgan) kategoriyalar bu yerda oshkor bo'lmaydi.
// QULAYLIK: har bir kategoriyaga shu kategoriyadagi FAOL e'lonlar soni
// (listingCount) ham qo'shib yuboriladi — shunda foydalanuvchi (sayt yoki
// bot) hali qaysi kategoriya bo'sh, qaysi biri to'la ekanini kategoriyaga
// kirmasdan turib ko'ra oladi.
app.get("/api/categories", async (req, res) => {
  try {
    const [categories, counts] = await Promise.all([
      prisma.category.findMany({ where: { status: "active" } }),
      prisma.startup.groupBy({
        by: ["category"],
        where: { status: "active" },
        _count: { _all: true }
      })
    ]);
    const countByCategory: Record<string, number> = {};
    for (const c of counts) {
      countByCategory[c.category] = c._count._all;
    }
    res.json(categories.map((c: any) => ({
      ...c,
      fields: JSON.parse(c.fields || "[]"),
      listingCount: countByCategory[c.id] || 0
    })));
  } catch (err) {
    res.status(500).json({ error: "Kategoriyalarni yuklashda xatolik." });
  }
});

// POST /api/categories/propose — login qilgan foydalanuvchi yangi kategoriya
// taklif qiladi. Darhol ro'yxatga qo'shilmaydi, "pending" holatda admin
// tasdig'ini kutadi (AdminCategoriesTab orqali).
app.post("/api/categories/propose", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, name, icon } = req.body;
    if (!id || !String(id).trim() || !name || !String(name).trim()) {
      return res.status(400).json({ error: "ID va nom majburiy." });
    }
    const cleanId = String(id).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!cleanId) {
      return res.status(400).json({ error: "Yaroqli ID kiriting (faqat lotin harflari, raqamlar va chiziqchalar)." });
    }

    const existing = await prisma.category.findUnique({ where: { id: cleanId } });
    if (existing) {
      return res.status(409).json({ error: "Bunday ID'li kategoriya allaqachon mavjud yoki taklif qilingan." });
    }

    const category = await prisma.category.create({
      data: {
        id: cleanId,
        name: String(name).trim(),
        icon: icon && String(icon).trim() ? String(icon).trim() : "category",
        fields: "[]",
        status: "pending",
        proposedByUserId: req.user?.id,
      }
    });
    res.json({ success: true, category, message: "Taklifingiz qabul qilindi. Admin tasdiqlagach kategoriya ro'yxatda ko'rinadi." });
  } catch (err) {
    logger.error({ err: err }, "POST /api/categories/propose error");
    res.status(500).json({ error: "Kategoriya taklif qilishda xatolik." });
  }
});

// --- CATEGORIES (ADMIN) ---
// Admin panel uchun to'liq ro'yxat — "active" va "pending" barchasi ko'rinadi,
// shunda admin foydalanuvchilar taklif qilgan kategoriyalarni tasdiqlashi mumkin.
app.get("/api/admin/categories", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { proposedByUser: { select: { id: true, name: true, email: true } } }
    });
    res.json(categories.map((c: any) => ({ ...c, fields: JSON.parse(c.fields || "[]") })));
  } catch (err) {
    logger.error({ err: err }, "GET /api/admin/categories error");
    res.status(500).json({ error: "Kategoriyalarni yuklashda xatolik." });
  }
});

app.post("/api/admin/categories", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, name, icon, fields } = req.body;
    const category = await prisma.category.create({
      data: { id, name, icon, fields: JSON.stringify(fields || []), status: "active" }
    });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: "Kategoriya yaratishda xatolik." });
  }
});

// PATCH /api/admin/categories/:id/approve — foydalanuvchi taklif qilgan
// "pending" kategoriyani "active" holatga o'tkazadi (ommaviy ro'yxatda paydo bo'ladi).
app.patch("/api/admin/categories/:id/approve", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { status: "active" }
    });
    res.json(category);
  } catch (err) {
    logger.error({ err: err }, "PATCH /api/admin/categories/:id/approve error");
    res.status(500).json({ error: "Kategoriyani tasdiqlashda xatolik." });
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
    logger.error({ err: err }, "DELETE /api/admin/categories/:id error");
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
    logger.error({ err: err }, "Sitemap generation error");
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
    // Kesh siyosati: /assets ostidagi fayllar (masalan ProfilePage-BJLJ0JpP.js)
    // nomida build-hash bor — mazmuni o'zgarsa nomi ham o'zgaradi, shuning
    // uchun ularni CHEKSIZ uzoq va "immutable" qilib keshlash xavfsiz va
    // tavsiya etiladi. index.html esa har doim ENG YANGI holatda bo'lishi
    // kerak (aks holda brauzer eski index.html'ni uzoq vaqt keshda saqlab,
    // u orqali endi mavjud bo'lmagan eski chunk fayllarni so'rayveradi —
    // "Failed to fetch dynamically imported module" xatosining asosiy
    // sabablaridan biri shu edi, ilgari hech qanday Cache-Control
    // ko'rsatilmagan edi).
    app.use(express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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

  // 2-so'rov: har kuni soat 10:00 da VIP/TOP muddati tugayotgan/tugagan
  // foydalanuvchilarga Telegram orqali eslatma yuborish
  cron.schedule("0 10 * * *", () => {
    logger.info("[CRON] Running notifyExpiringVipAndTop...");
    notifyExpiringVipAndTop();
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

  // `scripts/backup-db.ts`ni asosiy server event loop'idan mustaqil,
  // alohida Node protsessi sifatida ishga tushiradi (qarang: pastdagi
  // "0 4 * * *" cron izohi). Chiqishi (stdout/stderr) mavjud `logger`
  // orqali yoziladi, shunda pm2 loglarida hamon ko'rinadi.
  function runDailyBackupInChildProcess() {
    const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
    const scriptPath = path.join(process.cwd(), "scripts", "backup-db.ts");

    const child = spawn(tsxBin, [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => {
      logger.info(`[Backup] ${data.toString().trim()}`);
    });
    child.stderr?.on("data", (data: Buffer) => {
      logger.error(`[Backup] ${data.toString().trim()}`);
    });
    child.on("error", (err) => {
      logger.error({ err }, "[CRON] Daily backup child process'ni ishga tushirib bo'lmadi");
    });
    child.on("exit", (code) => {
      if (code === 0) {
        logger.info("[CRON] Daily backup child process muvaffaqiyatli tugadi.");
      } else {
        logger.error({ code }, "[CRON] Daily backup child process xato kod bilan tugadi");
      }
    });
  }

  // Har kuni soat 04:00 da tunda ma'lumotlar bazasini zaxiralash
  // TUZATISH (production'da "Health-check javob bermadi" +
  // "[NODE-CRON] missed execution ... Possible blocking IO or high CPU"
  // ogohlantirishlari kuzatilgach): ilgari `scripts/backup-db.ts` shu
  // ASOSIY server protsessining ICHIDA (`dynamic import` + `await
  // runBackup()`) ishga tushirilardi. Fallback rejimida bu butun bazani
  // xotiraga o'qib (30 jadval), `JSON.stringify()` qilib, so'ng SINXRON
  // AES-256-GCM bilan shifrlaydi — bularning barchasi event loop'ni bir
  // necha soniyaga bloklaydigan CPU ishi, shu jumladan `/api/health`
  // so'roviga ham javob berilmay qolardi. Endi backup ALOHIDA child
  // process (`tsx scripts/backup-db.ts`) sifatida ishga tushiriladi —
  // qancha og'ir bo'lmasin, u asosiy server event loop'ini HECH QACHON
  // bloklamaydi.
  cron.schedule("0 4 * * *", () => {
    logger.info("[CRON] Running daily database backup (alohida child process sifatida)...");
    runDailyBackupInChildProcess();
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
