-- TUZATISH: obunachi krediti endi kanal egasiga emas, balki OBUNA
-- BO'LGAN ODAMNING O'Z kanaliga hisoblanadi (masalan: Erik Alex
-- kanaliga obuna bo'lsa, 2 ta kredit Erikning kanaliga yoziladi).
-- Shu sabab bu qiymat endi to'g'ridan-to'g'ri saqlanadi.

-- AlterTable
ALTER TABLE "ExchangeChannel" ADD COLUMN "earnedSubscribers" INTEGER NOT NULL DEFAULT 0;
