// Obuna-almashish bilan bog'liq DAVRIY (proaktiv) vazifalar: qoidani
// tekshirish (har 3 soatda), soatlik "yangi obunachi" hisoboti va
// faolsizlik eslatmasi. Har biri o'zining "ishlab turibdi" qulfiga
// (running flag) ega — ikkita bir xil job bir vaqtda ustma-ust ishlab
// ketmasligi uchun.
import cron from "node-cron";
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t, getUserLanguage } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET } from "./secret";
import { escapeHtml } from "./format";
import { enforceExchangeRules, checkExchangeChannelHealth, reactivateCreditSuspendedChannels, reactivateLostAccessChannels, announceNewExchangeChannels } from "./exchange-service";

export function registerCronJobs(bot: Bot<MyContext>): void {
  // Obuna almashish qoidasini DAVRIY tekshirish: foydalanuvchi botni
  // ochmasa ham, kimningdir kanali to'xtatilsa yoki tiklansa — shaxsiy
  // xabar orqali darhol xabardor qilinadi.
  let exchangeCheckRunning = false;

  cron.schedule("0 */3 * * *", async () => {
    if (exchangeCheckRunning) {
      logger.warn("Exchange periodic check: oldingi tekshiruv hali tugamagan — bu safar o'tkazib yuborildi.");
      return;
    }
    exchangeCheckRunning = true;
    try {
      const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/all-subscriber-ids`, {
        headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        logger.error({ status: res.status, body: errBody }, "exchange all-subscriber-ids request failed");
        return;
      }
      const userIds: string[] = await res.json();

      for (const userId of userIds) {
        try {
          const report = await enforceExchangeRules(bot, Number(userId));

          if (report.lapsed?.length > 0) {
            const lang = await getUserLanguage(userId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
            const lapsedButtons: any[] = (report.lapsedDetails || [])
              .filter((c: any) => c.link)
              .map((c: any) => [{ text: t("ex_resubscribe_btn", lang, { title: c.title }), url: c.link }]);
            lapsedButtons.push([{ text: t("back_to_menu", lang), callback_data: "menu_home" }]);

            await bot.api.sendMessage(
              userId,
              t("ex_lapsed_notice", lang, { channels: escapeHtml(report.lapsed.join(", ")) }),
              { parse_mode: "HTML", reply_markup: { inline_keyboard: lapsedButtons } }
            ).catch((err) => logger.warn({ err, userId }, "Exchange lapse notify failed"));
          } else if (report.reactivatedChannels?.length > 0) {
            const lang = await getUserLanguage(userId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
            const names = report.reactivatedChannels.map((c: any) => c.title).join(", ");
            await bot.api.sendMessage(
              userId,
              t("ex_reactivated_notice", lang, { names: escapeHtml(names) }),
              { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: t("back_to_menu", lang), callback_data: "menu_home" }]] } }
            ).catch((err) => logger.warn({ err, userId }, "Exchange reactivate notify failed"));
          }
        } catch (err) {
          logger.warn({ err, userId }, "Exchange periodic check failed for user");
        }
        // Telegram API cheklovlariga hurmat yuzasidan har foydalanuvchi
        // orasida qisqa tanaffus
        await new Promise((r) => setTimeout(r, 300));
      }

      // TUZATILDI: kanal egasi botni admin'likdan olib tashlasa yoki
      // kanalni o'chirib yuborsa, endi shu yerda aniqlanadi.
      await checkExchangeChannelHealth(bot);

      // YANGI (foydalanuvchi talabi — "kanallar navbatdan o'chib
      // qolyapti" bugi ILDIZIDAN tuzatildi): avval NOTO'G'RI (faqat
      // asosiy bot tekshirilib) "bot admin emas" deb belgilangan, lekin
      // aslida "obunachi yig'ish" boti orqali admin bo'lgan kanallarni
      // shu yerda bir martalik (har 3 soatda) qayta tekshirib, avtomatik
      // tiklaydi.
      await reactivateLostAccessChannels(bot);

      // YANGI (foydalanuvchi talabi — "ball/kredit bor foydalanuvchilar
      // navbatdan olib tashlanib, qo'lda qayta ishga tushirishga to'g'ri
      // kelyapti" bugi tuzatildi): kredit sababli to'xtatilgan kanallar
      // endi shu yerda, har 3 soatda, avtomatik qayta navbatga qo'shiladi
      // — admin qo'lda hech narsa qilishi shart emas.
      await reactivateCreditSuspendedChannels(bot);
    } catch (err) {
      logger.error({ err }, "Exchange periodic enforcement job failed");
    } finally {
      exchangeCheckRunning = false;
    }
  });

  // YANGI (foydalanuvchi talabi — "botga yangi foydalanuvchi qo'shilganida,
  // hali unga obuna bo'lmagan boshqalarga xabar borsin"): har 30 daqiqada
  // yangi qo'shilgan kanallarni tekshirib, hali obuna bo'lmagan faol
  // ishtirokchilarga bildirishnoma yuboradi.
  let exchangeNewChannelAnnounceRunning = false;

  cron.schedule("5,35 * * * *", async () => {
    if (exchangeNewChannelAnnounceRunning) {
      logger.warn("Exchange new-channel announcement: oldingi ishga tushirish hali tugamagan — bu safar o'tkazib yuborildi.");
      return;
    }
    exchangeNewChannelAnnounceRunning = true;
    try {
      await announceNewExchangeChannels(bot);
    } catch (err) {
      logger.error({ err }, "Exchange new-channel announcement job failed");
    } finally {
      exchangeNewChannelAnnounceRunning = false;
    }
  });

  // Kanal egasiga "kanalingizga bot orqali N ta odam qo'shildi"
  // bildirishnomasi HAR SOATDA yuboriladi — faqat shu soat ichida
  // haqiqatda yangi odam qo'shilgan kanallar uchun.
  let exchangeJoinReportRunning = false;

  cron.schedule("0 * * * *", async () => {
    if (exchangeJoinReportRunning) {
      logger.warn("Exchange hourly join report: oldingi ishga tushirish hali tugamagan — bu safar o'tkazib yuborildi.");
      return;
    }
    exchangeJoinReportRunning = true;
    try {
      const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/hourly-join-report`, {
        headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        logger.error({ status: res.status, body: errBody }, "exchange hourly-join-report request failed");
        return;
      }
      const report: { channelId: number; ownerTelegramId: string; title: string; newSubscribers: number }[] = await res.json();

      for (const item of report) {
        try {
          const lang = await getUserLanguage(item.ownerTelegramId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
          await bot.api.sendMessage(
            item.ownerTelegramId,
            t("ex_hourly_join_report", lang, { title: escapeHtml(item.title), count: String(item.newSubscribers) }),
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: t("back_to_menu", lang), callback_data: "menu_home" }]] } }
          );
        } catch (err) {
          logger.warn({ err, ownerTelegramId: item.ownerTelegramId }, "Exchange hourly join-report notify failed");
        }
        // Telegram API cheklovlariga hurmat yuzasidan har xabar orasida
        // qisqa tanaffus
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      logger.error({ err }, "Exchange hourly join report job failed");
    } finally {
      exchangeJoinReportRunning = false;
    }
  });

  // "Obunachi yig'ish"da faollikni rag'batlantirish: kanal qo'shgan-u,
  // lekin O'ZI hech kimga obuna bo'lmagan foydalanuvchilarga 24 soatdan
  // keyin yumshoq eslatma yuboriladi.
  let exchangeInactivityReminderRunning = false;

  cron.schedule("30 * * * *", async () => {
    if (exchangeInactivityReminderRunning) {
      logger.warn("Exchange inactivity reminder: oldingi ishga tushirish hali tugamagan — bu safar o'tkazib yuborildi.");
      return;
    }
    exchangeInactivityReminderRunning = true;
    try {
      const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/inactivity-reminder-report`, {
        headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        logger.error({ status: res.status, body: errBody }, "exchange inactivity-reminder-report request failed");
        return;
      }
      const report: { ownerTelegramId: string; title: string }[] = await res.json();

      for (const item of report) {
        try {
          const lang = await getUserLanguage(item.ownerTelegramId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
          await bot.api.sendMessage(
            item.ownerTelegramId,
            t("ex_inactivity_reminder", lang, { title: escapeHtml(item.title) }),
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: t("exchange_subscribe_btn", lang), callback_data: "ex_browse" }],
                  // YANGI (foydalanuvchi talabi — referal orqali ham
                  // faollikni oshirish): eslatmaga do'stlarni taklif
                  // qilish tugmasi ham qo'shildi — matn allaqachon buni
                  // tushuntiradi (ex_inactivity_reminder), tugma esa
                  // to'g'ridan-to'g'ri referal havolasini ko'rsatadigan
                  // ekranga olib boradi.
                  [{ text: t("exchange_invite_btn", lang), callback_data: "ex_invite" }],
                  [{ text: t("back_to_menu", lang), callback_data: "menu_home" }]
                ]
              }
            }
          );
        } catch (err) {
          logger.warn({ err, ownerTelegramId: item.ownerTelegramId }, "Exchange inactivity reminder notify failed");
        }
        // Telegram API cheklovlariga hurmat yuzasidan har xabar orasida
        // qisqa tanaffus
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      logger.error({ err }, "Exchange inactivity reminder job failed");
    } finally {
      exchangeInactivityReminderRunning = false;
    }
  });
}
