// Admin panel: saytni qayta build qilish (frontend + backend) va, alohida
// amal sifatida, serverni qayta ishga tushirish. Ikkalasi ATAYLAB alohida
// endpoint — build o'zi (vite build + esbuild) joriy ishlab turgan serverga
// hech qanday xavf tug'dirmaydi (natijalar shunchaki disk/`dist` papkasiga
// yoziladi, frontend statik fayllar Express orqali xotiraga yuklanmasdan,
// har bir so'rovda diskdan o'qilgani uchun YANGILANGAN frontend darhol,
// hech qanday to'xtashsiz jonli bo'ladi). Serverni qayta ishga tushirish esa
// (backend kodidagi o'zgarishlar kuchga kirishi uchun zarur) qisqa vaqtga
// (bir necha soniya) saytni vaqtincha to'xtatadi — shuning uchun frontendda
// alohida, aniq ogohlantirish/tasdiqlash bilan chaqiriladi.
import { Router, Response } from "express";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import {
  prisma,
  authenticateToken,
  requireAdmin,
  AuthRequest
} from "../lib/context";
import { logger } from "../lib/logger";
import { rebuildLimiter } from "../lib/rateLimiters";

const execFileAsync = promisify(execFile);
const router = Router();

// Bir vaqtning o'zida faqat bitta build ishlashi kerak — ikkita admin
// (yoki bitta admin ikki marta bosib yuborsa) parallel `npm run build`
// ishga tushirsa, ikkalasi ham bir xil `dist/` papkaga yozib, bir-birining
// natijasini buzishi yoki server resurslarini keraksiz ikki barobar
// yeyishi mumkin.
let isBuildRunning = false;

const MAX_BUILD_OUTPUT_CHARS = 20000;
const BUILD_TIMEOUT_MS = 6 * 60 * 1000; // 6 daqiqa (prisma generate x2 + vite build + esbuild)

function appendCapped(buffer: string, chunk: string): string {
  const combined = buffer + chunk;
  return combined.length > MAX_BUILD_OUTPUT_CHARS
    ? combined.slice(combined.length - MAX_BUILD_OUTPUT_CHARS)
    : combined;
}

// POST /api/admin/rebuild — `npm run build`ni ishga tushiradi (frontend +
// backend bundle). Serverni QAYTA ISHGA TUSHIRMAYDI — faqat `dist/`ni
// yangilaydi. Frontend o'zgarishlari darhol jonli bo'ladi; backend
// o'zgarishlari uchun alohida POST /api/admin/rebuild/restart kerak.
router.post("/", authenticateToken, requireAdmin, rebuildLimiter, async (req: AuthRequest, res: Response) => {
  if (isBuildRunning) {
    return res.status(409).json({ error: "Build allaqachon ishlamoqda. Iltimos, u tugashini kuting." });
  }

  isBuildRunning = true;
  const startedAt = Date.now();
  let output = "";
  let timedOut = false;

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      // `npm run build`: package.json'dagi buyruq — prisma generate (ikkala
      // schema uchun) + vite build + esbuild server bundle. Shell orqali
      // emas, argument massivi bilan ishga tushiriladi (buyruq
      // in'yeksiyasidan himoya — bu yerda foydalanuvchi kiritgan hech qanday
      // qiymat yo'q, lekin loyihadagi boshqa joylar (admin-backup.ts) bilan
      // bir xil xavfsiz naqsh saqlanadi).
      const child = spawn("npm", ["run", "build"], {
        cwd: process.cwd(),
        env: process.env
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, BUILD_TIMEOUT_MS);

      child.stdout.on("data", (chunk: Buffer) => {
        output = appendCapped(output, chunk.toString());
      });
      child.stderr.on("data", (chunk: Buffer) => {
        output = appendCapped(output, chunk.toString());
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code ?? 1);
      });
    });

    const durationMs = Date.now() - startedAt;

    if (timedOut) {
      logger.error({ durationMs }, "Admin rebuild: timeout");
      return res.status(500).json({
        error: "Build vaqt chegarasidan oshib ketdi va to'xtatildi.",
        output
      });
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: exitCode === 0 ? "rebuild_success" : "rebuild_failed",
        details: `npm run build — exit code ${exitCode}, ${Math.round(durationMs / 1000)}s`
      }
    }).catch((e: unknown) => logger.error({ err: e }, "Audit log error (rebuild)"));

    if (exitCode !== 0) {
      logger.error({ exitCode, durationMs }, "Admin rebuild: build failed");
      return res.status(500).json({
        error: "Build muvaffaqiyatsiz tugadi. Quyidagi logdan sababini tekshiring.",
        output,
        durationMs
      });
    }

    logger.info({ adminId: req.user?.id, durationMs }, "Admin rebuild: build muvaffaqiyatli");
    res.json({
      success: true,
      message: "Build muvaffaqiyatli yakunlandi. Frontend o'zgarishlari darhol jonli bo'ladi. Backend (server) o'zgarishlari kuchga kirishi uchun serverni qayta ishga tushirish kerak.",
      output,
      durationMs
    });
  } catch (err: unknown) {
    logger.error({ err }, "Admin rebuild error");
    res.status(500).json({ error: "Build ishga tushirishda xatolik yuz berdi.", output });
  } finally {
    isBuildRunning = false;
  }
});

