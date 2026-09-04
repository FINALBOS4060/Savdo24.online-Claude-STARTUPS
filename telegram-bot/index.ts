// Savdo24 Telegram boti — kirish nuqtasi.
//
// Bu fayl endi FAQAT: .env yuklash, xavfsizlik to'rlari (unhandled
// rejection/exception), bot instance yaratish, middleware'larni ulash va
// har bir bo'lim uchun handler modullarini ro'yxatdan o'tkazish bilan
// shug'ullanadi. Haqiqiy mantiq (katalog, matn oqimlari, to'lov, profil
// va h.k.) tegishli modullarga bo'lib chiqilgan — quyidagi import
// ro'yxatiga qarang.
//
// TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
// botining bir-biriga aloqasi bo'lmasligi kerak, obunachi yig'ish
// ishlarini obunachi yig'ish boti qilishi kerak"): avval "Obunachi
// yig'ish" (exchange) handlerlari (registerExchangeHandlers) VA uni
// boshqaruvchi barcha davriy vazifalar (registerCronJobs — sog'liq
// tekshiruvi, qoidabuzarlik tekshiruvi, yangi kanal e'loni va h.k.) SHU
// (asosiy) botda ham ishga tushirilardi — garchi subscriber-bot/index.ts
// da ALLAQACHON xuddi shu ikkalasi ham ishlab turgan bo'lsa ham. Bu
// nafaqat ortiqcha (bir xil ish ikki marta bajarilardi — masalan har bir
// kanal soog'ligi ikki marta tekshirilardi), balki aynan shu ikki
// botning "aralashib ketishi" muammolarga sabab bo'lgan edi (masalan
// avvalgi bug: sog'liq tekshiruvi FAQAT asosiy botning admin holatini
// ko'rar, subscriber-bot orqali admin qilingan kanallarni ko'rmasdi).
// Endi "Obunachi yig'ish" — E'TIBORAN faqat subscriber-bot/index.ts
// javobgarligida: shu (asosiy) bot ENDI registerExchangeHandlers'ni ham,
// registerCronJobs'ni ham chaqirmaydi — bu ikkalasi FAQAT
// subscriber-bot/index.ts'da ishlaydi, FAQAT o'sha botning o'z tokeni
// (TELEGRAM_SUBSCRIBER_BOT_TOKEN) bilan.
//
// MUHIM (TARTIB): registerXxxHandlers(bot) chaqiruvlarining ketma-ketligi
// ASL index.ts'dagi bilan BIR XIL saqlangan, chunki grammy middleware
// zanjirida bir xil update turini (masalan oddiy matnli xabar) ushlaydigan
// bir nechta handler o'zaro `next()` orqali bog'langan — chaqiruv tartibini
// o'zgartirish ba'zi oqimlarni (masalan "🔍 Qidirish" tugmasi yoki kanal
// ro'yxatdan o'tkazish) buzishi mumkin. Har bir modul ichidagi izohlarga
// qarang.
import { session } from "grammy";
import dotenv from "dotenv";
import path from "path";
import { logger } from "../src/lib/logger";
import { getUserLanguage, refreshBotMessageOverrides } from "./i18n";
import { SessionData, MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET } from "./secret";

import { createBot } from "./bot-instance";
import { sessionStorage } from "./session-store";
import { rateLimitMiddleware } from "./rate-limit";
import { sponsorGateMiddleware } from "./sponsor-gate";
import { registerProcessSafetyNets } from "./process-safety";

import { registerStartHandlers } from "./handlers-start";
import { registerCatalogHandlers } from "./handlers-catalog";
import { registerProfileHandlers } from "./handlers-profile";
import { registerTextHandlers } from "./handlers-text";
import { registerInlineHandlers } from "./handlers-inline";
import { registerMenuCallbackHandlers } from "./handlers-menu-callbacks";
import { registerPaymentHandlers } from "./handlers-payment";
import { registerBotCommandMenu } from "./bot-commands";

// Load environment variables from process.cwd() or root .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

