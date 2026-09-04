-- YANGI: kanal egasiga har soatda "kanalingizga N ta odam qo'shildi"
-- degan bildirishnoma yuborish uchun kursor ustuni. Bu ustun oxirgi
-- marta shu bildirishnoma yuborilgan vaqtni saqlaydi — soatlik cron
-- shundan keyin qo'shilgan yangi obunalarnigina hisoblaydi (takroriy
-- xabar yubormaslik uchun).

-- AlterTable
ALTER TABLE "ExchangeChannel" ADD COLUMN "lastJoinNotifiedAt" TIMESTAMP(3);
