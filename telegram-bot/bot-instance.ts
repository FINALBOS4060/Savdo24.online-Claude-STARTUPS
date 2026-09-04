// Bot instance yaratish: token'ni aniqlash (bazadan yoki .env'dan) va
// global xato ushlagichni (bot.catch) o'rnatish. Bu ASYNC funksiya —
// index.ts o'zining "main()" o'rovi ichida `await createBot()` deb
// chaqiradi (CJS/ESM'da top-level await muammosidan qochish uchun).
import { Bot } from "grammy";
import { logger } from "../src/lib/logger";
import { t } from "./i18n";
import { MyContext } from "./types";
import { TELEGRAM_BOT_INTERNAL_SECRET } from "./secret";
import { backToMenuKeyboard } from "./keyboards";

// TUZATISH: avval botToken FAQAT .env'dan olinardi. Admin panelda
// TELEGRAM_BOT_TOKEN'ni tahrirlash Setting jadvaliga yozardi-yu, alohida
// PM2 jarayoni sifatida ishga tushgan bot buni umuman ko'rmasdi. Endi
// ishga tushishdan oldin serverdan (agar u allaqachon ishlab turgan bo'lsa)
// GET /api/telegram/internal/bot-token orqali bazadagi qiymat so'raladi va
// topilsa ustunlik beriladi. Server hali ishlamayotgan bo'lsa, APP_URL
// sozlanmagan bo'lsa, yoki bazada qiymat bo'lmasa — jim ravishda .env
// qiymatiga qaytiladi (token manbai ikkinchi darajali masala, bot baribir
// ishga tushishi kerak).
//
// 🆕 IKKINCHI BOT (OBUNACHI YIG'ISH): xuddi shu resolve mantig'i endi
// parametrlashtirilgan (resolveToken) — shu bilan asosiy bot va
// "obunachi yig'ish" boti (subscriber-bot/index.ts) BIR XIL kod yo'lidan
// (.env → bazadagi qiymat bilan ustun qo'yish) foydalanadi, faqat har
// biri o'z env o'zgaruvchisi/endpoint variantidan token oladi.
interface TokenResolutionConfig {
  envVarNames: string[];
  internalTokenPath: string;
}

