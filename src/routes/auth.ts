import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { logger } from "../lib/logger";

// We import shared instances and helpers from context
import {
  prisma,
  JWT_SECRET,
  generateRefreshToken,
  sendEmail,
  sendTelegramMessage,
  authenticateToken,
  getSetting,
  AuthRequest
} from "../lib/context";
import { escapeHtml, getErrorCode } from "../lib/pure-helpers";
import { authLimiter, authAccountLimiter, passwordResetLimiter } from "../lib/rateLimiters";

const router = Router();

// Zod schemas for input validation
const registerSchema = z.object({
  email: z.string().email("Noto'g'ri email formati.").transform(v => v.trim().toLowerCase()),
  password: z.string()
    .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak."),
  name: z.string().min(1, "Ism kiritilishi shart."),
  // Telefon raqami va referral kod ixtiyoriy — kiritilmasa ham ro'yxatdan
  // o'tish davom etadi.
  phone: z.string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Telefon raqami noto'g'ri formatda.")
    .optional()
    .or(z.literal("")),
  referralCode: z.string().trim().max(64).optional().or(z.literal(""))
});

const loginSchema = z.object({
  email: z.string().email("Noto'g'ri email formati.").transform(v => v.trim().toLowerCase()),
  password: z.string().min(1, "Parol kiritilishi shart.")
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token kiritilishi shart."),
  password: z.string()
    .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak.")
});

// Helper to set HttpOnly auth cookies
const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".savdo24.online" : undefined;

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: "/",
    domain: COOKIE_DOMAIN
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    domain: COOKIE_DOMAIN
  });
}

// clearCookie faqat set qilingandagi bilan AYNAN bir xil domain/path berilganda ishlaydi
// (brauzerlar shunday talab qiladi) — shuning uchun alohida helper orqali izchillikni ta'minlaymiz.
function clearAuthCookies(res: Response) {
  res.clearCookie("token", { path: "/", domain: COOKIE_DOMAIN });
  res.clearCookie("refreshToken", { path: "/", domain: COOKIE_DOMAIN });
}

