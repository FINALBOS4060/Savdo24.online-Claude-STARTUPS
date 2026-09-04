// 🌐 TILNI ALMASHTIRISH TIZIMI (i18n)
//
// Botning eng ko'p ishlatiladigan qismlari (asosiy menyu, salomlashish,
// yordam, kategoriyalar, ro'yxatlar, qidiruv, majburiy obuna ekrani va
// umumiy tugmalar/xatolar) shu modul orqali ikkala tilda ham ishlaydi.
// Qolgan (chuqurroq) oqimlar — to'lov, VIP, obunachi almashish qoidalari,
// qo'llab-quvvatlash va h.k. — hozircha faqat o'zbek tilida qoladi;
// kelajakda shu yerga qo'shib boriladi.
//
// Foydalanuvchi tanlagan til `TelegramBotUser` jadvalida (backend,
// Prisma) DOIMIY saqlanadi — bot qayta ishga tushirilsa ham yo'qolmaydi.
// Har bir foydalanuvchi uchun 10 daqiqalik xotira-keshi bor (ortiqcha
// bazaga murojaat qilinmasligi uchun).

import { prisma } from "./db";
import { decryptSecret } from "../src/lib/crypto";
import { logger } from "../src/lib/logger";

export type Lang = "uz" | "en" | "ru";

type Dict = Record<string, string>;

