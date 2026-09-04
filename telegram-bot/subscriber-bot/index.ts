// 📢 "OBUNACHI YIG'ISH" BOTI — kirish nuqtasi.
//
// Bu ASOSIY botdan (telegram-bot/index.ts) TO'LIQ MUSTAQIL, alohida
// Telegram bot processi (o'z tokeni — TELEGRAM_SUBSCRIBER_BOT_TOKEN,
// o'z @username'i, o'z PM2 jarayoni: "telegram-subscriber-bot"). Vazifasi:
// 1) foydalanuvchidan sponsor kanal(lar)ga obuna bo'lishni so'rash,
// obunani tekshirish va tasdiqlangach asosiy botga o'tish tugmasini
// ko'rsatish (darvoza/gate), VA 2) endi (foydalanuvchi so'roviga ko'ra)
// asosiy botdagi "🔄 Obunachi yig'ish" (kanal almashish/exchange)
// bo'limining O'ZINI ham — kanal qo'shish, boshqa kanallarga obuna
// bo'lish, mening kanallarim, reyting, do'st taklif qilish.
//
// TUZATILDI (avval "ATAYLAB sessiyasiz" edi): exchange bo'limi
// (ex_add/ex_browse va h.k.) foydalanuvchi holatini (masalan "kanal
// nomini kutyapman") saqlashi SHART bo'lgani uchun bu bot endi asosiy
// bot bilan BIR XIL `session()` middleware'ini (bir xil `sessionStorage`,
// bir xil DB jadvali — TelegramBotSession, telegramUserId bo'yicha
// kalitlangan) ishlatadi. Bu ATAYLAB shunday: ikkala bot bir xil
// foydalanuvchi identifikatori (telegramUserId) bo'yicha BIR XIL sessiya
// yozuvini o'qiydi/yozadi — bitta odam ikkala botda ham "bitta holat"ga
// ega bo'ladi (masalan boshqa botda boshlangan shikoyat oqimi bu yerda
// ham tugallanishi mumkin). Exchange biznes-mantig'ining O'ZI
// (exchange-service.ts, handlers-exchange.ts) IKKALA botda ham AYNAN
// BIR XIL kod — bu yerga nusxa ko'chirilmagan, faqat qayta ishlatilgan.
//
// MUHIM (DEPLOY): bu bot sponsor kanallarda VA exchange kanallarida
// getChatMember chaqira olishi uchun HAR BIR shunday kanalga o'zi
// admin qilib qo'shilishi kerak. TUZATILDI (foydalanuvchi talabi —
// "asosiy bot bilan bu botning umuman bir-biriga aloqasi bo'lmasligi
// kerak, obunachi yig'ish ishlarini obunachi yig'ish boti qilishi
// kerak"): avval bu yerda "amalda ikkala bot BIR XIL kanallarga admin
// qilib qo'yilishi tavsiya etiladi" deyilgan edi — bu ENDI NOTO'G'RI.
// Asosiy bot (telegram-bot/index.ts) endi "Obunachi yig'ish" bo'limini
// UMUMAN ishlatmaydi (na uning handlerlarini ro'yxatdan o'tkazadi, na
// uning davriy vazifalarini) — foydalanuvchini shu botga yo'naltiradi,
// xolos. Demak ENDI: ExchangeChannel'ga FAQAT shu (subscriber) bot
// admin qilinishi SHART va YETARLI — asosiy botning o'sha kanalda
// admin bo'lish-bo'lmasligi END umuman ahamiyatsiz (u hech qachon
// tekshirilmaydi ham).
import { Bot, session } from "grammy";
import dotenv from "dotenv";
import path from "path";
import { logger } from "../../src/lib/logger";
import { t, Lang, getUserLanguage, setUserLanguage, hasUserChosenLanguage, refreshBotMessageOverrides } from "../i18n";
import { getSponsorChannelsCached, handleMenuExchange, handleExchangeReportReasonText, handleExchangeChannelRegistrationMessage } from "../exchange-service";
import {
  registerExchangeHandlers,
  handleExchangeAdd,
  handleExchangeBrowse,
  handleExchangeMyChannels,
  handleExchangeLeaderboard,
  handleExchangeInvite,
  handleExchangeInfo
} from "../handlers-exchange";
import { createSubscriberBot, resolveMainBotUsername } from "../bot-instance";
import { showExchangeSummary } from "../profile-service";
import { rateLimitMiddleware } from "../rate-limit";
import { GatePassCache, checkSubscription, buildGateKeyboard } from "../sponsor-gate";
import { registerProcessSafetyNets } from "../process-safety";
import { trackBotEvent, TELEGRAM_BOT_INTERNAL_SECRET } from "../secret";
import { sessionStorage } from "../session-store";
import { SponsorChannel, SessionData, MyContext } from "../types";
// YANGI (foydalanuvchi talabi — "obunachi yig'ish ishlarini obunachi
// yig'ish boti qilishi kerak"): barcha davriy ("Obunachi yig'ish")
// vazifalar (sog'liq tekshiruvi, qoidabuzarlik tekshiruvi, kredit
// sababli to'xtatilgan/kirish yo'qolgan kanallarni avtomatik tiklash,
// yangi kanal e'loni) ENDI FAQAT shu botda ishga tushiriladi — avval
// bular ASOSIY botda (telegram-bot/index.ts) ishlardi, garchi ko'p
// tekshiruvlar aynan shu (subscriber) botning admin holatiga bog'liq
// bo'lsa ham. Endi bitta joyda, bitta bot bilan — ikki marta
// bajarilish yo'q, "qaysi bot tekshirilyapti" chalkashligi yo'q.
import { registerCronJobs } from "../cron-jobs";


// Asosiy bot bilan bir xil naqsh — process.cwd() ildiz papkasi deb kutiladi
// (ecosystem.config.cjs'da cwd: __dirname loyihaning o'zi).
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

// 🛡️ GLOBAL XAVFSIZLIK TO'RI: DRY — asosiy bot (index.ts) bilan BIR XIL,
// umumiy `process-safety.ts` moduli orqali. Tafsilot va TUZATILDI tarixi
// (uncaughtException'dan keyin boshqariladigan qayta ishga tushirish)
// uchun o'sha faylga qarang.
registerProcessSafetyNets("Obunachi yig'ish boti");

// TUZATILDI (TELEGRAM API YUKLAMASI): avval har bir oddiy xabarda (hatto
// oddiy "salom" kabi so'zda ham) barcha sponsor kanallar bo'yicha
// getChatMember qayta so'ralardi. Asosiy botdagi sponsor-gate.ts'dagi
// BIR XIL naqsh: obuna tasdiqlangan foydalanuvchi uchun GATE_PASS_TTL_MS
// davomida qayta tekshirilmaydi — faqat aniq foydalanuvchi harakati
// (/start yoki "✅ Tekshirish" tugmasi, pastda `force: true` bilan
// chaqiriladi) keshni chetlab o'tib, haqiqiy tekshiruvni majburlaydi.
const GATE_PASS_TTL_MS = 5 * 60 * 1000;

// TUZATILDI (DRY — KOD TAKRORLANISHI): avval bu yerda "gate o'tildi"
// keshi (Map + mark/clear/hasPassedRecently) va `findNotSubscribedChannels`/
// `gateKeyboard` asosiy botdagi sponsor-gate.ts bilan so'zma-so'z bir xil
// (faqat "check_subscription" vs "sub_bot_check" callback nomi farq
// qiladigan) holda qaytadan yozilgan edi. Endi ikkalasi ham umumiy
// `sponsor-gate.ts` modulidan olinadi — bitta joyda tuzatish ikkinchisida
// unutilib qolish xavfi endi yo'q. Kesh instansiyasi baribir MUSTAQIL
// (asosiy botning keshidan alohida) — chunki har bir bot o'z kanallariga
// alohida admin bo'ladi va gate holati bittasida o'tishi ikkinchisiga
// avtomatik tegishli emas (qarang: exchange-service.ts'dagi DEPLOY izohi).
const gatePassCache = new GatePassCache(GATE_PASS_TTL_MS);

