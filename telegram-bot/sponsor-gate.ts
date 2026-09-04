// 📢🔒 MAJBURIY OBUNA (SponsorChannel) darvozasi: foydalanuvchi Telegram'da
// haqiqatan sponsor kanal(lar)ga obuna ekanini getChatMember orqali
// tekshiradi. Har bir kanal alohida tekshiriladi, xatolik (masalan bot
// o'sha kanaldan chiqarib yuborilgan) "obuna emas" deb hisoblanadi.
//
// Bu fayl botning HAR QANDAY buyrug'i/tugmasi/xabaridan OLDIN ishlaydigan
// global middleware'ni (sponsorGateMiddleware) ham eksport qiladi —
// index.ts uni session va til-yuklash middleware'laridan KEYIN ulaydi.
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext, SponsorChannel } from "./types";
import { getSponsorChannelsCached } from "./exchange-service";
import { recordFailOpenOutcome, recordChannelCheckOutcome } from "./fail-open-monitor";
import { mapWithConcurrency } from "./format";
import { TELEGRAM_BOT_INTERNAL_SECRET } from "./secret";

// Sponsor-kanallar ro'yxati kamdan-kam o'zgaradi — shu sabab har bir
// update uchun qayta murojaat qilish o'rniga getSponsorChannelsCached
// (exchange-service.ts) qisqa muddat keshlaydi.

// TUZATILDI (TELEGRAM API YUKLAMASI): avval bu darvoza HAR BIR update
// uchun sponsor kanallar sonicha getChatMember chaqirar edi (bu global,
// BARCHA botlar/foydalanuvchilar uchun umumiy Telegram flood-limitiga
// hisoblanadi). Endi foydalanuvchi obunasi tasdiqlangandan keyin
// GATE_PASS_TTL_MS davomida qayta tekshirilmaydi.
const GATE_PASS_TTL_MS = 5 * 60 * 1000;

// TUZATILDI (DRY — KOD TAKRORLANISHI): ilgari "gate o'tildi" keshi
// (Map<userId, expiresAt> + mark/clear/hasPassedRecently funksiyalari)
// shu faylda VA subscriber-bot/index.ts'da deyarli so'zma-so'z ikki marta
// yozilgan edi — ikkalasi ham bir xil TTL, bir xil tozalash intervali,
// bir xil mantiq bilan. Bitta joyda tuzatilganda ikkinchisi unutilib
// qolish xavfi bor edi. Endi bu bitta qayta ishlatiladigan klass orqali
// chiqarilgan — har bir bot (asosiy va "obunachi yig'ish") o'ziga xos,
// bir-biridan MUSTAQIL instansiya yaratadi (foydalanuvchi bittasida gate
// o'tishi ikkinchisiga ta'sir qilmasligi kerak, chunki har bot o'z
// kanallariga alohida admin bo'ladi — qarang: exchange-service.ts izohi).
export class GatePassCache {
  private cache = new Map<number, number>();

  constructor(private readonly ttlMs: number = GATE_PASS_TTL_MS) {
    setInterval(() => {
      const now = Date.now();
      for (const [userId, expiresAt] of this.cache) {
        if (expiresAt <= now) this.cache.delete(userId);
      }
    }, 5 * 60 * 1000).unref();
  }

  markPassed(userId: number): void {
    this.cache.set(userId, Date.now() + this.ttlMs);
  }

  clearPassed(userId: number): void {
    this.cache.delete(userId);
  }

  hasPassedRecently(userId: number): boolean {
    const until = this.cache.get(userId);
    return !!until && until > Date.now();
  }
}

// Asosiy botning global darvozasi (sponsorGateMiddleware) uchun ishlatiladigan
// standart instansiya — pastga qarang.
const sponsorGatePassedCache = new GatePassCache(GATE_PASS_TTL_MS);

export function markGatePassed(userId: number): void {
  sponsorGatePassedCache.markPassed(userId);
}

export function clearGatePassed(userId: number): void {
  sponsorGatePassedCache.clearPassed(userId);
}

function hasPassedGateRecently(userId: number): boolean {
  return sponsorGatePassedCache.hasPassedRecently(userId);
}