export const translations: Record<Lang, Dict> = {
  uz: {
    welcome:
      "👋 <b>Assalomu alaykum! Savdo24 botiga xush kelibsiz.</b>\n\n" +
      "Bu yerda siz:\n" +
      "🆕 Yangi e'lonlarni ko'rishingiz,\n" +
      "🔥 Eng arzon/top takliflarni topishingiz,\n" +
      "💳 Xarid qilishingiz,\n" +
      "👤 O'z profilingizni ko'rishingiz mumkin.\n\n" +
      "Boshlash uchun pastdagi tugmalardan birini bosing 👇",
    help:
      "❓ <b>Yordam</b>\n\n" +
      "Botdan foydalanish juda oddiy — pastdagi tugmalarni bosib boshqarasiz, hech narsa yozib o'tirish shart emas.\n\n" +
      "🆕 <b>Yangi e'lonlar</b> — so'nggi qo'shilgan mahsulotlar\n" +
      "🔥 <b>TOP takliflar</b> — eng ommabop e'lonlar\n" +
      "🔍 <b>Qidirish</b> — mahsulot nomi bo'yicha qidiruv\n" +
      "👤 <b>Profilim</b> — balans, referral kodingiz va h.k. (avval hisobingizni ulashingiz kerak)\n" +
      "🔗 <b>Hisobni ulash</b> — saytdagi hisobingizni shu Telegram akkauntga bog'laydi\n\n" +
      "Agar biror muammo bo'lsa, saytga o'tib \"Yordam\" bo'limiga murojaat qiling.",
    menu_new: "🆕 Yangi e'lonlar",
    menu_top: "🔥 TOP takliflar",
    menu_categories: "📂 Kategoriyalar",
    menu_search: "🔍 Qidirish",
    menu_profile: "👤 Mening profilim",
    menu_link: "🔗 Hisobni ulash",
    menu_exchange: "🔄 Obunachi yig'ish",
    menu_site: "🌐 Saytga o'tish",
    menu_help: "❓ Yordam",
    menu_language: "🌐 Til / Language",
    menu_products: "🛍 Mahsulotlar",
    menu_more: "☰ Ko'proq",
    products_menu_title: "🛍 <b>Mahsulotlar</b>\n\nQaysi birini ko'rmoqchisiz?",
    more_menu_title: "☰ <b>Ko'proq</b>",
    back_to_menu: "🏠 Bosh menyu",
    choose_language: "🌐 <b>Tilni tanlang / Choose language / Выберите язык</b>",
    language_set_uz: "✅ Til o'zbekchaga o'zgartirildi.",
    language_set_en: "✅ Language switched to English.",
    language_set_ru: "✅ Язык изменён на русский.",
    categories_title: "📂✨ <b>Kategoriya tanlang</b>\n\nQaysi bo'limdagi e'lonlarni ko'rmoqchisiz?",
    categories_empty: "😔 Hozircha kategoriyalar mavjud emas.",
    categories_error: "⚠️ Kategoriyalarni yuklashda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
    category_fallback: "Kategoriya",
    listing_new_title: "🆕 Eng so'nggi e'lonlar",
    listing_new_empty: "Hozircha yangi e'lonlar yo'q.",
    listing_top_title: "🔥 TOP takliflar",
    listing_top_empty: "Hozircha TOP e'lonlar yo'q.",
    listing_category_empty: "Bu kategoriyada hozircha e'lon yo'q.",
    listing_error: "⚠️ Ro'yxatni yuklashda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
    search_prompt: "🔍 <b>Qidiruv</b>\n\nNimani qidirmoqchisiz? Mahsulot nomi yoki kalit so'z yozing.\n\nYoki to'g'ridan-to'g'ri: <code>/qidiruv so'z</code>",
    search_cancel: "❌ Bekor qilish",
    search_empty: "😔 \"{{query}}\" bo'yicha hech narsa topilmadi.",
    search_error: "⚠️ Qidirishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
    other_category: "📂 Boshqa kategoriya",
    back_to_list: "🔙 Ro'yxatga qaytish",
    sponsor_gate_title: "📢🔒 <b>Botdan foydalanish uchun quyidagi kanal(lar)ga obuna bo'lishingiz shart:</b>\n\nObuna bo'lgach, pastdagi <b>✅ Tekshirish</b> tugmasini bosing.",
    sponsor_gate_join: "➕ Obuna bo'lish: {{channel}}",
    sponsor_gate_check: "✅ Tekshirish",
    sponsor_gate_alert: "⚠️ Avval quyidagi kanal(lar)ga obuna bo'ling.",
    sponsor_gate_still_not: "⚠️ Hali quyidagi kanallarga obuna bo'lmagansiz: {{channels}}",
    sponsor_gate_confirmed: "✅ Rahmat! Obuna tasdiqlandi.",
    // 🆕 Faqat "obunachi yig'ish" (subscriber-bot) processida ishlatiladi.
    subscriber_bot_no_channels: "ℹ️ Hozircha faol sponsor kanallar yo'q. Keyinroq qayta urinib ko'ring.",
    subscriber_bot_open_main: "🚀 Asosiy botga o'tish",
    subscriber_bot_open_main_prompt: "Pastdagi tugma orqali asosiy botga o'ting 👇",
    subscriber_bot_welcome:
      "👋 <b>Assalomu alaykum! Bu — \"Obunachi yig'ish\" boti.</b>\n\n" +
      "Bu yerda siz Telegram kanalingizga <b>bepul, haqiqiy obunachi</b> orttira olasiz — pul to'lash shart emas, faqat almashinuv orqali:\n\n" +
      "1️⃣ Avval o'z kanalingizni botga ulaysiz (bot admin qilib qo'shiladi)\n" +
      "2️⃣ Keyin boshqa foydalanuvchilarning kanallariga obuna bo'lasiz\n" +
      "3️⃣ Siz qancha ko'p obuna bo'lsangiz, kanalingiz navbatda shunchalik tez oldinga siljiydi va boshqalar SIZGA obuna bo'la boshlaydi\n\n" +
      "👇 Boshlash uchun pastdagi <b>\"🔄 Obunachi yig'ish\"</b> tugmasini bosing.",
    subscriber_bot_language_btn: "🌐 Til",
    subscriber_bot_invite_btn: "🔗 Do'stlarni taklif qilish",
    subscriber_bot_stats_btn: "📊 Statistika",
    // 🆕 Foydalanuvchi so'rovi bo'yicha pastki panelga qo'shildi.
    subscriber_bot_profile_btn: "👤 Profil",
    subscriber_bot_report_btn: "🚩 Report",
    subscriber_bot_rules_btn: "📜 Qoida va bonuslar",
    subscriber_bot_choose_language: "🌐 Tilni tanlang / Выберите язык:",
    subscriber_bot_invite_text: "🔗 Do'stlaringizni shu havola orqali taklif qiling:\n<code>{{link}}</code>",
    subscriber_bot_invite_error: "⚠️ Havolani hozircha yaratib bo'lmadi, keyinroq urinib ko'ring.",
    subscriber_bot_stats_text: "📊 Siz orqali <b>{{count}}</b> kishi botga qo'shildi.",
    subscriber_bot_stats_error: "⚠️ Statistikani yuklab bo'lmadi, keyinroq urinib ko'ring.",
    generic_error: "⚠️ Xatolik yuz berdi, keyinroq urinib ko'ring.",
    // TUZATILDI (UNIVERSALLIK): quyidagi 4 kalit ilgari handlers-start.ts,
    // handlers-catalog.ts va bot-instance.ts ichida t()ni chetlab,
    // to'g'ridan-to'g'ri qattiq-kodlangan o'zbekcha matn sifatida
    // yuborilardi — inglizcha tanlagan foydalanuvchi ham shu joylarda
    // kutilmaganda o'zbekcha xabar ko'rardi.
    start_link_expired: "⌛️ Havola eskirgan yoki noto'g'ri.",
    start_generic_error: "⚠️ Xatolik yuz berdi, keyinroq urinib ko'ring.",
    start_network_error: "⚠️ Tarmoq xatoligi yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
    // TUZATILDI (i18n'ni chetlab o'tish): handlers-text.ts oxiridagi
    // "tushunmadim" fallback handler'i shu matnni qattiq-kodlangan
    // o'zbekcha holda yuborardi — yuqoridagi start_* kalitlar bilan bir xil
    // turdagi xato. Ingliz tilini tanlagan foydalanuvchi ham noma'lum matn
    // yozganda o'zbekcha javob olardi.
    unrecognized_input: "🤔 Kechirasiz, buni tushunmadim.\n\nQuyidagi tugmalardan birini tanlang 👇",
    link_code_error: "Bog'lashda xatolik yuz berdi. Kod muddati tugagan bo'lishi mumkin.",
    link_code_error_hint: "Saytdan yangi kod olib, qaytadan urinib ko'ring.",
    product_id_required: "🔎 Mahsulot ID'sini kiriting. Masalan: <code>/mahsulot 123</code>",
    unexpected_error: "⚠️ Kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.",
    referral_invite_note: "🔄 Do'stingiz sizni <b>\"Obunachi yig'ish\"</b> bo'limiga taklif qildi! O'sha bo'limdan o'z kanalingizni qo'shsangiz, taklif qilgan do'stingizga bonus ball qo'shiladi.",
    link_account_required: "👤 Avval hisobingizni ulashingiz kerak.",
    notif_off_toast: "🔕 Reklama xabarlari o'chirildi.",
    notif_on_toast: "🔔✅ Bildirishnomalar yoqildi.",
    file_ready: "📦✅ Faylingiz tayyor: {{url}}",

    // TUZATILDI (UNIVERSALLIK): quyidagi kalitlar ilgari index.ts ichida
    // 100+ joyda `lang === "en" ? "..." : "..."` shaklida qattiq kodlangan
    // edi — endi hammasi shu yerga, markazlashgan lug'atga ko'chirildi.
    // Yangi til qo'shish uchun endi faqat shu faylga yangi blok qo'shish
    // kifoya, index.ts ga tegish shart emas.
    rate_limit_warning: "⏳ Juda tez-tez so'rov yuboryapsiz — biroz kutib, qayta urinib ko'ring.",
    listing_no_more: "😔 Boshqa e'lon yo'q.",
    page_indicator: "({{page}}/{{totalPages}}-sahifa)",
    tap_product_hint: "\nBatafsil ko'rish uchun mahsulot nomini bosing 👇",
    nav_previous: "⬅️ Oldingisi",
    nav_next: "Keyingisi ➡️",
    search_no_more: "😔 Boshqa natija yo'q.",
    search_results_title: "\"{{query}}\" bo'yicha natijalar",
    search_new: "🔍 Yangi qidiruv",
    profile_activity_btn: "🧾 Faoliyat tarixi",
    profile_purchases_btn: "🛒 Xaridlarim",
    profile_sales_btn: "💰 Sotuvlarim",
    profile_stats_btn: "📊 Statistikam",
    profile_exchange_btn: "🔄 Obunachi yig'ish",
    profile_notifications_btn: "🔔 Bildirishnoma sozlamasi",
    profile_referral_btn: "🎯 Do'stlarga taklif qilish",
    refresh_btn: "🔄 Yangilash",
    back_profile_btn: "⬅️ Profil",
    profile_link_required_full: "👤 Profilingizni ko'rish uchun avval hisobingizni saytga ulashingiz kerak.\n\nPastdagi \"🔗 Hisobni ulash\" tugmasini bosing 👇",
    profile_balance_line: "💰 Balans: <b>{{balance}} USDT</b>\n",
    profile_referral_earned_line: "🎁 Referraldan mukofot: <b>{{amount}} USDT</b>\n",
    profile_referral_count_line: "👥 Referrallar: <b>{{count}}</b> ta\n",
    profile_referral_code_line: "🔗 Referral kod: <code>{{code}}</code>\n",
    none_placeholder: "yo'q",
    profile_unread_line: "🔴 O'qilmagan faoliyat: <b>{{count}}</b> ta — pastdagi \"🧾 Faoliyat tarixi\"da ko'ring\n",
    profile_no_unread_line: "🟢 Yangi faoliyat yo'q — hammasi ko'rilgan\n",
    profile_load_error: "⚠️ Profil ma'lumotlarini yuklashda xatolik yuz berdi.",
    referral_no_code: "🎯 Sizda hali referral kod yo'q. Uni saytda Profil → Referrallar bo'limidan yaratishingiz mumkin.",
    referral_invite_text: "<b>🎯 Do'stlaringizni taklif qiling</b>\n\nQuyidagi havola orqali ro'yxatdan o'tgan foydalanuvchilar chegirma oladi, siz esa ularning xaridlaridan mukofot olasiz.\n\n🔗 <code>{{link}}</code>\n\nHavolani nusxalab do'stlaringizga yuboring 👆",
    referral_link_error: "⚠️ Referral havolani olishda xatolik yuz berdi.",
    seller_stats_title: "<b>📊 Statistikam</b>\n",
    seller_stats_total: "📦 Jami e'lonlar: {{count}}\n",
    seller_stats_active: "✅ Faol e'lonlar: {{count}}\n",
    seller_stats_sold: "🏷 Sotilgan: {{count}}\n",
    seller_stats_views: "👁 Jami ko'rishlar: {{count}}\n",
    seller_stats_sales: "💰 Tugallangan sotuvlar: {{count}}",
    seller_stats_error: "⚠️ Statistikani yuklashda xatolik yuz berdi.",
    purchases_empty: "🛒 Hozircha xaridlaringiz yo'q.",
    purchases_title: "<b>🛒 Xaridlarim</b> (oxirgi 10 ta)\n\n",
    purchases_rate_btn: "⭐ \"{{name}}\"ni baholash",
    purchases_error: "⚠️ Xaridlar tarixini yuklashda xatolik yuz berdi.",
    sales_empty: "💰 Hozircha sotuvlaringiz yo'q.",
    sales_title: "<b>💰 Sotuvlarim</b> (oxirgi 10 ta)\n\n",
    sales_error: "⚠️ Sotuvlar tarixini yuklashda xatolik yuz berdi.",
    review_stars_prompt: "⭐ Necha yulduz baholaysiz?",
    session_expired: "⚠️ Sessiya eskirgan, qaytadan urinib ko'ring.",
    review_comment_prompt: "✍️ Endi izohingizni yozing (1000 belgigacha):",
    review_comment_short: "✍️ Izoh juda qisqa — kamida 3 harf yozing.",
    review_submit_error: "⚠️ Sharh qoldirishda xatolik yuz berdi.",
    review_submit_success: "🎉 Rahmat! Sharhingiz muvaffaqiyatli qo'shildi.",
    support_subject_short: "📝 Mavzu juda qisqa — kamida 2 harf yozing.",
    support_message_prompt: "✍️ Endi murojaatingiz matnini batafsil yozing:",
    support_message_short: "✍️ Xabar juda qisqa — kamida 5 harf yozing.",
    support_submit_error: "⚠️ Murojaat yuborishda xatolik yuz berdi.",
    support_submit_success: "✅ Murojaatingiz qabul qilindi! Tez orada javob beramiz.",
    support_start_prompt: "🆘 <b>Murojaat yuborish</b>\n\n📝 Avval mavzuni qisqacha yozing (masalan: \"To'lov muammosi\"):",
    subscriber_bot_report_prompt: "🆘 <b>Murojaat yuborish</b>\n\n📝 Menga kanal linki va o'z shikoyatingizni yuboring:",
    contact_support_btn: "🆘 Murojaat yuborish",
    search_term_short: "🔍 Qidiruv so'zi juda qisqa — kamida 2 harf yozing.",
    notif_turn_on: "✅ Bildirishnomalarni yoqish",
    notif_turn_off: "🔕 Bildirishnomalarni o'chirish",
    notif_status_on: "✅ Yoqilgan",
    notif_status_off: "🔕 O'chirilgan",
    notif_settings_text: "<b>🔔 Bildirishnoma sozlamalari</b>\n\nReklama va umumiy e'lon (broadcast) xabarlari: <b>{{status}}</b>\n\nℹ️ Xarid, to'lov va nizolar haqidagi MUHIM xabarlar bu sozlamadan qat'iy nazar har doim yuboriladi.",
    notif_settings_error: "⚠️ Sozlamalarni yuklashda xatolik yuz berdi.",
    notif_toggle_error: "⚠️ Sozlamani o'zgartirishda xatolik yuz berdi.",
    activity_just_now: "hozirgina",
    activity_min_ago: "{{count}} daq. oldin",
    activity_hours_ago: "{{count}} soat oldin",
    activity_empty: "🧾 Hozircha faoliyat tarixi bo'sh — bot hech narsa qayd etmagan.",
    activity_title: "<b>🧾 Faoliyat tarixi</b> (oxirgi 15 ta)\n━━━━━━━━━━━━━━━\n\n",
    activity_error: "⚠️ Faoliyat tarixini yuklashda xatolik yuz berdi.",
    exchange_status_blocked: "Admin tomonidan bloklangan",
    exchange_status_queued: "Navbatda kutmoqda — hali hech kimga ko'rsatilmagan",
    exchange_status_active: "Faol — hozir boshqalarga ko'rsatilmoqda. Siz istalgan 1 ta kanalga obuna bo'lsangiz, kanalingizga <b>+{{multiplier}} ball</b> qo'shiladi va vaqtincha navbatdan chiqariladi.",
    exchange_status_lapsed: "To'xtatilgan — obunadan chiqib ketgansiz. Orqaga qaytib obuna bo'lsangiz, avtomatik qayta navbatga qo'shiladi.",
    exchange_status_quota: "Navbatdan olib tashlangan — {{reason}}. Qayta navbatga qo'shish uchun \"➕ Kanalimni qo'shish\" orqali xuddi shu kanalni qayta yuboring.",
    exchange_status_quota_default_reason: "ball yig'ilgan",
    exchange_load_error_retry: "⚠️ Ma'lumotlarni yuklab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
    exchange_summary_title: "<b>🔄 Obunachi yig'ish — statistikam</b>\n━━━━━━━━━━━━━━━\n\n",
    // TUZATILDI (foydalanuvchi talabi — "100 ta obunachi qo'shildi" degan
    // xabar HAQIQIY Telegram obunachisi degandek yolg'on tuyulardi):
    // bu son aslida ichki reyting/navbat balli, shu sabab endi "obunachi"
    // emas "ball" deb ataladi.
    exchange_total_collected: "🏆 Jami to'plangan ball: <b>{{count}}</b> ta\n",
    exchange_referral_bonus_line: "   ┗ shundan referaldan: <b>{{count}}</b> ta\n",
    exchange_active_subs_line: "📥 Hozir haqiqiy obuna bo'lgan kanallaringiz: <b>{{count}}</b> ta\n",
    exchange_referral_stats_line: "🎯 Referal: <b>{{invited}}</b> ta taklif, shundan <b>{{rewarded}}</b> tasi mukofot berdi\n",
    exchange_new_subs_today_line: "📆 Bugun yangi obuna: <b>{{count}}/{{max}}</b>\n\n",
    exchange_no_channels: "🗂 Sizda hali qo'shilgan kanal yo'q.",
    exchange_channels_title: "🗂 <b>Kanallaringiz</b> ({{count}}/{{max}}):\n\n",
    exchange_channel_line: "• <b>{{title}}</b>\n   🏆 {{count}} ta ball\n   {{status}}\n\n",
    exchange_add_channel_btn: "➕ Kanalimni qo'shish",
    exchange_manage_channels_btn: "🗂 Kanallarni boshqarish",
    exchange_subscribe_btn: "📋 Kanallarga obuna bo'lish",
    exchange_invite_btn: "🎁 Do'stlarni taklif qilish",
    exchange_load_error: "⚠️ Ma'lumotlarni yuklashda xatolik yuz berdi.",
    exchange_rule_text:
      "⚠️ <b>Diqqat, muhim qoida!</b>\n\n" +
      "Siz boshqalarning kanaliga obuna bo'lasiz — har bir obuna uchun <b>sizning O'Z kanalingizga {{multiplier}} ta ball</b> qo'shiladi va shu zahoti kanalingiz navbatdan olib tashlanadi (u boshqalarga endi taklif qilinmaydi). Qancha ko'p kanalga obuna bo'lsangiz, shuncha ko'p ball yig'asiz (masalan 4 ta kanalga obuna bo'lsangiz — {{quadExample}} ta ball).\n\n" +
      "❗️ Agar SIZ obuna bo'lgan biror kanaldan keyinchalik <b>chiqib ketsangiz</b> (obunani qaytarib olsangiz), <b>sizning kanalingiz navbatdan olib tashlanadi</b> va sizga endi yangi ball kelmaydi — toki siz orqaga qaytib obuna bo'lguningizcha.\n\n" +
      "ℹ️ <i>Diqqat: \"ball\" — bu botning ICHKI reyting/navbat hisobi, Telegramdagi haqiqiy obunachilar soni EMAS.</i>",
    exchange_my_channels_btn: "🗂 Mening kanallarim",
    // TUZATILDI ("bo'lib kerakli joyda chiqarish", foydalanuvchi talabi):
    // avval bu matnga xush kelibsiz bonusi, referal bonusi VA to'liq
    // qoida matni HAMMASI qo'shib yuborilardi — natijada har safar
    // "Obunachi yig'ish" menyusi ochilganda bitta katta "devor" matn
    // chiqardi, garchi bonus/qoida ma'lumotlari allaqachon o'z joylarida
    // (ex_add_instructions — kanal qo'shishda, ex_invite_text — do'st
    // taklif qilishda, exchangeRuleText — obuna bo'lish ro'yxatida)
    // ko'rsatilsa ham. Endi kirish ekrani QISQA — batafsil ma'lumot
    // istagan foydalanuvchi uchun alohida "ℹ️ Qoida va bonuslar"
    // tugmasi (ex_info) qo'shildi.
    exchange_intro:
      "🔄✨ <b>Obunachi yig'ish</b>\n\n" +
      "O'z kanalingizni qo'shing, so'ng boshqa foydalanuvchilarning kanallariga obuna bo'ling — har bir obuna uchun kanalingizga {{multiplier}} tadan ball qo'shiladi.\n\n",
    ex_info_btn: "ℹ️ Qoida va bonuslar",
    ex_info_intro:
      "ℹ️ <b>Qoida va bonuslar</b>\n\n" +
      "🎁 <b>Xush kelibsiz bonusi:</b> kanalingizni BIRINCHI marta ulaganingizda sizga darhol {{welcomeBonus}} ta bonus ball sovg'a qilinadi! 🥳\n\n" +
      "👯 <b>Referal bonusi:</b> do'stingizni taklif qiling — u botga kirib o'z kanalini qo'shsa, sizga yana {{referralBonus}} ta bonus ball qo'shiladi!\n\n" +
      "ℹ️ <i>\"Ball\" — botning ICHKI reyting/navbat hisobi (Telegramdagi haqiqiy obunachilar soni emas).</i>",
    // YANGI (real vaqt statistikasi, foydalanuvchi talabi — ijtimoiy
    // isbot orqali rag'batlantirish): "Obunachi yig'ish" menyusi va
    // "Obuna bo'lish" ro'yxati tepasida ko'rsatiladi.
    ex_live_stats_line: "📊 Bugun <b>{{count}} kishi</b> boshqa kanallarga obuna bo'ldi — hoziroq siz ham qo'shiling! 🔥\n\n",
    ex_milestone_progress: "\n{{bar}} {{percent}}%\n{{badge}} Yana <b>{{remaining}} ta ball</b> — va keyingi bosqichga chiqasiz!\n",
    ex_milestone_reached: "\n{{bar}} 100%\n{{badge}} Siz eng yuqori bosqichga yetdingiz! Ajoyib natija 🎉\n",
    ex_leaderboard_btn: "🏆 Reyting (haftalik)",
    ex_leaderboard_title: "🏆 <b>Haftalik faollik reytingi</b>\n\nSo'nggi 7 kunda eng ko'p boshqa kanalga obuna bo'lgan (eng faol) foydalanuvchilar:\n\n",
    ex_leaderboard_line: "{{rank}} {{name}} — <b>{{count}} ta ball</b>\n",
    ex_leaderboard_anon_user: "Foydalanuvchi #{{id}}",
    ex_leaderboard_empty: "🏆 Hozircha reyting bo'sh — bu hafta birinchi bo'lib boshqa kanallarga obuna bo'ling va ro'yxat boshida turing! 🔥",
    ex_leaderboard_load_error: "❌ Reytingni yuklashda xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.",
    ex_leaderboard_join_hint: "👆 Siz hali ro'yxatda yo'qsiz — bir nechta kanalga obuna bo'lib, o'z o'rningizni egallang!",
    ex_invite_text:
      "🎁 <b>Do'stlaringizni taklif qiling!</b>\n\n" +
      "Quyidagi shaxsiy havolangiz orqali botga birinchi marta kirgan do'stingiz o'z kanalini \"Obunachi yig'ish\" bo'limiga qo'shsa — sizga darhol <b>{{referralBonus}} ta bonus ball</b> qo'shiladi (sayt profilingizdagi \"Obuna almashish\" bo'limida ko'rinadi).\n\n" +
      "🔗 <code>{{link}}</code>",
    ex_add_instructions:
      "➕📡 <b>Kanal qo'shish</b>\n\n" +
      "🎁 <i>Eslatma: agar bu sizning botga ulagan BIRINCHI kanalingiz bo'lsa, sizga darhol {{welcomeBonus}} ta bonus ball beriladi!</i>\n\n" +
      "1️⃣ Botni o'z kanalingizga <b>admin</b> qilib qo'shing (Kanal → Administratorlar → Admin qo'shish → botni tanlang)\n\n" +
      "2️⃣ Keyin quyidagilardan BIRINI qiling:\n" +
      "   • Kanalingizdagi istalgan xabarni shu yerga <b>forward</b> qiling (uzatib yuboring), YOKI\n" +
      "   • Kanalingizning <b>@username</b>'ini yozib yuboring (masalan: @mening_kanalim), YOKI\n" +
      "   • Kanalingiz havolasini yuboring (masalan: https://t.me/mening_kanalim)\n\n" +
      "⚠️ Agar kanalingiz <b>yopiq (private)</b> bo'lsa — faqat <b>forward</b> usuli ishlaydi (username ham, oddiy havola ham emas, chunki yopiq kanalning ochiq usernamesi yo'q). Yopiq kanal uchun taklif (invite) havolasi ham ishlamaydi — albatta forward qiling.",
    ex_channels_load_error: "⚠️ Kanallarni yuklashda xatolik yuz berdi.",
    ex_no_channels_yet: "📭 Sizda hali qo'shilgan kanal yo'q.",
    ex_my_channels_title: "🗂✨ <b>Mening kanallarim:</b>\n\n",
    ex_channel_active: "✅ Faol (navbatda)",
    ex_channel_suspended: "⏸ To'xtatilgan{{reason}}",
    ex_channel_row: "• <b>{{title}}</b>\n   {{status}}\n   🏆 Jami ball: <b>{{count}}</b> ta\n\n",
    ex_channel_remove_btn: "🗑 O'chirish: {{title}}",
    ex_remove_error: "⚠️ O'chirishda xatolik yuz berdi.",
    ex_remove_success: "✅ Kanal o'chirildi.",
    ex_resubscribe_btn: "🔗 Qayta obuna bo'lish: {{title}}",
    ex_lapsed_notice: "🚫 Siz quyidagi kanal(lar)dan obunani bekor qilibsiz: <b>{{channels}}</b>\n\nShuning uchun sizning kanalingiz vaqtincha navbatdan chiqarildi va sizga endi yangi ball kelmaydi. Qaytadan obuna bo'lsangiz, avtomatik tiklanadi.",
    ex_reactivated_notice: "✅ Tabriklaymiz! Kanalingiz (<b>{{names}}</b>) qaytadan navbatga qo'yildi — obunani tiklaganingiz uchun rahmat.",
    ex_credit_reactivated_notice: "✅ Kanalingiz (<b>{{names}}</b>) yana \"Obunachi yig'ish\" navbatiga qo'shildi — boshqa foydalanuvchilarga qayta taklif qilina boshlaydi.",
    // YANGI (foydalanuvchi talabi — "asosiy bot bilan obunachi yig'ish
    // botining bir-biriga aloqasi bo'lmasligi kerak"): "Obunachi yig'ish"
    // bo'limi endi shu (asosiy) botda ISHLAMAYDI — foydalanuvchi maxsus
    // botga yo'naltiriladi.
    ex_use_subscriber_bot: "🔄 \"Obunachi yig'ish\" bo'limi endi alohida botda ishlaydi. Davom etish uchun quyidagi tugmani bosing.",
    ex_open_subscriber_bot_btn: "🔄 Obunachi yig'ish botini ochish",
    ex_new_channel_announcement: "🆕 Yangi foydalanuvchi qo'shildi! Uning kanaliga (<b>{{title}}</b>) obuna bo'ling va {{multiplier}} ball qo'lga kiriting — har bir balingiz uchun kanalingizga 1 tadan obunachi avtomatik qo'shilaveradi.",
    ex_browse_load_error: "⚠️ Kanallarni yuklashda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
    ex_browse_empty: "📭 Hozircha taklif qilinadigan yangi kanal yo'q. Birozdan so'ng qayta urinib ko'ring.",
    ex_browse_disabled_by_admin: "⏸ Kanallarga obuna bo'lish orqali obunachi yig'ish bo'limi admin tomonidan vaqtincha to'xtatilgan. Birozdan so'ng qayta urinib ko'ring.",
    ex_browse_title: "📋 <b>Quyidagi kanallarga obuna bo'ling:</b>\n\n",
    ex_open_btn: "🔗 Ochish: {{title}}",
    ex_subscribed_btn: "✅ Obuna bo'ldim: {{title}}",
    // YANGI (foydalanuvchi talabi): ro'yxat ostidagi YAGONA "obuna
    // bo'ldim" tugmasi va "keyingi 10 ta" sahifalash tugmasi.
    ex_confirm_all_btn: "✅ Men barchasiga obuna bo'ldim",
    ex_next_page_btn: "➡️ Keyingi 10 ta kanal",
    ex_confirm_all_session_expired: "⚠️ Tekshiriladigan ro'yxat topilmadi. Avval \"🔄 Obunachi yig'ish\" orqali kanallar ro'yxatini oching.",
    ex_confirm_all_result_title: "📋 <b>Tekshiruv natijasi:</b>\n\n",
    ex_confirm_all_confirmed_line: "✅ Tasdiqlandi: {{titles}}\n\n",
    ex_confirm_all_pending_line: "⏳ Siz hali obuna bo'lmagansiz (obuna bo'lib, qayta tekshiring): {{titles}}\n\n",
    ex_confirm_all_unknown_line: "🔄 Hozircha tekshirib bo'lmadi (vaqtinchalik xatolik) — birozdan so'ng qaytadan tekshiring: {{titles}}\n\n",
    ex_confirm_all_rejected_line: "⚠️ Obunangiz tasdiqlandi, lekin qayd etilmadi — {{reason}}: {{titles}}\n\n",
    ex_confirm_all_none_confirmed: "⚠️ Siz hali ro'yxatdagi kanallarning birortasiga ham obuna bo'lmagansiz. Avval obuna bo'ling, keyin qayta tekshiring.",
    ex_channel_gone: "🚫 Bu kanal endi mavjud emas.",
    ex_own_channel: "🙅‍♂️ Bu sizning o'z kanalingiz — o'zingizga obunachi sifatida yozila olmaysiz.",
    ex_not_subscribed_yet: "⚠️ Siz hali \"{{title}}\" kanaliga obuna bo'lmagansiz. Avval obuna bo'ling, keyin tugmani bosing.",
    ex_subscribe_confirmed: "✅ Rahmat! Obunangiz qayd etildi.",
    ex_subscribe_success: "✅🎉 \"{{title}}\" kanaliga obunangiz qayd etildi. Rahmat!",
    ex_invite_link_error: "❌ Bu yopiq taklif (invite) havolasi — bot orqali bunday havolani avtomatik tanib bo'lmaydi.\n\nIltimos, o'z KANALINGIZDAGI biror xabarni shu yerga <b>forward</b> qiling (uzatib yuboring) — bu har doim ishlaydi, kanal ochiq yoki yopiq bo'lishidan qat'iy nazar.",
    ex_channel_not_understood:
      "🤔 Buni tushunmadim. Iltimos:\n" +
      "• kanalingizdagi biror xabarni <b>forward</b> qiling, YOKI\n" +
      "• kanalingiz username'ini <b>@</b> bilan yozing (masalan: @mening_kanalim), YOKI\n" +
      "• kanalingiz havolasini yuboring (masalan: https://t.me/mening_kanalim), YOKI\n" +
      "• bot allaqachon a'zo bo'lgan kanalning raqamli ID'sini yuboring (masalan: -1001234567890)",
    ex_forward_not_channel: "❌ Bu shaxsiy chat yoki guruhdan forward qilingan xabar, kanaldan emas. Iltimos, o'z KANALINGIZDAGI xabarni forward qiling.",
    ex_unnamed_channel: "Nomsiz kanal",
    ex_chat_not_found: "❌ \"{{identifier}}\" nomli/ID'li kanal topilmadi. Username, havola yoki ID to'g'ri ekanini tekshiring, yoki kanal yopiq bo'lsa — forward usulidan foydalaning.",
    ex_not_a_channel: "❌ Bu username kanalga emas, boshqa turdagi chatga tegishli. Faqat kanal qo'sha olasiz.",
    ex_bot_not_member: "❌ Bot bu kanalga umuman a'zo emas. Avval botni kanalingizga <b>admin</b> qilib qo'shing (Kanal → Administratorlar → Admin qo'shish), keyin qayta urinib ko'ring.",
    ex_bot_not_admin: "❌ Bot bu kanalda a'zo, lekin <b>admin emas</b>. Kanal sozlamalaridan botga admin huquqini bering, keyin qayta urinib ko'ring.",
    ex_owner_status_unknown: "❌ Sizning ushbu kanaldagi holatingizni aniqlab bo'lmadi. Kanalda admin ekanligingizga ishonch hosil qiling.",
    ex_owner_not_admin: "❌ Siz bu kanalda admin emassiz, shuning uchun uni qo'sha olmaysiz. Faqat kanal egasi yoki adminlari qo'sha oladi.",
    ex_welcome_bonus_line: "\n\n🎉🎁 <b>Xush kelibsiz bonusi!</b> Botga birinchi marta kanal ulaganingiz uchun sizga darhol <b>{{bonus}} ta bonus ball</b> qo'shildi! 🥳",
    ex_channel_added: "✅🚀 <b>{{title}}</b> kanali muvaffaqiyatli qo'shildi va navbatga qo'yildi!",
    product_not_found: "😔 Bunday mahsulot topilmadi. Ehtimol o'chirilgan yoki noto'g'ri havola.",
    product_already_sold: "😔 \"{{name}}\" mahsuloti allaqachon sotilgan.",
    product_no_description: "Tavsif mavjud emas.",
    product_price_label: "Narxi",
    product_buy_btn: "💳 Sotib olish",
    product_load_error: "⚠️ Mahsulot ma'lumotlarini yuklashda xatolik yuz berdi.",
    link_account_instructions: "🔗 <b>Hisobni ulash</b>\n\n1️⃣ Saytda: <b>Profil → Sozlamalar</b> bo'limiga o'ting\n2️⃣ U yerdan 6 xonali ulanish kodini oling\n3️⃣ Shu yerga <code>/bogla KOD</code> deb yozing\n\nMasalan: <code>/bogla A1B2C3</code>",
    payment_preparing: "💳⏳ To'lov tayyorlanmoqda...",
    payment_create_error: "To'lov yaratishda xatolik.",
    payment_finish_btn: "💰 To'lovni yakunlash",
    payment_link_ready: "\n\n✅ To'lov havolasi tayyor! Quyidagi tugma yoki QR-kod orqali to'lang.",
    payment_qr_caption: "📱 Kripto hamyoningiz orqali to'lash uchun shu QR-kodni skanerlang.",
    ex_channel_lost_access: "⚠️ <b>\"{{title}}\"</b> kanalingiz \"Obunachi yig'ish\" navbatidan vaqtincha chiqarildi — bot bu kanalda endi admin emas (yoki kanal topilmayapti).\n\nAgar botni tasodifan admin'likdan olib tashlagan bo'lsangiz, uni qayta admin qiling va kanalingizni qaytadan qo'shing — bu darhol navbatga qaytaradi.",
    ex_hourly_join_report: "👥 So'nggi 1 soat ichida <b>\"{{title}}\"</b> kanalingizga bot orqali <b>{{count}} ta</b> yangi odam qo'shildi.",
    ex_inactivity_reminder: "⏳ <b>\"{{title}}\"</b> kanalingiz \"Obunachi yig'ish\" navbatida sizga yangi ball olib kelmoqda — lekin siz so'nggi 24 soatda birorta ham kanalga obuna bo'lmadingiz.\n\nAlmashinuv ikki tomonlama ishlaydi: qanchalik ko'p kanalga obuna bo'lsangiz, sizning kanalingiz ham shunchalik tez navbatda oldinga siljiydi va tezroq yangi ball oladi. 2 daqiqa vaqt ajratib, bir nechta kanalga obuna bo'lib ko'ring 👇\n\n💡 <b>Yana bir yo'l:</b> do'stlaringizni taklif qiling! Har bir taklif qilgan odamingiz uchun bonus ball olasiz, ular esa o'z navbatida botni yana boshqalarga ulashishi mumkin — shu orqali kanalingiz tezroq ko'proq real obunachiga ega bo'ladi.",
    ex_report_btn: "🚩 Shikoyat qilish",
    ex_report_choose_reason: "🚩 Nima sababdan shikoyat qilmoqchisiz?",
    ex_report_reason_spam: "📢 Spam / keraksiz reklama",
    ex_report_reason_content: "🔞 Nomaqbul kontent",
    ex_report_reason_scam: "🎭 Firibgarlik / aldov",
    ex_report_reason_other: "✏️ Boshqa sabab",
    ex_report_other_prompt: "✏️ Shikoyat sababini yozing (kamida 3 ta belgi):",
    ex_report_reason_short: "⚠️ Sabab juda qisqa. Iltimos, batafsilroq yozing.",
    ex_report_success: "✅ Shikoyatingiz qabul qilindi, admin ko'rib chiqadi. Rahmat!",
    ex_report_already_sent: "ℹ️ Siz bu kanal haqida so'nggi 24 soat ichida allaqachon shikoyat qilgansiz."
  },
  ru: {
    welcome:
      "👋 <b>Добро пожаловать в бот Savdo24!</b>\n\n" +
      "Здесь вы можете:\n" +
      "🆕 Смотреть новые объявления,\n" +
      "🔥 Находить самые выгодные и топовые предложения,\n" +
      "💳 Совершать покупки,\n" +
      "👤 Просматривать свой профиль.\n\n" +
      "Чтобы начать, нажмите одну из кнопок ниже 👇",
    help:
      "❓ <b>Помощь</b>\n\n" +
      "Пользоваться ботом очень просто — управляйте кнопками ниже, печатать ничего не нужно.\n\n" +
      "🆕 <b>Новые объявления</b> — последние добавленные товары\n" +
      "🔥 <b>ТОП предложения</b> — самые популярные объявления\n" +
      "🔍 <b>Поиск</b> — поиск по названию товара\n" +
      "👤 <b>Мой профиль</b> — баланс, ваш реферальный код и т.д. (сначала привяжите аккаунт)\n" +
      "🔗 <b>Привязать аккаунт</b> — связывает ваш аккаунт на сайте с этим Telegram-аккаунтом\n\n" +
      "Если возникла проблема, зайдите на сайт и обратитесь в раздел «Помощь».",
    menu_new: "🆕 Новые объявления",
    menu_top: "🔥 ТОП предложения",
    menu_categories: "📂 Категории",
    menu_search: "🔍 Поиск",
    menu_profile: "👤 Мой профиль",
    menu_link: "🔗 Привязать аккаунт",
    menu_exchange: "🔄 Сбор подписчиков",
    menu_site: "🌐 Перейти на сайт",
    menu_help: "❓ Помощь",
    menu_language: "🌐 Til / Язык",
    menu_products: "🛍 Товары",
    menu_more: "☰ Ещё",
    products_menu_title: "🛍 <b>Товары</b>\n\nЧто вы хотите посмотреть?",
    more_menu_title: "☰ <b>Ещё</b>",
    back_to_menu: "🏠 Главное меню",
    choose_language: "🌐 <b>Tilni tanlang / Choose language / Выберите язык</b>",
    language_set_uz: "✅ Til o'zbekchaga o'zgartirildi.",
    language_set_en: "✅ Language switched to English.",
    language_set_ru: "✅ Язык изменён на русский.",
    categories_title: "📂✨ <b>Выберите категорию</b>\n\nОбъявления какого раздела вы хотите посмотреть?",
    categories_empty: "😔 Категорий пока нет.",
    categories_error: "⚠️ Не удалось загрузить категории. Попробуйте немного позже.",
    category_fallback: "Категория",
    listing_new_title: "🆕 Последние объявления",
    listing_new_empty: "Новых объявлений пока нет.",
    listing_top_title: "🔥 ТОП предложения",
    listing_top_empty: "ТОП объявлений пока нет.",
    listing_category_empty: "В этой категории пока нет объявлений.",
    listing_error: "⚠️ Не удалось загрузить список. Попробуйте немного позже.",
    search_prompt: "🔍 <b>Поиск</b>\n\nЧто вы ищете? Введите название товара или ключевое слово.\n\nИли сразу: <code>/qidiruv слово</code>",
    search_cancel: "❌ Отмена",
    search_empty: "😔 По запросу «{{query}}» ничего не найдено.",
    search_error: "⚠️ Ошибка при поиске. Попробуйте немного позже.",
    other_category: "📂 Другая категория",
    back_to_list: "🔙 Вернуться к списку",
    sponsor_gate_title: "📢🔒 <b>Для использования бота необходимо подписаться на следующий(ие) канал(ы):</b>\n\nПосле подписки нажмите кнопку <b>✅ Проверить</b> ниже.",
    sponsor_gate_join: "➕ Подписаться: {{channel}}",
    sponsor_gate_check: "✅ Проверить",
    sponsor_gate_alert: "⚠️ Сначала подпишитесь на канал(ы) ниже.",
    sponsor_gate_still_not: "⚠️ Вы ещё не подписаны на эти каналы: {{channels}}",
    sponsor_gate_confirmed: "✅ Спасибо! Подписка подтверждена.",
    subscriber_bot_no_channels: "ℹ️ Сейчас нет активных спонсорских каналов. Попробуйте позже.",
    subscriber_bot_open_main: "🚀 Перейти в основной бот",
    subscriber_bot_open_main_prompt: "Нажмите кнопку ниже, чтобы перейти в основной бот 👇",
    subscriber_bot_welcome:
      "👋 <b>Добро пожаловать! Это бот «Сбор подписчиков».</b>\n\n" +
      "Здесь вы можете получить <b>бесплатных, реальных подписчиков</b> для своего Telegram-канала — без оплаты, только через обмен:\n\n" +
      "1️⃣ Сначала подключите свой канал к боту (бот добавляется администратором)\n" +
      "2️⃣ Затем подпишитесь на каналы других пользователей\n" +
      "3️⃣ Чем больше вы подпишетесь, тем быстрее ваш канал продвигается в очереди, и на НЕГО начинают подписываться другие\n\n" +
      "👇 Чтобы начать, нажмите кнопку <b>«🔄 Сбор подписчиков»</b> ниже.",
    subscriber_bot_language_btn: "🌐 Язык",
    subscriber_bot_invite_btn: "🔗 Пригласить друзей",
    subscriber_bot_stats_btn: "📊 Статистика",
    subscriber_bot_profile_btn: "👤 Профиль",
    subscriber_bot_report_btn: "🚩 Жалоба",
    subscriber_bot_rules_btn: "📜 Правила и бонусы",
    subscriber_bot_choose_language: "🌐 Выберите язык:",
    subscriber_bot_invite_text: "🔗 Пригласите друзей по этой ссылке:\n<code>{{link}}</code>",
    subscriber_bot_invite_error: "⚠️ Не удалось создать ссылку, попробуйте позже.",
    subscriber_bot_stats_text: "📊 Через вас в бот пришло <b>{{count}}</b> человек.",
    subscriber_bot_stats_error: "⚠️ Не удалось загрузить статистику, попробуйте позже.",
    generic_error: "⚠️ Произошла ошибка, попробуйте позже.",
    start_link_expired: "⌛️ Ссылка устарела или недействительна.",
    start_generic_error: "⚠️ Произошла ошибка, попробуйте позже.",
    start_network_error: "⚠️ Произошла сетевая ошибка. Попробуйте немного позже.",
    unrecognized_input: "🤔 Извините, я вас не понял.\n\nВыберите одну из кнопок ниже 👇",
    link_code_error: "Ошибка привязки. Возможно, срок действия кода истёк.",
    link_code_error_hint: "Получите новый код на сайте и попробуйте снова.",
    product_id_required: "🔎 Введите ID товара. Например: <code>/mahsulot 123</code>",
    unexpected_error: "⚠️ Произошла непредвиденная ошибка. Попробуйте ещё раз.",
    referral_invite_note: "🔄 Ваш друг пригласил вас в раздел <b>«Сбор подписчиков»</b>! Добавьте там свой канал, и вашему другу начислится бонусный балл.",
    link_account_required: "👤 Сначала нужно привязать аккаунт.",
    notif_off_toast: "🔕 Рекламные сообщения отключены.",
    notif_on_toast: "🔔✅ Уведомления включены.",
    file_ready: "📦✅ Ваш файл готов: {{url}}",

    rate_limit_warning: "⏳ Вы отправляете запросы слишком часто — немного подождите и попробуйте снова.",
    listing_no_more: "😔 Больше объявлений нет.",
    page_indicator: "(стр. {{page}}/{{totalPages}})",
    tap_product_hint: "\nНажмите на название товара, чтобы посмотреть подробнее 👇",
    nav_previous: "⬅️ Назад",
    nav_next: "Далее ➡️",
    search_no_more: "😔 Больше результатов нет.",
    search_results_title: "Результаты по запросу «{{query}}»",
    search_new: "🔍 Новый поиск",
    profile_activity_btn: "🧾 История активности",
    profile_purchases_btn: "🛒 Мои покупки",
    profile_sales_btn: "💰 Мои продажи",
    profile_stats_btn: "📊 Моя статистика",
    profile_exchange_btn: "🔄 Сбор подписчиков",
    profile_notifications_btn: "🔔 Настройки уведомлений",
    profile_referral_btn: "🎯 Пригласить друзей",
    refresh_btn: "🔄 Обновить",
    back_profile_btn: "⬅️ Профиль",
    profile_link_required_full: "👤 Чтобы посмотреть профиль, сначала привяжите аккаунт на сайте.\n\nНажмите кнопку «🔗 Привязать аккаунт» ниже 👇",
    profile_balance_line: "💰 Баланс: <b>{{balance}} USDT</b>\n",
    profile_referral_earned_line: "🎁 Заработано с рефералов: <b>{{amount}} USDT</b>\n",
    profile_referral_count_line: "👥 Рефералы: <b>{{count}}</b>\n",
    profile_referral_code_line: "🔗 Реферальный код: <code>{{code}}</code>\n",
    none_placeholder: "нет",
    profile_unread_line: "🔴 Непрочитанная активность: <b>{{count}}</b> — смотрите «🧾 История активности» ниже\n",
    profile_no_unread_line: "🟢 Новой активности нет — всё просмотрено\n",
    profile_load_error: "⚠️ Не удалось загрузить данные профиля.",
    referral_no_code: "🎯 У вас пока нет реферального кода. Вы можете создать его на сайте в разделе Профиль → Рефералы.",
    referral_invite_text: "<b>🎯 Пригласите друзей</b>\n\nПользователи, зарегистрировавшиеся по ссылке ниже, получат скидку, а вы — вознаграждение с их покупок.\n\n🔗 <code>{{link}}</code>\n\nСкопируйте ссылку и отправьте её друзьям 👆",
    referral_link_error: "⚠️ Не удалось получить реферальную ссылку.",
    seller_stats_title: "<b>📊 Моя статистика</b>\n",
    seller_stats_total: "📦 Всего объявлений: {{count}}\n",
    seller_stats_active: "✅ Активные объявления: {{count}}\n",
    seller_stats_sold: "🏷 Продано: {{count}}\n",
    seller_stats_views: "👁 Всего просмотров: {{count}}\n",
    seller_stats_sales: "💰 Завершённые продажи: {{count}}",
    seller_stats_error: "⚠️ Не удалось загрузить статистику.",
    purchases_empty: "🛒 У вас пока нет покупок.",
    purchases_title: "<b>🛒 Мои покупки</b> (последние 10)\n\n",
    purchases_rate_btn: "⭐ Оценить «{{name}}»",
    purchases_error: "⚠️ Не удалось загрузить историю покупок.",
    sales_empty: "💰 У вас пока нет продаж.",
    sales_title: "<b>💰 Мои продажи</b> (последние 10)\n\n",
    sales_error: "⚠️ Не удалось загрузить историю продаж.",
    review_stars_prompt: "⭐ Сколько звёзд вы поставите?",
    session_expired: "⚠️ Сессия устарела, попробуйте снова.",
    review_comment_prompt: "✍️ Теперь напишите комментарий (до 1000 символов):",
    review_comment_short: "✍️ Комментарий слишком короткий — напишите минимум 3 символа.",
    review_submit_error: "⚠️ Не удалось отправить отзыв.",
    review_submit_success: "🎉 Спасибо! Ваш отзыв успешно добавлен.",
    support_subject_short: "📝 Тема слишком короткая — напишите минимум 2 символа.",
    support_message_prompt: "✍️ Теперь подробно опишите ваш вопрос:",
    support_message_short: "✍️ Сообщение слишком короткое — напишите минимум 5 символов.",
    support_submit_error: "⚠️ Не удалось отправить обращение.",
    support_submit_success: "✅ Ваше обращение принято! Мы скоро ответим.",
    support_start_prompt: "🆘 <b>Обращение в поддержку</b>\n\n📝 Сначала кратко напишите тему (например: «Проблема с оплатой»):",
    subscriber_bot_report_prompt: "🆘 <b>Обращение в поддержку</b>\n\n📝 Пришлите ссылку на канал и опишите вашу жалобу:",
    contact_support_btn: "🆘 Обратиться в поддержку",
    search_term_short: "🔍 Слишком короткий запрос — введите минимум 2 символа.",
    notif_turn_on: "✅ Включить уведомления",
    notif_turn_off: "🔕 Отключить уведомления",
    notif_status_on: "✅ Включено",
    notif_status_off: "🔕 Отключено",
    notif_settings_text: "<b>🔔 Настройки уведомлений</b>\n\nРекламные и общие рассылки: <b>{{status}}</b>\n\nℹ️ Важные сообщения о покупках, оплатах и спорах отправляются всегда, независимо от этой настройки.",
    notif_settings_error: "⚠️ Не удалось загрузить настройки.",
    notif_toggle_error: "⚠️ Не удалось изменить настройку.",
    activity_just_now: "только что",
    activity_min_ago: "{{count}} мин. назад",
    activity_hours_ago: "{{count}} ч. назад",
    activity_empty: "🧾 История активности пуста — бот пока ничего не зафиксировал.",
    activity_title: "<b>🧾 История активности</b> (последние 15)\n━━━━━━━━━━━━━━━\n\n",
    activity_error: "⚠️ Не удалось загрузить историю активности.",
    exchange_status_blocked: "Заблокирован администратором",
    exchange_status_queued: "В очереди — пока никому не показывался",
    exchange_status_active: "Активен — сейчас показывается другим. Подпишитесь на любой 1 канал, и вашему каналу начислится <b>+{{multiplier}} балла</b>, после чего он временно снимается с очереди.",
    exchange_status_lapsed: "Приостановлен — вы отписались. Подпишитесь обратно, и канал автоматически вернётся в очередь.",
    exchange_status_quota: "Снят с очереди — {{reason}}. Чтобы вернуться в очередь, отправьте этот же канал заново через «➕ Добавить канал».",
    exchange_status_quota_default_reason: "баллы собраны",
    exchange_load_error_retry: "⚠️ Не удалось загрузить данные. Попробуйте немного позже.",
    exchange_summary_title: "<b>🔄 Сбор подписчиков — моя статистика</b>\n━━━━━━━━━━━━━━━\n\n",
    exchange_total_collected: "🏆 Всего собрано баллов: <b>{{count}}</b>\n",
    exchange_referral_bonus_line: "   ┗ из них с рефералов: <b>{{count}}</b>\n",
    exchange_active_subs_line: "📥 Каналы, на которые вы сейчас реально подписаны: <b>{{count}}</b>\n",
    exchange_referral_stats_line: "🎯 Рефералы: приглашено <b>{{invited}}</b>, из них вознаграждено <b>{{rewarded}}</b>\n",
    exchange_new_subs_today_line: "📆 Новых подписок сегодня: <b>{{count}}/{{max}}</b>\n\n",
    exchange_no_channels: "🗂 У вас пока нет добавленных каналов.",
    exchange_channels_title: "🗂 <b>Ваши каналы</b> ({{count}}/{{max}}):\n\n",
    exchange_channel_line: "• <b>{{title}}</b>\n   🏆 {{count}} баллов\n   {{status}}\n\n",
    exchange_add_channel_btn: "➕ Добавить канал",
    exchange_manage_channels_btn: "🗂 Управление каналами",
    exchange_subscribe_btn: "📋 Подписаться на каналы",
    exchange_invite_btn: "🎁 Пригласить друзей",
    exchange_load_error: "⚠️ Не удалось загрузить данные.",
    exchange_rule_text:
      "⚠️ <b>Внимание, важное правило!</b>\n\n" +
      "Вы подписываетесь на чужие каналы — за каждую подписку <b>вашему СОБСТВЕННОМУ каналу начисляется {{multiplier}} балла</b>, и он сразу же снимается с очереди (больше не предлагается другим). Чем на больше каналов вы подпишетесь, тем больше баллов соберёте (например, подписавшись на 4 канала — {{quadExample}} баллов).\n\n" +
      "❗️ Если вы позже <b>отпишетесь</b> от канала, на который подписались (отмените подписку), <b>ваш канал будет снят с очереди</b>, и новые баллы перестанут начисляться — пока вы не подпишетесь обратно.\n\n" +
      "ℹ️ <i>Обратите внимание: «балл» — это ВНУТРЕННИЙ рейтинговый/очередной показатель бота, а НЕ реальное количество подписчиков в Telegram.</i>",
    exchange_my_channels_btn: "🗂 Мои каналы",
    exchange_intro:
      "🔄✨ <b>Сбор подписчиков</b>\n\n" +
      "Добавьте свой канал, затем подпишитесь на каналы других пользователей — за каждую подписку вашему каналу начисляется {{multiplier}} балла.\n\n",
    ex_info_btn: "ℹ️ Правила и бонусы",
    ex_info_intro:
      "ℹ️ <b>Правила и бонусы</b>\n\n" +
      "🎁 <b>Приветственный бонус:</b> при ПЕРВОМ подключении канала вы сразу получаете {{welcomeBonus}} бонусных баллов! 🥳\n\n" +
      "👯 <b>Реферальный бонус:</b> пригласите друга — если он зайдёт в бот и добавит свой канал, вам начислится ещё {{referralBonus}} бонусных баллов!\n\n" +
      "ℹ️ <i>«Балл» — это ВНУТРЕННИЙ рейтинговый/очередной показатель бота (а не реальное число подписчиков в Telegram).</i>",
    ex_live_stats_line: "📊 Сегодня <b>{{count}} человек</b> подписались на другие каналы — присоединяйтесь прямо сейчас! 🔥\n\n",
    ex_milestone_progress: "\n{{bar}} {{percent}}%\n{{badge}} Ещё <b>{{remaining}} баллов</b> — и вы перейдёте на следующий уровень!\n",
    ex_milestone_reached: "\n{{bar}} 100%\n{{badge}} Вы достигли максимального уровня! Отличный результат 🎉\n",
    ex_leaderboard_btn: "🏆 Рейтинг (за неделю)",
    ex_leaderboard_title: "🏆 <b>Недельный рейтинг активности</b>\n\nСамые активные пользователи за последние 7 дней (подписались на наибольшее число каналов):\n\n",
    ex_leaderboard_line: "{{rank}} {{name}} — <b>{{count}} баллов</b>\n",
    ex_leaderboard_anon_user: "Пользователь #{{id}}",
    ex_leaderboard_empty: "🏆 Рейтинг пока пуст — станьте первым, кто подпишется на другие каналы на этой неделе, и возглавьте список! 🔥",
    ex_leaderboard_load_error: "❌ Не удалось загрузить рейтинг. Попробуйте немного позже.",
    ex_leaderboard_join_hint: "👆 Вас пока нет в списке — подпишитесь на несколько каналов и займите своё место!",
    ex_invite_text:
      "🎁 <b>Пригласите друзей!</b>\n\n" +
      "Если ваш друг впервые зайдёт в бот по вашей персональной ссылке ниже и добавит свой канал в раздел «Сбор подписчиков» — вам сразу начислится <b>{{referralBonus}} бонусных балла</b> (отображается в разделе «Обмен подписчиками» в вашем профиле на сайте).\n\n" +
      "🔗 <code>{{link}}</code>",
    ex_add_instructions:
      "➕📡 <b>Добавить канал</b>\n\n" +
      "🎁 <i>Обратите внимание: если это ваш ПЕРВЫЙ канал, подключённый к боту, вы сразу получите {{welcomeBonus}} бонусных баллов!</i>\n\n" +
      "1️⃣ Добавьте бота <b>администратором</b> в свой канал (Канал → Администраторы → Добавить администратора → выберите бота)\n\n" +
      "2️⃣ Затем сделайте ОДНО из следующего:\n" +
      "   • <b>Перешлите (forward)</b> сюда любое сообщение из вашего канала, ИЛИ\n" +
      "   • Отправьте <b>@username</b> вашего канала (например: @my_channel), ИЛИ\n" +
      "   • Отправьте ссылку на канал (например: https://t.me/my_channel)\n\n" +
      "⚠️ Если ваш канал <b>закрытый (private)</b> — сработает ТОЛЬКО способ с <b>пересылкой</b> (ни username, ни обычная ссылка не подойдут, так как у закрытого канала нет публичного username). Пригласительная ссылка для закрытого канала тоже не сработает — обязательно перешлите сообщение.",
    ex_channels_load_error: "⚠️ Не удалось загрузить каналы.",
    ex_no_channels_yet: "📭 У вас пока нет добавленных каналов.",
    ex_my_channels_title: "🗂✨ <b>Мои каналы:</b>\n\n",
    ex_channel_active: "✅ Активен (в очереди)",
    ex_channel_suspended: "⏸ Приостановлен{{reason}}",
    ex_channel_row: "• <b>{{title}}</b>\n   {{status}}\n   🏆 Всего баллов: <b>{{count}}</b>\n\n",
    ex_channel_remove_btn: "🗑 Удалить: {{title}}",
    ex_remove_error: "⚠️ Не удалось удалить.",
    ex_remove_success: "✅ Канал удалён.",
    ex_resubscribe_btn: "🔗 Подписаться заново: {{title}}",
    ex_lapsed_notice: "🚫 Вы отписались от следующего канала (каналов): <b>{{channels}}</b>\n\nИз-за этого ваш канал временно снят с очереди и новые баллы больше не начисляются. При повторной подписке всё восстановится автоматически.",
    ex_reactivated_notice: "✅ Поздравляем! Ваш канал (<b>{{names}}</b>) снова добавлен в очередь — спасибо, что подписались заново.",
    ex_credit_reactivated_notice: "✅ Ваш канал (<b>{{names}}</b>) снова добавлен в очередь «Сбор подписчиков» — он опять будет предлагаться другим пользователям.",
    ex_use_subscriber_bot: "🔄 Раздел «Сбор подписчиков» теперь работает в отдельном боте. Нажмите кнопку ниже, чтобы продолжить.",
    ex_open_subscriber_bot_btn: "🔄 Открыть бот сбора подписчиков",
    ex_new_channel_announcement: "🆕 Появился новый пользователь! Подпишитесь на его канал (<b>{{title}}</b>) и получите {{multiplier}} балла(ов) — за каждый ваш балл к вашему каналу автоматически добавляется 1 подписчик.",
    ex_browse_load_error: "⚠️ Не удалось загрузить каналы. Попробуйте немного позже.",
    ex_browse_empty: "📭 Сейчас нет новых каналов для подписки. Загляните немного позже.",
    ex_browse_disabled_by_admin: "⏸ Раздел подписки на каналы временно приостановлен администратором. Попробуйте немного позже.",
    ex_browse_title: "📋 <b>Подпишитесь на следующие каналы:</b>\n\n",
    ex_open_btn: "🔗 Открыть: {{title}}",
    ex_subscribed_btn: "✅ Я подписался: {{title}}",
    ex_confirm_all_btn: "✅ Я подписался на все",
    ex_next_page_btn: "➡️ Следующие 10 каналов",
    ex_confirm_all_session_expired: "⚠️ Список для проверки не найден. Сначала откройте список каналов через «🔄 Сбор подписчиков».",
    ex_confirm_all_result_title: "📋 <b>Результат проверки:</b>\n\n",
    ex_confirm_all_confirmed_line: "✅ Подтверждено: {{titles}}\n\n",
    ex_confirm_all_pending_line: "⏳ Вы ещё не подписались (подпишитесь и проверьте снова): {{titles}}\n\n",
    ex_confirm_all_unknown_line: "🔄 Не удалось проверить сейчас (временная ошибка) — проверьте ещё раз через некоторое время: {{titles}}\n\n",
    ex_confirm_all_rejected_line: "⚠️ Подписка подтверждена, но не была засчитана — {{reason}}: {{titles}}\n\n",
    ex_confirm_all_none_confirmed: "⚠️ Вы ещё не подписались ни на один канал из списка. Сначала подпишитесь, затем проверьте снова.",
    ex_channel_gone: "🚫 Этого канала больше не существует.",
    ex_own_channel: "🙅‍♂️ Это ваш собственный канал — вы не можете подписаться сами на себя.",
    ex_not_subscribed_yet: "⚠️ Вы ещё не подписаны на канал «{{title}}». Сначала подпишитесь, затем нажмите кнопку.",
    ex_subscribe_confirmed: "✅ Спасибо! Ваша подписка зафиксирована.",
    ex_subscribe_success: "✅🎉 Подписка на канал «{{title}}» зафиксирована. Спасибо!",
    ex_invite_link_error: "❌ Это закрытая пригласительная ссылка — бот не может автоматически распознать такую ссылку.\n\nПожалуйста, перешлите (forward) сюда любое сообщение из вашего КАНАЛА — это всегда работает, независимо от того, открытый канал или закрытый.",
    ex_channel_not_understood:
      "🤔 Я не понял. Пожалуйста:\n" +
      "• перешлите (forward) сюда сообщение из вашего канала, ИЛИ\n" +
      "• напишите username вашего канала с <b>@</b> (например: @my_channel), ИЛИ\n" +
      "• отправьте ссылку на ваш канал (например: https://t.me/my_channel), ИЛИ\n" +
      "• отправьте числовой ID канала, в котором бот уже состоит (например: -1001234567890)",
    ex_forward_not_channel: "❌ Это сообщение переслано из личного чата или группы, а не из канала. Пожалуйста, перешлите сообщение из вашего КАНАЛА.",
    ex_unnamed_channel: "Канал без названия",
    ex_chat_not_found: "❌ Канал с именем/ID «{{identifier}}» не найден. Проверьте правильность username, ссылки или ID, либо если канал закрытый — используйте способ пересылки (forward).",
    ex_not_a_channel: "❌ Этот username относится не к каналу, а к другому типу чата. Можно добавлять только каналы.",
    ex_bot_not_member: "❌ Бот вообще не состоит в этом канале. Сначала добавьте бота <b>администратором</b> в свой канал (Канал → Администраторы → Добавить администратора), затем попробуйте снова.",
    ex_bot_not_admin: "❌ Бот состоит в этом канале, но <b>не является администратором</b>. Дайте боту права администратора в настройках канала и попробуйте снова.",
    ex_owner_status_unknown: "❌ Не удалось определить ваш статус в этом канале. Убедитесь, что вы являетесь администратором канала.",
    ex_owner_not_admin: "❌ Вы не являетесь администратором этого канала, поэтому не можете его добавить. Добавлять может только владелец или администраторы канала.",
    ex_welcome_bonus_line: "\n\n🎉🎁 <b>Приветственный бонус!</b> За первое подключение канала к боту вам сразу начислено <b>{{bonus}} бонусных баллов</b>! 🥳",
    ex_channel_added: "✅🚀 Канал <b>{{title}}</b> успешно добавлен и поставлен в очередь!",
    product_not_found: "😔 Такой товар не найден. Возможно, он удалён или ссылка неверна.",
    product_already_sold: "😔 Товар «{{name}}» уже продан.",
    product_no_description: "Описание отсутствует.",
    product_price_label: "Цена",
    product_buy_btn: "💳 Купить",
    product_load_error: "⚠️ Не удалось загрузить данные о товаре.",
    link_account_instructions: "🔗 <b>Привязка аккаунта</b>\n\n1️⃣ На сайте перейдите в раздел: <b>Профиль → Настройки</b>\n2️⃣ Получите там 6-значный код привязки\n3️⃣ Напишите здесь <code>/bogla КОД</code>\n\nНапример: <code>/bogla A1B2C3</code>",
    payment_preparing: "💳⏳ Подготовка оплаты...",
    payment_create_error: "Ошибка при создании оплаты.",
    payment_finish_btn: "💰 Завершить оплату",
    payment_link_ready: "\n\n✅ Ссылка на оплату готова! Оплатите с помощью кнопки ниже или QR-кода.",
    payment_qr_caption: "📱 Отсканируйте этот QR-код, чтобы оплатить через криптокошелёк.",
    ex_channel_lost_access: "⚠️ Ваш канал <b>«{{title}}»</b> временно снят с очереди «Сбор подписчиков» — бот больше не является администратором этого канала (или канал не найден).\n\nЕсли вы случайно удалили бота из администраторов, снова назначьте его администратором и добавьте канал заново — это сразу вернёт его в очередь.",
    ex_hourly_join_report: "👥 За последний 1 час к вашему каналу <b>«{{title}}»</b> через бота присоединилось <b>{{count}}</b> новых человек.",
    ex_inactivity_reminder: "⏳ Ваш канал <b>«{{title}}»</b> находится в очереди «Сбор подписчиков» и ждёт новых баллов — но за последние 24 часа вы сами ни на один канал не подписались.\n\nОбмен работает в обе стороны: чем на больше каналов вы подпишетесь, тем быстрее ваш канал продвигается в очереди и получает новые баллы. Уделите 2 минуты и подпишитесь на несколько каналов 👇\n\n💡 <b>Ещё один способ:</b> пригласите друзей! За каждого приглашённого вы получаете бонусный балл, а они, в свою очередь, тоже могут поделиться ботом с другими — так ваш канал быстрее наберёт больше реальных подписчиков.",
    ex_report_btn: "🚩 Пожаловаться",
    ex_report_choose_reason: "🚩 По какой причине вы хотите пожаловаться?",
    ex_report_reason_spam: "📢 Спам / ненужная реклама",
    ex_report_reason_content: "🔞 Неприемлемый контент",
    ex_report_reason_scam: "🎭 Мошенничество / обман",
    ex_report_reason_other: "✏️ Другая причина",
    ex_report_other_prompt: "✏️ Напишите причину жалобы (минимум 3 символа):",
    ex_report_reason_short: "⚠️ Причина слишком короткая. Пожалуйста, опишите подробнее.",
    ex_report_success: "✅ Ваша жалоба принята, администратор рассмотрит её. Спасибо!",
    ex_report_already_sent: "ℹ️ Вы уже подавали жалобу на этот канал за последние 24 часа."
  },
  en: {
    welcome:
      "👋 <b>Welcome to the Savdo24 bot!</b>\n\n" +
      "Here you can:\n" +
      "🆕 Browse the newest listings,\n" +
      "🔥 Find the top/best-value deals,\n" +
      "💳 Make a purchase,\n" +
      "👤 View your own profile.\n\n" +
      "Tap one of the buttons below to get started 👇",
    help:
      "❓ <b>Help</b>\n\n" +
      "Using the bot is simple — just tap the buttons below, no typing required.\n\n" +
      "🆕 <b>New listings</b> — the most recently added products\n" +
      "🔥 <b>Top deals</b> — the most popular listings\n" +
      "🔍 <b>Search</b> — search by product name\n" +
      "👤 <b>My profile</b> — balance, your referral code, etc. (link your account first)\n" +
      "🔗 <b>Link account</b> — connects your website account to this Telegram account\n\n" +
      "If you run into any issue, visit the website and go to the \"Help\" section.",
    menu_new: "🆕 New listings",
    menu_top: "🔥 Top deals",
    menu_categories: "📂 Categories",
    menu_search: "🔍 Search",
    menu_profile: "👤 My profile",
    menu_link: "🔗 Link account",
    menu_exchange: "🔄 Subscriber exchange",
    menu_site: "🌐 Open website",
    menu_help: "❓ Help",
    menu_language: "🌐 Til / Language",
    menu_products: "🛍 Products",
    menu_more: "☰ More",
    products_menu_title: "🛍 <b>Products</b>\n\nWhat would you like to see?",
    more_menu_title: "☰ <b>More</b>",
    back_to_menu: "🏠 Main menu",
    choose_language: "🌐 <b>Tilni tanlang / Choose language / Выберите язык</b>",
    language_set_uz: "✅ Til o'zbekchaga o'zgartirildi.",
    language_set_en: "✅ Language switched to English.",
    language_set_ru: "✅ Язык изменён на русский.",
    categories_title: "📂✨ <b>Choose a category</b>\n\nWhich section's listings would you like to browse?",
    categories_empty: "😔 No categories available yet.",
    categories_error: "⚠️ Failed to load categories. Please try again shortly.",
    category_fallback: "Category",
    listing_new_title: "🆕 Latest listings",
    listing_new_empty: "No new listings yet.",
    listing_top_title: "🔥 Top deals",
    listing_top_empty: "No top listings yet.",
    listing_category_empty: "No listings in this category yet.",
    listing_error: "⚠️ Failed to load the list. Please try again shortly.",
    search_prompt: "🔍 <b>Search</b>\n\nWhat are you looking for? Type a product name or keyword.\n\nOr directly: <code>/qidiruv word</code>",
    search_cancel: "❌ Cancel",
    search_empty: "😔 Nothing found for \"{{query}}\".",
    search_error: "⚠️ Search failed. Please try again shortly.",
    other_category: "📂 Other category",
    back_to_list: "🔙 Back to list",
    sponsor_gate_title: "📢🔒 <b>You must subscribe to the following channel(s) to use this bot:</b>\n\nOnce subscribed, tap the <b>✅ Check</b> button below.",
    sponsor_gate_join: "➕ Subscribe: {{channel}}",
    sponsor_gate_check: "✅ Check",
    sponsor_gate_alert: "⚠️ Please subscribe to the channel(s) below first.",
    sponsor_gate_still_not: "⚠️ You're not subscribed to these channels yet: {{channels}}",
    sponsor_gate_confirmed: "✅ Thanks! Subscription confirmed.",
    subscriber_bot_no_channels: "ℹ️ No active sponsor channels right now. Please try again later.",
    subscriber_bot_open_main: "🚀 Open the main bot",
    subscriber_bot_open_main_prompt: "Tap the button below to open the main bot 👇",
    subscriber_bot_welcome:
      "👋 <b>Welcome! This is the \"Subscriber exchange\" bot.</b>\n\n" +
      "Here you can get <b>free, real subscribers</b> for your Telegram channel — no payment needed, just an exchange:\n\n" +
      "1️⃣ First, connect your channel to the bot (the bot is added as admin)\n" +
      "2️⃣ Then subscribe to other users' channels\n" +
      "3️⃣ The more you subscribe, the faster your channel moves up the queue — and others start subscribing to YOU\n\n" +
      "👇 To get started, tap the <b>\"🔄 Subscriber exchange\"</b> button below.",
    subscriber_bot_language_btn: "🌐 Language",
    subscriber_bot_invite_btn: "🔗 Invite friends",
    subscriber_bot_stats_btn: "📊 Stats",
    subscriber_bot_profile_btn: "👤 Profile",
    subscriber_bot_report_btn: "🚩 Report",
    subscriber_bot_rules_btn: "📜 Rules & bonuses",
    subscriber_bot_choose_language: "🌐 Choose a language / Выберите язык:",
    subscriber_bot_invite_text: "🔗 Invite your friends using this link:\n<code>{{link}}</code>",
    subscriber_bot_invite_error: "⚠️ Couldn't generate the link right now, please try again later.",
    subscriber_bot_stats_text: "📊 <b>{{count}}</b> people joined the bot through you.",
    subscriber_bot_stats_error: "⚠️ Couldn't load the stats right now, please try again later.",
    generic_error: "⚠️ Something went wrong, please try again later.",
    start_link_expired: "⌛️ This link has expired or is invalid.",
    start_generic_error: "⚠️ Something went wrong, please try again later.",
    start_network_error: "⚠️ A network error occurred. Please try again shortly.",
    unrecognized_input: "🤔 Sorry, I didn't understand that.\n\nPlease choose one of the buttons below 👇",
    link_code_error: "Linking failed. The code may have expired.",
    link_code_error_hint: "Get a new code from the website and try again.",
    product_id_required: "🔎 Please enter a product ID. Example: <code>/mahsulot 123</code>",
    unexpected_error: "⚠️ An unexpected error occurred. Please try again.",
    referral_invite_note: "🔄 Your friend invited you to the <b>\"Subscriber exchange\"</b> section! Add your own channel there and your friend will get a bonus subscriber.",
    link_account_required: "👤 You need to link your account first.",
    notif_off_toast: "🔕 Promotional messages turned off.",
    notif_on_toast: "🔔✅ Notifications turned on.",
    file_ready: "📦✅ Your file is ready: {{url}}",

    rate_limit_warning: "⏳ Too many requests — please slow down a bit and try again in a few seconds.",
    listing_no_more: "😔 No more listings.",
    page_indicator: "(page {{page}}/{{totalPages}})",
    tap_product_hint: "\nTap a product name to view details 👇",
    nav_previous: "⬅️ Previous",
    nav_next: "Next ➡️",
    search_no_more: "😔 No more results.",
    search_results_title: "Results for \"{{query}}\"",
    search_new: "🔍 New search",
    profile_activity_btn: "🧾 Activity log",
    profile_purchases_btn: "🛒 My purchases",
    profile_sales_btn: "💰 My sales",
    profile_stats_btn: "📊 My stats",
    profile_exchange_btn: "🔄 Subscriber exchange",
    profile_notifications_btn: "🔔 Notification settings",
    profile_referral_btn: "🎯 Invite friends",
    refresh_btn: "🔄 Refresh",
    back_profile_btn: "⬅️ Profile",
    profile_link_required_full: "👤 To view your profile, you first need to link your website account.\n\nTap the \"🔗 Link account\" button below 👇",
    profile_balance_line: "💰 Balance: <b>{{balance}} USDT</b>\n",
    profile_referral_earned_line: "🎁 Referral earnings: <b>{{amount}} USDT</b>\n",
    profile_referral_count_line: "👥 Referrals: <b>{{count}}</b>\n",
    profile_referral_code_line: "🔗 Referral code: <code>{{code}}</code>\n",
    none_placeholder: "none",
    profile_unread_line: "🔴 Unread activity: <b>{{count}}</b> — see \"🧾 Activity log\" below\n",
    profile_no_unread_line: "🟢 No new activity — all caught up\n",
    profile_load_error: "⚠️ Failed to load profile data.",
    referral_no_code: "🎯 You don't have a referral code yet. You can create one on the website under Profile → Referrals.",
    referral_invite_text: "<b>🎯 Invite your friends</b>\n\nUsers who sign up through the link below get a discount, and you earn a reward from their purchases.\n\n🔗 <code>{{link}}</code>\n\nCopy the link and share it with your friends 👆",
    referral_link_error: "⚠️ Failed to get the referral link.",
    seller_stats_title: "<b>📊 My stats</b>\n",
    seller_stats_total: "📦 Total listings: {{count}}\n",
    seller_stats_active: "✅ Active listings: {{count}}\n",
    seller_stats_sold: "🏷 Sold: {{count}}\n",
    seller_stats_views: "👁 Total views: {{count}}\n",
    seller_stats_sales: "💰 Completed sales: {{count}}",
    seller_stats_error: "⚠️ Failed to load stats.",
    purchases_empty: "🛒 You don't have any purchases yet.",
    purchases_title: "<b>🛒 My purchases</b> (last 10)\n\n",
    purchases_rate_btn: "⭐ Rate \"{{name}}\"",
    purchases_error: "⚠️ Failed to load purchase history.",
    sales_empty: "💰 You don't have any sales yet.",
    sales_title: "<b>💰 My sales</b> (last 10)\n\n",
    sales_error: "⚠️ Failed to load sales history.",
    review_stars_prompt: "⭐ How many stars would you give?",
    session_expired: "⚠️ Session expired, please try again.",
    review_comment_prompt: "✍️ Now write your comment (up to 1000 characters):",
    review_comment_short: "✍️ Comment is too short — write at least 3 characters.",
    review_submit_error: "⚠️ Failed to submit review.",
    review_submit_success: "🎉 Thanks! Your review was submitted successfully.",
    support_subject_short: "📝 Subject is too short — write at least 2 characters.",
    support_message_prompt: "✍️ Now describe your issue in detail:",
    support_message_short: "✍️ Message is too short — write at least 5 characters.",
    support_submit_error: "⚠️ Failed to send your request.",
    support_submit_success: "✅ Your request was received! We'll get back to you soon.",
    support_start_prompt: "🆘 <b>Contact support</b>\n\n📝 First, write a short subject (e.g. \"Payment issue\"):",
    subscriber_bot_report_prompt: "🆘 <b>Report</b>\n\n📝 Send me the channel link and your complaint:",
    contact_support_btn: "🆘 Contact support",
    search_term_short: "🔍 Search term is too short — write at least 2 characters.",
    notif_turn_on: "✅ Turn notifications on",
    notif_turn_off: "🔕 Turn notifications off",
    notif_status_on: "✅ On",
    notif_status_off: "🔕 Off",
    notif_settings_text: "<b>🔔 Notification settings</b>\n\nPromotional / broadcast messages: <b>{{status}}</b>\n\nℹ️ Important messages about purchases, payments, and disputes are always sent regardless of this setting.",
    notif_settings_error: "⚠️ Failed to load settings.",
    notif_toggle_error: "⚠️ Failed to change the setting.",
    activity_just_now: "just now",
    activity_min_ago: "{{count}} min ago",
    activity_hours_ago: "{{count}}h ago",
    activity_empty: "🧾 Activity log is empty — the bot hasn't recorded anything yet.",
    activity_title: "<b>🧾 Activity log</b> (last 15)\n━━━━━━━━━━━━━━━\n\n",
    activity_error: "⚠️ Failed to load activity log.",
    exchange_status_blocked: "Blocked by admin",
    exchange_status_queued: "Waiting in queue — not shown to anyone yet",
    exchange_status_active: "Active — currently being shown to others. Subscribe to any 1 channel and your channel gets <b>+{{multiplier}} subscribers</b> and is temporarily removed from the queue.",
    exchange_status_lapsed: "Suspended — you unsubscribed. Subscribe back and it's automatically added back to the queue.",
    exchange_status_quota: "Removed from queue — {{reason}}. To get back in the queue, resubmit the same channel via \"➕ Add my channel\".",
    exchange_status_quota_default_reason: "subscribers collected",
    exchange_load_error_retry: "⚠️ Failed to load data. Please try again shortly.",
    exchange_summary_title: "<b>🔄 Subscriber exchange — my stats</b>\n━━━━━━━━━━━━━━━\n\n",
    exchange_total_collected: "👥 Total subscribers collected: <b>{{count}}</b>\n",
    exchange_referral_bonus_line: "   ┗ of which from referrals: <b>{{count}}</b>\n",
    exchange_active_subs_line: "📥 Channels you're currently actually subscribed to: <b>{{count}}</b>\n",
    exchange_referral_stats_line: "🎯 Referrals: <b>{{invited}}</b> invited, <b>{{rewarded}}</b> of them rewarded\n",
    exchange_new_subs_today_line: "📆 New subscriptions today: <b>{{count}}/{{max}}</b>\n\n",
    exchange_no_channels: "🗂 You don't have any channels added yet.",
    exchange_channels_title: "🗂 <b>Your channels</b> ({{count}}/{{max}}):\n\n",
    exchange_channel_line: "• <b>{{title}}</b>\n   👥 {{count}} subscribers\n   {{status}}\n\n",
    exchange_add_channel_btn: "➕ Add my channel",
    exchange_manage_channels_btn: "🗂 Manage channels",
    exchange_subscribe_btn: "📋 Subscribe to channels",
    exchange_invite_btn: "🎁 Invite friends",
    exchange_load_error: "⚠️ Failed to load data.",
    exchange_rule_text:
      "⚠️ <b>Attention, important rule!</b>\n\n" +
      "You subscribe to other people's channels — for each subscription, <b>{{multiplier}} subscribers are added to YOUR OWN channel</b> and it's immediately removed from the queue (it won't be offered to others anymore). The more channels you subscribe to, the more subscribers you collect (e.g. subscribing to 4 channels gets you {{quadExample}} subscribers).\n\n" +
      "❗️ If you later <b>unsubscribe</b> from a channel you subscribed to, <b>your own channel will be removed from the queue</b> and you'll stop receiving new subscribers — until you subscribe back.",
    exchange_my_channels_btn: "🗂 My channels",
    exchange_intro:
      "🔄✨ <b>Subscriber exchange</b>\n\n" +
      "Add your own channel, then subscribe to other users' channels — each subscription adds {{multiplier}} subscribers to your channel.\n\n",
    ex_info_btn: "ℹ️ Rules & bonuses",
    ex_info_intro:
      "ℹ️ <b>Rules & bonuses</b>\n\n" +
      "🎁 <b>Welcome bonus:</b> the FIRST time you link your channel, you instantly get {{welcomeBonus}} bonus subscribers! 🥳\n\n" +
      "👯 <b>Referral bonus:</b> invite a friend — if they join the bot and add their own channel, you get another {{referralBonus}} bonus subscribers!\n\n",
    ex_live_stats_line: "📊 <b>{{count}} people</b> subscribed to other channels today — join in now! 🔥\n\n",
    ex_milestone_progress: "\n{{bar}} {{percent}}%\n{{badge}} <b>{{remaining}} more subscribers</b> to reach the next milestone!\n",
    ex_milestone_reached: "\n{{bar}} 100%\n{{badge}} You've reached the top milestone! Amazing result 🎉\n",
    ex_leaderboard_btn: "🏆 Leaderboard (weekly)",
    ex_leaderboard_title: "🏆 <b>Weekly activity leaderboard</b>\n\nMost active users — the ones who subscribed to the most channels in the last 7 days:\n\n",
    ex_leaderboard_line: "{{rank}} {{name}} — <b>{{count}} subscribers</b>\n",
    ex_leaderboard_anon_user: "User #{{id}}",
    ex_leaderboard_empty: "🏆 The leaderboard is empty for now — be the first to subscribe to other channels this week and take the top spot! 🔥",
    ex_leaderboard_load_error: "❌ Failed to load the leaderboard. Please try again shortly.",
    ex_leaderboard_join_hint: "👆 You're not on the list yet — subscribe to a few channels and claim your spot!",
    ex_invite_text:
      "🎁 <b>Invite your friends!</b>\n\n" +
      "If a friend joins the bot for the first time through your personal link below and adds their own channel to \"Subscriber exchange\" — you instantly get <b>{{referralBonus}} bonus subscribers</b> (visible under \"Subscriber exchange\" in your website profile).\n\n" +
      "🔗 <code>{{link}}</code>",
    ex_add_instructions:
      "➕📡 <b>Add channel</b>\n\n" +
      "🎁 <i>Note: if this is the FIRST channel you've linked to the bot, you'll instantly get {{welcomeBonus}} bonus subscribers!</i>\n\n" +
      "1️⃣ Add the bot as an <b>admin</b> to your channel (Channel → Administrators → Add Admin → select the bot)\n\n" +
      "2️⃣ Then do ONE of the following:\n" +
      "   • <b>Forward</b> any message from your channel here, OR\n" +
      "   • Send your channel's <b>@username</b> (e.g. @my_channel), OR\n" +
      "   • Send your channel's link (e.g. https://t.me/my_channel)\n\n" +
      "⚠️ If your channel is <b>private</b> — only the <b>forward</b> method works (neither username nor a plain link works, since a private channel has no public username). An invite link won't work for a private channel either — you must forward a message.",
    ex_channels_load_error: "⚠️ Failed to load channels.",
    ex_no_channels_yet: "📭 You don't have any channels added yet.",
    ex_my_channels_title: "🗂✨ <b>My channels:</b>\n\n",
    ex_channel_active: "✅ Active (in queue)",
    ex_channel_suspended: "⏸ Suspended{{reason}}",
    ex_channel_row: "• <b>{{title}}</b>\n   {{status}}\n   👥 Total subscribers: <b>{{count}}</b>\n\n",
    ex_channel_remove_btn: "🗑 Remove: {{title}}",
    ex_remove_error: "⚠️ Failed to remove.",
    ex_remove_success: "✅ Channel removed.",
    ex_resubscribe_btn: "🔗 Resubscribe: {{title}}",
    ex_lapsed_notice: "🚫 You unsubscribed from the following channel(s): <b>{{channels}}</b>\n\nBecause of this, your channel was temporarily removed from the queue and won't receive new subscribers. It will be restored automatically once you resubscribe.",
    ex_reactivated_notice: "✅ Congratulations! Your channel (<b>{{names}}</b>) was added back to the queue — thanks for resubscribing.",
    ex_credit_reactivated_notice: "✅ Your channel (<b>{{names}}</b>) was added back to the \"Subscriber exchange\" queue — it will be offered to other users again.",
    ex_use_subscriber_bot: "🔄 The \"Subscriber exchange\" section now runs in a separate bot. Tap the button below to continue.",
    ex_open_subscriber_bot_btn: "🔄 Open the subscriber-exchange bot",
    ex_new_channel_announcement: "🆕 A new user just joined! Subscribe to their channel (<b>{{title}}</b>) and get {{multiplier}} points — for every point you earn, 1 subscriber gets automatically added to your channel.",
    ex_browse_load_error: "⚠️ Failed to load channels. Please try again shortly.",
    ex_browse_empty: "📭 No new channels available right now. Please check back shortly.",
    ex_browse_disabled_by_admin: "⏸ The subscriber exchange feature has been temporarily paused by the admin. Please check back shortly.",
    ex_browse_title: "📋 <b>Subscribe to the following channels:</b>\n\n",
    ex_open_btn: "🔗 Open: {{title}}",
    ex_subscribed_btn: "✅ Subscribed: {{title}}",
    ex_next_page_btn: "➡️ Next 10 channels",
    ex_confirm_all_btn: "✅ I've subscribed to all",
    ex_confirm_all_session_expired: "⚠️ No list found to check. First open the channel list via \"🔄 Subscriber exchange\".",
    ex_confirm_all_result_title: "📋 <b>Check result:</b>\n\n",
    ex_confirm_all_confirmed_line: "✅ Confirmed: {{titles}}\n\n",
    ex_confirm_all_pending_line: "⏳ You haven't subscribed yet (subscribe, then check again): {{titles}}\n\n",
    ex_confirm_all_unknown_line: "🔄 Couldn't verify these right now (temporary error) — please check again shortly: {{titles}}\n\n",
    ex_confirm_all_rejected_line: "⚠️ Your subscription was verified, but couldn't be recorded — {{reason}}: {{titles}}\n\n",
    ex_confirm_all_none_confirmed: "⚠️ You haven't subscribed to any of the channels in the list yet. Subscribe first, then check again.",
    ex_channel_gone: "🚫 This channel no longer exists.",
    ex_own_channel: "🙅‍♂️ This is your own channel — you can't count yourself as a subscriber.",
    ex_not_subscribed_yet: "⚠️ You're not subscribed to \"{{title}}\" yet. Subscribe first, then tap the button.",
    ex_subscribe_confirmed: "✅ Thanks! Your subscription has been recorded.",
    ex_subscribe_success: "✅🎉 Your subscription to \"{{title}}\" has been recorded. Thanks!",
    ex_invite_link_error: "❌ This is a private invite link — the bot can't automatically recognize it.\n\nPlease <b>forward</b> a message from your own CHANNEL here — this always works, regardless of whether the channel is public or private.",
    ex_channel_not_understood:
      "🤔 I didn't understand that. Please:\n" +
      "• <b>forward</b> a message from your channel, OR\n" +
      "• send your channel's username with <b>@</b> (e.g. @my_channel), OR\n" +
      "• send your channel's link (e.g. https://t.me/my_channel), OR\n" +
      "• send the numeric ID of a channel the bot is already a member of (e.g. -1001234567890)",
    ex_forward_not_channel: "❌ This message was forwarded from a private chat or group, not a channel. Please forward a message from your own CHANNEL.",
    ex_unnamed_channel: "Unnamed channel",
    ex_chat_not_found: "❌ Channel \"{{identifier}}\" not found. Check that the username, link, or ID is correct, or use the forward method if the channel is private.",
    ex_not_a_channel: "❌ This username doesn't belong to a channel, but another type of chat. You can only add a channel.",
    ex_bot_not_member: "❌ The bot isn't a member of this channel at all. First add the bot as an <b>admin</b> to your channel (Channel → Administrators → Add Admin), then try again.",
    ex_bot_not_admin: "❌ The bot is a member of this channel, but <b>not an admin</b>. Grant the bot admin rights in the channel settings, then try again.",
    ex_owner_status_unknown: "❌ Couldn't determine your status in this channel. Make sure you're an admin there.",
    ex_owner_not_admin: "❌ You're not an admin of this channel, so you can't add it. Only the channel owner or admins can add it.",
    ex_welcome_bonus_line: "\n\n🎉🎁 <b>Welcome bonus!</b> Since this is the first channel you've linked to the bot, you've been instantly awarded <b>{{bonus}} bonus subscribers</b>! 🥳",
    ex_channel_added: "✅🚀 <b>{{title}}</b> was successfully added and queued!",
    product_not_found: "😔 Product not found. It may have been deleted or the link is incorrect.",
    product_already_sold: "😔 \"{{name}}\" has already been sold.",
    product_no_description: "No description available.",
    product_price_label: "Price",
    product_buy_btn: "💳 Buy",
    product_load_error: "⚠️ Failed to load product details.",
    link_account_instructions: "🔗 <b>Link account</b>\n\n1️⃣ On the website: go to <b>Profile → Settings</b>\n2️⃣ Get the 6-character linking code from there\n3️⃣ Here, type <code>/bogla CODE</code>\n\nExample: <code>/bogla A1B2C3</code>",
    payment_preparing: "💳⏳ Preparing payment...",
    payment_create_error: "Failed to create payment.",
    payment_finish_btn: "💰 Finish payment",
    payment_link_ready: "\n\n✅ Payment link is ready! Pay using the button below or the QR code.",
    payment_qr_caption: "📱 Scan this QR code to pay with your crypto wallet.",
    ex_channel_lost_access: "⚠️ <b>\"{{title}}\"</b> was temporarily removed from the \"Subscriber exchange\" queue — the bot is no longer an admin in this channel (or the channel can't be found).\n\nIf you removed the bot's admin rights by accident, make it an admin again and re-add your channel — this restores it to the queue immediately.",
    ex_hourly_join_report: "👥 In the last hour, <b>{{count}}</b> new people joined your channel <b>\"{{title}}\"</b> through the bot.",
    ex_inactivity_reminder: "⏳ Your channel <b>\"{{title}}\"</b> is in the \"Subscriber exchange\" queue waiting for new subscribers — but you haven't subscribed to any channel in the last 24 hours.\n\nThe exchange works both ways: the more channels you subscribe to, the faster your own channel moves up the queue and gets new subscribers. Take 2 minutes to subscribe to a few channels 👇\n\n💡 <b>Another way:</b> invite your friends! You get a bonus for every friend you invite, and they may go on to share the bot with others too — growing your real subscriber count even faster.",
    ex_report_btn: "🚩 Report",
    ex_report_choose_reason: "🚩 Why are you reporting this channel?",
    ex_report_reason_spam: "📢 Spam / unwanted ads",
    ex_report_reason_content: "🔞 Inappropriate content",
    ex_report_reason_scam: "🎭 Scam / fraud",
    ex_report_reason_other: "✏️ Other reason",
    ex_report_other_prompt: "✏️ Write the reason for your report (at least 3 characters):",
    ex_report_reason_short: "⚠️ That reason is too short. Please add a bit more detail.",
    ex_report_success: "✅ Your report was received, an admin will review it. Thank you!",
    ex_report_already_sent: "ℹ️ You already reported this channel in the last 24 hours."
  }
};

