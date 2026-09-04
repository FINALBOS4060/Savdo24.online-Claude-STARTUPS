import { Request, Response, NextFunction } from "express";
import { PrismaClient as PGClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { Api, GrammyError } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import type { Server } from "socket.io";
import { createRequire } from "module";
import { JwtPayload } from "../types";
import { logger } from "./logger";
import { decryptSecret } from "./crypto";

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
    // TUZATILDI (MUSOBAQA HOLATI/RACE CONDITION, ayniqsa
    // TELEGRAM_BOT_INTERNAL_SECRET uchun muhim — telegram-bot/secret.ts
    // xuddi shu faylni MUSTAQIL kod nusxasi bilan o'qiydi/yozadi): avval
    // oddiy writeFileSync ishlatilardi — agar server va bot PM2 orqali
    // bir vaqtda BIRINCHI marta ishga tushsa, ikkalasi ham yuqoridagi
    // existsSync'da faylni "hali yo'q" deb topib, HAR XIL tasodifiy
    // kalit generatsiya qilib, bir-birining ustidan yozib qo'yishi
    // mumkin edi — natijada ikkala tomon xotirasida turli qiymat qolib,
    // birinchi so'rovlar 403 bilan muvaffaqiyatsiz tugardi. Endi
    // `flag: "wx"` (exclusive) bilan yozamiz: fayl shu oraliqda boshqa
    // process tomonidan allaqachon yaratilgan bo'lsa, EEXIST xatosi
    // tutiladi va o'zimiz generatsiya qilgan qiymat emas, balki ENDI
    // FAYLDA turgan (g'olib chiqqan) qiymat o'qib qaytariladi — shu
    // bilan "kim birinchi yozsa, o'shaniki qoladi" ta'minlanadi.
    try {
      fs.writeFileSync(secretFilePath, generated, { encoding: "utf8", flag: "wx" });
      logger.warn(
        `⚠️ OGOHLANTIRISH: "${envVar}" muhit o'zgaruvchisi sozlanmagan — yangi tasodifiy kalit generatsiya qilindi va kelajakda barqaror ulanish uchun quyidagi faylda saqlandi:\n👉 ${secretFilePath}\n`
      );
      return generated;
    } catch (writeErr: unknown) {
      const code = (writeErr as NodeJS.ErrnoException)?.code;
      if (code === "EEXIST") {
        const winner = fs.readFileSync(secretFilePath, "utf8").trim();
        if (winner && winner.length >= minLength) {
          logger.warn(`⚠️ OGOHLANTIRISH: "${envVar}" — boshqa process (bot) faylni bir zumda oldinroq yaratdi, o'sha qiymat ishlatiladi (${secretFilePath}).`);
          return winner;
        }
      }
      throw writeErr;
    }
  } catch (fileErr) {
    logger.warn({ fileErr }, `⚠️ OGOHLANTIRISH: "${envVar}" avto-kalit faylini yaratishda xatolik yuz berdi:`);
  }

  logger.warn(`⚠️ OGOHLANTIRISH: "${envVar}" topilmadi — vaqtinchalik tasodifiy kalit generatsiya qilindi.`);
  return crypto.randomBytes(32).toString("hex");
}

export const JWT_SECRET = getSecret("JWT_SECRET", 32);

// Bot <-> server ichki so'rovlarini tasdiqlash uchun maxfiy kalit.
// MUHIM: bu kalit ATAYLAB faqat process.env (yoki getSecret()ning
// .secret_TELEGRAM_BOT_INTERNAL_SECRET avto-fayli) orqali olinadi —
// bazadagi (admin panel) Setting jadvalidan HECH QACHON o'qilmaydi.
// Sabab: telegram-bot/index.ts alohida process sifatida ishlaydi va
// bazaga umuman ulanmaydi, u faqat o'z process.env'idan (yoki xuddi shu
// avto-fayldan) o'qiy oladi. Agar bu qiymat bazada saqlanadigan bo'lsa,
// ikki tomon (server va bot) bir-biridan mustaqil ikki xil qiymatga ega
// bo'lib qolishi mumkin edi — aynan shu sabab "403 Ruxsat etilmagan"
// xatosiga olib kelgan edi. getSecret() esa ikkala process ham bir xil
// process.cwd()da ishlagani sabab (ecosystem.config.cjs'da ikkalasi ham
// cwd: __dirname), .env'da qiymat bo'lmasa ham, avtomatik generatsiya
// qilingan kalitni umumiy faylga yozib, ikkala tomonni ham avtomatik
// sinxronlab qo'yadi — qo'lda sozlash umuman shart emas.
export const TELEGRAM_BOT_INTERNAL_SECRET = getSecret("TELEGRAM_BOT_INTERNAL_SECRET", 24);

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

