import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { decryptSecret } from '../src/lib/crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { listBackupsFromGoogleDrive, downloadFromGoogleDrive } from '../src/lib/googleDrive';

dotenv.config();

const prismaClient = new PrismaClient();

// TUZATILDI (XAVFLI FALLBACK — bir xil xato scripts/backup-db.ts,
// scripts/export-to-github.ts va src/routes/admin-backup.ts'da ham
// topilgan): deshifrlash muvaffaqiyatsiz bo'lsa, endi xom shifr matni
// emas, `null` qaytariladi — aks holda pastda S3/Google Drive/Telegram
// tiklash (restore) chaqiruvlarida noma'lum, ishlatib bo'lmaydigan
// qiymat haqiqiy kalit/token sifatida ishlatilib, tushunarsiz xatoga
// olib kelishi mumkin edi.
async function getSetting(key: string): Promise<string | null> {
  try {
    const dbSetting = await prismaClient.setting.findUnique({ where: { key } });
    if (dbSetting) {
      try {
        const decrypted = decryptSecret(dbSetting.value);
        return decrypted;
      } catch (decryptErr) {
        console.error(`[Settings] "${key}" sozlamasini deshifrlab bo'lmadi (ENCRYPTION_KEY mos kelmasligi mumkin) — Admin panel → Sozlamalar orqali qayta kiriting.`);
        return null;
      }
    }
  } catch (err) {
    // Suppress
  }
  return process.env[key] || null;
}

async function downloadFromTelegram(botToken: string, fileId: string): Promise<Buffer | null> {
  try {
    console.log(`[Telegram] Fetching file path for fileId: ${fileId}...`);
    const pathResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const pathData = await pathResponse.json() as any;

    if (!pathData.ok) {
      console.error("[Telegram] Error fetching file path:", pathData);
      return null;
    }

    const filePath = pathData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    
    console.log(`[Telegram] Downloading file from ${fileUrl}...`);
    const fileResponse = await fetch(fileUrl);
    const arrayBuffer = await fileResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("[Telegram] Error downloading file:", err);
    return null;
  }
}

// Eslatma: avval shu yerda `getMessageFromTelegram` degan funksiya bor edi —
// u hech qayerda chaqirilmasdi va faqat har doim `null` qaytarardi (aslida
// ishlamaydigan, faqat fikr-mulohaza izohlaridan iborat "o'lik kod" edi).
// Haqiqiy auto-restore FILE_ID orqali ishlaydi (pastdagi
// `restoreFromLatestBackup` va uning `last_backup_file_id` / `last_backup.json`
// fallback mexanizmiga qarang), shu sabab bu funksiya olib tashlandi.

