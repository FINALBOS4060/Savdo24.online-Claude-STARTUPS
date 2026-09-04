-- Admin ExchangeChannel'larni qo'lda bloklashi mumkin bo'lishi uchun.
-- blockedByAdmin=true bo'lgan kanal report-check'dagi avtomatik tiklash
-- mantig'i (suspendedDueToLapse) tomonidan HECH QACHON qayta
-- faollashtirilmaydi — faqat admin o'zi blokdan chiqarganda tiklanadi.

-- AlterTable
ALTER TABLE "ExchangeChannel" ADD COLUMN "blockedByAdmin" BOOLEAN NOT NULL DEFAULT false;
