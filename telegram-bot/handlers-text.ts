// Oddiy matnli xabarlar bilan bog'liq BARCHA handlerlar: doimiy pastki
// klaviatura tugmalari, sharh/murojaat/shikoyat oqimlari, qidiruv-kutish
// oqimi, "Obunachi yig'ish" kanal ro'yxatdan o'tkazish oqimi va oxirida
// mahsulot-slug/erkin-matn fallback'i.
//
// MUHIM (TARTIB): bu fayldagi bot.on("message:text"/"message") chaqiruvlari
// grammy'da BITTA umumiy zanjir (middleware chain) hosil qiladi — har biri
// mos kelmasa `next()` chaqirib keyingisiga o'tkazadi. Shu sabab
// registerTextHandlers(bot) ICHIDAGI handler tartibi index.ts'da qanday
// chaqirilishidan qat'iy nazar O'ZGARTIRILMASLIGI SHART (asl index.ts'dagi
// bilan bir xil ketma-ketlik saqlangan): 1) menyu tugmalari, 2) sharh/
// murojaat/shikoyat, 3) qidiruv-kutish, 4) kanal ro'yxatdan o'tkazish
// (bot.on("message") — matn bo'lmagan forward'larni ham ushlaydi),
// 5) slug/fallback (TERMINAL — next() chaqirmaydi).
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET, trackBotEvent } from "./secret";
import { SLUG_PATTERN } from "./format";
import {
  isMenuButton,
  clearAwaitingState,
  mainMenuKeyboard,
  backToMenuKeyboard,
  productsMenuKeyboard,
  moreMenuKeyboard
} from "./keyboards";
import { goHome, handleMenuSearch, handleMenuLink, handleMenuHelp, handleMenuLanguage, handleMenuSite } from "./menu-actions";
import { showListings, showCategories, showSearchResults, showProduct } from "./catalog";
import { showProfile } from "./profile-service";
import { mainMenuKeyboardOptions } from "./exchange-service";
import { redirectToSubscriberBot } from "./menu-actions";

