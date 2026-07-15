import crypto from 'crypto';

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "savdo24-default-encryption-secret-key-32-bytes";
  return crypto.createHash('sha256').update(secret).digest();
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
    return '';
  }
}

export function decryptSecret(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return '';
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
    return '';
  }
}
