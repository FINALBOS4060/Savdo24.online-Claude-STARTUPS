-- YANGI: broadcast (ommaviy xabar) tarixi. Ilgari natija faqat frontend
-- local state'da turardi (sahifa yangilansa yo'qolardi) va audit logda
-- faqat statistika saqlanib, xabar matnining o'zi hech qayerda
-- saqlanmasdi. Endi har bir broadcast so'rov boshlangan zahoti shu
-- jadvalga "running" holatida yoziladi va yakunda "done" qilinadi —
-- shu bilan admin panelida to'liq tarixni (kim, qachon, nima matn,
-- nechta yuborilgan) ko'rish mumkin bo'ladi, va server qayta ishga
-- tushib qolsa ham (masalan deploy) job butunlay yo'qolib qolmaydi.

-- CreateTable
CREATE TABLE "BroadcastMessage" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "adminId" INTEGER,
    "adminEmail" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastMessage_adminId_idx" ON "BroadcastMessage"("adminId");

-- CreateIndex
CREATE INDEX "BroadcastMessage_startedAt_idx" ON "BroadcastMessage"("startedAt");

-- AddForeignKey
ALTER TABLE "BroadcastMessage" ADD CONSTRAINT "BroadcastMessage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
