// Server tomonida (src/routes/*) "Obunachi yig'ish" botining xabar
// shablonlarini o'qish uchun yordamchi. telegram-bot/i18n.ts'dagi t()
// funksiyasi bilan BIR XIL vazifani bajaradi (admin tahriri bo'lsa —
// o'shani, aks holda standart matnni qaytaradi), lekin ATAYLAB
// mustaqil: bu fayl telegram-bot/db.ts'ni (va u orqali IKKINCHI,
// alohida Prisma ulanish hovuzini) import qilmaydi — server allaqachon
// src/lib/context.ts orqali o'z Prisma clientiga ega, shu sababli
// bu yerda xuddi shu clientni (getSetting orqali) qayta ishlatamiz.
//
// Ikkala tomon (bot va server) BIR XIL manbadan — Setting jadvalidagi
// "BOT_MSG:<key>" kalitlaridan — o'qiydi, shu sabab admin panelda
// kiritilgan tahrir ikkalasida ham (bot: bir necha daqiqada, server:
// har chaqiriqda darhol) ko'rinadi.
import { getSetting } from "./context";
import { BOT_MESSAGE_DEFAULTS } from "./botMessageDefaults";

export const BOT_MSG_SETTING_PREFIX = "BOT_MSG:";

export async function getBotMessageTemplate(key: string): Promise<string> {
  try {
    const override = await getSetting(`${BOT_MSG_SETTING_PREFIX}${key}`);
    if (override) return override;
  } catch {
    // e'tiborsiz qoldiriladi — standart matn bilan davom etamiz
  }
  return BOT_MESSAGE_DEFAULTS[key] ?? key;
}

// {{var}} joy-tutuvchilarni almashtirib, tayyor xabar matnini qaytaradi.
export async function renderBotMessage(
  key: string,
  vars?: Record<string, string | number>
): Promise<string> {
  let str = await getBotMessageTemplate(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return str;
}
