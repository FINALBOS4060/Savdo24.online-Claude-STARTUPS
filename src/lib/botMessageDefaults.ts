// "Obunachi yig'ish" (kanal almashish/exchange) botining barcha
// TEXT/xabar shablonlari uchun YAGONA manba (single source of truth).
//
// TARIX: bu matnlar avval faqat telegram-bot/i18n.ts ("uz" lug'ati) va
// src/routes/exchange-channels.ts (bir nechta joyda to'g'ridan-to'g'ri
// qattiq kodlangan shablon) ichida qattiq kodlangan edi — ularni
// o'zgartirish uchun kodni tahrirlab, qayta deploy qilish shart edi.
//
// YANGI (foydalanuvchi talabi — admin paneldan shu bilan bog'liq
// "Obunachi yig'ish" botining BARCHA xabarlarini o'zi qo'lda
// to'g'irlashni xohlaydi): endi bu matnlar admin panelda ("Obunachi
// yig'ish" bo'limi → "Bot xabarlari") to'g'ridan-to'g'ri, kodga
// tegmasdan tahrirlanadi:
//   - Standart (default) matn: shu faylda, o'zgarmas "zaxira nusxa".
//   - Admin tahriri: Setting jadvalida "BOT_MSG:<key>" kaliti bilan,
//     shifrlangan holda saqlanadi (src/routes/exchange-channels.ts
//     ichidagi adminRouter GET/PUT/DELETE /messages* endpointlari).
//   - Bot runtime'da (telegram-bot/i18n.ts, t() funksiyasi) DB'dagi
//     tahrir mavjud bo'lsa O'SHANI, aks holda shu yerdagi standart
//     matnni ishlatadi (refreshBotMessageOverrides() orqali bir necha
//     daqiqada bir marta yangilanadigan xotira-kesh — t() o'zi
//     SINXRON qolishi SHART, chunki botning yuzlab joyida to'g'ridan-
//     to'g'ri, await'siz chaqiriladi).
//
// MUHIM: bu yerdagi qiymatlar {{variable}} ko'rinishidagi joy-
// tutuvchilarga ega bo'lishi mumkin (masalan {{title}}, {{count}}) —
// bular xabar yuborilayotganda haqiqiy son/nom bilan almashtiriladi.
// Admin panelda placeholder'lar matndan avtomatik (regex bilan)
// aniqlanadi va ko'rsatiladi — shu sabab bu yerda alohida
// ro'yxatlanmaydi. Admin placeholder'ni matndan o'chirib yuborsa,
// o'sha joyga endi hech narsa qo'yilmaydi (xato tashlanmaydi) — shu
// sabab admin panelda har bir shablon ostida "mavjud o'zgaruvchilar"
// ro'yxati eslatma sifatida ko'rsatiladi.
//
// DIQQAT (til): hozircha faqat "uz" (o'zbek) matni tahrirlanadi — agar
// admin biror kalitni o'zgartirsa, bu o'zgarish "ru"/"en" tilidagi
// (agar mavjud bo'lsa) versiyani ham qoplab qo'yadi, chunki
// "Obunachi yig'ish" boti amalda deyarli faqat o'zbek tilida
// ishlatiladi va uch tilni alohida tahrirlash imkoniyati hozircha
// qo'shilmagan.

