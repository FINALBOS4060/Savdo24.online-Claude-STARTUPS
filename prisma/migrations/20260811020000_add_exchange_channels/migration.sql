-- Obuna almashish tizimi: foydalanuvchilar o'z kanallarini qo'shadi
-- (ExchangeChannel), bot ularni navbat asosida boshqalarga taklif qiladi
-- va kimga obuna bo'lganini kuzatadi (ExchangeSubscription). Bu
-- SponsorChannel'dan mustaqil — admin nazoratidagi majburiy obunalarga
-- hech qanday aloqasi yo'q.

-- CreateTable
CREATE TABLE "ExchangeChannel" (
    "id" SERIAL NOT NULL,
    "ownerTelegramId" TEXT NOT NULL,
    "ownerUsername" TEXT,
    "channelId" TEXT NOT NULL,
    "channelUsername" TEXT,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "suspendedReason" TEXT,
    "suspendedDueToLapse" BOOLEAN NOT NULL DEFAULT false,
    "lastOfferedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeSubscription" (
    "id" SERIAL NOT NULL,
    "subscriberTelegramId" TEXT NOT NULL,
    "channelId" INTEGER NOT NULL,
    "isCurrentMember" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeChannel_ownerTelegramId_channelId_key" ON "ExchangeChannel"("ownerTelegramId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeSubscription_subscriberTelegramId_channelId_key" ON "ExchangeSubscription"("subscriberTelegramId", "channelId");

-- AddForeignKey
ALTER TABLE "ExchangeSubscription" ADD CONSTRAINT "ExchangeSubscription_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ExchangeChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
