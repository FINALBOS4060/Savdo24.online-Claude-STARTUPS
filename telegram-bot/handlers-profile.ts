// Profil bo'limining barcha Telegram handlerlari (asosiy profil, referal,
// sotuvchi statistikasi, xaridlar/sharhlar, sotuvlar, faollik tarixi,
// obuna-almashish qisqacha kartasi, bildirishnoma yoqish/o'chirish).
// index.ts faqat registerProfileHandlers(bot)ni chaqiradi.
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET, trackBotEvent } from "./secret";
import { escapeHtml, withLoading, formatActivityDate, paymentStatusLabel } from "./format";
import { backToMenuKeyboard, notificationKeyboard } from "./keyboards";
import { showProfile } from "./profile-service";
import { redirectToSubscriberBot } from "./menu-actions";

export function registerProfileHandlers(bot: Bot<MyContext>) {

  bot.command(["profile", "profil"], (ctx) => showProfile(ctx));

  // 🎯 Do'stlarga taklif qilish — mavjud referral kod asosida havola tuziladi
  // (saytdagi ProfileReferralsTab bilan bir xil format: /browse?ref=KOD) va
  // forward qilish uchun tayyor matn yuboriladi.
  bot.callbackQuery("profile_referral", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_profile_referral", ctx.from?.id);
    const lang = ctx.session.language || "uz";
    try {
      const res = await withLoading(ctx, "typing", () =>
        fetch(`${process.env.APP_URL}/api/telegram/user-stats/${ctx.from?.id}`, {
          headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
        })
      );
      if (!res.ok) {
        await ctx.reply(t("link_account_required", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
        return;
      }
      const data = await res.json();
      if (!data.referralCode) {
        await ctx.reply(t("referral_no_code", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
        return;
      }
      const link = `${process.env.APP_URL}/browse?ref=${data.referralCode}`;
      await ctx.reply(t("referral_invite_text", lang, { link: escapeHtml(link) }), { parse_mode: "HTML", reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
    } catch (err: unknown) {
      logger.error({ err }, "profile_referral error");
      await ctx.reply(t("referral_link_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
    }
  });

  // 📊 Statistikam — sotuvchi uchun e'lonlar/ko'rishlar/sotuvlar sonini
  // bot ichida qisqacha ko'rsatadi.
  bot.callbackQuery("profile_seller_stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_profile_seller_stats", ctx.from?.id);
    const lang = ctx.session.language || "uz";
    const isEn = lang === "en";
    try {
      const res = await withLoading(ctx, "typing", () =>
        fetch(`${process.env.APP_URL}/api/telegram/seller-stats/${ctx.from?.id}`, {
          headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
        })
      );
      if (!res.ok) {
        await ctx.reply(t("link_account_required", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
        return;
      }
      const data = await res.json();
      // TUZATILDI (UNIVERSALLIK): matn endi to'liq i18n.ts lug'atidan olinadi
      // (seller_stats_* kalitlari) — yangi til qo'shilganda bu yerga tegish
      // shart emas.
      const text = t("seller_stats_title", lang) + "\n\n" +
        t("seller_stats_total", lang, { count: data.totalListings }) +
        t("seller_stats_active", lang, { count: data.activeListings }) +
        t("seller_stats_sold", lang, { count: data.soldListings }) +
        t("seller_stats_views", lang, { count: data.totalViews }) +
        t("seller_stats_sales", lang, { count: data.completedSalesCount });
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
    } catch (err: unknown) {
      logger.error({ err }, "profile_seller_stats error");
      await ctx.reply(t("seller_stats_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
    }
  });

  // 🛒 Xaridlarim — /api/telegram/user-purchases orqali oxirgi 10 ta
  // xaridni (💸 to'lov holati bilan birga) ko'rsatadi. Tugallangan
  // xaridlarga "⭐ Baholash" tugmasi qo'shiladi (agar hali sharh
  // qoldirilmagan bo'lsa — buni server tekshiradi, bot faqat urinishga
  // ruxsat beradi).
  // TUZATILDI (UNIVERSALLIK): avval bu faqat bitta (o'zbekcha) lug'at edi —
  // `p.status` qanday til tanlangani bilan bog'liq bo'lmasdan doim shu yerdan
  // olinardi. Endi `lang` parametr sifatida qabul qilinadi, xuddi botdagi
  // boshqa har bir matn kabi.

  bot.callbackQuery("profile_purchases", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_profile_purchases", ctx.from?.id);
    const lang = ctx.session.language || "uz";
    const isEn = lang === "en";
    try {
      const res = await withLoading(ctx, "typing", () =>
        fetch(`${process.env.APP_URL}/api/telegram/user-purchases/${ctx.from?.id}`, {
          headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
        })
      );
      if (!res.ok) {
        await ctx.reply(t("link_account_required", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
        return;
      }
      const data = await res.json();
      const purchases = data.purchases || [];
      if (!purchases.length) {
        await ctx.reply(t("purchases_empty", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
        return;
      }
      let text = t("purchases_title", lang);
      const rows: { text: string; callback_data: string }[][] = [];
      purchases.forEach((p: any) => {
        // TUZATILDI (UNIVERSALLIK): sana ilgari doim "uz-UZ" locale bilan
        // formatlanardi — endi tanlangan tilga mos locale ishlatiladi.
        const date = new Date(p.createdAt).toLocaleDateString(isEn ? "en-US" : "uz-UZ");
        const statusLabel = paymentStatusLabel(p.status, lang);
        text += `• <b>${escapeHtml(p.name)}</b> — ${escapeHtml(p.amount)} ${escapeHtml(p.currency)} (${date})\n  ${statusLabel}\n`;
        if (p.status === "completed" && p.startupId) {
          const reviewLabel = t("purchases_rate_btn", lang, { name: p.name });
          rows.push([{ text: reviewLabel.slice(0, 60), callback_data: `review_start_${p.startupId}` }]);
        }
      });
      rows.push([{ text: t("back_to_menu", lang), callback_data: "menu_home" }]);
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: { inline_keyboard: rows } }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
    } catch (err: unknown) {
      logger.error({ err }, "profile_purchases error");
      await ctx.reply(t("purchases_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
    }
  });

  // ⭐ Sharh/reyting qoldirish: avval 1-5 yulduz tanlanadi (tugmalar orqali),
  // keyin izoh matni oddiy xabar sifatida so'raladi. Server tomonida
  // (POST /api/telegram/reviews) haqiqatan sotib olinganmi va takroriy
  // sharh emasmi tekshiriladi — bot faqat foydalanuvchi qulayligi uchun oqimni boshqaradi.
  bot.callbackQuery(/^review_start_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language || "uz";
    const startupId = ctx.match[1];
    ctx.session.reviewStartupId = startupId;
    await ctx.reply(t("review_stars_prompt", lang), {
      reply_markup: {
        inline_keyboard: [
          [1, 2, 3, 4, 5].map((n) => ({ text: "⭐".repeat(n), callback_data: `review_rate_${n}` })),
          [{ text: t("search_cancel", lang), callback_data: "menu_home" }]
        ]
      }
    }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
  });

  bot.callbackQuery(/^review_rate_(\d)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language || "uz";
    if (!ctx.session.reviewStartupId) {
      await ctx.reply(t("session_expired", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
      return;
    }
    ctx.session.reviewRating = parseInt(ctx.match[1], 10);
    ctx.session.awaitingReviewComment = true;
    await ctx.reply(t("review_comment_prompt", lang), {
      reply_markup: { inline_keyboard: [[{ text: t("search_cancel", lang), callback_data: "menu_home" }]] }
    }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
  });

  // 💰 Sotuvlarim — o'z e'lonlaridan qilingan tugallangan sotuvlar.
  bot.callbackQuery("profile_sales", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_profile_sales", ctx.from?.id);
    const lang = ctx.session.language || "uz";
    const isEn = lang === "en";
    try {
      const res = await withLoading(ctx, "typing", () =>
        fetch(`${process.env.APP_URL}/api/telegram/user-sales/${ctx.from?.id}`, {
          headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
        })
      );
      if (!res.ok) {
        await ctx.reply(t("link_account_required", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
        return;
      }
      const data = await res.json();
      const sales = data.sales || [];
      if (!sales.length) {
        await ctx.reply(t("sales_empty", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
        return;
      }
      let text = t("sales_title", lang);
      sales.forEach((s: any) => {
        const date = new Date(s.createdAt).toLocaleDateString(isEn ? "en-US" : "uz-UZ");
        text += `• <b>${escapeHtml(s.name)}</b> — ${escapeHtml(s.amount)} ${escapeHtml(s.currency)} (${date})\n`;
      });
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
    } catch (err: unknown) {
      logger.error({ err }, "profile_sales error");
      await ctx.reply(t("sales_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerProfileHandlers: ctx.reply yuborishda xato"));
    }
  });

  // 🔔 Bildirishnoma sozlamasi — bot ichidan bevosita telegramBroadcastOptOut
  // (reklama/broadcast xabarlaridan chiqish) yoqiladi/o'chiriladi. DIQQAT:
  // bu faqat REKLAMA/broadcast xabarlarga tegishli — xarid tasdiqlangani,
  // nizo (dispute) va h.k. kabi MUHIM xabarlar bu sozlamadan qat'iy nazar
  // har doim yuboriladi (server kodida shunday, bot buni o'zgartira olmaydi).

  async function showNotificationSettings(ctx: MyContext) {
    const lang = ctx.session.language || "uz";
    try {
      const res = await withLoading(ctx, "typing", () =>
        fetch(`${process.env.APP_URL}/api/telegram/user-stats/${ctx.from?.id}`, {
          headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
        })
      );
      if (!res.ok) {
        await ctx.reply(t("link_account_required", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showNotificationSettings: ctx.reply yuborishda xato"));
        return;
      }
      const data = await res.json();
      const optedOut = !!data.telegramBroadcastOptOut;
      const status = optedOut ? t("notif_status_off", lang) : t("notif_status_on", lang);
      await ctx.reply(t("notif_settings_text", lang, { status }), { parse_mode: "HTML", reply_markup: notificationKeyboard(optedOut, lang) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showNotificationSettings: ctx.reply yuborishda xato"));
    } catch (err: unknown) {
      logger.error({ err }, "showNotificationSettings error");
      await ctx.reply(t("notif_settings_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showNotificationSettings: ctx.reply yuborishda xato"));
    }
  }

  // 🧾 Faoliyat tarixi — botning "nima bo'ldi, nimalarni bajardim" degan
  // savolga javob beradigan YAGONA, universal lenta: xarid, sotuv, nizo,
  // sharh, escrow, obuna-almashish va h.k. — hammasi bitta ixcham
  // ro'yxatda, har biri turiga mos emoji bilan.
  const ACTIVITY_TYPE_ICONS: Record<string, string> = {
    PAYMENT: "💳",
    PURCHASE: "🛒",
    SALE: "💰",
    DISPUTE: "⚖️",
    REVIEW: "⭐",
    ESCROW: "🔐",
    EXCHANGE: "🔄",
    B2B: "🏢",
    STARTUP: "🚀",
    SYSTEM: "🔔"
  };

  // TUZATILDI (UNIVERSALLIK): avval bu funksiya `lang`ni umuman qabul
  // qilmasdi va "hozirgina"/"daq. oldin"/"soat oldin" so'zlari, shuningdek
  // "uz-UZ" locale'i doim qattiq kodlangan edi — ingliz tilini tanlagan
  // foydalanuvchi ham har doim o'zbekcha va o'zbek sana formatini ko'rardi.

  bot.callbackQuery("profile_activity", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_profile_activity", ctx.from?.id);
    const lang = ctx.session.language || "uz";
    try {
      const res = await withLoading(ctx, "typing", () =>
        fetch(`${process.env.APP_URL}/api/telegram/user-activity/${ctx.from!.id}?limit=15`, {
          headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
        })
      );
      if (!res.ok) {
        await ctx.reply(t("link_account_required", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showNotificationSettings: ctx.reply yuborishda xato"));
        return;
      }
      const data = await res.json();
      const items: any[] = data.items || [];
      if (!items.length) {
        await ctx.reply(t("activity_empty", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showNotificationSettings: ctx.reply yuborishda xato"));
        return;
      }

      let text = t("activity_title", lang);
      for (const n of items) {
        const icon = ACTIVITY_TYPE_ICONS[n.type] || "•";
        const unreadMark = n.isRead ? "" : " 🆕";
        text += `${icon} <b>${escapeHtml(n.title)}</b>${unreadMark}\n${escapeHtml(n.message)}\n<i>${formatActivityDate(n.createdAt, lang)}</i>\n\n`;
      }
      // Telegram xabar uzunligi cheklovi (4096) — juda uzun bo'lib
      // qolmasligi uchun ehtiyot chorasi sifatida qisqartiramiz.
      if (text.length > 3900) text = text.slice(0, 3900) + "\n…";

      await ctx.reply(text, { parse_mode: "HTML", reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showNotificationSettings: ctx.reply yuborishda xato"));
    } catch (err: unknown) {
      logger.error({ err }, "profile_activity error");
      await ctx.reply(t("activity_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showNotificationSettings: ctx.reply yuborishda xato"));
    }
  });

  // 🔄 Obunachi yig'ish — profildagi MUKAMMAL xulosa: kanallar, jami
  // to'plangan obunachi (kanallardan + referal bonusidan), referal
  // statistikasi, real obunalar soni va kunlik limit — hammasi bitta
  // ixcham kartochkada, keyin tegishli bo'limlarga tez o'tish tugmalari.
  //
  // TUZATILDI (foydalanuvchi talabi — "Profil" va "Mening profilim"
  // ikkalasi bir xil narsani ko'rsatishi kerak): bu funksiya endi
  // profile-service.ts'ga (showExchangeSummary nomi bilan) ko'chirildi,
  // shu sabab uni bu bot (asosiy) VA "Obunachi yig'ish" boti
  // (subscriber-bot/index.ts) IKKALASI HAM bir xil kod orqali chaqira
  // oladi — avval subscriber-bot o'zining "👤 Profil" tugmasi uchun
  // butunlay boshqa (faqat taklif qilingan do'stlar sonini ko'rsatuvchi,
  // handleStatsButton) va "👤 Mening profilim" tugmasi uchun yana boshqa
  // (sayt profilini, showProfile) funksiyani chaqirardi — ikkalasi
  // turli-tuman natija berib, foydalanuvchini chalkashtirar edi.
  // TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi
  // yig'ish botining bir-biriga aloqasi bo'lmasligi kerak"): bu
  // ekrandagi barcha tugmalar (ex_add, ex_browse va h.k.) endi FAQAT
  // subscriber-bot/index.ts'da ishlaydi — shu sabab bu botda
  // showExchangeSummary()ni ko'rsatish o'rniga, foydalanuvchi to'g'ridan
  // to'g'ri o'sha botga yo'naltiriladi (aks holda ekran ko'rsatilardi-yu,
  // tugmalarining hech biri ishlamas edi).
  bot.callbackQuery("profile_exchange", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_profile_exchange", ctx.from?.id);
    await redirectToSubscriberBot(ctx);
  });

  bot.callbackQuery("profile_notifications", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_profile_notifications", ctx.from?.id);
    await showNotificationSettings(ctx);
  });

  async function toggleNotification(ctx: MyContext, optOut: boolean) {
    const lang = ctx.session.language || "uz";
    try {
      const res = await fetch(`${process.env.APP_URL}/api/telegram/notification-settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET
        },
        body: JSON.stringify({ telegramUserId: ctx.from?.id, telegramBroadcastOptOut: optOut })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await ctx.reply(`❌ ${data.error || t("notif_toggle_error", lang)}`, {
          reply_markup: backToMenuKeyboard(ctx)
        }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "toggleNotification: ctx.reply yuborishda xato"));
        return;
      }
      trackBotEvent(optOut ? "bot_notifications_off" : "bot_notifications_on", ctx.from?.id);
      await showNotificationSettings(ctx);
    } catch (err: unknown) {
      logger.error({ err }, "toggleNotification error");
      await ctx.reply(t("notif_toggle_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "toggleNotification: ctx.reply yuborishda xato"));
    }
  }

  bot.callbackQuery("notif_off", async (ctx) => {
    await ctx.answerCallbackQuery(t("notif_off_toast", ctx.session.language || "uz"));
    await toggleNotification(ctx, true);
  });

  bot.callbackQuery("notif_on", async (ctx) => {
    await ctx.answerCallbackQuery(t("notif_on_toast", ctx.session.language || "uz"));
    await toggleNotification(ctx, false);
  });

}
