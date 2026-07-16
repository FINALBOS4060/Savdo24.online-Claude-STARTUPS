import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import rateLimit from "express-rate-limit";
import { execSync } from "child_process";
import helmet from "helmet";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient as PGClient } from "@prisma/client";
import { createRequire } from 'module';
const _require = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
const SQLiteClient = _require(path.join(process.cwd(), "src/generated/sqlite-client/index.js")).PrismaClient;
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import multer from "multer";
import sharp from "sharp";
import crypto from "crypto";
import { Bot } from "grammy";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

async function getTransporter() {
  const host = await getSetting("SMTP_HOST") || process.env.SMTP_HOST;
  const port = parseInt(await getSetting("SMTP_PORT") || process.env.SMTP_PORT || "587");
  const user = await getSetting("SMTP_USER") || process.env.SMTP_USER;
  const pass = await getSetting("SMTP_PASS") || process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    await transporter.sendMail({
      from: "\"Savdo24\" <noreply@savdo24.online>",
      to,
      subject,
      html
    });
  } catch (err) {
    console.error("Email yuborishda xatolik:", err);
  }
}

// Newsletter functionality moved down after app declaration

async function getStripe() {
  const key = await getSetting("STRIPE_SECRET_KEY") || process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2025-01-27' as any });
}
import { encryptSecret, decryptSecret } from "./src/lib/crypto";
import { OAuth2Client } from "google-auth-library";

process.on("unhandledRejection", (reason) => {
  console.error("Ushlanmagan promise xatosi:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Ushlanmagan istisno:", err);
});

// Environment variable validation
const JWT_SECRET = (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32)
  ? process.env.JWT_SECRET
  : (() => {
      if (process.env.NODE_ENV === "production") {
        console.error("XATOLIK: JWT_SECRET muhit o'zgaruvchisi topilmadi yoki juda qisqa (kamida 32 belgi bo'lishi kerak). Server to'xtatilmoqda.");
        process.exit(1);
      }
      console.warn("⚠️ Ogohlantirish: JWT_SECRET topilmadi yoki juda qisqa. Ishlab chiqish muhitida vaqtinchalik kalit ishlatilmoqda.");
      const fallback = "dev_default_jwt_secret_must_be_at_least_32_characters_long_for_security";
      process.env.JWT_SECRET = fallback;
      return fallback;
    })();

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32)
  ? process.env.ENCRYPTION_KEY
  : (() => {
      if (process.env.NODE_ENV === "production") {
        console.error("XATOLIK: ENCRYPTION_KEY muhit o'zgaruvchisi topilmadi yoki juda qisqa. Server to'xtatilmoqda.");
        process.exit(1);
      }
      console.warn("⚠️ Ogohlantirish: ENCRYPTION_KEY topilmadi yoki juda qisqa. Ishlab chiqish muhitida vaqtinchalik kalit ishlatilmoqda.");
      const fallback = "dev_default_encryption_key_must_be_at_least_32_characters_long_for_security";
      process.env.ENCRYPTION_KEY = fallback;
      return fallback;
    })();

// Coingate production check
if (process.env.NODE_ENV === "production" && !process.env.COINGATE_API_TOKEN) {
  console.warn("⚠️ DIQQAT: Production muhitida COINGATE_API_TOKEN topilmadi. To'lov tizimi ishlamaydi!");
}

let googleClient: OAuth2Client | null = null;
function getGoogleClient() {
  if (!googleClient) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn("GOOGLE_CLIENT_ID topilmadi. Google bilan kirish ishlamasligi mumkin.");
      return null;
    }
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
}

const app = express();

// Newsletter logic moved down
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.APP_URL || "https://savdo24.online" }
});

// requireAdmin middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  if (authReq.user?.role !== "Admin") {
    return res.status(403).json({ error: "Ruxsat etilmagan. Admin ruxsati talab qilinadi." });
  }
  next();
}

const isPostgres = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"));
const prisma: any = isPostgres 
  ? new PGClient() 
  : new SQLiteClient({
      datasources: {
        db: {
          url: "file:./dev.db"
        }
      }
    });

async function getSetting(key: string): Promise<string | null> {
  try {
    const dbSetting = await prisma.setting.findUnique({ where: { key } });
    if (dbSetting) {
      const decrypted = decryptSecret(dbSetting.value);
      if (decrypted) return decrypted;
    }
  } catch (err) {
    console.error(`Error in getSetting for ${key}:`, err);
  }
  return process.env[key] || null;
}

async function trackEvent(event: string, userId?: number, targetId?: string, source?: string, metadata: any = {}) {
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
    console.error("Analytics tracking error:", err);
  }
}

function getReferralTier(referralCount: number) {
  if (referralCount >= 21) {
    return { discount: 15, commission: 15, badge: "👑 Referral King", monthlyBonus: 50 };
  } else if (referralCount >= 6) {
    return { discount: 10, commission: 10, badge: "🌟 Referral Star", monthlyBonus: 0 };
  } else {
    return { discount: 5, commission: 5, badge: null, monthlyBonus: 0 };
  }
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
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    // Find escrows held for more than 14 days
    const escrowsToRelease = await prisma.escrowPayment.findMany({
      where: {
        status: "held",
        createdAt: { lt: fourteenDaysAgo }
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

    console.log(`Checking ${escrowsToRelease.length} escrows for auto-release...`);

    for (const escrow of escrowsToRelease) {
      // Check if there are any open disputes
      const openDispute = await prisma.dispute.findFirst({
        where: {
          paymentId: escrow.paymentId,
          status: { in: ["open", "reviewing"] }
        }
      });

      if (!openDispute) {
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
            `Sizning '${escrow.payment.startup.name}' loyihangiz uchun escrow to'lovi 14 kunlik muddatdan so'ng avtomatik ozod qilindi.`,
            "/profile"
          );

          await sendEmail(
            seller.email,
            "Escrow to'lovi ozod qilindi",
            `<p>Tabriklaymiz! <b>${escrow.payment.startup.name}</b> loyihasi uchun escrow to'lovi 14 kundan so'ng avtomatik ravishda ozod qilindi va balansingizga o'tkazildi.</p>`
          );
        }
        
        console.log(`Auto-released escrow for payment ${escrow.paymentId}`);
      }
    }
  } catch (err) {
    console.error("Escrow auto-release error:", err);
  }
}

