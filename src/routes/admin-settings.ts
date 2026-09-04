import { Router, Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
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
  getSettingDiagnostic,
  AuthRequest
} from "../lib/context";

const execFileAsync = promisify(execFile);
const router = Router();

// TUZATISH: TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_API_TOKEN bazaga yozilsa-da,
// haqiqiy botni ishga tushiradigan alohida PM2 jarayoni (telegram-bot,
// bu jarayonning o'zi endi src/routes/telegram-integration.ts'dagi
// GET /api/telegram/internal/bot-token orqali shu qiymatni ishga
// tushishda so'raydi — telegram-bot/index.ts'ga qarang) buni faqat
// ISHGA TUSHGANDA o'qiydi, jonli holatda emas. Shu sabab bu ikki kalit
// saqlanganda pastdagi PUT handler bot jarayonini PM2 orqali avtomatik
// qayta ishga tushiradi (bir necha soniyalik qisqa uzilish, lekin sayt/
// asosiy server bunga aloqasi yo'q) — aks holda o'zgarish "yozilgan-u,
// lekin kuchga kirmagan" bo'lib qolardi va admin buni bilmasdi.
const BOT_TOKEN_KEYS = new Set(["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_API_TOKEN", "TELEGRAM_SUBSCRIBER_BOT_TOKEN"]);

// 🆕 Har bir bot-token kaliti O'Z PM2 jarayoniga tegishli: asosiy bot
// ("telegram-bot") va "obunachi yig'ish" boti ("telegram-subscriber-bot")
// ALOHIDA processlar (qarang: ecosystem.config.cjs) — shu sabab
// TELEGRAM_SUBSCRIBER_BOT_TOKEN saqlanganda asosiy botni emas, faqat
// obunachi yig'ish botini qayta ishga tushirish kerak.
const PM2_APP_NAME_BY_KEY: Record<string, string> = {
  TELEGRAM_BOT_TOKEN: process.env.PM2_BOT_APP_NAME || "telegram-bot",
  TELEGRAM_BOT_API_TOKEN: process.env.PM2_BOT_APP_NAME || "telegram-bot",
  TELEGRAM_SUBSCRIBER_BOT_TOKEN: process.env.PM2_SUBSCRIBER_BOT_APP_NAME || "telegram-subscriber-bot"
};

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
  "TELEGRAM_BOT_API_TOKEN",
  // 🆕 "Obunachi yig'ish" (majburiy obuna/sponsor-gate) funksiyasi uchun
  // ALOHIDA bot tokeni — asosiy bot bilan bir xil kodni ikkiga bo'lish
  // o'rniga, shu ikkinchi token bilan mustaqil process (telegram-bot/
  // subscriber-bot/index.ts) ishga tushadi.
  "TELEGRAM_SUBSCRIBER_BOT_TOKEN",
  // TUZATISH (tizim tekshiruvi paytida topildi): "obunachi yig'ish"
  // boti obuna tasdiqlangach qaysi (asosiy) botga o'tish tugmasini
  // ko'rsatishini shu qiymat orqali biladi. Ikkala bot tokeni ham
  // admin panelda tahrirlanadi, lekin bu sozlama avval FAQAT .env
  // orqali o'zgartirilardi — admin server terminaliga kirmasdan buni
  // o'zgartira olmasdi. Maxfiy emas (shunchaki @username), shuning
  // uchun SECRET_KEYS'ga emas, faqat shu ro'yxatga qo'shildi.
  "MAIN_BOT_USERNAME",
  "TELEGRAM_STORAGE_CHANNEL_ID",
  "TELEGRAM_BACKUP_CHAT_ID",
  "BACKUP_GITHUB_TOKEN",
  "BACKUP_GITHUB_REPO",
  "BACKUP_GITHUB_EMAIL",
  "BACKUP_GITHUB_NAME",
  "GOOGLE_DRIVE_CLIENT_EMAIL",
  "GOOGLE_DRIVE_PRIVATE_KEY",
  "GOOGLE_DRIVE_FOLDER_ID",
  "APP_URL",
  "GOOGLE_CLIENT_ID",
  "SMTP_SERVICE",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TELEGRAM_ADMIN_CHAT_ID",
  // ESLATMA: TELEGRAM_BOT_INTERNAL_SECRET ATAYLAB bu ro'yxatda emas.
  // Bu kalit endi src/lib/context.ts'dagi getSecret() orqali faqat
  // .env (yoki avto-generatsiya qilingan umumiy fayl)dan olinadi va
  // bazaga umuman yozilmaydi — chunki telegram-bot/index.ts alohida
  // process bo'lib, bazaga ulanmaydi va uni baribir o'qiy olmasdi.
  // Buni admin panelda tahrirlash imkonini qoldirish faqat ikki tomon
  // (server/bot) orasida qiymat farqlanib ketishiga (va doimiy 403
  // "Ruxsat etilmagan" xatosiga) olib kelishi mumkin edi.
  "TOP_BASE_PRICE_PER_DAY",
  "TOP_MAX_CONCURRENT_SLOTS",
  "VIP_DISCOUNT_PERCENT",
  "VIP_PRICE_PER_DAY",
  "EXCHANGE_MAX_CHANNELS_PER_USER",
  // TUZATISH (tizim tekshiruvi paytida topildi): kunlik yangi-obuna
  // chegarasi (getMaxNewSubsPerDay(), qarang: exchange-channels.ts)
  // kod ichida sozlanadigan (getSetting orqali) qilib yozilgan edi,
  // lekin bu ro'yxatga ATAYLAB emas, e'tibordan chetda qolib qo'shilmay
  // qolgan — shu sabab admin panelidan bu qiymatni UMUMAN o'zgartirib
  // bo'lmasdi (faqat standart 30 yoki .env'dagi qiymat ishlatilaverardi).
  "EXCHANGE_MAX_NEW_SUBS_PER_DAY",
  // YANGI (admin talabi — "1 kanalga obuna bo'lsa necha ta obunachi
  // qo'shilishi kerak" kabi qoidalarni admin paneldan sozlash): avval
  // bular exchange-channels.ts ichida qattiq kodlangan (masalan har doim
  // 2) konstantalar edi. Endi getSubscriberMultiplier/getReferralBonus/
  // getWelcomeBonus orqali shu sozlamalardan o'qiladi — admin xohlagan
  // songa (masalan 100) o'zgartirishi mumkin. Bo'sh/yozilmagan bo'lsa
  // standart qiymatlar (mos ravishda 2, 5, 5) ishlatiladi.
  "EXCHANGE_SUBSCRIBER_MULTIPLIER",
  "EXCHANGE_REFERRAL_BONUS",
  "EXCHANGE_WELCOME_BONUS"
];