// TUZATISH (KRITIK — bot "errored" holatda, "Top-level await is currently
// not supported with the 'cjs' output format" xatosi bilan yiqilardi):
// PM2 `tsx`ni interpreter sifatida chaqirganda, esbuild bu faylni ba'zan
// CJS chiqish formatiga transform qiladi — package.json'da
// "type": "module" bo'lishiga qaramay. CJS formatida MODUL DARAJASIDA
// (top-level) `await` ISHLATIB BO'LMAYDI. Yechim: bot yaratish/ulash
// bosqichini bitta async funksiya ichiga o'raymiz va uni darhol
// chaqiramiz — bu naqsh CJS va ESM'ning IKKALASIDA HAM ishlaydi.
//
// 🛡️ GLOBAL XAVFSIZLIK TO'RI: kod bo'ylab ko'p joyda `ctx.reply(...)`
// `await`/`.catch()`siz chaqiriladi. Agar bunday so'rov rad etilsa
// (foydalanuvchi botni bloklagan, xabar 4096 belgidan uzun va h.k.) —
// Node.js 15+ da bu ODDIY OGOHLANTIRISH EMAS, butun process'ni darhol
// yiqitadi. `registerProcessSafetyNets` (process-safety.ts) bu ikkala
// holatni (unhandledRejection va uncaughtException) boshqaradi — tafsilot
// va TUZATILDI tarixi uchun o'sha faylga qarang. DRY: bu endi asosiy
// va "obunachi yig'ish" botlari uchun BIR XIL, umumiy modul — avval har
// ikkalasida alohida-alohida yozilgan edi.
registerProcessSafetyNets("Savdo24 asosiy bot");

void (async function main() {
  const bot = await createBot();

  // ✉️ Admin panelda tahrirlangan bot-xabar shablonlarini ishga
  // tushishdanoq xotiraga yuklaymiz (keyin i18n.ts ichidagi setInterval
  // davriy yangilab turadi) — shu bilan avvalgi deploy'da kiritilgan
  // tahrirlar bot qayta ishga tushganda yo'qolib qolmaydi.
  await refreshBotMessageOverrides();

  // --- Global middleware'lar (tartib muhim) ---
  bot.use(rateLimitMiddleware);

  bot.use(session({
    storage: sessionStorage,
    getSessionKey: (ctx) => (ctx.from?.id ? String(ctx.from.id) : ctx.chat?.id ? String(ctx.chat.id) : undefined),
    initial: (): SessionData => ({
      token: "",
      startupId: "",
      awaitingExchangeChannel: false,
      awaitingSearch: false,
      awaitingReviewComment: false,
      awaitingSupportSubject: false,
      awaitingSupportMessage: false,
      awaitingReportReason: false
    })
  }));

  // 🌐 TIL-YUKLASH: har bir yangilanishda (agar seansda hali yo'q bo'lsa)
  // foydalanuvchining saqlangan tilini backend'dan yuklab, ctx.session.language
  // ga joylaydi. Bu MAJBURIY OBUNA darvozasidan OLDIN turishi kerak, aks
  // holda sponsor-gate xabari noto'g'ri tilda chiqib qolishi mumkin.
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.from && !ctx.session.language) {
      ctx.session.language = await getUserLanguage(ctx.from.id, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
    }
    return next();
  });

  // O'CHIRILDI (foydalanuvchi talabi): majburiy sponsor-kanal obuna
  // darvozasi endi ishlamaydi. sponsor-gate.ts fayli o'zi o'chirilmadi
  // (handlers-payment.ts hali undan ba'zi funksiyalarni import qiladi),
  // faqat global middleware ro'yxatdan olib tashlandi — shu bilan
  // foydalanuvchilardan endi hech qanday kanalga obuna bo'lish talab
  // qilinmaydi.
  // bot.use(sponsorGateMiddleware(bot));

  // --- Handler modullari (ro'yxatdan o'tkazish tartibi asl fayl bilan bir xil) ---
  registerStartHandlers(bot);
  registerCatalogHandlers(bot);
  registerProfileHandlers(bot);
  registerTextHandlers(bot);
  registerInlineHandlers(bot);
  registerMenuCallbackHandlers(bot);
  registerPaymentHandlers(bot);

  registerBotCommandMenu(bot);

  bot.start();
})().catch((err) => {
  // Async funksiya ichida ushlanmagan xato bo'lsa (masalan `new Bot()`
  // o'zi xato tashlasa) — buni ANIQ log qilib, jarayonni to'xtatamiz.
  logger.error({ err }, "Bot ishga tushirishda halokatli xato — process to'xtatilmoqda.");
  process.exit(1);
});