// 1. POST /api/auth/register
router.post("/register", [authLimiter, authAccountLimiter], async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message).join(" ");
    return res.status(400).json({ error: errors });
  }

  const { email, password, name, phone, referralCode } = result.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Ushbu email bilan allaqachon ro'yxatdan o'tilgan." });
    }

    // Referral kod kiritilgan bo'lsa, faqat mavjud va faol kod bo'lsa saqlaymiz
    // (noto'g'ri kod ro'yxatdan o'tishni to'xtatmaydi — chegirma/komissiya
    // hisob-kitobi xarid vaqtida amalga oshadi).
    let normalizedReferralCode: string | null = null;
    if (referralCode) {
      const code = referralCode.trim().toUpperCase();
      const referral = await prisma.referral.findUnique({ where: { code, isActive: true } });
      if (referral) {
        normalizedReferralCode = code;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    // 🛡️ MAXSUS ADMIN EMAIL: shu email bilan ro'yxatdan o'tilsa, hisob
    // AVTOMATIK "Admin" roli bilan yaratiladi — boshqa hamma odatdagidek
    // "Xaridor" bo'lib qoladi. Solishtirish katta-kichik harfga sezgir
    // EMAS (email umuman .toLowerCase() qilinib saqlanadi — 26-qator),
    // shu sabab bu yerda ham pastki registrga o'tkazilgan holda solishtiramiz.
    const ADMIN_AUTO_EMAIL = "alexsammers117@gmail.com";
    const userRole = email === ADMIN_AUTO_EMAIL ? "Admin" : "Xaridor";
    const telegramLinkCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const telegramLinkCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    // 10-MUAMMO: Email-tasdiqlash kodini (verificationToken) generatsiya qilib foydalanishga kiritish (Variant 2 tanlandi)
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole,
        joinDate: new Date(),
        avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
        verified: false,
        emailVerified: false,
        telegramLinkCode,
        telegramLinkCodeExpires,
        verificationToken,
        phone: phone || null,
        signupReferralCode: normalizedReferralCode,
      },
    });

    // 10-MUAMMO (TUZATILDI): avval bu yerda email-tasdiqlash xati yuborish
    // o'chirilgan edi ("Telegram va Google orqali tasdiqlash ishlatiladi"
    // izohi bilan) — lekin email/parol orqali ro'yxatdan o'tib, Telegram
    // hisobini hech qachon ulamagan foydalanuvchi UCHUN email'ni tasdiqlashning
    // boshqa hech qanday yo'li yo'q edi (verificationToken generatsiya
    // qilinardi-yu, hech qachon ishlatilmasdi). Bu ham xavfsizlik bo'shlig'i
    // (tasdiqlanmagan email bilan cheksiz hisob ochish imkoniyati / spam),
    // ham foydalanuvchi uchun chiqish yo'li yopiq tuzoq edi. Endi xat
    // haqiqatan yuboriladi; xatolik bo'lsa ham ro'yxatdan o'tish
    // to'xtatilmaydi (email keyinroq "qayta yuborish" orqali ham olinishi
    // mumkin — pastdagi /resend-verification).
    try {
      const appUrl = await getSetting("APP_URL") || process.env.APP_URL || "http://localhost:3000";
      const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;
      await sendEmail(
        email,
        "Savdo24 — Emailingizni tasdiqlang",
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #0d131a; color: #ffffff;">
            <h2 style="color: #10b981; text-align: center;">Xush kelibsiz, ${escapeHtml(name)}!</h2>
            <p>Savdo24'da ro'yxatdan o'tganingiz uchun rahmat. Hisobingizni faollashtirish uchun quyidagi tugmani bosing:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Emailni tasdiqlash</a>
            </div>
            <p style="font-size: 12px; color: #8892b0;">Yoki Telegram hisobingizni ulash orqali ham avtomatik tasdiqlanishi mumkin.</p>
            <p style="font-size: 12px; color: #10b981; word-break: break-all;">${verifyUrl}</p>
            <hr style="border: none; border-top: 1px solid #18202c; margin: 20px 0;" />
            <p style="font-size: 11px; color: #8892b0; text-align: center;">Savdo24 — Startaplar va raqamli loyihalar bozori</p>
          </div>
        `
      );
    } catch (emailErr: unknown) {
      // Xat yuborilmasa ham ro'yxatdan o'tish davom etadi — foydalanuvchi
      // keyinroq /resend-verification orqali qayta so'rashi mumkin.
      logger.error({ err: emailErr, userId: user.id }, "Ro'yxatdan o'tishda tasdiqlash emaili yuborilmadi");
    }

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
  } catch (err: unknown) {
    // 102-band: agar bir xil email bilan ikkita ro'yxatdan o'tish so'rovi
    // AYNAN bir vaqtda kelsa (masalan tarmoq kechikishi tufayli qayta
    // yuborilsa yoki ikki xil qurilmadan), yuqoridagi findUnique tekshiruvi
    // ikkalasi uchun ham "mavjud emas" deb topishi mumkin — keyin Prisma'ning
    // o'zi unikal cheklov (email) tufayli xato tashlaydi. Bu xato avval umumiy
    // catch blokiga tushib, chalkash "Serverda xatolik" (500) xabarini
    // ko'rsatardi — endi boshqa joylardagi (routes/support.ts, server.ts)
    // P2002 ishlov berish naqshiga mos ravishda aniq xabar beriladi.
    if (getErrorCode(err) === "P2002") {
      return res.status(400).json({ error: "Ushbu email bilan allaqachon ro'yxatdan o'tilgan." });
    }
    logger.error({ err }, "Register endpoint error");
    res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
});

// 2. POST /api/auth/login
router.post("/login", [authLimiter, authAccountLimiter], async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message).join(" ");
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
        telegramLinked: !!user.telegramUserId,
        telegramBroadcastOptOut: user.telegramBroadcastOptOut,
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
  clearAuthCookies(res);
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

    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || user.isBanned) {
      clearAuthCookies(res);
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
        telegramLinked: !!user.telegramUserId,
        telegramBroadcastOptOut: user.telegramBroadcastOptOut,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "Yaroqsiz yoki muddati o'tgan seans." });
  }
});


// 7. POST /api/auth/forgot-password
router.post("/forgot-password", passwordResetLimiter, async (req: Request, res: Response) => {
  let { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email manzilini kiritish majburiy." });
  }
  email = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const genericMessage = "Agar ushbu email tizimda mavjud bo'lsa, parolni tiklash havolasi yuborildi.";
    
    if (!user) {
      return res.json({ success: true, message: genericMessage });
    }

    if (user.isBanned) {
      logger.info({ email }, "[Forgot Password] Banned user attempted password reset");
      return res.json({ success: true, message: genericMessage });
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
          <p>Salom <strong>${escapeHtml(user.name)}</strong>,</p>
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
      true
    );

    res.json({ success: true, message: genericMessage });
  } catch (err) {
    logger.error({ err }, "Forgot password error");
    res.status(500).json({ error: "Parolni tiklash so'rovida xatolik yuz berdi." });
  }
});

// 7.5. POST /api/auth/forgot-password-telegram
// MUHIM: emailga tayanish (SMTP server ishlamasligi, xatlar spam papkaga
// tushib qolishi, foydalanuvchi email parolini ham unutgan bo'lishi mumkin)
// ba'zan yetarli ishonchli emas. Telegram bot orqali tiklash — agar
// foydalanuvchi hisobini avval botga ulagan bo'lsa — tezroq va ishonchliroq
// muqobil kanal beradi. Email bilan bir xil token/amal qilish muddati
// ishlatiladi, faqat yetkazish kanali farq qiladi.
router.post("/forgot-password-telegram", passwordResetLimiter, async (req: Request, res: Response) => {
  let { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email manzilini kiritish majburiy." });
  }
  email = email.trim().toLowerCase();

  // Xavfsizlik: email mavjudligini yoki Telegram ulanganligini tashqi
  // dunyoga oshkor qilmaslik uchun har doim bir xil umumiy javob beriladi
  // (forgot-password'dagi bir xil naqsh — akkaunt enumeration'ning oldini olish).
  const genericMessage = "Agar ushbu email tizimda mavjud bo'lsa va Telegram hisobingiz ulangan bo'lsa, tiklash havolasi Telegram botga yuborildi.";

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.isBanned || !user.telegramUserId) {
      return res.json({ success: true, message: genericMessage });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 soat

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry }
    });

    const appUrl = await getSetting("APP_URL") || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const sent = await sendTelegramMessage(
      user.telegramUserId,
      `🔑 <b>Parolni qayta tiklash so'rovi</b>\n\n` +
      `Salom, ${escapeHtml(user.name)}!\n\n` +
      `Savdo24'da parolingizni tiklash uchun so'rov yubordingiz. Pastdagi tugma orqali yangi parol o'rnating.\n\n` +
      `⏱ Havola faqat <b>1 soat</b> davomida amal qiladi.\n\n` +
      `Agar bu so'rovni siz yubormagan bo'lsangiz, bu xabarni shunchaki e'tiborsiz qoldiring — hisobingizga hech narsa bo'lmaydi.`,
      { replyMarkup: { inline_keyboard: [[{ text: "🔑 Parolni yangilash", url: resetUrl }]] } }
    );

    if (!sent) {
      // Telegram orqali yuborib bo'lmadi (masalan foydalanuvchi botni
      // bloklagan) — bu holatni ham oshkor qilmasdan, umumiy javobni
      // qaytaramiz, lekin logda sababni qayd qilamiz.
      logger.warn({ userId: user.id }, "[Forgot Password Telegram] Xabar yuborib bo'lmadi (bot bloklangan bo'lishi mumkin)");
    }

    res.json({ success: true, message: genericMessage });
  } catch (err) {
    logger.error({ err }, "Forgot password (Telegram) error");
    res.status(500).json({ error: "Parolni tiklash so'rovida xatolik yuz berdi." });
  }
});

