import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedData {
  encryptedValue: string;
  iv: string;
  authTag: string;
}

class EncryptionService {
  private masterKey: Buffer;

  constructor() {
    const keyHex = process.env.MASTER_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
      throw new Error('Invalid MASTER_ENCRYPTION_KEY: must be 64 hex characters (32 bytes)');
    }
    this.masterKey = Buffer.from(keyHex, 'hex');
  }

  /**
   * Derive a project-specific Data Encryption Key (DEK) from the master key
   */
  private deriveProjectKey(projectId: string): Buffer {
    return Buffer.from(crypto.hkdfSync(
      'sha256',
      this.masterKey,
      projectId,
      'secret-vault-dek',
      32
    ));
  }

  /**
   * Encrypt a secret value
   */
  encrypt(plaintext: string, projectId: string): EncryptedData {
    const key = this.deriveProjectKey(projectId);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return {
      encryptedValue: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt a secret value
   */
  decrypt(data: EncryptedData, projectId: string): string {
    const key = this.deriveProjectKey(projectId);
    const iv = Buffer.from(data.iv, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data.encryptedValue, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export const encryptionService = new EncryptionService();
