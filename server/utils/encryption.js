const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

if (KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256-GCM');
}

function encrypt(plainText) {
  if (!plainText) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64')
  };
}

function decrypt(encryptedObj) {
  if (!encryptedObj || !encryptedObj.ciphertext) return null;
  try {
    const iv = Buffer.from(encryptedObj.iv, 'base64');
    const tag = Buffer.from(encryptedObj.tag, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encryptedObj.ciphertext, 'base64'),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return '[DECRYPTION ERROR]';
  }
}

module.exports = { encrypt, decrypt };
