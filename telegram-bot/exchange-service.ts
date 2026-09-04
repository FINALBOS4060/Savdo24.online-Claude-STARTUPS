// "Obunachi almashish" (exchange) bo'limining server bilan gaplashadigan
// biznes-mantig'i: keshlangan konfiguratsiya/statistika o'qishlari va
// qoida-bajarilishini tekshirish. `bot` parametr sifatida uzatiladi
// (Telegram API chaqiruvlari uchun) — bu modul bot instansiyasini o'zi
// yaratmaydi, shu sabab index.ts'dagi async token-yuklash bilan bog'liq
// muammolardan mustaqil.
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t, Lang, getUserLanguage } from "./i18n";
import { MyContext, SponsorChannel } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET, trackBotEvent } from "./secret";
import { recordChannelCheckOutcome, recordChannelHealthOutcome } from "./fail-open-monitor";
import { backToMenuKeyboard, exchangeMenuKeyboard, exchangePanelKeyboard } from "./keyboards";
import { escapeHtml, exchangeRuleText, mapWithConcurrency, parseChannelLinkToUsername } from "./format";

export let sponsorChannelsCache: { data: SponsorChannel[]; expiresAt: number } | null = null;

export async function getSponsorChannelsCached(): Promise<SponsorChannel[] | null> {
  if (sponsorChannelsCache && sponsorChannelsCache.expiresAt > Date.now()) {
    return sponsorChannelsCache.data;
  }
  const res = await fetch(`${process.env.APP_URL}/api/telegram/sponsor-channels`, {
    headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
  });
  if (!res.ok) return null; // eski kesh bo'lsa ham shu yerda qaytarilmaydi — chaqiruvchi fail-open qiladi
  const data: SponsorChannel[] = await res.json();
  sponsorChannelsCache = { data, expiresAt: Date.now() + 60 * 1000 };
  return data;
}

export let exchangeBonusConfigCache: { referralBonus: number; welcomeBonus: number; subscriberMultiplier: number; expiresAt: number } | null = null;

export async function getExchangeBonusConfigCached(): Promise<{ referralBonus: number; welcomeBonus: number; subscriberMultiplier: number }> {
  if (exchangeBonusConfigCache && exchangeBonusConfigCache.expiresAt > Date.now()) {
    return exchangeBonusConfigCache;
  }
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/bonus-config`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    if (!res.ok) throw new Error(`bonus-config request failed: ${res.status}`);
    const data = await res.json();
    const referralBonus = Number.isFinite(data.referralBonus) ? data.referralBonus : 5;
    // TUZATILDI: "xush kelibsiz" bonusi standart qiymati serverdagi
    // DEFAULT_EXCHANGE_WELCOME_BONUS (exchange-channels.ts) bilan bir xil
    // bo'lishi kerak — foydalanuvchi talabi bo'yicha 5'dan 20'ga oshirildi.
    // Bu yerdagi qiymat FAQAT /api/telegram/exchange/bonus-config so'rovi
    // muvaffaqiyatsiz bo'lganda ishlatiladigan fallback, shu sabab
    // ikkalasi sinxron turishi muhim (aks holda tarmoq uzilganda bot
    // noto'g'ri "5 ta" deb ko'rsatib qo'yishi mumkin edi).
    const welcomeBonus = Number.isFinite(data.welcomeBonus) ? data.welcomeBonus : 20;
    const subscriberMultiplier = Number.isFinite(data.subscriberMultiplier) ? data.subscriberMultiplier : 2;
    exchangeBonusConfigCache = { referralBonus, welcomeBonus, subscriberMultiplier, expiresAt: Date.now() + 60 * 60 * 1000 };
    return exchangeBonusConfigCache;
  } catch (err) {
    logger.warn({ err }, "exchange bonus-config fetch failed — fallback qiymatlar (5/20/2) ishlatiladi");
    // Eski kesh bo'lsa ham shuni qaytaramiz (fallback "5/20/2"dan ko'ra
    // ko'proq ishonchli) — faqat umuman hech qachon muvaffaqiyatli
    // bo'lmagan bo'lsa, qattiq-kodlangan standart qiymatga tushamiz.
    return exchangeBonusConfigCache || { referralBonus: 5, welcomeBonus: 20, subscriberMultiplier: 2 };
  }
}

export let exchangeLiveStatsCache: { subscriptionsToday: number; expiresAt: number } | null = null;

export async function getExchangeLiveStatsLine(lang: Lang): Promise<string> {
  try {
    if (!exchangeLiveStatsCache || exchangeLiveStatsCache.expiresAt <= Date.now()) {
      const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/live-stats`, {
        headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
      });
      if (!res.ok) throw new Error(`live-stats request failed: ${res.status}`);
      const data = await res.json();
      const subscriptionsToday = Number.isFinite(data.subscriptionsToday) ? data.subscriptionsToday : 0;
      exchangeLiveStatsCache = { subscriptionsToday, expiresAt: Date.now() + 3 * 60 * 1000 };
    }
    // Son 0 bo'lsa (masalan kunning juda erta soatlarida) ijtimoiy isbot
    // o'rniga aksincha ta'sir qiladi ("hech kim qilmayapti" degan taassurot
    // beradi) — shu sabab bunday holatda satr umuman ko'rsatilmaydi.
    if (exchangeLiveStatsCache.subscriptionsToday <= 0) return "";
    return t("ex_live_stats_line", lang, { count: String(exchangeLiveStatsCache.subscriptionsToday) });
  } catch (err) {
    logger.warn({ err }, "exchange live-stats fetch failed — statistikasiz davom etilmoqda");
    return "";
  }
}

// TUZATILDI (TEZLIK — NOMUVOFIQLIK): avval bu funksiya har bir obuna
// uchun `bot.api.getChatMember`ni KETMA-KET (`for...of` + `await`)
// chaqirar edi, orasida esa qattiq kodlangan 150ms kutish bor edi —
// foydalanuvchida ko'p (masalan 20 ta) obuna bo'lsa, bu bir necha
// soniyalik sun'iy kechikish degani edi. Bu xuddi shu turdagi muammo
// sponsor-gate.ts'dagi `checkSubscription`da ALLAQACHON `mapWithConcurrency`
// bilan tuzatilgan, ammo shu yerga qo'llanilmagan edi. Endi bu yerda ham
// bir vaqtning o'zida ko'pi bilan ENFORCE_RULES_CONCURRENCY ta so'rov
// PARALLEL yuboriladi (Telegram flood-limitiga bexosdan urilib
// ketmaslik uchun ataylab cheklangan, boshqa joylardagi bilan bir xil
// naqsh) — natijada javob vaqti obunalar soniga chiziqli emas, balki
// concurrency darajasiga qarab qisqaradi. Xatoni qayta ishlash mantig'i
// ("holat noma'lum — jazolamaymiz") o'zgarmadi.
const ENFORCE_RULES_CONCURRENCY = 5;

