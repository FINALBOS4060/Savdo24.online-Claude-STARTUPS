-- TUZATISH ("adolatli ko'rinish"): kanal /browse orqali boshqalarga
-- nechi marta taklif qilinganini kuzatish uchun. Bu son EXCHANGE_MIN_
-- OFFERS_BEFORE_DEACTIVATE sozlamasi bilan birga ishlatilib, kanal
-- egasi boshqa kanalga obuna bo'lganida kredit olgani uchun DARHOL
-- navbatdan chiqarilishining oldini oladi — kanal kamida shu son marta
-- ko'rsatilmaguncha navbatda qoladi.

-- AlterTable
ALTER TABLE "ExchangeChannel" ADD COLUMN "timesOffered" INTEGER NOT NULL DEFAULT 0;