// POST /api/admin/rebuild/restart — joriy serverni qayta ishga tushiradi
// (PM2 orqali). MUHIM: bu bir necha soniyaga saytni vaqtincha to'xtatadi —
// shuning uchun frontendda alohida, aniq tasdiqlash talab qilinadi.
// PM2 ishlatilmaydigan muhitlarda (masalan Render'ning o'z buildpack
// jarayoni, yoki `npm run dev`) bu buyruq muvaffaqiyatsiz tugaydi — bu
// kutilgan holat, xato sifatida qaytariladi, server hech narsa qilmaydi.
//
// TUZATISH: bu tugma avval FAQAT asosiy server jarayonini ("savdo24")
// qayta ishga tushirardi. Nomi shunchaki "Serverni qayta ishga
// tushirish" bo'lgani uchun admin buni "hammasi (bot ham) qayta ishga
// tushadi" deb tushunishi tabiiy edi — lekin bot (telegram-bot/index.ts)
// PM2'da butunlay alohida jarayon bo'lgani sabab bu tugma unga umuman
// tegmasdi (masalan TELEGRAM_BOT_TOKEN'ni admin-settings.ts orqali emas,
// boshqa yo'l bilan — .env faylini qo'lda tahrirlab — o'zgartirgan admin
// shu tugmani bosib botni yangilanadi deb o'ylashi mumkin edi). Endi bu
// endpoint IKKALA PM2 jarayonini ham (topilgan bo'lsa) qayta ishga
// tushiradi va javobda aynan qaysi jarayon(lar) qayta ishga tushirilgani
// aniq ko'rsatiladi.
router.post("/restart", authenticateToken, requireAdmin, rebuildLimiter, async (req: AuthRequest, res: Response) => {
  const pm2AppName = process.env.PM2_APP_NAME || "savdo24";
  const pm2BotAppName = process.env.PM2_BOT_APP_NAME || "telegram-bot";

  try {
    // Avval PM2 ro'yxatida shu nomdagi jarayon bor-yo'qligini tekshiramiz —
    // aks holda `pm2 restart` yo'q jarayon uchun tushunarsiz xato beradi,
    // yoki (agar PM2 umuman o'rnatilmagan bo'lsa) butunlay ishlamaydi.
    await execFileAsync("pm2", ["describe", pm2AppName]);
  } catch (err: unknown) {
    logger.warn({ err, pm2AppName }, "Admin restart: PM2 topilmadi yoki jarayon mavjud emas");
    return res.status(400).json({
      error: `PM2 orqali "${pm2AppName}" nomli jarayon topilmadi. Bu muhitda (masalan Render yoki dev rejimida) avtomatik qayta ishga tushirish mavjud emas — serverni qo'lda (hosting platformangiz orqali) qayta ishga tushiring.`
    });
  }

  // Bot jarayoni ixtiyoriy — topilmasa asosiy server baribir qayta
  // ishga tushadi, faqat javobda buni aniq aytamiz (jim qolmaymiz).
  let botFound = false;
  try {
    await execFileAsync("pm2", ["describe", pm2BotAppName]);
    botFound = true;
  } catch (err: unknown) {
    logger.warn({ err, pm2BotAppName }, "Admin restart: PM2 orqali 'telegram-bot' jarayoni topilmadi — faqat asosiy server qayta ishga tushiriladi");
  }

  await prisma.auditLog.create({
    data: {
      adminId: req.user?.id || 0,
      adminEmail: req.user?.email,
      action: "server_restart",
      details: `Admin panel orqali qayta ishga tushirildi (PM2: ${pm2AppName}${botFound ? ", " + pm2BotAppName : ""})`
    }
  }).catch((e: unknown) => logger.error({ err: e }, "Audit log error (restart)"));

  logger.info({ adminId: req.user?.id, pm2AppName, pm2BotAppName, botFound }, "Admin restart: qayta ishga tushirilmoqda");

  // Javobni avval yuboramiz, keyingina qayta ishga tushiramiz — aks holda
  // admin hech qanday tasdiqlovchi javob olmasdan (so'rov o'rtada uzilib)
  // "xato bo'ldimi?" deb qolishi mumkin edi. Kichik kechikish (500ms)
  // javobning brauzerga yetib borishi uchun yetarli vaqt beradi.
  res.json({
    success: true,
    message: botFound
      ? "Server VA bot jarayoni (telegram-bot) bir necha soniyada qayta ishga tushadi. Sahifa vaqtincha javob bermasligi mumkin."
      : `Server bir necha soniyada qayta ishga tushadi. Sahifa vaqtincha javob bermasligi mumkin. DIQQAT: PM2'da "${pm2BotAppName}" jarayoni topilmadi — bot QAYTA ISHGA TUSHIRILMADI, uni alohida qo'lda qayta ishga tushiring.`
  });

  setTimeout(() => {
    execFileAsync("pm2", ["restart", pm2AppName]).catch((err) => {
      logger.error({ err, pm2AppName }, "Admin restart: pm2 restart muvaffaqiyatsiz tugadi");
    });
    if (botFound) {
      execFileAsync("pm2", ["restart", pm2BotAppName]).catch((err) => {
        logger.error({ err, pm2BotAppName }, "Admin restart: telegram-bot uchun pm2 restart muvaffaqiyatsiz tugadi");
      });
    }
  }, 500);
});

