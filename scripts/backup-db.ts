import { execSync } from 'child_process';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { encryptSecret, decryptSecret } from '../src/lib/crypto';

dotenv.config();

const prismaClient = new PrismaClient();

async function getSetting(key: string): Promise<string | null> {
  try {
    const dbSetting = await prismaClient.setting.findUnique({ where: { key } });
    if (dbSetting) {
      const decrypted = decryptSecret(dbSetting.value);
      if (decrypted) return decrypted;
      return dbSetting.value; // Fallback if not encrypted
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
    
    // AES-256-GCM Encryption
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(fileBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();
    
    const encryptedContent = `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
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

      const backupData = {
        users: await prismaClient.user.findMany(),
        startups: await prismaClient.startup.findMany(),
        ideas: await prismaClient.idea.findMany(),
        reviews: await prismaClient.review.findMany(),
        payments: await prismaClient.payment.findMany(),
        disputes: await prismaClient.dispute.findMany(),
        refreshTokens: await prismaClient.refreshToken.findMany(),
        reports: await prismaClient.report.findMany(),
        settings: await prismaClient.setting.findMany(),
        exportedAt: new Date().toISOString(),
      };

      console.log("Database records retrieved. Generating JSON payload...");
      const jsonString = JSON.stringify(backupData, null, 2);
      fs.writeFileSync(tempFilePath, jsonString);
      uploadContent = jsonString;
      console.log("Local JSON backup generated successfully.");
    } catch (prismaErr) {
      console.error("Prisma Client fallback backup failed:", prismaErr);
      return;
    }
  }

  // Send to Telegram if configured
  await sendToTelegram(tempFilePath, filename);

  // Load S3 settings
  const endpoint = await getSetting("CONTABO_S3_ENDPOINT");
  const accessKeyId = await getSetting("CONTABO_ACCESS_KEY");
  const secretAccessKey = await getSetting("CONTABO_SECRET_KEY");
  const bucketName = await getSetting("CONTABO_BUCKET_NAME");

  // Upload to S3 if configured
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    console.warn("\n[Warning] Contabo S3 credentials are not configured in your settings / .env!");
    console.log(`Local backup file saved at: ${tempFilePath}`);
    console.log("Please configure CONTABO_S3_ENDPOINT, CONTABO_ACCESS_KEY, CONTABO_SECRET_KEY, and CONTABO_BUCKET_NAME to enable cloud backup uploads.");
    await prismaClient.$disconnect();
    return;
  }

  try {
    console.log(`\nInitializing S3 Client connecting to ${endpoint}...`);
    const s3 = new S3Client({
      endpoint,
      region: 'us-east-1', 
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: true 
    });

    console.log(`Uploading "${filename}" to Contabo bucket "${bucketName}"...`);
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: `backups/${filename}`,
      Body: uploadContent,
      ContentType: contentType
    }));

    console.log(`\n🎉 Cloud Upload Succeeded! Backed up to backups/${filename}`);
    
    // Clean up local file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log("Temporary local backup file cleaned up successfully.");
    }
    console.log("Backup process completed successfully.");
  } catch (s3Err) {
    console.error("S3 Upload failed:", s3Err);
  } finally {
    await prismaClient.$disconnect();
  }
}

// CLI execution
if (require.main === module) {
  runBackup();
}

