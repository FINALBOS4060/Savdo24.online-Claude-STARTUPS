-- YANGI (foydalanuvchi talabi):
-- 1) "kredit oldi-yu, navbatga qaytmay qoldi" bugi tuzatildi — kanal
--    boshqa kanalga obuna bo'lib (yoki referal orqali) kredit olganda
--    isActive=false qilinganda endi ALOHIDA `suspendedDueToCreditEarned`
--    bayrog'i bilan belgilanadi (avval bunday holatlar suspendedDueToLapse
--    bilan ARALASHTIRILMAGANI uchun hech qanday avtomatik tiklanish
--    mantig'iga kirmasdi — faqat admin qo'lda "Qayta ishga tushirish"
--    bosgandagina tiklanardi). cron-jobs.ts'dagi yangi davriy vazifa buni
--    endi har 3 soatda avtomatik navbatga qaytaradi.
-- 2) "yangi foydalanuvchi qo'shildi" bildirishnomasi uchun
--    `newChannelAnnouncedAt` kursori — kanal boshqa (hali obuna bo'lmagan)
--    ishtirokchilarga bir marta e'lon qilingandan keyin belgilanadi.

-- AlterTable
ALTER TABLE "ExchangeChannel" ADD COLUMN "suspendedDueToCreditEarned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExchangeChannel" ADD COLUMN "newChannelAnnouncedAt" TIMESTAMP(3);