// GET /api/admin/rebuild/process-status — PM2 orqali ISHLAYOTGAN
// jarayonlarning (asosiy server + telegram-bot) HAQIQIY holatini
// qaytaradi (online/errored/to'xtagan/topilmadi), foydalanuvchi
// faolligi statistikasi emas.
//
// TUZATISH: dashboarddagi yagona bot bilan bog'liq karta
// (TelegramBotStatsCard, AdminDashboardTab.tsx) faqat foydalanuvchi
// harakatlari statistikasini (bog'langan foydalanuvchilar, bosilgan
// tugmalar) ko'rsatardi — botning O'ZI PM2'da ishlab turibdimi, xato
// bilan yiqilib qulaganmi (errored) yoki umuman ishga tushmaganmi,
// buning uchun hech qanday monitoring yo'q edi. Admin buni faqat botga
// xabar yozib "javob bermayapti"ni payqab bilardi. Endi bu endpoint
// `pm2 jlist` orqali ikkala jarayonning (savdo24 va telegram-bot)
// haqiqiy PM2 holatini, uptime'ini va restart sonini qaytaradi —
// frontend buni bir necha soniyada bir marta so'rab, badge sifatida
// ko'rsatadi (pastdagi AdminDashboardTab.tsx'ga qarang).
router.get("/process-status", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const pm2AppName = process.env.PM2_APP_NAME || "savdo24";
  const pm2BotAppName = process.env.PM2_BOT_APP_NAME || "telegram-bot";

  type ProcInfo = {
    key: "server" | "bot";
    name: string;
    found: boolean;
    status: string;
    uptimeMs: number | null;
    restarts: number | null;
    memoryMb: number | null;
    cpuPercent: number | null;
  };

  const emptyInfo = (key: "server" | "bot", name: string): ProcInfo => ({
    key, name, found: false, status: "not_found", uptimeMs: null, restarts: null, memoryMb: null, cpuPercent: null
  });

  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"]);
    let list: any[] = [];
    try {
      list = JSON.parse(stdout);
    } catch (parseErr) {
      logger.error({ parseErr }, "Admin process-status: pm2 jlist JSON tahlil qilinmadi");
      return res.json({ available: false, processes: [emptyInfo("server", pm2AppName), emptyInfo("bot", pm2BotAppName)] });
    }

    const toInfo = (key: "server" | "bot", name: string): ProcInfo => {
      const proc = list.find((p) => p?.name === name);
      if (!proc) return emptyInfo(key, name);
      const env = proc.pm2_env || {};
      const uptimeMs = typeof env.pm_uptime === "number" && env.status === "online" ? Date.now() - env.pm_uptime : null;
      return {
        key,
        name,
        found: true,
        status: env.status || "unknown",
        uptimeMs,
        restarts: typeof env.restart_time === "number" ? env.restart_time : null,
        memoryMb: typeof proc.monit?.memory === "number" ? Math.round(proc.monit.memory / (1024 * 1024)) : null,
        cpuPercent: typeof proc.monit?.cpu === "number" ? proc.monit.cpu : null
      };
    };

    res.json({
      available: true,
      processes: [toInfo("server", pm2AppName), toInfo("bot", pm2BotAppName)]
    });
  } catch (err: unknown) {
    // PM2 umuman o'rnatilmagan yoki muhitda mavjud emas (Render, dev
    // rejimi) — bu xato emas, shunchaki monitoring shu muhitda mumkin
    // emas degani. Frontend `available:false`ni ko'rib "PM2 monitoring
    // mavjud emas" deb ko'rsatadi.
    logger.warn({ err }, "Admin process-status: PM2 topilmadi yoki jlist muvaffaqiyatsiz tugadi");
    res.json({ available: false, processes: [emptyInfo("server", pm2AppName), emptyInfo("bot", pm2BotAppName)] });
  }
});

export default router;