async function resolveToken(config: TokenResolutionConfig): Promise<string> {
  const envToken = config.envVarNames.map((name) => process.env[name]).find((v) => !!v) || "";

  if (!process.env.APP_URL || !TELEGRAM_BOT_INTERNAL_SECRET) {
    return envToken;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${process.env.APP_URL}${config.internalTokenPath}`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn({ status: res.status }, "Bazadan bot tokenini olib bo'lmadi (server javobi xato) — .env qiymatiga o'tildi.");
      return envToken;
    }

    const data = await res.json();
    if (data?.token && typeof data.token === "string" && data.token.length > 10) {
      logger.info("Bot tokeni bazadan (admin panelda sozlangan) olindi.");
      return data.token;
    }
    return envToken;
  } catch (err) {
    // Server hali ishga tushmagan bo'lishi mumkin (PM2 ikkala jarayonni
    // deyarli bir vaqtda boshlaydi) — bu kutilgan holat, xato emas.
    logger.warn({ err }, "Bazadan bot tokenini so'rashda xatolik (server hali ishga tushmagan bo'lishi mumkin) — .env qiymatiga o'tildi.");
    return envToken;
  }
}

async function resolveBotToken(): Promise<string> {
  return resolveToken({
    envVarNames: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_API_TOKEN"],
    internalTokenPath: "/api/telegram/internal/bot-token"
  });
}

// 🆕 "Obunachi yig'ish" boti uchun ikkinchi token — .env'da
// TELEGRAM_SUBSCRIBER_BOT_TOKEN, admin panelda ham alohida maydon
// (src/routes/admin-settings.ts'dagi ALL_KEYS'ga qarang).
async function resolveSubscriberBotToken(): Promise<string> {
  return resolveToken({
    envVarNames: ["TELEGRAM_SUBSCRIBER_BOT_TOKEN"],
    internalTokenPath: "/api/telegram/internal/bot-token?bot=subscriber"
  });
}

// YANGI (foydalanuvchi talabi — "kanallar navbatdan o'chib qolyapti"
// bugi tuzatildi): exchange-service.ts'dagi sog'liq tekshiruvi (health
// check) ENDI ikkala botning ham admin holatini tekshirishi kerak —
// qarang shu fayldagi yuqoridagi izoh va exchange-service.ts'dagi
// checkExchangeChannelHealth. Shu sabab resolveSubscriberBotToken
// tashqariga eksport qilindi (avval faqat shu fayl ichida ishlatilardi).
export { resolveSubscriberBotToken };

export async function createBot(): Promise<Bot<MyContext>> {
  const botToken = await resolveBotToken();

  // MUHIM: agar botToken bo'sh bo'lsa, `new Bot("")` grammy ichida darhol
  // (tushunarsiz, inglizcha) xato tashlaydi — PM2 buni cheksiz qayta ishga
  // tushirishga (restart loop) urinardi, log'da esa haqiqiy sabab yo'qolib
  // ketardi.
  if (!botToken) {
    logger.error("TELEGRAM_BOT_TOKEN (yoki TELEGRAM_BOT_API_TOKEN) .env faylida sozlanmagan — bot ishga tushmaydi.");
    process.exit(1);
  }
  if (!process.env.APP_URL) {
    logger.error("APP_URL .env faylida sozlanmagan — bot server bilan bog'lana olmaydi (barcha so'rovlar 'undefined/api/...' manziliga ketardi).");
    process.exit(1);
  }

  const bot = new Bot<MyContext>(botToken);

  // MUHIM (ISHONCHLILIK): grammy'da global xato ushlagich bo'lmasa, biror
  // handler ichida kutilmagan xato sodir bo'lsa (masalan
  // ctx.answerCallbackQuery() muddati o'tgan callback uchun xato qaytarsa)
  // — o'sha bitta xato butun botni to'xtatib qo'yishi (yoki kamida
  // foydalanuvchini javobsiz qoldirishi) mumkin edi. Endi har qanday
  // kutilmagan xato shu yerda ushlanadi, log qilinadi va foydalanuvchi
  // bosh menyu bilan tushunarli xabar oladi — bot boshqa foydalanuvchilar
  // uchun ishlashda davom etadi.
  bot.catch((err) => {
    const ctx = err.ctx;
    logger.error({ err: err.error, updateId: ctx.update.update_id }, "Ushlanmagan bot xatosi (global handler)");
    ctx.reply(t("unexpected_error", ctx.session?.language || "uz"), {
      reply_markup: backToMenuKeyboard(ctx)
    }).catch(() => {
      // Foydalanuvchiga xabar ham yuborib bo'lmasa (masalan u botni bloklagan
      // bo'lsa), jim o'tkazamiz — bu holatda qilishimiz mumkin bo'lgan narsa yo'q.
    });
  });

  return bot;
}

// YANGI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
// botining bir-biriga aloqasi bo'lmasligi kerak"): asosiy bot endi
// "Obunachi yig'ish" bo'limini o'zi ISHLAMAYDI — foydalanuvchini
// subscriber-bot'ga YO'NALTIRADI. Buning uchun subscriber botning
// @username'i kerak (resolveMainBotUsername'ning aksi). 5 daqiqalik
// oddiy xotira-kesh bilan — bu qiymat deyarli hech qachon
// o'zgarmaydi, shu sabab har bosishda Telegramga so'rov yubormaslik
// uchun kifoya.
let subscriberBotUsernameCache: { username: string; expiresAt: number } | null = null;

export async function resolveSubscriberBotUsername(): Promise<string | undefined> {
  if (subscriberBotUsernameCache && subscriberBotUsernameCache.expiresAt > Date.now()) {
    return subscriberBotUsernameCache.username;
  }
  try {
    const token = await resolveSubscriberBotToken();
    if (!token) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: controller.signal });
    clearTimeout(timer);
    const data: any = await res.json().catch(() => null);
    if (res.ok && data?.ok && data.result?.username) {
      subscriberBotUsernameCache = { username: data.result.username, expiresAt: Date.now() + 5 * 60 * 1000 };
      return subscriberBotUsernameCache.username;
    }
    return undefined;
  } catch (err) {
    logger.warn({ err }, "resolveSubscriberBotUsername: Telegram so'rovida xato");
    return undefined;
  }
}

// 🆕 IKKINCHI, MUSTAQIL BOT INSTANCE: "obunachi yig'ish" boti uchun.
// Asosiy botdan BUTUNLAY BOSHQA tokendan (TELEGRAM_SUBSCRIBER_BOT_TOKEN)
// foydalanadi — shu sabab Telegram'da alohida bot sifatida ko'rinadi (o'z
// @username'i, o'z suhbatlari, sponsor kanallarga o'zi alohida admin
// qilib qo'shilishi kerak). Bu bot asosiy botning menyu/sessiya
// tizimidan foydalanmagani uchun oddiy `Bot` (MyContext/SessionFlavor'siz)
// qaytaradi — qarang: telegram-bot/subscriber-bot/index.ts.
// 🆕 TUZATISH: MAIN_BOT_USERNAME endi admin panelda ham tahrirlanadi
// (src/routes/admin-settings.ts ALL_KEYS), lekin "obunachi yig'ish" boti
// buni avval FAQAT process.env'dan o'qirdi. Endi bot-token bilan bir xil
// naqsh: avval bazadagi (admin panelda sozlangan) qiymat so'raladi,
// server hali ishlamayotgan bo'lsa yoki bazada bo'lmasa — .env qiymatiga
// jim ravishda qaytiladi.
export async function resolveMainBotUsername(): Promise<string | undefined> {
  const envValue = process.env.MAIN_BOT_USERNAME;

  if (!process.env.APP_URL || !TELEGRAM_BOT_INTERNAL_SECRET) {
    return envValue;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${process.env.APP_URL}/api/telegram/internal/main-bot-username`, {
      headers: { "x-telegram-bot-secret": TELEGRAM_BOT_INTERNAL_SECRET },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) return envValue;

    const data = await res.json();
    if (data?.username && typeof data.username === "string") return data.username;
    return envValue;
  } catch (err) {
    logger.warn({ err }, "Bazadan MAIN_BOT_USERNAME'ni so'rashda xatolik — .env qiymatiga o'tildi.");
    return envValue;
  }
}

