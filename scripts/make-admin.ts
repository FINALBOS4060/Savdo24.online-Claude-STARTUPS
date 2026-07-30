import { PrismaClient as PGClient } from "@prisma/client";
import { PrismaClient as SQLiteClient } from "../src/generated/sqlite-client/index.js";
import dotenv from "dotenv";

dotenv.config();

const isPostgres = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"));
const prisma: any = isPostgres 
  ? new PGClient() 
  : new SQLiteClient({
      datasources: {
        db: {
          url: "file:./dev.db"
        }
      }
    });

async function main() {
  const rawEmail = process.argv[2];

  if (!rawEmail) {
    console.error("Xatolik: Iltimos, foydalanuvchi email manzilini kiriting.");
    console.log("Foydalanish: npx tsx scripts/make-admin.ts <email_address>");
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase();

  console.log(`Foydalanish ma'lumotlar bazasi turi: ${isPostgres ? "PostgreSQL" : "SQLite"}`);
  console.log(`Email bo'yicha foydalanuvchi qidirilmoqda: ${email}`);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`Xatolik: '${email}' email manzilli foydalanuvchi topilmadi.`);
      process.exitCode = 1;
      return;
    }

    console.log(`Foydalanish: Foydalanuvchi topildi - ${user.name} (Hozirgi roli: ${user.role})`);

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: "Admin" },
    });

    console.log(`Muvaffaqiyatli: ${updatedUser.name} roli muvaffaqiyatli 'Admin' qilib o'zgartirildi!`);
  } catch (error) {
    console.error("Xatolik yuz berdi:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