// 8. POST /api/auth/reset-password
router.post("/reset-password", passwordResetLimiter, async (req: Request, res: Response) => {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message).join(" ");
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

    // Xavfsizlik: parol tiklangach, o'sha foydalanuvchining barcha eski
    // refresh tokenlari (faol seanslari) bekor qilinishi shart — aks holda
    // parolni o'g'irlagan/eski sessiyaga ega bo'lgan odam kirishda davom eta oladi.
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } }).catch(() => {});
    clearAuthCookies(res);

    logger.info({ userId: user.id }, "Password reset successfully");
    res.json({ success: true, message: "Parol muvaffaqiyatli yangilandi. Yangi parol bilan tizimga kirishingiz mumkin." });
  } catch (err) {
    logger.error({ err }, "Reset password error");
    res.status(500).json({ error: "Parolni saqlashda xatolik yuz berdi." });
  }
});

// 9. GET /api/auth/verify-email/:token — ro'yxatdan o'tishda yuborilgan
// tasdiqlash havolasi shu yerga tushadi. Muvaffaqiyatli bo'lsa
// emailVerified=true qilinadi va token bir martalik sifatida tozalanadi
// (qayta ishlatib bo'lmaydi).
router.get("/verify-email/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Tasdiqlash tokeni noto'g'ri." });
  }

  try {
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) {
      return res.status(400).json({ error: "Tasdiqlash havolasi noto'g'ri yoki allaqachon ishlatilgan." });
    }

    if (user.emailVerified) {
      return res.json({ success: true, message: "Email allaqachon tasdiqlangan." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null }
    });

    logger.info({ userId: user.id }, "Email verified successfully");
    res.json({ success: true, message: "Email muvaffaqiyatli tasdiqlandi!" });
  } catch (err) {
    logger.error({ err }, "Verify email error");
    res.status(500).json({ error: "Emailni tasdiqlashda xatolik yuz berdi." });
  }
});

