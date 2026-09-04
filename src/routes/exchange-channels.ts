// Arxitektura: Telegram bot (grammy) da haqiqiy a'zolik holatini
// tekshirish uchun kerakli huquq (getChatMember) odatda bot processida
// ishlatiladi (davriy sog'liq-tekshiruvi, checkExchangeChannelHealth);
// bu yerdagi endpointlarning aksariyati botdan kelgan natijalarni
// saqlaydi/o'qiydi. LEKIN pastdagi "/unblock" endpointi (admin bitta
// kanalni qo'lda blokdan chiqarganda) buning YAGONA istisnosi — chunki
// bu holatda darhol, aniq javob kerak (admin panelda kutish shart emas),
// shu sabab shu yerning o'zida (server.ts/admin-settings.ts'dagi bilan
// BIR XIL naqsh — bevosita https://api.telegram.org/bot<token>/...
// so'rovi) tekshiriladi, grammy/bot-processga muhtoj emas.
import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
import { encryptSecret } from "../lib/crypto";
// Obuna almashish tizimi ("odamlar o'zaro obunachi yig'adigan" bo'lim).
// MUHIM: bu SponsorChannel/majburiy-obuna tizimidan BUTUNLAY mustaqil —
// admin qo'shgan majburiy kanallarga hech qanday aloqasi yo'q, faqat
// oddiy foydalanuvchilar o'z kanalini qo'shib, bir-birlariga navbat
// asosida ko'rsatiladigan tizim.
import { prisma, getSetting, authenticateToken, requireAdmin, AuthRequest, sendTelegramMessage, notifyAdminTelegram, createNotification, TELEGRAM_BOT_INTERNAL_SECRET, isPostgres } from "../lib/context";
import { renderBotMessage, BOT_MSG_SETTING_PREFIX } from "../lib/botMessages";
import { BOT_MESSAGE_DEFAULTS, extractPlaceholders } from "../lib/botMessageDefaults";
import { safeCompare, getErrorMessage, getErrorCode, APP_TIMEZONE, getStartOfDayInTimezone } from "../lib/pure-helpers";


const router = Router();
const adminRouter = Router();

// YANGI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
// botining bir-biriga aloqasi bo'lmasligi kerak"): "Obunachi yig'ish"
// bo'limining barcha Telegram bildirishnomalari (referal mukofoti,
// obunachi krediti va h.k.) endi FAQAT TELEGRAM_SUBSCRIBER_BOT_TOKEN
// bilan yuboriladi — sendTelegramMessage() ning standart (asosiy bot)
// tokenidan FOYDALANILMAYDI. Agar biror sabab bilan bu token sozlanmagan
// bo'lsa, xabar shunchaki yuborilmaydi (asosiy botga "orqaga tushib"
// yubormaymiz — aynan shu "orqaga tushish" foydalanuvchi aytgan
// muammoning o'zi edi).
async function resolveSubscriberBotTokenForNotify(): Promise<string | null> {
  return (await getSetting("TELEGRAM_SUBSCRIBER_BOT_TOKEN")) || process.env.TELEGRAM_SUBSCRIBER_BOT_TOKEN || null;
}

const DEFAULT_MAX_CHANNELS_PER_USER = 1;

// TUZATILDI: bitta Telegram akkaunt bir kunda eng ko'pi bilan nechta YANGI
// (avval umuman obuna bo'lmagan) kanalga "obuna bo'ldim" deb belgilay olishi
// mumkinligi chegarasi — ko'p sonli zaxira akkauntlar bilan tez-tez
// almashtirib obunachi "farm" qilishni sekinlashtirish uchun. Faqat YANGI
// (ilgari umuman bo'lmagan) obunalarga hisoblanadi, mavjud obunani qayta
// tasdiqlash (masalan davriy tekshiruvdan keyin) bunga kirmaydi.
const DEFAULT_MAX_NEW_SUBS_PER_DAY = 30;

// Har bir HAQIQIY (getChatMember bilan tasdiqlangan) obuna sayt profilida
// necha obunachi sifatida hisoblanadi. Masalan: bitta haqiqiy obuna
// standart holatda 2 ta obunachi sifatida ko'rsatiladi. FAQAT
// ko'rsatilgan (subscriberCount) songa ta'sir qiladi — navbat,
// qoidabuzarlik tekshiruvi va boshqa barcha mantiq hamon HAQIQIY (1x)
// ExchangeSubscription yozuvlari asosida ishlaydi, o'zgarmagan.
// TUZATILDI (admin talabi — "1 kanalga obuna bo'lsa necha ta obunachi
// qo'shilishi kerakligini admin paneldan sozlash"): avval bu qattiq
// kodlangan (EXCHANGE_SUBSCRIBER_MULTIPLIER = 2) qiymat edi. Endi boshqa
// EXCHANGE_* sozlamalar (getMaxNewSubsPerDay va h.k.) bilan BIR XIL naqsh: `getSetting` orqali bazadan o'qiladi,
// admin panelda "Tizim sozlamalari" bo'limida (ALL_KEYS ro'yxati orqali)
// istalgan songa (masalan 100) o'zgartirilishi mumkin. Sozlama umuman
// yozilmagan bo'lsa — standart 2 ishlatiladi.
const DEFAULT_EXCHANGE_SUBSCRIBER_MULTIPLIER = 2;

async function getSubscriberMultiplier(): Promise<number> {
  const raw = await getSetting("EXCHANGE_SUBSCRIBER_MULTIPLIER");
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXCHANGE_SUBSCRIBER_MULTIPLIER;
}

// Referal orqali: taklif qilingan odam O'Z KANALINI (birinchi marta)
// qo'shsa, taklif qilgan odamga shuncha BONUS obunachi qo'shiladi.
// TUZATILDI: yuqoridagi kabi endi admin paneldan sozlanadi (standart 5).
const DEFAULT_EXCHANGE_REFERRAL_BONUS = 5;

async function getReferralBonus(): Promise<number> {
  const raw = await getSetting("EXCHANGE_REFERRAL_BONUS");
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_EXCHANGE_REFERRAL_BONUS;
}

// "Xush kelibsiz bonusi": foydalanuvchi botga ILK MARTA o'z kanalini
// ulasa, unga o'ziga shuncha bonus obunachi (kredit) beriladi (referaldan
// mustaqil, har bir yangi foydalanuvchiga bir martalik). ExchangeWelcomeBonus
// jadvalidagi yozuv orqali "allaqachon berilganmi" doimiy tekshiriladi.
// TUZATILDI: yuqoridagi kabi endi admin paneldan sozlanadi (standart 20,
// foydalanuvchi talabi bo'yicha avvalgi 5'dan oshirildi).
const DEFAULT_EXCHANGE_WELCOME_BONUS = 20;

async function getWelcomeBonus(): Promise<number> {
  const raw = await getSetting("EXCHANGE_WELCOME_BONUS");
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_EXCHANGE_WELCOME_BONUS;
}

function escapeHtmlSimple(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 500);
}

// "Faoliyat tarixi" (bot profilida) uchun: Notification jadvali faqat
// User.id (ichki raqamli id) bo'yicha yoziladi, bu yerda esa bizda
// faqat telegramUserId bor — shu sabab kichik yordamchi orqali
// telegramUserId -> User.id ni topamiz. Foydalanuvchi hali saytga
// ulanmagan (User yozuvi yo'q) bo'lsa, jimgina hech narsa qilmaymiz —
// bu holat oddiy, xatolik emas.
async function findUserIdByTelegramId(telegramUserId: string): Promise<number | null> {
  const user = await prisma.user.findFirst({ where: { telegramUserId }, select: { id: true } });
  return user?.id ?? null;
}

async function requireBotSecret(req: Request, res: Response): Promise<boolean> {
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    res.status(403).json({ error: "Ruxsat etilmagan." });
    return false;
  }
  return true;
}

async function getMaxChannelsPerUser(): Promise<number> {
  const raw = await getSetting("EXCHANGE_MAX_CHANNELS_PER_USER");
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHANNELS_PER_USER;
}

async function getMaxNewSubsPerDay(): Promise<number> {
  const raw = await getSetting("EXCHANGE_MAX_NEW_SUBS_PER_DAY");
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_NEW_SUBS_PER_DAY;
}

// YANGI (admin talabi): admin panelda "Obuna almashish kanallari"
// bo'limidan butun "kanallarga obuna bo'lishga taklif qilish" (odam
// chaqirish) mexanizmini bir tugma bilan to'liq to'xtatib/yoqib qo'yish
// imkoniyati. O'chirilganda:
//   • /browse endpointi HECH KIMGA endi hech qanday kanal taklif qilmaydi
//     (ya'ni hech kim "quyidagi kanalga obuna bo'ling" deb chaqirilmaydi),
//   • allaqachon qo'shilgan kanallar, ularning to'plagan obunachi soni va
//     "Kanalimni qo'shish" (ex_add) funksiyasi ATAYLAB tegilmaydi — bu
//     faqat YANGI taklif qilishni to'xtatadi, mavjud ma'lumotni o'chirmaydi
//     va admin istalgan payt qayta yoqishi mumkin.
// Standart holat — YOQILGAN (sozlama umuman yozilmagan bo'lsa ham).
async function isExchangeInvitesEnabled(): Promise<boolean> {
  const raw = await getSetting("EXCHANGE_INVITES_ENABLED");
  return raw !== "false";
}

// GET /api/telegram/exchange/bonus-config
// TUZATILDI (SINXRONLASH XAVFI): bot tomonida EXCHANGE_REFERRAL_BONUS_TEXT
// va EXCHANGE_WELCOME_BONUS_TEXT qiymatlari avval shu fayldagi
// EXCHANGE_REFERRAL_BONUS/EXCHANGE_WELCOME_BONUS konstantalarini QO'LDA
// (qattiq-kodlangan string sifatida) takrorlar edi — faqat matn
// ko'rsatish uchun, izohda ochiq yozilganidek "har doim serverda bir xil
// bo'lishi kerak" degan taxmin bilan. Agar shu konstantalar bu yerda
// o'zgartirilib, botdagi nusxasi unutilsa, bot foydalanuvchiga NOTO'G'RI
// miqdor va'da qilardi (masalan "5 ta bonus" deb yozadi-yu, server
// aslida 8 ta beradi). Endi bot shu endpoint orqali haqiqiy qiymatlarni
// so'raydi va bir necha soatga keshlaydi — qattiq-kodlangan matn faqat
// bu so'rov muvaffaqiyatsiz bo'lgan taqdirdagi fallback sifatida qoladi.
router.get("/bonus-config", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;
  const [referralBonus, welcomeBonus, subscriberMultiplier] = await Promise.all([
    getReferralBonus(),
    getWelcomeBonus(),
    getSubscriberMultiplier()
  ]);
  res.json({
    referralBonus,
    welcomeBonus,
    // YANGI (foydalanuvchi talabi — profil ekranida "istalgan kanalga
    // obuna bo'lsangiz +N obunachi qo'shiladi" kabi aniq matn ko'rsatish
    // uchun): bot bu qiymatni endi qattiq-kodlamasdan shu yerdan oladi —
    // xuddi referralBonus/welcomeBonus bilan bir xil sinxronlash sababi.
    subscriberMultiplier
  });
});

