// Telegram bot uchun TO'G'RIDAN-TO'G'RI Postgres/SQLite ulanishi.
//
// MUHIM (QARORNING SABABI): Ilgari bot HAR BIR update uchun (sessiya
// o'qish/yozish, til olish) asosiy serverga HTTP (`fetch`) so'rovi
// yuborardi — bu har bir foydalanuvchi xabariga kamida 1-3 ta qo'shimcha
// tarmoq so'rovi qo'shardi va asosiy server sekinlashsa yoki vaqtincha
// javob bermasa, bot ham shu bilan birga sekinlashardi/nosoz bo'lardi.
//
// Bu fayl faqat ENG KO'P chaqiriladigan va HECH QANDAY qo'shimcha
// business-logika (bonus hisoblash, to'lov, bildirishnoma va h.k.)
// TALAB QILMAYDIGAN ikkita joy uchun — sessiya (TelegramBotSession) va
// til (TelegramBotUser) — botga o'z Prisma clientini beradi.
//
// ATAYLAB CHEKLANGAN: to'lov (handlers-payment.ts), exchange/bonus
// (exchange-service.ts, handlers-exchange.ts), profil statistikasi va
// h.k. HALI HAM asosiy serverga HTTP orqali murojaat qiladi — bu
// joylarda validatsiya, bildirishnoma yuborish va boshqa yon
// ta'sirlar (side effects) bor, ularni ikki joyda (bot + server)
// mustaqil qayta yozish ikkalasi orasida sinxronsizlik xavfini
// keltirib chiqaradi. Bu qatlamlarni keyinroq, alohida va ehtiyotkorlik
// bilan ko'chirish kerak.
//
// src/lib/context.ts'dagi PG/SQLite tanlash mantig'i bilan BIR XIL —
// asosiy sabab shu yerda ham takrorlangan: DATABASE_URL "postgres" bilan
// boshlansa PostgreSQL, aks holda mahalliy SQLite ishlatiladi.
import { PrismaClient as PGClient } from "@prisma/client";
import path from "path";
import { createRequire } from "module";
import { logger } from "../src/lib/logger";

const _require = typeof require !== "undefined" ? require : createRequire(import.meta.url);

export const isPostgres = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"));

if (process.env.NODE_ENV === "production" && !isPostgres) {
  logger.warn(
    "⚠️ OGOHLANTIRISH (telegram-bot/db.ts): Production muhitida DATABASE_URL to'g'ri PostgreSQL ulanish satri bilan sozlanmagan! SQLite ulanishidan foydalaniladi."
  );
}

