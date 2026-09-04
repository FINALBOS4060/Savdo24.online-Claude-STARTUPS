-- TUZATISH ("kredit qaytarib olinmaydi" muammosi): obunachi biror
-- kanalga obuna bo'lib kredit olgach, o'sha kanaldan chiqib ketsa,
-- berilgan kredit endi avtomatik qaytarib olinadi. Buning uchun har bir
-- ExchangeSubscription yozuvida qancha kredit berilgani va u qaytarib
-- olinganmi saqlanadi.

-- AlterTable
ALTER TABLE "ExchangeSubscription" ADD COLUMN "creditGrantedAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExchangeSubscription" ADD COLUMN "creditClawedBack" BOOLEAN NOT NULL DEFAULT false;