async function sendWeeklyNewsletter() {
  try {
    const users = await prisma.user.findMany({ where: { emailVerified: true } });
    
    const newListings = await prisma.startup.findMany({
      where: { 
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
        status: "active"
      },
      take: 5
    });
    
    const topListings = await prisma.startup.findMany({
      where: { isTop: true, topExpiresAt: { gt: new Date() } },
      take: 3
    });

    if (newListings.length === 0 && topListings.length === 0) return;
    
    for (const user of users) {
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0b1426; color: white; padding: 30px; border-radius: 20px;">
          <h2 style="color: #f3ba2f; text-align: center;">Savdo24 Haftalik Digest</h2>
          <p style="text-align: center; color: #8892b0;">Platformadagi eng so'nggi va eng yaxshi takliflar</p>
          
          ${newListings.length > 0 ? `
            <h3 style="border-bottom: 1px solid #ffffff10; padding-bottom: 10px; margin-top: 30px;">📬 Yangi Elonlar</h3>
            ${newListings.map((s: any) => `
              <div style="margin-bottom: 15px; padding: 15px; background: #ffffff05; border-radius: 12px;">
                <h4 style="margin: 0; color: #f3ba2f;">${s.name}</h4>
                <p style="margin: 5px 0; font-size: 14px; color: #8892b0;">${s.slogan}</p>
                <p style="margin: 0; font-weight: bold; color: #10b981;">$${s.price}</p>
              </div>
            `).join('')}
          ` : ''}

          ${topListings.length > 0 ? `
            <h3 style="border-bottom: 1px solid #ffffff10; padding-bottom: 10px; margin-top: 30px;">🔥 TOP Deals</h3>
            ${topListings.map((s: any) => `
              <div style="margin-bottom: 15px; padding: 15px; background: #f3ba2f10; border: 1px solid #f3ba2f30; border-radius: 12px;">
                <h4 style="margin: 0; color: #f3ba2f;">${s.name} (TOP)</h4>
                <p style="margin: 5px 0; font-size: 14px; color: #8892b0;">${s.slogan}</p>
                <p style="margin: 0; font-weight: bold; color: #10b981;">$${s.price}</p>
              </div>
            `).join('')}
          ` : ''}

          <div style="margin-top: 40px; text-align: center;">
            <a href="https://savdo24.online/browse" style="background: #f3ba2f; color: black; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold;">Barchasini Ko'rish</a>
          </div>
        </div>
      `;
      
      await sendEmail(user.email, "📬 Savdo24 Haftalik Digest", html);
    }
    console.log("Weekly newsletter sent to", users.length, "users.");
  } catch (err) {
    console.error("Newsletter error:", err);
  }
}

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Autentifikatsiya xatosi: Token topilmadi"));
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return next(new Error("Autentifikatsiya xatosi: Yaroqsiz token"));
    socket.data.user = decoded;
    next();
  });
});
io.on("connection", (socket) => {
  socket.join(`user:${socket.data.user.id}`);
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

const ideaLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3,
  message: { error: "Juda ko'p komment qoldirildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." }
});

const upvoteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: "Juda ko'p ovoz berildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." }
});

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Juda ko'p shikoyat yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Juda ko'p fayl yuklandi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Juda ko'p urinish. Iltimos, 1 soatdan so'ng qayta urinib ko'ring." }
});

const paymentStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "To'lov holatini tekshirish limiti tugadi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

const PORT = 3000;

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date() });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use(express.json());
app.use(cookieParser());

// Security Headers & CORS
app.use(helmet({
  contentSecurityPolicy: false,
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
      origin.endsWith('.savdo24.online') || 
      origin.includes('asia-east1.run.app') || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1');

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
function formatStartup(dbStartup: any) {
  try {
    const formatted = {
      ...dbStartup,
      price: dbStartup.price || 0,
      listingType: dbStartup.listingType || "To'liq loyiha (manba kodi bilan)",
      techStack: JSON.parse(dbStartup.techStack || "[]"),
      demoUrl: dbStartup.demoUrl || "",
      repoIncluded: dbStartup.repoIncluded ?? false,
      soldStatus: dbStartup.soldStatus || "sotuvda",
      proposalsCount: dbStartup.proposalsCount || 0,
      gallery: JSON.parse(dbStartup.gallery || "[]"),
      team: JSON.parse(dbStartup.team || "[]"),
      milestones: JSON.parse(dbStartup.milestones || "[]"),
    };
    // Hide deliveryUrl from general viewing. It should only be accessible to the verified buyer on payment status check.
    delete formatted.deliveryUrl;
    return formatted;
  } catch (err) {
    console.error("Error formatting startup:", err);
    return dbStartup;
  }
}

// Helper to create notifications
async function createNotification(userId: number, type: string, title: string, message: string, link?: string) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, link }
    });
    io.to(`user:${userId}`).emit("new_notification", notification);
    return notification;
  } catch (err) {
    console.error("Error creating notification:", err);
  }
}

// Automatic Database Seeding
async function seedDatabase() {
  try {
    const forceReseedCheck = await prisma.startup.findUnique({ where: { id: "notion-pm-template" } });
    if (!forceReseedCheck) {
      console.log("Updating database seeds to support custom category-specific attributes...");
      await prisma.payment.deleteMany({});
      await prisma.idea.deleteMany({});
      await prisma.startup.deleteMany({});
      await prisma.category.deleteMany({});
    }

    const categoryCount = await prisma.category.count();
    const startupCount = await prisma.startup.count();

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
          fields: JSON.stringify([
            { key: 'teamSize', label: 'Jamoa hajmi (kishi)', type: 'number', placeholder: 'Masalan: 5' },
            { key: 'stage', label: 'Loyiha bosqichi', type: 'select', options: ["G'oya", 'Prototip', 'Ishlab chiqarilgan', 'Foydalanuvchilari bor'] },
            { key: 'pitchDeckUrl', label: 'Asoslash hujjati havolasi (Pitch deck)', type: 'text', placeholder: 'Masalan: https://drive.google.com/...' }
          ])
        },
        { 
          id: "ai-prompts", 
          name: "AI Promptlar", 
          icon: "auto_awesome",
          fields: JSON.stringify([
            { key: 'targetAi', label: 'Qaysi AI tizimi uchun', type: 'select', options: ['ChatGPT', 'Midjourney', 'Claude', 'Boshqa'] },
            { key: 'promptsCount', label: 'Promptlar soni', type: 'number', placeholder: 'Masalan: 50' },
            { key: 'language', label: 'Muloqot tili', type: 'select', options: ["o'zbek", "ingliz", "rus"] }
          ])
        },
        { 
          id: "ai-models", 
          name: "AI Modellar/Botlar", 
          icon: "smart_toy",
          fields: JSON.stringify([
            { key: 'framework', label: 'Kutubxona / Framework', type: 'select', options: ['PyTorch', 'TensorFlow', 'Boshqa'] },
            { key: 'modelSize', label: 'Model hajmi', type: 'text', placeholder: 'Masalan: 7B parametr' },
            { key: 'datasetSource', label: 'O\'qitilgan ma\'lumotlar manbai', type: 'text', placeholder: 'Masalan: Common Crawl, Custom dataset' }
          ])
        },
        { 
          id: "sites-apps", 
          name: "Saytlar/Ilovalar", 
          icon: "web",
          fields: JSON.stringify([
            { key: 'hasDomain', label: 'Domen qo\'shiladimi (beriladimi)', type: 'checkbox' },
            { key: 'hasHosting', label: 'Hosting qo\'shiladimi', type: 'checkbox' },
            { key: 'mau', label: 'Oylik faol foydalanuvchi soni', type: 'number', placeholder: 'Masalan: 1200' },
            { key: 'platformType', label: 'Platforma turi', type: 'select', options: ['Web', 'iOS', 'Android'] }
          ])
        },
        { 
          id: "other-digital", 
          name: "Boshqa raqamli mahsulotlar", 
          icon: "category",
          fields: JSON.stringify([
            { key: 'additionalNotes', label: 'Erkin qo\'shimcha izoh maydoni', type: 'text', placeholder: 'Mahsulot haqida qo\'shimcha ma\'lumotlar...' }
          ])
        },
      ];
      for (const cat of categories) {
        await prisma.category.create({ data: cat });
      }
    }

    if (startupCount === 0) {
      console.log("Seeding startups...");
      const startupsToSeed = [
        {
          id: 'ecoflow-systems',
          name: 'EcoFlow Systems',
          slogan: 'Aqlli energiya tejash tizimi',
          description: 'Suyuq metall akkumulyatorlar orqali energiya saqlashni va optimallashtirishni inqilob qilish uchun tayyor dasturiy ta\'minot.',
          longDescription: 'EcoFlow Systems tayyor dasturiy ta\'minot platformasi bo\'lib, u suyuq metall akkumulyator tizimlari va energiyani tejash datchiklari bilan ishlashga mo\'ljallangan. Tizim to\'liq avtomatlashtirilgan veb-boshqaruv paneli va real-vaqt ma\'lumotlar tahlili modulini o\'z ichiga oladi.',
          category: 'startups',
          price: 3500.0,
          listingType: "To'liq loyiha (manba kodi bilan)",
          techStack: JSON.stringify(['React', 'Node.js', 'TypeScript', 'MongoDB']),
          demoUrl: 'https://demo.ecoflow-systems.uz',
          repoIncluded: true,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 8,
          attributes: JSON.stringify({ teamSize: 5, stage: "Ishlab chiqarilgan", pitchDeckUrl: "https://drive.google.com/example-pitch-deck" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCBLeM6mAr4LQY7zhSUG4tgZGKWNWY0ZRNIR_XhEKXt1jYMR02ExWAO3uckrzGgmvC4-PI7N-mHd9C8lXG-OAzJKBufMTKlpfMfSnEeJSF8e7heYGRKgRvFIrQkx5yKj_5vOLNyxFsKl_YskqkjY7SejckUabAB1QVAyOiWRo5Ue_LzWhq9IKtABXo9W9YyYvicDRVKj6KibiQpb0KoyemsI9t8PJjPQ3mmag3a-1LFqV51mgBVDlgsXJ1V6a0DitjRFPeVGsZmp5A',
          gallery: JSON.stringify([
            'https://lh3.googleusercontent.com/aida-public/AB6AXuC7UvHpcwWXajOrLewZmBzhPm5Uv-Wd6Lm_h6ZhtBZXqQtFtgqyctaOis2IfgTi38EFrC78gIUpozdKZ2ChemtUoSy8cvfdmfdQ1rAtcPJbYuSpw3WylcL9wM-U2lspGYA8ALHOYpMOuNVLf1HRqHSZ5wyzNElJZ9_v113hYgEzbh3S0nvU3awIQWEe11yaYYsBOTucYfhOp6p0vDGW2OcePXVkdRx8ES-iFhyKWoEPDl928YZAVLrMPAYfohEwnGjzn3gs0hDIu3c',
            'https://lh3.googleusercontent.com/aida-public/AB6AXuC5bYHvQOPv-4tW9XUYTRj4rDUxmGsS_eah3BcXLjK0nWyPMZoZ-v3KbzYGAdi-6CeJx6uaw0ArpEim2iKQ8APg-B7RNMWCTkgjia5vTujRyPV7GN7juHdzAMwzQSK-CMe_YZLHO09spzlsTT15WKw4lBqk29Z7hzNZ-bI55i57Hp-U-EE0NtkKKWwuzRccqfkvUQmBFKSPFWLy2AJiINQRK0pQpvJ5DLSNC-pkcSI6tyfrGox5GMaXxqFR1NokOScY8cuqFIhM1nE',
            'https://lh3.googleusercontent.com/aida-public/AB6AXuAcj_MixK83pAREjW1ixVYsVkFFps-TAbAYms21dFxcH45932nzy3456R_dfvcY41Eg8i4xuBs7vnzRy8CpyLc4n4VnQF0zIfc70GyJ1F6jf-rtbbHp9ygnTHyeXy7MvN1Jy9XDc2I106sFY0YO8NIv85nxL-IyS6LJ5DiYXkbFXIWj2Tif5OqekyUBK3dp4TCHvPZa4b7FMkTplCbw4CNwkRjXrKiXEZ4B3vF_4TSNCPY4ZaxubrHDqGpbRHoVEF-J0HT7g3WpBiU'
          ]),
          team: JSON.stringify([
            {
              name: 'Dr. Elena Volkov',
              role: 'Bosh direktor va Asoschi (sobiq NASA mutaxassisi)',
              imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDa0O3FIqyMSDgzz8mPwkA1ltnosRkGCZdRiN5vZd8_vOFXQK1hmTgJrHlg-GHTA7y3RMj6QT4Pe4tMi62J2TFz6rwTULoRE0PgU7_FfUfVDClc_IaH7rgsnBDXDa30re2u0RBFIA5wQsaYt15hLy87ZqDxQraeL0ggL2mC1uuRU9YJohPKwXik8dgH_vZ4bicEBoqfBet8NibIWqfbasbwF5klMWT_som2kgy6uB5H9NWzVYG7Vt5frYENjeljTZR6h8b1OYYsAzI'
            },
            {
              name: 'Marcus Thorne',
              role: 'Operatsion direktor (sobiq Siemens mutaxassisi)',
              imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBz9aPMR2g5XPr_QbhNFTyVHgVmu_1mgoupRnrXwKMzVctBUrGwMcvfEa8sJS8y_LOedViZpfpXhhCxxQuH569zSHsMA5RNxR3r7mawbPtJ8xeo4nN1Zg2RNyltsvYPUSZ8PruLfpgb_BXVB8hYn1NjJEqyyIOjcJUi9ACG13nhyFwttyrCF-gH-TFLBJMy_sx2L-Fv-r2CSV5dD4U0b2eHRehqxE1MNc1HlxQSFfLtzUqQN4ryaB6FWF5yzrvkGOpioPWB_3aby0'
            }
          ]),
          milestones: JSON.stringify([
            {
              date: '2025',
              title: 'Tizim to\'liq yakunlandi',
              desc: 'Veb boshqaruv paneli va API integratsiyalari 100% tayyor.'
            }
          ]),
          contactEmail: 'contact@ecoflow.com',
          contactPhone: '+998 90 999 88 77',
          contactTelegram: 'ecoflow_systems',
          dateCreated: '2025-10-15',
        },
        {
          id: 'neuralpath-ai',
          name: 'NeuralPath AI',
          slogan: 'Sun\'iy Intellekt SaaS marshrutizator',
          description: 'Bashorat qiluvchi neyron tarmoqlari yordamida logistika marshrutlarini avtomatlashtirish uchun tayyor B2B yechim.',
          longDescription: 'NeuralPath AI logistika kompaniyalari uchun tayyor SaaS platformadir. Sun\'iy intellekt yordamida yuklarni eng tezkor va arzon yo\'nalishlar bo\'ylab real vaqt rejimida taqsimlaydi.',
          category: 'ai-models',
          price: 2200.0,
          listingType: 'Litsenziya/foydalanish huquqi sotiladi',
          techStack: JSON.stringify(['Python', 'FastAPI', 'TensorFlow', 'React']),
          demoUrl: 'https://neuralpath.ai/demo',
          repoIncluded: false,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 12,
          attributes: JSON.stringify({ framework: "TensorFlow", modelSize: "12B parametr", datasetSource: "Common Crawl & Custom logistika ma'lumotlari" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCF45geSO_QnC7nqx9b1yE0o1OYJZfrQnJjhANEdEVR8j-Ok2uwdCi8i8krhY_znOddGypsTbhhHierRgRTTKZ8T5krtxryW14MYjVW8LkZOw_oWJQkpETrnyoqvf-qLgl8ghvPsyc8u_IevPYo_bB7N0QDQng-xfzBwPFGAqLC9mU0UHebbsEAylgPdrBrN1e7j3ZoWCnjcJvypu4PUDfCdymvx6ozFz1oGPXG-ahwonvmeg-FPTQr5ecTEGXmM8xrWKatwsrYd38',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Alex Volkov', role: 'Asoschi va Bosh direktor', imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBki15-UiKMRHYRIBQdJTisfKqtSaYpxsncBO2y7YCY2JF255CApBYI6utaNMs1ChYUgtjn2tVfN1UcBGeBMlrJcc0TSK_r8Jcvi6roPh2Lw0AS9w0cQ2Fdo0oveTBUKZZzwCFWAVdbOg2YdRT_sg6_3OM_9HWxgw2p30u4Xgo6ypFGg57R-lBH42CqeD35KOqUZO5WHjOWlQ8A0isb4DXS32bS75MTekwYi9pN7vxQuETi_viEAdQshVhB4cCztZM-qT5BirtAcwA' }
          ]),
          milestones: JSON.stringify([
            { date: '2025', title: 'Beta yakunlandi', desc: 'Real mijozlar bilan test sinovlari muvaffaqiyatli yakunlandi.' }
          ]),
          contactEmail: 'alex@neuralpath.ai',
          contactPhone: '+998 90 111 22 33',
          contactTelegram: 'neuralpath',
          dateCreated: '2025-11-01',
        },
        {
          id: 'greenhorizon',
          name: 'GreenHorizon',
          slogan: 'Vertikal dehqonchilikni boshqarish dasturi',
          description: 'Shahar sharoitidagi vertikal issiqxonalar va dehqonchilikni boshqarish uchun avtomatlashtirilgan IoT veb-tizimi.',
          longDescription: 'Gidroponika va LED yorug\'lik datchiklarini boshqaruvchi tayyor veb-dastur. Suv va mineral dori sarfini to\'liq nazorat qiluvchi va tahliliy hisobotlar beruvchi tizim.',
          category: 'sites-apps',
          price: 1500.0,
          listingType: "To'liq loyiha (manba kodi bilan)",
          techStack: JSON.stringify(['React Native', 'Firebase', 'Node.js']),
          demoUrl: 'https://greenhorizon.demo',
          repoIncluded: true,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 2,
          attributes: JSON.stringify({ hasDomain: true, hasHosting: true, mau: 1500, platformType: "Web" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDeo1QEZB3qsN2ZprfjyOyswyYLfkz1a08UVHqDgxJmvL0uH9hb9FERAoR3YT1TKz3gVygZFDMVmf8GtFmmKAWoy8l8hYNBMgCXJO5eOELpsqkrmlOTx8_Kv0SNQgzrQdLO8T8gWHx_yhBY9cjMKcDFuwEClzXyk59T84i-WAy9bVTWlws4PFdUABOTU6RVtWzLxcCKbPsswQXW7-xRdxhHWeL9BnGfMU7ug1iBH1FM-_S-oGmUZnuLD5CTbP6FtFKh-D3tFfqcZAU',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Elena Green', role: 'Bosh botanik', imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDa0O3FIqyMSDgzz8mPwkA1ltnosRkGCZdRiN5vZd8_vOFXQK1hmTgJrHlg-GHTA7y3RMj6QT4Pe4tMi62J2TFz6rwTULoRE0PgU7_FfUfVDClc_IaH7rgsnBDXDa30re2u0RBFIA5wQsaYt15hLy87ZqDxQraeL0ggL2mC1uuRU9YJohPKwXik8dgH_vZ4bicEBoqfBet8NibIWqfbasbwF5klMWT_som2kgy6uB5H9NWzVYG7Vt5frYENjeljTZR6h8b1OYYsAzI' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'grow@greenhorizon.com',
          contactPhone: '+998 90 222 33 44',
          contactTelegram: 'greenhorizon',
          dateCreated: '2025-05-10',
        },
        {
          id: 'pulsemetrics',
          name: 'PulseMetrics',
          slogan: 'Shifokorlar va bemorlar uchun telemeditsina portali',
          description: 'Masofadan turib bemorlar holatini monitoring qilish, shifokorlar bilan chat va video-aloqa o\'rnatish uchun tayyor portal.',
          longDescription: 'PulseMetrics - bu kardiologiya va umumiy tibbiy diagnostika qurilmalari bilan integratsiyalashuvchi telemeditsina veb-ilovasi. Shifokorlar uchun qulay tahliliy interfeys va bemorlar uchun shaxsiy kabinetga ega.',
          category: 'sites-apps',
          price: 4800.0,
          listingType: "To'liq loyiha (manba kodi bilan)",
          techStack: JSON.stringify(['React', 'Golang', 'PostgreSQL', 'WebRTC']),
          demoUrl: 'https://pulsemetrics.demo',
          repoIncluded: true,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 23,
          attributes: JSON.stringify({ hasDomain: true, hasHosting: false, mau: 4200, platformType: "Web" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC7XHcXHljRMitx-T_JK9v3n3twmEJVTF8yMrrFKUbhr4QMI1FGA4xHmQ2BtWdAu7DLdC4WfpfD-VKKZHVF4Go1i_22DfnJ5GKPU-UBzX0jc2C-AcnPq-kDL_rxc_688C5BUszuQjCfDBqWeX187X-vj92id9OJ2EpA-Nm4AkfzerDAj1F3MsuV25DYOBAbgb4G4pNWKXj8lRIvJcrTdMw5sfFoPzZumIBzTUqg6O3BlhUkZ7LWN-CjdA54Qqn8Sx9JydeXWVr16BE',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Dr. John Doe', role: 'Bosh tibbiy xodim', imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDBz9aPMR2g5XPr_QbhNFTyVHgVmu_1mgoupRnrXwKMzVctBUrGwMcvfEa8sJS8y_LOedViZpfpXhhCxxQuH569zSHsMA5RNxR3r7mawbPtJ8xeo4nN1Zg2RNyltsvYPUSZ8PruLfpgb_BXVB8hYn1NjJEqyyIOjcJUi9ACG13nhyFwttyrCF-gH-TFLBJMy_sx2L-Fv-r2CSV5dD4U0b2eHRehqxE1MNc1HlxQSFfLtzUqQN4ryaB6FWF5yzrvkGOpioPWB_3aby0' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'support@pulsemetrics.io',
          contactPhone: '+998 90 333 44 55',
          contactTelegram: 'pulsemetrics_io',
          dateCreated: '2025-01-20',
        },
        {
          id: 'quantumpay-ai',
          name: 'QuantumPay AI',
          slogan: 'Ko\'p valyutali crypto to\'lov shlyuzi kodi',
          description: 'Onlayn do\'konlar va SaaS ilovalar uchun USDT va boshqa kriptovalyutalarda to\'lovlarni qabul qilish shlyuzi (API integration).',
          longDescription: 'QuantumPay AI tayyor kripto to\'lov infratuzilmasi hisoblanadi. O\'z ichiga API hujjatlari, barcha tillar uchun SDK-lar va tranzaksiyalarny boshqarish bo\'yicha admin panelni oladi.',
          category: 'sites-apps',
          price: 8500.0,
          listingType: "To'liq loyiha (manba kodi bilan)",
          techStack: JSON.stringify(['Next.js', 'Solidity', 'Express', 'Prisma']),
          demoUrl: 'https://quantumpay.ai/demo',
          repoIncluded: true,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 12,
          attributes: JSON.stringify({ hasDomain: true, hasHosting: true, mau: 8900, platformType: "Web" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCF45geSO_QnC7nqx9b1yE0o1OYJZfrQnJjhANEdEVR8j-Ok2uwdCi8i8krhY_znOddGypsTbhhHierRgRTTKZ8T5krtxryW14MYjVW8LkZOw_oWJQkpETrnyoqvf-qLgl8ghvPsyc8u_IevPYo_bB7N0QDQng-xfzBwPFGAqLC9mU0UHebbsEAylgPdrBrN1e7j3ZoWCnjcJvypu4PUDfCdymvx6ozFz1oGPXG-ahwonvmeg-FPTQr5ecTEGXmM8xrWKatwsrYd38',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Alex Volkov', role: 'Asoschi', imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBki15-UiKMRHYRIBQdJTisfKqtSaYpxsncBO2y7YCY2JF255CApBYI6utaNMs1ChYUgtjn2tVfN1UcBGeBMlrJcc0TSK_r8Jcvi6roPh2Lw0AS9w0cQ2Fdo0oveTBUKZZzwCFWAVdbOg2YdRT_sg6_3OM_9HWxgw2p30u4Xgo6ypFGg57R-lBH42CqeD35KOqUZO5WHjOWlQ8A0isb4DXS32bS75MTekwYi9pN7vxQuETi_viEAdQshVhB4cCztZM-qT5BirtAcwA' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'contact@quantumpay.ai',
          contactPhone: '+998 90 444 55 66',
          contactTelegram: 'quantumpay',
          dateCreated: '2025-08-12',
        },
        {
          id: 'greenlogistics',
          name: 'GreenLogistics',
          slogan: 'Kuryerlar uchun yo\'nalishlarni optimallashtiruvchi mobil ilova kodi',
          description: 'Zararli chiqindilarsiz elektromobillar parkini boshqarish va yo\'nalishlarni taqsimlash uchun algoritmlangan mobil ilova loyihasi.',
          longDescription: 'GreenLogistics kuryerlik kompaniyalari uchun optimallashtirilgan marshrutlash drayveri va mobil ilova loyihasidir. GPS telemetriyasi va kuryerlar navbatini hisobga oladi.',
          category: 'startups',
          price: 1250.0,
          listingType: 'Litsenziya/foydalanish huquqi sotiladi',
          techStack: JSON.stringify(['Python', 'Django', 'React Native', 'PostgreSQL']),
          demoUrl: 'https://greenlogistics.demo',
          repoIncluded: false,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 0,
          attributes: JSON.stringify({ teamSize: 4, stage: "Foydalanuvchilari bor", pitchDeckUrl: "https://drive.google.com/greenlogistics-pitch" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCF45geSO_QnC7nqx9b1yE0o1OYJZfrQnJjhANEdEVR8j-Ok2uwdCi8i8krhY_znOddGypsTbhhHierRgRTTKZ8T5krtxryW14MYjVW8LkZOw_oWJQkpETrnyoqvf-qLgl8ghvPsyc8u_IevPYo_bB7N0QDQng-xfzBwPFGAqLC9mU0UHebbsEAylgPdrBrN1e7j3ZoWCnjcJvypu4PUDfCdymvx6ozFz1oGPXG-ahwonvmeg-FPTQr5ecTEGXmM8xrWKatwsrYd38',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Alex Volkov', role: 'Asoschi', imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBki15-UiKMRHYRIBQdJTisfKqtSaYpxsncBO2y7YCY2JF255CApBYI6utaNMs1ChYUgtjn2tVfN1UcBGeBMlrJcc0TSK_r8Jcvi6roPh2Lw0AS9w0cQ2Fdo0oveTBUKZZzwCFWAVdbOg2YdRT_sg6_3OM_9HWxgw2p30u4Xgo6ypFGg57R-lBH42CqeD35KOqUZO5WHjOWlQ8A0isb4DXS32bS75MTekwYi9pN7vxQuETi_viEAdQshVhB4cCztZM-qT5BirtAcwA' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'hello@greenlogistics.io',
          contactPhone: '+998 90 555 66 77',
          contactTelegram: 'greenlogistics_uz',
          dateCreated: '2025-09-01',
        },
        {
          id: 'retroarcade-io',
          name: 'RetroArcade.io',
          slogan: 'Web3 o\'yin portali va retro arcade o\'yinlar to\'plami',
          description: 'Yuqori sifatli piksel-art sarguzashtlari va NFT aktivlariga ega brauzer o\'yinlari platformasi kodi.',
          longDescription: 'RetroArcade.io muvaffaqiyatli sotilgan loyihadir. Dastlab to\'liq raqamli kolleksiya elementlariga ega bo\'lgan brauzer o\'yin portali sifatida qurilgan.',
          category: 'sites-apps',
          price: 950.0,
          listingType: "To'liq loyiha (manba kodi bilan)",
          techStack: JSON.stringify(['HTML5', 'Phaser', 'Web3JS']),
          demoUrl: 'https://retroarcade.io/play',
          repoIncluded: true,
          soldStatus: 'sotildi',
          status: 'active',
          proposalsCount: 32,
          attributes: JSON.stringify({ hasDomain: true, hasHosting: true, mau: 15000, platformType: "Web" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCF45geSO_QnC7nqx9b1yE0o1OYJZfrQnJjhANEdEVR8j-Ok2uwdCi8i8krhY_znOddGypsTbhhHierRgRTTKZ8T5krtxryW14MYjVW8LkZOw_oWJQkpETrnyoqvf-qLgl8ghvPsyc8u_IevPYo_bB7N0QDQng-xfzBwPFGAqLC9mU0UHebbsEAylgPdrBrN1e7j3ZoWCnjcJvypu4PUDfCdymvx6ozFz1oGPXG-ahwonvmeg-FPTQr5ecTEGXmM8xrWKatwsrYd38',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Alex Volkov', role: 'Asoschi', imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBki15-UiKMRHYRIBQdJTisfKqtSaYpxsncBO2y7YCY2JF255CApBYI6utaNMs1ChYUgtjn2tVfN1UcBGeBMlrJcc0TSK_r8Jcvi6roPh2Lw0AS9w0cQ2Fdo0oveTBUKZZzwCFWAVdbOg2YdRT_sg6_3OM_9HWxgw2p30u4Xgo6ypFGg57R-lBH42CqeD35KOqUZO5WHjOWlQ8A0isb4DXS32bS75MTekwYi9pN7vxQuETi_viEAdQshVhB4cCztZM-qT5BirtAcwA' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'support@retroarcade.io',
          contactPhone: '+998 90 666 77 88',
          contactTelegram: 'retroarcade',
          dateCreated: '2025-04-05',
        },
        {
          id: 'ecommerce-prompts',
          name: 'E-Commerce Marketing Prompt Pack',
          slogan: 'Savdo va konversiyani oshiruvchi 150+ professional promptlar',
          description: 'Onlayn do\'konlar va raqamli marketologlar uchun maxsus optimallashtirilgan, sotuvlarni oshiruvchi tayyor ChatGPT promptlari to\'plami.',
          longDescription: 'E-Commerce Marketing Prompt Pack - marketing kampaniyalarini avtomatlashtirish, yuqori konversiyali reklama matnlari yozish va mahsulot tavsiflarini SEO-optimallashtirish uchun eng mukammal va sinovdan o\'tgan promptlar to\'plamidir.',
          category: 'ai-prompts',
          price: 150.0,
          listingType: 'Litsenziya/foydalanish huquqi sotiladi',
          techStack: JSON.stringify(['ChatGPT', 'Midjourney', 'Claude', 'Copywriting']),
          demoUrl: '',
          repoIncluded: false,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 3,
          attributes: JSON.stringify({ targetAi: "ChatGPT", promptsCount: 150, language: "o'zbek" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCBLeM6mAr4LQY7zhSUG4tgZGKWNWY0ZRNIR_XhEKXt1jYMR02ExWAO3uckrzGgmvC4-PI7N-mHd9C8lXG-OAzJKBufMTKlpfMfSnEeJSF8e7heYGRKgRvFIrQkx5yKj_5vOLNyxFsKl_YskqkjY7SejckUabAB1QVAyOiWRo5Ue_LzWhq9IKtABXo9W9YyYvicDRVKj6KibiQpb0KoyemsI9t8PJjPQ3mmag3a-1LFqV51mgBVDlgsXJ1V6a0DitjRFPeVGsZmp5A',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Jasur Mavlonov', role: 'Bosh Prompt Injener', imgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jasur' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'jasur@marketing-prompts.uz',
          contactPhone: '+998 93 456 78 90',
          contactTelegram: 'prompt_king',
          dateCreated: '2026-03-10',
        },
        {
          id: 'design-kit-3d',
          name: 'Minimalist Dashboard 3D & UI Kit',
          slogan: 'Professional Figma UI Kit va Blender 3D elementlar',
          description: 'Loyiha boshqaruvi va SaaS platformalar uchun tayyor minimalist dizayn tizimi hamda yuqori sifatli Blender (.blend) 3D renderlari.',
          longDescription: 'Ushbu paket zamonaviy veb-ilova va veb-saytlar yaratish uchun 50 dan ortiq tayyor UI komponentlar, to\'liq moslashuvchan Figma dizayn tizimi hamda mukammal darajadagi Blender 3D render va model fayllaridan tashkil topgan.',
          category: 'other-digital',
          price: 250.0,
          listingType: "Manba kodisiz tayyor mahsulot",
          techStack: JSON.stringify(['Figma', 'Blender', 'UI/UX', '3D Modeling']),
          demoUrl: 'https://figma.com/community/file/example',
          repoIncluded: true,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 1,
          attributes: JSON.stringify({ additionalNotes: "MIT litsenziyasi ostidagi to'liq Figma va Blender (.blend) manba fayllarini o'z ichiga oladi." }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCF45geSO_QnC7nqx9b1yE0o1OYJZfrQnJjhANEdEVR8j-Ok2uwdCi8i8krhY_znOddGypsTbhhHierRgRTTKZ8T5krtxryW14MYjVW8LkZOw_oWJQkpETrnyoqvf-qLgl8ghvPsyc8u_IevPYo_bB7N0QDQng-xfzBwPFGAqLC9mU0UHebbsEAylgPdrBrN1e7j3ZoWCnjcJvypu4PUDfCdymvx6ozFz1oGPXG-ahwonvmeg-FPTQr5ecTEGXmM8xrWKatwsrYd38',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Diana Smith', role: 'UI/UX & 3D Artist', imgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Diana' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'diana@creative-kits.com',
          contactPhone: '+998 94 987 65 43',
          contactTelegram: 'diana_designs',
          dateCreated: '2026-05-15',
        },
        {
          id: 'uztranslate-ai-bot',
          name: 'UzTranslate AI Bot',
          slogan: "O'zbek tili uchun mukammal neyron tarjima boti kodi",
          description: "O'zbek tilidagi shevalar va madaniy kontekstni tushunadigan Telegram/Web neyron tarjima boti manba kodi.",
          longDescription: "UzTranslate AI Bot - bu o'zbek tilining o'ziga xos xususiyatlari, mahalliy shevalar va frazeologizmlarni mukammal tushunadigan, sun'iy intellektga asoslangan tarjimon tizimi. Telegram bot va veb-interfeys ko'rinishida to'liq tayyorlangan.",
          category: 'ai-models',
          price: 950.0,
          listingType: "To'liq loyiha (manba kodi bilan)",
          techStack: JSON.stringify(['Python', 'PyTorch', 'Telegram API', 'FastAPI']),
          demoUrl: 'https://t.me/uztranslate_demo_bot',
          repoIncluded: true,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 2,
          attributes: JSON.stringify({ framework: "PyTorch", modelSize: "3B parametr", datasetSource: "Uzbek Wikipedia & Parallel Corpora" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCBLeM6mAr4LQY7zhSUG4tgZGKWNWY0ZRNIR_XhEKXt1jYMR02ExWAO3uckrzGgmvC4-PI7N-mHd9C8lXG-OAzJKBufMTKlpfMfSnEeJSF8e7heYGRKgRvFIrQkx5yKj_5vOLNyxFsKl_YskqkjY7SejckUabAB1QVAyOiWRo5Ue_LzWhq9IKtABXo9W9YyYvicDRVKj6KibiQpb0KoyemsI9t8PJjPQ3mmag3a-1LFqV51mgBVDlgsXJ1V6a0DitjRFPeVGsZmp5A',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Sardor Rahimov', role: 'AI muhandis', imgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sardor' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'sardor@uztranslate.ai',
          contactPhone: '+998 90 777 66 55',
          contactTelegram: 'uztranslate_dev',
          dateCreated: '2026-04-18',
        },
        {
          id: 'midjourney-realistic-prompts',
          name: 'Midjourney Ultra-Realistic Photo Prompt Pack',
          slogan: 'Ultra-realistik portretlar va tabiat rasmlari uchun 50+ prompt',
          description: "Midjourney v6 uchun optimallashtirilgan, mukammal yoritish va kameralar sozlamalariga ega professional vizual promptlar to'plami.",
          longDescription: "Midjourney Ultra-Realistic Photo Prompt Pack - bu reklama, dizayn va ijtimoiy tarmoqlar uchun mukammal sifatdagi tasvirlarni yaratishga yordam beradigan professional promptlar to'plamidir. Har bir prompt batafsil parametrlar va namuna rasmlari bilan taqdim etiladi.",
          category: 'ai-prompts',
          price: 80.0,
          listingType: 'Litsenziya/foydalanish huquqi sotiladi',
          techStack: JSON.stringify(['Midjourney', 'AI Art', 'Prompt Engineering']),
          demoUrl: '',
          repoIncluded: false,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 0,
          attributes: JSON.stringify({ targetAi: "Midjourney", promptsCount: 50, language: "ingliz" }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCF45geSO_QnC7nqx9b1yE0o1OYJZfrQnJjhANEdEVR8j-Ok2uwdCi8i8krhY_znOddGypsTbhhHierRgRTTKZ8T5krtxryW14MYjVW8LkZOw_oWJQkpETrnyoqvf-qLgl8ghvPsyc8u_IevPYo_bB7N0QDQng-xfzBwPFGAqLC9mU0UHebbsEAylgPdrBrN1e7j3ZoWCnjcJvypu4PUDfCdymvx6ozFz1oGPXG-ahwonvmeg-FPTQr5ecTEGXmM8xrWKatwsrYd38',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Diana Smith', role: 'Digital Artist & Prompt Expert', imgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Diana' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'diana@creative-prompts.com',
          contactPhone: '+998 91 123 45 67',
          contactTelegram: 'diana_prompts',
          dateCreated: '2026-06-01',
        },
        {
          id: 'notion-pm-template',
          name: 'Tayyor Notion shabloni: loyiha boshqaruvi',
          slogan: 'Kichik jamoalar va frilanserlar uchun Notion loyiha boshqaruv shabloni',
          description: 'Kanban doskasi, vaqtni kuzatish, moliyaviy hisobot va mijozlar bazasini o\'z ichiga olgan mukammal Notion tizimi.',
          longDescription: "Ushbu Notion shabloni frilanserlar, startaplar va kichik jamoalar uchun loyihalarni samarali boshqarish, vazifalar taqsimoti, oylik/yillik moliyaviy hisob-kitoblar va mijozlar bilan aloqalarni (CRM) bitta joyda jamlash uchun mo'ljallangan.",
          category: 'other-digital',
          price: 45.0,
          listingType: 'Litsenziya/foydalanish huquqi sotiladi',
          techStack: JSON.stringify(['Notion', 'Productivity', 'Templates', 'Project Management']),
          demoUrl: 'https://notion.so/templates/example-pm',
          repoIncluded: false,
          soldStatus: 'sotuvda',
          status: 'active',
          proposalsCount: 5,
          attributes: JSON.stringify({ additionalNotes: "O'zbek tiliga to'liq moslashtirilgan va foydalanish bo'yicha batafsil video-yo'riqnoma bilan birga taqdim etiladi." }),
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCBLeM6mAr4LQY7zhSUG4tgZGKWNWY0ZRNIR_XhEKXt1jYMR02ExWAO3uckrzGgmvC4-PI7N-mHd9C8lXG-OAzJKBufMTKlpfMfSnEeJSF8e7heYGRKgRvFIrQkx5yKj_5vOLNyxFsKl_YskqkjY7SejckUabAB1QVAyOiWRo5Ue_LzWhq9IKtABXo9W9YyYvicDRVKj6KibiQpb0KoyemsI9t8PJjPQ3mmag3a-1LFqV51mgBVDlgsXJ1V6a0DitjRFPeVGsZmp5A',
          gallery: JSON.stringify([]),
          team: JSON.stringify([
            { name: 'Abdurahmon G\'ofurov', role: 'No-Code Ishlab Chiquvchi', imgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Abdu' }
          ]),
          milestones: JSON.stringify([]),
          contactEmail: 'abdu@notion-dev.uz',
          contactPhone: '+998 95 900 80 70',
          contactTelegram: 'notion_master_uz',
          dateCreated: '2026-07-02',
        }
      ];

      console.log(`Seeding ${startupsToSeed.length} startups...`);
      for (const startup of startupsToSeed) {
        try {
          // Attempt normal creation
          await prisma.startup.create({ data: startup as any });
        } catch (error: any) {
          // Handle case where DB column might be missing (e.g. currentTier)
          const errorMessage = error.message || "";
          if (errorMessage.includes('currentTier') || errorMessage.includes('column')) {
            console.warn(`[Seed Warning] Column issue for ${startup.id}. Retrying without 'currentTier'...`);
            const { currentTier, ...dataWithoutTier } = startup as any;
            await prisma.startup.create({ data: dataWithoutTier }).catch(e => {
              console.error(`[Seed Error] Failed to seed ${startup.id} even without currentTier:`, e.message);
            });
          } else if (error.code === 'P2002') {
            // Unique constraint violation (already exists) - ignore
            console.log(`[Seed Info] Startup ${startup.id} already exists, skipping.`);
          } else {
            console.error(`[Seed Error] Unexpected error for ${startup.id}:`, error.message);
          }
        }
      }
      console.log("Database seeded successfully!");
    }
  } catch (err) {
    console.error("Failed to automatically seed database:", err);
  }
}

// Authentication Middleware
interface AuthRequest extends Request {
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

async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Kirish ruxsati berilmadi. Token topilmadi." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
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

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Yaroqsiz yoki muddati o'tgan token." });
  }
}

// TOP narxini talabga qarab hisoblash (dinamik narx)
async function calculateTopPrice(days: number) {
  const basePrice = parseFloat(await getSetting("TOP_BASE_PRICE_PER_DAY") || "1");
  const maxSlots = parseInt(await getSetting("TOP_MAX_CONCURRENT_SLOTS") || "20");
  const activeCount = await prisma.startup.count({ 
    where: { 
      isTop: true, 
      topExpiresAt: { gt: new Date() } 
    } 
  });
  
  // Talab ko'p bo'lsa (faol TOP'lar ko'p bo'lsa) — narx oshadi
  const demandMultiplier = 1 + (activeCount / maxSlots);
  return Math.round(basePrice * demandMultiplier * days * 100) / 100;
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

// Email Verification Helper Function
async function sendVerificationEmail(email: string, token: string, name: string) {
  const appUrl = await getSetting("APP_URL") || "http://localhost:3000";
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;
  console.log("==================================================");
  console.log(`VERIFICATION EMAIL TO ${email} [${name}]:`);
  console.log(`Link: ${verifyUrl}`);
  console.log("==================================================");

  // SMTP Settings
  const smtpHost = await getSetting("SMTP_HOST");
  const rawSmtpPort = await getSetting("SMTP_PORT");
  const smtpPort = rawSmtpPort ? parseInt(rawSmtpPort) : 587;
  const smtpUser = await getSetting("SMTP_USER");
  const smtpPass = await getSetting("SMTP_PASS");

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"Savdo24 Support" <${smtpUser}>`,
        to: email,
        subject: "Savdo24 — Email manzilingizni tasdiqlang",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #0d131a; color: #ffffff;">
            <h2 style="color: #10b981; text-align: center;">Savdo24-ga xush kelibsiz!</h2>
            <p>Salom <strong>${name}</strong>,</p>
            <p>Savdo24 platformasida muvaffaqiyatli ro'yxatdan o'tganingiz uchun rahmat. Hisobingizni faollashtirish va barcha imkoniyatlardan foydalanish uchun quyidagi havola orqali email manzilingizni tasdiqlang:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Emailni tasdiqlash</a>
            </div>
            <p style="font-size: 12px; color: #8892b0;">Agar tugma ishlamasa, ushbu havolani brauzeringizga nusxalab joylashtiring:</p>
            <p style="font-size: 12px; color: #10b981; word-break: break-all;">${verifyUrl}</p>
            <hr style="border: none; border-top: 1px solid #18202c; margin: 20px 0;" />
            <p style="font-size: 11px; color: #8892b0; text-align: center;">Savdo24 — Startaplar, AI va raqamli mahsulotlar bozori</p>
          </div>
        `,
      });
      console.log(`Email successfully sent to ${email}`);
    } catch (err: any) {
      console.error("Failed to send email via SMTP:", err.message);
    }
  } else {
    console.log("SMTP not configured in env variables, verification email printed to console.");
  }
}

// Refresh Token Helper
async function generateRefreshToken(userId: number, req: Request): Promise<string> {
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

// JWT AUTH: Register
app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Ushbu email orqali ro'yxatdan o'tilgan." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = "Xaridor";
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole,
        joinDate: new Date().toLocaleDateString("uz-UZ", { year: "numeric", month: "long" }) + "-yil",
        avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
        verified: false,
        emailVerified: false,
        verificationToken,
      },
    });

    // Send verification email in background
    sendVerificationEmail(user.email, verificationToken, user.name).catch(console.error);

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = await generateRefreshToken(user.id, req);

    // Set cookie (storing accessToken with 15m age)
    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(201).json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
        emailVerified: user.emailVerified,
        joinDate: user.joinDate,
        avatarUrl: user.avatarUrl,
        walletConnected: user.walletConnected,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
});

// JWT AUTH: Login
app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email va parolni kiriting." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "Email yoki parol noto'g'ri." });
    }

    const isMatch = user.password && await bcrypt.compare(password, user.password);
    if (!isMatch) {
      if (user.authProvider === 'google') {
        return res.status(400).json({ error: "Bu hisob Google orqali ro'yxatdan o'tgan, iltimos Google tugmasi orqali kiring." });
      }
      return res.status(400).json({ error: "Email yoki parol noto'g'ri." });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "Sizning hisobingiz bloklangan. Qo'shimcha ma'lumot uchun qo'llab-quvvatlash xizmatiga murojaat qiling." });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = await generateRefreshToken(user.id, req);

    // Set cookie
    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({
      token: accessToken,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
        emailVerified: user.emailVerified,
        joinDate: user.joinDate,
        avatarUrl: user.avatarUrl,
        walletConnected: user.walletConnected,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
});

app.post("/api/auth/google", async (req: Request, res: Response) => {
  const { credential } = req.body;
  const client = getGoogleClient();
  if (!client) {
    return res.status(500).json({ error: "Google Auth konfiguratsiyasi serverda mavjud emas." });
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
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
          avatarUrl: payload.picture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${payload.email}`,
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

    res.json({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Google orqali kirish muvaffaqiyatsiz bo'ldi." });
  }
});

// POST /api/auth/forgot-password — Parolni tiklash so'rovi
app.post("/api/auth/forgot-password", passwordResetLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email manzilini kiritish majburiy." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "Ushbu email manzili bilan foydalanuvchi topilmadi." });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "Sizning hisobingiz bloklangan. Parolni tiklash imkoniyati cheklangan." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry
      }
    });

    const appUrl = await getSetting("APP_URL") || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const smtpHost = await getSetting("SMTP_HOST");
    const rawSmtpPort = await getSetting("SMTP_PORT");
    const smtpPort = rawSmtpPort ? parseInt(rawSmtpPort) : 587;
    const smtpUser = await getSetting("SMTP_USER");
    const smtpPass = await getSetting("SMTP_PASS");

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"Savdo24 Support" <${smtpUser}>`,
        to: email,
        subject: "Savdo24 — Parolni qayta tiklash",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #0d131a; color: #ffffff;">
            <h2 style="color: #10b981; text-align: center;">Parolni qayta tiklash so'rovi</h2>
            <p>Salom <strong>${user.name}</strong>,</p>
            <p>Siz Savdo24 platformasida parolingizni unutganingiz sababli tiklash so'rovini yubordingiz. Parolingizni qayta tiklash uchun quyidagi tugmani bosing:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Parolni yangilash</a>
            </div>
            <p>Ushbu havola faqat 1 soat davomida amal qiladi.</p>
            <p style="font-size: 12px; color: #8892b0;">Agar siz bunday so'rov yubormagan bo'lsangiz, ushbu xatni shunchaki e'tiborsiz qoldiring.</p>
            <p style="font-size: 12px; color: #10b981; word-break: break-all;">${resetUrl}</p>
            <hr style="border: none; border-top: 1px solid #18202c; margin: 20px 0;" />
            <p style="font-size: 11px; color: #8892b0; text-align: center;">Savdo24 — Startaplar va raqamli loyihalar bozori</p>
          </div>
        `,
      });
      console.log(`Reset password link sent to ${email}`);
    } else {
      console.log("SMTP configured locally: reset url is:", resetUrl);
    }

    res.json({ success: true, message: "Parolni tiklash havolasi email manzilingizga yuborildi.", token });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Parolni tiklash so'rovida xatolik yuz berdi." });
  }
});

