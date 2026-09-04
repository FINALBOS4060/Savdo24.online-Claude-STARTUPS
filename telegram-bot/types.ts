// Bot bo'ylab ishlatiladigan session va context tiplari.
// index.ts va boshqa barcha modullar (keyboards.ts, format.ts) shu yerdan
// import qiladi — tip bitta joyda e'lon qilinadi, hamma joyda bir xil.
import { Context, SessionFlavor } from "grammy";
import { Lang } from "./i18n";

export interface SessionData {
  token: string;
  startupId: string;
  awaitingExchangeChannel?: boolean;
  awaitingSearch?: boolean;
  // 🌐 Foydalanuvchi tili — global til-yuklash middleware tomonidan
  // seans boshida TelegramBotUser jadvalidan (backend) to'ldiriladi va
  // shu seans davomida shu yerda saqlanadi (qayta-qayta so'ralmasligi
  // uchun). Doimiy manba backend — bu shunchaki tezkor kesh.
  language?: Lang;
  // QULAYLIK: "🔙 Ro'yxatga qaytish" tugmasi uchun — foydalanuvchi mahsulotni
  // qaysi ro'yxatdan (yangi/top/kategoriya/qidiruv) ochganini shu yerda
  // saqlaymiz, showProduct shunga qarab to'g'ri "orqaga" tugmasini chizadi.
  lastList?: {
    kind: "new" | "top" | "category" | "search";
    page: number;
    categoryId?: string;
    query?: string;
  };
  // ⭐ Sharh/reyting qoldirish oqimi: avval reyting (1-5) tugma bilan
  // tanlanadi, keyin izoh matni oddiy xabar sifatida kutiladi.
  reviewStartupId?: string;
  reviewRating?: number;
  awaitingReviewComment?: boolean;
  // 🆘 Qo'llab-quvvatlashga murojaat oqimi: avval mavzu, keyin xabar matni
  // ketma-ket oddiy xabar sifatida kutiladi. FAQAT asosiy botda ishlatiladi.
  awaitingSupportSubject?: boolean;
  awaitingSupportMessage?: boolean;
  supportSubject?: string;
  // TUZATILDI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
  // botida foydalanuvchilar uchun bog'liqlik joyi bormi" savoli aniqladi):
  // sessiya (SessionData) ikkala bot uchun BIR XIL jadvalda, FAQAT
  // telegramUserId bo'yicha (bot'ga bog'lanmagan holda) saqlanadi — ya'ni
  // ikkala bot bir xil foydalanuvchining bitta sessiya yozuvini
  // BO'LISHADI. Avval subscriber-bot/index.ts ham xuddi shu
  // `awaitingSupportSubject`/`awaitingSupportMessage`/`supportSubject`
  // maydonlarini o'zining (butunlay boshqa) qo'llab-quvvatlash oqimi
  // uchun ishlatardi — bu shuni anglatardi: agar foydalanuvchi ASOSIY
  // botda murojaat yozishni boshlab, tugatmasdan SUBSCRIBER botga o'tib,
  // u yerda biror oddiy xabar yozsa, bu xabar NOTO'G'RI ravishda "murojaat
  // matni" deb qabul qilinardi (va aksincha). Endi subscriber-bot o'zining
  // ALOHIDA maydonlaridan (pastda) foydalanadi — ikkala oqim endi hech
  // qachon aralashmaydi.
  subAwaitingSupportSubject?: boolean;
  subAwaitingSupportMessage?: boolean;
  subSupportSubject?: string;
  // 🚩 Kanaldan shikoyat qilish oqimi: sabab tugmalar orqali tanlanadi,
  // "Boshqa sabab" tanlansa esa matn kutiladi.
  awaitingReportReason?: boolean;
  reportChannelId?: string;
  // 🆕 "Obunachi yig'ish" ro'yxatida so'nggi marta ko'rsatilgan kanallar
  // (handleExchangeBrowse tomonidan saqlanadi) — yagona "✅ Obuna bo'ldim"
  // tugmasi (ex_confirm_all) shu ro'yxatni bir vaqtning o'zida tekshiradi,
  // per-kanal alohida tugma shart emas.
  exchangeBrowseChannels?: { id: number; channelId: string; title: string }[];
  // 📢 Faqat "obunachi yig'ish" (subscriber-bot) processida ishlatiladi:
  // foydalanuvchiga pastki reply-klaviatura paneli KAMIDA BIR MARTA
  // ko'rsatilganmi — shu bayroq DOIMIY (DB'dagi seansda) saqlanadi, shu
  // sabab u /start'ni necha marta bosishidan qat'i nazar "bir martalik"
  // bo'lib qoladi (bot process qayta ishga tushsa ham yo'qolmaydi).
  subscriberBotKeyboardShown?: boolean;
  // 🆕 Faqat "obunachi yig'ish" (subscriber-bot) processida ishlatiladi:
  // pastki doimiy reply-klaviatura panelining HOZIRGI holati — "main"
  // (Profil/Obunachi yig'ish/Report/... asosiy panel) yoki "exchange"
  // (Do'stlarni taklif qilish/Kanalimni qo'shish/... — "Obunachi yig'ish"
  // bo'limi ichidagi panel). "🔄 Obunachi yig'ish" bosilganda "exchange"ga
  // o'rnatiladi va shu bo'lim ichidagi panel qayta yuborilmaydi (Telegram
  // uni ekranda saqlab turadi); "🏠 Bosh menyu" bosilganda "main"ga qaytadi.
  subscriberBotPanelMode?: "main" | "exchange";
}

export interface SponsorChannel {
  channelId: string;
  channelUsername: string;
  // TUZATILDI: server (/api/telegram/sponsor-channels) bu ikkalasini ham
  // qaytaradi, lekin ilgari bu yerda e'lon qilinmagani uchun ulardan
  // foydalanish har safar cast talab qilardi (masalan admin xabarlarida
  // kanal nomini ko'rsatish uchun — qarang: sponsor-gate.ts). Ixtiyoriy
  // qilib qo'shildi — mavjud kod buzilmaydi.
  displayName?: string;
  id?: number;
}

export type MyContext = Context & SessionFlavor<SessionData>;

