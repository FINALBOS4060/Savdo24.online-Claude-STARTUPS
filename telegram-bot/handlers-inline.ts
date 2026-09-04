// Tezkor qidiruv (inline mode): foydalanuvchi istalgan chatda
// "@bot so'rov" deb yozganda ishlaydi. MUHIM: botning o'zida ISHLASHI
// uchun @BotFather'da /setinline orqali "Inline mode" YOQILGAN bo'lishi
// kerak (kod ichida emas, bir martalik BotFather sozlamasi).
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { MyContext } from "./types";
import { trackBotEvent } from "./secret";
import { escapeHtml } from "./format";

export function registerInlineHandlers(bot: Bot<MyContext>): void {
  bot.on("inline_query", async (ctx) => {
    const query = (ctx.inlineQuery.query || "").trim();

    try {
      if (query.length < 2) {
        return ctx.answerInlineQuery([], {
          cache_time: 10,
          is_personal: false,
          button: { text: "🔍 Qidirish uchun kamida 2 harf yozing", start_parameter: "inline_help" }
        });
      }

      const res = await fetch(
        `${process.env.APP_URL}/api/startups?search=${encodeURIComponent(query)}&onlyActive=true&limit=20`
      );
      if (!res.ok) {
        return ctx.answerInlineQuery([], { cache_time: 5 });
      }
      const data = await res.json();
      const items: any[] = Array.isArray(data) ? data : (data.startups || []);

      const results = items.slice(0, 20).map((p: any) => {
        const imageUrl = p.image
          ? (String(p.image).startsWith("/") ? `${process.env.APP_URL}${p.image}` : p.image)
          : undefined;
        const description = `💰 ${p.price} USDT · ${p.category || ""}`.trim();
        const messageText =
          `<b>${escapeHtml(p.name)}</b>\n\n` +
          `${escapeHtml(p.slogan || p.description || "")}\n\n` +
          `💰 Narxi: ${escapeHtml(p.price)} USDT`;

        const base = {
          type: "article" as const,
          id: String(p.id),
          title: p.name,
          description,
          input_message_content: {
            message_text: messageText,
            parse_mode: "HTML" as const
          },
          reply_markup: {
            inline_keyboard: [[
              { text: "🔎 Batafsil / Sotib olish", url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || "Savdo24_Register_bot"}?start=buy_${p.id}` }
            ]]
          }
        };

        // Rasm mavjud bo'lsa thumbnail sifatida ko'rsatiladi — xabarning
        // o'zi baribir yuqoridagi matn bilan yuboriladi.
        return imageUrl ? { ...base, thumbnail_url: imageUrl } : base;
      });

      await ctx.answerInlineQuery(results, { cache_time: 30, is_personal: false });
      trackBotEvent("bot_inline_search", ctx.from?.id);
    } catch (err: unknown) {
      logger.error({ err, query }, "inline_query error");
      try {
        await ctx.answerInlineQuery([], { cache_time: 5 });
      } catch {
        // javob berib bo'lmasa ham jim o'tkazamiz
      }
    }
  });
}