// POST /api/auth/reset-password — Yangi parolni saqlash
app.post("/api/auth/reset-password", passwordResetLimiter, async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: "Token va yangi parol kiritilishi shart." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: "Yaroqsiz yoki muddati o'tgan havola." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ success: true, message: "Parolingiz muvaffaqiyatli o'zgartirildi. Endi tizimga yangi parol bilan kirishingiz mumkin." });
  } catch (err: any) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Parolni yangilashda xatolik yuz berdi." });
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

    const totalEarnings = completedSales.reduce((acc: number, p: any) => acc + (p.sellerPayoutAmount || 0), 0);

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
      include: { buyer: true, startup: true },
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

// --- ANALYTICS ---

app.post("/api/analytics/track", async (req: Request, res: Response) => {
  const { event, targetId, source, metadata } = req.body;
  // Get userId from token if exists
  let userId: number | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.id;
    } catch {}
  }

  await trackEvent(event, userId, targetId, source, metadata);
  res.json({ success: true });
});

// --- AI FEATURES ---

app.get("/api/ai/price-suggestion", async (req: Request, res: Response) => {
  const { category, features } = req.query;
  const featuresList = typeof features === 'string' ? JSON.parse(features) : [];

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
      avgPrice = similar.reduce((sum: number, s: any) => sum + s.price, 0) / similar.length;
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

// --- ESCROW SYSTEM ---

app.get("/api/escrow/my-purchases", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const escrows = await prisma.escrowPayment.findMany({
      where: { payment: { userId: req.user?.id } },
      include: { payment: true }
    });
    res.json(escrows);
  } catch (err) {
    res.status(500).json({ error: "Escrow ma'lumotlarini yuklashda xatolik." });
  }
});

