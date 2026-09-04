// Bosh menyu ostidagi oddiy bo'limlar (Qidirish, Hisobni ulash, Yordam,
// Til, Sayt) va "bosh menyuga qaytish" — bular komanda/callback ikkalasi
// tomonidan HAM, doimiy pastki klaviatura matn-tugmalari tomonidan HAM
// chaqiriladi (handlers-catalog.ts, handlers-menu-callbacks.ts,
// handlers-text.ts), shu sabab bitta umumiy joyga chiqarildi.
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { mainMenuKeyboard, backToMenuKeyboard, clearAwaitingState } from "./keyboards";
import { mainMenuKeyboardOptions } from "./exchange-service";
import { renderScreen } from "./format";
import { resolveSubscriberBotUsername } from "./bot-instance";

// YANGI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
// botining bir-biriga aloqasi bo'lmasligi kerak, obunachi yig'ish
// ishlarini obunachi yig'ish boti qilishi kerak"): avval "Obunachi
// yig'ish" bo'limi shu (asosiy) botda ham TO'LIQ ishlab turardi
// (handleMenuExchange va h.k. — bu bot o'z tokeni bilan getChatMember
// chaqirardi). Bu aynan "qaysi bot admin" chalkashligining yana bir
// manbai edi. Endi bu bo'lim shu botda UMUMAN ishlamaydi — foydalanuvchi
// shu funksiyaga (subscriber-bot/index.ts'da to'liq ishlaydigan) alohida
// botga yo'naltiriladi.
export async function redirectToSubscriberBot(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  clearAwaitingState(ctx);
  const username = await resolveSubscriberBotUsername();
  const buttons = username
    ? [[{ text: t("ex_open_subscriber_bot_btn", lang), url: `https://t.me/${username}` }]]
    : [];
  await ctx.reply(t("ex_use_subscriber_bot", lang), {
    reply_markup: { inline_keyboard: buttons }
  }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "redirectToSubscriberBot: ctx.reply yuborishda xato"));
}

// menu_home callback'i va doimiy klaviaturadagi "🏠 Bosh menyu" tugmasi
// bir xil "boshiga qaytish" mantig'ini ishlatadi: barcha "kutilayotgan
// kirish" holatlari tozalanadi va xush kelibsiz xabari qayta yuboriladi.
export async function goHome(ctx: MyContext): Promise<void> {
  clearAwaitingState(ctx);
  await ctx.reply(t("welcome", ctx.session.language || "uz"), { parse_mode: "HTML", reply_markup: mainMenuKeyboard(ctx, await mainMenuKeyboardOptions(ctx)) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "goHome: ctx.reply yuborishda xato"));
}

export async function handleMenuSearch(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  ctx.session.awaitingSearch = true;
  await renderScreen(
    ctx,
    t("search_prompt", lang),
    { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: t("search_cancel", lang), callback_data: "menu_home" }]] } }
  );
}

export async function handleMenuLink(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  await renderScreen(ctx, t("link_account_instructions", lang), { parse_mode: "HTML", reply_markup: backToMenuKeyboard(ctx) });
}

export async function handleMenuHelp(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  await renderScreen(ctx, t("help", lang), {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: t("contact_support_btn", lang), callback_data: "support_start" }],
        [{ text: t("back_to_menu", lang), callback_data: "menu_home" }]
      ]
    }
  });
}

export async function handleMenuLanguage(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  await renderScreen(ctx, t("choose_language", lang), {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇺🇿 O'zbekcha", callback_data: "set_lang_uz" },
          { text: "🇬🇧 English", callback_data: "set_lang_en" },
          { text: "🇷🇺 Русский", callback_data: "set_lang_ru" }
        ],
        [{ text: t("back_to_menu", lang), callback_data: "menu_home" }]
      ]
    }
  });
}

// "🌐 Saytga o'tish" avval INLINE url-tugma edi. Doimiy pastki
// klaviaturada url-tugma BO'LISHI MUMKIN EMAS (Telegram Bot API cheklovi),
// shu sabab bosilganda bot havolani matn ko'rinishida yuboradi — Telegram
// uni avtomatik bosiladigan havolaga aylantiradi.
export async function handleMenuSite(ctx: MyContext): Promise<void> {
  const lang = ctx.session.language || "uz";
  const url = process.env.APP_URL || "https://savdo24.online";
  await renderScreen(ctx, `${t("menu_site", lang)}:\n${url}`, { reply_markup: backToMenuKeyboard(ctx) });
}