// TUZATILDI (foydalanuvchi talabi — skrinshot bilan: "chiqib ketgan
// kanalning manzili/linki ko'rsatilmas ekan"): avval "qaytadan obuna
// bo'lish" tugmasi FAQAT kanalda OCHIQ @username bo'lsagina chiqardi —
// yopiq (private) kanallarda (ko'pchilik "Obunachi yig'ish"ga forward
// orqali qo'shilgan kanal xuddi shunday) username yo'q, shu sabab
// tugma UMUMAN ko'rinmas, foydalanuvchi qaysi kanaldan chiqib
// ketganini bilsa ham qaytib obuna bo'lolmas edi. Endi: agar ochiq
// username bo'lmasa, bot (kanalda ALLAQACHON admin bo'lgani uchun —
// bu shart exchange-kanal sifatida ro'yxatdan o'tishning o'zida
// tekshiriladi) `exportChatInviteLink` orqali taklif havolasini
// o'zi yaratishga urinadi. Bot uchun bu ruxsat yo'q/xatolik chiqsa
// (masalan "can_invite_users" huquqi berilmagan bo'lsa), shunchaki
// `null` qaytariladi va tugma avvalgidek ko'rsatilmaydi — hech qanday
// yangi xatolik holati qo'shilmaydi, faqat qo'shimcha imkoniyat.
export async function resolveChannelJoinLink(bot: Bot<MyContext>, channelId: string, channelUsername?: string | null): Promise<string | null> {
  if (channelUsername) {
    return `https://t.me/${String(channelUsername).replace("@", "")}`;
  }
  try {
    const link = await bot.api.exportChatInviteLink(channelId);
    return link || null;
  } catch (err) {
    logger.warn({ err, channelId }, "resolveChannelJoinLink: yopiq kanal uchun taklif havolasini yaratib bo'lmadi");
    return null;
  }
}

export async function enforceExchangeRules(bot: Bot<MyContext>, userId: number) {
  const secretHeader = { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET };

  const subsRes = await fetch(`${process.env.APP_URL}/api/telegram/exchange/my-subscriptions/${userId}`, { headers: secretHeader });
  if (!subsRes.ok) {
    const errBody = await subsRes.text().catch(() => "");
    logger.error({ status: subsRes.status, body: errBody }, "exchange my-subscriptions request failed");
    throw new Error(`my-subscriptions failed: ${subsRes.status}`);
  }
  const subs = await subsRes.json();

  // TUZATILDI: `channelId` (Telegram chat ID) endi natijaga ham
  // qo'shib qo'yiladi — pastda "qaytadan obuna bo'lish" havolasini
  // (yopiq kanal uchun exportChatInviteLink orqali) yaratish uchun
  // shu ID kerak bo'ladi (ilgari faqat exchangeChannelId — bazadagi
  // ID — saqlanardi, Telegram chat ID esa tashlab yuborilardi).
  type ExchangeCheckResult = { exchangeChannelId: string; channelId: string; isMember: boolean; channelTitle: string; channelUsername: string };

  const checked = await mapWithConcurrency(subs, ENFORCE_RULES_CONCURRENCY, async (s): Promise<ExchangeCheckResult | null> => {
    try {
      const member = await bot.api.getChatMember(s.channelId, userId);
      // 3-MASALA: bu yerda ham (sponsor-gate.ts'dagi checkSubscription
      // bilan bir xil sabab uchun) har bir exchange-kanal alohida
      // kuzatiladi — shu bilan bitta kanalda bot admin bo'lmay qolgani
      // boshqa kanallarning muvaffaqiyati orasida "cho'kib" ketmaydi.
      recordChannelCheckOutcome("exchange-subscription", s.channelId, true);
      const isMember = ["member", "administrator", "creator"].includes(member.status);
      return { exchangeChannelId: s.exchangeChannelId, channelId: String(s.channelId), isMember, channelTitle: s.title, channelUsername: s.channelUsername };
    } catch (err) {
      // Holatni ANIQLAB BO'LMADI — bu holatni "chiqib ketgan" deb talqin
      // qilmaymiz, shunchaki bu obunani shu safar tekshiruvdan chetlab
      // o'tamiz (oldingi saqlangan holat o'zgarmay qoladi).
      recordChannelCheckOutcome("exchange-subscription", s.channelId, false);
      logger.warn({ err, channelId: s.channelId }, "exchange getChatMember failed — holat noma'lum, jazolanmaydi");
      return null;
    }
  });
  const results = checked.filter((r): r is ExchangeCheckResult => r !== null);

  if (results.length === 0) {
    return { lapsed: [], lapsedDetails: [], suspendedChannels: [], reactivatedChannels: [] };
  }

  const reportRes = await fetch(`${process.env.APP_URL}/api/telegram/exchange/report-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...secretHeader },
    body: JSON.stringify({ telegramUserId: userId, results })
  });
  if (!reportRes.ok) {
    const errBody = await reportRes.text().catch(() => "");
    logger.error({ status: reportRes.status, body: errBody }, "exchange report-check request failed");
    throw new Error(`report-check failed: ${reportRes.status}`);
  }
  const report = await reportRes.json();

  // Server faqat nom (string) qaytaradi — qaytadan obuna bo'lish tugmasi
  // uchun link kerak bo'lganda shu yerdagi `results`dan (channelUsername
  // bilan) foydalanamiz. Ochiq username bo'lmasa (yopiq/private kanal),
  // resolveChannelJoinLink o'zi taklif havolasini yaratishga urinadi —
  // shu sabab BU YERDA HAM (sponsor-gate.ts'dagi kabi) cheklangan
  // parallellik bilan bajariladi, ketma-ket emas.
  const lapsedResults = results.filter((r) => !r.isMember);
  const lapsedDetails = await mapWithConcurrency(lapsedResults, ENFORCE_RULES_CONCURRENCY, async (r) => ({
    title: r.channelTitle,
    channelUsername: r.channelUsername,
    link: await resolveChannelJoinLink(bot, r.channelId, r.channelUsername)
  }));

  return { ...report, lapsedDetails };
}

export async function submitExchangeChannelReport(ctx: MyContext, exchangeChannelId: string, reason: string) {
  const lang = ctx.session.language || "uz";
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/report-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
      body: JSON.stringify({ reporterTelegramId: ctx.from!.id, exchangeChannelId, reason })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await ctx.reply(`❌ ${data.error || t("generic_error", lang)}`, { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "submitExchangeChannelReport: ctx.reply yuborishda xato"));
      return;
    }
    if (data.alreadyReported) {
      await ctx.reply(t("ex_report_already_sent", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "submitExchangeChannelReport: ctx.reply yuborishda xato"));
      return;
    }
    trackBotEvent("bot_exchange_channel_reported", ctx.from?.id);
    await ctx.reply(t("ex_report_success", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "submitExchangeChannelReport: ctx.reply yuborishda xato"));
  } catch (err: unknown) {
    logger.error({ err }, "exchange report-channel submit error");
    await ctx.reply(t("generic_error", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "submitExchangeChannelReport: ctx.reply yuborishda xato"));
  }
}


// TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
// botining bir-biriga aloqasi bo'lmasligi kerak"): avval bu yerda IKKI
// bot (asosiy + subscriber) alohida-alohida tekshirilardi, chunki
// exchange bo'limi ikkalasida ham ishlab, kanal QAYSI bot orqali
// qo'shilganiga qarab turli bot admin bo'lishi mumkin edi. Endi
// "Obunachi yig'ish" FAQAT shu (subscriber) botda ishlaydi — bu funksiya
// endi shu funksiyaga uzatilgan `bot` (har doim subscriber bot instance)
// ning O'ZI shu kanalda admin ekanligini tekshiradi, xolos. Ikkinchi
// bot bilan tekshirish endi kerak emas — chunki kanal endi FAQAT shu
// bot orqali qo'shiladi/admin qilinadi.
async function hasBotAdminAccess(bot: Bot<MyContext>, channelId: string): Promise<boolean> {
  try {
    const member = await bot.api.getChatMember(channelId, bot.botInfo.id);
    return ["administrator", "creator"].includes(member.status);
  } catch (err) {
    return false;
  }
}

export async function checkExchangeChannelHealth(bot: Bot<MyContext>) {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/active-channels-health`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    // TUZATILDI (izchillik, xuddi shu fayldagi boshqa cron-fetch
    // joylari bilan bir xil naqsh): res.ok tekshiruvi qo'shildi.
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.error({ status: res.status, body: errBody }, "exchange active-channels-health request failed");
      return;
    }
    const channels: { id: number; channelId: string; title: string; ownerTelegramId: string }[] = await res.json();

    for (const c of channels) {
      const hasAccess = await hasBotAdminAccess(bot, c.channelId);
      const lostAccess = !hasAccess;

      // TUZATILDI: ilgari shu yerda BITTA muvaffaqiyatsiz getChatMember
      // chaqiruvidanoq (hatto oddiy tarmoq uzilishi/timeout bo'lsa ham)
      // kanal DOIMIY ravishda isActive=false qilinardi. Bu vaqtinchalik
      // tarmoq xatosini haqiqiy "bot admin emas" holati bilan aralashtirib
      // yuborardi va kanal egasi hech nima qilmagan bo'lsa ham kanal
      // navbatdan chiqib ketardi. Endi recordChannelHealthOutcome orqali
      // FAQAT bir necha marta KETMA-KET muvaffaqiyatsiz bo'lgandagina
      // (barqaror holat, lahzalik xato emas) haqiqatan o'chiriladi —
      // muvaffaqiyatli chaqiruv hisoblagichni darhol tozalaydi.
      const shouldDeactivate = recordChannelHealthOutcome(c.channelId, !lostAccess);

      if (shouldDeactivate) {
        try {
          await fetch(`${process.env.APP_URL}/api/telegram/exchange/deactivate-channel`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
            body: JSON.stringify({ id: c.id, reason: "Bot kanalda admin huquqini yo'qotdi yoki kanal topilmadi." })
          });
          // TUZATILDI (UNIVERSALLIK): xuddi yuqoridagi obuna-tashlab-ketish
          // bildirishnomasi kabi, bu ham foydalanuvchi tilidan qat'iy nazar
          // doim o'zbekcha yuborilardi.
          const lang = await getUserLanguage(c.ownerTelegramId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
          await bot.api.sendMessage(
            c.ownerTelegramId,
            t("ex_channel_lost_access", lang, { title: escapeHtml(c.title) }),
            // TUZATILDI: bu yerda (davriy cron job ichida) foydalanuvchining
            // Telegram ctx'i UMUMAN mavjud emas — oldin shu yerda
            // exchangeMenuKeyboard(ctx) chaqirilardi, lekin `ctx` aniqlanmagan
            // o'zgaruvchi bo'lgani sabab bu HAR DOIM ReferenceError tashlardi
            // (pastdagi catch uni jimgina "yuborilmadi" deb yutib yuborardi —
            // ya'ni kanal egasi hech qachon xabar OLMASDI, garchi kanal DB'da
            // to'g'ri o'chirilgan bo'lsa ham). Statik tugma bilan almashtirildi.
            { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: t("back_to_menu", lang), callback_data: "menu_home" }]] } }
          ).catch((err) => logger.warn({ err, ownerTelegramId: c.ownerTelegramId }, "Exchange dead-channel notify failed"));
        } catch (err) {
          logger.warn({ err, channelId: c.id }, "Exchange deactivate-channel call failed");
        }
      }
      // Telegram API cheklovlariga hurmat yuzasidan har kanal orasida
      // qisqa tanaffus
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (err) {
    logger.error({ err }, "Exchange channel health check failed");
  }
}


