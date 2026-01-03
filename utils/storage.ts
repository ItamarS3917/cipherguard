
import { MasterPasswordConfig, PasswordEntry, LockoutState } from '../types';
import { deriveKeyFromPassword, wrapVaultKey, unwrapVaultKey, parseRecoveryKey, base64ToBuffer, bufferToBase64 } from './crypto';
import { storage } from './tauriStorage';

const STORAGE_KEYS = {
  CONFIG: 'cipherguard_master_config',  // NEW - changed from cipherguard_config
  PASSWORDS: 'cipherguard_vault',       // Unchanged
  LOCKOUT: 'cipherguard_lockout'        // Unchanged
};

// ============================================================================
// Master Password Config Storage
// ============================================================================

/**
 * Save master password configuration with wrapped vault keys
 */
export async function saveMasterPasswordConfig(
  masterPassword: string,
  recoveryKey: string,
  vaultKey: Uint8Array
): Promise<void> {
  // Generate random salt for Argon2id (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Define Argon2 parameters
  const argon2Params = {
    memory: 65536,      // 64 MB
    iterations: 3,      // OWASP recommended
    parallelism: 1,     // Browser limitation
    hashLength: 32      // 256-bit key
  };

  // Derive keys from both master password and recovery key
  const passwordDerivedKey = await deriveKeyFromPassword(masterPassword, salt, argon2Params);
  const recoveryDerivedKey = await deriveKeyFromPassword(recoveryKey, salt, argon2Params);

  // Wrap vault key with both derived keys
  const wrappedVaultKey_password = await wrapVaultKey(vaultKey, passwordDerivedKey);
  const wrappedVaultKey_recovery = await wrapVaultKey(vaultKey, recoveryDerivedKey);

  // Create config object
  const config: MasterPasswordConfig = {
    wrappedVaultKey_password,
    wrappedVaultKey_recovery,
    salt: bufferToBase64(salt),
    argon2Params,
    isSetup: true
  };

  // Save to storage
  await storage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
}

/**
 * Get master password configuration from storage
 */
export async function getMasterPasswordConfig(): Promise<MasterPasswordConfig | null> {
  const stored = await storage.getItem(STORAGE_KEYS.CONFIG);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Authenticate user and get vault key
 * Tries both master password and recovery key paths
 */
export async function authenticateAndGetVaultKey(
  input: string,
  config: MasterPasswordConfig
): Promise<{ success: boolean; vaultKey?: Uint8Array; error?: string }> {
  // Parse input (handle recovery key formatting)
  const normalizedInput = parseRecoveryKey(input) || input;

  // Convert salt from base64
  const salt = base64ToBuffer(config.salt);

  // Derive key from input
  const derivedKey = await deriveKeyFromPassword(normalizedInput, salt, config.argon2Params);

  // Try to unwrap vault key with password path
  let vaultKey = await unwrapVaultKey(config.wrappedVaultKey_password, derivedKey);
  if (vaultKey) {
    return { success: true, vaultKey };
  }

  // Try to unwrap vault key with recovery path
  vaultKey = await unwrapVaultKey(config.wrappedVaultKey_recovery, derivedKey);
  if (vaultKey) {
    return { success: true, vaultKey };
  }

  // Both failed
  return {
    success: false,
    error: 'Invalid master password or recovery key'
  };
}

// ============================================================================
// Encrypted Password Vault Storage (AES-256-GCM encrypted)
// ============================================================================

/**
 * Save encrypted password vault
 * @param passwords - Array of password entries
 * @param vaultKey - 32-byte vault key (from authentication)
 */
export async function savePasswords(
  passwords: PasswordEntry[],
  vaultKey: Uint8Array
): Promise<void> {
  // Import vaultKey as CryptoKey
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    vaultKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate IV and salt
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Encrypt passwords
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(passwords));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  );

  // Store encrypted data
  const encryptedData = {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt)
  };

  await storage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(encryptedData));
}

/**
 * Load and decrypt password vault
 * @param vaultKey - 32-byte vault key (from authentication)
 */
export async function getPasswords(vaultKey: Uint8Array): Promise<PasswordEntry[]> {
  const stored = await storage.getItem(STORAGE_KEYS.PASSWORDS);
  if (!stored) return [];

  try {
    const encryptedData = JSON.parse(stored);

    // Import vaultKey as CryptoKey
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      vaultKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    const ciphertextBuffer = base64ToBuffer(encryptedData.ciphertext);
    const iv = base64ToBuffer(encryptedData.iv);

    const dataBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(dataBuffer);
    return JSON.parse(jsonString);
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
