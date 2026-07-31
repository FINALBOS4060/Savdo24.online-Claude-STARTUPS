import { execSync } from 'child_process';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { encryptSecret, decryptSecret } from '../src/lib/crypto';
import { fileURLToPath } from 'url';
import { uploadToGoogleDrive } from '../src/lib/googleDrive';

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
    // Suppress if DB table settings doesn't exist yet
  }
  return process.env[key] || null;
}

async function updateSetting(key: string, value: string) {
  try {
    const encryptedValue = encryptSecret(value);
    await prismaClient.setting.upsert({
      where: { key },
      update: { value: encryptedValue },
      create: { key, value: encryptedValue }
    });
  } catch (err) {
    console.error(`Error updating setting ${key}:`, err);
  }
}

function encryptBackupBuffer(fileBuffer: Buffer, encryptionKey: string): Buffer {
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(fileBuffer);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(`${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`);
}

async function sendToTelegram(filePath: string, filename: string) {
  const botToken = await getSetting("TELEGRAM_BOT_TOKEN");
  const chatId = await getSetting("TELEGRAM_BACKUP_CHAT_ID");
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!botToken || !chatId) {
    console.log("[Telegram] Credentials (TELEGRAM_BOT_TOKEN/TELEGRAM_BACKUP_CHAT_ID) are not configured. Skipping Telegram backup.");
    return null;
  }

  if (!encryptionKey || encryptionKey.length < 32) {
    console.error("[Telegram] CRITICAL ERROR: ENCRYPTION_KEY is not defined or too short (min 32 chars). Backup will NOT be sent unencrypted.");
    return null;
  }

  console.log(`\n[Telegram] Encrypting and sending backup file ${filename} to Telegram chat/channel ${chatId}...`);
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const encryptedContent = encryptBackupBuffer(fileBuffer, encryptionKey);
    const encryptedFilename = `${filename}.enc`;
    
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", new Blob([encryptedContent]), encryptedFilename);
    formData.append("caption", `Savdo24 Zaxira nusxasi (SHIFRLANGAN)\nSana: ${new Date().toLocaleString()}\nFayl: ${encryptedFilename}\n\n⚠️ Bu fayl AES-256-GCM bilan shifrlangan. Ochish uchun loyihaning ENCRYPTION_KEY qiymatidan foydalaning.`);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      body: formData
    });

    const result = await response.json() as any;
    if (result.ok) {
      console.log("🎉 [Telegram] Encrypted backup successfully sent via Telegram Bot!");
      const fileId = result.result.document.file_id;
      await updateSetting("last_backup_message_id", result.result.message_id.toString());
      await updateSetting("last_backup_file_id", fileId);
      await updateSetting("last_backup_date", new Date().toISOString());
      
      // Local fallback for auto-restore if DB is wiped
      try {
        fs.writeFileSync(path.join(process.cwd(), 'last_backup.json'), JSON.stringify({
          messageId: result.result.message_id,
          fileId: fileId,
          date: new Date().toISOString()
        }));
      } catch (e) {
        console.warn("Failed to write local backup fallback file.");
      }
      
      return result.result.message_id;
    } else {
      console.error("[Telegram] Bot API returned an error:", result);
    }
  } catch (err: any) {
    console.error("[Telegram] Error encrypting or sending backup via Telegram:", err.message);
  }
  return null;
}