// YANGI (foydalanuvchi talabi — "kanallar DOIM navbatda turishi kerak"):
// TUZATISH TARIXI — avval kredit olganda kanal isActive=false qilinar
// edi, keyin buni "har 3 soatda avtomatik tikla" bilan yumshatishga
// urinildi. Foydalanuvchi buni ham istamadi ("navbatdan chiqmasligi
// kerak, yumshatish emas"), shu sabab exchange-channels.ts'dagi asosiy
// mantiq o'zgartirildi: kredit olish ENDI kanalni UMUMAN navbatdan
// chiqarmaydi. Bu funksiya endi faqat MUROSA/TOZALASH vazifasini
// bajaradi — ushbu tuzatishdan OLDIN allaqachon suspendedDueToCreditEarned=true
// bilan bazada qolib ketgan (eski) kanallarni bir martalik tarzda
// qayta navbatga qaytaradi. Yangi kanal bu holatga umuman tushmaydi,
// shu sabab vaqt o'tishi bilan bu funksiya hech narsa topmay bo'sh
// ishlab turadi — shunchaki xavfsizlik uchun cron-jobs.ts'da qoldirilgan.
// YANGI (foydalanuvchi talabi — "kanallar navbatdan o'chib qolyapti"
// bugi ILDIZIDAN tuzatildi, keyinroq esa "asosiy bot bilan bu botning
// aloqasi bo'lmasligi kerak" talabiga ko'ra soddalashtirildi):
// checkExchangeChannelHealth ilgari FAQAT asosiy botning admin holatini
// tekshirardi — agar kanal subscriber bot orqali qo'shilib, faqat O'SHA
// bot admin qilingan bo'lsa, bu tekshiruv har doim "admin emas" deb
// noto'g'ri xulosaga kelib, SOG'LOM kanalni ham NOFAOL qilib qo'yardi.
// Vaqtinchalik yechim sifatida ikkala botni tekshirish qo'shilgan edi,
// keyin esa "Obunachi yig'ish" bo'limi butunlay subscriber botga
// ko'chirilgani sabab bu ikkinchi tekshiruv kerak bo'lmay qoldi (qarang:
// hasBotAdminAccess). Bu funksiya endi FAQAT o'sha davrda (ikkala bot
// tekshirilmagan paytda) noto'g'ri NOFAOL qilib qo'yilgan ESKI
// yozuvlarni bir martalik tarzda tuzatish uchun qoldirilgan — ular
// haqiqatan subscriber bot admin ekanini tasdiqlasa, qayta navbatga
// qaytariladi. cron-jobs.ts'da har 3 soatda chaqiriladi.
export async function reactivateLostAccessChannels(bot: Bot<MyContext>): Promise<void> {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/lost-access-channels`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.error({ status: res.status, body: errBody }, "exchange lost-access-channels request failed");
      return;
    }
    const channels: { id: number; channelId: string; title: string; ownerTelegramId: string }[] = await res.json();
    if (channels.length === 0) return;

    const verifiedIds: number[] = [];
    const verifiedByOwner = new Map<string, string[]>();
    for (const c of channels) {
      const hasAccess = await hasBotAdminAccess(bot, c.channelId);
      if (hasAccess) {
        verifiedIds.push(c.id);
        const list = verifiedByOwner.get(c.ownerTelegramId) || [];
        list.push(c.title);
        verifiedByOwner.set(c.ownerTelegramId, list);
      }
      // Telegram API cheklovlariga hurmat yuzasidan har kanal orasida
      // qisqa tanaffus
      await new Promise((r) => setTimeout(r, 200));
    }

    if (verifiedIds.length === 0) return;

    const reactivateRes = await fetch(`${process.env.APP_URL}/api/telegram/exchange/reactivate-verified-channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
      body: JSON.stringify({ ids: verifiedIds })
    });
    if (!reactivateRes.ok) {
      const errBody = await reactivateRes.text().catch(() => "");
      logger.error({ status: reactivateRes.status, body: errBody }, "exchange reactivate-verified-channels request failed");
      return;
    }

    for (const [ownerTelegramId, titles] of verifiedByOwner) {
      try {
        const lang = await getUserLanguage(ownerTelegramId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
        await bot.api.sendMessage(
          ownerTelegramId,
          t("ex_credit_reactivated_notice", lang, { names: escapeHtml(titles.join(", ")) }),
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: t("back_to_menu", lang), callback_data: "menu_home" }]] } }
        ).catch((err) => logger.warn({ err, ownerTelegramId }, "Exchange lost-access-reactivate notify failed"));
      } catch (err) {
        logger.warn({ err, ownerTelegramId }, "Exchange lost-access-reactivate notify failed (lang lookup)");
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err) {
    logger.error({ err }, "Exchange reactivate-lost-access job failed");
  }
}