// ecosystem.config.cjs'da ikkala process (savdo24 va telegram-bot) ham
// cwd: __dirname (repo ildizi) bilan ishga tushiriladi — shu sababli bu
// yerda ham process.cwd() xuddi src/lib/context.ts'dagidek ildizga
// ko'rsatadi deb ishonch bilan foydalanish mumkin.
//
// TUZATILDI (TIP XAVFSIZLIGI): avval bu klient generatsiya vaqtida
// aniqlanmagani uchun (`_require(...)` — dinamik `require`, natijasi
// har doim `any`) `prisma` o'zgaruvchisi ham `any` deb e'lon qilingan
// edi. Bu esa uni ishlatuvchi BARCHA fayllarda (i18n.ts, session-store.ts
// va shu faylning o'zida) TypeScript'ning maydon nomi xatolarini
// (masalan `prisma.telegramBotSesion` kabi yozuv xatosi) compile
// vaqtida topib berish qobiliyatini butunlay o'chirib qo'yardi — xato
// faqat runtime'da, production'da chiqib qolardi.
//
// SQLite klienti alohida sxemadan (`prisma/schema.sqlite.prisma`)
// generatsiya qilingani uchun uning ANIQ tipi build vaqtida mavjud
// emas (fayl `src/generated/sqlite-client` — .gitignore'da, faqat
// `prisma generate` ishga tushgandan keyin paydo bo'ladi), shu sabab
// uni to'liq typed qilib bo'lmaydi. LEKIN ikkala sxema (schema.prisma
// va schema.sqlite.prisma) HAR DOIM BIR XIL modellarni (shu jumladan
// botga kerak bo'lgan TelegramBotUser/TelegramBotSession) bir xil
// maydon turlari bilan ta'riflaydi (yuqoridagi izohga qarang) — shuning
// uchun ikkala holatda ham natijaviy obyektni Postgres klienti tipiga
// (`PGClient`) xavfsiz cast qilish mumkin: bot faqat shu ikki model va
// $executeRawUnsafe/$queryRaw/$disconnect'dan foydalanadi, ular esa
// ikkala generatsiyada bir xil.
// TUZATILDI (TUSHUNARSIZ ISHGA TUSHISH XATOSI): avval bu yerda
// `_require(...)` to'g'ridan-to'g'ri, hech qanday o'rovsiz chaqirilardi.
// Agar `src/generated/sqlite-client` hali generatsiya qilinmagan bo'lsa
// (masalan production build'da `prisma generate --schema=prisma/schema.sqlite.prisma`
// bosqichi o'tkazib yuborilgan yoki muvaffaqiyatsiz tugagan bo'lsa), Node
// bu yerda xom, tushunarsiz "Cannot find module
// '.../src/generated/sqlite-client/index.js'" xatosini tashlardi — bu
// bot-instance.ts'dagi `createBot()` xato xabarlaridan farqli o'laroq,
// haqiqiy sababni (qaysi buyruq bajarilmagani) ko'rsatmasdi, PM2 esa buni
// cheksiz qayta ishga tushirishga (restart loop) urinardi.
//
// Endi xuddi createBot()dagi kabi: xato ANIQ tushuntirish va aniq YECHIM
// (qaysi buyruqni bajarish kerakligi) bilan birga log qilinadi, so'ng
// process darhol (tushunarsiz stack-trace bilan qayta-qayta qulashi
// o'rniga) to'xtatiladi.
// TUZATILDI (LAZY INIT — TESTLASH VA IMPORT XAVFSIZLIGI): avval yuqoridagi
// SQLite `_require(...)` va pastdagi `new PGClient()`/`new SQLiteClient()`
// MODUL YUKLANGANDA (import vaqtida) DARHOL bajarilardi — ya'ni shu faylni
// (yoki uni bilvosita import qiluvchi i18n.ts/format.ts kabi "sof" fayllarni)
// import qilishning O'ZI, `prisma`ning birorta metodi hech qachon
// chaqirilmasa ham, quyidagilarga olib kelishi mumkin edi:
//   • SQLite generatsiya qilinmagan bo'lsa — `process.exit(1)` (!) — butun
//     process yiqiladi, faqat shu faylni import qilgani uchun;
//   • Postgres client generatsiya/engine muammosi bo'lsa — import xato
//     tashlaydi (`ERR_MODULE_NOT_FOUND` yoki engine checksum xatosi).
// Bu ikkalasi ham `format.ts`dagi o'z izohi bilan ("hech qanday bot/sessiya
// holatiga ega emas ... shu sabab testlash oson") ziddiyatda edi — DB
// bog'lanishisiz oddiy `escapeHtml()`ni testlash uchun ham ishlaydigan
// Postgres/SQLite ulanishi kerak bo'lib qolardi.
//
// Endi client LAZY (kechiktirilgan) — faqat birinchi HAQIQIY chaqiruvda
// (masalan `prisma.telegramBotSession.findUnique(...)`) yaratiladi. Ishlab
// chiqarishdagi xatti-harakat AYNAN bir xil qoladi (xato xabari, log,
// process.exit — barchasi saqlanib qolgan, faqat endi "import vaqtida"
// emas, "birinchi ishlatilganda" ishga tushadi); farq faqat shundaki, DB'ga
// umuman murojaat qilmaydigan sof funksiyalarni (format.ts, i18n.ts'dagi
// `t()`) ishlatish/testlash uchun endi ishlaydigan DB shart emas.
let cachedClient: PGClient | null = null;

function createClient(): PGClient {
  if (isPostgres) {
    return new PGClient();
  }

  let SQLiteClient: (new (...args: unknown[]) => unknown) | null = null;
  try {
    SQLiteClient = _require(path.join(process.cwd(), "src/generated/sqlite-client/index.js")).PrismaClient;
  } catch (err) {
    logger.error(
      { err },
      "SQLite Prisma klientini yuklab bo'lmadi (src/generated/sqlite-client topilmadi). " +
        "Buni tuzatish uchun: `npx prisma generate --schema=prisma/schema.sqlite.prisma` buyrug'ini " +
        "ishga tushiring, so'ng botni qayta ishga tushiring. (Yoki agar Postgres ishlatmoqchi bo'lsangiz, " +
        "DATABASE_URL'ni \"postgres://...\" bilan boshlanadigan qiymatga sozlang.)"
    );
    process.exit(1);
  }

  return new (SQLiteClient!)({
    datasources: {
      db: {
        url: "file:./dev.db"
      }
    }
  }) as PGClient;
}

