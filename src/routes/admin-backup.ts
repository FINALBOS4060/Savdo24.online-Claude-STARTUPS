// Admin panel: butun sayt ma'lumotlarini (PostgreSQL baza + /uploads
// papkasidagi rasmlar) bitta .zip fayl sifatida yuklab olish va shu fayldan
// tiklash. Ilgari rasm saqlash uchun ishlatilgan Telegram-kanal usuli olib
// tashlangani sababli, endi hamma narsa shu ikkita joyda (baza + local
// diskdagi uploads papkasi) saqlanadi va shu ikkalasi birga zaxiralanadi.
import { Router, Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import multer from "multer";
import archiver from "archiver";
import AdmZip from "adm-zip";
import { authenticateToken, requireAdmin, prisma, AuthRequest } from "../lib/context";
import { logger } from "../lib/logger";
import { rebuildLimiter } from "../lib/rateLimiters";
import { decryptSecret } from "../lib/crypto";

const execFileAsync = promisify(execFile);
const router = Router();

// Bulutli (Telegram / Contabo S3 / Google Drive) zaxira holatini o'qish
// uchun yordamchi — scripts/backup-db.ts har bir muvaffaqiyatli Telegram
// zaxirasidan keyin shu uchta Setting qiymatini yozadi.
//
// TUZATILDI (XAVFLI FALLBACK — production loglarida ENCRYPTION_KEY
// nomuvofiqligi tufayli "Decryption failed" xatolari kuzatilgach): oldin
// deshifrlash muvaffaqiyatsiz bo'lsa, funksiya bazadagi XOM (hali ham
// shifrlangan, `iv:encrypted:tag` formatidagi) satrni xuddi haqiqiy
// qiymatdek QAYTARARDI (izohda "shifrlanmagan bo'lsa ham qaytaramiz"
// deb izohlangan edi — bu faqat sozlama HAQIQATAN shifrlanmagan bo'lsa
// to'g'ri, lekin shifrlangan-u DESHIFRLAB BO'LMASA — masalan
// ENCRYPTION_KEY o'zgargan bo'lsa — noto'g'ri natija berardi).
//
// Amaliy oqibati: `/api/admin/backup/cloud-status` shu qiymatni
// `telegramConfigured: !!(botToken && chatId)` orqali tekshiradi — xom
// shifr matni bo'sh emas bo'lgani uchun bu HAR DOIM "sozlangan" (true)
// deb noto'g'ri ko'rsatardi, garchi token aslida ishlatib bo'lmaydigan
// chalkash matn bo'lsa ham. Bu esa src/routes/admin-settings.ts'dagi
// (getSettingDiagnostic orqali) allaqachon to'g'ri ko'rsatilgan "⚠️
// SHIFRLASHDA XATOLIK" ogohlantirishiga ZID edi — ikkita admin sahifasi
// bir xil sozlama haqida bir-biriga zid ma'lumot berardi.
//
// Endi deshifrlash muvaffaqiyatsiz bo'lsa, xato aniq log qilinadi va
// `null` qaytariladi — context.ts'dagi umumiy getSetting() bilan bir xil,
// xavfsiz "fail closed" xulq-atvor: noma'lum/buzilgan qiymat hech qachon
// haqiqiy sozlama sifatida ishlatilmaydi.
async function getSetting(key: string): Promise<string | null> {
  try {
    const dbSetting = await prisma.setting.findUnique({ where: { key } });
    if (dbSetting) {
      try {
        return decryptSecret(dbSetting.value);
      } catch (decryptErr) {
        logger.warn(
          { decryptErr, key },
          "admin-backup: sozlamani deshifrlab bo'lmadi (ENCRYPTION_KEY mos kelmasligi mumkin) — sozlamani Admin panel → Sozlamalar orqali qayta kiriting"
        );
        return null;
      }
    }
  } catch {
    // Settings jadvali hali yo'q bo'lishi mumkin — jim o'tkazamiz
  }
  return process.env[key] || null;
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// pg_dump/psql "postgresql://...?schema=public" ko'rinishidagi Prisma'ga xos
// "schema" so'rov parametrini tushunmaydi ("invalid URI query parameter"
// xatosini beradi) — shuning uchun ularga uzatishdan oldin shu qismni olib
// tashlaymiz. Schema nomi (odatda "public") bazaga ulanishda muhim emas,
// chunki u foydalanuvchining standart search_path'iga kiradi.
function toPgToolConnectionString(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.search = "";
    return url.toString();
  } catch {
    // Agar URL sifatida parse qilib bo'lmasa, qo'lda "?"dan keyingisini kesamiz
    return databaseUrl.split("?")[0];
  }
}

const backupUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB — rasm ko'p bo'lsa ham yetadi
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/zip" || file.originalname.toLowerCase().endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Faqat .zip fayl qabul qilinadi."));
    }
  }
});

