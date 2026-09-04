// "Obunachi almashish" (exchange) bo'limining barcha Telegram
// callbackQuery handlerlari — bitta joyda. index.ts faqat
// registerExchangeHandlers(bot)ni chaqiradi, aslida qaysi tugma nima
// qilishini bilish shart emas.
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET, trackBotEvent } from "./secret";
import { escapeHtml, exchangeRuleText, exchangeChannelStatusLine, withLoading, mapWithConcurrency } from "./format";
import { backToMenuKeyboard, exchangeMenuKeyboard } from "./keyboards";
import {
  getExchangeBonusConfigCached,
  getExchangeLiveStatsLine,
  enforceExchangeRules,
  submitExchangeChannelReport,
  handleMenuExchange,
  handleExchangeBrowse,
  showExchangeAddChannelPrompt
} from "./exchange-service";

// YANGI (ex_confirm_all handleri uchun): bir vaqtning o'zida ko'pi bilan
// nechta getChatMember/confirm-subscribe so'rovi PARALLEL yuborilishi —
// enforceExchangeRules'dagi ENFORCE_RULES_CONCURRENCY bilan bir xil
// sabab/qiymat (Telegram flood-limitiga urilib ketmaslik uchun).
const CONFIRM_ALL_CONCURRENCY = 5;

