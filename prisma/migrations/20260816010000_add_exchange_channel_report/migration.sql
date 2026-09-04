-- YANGI (foydalanuvchi talabi): "Obunachi yig'ish" bo'limida taklif
-- qilinayotgan kanallardan shikoyat qilish imkoniyati — bot orqali
-- foydalanuvchi biror kanalni (masalan spam yoki nomaqbul kontent
-- uchun) shikoyat qilsa, shu yerga yoziladi va admin darhol Telegram
-- orqali xabardor qilinadi.

-- CreateTable
CREATE TABLE "ExchangeChannelReport" (
    "id" SERIAL NOT NULL,
    "channelId" INTEGER NOT NULL,
    "reporterTelegramId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeChannelReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeChannelReport_channelId_idx" ON "ExchangeChannelReport"("channelId");

-- AddForeignKey
ALTER TABLE "ExchangeChannelReport" ADD CONSTRAINT "ExchangeChannelReport_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ExchangeChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
