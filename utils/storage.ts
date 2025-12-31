
import { SecurityConfig, PasswordEntry, LockoutState } from '../types';
import { encrypt, decrypt } from './crypto';
import { storage } from './tauriStorage';

const STORAGE_KEYS = {
  CONFIG: 'cipherguard_config',
  PASSWORDS: 'cipherguard_vault',
  LOCKOUT: 'cipherguard_lockout'
};

// ============================================================================
// Security Config Storage (contains questions + HASHED answers for verification)
// ============================================================================

/**
 * Hash security answers for storage (SHA-256)
 * We store hashed answers for verification, but use raw answers for encryption
 */
async function hashAnswers(answers: [string, string, string]): Promise<[string, string, string]> {
  const normalized = answers.map(a => a.toLowerCase().trim());
  const hashed = await Promise.all(
    normalized.map(async (answer) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(answer);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    })
  );
  return hashed as [string, string, string];
}

/**
 * Save security config with hashed answers
 */
export async function saveSecurityConfig(config: SecurityConfig, rawAnswers: [string, string, string]) {
  const hashedAnswers = await hashAnswers(rawAnswers);
  const configToStore = {
    ...config,
    answers: hashedAnswers
  };
  await storage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(configToStore));
}

/**
 * Get security config (contains hashed answers)
 */
export const getSecurityConfig = async (): Promise<SecurityConfig | null> => {
  const stored = await storage.getItem(STORAGE_KEYS.CONFIG);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

/**
 * Verify if provided answers match stored hashed answers
 */
export async function verifyAnswers(providedAnswers: [string, string, string], config: SecurityConfig): Promise<boolean> {
  const hashedProvided = await hashAnswers(providedAnswers);
  return hashedProvided.every((hash, idx) => hash === config.answers[idx]);
}

// ============================================================================
// Encrypted Password Vault Storage (AES-256-GCM encrypted)
// ============================================================================

/**
 * Save encrypted password vault
 * Requires the user's raw security answers to derive encryption key
 */
export async function savePasswords(passwords: PasswordEntry[], answers: [string, string, string]) {
  const encryptedData = await encrypt(passwords, answers);
  await storage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(encryptedData));
}

/**
 * Load and decrypt password vault
 * Requires the user's raw security answers to derive decryption key
 */
export async function getPasswords(answers: [string, string, string]): Promise<PasswordEntry[]> {
  const stored = await storage.getItem(STORAGE_KEYS.PASSWORDS);
  if (!stored) return [];

  try {
    const encryptedData = JSON.parse(stored);
    const decrypted = await decrypt(encryptedData, answers);
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt password vault:', error);
    return [];
  }
}

// ============================================================================
// Lockout State (stored in plaintext - not sensitive)
// ============================================================================

export const getLockoutState = async (): Promise<LockoutState> => {
  const stored = await storage.getItem(STORAGE_KEYS.LOCKOUT);
  if (!stored) return { failedAttempts: 0, lockoutUntil: null };
  try {
    return JSON.parse(stored);
  } catch {
    return { failedAttempts: 0, lockoutUntil: null };
  }
};

export const saveLockoutState = async (state: LockoutState) => {
  await storage.setItem(STORAGE_KEYS.LOCKOUT, JSON.stringify(state));
};

// ============================================================================
// Utility Functions
// ============================================================================

export const clearAllData = async () => {
  await Promise.all(
    Object.values(STORAGE_KEYS).map(key => storage.removeItem(key))
  );
};