app.post("/api/escrow/release", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { paymentId } = req.body;
  try {
    const escrow = await prisma.escrowPayment.findUnique({
      where: { paymentId },
      include: { payment: { include: { startup: true } } }
    });

    if (!escrow || escrow.payment.userId !== req.user?.id) {
      return res.status(403).json({ error: "Ruxsat etilmagan." });
    }

    if (escrow.status !== "held") {
      return res.status(400).json({ error: "Escrow holati noto'g'ri." });
    }

    await prisma.escrowPayment.update({
      where: { id: escrow.id },
      data: { status: "released", releasedAt: new Date() }
    });

    // Notify seller
    if (escrow.payment.startup?.userId) {
      await createNotification(
        escrow.payment.startup.userId,
        "SYSTEM",
        "Mablag' ozod qilindi!",
        `Sizning "${escrow.payment.startup.name}" loyihangiz uchun mablag' xaridor tomonidan tasdiqlandi va ozod qilindi.`,
        `/profile`
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Mablag'ni ozod qilishda xatolik." });
  }
});

app.post("/api/escrow/dispute", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { paymentId, reason, evidence } = req.body;
  try {
    const escrow = await prisma.escrowPayment.findUnique({
      where: { paymentId },
      include: { payment: true }
    });

    if (!escrow || escrow.payment.userId !== req.user?.id) {
      return res.status(403).json({ error: "Ruxsat etilmagan." });
    }

    await prisma.$transaction([
      prisma.escrowPayment.update({
        where: { id: escrow.id },
        data: { status: "disputed" }
      }),
      prisma.disputeResolution.create({
        data: {
          escrowId: escrow.id,
          reason,
          evidence: JSON.stringify(evidence || [])
        }
      })
    ]);

    await createNotification(
      1, // Admin notification (assuming ID 1 is main admin)
      "SYSTEM",
      "Yangi Escrow Nizosi",
      `To'lov #${paymentId} bo'yicha nizo ochildi.`,
      `/admin/disputes`
    );

    res.json({ success: true, message: "Nizo qabul qilindi. Admin ko'rib chiqadi." });
  } catch (err) {
    res.status(500).json({ error: "Nizo ochishda xatolik." });
  }
});

