-- Foydalanuvchilar endi yangi kategoriya taklif qilishi mumkin, ammo u
-- admin tasdiqlaguncha ommaviy ro'yxatda ko'rinmaydi ("pending" holatda
-- turadi). Admin o'zi yaratgan kategoriyalar darhol "active" bo'lib qoladi.

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Category" ADD COLUMN "proposedByUserId" INTEGER;
ALTER TABLE "Category" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Category_status_idx" ON "Category"("status");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