// TUZATILDI: avval process.env.MAIN_BOT_USERNAME to'g'ridan-to'g'ri
// o'qilardi (admin panelda sozlangan qiymatni ko'rmasdi). Endi main()
// ishga tushishda bir marta resolveMainBotUsername() orqali (bazadagi
// qiymatga ustunlik berib) aniqlanadi va shu o'zgaruvchida saqlanadi.
let mainBotUsername: string | undefined;

function markGatePassed(userId: number): void {
  gatePassCache.markPassed(userId);
}

function clearGatePassed(userId: number): void {
  gatePassCache.clearPassed(userId);
}

function hasPassedGateRecently(userId: number): boolean {
  return gatePassCache.hasPassedRecently(userId);
}

// DRY: obuna tekshiruvi (concurrency-cheklangan parallel getChatMember)
// endi sponsor-gate.ts'dagi yagona `checkSubscription` orqali amalga
// oshiriladi — bu yerda qaytadan yozilmaydi.
async function findNotSubscribedChannels(
  bot: Bot<MyContext>,
  channels: SponsorChannel[],
  userId: number
): Promise<SponsorChannel[]> {
  return checkSubscription(bot, channels, userId);
}

function gateKeyboard(notSubscribed: SponsorChannel[], lang: Lang) {
  return buildGateKeyboard(notSubscribed, lang, "sub_bot_check");
}

