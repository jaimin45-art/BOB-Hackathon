const crypto = require('crypto');

// Generate a deterministic 32-byte key from JWT_SECRET or fallback if AES_KEY is not defined
const SECRET_KEY = process.env.AES_KEY 
  ? crypto.createHash('sha256').update(process.env.AES_KEY).digest()
  : crypto.createHash('sha256').update(process.env.JWT_SECRET || 'bob_trust_secret_key_1001').digest();

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypts a text string or object using AES-256-CBC.
 * Returns the IV and ciphertext combined as hex.
 */
function encrypt(val) {
  if (val === null || val === undefined) return val;
  
  // Convert object/array to string
  const text = typeof val === 'object' ? JSON.stringify(val) : String(val);
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Format: iv_hex:ciphertext_hex
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('AES Encryption failed:', err.message);
    return text; // Safe fallback to plain text if error occurs
  }
}

/**
 * Decrypts a combined hex string (iv:ciphertext) back to its original value.
 * Tries to parse back to JSON if it was an object.
 */
function decrypt(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
    return encryptedText;
  }
  
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Attempt to parse JSON if it looks like an object or array
    if ((decrypted.startsWith('{') && decrypted.endsWith('}')) || 
        (decrypted.startsWith('[') && decrypted.endsWith(']'))) {
      return JSON.parse(decrypted);
    }
    
    return decrypted;
  } catch (err) {
    // If decryption fails (e.g. wrong key, modified text, or plain text saved previously),
    // return the original string to maintain robustness
    return encryptedText;
  }
}

module.exports = {
  encrypt,
  decrypt
};