export const BOT_MESSAGE_DEFAULTS: Record<string, string> = {
  "exchange_status_blocked": "Admin tomonidan bloklangan",
  "exchange_status_queued": "Navbatda kutmoqda — hali hech kimga ko'rsatilmagan",
  "exchange_status_active": "Faol — hozir boshqalarga ko'rsatilmoqda. Siz istalgan 1 ta kanalga obuna bo'lsangiz, kanalingizga <b>+{{multiplier}} ball</b> qo'shiladi va vaqtincha navbatdan chiqariladi.",
  "exchange_status_lapsed": "To'xtatilgan — obunadan chiqib ketgansiz. Orqaga qaytib obuna bo'lsangiz, avtomatik qayta navbatga qo'shiladi.",
  "exchange_status_quota": "Navbatdan olib tashlangan — {{reason}}. Qayta navbatga qo'shish uchun \"➕ Kanalimni qo'shish\" orqali xuddi shu kanalni qayta yuboring.",
  "exchange_status_quota_default_reason": "ball yig'ilgan",
  "exchange_load_error_retry": "⚠️ Ma'lumotlarni yuklab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
  "exchange_summary_title": "<b>🔄 Obunachi yig'ish — statistikam</b>\n━━━━━━━━━━━━━━━\n\n",
  "exchange_total_collected": "🏆 Jami to'plangan ball: <b>{{count}}</b> ta\n",
  "exchange_referral_bonus_line": "   ┗ shundan referaldan: <b>{{count}}</b> ta\n",
  "exchange_active_subs_line": "📥 Hozir haqiqiy obuna bo'lgan kanallaringiz: <b>{{count}}</b> ta\n",
  "exchange_referral_stats_line": "🎯 Referal: <b>{{invited}}</b> ta taklif, shundan <b>{{rewarded}}</b> tasi mukofot berdi\n",
  "exchange_new_subs_today_line": "📆 Bugun yangi obuna: <b>{{count}}/{{max}}</b>\n\n",
  "exchange_no_channels": "🗂 Sizda hali qo'shilgan kanal yo'q.",
  "exchange_channels_title": "🗂 <b>Kanallaringiz</b> ({{count}}/{{max}}):\n\n",
  "exchange_channel_line": "• <b>{{title}}</b>\n   🏆 {{count}} ta ball\n   {{status}}\n\n",
  "exchange_add_channel_btn": "➕ Kanalimni qo'shish",
  "exchange_manage_channels_btn": "🗂 Kanallarni boshqarish",
  "exchange_subscribe_btn": "📋 Kanallarga obuna bo'lish",
  "exchange_invite_btn": "🎁 Do'stlarni taklif qilish",
  "exchange_load_error": "⚠️ Ma'lumotlarni yuklashda xatolik yuz berdi.",
  "exchange_rule_text": "⚠️ <b>Diqqat, muhim qoida!</b>\n\nSiz boshqalarning kanaliga obuna bo'lasiz — har bir obuna uchun <b>sizning O'Z kanalingizga {{multiplier}} ta ball</b> qo'shiladi va shu zahoti kanalingiz navbatdan olib tashlanadi (u boshqalarga endi taklif qilinmaydi). Qancha ko'p kanalga obuna bo'lsangiz, shuncha ko'p ball yig'asiz (masalan 4 ta kanalga obuna bo'lsangiz — {{quadExample}} ta ball).\n\n❗️ Agar SIZ obuna bo'lgan biror kanaldan keyinchalik <b>chiqib ketsangiz</b> (obunani qaytarib olsangiz), <b>sizning kanalingiz navbatdan olib tashlanadi</b> va sizga endi yangi ball kelmaydi — toki siz orqaga qaytib obuna bo'lguningizcha.\n\nℹ️ <i>Diqqat: \"ball\" — bu botning ICHKI reyting/navbat hisobi, Telegramdagi haqiqiy obunachilar soni EMAS.</i>",
  "exchange_my_channels_btn": "🗂 Mening kanallarim",
  "exchange_intro": "🔄✨ <b>Obunachi yig'ish</b>\n\nO'z kanalingizni qo'shing, so'ng boshqa foydalanuvchilarning kanallariga obuna bo'ling — har bir obuna uchun kanalingizga {{multiplier}} tadan ball qo'shiladi.\n\n",
  "ex_info_btn": "ℹ️ Qoida va bonuslar",
  "ex_info_intro": "ℹ️ <b>Qoida va bonuslar</b>\n\n🎁 <b>Xush kelibsiz bonusi:</b> kanalingizni BIRINCHI marta ulaganingizda sizga darhol {{welcomeBonus}} ta bonus ball sovg'a qilinadi! 🥳\n\n👯 <b>Referal bonusi:</b> do'stingizni taklif qiling — u botga kirib o'z kanalini qo'shsa, sizga yana {{referralBonus}} ta bonus ball qo'shiladi!\n\nℹ️ <i>\"Ball\" — botning ICHKI reyting/navbat hisobi (Telegramdagi haqiqiy obunachilar soni emas).</i>",
  "ex_live_stats_line": "📊 Bugun <b>{{count}} kishi</b> boshqa kanallarga obuna bo'ldi — hoziroq siz ham qo'shiling! 🔥\n\n",
  "ex_milestone_progress": "\n{{bar}} {{percent}}%\n{{badge}} Yana <b>{{remaining}} ta ball</b> — va keyingi bosqichga chiqasiz!\n",
  "ex_milestone_reached": "\n{{bar}} 100%\n{{badge}} Siz eng yuqori bosqichga yetdingiz! Ajoyib natija 🎉\n",
  "ex_leaderboard_btn": "🏆 Reyting (haftalik)",
  "ex_leaderboard_title": "🏆 <b>Haftalik faollik reytingi</b>\n\nSo'nggi 7 kunda eng ko'p boshqa kanalga obuna bo'lgan (eng faol) foydalanuvchilar:\n\n",
  "ex_leaderboard_line": "{{rank}} {{name}} — <b>{{count}} ta ball</b>\n",
  "ex_leaderboard_anon_user": "Foydalanuvchi #{{id}}",
  "ex_leaderboard_empty": "🏆 Hozircha reyting bo'sh — bu hafta birinchi bo'lib boshqa kanallarga obuna bo'ling va ro'yxat boshida turing! 🔥",
  "ex_leaderboard_load_error": "❌ Reytingni yuklashda xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.",
  "ex_leaderboard_join_hint": "👆 Siz hali ro'yxatda yo'qsiz — bir nechta kanalga obuna bo'lib, o'z o'rningizni egallang!",
  "ex_invite_text": "🎁 <b>Do'stlaringizni taklif qiling!</b>\n\nQuyidagi shaxsiy havolangiz orqali botga birinchi marta kirgan do'stingiz o'z kanalini \"Obunachi yig'ish\" bo'limiga qo'shsa — sizga darhol <b>{{referralBonus}} ta bonus ball</b> qo'shiladi (sayt profilingizdagi \"Obuna almashish\" bo'limida ko'rinadi).\n\n🔗 <code>{{link}}</code>",
  "ex_add_instructions": "➕📡 <b>Kanal qo'shish</b>\n\n🎁 <i>Eslatma: agar bu sizning botga ulagan BIRINCHI kanalingiz bo'lsa, sizga darhol {{welcomeBonus}} ta bonus ball beriladi!</i>\n\n1️⃣ Botni o'z kanalingizga <b>admin</b> qilib qo'shing (Kanal → Administratorlar → Admin qo'shish → botni tanlang)\n\n2️⃣ Keyin quyidagilardan BIRINI qiling:\n   • Kanalingizdagi istalgan xabarni shu yerga <b>forward</b> qiling (uzatib yuboring), YOKI\n   • Kanalingizning <b>@username</b>'ini yozib yuboring (masalan: @mening_kanalim), YOKI\n   • Kanalingiz havolasini yuboring (masalan: https://t.me/mening_kanalim)\n\n⚠️ Agar kanalingiz <b>yopiq (private)</b> bo'lsa — faqat <b>forward</b> usuli ishlaydi (username ham, oddiy havola ham emas, chunki yopiq kanalning ochiq usernamesi yo'q). Yopiq kanal uchun taklif (invite) havolasi ham ishlamaydi — albatta forward qiling.",
  "ex_channels_load_error": "⚠️ Kanallarni yuklashda xatolik yuz berdi.",
  "ex_no_channels_yet": "📭 Sizda hali qo'shilgan kanal yo'q.",
  "ex_my_channels_title": "🗂✨ <b>Mening kanallarim:</b>\n\n",
  "ex_channel_active": "✅ Faol (navbatda)",
  "ex_channel_suspended": "⏸ To'xtatilgan{{reason}}",
  "ex_channel_row": "• <b>{{title}}</b>\n   {{status}}\n   🏆 Jami ball: <b>{{count}}</b> ta\n\n",
  "ex_channel_remove_btn": "🗑 O'chirish: {{title}}",
  "ex_remove_error": "⚠️ O'chirishda xatolik yuz berdi.",
  "ex_remove_success": "✅ Kanal o'chirildi.",
  "ex_resubscribe_btn": "🔗 Qayta obuna bo'lish: {{title}}",
  "ex_lapsed_notice": "🚫 Siz quyidagi kanal(lar)dan obunani bekor qilibsiz: <b>{{channels}}</b>\n\nShuning uchun sizning kanalingiz vaqtincha navbatdan chiqarildi va sizga endi yangi ball kelmaydi. Qaytadan obuna bo'lsangiz, avtomatik tiklanadi.",
  "ex_reactivated_notice": "✅ Tabriklaymiz! Kanalingiz (<b>{{names}}</b>) qaytadan navbatga qo'yildi — obunani tiklaganingiz uchun rahmat.",
  "ex_credit_reactivated_notice": "✅ Kanalingiz (<b>{{names}}</b>) yana \"Obunachi yig'ish\" navbatiga qo'shildi — boshqa foydalanuvchilarga qayta taklif qilina boshlaydi.",
  "ex_use_subscriber_bot": "🔄 \"Obunachi yig'ish\" bo'limi endi alohida botda ishlaydi. Davom etish uchun quyidagi tugmani bosing.",
  "ex_open_subscriber_bot_btn": "🔄 Obunachi yig'ish botini ochish",
  "ex_new_channel_announcement": "🆕 Yangi foydalanuvchi qo'shildi! Uning kanaliga (<b>{{title}}</b>) obuna bo'ling va {{multiplier}} ball qo'lga kiriting — har bir balingiz uchun kanalingizga 1 tadan obunachi avtomatik qo'shilaveradi.",
  "ex_browse_load_error": "⚠️ Kanallarni yuklashda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
  "ex_browse_empty": "📭 Hozircha taklif qilinadigan yangi kanal yo'q. Birozdan so'ng qayta urinib ko'ring.",
  "ex_browse_disabled_by_admin": "⏸ Kanallarga obuna bo'lish orqali obunachi yig'ish bo'limi admin tomonidan vaqtincha to'xtatilgan. Birozdan so'ng qayta urinib ko'ring.",
  "ex_browse_title": "📋 <b>Quyidagi kanallarga obuna bo'ling:</b>\n\n",
  "ex_open_btn": "🔗 Ochish: {{title}}",
  "ex_subscribed_btn": "✅ Obuna bo'ldim: {{title}}",
  "ex_confirm_all_btn": "✅ Men barchasiga obuna bo'ldim",
  "ex_next_page_btn": "➡️ Keyingi 10 ta kanal",
  "ex_confirm_all_session_expired": "⚠️ Tekshiriladigan ro'yxat topilmadi. Avval \"🔄 Obunachi yig'ish\" orqali kanallar ro'yxatini oching.",
  "ex_confirm_all_result_title": "📋 <b>Tekshiruv natijasi:</b>\n\n",
  "ex_confirm_all_confirmed_line": "✅ Tasdiqlandi: {{titles}}\n\n",
  "ex_confirm_all_pending_line": "⏳ Siz hali obuna bo'lmagansiz (obuna bo'lib, qayta tekshiring): {{titles}}\n\n",
  "ex_confirm_all_none_confirmed": "⚠️ Siz hali ro'yxatdagi kanallarning birortasiga ham obuna bo'lmagansiz. Avval obuna bo'ling, keyin qayta tekshiring.",
  "ex_channel_gone": "🚫 Bu kanal endi mavjud emas.",
  "ex_own_channel": "🙅‍♂️ Bu sizning o'z kanalingiz — o'zingizga obunachi sifatida yozila olmaysiz.",
  "ex_not_subscribed_yet": "⚠️ Siz hali \"{{title}}\" kanaliga obuna bo'lmagansiz. Avval obuna bo'ling, keyin tugmani bosing.",
  "ex_subscribe_confirmed": "✅ Rahmat! Obunangiz qayd etildi.",
  "ex_subscribe_success": "✅🎉 \"{{title}}\" kanaliga obunangiz qayd etildi. Rahmat!",
  "ex_invite_link_error": "❌ Bu yopiq taklif (invite) havolasi — bot orqali bunday havolani avtomatik tanib bo'lmaydi.\n\nIltimos, o'z KANALINGIZDAGI biror xabarni shu yerga <b>forward</b> qiling (uzatib yuboring) — bu har doim ishlaydi, kanal ochiq yoki yopiq bo'lishidan qat'iy nazar.",
  "ex_channel_not_understood": "🤔 Buni tushunmadim. Iltimos:\n• kanalingizdagi biror xabarni <b>forward</b> qiling, YOKI\n• kanalingiz username'ini <b>@</b> bilan yozing (masalan: @mening_kanalim), YOKI\n• kanalingiz havolasini yuboring (masalan: https://t.me/mening_kanalim), YOKI\n• bot allaqachon a'zo bo'lgan kanalning raqamli ID'sini yuboring (masalan: -1001234567890)",
  "ex_forward_not_channel": "❌ Bu shaxsiy chat yoki guruhdan forward qilingan xabar, kanaldan emas. Iltimos, o'z KANALINGIZDAGI xabarni forward qiling.",
  "ex_unnamed_channel": "Nomsiz kanal",
  "ex_chat_not_found": "❌ \"{{identifier}}\" nomli/ID'li kanal topilmadi. Username, havola yoki ID to'g'ri ekanini tekshiring, yoki kanal yopiq bo'lsa — forward usulidan foydalaning.",
  "ex_not_a_channel": "❌ Bu username kanalga emas, boshqa turdagi chatga tegishli. Faqat kanal qo'sha olasiz.",
  "ex_bot_not_member": "❌ Bot bu kanalga umuman a'zo emas. Avval botni kanalingizga <b>admin</b> qilib qo'shing (Kanal → Administratorlar → Admin qo'shish), keyin qayta urinib ko'ring.",
  "ex_bot_not_admin": "❌ Bot bu kanalda a'zo, lekin <b>admin emas</b>. Kanal sozlamalaridan botga admin huquqini bering, keyin qayta urinib ko'ring.",
  "ex_owner_status_unknown": "❌ Sizning ushbu kanaldagi holatingizni aniqlab bo'lmadi. Kanalda admin ekanligingizga ishonch hosil qiling.",
  "ex_owner_not_admin": "❌ Siz bu kanalda admin emassiz, shuning uchun uni qo'sha olmaysiz. Faqat kanal egasi yoki adminlari qo'sha oladi.",
  "ex_welcome_bonus_line": "\n\n🎉🎁 <b>Xush kelibsiz bonusi!</b> Botga birinchi marta kanal ulaganingiz uchun sizga darhol <b>{{bonus}} ta bonus ball</b> qo'shildi! 🥳",
  "ex_channel_added": "✅🚀 <b>{{title}}</b> kanali muvaffaqiyatli qo'shildi va navbatga qo'yildi!",
  "ex_channel_lost_access": "⚠️ <b>\"{{title}}\"</b> kanalingiz \"Obunachi yig'ish\" navbatidan vaqtincha chiqarildi — bot bu kanalda endi admin emas (yoki kanal topilmayapti).\n\nAgar botni tasodifan admin'likdan olib tashlagan bo'lsangiz, uni qayta admin qiling va kanalingizni qaytadan qo'shing — bu darhol navbatga qaytaradi.",
  "ex_hourly_join_report": "👥 So'nggi 1 soat ichida <b>\"{{title}}\"</b> kanalingizga bot orqali <b>{{count}} ta</b> yangi odam qo'shildi.",
  "ex_inactivity_reminder": "⏳ <b>\"{{title}}\"</b> kanalingiz \"Obunachi yig'ish\" navbatida sizga yangi ball olib kelmoqda — lekin siz so'nggi 24 soatda birorta ham kanalga obuna bo'lmadingiz.\n\nAlmashinuv ikki tomonlama ishlaydi: qanchalik ko'p kanalga obuna bo'lsangiz, sizning kanalingiz ham shunchalik tez navbatda oldinga siljiydi va tezroq yangi ball oladi. 2 daqiqa vaqt ajratib, bir nechta kanalga obuna bo'lib ko'ring 👇\n\n💡 <b>Yana bir yo'l:</b> do'stlaringizni taklif qiling! Har bir taklif qilgan odamingiz uchun bonus ball olasiz, ular esa o'z navbatida botni yana boshqalarga ulashishi mumkin — shu orqali kanalingiz tezroq ko'proq real obunachiga ega bo'ladi.",
  "ex_report_btn": "🚩 Shikoyat qilish",
  "ex_report_choose_reason": "🚩 Nima sababdan shikoyat qilmoqchisiz?",
  "ex_report_reason_spam": "📢 Spam / keraksiz reklama",
  "ex_report_reason_content": "🔞 Nomaqbul kontent",
  "ex_report_reason_scam": "🎭 Firibgarlik / aldov",
  "ex_report_reason_other": "✏️ Boshqa sabab",
  "ex_report_other_prompt": "✏️ Shikoyat sababini yozing (kamida 3 ta belgi):",
  "ex_report_reason_short": "⚠️ Sabab juda qisqa. Iltimos, batafsilroq yozing.",
  "ex_report_success": "✅ Shikoyatingiz qabul qilindi, admin ko'rib chiqadi. Rahmat!",
  "ex_report_already_sent": "ℹ️ Siz bu kanal haqida so'nggi 24 soat ichida allaqachon shikoyat qilgansiz.",
  "ex_referral_credited_notify": "🎉 <b>Tabriklaymiz!</b>\n\nSiz taklif qilgan do'stingiz botga o'z kanalini ulab, admin qildi — sizga <b>{{bonus}} ta bonus ball</b> qo'shildi! Buni sayt profilingizdagi \"Obuna almashish\" bo'limida ko'rishingiz mumkin.",
  "ex_credit_awarded_notify": "🎉 <b>Tabriklaymiz!</b>\n\n\"<b>{{title}}</b>\" kanaliga obuna bo'lganingiz uchun kanalingizga <b>{{multiplier}} ta ball</b> qo'shildi (kanalingiz navbatda qolmoqda, ko'rinish olishda davom etmoqda).\n\nℹ️ <i>\"Ball\" — botning ichki reyting/navbat hisobi, Telegramdagi haqiqiy obunachilar soni emas.</i>\n\n🚀 <b>Davom eting!</b> Yana boshqa kanallarga obuna bo'lsangiz, har birida yana {{multiplier}} ta ball qo'shilaveradi. Ball qancha ko'p bo'lsa, kanalingiz navbatda shuncha ko'p marta ko'rsatiladi — demak, sizga REAL obuna bo'ladigan odamlar soni ham shuncha oshadi.",
  "ex_credit_awarded_browse_btn": "📋 Yana kanal topish",
};

// Admin panelda ko'rsatiladigan kalitlar ro'yxati (BOT_MESSAGE_DEFAULTS
// bilan bir xil tartibda).
export const BOT_MESSAGE_KEY_ORDER: string[] = Object.keys(BOT_MESSAGE_DEFAULTS);

// Matndagi {{variable}} joy-tutuvchilarni topib qaytaradi (masalan
// "{{title}}" uchun "title"). Admin panelda "mavjud o'zgaruvchilar"
// eslatmasini ko'rsatish uchun ishlatiladi.
export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) found.add(m[1]);
  return Array.from(found);
}
