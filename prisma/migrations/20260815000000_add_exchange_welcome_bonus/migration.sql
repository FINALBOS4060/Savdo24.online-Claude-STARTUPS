-- "Xush kelibsiz bonusi": foydalanuvchi botga ilk marta o'z kanalini
-- ulaganida bir martalik 5 ta obunachi mukofoti berilishi uchun.
-- Bu jadval faqat "kimga allaqachon berilgan" belgisini doimiy saqlaydi
-- (ExchangeChannel o'chirilib qayta qo'shilsa ham qayta berilmasligi uchun).

-- CreateTable
CREATE TABLE "ExchangeWelcomeBonus" (
    "ownerTelegramId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeWelcomeBonus_pkey" PRIMARY KEY ("ownerTelegramId")
);