// TUZATILDI (TEZLIK): ilgari bu funksiya har bir sponsor kanal uchun
// `bot.api.getChatMember`ni KETMA-KET (`for...of` + `await`) chaqirar
// edi — kanallar soni ko'paysa, har bir foydalanuvchi update'i
// shunchalik sekinlashardi. Endi `mapWithConcurrency` (format.ts)
// yordamida bir vaqtning o'zida ko'pi bilan
// CHECK_SUBSCRIPTION_CONCURRENCY ta so'rov PARALLEL yuboriladi — bu
// Telegram'ning global flood-limitiga bexosdan urilib ketmaslik uchun
// ataylab cheklangan (butunlay cheksiz Promise.all emas). Xatoni
// qayta ishlash mantig'i (xato bo'lsa "obuna emas" deb hisoblash)
// o'zgarmadi.
//
// DRY: bu funksiya avval subscriber-bot/index.ts'da
// (`findNotSubscribedChannels` nomi bilan) so'zma-so'z qaytadan
// yozilgan edi. Endi ikkala bot ham shu YAGONA implementatsiyani
// import qilib ishlatadi.
export const CHECK_SUBSCRIPTION_CONCURRENCY = 5;

// TUZATILDI (ADMIN HECH QACHON BILMASDI): avval bitta sponsor kanal
// buzilib qolsa (noto'g'ri/o'chirilgan username, bot admin qilinmagan
// va h.k.), bu FAQAT server logiga yozilardi — hech kim kuzatib
// turmagani uchun, kanal HAQIQATDA tuzatilmaguncha BUTUN bot HAMMA
// foydalanuvchi uchun cheksiz vaqt bloklanib qolardi (majburiy obuna —
// har bir buyruq/xabardan oldin ishlaydi). Endi recordChannelCheckOutcome
// eskalatsiya bo'sag'asiga yetganda (fail-open-monitor.ts) shu funksiya
// orqali adminga TO'G'RIDAN-TO'G'RI Telegram xabari yuboriladi (server
// tomonidagi notifyAdminTelegram orqali — qarang: telegram-integration.ts
// "/sponsor-channels/report-issue"). Kanal AVTOMATIK o'chirilmaydi/
// nofaol qilinmaydi (sponsor kanallar odatda pullik reklama joylashuvi —
// buni faqat admin qo'lda hal qilishi kerak), faqat muammo haqida
// darhol xabardor qilinadi.
function reportBrokenSponsorChannel(channel: SponsorChannel): void {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return;
  fetch(`${appUrl}/api/telegram/sponsor-channels/report-issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
    body: JSON.stringify({
      channelId: channel.channelId,
      channelUsername: channel.channelUsername,
      displayName: channel.displayName
    })
  }).catch((err) => logger.warn({ err, channelId: channel.channelId }, "reportBrokenSponsorChannel: adminga xabar yuborib bo'lmadi"));
}

export async function checkSubscription(bot: Bot<MyContext>, channels: SponsorChannel[], userId: number): Promise<SponsorChannel[]> {
  const results = await mapWithConcurrency(channels, CHECK_SUBSCRIPTION_CONCURRENCY, async (channel): Promise<SponsorChannel | null> => {
    try {
      const member = await bot.api.getChatMember(channel.channelId, userId);
      // TUZATILDI (3-MASALA — "IKKI BOT ALOHIDA ADMIN BO'LISHI KERAK"
      // MO'RTLIGI): avval bitta kanalda bot admin bo'lmay qolgani
      // (masalan deploy'da unutilgani) sezilmasdan, cheksiz "jim
      // fail-open" bo'lib davom etardi — chunki xato faqat umumiy
      // logger.warn bilan yozilardi va boshqa kanallarning muvaffaqiyati
      // orasida ko'zga tashlanmasdi. Endi HAR BIR KANAL uchun alohida
      // ketma-ket muvaffaqiyat/muvaffaqiyatsizlik kuzatiladi — agar bitta
      // KONKRET kanalda bir necha marta ketma-ket xato chiqsa,
      // recordChannelCheckOutcome shu kanal ID'sini ko'rsatib
      // logger.error bilan ogohlantiradi VA adminga Telegram orqali
      // xabar yuboradi (qarang: fail-open-monitor.ts, yuqoridagi
      // reportBrokenSponsorChannel).
      recordChannelCheckOutcome("sponsor-gate", channel.channelId, true);
      const isSubscribed = ["member", "administrator", "creator"].includes(member.status);
      return isSubscribed ? null : channel;
    } catch (err: unknown) {
      const shouldAlertAdmin = recordChannelCheckOutcome("sponsor-gate", channel.channelId, false);
      logger.warn({ err, channelId: channel.channelId }, "getChatMember failed, treating as not subscribed");
      if (shouldAlertAdmin) reportBrokenSponsorChannel(channel);
      return channel;
    }
  });
  return results.filter((c): c is SponsorChannel => c !== null);
}

// DRY: darvoza inline-klaviaturasi ("kanalga qo'shilish" tugmalari +
// "✅ Tekshirish") ham ikkala botda deyarli bir xil edi — yagona farq
// "✅ Tekshirish" tugmasining callback_data qiymati (asosiy botda
// "check_subscription", "obunachi yig'ish" botida "sub_bot_check").
// Shu sabab bu qiymat endi parametr sifatida qabul qilinadi.
export function buildGateKeyboard(
  notSubscribed: SponsorChannel[],
  lang: Parameters<typeof t>[1],
  checkCallbackData: string
) {
  return {
    inline_keyboard: [
      ...notSubscribed.map((c) => [
        { text: t("sponsor_gate_join", lang, { channel: c.channelUsername }), url: `https://t.me/${c.channelUsername.replace("@", "")}` }
      ]),
      [{ text: t("sponsor_gate_check", lang), callback_data: checkCallbackData }]
    ]
  };
}