// 🆕 PASTKI REPLY-KLAVIATURA (doimiy tugmalar paneli): foydalanuvchi
// so'rovi bo'yicha, saytdagi hisobga (balans, email, xaridlar) BOG'LIQ
// BO'LMAGAN, faqat shu botning o'ziga tegishli funksiyalar qo'shildi —
// obunani tekshirish, til almashtirish, do'stlarni taklif qilish
// (referal), taklif statistikasi VA (YANGI) asosiy botdagi bilan bir
// xil "🔄 Obunachi yig'ish" (exchange) bo'limini ochish. Matn taniladigan
// tugmalar bo'lgani uchun (callback_data emas, oddiy matn yuboriladi),
// har biri pastdagi `bot.hears` handlerlarida BARCHA tillar bo'yicha
// aniqlanadi. Alohida yangi i18n kaliti QO'SHILMADI — mavjud
// "menu_exchange" kaliti (i18n.ts) qayta ishlatildi, chunki matn (label)
// asosiy botdagi tugma bilan bir xil bo'lishi kerak.
//
// TUZATILDI (✅ Tekshirish tugmasi doimo ko'rinardi): avval bu tugma
// foydalanuvchi allaqachon obunani tasdiqlagan bo'lsa ham panelda
// doimiy turaverardi — bu keraksiz va chalkashtiruvchi edi (tekshirish
// uchun endi hech narsa yo'q). Endi `showCheck` parametri orqali bu
// tugma FAQAT foydalanuvchi hali darvozadan o'tmagan (obunasi
// tasdiqlanmagan yoki keshi eskirgan) holatda ko'rsatiladi — buni
// pastdagi `keyboardForUser()` orqali `hasPassedGateRecently()`
// natijasidan aniqlaymiz.
// TUZATILDI (FOYDALANUVCHI SO'ROVI — PANEL "DOIM" KO'RINISHI KERAK):
// avval bu yerda `is_persistent: true` bor edi, keyin klaviaturani
// qo'lda "⌄" strelkasi bilan yig'ishtirib bo'lmasligi sababli OLIB
// TASHLANGAN edi (pastdagi eski izohga qarang). Lekin amalda bu
// muammoli chiqdi: foydalanuvchi Telegram'da chatning TARIXINI
// tozalasa, klaviatura holati mijoz tomonida yo'qolib qoladi va bot
// buni QAYTA yubormaydi (chunki `maybeKeyboard` sessiyadagi
// "allaqachon ko'rsatilgan" bayrog'iga tayanadi, u esa tarixni
// tozalashdan TA'SIRLANMAYDI — serverda saqlanib qoladi) — natijada
// panel tugmasi butunlay yo'qolib qoladi.
//
// Foydalanuvchining aniq so'rovi bo'yicha: bu tugma HAR DOIM ko'rinib
// turishi kerak. Shu sabab endi `is_persistent: true` QAYTARILDI — bu
// Telegramga chatda klaviaturani doimiy ko'rsatishni buyuradi (hatto
// foydalanuvchi uni yig'ishtirsa yoki tarixni tozalasa ham qayta
// paydo bo'ladi). Bilib turing: bu ESKI muammoni qaytarib keltiradi —
// foydalanuvchi endi "⌄" strelkasi bilan panelni QO'LDA yig'ishtira
// olmaydi (Telegram uni har doim majburan ochiq ko'rsatadi). Bu —
// ataylab qilingan savdo-sotiq: "doim ko'rinish" > "qo'lda yopish
// imkoniyati".
// TUZATILDI (foydalanuvchi talabi — 6 ta tugma): avval bu yerda 4 ta
// tugma bor edi (Obunachi yig'ish, Til, Do'stlarni taklif, Statistika).
// Endi 6 ta: Profil, Do'stlarni taklif qilish, Report (qo'llab-quvvatlash
// murojaati bilan bir xil oqim — pastga qarang), Qoida va bonuslar
// (mavjud handleExchangeInfo bilan bir xil ekran), Til, Obunachi yig'ish.
// "Statistika" o'z vazifasini endi "Profil" bajaradi (bir xil kontent,
// funksiya nomi handleStatsButton saqlab qolindi — faqat yangi tugma
// matnidan chaqiriladi). Joylashuv: Profil | Obunachi yig'ish ustma-ust
// qatorda, Report | Do'stlarni taklif qilish keyingi qatorda, Til |
// Qoida va bonuslar eng pastki qatorda (pastga qarang, keyingi izoh).
// TUZATILDI (foydalanuvchi talabi — tugmalar joyini almashtirish):
// "🔄 Obunachi yig'ish" endi "🔗 Do'stlarni taklif qilish" turgan joyda,
// "🔗 Do'stlarni taklif qilish" endi "📜 Qoida va bonuslar" turgan joyda,
// "📜 Qoida va bonuslar" esa panelning eng pastki qatoriga, o'ng
// tomonga ko'chirildi.
function replyKeyboard(lang: Lang, showCheck: boolean = true) {
  return {
    keyboard: [
      ...(showCheck ? [[{ text: t("sponsor_gate_check", lang) }]] : []),
      [{ text: t("subscriber_bot_profile_btn", lang) }, { text: t("menu_exchange", lang) }],
      [{ text: t("subscriber_bot_report_btn", lang) }, { text: t("subscriber_bot_invite_btn", lang) }],
      [{ text: t("subscriber_bot_language_btn", lang) }, { text: t("subscriber_bot_rules_btn", lang) }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

// Foydalanuvchining HOZIRGI darvoza holatiga (gatePassedCache) qarab
// to'g'ri pastki panelni tanlaydi — o'tgan bo'lsa "✅ Tekshirish"siz,
// hali o'tmagan/keshi eskirgan bo'lsa shu tugma bilan.
function keyboardForUser(userId: number, lang: Lang) {
  return replyKeyboard(lang, !hasPassedGateRecently(userId));
}

// TUZATILDI (foydalanuvchi talabi — dublikat tugmalar olib tashlandi):
// avval "🔄 Obunachi yig'ish" ochilganda handleMenuExchange() natijasidan
// SO'NG yana bir alohida xabar ("⬇️ Bu bo'limda quyidagi tugmalar orqali
// ham boshqarishingiz mumkin." + o'sha 6 ta amalning PASTKI PANEL
// nusxasi — exchangePanelKeyboard) yuborilardi. Bu bitta xil 6 ta
// tugmani IKKI marta (bir marta handleMenuExchange ichidagi INLINE
// ko'rinishda, bir marta shu pastki panelda) ko'rsatib, foydalanuvchini
// chalkashtirardi. Endi bu ikkinchi xabar VA uni yuboruvchi
// `exchangePanelKeyboard` funksiyasi butunlay OLIB TASHLANDI — bo'lim
// endi FAQAT handleMenuExchange() ichidagi bitta INLINE menyuni
// ko'rsatadi (shu sabab pastdagi handleMenuExchange/handleExchangeBrowse
// chaqiruvlari endi standart `includeMenuActions=true` bilan ishlaydi).

// TUZATILDI (PANEL QAYTA-QAYTA MAJBURAN OCHILARDI): Telegram klientida,
// bot QANDAY BO'LMASIN reply-klaviatura (`reply_markup: { keyboard: ... }`)
// bilan xabar yuborsa, foydalanuvchi uni qo'lda "⌄" strelkasi bilan
// yig'ishtirib qo'ygan bo'lsa ham, panel MAJBURAN qayta ochiladi. Avval
// bu bot HAR safar /start bosilganda (hatto foydalanuvchi ALLAQACHON
// ko'p marta ko'rgan, ataylab yig'ishtirib qo'ygan bo'lsa ham) shu
// panelni qayta yuborardi — natijada u "doim ochiq"dek his qilinardi.
//
// `force: true` bo'lganda (foydalanuvchi ANIQ shu panelning o'zidagi bir
// tugmani bosgani sababli chaqirilgan holatlar — "✅ Tekshirish",
// til/menyu tugmalari) panel baribir yangilanadi, chunki bu holatlarda
// panel allaqachon ekranda ochiq turibdi — bu shunchaki mazmunini
// yangilash, "qayta ochish" emas.
//
// `force: false` bo'lganda (masalan /start buyrug'i — bu istalgan payt,
// panel yig'ishtirilgan holatda ham yuborilishi mumkin) panel FAQAT shu
// foydalanuvchi uchun HALI HECH QACHON ko'rsatilmagan bo'lsa
// (`ctx.session.subscriberBotKeyboardShown` hali `true` emas)
// yuboriladi — shundan keyingi /start'larda reply_markup UMUMAN
// qo'shilmaydi, shu bilan foydalanuvchi paneli qo'lda yig'ishtirib
// qo'ygan bo'lsa, bot uni qayta majburlab ochmaydi.
function maybeKeyboard(ctx: MyContext, kb: ReturnType<typeof replyKeyboard>, force: boolean): ReturnType<typeof replyKeyboard> | undefined {
  if (!force && ctx.session.subscriberBotKeyboardShown) return undefined;
  ctx.session.subscriberBotKeyboardShown = true;
  return kb;
}

// Barcha qo'llab-quvvatlanadigan tillar bo'yicha tugma matnlarini
// oldindan hisoblab, {matn -> til kaliti} moslamasini quradi — pastki
// panel tugmasi bosilganda kelgan matnni (foydalanuvchi tili qanday
// bo'lishidan qat'i nazar) aniqlash uchun.
function collectButtonTexts(key: Parameters<typeof t>[0]): string[] {
  return (["uz", "en", "ru"] as Lang[]).map((lang) => {
    try {
      return t(key, lang);
    } catch {
      return null;
    }
  }).filter((text): text is string => !!text);
}

const CHECK_BUTTON_TEXTS = new Set(collectButtonTexts("sponsor_gate_check"));
const LANGUAGE_BUTTON_TEXTS = new Set(collectButtonTexts("subscriber_bot_language_btn"));
const INVITE_BUTTON_TEXTS = new Set(collectButtonTexts("subscriber_bot_invite_btn"));
const STATS_BUTTON_TEXTS = new Set(collectButtonTexts("subscriber_bot_stats_btn"));
// 🆕 "👤 Profil" — "👤 Mening profilim" bilan bir xil ekranni
// (showExchangeSummary — ball, obuna qilingan kanallar soni, o'z
// kanaliga qo'shilgan ball/obunachi) ko'rsatadi (pastga qarang).
const PROFILE_BUTTON_TEXTS = new Set(collectButtonTexts("subscriber_bot_profile_btn"));
// 🆕 "🚩 Report" — asosiy botdagi "🆘 Murojaat yuborish" (support_start)
// bilan BIR XIL oqim: mavzu → xabar → POST /api/telegram/support-ticket.
// Backend/admin panel tarafida hech narsa qo'shilmadi — mavjud
// AdminSupportTab shu yerdan kelgan murojaatlarni ham ko'rsatadi.
const REPORT_BUTTON_TEXTS = new Set(collectButtonTexts("subscriber_bot_report_btn"));
// 🆕 "📜 Qoida va bonuslar" — mavjud handleExchangeInfo() bilan bir xil
// ekran (xush kelibsiz bonusi, referal bonusi, navbat qoidalari).
const RULES_BUTTON_TEXTS = new Set(collectButtonTexts("subscriber_bot_rules_btn"));
// 🆕 "🔄 Obunachi yig'ish" (exchange) bo'limini ochadigan pastki panel
// tugmasi — mavjud "menu_exchange" i18n kaliti bilan bir xil matn.
const EXCHANGE_BUTTON_TEXTS = new Set(collectButtonTexts("menu_exchange"));
// 🆕 handleMenuExchange/handleExchangeBrowse ichidagi INLINE
// exchangeMenuKeyboard (keyboards.ts) tugmalari — shu bot ham bir xil
// i18n kalitlaridan foydalanadi, shu sabab yangi kalit qo'shilmagan.
const EX_ADD_BUTTON_TEXTS = new Set(collectButtonTexts("exchange_add_channel_btn"));
const EX_BROWSE_BUTTON_TEXTS = new Set(collectButtonTexts("exchange_subscribe_btn"));
const EX_MYCHANNELS_BUTTON_TEXTS = new Set(collectButtonTexts("exchange_my_channels_btn"));
const EX_LEADERBOARD_BUTTON_TEXTS = new Set(collectButtonTexts("ex_leaderboard_btn"));
const EX_INVITE_BUTTON_TEXTS = new Set(collectButtonTexts("exchange_invite_btn"));
const EX_INFO_BUTTON_TEXTS = new Set(collectButtonTexts("ex_info_btn"));
// TUZATILDI: "back_to_menu" ("🏠 Bosh menyu") matni faqat shu (exchange)
// panelda ishlatiladi — asosiy panelda bunday tugma yo'q, shu sabab
// to'qnashuv xavfi yo'q.
const EX_HOME_BUTTON_TEXTS = new Set(collectButtonTexts("back_to_menu"));

// 🌐 TIL TANLASH: asosiy botdagi bilan bir xil `setUserLanguage` orqali
// (i18n.ts, bazaga DOIMIY saqlanadi) — shu sabab foydalanuvchi tanlagan
// til asosiy botda ham (agar u yerga o'tsa) saqlanib qoladi, chunki
// ikkala bot BIR XIL TelegramBotUser jadvalidan foydalanadi.
// YANGI (foydalanuvchi talabi — "botga birinchi start bosilganida tilni
// tanlash tugmalari chiqsin"): /start'dagi "salom xabari + darvoza
// tekshiruvi" oqimi endi shu alohida funksiyaga chiqarildi — buni
// oddiy /start (til allaqachon tanlangan bo'lsa) HAM, til BIRINCHI
// marta tanlangandan keyingi davom ettirish HAM (start_sub_lang_*
// callback, pastda) chaqiradi — ikkala joyda BIR XIL kod ikki marta
// yozilmasin.
async function sendSubscriberBotWelcomeAndGate(ctx: MyContext, bot: Bot<MyContext>): Promise<void> {
  // 🆕 Pastki reply-klaviatura panelini /start'da DARHOL ko'rsatish uchun:
  // pastdagi asosiy javob (gate yoki tasdiq) holatiga qarab yo inline
  // tugmalar bilan, yo umuman reply_markup'siz kelishi mumkin — shu
  // sabab bu yerda alohida, juda qisqa "salom" xabari orqali panel oldin
  // o'rnatib qo'yiladi (Telegram uni keyingi inline-tugmali xabarlarda
  // ham ekranda saqlab turadi, chunki panel faqat boshqa reply-keyboard
  // yoki remove_keyboard yuborilganda o'zgaradi).
  if (ctx.from) {
    const lang = await getUserLanguage(ctx.from.id);
    // TUZATILDI (FOYDALANUVCHI SO'ROVI): avval panel FAQAT shu
    // foydalanuvchi uchun HALI HECH QACHON ko'rsatilmagan bo'lsagina
    // yuborilardi (`force: false`) — maqsad: foydalanuvchi uni qo'lda
    // yig'ishtirib qo'ygan bo'lsa, bot uni majburlab qayta ochmasin.
    // Lekin bu aynan tarixni tozalashdan keyin panel butunlay
    // yo'qolib qolishiga sabab bo'lган holat edi (sessiyadagi bayroq
    // saqlanib qoladi, shu sabab panel qayta yuborilmaydi). Endi
    // `force: true` — panel HAR safar /start bosilganda qayta
    // tasdiqlanadi, shu bilan tarixni tozalashdan keyin ham har doim
    // tiklanadi (yuqoridagi `is_persistent: true` bilan birga ishlaydi).
    await ctx.reply(t("subscriber_bot_welcome", lang), { reply_markup: maybeKeyboard(ctx, keyboardForUser(ctx.from.id, lang), true) }).catch(() => {});
  }
  // GATE tekshiruvini majburlaymiz (force: true — keshni chetlab o'tib
  // haqiqiy tekshiruv). PANEL ham endi majburlanadi (keyboardForce:
  // true — standart qiymat, yuqoridagi bilan bir xil sabab: panel
  // "doim ko'rinishi" kerak, hatto tarix tozalangan bo'lsa ham).
  // TUZATILDI (foydalanuvchi talabi): `announceConfirmation: false` —
  // /start bosilganda "✅ Rahmat! Obuna tasdiqlandi." xabari ENDI
  // ko'rsatilmaydi (yuqoridagi qisqa "salom" xabari allaqachon bor),
  // lekin darvozani o'tgan deb belgilash, statistika hodisasi va asosiy
  // botga o'tish tugmasi (agar mavjud bo'lsa) baribir yuboriladi —
  // qarang sendGateOrSuccess izohi.
  return sendGateOrSuccess(ctx, bot, { force: true, announceConfirmation: false });
}

async function handleLanguageButton(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  const lang = await getUserLanguage(ctx.from.id);
  await ctx.reply(t("subscriber_bot_choose_language", lang), {
    reply_markup: {
      inline_keyboard: [[
        { text: "🇺🇿 O'zbekcha", callback_data: "sub_bot_lang_uz" },
        { text: "🇬🇧 English", callback_data: "sub_bot_lang_en" },
        { text: "🇷🇺 Русский", callback_data: "sub_bot_lang_ru" }
      ]]
    }
  }).catch(() => {});
}

// 🔗 REFERAL HAVOLA: saytga emas, shu botning o'ziga (?start=<uid>) —
// do'stlar shu havola orqali kirsa, subscriber-bot/index.ts'dagi
// `bot.command("start", ...)` payload'ni ("?start="dan keyingi qism)
// trackBotEvent orqali AnalyticsEvent'ga yozadi (metadata.payload —
// taklif qilgan foydalanuvchi ID'si), keyinroq statistika shundan
// hisoblanadi.
async function handleInviteButton(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  const lang = await getUserLanguage(ctx.from.id);
  const botUsername = ctx.me?.username;
  if (!botUsername) {
    await ctx.reply(t("subscriber_bot_invite_error", lang)).catch(() => {});
    return;
  }
  const link = `https://t.me/${botUsername}?start=${ctx.from.id}`;
  await ctx.reply(t("subscriber_bot_invite_text", lang, { link }), { parse_mode: "HTML" }).catch(() => {});
}

// 🚩 REPORT / MUROJAAT: asosiy botdagi "support_start" callback bilan
// O'XSHASH boshlanish (support_start_prompt matni) — davomi (mavzu →
// xabar) pastdagi umumiy bot.on("message:text") handlerida, handlers-text.ts'dagi
// bilan BIR XIL /api/telegram/support-ticket endpointiga yuboriladi, shu
// sabab admin panelidagi mavjud "Murojaatlar" (AdminSupportTab) bo'limida
// avtomatik ko'rinadi — alohida hech narsa qo'shish shart emas.
// TUZATILDI (foydalanuvchi talabi — "ikkala bot orasida bog'liqlik
// bormi" savoli aniqladi): asosiy bot bilan BIR XIL `awaitingSupportSubject`
// maydonidan foydalanish sessiya BO'LISHILGANI (ikkala bot bir xil
// telegramUserId bo'yicha bitta sessiya yozuvini o'qiydi/yozadi) sabab
// xato edi — agar foydalanuvchi asosiy botda murojaat boshlab, tugatmasdan
// shu (subscriber) botga o'tsa, keyingi oddiy xabari NOTO'G'RI ravishda
// "murojaat matni" deb qabul qilinardi. Endi ALOHIDA `subAwaitingSupportSubject`
// maydoni ishlatiladi (qarang: types.ts'dagi izoh) — ikkala oqim endi
// bir-biriga aralashmaydi.
async function handleReportButton(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  const lang = ctx.session.language || (await getUserLanguage(ctx.from.id));
  ctx.session.subAwaitingSupportSubject = true;
  await ctx.reply(t("subscriber_bot_report_prompt", lang), {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: t("search_cancel", lang), callback_data: "menu_home" }]] }
  }).catch(() => {});
}