function getClient(): PGClient {
  if (!cachedClient) {
    cachedClient = createClient();
    process.on("beforeExit", async () => {
      try {
        await cachedClient!.$disconnect();
      } catch {
        // e'tiborsiz qoldiriladi — process baribir yopilyapti
      }
    });
  }
  return cachedClient;
}

// `prisma.telegramBotSession.findUnique(...)`, `prisma.$queryRaw` va h.k.
// kabi barcha mavjud chaqiruv shakllari o'zgarishsiz ishlashda davom etishi
// uchun (bitta lazy getter funksiya emas, xuddi asl "obyekt" ko'rinishidagi
// eksport) — Proxy orqali har bir maydonga murojaat qilinganda haqiqiy
// client shu yerda (agar hali yaratilmagan bo'lsa) birinchi marta yaratiladi.
export const prisma: PGClient = new Proxy({} as PGClient, {
  get(_target, prop, receiver) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop as string];
    return typeof value === "function" ? value.bind(client) : value;
  }
});

// ─────────────────────────────────────────────────────────────────────────
// RATE-LIMIT JADVALI (cluster-safe): ilgari rate-limit.ts hisobni faqat
// process-xotirasidagi Map'da saqlardi — bu bitta PM2 instance (hozirgi
// ecosystem.config.cjs'da `instances: 1`) uchun to'g'ri ishlaydi, LEKIN
// kimdir kelajakda `instances`ni oshirsa (cluster rejimi), har bir
// instance o'z alohida hisobini yuritib, cheklov amalda ishlamay qoladi
// — chunki bitta foydalanuvchining so'rovlari turli instance'larga tarqalib
// ketishi mumkin.
//
// Bu yerda shu hisob endi BAZADA (barcha instance'lar uchun UMUMIY)
// saqlanadi — schema.prisma'da alohida model qo'shish (va shu bilan
// migratsiya talab qilish) o'rniga, jadval o'zi birinchi ishlatilganda
// avtomatik (`CREATE TABLE IF NOT EXISTS`) yaratiladi — Postgres'da ham,
// SQLite'da ham ishlaydigan oddiy sintaksis bilan.
//
// FAIL-OPEN QOIDASI: agar bu so'rov biror sababdan (jadval hali
// yaratilmagan, baza vaqtincha javob bermayapti va h.k.) xato bersa,
// so'rov CHEKLANMAGAN deb hisoblanadi (rate-limit.ts'da qaraladi) — bu
// spam-himoyaning vaqtincha ishlamay qolishidan ko'ra, botning butunlay
// to'xtab qolishi ancha yomonroq oqibat bo'lgani uchun ataylab shunday.
let rateLimitTableReady: Promise<void> | null = null;

export function ensureRateLimitTable(): Promise<void> {
  if (!rateLimitTableReady) {
    rateLimitTableReady = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS telegram_rate_limit (
           user_id TEXT PRIMARY KEY,
           window_start BIGINT NOT NULL,
           count INTEGER NOT NULL
         )`
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        logger.warn({ err }, "telegram_rate_limit jadvalini yaratishda xatolik");
        // Keyingi chaqiruvda qayta urinib ko'rish uchun keshni tozalaymiz.
        rateLimitTableReady = null;
        throw err;
      });
  }
  return rateLimitTableReady;
}

// Bitta foydalanuvchi uchun hisobni ATOMIK ravishda oshiradi va shu
// oynadagi joriy sonini qaytaradi. `windowStart > cutoff` bo'lsa (ya'ni
// oldingi oyna hali "yangi" bo'lsa) hisob +1 qilinadi, aks holda 1'dan
// qayta boshlanadi — bu xuddi eski in-memory mantiq bilan bir xil,
// faqat endi barcha instance'lar orasida umumiy va atomik (bir vaqtda
// kelgan ikkita so'rov bir-birini "yutib qo'ymaydi").
export async function incrementRateLimitCounter(
  userId: string,
  now: number,
  windowMs: number
): Promise<number> {
  await ensureRateLimitTable();
  const cutoff = now - windowMs;
  const rows: { count: number | bigint }[] = await prisma.$queryRaw`
    INSERT INTO telegram_rate_limit (user_id, window_start, count)
    VALUES (${userId}, ${now}, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      count = CASE WHEN telegram_rate_limit.window_start > ${cutoff} THEN telegram_rate_limit.count + 1 ELSE 1 END,
      window_start = CASE WHEN telegram_rate_limit.window_start > ${cutoff} THEN telegram_rate_limit.window_start ELSE ${now} END
    RETURNING count
  `;
  return Number(rows[0]?.count ?? 1);
}