// GET /api/admin/backup/export — bazani (pg_dump) va uploads papkasini
// bitta zip fayl qilib, to'g'ridan-to'g'ri brauzerga yuklab beradi.
router.get("/export", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "savdo24-backup-"));
  const dumpPath = path.join(tmpDir, "database.sql");

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: "DATABASE_URL sozlanmagan." });
    }

    // --clean --if-exists: tiklashda eski jadvallarni avtomatik tozalab,
    // qayta yaratadi — shu bilan import bosqichi soddalashadi.
    await execFileAsync("pg_dump", [
      toPgToolConnectionString(databaseUrl),
      "-f", dumpPath,
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists"
    ]);

    const filename = `savdo24-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      logger.error({ err }, "Backup export (archiver) xatosi");
      if (!res.headersSent) res.status(500).end();
    });
    archive.pipe(res);
    archive.file(dumpPath, { name: "database.sql" });
    if (fs.existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, "uploads");
    }
    await archive.finalize();

    logger.info({ adminId: req.user?.id }, "Admin to'liq zaxira nusxasini yukladi");
  } catch (err) {
    logger.error({ err }, "GET /api/admin/backup/export xatosi");
    if (!res.headersSent) {
      res.status(500).json({ error: "Zaxira yaratishda xatolik yuz berdi." });
    }
  } finally {
    fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

// POST /api/admin/backup/import — .zip fayldan bazani (psql) va
// /uploads papkasini tiklaydi. DIQQAT: bu joriy bazadagi ma'lumotlarni
// zaxiradagi holat bilan ALMASHTIRADI (qaytarib bo'lmaydi).
router.post(
  "/import",
  authenticateToken,
  requireAdmin,
  backupUpload.single("backup"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: "Zaxira fayli yuklanmadi." });
    }

    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "savdo24-restore-"));

    try {
      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(tmpDir, true);

      const dumpPath = path.join(tmpDir, "database.sql");
      if (!fs.existsSync(dumpPath)) {
        return res.status(400).json({ error: "Zaxira faylida database.sql topilmadi — fayl noto'g'ri yoki buzilgan." });
      }

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return res.status(500).json({ error: "DATABASE_URL sozlanmagan." });
      }

      await execFileAsync("psql", [toPgToolConnectionString(databaseUrl), "-f", dumpPath]);

      const uploadsBackup = path.join(tmpDir, "uploads");
      if (fs.existsSync(uploadsBackup)) {
        await fsp.mkdir(UPLOADS_DIR, { recursive: true });
        await fsp.cp(uploadsBackup, UPLOADS_DIR, { recursive: true });
      }

      logger.info({ adminId: req.user?.id }, "Admin zaxiradan bazani va fayllarni tikladi");
      return res.json({ message: "Ma'lumotlar bazasi va fayllar muvaffaqiyatli tiklandi." });
    } catch (err) {
      logger.error({ err }, "POST /api/admin/backup/import xatosi");
      return res.status(500).json({ error: "Tiklashda xatolik yuz berdi. Server loglarini tekshiring." });
    } finally {
      fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      fsp.rm(req.file.path, { force: true }).catch(() => {});
    }
  }
);

// GET /api/admin/backup/cloud-status — Telegram/S3/Google Drive orqali
// avtomatik (kunlik cron) zaxiralash qay holatda ekanini ko'rsatadi.
// MUHIM: bu tizim yuqoridagi /export /import (pg_dump + uploads zip)dan
// TO'LIQ MUSTAQIL edi — admin panelidagi yuklab olish/tiklash tugmalari
// Telegram'ga umuman bog'liq emas edi, shu sabab Telegram'ga muvaffaqiyatli
// zaxira ketayotgan bo'lsa ham admin buni panelda hech qachon ko'rmasdi va
// undan tiklay olmasdi. Bu endpoint shu ikki tizimni "ko'rinadigan" qilib
// bog'laydi.
router.get("/cloud-status", authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const [botToken, chatId, lastBackupDate, lastBackupFileId] = await Promise.all([
      getSetting("TELEGRAM_BOT_TOKEN"),
      getSetting("TELEGRAM_BACKUP_CHAT_ID"),
      getSetting("last_backup_date"),
      getSetting("last_backup_file_id"),
    ]);

    const [s3Endpoint, s3Bucket, gdClientEmail] = await Promise.all([
      getSetting("CONTABO_S3_ENDPOINT"),
      getSetting("CONTABO_BUCKET_NAME"),
      getSetting("GOOGLE_DRIVE_CLIENT_EMAIL"),
    ]);

    res.json({
      telegramConfigured: !!(botToken && chatId),
      s3Configured: !!(s3Endpoint && s3Bucket),
      googleDriveConfigured: !!gdClientEmail,
      lastBackupDate: lastBackupDate || null,
      hasTelegramFileId: !!lastBackupFileId,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/backup/cloud-status xatosi");
    res.status(500).json({ error: "Bulutli zaxira holatini olishda xatolik yuz berdi." });
  }
});

// POST /api/admin/backup/cloud-backup — hozirgi bazani darhol Telegram/S3/
// Google Drive'ga (sozlangan bo'lsa) yuboradi, kunlik cron (soat 04:00)ni
// kutmasdan. scripts/backup-db.ts'dagi xuddi shu funksiyani ishlatadi.
router.post("/cloud-backup", authenticateToken, requireAdmin, rebuildLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { runBackup } = await import("../../scripts/backup-db");
    await runBackup();

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "cloud_backup_triggered",
        details: "Admin panel orqali Telegram/S3/Google Drive zaxirasi qo'lda ishga tushirildi"
      }
    }).catch((e: unknown) => logger.error({ err: e }, "Audit log error (cloud-backup)"));

    logger.info({ adminId: req.user?.id }, "Admin bulutli zaxirani qo'lda ishga tushirdi");
    res.json({ message: "Bulutli zaxira (Telegram/S3/Google Drive, sozlanganlari) yuborildi." });
  } catch (err) {
    logger.error({ err }, "POST /api/admin/backup/cloud-backup xatosi");
    res.status(500).json({ error: "Bulutga zaxira yuborishda xatolik yuz berdi. Server loglarini tekshiring." });
  }
});

// POST /api/admin/backup/cloud-restore — Telegram/S3/Google Drive'dagi ENG
// SO'NGGI zaxiradan bazani tiklaydi (scripts/restore-db.ts'dagi mantiq —
// uchala manbani ham sanasi bo'yicha solishtirib eng yangisini tanlaydi).
// DIQQAT: joriy bazadagi ma'lumotlarni almashtiradi, orqaga qaytarib
// bo'lmaydi — xuddi /import kabi.
router.post("/cloud-restore", authenticateToken, requireAdmin, rebuildLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { restoreFromLatestBackup } = await import("../../scripts/restore-db");
    await restoreFromLatestBackup();

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: "cloud_restore_triggered",
        details: "Admin panel orqali Telegram/S3/Google Drive'dan tiklash qo'lda ishga tushirildi"
      }
    }).catch((e: unknown) => logger.error({ err: e }, "Audit log error (cloud-restore)"));

    logger.info({ adminId: req.user?.id }, "Admin bulutdan tiklashni qo'lda ishga tushirdi");
    res.json({ message: "Bulutdagi (Telegram/S3/Google Drive) eng so'nggi zaxiradan tiklash bajarildi. Batafsil natija uchun server loglarini tekshiring." });
  } catch (err) {
    logger.error({ err }, "POST /api/admin/backup/cloud-restore xatosi");
    res.status(500).json({ error: "Bulutdan tiklashda xatolik yuz berdi. Server loglarini tekshiring." });
  }
});

export default router;