// ✉️ BOT XABARLARI — ADMIN TAHRIRLARI (YANGI, foydalanuvchi talabi —
// "admin paneldan 'Obunachi yig'ish' botining barcha xabarlarini o'zim
// qo'lda to'g'irlashni xohlayman"):
//
// Admin panelda tahrirlangan matnlar `Setting` jadvalida
// `BOT_MSG:<key>` kaliti bilan (boshqa maxfiy sozlamalar kabi)
// shifrlangan holda saqlanadi (qarang: src/routes/exchange-channels.ts,
// adminRouter'dagi GET/PUT/DELETE /messages* endpointlari). Standart
// (default) matnlar esa src/lib/botMessageDefaults.ts faylida —
// bularning ikkalasi ham shu yerda BIRLASHTIRILADI.
//
// MUHIM (SINXRONLIK): `t()` funksiyasi botning yuzlab joyida
// to'g'ridan-to'g'ri, `await`siz chaqiriladi — shu sabab uni asinxron
// qilib bo'lmaydi. Shuning uchun tahrirlar DB'dan xotiraga oldindan
// (bot ishga tushganda va so'ng davriy ravishda) yuklab olinadi;
// `t()' ning o'zi faqat shu tayyor xotira-keshni o'qiydi.
let botMessageOverrides: Record<string, string> = {};