const SECRET_KEYS = [
  "COINGATE_API_TOKEN",
  "CONTABO_ACCESS_KEY",
  "CONTABO_SECRET_KEY",
  "SMTP_PASS",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_API_TOKEN",
  "TELEGRAM_SUBSCRIBER_BOT_TOKEN",
  "BACKUP_GITHUB_TOKEN",
  "GOOGLE_DRIVE_PRIVATE_KEY",
  "GOOGLE_DRIVE_FOLDER_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
];

function maskValue(val: string): string {
  if (!val) return "";
  if (val.length <= 4) return "••••";
  return "••••••••" + val.slice(-4);
}

// TUZATISH: ilgari TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_API_TOKEN hech qanday
// tekshiruvsiz to'g'ridan-to'g'ri bazaga yozilardi — token noto'g'ri
// (yoki nusxalashda xato ketgan, bo'sh joy qo'shilgan va h.k.) bo'lsa,
// bu FAQAT keyinroq, birinchi bildirishnoma yuborilmay qolganda
// (sendTelegramMessage() xato qaytarganda) bilinardi. Endi saqlashdan
// oldin Telegram'ning getMe() metodi orqali token darhol tekshiriladi:
// token noto'g'ri bo'lsa (Telegram 401/404 bilan javob bersa), saqlash
// butunlay rad etiladi va admin buni shu zahoti ko'radi.
async function verifyTelegramBotToken(
  token: string
): Promise<{ ok: true; botUsername?: string } | { ok: false; reason: "invalid" | "network"; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: controller.signal });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) {
      return { ok: true, botUsername: data.result?.username };
    }
    // Telegram noto'g'ri token uchun ham odatda JSON bilan javob beradi
    // ({ ok: false, error_code, description }) — description'ni to'g'ridan-to'g'ri
    // adminga ko'rsatamiz (masalan "Unauthorized").
    return {
      ok: false,
      reason: "invalid",
      message: data?.description || `Telegram API xato qaytardi (HTTP ${res.status}).`
    };
  } catch (err: unknown) {
    // Tarmoq xatosi / timeout — bu tokenning o'zi noto'g'ri ekanini
    // anglatmaydi (masalan Telegram API vaqtincha ishlamayotgan bo'lishi
    // mumkin), shuning uchun bunday holatda saqlashni bloklamaymiz —
    // faqat ogohlantiramiz.
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "Noma'lum tarmoq xatosi." };
  } finally {
    clearTimeout(timeoutId);
  }
}

