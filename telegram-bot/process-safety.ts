// 🛡️ PROCESS DARAJASIDAGI XAVFSIZLIK TO'RI: ikkala bot processi
// (asosiy va "obunachi yig'ish") uchun BIR XIL — shu sabab bu yerda
// bitta joyda ta'riflanib, ikkalasida ham import qilinadi (DRY — xuddi
// gate mantig'i sponsor-gate.ts'ga chiqarilgani kabi).
//
// TUZATILDI (4-MASALA — uncaughtException'DAN KEYIN PROCESS "ZOMBI"
// HOLATIDA QOLARDI): avval `uncaughtException` faqat logger.error bilan
// yozilib, process hech narsa bo'lmagandek DAVOM ETAVERARDI. Node.js'ning
// o'zi buni tavsiya qilmaydi: `uncaughtException` yuz berganidan keyin
// process holati ISHONCHSIZ hisoblanadi (masalan biror modul o'rtada
// to'xtab qolgan, ichki holat/resurslar noaniq bo'lib qolgan bo'lishi
// mumkin) — uni shu holatda davom ettirish o'rniga BOSHQARILADIGAN
// tarzda qayta ishga tushirish tavsiya etiladi. Bu loyihada PM2
// (`ecosystem.config.cjs`) process `process.exit()` bilan chiqqanda uni
// AVTOMATIK qayta ko'taradi — shu sabab bu yerda endi xato to'liq log
// qilingandan so'ng, nazoratli tarzda `process.exit(1)` chaqiriladi.
//
// `unhandledRejection` uchun ESKI xatti-harakat ATAYLAB o'zgartirilmadi:
// kod bo'ylab ko'p joyda `ctx.reply(...)` `await`/`.catch()`siz
// chaqiriladi (masalan foydalanuvchi botni bloklagan bo'lsa, bu rad
// etiladi) — bu XATO emas, KUTILGAN va tez-tez uchraydigan holat, faqat
// Node.js 15+ uni sukut bo'yicha "halokatli" deb belgilagan. Buni
// `uncaughtException` bilan bir xil darajada halokatli deb hisoblab
// process'ni har safar to'xtatish — botni foydalanuvchi oddiy bloklashi
// bilan butun process qayta-qayta o'lib-tirilishiga olib kelardi. Shu
// sabab bu yerda faqat log qilinadi, process davom etadi (tub sabab —
// har joyga alohida .catch() qo'shish — bu bilan almashtirilmagan, bu
// eng arzon va zudlik bilan qo'yiladigan himoya).
import { logger } from "../src/lib/logger";

let shuttingDownForUncaughtException = false;

// Log yozuvi diskka/uzoq transportga yetib borishi uchun kutiladigan
// vaqt — logger asinxron bo'lishi mumkin, `process.exit()` darhol
// chaqirilsa yuqoridagi eng muhim log yozuvi yo'qolib qolishi mumkin.
const EXIT_DELAY_MS = 500;

export function registerProcessSafetyNets(label: string): void {
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, `🛡️ ${label}: ushlanmagan promise rad etilishi (process yiqilishining oldi olindi)`);
  });

  process.on("uncaughtException", (err) => {
    logger.error(
      { err },
      `🚨 ${label}: ushlanmagan sinxron xato — process ISHONCHSIZ holatda, boshqariladigan qayta ishga tushirish uchun to'xtatilmoqda (PM2 process'ni avtomatik qayta ko'taradi)`
    );
    // Ketma-ket bir necha uncaughtException kelib qolsa ham (masalan
    // xato hodisa ichida qayta yuz bersa), process.exit() FAQAT bir marta
    // chaqirilishi uchun himoyalanadi.
    if (shuttingDownForUncaughtException) return;
    shuttingDownForUncaughtException = true;
    // process.exit(1) — 0 EMAS — shu bilan PM2/monitoring buni
    // "muvaffaqiyatsiz tugash" deb belgilaydi va navbatdagi ishga
    // tushirishni kuzatib boradi (masalan tez-tez qulab tushsa,
    // PM2 crash-loop backoff qo'llaydi).
    setTimeout(() => process.exit(1), EXIT_DELAY_MS);
  });
}
