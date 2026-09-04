-- "Bildirishnomalarni boshqarish (opt-out)" va "VIP/TOP muddati tugashi
-- haqida eslatma" so'rovlari uchun.
--
-- User.telegramBroadcastOptOut: true bo'lsa, admin broadcast/reklama
-- xabarlarini olmaydi (xarid/nizo kabi muhim xabarlar bunga bog'liq emas,
-- ular notifyUserTelegram() orqali har doim yuboriladi).
--
-- *ExpiryNotifiedAt / *ExpiredNotifiedAt maydonlari: VIP/TOP tugashiga
-- 1-2 kun qolganda va tugagandan keyin yuboriladigan eslatmalarni faqat
-- BIR MARTA yuborish uchun (soatlik/kunlik cron qayta-qayta chaqirsa ham
-- spam bo'lmasligi uchun).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "telegramBroadcastOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "vipExpiryNotifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "vipExpiredNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Startup" ADD COLUMN "topExpiryNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Startup" ADD COLUMN "topExpiredNotifiedAt" TIMESTAMP(3);