export async function reactivateCreditSuspendedChannels(bot: Bot<MyContext>): Promise<void> {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/reactivate-credit-suspended`, {
      method: "POST",
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.error({ status: res.status, body: errBody }, "exchange reactivate-credit-suspended request failed");
      return;
    }
    const { reactivated }: { reactivated: { id: number; title: string; ownerTelegramId: string }[] } = await res.json();
    if (!reactivated || reactivated.length === 0) return;

    // Bir foydalanuvchining bir nechta kanali bo'lishi mumkin — har biriga
    // alohida xabar yubormaslik uchun egasi bo'yicha guruhlanadi.
    const byOwner = new Map<string, string[]>();
    for (const c of reactivated) {
      const list = byOwner.get(c.ownerTelegramId) || [];
      list.push(c.title);
      byOwner.set(c.ownerTelegramId, list);
    }

    for (const [ownerTelegramId, titles] of byOwner) {
      try {
        const lang = await getUserLanguage(ownerTelegramId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
        await bot.api.sendMessage(
          ownerTelegramId,
          t("ex_credit_reactivated_notice", lang, { names: escapeHtml(titles.join(", ")) }),
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: t("back_to_menu", lang), callback_data: "menu_home" }]] } }
        ).catch((err) => logger.warn({ err, ownerTelegramId }, "Exchange credit-reactivate notify failed"));
      } catch (err) {
        logger.warn({ err, ownerTelegramId }, "Exchange credit-reactivate notify failed (lang lookup)");
      }
      // Telegram API cheklovlariga hurmat yuzasidan har foydalanuvchi
      // orasida qisqa tanaffus
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err) {
    logger.error({ err }, "Exchange reactivate-credit-suspended job failed");
  }
}

// YANGI (foydalanuvchi talabi — "botga yangi foydalanuvchi qo'shilganida,
// hali unga obuna bo'lmagan boshqalarga xabar borsin"): yaqinda navbatga
// qo'shilgan kanallarni serverdan so'rab, hali obuna bo'lmagan faol
// ishtirokchilarga "yangi kanal qo'shildi, obuna bo'lib ball oling"
// bildirishnomasini yuboradi. cron-jobs.ts'da davriy chaqiriladi.
export async function announceNewExchangeChannels(bot: Bot<MyContext>): Promise<void> {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/new-channel-announcements`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.error({ status: res.status, body: errBody }, "exchange new-channel-announcements request failed");
      return;
    }
    const announcements: {
      id: number;
      title: string;
      channelId: string;
      channelUsername: string | null;
      recipientTelegramIds: string[];
    }[] = await res.json();
    if (!announcements || announcements.length === 0) return;

    const { subscriberMultiplier } = await getExchangeBonusConfigCached();

    for (const ch of announcements) {
      const link = await resolveChannelJoinLink(bot, ch.channelId, ch.channelUsername);
      for (const recipientTelegramId of ch.recipientTelegramIds) {
        try {
          const lang = await getUserLanguage(recipientTelegramId, process.env.APP_URL || "", TELEGRAM_BOT_INTERNAL_SECRET);
          const buttons: any[] = link
            ? [[{ text: t("exchange_subscribe_btn", lang), url: link }]]
            : [[{ text: t("exchange_subscribe_btn", lang), callback_data: "ex_browse" }]];
          buttons.push([{ text: t("back_to_menu", lang), callback_data: "menu_home" }]);
          await bot.api.sendMessage(
            recipientTelegramId,
            t("ex_new_channel_announcement", lang, { title: escapeHtml(ch.title), multiplier: String(subscriberMultiplier) }),
            { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } }
          ).catch((err) => logger.warn({ err, recipientTelegramId }, "Exchange new-channel announce notify failed"));
        } catch (err) {
          logger.warn({ err, recipientTelegramId }, "Exchange new-channel announce notify failed (lang lookup)");
        }
        // Telegram API cheklovlariga hurmat yuzasidan har xabar orasida
        // qisqa tanaffus
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  } catch (err) {
    logger.error({ err }, "Exchange new-channel announcement job failed");
  }
}

// TUZATILDI (✨ faqat kerak paytda kerakli joyda): asosiy "Obunachi
// yig'ish" ekranidagi "➕ Kanalimni qo'shish" tugmasi foydalanuvchining
// HOZIRGI holatidan qat'i nazar doim ko'rsatilardi — hatto uning kanali
// allaqachon navbatda (isActive=true) turgan bo'lsa ham, bu esa
// chalkashtiruvchi edi (yana bosish shart emasligi aniq emas edi). Endi
// shu funksiya orqali foydalanuvchining kamida bitta FAOL (navbatdagi)
// kanali bor-yo'qligi tekshiriladi — bor bo'lsa tugma yashiriladi.
// `ex_mychannels` bilan BIR XIL /my-channels endpoint qayta ishlatiladi
// (nusxa ko'chirilmagan), xato bo'lsa xavfsiz tomonga (false — tugma
// ko'rsatiladi) qaytariladi, chunki noto'g'ri yashirishdan ko'ra
// keraksiz ko'rsatish zararsizroq.
export async function hasActiveExchangeChannel(telegramUserId: number): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/my-channels/${telegramUserId}`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    if (!res.ok) return false;
    const channels = await res.json();
    if (!Array.isArray(channels)) return false;
    return channels.some((c: { isActive?: boolean }) => c.isActive === true);
  } catch (err) {
    logger.warn({ err, telegramUserId }, "hasActiveExchangeChannel: tekshirishda xato — tugma xavfsiz tomonga (ko'rsatiladi) qoldirildi");
    return false;
  }
}

// TUZATILDI (foydalanuvchi talabi — "obuna bo'lishdan oldin O'Z kanalini
// ulash SHART"): "hasActiveExchangeChannel" (yuqorida) faqat NAVBATDA turgan
// (isActive=true) kanal bor-yo'qligini tekshiradi — bu "➕ Kanalimni qo'shish"
// tugmasini yashirish/ko'rsatish uchun yetarli edi. Lekin bu yerda maqsad
// boshqa: foydalanuvchi UMUMAN hech qachon botga birorta ham kanal
// ulamaganmi (hatto vaqtincha to'xtatilgan/suspended kanal ham sanaladi —
// chunki u ALLAQACHON bir marta ulagan, faqat hozir faol emas). Shu sabab
// alohida, kengroq tekshiruv kerak.
export async function hasAnyExchangeChannel(telegramUserId: number): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/my-channels/${telegramUserId}`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    // TUZATILDI (fail-safe yo'nalishi): bu yerda xato "kanal yo'q" deb emas,
    // "kanal bor" deb hisoblanadi — aks holda server/tarmoq xatosi
    // foydalanuvchini asossiz ravishda "obuna bo'lish" bo'limidan
    // to'xtatib qo'yardi (noto'g'ri bloklashdan ko'ra keraksiz o'tkazish
    // zararsizroq — xuddi sponsor-gate.ts'dagi fail-open mantig'i kabi).
    if (!res.ok) return true;
    const channels = await res.json();
    if (!Array.isArray(channels)) return true;
    return channels.length > 0;
  } catch (err) {
    logger.warn({ err, telegramUserId }, "hasAnyExchangeChannel: tekshirishda xato — fail-open (bor deb hisoblanadi)");
    return true;
  }
}

// YANGI (foydalanuvchi talabi — asosiy menyu tepasidagi "➕ Kanalimni
// qo'shish" ogohlantirish tugmasi): mainMenuKeyboard() endi bu tugmani
// ko'rsatish-ko'rsatmaslikni bilishi kerak, lekin keyboards.ts bu faylni
// (exchange-service.ts) import qila olmaydi — aylanma import bo'lib
// qoladi (bu fayl allaqachon keyboards.ts'ni import qiladi). Shu sabab
// tekshiruv shu yerda, yagona joyda qilinadi va chaqiruvchi tomon (har bir
// mainMenuKeyboard(ctx) chaqirilgan joy) natijani oldindan hisoblab, oddiy
// boolean sifatida uzatadi.
export async function mainMenuKeyboardOptions(ctx: MyContext): Promise<{ showAddChannelWarning: boolean }> {
  const showAddChannelWarning = ctx.from ? !(await hasAnyExchangeChannel(ctx.from.id)) : false;
  return { showAddChannelWarning };
}

