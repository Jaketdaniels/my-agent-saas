import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "@/types/cloudflare";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds
const ATTEMPT_WINDOW = 60 * 60; // 1 hour in seconds

interface LoginAttemptRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
}

/**
 * Get the key for storing login attempts
 */
function getLoginAttemptsKey(identifier: string): string {
  return `login-attempts:${identifier}`;
}

/**
 * Check if an account is locked due to too many failed attempts
 */
export async function isAccountLocked(email: string): Promise<{ locked: boolean; minutesRemaining?: number }> {
  const { env } = getCloudflareContext();
  const kv = (env as CloudflareEnv).NEXT_INC_CACHE_KV;
  
  if (!kv) {
    console.error('[Login Attempts] KV store not available');
    return { locked: false };
  }

  const key = getLoginAttemptsKey(email.toLowerCase());
  const recordStr = await kv.get(key);
  
  if (!recordStr) {
    return { locked: false };
  }

  const record: LoginAttemptRecord = JSON.parse(recordStr);
  
  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    const minutesRemaining = Math.ceil((record.lockedUntil - Date.now()) / 1000 / 60);
    return { locked: true, minutesRemaining };
  }

  return { locked: false };
}

/**
 * Record a failed login attempt
 */
export async function recordFailedAttempt(email: string): Promise<{ lockout: boolean; attemptsRemaining: number }> {
  const { env } = getCloudflareContext();
  const kv = (env as CloudflareEnv).NEXT_INC_CACHE_KV;
  
  if (!kv) {
    console.error('[Login Attempts] KV store not available');
    return { lockout: false, attemptsRemaining: MAX_ATTEMPTS };
  }

  const key = getLoginAttemptsKey(email.toLowerCase());
  const now = Date.now();
  
  // Get existing record
  const recordStr = await kv.get(key);
  let record: LoginAttemptRecord;
  
  if (recordStr) {
    record = JSON.parse(recordStr);
    
    // Reset if outside the attempt window
    if (now - record.lastAttempt > ATTEMPT_WINDOW * 1000) {
      record = {
        attempts: 1,
        lastAttempt: now,
      };
    } else {
      record.attempts++;
      record.lastAttempt = now;
    }
  } else {
    record = {
      attempts: 1,
      lastAttempt: now,
    };
  }

  // Check if we should lock the account
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + (LOCKOUT_DURATION * 1000);
    
    await kv.put(
      key,
      JSON.stringify(record),
      {
        expirationTtl: LOCKOUT_DURATION + 60, // Add buffer for cleanup
      }
    );
    
    return { lockout: true, attemptsRemaining: 0 };
  }

  // Store the updated record
  await kv.put(
    key,
    JSON.stringify(record),
    {
      expirationTtl: ATTEMPT_WINDOW,
    }
  );

  return { 
    lockout: false, 
    attemptsRemaining: MAX_ATTEMPTS - record.attempts 
  };
}

/**
 * Clear login attempts after successful login
 */
export async function clearLoginAttempts(email: string): Promise<void> {
  const { env } = getCloudflareContext();
  const kv = (env as CloudflareEnv).NEXT_INC_CACHE_KV;
  
  if (!kv) {
    console.error('[Login Attempts] KV store not available');
    return;
  }

  const key = getLoginAttemptsKey(email.toLowerCase());
  await kv.delete(key);
}

/**
 * Get current attempt count for an email
 */
export async function getAttemptCount(email: string): Promise<number> {
  const { env } = getCloudflareContext();
  const kv = (env as CloudflareEnv).NEXT_INC_CACHE_KV;
  
  if (!kv) {
    return 0;
  }

  const key = getLoginAttemptsKey(email.toLowerCase());
  const recordStr = await kv.get(key);
  
  if (!recordStr) {
    return 0;
  }

  const record: LoginAttemptRecord = JSON.parse(recordStr);
  
  // Reset if outside window
  if (Date.now() - record.lastAttempt > ATTEMPT_WINDOW * 1000) {
    return 0;
  }

  return record.attempts;
}
