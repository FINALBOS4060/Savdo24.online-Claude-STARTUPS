import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { logger } from "../lib/logger";

// We import shared instances and helpers from main server file
import {
  prisma,
  JWT_SECRET,
  generateRefreshToken,
  sendVerificationEmail,
  sendEmail,
  authenticateToken,
  getSetting,
  AuthRequest
} from "../../server";
import { authLimiter, passwordResetLimiter } from "../lib/rateLimiters";

const router = Router();

// Zod schemas for input validation
const registerSchema = z.object({
  email: z.string().email("Noto'g'ri email formati."),
  password: z.string()
    .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak.")
    .regex(/\d/, "Parolda kamida bitta raqam bo'lishi kerak."),
  name: z.string().min(1, "Ism kiritilishi shart.")
});

const loginSchema = z.object({
  email: z.string().email("Noto'g'ri email formati."),
  password: z.string().min(1, "Parol kiritilishi shart.")
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token kiritilishi shart."),
  password: z.string()
    .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak.")
    .regex(/\d/, "Parolda kamida bitta raqam bo'lishi kerak.")
});

// Helper to set HttpOnly auth cookies
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

// 1. POST /api/auth/register
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    const errors = (result.error as any).errors.map((e: any) => e.message).join(" ");
    return res.status(400).json({ error: errors });
  }

  const { email, password, name } = result.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(201).json({ 
         message: "Ro'yxatdan o'tish so'rovi qabul qilindi. Iltimos, Telegram orqali tasdiqlang." 
       });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userRole = "Xaridor";
    const telegramLinkCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const telegramLinkCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

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
        telegramLinkCode,
        telegramLinkCodeExpires,
      },
    });

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = await generateRefreshToken(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    logger.info({ userId: user.id }, "User registered successfully");

    res.status(201).json({
      accessToken,
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
        telegramLinkCode
      },
      message: "Hisob yaratildi. Davom etish uchun Telegram orqali tasdiqlang."
    });
  } catch (err) {
    logger.error({ err }, "Register endpoint error");
    res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
});

// 2. POST /api/auth/login
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const errors = (result.error as any).errors.map((e: any) => e.message).join(" ");
    return res.status(400).json({ error: errors });
  }

  const { email, password } = result.data;

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
      return res.status(403).json({ error: "Sizning hisobingiz bloklangan. Qo'shimcha ma'lumot uchun qo'llab-quvvatlash xizmagiga murojaat qiling." });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = await generateRefreshToken(user.id, req);
    setAuthCookies(res, accessToken, refreshToken);

    logger.info({ userId: user.id }, "User logged in successfully");

    res.json({
      accessToken,
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
        averageRating: user.averageRating,
        totalReviews: user.totalReviews,
        isVip: user.isVip,
        vipExpiresAt: user.vipExpiresAt,
      },
    });
  } catch (err) {
    logger.error({ err }, "Login endpoint error");
    res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
});

// 3. POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  // Read from cookie first, fallback to body
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
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
          await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => {});
          logger.warn({ userId }, "Refresh token reuse attempt detected. All active sessions cleared.");
          return res.status(401).json({ error: "Refresh token allaqachon ishlatilgan yoki yaroqsiz! Xavfsizlik choralari tufayli barcha faol seanslar tugatildi." });
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

    setAuthCookies(res, accessToken, newRefreshToken);

    res.json({ 
      accessToken, 
      user: {
        id: dbToken.user.id,
        name: dbToken.user.name,
        email: dbToken.user.email,
        role: dbToken.user.role
      } 
    });
  } catch (err) {
    logger.error({ err }, "Token refresh endpoint error");
    res.status(500).json({ error: "Tokenni yangilashda xatolik yuz berdi." });
  }
});

// 4. POST /api/auth/logout
router.post("/logout", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken }
    }).catch(() => {});
  }
  res.clearCookie("token");
  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Sessiya tugatildi." });
});

// 5. GET /api/auth/me
router.get("/me", async (req: Request, res: Response) => {
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
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || user.isBanned) {
      res.clearCookie("token");
      res.clearCookie("refreshToken");
      return res.status(403).json({ error: "Hisobingiz bloklangan yoki o'chirilgan." });
    }

    res.json({
      accessToken: token,
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
        averageRating: user.averageRating,
        totalReviews: user.totalReviews,
        isVip: user.isVip,
        vipExpiresAt: user.vipExpiresAt,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "Yaroqsiz yoki muddati o'tgan seans." });
  }
});


// 7. POST /api/auth/forgot-password
router.post("/forgot-password", passwordResetLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email manzilini kiritish majburiy." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const genericMessage = "Agar ushbu email tizimda mavjud bo'lsa, parolni tiklash havolasi yuborildi.";
    
    if (!user) {
      return res.json({ success: true, message: genericMessage });
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

    await sendEmail(
      email,
      "Savdo24 — Parolni qayta tiklash",
      `
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
      `
    );

    res.json({ success: true, message: genericMessage });
  } catch (err) {
    logger.error({ err }, "Forgot password error");
    res.status(500).json({ error: "Parolni tiklash so'rovida xatolik yuz berdi." });
  }
});

// 8. POST /api/auth/reset-password
router.post("/reset-password", passwordResetLimiter, async (req: Request, res: Response) => {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    const errors = (result.error as any).errors.map((e: any) => e.message).join(" ");
    return res.status(400).json({ error: errors });
  }

  const { token, password } = result.data;

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: "Faol bo'lmagan yoki muddati o'tgan parol tiklash tokeni." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    logger.info({ userId: user.id }, "Password reset successfully");
    res.json({ success: true, message: "Parol muvaffaqiyatli yangilandi. Yangi parol bilan tizimga kirishingiz mumkin." });
  } catch (err) {
    logger.error({ err }, "Reset password error");
    res.status(500).json({ error: "Parolni saqlashda xatolik yuz berdi." });
  }
});

export default router;
