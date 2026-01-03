/**
 * Cryptographic utilities for secure password storage
 * Uses Web Crypto API with AES-256-GCM encryption
 */

import { argon2id } from '@noble/hashes/argon2.js';

export interface EncryptedData {
  ciphertext: string; // Base64 encoded encrypted data
  iv: string;         // Base64 encoded initialization vector
  salt: string;       // Base64 encoded salt for key derivation
}

const PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum
const KEY_LENGTH = 256; // AES-256

const ARGON2_PARAMS = {
  memory: 65536,     // 64 MB
  iterations: 3,     // OWASP recommended
  parallelism: 1,    // Browser limitation
  hashLength: 32     // 256-bit key
};

/**
 * Derives an AES-256 encryption key from security answers using PBKDF2
 */
export async function deriveKeyFromAnswers(answers: [string, string, string], salt: Uint8Array): Promise<CryptoKey> {
  // Combine and normalize answers to create passphrase
  const passphrase = answers
    .map(a => a.toLowerCase().trim())
    .join('::'); // Delimiter to prevent collision attacks

  const encoder = new TextEncoder();
  const passphraseBuffer = encoder.encode(passphrase);

  // Import passphrase as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-256-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-256-GCM
 */
export async function encrypt(data: any, answers: [string, string, string]): Promise<EncryptedData> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  // Derive encryption key
  const key = await deriveKeyFromAnswers(answers, salt);

  // Encrypt the data
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBuffer
  );

  // Convert to base64 for storage
  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt)
  };
}

/**
 * Decrypts data using AES-256-GCM
 */
export async function decrypt(encryptedData: EncryptedData, answers: [string, string, string]): Promise<any> {
  // Convert from base64
  const ciphertextBuffer = base64ToBuffer(encryptedData.ciphertext);
  const iv = base64ToBuffer(encryptedData.iv);
  const salt = base64ToBuffer(encryptedData.salt);

  // Derive decryption key
  const key = await deriveKeyFromAnswers(answers, salt);

  try {
    // Decrypt the data
    const dataBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(dataBuffer);
    return JSON.parse(jsonString);
  } catch (error) {
    // Decryption failed - wrong answers or corrupted data
    throw new Error('Decryption failed: Invalid credentials or corrupted data');
  }
}

/**
 * Generates a random salt for initial setup
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Derives a 256-bit key from password using Argon2id
 * @param password - Master password or recovery key
 * @param salt - 16-byte salt
 * @param params - Argon2 parameters
 * @returns 32-byte derived key
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  params: { memory: number; iterations: number; parallelism: number; hashLength: number }
): Promise<Uint8Array> {
  // Normalize password (lowercase, trim)
  const normalized = password.toLowerCase().trim();

  // Derive key using Argon2id
  const derivedKey = argon2id(normalized, salt, {
    t: params.iterations,
    m: params.memory,
    p: params.parallelism,
    dkLen: params.hashLength
  });

  return derivedKey;
}

/**
 * Wraps (encrypts) the vault key with a derived key
 * @param vaultKey - 32-byte random vault key
 * @param derivedKey - Key derived from password via Argon2id
 * @returns EncryptedData structure
 */
export async function wrapVaultKey(
  vaultKey: Uint8Array,
  derivedKey: Uint8Array
): Promise<EncryptedData> {
  // Convert Uint8Array to CryptoKey
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    derivedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Generate random salt for this encryption (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Encrypt vault key
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    vaultKey
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt)
  };
}

/**
 * Unwraps (decrypts) the vault key with a derived key
 * @param wrappedKey - EncryptedData containing wrapped vault key
 * @param derivedKey - Key derived from user input
 * @returns Vault key (32 bytes) or null if decryption fails
 */
export async function unwrapVaultKey(
  wrappedKey: EncryptedData,
  derivedKey: Uint8Array
): Promise<Uint8Array | null> {
  try {
    // Convert Uint8Array to CryptoKey
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      derivedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Convert from base64
    const ciphertextBuffer = base64ToBuffer(wrappedKey.ciphertext);
    const iv = base64ToBuffer(wrappedKey.iv);

    // Decrypt vault key
    const vaultKeyBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertextBuffer
    );

    return new Uint8Array(vaultKeyBuffer);
  } catch (error) {
    // Decryption failed (wrong password)
    return null;
  }
}

// Helper functions for base64 encoding/decoding
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a cryptographically random recovery key
 * @returns Formatted recovery key (XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX)
 */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  // Convert to hex string
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  // Format as 8 groups of 4 characters
  const groups = [];
  for (let i = 0; i < hex.length; i += 4) {
    groups.push(hex.slice(i, i + 4));
  }

  return groups.join('-');
}

/**
 * Parses recovery key from user input (strips hyphens, validates)
 * @returns Normalized hex string or null if invalid
 */
export function parseRecoveryKey(input: string): string | null {
  // Remove hyphens and whitespace
  const normalized = input.replace(/[-\s]/g, '').toUpperCase();

  // Validate: must be 64 hex characters
  if (!/^[A-F0-9]{64}$/.test(normalized)) {
    return null;
  }

  return normalized;
}