// --- B2B WHOLESALE ---

app.post("/api/b2b/onboard", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { companyName, taxId } = req.body;
  try {
    const b2b = await prisma.b2BAccount.create({
      data: {
        userId: req.user?.id || 0,
        companyName,
        taxId,
        verified: false, // Admin needs to verify
        discount: 20
      }
    });

    await createNotification(
      1,
      "SYSTEM",
      "Yangi B2B So'rov",
      `"${companyName}" kompaniyasi B2B hisob uchun so'rov yubordi.`,
      `/admin/b2b`
    );

    res.json(b2b);
  } catch (err) {
    res.status(500).json({ error: "B2B hisob yaratishda xatolik." });
  }
});

app.get("/api/b2b/profile", authenticateToken, async (req: AuthRequest, res: Response) => {
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

// --- ADMIN B2B ---
app.patch("/api/admin/b2b/:id/verify", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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
    const totalAmount = tier.pricePerDay * tier.durationDays;
    const orderId = "UPG-" + Math.floor(Math.random() * 1000000);
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

// POST /api/referrals/generate — Unique kod yaratish
app.post("/api/referrals/generate", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Avtorizatsiyadan o'ting." });

  try {
    const existing = await prisma.referral.findFirst({
      where: { referrerId: req.user.id, isActive: true }
    });

    if (existing) {
      return res.json({ code: existing.code });
    }

    const referralCount = await prisma.referral.count({ where: { referrerId: req.user.id, refereeId: { not: null } } });
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
    console.error("Referral generate error:", err);
    res.status(500).json({ error: "Referral kod yaratishda xatolik." });
  }
});

// GET /api/referrals/apply — Kodni tekshirish
app.get("/api/referrals/apply", authenticateToken, async (req: AuthRequest, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).json({ error: "Kod yuborilmadi." });

  try {
    const referral = await prisma.referral.findUnique({
      where: { code, isActive: true },
      include: { referrer: true }
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
app.get("/api/referrals/my-stats", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Avtorizatsiyadan o'ting." });

  try {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: req.user.id },
      include: {
        _count: { select: { rewards: true } },
        rewards: { where: { status: "earned" } }
      }
    });

    const totalEarned = referrals.reduce((sum, r) => sum + r.rewards.reduce((s, rw) => s + rw.rewardAmount, 0), 0);
    const referralCount = await prisma.referral.count({ where: { referrerId: req.user.id, refereeId: { not: null } } });
    const tier = getReferralTier(referralCount);

    res.json({
      referralCount,
      totalEarned,
      tier,
      referrals: referrals.map(r => ({
        code: r.code,
        isActive: r.isActive,
        rewardCount: r._count.rewards
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Ma'lumotlarni yuklashda xatolik." });
  }
});

// GET /api/admin/referrals — Admin stats
app.get("/api/admin/referrals", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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

// GET /api/admin/users — Barcha foydalanuvchilar (Admin)
app.get("/api/admin/users", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { email: { contains: String(search) } }
      ];
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
app.patch("/api/admin/users/:id/ban", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isBanned } = req.body;

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { isBanned }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user.id,
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
app.get("/api/admin/users/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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
app.patch("/api/admin/users/:id/vip", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isVip, vipExpiresAt } = req.body;
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { isVip, vipExpiresAt: vipExpiresAt ? new Date(vipExpiresAt) : null }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user.id,
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
app.patch("/api/admin/users/:id/role", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { role }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user.id,
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
app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    await prisma.user.delete({ where: { id: Number(id) } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user.id,
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

// JWT AUTH: Get Profile (Me)
app.get("/api/auth/me", async (req: AuthRequest, res: Response) => {
  try {
    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers["authorization"];
      token = authHeader && authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Tizimga kirilmagan (Sessiya muddati tugagan)." });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(404).json({ error: "Foydalanuvchi topilmadi." });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
        emailVerified: user.emailVerified,
        joinDate: user.joinDate,
        avatarUrl: user.avatarUrl,
        walletConnected: user.walletConnected,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "Yaroqsiz token yoki sessiya muddati tugagan." });
  }
});

// JWT AUTH: Refresh Token
app.post("/api/auth/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token talab qilinadi." });
  }

  try {
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!dbToken) {
      // Rotation & reuse detection
      const parts = refreshToken.split("-");
      if (parts.length === 2) {
        const userId = parseInt(parts[1]);
        if (!isNaN(userId)) {
          // Delete all tokens for this user because of reuse attempt
          await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => {});
          return res.status(401).json({ error: "Refresh token allaqachon ishlatilgan yoki yaroqsiz! Xavfsizlik choralari tufayli foydalanuvchining barcha faol seanslari tugatildi." });
        }
      }
      return res.status(401).json({ error: "Yaroqsiz refresh token." });
    }

    if (dbToken.user.isBanned) {
      return res.status(403).json({ error: "Sizning hisobingiz bloklangan. Qo'shimcha ma'lumot uchun qo'llab-quvvatlash xizmatiga murojaat qiling." });
    }

    if (new Date() > dbToken.expiresAt) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } }).catch(() => {});
      return res.status(401).json({ error: "Refresh token muddati tugagan." });
    }

    // Delete the old refresh token (rotation)
    await prisma.refreshToken.delete({ where: { token: refreshToken } }).catch(() => {});

    // Create a new rotated refresh token
    const newRefreshToken = await generateRefreshToken(dbToken.user.id, req);

    const accessToken = jwt.sign(
      { id: dbToken.user.id, email: dbToken.user.email, name: dbToken.user.name, role: dbToken.user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({
      token: accessToken,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ error: "Tokenni yangilashda xatolik yuz berdi." });
  }
});

// JWT AUTH: Logout
app.post("/api/auth/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken }
    }).catch(() => {});
  }
  res.clearCookie("token");
  res.json({ success: true, message: "Sessiya tugatildi." });
});

// POST /api/auth/resend-verification — Tasdiqlash emailini qayta yuborish
app.post("/api/auth/resend-verification", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id } });
    if (!user) {
      return res.status(404).json({ error: "Foydalanuvchi topilmadi." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Sizning email manzilingiz allaqachon tasdiqlangan." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: token }
    });

    await sendVerificationEmail(user.email, token, user.name);
    res.json({ success: true, message: "Tasdiqlash xati muvaffaqiyatli qayta yuborildi. Iltimos pochtangizni tekshiring." });
  } catch (err: any) {
    console.error("Resend verification error:", err);
    res.status(500).json({ error: "Xatni yuborishda xatolik yuz berdi." });
  }
});

// GET /api/startups - barcha startaplarni olish (filter: kategoriya, status, qidiruv, listingType va sahifalash bo'yicha)
app.get("/api/startups", async (req: Request, res: Response) => {
  const { category, status, search, listingType, page, limit, onlyActive, isTop } = req.query;

  try {
    const filter: any = {};
    if (category) filter.category = category as string;
    if (status) filter.status = status as string;
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

    if (search) {
      const searchStr = search as string;
      filter.OR = [
        { name: { contains: searchStr } },
        { description: { contains: searchStr } },
        { category: { contains: searchStr } },
      ];
    }

    if (page || limit) {
      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 12;
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

      const formatted = startupsList.map(formatStartup);
      res.json({ startups: formatted, totalCount, totalPages });
    } else {
      const startupsList = await prisma.startup.findMany({
        where: filter,
        orderBy: [
          { isTop: "desc" },
          { id: "desc" }
        ],
        include: { user: { select: { name: true, isVip: true, avatarUrl: true } } }
      });

      const formatted = startupsList.map(formatStartup);
      res.json(formatted);
    }
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

    res.json(formatStartup(startupRecord));
  } catch (err: any) {
    console.error("GET /api/startups/:id error:", err);
    res.status(500).json({ error: "Startapni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/top-boost/price
app.get("/api/top-boost/price", async (req: Request, res: Response) => {
  const { days } = req.query;
  if (!days) return res.status(400).json({ error: "Kunlar soni ko'rsatilmadi." });
  const price = await calculateTopPrice(parseInt(days as string));
  res.json({ price });
});

// POST /api/top-boost/create
app.post("/api/top-boost/create", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { startupId, days } = req.body;
  if (!startupId || !days) return res.status(400).json({ error: "StartupId va kunlar soni ko'rsatilmadi." });

  try {
    const startup = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startup) return res.status(404).json({ error: "Startap topilmadi." });

    const price = await calculateTopPrice(parseInt(days as string));
    const orderId = `TOP-${days}-${Math.floor(Math.random() * 10000000)}`;
    const secureToken = crypto.randomBytes(24).toString('hex');

    await prisma.payment.create({
      data: {
        id: orderId,
        amount: price,
        status: "pending",
        source: "top_boost",
        currency: "USDT",
        userId: req.user!.id,
        startupId: startupId,
        callbackToken: secureToken,
        platformFeeAmount: 0,
        sellerPayoutAmount: 0
      },
    });

    let paymentUrl = "";
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
            price_amount: price.toFixed(2),
            price_currency: "USD",
            receive_currency: "USDT",
            callback_url: `${appUrlSetting}/api/payments/webhook?token=${secureToken}`,
            success_url: `${appUrlSetting}/checkout/success`,
            cancel_url: `${appUrlSetting}/checkout/cancel`,
            title: `TOP Boost: ${startup.name} (${days} kun)`,
          }),
        });

        if (response.ok) {
          const orderData: any = await response.json();
          paymentUrl = orderData.payment_url;
        }
      } catch (err) {
        console.error("CoinGate error in top boost create:", err);
      }
    }

    if (!paymentUrl) {
      paymentUrl = `${appUrlSetting}/api/payments/coingate-simulator?orderId=${orderId}&token=${secureToken}&amount=${price.toFixed(2)}&title=${encodeURIComponent("TOP Boost: " + startup.name)}`;
    }

    res.json({ paymentUrl });
  } catch (err) {
    console.error("TOP boost create error:", err);
    res.status(500).json({ error: "To'lov yaratishda xatolik." });
  }
});

