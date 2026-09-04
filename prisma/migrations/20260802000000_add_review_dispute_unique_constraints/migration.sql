-- 132-bosqich: Review va Dispute jadvallarida "avval tekshir (findFirst),
-- keyin yarat (create)" naqshi ilova darajasida ishlatilgan, lekin
-- IdeaVote/Report/Conversation'dan farqli o'laroq bazada mos @@unique
-- cheklovi yo'q edi. Bu ikkita AYNAN bir vaqtda kelgan so'rov (masalan
-- foydalanuvchi tugmani ikki marta bosib yuborsa) uchun dublikat sharh
-- yoki dublikat nizo yaratilishiga yo'l qo'yardi (poyga holati / race
-- condition). Bu migratsiya faqat QO'SHADI (hech narsani o'chirmaydi yoki
-- o'zgartirmaydi) — mavjud indekslarga tegmaydi.
--
-- DIQQAT (production'ga qo'llashdan oldin albatta o'qing):
-- Agar bazada allaqachon dublikat qatorlar mavjud bo'lsa (masalan bitta
-- xaridor bitta loyihaga ikkita sharh qoldirgan bo'lsa), quyidagi
-- CREATE UNIQUE INDEX buyrug'i xato bilan to'xtaydi. Bu holatda avval
-- dublikatlarni qo'lda tozalash (yoki qaysi yozuvni saqlab qolishni
-- tanlash) kerak bo'ladi, so'ng migratsiyani qayta ishga tushiring.

-- CreateIndex
CREATE UNIQUE INDEX "Review_startupId_buyerId_key" ON "Review"("startupId", "buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_paymentId_key" ON "Dispute"("paymentId");
