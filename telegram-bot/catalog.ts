// Mahsulot katalogi bilan bog'liq barcha "ko'rsatish" funksiyalari:
// kategoriyalar, ro'yxatlar (yangi/top/kategoriya), qidiruv natijalari va
// bitta mahsulot kartochkasi. Bularning barchasi turli handler fayllaridan
// (handlers-catalog.ts, handlers-text.ts, handlers-start.ts,
// handlers-menu-callbacks.ts) chaqiriladi, shu sabab bitta umumiy joyga
// chiqarildi.
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { escapeHtml, categoryEmoji, withLoading, renderScreen } from "./format";
import { backToMenuKeyboard, backToListButton } from "./keyboards";

// Avval har doim faqat birinchi 5 ta natija ko'rsatilardi va undan
// ortig'ini ko'rish uchun umuman yo'l yo'q edi. Endi "➡️ Keyingisi"/
// "⬅️ Oldingisi" tugmalari bilan sahifalash qo'shildi.
export const PAGE_SIZE = 5;

// Kategoriyalar admin tomonidan kamdan-kam o'zgaradi, shu sabab har bir
// bosilgan tugma uchun /api/categories'ga qayta-qayta murojaat qilish
// o'rniga, natija 5 daqiqaga xotirada (module-level) keshlanadi.
//
// TUZATILDI (KRITIK — XATO JAVOBNI "MUVAFFAQIYAT" DEB KESHLASH): oldin bu
// yerda `res.ok` UMUMAN tekshirilmasdi — server 500 (yoki boshqa xato
// shakldagi JSON, masalan `{error: "..."}`) qaytarsa ham, `Array.isArray`
// tekshiruvi uni jimgina BO'SH RO'YXATGA aylantirar va shu holatni ham
// xuddi haqiqiy muvaffaqiyatli javobdek 5 DAQIQAGA keshlardi. Natijada bitta
// lahzalik server xatosi 5 daqiqa davomida BARCHA foydalanuvchilarga
// "Kategoriyalar yo'q" ko'rsatishga olib kelardi, garchi server darhol
// tiklangan bo'lsa ham. Bu — xuddi shu modulda (exchange-service.ts)
// qo'llanilgan naqsh bilan izchil emas edi: getSponsorChannelsCached() va
// getExchangeBonusConfigCached() ikkalasi ham faqat MUVAFFAQIYATLI javobni
// keshlaydi.
//
// Endi: (1) `res.ok`ni tekshiramiz — xato bo'lsa hech narsa keshlanmaydi;
// (2) FAIL-OPEN: agar eski (muddati o'tgan) kesh mavjud bo'lsa, xato
// o'rniga o'shani (bo'sh "hech narsa yo'q" xabari o'rniga eskirgan-lekin-
// haqiqiy ro'yxat ko'rsatilishi ancha yaxshiroq) qaytaramiz — faqat
// logger.warn bilan qayd etiladi. (3) Eski kesh ham bo'lmasa (masalan bot
// hali birinchi marta ishga tushayotgan bo'lsa), xatoni chaqiruvchiga
// (showCategories) QAYTA TASHLAYMIZ — u allaqachon try/catch bilan
// o'ralgan va foydalanuvchiga `categories_error` (tushunarli, "kategoriyalar
// yo'q" emas — "yuklab bo'lmadi" xabari) ko'rsatadi.
let categoriesCache: { data: { id: string; name: string; icon?: string; listingCount?: number }[]; expiresAt: number } | null = null;
export async function getCategoriesCached(): Promise<{ id: string; name: string; icon?: string; listingCount?: number }[]> {
  if (categoriesCache && categoriesCache.expiresAt > Date.now()) {
    return categoriesCache.data;
  }
  try {
    const res = await fetch(`${process.env.APP_URL}/api/categories`);
    if (!res.ok) {
      throw new Error(`categories request failed: ${res.status}`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    categoriesCache = { data: list, expiresAt: Date.now() + 5 * 60 * 1000 };
    return list;
  } catch (err) {
    if (categoriesCache) {
      logger.warn({ err }, "getCategoriesCached: yangilashda xato — eskirgan kesh qaytarilmoqda (fail-open)");
      return categoriesCache.data;
    }
    throw err;
  }
}

export async function showCategories(ctx: MyContext): Promise<unknown> {
  try {
    const lang = ctx.session.language || "uz";
    const categories = await withLoading(ctx, "typing", async () => getCategoriesCached());
    if (!Array.isArray(categories) || !categories.length) {
      await renderScreen(ctx, t("categories_empty", lang), { reply_markup: backToMenuKeyboard(ctx) });
      return;
    }

    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < categories.length; i += 2) {
      const row = categories.slice(i, i + 2).map((c) => {
        // QULAYLIK: nechta e'lon borligi ko'rsatiladi — foydalanuvchi bo'sh
        // kategoriyaga bekorga kirib vaqt sarflamaydi.
        const countLabel = typeof c.listingCount === "number" ? ` (${c.listingCount})` : "";
        return {
          text: `${categoryEmoji(c.icon)} ${c.name}${countLabel}`.slice(0, 64),
          callback_data: `cat_${c.id}_1`
        };
      });
      rows.push(row);
    }
    rows.push([{ text: t("back_to_menu", lang), callback_data: "menu_home" }]);

    await renderScreen(ctx, t("categories_title", lang), {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: rows }
    });
  } catch (err: unknown) {
    logger.error({ err }, "showCategories error");
    await renderScreen(ctx, t("categories_error", ctx.session.language || "uz"), {
      reply_markup: backToMenuKeyboard(ctx)
    });
  }
}