// 📊 STATISTIKA / PROFIL: server tomonida (src/routes/telegram-integration.ts,
// GET /api/telegram/subscriber-referral-stats/:telegramUserId) yangi
// endpoint qo'shildi — shu bot orqali qancha ODAM taklif qilib
// keltirilganini (AnalyticsEvent'dagi subscriber_bot_start hodisalari,
// metadata.payload = ushbu foydalanuvchi ID'si bo'yicha) qaytaradi.
// Endi "👤 Profil" tugmasi ham shu funksiyani chaqiradi (funksiya nomi
// tarixiy sabablarga ko'ra o'zgartirilmadi).
async function handleStatsButton(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;
  const lang = await getUserLanguage(ctx.from.id);
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/subscriber-referral-stats/${ctx.from.id}`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET }
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data: { invitedCount: number } = await res.json();
    await ctx.reply(t("subscriber_bot_stats_text", lang, { count: data.invitedCount }), { parse_mode: "HTML" }).catch(() => {});
  } catch (err) {
    logger.warn({ err }, "Obunachi yig'ish boti: statistika olishda xato");
    await ctx.reply(t("subscriber_bot_stats_error", lang)).catch(() => {});
  }
}



// Har bir /start, oddiy xabar va "✅ Tekshirish" bosilganda shu funksiya
// ishlaydi: hozirgi holatga qarab yo darvozani (obuna bo'lmagan kanallar),
// yo muvaffaqiyat xabarini (+ asosiy botga o'tish tugmasi) ko'rsatadi.
//
// `force` — true bo'lsa (foydalanuvchi aniq /start yozgan yoki "✅
// Tekshirish" bosgan), gatePassedCache chetlab o'tiladi va HAQIQIY
// tekshiruv bajariladi. false bo'lsa (oddiy xabar), avval kesh
// tekshiriladi — foydalanuvchi yaqinda obuna tasdiqlagan bo'lsa, hech
// qanday Telegram API so'rovi yuborilmasdan jim o'tkaziladi (bu bot
// darvozadan tashqari boshqa hech qanday funksiyaga ega emas).
//
// TUZATILDI (foydalanuvchi talabi): `/start` bosilganda "✅ Rahmat!
// Obuna tasdiqlandi." xabari ENDI ko'rsatilmaydi (chunki foydalanuvchi
// buni kutmagan holda, oddiy /start bosishning o'zidayoq ko'radi — bu
// ortiqcha bildirishnoma edi), LEKIN uning ORQASIDAGI ish (darvozani
// o'tgan deb belgilash — markGatePassed, statistika hodisasi, VA asosiy
// botga o'tish tugmasi bilan xabar) BAJARILISHDA DAVOM ETADI — faqat
// aynan shu bitta tasdiq matni yuborilmaydi. Buning uchun /start
// handleri (pastda) shu funksiyani `{ announceConfirmation: false }`
// bilan chaqiradi; "✅ Tekshirish" tugmasi va callback esa foydalanuvchi
// ANIQ shu amalni bajargani uchun ANIQ natija ko'rishi kerak — ular
// standart (`announceConfirmation: true`) bilan ishlayveradi.
async function sendGateOrSuccess(ctx: MyContext, bot: Bot<MyContext>, options: { force?: boolean; keyboardForce?: boolean; announceConfirmation?: boolean; recheckTap?: boolean } = {}): Promise<void> {
  // `keyboardForce` standart holatda true — chaqiruvchilarning aksariyati
  // (✅ Tekshirish tugmasi, callback, umumiy xabar) allaqachon ochiq
  // panelga javoban ishlaydi. Faqat /start buyrug'i buni ANIQ `false`
  // qilib uzatadi (pastga qarang) — bu yerda esa PANEL_FORCE emas,
  // GATE tekshiruvi majburlanadi (options.force), ular ikki xil narsa.
  const keyboardForce = options.keyboardForce ?? true;
  const announceConfirmation = options.announceConfirmation ?? true;
  if (!ctx.from) return;
  const userId = ctx.from.id;

  if (!options.force && hasPassedGateRecently(userId)) {
    return;
  }

  // Kesh chetlab o'tilishidan OLDIN saqlab qo'yamiz — pastda "gate_passed"
  // hodisasi FAQAT foydalanuvchi ENDI o'tganida (avval o'tmagan yoki keshi
  // eskirgan bo'lsa) yozilishi uchun kerak; aks holda foydalanuvchi allaqachon
  // o'tgan holda "✅ Tekshirish"ni qayta-qayta bossa, statistikaga soxta
  // (haqiqiy yangi o'tish bo'lmagan) hodisalar qo'shilib ketardi.
  const alreadyPassed = hasPassedGateRecently(userId);

  const lang = await getUserLanguage(userId);

  const channels = await getSponsorChannelsCached();
  if (!channels || channels.length === 0) {
    // Tekshiradigan sponsor kanal umuman yo'q — demak "✅ Tekshirish"
    // tugmasining hech qanday vazifasi yo'q, shuning uchun darvoza
    // "o'tilgan" deb belgilanadi va tugma yashiriladi.
    markGatePassed(userId);
    await ctx.reply(t("subscriber_bot_no_channels", lang), { reply_markup: maybeKeyboard(ctx, replyKeyboard(lang, false), keyboardForce) }).catch(() => {});
    return;
  }

  const notSubscribed = await findNotSubscribedChannels(bot, channels, userId);

  if (notSubscribed.length === 0) {
    markGatePassed(userId);
    if (!alreadyPassed) {
      trackBotEvent("subscriber_bot_gate_passed", userId);
    }
    const openMainBotUsername = mainBotUsername?.replace("@", "");
    // MUHIM: bitta Telegram xabari bir vaqtning o'zida ham inline, ham
    // pastki (reply) klaviaturaga ega bo'la olmaydi. Shu sabab endi IKKI
    // xabar yuboriladi: (1) tasdiq matni + YANGILANGAN pastki panel —
    // "✅ Tekshirish" tugmasi ENDI kerak emasligi uchun shu yerda
    // panelidan OLIB TASHLANADI (replyKeyboard(lang, false)); (2) agar
    // asosiy bot username'i ma'lum bo'lsa, unga o'tish uchun alohida
    // inline (url) tugmali xabar.
    // `announceConfirmation=false` bo'lganda ("/start" orqali chaqirilganda)
    // FAQAT shu birinchi (tasdiq matnli) xabar o'tkazib yuboriladi — pastki
    // panel yangilanishi keyingi istalgan tugma bosilganda (keyboardForUser
    // hasPassedGateRecently'ni ENDI true qaytaradi) o'z-o'zidan to'g'rilanadi.
    if (announceConfirmation) {
      await ctx.reply(t("sponsor_gate_confirmed", lang), {
        reply_markup: maybeKeyboard(ctx, replyKeyboard(lang, false), keyboardForce)
      }).catch(() => {});
    }
    if (openMainBotUsername) {
      await ctx.reply(t("subscriber_bot_open_main_prompt", lang), {
        reply_markup: { inline_keyboard: [[{ text: t("subscriber_bot_open_main", lang), url: `https://t.me/${openMainBotUsername}` }]] }
      }).catch(() => {});
    }
    return;
  }

  clearGatePassed(userId);
  // TUZATILDI (TAKRORLANGAN DARVOZA XABARLARI — foydalanuvchi skrinshotida
  // ko'ringan muammo): avval foydalanuvchi "✅ Tekshirish" tugmasini necha
  // marta bossa ham (masalan sponsor kanal buzilgan/noto'g'ri username
  // bo'lgani uchun tekshiruv HECH QACHON o'tmasa), shuncha marta YANGI
  // to'liq darvoza xabari (kanallar ro'yxati + tugmalar) yuborilardi —
  // natijada chatda o'nlab bir xil xabar to'planib qolardi (bot
  // ishlamayotgandek taassurot qoldirardi). Asosiy botdagi xuddi shu
  // vaziyat (handlers-payment.ts'dagi "check_subscription" callback'i)
  // esa bunday holatda YANGI xabar YUBORMAYDI — faqat alert-popup
  // ko'rsatadi. Endi bu yerda ham xuddi shu naqsh qo'llaniladi: agar
  // foydalanuvchi ANIQ tugma bosib (callback — "✅ Tekshirish" yoki pastki
  // panel matnli tugmasi) qayta tekshirgan bo'lsa-yu hali obuna
  // bo'lmagan bo'lsa, faqat alert/xabar bilan ogohlantiriladi — TO'LIQ
  // darvoza xabari esa faqat DASTLABKI marta (oddiy xabar yoki /start
  // orqali, quyidagi umumiy branch'da) yuboriladi.
  const stillNotSubscribedText = t("sponsor_gate_still_not", lang, {
    channels: notSubscribed.map((c) => c.channelUsername).join(", ")
  });
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: stillNotSubscribedText, show_alert: true }).catch(() => {});
    return;
  }
  if (options.recheckTap) {
    // Pastki panelning matnli "✅ Tekshirish" tugmasi (callback emas,
    // oddiy matn xabari) — alert-popup ko'rsatib bo'lmaydi, lekin
    // baribir to'liq ro'yxatni QAYTADAN yubormaymiz, faqat qisqa
    // ogohlantirish matnini yuboramiz (spam kamayadi). `recheckTap`
    // FAQAT foydalanuvchi ANIQ "qayta tekshirish" amalini bajarganda
    // true bo'ladi (pastdagi bot.hears(CHECK_BUTTON_TEXTS) chaqiruviga
    // qarang) — /start bunda ISHTIROK ETMAYDI, shu sabab birinchi marta
    // kirganda darvoza baribir TO'LIQ (join tugmalari bilan) ko'rsatiladi.
    await ctx.reply(stillNotSubscribedText).catch(() => {});
    return;
  }
  await ctx.reply(t("sponsor_gate_title", lang), {
    parse_mode: "HTML",
    reply_markup: gateKeyboard(notSubscribed, lang)
  }).catch(() => {});
}