async function decryptBackup(encryptedContent: string, encryptionKey: string): Promise<Buffer | null> {
  try {
    const [ivHex, encryptedHex, tagHex] = encryptedContent.split(':');
    if (!ivHex || !encryptedHex || !tagHex) {
      throw new Error("Invalid encrypted format. Expected iv:encrypted:tag");
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = crypto.createHash('sha256').update(encryptionKey).digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  } catch (err: any) {
    console.error("[Restore] Decryption failed:", err.message);
    return null;
  }
}

// 69-MUAMMO: backup-db.ts to'liq mustaqil ravishda Contabo S3'ga zaxira
// yuklay oladi (Telegram sozlanmagan bo'lsa ham), lekin bu funksiya faqat
// Telegram file_id orqali tiklay olardi — S3'ga yuklangan zaxiralar HECH
// QACHON tiklanmasdi (checkAndAutoRestore ham faqat last_backup_file_id/
// last_backup.json'ga qarardi, ikkalasi ham faqat Telegram muvaffaqiyatli
// bo'lgandagina yoziladi). Ya'ni faqat S3 sozlangan loyihalarda zaxira
// "bir tomonlama" edi — yuklanadi, lekin hech qachon qaytarib olinmaydi.
// Endi shu funksiya S3'dagi ENG SO'NGGI obyektni SANASI bilan birga topadi
// (hali yuklab olmasdan) — shunda uni boshqa manbalar (Telegram, Google
// Drive) bilan sana bo'yicha solishtirish mumkin bo'ladi.
async function findLatestS3Backup(): Promise<{ date: Date; download: () => Promise<Buffer | null> } | null> {
  const endpoint = await getSetting("CONTABO_S3_ENDPOINT");
  const accessKeyId = await getSetting("CONTABO_ACCESS_KEY");
  const secretAccessKey = await getSetting("CONTABO_SECRET_KEY");
  const bucketName = await getSetting("CONTABO_BUCKET_NAME");

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  try {
    const s3 = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true
    });

    const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: 'backups/' }));
    const objects = listed.Contents || [];
    if (objects.length === 0) {
      console.log("[S3] Bucketda 'backups/' ostida hech qanday fayl topilmadi.");
      return null;
    }

    const latest = objects.reduce((a, b) => ((a.LastModified?.getTime() || 0) >= (b.LastModified?.getTime() || 0) ? a : b));
    console.log(`[S3] Eng so'nggi zaxira topildi: ${latest.Key} (${latest.LastModified?.toISOString()})`);

    return {
      date: latest.LastModified || new Date(0),
      download: async () => {
        try {
          const obj = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: latest.Key! }));
          const chunks: Buffer[] = [];
          for await (const chunk of obj.Body as any) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          return Buffer.concat(chunks);
        } catch (err: any) {
          console.error("[S3] Zaxirani yuklab olishda xatolik:", err.message);
          return null;
        }
      }
    };
  } catch (err: any) {
    console.error("[S3] Zaxiralarni ro'yxatlashda xatolik:", err.message);
    return null;
  }
}

// Google Drive'dagi eng so'nggi zaxirani (sanasi bilan birga) topadi. Avval
// bu manba backup-db.ts orqali yuklanardi, lekin restore-db.ts uni umuman
// ko'rmasdi — ya'ni Google Drive'ga yuklangan zaxiralar ham hech qachon
// qaytarib olinmasdi (S3 bilan bir xil muammo).
async function findLatestGoogleDriveBackup(): Promise<{ date: Date; download: () => Promise<Buffer | null> } | null> {
  const clientEmail = await getSetting("GOOGLE_DRIVE_CLIENT_EMAIL");
  const privateKey = await getSetting("GOOGLE_DRIVE_PRIVATE_KEY");
  const folderId = await getSetting("GOOGLE_DRIVE_FOLDER_ID");

  if (!clientEmail || !privateKey) {
    return null;
  }

  try {
    const files = await listBackupsFromGoogleDrive({ clientEmail, privateKey, folderId });
    if (files.length === 0) {
      console.log("[Google Drive] Papkada hech qanday zaxira fayli topilmadi.");
      return null;
    }

    // listBackupsFromGoogleDrive natijasi createdTime bo'yicha kamayish
    // tartibida keladi, shuning uchun birinchisi eng so'nggisi.
    const latest = files[0];
    console.log(`[Google Drive] Eng so'nggi zaxira topildi: ${latest.name} (${latest.createdTime})`);

    return {
      date: latest.createdTime ? new Date(latest.createdTime) : new Date(0),
      download: () => downloadFromGoogleDrive(latest.id, { clientEmail, privateKey, folderId })
    };
  } catch (err: any) {
    console.error("[Google Drive] Zaxiralarni ro'yxatlashda xatolik:", err.message);
    return null;
  }
}

