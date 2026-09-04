// Barcha klaviatura (inline/reply) quruvchi funksiyalar, bittа joyda.
// Har birini o'zgartirish uchun endi index.ts'ni skroll qilish shart emas.
import { Keyboard } from "grammy";
import { t, Lang } from "./i18n";
import { MyContext } from "./types";

// TUZATILDI (SODDALASHTIRISH): avval bu yerda 10 ta tugma (2 qatorli emas,
// 5 qatorli) bo'lgan — foydalanuvchilar qaysi tugma qayerga olib borishini
// eslay olmay chalkashib ketishardi. Endi FAQAT 4 ta eng asosiy yo'nalish
// qoladi: Mahsulotlar (Yangi/TOP/Kategoriyalarni o'zida birlashtiradi),
// Qidirish, Profil va "Ko'proq" (Hisobni ulash, Obunachi yig'ish, Sayt,
// Yordam, Til shu submenyu ichiga ko'chirildi — pastdagi
// productsMenuKeyboard() va moreMenuKeyboard() funksiyalariga qarang).
// Bu tugmalarning har biri ENDI oddiy matn yubormaydi — ular INLINE
// submenyu ochadi (index.ts'dagi message:text handlerlarga qarang), shu
// sabab foydalanuvchi bosgach nima bo'lishini ko'rib, keyin tanlaydi.
// TUZATILDI (foydalanuvchi talabi — ogohlantirish sifatida): agar
// foydalanuvchi hali BIRORTA HAM kanal ulamagan bo'lsa (hasAnyExchangeChannel
// — exchange-service.ts), "➕ Kanalimni qo'shish" tugmasi endi shu asosiy
// menyuning ENG TEPASIDA, alohida to'liq kenglikdagi qatorda ham ko'rsatiladi
// (ilgari faqat "Ko'proq → Obunachi yig'ish" ichida ko'milgan holda bor edi).
// Tekshiruv chaqiruvchi tarafda (ctx.from bo'yicha, hasAnyExchangeChannel
// bilan) bajariladi va shu yerga oddiy boolean sifatida uzatiladi — bu
// funksiya o'zi hech qanday tarmoq so'rovi qilmaydi (sinxron qolaveradi),
// chunki exchange-service.ts bu faylni import qiladi (keyboards.ts ↔
// exchange-service.ts aylanma import bo'lmasligi uchun).
// TUZATILDI (foydalanuvchi talabi — "👤 Mening profilim" tugmasi asosiy
// pastki panelda xato ishlayotgani sababli): shu tugma asosiy panelidan
// OLIB TASHLANDI, o'rniga "🔄 Obunachi yig'ish" (menu_exchange) qo'yildi.
// Profilga endi /profile buyrug'i orqali (bot-commands.ts) va "Obunachi
// yig'ish" panelidagi "Mening profilim" tugmasi (exchangeMenuKeyboard /
// exchangePanelKeyboard) orqali kirish mumkin — bu tugmalar O'ZGARTIRILMADI,
// faqat asosiy pastki paneldagi tugma olib tashlandi.
export function mainMenuKeyboard(ctx: MyContext, options: { showAddChannelWarning?: boolean } = {}) {
  const lang = ctx.session?.language || "uz";
  const kb = new Keyboard();
  if (options.showAddChannelWarning) {
    kb.text(t("exchange_add_channel_btn", lang)).row();
  }
  return kb
    .text(t("menu_products", lang)).text(t("menu_search", lang)).row()
    .text(t("menu_exchange", lang)).text(t("menu_more", lang))
    .resized()
    .persistent();
}

// "🛍 Mahsulotlar" bosilganda ochiladigan submenyu — avval alohida-alohida
// pastki tugma bo'lgan Yangi/TOP/Kategoriyalar endi shu bitta INLINE
// menyu ichida. Callback_data'lar mavjud "menu_new"/"menu_top"/
// "menu_categories" handlerlari bilan bir xil — hech qanday yangi
// handler yozish shart bo'lmadi.
export function productsMenuKeyboard(lang: Lang) {
  return {
    inline_keyboard: [
      [{ text: t("menu_new", lang), callback_data: "menu_new" }],
      [{ text: t("menu_top", lang), callback_data: "menu_top" }],
      [{ text: t("menu_categories", lang), callback_data: "menu_categories" }],
      [{ text: t("back_to_menu", lang), callback_data: "menu_home" }]
    ]
  };
}