// YANGI (production diagnostikasi — foydalanuvchi so'rovi bo'yicha):
// oddiy getSetting() shifrlashda xato bo'lsa, jim ravishda .env
// qiymatiga (yoki null'ga) qaytadi — bu ATAYLAB shunday, chunki boshqa
// barcha chaqiruvchilar uchun (masalan VIP narxini hisoblash) xato
// tashlash o'rniga xavfsiz standart qiymatga tushish to'g'ri xulq-atvor.
// LEKIN bu "jim" xulq-atvor bir kamchilikka olib keladi: agar bazadagi
// qiymat ENCRYPTION_KEY o'zgargani (yoki ma'lumot buzilgani) sabab
// umuman o'qib bo'lmasa, ADMIN buni HECH QACHON bilmaydi — masalan admin
// panelda VIP narxini o'zgartirgan bo'lsa-yu, u "muvaffaqiyatli
// saqlandi" ko'rinsa-da, aslida tizim shifrlashda xato tufayli standart
// qiymatga qaytib ketayotgan bo'lishi mumkin (buni bevosita PM2
// loglaridan topish kerak edi). Bu funksiya FAQAT admin sozlamalar
// ro'yxati (GET /api/admin/settings) uchun — decryptFailed=true bo'lsa,
// admin panelda buni ANIQ ko'rsatish uchun ishlatiladi.
export async function getSettingDiagnostic(key: string): Promise<{ value: string | null; decryptFailed: boolean }> {
  try {
    if (prisma && prisma.setting) {
      const dbSetting = await prisma.setting.findUnique({ where: { key } });
      if (dbSetting) {
        try {
          return { value: decryptSecret(dbSetting.value), decryptFailed: false };
        } catch (decryptErr) {
          logger.error({ decryptErr }, `Error decrypting setting ${key}:`);
          return { value: process.env[key] || null, decryptFailed: true };
        }
      }
    }
  } catch (err) {
    logger.error({ err }, `Error in getSettingDiagnostic for ${key}:`);
  }
  return { value: process.env[key] || null, decryptFailed: false };
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

// Ilgari har bir xabar (buyurtma bildirishnomasi, referral mukofoti, admin
// ogohlantirishi va h.k.) uchun `new Bot(botToken)` chaqirilardi — bu har
// safar butun grammy Bot obyektini (webhook/polling infratuzilmasi bilan)
// qaytadan yaratardi, holbuki bizga faqat bitta metod (sendMessage) kerak.
// Endi `Api` (grammy'ning yengil, faqat so'rov yuboradigan klassi) token
// bo'yicha keshlanadi — token o'zgarmagan bo'lsa, mavjud instance qayta
// ishlatiladi.
const telegramApiCache = new Map<string, Api>();
function getTelegramApi(token: string): Api {
  let api = telegramApiCache.get(token);
  if (!api) {
    api = new Api(token);
    telegramApiCache.set(token, api);
  }
  return api;
}

export async function notifyAdminTelegram(message: string) {
  try {
    const botToken = (await getSetting("TELEGRAM_BOT_TOKEN")) || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.warn("TELEGRAM_BOT_TOKEN sozlanmagan, admin ogohlantirishini yuborib bo'lmadi.");
      return;
    }
    const adminChatId =
      (await getSetting("TELEGRAM_ADMIN_CHAT_ID")) || process.env.TELEGRAM_ADMIN_CHAT_ID || "8780300373";
    if (!adminChatId) {
      logger.warn("TELEGRAM_ADMIN_CHAT_ID sozlanmagan, admin ogohlantirishini yuborib bo'lmadi.");
      return;
    }
    const api = getTelegramApi(botToken);
    const truncatedMessage = message.substring(0, 4096);
    await api.sendMessage(adminChatId, truncatedMessage, { parse_mode: "HTML" });
  } catch (err: unknown) {
    logger.error({ err }, "Admin Telegram ogohlantirishini yuborishda xatolik");
  }
}

