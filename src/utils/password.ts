import "server-only";

/**
 * Password hashing utilities using Web Crypto API (Cloudflare Workers compatible)
 * Uses PBKDF2 which is available in Workers runtime
 */

const ITERATIONS = 100000; // OWASP recommended minimum for PBKDF2
const SALT_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  
  // Convert password to buffer
  const passwordBuffer = new TextEncoder().encode(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LENGTH * 8 // bits
  );
  
  // Combine salt and derived key
  const derivedKey = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + derivedKey.length);
  combined.set(salt, 0);
  combined.set(derivedKey, salt.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
    
    // Extract salt and key
    const salt = combined.slice(0, SALT_LENGTH);
    const storedKey = combined.slice(SALT_LENGTH);
    
    // Hash the provided password with the same salt
    const passwordBuffer = new TextEncoder().encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      KEY_LENGTH * 8
    );
    
    const derivedKey = new Uint8Array(derivedBits);
    
    // Constant-time comparison
    if (storedKey.length !== derivedKey.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < storedKey.length; i++) {
      result |= storedKey[i] ^ derivedKey[i];
    }
    
    return result === 0;
  } catch {
    return false;
  }
}

/**
 * Check if a password meets minimum requirements
 * Returns null if valid, or an error message if invalid
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return "Password is too common. Please choose a stronger password";
  }
  
  return null;
}