// POST /api/vip/create
app.post("/api/vip/create", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { days } = req.body;
  if (!days) return res.status(400).json({ error: "Kunlar soni ko'rsatilmadi." });

  try {
    const basePricePerDay = parseFloat(await getSetting("VIP_PRICE_PER_DAY") || "0.5");
    const discountPercent = parseFloat(await getSetting("VIP_DISCOUNT_PERCENT") || "40");
    const totalBasePrice = basePricePerDay * parseInt(days as string);
    const price = Math.round(totalBasePrice * (1 - discountPercent / 100) * 100) / 100;

    const orderId = `VIP-${days}-${Math.floor(Math.random() * 10000000)}`;
    const secureToken = crypto.randomBytes(24).toString('hex');

    await prisma.payment.create({
      data: {
        id: orderId,
        amount: price,
        status: "pending",
        source: "vip_subscription",
        currency: "USDT",
        userId: req.user!.id,
        callbackToken: secureToken,
        platformFeeAmount: 0,
        sellerPayoutAmount: 0
      },
    });

    let paymentUrl = "";
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
            price_amount: price.toFixed(2),
            price_currency: "USD",
            receive_currency: "USDT",
            callback_url: `${appUrlSetting}/api/payments/webhook?token=${secureToken}`,
            success_url: `${appUrlSetting}/checkout/success`,
            cancel_url: `${appUrlSetting}/checkout/cancel`,
            title: `VIP Subscription (${days} kun)`,
          }),
        });

        if (response.ok) {
          const orderData: any = await response.json();
          paymentUrl = orderData.payment_url;
        }
      } catch (err) {
        console.error("CoinGate error in vip create:", err);
      }
    }

    if (!paymentUrl) {
      paymentUrl = `${appUrlSetting}/api/payments/coingate-simulator?orderId=${orderId}&token=${secureToken}&amount=${price.toFixed(2)}&title=${encodeURIComponent("VIP Subscription")}`;
    }

    res.json({ paymentUrl });
  } catch (err) {
    console.error("VIP create error:", err);
    res.status(500).json({ error: "To'lov yaratishda xatolik." });
  }
});

// POST /api/startups — yangi startap qo'shish
app.post("/api/startups", authenticateToken, async (req: AuthRequest, res: Response) => {
  const {
    id,
    name,
    slogan,
    description,
    longDescription,
    category,
    price,
    listingType,
    techStack,
    demoUrl,
    repoIncluded,
    image,
    gallery,
    team,
    milestones,
    contactEmail,
    contactPhone,
    contactTelegram,
    deliveryUrl,
  } = req.body;

  if (!id || !name || !description || !category || price === undefined) {
    return res.status(400).json({ error: "Majburiy maydonlar to'ldirilmagan." });
  }

  const parsedPrice = parseFloat(price as any);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: "Narx musbat son bo'lishi shart." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id } });
    if (user && !user.emailVerified) {
      return res.status(403).json({ error: "Startap e'lon qilish uchun iltimos avval email manzilingizni tasdiqlang." });
    }

    const existing = await prisma.startup.findUnique({ where: { id } });
    if (existing) {
      return res.status(400).json({ error: "Ushbu identifikatorli (ID) loyiha allaqachon mavjud." });
    }

    const newStartup = await prisma.startup.create({
      data: {
        id,
        name,
        slogan: slogan || "",
        description,
        longDescription: longDescription || description,
        category,
        price: parsedPrice,
        listingType: listingType || "To'liq loyiha (manba kodi bilan)",
        techStack: JSON.stringify(techStack || []),
        demoUrl: demoUrl || "",
        deliveryUrl: deliveryUrl || "",
        repoIncluded: repoIncluded === true || repoIncluded === "true",
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

// PATCH /api/startups/:id/status — admin tomonidan tasdiqlash/rad etish
app.patch("/api/startups/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // active, pending, sold, rejected etc.

  if (!status) {
    return res.status(400).json({ error: "Status taqdim etilishi shart." });
  }

  // Check if admin
  if (req.user?.role !== "Admin") {
    // We can also allow founders to mark their own startups as sold
    const startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup || startup.userId !== req.user?.id) {
      return res.status(403).json({ error: "Ushbu amalni bajarish uchun sizda ruxsat yo'q (Faqat Admin)." });
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
          `<p>Tabriklaymiz! <b>${updated.name}</b> loyihangiz admin tomonidan ko'rib chiqildi va tasdiqlandi.</p><p>Endi u platformada sotuvda ko'rinadi.</p>`
        );
      }
    }

    if (req.user?.role === "Admin") {
      await prisma.auditLog.create({
        data: {
          adminId: req.user?.id || 0,
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

    const where: any = {};

    if (category && category !== "all") {
      where.startup = {
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
        const decoded = jwt.verify(token, JWT_SECRET) as any;
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
    res.status(500).json({ error: "G'oyani chop etishda xatolik yuz berdi: " + err.message });
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
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(',')[0].trim();
    const userAgent = req.headers["user-agent"] || "unknown";
    const rawKey = `guest-${ip}-${userAgent}`;
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

    // Compress images using sharp
    if (req.file.mimetype === "image/gif") {
      // Preserve GIF animation
      finalBuffer = req.file.buffer;
      finalContentType = "image/gif";
      finalExt = ".gif";
    } else if (req.file.mimetype.startsWith("image/")) {
      try {
        finalBuffer = await sharp(req.file.buffer)
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        finalContentType = "image/jpeg";
        finalExt = ".jpg";
      } catch (err) {
        console.error("Sharp compression error:", err);
      }
    }

    const telegramBotToken = await getSetting("TELEGRAM_BOT_TOKEN");
    const storageChannelId = await getSetting("TELEGRAM_STORAGE_CHANNEL_ID");

    if (!telegramBotToken || !storageChannelId) {
      return res.status(500).json({ error: "Telegram storage sozlamalari (TOKEN yoki CHANNEL_ID) kiritilmagan." });
    }

    // Telegram'ga fayl yuborish
    const formData = new FormData();
    formData.append('chat_id', storageChannelId);
    
    // Create Blob for FormData
    const blob = new Blob([finalBuffer], { type: finalContentType });
    formData.append('document', blob, `file_${Date.now()}${finalExt}`);

    const tgResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const tgData: any = await tgResponse.json();
    if (!tgData.ok) {
      console.error("Telegram upload error:", tgData);
      return res.status(500).json({ error: `Telegram'ga yuklashda xatolik: ${tgData.description}` });
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
    res.status(500).json({ error: "Rasm yuklashda xatolik yuz berdi: " + err.message });
  }
});

// Proxy endpoint to retrieve files from Telegram
app.get("/api/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const telegramBotToken = await getSetting("TELEGRAM_BOT_TOKEN");
    
    if (!telegramBotToken) {
      return res.status(500).send("Telegram Bot Token kiritilmagan.");
    }

    // 1. Get file path from Telegram
    const pathRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`);
    const pathData: any = await pathRes.json();
    
    if (!pathData.ok) {
      console.error("Telegram getFile error:", pathData);
      return res.status(404).send("Fayl Telegram'da topilmadi.");
    }

    // 2. Redirect to the actual file URL on Telegram's servers
    const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${pathData.result.file_path}`;
    res.redirect(fileUrl);
  } catch (err) {
    console.error("GET /api/files/:fileId error:", err);
    res.status(500).send("Faylni yuklab olishda xatolik.");
  }
});

// POST /api/payments/create — to'lov buyurtmasi yaratish
app.post("/api/payments/create", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { startupId, referralCode } = req.body;

  if (!startupId) {
    return res.status(400).json({ error: "Loyiha ID si ko'rsatilishi shart." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id } });
    if (user && !user.emailVerified) {
      return res.status(403).json({ error: "Xaridni amalga oshirish uchun iltimos avval email manzilingizni tasdiqlang." });
    }

    const startupRecord = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startupRecord || !startupRecord.price) {
      return res.status(400).json({ error: "Loyiha topilmadi yoki narx belgilanmagan." });
    }
    if (startupRecord.soldStatus === "sotildi") {
      return res.status(409).json({ error: "Bu loyiha allaqachon sotilgan." });
    }
    
    let realAmount = startupRecord.price;
    let discountApplied = 0;
    let referralId = null;

    if (referralCode) {
      const referral = await prisma.referral.findUnique({
        where: { code: referralCode, isActive: true }
      });
      if (referral && referral.referrerId !== req.user?.id) {
        discountApplied = (realAmount * referral.discountPercent) / 100;
        realAmount -= discountApplied;
        referralId = referral.id;
      }
    }

    const orderId = "CG-" + Math.floor(Math.random() * 10000000);
    const secureToken = crypto.randomBytes(24).toString('hex');

    const payment = await prisma.payment.create({
      data: {
        id: orderId,
        amount: realAmount,
        status: "pending",
        currency: "USDT",
        userId: req.user?.id,
        startupId: startupId,
        callbackToken: secureToken,
        gateway: "coingate",
        referralId: referralId
      },
    });

    let paymentUrl = "";
    let useStripe = false;

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
            data: { gateway: "stripe", id: session.id } // Use session ID as new payment ID for stripe
          });
          // Note: If we change ID, we might need to update local variables
        } catch (stripeErr) {
          console.error("Stripe fallback error:", stripeErr);
        }
      }
    }

    if (!paymentUrl) {
      if (process.env.NODE_ENV === "production") {
        const stripeKey = await getSetting("STRIPE_SECRET_KEY") || process.env.STRIPE_SECRET_KEY;
        if (!coingateToken && !stripeKey) {
          return res.status(503).json({ error: "To'lov tizimi vaqtincha mavjud emas, keyinroq urinib ko'ring." });
        }
      }
      paymentUrl = `/api/payments/coingate-simulator?orderId=${orderId}&token=${secureToken}&amount=${realAmount.toFixed(2)}&title=${encodeURIComponent(startupRecord.name)}`;
    }

    res.status(201).json({
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      currency: payment.currency,
      paymentUrl
    });
  } catch (err: any) {
    console.error("POST /api/payments/create error:", err);
    res.status(500).json({ error: "To'lov buyurtmasini yaratib bo'lmadi." });
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
          <p class="order-id">Buyurtma ID: <strong>${orderId}</strong></p>
          <p style="color: #cbd5e0; font-size: 15px; font-weight: 600; margin-bottom: 4px;">${title || "Loyiha xaridi"}</p>
          <div class="amount">${amount} <span class="currency">USDT</span></div>
          <p class="info-text">Bu CoinGate to'lov tizimining integratsiyasini va webhook qayta qo'ng'iroqlarini tekshirish uchun maxsus simulyatordir.</p>
          <button onclick="pay()">To'lovni tasdiqlash</button>
        </div>
        <script>
          async function pay() {
            try {
              const params = new URLSearchParams();
              params.append('order_id', '${orderId}');
              params.append('status', 'paid');
              params.append('price_amount', '${amount}');
              params.append('price_currency', 'USD');
              params.append('id', 'CG-' + Math.floor(Math.random() * 1000000));

              const res = await fetch('/api/payments/webhook?token=${token}', {
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

function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /api/payments/webhook — CoinGate webhook callback qabul qilish
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

    let updatedStatus = "completed";

    if (payment.startupId) {
      const startup = await prisma.startup.findUnique({ where: { id: payment.startupId } });
      if (startup && startup.soldStatus === "sotildi") {
        updatedStatus = "refund_required";
        console.log(`Startup ${payment.startupId} is already sold. Setting payment ${order_id} to 'refund_required'.`);
      }
    }

    const platformFeeAmount = updatedStatus === "completed" ? payment.amount * 0.05 : null;
    const sellerPayoutAmount = updatedStatus === "completed" ? payment.amount * 0.95 : null;

    await prisma.payment.update({
      where: { id: order_id },
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
        await prisma.referral.update({
          where: { id: referral.id },
          data: { refereeId: payment.userId || 0 }
        });
        
        const rewardAmount = (payment.amount * referral.commissionPercent) / 100;
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

    if (updatedStatus === "completed") {
      const buyer = await prisma.user.findUnique({ where: { id: payment.userId } });
      const startup = await prisma.startup.findUnique({ where: { id: payment.startupId }, include: { user: true } });
      
      if (buyer && startup) {
        // To Buyer
        await sendEmail(
          buyer.email,
          "Xarid muvaffaqiyatli yakunlandi",
          `<p>Tabriklaymiz! Siz <b>${startup.name}</b> loyihasini muvaffaqiyatli sotib oldingiz.</p><p>Loyiha fayllari va tafsilotlari tez orada sizga yetkaziladi.</p>`
        );
        // To Seller
        if (startup.user) {
          await sendEmail(
            startup.user.email,
            "Loyihangiz sotildi!",
            `<p>Tabriklaymiz! Sizning <b>${startup.name}</b> loyihangiz sotib olindi.</p><p>To'lov qabul qilindi. Tafsilotlar uchun dashboardni ko'ring.</p>`
          );
        }
      }
    }

    if (updatedStatus === "completed" && payment.startupId) {
      await prisma.telegramDelivery.create({
        data: {
          token: crypto.randomBytes(24).toString('hex'),
          paymentId: order_id,
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
              `✅ To'lovingiz qabul qilindi! Yetkazib berish havolasi: ${startup.deliveryUrl}`
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
        await prisma.startup.update({
          where: { id: payment.startupId },
          data: { 
            currentTier: subscription.tier.tier,
            isTop: subscription.tier.tier !== "standard",
            topExpiresAt: subscription.expiresAt
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

    res.json({ success: true, orderId: order_id, status: updatedStatus });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

// GET /api/telegram/user-stats/:telegramUserId — Bot uchun user stats
app.get("/api/telegram/user-stats/:telegramUserId", async (req: Request, res: Response) => {
  const { telegramUserId } = req.params;
  const secret = req.headers["x-telegram-bot-secret"];

  const internalSecret = await getSetting("TELEGRAM_BOT_INTERNAL_SECRET") || process.env.TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat etilmagan." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { telegramUserId: telegramUserId.toString() },
      include: {
        referrals: {
          include: { rewards: { where: { status: "earned" } } }
        }
      }
    });

    if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });

    const referral = await prisma.referral.findFirst({ where: { referrerId: user.id, isActive: true } });
    const referralCount = await prisma.referral.count({ where: { referrerId: user.id, refereeId: { not: null } } });
    const totalEarned = user.referrals.reduce((sum, r) => sum + r.rewards.reduce((s, rw) => s + rw.rewardAmount, 0), 0);

    res.json({
      name: user.name,
      email: user.email,
      balance: user.balance,
      referralCode: referral?.code,
      referralCount,
      totalEarned
    });
  } catch (err) {
    res.status(500).json({ error: "Xatolik yuz berdi." });
  }
});

// GET /api/telegram/verify/:token
app.get("/api/telegram/verify/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const delivery = await prisma.telegramDelivery.findUnique({ where: { token } });
    if (!delivery || delivery.used || new Date() > delivery.expiresAt) {
      return res.status(400).json({ error: "Havola eskirgan yoki noto'g'ri" });
    }
    res.json({ success: true, startupId: delivery.startupId });
  } catch (err: any) {
    console.error("Verify telegram token error:", err);
    res.status(500).json({ error: "Havolani tasdiqlashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/sponsor-channels
app.get("/api/telegram/sponsor-channels", async (req: Request, res: Response) => {
  try {
    const channels = await prisma.sponsorChannel.findMany({ where: { isActive: true } });
    res.json(channels);
  } catch (err: any) {
    console.error("Get sponsor channels error:", err);
    res.status(500).json({ error: "Sponsor kanallarni yuklashda xatolik yuz berdi." });
  }
});

// POST /api/telegram/deliver/:token
app.post("/api/telegram/deliver/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { telegramUserId } = req.body;
    const delivery = await prisma.telegramDelivery.findUnique({ where: { token } });
    if (!delivery || delivery.used || new Date() > delivery.expiresAt) {
      return res.status(400).json({ error: "Havola eskirgan yoki noto'g'ri" });
    }
    // Mark as used
    await prisma.telegramDelivery.update({
      where: { token },
      data: { used: true, telegramUserId: String(telegramUserId) }
    });
    // Get delivery URL
    const startup = await prisma.startup.findUnique({ where: { id: delivery.startupId } });
    res.json({ deliveryUrl: startup?.deliveryUrl });
  } catch (err: any) {
    console.error("Deliver telegram error:", err);
    res.status(500).json({ error: "Loyiha havolasini yuborishda xatolik yuz berdi." });
  }
});


// POST /api/conversations — yangi suhbat boshlash
app.post("/api/conversations", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { startupId, sellerId } = req.body;
    const buyerId = req.user!.id;

    if (buyerId === parseInt(sellerId)) {
      return res.status(400).json({ error: "O'zingiz bilan suhbat ocha olmaysiz." });
    }

    // Check if startup and seller exist
    const startup = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startup) {
      return res.status(404).json({ error: "Loyiha topilmadi." });
    }
    const seller = await prisma.user.findUnique({ where: { id: parseInt(sellerId) } });
    if (!seller) {
      return res.status(404).json({ error: "Sotuvchi topilmadi." });
    }

    let conversation = await prisma.conversation.findUnique({
      where: { startupId_buyerId_sellerId: { startupId, buyerId, sellerId: parseInt(sellerId) } }
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { startupId, buyerId, sellerId: parseInt(sellerId) }
      });
    }
    res.json(conversation);
  } catch (err: any) {
    console.error("Create conversation error:", err);
    res.status(500).json({ error: "Suhbat boshlashda xatolik yuz berdi." });
  }
});

// GET /api/conversations — barcha suhbatlar
app.get("/api/conversations", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: { buyer: true, seller: true, startup: true },
      orderBy: { lastMessageAt: "desc" }
    });
    res.json(conversations);
  } catch (err: any) {
    console.error("Get conversations error:", err);
    res.status(500).json({ error: "Suhbatlarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/conversations/:id/messages — suhbat tarixi
app.get("/api/conversations/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
      return res.status(403).json({ error: "Siz bu suhbat ishtirokchisi emassiz." });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(messages.reverse());
  } catch (err: any) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Xabarlarni yuklashda xatolik yuz berdi." });
  }
});

// POST /api/conversations/:id/messages — yangi xabar yuborish
app.post("/api/conversations/:id/messages", authenticateToken, rateLimit({ windowMs: 60 * 1000, max: 20 }), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const senderId = req.user!.id;
    
    const conversation = await prisma.conversation.findUnique({ where: { id }, include: { buyer: true, seller: true } });
    if (!conversation || (conversation.buyerId !== senderId && conversation.sellerId !== senderId)) return res.status(403).json({ error: "Siz bu suhbat ishtirokchisi emassiz" });
    
    const message = await prisma.message.create({
      data: { conversationId: id, senderId, content }
    });
    await prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
    
    const recipientId = senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
    io.to(`user:${recipientId}`).emit("new_message", message);

    // Create persistent notification for new message
    const senderName = senderId === conversation.buyerId ? conversation.buyer.name : conversation.seller.name;
    await createNotification(
      recipientId, 
      "MESSAGE",
      "Yangi xabar", 
      `${senderName} sizga yangi xabar yubordi: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`, 
      `/messages`
    );
    
    res.json(message);
  } catch (err: any) {
    console.error("Post message error:", err);
    res.status(500).json({ error: "Xabar yuborishda xatolik yuz berdi." });
  }
});

// PATCH /api/conversations/:id/read — xabarlarni o'qilgan deb belgilash
app.patch("/api/conversations/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
      return res.status(403).json({ error: "Siz bu suhbat ishtirokchisi emassiz." });
    }

    await prisma.message.updateMany({
      where: { conversationId: id, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() }
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Read messages error:", err);
    res.status(500).json({ error: "Xabarlarni o'qilgan deb belgilashda xatolik yuz berdi." });
  }
});

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

// GET /api/auth/verify-email — Emailni tasdiqlash havolasi
app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(`
      <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px; background-color: #0d131a; color: white; padding: 40px; border-radius: 10px; max-width: 500px; margin-left: auto; margin-right: auto; border: 1px solid #ef4444;">
        <h1 style="color: #ef4444;">Tasdiqlash kodi topilmadi</h1>
        <p>Iltimos, email manzilingizdagi havolani qayta tekshiring.</p>
        <a href="/" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 15px;">Bosh sahifaga qaytish</a>
      </div>
    `);
  }

  try {
    const user = await prisma.user.findFirst({
      where: { verificationToken: token as string }
    });

    if (!user) {
      return res.status(404).send(`
        <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px; background-color: #0d131a; color: white; padding: 40px; border-radius: 10px; max-width: 500px; margin-left: auto; margin-right: auto; border: 1px solid #ef4444;">
          <h1 style="color: #ef4444;">Yaroqsiz yoki eskirgan tasdiqlash kodi</h1>
          <p>Ushbu tasdiqlash kodi yaroqsiz yoki allaqachon ishlatilgan.</p>
          <a href="/" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 15px;">Bosh sahifaga qaytish</a>
        </div>
      `);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null // Clear token after use
      }
    });

    res.send(`
      <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px; background-color: #0d131a; color: white; padding: 40px; border-radius: 10px; max-width: 500px; margin-left: auto; margin-right: auto; border: 1px solid #10b981;">
        <h1 style="color: #10b981;">Email muvaffaqiyatli tasdiqlandi! 🎉</h1>
        <p>Sizning email manzilingiz muvaffaqiyatli tasdiqlandi. Endi platformadagi barcha xizmatlardan to'liq foydalana olasiz.</p>
        <p style="color: #8892b0; font-size: 14px;">Ushbu sahifani yopishingiz va Savdo24 platformasini yangilashingiz (refresh) mumkin.</p>
        <div style="margin-top: 30px;">
          <a href="/" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Savdo24-ga o'tish</a>
        </div>
      </div>
    `);
  } catch (err: any) {
    console.error("Email verification error:", err);
    res.status(500).send(`
      <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px; background-color: #0d131a; color: white; padding: 40px; border-radius: 10px; max-width: 500px; margin-left: auto; margin-right: auto; border: 1px solid #ef4444;">
        <h1 style="color: #ef4444;">Serverda xatolik yuz berdi</h1>
        <p>Iltimos qayta urinib ko'ring.</p>
      </div>
    `);
  }
});

