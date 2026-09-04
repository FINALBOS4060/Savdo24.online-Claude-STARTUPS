// Sof formatlash va matn-yordamchi funksiyalar. Bularning hech biri
// bot/session holatiga ega emas — kirish qiymati asosida chiqish qaytaradi,
// shu sabab index.ts'dan ajratib olish xavfsiz va testlash oson.
import { t, Lang } from "./i18n";
import { MyContext } from "./types";
import { logger } from "../src/lib/logger";

// DIZAYN TUZATISH: avval HAR BIR menyu/ro'yxat/sahifalash bosilganda
// (hattoki bir xil ekranga "orqaga" qaytilganda ham) bot doim YANGI xabar
// yuborardi (ctx.reply), eskisi esa chatda qolaverardi. Natijada bir necha
// daqiqa kategoriya/ro'yxat orasida yurgan foydalanuvchining chatida
// o'nlab "o'lik" eski ekranlar to'planib qolardi — bu constant Telegram
// botlarida (masalan admin-panel botlari) odatiy bo'lmagan, tartibsiz va
// havaskorona ko'rinadi. Professional botlar navigatsiya bosilganda
// mavjud xabarni TAHRIRLAYDI (bitta "oyna"), faqat chindan ham yangi
// mazmun (masalan yangi mahsulot ochilganda) uchun yangi xabar yuboradi.
//
// renderScreen — shu naqshni markazlashtiradi: agar chaqiruv INLINE
// tugma bosilishidan (callbackQuery) kelgan bo'lsa, avval mavjud xabarni
// tahrirlashga urinadi; agar bu imkonsiz bo'lsa (masalan avvalgi xabar
// rasm/caption edi, matn emas — Telegram buni editMessageText bilan
// tahrirlashga yo'l qo'ymaydi) yoki chaqiruv oddiy buyruq/matn xabaridan
// kelgan bo'lsa (tahrirlash uchun asl xabar yo'q), oddiy yangi xabarga
// qaytadi. "message is not modified" xatosi (foydalanuvchi bir xil
// ekranni qayta bosganda) jim o'tkaziladi — bu haqiqiy xato emas.
export async function renderScreen(
  ctx: MyContext,
  text: string,
  extra: { parse_mode?: "HTML"; reply_markup?: unknown } = {}
): Promise<unknown> {
  if (ctx.callbackQuery?.message) {
    try {
      return await ctx.editMessageText(text, extra as never);
    } catch (err: unknown) {
      const desc = (err as { description?: string; message?: string })?.description
        || (err as { message?: string })?.message
        || "";
      if (typeof desc === "string" && desc.includes("message is not modified")) {
        return;
      }
      // Tahrirlab bo'lmadi (masalan asl xabar rasm bo'lgan) — yangi
      // xabar sifatida yuboramiz, foydalanuvchi baribir javobsiz qolmasin.
      return ctx.reply(text, extra as never).catch((replyErr) =>
        logger.warn({ err: replyErr, userId: ctx.from?.id }, "renderScreen: fallback ctx.reply yuborishda xato")
      );
    }
  }
  return ctx.reply(text, extra as never).catch((replyErr) =>
    logger.warn({ err: replyErr, userId: ctx.from?.id }, "renderScreen: ctx.reply yuborishda xato")
  );
}