export async function runBackup() {
  console.log("=== Savdo24 Database Backup Process ===");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("DATABASE_URL is not configured in environment variables!");
    await prismaClient.$disconnect();
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let filename = `backup-${timestamp}.sql`;
  let tempFilePath = path.join('/tmp', filename);
  let uploadContent: Buffer | string = Buffer.alloc(0);
  let contentType = 'application/sql';

  let pgDumpSuccess = false;

  // Method 1: Try pg_dump (SQL Dump)
  try {
    console.log(`[Method 1] Attempting pg_dump to file: ${tempFilePath}`);
    execSync(`pg_dump "${dbUrl}" -f "${tempFilePath}"`, { stdio: 'ignore' });
    console.log("Local SQL dump completed successfully via pg_dump.");
    uploadContent = fs.readFileSync(tempFilePath);
    pgDumpSuccess = true;
  } catch (dumpErr) {
    console.warn("pg_dump was not successful (it may not be installed in the runtime container).");
    console.log("Switching to [Method 2] - Resilient Prisma Client JSON Export...");
  }

  // Method 2: Fallback to Prisma JSON Export
  if (!pgDumpSuccess) {
    filename = `backup-${timestamp}-fallback.json`;
    tempFilePath = path.join('/tmp', filename);
    contentType = 'application/json';

    try {
      console.log("Fetching all tables from database...");

      // MUHIM: bu ro'yxatda schema.prisma'dagi 30 modeldan atigi 9 tasi bor edi
      // (Notification, Conversation/Message, VipSubscription, B2BAccount/B2BOrder,
      // Referral va h.k. umuman yo'q edi) — pg_dump ishlamagan muhitda (fallback
      // ishga tushganda) bu jadvallar HECH QACHON zaxiralanmasdi. Endi barcha 30
      // modelga to'liq.
      const backupData = {
        users: await prismaClient.user.findMany(),
        categories: await prismaClient.category.findMany(),
        startups: await prismaClient.startup.findMany(),
        payments: await prismaClient.payment.findMany(),
        ideas: await prismaClient.idea.findMany(),
        subscribers: await prismaClient.subscriber.findMany(),
        ideaVotes: await prismaClient.ideaVote.findMany(),
        reviews: await prismaClient.review.findMany(),
        disputes: await prismaClient.dispute.findMany(),
        refreshTokens: await prismaClient.refreshToken.findMany(),
        reports: await prismaClient.report.findMany(),
        auditLogs: await prismaClient.auditLog.findMany(),
        settings: await prismaClient.setting.findMany(),
        telegramDeliveries: await prismaClient.telegramDelivery.findMany(),
        sponsorChannels: await prismaClient.sponsorChannel.findMany(),
        topBoosts: await prismaClient.topBoost.findMany(),
        vipSubscriptions: await prismaClient.vipSubscription.findMany(),
        conversations: await prismaClient.conversation.findMany(),
        messages: await prismaClient.message.findMany(),
        referrals: await prismaClient.referral.findMany(),
        referralRewards: await prismaClient.referralReward.findMany(),
        listingTiers: await prismaClient.listingTier.findMany(),
        listingSubscriptions: await prismaClient.listingSubscription.findMany(),
        escrowPayments: await prismaClient.escrowPayment.findMany(),
        disputeResolutions: await prismaClient.disputeResolution.findMany(),
        b2bAccounts: await prismaClient.b2BAccount.findMany(),
        b2bOrders: await prismaClient.b2BOrder.findMany(),
        analyticsEvents: await prismaClient.analyticsEvent.findMany(),
        supportTickets: await prismaClient.supportTicket.findMany(),
        notifications: await prismaClient.notification.findMany(),
        exportedAt: new Date().toISOString(),
      };

      console.log("Database records retrieved. Generating JSON payload...");
      const jsonString = JSON.stringify(backupData, null, 2);
      fs.writeFileSync(tempFilePath, jsonString);
      uploadContent = jsonString;
      console.log("Local JSON backup generated successfully.");
    } catch (prismaErr) {
      console.error("Prisma Client fallback backup failed:", prismaErr);
      await prismaClient.$disconnect();
      return;
    }
  }

  // Prepare encrypted buffer for S3 and Google Drive uploads
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const rawBuffer = Buffer.isBuffer(uploadContent) ? uploadContent : Buffer.from(uploadContent);
  const encryptedUploadContent = (encryptionKey && encryptionKey.length >= 32)
    ? encryptBackupBuffer(rawBuffer, encryptionKey)
    : rawBuffer;
  const encryptedFilename = (encryptionKey && encryptionKey.length >= 32)
    ? `${filename}.enc`
    : filename;

  // Load S3 settings
  const endpoint = await getSetting("CONTABO_S3_ENDPOINT");
  const accessKeyId = await getSetting("CONTABO_ACCESS_KEY");
  const secretAccessKey = await getSetting("CONTABO_SECRET_KEY");
  const bucketName = await getSetting("CONTABO_BUCKET_NAME");

  // Load Google Drive settings
  const gdClientEmail = await getSetting("GOOGLE_DRIVE_CLIENT_EMAIL");
  const gdPrivateKey = await getSetting("GOOGLE_DRIVE_PRIVATE_KEY");
  const gdFolderId = await getSetting("GOOGLE_DRIVE_FOLDER_ID");

  console.log("\nStarting multi-destination parallel backups (Telegram, S3, Google Drive)...");

  const backupTasks: Array<Promise<any>> = [];

  // 1. Telegram Task
  backupTasks.push(
    sendToTelegram(tempFilePath, filename).catch((err) =>
      console.error("[Telegram Backup Error]:", err)
    )
  );

  // 2. Contabo S3 Task
  if (endpoint && accessKeyId && secretAccessKey && bucketName) {
    if (!encryptionKey || encryptionKey.length < 32) {
      console.error("\n[S3] CRITICAL ERROR: ENCRYPTION_KEY is not defined or too short (min 32 chars). Cloud backup will NOT be uploaded unencrypted.");
    } else {
      backupTasks.push(
        (async () => {
          console.log(`[S3] Initializing S3 Client connecting to ${endpoint}...`);
          const s3 = new S3Client({
            endpoint,
            region: 'us-east-1',
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true
          });

          console.log(`[S3] Uploading "${encryptedFilename}" to bucket "${bucketName}"...`);
          await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: `backups/${encryptedFilename}`,
            Body: encryptedUploadContent,
            ContentType: 'application/octet-stream'
          }));
          console.log(`🎉 [S3] Upload Succeeded! Backed up to backups/${encryptedFilename}`);
        })().catch((s3Err) => console.error("[S3 Upload Error]:", s3Err))
      );
    }
  } else {
    console.log("[S3] Credentials not fully configured. Skipping S3 upload.");
  }

  // 3. Google Drive Task
  if (gdClientEmail && gdPrivateKey) {
    if (!encryptionKey || encryptionKey.length < 32) {
      console.error("\n[Google Drive] CRITICAL ERROR: ENCRYPTION_KEY is not defined or too short (min 32 chars). Drive backup will NOT be uploaded unencrypted.");
    } else {
      backupTasks.push(
        uploadToGoogleDrive(encryptedUploadContent, encryptedFilename, {
          clientEmail: gdClientEmail,
          privateKey: gdPrivateKey,
          folderId: gdFolderId
        }).catch((gdErr) => console.error("[Google Drive Upload Error]:", gdErr))
      );
    }
  } else {
    console.log("[Google Drive] Credentials not fully configured. Skipping Google Drive upload.");
  }

  // Execute all backup destinations in parallel
  await Promise.allSettled(backupTasks);

  // Clean up temporary local backup file
  try {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log("Temporary local backup file cleaned up successfully.");
    }
  } catch (cleanErr) {
    console.warn("Could not clean up temp backup file:", cleanErr);
  }

  console.log("Backup process completed.");
  await prismaClient.$disconnect();
}

// CLI execution
// Note: when this file is dynamically imported from the bundled (CJS) production
// server, `import.meta.url` is empty and fileURLToPath() throws. Guard against
// that so importing this module for programmatic use (e.g. from server.ts)
// never crashes — only running it directly via `tsx scripts/backup-db.ts` should
// trigger the auto-run.
const nodePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
let modulePath = '';
try {
  modulePath = fileURLToPath(import.meta.url);
} catch {
  // import.meta.url unavailable (e.g. bundled to CJS) — not a direct CLI run.
}
if (nodePath && modulePath && nodePath === modulePath) {
  runBackup();
}