// TUZATILDI (foydalanuvchi talabi, ko'chirildi handlers-exchange.ts'dan):
// "➕ Kanalimni qo'shish" ko'rsatmasi endi shu yerda — shunda uni
// handleMenuExchange PASTDAGI yangi darvoza uchun ham, handlers-exchange.ts
// o'zining "ex_add" tugmasi uchun ham (nusxa ko'chirmasdan) qayta
// ishlatadi.
// TUZATILDI (foydalanuvchi talabi — pastki panel almashtirilishi kerak):
// `useReplyPanel=true` bo'lganda (faqat subscriber-bot shunday chaqiradi)
// inline "🔙 Bosh menyu" o'rniga PASTKI reply-klaviatura (exchangePanelKeyboard,
// "Kanalimni qo'shish" tugmasi yashirilgan holda — foydalanuvchi allaqachon
// aynan shu amal ichida turibdi) yuboriladi. Bu xabar Telegramning eski
// (asosiy) pastki panelini avtomatik almashtiradi — alohida "olib
// tashlash" chaqiruvi shart emas.
export async function showExchangeAddChannelPrompt(ctx: MyContext, useReplyPanel: boolean = false): Promise<void> {
  ctx.session.awaitingExchangeChannel = true;
  const lang = ctx.session.language || "uz";
  const { welcomeBonus } = await getExchangeBonusConfigCached();
  const reply_markup = useReplyPanel ? exchangePanelKeyboard(lang, { hideAddChannel: true }) : backToMenuKeyboard(ctx);
  if (useReplyPanel && ctx.session) ctx.session.subscriberBotPanelMode = "exchange";
  await ctx.reply(t("ex_add_instructions", lang, { welcomeBonus }), { parse_mode: "HTML", reply_markup }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "showExchangeAddChannelPrompt: ctx.reply yuborishda xato"));
}

