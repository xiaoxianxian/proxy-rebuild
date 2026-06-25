import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class SecretsManager {
  private encryptionKey: Buffer;

  constructor(secretKey: string) {
    // 如果密钥不够长，用 SHA-256 哈希扩展
    if (secretKey.length < KEY_LENGTH) {
      const hash = crypto.createHash('sha256');
      hash.update(secretKey);
      this.encryptionKey = hash.digest();
    } else {
      this.encryptionKey = Buffer.from(secretKey.slice(0, KEY_LENGTH));
    }
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    // 格式: iv + tag + encrypted
    return iv.toString('hex') + tag.toString('hex') + encrypted;
  }

  decrypt(encrypted: string): string {
    const iv = Buffer.from(encrypted.slice(0, IV_LENGTH * 2), 'hex');
    const tag = Buffer.from(encrypted.slice(IV_LENGTH * 2, IV_LENGTH * 2 + TAG_LENGTH * 2), 'hex');
    const ciphertext = encrypted.slice((IV_LENGTH + TAG_LENGTH) * 2);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
