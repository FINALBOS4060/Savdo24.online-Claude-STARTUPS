// Profil sahifasini ko'rsatish. index.ts (bir nechta joyda chaqiriladi)
// va handlers-profile.ts ikkalasi ham shu yerdan import qiladi.
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET } from "./secret";
import { escapeHtml, withLoading, renderScreen, exchangeChannelStatusLine } from "./format";
import { mainMenuKeyboard, profileKeyboard, backToMenuKeyboard, exchangeMenuKeyboard } from "./keyboards";
import { mainMenuKeyboardOptions, getExchangeBonusConfigCached } from "./exchange-service";
import { getExchangeMilestoneProgress, renderProgressBar } from "../src/lib/pure-helpers";

export async function showProfile(ctx: MyContext) {
  const lang = ctx.session.language || "uz";
  try {
    const secretHeader = { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET };
    const [statsRes, activityRes] = await withLoading(ctx, "typing", () =>
      Promise.all([
        fetch(`${process.env.APP_URL}/api/telegram/user-stats/${ctx.from?.id}`, { headers: secretHeader }),
        fetch(`${process.env.APP_URL}/api/telegram/user-activity/${ctx.from?.id}?limit=1`, { headers: secretHeader }).catch(() => null)
      ])
    );

    if (!statsRes.ok) {
      await ctx.reply(t("profile_link_required_full", lang), { reply_markup: mainMenuKeyboard(ctx, await mainMenuKeyboardOptions(ctx)) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showProfile: ctx.reply yuborishda xato"));
      return;
    }

    const data = await statsRes.json();
    const activity = activityRes && activityRes.ok ? await activityRes.json().catch(() => null) : null;
    const unreadCount: number = activity?.unreadCount || 0;

    let text = `<b>👤 ${escapeHtml(data.name)}</b>\n`;
    text += `<code>${escapeHtml(data.email)}</code>\n`;
    text += "━━━━━━━━━━━━━━━\n";
    text += t("profile_balance_line", lang, { balance: data.balance });
    text += t("profile_referral_earned_line", lang, { amount: data.totalEarned });
    text += t("profile_referral_count_line", lang, { count: data.referralCount });
    text += t("profile_referral_code_line", lang, { code: data.referralCode || t("none_placeholder", lang) });
    text += unreadCount > 0 ? t("profile_unread_line", lang, { count: unreadCount }) : t("profile_no_unread_line", lang);

    await renderScreen(ctx, text, { parse_mode: "HTML", reply_markup: profileKeyboard(data.referralCode, unreadCount, lang) });
  } catch (err: unknown) {
    logger.error({ err }, "showProfile error");
    await renderScreen(ctx, t("profile_load_error", lang), { reply_markup: backToMenuKeyboard(ctx) });
  }
}

// 🔄 Obunachi yig'ish — "PROFIL" sifatida ko'rsatiladigan MUKAMMAL xulosa:
// jami to'plangan ball, faol obunalar (necha kanalga obuna bo'lgan), referal
// statistikasi, kunlik limit va har bir o'z kanaliga qancha ball/obunachi
// qo'shilgani — hammasi bitta ixcham kartochkada.
//
// TUZATILDI (foydalanuvchi talabi — "Profil" va "Mening profilim" bir xil
// narsani ko'rsatishi kerak): bu funksiya avval handlers-profile.ts ichida
// faqat "profile_exchange" callbackiga bog'langan holda yozilgan edi. Endi
// bu yerga (profile-service.ts) ko'chirildi va eksport qilindi, shu sabab
// uni asosiy bot (handlers-profile.ts) VA "Obunachi yig'ish" boti
// (subscriber-bot/index.ts) IKKALASI HAM — o'zining "👤 Profil" pastki
// panel tugmasi UCHUN HAM, "👤 Mening profilim" tugmasi UCHUN HAM — bir
// xil chaqiradi. Shu bilan ikkala tugma endi doim BIR XIL natija beradi.
export async function showExchangeSummary(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  try {
    const res = await withLoading(ctx, "typing", () =>
      fetch(`${process.env.APP_URL}/api/telegram/exchange/summary/${ctx.from!.id}`, {
        headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
      })
    );
    if (!res.ok) {
      await ctx.reply(t("exchange_load_error_retry", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showExchangeSummary: ctx.reply yuborishda xato"));
      return;
    }
    const data = await res.json();
    const channels: any[] = data.channels || [];
    const { subscriberMultiplier } = await getExchangeBonusConfigCached();

    let text = t("exchange_summary_title", lang);
    text += t("exchange_total_collected", lang, { count: data.totalEarnedSubscribers });
    // YANGI (progress-bar / "yana N kishi qoldi"): foydalanuvchiga jami
    // yig'gan obunachisi keyingi kosmetik bosqichga qanchalik yaqinligini
    // ko'rsatadi — aniq, ko'zga ko'rinuvchi maqsad orqali faollikni
    // rag'batlantirish uchun (qarang: src/lib/pure-helpers.ts).
    const milestone = getExchangeMilestoneProgress(Number(data.totalEarnedSubscribers) || 0);
    const bar = renderProgressBar(milestone.progressPercent);
    text += milestone.reached
      ? t("ex_milestone_reached", lang, { bar, badge: milestone.badge })
      : t("ex_milestone_progress", lang, { bar, percent: String(milestone.progressPercent), remaining: String(milestone.remaining), badge: milestone.badge });
    if (data.referralBonus > 0) {
      text += t("exchange_referral_bonus_line", lang, { count: data.referralBonus });
    }
    text += t("exchange_active_subs_line", lang, { count: data.activeSubscriptionsCount });
    text += t("exchange_referral_stats_line", lang, { invited: data.referralInvitedCount, rewarded: data.referralRewardedCount });
    text += t("exchange_new_subs_today_line", lang, { count: data.newSubsToday, max: data.maxNewSubsPerDay });

    if (channels.length === 0) {
      text += t("exchange_no_channels", lang);
    } else {
      text += t("exchange_channels_title", lang, { count: channels.length, max: data.maxChannels });
      for (const c of channels) {
        text += t("exchange_channel_line", lang, { title: escapeHtml(c.title), count: c.earnedSubscribers, status: exchangeChannelStatusLine(c, lang, subscriberMultiplier) });
      }
    }

    const buttons: any[] = [];
    if (channels.length === 0) {
      buttons.push([{ text: t("exchange_add_channel_btn", lang), callback_data: "ex_add" }]);
    } else {
      buttons.push([{ text: t("exchange_manage_channels_btn", lang), callback_data: "ex_mychannels" }]);
    }
    buttons.push([{ text: t("exchange_subscribe_btn", lang), callback_data: "ex_browse" }]);
    buttons.push([{ text: t("exchange_invite_btn", lang), callback_data: "ex_invite" }]);
    buttons.push([{ text: t("refresh_btn", lang), callback_data: "profile_exchange" }, { text: t("back_profile_btn", lang), callback_data: "menu_profile" }]);

    await ctx.reply(text, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showExchangeSummary: ctx.reply yuborishda xato"));
  } catch (err: unknown) {
    logger.error({ err }, "showExchangeSummary error");
    await ctx.reply(t("exchange_load_error", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showExchangeSummary: ctx.reply yuborishda xato"));
  }
}

