# Xavfsizlik bo'yicha muhim eslatmalar (Security Notice)

## Telegram Bot Tokenini almashtirish zarurati

Avvalroq platformada mavjud bo'lgan xavfsizlik zaifligi tufayli (fayl yuklashda to'g'ridan-to'g'ri Telegram serverlariga redirect qilish) `TELEGRAM_BOT_TOKEN` brauzerning tarmoq panelida (Network panel / Location sarlavhasi) ochiq matn ko'rinishida oshkor bo'lgan bo'lishi mumkin.

### Zudlik bilan bajarilishi kerak bo'lgan amallar:

1. **Tokenni bekor qilish (Revoke):**
   - Telegram ilovasida **@BotFather** botiga kiring.
   - `/revoke` buyrug'ini yuboring.
   - Platformangizga ulangan botni tanlang. BotFather joriy tokenni bekor qiladi va yangi xavfsiz `TELEGRAM_BOT_TOKEN`ni generatsiya qilib beradi.

2. **Yangilash:**
   - Yangi tokenni platforma sozlamalarida (`.env` faylida va/yoki admin panel sozlamalarida) yangilang.
   - Serverni qayta ishga tushiring.

---

## Amalga oshirilgan xavfsizlik choralari

- **Fayl proksi-oqimi (Proxy Stream):** `/api/files/:fileId` marshruti endi Telegram manziliga redirect qilmaydi. Buning o'rniga, serverning o'zi orqa fonda so'rov yuboradi va olingan rasm yoki fayl oqimini (stream) xavfsiz tarzda foydalanuvchiga uzatadi.
- **Maxfiy maydonlar filtrlash (Public Selection):** Barcha foydalanuvchi ma'lumotlari so'raladigan joylarda `Prisma`ning `include` mexanizmi o'rniga qat'iy `select` doimiysi (`PUBLIC_USER_SELECT`) joriy qilindi. Bu orqali foydalanuvchining maxfiy maydonlari (`password`, `resetToken`, `verificationToken`, `telegramLinkCode`, `googleId` va h.k.) klientga hech qachon chiqib ketmaydi.
- **Avtomatik testlar:** Xavfsizlik choralarining to'g'ri ishlashini doimiy ravishda tekshirish uchun `tests/security.test.ts` testi yaratildi va muvaffaqiyatli integratsiya qilindi.