// KO'CHIRILDI (avval handlers-exchange.ts'da edi, ex_browse callback'i
// ichida to'g'ridan-to'g'ri yozilgan edi): endi shu yerda, servis
// qatlamida — chunki pastdagi handleMenuExchange endi buni TO'G'RIDAN-
// TO'G'RI chaqiradi ("Obunachi yig'ish" tugmasi ENDI "Kanallarga obuna
// bo'lish"ning ishini ham bajaradi, foydalanuvchi talabi). Servis
// qatlami (exchange-service.ts) chaqiruvchi/handler qatlamini
// (handlers-exchange.ts) import qilmasligi kerak (aylanma import bo'lib
// qolmasligi uchun) — shu sabab funksiya shu yo'nalishda ko'chirildi,
// handlers-exchange.ts endi buni shu yerdan qayta eksport qiladi. Dinamik
// subscriberMultiplier (getExchangeBonusConfigCached/exchangeRuleText)
// mantig'i O'ZGARISHSIZ saqlab qolindi — faqat joyi va pastdagi
// tugmalar/pagination o'zgardi.
// TUZATILDI (foydalanuvchi talabi — "obunachi yig'ish" boti, skrinshot
// bilan): shu funksiya ro'yxat OSTIGA exchangeMenuKeyboard() qatorlarini
// (Kanalimni qo'shish, Mening kanallarim, Reyting, Do'stlarni taklif,
// Qoida va bonuslar, Bosh menyu) INLINE tugma sifatida qo'shib kelardi.
// Asosiy botda bu kerak (boshqa joyda bu amallarga yo'l yo'q), LEKIN
// subscriber-bot/index.ts o'sha AYNAN SHU tugmalarni pastki
// reply-klaviatura (exchangePanelKeyboard) sifatida ALLAQACHON alohida
// xabar bilan yuboradi — natijada foydalanuvchi bir xil 6 ta amalni ikki
// marta (bir marta inline, bir marta pastki panelda) ko'rardi.
// `includeMenuActions=false` shu takrorlanishni oldini oladi — subscriber-bot
// endi shu bayroqni `false` qilib chaqiradi (pastga qarang), asosiy bot esa
// hech narsa o'zgartirmay standart `true` bilan ishlayveradi.
// TUZATILDI (foydalanuvchi talabi — skrinshot bilan: "Obunachi yig'ish"
// bosilganda ASOSIY pastki panel (Profil/Report/Til/...) o'rniga shu
// bo'lim tugmalari turishi kerak, faqat inline qo'shimcha sifatida emas):
// `useReplyPanel=true` bo'lganda (faqat subscriber-bot shunday chaqiradi)
// quyidagi "kanal yo'q"/"o'chirilgan"/"xatolik" xabarlariga inline
// exchangeMenuKeyboard() o'rniga PASTKI reply-klaviatura
// (exchangePanelKeyboard) biriktiriladi — bu xabar eski asosiy panelni
// avtomatik almashtiradi. Haqiqiy kanal ro'yxati chiqqan holatda (pastga
// qarang) inline "✅ Obuna bo'ldim"/Report tugmalari FUNKSIONAL zarur
// bo'lgani uchun inline qolaveradi, lekin `includeMenuActions` qatorlari
// (Kanalimni qo'shish va h.k.) ENDI qo'shilmaydi — ular allaqachon pastki
// panelda; agar panel hali "exchange" holatiga o'tmagan bo'lsa (masalan
// foydalanuvchida ilgaridan faol kanal bo'lib, to'g'ridan-to'g'ri shu
// ro'yxatga tushib qolsa), buni bitta qisqa xabar bilan oldindan
// almashtiramiz.
export async function handleExchangeBrowse(bot: Bot<MyContext>, ctx: MyContext, includeMenuActions: boolean = true, useReplyPanel: boolean = false): Promise<void> {
  const userId = ctx.from!.id;
  const lang = ctx.session.language || "uz";
  const secretHeader = { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET };
  const emptyStateKeyboard = useReplyPanel ? exchangePanelKeyboard(lang) : exchangeMenuKeyboard(ctx);
  if (useReplyPanel && ctx.session) ctx.session.subscriberBotPanelMode = "exchange";

  try {
    // 1) Avval foydalanuvchining oldingi obunalari haqiqatan hali ham
    // amal qiladimi tekshiramiz (qoidani buzganlarni jazolash shu yerda).
    const report = await enforceExchangeRules(bot, userId);

    if (report.lapsed?.length > 0) {
      const lapsedButtons: any[] = (report.lapsedDetails || [])
        .filter((c: any) => c.link)
        .map((c: any) => [{ text: t("ex_resubscribe_btn", lang, { title: c.title }), url: c.link }]);
      lapsedButtons.push([{ text: t("back_to_menu", lang), callback_data: "menu_home" }]);

      await ctx.reply(t("ex_lapsed_notice", lang, { channels: escapeHtml(report.lapsed.join(", ")) }), { parse_mode: "HTML", reply_markup: { inline_keyboard: lapsedButtons } }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeBrowse: ctx.reply yuborishda xato"));
      return;
    }

    // 2) Yangi kanallarni navbat bo'yicha taklif qilamiz. TUZATILDI
    // (foydalanuvchi talabi): limit 5'dan 10'ga oshirildi.
    const browseRes = await fetch(`${process.env.APP_URL}/api/telegram/exchange/browse/${userId}?limit=10`, { headers: secretHeader });
    if (!browseRes.ok) {
      // TUZATILDI: ilgari bu yerda status kodi tekshirilmasdan to'g'ridan-to'g'ri
      // .json() qilinardi — server xatolik qaytarsa ({error: "..."}, massiv EMAS),
      // kod buni "yangi kanal yo'q" deb noto'g'ri talqin qilib, foydalanuvchiga
      // "hozircha kanal yo'q" degan chalg'ituvchi xabar ko'rsatardi va haqiqiy
      // xatolik hech qayerda (log'da ham) ko'rinmasdi. Endi xato aniq log qilinadi
      // va foydalanuvchiga "yo'q" emas, "xatolik" ekani aytiladi.
      const errBody = await browseRes.text().catch(() => "");
      logger.error({ status: browseRes.status, body: errBody }, "exchange browse request failed");
      await ctx.reply(t("ex_browse_load_error", lang), { reply_markup: emptyStateKeyboard }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeBrowse: ctx.reply yuborishda xato"));
      return;
    }
    const browseData = await browseRes.json();
    // TUZATILDI (YANGI ADMIN BOSHQARUVI): endpoint javobi endi xom massiv
    // emas, { disabledByAdmin, channels } shaklida — chunki admin
    // panelidagi "Obuna almashish kanallari" bo'limidan butun taklif
    // qilish mexanizmini vaqtincha o'chirib qo'yishi mumkin bo'ldi. Bunday
    // holatda foydalanuvchiga "hozircha yangi kanal yo'q" emas, aynan
    // "admin vaqtincha o'chirgan" degan aniq xabar ko'rsatiladi.
    if (browseData.disabledByAdmin) {
      await ctx.reply(t("ex_browse_disabled_by_admin", lang), { reply_markup: emptyStateKeyboard }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeBrowse: ctx.reply yuborishda xato"));
      return;
    }
    const channels = browseData.channels;

    if (!Array.isArray(channels) || channels.length === 0) {
      await ctx.reply(t("ex_browse_empty", lang), { reply_markup: emptyStateKeyboard }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeBrowse: ctx.reply yuborishda xato"));
      return;
    }

    // 🆕 TUZATILDI (foydalanuvchi talabi — skrinshot bilan: "obuna
    // bo'ldim" bosilgach "siz hali obuna bo'lmagansiz" deb chiqadi,
    // garchi foydalanuvchi HAQIQATAN obuna bo'lgan bo'lsa ham): sabab —
    // botning o'zi o'sha kanalda ALLAQACHON admin huquqini yo'qotgan
    // bo'lishi mumkin (davriy sog'liq-tekshiruvi — checkExchangeChannelHealth
    // — buni FAQAT bir necha soatda bir marta, cron orqali payqaydi), lekin
    // ro'yxat baribir "eski" (hali isActive=true) holatda ko'rsatilaverardi
    // — foydalanuvchi hech qachon haqiqiy a'zo bo'la olmaydigan kanalga
    // "obuna bo'ling" deb taklif qilinardi. Endi shu ro'yxat foydalanuvchiga
    // ko'rsatilishidan OLDIN, HAR BIR kanal uchun bot HAQIQATAN hali ham
    // o'sha kanalda admin/creator ekanligi TO'G'RIDAN-TO'G'RI (jonli)
    // tekshiriladi — checkExchangeChannelHealth bilan BIR XIL
    // recordChannelHealthOutcome hisoblagichi ishlatiladi (bitta lahzalik
    // tarmoq xatosi kanalni butunlay o'chirib qo'ymasligi uchun), lekin
    // BU YERDA — hisoblagich chegarasidan qat'i nazar — bot ANIQ admin
    // EMASLIGI tasdiqlangan kanal DARHOL shu safargi ro'yxatdan chiqarib
    // tashlanadi (foydalanuvchiga hozir taklif qilinmaydi), chegaraga
    // (CHANNEL_DEACTIVATION_THRESHOLD) yetgandagina esa bazada ham
    // isActive=false qilib qo'yiladi — xuddi davriy tekshiruvdagi kabi.
    const healthChecked = await mapWithConcurrency(channels, ENFORCE_RULES_CONCURRENCY, async (c: any) => {
      let hasAccess = true;
      try {
        const member = await bot.api.getChatMember(c.channelId, bot.botInfo.id);
        hasAccess = ["administrator", "creator"].includes(member.status);
      } catch {
        hasAccess = false;
      }
      const shouldDeactivate = recordChannelHealthOutcome(c.channelId, hasAccess);
      if (shouldDeactivate) {
        fetch(`${process.env.APP_URL}/api/telegram/exchange/deactivate-channel`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...secretHeader },
          body: JSON.stringify({ id: c.id, reason: "Bot kanalda admin huquqini yo'qotdi yoki kanal topilmadi." })
        }).catch((err) => logger.warn({ err, channelId: c.id }, "handleExchangeBrowse: deactivate-channel so'rovi muvaffaqiyatsiz"));
      }
      return { channel: c, hasAccess };
    });
    const availableChannels = healthChecked.filter((r) => r.hasAccess).map((r) => r.channel);

    if (availableChannels.length === 0) {
      // Barcha taklif qilingan kanallarda bot admin emasligi chiqdi —
      // foydalanuvchiga "hozircha yangi kanal yo'q" bilan BIR XIL xabar
      // (u aslida nima uchun ekanini bilishi shart emas, faqat qayta
      // urinib ko'rishi mumkinligini bilsa yetarli).
      await ctx.reply(t("ex_browse_empty", lang), { reply_markup: emptyStateKeyboard }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeBrowse: ctx.reply yuborishda xato"));
      return;
    }

    // YANGI (foydalanuvchi talabi, skrinshot bilan): har bir kanal
    // qatorida — o'ng tomonda — Report tugmasi; alohida per-kanal
    // "✅ Obuna bo'ldim" tugmasi endi YO'Q, o'rniga ro'yxat ostida YAGONA
    // shunday tugma bor (ex_confirm_all) — bosilganda shu safar
    // ko'rsatilgan BARCHA kanallar birданiga tekshiriladi. Shu ro'yxat
    // (id/channelId/title) sessiyada saqlanadi — ex_confirm_all handler
    // (handlers-exchange.ts) shundan foydalanadi.
    ctx.session.exchangeBrowseChannels = availableChannels.map((c: any) => ({ id: c.id, channelId: c.channelId, title: c.title }));

    // Eslatma: matn ichiga kanal HAVOLASINI qo'shmaymiz — aks holda
    // Telegram har bir havola uchun katta preview kartochka chiqarib,
    // xabarni ortiqcha uzun va chalkash qilib yuboradi. Havola faqat
    // pastdagi "Ochish" tugmasida (URL button) beriladi, bu yetarli.
    let text = (await getExchangeLiveStatsLine(lang)) + t("ex_browse_title", lang);
    const buttons: any[] = [];
    // TUZATILDI (foydalanuvchi talabi bilan bir xil sabab — "chiqib
    // ketgan kanal" holatidagidek): yopiq (private, username'siz)
    // kanallar uchun ham resolveChannelJoinLink orqali (bot allaqachon
    // shu kanalda admin bo'lgani uchun) taklif havolasi yaratishga
    // urinamiz — avval bunday kanallar uchun "Ochish" tugmasi umuman
    // ko'rinmas edi.
    const channelLinks = await mapWithConcurrency(availableChannels, ENFORCE_RULES_CONCURRENCY, async (c: any) =>
      resolveChannelJoinLink(bot, String(c.channelId), c.channelUsername)
    );
    availableChannels.forEach((c: any, idx: number) => {
      const link = channelLinks[idx];
      text += `• <b>${escapeHtml(c.title)}</b>\n`;
      const row: any[] = [];
      if (link) row.push({ text: t("ex_open_btn", lang, { title: c.title }), url: link });
      row.push({ text: t("ex_report_btn", lang), callback_data: `ex_report_${c.id}` });
      buttons.push(row);
    });
    buttons.push([{ text: t("ex_confirm_all_btn", lang), callback_data: "ex_confirm_all" }]);
    // YANGI (foydalanuvchi talabi): "Keyingi 10 ta" — faqat navbatda shu
    // sahifadan tashqari yana kanal bo'lsagina ko'rsatiladi (backend
    // hasMore bayrog'i orqali) — 10 tadan oshmasa umuman chiqmaydi.
    if (browseData.hasMore) {
      buttons.push([{ text: t("ex_next_page_btn", lang), callback_data: "ex_browse" }]);
    }
    // Qolgan bo'lim amallari (kanal qo'shish, mening kanallarim, reyting,
    // taklif qilish, qoida va bonuslar, bosh menyu) — `useReplyPanel=true`
    // bo'lsa BUTUNLAY qo'shilmaydi (ular allaqachon pastki reply-panelda —
    // pastga qarang); aks holda (asosiy bot) avvalgidek FAQAT
    // `includeMenuActions=true` bo'lganda shu ro'yxat ostiga INLINE tugma
    // sifatida qo'shiladi.
    if (includeMenuActions && !useReplyPanel) {
      const hideAddChannel = ctx.from ? await hasActiveExchangeChannel(ctx.from.id) : false;
      buttons.push(...exchangeMenuKeyboard(ctx, { hideAddChannel }).inline_keyboard);
    }

    // TUZATILDI: kanallar ro'yxati inline "✅ Obuna bo'ldim"/Report
    // tugmalari bilan yuborilishi shart (funksional zarur), shu sabab bu
    // aniq xabar reply-panel tashimaydi. Agar pastki panel hali "exchange"
    // holatiga o'tmagan bo'lsa (masalan foydalanuvchida ilgaridan faol
    // kanal bo'lib, oraliq "kanal yo'q"/"qo'shish" ekranisiz to'g'ridan-
    // to'g'ri shu ro'yxatga tushib qolsa), buni oldindan bitta qisqa
    // xabar bilan almashtirib qo'yamiz — shundan keyin faqat bir marta.
    if (useReplyPanel && ctx.session && ctx.session.subscriberBotPanelMode !== "exchange") {
      ctx.session.subscriberBotPanelMode = "exchange";
      await ctx.reply(t("menu_exchange", lang), { reply_markup: exchangePanelKeyboard(lang) }).catch(() => {});
    }

    const { subscriberMultiplier: browseMultiplier } = await getExchangeBonusConfigCached();
    await ctx.reply(text + "\n" + exchangeRuleText(lang, browseMultiplier), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: buttons }
    }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeBrowse: ctx.reply yuborishda xato"));
  } catch (err: unknown) {
    logger.error({ err }, "ex_browse error");
    await ctx.reply(t("ex_channels_load_error", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeBrowse: ctx.reply yuborishda xato"));
  }
}

export async function handleMenuExchange(bot: Bot<MyContext>, ctx: MyContext, includeMenuActions: boolean = true, useReplyPanel: boolean = false) {
  // 🆕 DARVOZA (foydalanuvchi talabi): boshqalarning kanaliga obuna
  // bo'lishdan OLDIN foydalanuvchi o'z kanalini botga ulagan bo'lishi
  // shart — aks holda uning "obuna bo'lish"laridan hech kimga (hech qanday
  // kanalga) foyda tegmaydi. Shu sabab "Obunachi yig'ish" bo'limi ochilgan
  // zahoti (odatdagi kirish ekrani o'rniga) foydalanuvchida BIRORTA HAM
  // ulangan kanal yo'qligi tekshiriladi — bo'lmasa, oddiy kirish ekrani
  // ko'rsatilmay, to'g'ridan-to'g'ri "kanal qo'shish" ko'rsatmasi
  // chiqariladi (xuddi "➕ Kanalimni qo'shish" tugmasi bosilgandek).
  // Kanalni muvaffaqiyatli ulagach, handleExchangeChannelRegistrationMessage
  // AVTOMATIK ravishda shu ro'yxatni ko'rsatadi — qarang: o'sha
  // funksiyadagi izoh va uni chaqiruvchi joylar (handlers-text.ts,
  // subscriber-bot/index.ts).
  if (ctx.from && !(await hasAnyExchangeChannel(ctx.from.id))) {
    await showExchangeAddChannelPrompt(ctx, useReplyPanel);
    return;
  }

  // TUZATILDI (foydalanuvchi talabi): oldin bu yerda alohida, qisqa
  // kirish ekrani (statsLine + t("exchange_intro", {multiplier}) +
  // to'liq exchangeMenuKeyboard, shu jumladan o'zining "📋 Kanallarga
  // obuna bo'lish" tugmasi bilan) ko'rsatilardi — foydalanuvchi obuna
  // bo'lish ro'yxatini ko'rish uchun YANA bitta tugma bosishi kerak edi.
  // Endi "🔄 Obunachi yig'ish" tugmasining O'ZI to'g'ridan-to'g'ri shu
  // ro'yxatni (avvalgi "📋 Kanallarga obuna bo'lish" — ex_browse)
  // ko'rsatadi, oraliq ekran YO'Q. Qolgan amallar (kanal qo'shish, mening
  // kanallarim, reyting, taklif qilish, qoida va bonuslar) endi shu
  // ro'yxat ostidagi tugmalar orqali ochiladi (handleExchangeBrowse
  // yuqorida — exchangeMenuKeyboard qatorlarini ro'yxat ostiga qo'shadi,
  // shu jumladan dinamik {{multiplier}} qoida matni pastda ko'rinadi).
  await handleExchangeBrowse(bot, ctx, includeMenuActions, useReplyPanel);
}

// 🆕 QO'CHIRILDI (handlers-text.ts'dan, "obunachi yig'ish" botiga ham
// ulash uchun): "🚩 Kanaldan shikoyat qilish" oqimining "Boshqa sabab"
// bosqichi — foydalanuvchi erkin matn yozganda ishlaydi. Avval bu logika
// FAQAT handlers-text.ts ichida, asosiy botning umumiy message:text
// zanjirida edi. Endi shu yerga (umumiy exchange-service.ts'ga)
// ko'chirildi — shu bilan ASOSIY bot VA "obunachi yig'ish" boti (mustaqil
// process, subscriber-bot/index.ts) BIR XIL kodni chaqiradi, ikkita joyda
// mustaqil nusxa yuritilmaydi (naqsh checkExchangeChannelHealth/
// enforceExchangeRules bilan bir xil — bitta joyda mantiq, bir nechta
// bot uni chaqiradi). handlers-text.ts endi shu funksiyani chaqiradi,
// xatti-harakat o'zgarmagan (mantiq so'z-ma-so'z ko'chirildi).
export async function handleExchangeReportReasonText(ctx: MyContext, text: string): Promise<void> {
  const lang = ctx.session?.language || "uz";
  ctx.session.awaitingReportReason = false;
  const reason = text.trim();
  const exchangeChannelId = ctx.session.reportChannelId;
  ctx.session.reportChannelId = undefined;

  if (!exchangeChannelId) {
    await ctx.reply(t("session_expired", lang), { reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeReportReasonText: ctx.reply yuborishda xato"));
    return;
  }
  if (reason.length < 3) {
    ctx.session.awaitingReportReason = true;
    ctx.session.reportChannelId = exchangeChannelId;
    await ctx.reply(t("ex_report_reason_short", lang)).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeReportReasonText: ctx.reply yuborishda xato"));
    return;
  }
  await submitExchangeChannelReport(ctx, exchangeChannelId, reason);
}

// 🆕 KO'CHIRILDI (handlers-text.ts'dan, xuddi yuqoridagi funksiya bilan
// BIR XIL sabab uchun): "➕ Kanalimni qo'shish" (ex_add) bosgandan keyin
// foydalanuvchi kanaldan forward qilgan/@username yozgan/t.me havolasini
// yuborgan xabarni qayta ishlaydi — kanalni tekshiradi (bot admin
// ekanligi, foydalanuvchi kanal egasi/admin ekanligi) va serverga
// ro'yxatdan o'tkazadi. Chaqiruvchi (index.ts yoki subscriber-bot/
// index.ts) buni FAQAT `ctx.session.awaitingExchangeChannel === true`
// bo'lganda chaqiradi — bu yerda qayta tekshirilmaydi.
//
// MUHIM (DEPLOY, ikkala bot ham ishlatganda): kanalni ro'yxatdan
// o'tkazishda "bot admin ekanligi" tekshiruvi CHAQIRUVCHI `bot`
// instansiyasi (ya'ni foydalanuvchi qaysi bot orqali kanal qo'shsa, O'SHA
// bot) bo'yicha tekshiriladi. Demak agar foydalanuvchi kanalni "obunachi
// yig'ish" boti orqali qo'shsa, aynan O'SHA bot kanalga admin qilib
// qo'yilgan bo'lishi kerak (asosiy botning admin bo'lishi bunga
// yordam bermaydi) — xuddi sponsor-kanallar uchun yuqoridagi izohdagi
// talab kabi.
// TUZATILDI (foydalanuvchi talabi — "kanal ulangach avtomatik davom
// etish"): funksiya endi `Promise<boolean>` qaytaradi — `true` FAQAT
// kanal MUVAFFAQIYATLI ro'yxatdan o'tkazilganda (ya'ni oxirgi "ex_channel_added"
// javobi yuborilganda), aks holda (tushunarsiz xabar, forward kanal emas,
// bot/egasi admin emas, server xatosi va h.k.) `false`. Chaqiruvchilar
// (handlers-text.ts, subscriber-bot/index.ts) shu qiymatga qarab, kanal
// MUVAFFAQIYATLI qo'shilganda darhol "📋 Kanallarga obuna bo'lish"
// ro'yxatini (handleExchangeBrowse) avtomatik ko'rsatadi — foydalanuvchi
// yana alohida "Obunachi yig'ish" tugmasini bosib o'tirmaydi.
export async function handleExchangeChannelRegistrationMessage(bot: Bot<MyContext>, ctx: MyContext): Promise<boolean> {
  const lang = ctx.session.language || "uz";

  const origin = (ctx.message as any)?.forward_origin;
  const text = (ctx.message as any)?.text?.trim();
  const looksLikeUsername = !!text && text.startsWith("@") && text.length > 1;
  // Telegram kanal ID'lari doim "-100" bilan boshlanadi.
  const looksLikeNumericId = !!text && /^-100\d{6,}$/.test(text);
  const linkParsed = !origin && !looksLikeUsername && !looksLikeNumericId && text ? parseChannelLinkToUsername(text) : null;

  if (linkParsed?.isInviteLink) {
    // Bu holatda flag'ni O'CHIRMAYMIZ — qayta urinishga imkon beramiz.
    await ctx.reply(t("ex_invite_link_error", lang), { parse_mode: "HTML", reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
    return false;
  }

  const resolvedIdentifier: string | number | null = looksLikeUsername
    ? text!
    : looksLikeNumericId
    ? Number(text!)
    : linkParsed?.username || null;

  if (!origin && !resolvedIdentifier) {
    // Bu holatda flag'ni O'CHIRMAYMIZ — odam adashib boshqa narsa
    // yuborgan bo'lishi mumkin, qayta urinishga imkon beramiz.
    await ctx.reply(t("ex_channel_not_understood", lang), { parse_mode: "HTML", reply_markup: backToMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
    return false;
  }

  ctx.session.awaitingExchangeChannel = false;

  try {
    let channelId: string;
    let channelUsername: string | null;
    let title: string;

    if (origin) {
      if (origin.type !== "channel") {
        await ctx.reply(t("ex_forward_not_channel", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
        return false;
      }
      const chat = origin.chat;
      channelId = String(chat.id);
      channelUsername = chat.username ? `@${chat.username}` : null;
      title = chat.title || t("ex_unnamed_channel", lang);
    } else {
      let chat;
      try {
        chat = await bot.api.getChat(resolvedIdentifier!);
      } catch (err) {
        logger.warn({ err, identifier: resolvedIdentifier }, "exchange getChat failed");
        await ctx.reply(t("ex_chat_not_found", lang, { identifier: String(resolvedIdentifier) }), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
        return false;
      }
      if (chat.type !== "channel") {
        await ctx.reply(t("ex_not_a_channel", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
        return false;
      }
      channelId = String(chat.id);
      channelUsername = (chat as any).username
        ? `@${(chat as any).username}`
        : (typeof resolvedIdentifier === "string" ? resolvedIdentifier : null);
      title = (chat as any).title || t("ex_unnamed_channel", lang);
    }

    let botMember;
    try {
      botMember = await bot.api.getChatMember(channelId, ctx.me.id);
    } catch (err) {
      logger.warn({ err, channelId }, "exchange bot getChatMember failed");
      await ctx.reply(t("ex_bot_not_member", lang), { parse_mode: "HTML", reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
      return false;
    }
    if (!["administrator", "creator"].includes(botMember.status)) {
      await ctx.reply(t("ex_bot_not_admin", lang), { parse_mode: "HTML", reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
      return false;
    }

    let ownerMember;
    try {
      ownerMember = await bot.api.getChatMember(channelId, ctx.from!.id);
    } catch (err) {
      logger.warn({ err, channelId, userId: ctx.from!.id }, "exchange owner getChatMember failed");
      await ctx.reply(t("ex_owner_status_unknown", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
      return false;
    }
    if (!["administrator", "creator"].includes(ownerMember.status)) {
      await ctx.reply(t("ex_owner_not_admin", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
      return false;
    }

    const res = await fetch(`${process.env.APP_URL}/api/telegram/exchange/register-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
      body: JSON.stringify({
        ownerTelegramId: ctx.from!.id,
        ownerUsername: ctx.from!.username,
        channelId,
        channelUsername,
        title
      })
    });
    const data = await res.json();
    if (!res.ok) {
      await ctx.reply(`❌ ${data.error || t("generic_error", lang)}`, { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
      return false;
    }
    // 🎁 Agar bu foydalanuvchining BOTGA ULAGAN ILK kanali bo'lsa,
    // server darhol xush kelibsiz bonusini ham qo'shib qo'yadi.
    const { welcomeBonus, subscriberMultiplier: registerMultiplier } = await getExchangeBonusConfigCached();
    let welcomeBonusLine = "";
    if (data.welcomeBonusGiven) {
      welcomeBonusLine = t("ex_welcome_bonus_line", lang, { bonus: welcomeBonus });
    }
    await ctx.reply(
      t("ex_channel_added", lang, { title: escapeHtml(title) }) +
      welcomeBonusLine +
      `\n\n` + exchangeRuleText(lang, registerMultiplier),
      // Kanal ENDI faol (navbatga qo'shildi) — shu sabab "➕ Kanalimni
      // qo'shish" tugmasi shu yerda ENDI keraksiz, yashiriladi.
      { parse_mode: "HTML", reply_markup: exchangeMenuKeyboard(ctx, { hideAddChannel: true }) }
    ).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
    return true;
  } catch (err: unknown) {
    logger.error({ err }, "Exchange channel registration error");
    await ctx.reply(t("generic_error", lang), { reply_markup: exchangeMenuKeyboard(ctx) }).catch((replyErr) => logger.warn({ err: replyErr, userId: ctx.from?.id }, "handleExchangeChannelRegistrationMessage: ctx.reply yuborishda xato"));
    return false;
  }
}

