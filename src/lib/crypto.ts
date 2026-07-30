import crypto from 'crypto';

// Development rejimida ENCRYPTION_KEY sozlanmagan bo'lsa, JWT_SECRET bilan bir xil
// naqshda vaqtinchalik kalit generatsiya qilamiz (faqat shu jarayon uchun keshlanadi,
// aks holda encrypt/decrypt har safar boshqa kalit olib, deshifrlash doim ishlamay qolardi).
let cachedDevKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (secret) {
    return crypto.createHash('sha256').update(secret).digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL ERROR: ENCRYPTION_KEY is not defined in environment variables.");
  }

  if (!cachedDevKey) {
    console.warn("⚠️ ENCRYPTION_KEY topilmadi — faqat shu sessiya uchun tasodifiy vaqtinchalik kalit generatsiya qilindi (development rejimi).");
    cachedDevKey = crypto.randomBytes(32);
  }
  return cachedDevKey;
}

export function encryptSecret(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // GCM standard IV is 12 bytes
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${tag}`;
  } catch (err) {
    console.error("Encryption failed:", err);
    throw new Error(`Encryption failed: ${(err as Error).message}`);
  }
}

export function decryptSecret(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted format. Expected iv:encrypted:tag");
    }
    const [ivHex, encryptedHex, tagHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error(`Decryption failed: ${(err as Error).message}`);
  }
}
