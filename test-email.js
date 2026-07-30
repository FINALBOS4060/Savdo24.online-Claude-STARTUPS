// SMTP sozlamalarini tekshirish uchun qo'lda ishga tushiriladigan skript.
// MUHIM: endi src/lib/crypto.ts (TypeScript)ni import qiladi — oddiy `node`
// buni ishga tushira olmaydi, shuning uchun loyihadagi boshqa skriptlar kabi
// tsx orqali ishga tushiriladi: npx tsx test-email.js <qabul_qiluvchi@email.com>
import "dotenv/config";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "./src/lib/crypto";

const to = process.argv[2];
if (!to) {
  console.error("Foydalanish: npx tsx test-email.js <qabul_qiluvchi@email.com>");
  process.exit(1);
}

// MUHIM: server.ts'dagi haqiqiy getTransporter() avval DB'dagi Sozlamalar
// panelidan (Setting jadvali, shifrlangan) o'qiydi, faqat topilmasa .env'ga
// qaraydi. Bu skript avval faqat .env'ni tekshirardi — agar admin SMTP'ni
// faqat Sozlamalar panelidan kiritgan bo'lsa, skript noto'g'ri ravishda
// "sozlanmagan" deb xato bergan bo'lardi. Endi DB ham tekshiriladi.
const prisma = new PrismaClient();
async function getSetting(key) {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (row) {
      try {
        return decryptSecret(row.value);
      } catch {
        return row.value;
      }
    }
  } catch {
    // Setting jadvali hali mavjud bo'lmasligi mumkin
  }
  return process.env[key] || null;
}

const service = await getSetting("SMTP_SERVICE");
const host = await getSetting("SMTP_HOST");
const port = parseInt((await getSetting("SMTP_PORT")) || "587");
const user = await getSetting("SMTP_USER");
const pass = await getSetting("SMTP_PASS");
await prisma.$disconnect();

const transporter = service
  ? nodemailer.createTransport({ service, auth: { user, pass } })
  : nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });

try {
  await transporter.verify();
  console.log("SMTP ulanishi muvaffaqiyatli.");
  await transporter.sendMail({
    from: '"Savdo24" <noreply@savdo24.online>',
    to,
    subject: "Savdo24 test xati",
    html: "<p>Bu SMTP sozlamalarini tekshirish uchun test xati.</p>",
  });
  console.log(`Test xati ${to} manziliga yuborildi.`);
} catch (err) {
  console.error("SMTP xatosi:", err.message);
  process.exit(1);
}