export function escapeHtml(input: unknown): string {
  const str = input === null || input === undefined ? "" : String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const CATEGORY_ICON_EMOJI: Record<string, string> = {
  rocket_launch: "🚀",
  auto_awesome: "✨",
  smart_toy: "🤖",
  web: "🌐",
  category: "🗂",
  code: "💻",
  shopping_cart: "🛒",
  palette: "🎨",
  videocam: "🎬",
  photo_camera: "📷",
  music_note: "🎵",
  school: "🎓",
  business: "💼",
  games: "🎮",
  sports_esports: "🎮",
  language: "🌍",
  extension: "🧩",
  storage: "🗄",
  security: "🔒",
  cloud: "☁️"
};

export function categoryEmoji(iconKey?: string): string {
  return CATEGORY_ICON_EMOJI[iconKey || ""] || "📦";
}

// Mahsulot-slug naqshi (handlers-text.ts'dagi oxirgi fallback handler
// shu bilan erkin matnni mahsulot slug'i deb tanib olishga urinadi).
// Bu yerga (format.ts'ga) ko'chirildi — chunki bu ham hech qanday
// bot/sessiya holatiga bog'liq bo'lmagan SOF naqsh, va handlers-text.ts
// o'zi grammy Bot, katalog, exchange-service kabi og'ir modullarni
// import qiladi — faqat shu regexni ishlatish/testlash uchun ularning
// barchasini (va ular orqali yon ta'sirlarni, masalan
// secret.ts'dagi avto-kalit fayl yozishni) ishga tushirish shart emas.
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const PAYMENT_STATUS_LABELS: Record<Lang, Record<string, string>> = {
  uz: {
    completed: "✅ Tugallandi",
    pending: "⏳ Kutilmoqda",
    failed: "❌ Muvaffaqiyatsiz",
    refund_required: "↩️ Qaytarish kutilmoqda"
  },
  en: {
    completed: "✅ Completed",
    pending: "⏳ Pending",
    failed: "❌ Failed",
    refund_required: "↩️ Refund pending"
  }
};

export function paymentStatusLabel(status: string, lang: Lang): string {
  return PAYMENT_STATUS_LABELS[lang]?.[status] || PAYMENT_STATUS_LABELS.uz[status] || status;
}

export function formatActivityDate(iso: string, lang: Lang = "uz"): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const isEn = lang === "en";
  if (diffMin < 1) return t("activity_just_now", lang);
  if (diffMin < 60) return t("activity_min_ago", lang, { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t("activity_hours_ago", lang, { count: diffHour });
  const locale = isEn ? "en-US" : "uz-UZ";
  return d.toLocaleDateString(locale) + " " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export const EXCHANGE_CHANNEL_STATUS_ICON: Record<string, string> = {
  active: "✅",
  queued: "🕓",
  blocked: "🚫",
  lapsed: "⏸",
  quota: "🏁"
};

// TUZATILDI (foydalanuvchi talabi — "yana qancha odam obuna bo'lishi va
// undan keyin navbatdan olinishi haqida ma'lumot bo'lsin"): oldin bu
// funksiya faqat "Faol — navbatda" deb qisqa yozardi, foydalanuvchi esa
// aynan NIMA sodir bo'lishi va NIMA qilish kerakligini bilmasdi. Endi
// har bir holat uchun aniq keyingi qadam ko'rsatiladi:
//   • hali hech kimga taklif qilinmagan (lastOfferedAt=null) — "navbatda
//     kutmoqda" (hali hatto ko'rsatilmagan);
//   • kamida bir marta ko'rsatilgan va hali faol — "istalgan 1 ta
//     kanalga obuna bo'lsangiz, +N obunachi qo'shiladi va navbatdan
//     chiqariladi" (aniq multiplier bilan, qattiq-kodlanmagan);
//   • navbatdan allaqachon olib tashlangan (kvota to'lgan) — buni QANDAY
//     tiklash mumkinligi ("Kanalimni qo'shish" orqali qayta yuborish).
// `multiplier` chaqiruvchi tomonidan /bonus-config'dan keshlangan holda
// uzatiladi — server konstantasi (hozir 2) o'zgarsa ham matn har doim
// haqiqiy qiymatni ko'rsatadi.
export function exchangeChannelStatusLine(c: any, lang: Lang, multiplier: number = 2): string {
  if (c.blockedByAdmin) return `${EXCHANGE_CHANNEL_STATUS_ICON.blocked} ${t("exchange_status_blocked", lang)}`;
  if (c.isActive) {
    if (!c.lastOfferedAt) {
      return `${EXCHANGE_CHANNEL_STATUS_ICON.queued} ${t("exchange_status_queued", lang)}`;
    }
    return `${EXCHANGE_CHANNEL_STATUS_ICON.active} ${t("exchange_status_active", lang, { multiplier })}`;
  }
  if (c.suspendedDueToLapse) return `${EXCHANGE_CHANNEL_STATUS_ICON.lapsed} ${t("exchange_status_lapsed", lang)}`;
  return `${EXCHANGE_CHANNEL_STATUS_ICON.quota} ${t("exchange_status_quota", lang, { reason: escapeHtml(c.suspendedReason || t("exchange_status_quota_default_reason", lang)) })}`;
}

export function exchangeRuleText(lang: Lang, multiplier: number): string {
  return t("exchange_rule_text", lang, { multiplier, quadExample: multiplier * 4 });
}

export function parseChannelLinkToUsername(input: string): { username: string | null; isInviteLink: boolean } {
  const cleaned = input.trim().replace(/^@/, "");
  const m = cleaned.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(.+)$/i);
  if (!m) return { username: null, isInviteLink: false };
  let path = m[1].split(/[?#]/)[0].replace(/\/+$/, "");
  if (path.startsWith("+") || /^joinchat(\/|$)/i.test(path)) {
    return { username: null, isInviteLink: true };
  }
  // "t.me/s/kanalnomi" — ochiq kanalning veb-ko'rinish (preview) havolasi,
  // "s/" prefiksini olib tashlab oddiy usernamega o'giramiz.
  path = path.replace(/^s\//i, "");
  if (!path || path.includes("/")) return { username: null, isInviteLink: false };
  return { username: `@${path}`, isInviteLink: false };
}


export async function withLoading<T>(ctx: MyContext, action: "typing" | "upload_photo", fn: () => Promise<T>): Promise<T> {
  ctx.replyWithChatAction(action).catch(() => {
    // chatAction yuborilmasa ham asosiy natijaga ta'sir qilmasin
  });
  return fn();
}

// TUZATILDI (TEZLIK): sponsor-gate.ts'dagi checkSubscription ilgari har
// bir kanal uchun `await bot.api.getChatMember(...)`ni KETMA-KET
// chaqirar edi — masalan 10 ta sponsor kanal bo'lsa, har bir
// foydalanuvchi xabari 10 ta Telegram API chaqiruvini ketma-ket kutib
// o'tirardi (agar har biri ~200ms bo'lsa, jami ~2 soniya). Bu yordamchi
// funksiya `items`ni PARALLEL qayta ishlaydi, lekin bir vaqtning o'zida
// ko'pi bilan `concurrency` ta chaqiruv ishlaydi — butunlay cheksiz
// `Promise.all` emas, chunki bu Telegram'ning global (barcha
// botlar/foydalanuvchilar uchun umumiy) flood-limitiga bexosdan urilib
// ketish xavfini oshiradi. Natijalar tartibda (kirish massivi bilan bir
// xil indeks tartibida) qaytariladi.
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
