// Bosh menyu ostidagi INLINE callback tugmalari: bosh menyuga qaytish,
// yangi/top ro'yxatlar, yordam, til tanlash, "Ko'proq" submenyusidagi
// bo'limlar, qo'llab-quvvatlashga murojaat boshlash, profil.
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t, Lang, setUserLanguage } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET, trackBotEvent } from "./secret";
import { backToMenuKeyboard, mainMenuKeyboard } from "./keyboards";
import { goHome, handleMenuHelp, handleMenuLanguage, handleMenuLink, handleMenuSite, redirectToSubscriberBot } from "./menu-actions";
import { showListings } from "./catalog";
import { mainMenuKeyboardOptions } from "./exchange-service";
import { showProfile } from "./profile-service";

export function registerMenuCallbackHandlers(bot: Bot<MyContext>): void {
  // Har bir tugma bosilganda avvalgi xabar o'chirilmaydi (Telegram odatiy
  // tarzda yangi xabar yuboradi) — bu foydalanuvchiga "orqaga qaytish"
  // tarixini ham saqlab qoladi, chalkashlik chiqarmaydi.
  bot.callbackQuery("menu_home", async (ctx) => {
    await ctx.answerCallbackQuery();
    await goHome(ctx);
  });

  bot.callbackQuery("menu_new", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_menu_new_listings", ctx.from?.id);
    await showListings(ctx, "new");
  });

  bot.callbackQuery("menu_top", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_menu_top_deals", ctx.from?.id);
    await showListings(ctx, "top");
  });

  bot.callbackQuery("menu_help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleMenuHelp(ctx);
  });

  // 🌐 TIL ALMASHTIRISH: foydalanuvchi tanlagan til `TelegramBotUser`
  // jadvalida (backend) DOIMIY saqlanadi.
  bot.callbackQuery("menu_language", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleMenuLanguage(ctx);
  });

  bot.callbackQuery("menu_link", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleMenuLink(ctx);
  });

  // TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi
  // yig'ish botining bir-biriga aloqasi bo'lmasligi kerak"): bu tugma
  // endi shu botda ishlamaydi — foydalanuvchi alohida "Obunachi
  // yig'ish" botiga yo'naltiriladi.
  bot.callbackQuery("menu_exchange", async (ctx) => {
    await ctx.answerCallbackQuery();
    await redirectToSubscriberBot(ctx);
  });

  bot.callbackQuery("menu_site", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleMenuSite(ctx);
  });

  bot.callbackQuery(/^set_lang_(uz|en|ru)$/, async (ctx) => {
    const newLang = ctx.match[1] as Lang;
    ctx.session.language = newLang;
    await setUserLanguage(ctx.from!.id, newLang, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
    const confirmKey = newLang === "en" ? "language_set_en" : newLang === "ru" ? "language_set_ru" : "language_set_uz";
    await ctx.answerCallbackQuery(t(confirmKey, newLang));
    await ctx.reply(t("welcome", newLang), { parse_mode: "HTML", reply_markup: mainMenuKeyboard(ctx, await mainMenuKeyboardOptions(ctx)) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerMenuCallbackHandlers: ctx.reply yuborishda xato"));
  });

  // 🆘 Botdan chiqmasdan qo'llab-quvvatlashga murojaat yuborish: avval
  // mavzu, keyin batafsil xabar matni ketma-ket so'raladi.
  bot.callbackQuery("support_start", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language || "uz";
    ctx.session.awaitingSupportSubject = true;
    await ctx.reply(t("support_start_prompt", lang), {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: t("search_cancel", lang), callback_data: "menu_home" }]] }
    }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerMenuCallbackHandlers: ctx.reply yuborishda xato"));
  });

  bot.callbackQuery("menu_profile", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_menu_profile", ctx.from?.id);
    try {
      await showProfile(ctx);
    } catch (err: unknown) {
      logger.error({ err }, "menu_profile callback error");
      await ctx.reply(t("profile_load_error", ctx.session.language || "uz"), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerMenuCallbackHandlers: ctx.reply yuborishda xato"));
    }
  });

  // TUZATILDI (KOMPILYATSIYA XATOSI — bot UMUMAN ishga tushmasdi):
  // oldin bu handler `async` deb belgilanmagan edi, lekin ichida `await`
  // ishlatilgan — bu esa `tsc`/`esbuild`/`tsx` uchun SINTAKSIS xatosi
  // ("await expressions are only allowed within async functions").
  // Shu faylning BOSHQA barcha handlerlari to'g'ri `async (ctx) => {`
  // deb yozilgan, faqat shu bittasida unutilib qolgan. Natijada butun
  // fayl (demak butun bot) parse/build bosqichidayoq muvaffaqiyatsiz
  // tugardi — bu runtime xatosi emas, build XATOSI edi.
  bot.command(["yordam", "help", "menu"], async (ctx) => {
    await ctx.reply(t("help", ctx.session.language || "uz"), { parse_mode: "HTML", reply_markup: mainMenuKeyboard(ctx, await mainMenuKeyboardOptions(ctx)) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerMenuCallbackHandlers: ctx.reply yuborishda xato"));
  });
}