// 10. POST /api/auth/resend-verification — foydalanuvchi ro'yxatdan o'tishda
// yuborilgan tasdiqlash xati kelmagan/yo'qolgan bo'lsa, qayta so'rashi
// mumkin. forgot-password bilan bir xil naqsh: hisob mavjudligini oshkor
// qilmaslik uchun har doim bir xil umumiy javob qaytariladi.
router.post("/resend-verification", passwordResetLimiter, async (req: Request, res: Response) => {
  let { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email manzilini kiritish majburiy." });
  }
  email = email.trim().toLowerCase();
  const genericMessage = "Agar ushbu email tizimda mavjud va hali tasdiqlanmagan bo'lsa, tasdiqlash havolasi qayta yuborildi.";

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified || user.isBanned) {
      return res.json({ success: true, message: genericMessage });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({ where: { id: user.id }, data: { verificationToken } });

    const appUrl = await getSetting("APP_URL") || process.env.APP_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    await sendEmail(
      email,
      "Savdo24 — Emailingizni tasdiqlang",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #0d131a; color: #ffffff;">
          <h2 style="color: #10b981; text-align: center;">Emailni tasdiqlash</h2>
          <p>Salom <strong>${escapeHtml(user.name)}</strong>,</p>
          <p>Hisobingizni faollashtirish uchun quyidagi tugmani bosing:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Emailni tasdiqlash</a>
          </div>
          <p style="font-size: 12px; color: #10b981; word-break: break-all;">${verifyUrl}</p>
          <hr style="border: none; border-top: 1px solid #18202c; margin: 20px 0;" />
          <p style="font-size: 11px; color: #8892b0; text-align: center;">Savdo24 — Startaplar va raqamli loyihalar bozori</p>
        </div>
      `
    );

    res.json({ success: true, message: genericMessage });
  } catch (err) {
    logger.error({ err }, "Resend verification error");
    res.status(500).json({ error: "So'rovni bajarishda xatolik yuz berdi." });
  }
});

export default router;