export function registerTextHandlers(bot: Bot<MyContext>): void {
  // 📋 DOIMIY PASTKI MENYU (persistent reply keyboard) tugmalari shu yerda
  // ushlanadi. BU HANDLER BOSHQA BARCHA "message:text" HANDLERLARIDAN
  // OLDIN TURISHI SHART — aks holda, masalan, foydalanuvchi qidiruv matni
  // kutilayotganda "🏠 Bosh menyu" tugmasini bossa, bu matn noto'g'ri
  // ravishda qidiruv so'rovi sifatida qabul qilinib qolardi.
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();

    if (isMenuButton(text, "back_to_menu")) {
      return goHome(ctx);
    }
    if (isMenuButton(text, "menu_products")) {
      clearAwaitingState(ctx);
      const lang = ctx.session.language || "uz";
      await ctx.reply(t("products_menu_title", lang), { parse_mode: "HTML", reply_markup: productsMenuKeyboard(lang) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
      return;
    }
    if (isMenuButton(text, "menu_more")) {
      clearAwaitingState(ctx);
      const lang = ctx.session.language || "uz";
      await ctx.reply(t("more_menu_title", lang), { parse_mode: "HTML", reply_markup: moreMenuKeyboard(lang) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
      return;
    }
    // TUZATILDI (SODDALASHTIRISH): quyidagi 6 ta shart endi asosiy pastki
    // klaviaturada ko'rinmaydi (submenyularga ko'chirilgan), lekin ESKI
    // klaviatura foydalanuvchi ekranida "keshda" turib qolgan bo'lishi
    // mumkinligi uchun shu yerda qoldirilgan.
    if (isMenuButton(text, "menu_new")) {
      clearAwaitingState(ctx);
      trackBotEvent("bot_menu_new_listings", ctx.from?.id);
      return showListings(ctx, "new");
    }
    if (isMenuButton(text, "menu_top")) {
      clearAwaitingState(ctx);
      trackBotEvent("bot_menu_top_deals", ctx.from?.id);
      return showListings(ctx, "top");
    }
    if (isMenuButton(text, "menu_categories")) {
      clearAwaitingState(ctx);
      trackBotEvent("bot_menu_categories", ctx.from?.id);
      return showCategories(ctx);
    }
    if (isMenuButton(text, "menu_search")) {
      clearAwaitingState(ctx);
      trackBotEvent("bot_menu_search", ctx.from?.id);
      return handleMenuSearch(ctx);
    }
    if (isMenuButton(text, "menu_profile")) {
      clearAwaitingState(ctx);
      trackBotEvent("bot_menu_profile", ctx.from?.id);
      try {
        return await showProfile(ctx);
      } catch (err: unknown) {
        logger.error({ err }, "menu_profile (reply keyboard) error");
        await ctx.reply(t("profile_load_error", ctx.session.language || "uz"), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
        return;
      }
    }
    if (isMenuButton(text, "menu_link")) {
      clearAwaitingState(ctx);
      return handleMenuLink(ctx);
    }
    // TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi
    // yig'ish botining bir-biriga aloqasi bo'lmasligi kerak"): bu
    // bo'lim endi shu botda ISHLAMAYDI — foydalanuvchi alohida
    // "Obunachi yig'ish" botiga yo'naltiriladi (qarang: menu-actions.ts).
    if (isMenuButton(text, "exchange_add_channel_btn")) {
      trackBotEvent("bot_menu_exchange_top_warning", ctx.from?.id);
      return redirectToSubscriberBot(ctx);
    }
    if (isMenuButton(text, "menu_exchange")) {
      trackBotEvent("bot_menu_exchange", ctx.from?.id);
      return redirectToSubscriberBot(ctx);
    }
    if (isMenuButton(text, "menu_site")) {
      clearAwaitingState(ctx);
      return handleMenuSite(ctx);
    }
    if (isMenuButton(text, "menu_help")) {
      clearAwaitingState(ctx);
      return handleMenuHelp(ctx);
    }
    if (isMenuButton(text, "menu_language")) {
      clearAwaitingState(ctx);
      return handleMenuLanguage(ctx);
    }

    return next();
  });

  // ⭐ Sharh izohi, 🆘 Murojaat va 🚩 Shikoyat sabab oqimlari — bayroq true
  // bo'lmasa keyingi handler'larga o'tkazib yuboriladi.
  bot.on("message:text", async (ctx, next) => {
    const lang = ctx.session?.language || "uz";

    if (ctx.session?.awaitingReviewComment) {
      ctx.session.awaitingReviewComment = false;
      const comment = ctx.message.text.trim();
      const startupId = ctx.session.reviewStartupId;
      const rating = ctx.session.reviewRating;
      ctx.session.reviewStartupId = undefined;
      ctx.session.reviewRating = undefined;

      if (!startupId || !rating) {
        await ctx.reply(t("session_expired", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
        return;
      }
      if (comment.length < 3) {
        await ctx.reply(t("review_comment_short", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
        return;
      }
      try {
        const res = await fetch(`${process.env.APP_URL}/api/telegram/reviews`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET
          },
          body: JSON.stringify({ telegramUserId: ctx.from?.id, startupId, rating, comment })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          await ctx.reply(`❌ ${data.error || t("review_submit_error", lang)}`, {
            reply_markup: backToMenuKeyboard(ctx)
          }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
          return;
        }
        trackBotEvent("bot_review_submitted", ctx.from?.id);
        await ctx.reply(t("review_submit_success", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
      } catch (err: unknown) {
        logger.error({ err }, "review submit error");
        await ctx.reply(t("review_submit_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
      }
      return;
    }

    if (ctx.session?.awaitingSupportSubject) {
      ctx.session.awaitingSupportSubject = false;
      const subject = ctx.message.text.trim();
      if (subject.length < 2) {
        ctx.session.awaitingSupportSubject = true;
        await ctx.reply(t("support_subject_short", lang)).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
        return;
      }
      ctx.session.supportSubject = subject;
      ctx.session.awaitingSupportMessage = true;
      await ctx.reply(t("support_message_prompt", lang), {
        reply_markup: { inline_keyboard: [[{ text: t("search_cancel", lang), callback_data: "menu_home" }]] }
      }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
      return;
    }

    if (ctx.session?.awaitingSupportMessage) {
      const message = ctx.message.text.trim();
      const subject = ctx.session.supportSubject;
      // Xabar juda qisqa bo'lsa mavzu va "kutish" holati saqlab qolinadi,
      // foydalanuvchi shunchaki xabarni qaytadan yozishi mumkin.
      if (message.length < 5) {
        await ctx.reply(t("support_message_short", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
        return;
      }
      ctx.session.awaitingSupportMessage = false;
      ctx.session.supportSubject = undefined;
      try {
        const res = await fetch(`${process.env.APP_URL}/api/telegram/support-ticket`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET
          },
          body: JSON.stringify({ telegramUserId: ctx.from?.id, subject, message })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          await ctx.reply(`❌ ${data.error || t("support_submit_error", lang)}`, {
            reply_markup: backToMenuKeyboard(ctx)
          }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
          return;
        }
        trackBotEvent("bot_support_ticket", ctx.from?.id);
        await ctx.reply(t("support_submit_success", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
      } catch (err: unknown) {
        logger.error({ err }, "support ticket submit error");
        await ctx.reply(t("support_submit_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
      }
      return;
    }

    // TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi
    // yig'ish botining bir-biriga aloqasi bo'lmasligi kerak"): shikoyat
    // sababini kutish oqimi endi FAQAT subscriber-bot/index.ts'da
    // ishlaydi — bu botda "Obunachi yig'ish" bo'limiga umuman kirib
    // bo'lmagani uchun (yuqoridagi redirectToSubscriberBot'ga qarang),
    // awaitingReportReason bu yerda hech qachon true bo'lib qolmaydi,
    // shu sabab bu blok olib tashlandi.

    return next();
  });

  // QULAYLIK: "🔍 Qidirish" tugmasidan keyin foydalanuvchi yozgan matn shu
  // yerda ushlanadi.
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.session?.awaitingSearch) return next();
    ctx.session.awaitingSearch = false;
    const lang = ctx.session.language || "uz";
    const query = ctx.message.text.trim();
    if (query.length < 2) {
      await ctx.reply(t("search_term_short", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
      return;
    }
    trackBotEvent("bot_search", ctx.from?.id);
    await showSearchResults(ctx, query);
  });

  // TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi
  // yig'ish botining bir-biriga aloqasi bo'lmasligi kerak"): kanal
  // ro'yxatdan o'tkazish (forward/username/link orqali) oqimi endi
  // FAQAT subscriber-bot/index.ts'da ishlaydi — bu botda
  // awaitingExchangeChannel hech qachon true bo'lib qolmaydi (yuqoridagi
  // redirectToSubscriberBot'ga qarang), shu sabab bu blok olib
  // tashlandi.

  // Mahsulot ID/slug fallback: 123-band slug format (kamida 150 belgigacha
  // + tasodifiy hex qo'shimcha) — mos kelmasa foydalanuvchiga tushunarli
  // javob va bosh menyu beriladi. TERMINAL handler — next() chaqirmaydi,
  // shu sabab shu fayldagi eng oxirida turishi shart.
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return; // noma'lum slash-buyruqlar grammy tomonidan e'tiborsiz qoldiriladi
    if (text.length <= 160 && SLUG_PATTERN.test(text)) {
      return showProduct(ctx, text);
    }
    // TUZATILDI (i18n'ni chetlab o'tish): oldin bu yerda matn to'g'ridan-
    // to'g'ri qattiq-kodlangan o'zbekcha holda yuborilardi — ingliz tilini
    // tanlagan foydalanuvchi ham noma'lum matn yozganda o'zbekcha javob
    // olardi. Endi i18n.ts'dagi `unrecognized_input` kaliti orqali,
    // foydalanuvchining tanlagan tilida yuboriladi (shu fayldagi boshqa
    // joylar bilan bir xil `ctx.session.language || "uz"` naqshi).
    const lang = ctx.session.language || "uz";
    await ctx.reply(
      t("unrecognized_input", lang),
      { reply_markup: mainMenuKeyboard(ctx, await mainMenuKeyboardOptions(ctx)) }
    ).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "message:text: ctx.reply yuborishda xato"));
  });
}