// Bot ishga tushganda (index.ts/subscriber-bot/index.ts'dan chaqiriladi)
// VA davriy ravishda (pastdagi setInterval) qayta chaqiriladi — shu
// sabab admin panelda kiritilgan tahrir botni qayta ishga tushirmasdan
// ham (bir necha daqiqa ichida) kuchga kiradi.
export async function refreshBotMessageOverrides(): Promise<void> {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { startsWith: "BOT_MSG:" } }
    });
    const next: Record<string, string> = {};
    for (const row of rows) {
      try {
        next[row.key.slice("BOT_MSG:".length)] = decryptSecret(row.value);
      } catch (err) {
        logger.warn({ err, key: row.key }, "Bot xabar shabloni tahririni deshifrlashda xatolik — standart matn ishlatiladi.");
      }
    }
    botMessageOverrides = next;
  } catch (err) {
    // Baza vaqtincha javob bermasa — eski (yoki bo'sh) kesh bilan davom
    // etamiz. Bu botni umuman to'xtatib qo'yadigan kritik xatolik emas:
    // standart matnlar baribir ishlayveradi.
    logger.warn({ err }, "Bot xabar shablonlari tahrirlarini (admin panel) yuklab bo'lmadi — standart matnlar ishlatilmoqda.");
  }
}

