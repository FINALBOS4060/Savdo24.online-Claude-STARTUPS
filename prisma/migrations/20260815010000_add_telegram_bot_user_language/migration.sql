-- Telegram bot foydalanuvchisining til tanlovini (uz/en) doimiy saqlash
-- uchun. Website "User" jadvalidan mustaqil, chunki ko'p bot
-- foydalanuvchisi saytdagi hisobini hech qachon ulamasligi mumkin.

-- CreateTable
CREATE TABLE "TelegramBotUser" (
    "telegramUserId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramBotUser_pkey" PRIMARY KEY ("telegramUserId")
);
