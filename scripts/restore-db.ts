import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { decryptSecret } from '../src/lib/crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const prismaClient = new PrismaClient();

async function getSetting(key: string): Promise<string | null> {
  try {
    const dbSetting = await prismaClient.setting.findUnique({ where: { key } });
    if (dbSetting) {
      try {
        const decrypted = decryptSecret(dbSetting.value);
        return decrypted;
      } catch (decryptErr) {
        return dbSetting.value; // Fallback if not encrypted
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
// Endi Telegram manbasi topilmasa, eng so'nggi S3 obyekti qidirib topiladi.
async function downloadLatestFromS3(): Promise<Buffer | null> {
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
    console.log(`[S3] Eng so'nggi zaxira topildi: ${latest.Key}`);

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

export async function restoreFromLatestBackup(manualFileId?: string) {
  console.log("=== Savdo24 Database Restore Process ===");
  
  const botToken = await getSetting("TELEGRAM_BOT_TOKEN");
  const chatId = await getSetting("TELEGRAM_BACKUP_CHAT_ID");
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const dbUrl = process.env.DATABASE_URL;

  if (!encryptionKey || !dbUrl) {
    console.error("[Restore] Missing required configuration (ENCRYPTION_KEY or DATABASE_URL).");
    await prismaClient.$disconnect();
    return;
  }

  let fileId = manualFileId;

  if (!fileId && botToken) {
    // Try to get from settings
    const savedFileId = await getSetting("last_backup_file_id");
    if (savedFileId) {
      fileId = savedFileId;
    } else {
      // Try local fallback file
      const fallbackPath = path.join(process.cwd(), 'last_backup.json');
      if (fs.existsSync(fallbackPath)) {
        const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        fileId = fallbackData.fileId;
        console.log(`[Restore] Found backup fileId from local fallback: ${fileId}`);
      }
    }
  }

  // 69-MUAMMO: Telegram manbasi topilmasa (yoki umuman sozlanmagan bo'lsa),
  // avvalgi kod shu yerda to'xtab qolardi — S3'dagi zaxira umuman
  // ko'rilmasdi. Endi shu holatda Contabo S3'dan eng so'nggi zaxira izlanadi.
  let encryptedBuffer: Buffer | null = null;
  if (fileId && botToken) {
    encryptedBuffer = await downloadFromTelegram(botToken, fileId);
    if (!encryptedBuffer) {
      console.error("[Restore] Failed to download backup file from Telegram.");
    }
  }

  if (!encryptedBuffer) {
    console.log("[Restore] Telegram manbasi mavjud emas, Contabo S3 tekshirilmoqda...");
    encryptedBuffer = await downloadLatestFromS3();
  }

  if (!encryptedBuffer) {
    console.error("[Restore] No backup found via Telegram or Contabo S3. Auto-restore aborted.");
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
          // @ts-ignore
          await prismaClient[table.name].createMany({
            data: table.data,
            skipDuplicates: true
          });
        }
      }
      console.log("✅ [Restore] JSON import completed successfully.");
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
