// Mahsulot katalogi bilan bog'liq buyruq/tugma handlerlari: yangi
// e'lonlar, TOP takliflar, kategoriyalar, qidiruv, sahifalash va bitta
// mahsulotni ochish. Ko'rsatish mantig'ining o'zi catalog.ts'da.
import { Bot } from "grammy";
import { MyContext } from "./types";
import { t } from "./i18n";
import { trackBotEvent } from "./secret";
import { showListings, showCategories, showSearchResults, showProduct, getCategoriesCached } from "./catalog";
import { handleMenuSearch } from "./menu-actions";
import { logger } from "../src/lib/logger";
import { backToMenuKeyboard } from "./keyboards";

export function registerCatalogHandlers(bot: Bot<MyContext>): void {
  bot.command("new_listings", (ctx) => showListings(ctx, "new"));
  bot.command("top_deals", (ctx) => showListings(ctx, "top"));

  bot.command("mahsulot", async (ctx) => {
    const id = ctx.match;
    if (!id) {
      await ctx.reply(t("product_id_required", ctx.session.language || "uz"), {
        parse_mode: "HTML",
        reply_markup: backToMenuKeyboard(ctx)
      }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "mahsulot: ctx.reply yuborishda xato"));
      return;
    }
    await showProduct(ctx, id);
  });

  bot.callbackQuery("menu_categories", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_menu_categories", ctx.from?.id);
    await showCategories(ctx);
  });

  // Kategoriya tanlanganda (cat_<id>_<page>) — kategoriya nomini bilish
  // uchun keshlangan ro'yxatdan (getCategoriesCached) qidiramiz.
  bot.callbackQuery(/^cat_(.+)_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const categoryId = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    try {
      const categories = await getCategoriesCached();
      const cat = categories.find((c) => c.id === categoryId);
      await showListings(ctx, "category", page, categoryId, cat?.name);
    } catch (err: unknown) {
      logger.error({ err, categoryId }, "category select error");
      await showListings(ctx, "category", page, categoryId);
    }
  });

  bot.command(["qidiruv", "search"], async (ctx) => {
    const query = ctx.match?.trim();
    if (query) {
      trackBotEvent("bot_search", ctx.from?.id);
      return showSearchResults(ctx, query);
    }
    await handleMenuSearch(ctx);
  });

  // Sahifalash tugmalari: list_new_2, list_top_3 va h.k.
  bot.callbackQuery(/^list_(new|top)_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showListings(ctx, ctx.match[1] as "new" | "top", parseInt(ctx.match[2], 10));
  });

  // Kategoriya ichidagi sahifalash: list_cat_<categoryId>_<page>
  bot.callbackQuery(/^list_cat_(.+)_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const categoryId = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    try {
      const categories = await getCategoriesCached();
      const cat = categories.find((c) => c.id === categoryId);
      await showListings(ctx, "category", page, categoryId, cat?.name);
    } catch (err: unknown) {
      logger.error({ err, categoryId }, "category page error");
      await showListings(ctx, "category", page, categoryId);
    }
  });

  // Callback_data ichida so'rov matni URL-encode qilingan holda saqlanadi
  bot.callbackQuery(/^search_(.+)_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const query = decodeURIComponent(ctx.match[1]);
    await showSearchResults(ctx, query, parseInt(ctx.match[2], 10));
  });

  bot.callbackQuery("menu_search", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_menu_search", ctx.from?.id);
    await handleMenuSearch(ctx);
  });

  // "🆕 Yangi e'lonlar" ro'yxatidagi har bir mahsulot tugmasi shu orqali
  // ochiladi (callback_data: view_<id>).
  bot.callbackQuery(/^view_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showProduct(ctx, ctx.match[1]);
  });
}