export async function restoreFromLatestBackup(manualFileId?: string) {
  console.log("=== Savdo24 Database Restore Process ===");
  
  const botToken = await getSetting("TELEGRAM_BOT_TOKEN");
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const dbUrl = process.env.DATABASE_URL;

  if (!encryptionKey || !dbUrl) {
    console.error("[Restore] Missing required configuration (ENCRYPTION_KEY or DATABASE_URL).");
    await prismaClient.$disconnect();
    return;
  }

  // MUHIM (server butunlay tozalanganda): Telegram orqali tiklash faqat
  // avvalgi backup'ning file_id'sini "bilsak" ishlaydi — bu esa DB'dagi
  // Settings jadvalida yoki serverning lokal diskidagi last_backup.json
  // faylida saqlanadi. Agar ma'lumotlar bazasi VA server diski BIRDANIGA
  // tozalansa (masalan konteyner butunlay qayta yaratilsa), bu ikkalasi
  // ham yo'qoladi va Telegram fileId'ni hech qanday tarzda topib bo'lmaydi
  // — Bot API orqali kanaldagi eski xabarlarni "ro'yxatlash" imkoni yo'q.
  // Shu sabab endi tizim Telegram bilan bir qatorda Contabo S3 va Google
  // Drive'ni ham HAR DOIM (fileId'ga bog'liq bo'lmagan holda) tekshiradi —
  // bu ikkalasi o'zining fayllar ro'yxatini har safar qayta so'rab oladi,
  // shuning uchun disk/DB tozalanishidan mutlaqo ta'sirlanmaydi (faqat
  // ularning kirish kalitlari .env'da muhit o'zgaruvchisi sifatida ham
  // saqlangan bo'lishi kerak — DB Settings'dan tashqari).
  let fileId = manualFileId;
  let telegramBackupDate: Date | null = null;

  if (!fileId && botToken) {
    const savedFileId = await getSetting("last_backup_file_id");
    if (savedFileId) {
      fileId = savedFileId;
      const savedDate = await getSetting("last_backup_date");
      telegramBackupDate = savedDate ? new Date(savedDate) : null;
    } else {
      const fallbackPath = path.join(process.cwd(), 'last_backup.json');
      if (fs.existsSync(fallbackPath)) {
        const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        fileId = fallbackData.fileId;
        telegramBackupDate = fallbackData.date ? new Date(fallbackData.date) : null;
        console.log(`[Restore] Found backup fileId from local fallback: ${fileId}`);
      }
    }
  }

  type Candidate = { source: string; date: Date; download: () => Promise<Buffer | null> };
  const candidates: Candidate[] = [];

  if (fileId && botToken) {
    candidates.push({
      source: 'Telegram',
      // Sana noma'lum bo'lsa ham kandidat sifatida qo'shamiz — lekin uni
      // eng past ustuvorlikka qo'yish uchun juda eski sana beramiz, shunda
      // sanasi ma'lum S3/Google Drive zaxiralari birinchi o'ringa chiqadi
      // (chunki ularning "yo'q bo'lib qolishi" ehtimoli kamroq).
      date: telegramBackupDate || new Date(0),
      download: () => downloadFromTelegram(botToken, fileId!)
    });
  }

  const s3Candidate = await findLatestS3Backup();
  if (s3Candidate) candidates.push({ source: 'Contabo S3', ...s3Candidate });

  const gdCandidate = await findLatestGoogleDriveBackup();
  if (gdCandidate) candidates.push({ source: 'Google Drive', ...gdCandidate });

  if (candidates.length === 0) {
    console.error("[Restore] Hech qanday manbada (Telegram, Contabo S3, Google Drive) zaxira topilmadi. Auto-restore bekor qilindi.");
    await prismaClient.$disconnect();
    return;
  }

  // Eng so'nggi (sanasi eng katta) kandidatdan boshlab, muvaffaqiyatli
  // yuklab bo'lguncha navbatma-navbat sinab ko'ramiz.
  candidates.sort((a, b) => b.date.getTime() - a.date.getTime());
  console.log(`[Restore] Topilgan manbalar (ustuvorlik bo'yicha): ${candidates.map((c) => `${c.source} (${c.date.toISOString()})`).join(', ')}`);

  let encryptedBuffer: Buffer | null = null;
  for (const candidate of candidates) {
    console.log(`[Restore] "${candidate.source}" manbasidan yuklab olinmoqda...`);
    encryptedBuffer = await candidate.download();
    if (encryptedBuffer) {
      console.log(`✅ [Restore] "${candidate.source}" manbasidan muvaffaqiyatli yuklandi.`);
      break;
    }
    console.warn(`[Restore] "${candidate.source}" manbasidan yuklab bo'lmadi, keyingi manba sinaladi...`);
  }

  if (!encryptedBuffer) {
    console.error("[Restore] Barcha topilgan manbalardan yuklashga urinildi, lekin hech biri muvaffaqiyatli bo'lmadi. Auto-restore bekor qilindi.");
    await prismaClient.$disconnect();
    return;
  }

  console.log("[Restore] Decrypting backup...");
  const decryptedBuffer = await decryptBackup(encryptedBuffer.toString(), encryptionKey);
  if (!decryptedBuffer) {
    console.error("[Restore] Failed to decrypt backup.");
    await prismaClient.$disconnect();
    return;
  }

  const tempRestorePath = path.join('/tmp', `restore-${Date.now()}`);
  fs.writeFileSync(tempRestorePath, decryptedBuffer);

  // Check if it's SQL or JSON
  const isJson = decryptedBuffer.toString().trim().startsWith('{');

  if (!isJson) {
    console.log("[Restore] Detected SQL format. Importing via psql...");
    try {
      execSync(`psql "${dbUrl}" -f "${tempRestorePath}"`, { stdio: 'inherit' });
      console.log("✅ [Restore] SQL import completed successfully.");
    } catch (err) {
      console.error("[Restore] SQL import failed:", err);
    }
  } else {
    console.log("[Restore] Detected JSON format. Importing via Prisma...");
    const failedTables: string[] = [];
    try {
      const data = JSON.parse(decryptedBuffer.toString());
      
      // Import tables sequentially to respect relations (simple approach)
      // MUHIM: bu ro'yxat backup-db.ts kabi atigi 9/30 modelni tiklardi — endi
      // backupData'dagi barcha 30 modelga to'liq, FK bog'liqliklariga mos
      // tartibda (masalan Startup Category'dan, Payment Startup'dan, Message
      // Conversation'dan keyin keladi).
      const tables = [
        { name: 'user', data: data.users },
        { name: 'category', data: data.categories },
        { name: 'startup', data: data.startups },
        { name: 'payment', data: data.payments },
        { name: 'idea', data: data.ideas },
        { name: 'subscriber', data: data.subscribers },
        { name: 'ideaVote', data: data.ideaVotes },
        { name: 'review', data: data.reviews },
        { name: 'dispute', data: data.disputes },
        { name: 'refreshToken', data: data.refreshTokens },
        { name: 'report', data: data.reports },
        { name: 'auditLog', data: data.auditLogs },
        { name: 'setting', data: data.settings },
        { name: 'telegramDelivery', data: data.telegramDeliveries },
        { name: 'sponsorChannel', data: data.sponsorChannels },
        { name: 'topBoost', data: data.topBoosts },
        { name: 'vipSubscription', data: data.vipSubscriptions },
        { name: 'conversation', data: data.conversations },
        { name: 'message', data: data.messages },
        { name: 'referral', data: data.referrals },
        { name: 'referralReward', data: data.referralRewards },
        { name: 'listingTier', data: data.listingTiers },
        { name: 'listingSubscription', data: data.listingSubscriptions },
        { name: 'escrowPayment', data: data.escrowPayments },
        { name: 'disputeResolution', data: data.disputeResolutions },
        { name: 'b2BAccount', data: data.b2bAccounts },
        { name: 'b2BOrder', data: data.b2bOrders },
        { name: 'analyticsEvent', data: data.analyticsEvents },
        { name: 'supportTicket', data: data.supportTickets },
        { name: 'notification', data: data.notifications }
      ];

      for (const table of tables) {
        if (table.data && table.data.length > 0) {
          console.log(`[Restore] Importing ${table.data.length} records into ${table.name}...`);
          try {
            // @ts-ignore
            await prismaClient[table.name].createMany({
              data: table.data,
              skipDuplicates: true
            });
          } catch (tableErr: any) {
            // MUHIM: avval bitta jadval xato bersa (masalan FK maqsadi hali
            // tiklanmagan, yoki noyob cheklov to'qnashuvi) BUTUN import
            // to'xtab qolardi va shu jadvaldan keyingi HAMMA jadvallar
            // (masalan referral, listingSubscription, notification va h.k.)
            // sukut bilan tiklanmay qolardi. Endi har bir jadval mustaqil —
            // bittasi muvaffaqiyatsiz bo'lsa ham, xatolik log qilinadi va
            // qolgan jadvallar tiklashda davom etadi.
            failedTables.push(table.name);
            console.error(`[Restore] Failed to import table "${table.name}":`, tableErr.message || tableErr);
          }
        }
      }

      // MUHIM: JSON fallback orqali tiklashda ba'zi jadvallarning (User, Idea,
      // Review, Message, Notification va h.k.) autoincrement Int ID'lari
      // to'g'ridan-to'g'ri saqlab qo'yiladi, lekin Postgres'ning ichki
      // ketma-ketlik hisoblagichi (sequence) bu haqda xabardor bo'lmaydi.
      // Natijada tiklashdan keyin yaratilgan YANGI yozuvlar eski (tiklangan)
      // ID bilan to'qnashib, "duplicate key" xatosiga olib kelishi mumkin edi.
      console.log("[Restore] Autoincrement ketma-ketliklari (sequences) sinxronlanmoqda...");
      const autoIncrementTables = [
        'User', 'Idea', 'Subscriber', 'IdeaVote', 'Review', 'Dispute',
        'RefreshToken', 'Report', 'AuditLog', 'SponsorChannel', 'Message',
        'AnalyticsEvent', 'Notification'
      ];
      for (const tableName of autoIncrementTables) {
        try {
          await prismaClient.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), (SELECT MAX(id) FROM "${tableName}") IS NOT NULL)`
          );
        } catch (seqErr: any) {
          console.warn(`[Restore] "${tableName}" uchun sequence sinxronlashda xatolik:`, seqErr.message || seqErr);
        }
      }

      if (failedTables.length > 0) {
        console.error(`⚠️ [Restore] JSON import yakunlandi, LEKIN quyidagi jadvallar tiklanmadi: ${failedTables.join(', ')}. Sabablarini yuqoridagi loglardan tekshiring.`);
      } else {
        console.log("✅ [Restore] JSON import completed successfully.");
      }
    } catch (err) {
      console.error("[Restore] JSON import failed:", err);
    }
  }

  // Cleanup
  if (fs.existsSync(tempRestorePath)) {
    fs.unlinkSync(tempRestorePath);
  }

  await prismaClient.$disconnect();
}

// CLI execution
// Note: when this file is dynamically imported from the bundled (CJS) production
// server, `import.meta.url` is empty and fileURLToPath() throws. Guard against
// that so importing this module for programmatic use (e.g. from server.ts)
// never crashes — only running it directly via `tsx scripts/restore-db.ts` should
// trigger the auto-run.
const nodePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
let modulePath = '';
try {
  modulePath = fileURLToPath(import.meta.url);
} catch {
  // import.meta.url unavailable (e.g. bundled to CJS) — not a direct CLI run.
}
if (nodePath && modulePath && nodePath === modulePath) {
  const args = process.argv.slice(2);
  const manualFileId = args[0];
  restoreFromLatestBackup(manualFileId);
}