// GET /api/admin/settings — Barcha sozlamalarni qisman yashirgan holda olish (Admin)
router.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const results = [];
    for (const key of ALL_KEYS) {
      // TUZATISH (foydalanuvchi so'rovi — production'da VIP_PRICE_PER_DAY/
      // TELEGRAM_BOT_TOKEN kabi sozlamalarni shifrini ochib bo'lmayotgan
      // holat kuzatilgach): oddiy getSetting() bunday xatoni jim yutib
      // yuborardi — admin panelda qiymat oddiy "bo'sh" yoki .env'dagi
      // ESKI qiymat sifatida ko'rinardi, admin esa buning sababi
      // ENCRYPTION_KEY nomuvofiqligi ekanini BILMASDI. Endi shifrlashda
      // xato bo'lsa, buni ANIQ va tushunarli ko'rsatamiz — admin darhol
      // qiymatni qayta kiritib saqlashi kerakligini tushunadi.
      const diag = await getSettingDiagnostic(key);
      const isSecret = SECRET_KEYS.includes(key);
      const displayValue = diag.decryptFailed
        ? "⚠️ SHIFRLASHDA XATOLIK — qiymatni qayta kiriting"
        : diag.value
          ? (isSecret ? maskValue(diag.value) : diag.value)
          : "";
      results.push({
        key,
        value: displayValue,
        hasValue: !!diag.value,
        isSecret,
        decryptFailed: diag.decryptFailed
      });
    }
    res.json(results);
  } catch (err: unknown) {
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
    // Bot tokenini saqlashdan OLDIN tekshiramiz (bo'sh qiymat — tokenni
    // tozalash uchun — tekshirilmaydi). Faqat "invalid" (Telegram token'ni
    // aniq rad etgan) holatda saqlash to'xtatiladi; tarmoq xatosida
    // saqlash davom etadi, lekin javobga ogohlantirish qo'shiladi.
    let tokenVerifyWarning: string | undefined;
    if (BOT_TOKEN_KEYS.has(key) && value.trim()) {
      const verification = await verifyTelegramBotToken(value.trim());
      if (!verification.ok && verification.reason === "invalid") {
        return res.status(400).json({
          error: `Noto'g'ri Telegram bot tokeni: ${verification.message}. Iltimos, tokenni @BotFather'dan qayta tekshirib kiriting.`
        });
      }
      if (!verification.ok && verification.reason === "network") {
        tokenVerifyWarning = `DIQQAT: token Telegram orqali oldindan tekshirib bo'lmadi (${verification.message}) — baribir saqlandi, lekin agar u noto'g'ri bo'lsa, bildirishnomalar yuborilmaydi.`;
        logger.warn({ key, err: verification.message }, "Bot tokenini oldindan tekshirishda tarmoq xatosi — baribir saqlanmoqda");
      } else if (verification.ok) {
        logger.info({ key, botUsername: verification.botUsername }, "Bot tokeni Telegram getMe() orqali tasdiqlandi");
      }
    }

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

    // TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_API_TOKEN — bot jarayoni tokenni
    // faqat ishga tushganda o'qigani uchun, o'zgarish kuchga kirishi
    // uchun uni qayta ishga tushirish kerak (yuqoridagi izohga qarang).
    let warning: string | undefined = tokenVerifyWarning;
    if (BOT_TOKEN_KEYS.has(key)) {
      const pm2BotAppName = PM2_APP_NAME_BY_KEY[key];
      try {
        await execFileAsync("pm2", ["describe", pm2BotAppName]);
        // Javobni admin darhol olsin, bot esa fonda qayta ishga tushsin —
        // pastdagi admin-rebuild.ts'dagi server restart bilan bir xil naqsh.
        execFileAsync("pm2", ["restart", pm2BotAppName]).catch((err: unknown) => {
          logger.error({ err, pm2BotAppName }, `Bot tokeni yangilandi, lekin '${pm2BotAppName}' jarayonini qayta ishga tushirib bo'lmadi`);
        });
        const restartMsg = `Bot jarayoni (${pm2BotAppName}) yangi token bilan avtomatik qayta ishga tushirilmoqda — bir necha soniyada kuchga kiradi.`;
        warning = warning ? `${warning} ${restartMsg}` : restartMsg;
        logger.info({ adminId: req.user?.id, pm2BotAppName, key }, `Bot tokeni yangilandi, ${pm2BotAppName} jarayoni qayta ishga tushirilmoqda`);
      } catch (err: unknown) {
        const restartMsg = `DIQQAT: bu qiymat "${pm2BotAppName}" jarayoniga ta'sir qilishi uchun uni qo'lda qayta ishga tushirish kerak ("pm2 restart ${pm2BotAppName}") — bu muhitda PM2 orqali "${pm2BotAppName}" jarayoni topilmadi (masalan dev rejimida yoki PM2 o'rnatilmagan bo'lishi mumkin).`;
        warning = warning ? `${warning} ${restartMsg}` : restartMsg;
        logger.warn({ err, pm2BotAppName, key }, `Bot tokeni yangilandi, lekin PM2 orqali '${pm2BotAppName}' jarayoni topilmadi — qo'lda restart kerak`);
      }
    }

    res.json({ success: true, key, value: maskValue(value), warning });
  } catch (err: unknown) {
    logger.error({ err, key }, "Save setting error");
    res.status(500).json({ error: "Sozlamani saqlashda xatolik yuz berdi." });
  }
});

export default router;
