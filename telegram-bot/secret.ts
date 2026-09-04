// Ichki server-bot autentifikatsiya kaliti + shu kalitga bog'liq
// umumiy funksiyalar. Bu qiymat bir marta (modul yuklanganda) hisoblanadi
// va butun bot bo'ylab (index.ts, exchange-service.ts va h.k.) bir xil
// import orqali ishlatiladi.
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { logger } from "../src/lib/logger";

export function resolveInternalSecret(): string {
  const fromEnv = process.env.TELEGRAM_BOT_INTERNAL_SECRET;
  if (fromEnv && fromEnv.length >= 24) return fromEnv;

  const secretFilePath = path.resolve(process.cwd(), ".secret_TELEGRAM_BOT_INTERNAL_SECRET");
  try {
    if (fs.existsSync(secretFilePath)) {
      const saved = fs.readFileSync(secretFilePath, "utf8").trim();
      if (saved && saved.length >= 24) return saved;
    }
    const generated = crypto.randomBytes(32).toString("hex");
    // TUZATILDI (MUSOBAQA HOLATI/RACE CONDITION): avval oddiy
    // writeFileSync ishlatilardi — agar server (src/lib/context.ts,
    // xuddi shu faylni bir xil mantiq bilan yozadi) va bot PM2 orqali
    // bir vaqtda BIRINCHI marta ishga tushsa, ikkalasi ham yuqoridagi
    // existsSync'da faylni "hali yo'q" deb topib, HAR XIL tasodifiy
    // kalit generatsiya qilib, bir-birining ustidan yozib qo'yishi
    // mumkin edi — natijada bot va server xotirasida turli qiymat
    // qolib, birinchi so'rovlar 403 bilan muvaffaqiyatsiz tugardi (faqat
    // birontasi qayta ishga tushgandan keyin fayldan qayta o'qib
    // to'g'irlanardi). Endi `flag: "wx"` (exclusive — fayl ALLAQACHON
    // mavjud bo'lsa xato tashlaydi) bilan yozamiz: agar shu oraliqda
    // boshqa process (server) allaqachon yozib ulgurgan bo'lsa, EEXIST
    // xatosi tutiladi va O'ZIMIZ GENERATSIYA QILGAN qiymat emas, balki
    // ENDI FAYLDA turgan (g'olib chiqqan) qiymat o'qib qaytariladi —
    // shu bilan "kim birinchi yozsa, o'shaniki qoladi" ta'minlanadi va
    // ikkala tomon HAR DOIM bir xil kalitga ega bo'ladi.
    try {
      fs.writeFileSync(secretFilePath, generated, { encoding: "utf8", flag: "wx" });
      logger.warn(
        `⚠️ TELEGRAM_BOT_INTERNAL_SECRET .env'da topilmadi — avto-kalit yaratildi va saqlandi: ${secretFilePath}`
      );
      return generated;
    } catch (writeErr: unknown) {
      const code = (writeErr as NodeJS.ErrnoException)?.code;
      if (code === "EEXIST") {
        // Boshqa process (server) shu oraliqda faylni allaqachon
        // yaratib ulgurgan — G'OLIB O'SHA, biz o'zimiz generatsiya
        // qilgan qiymatni tashlab, faylni qayta o'qiymiz.
        const winner = fs.readFileSync(secretFilePath, "utf8").trim();
        if (winner && winner.length >= 24) return winner;
      }
      throw writeErr;
    }
  } catch (err) {
    logger.warn({ err }, "⚠️ Avto-kalit faylini o'qib/yozib bo'lmadi, vaqtinchalik kalit ishlatiladi");
    return crypto.randomBytes(32).toString("hex");
  }
}

export const TELEGRAM_BOT_INTERNAL_SECRET = resolveInternalSecret();

// TUZATILDI: endi ixtiyoriy `payload` parametrini ham qabul qiladi —
// masalan /start'ning deep-link parametri (?start=XXX, referal manbasi).
// Server tomonida bu qiymat AnalyticsEvent.metadata JSON ichiga
// yoziladi (qarang: POST /api/telegram/track-event), shu bilan qaysi
// havola orqali kimlar kelganini keyinchalik AnalyticsEvent orqali
// tahlil qilish mumkin bo'ladi.
export function trackBotEvent(
  event: string,
  telegramUserId: number | string | undefined,
  payload?: string
) {
  if (!telegramUserId) return;
  fetch(`${process.env.APP_URL}/api/telegram/track-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET
    },
    body: JSON.stringify({ event, telegramUserId, payload })
  }).catch((err) => logger.warn({ err, event }, "trackBotEvent failed (e'tiborsiz qoldirildi)"));
}

