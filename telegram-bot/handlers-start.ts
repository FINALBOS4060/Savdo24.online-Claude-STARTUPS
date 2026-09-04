// /start va /bogla buyruqlari: fayl yetkazish tokeni, "buy_" chuqur
// havolasi, "exref_" referal havolasi, hisob bog'lash kodi.
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t, hasUserChosenLanguage } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET, trackBotEvent } from "./secret";
import { escapeHtml } from "./format";
import { mainMenuKeyboard, backToMenuKeyboard } from "./keyboards";
import { mainMenuKeyboardOptions } from "./exchange-service";
import { deliverFile } from "./delivery";
import { showProduct } from "./catalog";

// TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
// botining bir-biriga aloqasi bo'lmasligi kerak"): avval oddiy "/start"
// bosilganda, foydalanuvchida HALI birorta ham ulangan exchange kanali
// bo'lmasa, asosiy menyu O'RNIGA "kanalingizni ulang" bildirishnomasi
// ko'rsatilib, foydalanuvchi asosiy menyuga UMUMAN kira olmasdi (butun
// onboarding "Obunachi yig'ish" bo'limiga bog'liq edi). Bu aynan
// so'ralgan "ikkala bot bir-biriga aloqasi bo'lmasligi" tamoyiliga zid
// edi — endi asosiy bot HAR DOIM, exchange kanali bor-yo'qligidan
// qat'i nazar, oddiy xush kelibsiz xabarini va asosiy menyuni
// ko'rsatadi. `hasAnyExchangeChannel`/`showExchangeAddChannelPrompt`
// import va chaqiruvlari shu sabab olib tashlandi.
async function sendWelcomeOrChannelPrompt(ctx: MyContext, extraText?: string): Promise<void> {
  const lang = ctx.session.language || "uz";
  const welcomeText = extraText ? `${t("welcome", lang)}\n\n${extraText}` : t("welcome", lang);
  await ctx.reply(welcomeText, { parse_mode: "HTML", reply_markup: mainMenuKeyboard(ctx, {}) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "start: ctx.reply yuborishda xato"));
}

// YANGI (foydalanuvchi talabi — "botga birinchi start bosilganida tilni
// tanlash tugmalari chiqsin, ruz tilinihm qo'sh"): foydalanuvchi HALI
// hech qachon tilni aniq tanlamagan bo'lsa (hasUserChosenLanguage —
// TelegramBotUser jadvalida yozuv yo'q), oddiy xush kelibsiz xabari
// o'rniga AVVAL tilni tanlash ekrani ko'rsatiladi. Tugmalar
// handlers-menu-callbacks.ts'dagi ALLAQACHON mavjud "set_lang_(uz|en|ru)"
// callback'iga ishora qiladi — u til(ni saqlaydi VA o'zi xush kelibsiz
// xabari + asosiy menyuni yuboradi, shu sabab bu yerda alohida yangi
// callback yozish shart bo'lmadi.
async function sendFirstRunLanguagePicker(ctx: MyContext): Promise<void> {
  // Tilni hali tanlamagan foydalanuvchi uchun mos matn — uchala tilda
  // ham bir xil (choose_language kaliti allaqachon uch tilli).
  await ctx.reply(t("choose_language", "uz"), {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇺🇿 O'zbekcha", callback_data: "set_lang_uz" },
          { text: "🇬🇧 English", callback_data: "set_lang_en" },
          { text: "🇷🇺 Русский", callback_data: "set_lang_ru" }
        ]
      ]
    }
  }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "start: til tanlash ekranini yuborishda xato"));
}