// 🆕 KO'CHIRILDI (avval bot.callbackQuery ichida to'g'ridan-to'g'ri
// yozilgan edi): har bir exchange ekranining mantig'i endi ALOHIDA
// eksport qilingan funksiyada — shu bilan "obunachi yig'ish" boti
// (subscriber-bot/index.ts) ham AYNAN shu kodni pastki reply-panel
// tugmalaridan chaqira oladi (callbackQuery'ga bog'liq bo'lmagan holda,
// ctx.answerCallbackQuery() bu funksiyalar ICHIDA emas, faqat pastdagi
// bot.callbackQuery vraper'larida chaqiriladi — xuddi mavjud
// handleMenuExchange/handleExchangeReportReasonText naqshidek). Mantiq
// so'z-ma-so'z bir xil, faqat joyi ko'chirilgan — nusxa YO'Q.
export async function handleExchangeInvite(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "Savdo24_Register_bot";
  const link = `https://t.me/${botUsername}?start=exref_${ctx.from!.id}`;
  const { referralBonus } = await getExchangeBonusConfigCached();
  await ctx.reply(t("ex_invite_text", lang, { referralBonus, link }), { parse_mode: "HTML", reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeInvite: ctx.reply yuborishda xato"));
}

export async function handleExchangeInfo(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  const { referralBonus, welcomeBonus, subscriberMultiplier } = await getExchangeBonusConfigCached();
  await ctx.reply(
    t("ex_info_intro", lang, { welcomeBonus, referralBonus }) + exchangeRuleText(lang, subscriberMultiplier),
    { parse_mode: "HTML", reply_markup: exchangeMenuKeyboard(ctx) }
  ).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeInfo: ctx.reply yuborishda xato"));
}

// TUZATILDI (DRY — ko'chirildi exchange-service.ts'ga): ko'rsatma matni
// endi handleMenuExchange'dagi yangi majburiy darvoza bilan BIR XIL
// showExchangeAddChannelPrompt() funksiyasidan chiqadi — ikki joyda
// nusxa yuritilmaydi.
export async function handleExchangeAdd(ctx: MyContext): Promise<void> {
  await showExchangeAddChannelPrompt(ctx);
}

export async function handleExchangeMyChannels(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/my-channels/${ctx.from!.id}`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    if (!res.ok) {
      // TUZATILDI: xuddi ex_browse'dagi kabi — javob tekshirilmasa, server
      // xatosi ({error: "..."}, massiv emas) "sizda hali kanal yo'q" deb
      // noto'g'ri talqin qilinardi.
      const errBody = await res.text().catch(() => "");
      logger.error({ status: res.status, body: errBody }, "exchange my-channels request failed");
      await ctx.reply(t("ex_channels_load_error", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeMyChannels: ctx.reply yuborishda xato"));
      return;
    }
    const channels = await res.json();
    if (!Array.isArray(channels) || channels.length === 0) {
      await ctx.reply(t("ex_no_channels_yet", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeMyChannels: ctx.reply yuborishda xato"));
      return;
    }
    // TUZATILDI (foydalanuvchi talabi): ilgari bu yerda faqat "Faol
    // (navbatda)" / "To'xtatilgan" deb qisqa yozilardi — endi profil
    // ekranidagi bilan BIR XIL, batafsil (keyingi qadamni ham
    // ko'rsatadigan) status matni ishlatiladi, shu jumladan "hali
    // hech kimga ko'rsatilmagan" holati.
    const { subscriberMultiplier } = await getExchangeBonusConfigCached();
    let text = t("ex_my_channels_title", lang);
    const buttons: any[] = [];
    for (const c of channels) {
      const status = exchangeChannelStatusLine(c, lang, subscriberMultiplier);
      const count = typeof c.subscriberCount === "number" ? c.subscriberCount : 0;
      text += t("ex_channel_row", lang, { title: escapeHtml(c.title), status, count });
      buttons.push([{ text: t("ex_channel_remove_btn", lang, { title: c.title }), callback_data: `ex_remove_${c.id}` }]);
    }
    buttons.push([{ text: t("back_to_menu", lang), callback_data: "menu_home" }]);
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeMyChannels: ctx.reply yuborishda xato"));
  } catch (err: unknown) {
    logger.error({ err }, "ex_mychannels error");
    await ctx.reply(t("ex_channels_load_error", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeMyChannels: ctx.reply yuborishda xato"));
  }
}

// KO'CHIRILDI (foydalanuvchi talabi): handleExchangeBrowse'ning o'zi
// endi exchange-service.ts'da (servis qatlami) — chunki handleMenuExchange
// (o'sha faylda) endi buni TO'G'RIDAN-TO'G'RI chaqiradi, servis qatlami
// esa shu (handler) qatlamini import qilmasligi kerak (aylanma import
// bo'lib qolmasligi uchun). Bu yerda faqat qayta eksport qilingan —
// pastdagi "ex_browse" callback'i va subscriber-bot/index.ts avvalgidek
// shu nomdan import qilib ishlatadi, hech narsa buzilmagan. Dinamik
// subscriberMultiplier mantig'i (getExchangeBonusConfigCached/
// exchangeRuleText) ko'chirilgan funksiya ichida o'zgarishsiz qoldi.
export { handleExchangeBrowse } from "./exchange-service";

// YANGI (foydalanuvchi talabi): haftalik reyting jadvali — so'nggi 7
// kunda eng ko'p boshqa kanalga obuna bo'lgan (eng faol) 10 nafar
// foydalanuvchini ko'rsatadi. Hisoblash serverda (/leaderboard)
// bajariladi — bot faqat natijani chiroyli formatlab ko'rsatadi.
export async function handleExchangeLeaderboard(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";

  try {
    const res = await withLoading(ctx, "typing", () =>
      fetch(`${process.env.APP_URL}/api/telegram/exchange/leaderboard`, {
        headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
      })
    );
    if (!res.ok) {
      await ctx.reply(t("ex_leaderboard_load_error", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeLeaderboard: ctx.reply yuborishda xato"));
      return;
    }
    const entries: { telegramUserId: string; username: string | null; subscribersEarned: number }[] = await res.json();

    if (!Array.isArray(entries) || entries.length === 0) {
      await ctx.reply(t("ex_leaderboard_empty", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeLeaderboard: ctx.reply yuborishda xato"));
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    let text = t("ex_leaderboard_title", lang);
    entries.forEach((e, i) => {
      const rank = medals[i] || `${i + 1}.`;
      const displayName = e.username
        ? `@${escapeHtml(e.username)}`
        : t("ex_leaderboard_anon_user", lang, { id: String(e.telegramUserId).slice(-4) });
      text += t("ex_leaderboard_line", lang, { rank, name: displayName, count: e.subscribersEarned });
    });

    // Foydalanuvchining o'zi ro'yxatda yo'q bo'lsa, uni ham
    // rag'batlantirish uchun qisqa taklif qo'shiladi.
    const isCurrentUserListed = entries.some((e) => String(e.telegramUserId) === String(ctx.from!.id));
    if (!isCurrentUserListed) {
      text += "\n" + t("ex_leaderboard_join_hint", lang);
    }

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: t("exchange_subscribe_btn", lang), callback_data: "ex_browse" }],
          [{ text: t("back_to_menu", lang), callback_data: "menu_home" }]
        ]
      }
    }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeLeaderboard: ctx.reply yuborishda xato"));
  } catch (err: unknown) {
    logger.error({ err }, "ex_leaderboard error");
    await ctx.reply(t("ex_leaderboard_load_error", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeLeaderboard: ctx.reply yuborishda xato"));
  }
}

// TUZATILDI (foydalanuvchi talabi — dublikat tugmalar olib tashlandi):
// avval subscriber-bot/index.ts shu funksiyani `{ isSubscriberBot: true }`
// bilan chaqirib, "menu_exchange"/"ex_browse" natijasidagi ro'yxat ostiga
// INLINE tugma (Kanalimni qo'shish, Mening kanallarim va h.k.) qo'shilishini
// o'chirardi — chunki o'sha bot bu tugmalarni ALOHIDA pastki reply-
// klaviatura sifatida ham ko'rsatardi (endi olib tashlangan, qarang
// subscriber-bot/index.ts). Endi bunday pastki panel yo'q, shu sabab
// `isSubscriberBot` bayrog'idan qat'i nazar INLINE tugmalar HAR DOIM
// ko'rsatiladi — subscriber-bot ham asosiy bot bilan bir xil ishlaydi.
export function registerExchangeHandlers(bot: Bot<MyContext>, options: { isSubscriberBot?: boolean } = {}) {
  const includeMenuActions = true;

  bot.callbackQuery("menu_exchange", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_menu_exchange", ctx.from?.id);
    await handleMenuExchange(bot, ctx, includeMenuActions);
  });

  bot.callbackQuery("ex_invite", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_exchange_invite", ctx.from?.id);
    await handleExchangeInvite(ctx);
  });

  // YANGI ("bo'lib kerakli joyda chiqarish" tuzatishi): asosiy kirish
  // ekrani endi qisqa — to'liq bonus/qoida ma'lumotini shu yerda, faqat
  // so'ralganda, bitta joyda ko'rsatamiz (qarang: exchange_intro izohi,
  // i18n.ts).
  bot.callbackQuery("ex_info", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleExchangeInfo(ctx);
  });

  bot.callbackQuery("ex_add", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleExchangeAdd(ctx);
  });

  bot.callbackQuery("ex_mychannels", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleExchangeMyChannels(ctx);
  });

  bot.callbackQuery(/^ex_remove_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language || "uz";
    const id = ctx.match![1];
    try {
      const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/remove-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
        body: JSON.stringify({ ownerTelegramId: ctx.from!.id, id })
      });
      if (!res.ok) {
        // TUZATILDI: ilgari bu so'rov natijasi UMUMAN tekshirilmasdi — server
        // 404 ("kanal topilmadi" — masalan boshqa foydalanuvchiga tegishli
        // bo'lsa) qaytarsa ham, bot foydalanuvchiga har doim "✅ Kanal
        // o'chirildi" deb yolg'on xabar berardi.
        const data = await res.json().catch(() => ({}));
        await ctx.reply(`❌ ${data.error || t("ex_remove_error", lang)}`, { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerExchangeHandlers: ctx.reply yuborishda xato"));
        return;
      }
      await ctx.reply(t("ex_remove_success", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerExchangeHandlers: ctx.reply yuborishda xato"));
    } catch (err: unknown) {
      logger.error({ err }, "ex_remove error");
      await ctx.reply(t("ex_remove_error", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerExchangeHandlers: ctx.reply yuborishda xato"));
    }
  });


  // Foydalanuvchining eski obunalarini haqiqiy holat bilan solishtiradi
  // (getChatMember orqali), natijani serverga yuboradi va natijani
  // qaytaradi. Bu funksiya HAM "obuna bo'lish" tugmasi bosilganda, HAM
  // pastdagi davriy (proaktiv) tekshiruvda ishlatiladi — shu bilan ikkala
  // joyda ham bir xil qoida qo'llanadi.
  //
  // MUHIM (nazorat mexanizmi tuzatildi): getChatMember chaqiruvi XATO
  // bersa (tarmoq uzilishi, Telegram flood-control/429, bot vaqtincha
  // o'sha kanaldan chetlashtirilishi va h.k.) — bu foydalanuvchi
  // HAQIQATAN kanaldan chiqib ketgani degani EMAS. Shuning uchun bunday
  // "noma'lum" holatlarda foydalanuvchi JAZOLANMAYDI — natija umuman
  // serverga yuborilmaydi va oldingi holat o'zgarishsiz qoladi. Faqat
  // Telegram ANIQ "left" yoki "kicked" statusini qaytarganda (haqiqatan
  // obunadan chiqqan/chiqarilgan) kanal navbatdan olib tashlanadi.

  bot.callbackQuery("ex_browse", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleExchangeBrowse(bot, ctx, includeMenuActions);
  });

  // 🆕 YANGI (foydalanuvchi talabi, skrinshot bilan): oldin har bir
  // kanal o'zining alohida "✅ Obuna bo'ldim: {title}" tugmasiga ega edi
  // (ex_sub_ID). Endi ro'yxat ostida YAGONA tugma — bosilganda so'nggi
  // ko'rsatilgan (ctx.session.exchangeBrowseChannels, handleExchangeBrowse
  // tomonidan saqlangan) BARCHA kanallar bir vaqtning o'zida (parallel,
  // enforceExchangeRules'dagi bilan bir xil naqsh — mapWithConcurrency)
  // tekshiriladi: haqiqatan a'zo bo'lganlar tasdiqlanadi
  // (confirm-subscribe), hali obuna bo'lmaganlar alohida ko'rsatiladi va
  // sessiyada qoladi — "qayta tekshirish" tugmasi bilan darhol qayta
  // urinish mumkin. ex_sub_ID handleri (pastda) hozircha eski
  // havolalar/xabarlar bilan moslik uchun saqlab qolindi.
  bot.callbackQuery("ex_confirm_all", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = ctx.session.language || "uz";
    const pending = ctx.session.exchangeBrowseChannels;

    if (!pending || pending.length === 0) {
      await ctx.reply(t("ex_confirm_all_session_expired", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "ex_confirm_all: ctx.reply yuborishda xato"));
      return;
    }

    const secretHeader = { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET };
    const confirmed: string[] = [];
    // TUZATILDI (ANIQLIK — foydalanuvchi talabi: "bot ba'zi kanallarga
    // obuna bo'lganini bilmayapti"): avval UCHTA butunlay xil holat —
    // (1) haqiqatan a'zo emas, (2) getChatMember xato berdi (holat
    // NOMA'LUM), (3) a'zoligi getChatMember orqali TASDIQLANGAN bo'lsa
    // ham confirm-subscribe so'rovi rad etdi (masalan kunlik yangi-obuna
    // limiti — 429) — barchasi BITTA "stillPending" ro'yxatiga tushib,
    // HAMMASI uchun bitta xabar ("Siz hali obuna bo'lmagansiz") ko'rsatilardi.
    // Bu ANIQ NOTO'G'RI edi: (3)-holatda foydalanuvchi HAQIQATAN obuna
    // bo'lgani getChatMember orqali tasdiqlangan, shunga qaramay "hali
    // obuna bo'lmagansiz" deyilardi — bu ANIQ YOLG'ON xabar. (2)-holatda
    // ham xuddi shunday — holat aslida noma'lum, "obuna emas" degan
    // xulosa yo'q. Endi bu uch holat ALOHIDA kuzatilib, HAR BIRIGA ANIQ,
    // TO'G'RI mos xabar ko'rsatiladi. (ESLATMA: (3)-holatning to'g'ri
    // yechimi — server qaytargan aniq sababni ko'rsatish — ilgari
    // ex_sub_ID handlerida ALLAQACHON qilingan edi, lekin "hammasini
    // birdan tasdiqlash" tugmasi (ex_confirm_all) uni almashtirganda bu
    // tuzatish qaytadan yo'qolib qolgan ekan.)
    const notMember: { id: number; channelId: string; title: string }[] = [];
    const unknownStatus: { id: number; channelId: string; title: string }[] = [];
    const rejectedAfterVerified: { channel: { id: number; channelId: string; title: string }; reason: string }[] = [];

    await mapWithConcurrency(pending, CONFIRM_ALL_CONCURRENCY, async (c) => {
      let isMember: boolean;
      try {
        const member = await bot.api.getChatMember(c.channelId, ctx.from!.id);
        isMember = ["member", "administrator", "creator"].includes(member.status);
      } catch (err: unknown) {
        // Holatni ANIQLAB BO'LMADI (tarmoq xatosi, Telegram flood-control
        // va h.k.) — "chiqib ketgan/obuna bo'lmagan" deb JAZOLANMAYDI VA
        // FOYDALANUVCHIGA HAM SHUNDAY DEYILMAYDI — alohida, "hozircha
        // tekshirib bo'lmadi" xabari bilan ko'rsatiladi.
        logger.warn({ err, channelId: c.channelId }, "ex_confirm_all: getChatMember failed — holat noma'lum");
        unknownStatus.push(c);
        return;
      }

      if (!isMember) {
        notMember.push(c);
        return;
      }

      try {
        const confirmRes = await fetch(`${process.env.APP_URL}/api/telegram/exchange/confirm-subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...secretHeader },
          body: JSON.stringify({ subscriberTelegramId: ctx.from!.id, exchangeChannelId: c.id })
        });
        if (confirmRes.ok) {
          confirmed.push(c.title);
          return;
        }
        // TUZATILDI: a'zoligi ENDIGINA getChatMember orqali TASDIQLANGAN
        // bo'lsa ham, server so'rovni boshqa sababga ko'ra (masalan kunlik
        // yangi-obuna limiti) rad etishi mumkin. Haqiqiy sabab (serverning
        // aniq xabari) ENDI YASHIRILMAYDI — pastda alohida qatorda
        // ko'rsatiladi, "hali obuna bo'lmagansiz" bilan ARALASHTIRILMAYDI.
        const data = await confirmRes.json().catch(() => ({}));
        logger.warn({ status: confirmRes.status, error: data?.error, channelId: c.id }, "ex_confirm_all: confirm-subscribe failed (a'zoligi tasdiqlangan edi)");
        rejectedAfterVerified.push({ channel: c, reason: data?.error || t("generic_error", lang) });
      } catch (err: unknown) {
        logger.warn({ err, channelId: c.channelId }, "ex_confirm_all: confirm-subscribe so'rovi ishlamadi (a'zoligi tasdiqlangan edi)");
        rejectedAfterVerified.push({ channel: c, reason: t("generic_error", lang) });
      }
    });

    let resultText = t("ex_confirm_all_result_title", lang);
    if (confirmed.length > 0) {
      resultText += t("ex_confirm_all_confirmed_line", lang, { titles: confirmed.map((title) => escapeHtml(title)).join(", ") });
    }
    if (notMember.length > 0) {
      resultText += t("ex_confirm_all_pending_line", lang, { titles: notMember.map((c) => escapeHtml(c.title)).join(", ") });
    }
    if (unknownStatus.length > 0) {
      resultText += t("ex_confirm_all_unknown_line", lang, { titles: unknownStatus.map((c) => escapeHtml(c.title)).join(", ") });
    }
    // Bir xil sabab bilan rad etilgan kanallar birga guruhlanadi — masalan
    // kunlik limitga urilgan 5 ta kanal bo'lsa, sabab BIR MARTA yozilib,
    // hammasi shu bitta qatorda ko'rsatiladi (har biriga alohida qator emas).
    if (rejectedAfterVerified.length > 0) {
      const groups = new Map<string, string[]>();
      for (const { channel, reason } of rejectedAfterVerified) {
        const list = groups.get(reason) || [];
        list.push(channel.title);
        groups.set(reason, list);
      }
      for (const [reason, titles] of groups) {
        resultText += t("ex_confirm_all_rejected_line", lang, { reason: escapeHtml(reason), titles: titles.map((title) => escapeHtml(title)).join(", ") });
      }
    }
    if (confirmed.length === 0 && notMember.length === 0 && unknownStatus.length === 0 && rejectedAfterVerified.length === 0) {
      resultText = t("ex_confirm_all_none_confirmed", lang);
    }

    // Keyingi safar qayta tekshirish uchun HALI yakunlanmagan barcha
    // kanallar (haqiqatan obuna bo'lmaganlar + holati noma'lumlar +
    // a'zoligi tasdiqlangan-u lekin rad etilganlar) sessiyada qoldiriladi —
    // tasdiqlanganlarni qayta tekshirishning hojati yo'q.
    const stillPending = [...notMember, ...unknownStatus, ...rejectedAfterVerified.map((r) => r.channel)];
    ctx.session.exchangeBrowseChannels = stillPending;

    const resultButtons: any[] = [];
    if (stillPending.length > 0) {
      resultButtons.push([{ text: t("ex_confirm_all_btn", lang), callback_data: "ex_confirm_all" }]);
    }
    resultButtons.push([{ text: t("back_to_menu", lang), callback_data: "menu_home" }]);

    await ctx.reply(resultText, { parse_mode: "HTML", reply_markup: { inline_keyboard: resultButtons } }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "ex_confirm_all: ctx.reply yuborishda xato"));
  });

  // YANGI (foydalanuvchi talabi): haftalik reyting jadvali — so'nggi 7
  // kunda eng ko'p boshqa kanalga obuna bo'lgan (eng faol) 10 nafar
  // foydalanuvchini ko'rsatadi. Hisoblash serverda (/leaderboard)
  // bajariladi — bot faqat natijani chiroyli formatlab ko'rsatadi.
  bot.callbackQuery("ex_leaderboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    trackBotEvent("bot_exchange_leaderboard", ctx.from?.id);
    await handleExchangeLeaderboard(ctx);
  });

  bot.callbackQuery(/^ex_sub_(\d+)$/, async (ctx) => {
    const exchangeChannelId = ctx.match![1];
    const lang = ctx.session.language || "uz";
    const secretHeader = { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET };

    try {
      const chRes = await fetch(`${process.env.APP_URL}/api/telegram/exchange/channel/${exchangeChannelId}`, { headers: secretHeader });
      if (!chRes.ok) {
        return ctx.answerCallbackQuery(t("ex_channel_gone", lang));
      }
      const channel = await chRes.json();

      if (String(channel.ownerTelegramId) === String(ctx.from!.id)) {
        return ctx.answerCallbackQuery(t("ex_own_channel", lang));
      }

      const member = await bot.api.getChatMember(channel.channelId, ctx.from!.id);
      const isMember = ["member", "administrator", "creator"].includes(member.status);

      if (!isMember) {
        return ctx.answerCallbackQuery(t("ex_not_subscribed_yet", lang, { title: channel.title }));
      }

      const confirmRes = await fetch(`${process.env.APP_URL}/api/telegram/exchange/confirm-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...secretHeader },
        body: JSON.stringify({ subscriberTelegramId: ctx.from!.id, exchangeChannelId })
      });
      if (!confirmRes.ok) {
        // TUZATILDI: bu so'rov natijasi ilgari UMUMAN tekshirilmasdi — server
        // 429 qaytarganda (masalan kunlik yangi-obuna limiti to'lganda) ham,
        // bot foydalanuvchiga har doim "✅ Rahmat! Obunangiz qayd etildi" deb
        // yolg'on xabar berardi, garchi hech narsa saqlanmagan (kredit
        // berilmagan, kanal navbatdan chiqarilmagan) bo'lsa ham.
        const data = await confirmRes.json().catch(() => ({}));
        return ctx.answerCallbackQuery({ text: `❌ ${data.error || t("generic_error", lang)}`, show_alert: true });
      }

      await ctx.answerCallbackQuery(t("ex_subscribe_confirmed", lang));
      // TUZATILDI (IZCHILLIK): escapeHtml(channel.title) shu yerda ilgari
      // ham qo'llanilgan edi, lekin parse_mode: "HTML" UNUTILGAN edi — bu
      // teskari muammo tug'diradi: kanal nomida "&" kabi belgi bo'lsa,
      // foydalanuvchi Telegram'da xom "&amp;" matnini ko'rar edi (chunki
      // HTML rejimi yo'qligida Telegram bu kodlarni hech qachon
      // dekodlamaydi). Endi parse_mode qo'shildi — escapeHtml endi to'g'ri
      // ishlaydi.
      await ctx.reply(t("ex_subscribe_success", lang, { title: escapeHtml(channel.title) }), {
        parse_mode: "HTML",
        reply_markup: exchangeMenuKeyboard(ctx)
      }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerExchangeHandlers: ctx.reply yuborishda xato"));
    } catch (err: unknown) {
      logger.error({ err }, "ex_sub error");
      await ctx.answerCallbackQuery(t("generic_error", lang)).catch((cbErr) => logger.warn({ err: cbErr, userId: ctx.from?.id }, "registerExchangeHandlers: answerCallbackQuery yuborishda xato"));
    }
  });

  // 🚩 YANGI (foydalanuvchi talabi): "Obunachi yig'ish" ro'yxatida
  // taklif qilingan kanaldan shikoyat qilish oqimi. Avval sabab
  // tugmalar orqali tanlanadi (tez, matn kiritish shart emas) — faqat
  // "Boshqa sabab" tanlansa matn kutiladi.
  bot.callbackQuery(/^ex_report_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const exchangeChannelId = ctx.match![1];
    const lang = ctx.session.language || "uz";
    await ctx.reply(t("ex_report_choose_reason", lang), {
      reply_markup: {
        inline_keyboard: [
          [{ text: t("ex_report_reason_spam", lang), callback_data: `ex_report_r_${exchangeChannelId}_spam` }],
          [{ text: t("ex_report_reason_content", lang), callback_data: `ex_report_r_${exchangeChannelId}_content` }],
          [{ text: t("ex_report_reason_scam", lang), callback_data: `ex_report_r_${exchangeChannelId}_scam` }],
          [{ text: t("ex_report_reason_other", lang), callback_data: `ex_report_other_${exchangeChannelId}` }],
          [{ text: t("search_cancel", lang), callback_data: "menu_home" }]
        ]
      }
    }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerExchangeHandlers: ctx.reply yuborishda xato"));
  });

  const EXCHANGE_REPORT_REASON_LABELS: Record<string, string> = {
    spam: "Spam / keraksiz reklama",
    content: "Nomaqbul kontent (18+, zo'ravonlik va h.k.)",
    scam: "Firibgarlik / aldov"
  };


  bot.callbackQuery(/^ex_report_r_(\d+)_(spam|content|scam)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, exchangeChannelId, reasonCode] = ctx.match!;
    await submitExchangeChannelReport(ctx, exchangeChannelId, EXCHANGE_REPORT_REASON_LABELS[reasonCode]);
  });

  bot.callbackQuery(/^ex_report_other_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const exchangeChannelId = ctx.match![1];
    const lang = ctx.session.language || "uz";
    ctx.session.awaitingReportReason = true;
    ctx.session.reportChannelId = exchangeChannelId;
    await ctx.reply(t("ex_report_other_prompt", lang), {
      reply_markup: { inline_keyboard: [[{ text: t("search_cancel", lang), callback_data: "menu_home" }]] }
    }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerExchangeHandlers: ctx.reply yuborishda xato"));
  });


}
