// To'lov oqimi (buy_ callback) va majburiy obunani qayta tekshirish
// (check_subscription callback, faylni davom ettirib yetkazish).
import { Bot, InputFile } from "grammy";
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET, trackBotEvent } from "./secret";
import { backToMenuKeyboard, mainMenuKeyboard } from "./keyboards";
import { deliverFile } from "./delivery";
import { getSponsorChannelsCached, mainMenuKeyboardOptions } from "./exchange-service";
import { checkSubscription, markGatePassed, clearGatePassed } from "./sponsor-gate";
import { SponsorChannel } from "./types";

export function registerPaymentHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery(/^buy_(.+)$/, async (ctx) => {
    const startupId = ctx.match[1];
    const lang = ctx.session.language || "uz";
    await ctx.answerCallbackQuery(t("payment_preparing", lang));
    trackBotEvent("bot_buy_initiated", ctx.from?.id);

    try {
      const res = await fetch(`${process.env.APP_URL}/api/telegram/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET
        },
        body: JSON.stringify({
          telegramUserId: ctx.from?.id,
          startupId
        })
      });

      const data = await res.json();

      if (!res.ok) {
        await ctx.reply(`❌ ${data.error || t("payment_create_error", lang)}`, { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerPaymentHandlers: ctx.reply yuborishda xato"));
        return;
      }

      // rasmsiz mahsulotlar oddiy matnli xabar (text) sifatida yuborilgan,
      // rasmli mahsulotlar esa caption bilan (photo) — xabar turiga qarab
      // tegishli edit metodi tanlanadi.
      const newMarkup = {
        inline_keyboard: [
          [{ text: t("payment_finish_btn", lang), url: data.paymentUrl }]
        ]
      };
      const hasPhoto = !!(ctx.callbackQuery.message && "photo" in ctx.callbackQuery.message && ctx.callbackQuery.message.photo);
      if (hasPhoto) {
        await ctx.editMessageCaption({
          caption: (ctx.callbackQuery.message?.caption || "") + t("payment_link_ready", lang),
          parse_mode: "HTML",
          reply_markup: newMarkup
        });
      } else {
        await ctx.editMessageText(
          (ctx.callbackQuery.message?.text || "") + t("payment_link_ready", lang),
          { parse_mode: "HTML", reply_markup: newMarkup }
        );
      }

      // QR-kodni reply sifatida yuborish (mavjud bo'lsa)
      if (data.qrCode && typeof data.qrCode === "string" && data.qrCode.includes(",")) {
        const qrBuffer = Buffer.from(data.qrCode.split(",")[1], "base64");
        await ctx.replyWithPhoto(
          new InputFile(qrBuffer, "qr-payment.png"),
          {
            caption: t("payment_qr_caption", lang),
            reply_to_message_id: ctx.callbackQuery.message?.message_id
          }
        );
      }
    } catch (err) {
      logger.error({ err }, "Buy callback error");
      await ctx.reply(t("generic_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerPaymentHandlers: ctx.reply yuborishda xato"));
    }
  });

  // /start (fayl tokeni) va check_subscription callback'i ikkalasi ham
  // xuddi shu "faylni yetkazib berish" logikasidan foydalanadi.
  bot.callbackQuery("check_subscription", async (ctx) => {
    const lang = ctx.session.language || "uz";
    try {
      const channels = await getSponsorChannelsCached();
      if (channels === null) {
        return ctx.answerCallbackQuery({ text: t("generic_error", lang), show_alert: true });
      }

      const notSubscribed = await checkSubscription(bot, channels, ctx.from!.id);

      if (notSubscribed.length > 0) {
        clearGatePassed(ctx.from!.id);
        return ctx.answerCallbackQuery({
          text: t("sponsor_gate_still_not", lang, { channels: notSubscribed.map((c: SponsorChannel) => c.channelUsername).join(", ") }),
          show_alert: true
        });
      }

      markGatePassed(ctx.from!.id);
      await ctx.answerCallbackQuery(t("sponsor_gate_confirmed", lang));
      // Agar bloklanish aynan fayl-yetkazish oqimida (token bilan /start)
      // sodir bo'lgan bo'lsa — o'sha faylni davom ettirib yetkazamiz. Aks
      // holda asosiy menyuga qaytaramiz.
      if (ctx.session?.token) {
        await deliverFile(ctx, ctx.session.token);
      } else {
        await ctx.reply(t("welcome", lang), { parse_mode: "HTML", reply_markup: mainMenuKeyboard(ctx, await mainMenuKeyboardOptions(ctx)) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "registerPaymentHandlers: ctx.reply yuborishda xato"));
      }
    } catch (err: unknown) {
      logger.error({ err }, "check_subscription callback error");
      await ctx.answerCallbackQuery(t("generic_error", lang)).catch((cbErr) => logger.warn({ err: cbErr, userId: ctx.from?.id }, "registerPaymentHandlers: answerCallbackQuery yuborishda xato"));
    }
  });
}
