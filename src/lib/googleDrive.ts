import { google } from "googleapis";
import { Readable } from "stream";
import { logger } from "./logger";
import { getErrorMessage } from "./pure-helpers";

interface GoogleDriveConfig {
  clientEmail?: string | null;
  privateKey?: string | null;
  folderId?: string | null;
}

export async function getDriveClient(config: GoogleDriveConfig) {
  const { clientEmail, privateKey } = config;
  if (!clientEmail || !privateKey) {
    return null;
  }

  const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedPrivateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]
  });

  return google.drive({ version: "v3", auth });
}

export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  config: GoogleDriveConfig
): Promise<string | null> {
  try {
    const drive = await getDriveClient(config);
    if (!drive) {
      logger.info("[Google Drive] Credentials not fully provided. Skipping Drive backup.");
      return null;
    }

    const fileMetadata: any = {
      name: fileName
    };

    if (config.folderId) {
      fileMetadata.parents = [config.folderId];
    }

    const media = {
      mimeType: "application/octet-stream",
      body: Readable.from(fileBuffer)
    };

    logger.info({ fileName }, "[Google Drive] Uploading encrypted backup to Google Drive...");
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name, webViewLink"
    });

    if (response.data.id) {
      logger.info(
        { fileId: response.data.id, fileName: response.data.name },
        "🎉 [Google Drive] Backup uploaded successfully!"
      );
      return response.data.id;
    }
  } catch (err: unknown) {
    logger.error({ err: getErrorMessage(err) }, "[Google Drive] Upload failed");
  }
  return null;
}

export async function listBackupsFromGoogleDrive(
  config: GoogleDriveConfig
): Promise<Array<{ id: string; name: string; createdTime?: string }>> {
  try {
    const drive = await getDriveClient(config);
    if (!drive) return [];

    let query = "trashed = false";
    if (config.folderId) {
      query += ` and '${config.folderId}' in parents`;
    }

    const res = await drive.files.list({
      q: query,
      fields: "files(id, name, createdTime)",
      orderBy: "createdTime desc"
    });

    return (res.data.files || []).map((f) => ({
      id: f.id || "",
      name: f.name || "",
      createdTime: f.createdTime || ""
    }));
  } catch (err: unknown) {
    logger.error({ err: getErrorMessage(err) }, "[Google Drive] List backups failed");
    return [];
  }
}

// MUHIM: avval faqat listBackupsFromGoogleDrive() bor edi (fayllarni sanab
// chiqadi), lekin haqiqiy faylni yuklab olish funksiyasi umuman yo'q edi —
// ya'ni Google Drive'ga zaxira yuklanardi, lekin undan HECH QACHON tiklab
// bo'lmasdi (restore-db.ts bu manbani umuman ko'rmasdi). Endi shu funksiya
// orqali kerakli faylni Buffer sifatida yuklab olish mumkin.
export async function downloadFromGoogleDrive(
  fileId: string,
  config: GoogleDriveConfig
): Promise<Buffer | null> {
  try {
    const drive = await getDriveClient(config);
    if (!drive) return null;

    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    return Buffer.from(res.data as ArrayBuffer);
  } catch (err: unknown) {
    logger.error({ err: getErrorMessage(err), fileId }, "[Google Drive] Download failed");
    return null;
  }
}