// GET /api/telegram/exchange/live-stats
// YANGI (foydalanuvchi talabi — ijtimoiy isbot/social proof orqali
// faollikni rag'batlantirish): "Obunachi yig'ish" bo'limiga kirganda
// foydalanuvchi "bugun necha kishi obuna bo'ldi" kabi real vaqt
// statistikasini ko'rsin — bu "hamma qilyapti" hissi orqali ishtirokni
// oshiradi. Kun chegarasi APP_TIMEZONE (Asia/Tashkent) bo'yicha
// hisoblanadi — /telegram-stats'dagi bilan bir xil yondashuv (qarang:
// src/lib/pure-helpers.ts), server qanday TZ'da ishga tushirilishidan
// qat'iy nazar to'g'ri "bugun"ni ko'rsatadi.
router.get("/live-stats", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;
  try {
    const todayStart = getStartOfDayInTimezone(new Date(), APP_TIMEZONE);

    const [subscriptionsToday, channelsAddedToday, totalActiveChannels] = await Promise.all([
      prisma.exchangeSubscription.count({ where: { subscribedAt: { gte: todayStart } } }),
      prisma.exchangeChannel.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.exchangeChannel.count({ where: { isActive: true } })
    ]);

    res.json({ subscriptionsToday, channelsAddedToday, totalActiveChannels });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange live-stats error");
    res.status(500).json({ error: "Statistikani olishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/leaderboard
// YANGI (foydalanuvchi talabi — reyting jadvali orqali faollikni
// rag'batlantirish): so'nggi 7 kunda ENG KO'P boshqa foydalanuvchining
// kanaliga obuna bo'lgan (ya'ni ENG FAOL) 10 nafar foydalanuvchini
// ko'rsatadi. MUHIM: bu reyting "kimning kanaliga ko'p odam kelgani"
// EMAS, balki "kim boshqalarga eng ko'p yordam bergani (obuna
// bo'lgani)"ni o'lchaydi — aynan shu boshlang'ich muammoni ("odamlar
// bir-biriga obuna bo'lishga erinishadi") hal qilish uchun mo'ljallangan.
// Hafta chegarasi APP_TIMEZONE bo'yicha hisoblanadi (/telegram-stats va
// /live-stats bilan bir xil yondashuv).
router.get("/leaderboard", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;
  try {
    const weekStart = new Date(getStartOfDayInTimezone(new Date(), APP_TIMEZONE).getTime() - 6 * 24 * 60 * 60 * 1000);

    const grouped = await prisma.exchangeSubscription.groupBy({
      by: ["subscriberTelegramId"],
      where: { subscribedAt: { gte: weekStart } },
      _count: { subscriberTelegramId: true },
      orderBy: { _count: { subscriberTelegramId: "desc" } },
      take: 10
    });

    if (grouped.length === 0) {
      return res.json([]);
    }

    // Ko'rsatish uchun Telegram username kerak — buni alohida saqlamaymiz,
    // lekin g'olibning O'Z kanali bo'lsa, o'sha kanal ro'yxatdan
    // o'tkazilganda saqlangan ownerUsername'dan (ctx.from.username, qarang:
    // POST /register-channel) qayta foydalanamiz. Kanali bo'lmagan yoki
    // Telegram username o'rnatmagan foydalanuvchilar uchun bot tomonida
    // anonim ko'rinishda (ID oxiri) ko'rsatiladi.
    const subscriberIds = grouped.map((g: any) => g.subscriberTelegramId);
    const ownerChannels = await prisma.exchangeChannel.findMany({
      where: { ownerTelegramId: { in: subscriberIds } },
      select: { ownerTelegramId: true, ownerUsername: true },
      orderBy: { createdAt: "desc" }
    });
    const usernameMap = new Map<string, string | null>();
    for (const c of ownerChannels) {
      if (!usernameMap.has(c.ownerTelegramId)) usernameMap.set(c.ownerTelegramId, c.ownerUsername);
    }

    const subscriberMultiplier = await getSubscriberMultiplier();
    const leaderboard = grouped.map((g: any) => ({
      telegramUserId: g.subscriberTelegramId,
      username: usernameMap.get(g.subscriberTelegramId) || null,
      // Boshqa barcha ko'rsatiladigan sonlar bilan (masalan
      // "Umumiy yig'ilgan obunachi") bir xil birlikda bo'lishi uchun —
      // xom obuna sonini emas, admin sozlagan subscriberMultiplier bilan
      // ko'paytirilgan "obunachi" qiymatini qaytaramiz.
      subscribersEarned: g._count.subscriberTelegramId * subscriberMultiplier
    }));

    res.json(leaderboard);
  } catch (err: unknown) {
    logger.error({ err }, "Exchange leaderboard error");
    res.status(500).json({ error: "Reytingni olishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/register-channel
// Bot allaqachon tekshirgan: 1) bot shu kanalda admin, 2) so'rovchi
// foydalanuvchi shu kanalda admin/creator. Bu yerda faqat limit va
// yozuv tekshiriladi.
router.post("/register-channel", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  const { ownerTelegramId, ownerUsername, channelId, channelUsername, title } = req.body;
  if (!ownerTelegramId || !channelId || !title) {
    return res.status(400).json({ error: "ownerTelegramId, channelId va title majburiy." });
  }

  try {
    const existing = await prisma.exchangeChannel.findUnique({
      where: { ownerTelegramId_channelId: { ownerTelegramId: String(ownerTelegramId), channelId: String(channelId) } }
    });

    if (existing) {
      if (existing.blockedByAdmin) {
        return res.status(403).json({ error: "Bu kanal admin tomonidan bloklangan va qayta faollashtirib bo'lmaydi." });
      }
      const reactivated = await prisma.exchangeChannel.update({
        where: { id: existing.id },
        data: {
          title,
          channelUsername: channelUsername || existing.channelUsername,
          ownerUsername: ownerUsername || existing.ownerUsername,
          isActive: true,
          suspendedReason: null,
          suspendedDueToLapse: false,
          suspendedDueToCreditEarned: false
        }
      });
      return res.json({ success: true, channel: reactivated, reactivated: true });
    }

    const activeCount = await prisma.exchangeChannel.count({
      where: { ownerTelegramId: String(ownerTelegramId) }
    });
    const max = await getMaxChannelsPerUser();
    if (activeCount >= max) {
      return res.status(400).json({ error: `Siz bittada eng ko'pi bilan ${max} ta kanal qo'sha olasiz.`, limit: max });
    }

    let channel = await prisma.exchangeChannel.create({
      data: {
        ownerTelegramId: String(ownerTelegramId),
        ownerUsername: ownerUsername || null,
        channelId: String(channelId),
        channelUsername: channelUsername || null,
        title
      }
    });

    // XUSH KELIBSIZ BONUSI: foydalanuvchi botga ILK MARTA o'z kanalini
    // ulayapti — unga darhol 5 ta bonus obunachi beriladi. ExchangeWelcomeBonus
    // jadvaliga yozuv qo'shishga urinamiz; agar u allaqachon mavjud bo'lsa
    // (P2002 — unique constraint), demak bonus ilgari berilgan (masalan
    // kanal o'chirilib qayta qo'shilgan) — bunday holda bonus QAYTA
    // BERILMAYDI.
    //
    // TUZATILDI (JIDDIY MANTIQ XATOSI — "yolg'on gapirish" bugi):
    // avval `welcomeBonusGiven = true` aynan `exchangeChannel.update`
    // (ya'ni HAQIQIY +5 qo'shish) chaqirilishidan OLDIN o'rnatilar edi.
    // Agar shu update biror sababdan (masalan vaqtinchalik baza band
    // bo'lishi, ulanish uzilishi va h.k.) xato bersa, catch blok buni
    // ushlab olardi-yu, lekin `welcomeBonusGiven` allaqachon `true`
    // bo'lib qolgani uchun ORQAGA QAYTARILMASDI — natijada javobda
    // `welcomeBonusGiven: true` qaytardi va bot foydalanuvchiga "🎉🎁
    // 5 ta bonus obunachi qo'shildi!" deb ko'rsatardi, HOLBUKI
    // `earnedSubscribers` haqiqatda ORTMAGAN edi (chunki aynan shu
    // amal xato bergan edi). Ya'ni bot HAQIQATDA yolg'on gapirardi.
    //
    // Endi ikkala amal ($create + $update) BITTA tranzaksiyaga
    // birlashtirildi — ikkalasi ham to'liq muvaffaqiyatli bo'lsagina
    // (yoki ikkalasi ham HECH NARSA o'zgartirmay) tugaydi, va
    // `welcomeBonusGiven` FAQAT tranzaksiya haqiqatan yakunlangandan
    // KEYIN, muvaffaqiyat holatida `true` bo'ladi.
    let welcomeBonusGiven = false;
    const welcomeBonus = await getWelcomeBonus();
    try {
      const [, updatedChannel] = await prisma.$transaction([
        prisma.exchangeWelcomeBonus.create({
          data: { ownerTelegramId: String(ownerTelegramId) }
        }),
        prisma.exchangeChannel.update({
          where: { id: channel.id },
          data: { earnedSubscribers: { increment: welcomeBonus } }
        })
      ]);
      // Bu qatorga faqat tranzaksiya HAQIQATDA muvaffaqiyatli
      // yakunlangandan keyin yetib kelinadi — shuning uchun endi
      // `welcomeBonusGiven: true` har doim haqiqatga mos keladi.
      channel = updatedChannel;
      welcomeBonusGiven = true;
      findUserIdByTelegramId(String(ownerTelegramId))
        .then((uid) => uid && createNotification(
          uid,
          "EXCHANGE",
          "🎁 Xush kelibsiz bonusi",
          `Botga birinchi marta o'z kanalingizni ulaganingiz uchun ${welcomeBonus} ta bonus ball qo'shildi.`
        ))
        .catch((e: unknown) => logger.warn({ err: e }, "Exchange welcome-bonus activity-log failed"));
    } catch (welcomeErr: unknown) {
      const welcomeCode = getErrorCode(welcomeErr);
      if (welcomeCode !== "P2002") {
        logger.error({ err: welcomeErr }, "Exchange welcome-bonus error (kanal qo'shish davom etadi)");
      }
    }

    // REFERAL MUKOFOTI (TUZATILDI, foydalanuvchi talabi): mukofot ENDI
    // shu yerda — taklif qilingan odam o'z kanalini botga ulab, admin
    // qilib qo'shgan zahoti — beriladi. Kanal haqiqiy birinchi obunachi
    // olishini kutish SHART EMAS: qoidaga ko'ra "chaqirilgan odam botga
    // o'z kanalini ulab admin qilsa" taklif qilgan odamga darhol 5 ta
    // bonus obunachi qo'shiladi va uning kanali navbatdan olib tashlanadi.
    // `rewarded` maydoni atomik updateMany bilan "claim" qilinadi, shu
    // sabab bir xil referal uchun ikki marta mukofot berilmaydi.
    try {
      const referral = await prisma.exchangeReferral.findUnique({
        where: { refereeTelegramId: String(ownerTelegramId) }
      });
      if (referral && !referral.rewarded && referral.referrerTelegramId !== String(ownerTelegramId)) {
        const claim = await prisma.exchangeReferral.updateMany({
          where: { id: referral.id, rewarded: false },
          data: { rewarded: true }
        });
        if (claim.count === 1) {
          const referralBonus = await getReferralBonus();
          await prisma.exchangeReferralCredit.upsert({
            where: { ownerTelegramId: referral.referrerTelegramId },
            create: { ownerTelegramId: referral.referrerTelegramId, bonusSubscribers: referralBonus },
            update: { bonusSubscribers: { increment: referralBonus } }
          });
          // TUZATILDI (foydalanuvchi talabi — "kanallar DOIM navbatda
          // turishi kerak, chunki doimiy odamlar foydalanadi"): avval
          // referal mukofoti berilganda taklif qilgan odamning kanali
          // navbatdan (isActive=false) chiqarilardi. Endi bunday
          // qilinmaydi — bonus ball allaqachon yuqorida ExchangeReferralCredit'ga
          // qo'shildi, kanal esa doim navbatda qolaveradi.
          const subscriberBotToken = await resolveSubscriberBotTokenForNotify();
          if (subscriberBotToken) {
            // YANGI (foydalanuvchi talabi — admin panelidan bot
            // xabarlarini o'zi tahrirlashni xohlaydi): bu matn endi
            // qattiq kodlanmagan — src/lib/botMessages.ts orqali
            // "ex_referral_credited_notify" shablonidan (admin
            // tahriri bo'lsa o'shandan, aks holda standartidan)
            // o'qiladi.
            renderBotMessage("ex_referral_credited_notify", { bonus: referralBonus }).then((text) =>
              sendTelegramMessage(referral.referrerTelegramId, text, { botToken: subscriberBotToken })
            ).catch((e: unknown) => logger.warn({ err: e }, "Exchange referral notify failed"));
          } else {
            logger.warn("TELEGRAM_SUBSCRIBER_BOT_TOKEN sozlanmagan — referal bildirishnomasi yuborilmadi.");
          }
          // "Faoliyat tarixi"da ko'rinishi uchun (bot profilidagi
          // yagona faoliyat lentasi Notification jadviga tayanadi).
          findUserIdByTelegramId(referral.referrerTelegramId)
            .then((uid) => uid && createNotification(
              uid,
              "EXCHANGE",
              "🎁 Referal bonusi",
              `Taklif qilgan do'stingiz o'z kanalini ulagani uchun ${referralBonus} ta bonus ball qo'shildi.`
            ))
            .catch((e: unknown) => logger.warn({ err: e }, "Exchange referral activity-log failed"));
        }
      }
    } catch (referralErr: unknown) {
      logger.error({ err: referralErr }, "Exchange referral reward error (kanal qo'shish davom etadi)");
    }

    res.status(201).json({ success: true, channel, reactivated: false, welcomeBonusGiven });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange register-channel error");
    const code = getErrorCode(err);
    const msg = getErrorMessage(err);
    // P2021 = Prisma: "jadval bazada mavjud emas" — aynan shu, agar
    // ExchangeChannel/ExchangeSubscription jadvallari migratsiya
    // qilinmagan bo'lsa (masalan SQLite sxemasi eskirgan bo'lsa) sodir
    // bo'ladi. Bunday holatda foydalanuvchiga umumiy xabar ko'rsatish
    // o'rniga, adminga DARHOL aniq sabab bilan Telegram orqali xabar
    // boradi — shunda muammo "sababi noma'lum" bo'lib qolmaydi.
    if (code === "P2021" || /does not exist|no such table/i.test(msg)) {
      notifyAdminTelegram(
        `🚨 <b>Obuna almashish: baza jadvali topilmadi!</b>\n\n` +
        `Foydalanuvchi (Telegram ID: ${ownerTelegramId}) kanal qo'shmoqchi bo'ldi, lekin ` +
        `ExchangeChannel/ExchangeSubscription jadvali bazada yo'q. Bu odatda migratsiya ` +
        `("prisma db push"/"prisma migrate deploy") hali ishga tushmaganini yoki eskirgan ` +
        `sxema fayli ishlatilayotganini bildiradi.\n\nXato: <code>${escapeHtmlSimple(msg)}</code>`
      ).catch(() => {});
      return res.status(500).json({
        error: "Server tomonida baza sozlamasi muammosi (jadval topilmadi). Admin xabardor qilindi, birozdan so'ng qayta urinib ko'ring."
      });
    }
    res.status(500).json({ error: "Kanalni qo'shishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/summary/:telegramUserId
// Bot profilidagi "🔄 Obunachi yig'ish" bo'limi uchun MUKAMMAL,
// bitta so'rovda hammasi: o'z kanallari (holati bilan), jami to'plangan
// obunachi, referal orqali kelgan bonus, hozir necha kishiga (real)
// obuna bo'lgani, kunlik limitdan qanchasi ishlatilgani va h.k.
router.get("/summary/:telegramUserId", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  const telegramUserId = String(req.params.telegramUserId);

  try {
    const [channels, referralCredit, activeSubsCount, referralStats, since24hCount, maxPerDay, maxChannels] = await Promise.all([
      prisma.exchangeChannel.findMany({
        where: { ownerTelegramId: telegramUserId },
        orderBy: { createdAt: "desc" }
      }),
      prisma.exchangeReferralCredit.findUnique({ where: { ownerTelegramId: telegramUserId } }).catch(() => null),
      // Foydalanuvchi HOZIR necha kishining (real) kanaliga obuna bo'lib turibdi
      prisma.exchangeSubscription.count({ where: { subscriberTelegramId: telegramUserId, isCurrentMember: true } }),
      // Referal: kim taklif qilgani va nechta odamni taklif qilib, ulardan
      // nechtasi ("rewarded") hali mukofot bergani.
      prisma.exchangeReferral.findMany({ where: { referrerTelegramId: telegramUserId } }),
      prisma.exchangeSubscription.count({
        where: { subscriberTelegramId: telegramUserId, subscribedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      }),
      getMaxNewSubsPerDay(),
      getMaxChannelsPerUser()
    ]);

    const totalEarned = channels.reduce((sum: number, c: any) => sum + c.earnedSubscribers, 0) + (referralCredit?.bonusSubscribers || 0);

    res.json({
      channels: channels.map((c: any) => ({
        id: c.id,
        title: c.title,
        channelUsername: c.channelUsername,
        isActive: c.isActive,
        blockedByAdmin: c.blockedByAdmin,
        suspendedDueToLapse: c.suspendedDueToLapse,
        suspendedReason: c.suspendedReason,
        earnedSubscribers: c.earnedSubscribers,
        // YANGI (foydalanuvchi talabi): profil ekranida kanal hali
        // navbatda ko'rsatilmoqchimi ("kutmoqda") yoki allaqachon
        // kamida bir marta boshqalarga taklif qilinganmi ("faol,
        // ko'rsatilmoqda") — shu farqni aniqlash uchun kerak.
        lastOfferedAt: c.lastOfferedAt,
        createdAt: c.createdAt
      })),
      maxChannels,
      referralBonus: referralCredit?.bonusSubscribers || 0,
      referralInvitedCount: referralStats.length,
      referralRewardedCount: referralStats.filter((r: any) => r.rewarded).length,
      totalEarnedSubscribers: totalEarned,
      activeSubscriptionsCount: activeSubsCount,
      newSubsToday: since24hCount,
      maxNewSubsPerDay: maxPerDay
    });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange summary error");
    res.status(500).json({ error: "Ma'lumotlarni olishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/register-referral
// Bot /start'da "exref_<taklif qiluvchining telegram ID'si>" chuqur
// havolasi bilan kirgan YANGI foydalanuvchi uchun chaqiriladi. Bu yerda
// hali HECH QANDAY mukofot berilmaydi — faqat "kim kimni taklif qildi"
// yozib qo'yiladi; mukofot faqat taklif qilingan odam keyinchalik O'Z
// KANALINI qo'shganda (register-channel'dagi referal blokida) beriladi.
router.post("/register-referral", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  const { referrerTelegramId, refereeTelegramId } = req.body;
  if (!referrerTelegramId || !refereeTelegramId) {
    return res.status(400).json({ error: "referrerTelegramId va refereeTelegramId majburiy." });
  }
  if (String(referrerTelegramId) === String(refereeTelegramId)) {
    return res.status(400).json({ error: "O'zingizni o'zingiz taklif qila olmaysiz." });
  }

  try {
    // Bir kishi faqat BIR marta (birinchi taklif qiluvchi bilan)
    // bog'lanadi — refereeTelegramId unique. Agar bu odam allaqachon
    // (shu yoki boshqa) referal orqali ro'yxatda bo'lsa, jimgina
    // e'tiborsiz qoldiramiz (birinchi havola g'alaba qozonadi).
    const existing = await prisma.exchangeReferral.findUnique({ where: { refereeTelegramId: String(refereeTelegramId) } });
    if (existing) {
      return res.json({ success: true, alreadyReferred: true });
    }
    await prisma.exchangeReferral.create({
      data: {
        referrerTelegramId: String(referrerTelegramId),
        refereeTelegramId: String(refereeTelegramId)
      }
    });
    res.json({ success: true, alreadyReferred: false });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange register-referral error");
    res.status(500).json({ error: "Referalni saqlashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/my-channels/:telegramUserId
// Bot "Mening kanallarim" bo'limi uchun — har bir kanal qancha
// obunachi to'plaganini ham ko'rsatish uchun subscriberCount qo'shildi
// (sayt profilidagi /my-channels bilan bir xil ko'paytiruvchi qoidasi).
router.get("/my-channels/:telegramUserId", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const channels = await prisma.exchangeChannel.findMany({
      where: { ownerTelegramId: String(req.params.telegramUserId) },
      orderBy: { createdAt: "desc" }
    });

    // TUZATILDI: subscriberCount endi bu kanalga KIM OBUNA BO'LGANIDAN
    // emas (bu boshqa kishilarga kredit bermaydi), balki kanal
    // egasining O'ZI boshqa kanallarga obuna bo'lib TO'PLAGAN
    // (earnedSubscribers) sonidan olinadi.
    res.json(channels.map((c: any) => ({
      ...c,
      subscriberCount: c.earnedSubscribers
    })));
  } catch (err: unknown) {
    logger.error({ err }, "Exchange my-channels error");
    res.status(500).json({ error: "Kanallarni olishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/remove-channel
router.post("/remove-channel", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  const { ownerTelegramId, id } = req.body;
  if (!ownerTelegramId || !id) {
    return res.status(400).json({ error: "ownerTelegramId va id majburiy." });
  }

  try {
    const channel = await prisma.exchangeChannel.findUnique({ where: { id: Number(id) } });
    if (!channel || channel.ownerTelegramId !== String(ownerTelegramId)) {
      return res.status(404).json({ error: "Kanal topilmadi." });
    }
    await prisma.exchangeChannel.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange remove-channel error");
    res.status(500).json({ error: "Kanalni o'chirishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/my-subscriptions/:telegramUserId
// Bot shu ro'yxatdagi har bir kanal bo'yicha haqiqiy a'zolikni
// getChatMember orqali o'zi tekshiradi, keyin /report-check'ga natijani yuboradi.
router.get("/my-subscriptions/:telegramUserId", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const subs = await prisma.exchangeSubscription.findMany({
      where: { subscriberTelegramId: String(req.params.telegramUserId), isCurrentMember: true },
      include: { channel: true }
    });
    res.json(subs.map((s: any) => ({
      exchangeChannelId: s.channel.id,
      channelId: s.channel.channelId,
      channelUsername: s.channel.channelUsername,
      title: s.channel.title
    })));
  } catch (err: unknown) {
    logger.error({ err }, "Exchange my-subscriptions error");
    res.status(500).json({ error: "Obunalarni olishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/report-check
// Bot getChatMember orqali tekshirgan natijalarni shu yerga yuboradi.
// Agar biror kanaldan chiqib ketgan bo'lsa (obunani qaytarib olgan) —
// SHU FOYDALANUVCHINING O'Z kanallari navbatdan vaqtincha chiqariladi.
// Agar hammasi joyida bo'lsa — avval shu sabab bilan to'xtatilgan
// kanallari bor bo'lsa, avtomatik qayta faollashtiriladi.
router.post("/report-check", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  const { telegramUserId, results } = req.body as {
    telegramUserId: string;
    results: { exchangeChannelId: number; isMember: boolean; channelTitle?: string }[];
  };

  if (!telegramUserId || !Array.isArray(results)) {
    return res.status(400).json({ error: "telegramUserId va results majburiy." });
  }

  try {
    const lapsed: string[] = [];

    for (const r of results) {
      // TUZATISH ("kredit qaytarib olinmaydi" muammosi): avval bu yerda
      // faqat isCurrentMember/lastCheckedAt yangilanardi, olingan kredit
      // hech qachon qaytarilmasdi — bu "obuna bo'l → kredit ol → darhol
      // chiq" orqali soxta obunachi yig'ishga yo'l ochardi. Endi: agar
      // foydalanuvchi ENDI a'zo bo'lmasa (r.isMember === false) VA shu
      // aniq obuna uchun ilgari kredit berilgan bo'lsa-yu hali qaytarib
      // olinmagan bo'lsa (creditGrantedAmount > 0 && !creditClawedBack),
      // o'sha son uning HOZIRGI kanallaridan ayiriladi (0 dan pastga
      // tushmasdan) va bayroq true qilinadi (qayta-qayta ayirilmasligi
      // uchun). Bu ALOHIDA report-check chaqiruvi ichida, pastdagi
      // "isActive suspend" mantig'idan MUSTAQIL ishlaydi — chunki
      // suspend vaqtinchalik (qayta obuna bo'lsa tiklanadi), kredit
      // ayirish esa doimiy.
      const sub = await prisma.exchangeSubscription.findUnique({
        where: {
          subscriberTelegramId_channelId: {
            subscriberTelegramId: String(telegramUserId),
            channelId: r.exchangeChannelId
          }
        }
      });

      await prisma.exchangeSubscription.updateMany({
        where: { subscriberTelegramId: String(telegramUserId), channelId: r.exchangeChannelId },
        data: { isCurrentMember: r.isMember, lastCheckedAt: new Date() }
      });

      if (!r.isMember) {
        lapsed.push(r.channelTitle || `#${r.exchangeChannelId}`);

        if (sub && sub.creditGrantedAmount > 0 && !sub.creditClawedBack) {
          try {
            const ownChannels = await prisma.exchangeChannel.findMany({
              where: { ownerTelegramId: String(telegramUserId) }
            });
            for (const oc of ownChannels) {
              const safeAmount = Math.min(sub.creditGrantedAmount, oc.earnedSubscribers);
              if (safeAmount > 0) {
                await prisma.exchangeChannel.update({
                  where: { id: oc.id },
                  data: { earnedSubscribers: { decrement: safeAmount } }
                });
              }
            }
            await prisma.exchangeSubscription.update({
              where: { id: sub.id },
              data: { creditClawedBack: true }
            });
          } catch (clawbackErr: unknown) {
            logger.error({ err: clawbackErr, telegramUserId, channelId: r.exchangeChannelId }, "Exchange credit clawback error");
          }
        }
      }
    }

    let suspendedChannels: { id: number; title: string }[] = [];
    let reactivatedChannels: { id: number; title: string }[] = [];

    if (lapsed.length > 0) {
      const ownChannels = await prisma.exchangeChannel.findMany({
        // TUZATILDI (foydalanuvchi talabi): sponsor kanal qoidabuzarlik
        // (lapse) tufayli ham navbatdan avtomatik chiqarilmasligi kerak.
        where: { ownerTelegramId: String(telegramUserId), isActive: true, isSponsor: false }
      });
      if (ownChannels.length > 0) {
        await prisma.exchangeChannel.updateMany({
          where: { ownerTelegramId: String(telegramUserId), isActive: true, isSponsor: false },
          data: {
            isActive: false,
            suspendedDueToLapse: true,
            suspendedReason: `Obuna bo'lgan kanal(lar)dan chiqib ketgan: ${lapsed.join(", ")}`
          }
        });
        suspendedChannels = ownChannels.map((c: any) => ({ id: c.id, title: c.title }));
      }
    } else {
      const toReactivate = await prisma.exchangeChannel.findMany({
        where: { ownerTelegramId: String(telegramUserId), suspendedDueToLapse: true, blockedByAdmin: false }
      });
      if (toReactivate.length > 0) {
        await prisma.exchangeChannel.updateMany({
          where: { ownerTelegramId: String(telegramUserId), suspendedDueToLapse: true },
          data: { isActive: true, suspendedDueToLapse: false, suspendedReason: null }
        });
        reactivatedChannels = toReactivate.map((c: any) => ({ id: c.id, title: c.title }));
      }
    }

    res.json({ lapsed, suspendedChannels, reactivatedChannels });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange report-check error");
    res.status(500).json({ error: "Tekshiruv natijasini saqlashda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/reactivate-credit-suspended
// YANGI (foydalanuvchi talabi — "ball/kredit bor foydalanuvchilar
// navbatdan olib tashlanib, qo'lda qayta ishga tushirishga to'g'ri
// kelyapti" bugi tuzatildi): avval kredit sababli to'xtatilgan kanal
// (suspendedDueToCreditEarned=true) hech qachon avtomatik tiklanmasdi —
// FAQAT admin panelidan qo'lda "Qayta ishga tushirish" bosilgandagina
// navbatga qaytardi. Bu endpoint cron-jobs.ts'dagi davriy vazifa
// (har 3 soatda) tomonidan chaqiriladi va HAMMA shunday kanallarni
// (admin tomonidan bloklanmagan va shikoyat tufayli to'xtatilmagan
// bo'lsa) avtomatik qayta navbatga qo'shadi — admin aralashuvisiz.
router.post("/reactivate-credit-suspended", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const toReactivate = await prisma.exchangeChannel.findMany({
      where: {
        suspendedDueToCreditEarned: true,
        blockedByAdmin: false,
        suspendedDueToReports: false
      },
      select: { id: true, title: true, ownerTelegramId: true }
    });

    if (toReactivate.length === 0) {
      return res.json({ reactivated: [] });
    }

    await prisma.exchangeChannel.updateMany({
      where: { id: { in: toReactivate.map((c: any) => c.id) } },
      data: { isActive: true, suspendedDueToCreditEarned: false, suspendedReason: null }
    });

    res.json({ reactivated: toReactivate });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange reactivate-credit-suspended error");
    res.status(500).json({ error: "Kredit sababli to'xtatilgan kanallarni tiklashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/new-channel-announcements
// YANGI (foydalanuvchi talabi — "yangi foydalanuvchi qo'shilganida,
// hali unga obuna bo'lmagan boshqa foydalanuvchilarga xabar borsin"):
// yaqinda navbatga qo'shilgan (va hali e'lon qilinmagan) kanallarni va
// ularga hali obuna bo'lmagan faol ishtirokchilarni topib beradi.
// cron-jobs.ts shu ro'yxat asosida bot orqali bildirishnoma yuboradi.
router.get("/new-channel-announcements", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    // Kanal qo'shilgandan keyin kamida shuncha vaqt kutiladi — bu kanal
    // egasi kanalni tasodifan (yoki sinov uchun) qo'shib, darhol
    // o'chirib yuborgan holatlarda keraksiz e'lon yuborilishining oldini
    // oladi.
    const GRACE_MS = 5 * 60 * 1000;
    const newChannels = await prisma.exchangeChannel.findMany({
      where: {
        isActive: true,
        isSponsor: false,
        newChannelAnnouncedAt: null,
        createdAt: { lte: new Date(Date.now() - GRACE_MS) }
      },
      orderBy: { createdAt: "asc" },
      // Bir cron aylanishida ko'pi bilan 3 ta yangi kanal e'lon qilinadi —
      // har bir kanal ko'plab foydalanuvchiga xabar yuborishni talab
      // qilishi mumkin, shu sabab Telegram flood-limitiga urilib
      // ketmaslik uchun ataylab cheklangan (keyingi kanal(lar) keyingi
      // cron aylanishida e'lon qilinadi).
      take: 3,
      select: { id: true, title: true, channelId: true, channelUsername: true, ownerTelegramId: true }
    });

    if (newChannels.length === 0) {
      return res.json([]);
    }

    // Darhol "e'lon qilindi" deb belgilaymiz (xabarlar yuborilishidan
    // OLDIN) — shu bilan bot xabar yuborayotgan vaqtda keyingi cron
    // aylanishi bir xil kanalni ikki marta ushlab, dublikat xabar
    // yubormaydi.
    await prisma.exchangeChannel.updateMany({
      where: { id: { in: newChannels.map((c: any) => c.id) } },
      data: { newChannelAnnouncedAt: new Date() }
    });

    const result = [];
    for (const ch of newChannels) {
      // Qabul qiluvchilar: hozir FAOL (navbatdagi) kamida bitta o'z
      // kanali bor — ya'ni almashinuvda haqiqatan ishtirok etayotgan —
      // VA yangi kanal egasining o'zi emas.
      const participants = await prisma.exchangeChannel.findMany({
        where: { isActive: true, ownerTelegramId: { not: ch.ownerTelegramId } },
        select: { ownerTelegramId: true },
        distinct: ["ownerTelegramId"]
      });
      const participantIds = participants.map((p: any) => p.ownerTelegramId);
      if (participantIds.length === 0) continue;

      // Ular orasidan bu ANIQ kanalga ALLAQACHON obuna bo'lganlarni
      // chiqarib tashlaymiz (masalan admin qo'lda qo'shgan bo'lsa).
      const alreadySubscribed = await prisma.exchangeSubscription.findMany({
        where: { channelId: ch.id, subscriberTelegramId: { in: participantIds }, isCurrentMember: true },
        select: { subscriberTelegramId: true }
      });
      const alreadySubscribedSet = new Set(alreadySubscribed.map((s: any) => s.subscriberTelegramId));
      const recipientTelegramIds = participantIds.filter((id: string) => !alreadySubscribedSet.has(id));

      if (recipientTelegramIds.length > 0) {
        result.push({
          id: ch.id,
          title: ch.title,
          channelId: ch.channelId,
          channelUsername: ch.channelUsername,
          recipientTelegramIds
        });
      }
    }

    res.json(result);
  } catch (err: unknown) {
    logger.error({ err }, "Exchange new-channel-announcements error");
    res.status(500).json({ error: "Yangi kanal e'lonlarini olishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/browse/:telegramUserId?limit=5
// Navbat asosida (eng kam taklif qilingani birinchi) boshqalarning
// kanallarini qaytaradi va shu bilan birga lastOfferedAt'ni yangilaydi.
router.get("/browse/:telegramUserId", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  // Admin "Obuna almashish kanallari" bo'limidan taklif qilishni
  // vaqtincha to'xtatgan bo'lishi mumkin — bunday holda hech kimga hech
  // qanday kanal taklif qilinmaydi (mavjud kanallar/statistikaga tegilmaydi).
  if (!(await isExchangeInvitesEnabled())) {
    return res.json({ disabledByAdmin: true, channels: [] });
  }

  // TUZATILDI (foydalanuvchi talabi): standart/maksimal limit 5'dan
  // 10'ga oshirildi — bot endi bitta sahifada 10 tagacha kanal
  // ko'rsatadi ("kanallar soni 10 tadan oshmasa bo'ldi").
  const limit = Math.min(parseInt(String(req.query.limit || "10"), 10) || 10, 10);

  try {
    const whereClause = {
      isActive: true,
      ownerTelegramId: { not: String(req.params.telegramUserId) },
      // Foydalanuvchi allaqachon (haqiqatan) obuna bo'lgan kanallarni
      // qayta taklif qilmaymiz — aks holda navbat behuda sarflanadi
      // (lastOfferedAt yangilanadi-yu, lekin yangi obunachi kelmaydi)
      // va foydalanuvchiga bir xil kanal qayta-qayta ko'rsatiladi.
      subscriptions: {
        none: {
          subscriberTelegramId: String(req.params.telegramUserId),
          isCurrentMember: true
        }
      }
    };

    const channels = await prisma.exchangeChannel.findMany({
      where: whereClause,
      // TUZATILDI (foydalanuvchi talabi — sponsor kanal doim birinchi):
      // isSponsor=true kanal(lar) navbat tartibidan qat'i nazar (lastOfferedAt/
      // createdAt) HAR DOIM ro'yxatning eng boshida chiqishi kerak. Prisma'da
      // "true birinchi" uchun DESC ishlatiladi (true > false).
      orderBy: [
        { isSponsor: "desc" },
        { lastOfferedAt: { sort: "asc", nulls: "first" } },
        { createdAt: "asc" }
      ],
      take: limit
    });

    if (channels.length > 0) {
      await prisma.exchangeChannel.updateMany({
        where: { id: { in: channels.map((c: any) => c.id) } },
        data: { lastOfferedAt: new Date(), timesOffered: { increment: 1 } }
      });
    }

    // YANGI (foydalanuvchi talabi — "Keyingi 10 ta" tugmasi): bot shu
    // sahifadan tashqari yana taklif qilinadigan kanal bor-yo'qligini
    // bilishi kerak, aks holda hamma joyda keraksiz "Keyingi 10 ta"
    // tugmasini ko'rsatib qo'yadi. Umumiy mos keluvchi kanallar soni shu
    // sahifada qaytarilgandan ko'proq bo'lsa — demak yana bor (navbat
    // aylanma bo'lgani uchun keyingi chaqiruvda boshqa/qo'shimcha
    // kanallar chiqadi, lastOfferedAt tartibi orqali).
    const totalEligible = channels.length < limit
      ? channels.length
      : await prisma.exchangeChannel.count({ where: whereClause });

    // TUZATILDI (MOSLIK): javob avval xom massiv edi (res.json(channels)),
    // endi { channels } shaklida — chunki yuqoridagi "o'chirilgan" holati
    // ham shu endpointdan qaytishi kerak edi va ikkala holat (o'chirilgan
    // / bo'sh navbat) bot tomonida bir xil "massiv emas" formatga tushib
    // qolmasligi uchun aniq strukturaga o'tkazildi. Botdagi chaqiruv shu
    // o'zgarishga mos yangilandi (pastga qarang: telegram-bot/index.ts).
    res.json({ disabledByAdmin: false, channels, hasMore: totalEligible > channels.length });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange browse error");
    res.status(500).json({ error: "Kanallarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/channel/:id
// Bot "✅ Obuna bo'ldim" tugmasi bosilganda haqiqiy Telegram channelId'ni
// bilishi kerak (getChatMember uchun) — callback_data faqat ichki
// raqamli id'ni tashiydi, shu sabab shu endpoint orqali to'ldiriladi.
router.get("/channel/:id", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const channel = await prisma.exchangeChannel.findUnique({ where: { id: Number(req.params.id) } });
    if (!channel || !channel.isActive) {
      return res.status(404).json({ error: "Kanal topilmadi yoki faol emas." });
    }
    res.json(channel);
  } catch (err: unknown) {
    logger.error({ err }, "Exchange get-channel error");
    res.status(500).json({ error: "Kanalni olishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/report-channel
// YANGI (foydalanuvchi talabi): "Obunachi yig'ish" bo'limida taklif
// qilingan kanaldan (masalan spam, nomaqbul kontent, firibgarlik uchun)
// shikoyat qilish. Yozuv bazada saqlanadi VA admin darhol Telegram
// orqali xabardor qilinadi — admin mavjud "Obuna almashish kanallari"
// bo'limidagi bloklash tugmasidan (AdminExchangeTab) darhol foydalana
// oladi. TUZATISH ehtimoli uchun umumiy Report jadvali (startup/user/
// izoh uchun mo'ljallangan, AdminReportsTab shu uchtasini kutadi)
// ATAYLAB ishlatilmadi — u yerga "exchangeChannel" turini qo'shish
// admin panelidagi mavjud render/o'chirish mantig'ini buzardi.
router.post("/report-channel", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  const { reporterTelegramId, exchangeChannelId, reason } = req.body;
  if (!reporterTelegramId || !exchangeChannelId || !reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "reporterTelegramId, exchangeChannelId va reason majburiy." });
  }

  try {
    const channel = await prisma.exchangeChannel.findUnique({ where: { id: Number(exchangeChannelId) } });
    if (!channel) {
      return res.status(404).json({ error: "Kanal topilmadi." });
    }
    if (channel.ownerTelegramId === String(reporterTelegramId)) {
      return res.status(400).json({ error: "O'z kanalingizdan shikoyat qilolmaysiz." });
    }

    // Bir xil foydalanuvchi bitta kanaldan so'nggi 24 soat ichida
    // ALLAQACHON shikoyat qilgan bo'lsa — takroriy yozuv yaratilmaydi
    // va admin qayta-qayta bir xil shikoyat bilan bezovta qilinmaydi
    // (masalan foydalanuvchi tugmani bir necha marta bossa).
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingReport = await prisma.exchangeChannelReport.findFirst({
      where: { channelId: channel.id, reporterTelegramId: String(reporterTelegramId), createdAt: { gte: since } }
    });
    if (existingReport) {
      return res.json({ success: true, alreadyReported: true });
    }

    await prisma.exchangeChannelReport.create({
      data: {
        channelId: channel.id,
        reporterTelegramId: String(reporterTelegramId),
        reason: reason.trim().slice(0, 500)
      }
    });

    // YANGI (foydalanuvchi talabi): kamida 2 ta TURLI odam (bitta odam
    // bir necha marta shikoyat qilsa ham hisoblanmasin, shu sabab
    // `distinct: ["reporterTelegramId"]`) shikoyat qilsa, kanal DARHOL
    // (admin ko'rib chiqishini kutmasdan) navbatdan/ko'rsatishdan olib
    // tashlanadi — foydalanuvchilar bunday kanalga endi taklif
    // qilinmaydi, lekin admin kirim/blok tarixi buzilmasligi uchun bu
    // blockedByAdmin bilan ARALASHTIRILMAYDI, alohida bayroq
    // (suspendedDueToReports) qo'yiladi. Admin allaqachon bloklagan yoki
    // (kamdan-kam holat — masalan qayta faollashtirilgan) allaqachon shu
    // sabab bilan to'xtatilgan kanalni qayta yangilamaymiz.
    const REPORT_THRESHOLD = 2;
    let autoSuspended = false;
    // TUZATILDI (foydalanuvchi talabi): sponsor kanal shikoyatlar asosida
    // ham avtomatik yashirilmaydi — faqat admin qo'lda /block qilishi
    // mumkin. Shikoyat baribir yuqorida notifyAdminTelegram orqali
    // adminga yetkaziladi, admin xohlasa qo'lda choralar ko'radi.
    if (!channel.blockedByAdmin && !channel.suspendedDueToReports && !channel.isSponsor) {
      const distinctReporters = await prisma.exchangeChannelReport.findMany({
        where: { channelId: channel.id },
        select: { reporterTelegramId: true },
        distinct: ["reporterTelegramId"]
      });
      if (distinctReporters.length >= REPORT_THRESHOLD) {
        await prisma.exchangeChannel.update({
          where: { id: channel.id },
          data: {
            isActive: false,
            suspendedDueToReports: true,
            suspendedReason: `${distinctReporters.length} ta foydalanuvchi shikoyat qilgani sabab vaqtincha yashirildi — admin ko'rib chiqmoqda.`
          }
        });
        autoSuspended = true;
      }
    }

    notifyAdminTelegram(
      `🚩 <b>Kanaldan shikoyat</b>\n\n` +
      `<b>Kanal:</b> ${escapeHtmlSimple(channel.title)} (ID: ${channel.id})\n` +
      `<b>Kanal egasi:</b> <code>${escapeHtmlSimple(channel.ownerTelegramId)}</code>\n` +
      `<b>Shikoyatchi:</b> <code>${escapeHtmlSimple(String(reporterTelegramId))}</code>\n` +
      `<b>Sabab:</b> ${escapeHtmlSimple(reason.trim().slice(0, 500))}` +
      (autoSuspended ? `\n\n⛔️ Kanal ${REPORT_THRESHOLD}+ shikoyat sabab AVTOMATIK vaqtincha yashirildi. Admin panelida ko'rib chiqing.` : "")
    ).catch((e: unknown) => logger.warn({ err: e }, "Exchange report-channel admin notify failed"));

    res.json({ success: true, alreadyReported: false });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange report-channel error");
    res.status(500).json({ error: "Shikoyatni yuborishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/confirm-subscribe
// Bot getChatMember bilan HAQIQIY a'zolikni tasdiqlagandan keyin chaqiradi.
router.post("/confirm-subscribe", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  const { subscriberTelegramId, exchangeChannelId } = req.body;
  if (!subscriberTelegramId || !exchangeChannelId) {
    return res.status(400).json({ error: "subscriberTelegramId va exchangeChannelId majburiy." });
  }

  try {
    const channel = await prisma.exchangeChannel.findUnique({ where: { id: Number(exchangeChannelId) } });
    if (!channel) {
      return res.status(404).json({ error: "Kanal topilmadi." });
    }
    // Kanal egasi o'z kanalida tabiiy ravishda admin/creator bo'lgani uchun
    // getChatMember uni har doim "a'zo" deb ko'rsatadi — shu sabab bot
    // orqali o'ziga o'zi soxta obunachi yozib qo'yishning oldini olamiz.
    if (channel.ownerTelegramId === String(subscriberTelegramId)) {
      return res.status(400).json({ error: "Siz o'z kanalingizga obunachi sifatida yozilolmaysiz." });
    }

    // Egaga bildirishnoma faqat HAQIQIY yangi (yoki qaytadan obuna
    // bo'lgan) obunachi uchun yuborilishi kerak — allaqachon isCurrentMember
    // bo'lgan yozuvni qayta upsert qilishda (masalan davriy tekshiruvda)
    // qayta-qayta xabar yubormaslik uchun oldingi holatni tekshiramiz.
    const existingSub = await prisma.exchangeSubscription.findUnique({
      where: {
        subscriberTelegramId_channelId: {
          subscriberTelegramId: String(subscriberTelegramId),
          channelId: Number(exchangeChannelId)
        }
      }
    });
    const isNewSubscriber = !existingSub || !existingSub.isCurrentMember;

    // TUZATILDI: faqat MUTLAQO YANGI (ilgari bu kanalga umuman obuna
    // bo'lmagan) holatlarga kunlik chegara qo'llanadi — mavjud obunani
    // qayta tasdiqlash (masalan davriy tekshiruvdan keyin qayta obuna
    // bo'lganda) bunga kirmaydi, chunki bu haqiqiy foydalanuvchini
    // jazolamasligi kerak.
    if (!existingSub) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentNewSubs = await prisma.exchangeSubscription.count({
        where: { subscriberTelegramId: String(subscriberTelegramId), subscribedAt: { gte: since } }
      });
      const maxPerDay = await getMaxNewSubsPerDay();
      if (recentNewSubs >= maxPerDay) {
        return res.status(429).json({
          error: `Kuniga eng ko'pi bilan ${maxPerDay} ta yangi kanalga obuna belgilashingiz mumkin. Ertaga qayta urinib ko'ring.`
        });
      }
    }

    await prisma.exchangeSubscription.upsert({
      where: {
        subscriberTelegramId_channelId: {
          subscriberTelegramId: String(subscriberTelegramId),
          channelId: Number(exchangeChannelId)
        }
      },
      // MUHIM: creditGrantedAmount/creditClawedBack shu yerda YANGILANMAYDI —
      // ular faqat pastdagi kredit-berish blokida (haqiqatan kredit
      // berilgandan KEYIN, muvaffaqiyatli bo'lsagina) yoziladi. Shunday
      // qilib, agar kredit berish bosqichida xatolik yuz bersa (masalan
      // ownChannels so'rovi muvaffaqiyatsiz bo'lsa), yozuv "kredit
      // berilgan" deb noto'g'ri belgilanib qolmaydi.
      update: { isCurrentMember: true, lastCheckedAt: new Date() },
      create: {
        subscriberTelegramId: String(subscriberTelegramId),
        channelId: Number(exchangeChannelId),
        isCurrentMember: true
      }
    });

    if (isNewSubscriber) {
      // TUZATILDI (foydalanuvchi talabi — "ball/kredit bor foydalanuvchilar
      // navbatdan olib tashlanib qo'lda qayta ishga tushirishga to'g'ri
      // kelyapti, kanallar DOIM navbatda turishi kerak"): avval bu yerda
      // kredit qo'shilgan zahoti kanal isActive=false qilinardi ("navbat
      // aylansin" degan mantiqda) — bu esa aynan shu muammoning ILDIZI
      // edi: har safar admin panelidan qo'lda tiklash kerak bo'lardi
      // (keyin buni 3 soatlik avtomatik cron bilan yumshatishga urinildi,
      // lekin foydalanuvchi buni ham istamadi — kanal HECH QACHON
      // navbatdan chiqmasligi kerak, chunki doimiy odamlar botdan
      // foydalanadi). Endi kredit (obunachi krediti) olish kanalning
      // isActive holatiga UMUMAN ta'sir qilmaydi — kanal doim navbatda
      // qoladi, faqat earnedSubscribers oshadi. Kanal FAQAT quyidagi haqiqiy
      // sabablar bilan navbatdan chiqadi: 1) egasi boshqa kanaldan chiqib
      // ketsa (lapse), 2) bot admin huquqini yo'qotsa (health-check),
      // 3) kamida 2 kishi shikoyat qilsa, 4) admin qo'lda bloklasa.
      try {
        const subscriberMultiplier = await getSubscriberMultiplier();
        const ownChannels = await prisma.exchangeChannel.findMany({
          where: { ownerTelegramId: String(subscriberTelegramId) }
        });
        if (ownChannels.length > 0) {
          await prisma.exchangeChannel.updateMany({
            where: { id: { in: ownChannels.map((c: any) => c.id) } },
            data: {
              earnedSubscribers: { increment: subscriberMultiplier }
              // isActive o'zgarmaydi (true bo'lib qoladi) — kanal doim
              // navbatda qoladi.
            }
          });
          // TUZATISH ("kredit qaytarib olinmaydi" muammosi): kredit
          // muvaffaqiyatli berilgandan so'ng, shu ANIQ obuna yozuvida
          // "qancha kredit berildi" qayd etiladi va "qaytarib olindimi"
          // bayrog'i false'ga qaytariladi (agar bu qayta-obuna bo'lsa —
          // ya'ni foydalanuvchi ilgari chiqib ketib, kredit qaytarib
          // olingan bo'lib, endi yana obuna bo'lgan bo'lsa — keyingi safar
          // yana chiqib ketsa yana qaytarib olinishi uchun).
          await prisma.exchangeSubscription.update({
            where: {
              subscriberTelegramId_channelId: {
                subscriberTelegramId: String(subscriberTelegramId),
                channelId: Number(exchangeChannelId)
              }
            },
            data: { creditGrantedAmount: subscriberMultiplier, creditClawedBack: false }
          });

          // Kanal endi kredit sababli hech qachon navbatdan chiqarilmaydi
          // — doim navbatda qolib, ko'rinishda davom etadi.
          const queueNote = " (kanalingiz navbatda qolmoqda, ko'rinish olishda davom etmoqda)";
          // TUZATILDI (foydalanuvchi talabi — "100 ta obunachi qo'shildi"
          // xabari HAQIQIY Telegram obunachisi qo'shilgandek yolg'on
          // tuyulardi, holbuki bu faqat ICHKI reyting/navbat balli): endi
          // "obunachi" emas "ball" deyiladi va matnga qisqa izoh
          // qo'shildi, toki kanal egasi buni real obunachi deb
          // adashtirmasin.
          // YANGI (foydalanuvchi talabi — rag'batlantiruvchi bildirishnoma):
          // ball qo'shilgani haqidagi xabarga endi qisqa, DAVOM ETISHGA
          // undovchi qism ham qo'shiladi — "yana obuna bo'lsangiz, yana
          // ball qo'shiladi" mexanikasi tushuntiriladi. MUHIM: foydalanuvchi
          // aslida "100 ta obunachi, 100% kafolat" kabi so'z birikmasini
          // so'ragan edi, lekin bu ANIQ o'sha "ball"ni "obunachi" bilan
          // adashtiradigan, va noaniq sonni "kafolat" qilib ko'rsatadigan
          // matn edi — xuddi shu muammo yuqorida ataylab TUZATILGAN edi
          // ("Ball" — botning ichki hisobi, haqiqiy obunachi emas).
          // Shu sabab bu yerda xushyoqarli, lekin RIYOSIZ shakl
          // ishlatildi: aniq son/kafolat va'da qilinmaydi, faqat mexanika
          // (yana obuna bo'lsangiz — yana ball, ko'proq ball — navbatda
          // ko'proq ko'rinish, demak ko'proq REAL obunachi ehtimoli)
          // tushuntiriladi. "📋 Yana kanal topish" tugmasi to'g'ridan-
          // to'g'ri ex_browse ro'yxatini ochadi — davom etish uchun yana
          // menyuga qaytish shart emas.
          const creditNotifyToken = await resolveSubscriberBotTokenForNotify();
          if (creditNotifyToken) {
            // YANGI (foydalanuvchi talabi — admin panelidan bot
            // xabarlarini o'zi tahrirlashni xohlaydi): bu — aynan
            // ekranda ko'rsatilgan "🎉 Tabriklaymiz! ... ball qo'shildi"
            // xabari. Endi matn ("ex_credit_awarded_notify") va tugma
            // yorlig'i ("ex_credit_awarded_browse_btn") ikkalasi ham
            // src/lib/botMessages.ts orqali (admin tahriri bo'lsa —
            // o'shandan, aks holda src/lib/botMessageDefaults.ts'dagi
            // standartidan) o'qiladi — kodga tegmasdan, admin panel
            // orqali o'zgartiriladi.
            Promise.all([
              renderBotMessage("ex_credit_awarded_notify", {
                title: escapeHtmlSimple(channel.title),
                multiplier: subscriberMultiplier
              }),
              renderBotMessage("ex_credit_awarded_browse_btn")
            ]).then(([text, btnLabel]) =>
              sendTelegramMessage(String(subscriberTelegramId), text, {
                botToken: creditNotifyToken,
                replyMarkup: {
                  inline_keyboard: [[{ text: btnLabel, callback_data: "ex_browse" }]]
                }
              })
            ).catch((e: unknown) => logger.warn({ err: e }, "Exchange earned-subscriber notify failed"));
          } else {
            logger.warn("TELEGRAM_SUBSCRIBER_BOT_TOKEN sozlanmagan — kredit bildirishnomasi yuborilmadi.");
          }
          findUserIdByTelegramId(String(subscriberTelegramId))
            .then((uid) => uid && createNotification(
              uid,
              "EXCHANGE",
              "🏆 Ball qo'shildi",
              `"${channel.title}" kanaliga obuna bo'lganingiz uchun kanalingizga ${subscriberMultiplier} ta ball qo'shildi${queueNote}.`
            ))
            .catch((e: unknown) => logger.warn({ err: e }, "Exchange credit activity-log failed"));
        }
      } catch (creditErr: unknown) {
        logger.error({ err: creditErr }, "Exchange earned-subscriber credit error");
      }
    }

    res.json({ success: true });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange confirm-subscribe error");
    res.status(500).json({ error: "Obunani belgilashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/all-subscriber-ids
// Bot proaktiv (davriy, masalan har 3 soatda) tekshiruv uchun ishlatadi:
// hozircha "faol" deb belgilangan obunasi bor barcha foydalanuvchilarning
// telegram ID ro'yxatini qaytaradi, keyin bot har biri uchun ex_browse'dagi
// bilan bir xil tekshiruv+report-check oqimini o'zi bajaradi.
router.get("/all-subscriber-ids", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const rows = await prisma.exchangeSubscription.findMany({
      where: { isCurrentMember: true },
      select: { subscriberTelegramId: true },
      distinct: ["subscriberTelegramId"]
    });
    res.json(rows.map((r: any) => r.subscriberTelegramId));
  } catch (err: unknown) {
    logger.error({ err }, "Exchange all-subscriber-ids error");
    res.status(500).json({ error: "Ro'yxatni olishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/lost-access-channels
// YANGI (foydalanuvchi talabi — "kanallar navbatdan o'chib qolyapti"
// bugi ILDIZIDAN tuzatildi): checkExchangeChannelHealth avval FAQAT
// asosiy botning admin holatini tekshirardi — agar kanal "obunachi
// yig'ish" boti orqali qo'shilib, faqat O'SHA bot admin qilingan bo'lsa,
// bu SOG'LOM kanal ham "Bot kanalda admin huquqini yo'qotdi" deb
// noto'g'ri belgilanardi (qarang: exchange-service.ts'dagi izoh). Bu
// endpoint FAQAT shu aniq sabab bilan (va admin tomonidan bloklanmagan,
// shikoyat tufayli ham to'xtatilmagan) NOFAOL bo'lgan kanallarni
// qaytaradi — cron-jobs.ts shularni ikkala bot bilan qayta tekshirib,
// haqiqatan admin ekanlarini avtomatik tiklaydi.
router.get("/lost-access-channels", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const channels = await prisma.exchangeChannel.findMany({
      where: {
        isActive: false,
        blockedByAdmin: false,
        suspendedDueToReports: false,
        suspendedReason: "Bot kanalda admin huquqini yo'qotdi yoki kanal topilmadi."
      },
      select: { id: true, channelId: true, title: true, ownerTelegramId: true }
    });
    res.json(channels);
  } catch (err: unknown) {
    logger.error({ err }, "Exchange lost-access-channels error");
    res.status(500).json({ error: "Kanallar ro'yxatini olishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/reactivate-verified-channels
// Bot ikkala tokeni bilan tekshirib, haqiqatan admin ekanligi
// tasdiqlangan kanal ID'lari ro'yxatini yuboradi — shu yerda navbatga
// qaytariladi.
router.post("/reactivate-verified-channels", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.filter((n: any) => Number.isInteger(n)) : [];
    if (ids.length === 0) return res.json({ reactivated: 0 });

    const result = await prisma.exchangeChannel.updateMany({
      where: { id: { in: ids }, blockedByAdmin: false, suspendedDueToReports: false },
      data: { isActive: true, suspendedDueToLapse: false, suspendedDueToCreditEarned: false, suspendedReason: null }
    });
    res.json({ reactivated: result.count });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange reactivate-verified-channels error");
    res.status(500).json({ error: "Kanallarni tiklashda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/active-channels-health
// TUZATILDI: ilgari faol kanallarning bot hali ham admin ekanligi
// UMUMAN tekshirilmasdi — agar kanal egasi botni admin'likdan olib
// tashlasa yoki kanalni o'chirib yuborsa, kanal "faol" bo'lib qolaverar
// va boshqalarga navbat orqali taklif qilinaverar edi (foydalanuvchi
// "Obuna bo'ldim" bossa tushunarsiz xatolik olardi). Bot bu ro'yxatni
// davriy olib, har bir kanalda hali admin ekanini o'zi tekshiradi.
router.get("/active-channels-health", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const channels = await prisma.exchangeChannel.findMany({
      where: { isActive: true },
      select: { id: true, channelId: true, title: true, ownerTelegramId: true }
    });
    res.json(channels);
  } catch (err: unknown) {
    logger.error({ err }, "Exchange active-channels-health error");
    res.status(500).json({ error: "Kanallar ro'yxatini olishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/hourly-join-report
// YANGI (foydalanuvchi talabi): kanal egasiga "kanalingizga bot orqali
// N ta odam qo'shildi" bildirishnomasini SOATIGA BIR MARTA yuborish
// uchun. Har bir ExchangeChannel uchun lastJoinNotifiedAt'dan (yoki u
// hali null bo'lsa createdAt'dan) beri paydo bo'lgan YANGI
// ExchangeSubscription yozuvlari sanaladi (subscribedAt faqat yozuv
// birinchi marta YARATILGANDA to'ldiriladi — qayta tasdiqlashda
// o'zgarmaydi, shu sabab bu haqiqiy "yangi qo'shilish" hisoblanadi).
// Faqat kamida 1 ta yangi qo'shilishi bor kanallar qaytariladi — bot
// shu ro'yxatni olib, har bir egaga alohida xabar yuboradi. Kursor
// shu yerning o'zida (javob qaytarishdan oldin) darhol yangilanadi —
// bot xabarni yubora olmasa ham (masalan vaqtinchalik tarmoq xatosi),
// bir xil sonlar keyingi soatda TAKRORLANMAYDI (boshqa davriy
// vazifalar — masalan checkExchangeChannelHealth — bilan bir xil
// "eng yaxshi urinish" yondashuvi).
router.get("/hourly-join-report", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const channels = await prisma.exchangeChannel.findMany({
      select: { id: true, ownerTelegramId: true, title: true, lastJoinNotifiedAt: true, createdAt: true }
    });

    const now = new Date();
    const report: { channelId: number; ownerTelegramId: string; title: string; newSubscribers: number }[] = [];
    const notifiedChannelIds: number[] = [];

    for (const c of channels) {
      const since = c.lastJoinNotifiedAt || c.createdAt;
      const newSubscribers = await prisma.exchangeSubscription.count({
        where: { channelId: c.id, subscribedAt: { gt: since } }
      });
      if (newSubscribers > 0) {
        report.push({ channelId: c.id, ownerTelegramId: c.ownerTelegramId, title: c.title, newSubscribers });
        notifiedChannelIds.push(c.id);
      }
    }

    if (notifiedChannelIds.length > 0) {
      await prisma.exchangeChannel.updateMany({
        where: { id: { in: notifiedChannelIds } },
        data: { lastJoinNotifiedAt: now }
      });
    }

    res.json(report);
  } catch (err: unknown) {
    logger.error({ err }, "Exchange hourly-join-report error");
    res.status(500).json({ error: "Hisobotni olishda xatolik yuz berdi." });
  }
});

// GET /api/telegram/exchange/inactivity-reminder-report
// YANGI (foydalanuvchi talabi — obunachi yig'ishda faollikni
// rag'batlantirish): odamlar "Obunachi yig'ish" navbatiga kanal
// qo'shadi-yu, LEKIN o'zlari boshqalarning kanaliga obuna bo'lmay,
// almashinuv aylanmasini sekinlashtirib qo'yishi mumkin. Bu hisobot
// har bir faol (isActive=true) kanal egasi uchun oxirgi 24 soat
// ichida (yoki kanal shundan keyin qo'shilgan bo'lsa — createdAt'dan
// beri) O'ZI biror kanalga obuna bo'lganmi-yo'qmi tekshiradi
// (ExchangeSubscription.subscriberTelegramId = shu egasi). Agar
// bo'lmagan bo'lsa — bitta yumshoq eslatma yuborish uchun ro'yxatga
// qo'shiladi. Bir kishining bir nechta faol kanali bo'lsa ham, faqat
// BITTA marta ro'yxatga tushadi (spam bo'lmasligi uchun).
//
// hourly-join-report bilan bir xil naqsh: kursor (lastInactivityReminderAt)
// javob qaytarishdan OLDIN darhol "hozir"ga yangilanadi — bot xabarni
// yubora olmasa ham (tarmoq xatosi va h.k.), bir xil eslatma
// keyingi soatda TAKRORLANMAYDI, 24 soatlik oyna yangidan boshlanadi.
router.get("/inactivity-reminder-report", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  try {
    const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
    const now = new Date();

    const channels = await prisma.exchangeChannel.findMany({
      where: { isActive: true },
      select: { id: true, ownerTelegramId: true, title: true, createdAt: true, lastInactivityReminderAt: true }
    });

    const report: { ownerTelegramId: string; title: string }[] = [];
    const remindedOwners = new Set<string>();
    const checkedChannelIds: number[] = [];

    for (const c of channels) {
      const since = c.lastInactivityReminderAt || c.createdAt;
      // Hali 24 soat to'lmagan bo'lsa — bu kanalni bu safar o'tkazib
      // yuboramiz (kursorni ham siljitmaymiz, chunki oyna hali yopilmagan).
      if (now.getTime() - since.getTime() < REMINDER_WINDOW_MS) continue;

      checkedChannelIds.push(c.id);

      const ownSubscriptionsCount = await prisma.exchangeSubscription.count({
        where: { subscriberTelegramId: c.ownerTelegramId, subscribedAt: { gt: since } }
      });

      if (ownSubscriptionsCount === 0 && !remindedOwners.has(c.ownerTelegramId)) {
        remindedOwners.add(c.ownerTelegramId);
        report.push({ ownerTelegramId: c.ownerTelegramId, title: c.title });
      }
    }

    if (checkedChannelIds.length > 0) {
      await prisma.exchangeChannel.updateMany({
        where: { id: { in: checkedChannelIds } },
        data: { lastInactivityReminderAt: now }
      });
    }

    res.json(report);
  } catch (err: unknown) {
    logger.error({ err }, "Exchange inactivity-reminder-report error");
    res.status(500).json({ error: "Hisobotni olishda xatolik yuz berdi." });
  }
});

// POST /api/telegram/exchange/deactivate-channel
// Bot getChatMember orqali o'zining shu kanalda endi admin emasligini
// (yoki kanalga umuman kira olmasligini — o'chirilgan/bot chiqarib
// yuborilgan) aniqlaganda chaqiradi. blockedByAdmin=false qoldiriladi —
// egasi botni qayta admin qilib, kanalni qaytadan qo'shsa (mavjud
// register-channel oqimi), avtomatik qayta faollashadi.
router.post("/deactivate-channel", async (req: Request, res: Response) => {
  if (!(await requireBotSecret(req, res))) return;

  const { id, reason } = req.body;
  if (!id) {
    return res.status(400).json({ error: "id majburiy." });
  }

  try {
    // TUZATILDI (foydalanuvchi talabi): sponsor kanal bot admin huquqini
    // yo'qotgan taqdirda ham AVTOMATIK o'chirilmaydi (isActive=true
    // qoladi) — bu holat faqat adminga xabar sifatida yuboriladi, chunki
    // sponsor kanal doim navbatda birinchi turishi kerak va uni faqat
    // admin qo'lda boshqarishi lozim. (Sabab baribir suspendedReason'ga
    // yozib qo'yiladi — admin panelida "bot admin emas" ekanini ko'radi,
    // lekin kanal foydalanuvchilarga ko'rsatilishda davom etadi.)
    const existing = await prisma.exchangeChannel.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return res.status(404).json({ error: "Kanal topilmadi." });
    }
    if (existing.isSponsor) {
      await prisma.exchangeChannel.update({
        where: { id: Number(id) },
        data: { suspendedReason: reason || "Bot kanalda admin huquqini yo'qotdi yoki kanal topilmadi." }
      });
      notifyAdminTelegram(
        `⚠️ <b>Sponsor kanalda muammo</b>\n\nBot "${escapeHtmlSimple(existing.title)}" sponsor kanalida admin huquqini yo'qotdi yoki kanal topilmadi. Kanal hali navbatda (avtomatik o'chirilmadi), lekin tekshirib, botni qaytadan admin qiling.`
      ).catch((e: unknown) => logger.warn({ err: e }, "Exchange sponsor-channel-lost-access admin notify failed"));
      return res.json({ success: true, skippedSponsor: true, channel: { id: existing.id, title: existing.title, ownerTelegramId: existing.ownerTelegramId } });
    }

    const channel = await prisma.exchangeChannel.update({
      where: { id: Number(id) },
      data: {
        isActive: false,
        suspendedDueToLapse: false,
        suspendedReason: reason || "Bot kanalda admin huquqini yo'qotdi yoki kanal topilmadi."
      }
    });
    res.json({ success: true, channel: { id: channel.id, title: channel.title, ownerTelegramId: channel.ownerTelegramId } });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange deactivate-channel error");
    res.status(500).json({ error: "Kanalni to'xtatishda xatolik yuz berdi." });
  }
});

// GET /api/exchange/my-channels — SAYT profili uchun (bot maxfiy kaliti
// emas, oddiy login orqali). Faqat Telegram hisobi ulangan
// foydalanuvchilar uchun ishlaydi.
const siteRouter = Router();
siteRouter.get("/my-channels", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.telegramUserId) {
      return res.json({ linked: false, channels: [] });
    }
    const channels = await prisma.exchangeChannel.findMany({
      where: { ownerTelegramId: user.telegramUserId },
      orderBy: { createdAt: "desc" }
    });

    const referralCredit = await prisma.exchangeReferralCredit.findUnique({
      where: { ownerTelegramId: user.telegramUserId }
    }).catch(() => null);

    res.json({
      linked: true,
      // Referal orqali (taklif qilingan do'stlar o'z kanalini ulagani
      // uchun) yig'ilgan bonus obunachilar — bu HAR BIR alohida kanalga
      // emas, foydalanuvchining umumiy hisobiga tegishli, shuning uchun
      // pastdagi kanallar ro'yxatidan alohida ko'rsatiladi.
      referralBonus: referralCredit?.bonusSubscribers || 0,
      channels: channels.map((c: any) => ({
        id: c.id,
        title: c.title,
        channelUsername: c.channelUsername,
        isActive: c.isActive,
        suspendedReason: c.suspendedReason,
        blockedByAdmin: c.blockedByAdmin,
        // TUZATILDI: subscriberCount = kanal egasi BOSHQA kanallarga
        // obuna bo'lib to'plagan kredit (earnedSubscribers), boshqalar
        // shu kanalga obuna bo'lgani UCHUN emas.
        subscriberCount: c.earnedSubscribers
      }))
    });
  } catch (err: unknown) {
    logger.error({ err }, "Exchange site my-channels error");
    res.status(500).json({ error: "Kanallarni olishda xatolik yuz berdi." });
  }
});

// ---- ADMIN MODERATSIYASI ----
// GET /api/admin/exchange-channels — barcha kanallar (moderatsiya uchun)
// TUZATILDI: avval BARCHA kanallar bir martada (sahifalashsiz) frontendga
// yuborilardi va butun jadval bir yo'la DOM'da render qilinardi — kanallar
// soni minglab bo'lsa sekinlashadi, va admin holat bo'yicha filtrlay
// olmasdi. Endi server tomonida qidiruv (title/username/ownerId bo'yicha),
// holat filtri va sahifalash qo'shildi; frontend faqat joriy sahifani oladi.
const CHANNELS_PAGE_SIZE_DEFAULT = 20;
const CHANNELS_PAGE_SIZE_MAX = 100;
const CHANNELS_SORTABLE_FIELDS = ["createdAt", "earnedSubscribers", "title"] as const;
type ChannelsSortField = typeof CHANNELS_SORTABLE_FIELDS[number];

adminRouter.get("/", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      CHANNELS_PAGE_SIZE_MAX,
      Math.max(1, parseInt(String(req.query.pageSize ?? String(CHANNELS_PAGE_SIZE_DEFAULT)), 10) || CHANNELS_PAGE_SIZE_DEFAULT)
    );
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    // status: 'all' (standart) | 'active' | 'blocked' | 'suspended' | 'reported' | 'inactive'
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
    const sortBy: ChannelsSortField = (CHANNELS_SORTABLE_FIELDS as readonly string[]).includes(sortByRaw)
      ? (sortByRaw as ChannelsSortField)
      : "createdAt";
    const sortDir: "asc" | "desc" = req.query.sortDir === "asc" ? "asc" : "desc";

    const searchWhere: any = {};
    if (search) {
      const mode = isPostgres ? { mode: "insensitive" as const } : {};
      searchWhere.OR = [
        { title: { contains: search, ...mode } },
        { channelUsername: { contains: search, ...mode } },
        { ownerUsername: { contains: search, ...mode } },
        { ownerTelegramId: { contains: search } }
      ];
    }
    const where: any = { ...searchWhere };
    if (status === "active") {
      where.isActive = true;
      where.blockedByAdmin = false;
      where.suspendedDueToLapse = false;
    } else if (status === "blocked") {
      where.blockedByAdmin = true;
    } else if (status === "suspended") {
      where.suspendedDueToLapse = true;
    } else if (status === "reported") {
      where.suspendedDueToReports = true;
    } else if (status === "inactive") {
      where.isActive = false;
      where.blockedByAdmin = false;
      where.suspendedDueToLapse = false;
    }

    // Eslatma: _count.subscriptions bu yerda faqat MODERATSIYA uchun —
    // kanalga qancha HAQIQIY odam obuna bo'lganini ko'rsatadi (moderator
    // ko'rishi uchun foydali). Bu foydalanuvchiga ko'rsatiladigan
    // subscriberCount (earnedSubscribers) bilan ADASHTIRILMASIN — u
    // egasining boshqa kanallarga obuna bo'lib to'plagan kreditidir.
    //
    // "counts" — statistika kartalari uchun, joriy QIDIRUVGA (lekin holat
    // filtriga emas) mos barcha kanallarning holat bo'yicha taqsimoti —
    // shu sabab admin bitta statusni filtrlab ko'rayotganda ham
    // statistika kartalari umumiy manzarani ko'rsatishda davom etadi.
    const [channels, total, countAll, countActive, countSuspended, countBlocked, countReported] = await Promise.all([
      prisma.exchangeChannel.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        // YANGI: _count.reports — admin jadvalida shikoyatlar sonini
        // ko'rsatish uchun (har bir shikoyat qatori emas, faqat son —
        // batafsil sabablar kerak bo'lsa keyinchalik alohida endpoint
        // qo'shilishi mumkin).
        include: { _count: { select: { subscriptions: { where: { isCurrentMember: true } }, reports: true } } }
      }).catch(async () =>
        // ba'zi Prisma versiyalarida include+where filter kombinatsiyasi
        // farq qilishi mumkin — xavfsiz fallback sifatida _count'siz ro'yxat
        prisma.exchangeChannel.findMany({ where, orderBy: { [sortBy]: sortDir }, skip: (page - 1) * pageSize, take: pageSize })
      ),
      prisma.exchangeChannel.count({ where }),
      prisma.exchangeChannel.count({ where: searchWhere }),
      prisma.exchangeChannel.count({ where: { ...searchWhere, isActive: true, blockedByAdmin: false, suspendedDueToLapse: false, suspendedDueToReports: false } }),
      prisma.exchangeChannel.count({ where: { ...searchWhere, suspendedDueToLapse: true } }),
      prisma.exchangeChannel.count({ where: { ...searchWhere, blockedByAdmin: true } }),
      prisma.exchangeChannel.count({ where: { ...searchWhere, suspendedDueToReports: true } })
    ]);

    res.json({
      channels,
      total,
      page,
      pageSize,
      counts: { all: countAll, active: countActive, suspended: countSuspended, blocked: countBlocked, reported: countReported }
    });
  } catch (err: unknown) {
    logger.error({ err }, "Admin exchange-channels list error");
    res.status(500).json({ error: "Kanallarni olishda xatolik yuz berdi." });
  }
});

// GET /api/admin/exchange-channels/invites-status — hozirgi holatni olish
adminRouter.get("/invites-status", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ enabled: await isExchangeInvitesEnabled() });
  } catch (err: unknown) {
    logger.error({ err }, "Admin exchange invites-status error");
    res.status(500).json({ error: "Holatni olishda xatolik yuz berdi." });
  }
});

// POST /api/admin/exchange-channels/invites-status — yoqish/o'chirish
adminRouter.post("/invites-status", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "\"enabled\" (true/false) majburiy." });
  }
  try {
    await prisma.setting.upsert({
      where: { key: "EXCHANGE_INVITES_ENABLED" },
      update: { value: encryptSecret(String(enabled)), updatedById: req.user?.id || 0 },
      create: { key: "EXCHANGE_INVITES_ENABLED", value: encryptSecret(String(enabled)), updatedById: req.user?.id || 0 }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: enabled ? "enable_exchange_invites" : "disable_exchange_invites",
        targetId: "exchange_invites",
        details: `Admin ${req.user?.name || req.user?.id}, "Obuna almashish" bo'limida odamlarni kanallarga taklif qilishni ${enabled ? "yoqdi" : "o'chirdi"}.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
    res.json({ success: true, enabled });
  } catch (err: unknown) {
    logger.error({ err }, "Admin exchange invites-status toggle error");
    res.status(500).json({ error: "Holatni o'zgartirishda xatolik yuz berdi." });
  }
});

// ✉️ BOT XABARLARI — YANGI (foydalanuvchi talabi: "admin paneldan shu
// bilan bog'liq 'Obunachi yig'ish' botining barcha xabarlarini o'zim
// qo'lda to'g'irlashni xohlayman, sen yozib berolmayapsan"):
//
// "Obunachi yig'ish" (AktivObunalar) botining BARCHA matn shablonlari
// (src/lib/botMessageDefaults.ts'dagi ro'yxat) shu uchta endpoint
// orqali admin panelidan to'g'ridan-to'g'ri, kodga tegmasdan
// tahrirlanadi. Har bir kalit uchun standart (default) matn ham,
// admin tahriri (agar bo'lsa) ham qaytariladi — shu bilan admin panel
// "standart bilan solishtirish" va "standartga qaytarish" imkoniyatini
// bera oladi.
//
// Tahrir Setting jadvalida "BOT_MSG:<key>" kaliti bilan (boshqa
// maxfiy sozlamalar kabi) shifrlangan holda saqlanadi. Faqat
// src/lib/botMessageDefaults.ts'da RO'YXATDAN O'TGAN kalitlar
// yozilishi mumkin (whitelist) — bu endpoint orqali boshqa (masalan
// API token) Setting kalitlarini yozib qo'yib bo'lmaydi.

// GET /api/admin/exchange-channels/messages — barcha shablonlar
// (standart + admin tahriri, agar bo'lsa) ro'yxati.
adminRouter.get("/messages", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { startsWith: BOT_MSG_SETTING_PREFIX } }
    });
    const overrides = new Map<string, string>();
    for (const row of rows) {
      try {
        overrides.set(row.key.slice(BOT_MSG_SETTING_PREFIX.length), await getSetting(row.key) || "");
      } catch {
        // e'tiborsiz qoldiriladi — shu bitta kalit standart matn bilan ko'rsatiladi
      }
    }
    const messages = Object.keys(BOT_MESSAGE_DEFAULTS).map((key) => {
      const defaultValue = BOT_MESSAGE_DEFAULTS[key];
      const override = overrides.get(key);
      return {
        key,
        defaultValue,
        // Admin hali tahrirlamagan bo'lsa null — front-end shu holatda
        // "standart" belgisini ko'rsatadi.
        value: override !== undefined && override !== "" ? override : null,
        placeholders: extractPlaceholders(defaultValue)
      };
    });
    res.json({ messages });
  } catch (err: unknown) {
    logger.error({ err }, "Admin bot-messages list error");
    res.status(500).json({ error: "Xabar shablonlarini olishda xatolik yuz berdi." });
  }
});

// PUT /api/admin/exchange-channels/messages/:key — bitta shablonni tahrirlash
adminRouter.put("/messages/:key", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;
  if (!Object.prototype.hasOwnProperty.call(BOT_MESSAGE_DEFAULTS, key)) {
    return res.status(404).json({ error: "Bunday xabar shabloni topilmadi." });
  }
  if (typeof value !== "string" || !value.trim()) {
    return res.status(400).json({ error: "Xabar matni bo'sh bo'lishi mumkin emas." });
  }
  if (value.length > 4000) {
    return res.status(400).json({ error: "Xabar matni juda uzun (4000 belgidan oshmasligi kerak)." });
  }
  try {
    const settingKey = `${BOT_MSG_SETTING_PREFIX}${key}`;
    await prisma.setting.upsert({
      where: { key: settingKey },
      update: { value: encryptSecret(value), updatedById: req.user?.id || 0 },
      create: { key: settingKey, value: encryptSecret(value), updatedById: req.user?.id || 0 }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "edit_bot_message",
        targetId: key,
        details: `Admin ${req.user?.name || req.user?.id}, "${key}" bot xabar shablonini tahrirladi.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
    res.json({ success: true, key, value });
  } catch (err: unknown) {
    logger.error({ err }, "Admin bot-message update error");
    res.status(500).json({ error: "Xabar shablonini saqlashda xatolik yuz berdi." });
  }
});

// POST /api/admin/exchange-channels/messages/:key/reset — standartga qaytarish
adminRouter.post("/messages/:key/reset", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  if (!Object.prototype.hasOwnProperty.call(BOT_MESSAGE_DEFAULTS, key)) {
    return res.status(404).json({ error: "Bunday xabar shabloni topilmadi." });
  }
  try {
    const settingKey = `${BOT_MSG_SETTING_PREFIX}${key}`;
    await prisma.setting.deleteMany({ where: { key: settingKey } });
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "reset_bot_message",
        targetId: key,
        details: `Admin ${req.user?.name || req.user?.id}, "${key}" bot xabar shablonini standart holatga qaytardi.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
    res.json({ success: true, key, defaultValue: BOT_MESSAGE_DEFAULTS[key] });
  } catch (err: unknown) {
    logger.error({ err }, "Admin bot-message reset error");
    res.status(500).json({ error: "Standartga qaytarishda xatolik yuz berdi." });
  }
});

// POST /api/admin/exchange-channels/:id/adjust-bonus
// YANGI (foydalanuvchi talabi bo'yicha, bug tuzatilgach): eski
// "xush kelibsiz bonusi" bugi (yuqoridagi TUZATILDI izohiga qarang)
// tufayli ba'zi foydalanuvchilarda ExchangeWelcomeBonus yozuvi
// yaratilgan-u, lekin +5 obunachi berilmagan bo'lishi mumkin edi —
// va bunday foydalanuvchi endi ODDIY OQIM ORQALI (kanalni o'chirib
// qayta qo'shish) bonusni QAYTA OLA OLMAYDI, chunki ExchangeWelcomeBonus
// yozuvi bazada abadiy qolib ketgan (unique constraint doim P2002
// qaytaradi). Shu sabab admin panelidan qo'lda tuzatish imkoniyati
// kerak: musbat yoki manfiy son bilan kanalning earnedSubscribers
// sonini to'g'ridan-to'g'ri sozlash (masalan qochib ketgan bonusni
// qo'lda qaytarish, yoki suiiste'mol qilingan sonni kamaytirish).
adminRouter.post("/:id/adjust-bonus", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount === 0) {
    return res.status(400).json({ error: "\"amount\" butun son (musbat yoki manfiy, nolga teng bo'lmagan) bo'lishi kerak." });
  }
  // TUZATILDI (admin talabi — "cheklovni olib tashlash kerak"): avval
  // bir martada eng ko'pi bilan 1000 birlik o'zgartirish mumkin edi —
  // bu cheklov olib tashlandi. Yagona qolgan chegara — bazadagi
  // `earnedSubscribers` ustuni 32-bitli INTEGER ekanligi (doToggleSponsor
  // / SPONSOR_CREDIT_MAX bilan bir xil sabab) — bundan oshib ketsa
  // Postgres o'zi xato qaytaradi, shu sabab oldindan aniq xabar bilan
  // to'xtatamiz.
  const INT32_MAX = 2147483647;
  if (Math.abs(amount) > INT32_MAX) {
    return res.status(400).json({ error: `Miqdor ${INT32_MAX.toLocaleString('en-US')} dan oshmasligi kerak (bazadagi ustun chegarasi).` });
  }
  try {
    const existing = await prisma.exchangeChannel.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) {
      return res.status(404).json({ error: "Kanal topilmadi." });
    }
    // Manfiy tomonga 0 dan pastga tushirib yubormaslik uchun ehtiyot
    // chorasi — ko'rsatilgan obunachi soni hech qachon manfiy bo'lmasligi
    // kerak.
    const safeAmount = amount < 0 ? -Math.min(Math.abs(amount), existing.earnedSubscribers) : amount;
    // Musbat tomonda esa yakuniy summa INT32_MAX'dan oshib ketmasligi
    // kerak — aks holda Postgres o'zi (noaniqroq) xato qaytaradi.
    if (existing.earnedSubscribers + safeAmount > INT32_MAX) {
      return res.status(400).json({
        error: `Bu amal kredit sonini ${INT32_MAX.toLocaleString('en-US')} dan oshiradi (bazadagi ustun chegarasi) — kichikroq miqdor kiriting.`
      });
    }
    const channel = await prisma.exchangeChannel.update({
      where: { id: existing.id },
      data: { earnedSubscribers: { increment: safeAmount } }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: safeAmount > 0 ? "grant_exchange_bonus" : "revoke_exchange_bonus",
        targetId: String(channel.id),
        details: `Admin ${req.user?.name || req.user?.id}, "${channel.title}" kanaliga qo'lda ${safeAmount > 0 ? "+" : ""}${safeAmount} obunachi tuzatishi kiritdi${req.body?.reason ? ` (sabab: ${String(req.body.reason).slice(0, 200)})` : ""}.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
    res.json({ success: true, channel });
  } catch (err: unknown) {
    logger.error({ err }, "Admin adjust-bonus error");
    res.status(500).json({ error: "Obunachi sonini tuzatishda xatolik yuz berdi." });
  }
});

// POST /api/admin/exchange-channels/:id/block
// POST /api/admin/exchange-channels/:id/block
// TUZATILDI: avval sabab qattiq kodlangan edi ("Admin tomonidan
// bloklangan.") — admin nima uchun bloklaganini yoza olmasdi, keyinchalik
// faqat audit logdan qidirish kerak bo'lardi va foydalanuvchiga/boshqa
// adminlarga UI'da darhol ko'rinmasdi. Endi ixtiyoriy `reason` qabul
// qilinadi va shu matn suspendedReason sifatida saqlanadi (bo'sh
// bo'lsa — standart matn ishlatiladi, orqaga moslik uchun).
adminRouter.post("/:id/block", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const rawReason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (rawReason.length > 500) {
    return res.status(400).json({ error: "Sabab 500 belgidan oshmasligi kerak." });
  }
  const suspendedReason = rawReason || "Admin tomonidan bloklangan.";
  try {
    const channel = await prisma.exchangeChannel.update({
      where: { id: Number(req.params.id) },
      data: {
        isActive: false,
        blockedByAdmin: true,
        suspendedDueToLapse: false,
        suspendedDueToReports: false,
        suspendedDueToCreditEarned: false,
        suspendedReason
      }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "block_exchange_channel",
        targetId: String(channel.id),
        details: `Admin ${req.user?.name || req.user?.id}, "${channel.title}" obuna almashish kanalini bloklandi${rawReason ? ` (sabab: ${rawReason.slice(0, 300)})` : ""}.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
    res.json({ success: true, channel });
  } catch (err: unknown) {
    logger.error({ err }, "Admin block exchange channel error");
    res.status(500).json({ error: "Bloklashda xatolik yuz berdi." });
  }
});

// POST /api/admin/exchange-channels/:id/sponsor
// YANGI (foydalanuvchi talabi — "sponsor kanal" navbat tizimi): admin
// bu endpoint orqali MAVJUD (oddiy foydalanuvchi kabi "Kanalimni
// qo'shish" oqimidan qo'shilgan) ExchangeChannel'ni sponsor deb
// belgilaydi. Sponsor bo'lgach: (1) /browse navbatida DOIM birinchi
// chiqadi, (2) kredit/lapse/shikoyat/health-check kabi hech qanday
// avtomatik mexanizm uni endi navbatdan chiqarolmaydi (qarang: yuqoridagi
// isSponsor tekshiruvlari), (3) kredit (earnedSubscribers) darhol
// "amalda cheksiz" qiymatga o'rnatiladi.
//
// MUHIM (SON CHEGARASI): so'ralgan "1 septilion" (10^24) haqiqiy
// qiymatni bazadagi "earnedSubscribers" ustuni ushlab turolmaydi — bu
// ustun PostgreSQL'ning oddiy 32-bitli INTEGER turi (eng ko'pi ~2.147
// milliard). Hatto 64-bitli BIGINT'ga o'tkazilsa ham, uning maksimumi
// ~9.2 kvintilion — baribir 1 septiliondan ANCHA kichik. Shu sabab bu
// yerda "amaliy cheksiz" sifatida ushbu ustun ushlay oladigan ENG
// KATTA qiymat (INT32_MAX = 2 147 483 647) qo'yiladi — bu real
// foydalanuvchi hech qachon yeta olmaydigan, ko'rinishda "tugamaydigan"
// sondir. Agar chinakam katta (masalan trillionlab) raqam ustunda
// ko'rinishi SHART bo'lsa, bu ustun turini BigInt/Decimal'ga
// o'tkazuvchi alohida migratsiya kerak bo'ladi.
// MUHIM (SON CHEGARASI): so'ralgan "1 septilion" (10^24) haqiqiy qiymatni
// bazadagi "earnedSubscribers" ustuni ushlab turolmaydi — bu ustun
// PostgreSQL'ning oddiy 32-bitli INTEGER turi (eng ko'pi ~2.147 milliard).
// Shu sabab admin bu yerdan XOHLAGAN sonni kiritishi mumkin (bo'sh
// qoldirsa standart — ushbu ustun ushlay oladigan ENG KATTA qiymat),
// lekin INT32_MAX'dan katta son kiritilsa, so'rov RAD ETILADI (aks holda
// Postgres xato qaytaradi yoki, yomonroq, qiymat "to'lib toshib" manfiy
// songa aylanib qolishi mumkin edi).
const SPONSOR_PRACTICALLY_INFINITE_CREDIT = 2147483647; // INT32_MAX — ustun ushlay oladigan eng katta son

adminRouter.post("/:id/sponsor", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const makeSponsor = req.body?.isSponsor !== false; // standart: true (belgilash); false yuborilsa — bekor qilish

  // YANGI (foydalanuvchi talabi — kredit miqdori admin paneldan
  // o'zgartirilsin): agar admin "credit" maydonini yuborsa, shu son
  // ishlatiladi; yubormasa/bo'sh qoldirsa — standart (INT32_MAX)
  // ishlatiladi. INT32_MAX'dan katta yoki manfiy son so'ralsa — aniq
  // xato bilan rad etiladi (jim ravishda kesib tashlanmaydi), shunda
  // admin nima uchun so'ralgan qiymat qabul qilinmaganini ko'radi.
  let creditToSet = SPONSOR_PRACTICALLY_INFINITE_CREDIT;
  if (makeSponsor && req.body?.credit !== undefined && req.body?.credit !== null && req.body?.credit !== "") {
    const parsed = Number(req.body.credit);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      return res.status(400).json({ error: "Kredit musbat butun son bo'lishi kerak." });
    }
    if (parsed > SPONSOR_PRACTICALLY_INFINITE_CREDIT) {
      return res.status(400).json({
        error: `Kredit ${SPONSOR_PRACTICALLY_INFINITE_CREDIT.toLocaleString("en-US")} (INT32_MAX) dan katta bo'la olmaydi — bazadagi ustun bundan katta sonni saqlay olmaydi.`,
        max: SPONSOR_PRACTICALLY_INFINITE_CREDIT
      });
    }
    creditToSet = parsed;
  }

  try {
    const channel = await prisma.exchangeChannel.update({
      where: { id: Number(req.params.id) },
      data: makeSponsor
        ? {
            isSponsor: true,
            isActive: true,
            blockedByAdmin: false,
            suspendedDueToLapse: false,
            suspendedDueToReports: false,
            suspendedReason: null,
            earnedSubscribers: creditToSet
          }
        : { isSponsor: false }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: makeSponsor ? "mark_exchange_channel_sponsor" : "unmark_exchange_channel_sponsor",
        targetId: String(channel.id),
        details: `Admin ${req.user?.name || req.user?.id}, "${channel.title}" kanalini ${makeSponsor ? `SPONSOR deb belgiladi (doim navbatda birinchi, kredit ${creditToSet.toLocaleString("en-US")} qilindi)` : "sponsor holatidan chiqardi"}.`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
    res.json({ success: true, channel });
  } catch (err: unknown) {
    logger.error({ err }, "Admin sponsor-toggle exchange channel error");
    res.status(500).json({ error: "Sponsor holatini o'zgartirishda xatolik yuz berdi." });
  }
});


// TUZATILDI (foydalanuvchi talabi — "bloklab, blokdan chiqarsam FAOL
// bo'lyapti, bu nima?"): avval bu endpoint HECH QANDAY haqiqiy tekshiruv
// qilmay, doim `isActive: true` qo'yardi — hatto o'sha kanalda bot allaqachon
// admin huquqini yo'qotgan yoki kanal butunlay o'chirilgan bo'lsa ham,
// admin panelda darhol "FAOL / NAVBATDA" bo'lib ko'rinardi (garchi haqiqatda
// hech qanday yangi obunachi ololmasa ham — birinchi navbatdagi taklifda
// getChatMember xato qaytarib, kanal yana avtomatik NOFAOL bo'lib qolardi).
// Endi blokdan chiqarishdan OLDIN kanalning Telegram'dagi HAQIQIY holati
// (bot hali ham o'sha kanalda admin/creator ekanligi) tekshiriladi:
//  - bot ANIQ admin/creator EKANLIGI tasdiqlansa — kanal to'liq FAOL qilinadi;
//  - bot ANIQ admin EMASLIGI (yoki kanal topilmasligi) tasdiqlansa — blok
//    baribir olib tashlanadi (admin "bloklangan" ro'yxatidan chiqadi), LEKIN
//    isActive=false qoladi, aniq sabab bilan (checkExchangeChannelHealth
//    bilan BIR XIL matn) — shu bilan admin panelda darhol "NOFAOL: bot admin
//    emas" ko'rinadi, "FAOL / NAVBATDA" deb yolg'on ko'rsatilmaydi;
//  - tekshiruvning o'zi xato bersa (tarmoq/timeout — Telegram bot tokeni
//    sozlanmagan va h.k.) — bu holatni "aniq bot admin emas" bilan
//    aralashtirmaslik uchun ESKI xulq-atvorga (isActive: true) qaytiladi,
//    lekin ogohlantirish log qilinadi.
// TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
// botining bir-biriga aloqasi bo'lmasligi kerak"): avval bu yerda IKKI
// bot tokeni (asosiy + subscriber) sinalardi, chunki "Obunachi yig'ish"
// bo'limi ikkalasida ham ishlar edi. Endi bu bo'lim FAQAT subscriber
// botda ishlaydi — demak ExchangeChannel'ga FAQAT shu bot admin
// bo'lishi mumkin/kerak, shu sabab bu yerda ham FAQAT
// TELEGRAM_SUBSCRIBER_BOT_TOKEN tekshiriladi.
async function checkExchangeChannelStillHasAdminBot(channelTelegramId: string): Promise<
  { verified: true; hasAccess: boolean } | { verified: false }
> {
  const token = (await getSetting("TELEGRAM_SUBSCRIBER_BOT_TOKEN")) || process.env.TELEGRAM_SUBSCRIBER_BOT_TOKEN || null;

  if (!token) return { verified: false };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: controller.signal });
    const meData: any = await meRes.json().catch(() => null);
    if (!meRes.ok || !meData?.ok || !meData.result?.id) {
      clearTimeout(timer);
      return { verified: false };
    }
    const botUserId = meData.result.id;
    const memberRes = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(channelTelegramId)}&user_id=${botUserId}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const memberData: any = await memberRes.json().catch(() => null);
    if (memberRes.ok && memberData?.ok) {
      return { verified: true, hasAccess: ["administrator", "creator"].includes(memberData.result?.status) };
    }
    // Telegram "bot chat a'zosi emas" yoki "chat topilmadi" kabi aniq
    // xatolarni ham JSON bilan ({ ok: false }) qaytaradi — bu HAQIQIY
    // "kirish yo'q" javobi.
    return { verified: true, hasAccess: false };
  } catch (err) {
    logger.warn({ err, channelTelegramId }, "checkExchangeChannelStillHasAdminBot: Telegram so'rovida xato");
    return { verified: false };
  }
}

// YANGI (foydalanuvchi talabi — "kanallardan chiqib ketgan foydalanuvchini
// admin paneldan navbatga qo'shib qo'ydim" bugi tuzatildi — ILDIZ SABABI):
// yuqoridagi checkExchangeChannelStillHasAdminBot FAQAT "bot hali ham shu
// kanalda admin"ligini tekshiradi — bu qoidabuzarlik (lapse) sababli
// to'xtatilgan kanal uchun UMUMAN NOTO'G'RI savol edi (bot admin holati
// bilan foydalanuvchining boshqa kanaldan chiqib ketgani orasida hech
// qanday bog'liqlik yo'q). Shu sabab avval "Qayta tekshirish" tugmasi
// (bir xil /unblock endpoint) suspendedDueToLapse=true kanallarda ham
// ko'rinib, bosilganda bot HAR DOIM admin bo'lgani uchun kanal DARHOL,
// foydalanuvchi haqiqatan qaytadan obuna bo'lganini tekshirmasdan,
// navbatga qaytarilardi — bu qoidabuzarni "kechirib yuborardi".
//
// Bu funksiya to'g'ri savolni beradi: foydalanuvchi (userTelegramId)
// ANIQ shu kanalda (channelTelegramId) hozir a'zomi — FAQAT subscriber
// bot tokeni bilan (qarang: checkExchangeChannelStillHasAdminBot'dagi
// izoh — "Obunachi yig'ish" endi FAQAT shu botda ishlaydi).
async function checkUserIsChannelMember(channelTelegramId: string, userTelegramId: string): Promise<
  { verified: true; isMember: boolean } | { verified: false }
> {
  const token = (await getSetting("TELEGRAM_SUBSCRIBER_BOT_TOKEN")) || process.env.TELEGRAM_SUBSCRIBER_BOT_TOKEN || null;

  if (!token) return { verified: false };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const memberRes = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(channelTelegramId)}&user_id=${encodeURIComponent(userTelegramId)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const memberData: any = await memberRes.json().catch(() => null);
    if (memberRes.ok && memberData?.ok) {
      return { verified: true, isMember: ["member", "administrator", "creator"].includes(memberData.result?.status) };
    }
    // Telegram aniq xato qaytardi (masalan bot bu kanalda a'zo emas) —
    // bu holatni tarmoq xatosidan ajratib bo'lmaydi, shu sabab xavfsiz
    // tomonga (verified: false — jazolamaslik) og'amiz.
    return { verified: false };
  } catch (err) {
    logger.warn({ err, channelTelegramId, userTelegramId }, "checkUserIsChannelMember: Telegram so'rovida xato");
    return { verified: false };
  }
}

// TUZATILDI (foydalanuvchi talabi — shikoyat oqimi): bu endi
// blockedByAdmin=true bo'lgan kanallar bilan bir qatorda,
// suspendedDueToReports=true (2+ shikoyat sabab avtomatik yashirilgan,
// lekin admin hali qo'lda bloklamagan) kanallarni ham tiklaydi — admin
// shikoyatlarni ko'rib chiqib, kanal aslida toza ekan desa, shu bitta
// tugma bilan qayta faollashtiradi.
adminRouter.post("/:id/unblock", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.exchangeChannel.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) {
      return res.status(404).json({ error: "Kanal topilmadi." });
    }

    // TUZATILDI (foydalanuvchi talabi — "kanallardan chiqib ketgan
    // foydalanuvchini admin paneldan navbatga qo'shib qo'ydim" bugi):
    // qoidabuzarlik (lapse) sababli to'xtatilgan kanal butunlay ALOHIDA
    // yo'l bilan ishlov olishi kerak — bot-admin-tekshiruvi bu yerda
    // umuman NOTO'G'RI savol (qarang: checkUserIsChannelMember'dagi
    // izoh). Shu sabab bu holat generik bot-admin-tekshiruvidan OLDIN,
    // to'liq ALOHIDA ushlanadi.
    if (existing.suspendedDueToLapse && !existing.blockedByAdmin && !existing.suspendedDueToReports) {
      const lapsedSubs = await prisma.exchangeSubscription.findMany({
        where: { subscriberTelegramId: existing.ownerTelegramId, isCurrentMember: false }
      });

      let stillLapsed: string[] = [];
      let sawUnverifiable = false;
      for (const sub of lapsedSubs) {
        const targetChannel = await prisma.exchangeChannel.findUnique({ where: { id: sub.channelId } });
        if (!targetChannel) continue; // kanal o'zi o'chirilgan bo'lsa, bu tekshiruvda hisobga olinmaydi
        const check = await checkUserIsChannelMember(targetChannel.channelId, existing.ownerTelegramId);
        if (!check.verified) {
          sawUnverifiable = true;
          continue;
        }
        if (check.isMember) {
          await prisma.exchangeSubscription.update({ where: { id: sub.id }, data: { isCurrentMember: true, lastCheckedAt: new Date() } });
        } else {
          stillLapsed.push(targetChannel.title);
        }
      }

      // Faqat HAMMA (tekshirib bo'lingan) obunalar qaytadan tasdiqlansa
      // reaktivatsiya qilinadi. Tarmoq xatosi (sawUnverifiable) sabab
      // ANIQLAB bo'lmagan holatlarni "qoidabuzarlik davom etyapti" deb
      // hisoblamaymiz (jazolamaymiz), LEKIN "hammasi toza" deb ham
      // e'lon qilmaymiz — shu sabab bunday holatda ham reaktivatsiya
      // qilinmaydi, admin keyinroq qayta urinib ko'rishi kerak.
      const allVerifiedAndRejoined = stillLapsed.length === 0 && !sawUnverifiable;

      if (!allVerifiedAndRejoined) {
        await prisma.auditLog.create({
          data: {
            adminId: req.user?.id || 0,
            adminEmail: req.user?.email,
            action: "unblock_exchange_channel",
            targetId: String(existing.id),
            details: `Admin ${req.user?.name || req.user?.id}, "${existing.title}" kanalini (qoidabuzarlik/lapse sababli to'xtatilgan) qayta tekshirdi — foydalanuvchi HALI HAM quyidagi kanal(lar)ga obuna bo'lmagan: ${stillLapsed.join(", ") || "(tekshirib bo'lmadi)"}. Kanal NOFAOL holatda qoldi.`
          }
        }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
        return res.json({
          success: true,
          channel: existing,
          botStillAdmin: true,
          lapseStillActive: true,
          stillLapsedChannels: stillLapsed
        });
      }

      const channel = await prisma.exchangeChannel.update({
        where: { id: existing.id },
        data: { isActive: true, suspendedDueToLapse: false, suspendedReason: null }
      });
      await prisma.auditLog.create({
        data: {
          adminId: req.user?.id || 0,
          adminEmail: req.user?.email,
          action: "unblock_exchange_channel",
          targetId: String(channel.id),
          details: `Admin ${req.user?.name || req.user?.id}, "${channel.title}" kanalini qayta tekshirdi — foydalanuvchi barcha talab qilingan kanallarga qaytadan obuna bo'lgani tasdiqlandi, kanal FAOL qilindi.`
        }
      }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
      return res.json({ success: true, channel, botStillAdmin: true, lapseStillActive: false });
    }

    // TUZATILDI (foydalanuvchi talabi — "bonus bersamham Faol/navbatda
    // bo'lmayapti"): bu endpoint endi nafaqat blockedByAdmin/
    // suspendedDueToReports bo'lgan kanallar uchun, balki oddiy (bot admin
    // huquqini yo'qotgani sabab avtomatik NOFAOL qilingan) kanallar uchun
    // ham chaqiriladi — audit-log matni endi kanalning DASTLABKI holatiga
    // (nima uchun tekshirilayotganiga) qarab to'g'ri yozilishi kerak,
    // aks holda bloklanmagan kanal uchun ham noto'g'ri ravishda "blokdan
    // chiqardi" deb yozilib qolardi.
    const wasBlocked = existing.blockedByAdmin;
    const wasReported = existing.suspendedDueToReports;
    const actionLabel = wasBlocked ? "blokdan chiqardi" : wasReported ? "shikoyatdan keyin qayta faollashtirdi" : "qayta tekshirdi (bot admin holatini)";

    const health = await checkExchangeChannelStillHasAdminBot(existing.channelId);
    const shouldReactivate = !health.verified || health.hasAccess;

    const channel = await prisma.exchangeChannel.update({
      where: { id: Number(req.params.id) },
      data: shouldReactivate
        ? { isActive: true, blockedByAdmin: false, suspendedDueToReports: false, suspendedDueToLapse: false, suspendedDueToCreditEarned: false, suspendedReason: null }
        : {
            isActive: false,
            blockedByAdmin: false,
            suspendedDueToReports: false,
            suspendedDueToLapse: false,
            suspendedDueToCreditEarned: false,
            suspendedReason: "Bot kanalda admin huquqini yo'qotdi yoki kanal topilmadi."
          }
    });
    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "unblock_exchange_channel",
        targetId: String(channel.id),
        details: shouldReactivate
          ? `Admin ${req.user?.name || req.user?.id}, "${channel.title}" obuna almashish kanalini ${actionLabel} — bot admin ekanligi tasdiqlandi, kanal FAOL qilindi.`
          : `Admin ${req.user?.name || req.user?.id}, "${channel.title}" kanalini ${actionLabel}, LEKIN bot bu kanalda admin emasligi tasdiqlangani sabab kanal NOFAOL holatda qoldi (egasi botni qayta admin qilishi kerak).`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
    res.json({ success: true, channel, botStillAdmin: shouldReactivate });
  } catch (err: unknown) {
    logger.error({ err }, "Admin unblock exchange channel error");
    res.status(500).json({ error: "Blokdan chiqarishda xatolik yuz berdi." });
  }
});

// TUZATILDI: avval bu endpoint BARCHA foydalanuvchilarga ketma-ket
// (await + 50ms tanaffus bilan) HTTP so'rov davomida turib yuborardi —
// 5000 foydalanuvchida ~250+ soniya degani, bu esa deploy platformasi
// (Render va h.k.) yoki brauzer tomonidan so'rov timeout qilinishiga
// olib kelardi, va admin natijani hech qachon ko'rmasdi (garchi
// yuborish serverda fonda davom etsa ham).
//
// Endi: POST so'rov DARHOL javob qaytaradi (jobId bilan), haqiqiy
// yuborish esa fonda (await qilinmagan holda) davom etadi. Admin
// paneli jobId bo'yicha GET /broadcast/status/:jobId orqali progress
// so'rab turadi (polling).
//
// TUZATILDI (2-bosqich): ilgari job holati FAQAT process xotirasida
// (Map) saqlanardi — bu ikkita muammoga olib kelardi: (1) server qayta
// ishga tushsa (masalan deploy paytida) davom etayotgan job butunlay
// yo'qolib qolardi va admin panelida "Job topilmadi" xatosi chiqardi;
// (2) xabarning O'ZI (matni) hech qayerda saqlanmasdi — audit logda
// faqat statistika ("N yuborildi") yozilardi, admin oldin nima
// yozganini keyinroq ko'ra olmasdi. Endi BroadcastMessage jadvaliga
// har bir job boshlanganda darhol "running" holatida yoziladi va
// progress vaqti-vaqti bilan (har 25 xabarda bir marta — har safar DB
// yozishning o'zi sekinlashtirmasligi uchun) shu qatorga yangilanadi,
// yakunda esa "done" qilib yopiladi. Xotiradagi Map hali ham
// saqlanadi — chunki tez-tez (har 1-2s) pollanadigan status so'rovi
// uchun DB'ga har safar murojaat qilish shart emas; DB esa TARIX va
// server qayta tiklanganda "running" job holatini ko'rsatish uchun.
interface BroadcastJob {
  id: number;
  total: number;
  sent: number;
  failed: number;
  status: "running" | "done";
  startedAt: number;
  finishedAt: number | null;
  audience: "all" | "no_channel";
}
const broadcastJobs = new Map<number, BroadcastJob>();

async function isBroadcastRunning(): Promise<boolean> {
  for (const job of broadcastJobs.values()) {
    if (job.status === "running") return true;
  }
  // Xotiradagi Map bo'sh bo'lsa ham (masalan server hozirgina qayta
  // ishga tushgan bo'lsa), oldingi jarayon DB'da "running" holatida
  // "yarim qolgan" bo'lishi mumkin — shuni ham tekshiramiz.
  const stuckRunning = await prisma.broadcastMessage.findFirst({ where: { status: "running" } });
  return !!stuckRunning;
}

async function runBroadcastJob(job: BroadcastJob, users: { id: number; telegramUserId: string | null }[], message: string, admin: { id?: number; name?: string; email?: string }) {
  // MUHIM: sendTelegramMessage() endi Telegram flood-control (429)
  // xatosini o'zi aniqlab, Telegram bergan retry_after vaqti bo'yicha
  // kutib, avtomatik qayta urinadi (qarang: src/lib/context.ts). Shu
  // sababli bu yerda alohida 429-maxsus logika kerak emas — "false"
  // qaytgan bo'lsa, demak bir necha qayta urinishdan keyin ham
  // yuborilmadi va haqiqatan "failed" deb hisoblash to'g'ri.
  for (const u of users) {
    try {
      const ok = await sendTelegramMessage(u.telegramUserId!, message);
      if (ok) job.sent++; else job.failed++;
    } catch {
      job.failed++;
    }
    if ((job.sent + job.failed) % 25 === 0) {
      await prisma.broadcastMessage.update({
        where: { id: job.id },
        data: { sent: job.sent, failed: job.failed }
      }).catch((e: any) => logger.error({ err: e }, "Broadcast progress update error"));
    }
    // Telegram cheklovlariga hurmat yuzasidan qisqa tanaffus
    await new Promise((r) => setTimeout(r, 50));
  }
  job.status = "done";
  job.finishedAt = Date.now();

  await prisma.broadcastMessage.update({
    where: { id: job.id },
    data: { sent: job.sent, failed: job.failed, status: "done", finishedAt: new Date(job.finishedAt) }
  }).catch((e: any) => logger.error({ err: e }, "Broadcast finalize error"));

  await prisma.auditLog.create({
    data: {
      adminId: admin.id || 0,
      adminEmail: admin.email,
      action: "broadcast_telegram",
      targetId: "all",
      details: `Admin ${admin.name || admin.id} ${job.total} foydalanuvchiga (${job.audience === "no_channel" ? "faqat kanal ulamaganlarga" : "hammaga"}) ommaviy xabar yubordi (${job.sent} muvaffaqiyatli, ${job.failed} muvaffaqiyatsiz).`
    }
  }).catch((e: any) => logger.error({ err: e }, "Audit log error"));
}

// POST /api/admin/exchange-channels/broadcast/send
// E'TIBOR: bu yer "exchange-channels" fayli ichida, lekin funksionallik
// umumiy — Telegram ulangan BARCHA foydalanuvchilarga tegishli, faqat
// obuna almashish tizimiga emas. Alohida fayl ochish shart emasligi
// uchun shu yerga qo'shildi (admin routerlari orasida eng yaqin joy).
adminRouter.post("/broadcast/send", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { message } = req.body;
  // YANGI (foydalanuvchi talabi): "audience" — kimga yuborilishini
  // tanlash. "all" (standart, avvalgidek) — Telegram ulangan barcha
  // (opt-out qilmagan, bloklamagan) foydalanuvchilar. "no_channel" —
  // shulardan FAQAT hali "Obunachi yig'ish" bo'limiga birorta ham kanal
  // ulamaganlar (xuddi botdagi hasAnyExchangeChannel bilan bir xil
  // mantiq — vaqtincha to'xtatilgan/suspended kanal ham "ulagan"
  // hisoblanadi, chunki u avval kamida bir marta ulangan).
  const audience: "all" | "no_channel" = req.body.audience === "no_channel" ? "no_channel" : "all";
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Xabar matni bo'sh bo'lishi mumkin emas." });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: "Xabar 4000 belgidan oshmasligi kerak." });
  }
  if (await isBroadcastRunning()) {
    return res.status(409).json({ error: "Hozir boshqa ommaviy xabar yuborilmoqda. Iltimos, u tugashini kuting." });
  }

  try {
    // 1-so'rov ("Bildirishnomalarni boshqarish"): foydalanuvchi reklama/broadcast
    // xabarlaridan chiqqan bo'lsa (telegramBroadcastOptOut), bu ro'yxatga kiritilmaydi.
    // Muhim xabarlar (xarid, nizo — notifyUserTelegram orqali yuboriladi) bunga bog'liq emas.
    // TUZATILDI: botni bloklagan foydalanuvchilar (telegramBotBlockedAt —
    // sendTelegramMessage() Telegram'dan 403 olganda shu maydonni yozadi,
    // qarang: src/lib/context.ts) ham endi bu yerda chetlab o'tiladi.
    // Ilgari bunday foydalanuvchilar ro'yxatdan chiqarilmasdi va har
    // broadcast'da qayta-qayta (behuda) urinilardi.
    let users = await prisma.user.findMany({
      where: { telegramUserId: { not: null }, isBanned: false, telegramBroadcastOptOut: false, telegramBotBlockedAt: null },
      select: { id: true, telegramUserId: true }
    });

    if (audience === "no_channel") {
      // Kanal ulagan foydalanuvchilarning telegramUserId to'plamini olib,
      // yuqoridagi ro'yxatdan chiqarib tashlaymiz — ExchangeChannel
      // jadvali ownerTelegramId bo'yicha bog'lanadi (Prisma relation
      // yo'q, chunki ExchangeChannel foydalanuvchisiz — faqat Telegram
      // ID orqali — ham qo'shilishi mumkin edi).
      const ownersWithChannel = await prisma.exchangeChannel.findMany({
        select: { ownerTelegramId: true },
        distinct: ["ownerTelegramId"]
      });
      const ownerIds = new Set(ownersWithChannel.map((c) => c.ownerTelegramId));
      users = users.filter((u) => !u.telegramUserId || !ownerIds.has(u.telegramUserId));
    }

    // DB'ga darhol "running" holatida yoziladi — shu bilan xabar matni
    // va progress server qayta ishga tushsa ham (va admin sahifani
    // yangilasa ham) yo'qolmaydi.
    const dbRow = await prisma.broadcastMessage.create({
      data: {
        message,
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        total: users.length,
        status: "running"
      }
    });

    const job: BroadcastJob = {
      id: dbRow.id,
      total: users.length,
      sent: 0,
      failed: 0,
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
      audience
    };
    broadcastJobs.set(job.id, job);

    // MUHIM: bu yerda ataylab await QILINMAGAN — javob darhol
    // qaytariladi, yuborish esa fonda davom etadi. Xatolik chiqsa ham
    // HTTP javobiga ta'sir qilmasligi uchun catch bilan yopilgan.
    runBroadcastJob(job, users, message, { id: req.user?.id, name: req.user?.name, email: req.user?.email }).catch((e: any) => {
      job.status = "done";
      job.finishedAt = Date.now();
      logger.error({ err: e }, "Broadcast background job error");
    });

    res.json({ success: true, jobId: job.id, total: job.total });
  } catch (err: unknown) {
    logger.error({ err }, "Broadcast error");
    res.status(500).json({ error: "Xabar yuborishda xatolik yuz berdi." });
  }
});

// GET /api/admin/exchange-channels/broadcast/status/:jobId
// Admin paneli shu orqali fonda ketayotgan broadcast progressini
// pollaydi (masalan har 1-2 soniyada).
adminRouter.get("/broadcast/status/:jobId", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const jobId = parseInt(req.params.jobId, 10);
  const job = broadcastJobs.get(jobId);
  if (!job) {
    // Xotirada yo'q — masalan server qayta ishga tushgan. DB'dan
    // o'qishga urinamiz: agar shu ID DB'da mavjud bo'lsa (running yoki
    // done), o'sha holatni qaytaramiz — shu bilan admin "Job topilmadi"
    // xatosi o'rniga oxirgi ma'lum progressni ko'radi.
    if (!Number.isNaN(jobId)) {
      const dbRow = await prisma.broadcastMessage.findUnique({ where: { id: jobId } });
      if (dbRow) {
        return res.json({
          success: true,
          jobId: dbRow.id,
          total: dbRow.total,
          sent: dbRow.sent,
          failed: dbRow.failed,
          status: dbRow.status
        });
      }
    }
    return res.status(404).json({ error: "Job topilmadi." });
  }
  res.json({
    success: true,
    jobId: job.id,
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    status: job.status
  });
});

// GET /api/admin/exchange-channels/broadcast/history
// YANGI: oldin yuborilgan broadcast xabarlar tarixi (matni bilan
// birga) — audit logda faqat statistika saqlanardi, xabarning o'zini
// keyinroq ko'rish imkoni yo'q edi. Endi admin panelida oxirgi
// yuborilgan xabarlar ro'yxati (kim, qachon, nechta odamga, qanday
// natija bilan) ko'rsatiladi.
adminRouter.get("/broadcast/history", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.broadcastMessage.findMany({
      orderBy: { startedAt: "desc" },
      take: 20
    });
    res.json({ success: true, items });
  } catch (err: unknown) {
    logger.error({ err }, "Broadcast history error");
    res.status(500).json({ error: "Tarixni yuklashda xatolik yuz berdi." });
  }
});

export { adminRouter as exchangeAdminRouter, siteRouter as exchangeSiteRouter };
export default router;