// 📂 Kategoriya bo'yicha ko'rish uchun "new"/"top" kabi statik ikkita
// variant yetarli emas edi — shu sabab showListings endi ixtiyoriy
// categoryId/categoryName ham qabul qiladi va uni /api/startups?category=
// filtriga qo'shadi. Har chaqiruvda ctx.session.lastList yangilanadi —
// showProduct shu ma'lumotdan foydalanib to'g'ri "🔙 Ro'yxatga qaytish"
// tugmasini chizadi.
export async function showListings(
  ctx: MyContext,
  kind: "new" | "top" | "category",
  page: number = 1,
  categoryId?: string,
  categoryName?: string
): Promise<unknown> {
  const lang = ctx.session.language || "uz";
  let filterParam = "";
  let title = t("listing_new_title", lang);
  let emptyText = t("listing_new_empty", lang);
  if (kind === "top") {
    filterParam = "&isTop=true";
    title = t("listing_top_title", lang);
    emptyText = t("listing_top_empty", lang);
  } else if (kind === "category" && categoryId) {
    filterParam = `&category=${encodeURIComponent(categoryId)}`;
    title = `📂 ${categoryName || t("category_fallback", lang)}`;
    emptyText = t("listing_category_empty", lang);
  }
  const apiUrl = `${process.env.APP_URL}/api/startups?limit=${PAGE_SIZE}&page=${page}${filterParam}`;

  ctx.session.lastList = { kind, page, categoryId, query: undefined };

  try {
    const data = await withLoading(ctx, "typing", async () => {
      const res = await fetch(apiUrl);
      return res.json();
    });
    const startups = data.startups || data || [];
    const totalPages = data.totalPages || 1;

    if (!startups.length) {
      await renderScreen(ctx, page > 1 ? t("listing_no_more", lang) : `😔 ${emptyText}`, { reply_markup: backToMenuKeyboard(ctx) });
      return;
    }

    let text = `<b>${title}</b> ${totalPages > 1 ? t("page_indicator", lang, { page, totalPages }) : ""}\n\n`;
    const productButtons: { text: string; callback_data: string }[][] = [];
    startups.forEach((s: { id: string; name: string; price: number }) => {
      text += `• <b>${escapeHtml(s.name)}</b> — ${escapeHtml(s.price)} USDT\n`;
      productButtons.push([{ text: `👉 ${s.name}`.slice(0, 60), callback_data: `view_${s.id}` }]);
    });
    text += t("tap_product_hint", lang);

    const listCallbackKind = kind === "category" ? `cat_${categoryId}` : kind;
    const navRow: { text: string; callback_data: string }[] = [];
    if (page > 1) navRow.push({ text: t("nav_previous", lang), callback_data: `list_${listCallbackKind}_${page - 1}` });
    if (page < totalPages) navRow.push({ text: t("nav_next", lang), callback_data: `list_${listCallbackKind}_${page + 1}` });

    const rows = [...productButtons];
    if (navRow.length) rows.push(navRow);
    if (kind === "category") rows.push([{ text: t("other_category", lang), callback_data: "menu_categories" }]);
    rows.push([{ text: t("back_to_menu", lang), callback_data: "menu_home" }]);

    await renderScreen(ctx, text, { parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
  } catch (err: unknown) {
    logger.error({ err, kind, page, categoryId }, "showListings error");
    await renderScreen(ctx, t("listing_error", lang), {
      reply_markup: backToMenuKeyboard(ctx)
    });
  }
}

// QULAYLIK: "🔍 Qidirish" — foydalanuvchi mahsulot nomini yozib qidirishi
// mumkin, natijalar xuddi "Yangi e'lonlar" kabi sahifalab ko'rsatiladi.
export async function showSearchResults(ctx: MyContext, query: string, page: number = 1): Promise<unknown> {
  const lang = ctx.session.language || "uz";
  ctx.session.lastList = { kind: "search", page, query };
  try {
    const data = await withLoading(ctx, "typing", async () => {
      const res = await fetch(
        `${process.env.APP_URL}/api/startups?search=${encodeURIComponent(query)}&onlyActive=true&limit=${PAGE_SIZE}&page=${page}`
      );
      return res.json();
    });
    const startups = data.startups || data || [];
    const totalPages = data.totalPages || 1;

    if (!startups.length) {
      // Bu javob HTML rejimida YUBORILMAYDI (parse_mode ko'rsatilmagan),
      // shu sabab escapeHtml(query) shart emas — oddiy matn.
      await renderScreen(
        ctx,
        page > 1 ? t("search_no_more", lang) : t("search_empty", lang, { query }),
        { reply_markup: backToMenuKeyboard(ctx) }
      );
      return;
    }

    const resultsTitle = t("search_results_title", lang, { query: escapeHtml(query) });
    let text = `<b>🔍 ${resultsTitle}</b> ${totalPages > 1 ? t("page_indicator", lang, { page, totalPages }) : ""}\n\n`;
    const productButtons: { text: string; callback_data: string }[][] = [];
    startups.forEach((s: { id: string; name: string; price: number }) => {
      text += `• <b>${escapeHtml(s.name)}</b> — ${escapeHtml(s.price)} USDT\n`;
      productButtons.push([{ text: `👉 ${s.name}`.slice(0, 60), callback_data: `view_${s.id}` }]);
    });
    text += t("tap_product_hint", lang);

    const navRow: { text: string; callback_data: string }[] = [];
    // TUZATILDI (KRITIK): Telegram callback_data 64 baytdan OSHMASLIGI
    // SHART — asl so'rov (encode qilishdan OLDIN) 20 belgigacha kesiladi,
    // shunda to'liq va to'g'ri encode qilingan natija baribir 64 bayt
    // ichida sig'adi va "%XX" o'rtadan kesilib qolmaydi.
    const encodedQuery = encodeURIComponent(query.slice(0, 20));
    if (page > 1) navRow.push({ text: t("nav_previous", lang), callback_data: `search_${encodedQuery}_${page - 1}` });
    if (page < totalPages) navRow.push({ text: t("nav_next", lang), callback_data: `search_${encodedQuery}_${page + 1}` });

    const rows = [...productButtons];
    if (navRow.length) rows.push(navRow);
    rows.push([
      { text: t("search_new", lang), callback_data: "menu_search" },
      { text: t("back_to_menu", lang), callback_data: "menu_home" }
    ]);

    await renderScreen(ctx, text, { parse_mode: "HTML", reply_markup: { inline_keyboard: rows } });
  } catch (err: unknown) {
    logger.error({ err, query, page }, "showSearchResults error");
    await renderScreen(ctx, t("search_error", lang), {
      reply_markup: backToMenuKeyboard(ctx)
    });
  }
}

// 🔙 "Mahsulotdan ro'yxatga qaytish" tugmasi: ctx.session.lastList'da
// saqlangan oxirgi ro'yxat holatiga mos callback_data quriladi
// (backToListButton, keyboards.ts).
export async function showProduct(ctx: MyContext, id: string): Promise<unknown> {
  const lang = ctx.session.language || "uz";
  try {
    const product = await withLoading(ctx, "typing", async () => {
      const res = await fetch(`${process.env.APP_URL}/api/startups/${id}`);
      if (!res.ok) return null;
      return res.json();
    });
    if (!product) {
      await ctx.reply(t("product_not_found", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showProduct: ctx.reply yuborishda xato"));
      return;
    }
    if (product.soldStatus === "sotildi") {
      await ctx.reply(t("product_already_sold", lang, { name: product.name }), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showProduct: ctx.reply yuborishda xato"));
      return;
    }

    const message = `<b>${escapeHtml(product.name)}</b>\n\n${escapeHtml(product.description || t("product_no_description", lang))}\n\n💰 ${t("product_price_label", lang)}: ${escapeHtml(product.price)} USDT`;

    const backRow = backToListButton(ctx);
    const keyboard = [
      [{ text: `${t("product_buy_btn", lang)} (${product.price} USDT)`, callback_data: `buy_${product.id}` }],
      ...(backRow ? [backRow] : []),
      [{ text: t("back_to_menu", lang), callback_data: "menu_home" }]
    ];

    // MUHIM: /api/upload orqali yuklangan rasmlar uchun `image` maydoni
    // nisbiy (relative) yo'l ko'rinishida saqlanadi. Telegram replyWithPhoto
    // esa to'liq (http/https) URL yoki file_id talab qiladi.
    const imageUrl = product.image
      ? (product.image.startsWith("/") ? `${process.env.APP_URL}${product.image}` : product.image)
      : null;

    if (imageUrl) {
      try {
        await ctx.replyWithPhoto(imageUrl, {
          caption: message,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch (photoErr) {
        // Rasm yuborib bo'lmasa, oddiy matnli xabarga qaytamiz.
        logger.error({ err: photoErr }, "replyWithPhoto error, falling back to text");
        await ctx.reply(message, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard }
        }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showProduct: ctx.reply yuborishda xato"));
      }
    } else {
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard }
      }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showProduct: ctx.reply yuborishda xato"));
    }
  } catch (err: unknown) {
    logger.error({ err, id }, "showProduct error");
    await ctx.reply(t("product_load_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showProduct: ctx.reply yuborishda xato"));
  }
}
