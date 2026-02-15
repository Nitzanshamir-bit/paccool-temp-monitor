const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CredentialStore {
  constructor() {
    this.storePath = path.join(__dirname, '..', '..', 'data', 'credentials.enc');
    this.encryptionKey = 'paccool-temp-monitor-encryption-key-v1-' + require('os').hostname();

    // Ensure data directory exists
    const dataDir = path.dirname(this.storePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  encrypt(text) {
    // Create a key from the encryption key string (32 bytes for aes-256)
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16); // Initialization vector

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data (IV needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText) {
    // Split IV and encrypted data
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    // Create a key from the encryption key string
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  saveCredentials(email, password) {
    try {
      const data = JSON.stringify({
        email: email,
        password: password,
        savedAt: new Date().toISOString()
      });

      const encrypted = this.encrypt(data);
      fs.writeFileSync(this.storePath, encrypted, 'utf8');

      console.log('[CredentialStore] Credentials saved successfully');
      return { success: true };
    } catch (error) {
      console.error('[CredentialStore] Error saving credentials:', error.message);
      return { success: false, error: error.message };
    }
  }

  getCredentials() {
    try {
      if (!fs.existsSync(this.storePath)) {
        console.log('[CredentialStore] No credentials file found');
        return { success: false, credentials: null };
      }

      const encrypted = fs.readFileSync(this.storePath, 'utf8');
      const decrypted = this.decrypt(encrypted);
      const credentials = JSON.parse(decrypted);

      console.log('[CredentialStore] Credentials retrieved successfully');
      return {
        success: true,
        credentials: {
          email: credentials.email,
          password: credentials.password
        }
      };
    } catch (error) {
      console.error('[CredentialStore] Error retrieving credentials:', error.message);
      return { success: false, credentials: null };
    }
  }

  hasStoredCredentials() {
    try {
      return fs.existsSync(this.storePath);
    } catch (error) {
      return false;
    }
  }

  clearCredentials() {
    try {
      if (fs.existsSync(this.storePath)) {
        fs.unlinkSync(this.storePath);
      }
      console.log('[CredentialStore] Credentials cleared successfully');
      return { success: true };
    } catch (error) {
      console.error('[CredentialStore] Error clearing credentials:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = CredentialStore;
