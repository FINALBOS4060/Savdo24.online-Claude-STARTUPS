// To'langan mahsulot faylini yetkazib berish oqimi. Bitta joyda —
// /start token bilan chaqirilganda va sponsor-darvozadan o'tgandan keyin
// ikkalasi ham shu funksiyani ishlatadi.
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET } from "./secret";
import { backToMenuKeyboard } from "./keyboards";

export async function deliverFile(ctx: MyContext, token: string) {
  const lang = ctx.session.language || "uz";
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/deliver/${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET
      },
      body: JSON.stringify({ telegramUserId: ctx.from?.id })
    });

    if (res.ok) {
      const data = await res.json();
      // TUZATILDI: fayl muvaffaqiyatli yetkazilgach token sessiyadan
      // O'CHIRILADI. Aks holda check_subscription callback'i (agar
      // majburiy obuna darvozasi keyinroq, BOSHQA sababdan qayta ishga
      // tushsa) `if (ctx.session?.token) deliverFile(ctx, ctx.session.token)`
      // shartiga tayanib, ALLAQACHON ISHLATILGAN eski tokenni qayta
      // yuborishga urinardi. Faqat MUVAFFAQIYATLI holatda tozalanadi —
      // xato (res.ok=false) yoki tarmoq xatosi bo'lsa token saqlanib
      // qoladi, shunda foydalanuvchi qayta urinishi (masalan darvozadan
      // qayta o'tganda) haligacha ishlaydi.
      // TUZATILDI (kichik "chang" sessiya holati): oldin faqat `token`
      // tozalanardi, `startupId` esa saqlanib qolardi. `token` boshqa
      // mahsulotlar uchun handlers-start.ts'da har safar qayta
      // yoziladi va tekshiriladi, shu sabab eski qiymat funksional
      // xato keltirib chiqarmaydi — lekin sessiyada keraksiz eskirgan
      // ID saqlanib qolishi (masalan keyingi debug/log tahlilida
      // chalg'itishi mumkin) yaxshi amaliyot emas. token bilan bir xil
      // vaqtda, bir xil shart ostida tozalanadi.
      if (ctx.session) {
        ctx.session.token = "";
        ctx.session.startupId = "";
      }
      await ctx.reply(t("file_ready", lang, { url: data.deliveryUrl })).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "deliverFile: ctx.reply yuborishda xato"));
    } else {
      const data = await res.json().catch(() => ({}));
      await ctx.reply(data.error || t("generic_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "deliverFile: ctx.reply yuborishda xato"));
    }
  } catch (err: unknown) {
    logger.error({ err }, "deliverFile error");
    await ctx.reply(t("generic_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "deliverFile: ctx.reply yuborishda xato"));
  }
}

