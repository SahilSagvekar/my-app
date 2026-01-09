// lib/encryption.ts
import crypto from "crypto";

// Use a 32-byte key for AES-256
// IMPORTANT: Store this in environment variable in production!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "your-32-character-secret-key!!"; // Must be 32 chars
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM
 * Returns: iv:authTag:encryptedData (base64 encoded)
 */
export function encrypt(text: string): string {
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(
    ALGORITHM, 
    Buffer.from(ENCRYPTION_KEY, "utf-8"), 
    iv
  );
  
  // Encrypt
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  // Format: iv:authTag:encryptedData (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with the encrypt function
 * Input format: iv:authTag:encryptedData (base64 encoded)
 */
export function decrypt(encryptedText: string): string {
  try {
    // Split the components
    const parts = encryptedText.split(":");
    
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted text format");
    }
    
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const encrypted = parts[2];
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM, 
      Buffer.from(ENCRYPTION_KEY, "utf-8"), 
      iv
    );
    
    // Set auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Hash a PIN using bcrypt-like approach with crypto
 * Note: For PINs, we use bcryptjs in the API routes instead
 * This is here as an alternative if needed
 */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(pin, salt, 100000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a PIN against its hash
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const verifyHash = crypto
    .pbkdf2Sync(pin, salt, 100000, 64, "sha512")
    .toString("hex");
  return hash === verifyHash;
}