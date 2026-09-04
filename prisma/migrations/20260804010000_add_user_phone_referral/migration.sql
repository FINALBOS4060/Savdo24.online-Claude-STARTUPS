-- Ro'yxatdan o'tish formasiga telefon raqami va referral kod maydonlari
-- qo'shildi. signupReferralCode faqat ro'yxatdan o'tish vaqtida kiritilgan
-- xom kodni saqlab qoladi (hisob-kitob/chegirma mantig'i hali ham xarid
-- vaqtida Referral jadvali orqali amalga oshadi).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "signupReferralCode" TEXT;
