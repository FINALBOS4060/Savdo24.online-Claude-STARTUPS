import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { decryptSecret } from '../src/lib/crypto';
import { execSync } from 'child_process';

dotenv.config();

const prismaClient = new PrismaClient();

async function getSetting(key: string): Promise<string | null> {
  try {
    const dbSetting = await prismaClient.setting.findUnique({ where: { key } });
    if (dbSetting) {
      const decrypted = decryptSecret(dbSetting.value);
      if (decrypted) return decrypted;
      return dbSetting.value;
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

async function getMessageFromTelegram(botToken: string, chatId: string, messageId: string) {
  // Telegram Bot API does not have a "getMessage" by ID. 
  // However, we can use "forwardMessage" to ourselves or a dummy chat to check if it exists and get its content.
  // Or simpler: The backup script sends a document. We can't "get" it by ID directly via Bot API without getUpdates.
  // BUT, if we have the file_id, we can download it.
  // Wait, the message_id we saved is for the message containing the document.
  // To get the file_id from a message_id, we'd normally need getUpdates or a user-bot.
  
  // Alternative: The backup script could save the FILE_ID instead of MESSAGE_ID.
  // File IDs are persistent for the same bot.
  console.log(`[Telegram] Attempting to find backup via message_id: ${messageId} in chat: ${chatId}`);
  // Since we can't easily get the message content by ID, let's assume we saved the FILE_ID instead, 
  // or that we are using a method that can retrieve it.
  
  // If we can't get it by ID, and the DB is empty, auto-restore is hard.
  // Let's check if there is any other way. 
  // Actually, I will modify backup-db.ts to also save the FILE_ID to a local file 'last_backup.json' 
  // as a fallback for auto-restore when the DB is wiped.
  return null;
}

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

export async function restoreFromLatestBackup(manualFileId?: string) {
  console.log("=== Savdo24 Database Restore Process ===");
  
  const botToken = await getSetting("TELEGRAM_BOT_TOKEN");
  const chatId = await getSetting("TELEGRAM_BACKUP_CHAT_ID");
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const dbUrl = process.env.DATABASE_URL;

  if (!botToken || !encryptionKey || !dbUrl) {
    console.error("[Restore] Missing required configuration (TELEGRAM_BOT_TOKEN, ENCRYPTION_KEY, or DATABASE_URL).");
    return;
  }

  let fileId = manualFileId;

  if (!fileId) {
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

  if (!fileId) {
    console.error("[Restore] No backup fileId found in Settings or local fallback. Auto-restore aborted.");
    return;
  }

  const encryptedBuffer = await downloadFromTelegram(botToken, fileId);
  if (!encryptedBuffer) {
    console.error("[Restore] Failed to download backup file from Telegram.");
    return;
  }

  console.log("[Restore] Decrypting backup...");
  const decryptedBuffer = await decryptBackup(encryptedBuffer.toString(), encryptionKey);
  if (!decryptedBuffer) {
    console.error("[Restore] Failed to decrypt backup.");
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
      const tables = [
        { name: 'user', data: data.users },
        { name: 'startup', data: data.startups },
        { name: 'idea', data: data.ideas },
        { name: 'review', data: data.reviews },
        { name: 'payment', data: data.payments },
        { name: 'dispute', data: data.disputes },
        { name: 'refreshToken', data: data.refreshTokens },
        { name: 'report', data: data.reports },
        { name: 'setting', data: data.settings }
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
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const manualFileId = args[0];
  restoreFromLatestBackup(manualFileId).then(() => prismaClient.$disconnect());
}