// Majburiy obuna EKRANI: obuna bo'lmagan kanallar ro'yxati + "✅ Tekshirish"
// tugmasi bilan chiqariladi.
export async function showSponsorGate(ctx: MyContext, notSubscribed: SponsorChannel[]): Promise<void> {
  const lang = ctx.session.language || "uz";
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: t("sponsor_gate_alert", lang),
      show_alert: true
    }).catch(() => {});
  }
  await ctx.reply(
    t("sponsor_gate_title", lang),
    {
      parse_mode: "HTML",
      reply_markup: buildGateKeyboard(notSubscribed, lang, "check_subscription")
    }
  ).catch(() => {
    // Foydalanuvchiga xabar yuborib bo'lmasa (bloklagan bo'lsa), jim o'tkazamiz.
  });
}

// 🛡️ GLOBAL DARVOZA: botning HAR QANDAY buyrug'i/tugmasi/xabaridan OLDIN
// ishga tushadi — shu sabab hech qaysi handler bu tekshiruvni chetlab
// o'ta olmaydi.
//
// Istisnolar:
// • "check_subscription" tugmasining o'zi — aks holda foydalanuvchi hech
//   qachon qayta tekshira olmay, cheksiz tsiklda qolib ketardi.
// • Inline so'rovlar — bunday so'rovlarga oddiy xabar (reply) yuborib
//   bo'lmaydi, shu sabab bu yerda bloklanmaydi (ctx.chat mavjud emasligi
//   orqali avtomatik ajratiladi).
export function sponsorGateMiddleware(bot: Bot<MyContext>) {
  return async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
    if (!ctx.chat || !ctx.from) return next();
    if (ctx.callbackQuery?.data === "check_subscription") return next();

    if (hasPassedGateRecently(ctx.from.id)) return next();

    try {
      const channels = await getSponsorChannelsCached();
      if (channels === null) {
        // FAIL-OPEN: tekshiruv o'zi ishlamasa, botni butunlay bloklab
        // qo'ymaymiz. KETMA-KET necha marta takrorlanayotgani
        // recordFailOpenOutcome orqali kuzatiladi — uzoq davom etsa,
        // log darajasi avtomatik logger.error'ga ko'tariladi (qarang:
        // fail-open-monitor.ts).
        recordFailOpenOutcome("sponsor-gate", false, { reason: "sponsor-channels fetch failed" });
        return next();
      }
      recordFailOpenOutcome("sponsor-gate", true);
      if (!Array.isArray(channels) || channels.length === 0) return next();

      const notSubscribed = await checkSubscription(bot, channels, ctx.from.id);
      if (notSubscribed.length === 0) {
        markGatePassed(ctx.from.id);
        return next();
      }

      clearGatePassed(ctx.from.id);
      await showSponsorGate(ctx, notSubscribed);
      // return qilinmaydi (next() chaqirilmaydi) — shu bilan asosiy handler
      // ISHGA TUSHMAYDI, foydalanuvchi obuna bo'lmaguncha hech narsa ko'rmaydi.
    } catch (err: unknown) {
      recordFailOpenOutcome("sponsor-gate", false, { err });
      logger.error({ err }, "Majburiy obuna darvozasi xatosi (fail-open: davom etiladi)");
      return next();
    }
  };
}
