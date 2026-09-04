-- Bot foydalanuvchisining grammy session holatini DOIMIY saqlash uchun
-- (server.ts/context.ts orqali emas, telegram-integration.ts endpointlari
-- orqali o'qiladi/yoziladi). Ilgari sessiya faqat bot jarayoni xotirasida
-- (in-memory) saqlanardi va har bir PM2 restart/deploy'da butunlay
-- yo'qolib ketardi.

-- CreateTable
CREATE TABLE "TelegramBotSession" (
    "telegramUserId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramBotSession_pkey" PRIMARY KEY ("telegramUserId")
);
