// Telegram'ning "/" menyu tugmasida (chat oynasining pastida) buyruqlar
// tushunarli tavsiflar bilan chiqishi uchun.
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { MyContext } from "./types";

export function registerBotCommandMenu(bot: Bot<MyContext>): void {
  bot.api.setMyCommands([
    { command: "start", description: "🏠 Botni boshlash / Bosh menyu" },
    { command: "menu", description: "📋 Bosh menyuni ochish" },
    { command: "yordam", description: "❓ Yordam" },
    { command: "new_listings", description: "🆕 Yangi e'lonlarni ko'rish" },
    { command: "top_deals", description: "🔥 TOP takliflarni ko'rish" },
    { command: "qidiruv", description: "🔍 Mahsulot qidirish" },
    { command: "profile", description: "👤 Mening profilim" },
    { command: "bogla", description: "🔗 Saytdagi hisobni ulash" }
  ]).catch((err) => logger.error({ err }, "setMyCommands failed"));
}