// POST /api/reviews — Sharh qoldirish
app.post("/api/reviews", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { rating, comment, startupId } = req.body;

  if (!rating || !comment || !startupId) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
  }

  const ratingInt = parseInt(rating);
  if (ratingInt < 1 || ratingInt > 5) {
    return res.status(400).json({ error: "Reyting 1 dan 5 gacha bo'lishi kerak." });
  }

  try {
    // Check if the buyer indeed completed a payment for this startup
    const completedPayment = await prisma.payment.findFirst({
      where: {
        startupId,
        userId: req.user?.id,
        status: "completed"
      }
    });

    if (!completedPayment) {
      return res.status(403).json({ error: "Siz ushbu loyihani sotib olmagansiz yoki to'lov yakunlanmagan. Sharh qoldira olmaysiz." });
    }

    // Check if they already left a review for this startup to prevent duplicates
    const existingReview = await prisma.review.findFirst({
      where: {
        startupId,
        buyerId: req.user?.id
      }
    });

    if (existingReview) {
      return res.status(409).json({ error: "Siz ushbu loyiha uchun allaqachon sharh qoldirgansiz." });
    }

    const startup = await prisma.startup.findUnique({
      where: { id: startupId }
    });

    if (!startup || !startup.userId) {
      return res.status(404).json({ error: "Loyiha yoki uning sotuvchisi topilmadi." });
    }

    const review = await prisma.review.create({
      data: {
        rating: ratingInt,
        comment,
        startupId,
        buyerId: req.user.id,
        sellerId: startup.userId
      }
    });

    // Notify seller
    await createNotification(
      startup.userId, 
      "REVIEW",
      "Yangi sharh", 
      `"${startup.name}" loyihangiz uchun yangi ${ratingInt} yulduzli sharh qoldirildi.`, 
      `/profile?tab=sales`
    );

    const seller = await prisma.user.findUnique({ where: { id: startup.userId } });
    if (seller) {
      await sendEmail(
        seller.email,
        "Yangi sharh qoldirildi",
        `<p>Sizning <b>${startup.name}</b> loyihangizga yangi sharh qoldirildi:</p><blockquote>${comment}</blockquote><p>Reyting: ${ratingInt} ball</p>`
      );
    }

    // Recalculate seller's rating metrics
    const sellerReviews = await prisma.review.findMany({
      where: { sellerId: startup.userId }
    });

    const totalReviews = sellerReviews.length;
    const sum = sellerReviews.reduce((acc: number, r: any) => acc + r.rating, 0);
    const averageRating = totalReviews > 0 ? parseFloat((sum / totalReviews).toFixed(1)) : 0;

    await prisma.user.update({
      where: { id: startup.userId },
      data: {
        averageRating,
        totalReviews
      }
    });

    res.status(201).json(review);
  } catch (err: any) {
    console.error("Create review error:", err);
    res.status(500).json({ error: "Sharh yozishda xatolik yuz berdi." });
  }
});

// GET /api/users/:id/reviews — Foydalanuvchining sharhlarini olish
app.get("/api/users/:id/reviews", async (req: Request, res: Response) => {
  const sellerId = parseInt(req.params.id);

  try {
    const reviews = await prisma.review.findMany({
      where: { sellerId },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        },
        startup: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const user = await prisma.user.findUnique({
      where: { id: sellerId },
      select: {
        averageRating: true,
        totalReviews: true,
        name: true
      }
    });

    res.json({
      reviews,
      averageRating: user?.averageRating || 0,
      totalReviews: user?.totalReviews || 0,
      sellerName: user?.name || "Noma'lum"
    });
  } catch (err: any) {
    console.error("Get reviews error:", err);
    res.status(500).json({ error: "Sharhlarni olishda xatolik yuz berdi." });
  }
});

// POST /api/disputes — Nizo ochish
app.post("/api/disputes", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { paymentId, reason, description } = req.body;

  if (!paymentId || !reason || !description) {
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring." });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment || payment.userId !== req.user?.id) {
      return res.status(403).json({ error: "Siz faqat o'zingiz to'lagan buyurtmalar bo'yicha nizo ocha olasiz." });
    }

    if (payment.status !== "completed") {
      return res.status(400).json({ error: "Nizo ochish uchun to'lov to'liq muvaffaqiyatli amalga oshirilgan bo'lishi shart." });
    }

    const existingDispute = await prisma.dispute.findFirst({
      where: { paymentId }
    });

    if (existingDispute) {
      return res.status(409).json({ error: "Ushbu buyurtma bo'yicha allaqachon nizo ochilgan." });
    }

    const dispute = await prisma.dispute.create({
      data: {
        paymentId,
        buyerId: req.user.id,
        reason,
        description,
        status: "open"
      }
    });

    res.status(201).json(dispute);
  } catch (err: any) {
    console.error("Create dispute error:", err);
    res.status(500).json({ error: "Nizo ochishda xatolik yuz berdi." });
  }
});