// Telegram flood-control (429) uchun qayta urinish (retry) sozlamalari.
// TUZATILDI: ilgari 429 xatosi ("Too Many Requests: retry after N")
// boshqa har qanday xato bilan bir xil ko'rilardi — funksiya shunchaki
// false qaytarardi va xabar "failed" deb belgilanardi, garchi u
// haqiqatda hech qachon Telegramga muvaffaqiyatsiz yetkazilmagan
// (kontent yoki ruxsat sababli rad etilmagan) bo'lsa ham, faqat vaqtinча
// tezlik cheklovi tufayli kechiktirilgan bo'lsa ham. Bu ayniqsa
// ommaviy xabar (broadcast) yuborishda sezilarli edi: bir necha o'nlab
// xabardan keyin flood-control ishga tushib, qolgan barcha
// foydalanuvchilar "muvaffaqiyatsiz" deb hisoblanardi.
// Endi: Telegram javobidagi parameters.retry_after (soniyalarda —
// aynan qancha kutish kerakligini Telegram o'zi aytadi) qiymatiga
// qarab kutiladi va xabar qayta yuboriladi, MAX_FLOOD_RETRIES marta
// gacha. Cheklov bot butunlay global rate-limitga tushib qolgan
// holatda ("hech narsa yordam bermayapti") jarayon abadiy
// to'xtab qolmasligi uchun qo'yilgan — shunda xabar haqiqatan ham
// "failed" deb belgilanadi va broadcast keyingi foydalanuvchiga o'tadi.
const MAX_FLOOD_RETRIES = 3;

export async function sendTelegramMessage(
  telegramUserId: string,
  text: string,
  options?: { replyMarkup?: InlineKeyboardMarkup; botToken?: string },
  _retryAttempt: number = 0
): Promise<boolean> {
  try {
    // YANGI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
    // botining bir-biriga aloqasi bo'lmasligi kerak"): endi chaqiruvchi
    // ANIQ qaysi bot tokeni bilan yuborilishini `options.botToken` orqali
    // majburlashi mumkin (masalan exchange-channels.ts endi "obunachi
    // yig'ish" bildirishnomalarini FAQAT TELEGRAM_SUBSCRIBER_BOT_TOKEN
    // bilan yuboradi). Berilmasa, avvalgidek asosiy bot tokeni ishlatiladi
    // — bu boshqa (exchange bilan bog'liq bo'lmagan) barcha eski
    // chaqiruvchilar uchun xulq-atvor O'ZGARMAGANLIGINI ta'minlaydi.
    const botToken = options?.botToken || (await getSetting("TELEGRAM_BOT_TOKEN")) || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.warn(options?.botToken ? "Berilgan bot tokeni bo'sh, xabar yuborilmadi." : "TELEGRAM_BOT_TOKEN is not set, skipping notification.");
      return false;
    }
    const api = getTelegramApi(botToken);
    await api.sendMessage(telegramUserId, text, {
      parse_mode: "HTML",
      ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {})
    });
    // Xabar muvaffaqiyatli yetkazildi — agar bu foydalanuvchi ilgari
    // botni bloklagan deb belgilangan bo'lsa (masalan keyinchalik botni
    // qayta ochib, blokdan chiqargan bo'lsa), belgini tozalaymiz. `updateMany`
    // + `telegramBotBlockedAt: { not: null }` sharti tufayli bu odatiy holatda
    // (belgilanmagan foydalanuvchilarning aksariyati uchun) hech narsani
    // yangilamaydi — shuning uchun har safar await qilib kutish shart emas.
    prisma.user
      .updateMany({ where: { telegramUserId, telegramBotBlockedAt: { not: null } }, data: { telegramBotBlockedAt: null } })
      .catch((e: unknown) => logger.error({ err: e, telegramUserId }, "telegramBotBlockedAt tozalashda xatolik"));
    return true;
  } catch (err: unknown) {
    // Telegram 403 ("Forbidden: bot was blocked by the user") — bu xato
    // vaqtinchalik emas, DOIMIY: foydalanuvchi botni to'sib qo'ygan va u
    // qayta blokdan chiqarmaguncha hech qanday xabar yetib bormaydi.
    // TUZATILDI: ilgari bu ham oddiy xato sifatida ko'rilib, faqat
    // "failed" deb belgilanardi va foydalanuvchi User jadvalida
    // hech qanday tarzda ajratilmasdi — natijada har broadcast'da
    // xuddi shu "o'lik" foydalanuvchilarga qayta-qayta behuda urinish
    // ketardi. Endi bunday holatda telegramBotBlockedAt vaqti
    // yoziladi va broadcast so'rovi (`/broadcast/send`) shu maydon
    // bo'yicha filtrlab, bloklagan foydalanuvchilarni umuman ro'yxatga
    // kiritmaydi.
    if (err instanceof GrammyError && err.error_code === 403) {
      logger.warn({ telegramUserId }, "Foydalanuvchi botni bloklagan (403) — telegramBotBlockedAt belgilanmoqda");
      prisma.user
        .updateMany({ where: { telegramUserId }, data: { telegramBotBlockedAt: new Date() } })
        .catch((e: unknown) => logger.error({ err: e, telegramUserId }, "telegramBotBlockedAt yozishda xatolik"));
      return false;
    }
    if (err instanceof GrammyError && err.error_code === 429 && _retryAttempt < MAX_FLOOD_RETRIES) {
      // Telegram retry_after'ni soniyalarda qaytaradi; kichik bufer
      // (+1s) qo'shib, chegaraga juda yaqin qayta urinishning oldini
      // olamiz.
      const retryAfterSec = err.parameters?.retry_after ?? 2;
      const waitMs = (retryAfterSec + 1) * 1000;
      logger.warn(
        { telegramUserId, retryAfterSec, attempt: _retryAttempt + 1, maxAttempts: MAX_FLOOD_RETRIES },
        "Telegram flood-control (429): kutib, qayta urinilmoqda"
      );
      await new Promise((r) => setTimeout(r, waitMs));
      return sendTelegramMessage(telegramUserId, text, options, _retryAttempt + 1);
    }
    if (err instanceof GrammyError && err.error_code === 429) {
      logger.error(
        { telegramUserId, maxAttempts: MAX_FLOOD_RETRIES },
        "Telegram flood-control (429): qayta urinishlar soni tugadi, xabar 'failed' deb belgilandi"
      );
    } else {
      logger.error({ err }, "Error sending Telegram message");
    }
    return false;
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
  } catch (err: unknown) {
    logger.error({ err }, "Error formatting startup");
    return dbStartup;
  }
}

