
export interface PasswordEntry {
  id: string;
  site: string;
  username: string;
  password: string;
  category: 'social' | 'work' | 'finance' | 'other';
  createdAt: number;
}

export interface SecurityConfig {
  questions: [string, string, string];
  answers: [string, string, string]; // Ideally hashed, but we'll use simple storage for this local demo
  isSetup: boolean;
}

export interface MasterPasswordConfig {
  // Wrapped vault keys (encrypted with derived keys)
  wrappedVaultKey_password: EncryptedData;
  wrappedVaultKey_recovery: EncryptedData;

  // Key derivation parameters
  salt: string; // Base64 encoded salt for Argon2id (16 bytes)
  argon2Params: {
    memory: number;      // 65536 KB (64 MB)
    iterations: number;  // 3
    parallelism: number; // 1
    hashLength: number;  // 32
  };

  isSetup: boolean;
}

// EncryptedData already exists in crypto.ts, reference it here
export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
}

export interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number | null;
}

export enum AppView {
  SETUP = 'SETUP',
  LOCK = 'LOCK',
  DASHBOARD = 'DASHBOARD'
}