// GET /api/disputes — Barcha nizolarni olish (Admin)
app.get("/api/disputes", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const disputes = await prisma.dispute.findMany({
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        payment: {
          include: {
            startup: {
              select: {
                id: true,
                name: true,
                price: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(disputes);
  } catch (err: any) {
    console.error("Get disputes error:", err);
    res.status(500).json({ error: "Nizolarni olishda xatolik yuz berdi." });
  }
});

// PATCH /api/disputes/:id — Nizoni yangilash (Admin)
app.patch("/api/disputes/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const disputeId = parseInt(req.params.id);
  const { status, adminNote } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status ko'rsatilishi lozim." });
  }

  try {
    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        adminNote: adminNote || null,
        resolvedAt: status === "resolved" || status === "rejected" ? new Date() : null
      },
      include: {
        payment: { include: { startup: true } }
      }
    });

    // Notify both parties about dispute resolution
    const disputeTitle = "Nizo hal qilindi";
    const disputeMsg = `"${updated.payment.startup?.name}" bo'yicha nizo ${status === 'resolved' ? 'hal qilindi' : 'rad etildi'}. Admin izohi: ${adminNote || 'Izohsiz'}`;
    
    if (updated.buyerId) await createNotification(updated.buyerId, "SYSTEM", disputeTitle, disputeMsg, `/profile?tab=purchases`);
    if (updated.sellerId) await createNotification(updated.sellerId, "SYSTEM", disputeTitle, disputeMsg, `/profile?tab=sales`);

    // Send Emails
    const buyer = await prisma.user.findUnique({ where: { id: updated.buyerId } });
    const seller = await prisma.user.findUnique({ where: { id: updated.payment.startup?.userId } });
    
    if (buyer) await sendEmail(buyer.email, disputeTitle, `<p>${disputeMsg}</p>`);
    if (seller) await sendEmail(seller.email, disputeTitle, `<p>${disputeMsg}</p>`);

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: status === "resolved" ? "resolve_dispute" : "reject_dispute",
        targetId: String(disputeId),
        details: adminNote ? `Nizo statusi: ${status}. Izoh: ${adminNote}` : `Nizo statusi: ${status}`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json(updated);
  } catch (err: any) {
    console.error("Update dispute error:", err);
    res.status(500).json({ error: "Nizoni yangilashda xatolik yuz berdi." });
  }
});

// GET /api/admin/stats — Platforma komissiyasi va sotuvlar statistikasi (Admin)
app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalActiveStartups,
      completedPayments,
      monthlyPayments,
      lastDisputes,
      lastReports
    ] = await Promise.all([
      prisma.user.count(),
      prisma.startup.count({ where: { status: "active", soldStatus: "sotuvda" } }),
      prisma.payment.findMany({ where: { status: "completed" } }),
      prisma.payment.findMany({ 
        where: { 
          status: "completed",
          createdAt: { gte: firstDayOfMonth }
        }
      }),
      prisma.dispute.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { buyer: true }
      }),
      prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: "desc" }
      })
    ]);

    const totalVolume = completedPayments.reduce((acc: number, p: any) => acc + p.amount, 0);
    const totalCommission = completedPayments.reduce((acc: number, p: any) => acc + (p.platformFeeAmount || 0), 0);
    const monthlyCommission = monthlyPayments.reduce((acc: number, p: any) => acc + (p.platformFeeAmount || 0), 0);

    const openDisputes = await prisma.dispute.count({ where: { status: "open" } });

    res.json({
      totalUsers,
      totalActiveStartups,
      totalCompletedSales: completedPayments.length,
      totalCommission,
      monthlyCommission,
      totalVolume,
      openDisputes,
      lastDisputes: lastDisputes.map((d: any) => ({
        id: d.id,
        buyer: d.buyer?.name,
        reason: d.reason,
        status: d.status,
        date: d.createdAt
      })),
      lastReports: lastReports.map((r: any) => ({
        id: r.id,
        targetType: r.targetType,
        reason: r.reason,
        status: r.status,
        date: r.createdAt
      })),
      systemStatus: {
        coingateConfigured: !!(process.env.COINGATE_API_TOKEN),
        isProduction: process.env.NODE_ENV === "production",
        envWarnings: (process.env.NODE_ENV === "production" && !process.env.COINGATE_API_TOKEN) ? ["To'lov tizimi sozlanmagan (COINGATE_API_TOKEN topilmadi)"] : []
      }
    });
  } catch (err: any) {
    console.error("Get stats error:", err);
    res.status(500).json({ error: "Statistikani olishda xatolik yuz berdi." });
  }
});


// POST /api/reports — Shikoyat qilish (Foydalanuvchi)
app.post("/api/reports", authenticateToken, reportLimiter, async (req: AuthRequest, res: Response) => {
  const { targetType, targetId, reason, description } = req.body;

  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ error: "Xatolik: Barcha majburiy maydonlarni to'ldiring." });
  }

  try {
    // Check if the user has already reported this targetId
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: req.user?.id || 0,
        targetId: String(targetId)
      }
    });

    if (existingReport) {
      return res.status(409).json({ error: "Siz ushbu e'lon yoki izoh bo'yicha allaqachon shikoyat qoldirgansiz." });
    }

    const report = await prisma.report.create({
      data: {
        targetType,
        targetId: String(targetId),
        reporterId: req.user?.id || 0,
        reason,
        description: description || null,
        status: "pending"
      }
    });

    res.status(201).json(report);
  } catch (err) {
    console.error("Create report error:", err);
    res.status(500).json({ error: "Shikoyat yuborishda xatolik yuz berdi." });
  }
});

// GET /api/reports — Barcha shikoyatlarni olish (Admin)
app.get("/api/reports", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" }
    });

    res.json(reports);
  } catch (err) {
    console.error("Get reports error:", err);
    res.status(500).json({ error: "Shikoyatlarni olishda xatolik yuz berdi." });
  }
});

// GET /api/admin/audit-logs — Admin amallari tarixi (Admin)
app.get("/api/admin/audit-logs", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(logs);
  } catch (err: any) {
    console.error("Get audit logs error:", err);
    res.status(500).json({ error: "Audit loglarni olishda xatolik yuz berdi." });
  }
});

// PATCH /api/reports/:id/status — Shikoyat statusini yangilash (Admin)
app.patch("/api/reports/:id/status", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { status } = req.body; // "reviewed" or "dismissed"

  if (!status) {
    return res.status(400).json({ error: "Status ko'rsatilishi lozim." });
  }

  try {
    const updated = await prisma.report.update({
      where: { id },
      data: { status }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: status === "reviewed" ? "resolve_report" : "reject_report",
        targetId: String(id),
        details: `Report status updated to ${status}`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json(updated);
  } catch (err) {
    console.error("Update report status error:", err);
    res.status(500).json({ error: "Shikoyat statusini yangilashda xatolik yuz berdi." });
  }
});

// DELETE /api/admin/startups/:id — E'lonni o'chirish (Admin)
app.delete("/api/admin/startups/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.review.deleteMany({ where: { startupId: id } });
    await prisma.idea.deleteMany({ where: { startupId: id } });
    
    const payments = await prisma.payment.findMany({ where: { startupId: id } });
    const paymentIds = payments.map((p: any) => p.id);
    await prisma.dispute.deleteMany({ where: { paymentId: { in: paymentIds } } });
    await prisma.payment.deleteMany({ where: { startupId: id } });

    await prisma.startup.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: "delete_startup",
        targetId: id,
        details: `Startup ${id} and all its relations deleted`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json({ success: true, message: "E'lon muvaffaqiyatli o'chirildi." });
  } catch (err) {
    console.error("Admin delete startup error:", err);
    res.status(500).json({ error: "E'lonni o'chirishda xatolik yuz berdi." });
  }
});

// DELETE /api/admin/ideas/:id — G'oya/Izohni o'chirish (Admin)
app.delete("/api/admin/ideas/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.ideaVote.deleteMany({ where: { ideaId: id } });
    await prisma.idea.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: "delete_idea",
        targetId: String(id),
        details: `Idea ${id} and its votes deleted`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json({ success: true, message: "Izoh muvaffaqiyatli o'chirildi." });
  } catch (err) {
    console.error("Admin delete idea error:", err);
    res.status(500).json({ error: "Izohni o'chirishda xatolik yuz berdi." });
  }
});

function maskValue(val: string): string {
  if (!val) return "";
  if (val.length <= 4) return "••••";
  return "••••••••" + val.slice(-4);
}

// GET /api/admin/settings — Barcha sozlamalarni qisman yashirgan holda olish (Admin)
app.get("/api/admin/settings", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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
    "APP_URL"
  ];

  try {
    const results = [];
    for (const key of ALL_KEYS) {
      const val = await getSetting(key);
      results.push({
        key,
        value: val ? maskValue(val) : "",
        hasValue: !!val
      });
    }
    res.json(results);
  } catch (err: any) {
    console.error("Get admin settings error:", err);
    res.status(500).json({ error: "Sozlamalarni olishda xatolik yuz berdi." });
  }
});

// PUT /api/admin/settings/:key — Sozlama qiymatini yangilash (Admin)
app.put("/api/admin/settings/:key", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;

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
    "APP_URL"
  ];

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
        action: "update_setting",
        targetId: key,
        details: `Admin ${adminName}, ${key} sozlamasini yangiladi.`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json({ success: true, key, value: maskValue(value) });
  } catch (err: any) {
    console.error(`Save setting error for ${key}:`, err);
    res.status(500).json({ error: "Sozlamani saqlashda xatolik yuz berdi." });
  }
});

// GET /api/admin/sponsor-channels — Barcha sponsor kanallarni olish (Admin)
app.get("/api/admin/sponsor-channels", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const channels = await prisma.sponsorChannel.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(channels);
  } catch (err: any) {
    console.error("Get sponsor channels error:", err);
    res.status(500).json({ error: "Sponsor kanallarni olishda xatolik yuz berdi." });
  }
});

// POST /api/admin/sponsor-channels — Yangi sponsor kanal qo'shish (Admin)
app.post("/api/admin/sponsor-channels", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { channelId, channelUsername, displayName, advertiserContact, pricePerMonth, startDate, endDate } = req.body;

  if (!channelId || !channelUsername || !displayName) {
    return res.status(400).json({ error: "Kanal ID, username va ko'rinadigan nom majburiy." });
  }

  try {
    const channel = await prisma.sponsorChannel.create({
      data: {
        channelId,
        channelUsername,
        displayName,
        advertiserContact,
        pricePerMonth: pricePerMonth ? parseFloat(pricePerMonth) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: "create_sponsor_channel",
        targetId: String(channel.id),
        details: `Yangi sponsor kanal qo'shildi: ${displayName} (@${channelUsername})`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.status(201).json(channel);
  } catch (err: any) {
    console.error("Create sponsor channel error:", err);
    res.status(500).json({ error: "Sponsor kanalni qo'shishda xatolik yuz berdi." });
  }
});

// PATCH /api/admin/sponsor-channels/:id — Sponsor kanalni yangilash (Admin)
app.patch("/api/admin/sponsor-channels/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { isActive, channelId, channelUsername, displayName, advertiserContact, pricePerMonth, startDate, endDate } = req.body;

  try {
    const updated = await prisma.sponsorChannel.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : undefined,
        channelId,
        channelUsername,
        displayName,
        advertiserContact,
        pricePerMonth: pricePerMonth !== undefined ? (pricePerMonth ? parseFloat(pricePerMonth) : null) : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: "update_sponsor_channel",
        targetId: String(id),
        details: `Sponsor kanal yangilandi (ID: ${id})`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json(updated);
  } catch (err: any) {
    console.error("Update sponsor channel error:", err);
    res.status(500).json({ error: "Sponsor kanalni yangilashda xatolik yuz berdi." });
  }
});

// DELETE /api/admin/sponsor-channels/:id — Sponsor kanalni o'chirish (Admin)
app.delete("/api/admin/sponsor-channels/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);

  try {
    await prisma.sponsorChannel.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        action: "delete_sponsor_channel",
        targetId: String(id),
        details: `Sponsor kanal o'chirildi (ID: ${id})`
      }
    }).catch((e: any) => console.error("Audit log error:", e));

    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete sponsor channel error:", err);
    res.status(500).json({ error: "Sponsor kanalni o'chirishda xatolik yuz berdi." });
  }
});

async function seedSettings() {
  const defaults = [
    { key: "TOP_BASE_PRICE_PER_DAY", value: "1" },
    { key: "TOP_MAX_CONCURRENT_SLOTS", value: "20" },
    { key: "VIP_PRICE_PER_DAY", value: "0.5" },
    { key: "VIP_DISCOUNT_PERCENT", value: "40" },
    { key: "TELEGRAM_STORAGE_CHANNEL_ID", value: "" }
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
  if (isPostgres) {
    try {
      console.log("DATABASE_URL found. Deploying PostgreSQL migrations...");
      execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", { stdio: "inherit" });
      console.log("PostgreSQL migrations deployed successfully.");
    } catch (migrateErr) {
      console.error("PostgreSQL migration deployment failed on startup:", migrateErr);
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
    await prisma.notification.update({
      where: { id: Number(req.params.id), userId: req.user!.id },
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
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Kategoriyani o'chirishda xatolik." });
  }
});

// --- SECURITY SETTINGS ---
app.get("/api/auth/sessions", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.refreshToken.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" }
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Sessiyalarni yuklashda xatolik." });
  }
});

app.delete("/api/auth/sessions/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.refreshToken.delete({
      where: { id: Number(req.params.id), userId: req.user!.id }
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Kutilmagan server xatosi:", err);
    res.status(500).json({ error: "Kutilmagan xatolik yuz berdi. Iltimos qaytadan urinib ko'ring." });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Scheduled Tasks (Internal Cron)
  // Har kuni soat 03:00 da escrow to'lovlarini tekshirish
  cron.schedule("0 3 * * *", () => {
    console.log("[CRON] Running autoReleaseEscrows...");
    autoReleaseEscrows();
  });

  // Har haftalik newsletter yuborish (Dushanba kuni 09:00)
  cron.schedule("0 9 * * 1", () => {
    console.log("[CRON] Running sendWeeklyNewsletter...");
    sendWeeklyNewsletter();
  });
}

start();