let socketIoInstance: Server | null = null;
export function setSocketIoInstance(instance: Server) {
  socketIoInstance = instance;
}

export const io = {
  to: (room: string) => {
    if (socketIoInstance) {
      return socketIoInstance.to(room);
    }
    return { emit: () => {} };
  },
  emit: (event: string, data: unknown) => {
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
  } catch (err: unknown) {
    logger.error({ err }, "Error creating notification");
  }
}

// createNotification saytdagi (qo'ng'iroq belgisi) bildirishnomani
// yaratadi, lekin foydalanuvchi saytga kirmasa buni ko'rmaydi. Bu
// funksiya SHU BILAN BIRGA, agar foydalanuvchi Telegram hisobini ulagan
// bo'lsa, xuddi shu xabarni botdan ham yuboradi — shunda saytga
// kirmasdan ham darhol xabardor bo'ladi. Xatolik jimgina e'tiborsiz
// qoldiriladi (masalan botni bloklagan bo'lsa) — asosiy amal (masalan
// xabar yuborish) buning tufayli buzilmasligi kerak.
export async function notifyUserTelegram(userId: number, text: string, link?: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramUserId: true } });
    if (!user?.telegramUserId) return;
    const appUrl = process.env.APP_URL || "https://savdo24.online";
    const fullText = link ? `${text}\n\n🔗 ${appUrl}${link}` : text;
    await sendTelegramMessage(user.telegramUserId, fullText);
  } catch (err: unknown) {
    logger.warn({ err, userId }, "notifyUserTelegram failed (e'tiborsiz qoldirildi)");
  }
}

export async function trackEvent(
  event: string,
  userId?: number,
  targetId?: string,
  source?: string,
  metadata: Record<string, unknown> = {}
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
  } catch (err: unknown) {
    logger.error({ err }, "Analytics tracking error");
  }
}

export async function getReferralCount(referrerId: number): Promise<number> {
  return prisma.referralReward.count({ where: { referral: { referrerId } } });
}