export function registerStartHandlers(bot: Bot<MyContext>): void {
  bot.command("start", async (ctx) => {
    const token = ctx.match;
    if (!token) {
      // YANGI: oddiy "/start" (havolasiz) — hali til tanlanmagan
      // bo'lsa, avval til tanlash ekranini ko'rsatamiz.
      if (ctx.from && !(await hasUserChosenLanguage(ctx.from.id))) {
        await sendFirstRunLanguagePicker(ctx);
        return;
      }
      await sendWelcomeOrChannelPrompt(ctx);
      return;
    }

    // Saytdagi "Telegram orqali to'lash" tugmasidan kelgan chuqur havola:
    // https://t.me/<bot>?start=buy_<startupId>
    if (token.startsWith("buy_")) {
      return showProduct(ctx, token.slice(4));
    }

    // "Obunachi yig'ish" bo'limidagi REFERAL havolasi:
    // https://t.me/<bot>?start=exref_<taklif qiluvchining Telegram ID'si>.
    // Bu yerda hali HECH QANDAY mukofot berilmaydi — faqat "kim kimni
    // taklif qildi" server tomonida yozib qo'yiladi.
    if (token.startsWith("exref_")) {
      const referrerTelegramId = token.slice(6);
      if (referrerTelegramId && referrerTelegramId !== String(ctx.from!.id)) {
        fetch(`${process.env.APP_URL}/api/telegram/exchange/register-referral`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
          body: JSON.stringify({ referrerTelegramId, refereeTelegramId: ctx.from!.id })
        }).catch((err) => logger.warn({ err }, "exchange register-referral fetch failed"));
      }
      await sendWelcomeOrChannelPrompt(ctx, t("referral_invite_note", ctx.session.language || "uz"));
      return;
    }

    try {
      // Agar token 6 ta harf-raqam bo'lsa, uni bog'lash kodi sifatida qabul qilamiz
      if (token.length === 6 && /^[A-Z0-9]+$/i.test(token)) {
        const linkRes = await fetch(`${process.env.APP_URL}/api/telegram/link`, {
          method: "POST",
          headers: {
             "Content-Type": "application/json",
            "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET
          },
          body: JSON.stringify({ code: token.toUpperCase(), telegramUserId: ctx.from?.id })
        });
        if (linkRes.ok) {
          const linkData = await linkRes.json();
          trackBotEvent("bot_account_linked", ctx.from?.id);
          await ctx.reply(`🎉 Tabriklaymiz, <b>${escapeHtml(linkData.name)}</b>! Hisobingiz muvaffaqiyatli tasdiqlandi va bog'landi.`, {
            parse_mode: "HTML",
            reply_markup: mainMenuKeyboard(ctx, await mainMenuKeyboardOptions(ctx))
          }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "start: ctx.reply yuborishda xato"));
          return;
        } else {
          const errData = await linkRes.json();
          const lang = ctx.session.language || "uz";
          await ctx.reply(
            `❌ ${errData.error || t("link_code_error", lang)}\n\n${t("link_code_error_hint", lang)}`,
            { reply_markup: backToMenuKeyboard(ctx) }
          ).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "start: ctx.reply yuborishda xato"));
          return;
        }
      }

      // Aks holda u fayl olish tokeni bo'lishi mumkin — server secret header talab qiladi
      const res = await fetch(`${process.env.APP_URL}/api/telegram/verify/${token}`, {
        headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
      });
      if (!res.ok) {
        await ctx.reply(t("start_link_expired", ctx.session.language || "uz")).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "start: ctx.reply yuborishda xato"));
        return;
      }
      const data = await res.json();

      // ESLATMA: Sponsor kanallarga majburiy obuna global darvozada
      // (sponsor-gate.ts) tekshiriladi — shu handler ishga tushgan bo'lsa,
      // foydalanuvchi ALLAQACHON barcha kanallarga obuna ekani tasdiqlangan.
      ctx.session.token = token;
      ctx.session.startupId = data.startupId;
      return deliverFile(ctx, token);
    } catch (err: unknown) {
      logger.error({ err }, "/start command error");
      await ctx.reply(t("start_generic_error", ctx.session.language || "uz"), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "start: ctx.reply yuborishda xato"));
    }
  });

  bot.command("bogla", async (ctx) => {
    const code = ctx.match?.trim().toUpperCase();
    if (!code) {
      // TUZATILDI (i18n'ni chetlab o'tish): oldin bu yerda matn
      // qattiq-kodlangan o'zbekcha holda yuborilardi — garchi
      // i18n.ts'da AYNAN shu matn uchun (menu-actions.ts'dagi
      // handleMenuLink allaqachon ishlatadigan) `link_account_instructions`
      // kaliti mavjud bo'lsa ham. Ingliz tilini tanlagan foydalanuvchi
      // `/bogla` buyrug'ini argumentsiz yozganda ham o'zbekcha javob
      // olardi.
      await ctx.reply(
        t("link_account_instructions", ctx.session.language || "uz"),
        { parse_mode: "HTML", reply_markup: backToMenuKeyboard(ctx) }
      ).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "bogla: ctx.reply yuborishda xato"));
      return;
    }

    try {
      const res = await fetch(`${process.env.APP_URL}/api/telegram/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET
        },
        body: JSON.stringify({ code, telegramUserId: ctx.from?.id })
      });

      if (res.ok) {
        const data = await res.json();
        await ctx.reply(`🎉 Tabriklaymiz, <b>${escapeHtml(data.name)}</b>! Hisobingiz muvaffaqiyatli bog'landi.`, {
          parse_mode: "HTML",
          reply_markup: mainMenuKeyboard(ctx, await mainMenuKeyboardOptions(ctx))
        }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "bogla: ctx.reply yuborishda xato"));
      } else {
        const data = await res.json();
        await ctx.reply(`❌ ${data.error || t("link_code_error", ctx.session.language || "uz")}`, {
          reply_markup: backToMenuKeyboard(ctx)
        }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "bogla: ctx.reply yuborishda xato"));
      }
    } catch (err: unknown) {
      logger.error({ err }, "/bogla command error");
      await ctx.reply(t("start_network_error", ctx.session.language || "uz"), {
        reply_markup: backToMenuKeyboard(ctx)
      }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "bogla: ctx.reply yuborishda xato"));
    }
  });
}