// "☰ Ko'proq" submenyusi — kamroq ishlatiladigan/ikkinchi darajali
// bo'limlar (Hisobni ulash, Obunachi yig'ish, Sayt, Yordam, Til) shu
// yerga yig'ilgan, shu bilan asosiy klaviatura toza qoladi.
export function moreMenuKeyboard(lang: Lang) {
  return {
    inline_keyboard: [
      [{ text: t("menu_link", lang), callback_data: "menu_link" }],
      [{ text: t("menu_exchange", lang), callback_data: "menu_exchange" }],
      [{ text: t("menu_site", lang), callback_data: "menu_site" }],
      [{ text: t("menu_help", lang), callback_data: "menu_help" }],
      [{ text: t("menu_language", lang), callback_data: "menu_language" }],
      [{ text: t("back_to_menu", lang), callback_data: "menu_home" }]
    ]
  };
}

export function isMenuButton(text: string, key: string): boolean {
  return text === t(key, "uz") || text === t(key, "en") || text === t(key, "ru");
}

export function clearAwaitingState(ctx: MyContext) {
  ctx.session.awaitingSearch = false;
  ctx.session.awaitingExchangeChannel = false;
  ctx.session.awaitingReviewComment = false;
  ctx.session.reviewStartupId = undefined;
  ctx.session.reviewRating = undefined;
  ctx.session.awaitingSupportSubject = false;
  ctx.session.awaitingSupportMessage = false;
  ctx.session.supportSubject = undefined;
  ctx.session.awaitingReportReason = false;
  ctx.session.reportChannelId = undefined;
}

export function backToMenuKeyboard(ctx: MyContext) {
  const lang = ctx.session?.language || "uz";
  return { inline_keyboard: [[{ text: t("back_to_menu", lang), callback_data: "menu_home" }]] };
}

export function profileKeyboard(referralCode?: string, unreadCount?: number, lang: Lang = "uz") {
  const activityBase = t("profile_activity_btn", lang);
  const activityLabel = unreadCount && unreadCount > 0
    ? `${activityBase} (${unreadCount > 99 ? "99+" : unreadCount})`
    : activityBase;
  const rows: { text: string; callback_data: string }[][] = [
    [
      { text: t("profile_purchases_btn", lang), callback_data: "profile_purchases" },
      { text: t("profile_sales_btn", lang), callback_data: "profile_sales" }
    ],
    [
      { text: t("profile_stats_btn", lang), callback_data: "profile_seller_stats" },
      { text: activityLabel, callback_data: "profile_activity" }
    ],
    [
      { text: t("profile_exchange_btn", lang), callback_data: "profile_exchange" }
    ],
    [
      { text: t("profile_notifications_btn", lang), callback_data: "profile_notifications" }
    ]
  ];
  if (referralCode) {
    rows.push([{ text: t("profile_referral_btn", lang), callback_data: "profile_referral" }]);
  }
  rows.push([{ text: t("refresh_btn", lang), callback_data: "menu_profile" }, { text: t("back_to_menu", lang), callback_data: "menu_home" }]);
  return { inline_keyboard: rows };
}

export function notificationKeyboard(optedOut: boolean, lang: Lang = "uz") {
  return {
    inline_keyboard: [
      [
        optedOut
          ? { text: t("notif_turn_on", lang), callback_data: "notif_on" }
          : { text: t("notif_turn_off", lang), callback_data: "notif_off" }
      ],
      [{ text: t("back_to_menu", lang), callback_data: "menu_home" }]
    ]
  };
}

export function backToListButton(ctx: MyContext): { text: string; callback_data: string }[] | null {
  const last = ctx.session?.lastList;
  if (!last) return null;
  const lang = ctx.session.language || "uz";
  const label = t("back_to_list", lang);
  if (last.kind === "search" && last.query) {
    return [{ text: label, callback_data: `search_${encodeURIComponent(last.query)}_${last.page}` }];
  }
  if (last.kind === "category" && last.categoryId) {
    return [{ text: label, callback_data: `cat_${last.categoryId}_${last.page}` }];
  }
  if (last.kind === "new" || last.kind === "top") {
    return [{ text: label, callback_data: `list_${last.kind}_${last.page}` }];
  }
  return null;
}

