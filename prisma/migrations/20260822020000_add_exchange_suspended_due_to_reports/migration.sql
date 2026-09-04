-- YANGI (foydalanuvchi talabi): kanalga kamida 2 ta TURLI foydalanuvchi
-- shikoyat qilsa, kanal odamlarga vaqtinchalik ko'rsatilmay qo'yiladi
-- (isActive=false) va admin panelida "Shikoyat tufayli" deb alohida
-- belgilanadi (blockedByAdmin'dan farqli — admin hali ko'rib chiqmagan).

-- AlterTable
ALTER TABLE "ExchangeChannel" ADD COLUMN "suspendedDueToReports" BOOLEAN NOT NULL DEFAULT false;