// Har 2 daqiqada bir marta avtomatik yangilanadi. `unref()` — bu taymer
// process'ni tirik ushlab turmasin (masalan testlarda yoki graceful
// shutdown'da process shu sabab osilib qolmaydi).
setInterval(() => {
  refreshBotMessageOverrides().catch(() => {});
}, 2 * 60 * 1000).unref?.();

// {{var}} shabloniga ega qatorlarni almashtiradi (masalan {{query}}).
export function t(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  let str = botMessageOverrides[key] ?? translations[lang][key] ?? translations.uz[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return str;
}

// Til-kesh: har bir telegramUserId uchun 10 daqiqa xotirada saqlanadi —
// har xabarda bazaga murojaat qilinmasligi uchun.
const languageCache = new Map<string, { lang: Lang; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

// MUHIM (TARIX): Ilgari bu ikki funksiya asosiy serverga HTTP (fetch)
// so'rov yuborardi (`appUrl`/`botSecret` parametrlari o'sha HTTP
// chaqiruvi uchun kerak edi). Endi TelegramBotUser jadvaliga
// to'g'ridan-to'g'ri Prisma orqali (telegram-bot/db.ts) o'qiladi/yoziladi —
// bu yerda ham (session-store.ts kabi) hech qanday qo'shimcha
// business-logika (bildirishnoma, validatsiya) yo'q, faqat oddiy
// key-value o'qish/yozish, shuning uchun to'g'ridan-to'g'ri DB xavfsiz.
//
// `appUrl`/`botSecret` parametrlari BARCHA chaqiruvchi joylarni
// o'zgartirmaslik uchun signature'da ataylab saqlab qolindi (endi
// ishlatilmaydi) — kelajakda kimdir buni tozalab, chaqiruvchilarni ham
// yangilashi mumkin.
export async function getUserLanguage(
  telegramUserId: number | string,
  _appUrl?: string,
  _botSecret?: string
): Promise<Lang> {
  const key = String(telegramUserId);
  const cached = languageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.lang;

  try {
    const row = await prisma.telegramBotUser.findUnique({ where: { telegramUserId: key } });
    const lang: Lang = row?.language === "en" ? "en" : row?.language === "ru" ? "ru" : "uz";
    languageCache.set(key, { lang, expiresAt: Date.now() + CACHE_TTL_MS });
    return lang;
  } catch {
    // Baza vaqtincha javob bermasa, standart "uz" bilan davom etamiz —
    // til tanlovi butun botni to'xtatib qo'yadigan kritik narsa emas.
    return "uz";
  }
}

// YANGI (foydalanuvchi talabi — "botga birinchi start bosilganida
// tilni tanlash tugmalari chiqsin"): foydalanuvchi HALI HECH QACHON
// tilni ANIQ tanlamagan-tanlamaganini tekshiradi — bu `getUserLanguage`
// dan farqli, chunki o'sha funksiya har doim biror til (standart "uz")
// qaytaradi. TelegramBotUser jadvalida yozuv MAVJUD EMASLIGI — bu
// foydalanuvchi hali umuman til tanlamagani (yoki hisobni ulash/eski
// "/language" REST API kabi boshqa yo'l bilan yozuv yaratmagani) degani,
// chunki yozuv FAQAT `setUserLanguage` chaqirilganda (til ANIQ
// tanlanganda) yaratiladi.
export async function hasUserChosenLanguage(telegramUserId: number | string): Promise<boolean> {
  try {
    const row = await prisma.telegramBotUser.findUnique({
      where: { telegramUserId: String(telegramUserId) },
      select: { telegramUserId: true }
    });
    return !!row;
  } catch {
    // Baza vaqtincha javob bermasa, xavfsiz tomonga o'tamiz — tilni
    // qayta-qayta so'rab foydalanuvchini charchatib yubormaslik uchun
    // "allaqachon tanlagan" deb hisoblaymiz (standart "uz" bilan davom
    // etadi, xatolik tuzatilgach keyingi safar to'g'ri aniqlanadi).
    return true;
  }
}

export async function setUserLanguage(
  telegramUserId: number | string,
  lang: Lang,
  _appUrl?: string,
  _botSecret?: string
): Promise<void> {
  const key = String(telegramUserId);
  languageCache.set(key, { lang, expiresAt: Date.now() + CACHE_TTL_MS });
  try {
    await prisma.telegramBotUser.upsert({
      where: { telegramUserId: key },
      create: { telegramUserId: key, language: lang },
      update: { language: lang }
    });
  } catch {
    // Kesh baribir yangilangani sabab shu seansda til darhol ishlaydi;
    // faqat doimiy saqlash (keyingi qayta ishga tushirishdan keyin ham
    // eslab qolish) muvaffaqiyatsiz bo'lgan bo'lishi mumkin — kritik emas.
  }
}