// TUZATILDI (OBUNACHI YIG'ISH BOTIGA EXCHANGE FUNKSIYASI QO'SHILDI):
// avval bu bot oddiy `Bot` (MyContext/SessionFlavor'siz) qaytarardi,
// chunki faqat sponsor-gate tekshiruvi uchun ishlatilardi va sessiyaga
// muhtoj emas edi. Endi subscriber-bot/index.ts asosiy botdagi "🔄
// Obunachi yig'ish" (exchange) bo'limini ham (registerExchangeHandlers
// orqali) qayta ishlatadi — bu esa ctx.session (awaitingExchangeChannel,
// awaitingReportReason, til keshi) talab qiladi. Shu sabab endi
// `Bot<MyContext>` qaytariladi (asosiy bot bilan BIR XIL tip) —
// subscriber-bot/index.ts endi `session()` middleware'ini xuddi asosiy
// bot bilan bir xil `sessionStorage`ga ulaydi.
export async function createSubscriberBot(): Promise<Bot<MyContext>> {
  const botToken = await resolveSubscriberBotToken();

  if (!botToken) {
    logger.error("TELEGRAM_SUBSCRIBER_BOT_TOKEN .env faylida (yoki admin panelda) sozlanmagan — obunachi yig'ish boti ishga tushmaydi.");
    process.exit(1);
  }
  if (!process.env.APP_URL) {
    logger.error("APP_URL .env faylida sozlanmagan — obunachi yig'ish boti server bilan bog'lana olmaydi.");
    process.exit(1);
  }

  return new Bot<MyContext>(botToken);
}
