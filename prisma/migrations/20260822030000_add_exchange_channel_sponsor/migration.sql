-- YANGI (foydalanuvchi talabi — "sponsor kanal" navbat tizimi): sponsor
-- kanali endi ODDIY foydalanuvchi kanali kabi ExchangeChannel jadvaliga
-- qo'shiladi, lekin isSponsor=true bo'lsa /browse navbatida DOIM birinchi
-- chiqadi va avtomatik (kredit/lapse/health-check) sabab bilan hech qachon
-- navbatdan chiqarilmaydi — faqat admin qo'lda o'chirishi mumkin.

-- AlterTable
ALTER TABLE "ExchangeChannel" ADD COLUMN "isSponsor" BOOLEAN NOT NULL DEFAULT false;