export function exchangeMenuKeyboard(ctx: MyContext, options: { hideAddChannel?: boolean } = {}) {
  const lang = ctx.session.language || "uz";
  const addBtn = { text: t("exchange_add_channel_btn", lang), callback_data: "ex_add" };
  const inviteBtn = { text: t("exchange_invite_btn", lang), callback_data: "ex_invite" };
  const profileBtn = { text: t("menu_profile", lang), callback_data: "menu_profile" };
  const infoBtn = { text: t("ex_info_btn", lang), callback_data: "ex_info" };
  const leaderboardBtn = { text: t("ex_leaderboard_btn", lang), callback_data: "ex_leaderboard" };
  const homeBtn = { text: t("back_to_menu", lang), callback_data: "menu_home" };

  // TUZATILDI (foydalanuvchi talabi): "🗂 Mening kanallarim" tugmasi
  // (ex_mychannels) butunlay olib tashlandi, o'rniga "👤 Mening
  // profilim" (menu_profile) qo'yildi. Shu bilan birga uning joyi
  // "🎁 Do'stlarni taklif qilish" bilan almashtirildi — natijada:
  //   1-qator: [Mening profilim]      [Kanalimni qo'shish]
  //   2-qator: [Qoida va bonuslar]    [Do'stlarni taklif qilish]
  //   3-qator: [Bosh menyu]           [Reyting (haftalik)]
  // "Kanalimni qo'shish" foydalanuvchida ALLAQACHON faol kanal bo'lsa
  // (hideAddChannel=true) butunlay yashiriladi — bu holda uni juftlab
  // turgan "Mening profilim" endi yolg'iz, to'liq kenglikda chiqadi
  // (aks holda 1 ta bo'sh joy bilan chala qator qolib ketardi).
  const firstRow = options.hideAddChannel ? [profileBtn] : [profileBtn, addBtn];

  return {
    inline_keyboard: [
      firstRow,
      [infoBtn, inviteBtn],
      [homeBtn, leaderboardBtn]
    ]
  };
}

// 🆕 (foydalanuvchi talabi, skrinshot bilan): "obunachi yig'ish" boti
// uchun — exchangeMenuKeyboard() bilan AYNAN BIR XIL 6 ta amal (bir xil
// i18n matn kalitlari, bir xil 3 qator x 2 ustun tartibi), lekin INLINE
// emas, PASTKI (reply) klaviatura sifatida. "🔄 Obunachi yig'ish" bo'limi
// ochilganda bu panel asosiy pastki panelning (Profil/Report/Til/...)
// O'RNIGA yuboriladi — Telegramda reply-klaviatura bittadan ortiq
// bo'lolmaydi, shu sabab yangisi yuborilishi bilanoq eskisi ekrandan
// avtomatik yo'qoladi (qo'shimcha "remove_keyboard" chaqirish shart
// emas). "🏠 Bosh menyu" bosilganda asosiy panel xuddi shunday tarzda
// qaytadan o'rnini egallaydi (index.ts'dagi keyboardForUser()ga qarang).
export function exchangePanelKeyboard(lang: Lang, options: { hideAddChannel?: boolean } = {}) {
  // TUZATILDI (foydalanuvchi talabi — exchangeMenuKeyboard bilan bir xil
  // o'zgarish): "Mening kanallarim" o'rniga "Mening profilim", uning
  // joyi esa "Do'stlarni taklif qilish" bilan almashtirildi. "Mening
  // profilim" matni pastki panelda bosilganda handlers-text.ts'dagi
  // umumiy isMenuButton(text, "menu_profile") shartiga tushib, profilni
  // ochadi — alohida yangi handler yozish shart bo'lmadi.
  const rows: string[][] = options.hideAddChannel
    ? [[t("menu_profile", lang)]]
    : [[t("menu_profile", lang), t("exchange_add_channel_btn", lang)]];
  rows.push([t("ex_info_btn", lang), t("exchange_invite_btn", lang)]);
  rows.push([t("back_to_menu", lang), t("ex_leaderboard_btn", lang)]);

  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true
  };
}

