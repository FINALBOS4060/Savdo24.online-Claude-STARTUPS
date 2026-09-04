-- Obuna almashish ("obunachi yig'ish") tizimiga REFERAL qo'shildi:
-- kim kimni taklif qilgani (ExchangeReferral) va shu orqali yig'ilgan
-- bonus obunachilar (ExchangeReferralCredit) saqlanadi.

-- CreateTable
CREATE TABLE "ExchangeReferral" (
    "id" SERIAL NOT NULL,
    "referrerTelegramId" TEXT NOT NULL,
    "refereeTelegramId" TEXT NOT NULL,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeReferralCredit" (
    "ownerTelegramId" TEXT NOT NULL,
    "bonusSubscribers" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeReferralCredit_pkey" PRIMARY KEY ("ownerTelegramId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeReferral_refereeTelegramId_key" ON "ExchangeReferral"("refereeTelegramId");

-- CreateIndex
CREATE INDEX "ExchangeReferral_referrerTelegramId_idx" ON "ExchangeReferral"("referrerTelegramId");