void (async function main() {
  const bot = await createSubscriberBot();
  mainBotUsername = await resolveMainBotUsername();

  // ✉️ Admin panelda tahrirlangan bot-xabar shablonlarini ishga
  // tushishdanoq xotiraga yuklaymiz (keyin i18n.ts ichidagi setInterval
  // davriy yangilab turadi) — aynan shu (AktivObunalar/"Obunachi
  // yig'ish") bot uchun eng muhimi shu, chunki ex_/exchange_ xabarlarning
  // deyarli barchasi shu botdan yuboriladi.
  await refreshBotMessageOverrides();

  bot.catch((err) => {
    logger.error({ err: err.error, updateId: err.ctx.update.update_id }, "Obunachi yig'ish boti: ushlanmagan global xato");
  });

  // TUZATILDI: asosiy botda registerBotCommandMenu (setMyCommands) bor
  // edi, bu botda esa yo'q edi — Telegram interfeysidagi "/" tugmasi
  // bosilganda buyruqlar ro'yxati ko'rinmasdi. Bu bot faqat /start'ga
  // ega bo'lgani uchun to'liq bot-commands.ts o'rniga shu yerda
  // to'g'ridan-to'g'ri chaqiriladi.
  bot.api.setMyCommands([
    { command: "start", description: "🚀 Obunani tekshirish / boshlash" }
  ]).catch((err) => logger.error({ err }, "Obunachi yig'ish boti: setMyCommands failed"));

  // 🚦 Asosiy botdagi bilan BIR XIL spam/DOS himoyasi — bu bot ayni
  // "ommaviy obunachi yig'ish" uchun mo'ljallangani sabab, trafik va
  // suiiste'mol xavfi ko'proq, shuning uchun himoyasiz qoldirib bo'lmaydi.
  // Bazadagi umumiy hisoblagichdan foydalanadi (telegram_rate_limit),
  // shuning uchun bir xil foydalanuvchi ikkala botni birga "flood" qilsa
  // ham cheklov ishlaydi.
  bot.use(rateLimitMiddleware);

  // 🆕 SESSIYA (asosiy botdagi bilan BIR XIL storage/kalit): endi
  // exchange bo'limi (ex_add → "kanal nomini kutyapman",
  // ex_report_other → "sabab matnini kutyapman") shu yerda ishlaydi,
  // shu sabab bu bot ham grammy `session()`ga muhtoj bo'lib qoldi.
  // `sessionStorage` (session-store.ts) telegramUserId bo'yicha
  // kalitlangan — asosiy bot ISHLATGAN BIR XIL DB yozuvi, shu bilan
  // ikkala bot bitta foydalanuvchi uchun bitta umumiy holatni ko'radi.
  bot.use(session({
    storage: sessionStorage,
    getSessionKey: (ctx) => (ctx.from?.id ? String(ctx.from.id) : ctx.chat?.id ? String(ctx.chat.id) : undefined),
    initial: (): SessionData => ({
      token: "",
      startupId: "",
      awaitingExchangeChannel: false,
      awaitingReportReason: false,
      subscriberBotKeyboardShown: false
    })
  }));

  // 🌐 TIL-YUKLASH (asosiy botdagi bilan bir xil naqsh): exchange
  // klaviaturalari (keyboards.ts'dagi exchangeMenuKeyboard/
  // backToMenuKeyboard) `ctx.session.language`ga tayanadi — bu yerda
  // avvaldan mavjud `getUserLanguage()`ni chaqirib, natijani sessiyaga
  // ham yozib qo'yamiz.
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.from && !ctx.session.language) {
      ctx.session.language = await getUserLanguage(ctx.from.id);
    }
    return next();
  });

  // 🔄 OBUNACHI YIG'ISH (exchange) bo'limi: asosiy botdagi
  // handlers-exchange.ts'dagi AYNAN BIR XIL registerExchangeHandlers()
  // qayta ishlatiladi (menu_exchange, ex_add, ex_browse, ex_mychannels,
  // ex_leaderboard, ex_invite, ex_sub_*, ex_report_* — barchasi). Bu
  // yerda hech narsa nusxalanmagan — bir xil kod, ikkita bot instance.
  // TUZATILDI: pastki reply-klaviatura (exchangePanelKeyboard) olib
  // tashlangani sabab "menu_exchange"/"ex_browse" natijasidagi ro'yxat
  // ostiga INLINE menyu tugmalari (Kanalimni qo'shish va h.k.) endi HAR
  // DOIM qo'shiladi — asosiy bot bilan bir xil (qarang handlers-exchange.ts).
  registerExchangeHandlers(bot);

  // YANGI (foydalanuvchi talabi — "obunachi yig'ish ishlarini obunachi
  // yig'ish boti qilishi kerak"): barcha "Obunachi yig'ish" davriy
  // (cron) vazifalari — sog'liq tekshiruvi, qoidabuzarlik (lapse)
  // tekshiruvi, kredit/kirish-yo'qolgan sababli to'xtatilgan kanallarni
  // avtomatik tiklash, yangi kanal e'loni — ENDI FAQAT shu botda ishga
  // tushiriladi (asosiy botda ENDI umuman chaqirilmaydi — qarang
  // telegram-bot/index.ts'dagi izoh). `bot` shu yerda subscriber bot
  // instance'ining O'ZI, shu sabab cron-jobs.ts ichidagi barcha
  // `bot.api.*` chaqiruvlari (getChatMember, sendMessage va h.k.)
  // avtomatik ravishda FAQAT shu bot tokeni bilan ishlaydi.
  registerCronJobs(bot);

  // 🆕 (BUG TUZATISH — foydalanuvchi xabar berdi): "🔄 Obunachi yig'ish"
  // ekranidagi INLINE "👤 Mening profilim" tugmasi (keyboards.ts'dagi
  // exchangeMenuKeyboard, callback_data: "menu_profile") ASOSIY botda
  // handlers-menu-callbacks.ts orqali ushlanadi, lekin bu (obunachi
  // yig'ish) bot o'sha faylni umuman ro'yxatdan o'tkazmaydi — natijada
  // bu bot tarafida callback HECH QANDAY handlerga tushmasdi va
  // foydalanuvchi (ekrandagi eski, boshqa oqim uchun ochiq qolgan holat
  // tufayli) mutlaqo bog'liq bo'lmagan "Report/murojaat" oqimiga tushib
  // qolayotgan edi. Endi shu yerda ham xuddi asosiy botdagi bilan bir
  // xil ishlaydi: profil ma'lumotlarini ko'rsatadi, xato bo'lsa shu
  // yerning o'zidagi "uy" ekraniga qaytaradi.
  //
  // TUZATILDI (foydalanuvchi talabi — "Profil" va "Mening profilim" bir
  // xil narsani ko'rsatishi kerak): avval bu yerda showProfile (SAYT
  // profili — balans/referal, ulangan hisob talab qiladi) chaqirilardi,
  // pastdagi "👤 Profil" pastki panel tugmasi esa BUTUNLAY BOSHQA,
  // ancha kambag'al kontent (faqat taklif qilingan do'stlar soni,
  // handleStatsButton) ko'rsatardi — ikkalasi mos kelmasdi. Endi
  // ikkalasi ham (bu callback VA "👤 Profil" tugmasi) bir xil
  // showExchangeSummary()ni chaqiradi: jami ball, obuna qilingan
  // kanallar soni va o'z kanaliga qancha ball/obunachi qo'shilgani.
  bot.callbackQuery("menu_profile", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) trackBotEvent("bot_menu_profile", ctx.from.id);
    try {
      await showExchangeSummary(ctx);
    } catch (err: unknown) {
      logger.warn({ err }, "Obunachi yig'ish boti: menu_profile callback xatosi");
      const lang = ctx.session.language || (ctx.from ? await getUserLanguage(ctx.from.id) : "uz");
      await ctx.reply(t("profile_load_error", lang)).catch(() => {});
    }
  });

  // 🔙 Exchange ekranlaridagi "🔙 Bosh menyu" tugmasi (callback_data:
  // "menu_home") asosiy botda katta bosh menyuga olib boradi — bu bot
  // esa bunday menyuga ega emas, shu sabab shu yerda o'ziga xos, sodda
  // "uy" ekrani (pastki panel + salomlashuv) ko'rsatiladi.
  bot.callbackQuery("menu_home", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    // TUZATILDI: "Obunachi yig'ish" bo'limidagi pastki panel (exchange)
    // holatidan chiqilganda bayroq "main"ga qaytariladi — shundan keyin
    // foydalanuvchi qayta "🔄 Obunachi yig'ish" bossa, panel yana to'g'ri
    // almashtiriladi (aks holda ichki flag "exchange"da qolib ketib,
    // kerakli qisqa almashtirish xabari qayta yuborilmay qolar edi).
    ctx.session.subscriberBotPanelMode = "main";
    const lang = ctx.session.language || (await getUserLanguage(ctx.from.id));
    await ctx.reply(t("subscriber_bot_welcome", lang), { reply_markup: maybeKeyboard(ctx, keyboardForUser(ctx.from.id, lang), true) }).catch(() => {});
  });

  // TUZATILDI (REFERAL/DEEP-LINK): avval ?start=XXX parametri butunlay
  // e'tiborsiz qoldirilardi — "obunachi yig'ish" boti uchun kim qaysi
  // havola orqali kelganini bilish muhim (masalan referal tizimi
  // uchun). Endi ctx.match (Telegramning /start payload'i) olinadi va
  // trackBotEvent orqali AnalyticsEvent.metadata.payload sifatida
  // yoziladi — shu bilan admin keyinchalik qaysi havola ko'proq
  // obunachi keltirganini tahlil qila oladi.
  bot.command("start", async (ctx) => {
    const payload = typeof ctx.match === "string" && ctx.match ? ctx.match : undefined;
    if (ctx.from) trackBotEvent("subscriber_bot_start", ctx.from.id, payload);

    // YANGI (foydalanuvchi talabi — "botga birinchi start bosilganida
    // tilni tanlash tugmalari chiqsin"): foydalanuvchi HALI hech qachon
    // tilni aniq tanlamagan bo'lsa, pastdagi "salom + darvoza" oqimidan
    // OLDIN til tanlash ekrani ko'rsatiladi. Tugma bosilgach
    // "start_sub_lang_(uz|en|ru)" callback'i (pastda) xuddi shu /start
    // oqimini (salom xabari + darvoza tekshiruvi) davom ettiradi — shu
    // sabab referal payload'ni ham saqlab qo'yamiz (kamdan-kam holatda
    // kerak bo'lsa-da, statistika uchun allaqachon yuqorida yozildi).
    if (ctx.from && !(await hasUserChosenLanguage(ctx.from.id))) {
      await ctx.reply(t("choose_language", "uz"), {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "🇺🇿 O'zbekcha", callback_data: "start_sub_lang_uz" },
            { text: "🇬🇧 English", callback_data: "start_sub_lang_en" },
            { text: "🇷🇺 Русский", callback_data: "start_sub_lang_ru" }
          ]]
        }
      }).catch(() => {});
      return;
    }

    return sendSubscriberBotWelcomeAndGate(ctx, bot);
  });
  bot.callbackQuery(["start_sub_lang_uz", "start_sub_lang_en", "start_sub_lang_ru"], async (ctx) => {
    if (!ctx.from) return;
    const newLang: Lang = ctx.callbackQuery.data === "start_sub_lang_en" ? "en" : ctx.callbackQuery.data === "start_sub_lang_ru" ? "ru" : "uz";
    await setUserLanguage(ctx.from.id, newLang);
    ctx.session.language = newLang;
    const confirmKey = newLang === "en" ? "language_set_en" : newLang === "ru" ? "language_set_ru" : "language_set_uz";
    await ctx.answerCallbackQuery(t(confirmKey, newLang)).catch(() => {});
    // Til birinchi marta tanlangach, xuddi oddiy "/start" bosilgandagidek
    // davom etamiz — salom xabari + darvoza tekshiruvi.
    return sendSubscriberBotWelcomeAndGate(ctx, bot);
  });
  bot.callbackQuery("sub_bot_check", (ctx) => sendGateOrSuccess(ctx, bot, { force: true, recheckTap: true }));
  // 🆕 PASTKI REPLY-KLAVIATURA TUGMASI: foydalanuvchi pastdagi doimiy
  // "✅ Tekshirish" tugmasini bossa, Telegram buni oddiy matnli xabar
  // sifatida yuboradi (callback_data emas) — shuning uchun bu matn
  // (barcha tillar bo'yicha, CHECK_BUTTON_TEXTS) alohida `bot.hears` bilan
  // ushlanadi va inline "✅ Tekshirish" tugmasi bilan BIR XIL (force: true,
  // ya'ni keshni chetlab o'tib, haqiqiy tekshiruv) natijani beradi. Bu
  // handler pastdagi umumiy `bot.on("message")`dan OLDIN ro'yxatdan
  // o'tkazilgan — shu tugma matniga mos xabarlar pastdagi force:false
  // yo'liga tushib qolmasligi uchun.
  bot.hears([...CHECK_BUTTON_TEXTS], (ctx) => sendGateOrSuccess(ctx, bot, { force: true, recheckTap: true }));
  bot.hears([...LANGUAGE_BUTTON_TEXTS], (ctx) => handleLanguageButton(ctx));
  bot.hears([...INVITE_BUTTON_TEXTS], (ctx) => handleInviteButton(ctx));
  bot.hears([...STATS_BUTTON_TEXTS], (ctx) => handleStatsButton(ctx));
  // TUZATILDI (foydalanuvchi talabi): "👤 Profil" endi "👤 Mening
  // profilim" bilan AYNAN BIR XIL ekranni (showExchangeSummary —
  // ball, obuna qilingan kanallar soni, o'z kanaliga qo'shilgan
  // ball/obunachi) ko'rsatadi — avval bu yerda handleStatsButton
  // chaqirilardi, u esa faqat taklif qilingan do'stlar sonini
  // ko'rsatib, foydalanuvchini "bu tugma nimaga kerak" deb
  // chalkashtirardi.
  bot.hears([...PROFILE_BUTTON_TEXTS], async (ctx) => {
    if (ctx.from) trackBotEvent("bot_menu_profile", ctx.from.id);
    await showExchangeSummary(ctx);
  });
  bot.hears([...REPORT_BUTTON_TEXTS], (ctx) => {
    trackBotEvent("subscriber_bot_report_start", ctx.from?.id);
    return handleReportButton(ctx);
  });
  bot.hears([...RULES_BUTTON_TEXTS], (ctx) => {
    trackBotEvent("subscriber_bot_rules_viewed", ctx.from?.id);
    return handleExchangeInfo(ctx);
  });
  // 🆕 Pastki panelning "🔄 Obunachi yig'ish" tugmasi — asosiy botdagi
  // handleMenuExchange() (exchange-service.ts) bilan bir xil ekranni
  // ochadi, SO'NG (foydalanuvchi so'rovi bo'yicha) pastki panelni
  // exchange bo'limi tugmalariga almashtiradi — shu bo'lim ichidagi har
  // bir amal (kanal qo'shish, obuna bo'lish va h.k.) endi pastki
  // panel orqali ham qilinishi mumkin, "🏠 Bosh menyu" bosilgach esa
  // (pastdagi EX_HOME_BUTTON_TEXTS yoki inline "menu_home") asosiy
  // panelga qaytadi.
  bot.hears([...EXCHANGE_BUTTON_TEXTS], async (ctx) => {
    trackBotEvent("subscriber_bot_menu_exchange", ctx.from?.id);
    // TUZATILDI (foydalanuvchi talabi — skrinshot bilan: asosiy pastki
    // panel (Profil/Report/Til/...) "Obunachi yig'ish" bosilganda
    // butunlay YO'QOLIB, o'rniga shu bo'lim tugmalari (Do'stlarni taklif
    // qilish, Kanalimni qo'shish, Qoida va bonuslar, Mening kanallarim,
    // Bosh menyu, Reyting) PASTKI panel sifatida chiqishi kerak edi —
    // ilgari ular faqat INLINE (xabar ostida) chiqib, asosiy panel
    // pastda ko'rinib turaverardi. `useReplyPanel=true` shu bilan
    // exchange-service.ts'ga aynan shu almashtirishni amalga oshirishni
    // buyuradi (qarang o'sha fayldagi izoh).
    await handleMenuExchange(bot, ctx, true, true);
  });
  // 🆕 EXCHANGE PANELINING QOLGAN TUGMALARI: asosiy botdagi INLINE
  // exchangeMenuKeyboard bilan BIR XIL handlerlarni chaqiradi
  // (handlers-exchange.ts'dan endi eksport qilingan) — hech narsa
  // nusxalanmagan, faqat qayta ishlatilgan.
  bot.hears([...EX_ADD_BUTTON_TEXTS], async (ctx) => {
    trackBotEvent("subscriber_bot_exchange_add", ctx.from?.id);
    await handleExchangeAdd(ctx);
  });
  bot.hears([...EX_BROWSE_BUTTON_TEXTS], async (ctx) => {
    trackBotEvent("subscriber_bot_exchange_browse", ctx.from?.id);
    // TUZATILDI: pastki panel (exchangePanelKeyboard) olib tashlandi —
    // endi standart `includeMenuActions=true` bilan bo'lim amallari
    // shu INLINE ro'yxat ostida ko'rsatiladi.
    await handleExchangeBrowse(bot, ctx, true);
  });
  bot.hears([...EX_MYCHANNELS_BUTTON_TEXTS], async (ctx) => {
    trackBotEvent("subscriber_bot_exchange_mychannels", ctx.from?.id);
    await handleExchangeMyChannels(ctx);
  });
  bot.hears([...EX_LEADERBOARD_BUTTON_TEXTS], async (ctx) => {
    trackBotEvent("subscriber_bot_exchange_leaderboard", ctx.from?.id);
    await handleExchangeLeaderboard(ctx);
  });
  bot.hears([...EX_INVITE_BUTTON_TEXTS], async (ctx) => {
    trackBotEvent("subscriber_bot_exchange_invite", ctx.from?.id);
    await handleExchangeInvite(ctx);
  });
  bot.hears([...EX_INFO_BUTTON_TEXTS], async (ctx) => {
    trackBotEvent("subscriber_bot_exchange_info", ctx.from?.id);
    await handleExchangeInfo(ctx);
  });
  // 🆕 Exchange panelidagi "🏠 Bosh menyu" — asosiy "menu_home" callback
  // bilan BIR XIL sodda "uy" ekranini ko'rsatadi (yuqoridagi
  // bot.callbackQuery("menu_home", ...)ga qarang) VA pastki panelni
  // asosiy panelga qaytaradi.
  bot.hears([...EX_HOME_BUTTON_TEXTS], async (ctx) => {
    if (!ctx.from) return;
    trackBotEvent("subscriber_bot_exchange_home", ctx.from.id);
    // TUZATILDI: pastki panelni "exchange"dan "main"ga qaytaradi — shu
    // bilan yuboriladigan `keyboardForUser` xabari eski (exchange) pastki
    // panelni asosiy panel bilan ALMASHTIRADI (Telegramda reply-klaviatura
    // bittadan ortiq bo'lolmaydi).
    ctx.session.subscriberBotPanelMode = "main";
    const lang = ctx.session.language || (await getUserLanguage(ctx.from.id));
    await ctx.reply(t("subscriber_bot_welcome", lang), { reply_markup: keyboardForUser(ctx.from.id, lang) }).catch(() => {});
  });
  bot.callbackQuery(["sub_bot_lang_uz", "sub_bot_lang_en", "sub_bot_lang_ru"], async (ctx) => {
    if (!ctx.from) return;
    const newLang: Lang = ctx.callbackQuery.data === "sub_bot_lang_en" ? "en" : ctx.callbackQuery.data === "sub_bot_lang_ru" ? "ru" : "uz";
    await setUserLanguage(ctx.from.id, newLang);
    ctx.session.language = newLang;
    const confirmKey = newLang === "en" ? "language_set_en" : newLang === "ru" ? "language_set_ru" : "language_set_uz";
    await ctx.answerCallbackQuery(t(confirmKey, newLang)).catch(() => {});
    await ctx.reply(t("subscriber_bot_welcome", newLang), { reply_markup: maybeKeyboard(ctx, keyboardForUser(ctx.from.id, newLang), true) }).catch(() => {});
  });

  // 🆕 "🚩 Kanaldan shikoyat qilish" oqimining "Boshqa sabab" bosqichi —
  // ex_report_other_* bosilgach ctx.session.awaitingReportReason=true
  // qo'yiladi (registerExchangeHandlers ichida), keyingi erkin matn shu
  // yerda ushlanadi. handlers-exchange.ts/exchange-service.ts bilan BIR
  // XIL kod (handleExchangeReportReasonText) — asosiy botdagi
  // handlers-text.ts'dagi bilan aynan bir xil.
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.session?.awaitingReportReason) return next();
    await handleExchangeReportReasonText(ctx, ctx.message.text);
  });

  // 🚩 "Report" pastki panel tugmasi bilan boshlangan murojaat oqimining
  // ikkinchi/uchinchi bosqichi (mavzu, so'ng xabar matni) — asosiy
  // botdagi handlers-text.ts'dagi awaitingSupportSubject/
  // awaitingSupportMessage bilan MANTIQ jihatidan BIR XIL (bitta umumiy
  // funksiyaga chiqarilmadi, chunki handlers-text.ts registerTextHandlers()
  // butun bir zanjir bo'lib, bu yerga to'g'ridan-to'g'ri ulash asosiy
  // botga tegishli boshqa (mahsulot/qidiruv) handlerlarni ham olib
  // kelardi). TUZATILDI (foydalanuvchi talabi — "ikkala bot orasida
  // bog'liqlik bormi" savoli aniqladi): MAYDON NOMLARI endi ALOHIDA
  // (subAwaitingSupportSubject/subAwaitingSupportMessage/subSupportSubject)
  // — asosiy bot bilan BIR XIL nomdan foydalanish, ikkala bot bir xil
  // sessiya yozuvini bo'lishgani sabab, foydalanuvchi bir botda murojaat
  // boshlab tugatmasdan boshqasiga o'tsa, xabarini noto'g'ri oqimga
  // yuborib qo'yardi (qarang: types.ts'dagi izoh). Natija baribir BIR
  // XIL backend endpoint (/api/telegram/support-ticket) ga boradi, shu
  // sabab admin panelidagi mavjud "Murojaatlar" bo'limida bu botdan
  // kelgan murojaatlar ham asosiy bot bilan bir qatorda ko'rinadi.
  bot.on("message:text", async (ctx, next) => {
    const lang = ctx.session?.language || "uz";

    if (ctx.session?.subAwaitingSupportSubject) {
      ctx.session.subAwaitingSupportSubject = false;
      const subject = ctx.message.text.trim();
      if (subject.length < 2) {
        ctx.session.subAwaitingSupportSubject = true;
        await ctx.reply(t("support_subject_short", lang)).catch(() => {});
        return;
      }
      ctx.session.subSupportSubject = subject;
      ctx.session.subAwaitingSupportMessage = true;
      await ctx.reply(t("support_message_prompt", lang), {
        reply_markup: { inline_keyboard: [[{ text: t("search_cancel", lang), callback_data: "menu_home" }]] }
      }).catch(() => {});
      return;
    }

    if (ctx.session?.subAwaitingSupportMessage) {
      const message = ctx.message.text.trim();
      const subject = ctx.session.subSupportSubject;
      if (message.length < 5) {
        await ctx.reply(t("support_message_short", lang)).catch(() => {});
        return;
      }
      ctx.session.subAwaitingSupportMessage = false;
      ctx.session.subSupportSubject = undefined;
      try {
        const res = await fetch(`${process.env.APP_URL}/api/telegram/support-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
          body: JSON.stringify({ telegramUserId: ctx.from?.id, subject, message })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          await ctx.reply(`❌ ${data.error || t("support_submit_error", lang)}`).catch(() => {});
          return;
        }
        trackBotEvent("subscriber_bot_report_submitted", ctx.from?.id);
        await ctx.reply(t("support_submit_success", lang)).catch(() => {});
      } catch (err: unknown) {
        logger.error({ err }, "subscriber-bot report/support-ticket submit error");
        await ctx.reply(t("support_submit_error", lang)).catch(() => {});
      }
      return;
    }

    return next();
  });

  // 🆕 "➕ Kanalimni qo'shish" (ex_add) oqimi — foydalanuvchi kanaldan
  // forward qilgan xabar, @username yoki t.me havolasini yuborganda shu
  // yerda ushlanadi (matn bo'lmagan forward'larni ham ushlash uchun
  // "message:text" emas, umumiy "message"). Asosiy botdagi
  // handlers-text.ts bilan BIR XIL kod (handleExchangeChannelRegistrationMessage).
  bot.on("message", async (ctx, next) => {
    if (!ctx.session?.awaitingExchangeChannel) return next();
    // TUZATILDI (foydalanuvchi talabi — avtomatik davom ettirish): kanal
    // MUVAFFAQIYATLI ulangandan so'ng (funksiya `true` qaytarsa),
    // foydalanuvchi qayta "🔄 Obunachi yig'ish" tugmasini bosishi shart
    // emas — "📋 Kanallarga obuna bo'lish" ro'yxati darhol ko'rsatiladi.
    const added = await handleExchangeChannelRegistrationMessage(bot, ctx);
    if (added) {
      // TUZATILDI: pastki panel olib tashlandi — endi standart
      // `includeMenuActions=true` bilan bo'lim amallari shu INLINE
      // ro'yxat ostida ko'rsatiladi.
      await handleExchangeBrowse(bot, ctx, true);
    }
  });

  // Boshqa har qanday xabar ham xuddi shu darvoza/tasdiq oqimini ko'rsatadi —
  // lekin YUQORIDAGI kesh tufayli, obuna yaqinda tasdiqlangan foydalanuvchi
  // uchun bu qayta Telegram API so'rovi yubormaydi (force: false, standart).
  bot.on("message", (ctx) => sendGateOrSuccess(ctx, bot));

  bot.start();
  logger.info("📢 Obunachi yig'ish boti ishga tushdi.");
})().catch((err) => {
  logger.error({ err }, "Obunachi yig'ish botini ishga tushirishda halokatli xato — process to'xtatilmoqda.");
  process.exit(1);
});
