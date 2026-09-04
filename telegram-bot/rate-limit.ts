// 🚦 RATE LIMITING (SPAM/DOS HIMOYASI): har bir Telegram foydalanuvchisi
// (ctx.from.id) uchun oxirgi RATE_LIMIT_WINDOW_MS ichida nechta update
// (xabar/tugma/buyruq) yuborgani hisoblanadi. Agar shu oyna ichida
// RATE_LIMIT_MAX_REQUESTS'dan oshsa — so'rov e'tiborsiz qoldiriladi (yoki
// juda tez-tez bosilsa, qisqa ogohlantirish beriladi, lekin flood-control'ga
// uchramaslik uchun ogohlantirish o'zi ham cheklanadi).
//
// MUHIM: bu middleware `session()` middleware'idan OLDIN turishi kerak
// (index.ts'da qanday ulanganiga qarang) — shu bilan spam qiluvchi
// foydalanuvchi uchun hatto sessiya o'qish/yozish ham chaqirilmaydi.
//
// MUHIM (TARIX — CLUSTER-SAFE QILISH): Ilgari hisob faqat shu process
// xotirasidagi Map'da saqlanardi. `ecosystem.config.cjs`da hozir
// `instances: 1` bo'lgani uchun bu amalda to'g'ri ishlardi, lekin kimdir
// kelajakda bir nechta instance (cluster) ishga tushirsa, har bir
// instance o'z alohida hisobini yuritib, cheklov chetlab o'tilishi mumkin
// edi. Endi hisob `telegram_rate_limit` jadvalida (barcha instance'lar
// uchun UMUMIY, atomik) saqlanadi — ko'rish uchun telegram-bot/db.ts'ga
// qarang. Bazaga murojaat FAIL-OPEN: xato bo'lsa, so'rov cheklanmagan deb
// hisoblanadi (botni to'liq to'xtatib qo'yishdan ko'ra yaxshiroq).
//
// Bitta xotira-kesh (localWarnCache) faqat "ogohlantirish xabari juda
// tez-tez yuborilmasin" degan, kritik bo'lmagan maqsad uchun qoldirildi —
// bu instance'lar orasida sinxron bo'lmasa ham, eng yomon holatda
// foydalanuvchi bir nechta instance'dan bir nechta ogohlantirish oladi,
// bu esa haqiqiy limitning o'zi (bazada, umumiy) ishlashiga ta'sir qilmaydi.
import { Context } from "grammy";
import { logger } from "../src/lib/logger";
import { t, getUserLanguage } from "./i18n";
import { incrementRateLimitCounter } from "./db";
import { TELEGRAM_BOT_INTERNAL_SECRET } from "./secret";
import { recordFailOpenOutcome } from "./fail-open-monitor";

const RATE_LIMIT_WINDOW_MS = 10_000; // 10 soniyalik oyna
const RATE_LIMIT_MAX_REQUESTS = 15; // shu oyna ichida ruxsat etilgan max so'rov
const RATE_LIMIT_WARN_COOLDOWN_MS = 10_000; // ogohlantirish xabari nechchi ms'da bir marta yuborilishi mumkin

// Faqat ogohlantirish spamini kamaytirish uchun — limitning o'zi emas.
const localWarnCache = new Map<number, number>();

// Xotirada cheksiz o'sib ketmasligi uchun — vaqti-vaqti bilan eski
// (faol bo'lmagan) yozuvlarni tozalab turamiz.
setInterval(() => {
  const now = Date.now();
  for (const [userId, lastWarnedAt] of localWarnCache) {
    if (now - lastWarnedAt > RATE_LIMIT_WINDOW_MS) {
      localWarnCache.delete(userId);
    }
  }
}, 5 * 60 * 1000).unref();

// TUZATILDI (QAYTA ISHLATISH): bu funksiya avval `MyContext` (asosiy
// botning session-flavored konteksti) bilan yozilgan edi, garchi
// ichkarida FAQAT `ctx.from`/`ctx.reply`dan foydalansa-da — shu sabab
// "obunachi yig'ish" boti (session'siz, oddiy `Context`) uni to'g'ridan-
// to'g'ri ishlata olmasdi. Endi imzo umumiyroq `Context`ga o'zgartirildi
// (MyContext = Context & SessionFlavor bo'lgani uchun ikkalasi ham mos
// keladi) — bir xil kod, ikkala bot uchun ham.
export async function rateLimitMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  const userId = ctx.from?.id;
  // Foydalanuvchisiz update'lar (masalan ba'zi maxsus holatlar) tekshirilmaydi.
  if (!userId) return next();

  const now = Date.now();
  let count: number;
  try {
    count = await incrementRateLimitCounter(String(userId), now, RATE_LIMIT_WINDOW_MS);
    recordFailOpenOutcome("rate-limit", true);
  } catch (err) {
    // FAIL-OPEN: baza vaqtincha javob bermasa, bu so'rovni cheklamaymiz —
    // spam-himoyaning bir lahzalik ishlamasligi, botning butunlay
    // to'xtab qolishidan ancha yaxshiroq. Bu holat KETMA-KET necha marta
    // takrorlanayotgani recordFailOpenOutcome orqali kuzatiladi — agar
    // bu bir martalik hodisa bo'lmay, uzoq davom etayotgan uzilishga
    // aylansa, log darajasi avtomatik logger.error'ga ko'tariladi
    // (qarang: fail-open-monitor.ts).
    recordFailOpenOutcome("rate-limit", false, { err, userId });
    logger.warn({ err, userId }, "rate-limit DB xatosi — so'rov cheklanmagan deb hisoblandi");
    return next();
  }

  if (count > RATE_LIMIT_MAX_REQUESTS) {
    logger.warn({ userId, count }, "Rate limit oshib ketdi — so'rov e'tiborsiz qoldirildi");
    const lastWarnedAt = localWarnCache.get(userId) ?? 0;
    if (now - lastWarnedAt > RATE_LIMIT_WARN_COOLDOWN_MS) {
      localWarnCache.set(userId, now);
      // TUZATILDI: bu middleware session() plaginidan OLDIN ulangani
      // sabab (ataylab — yuqoridagi izohga qarang) `ctx.session` bu
      // yerda hali umuman mavjud emas, shuning uchun `ctx.session?.language`
      // doim `undefined` bo'lib, ogohlantirish HAR DOIM "uz" tilida
      // yuborilardi (inglizcha tanlagan foydalanuvchiga ham). getUserLanguage
      // esa sessiyadan mustaqil, to'g'ridan-to'g'ri bazadan (keshlangan)
      // o'qiydi — shu sabab bu yerda xavfsiz ishlatish mumkin.
      const lang = await getUserLanguage(userId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
      ctx.reply(t("rate_limit_warning", lang)).catch(() => {});
    }
    // next() CHAQIRILMAYDI — shu bilan bu update umuman handler'larga
    // yetib bormaydi (session yozilmaydi, tashqi API'ga so'rov ketmaydi).
    return;
  }

  return next();
}
