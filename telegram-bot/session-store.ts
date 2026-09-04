// Sessiya (SessionData) server tomonidagi (Postgres, TelegramBotSession
// jadvali) DOIMIY xotiraga yoziladi — bot qayta ishga tushirilsa ham
// foydalanuvchining "yarim yo'ldagi" holati (masalan kanal nomini kutish,
// qidiruv/sharh/murojaat matnini kutish) saqlanib qoladi. `getSessionKey`
// index.ts'da aniq telegramUserId'ga bog'langan (standart ctx.chat.id
// o'rniga) — bu loyihadagi boshqa barcha joylarda (til, obuna almashish
// va h.k.) ishlatiladigan kalit bilan bir xil.
//
// MUHIM (TARIX): Ilgari bu yerda HAR BIR o'qish/yozish/o'chirish asosiy
// serverga HTTP so'rov (fetch) yuborardi. Bu — HAR BIR foydalanuvchi
// xabariga (grammy `session()` middleware avtomatik chaqiradi) kamida
// 2 ta qo'shimcha tarmoq so'rovini (bitta o'qish + bitta yozish) qo'shar
// edi. Bu yerda business-logika (validatsiya, bildirishnoma va h.k.)
// yo'q — faqat oddiy key-value o'qish/yozish, shuning uchun bu joy
// to'g'ridan-to'g'ri DB'ga (Prisma orqali, telegram-bot/db.ts) o'tkazish
// uchun ENG XAVFSIZ va ENG YUQORI FOYDALI joy edi.
import { StorageAdapter } from "grammy";
import { logger } from "../src/lib/logger";
import { SessionData } from "./types";
import { prisma } from "./db";

export const sessionStorage: StorageAdapter<SessionData> = {
  async read(key: string): Promise<SessionData | undefined> {
    try {
      const row = await prisma.telegramBotSession.findUnique({ where: { telegramUserId: key } });
      if (!row || !row.data) return undefined;
      return JSON.parse(row.data) as SessionData;
    } catch (err) {
      logger.warn({ err, key }, "session read xatosi — vaqtincha bo'sh sessiya bilan davom etiladi");
      return undefined;
    }
  },
  // TUZATISH (KRITIK — "jim xato"): oldin bu yerda baza xatosi bo'lsa
  // faqat logger.warn qilinardi va write() muvaffaqiyatli tugagandek
  // (Promise<void> resolve) qaytardi. Natijada masalan to'lov tokeni
  // (ctx.session.token) yozilmay qolsa ham, foydalanuvchi "✅ Tekshirish"
  // tugmasini bossa fayl yetkazib berilmasdi — va bu holatni faqat
  // log'lardan qidirib topish mumkin edi, tashqaridan (botdan) umuman
  // ko'rinmasdi.
  //
  // Endi: (1) vaqtinchalik (tarmoq/DB) xatolarni yutib yubormaslik uchun
  // bir necha marta qisqa orqaga chekinish (backoff) bilan qayta
  // urinamiz; (2) barcha urinishlar tugagach ham muvaffaqiyatsiz bo'lsa,
  // xatoni YUTMAYMIZ — uni QAYTA TASHLAYMIZ (throw). grammy'ning
  // session() middleware'i write()ni har bir yangilanishdan keyin
  // middleware zanjiri ICHIDA chaqiradi, shuning uchun bu yerda
  // tashlangan xato tabiiy ravishda bot-instance.ts'dagi global
  // `bot.catch()` ushlagichiga boradi — u allaqachon (a) foydalanuvchiga
  // tushunarli "⚠️ Kutilmagan xatolik" xabarini yuboradi va (b) xatoni
  // updateId bilan birga log qiladi. Ya'ni foydalanuvchi endi jim
  // qolmaydi, muammo esa oddiy log qidiruvisiz ham log'da updateId
  // bo'yicha aniq ko'rinadi.
  async write(key: string, value: SessionData): Promise<void> {
    const data = JSON.stringify(value);
    const MAX_ATTEMPTS = 3;
    const BASE_DELAY_MS = 200;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await prisma.telegramBotSession.upsert({
          where: { telegramUserId: key },
          create: { telegramUserId: key, data },
          update: { data }
        });
        return;
      } catch (err) {
        lastErr = err;
        logger.warn(
          { err, key, attempt, maxAttempts: MAX_ATTEMPTS },
          "session write xatosi — qayta urinilmoqda"
        );
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * attempt));
        }
      }
    }

    logger.error(
      { err: lastErr, key },
      "session write xatosi — barcha qayta urinishlar tugadi, sessiya (token, awaiting* holatlar va h.k.) saqlanmadi"
    );
    throw new Error(
      `Sessiyani saqlab bo'lmadi (key=${key}): ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
    );
  },
  async delete(key: string): Promise<void> {
    try {
      await prisma.telegramBotSession.delete({ where: { telegramUserId: key } }).catch(() => {});
    } catch (err) {
      logger.warn({ err, key }, "session delete xatosi");
    }
  }
};
