import { describe, it, expect } from 'vitest';
import {
  bufferToBase64,
  base64ToBuffer,
  generateRecoveryKey,
  parseRecoveryKey,
  deriveKeyFromPassword,
  wrapVaultKey,
  unwrapVaultKey,
} from '../utils/crypto';

describe('bufferToBase64', () => {
  it('should convert Uint8Array to base64 string', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const result = bufferToBase64(input);
    expect(result).toBe('SGVsbG8=');
  });

  it('should handle empty array', () => {
    const input = new Uint8Array([]);
    const result = bufferToBase64(input);
    expect(result).toBe('');
  });

  it('should handle ArrayBuffer', () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const result = bufferToBase64(buffer);
    expect(result).toBe('AQID');
  });
});

describe('base64ToBuffer', () => {
  it('should convert base64 string to Uint8Array', () => {
    const input = 'SGVsbG8=';
    const result = base64ToBuffer(input);
    expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('should handle empty string', () => {
    const input = '';
    const result = base64ToBuffer(input);
    expect(result).toEqual(new Uint8Array([]));
  });

  it('should be reversible with bufferToBase64', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 0]);
    const base64 = bufferToBase64(original);
    const restored = base64ToBuffer(base64);
    expect(restored).toEqual(original);
  });
});

describe('generateRecoveryKey', () => {
  it('should generate a recovery key with correct format', () => {
    const key = generateRecoveryKey();
    // Format: XXXX-XXXX-... (16 groups of 4 hex chars, 64 chars total)
    expect(key).toMatch(/^[A-F0-9]{4}(-[A-F0-9]{4}){15}$/);
  });

  it('should generate unique keys each time', () => {
    const key1 = generateRecoveryKey();
    const key2 = generateRecoveryKey();
    expect(key1).not.toBe(key2);
  });

  it('should generate a key with 64 hex characters total', () => {
    const key = generateRecoveryKey();
    const hexOnly = key.replace(/-/g, '');
    expect(hexOnly).toHaveLength(64);
  });
});

describe('parseRecoveryKey', () => {
  it('should parse a valid recovery key with hyphens', () => {
    const validKey = 'ABCD-1234-EF56-7890-ABCD-1234-EF56-7890-ABCD-1234-EF56-7890-ABCD-1234-EF56-7890';
    const result = parseRecoveryKey(validKey);
    expect(result).toBe('ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890');
  });

  it('should parse a valid recovery key without hyphens', () => {
    const validKey = 'ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890';
    const result = parseRecoveryKey(validKey);
    expect(result).toBe('ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890');
  });

  it('should handle lowercase input', () => {
    const validKey = 'abcd1234ef567890abcd1234ef567890abcd1234ef567890abcd1234ef567890';
    const result = parseRecoveryKey(validKey);
    expect(result).toBe('ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890');
  });

  it('should return null for invalid key (too short)', () => {
    const result = parseRecoveryKey('ABCD-1234');
    expect(result).toBeNull();
  });

  it('should return null for invalid key (invalid characters)', () => {
    const result = parseRecoveryKey('ZZZZ-1234-EF56-7890-ABCD-1234-EF56-7890-ABCD-1234-EF56-7890-ABCD-1234-EF56-7890');
    expect(result).toBeNull();
  });

  it('should handle whitespace in input', () => {
    const validKey = ' ABCD 1234 EF56 7890 ABCD 1234 EF56 7890 ABCD 1234 EF56 7890 ABCD 1234 EF56 7890 ';
    const result = parseRecoveryKey(validKey);
    expect(result).toBe('ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890ABCD1234EF567890');
  });

  it('should work with generated recovery key', () => {
    const generated = generateRecoveryKey();
    const parsed = parseRecoveryKey(generated);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(64);
  });
});

describe('deriveKeyFromPassword', () => {
  const params = {
    memory: 65536,
    iterations: 3,
    parallelism: 1,
    hashLength: 32,
  };

  it('should derive a 32-byte key', async () => {
    const salt = new Uint8Array(16);
    const derivedKey = await deriveKeyFromPassword('testpassword', salt, params);
    expect(derivedKey).toBeInstanceOf(Uint8Array);
    expect(derivedKey.length).toBe(32);
  });

  it('should produce different keys for different passwords', async () => {
    const salt = new Uint8Array(16);
    const key1 = await deriveKeyFromPassword('password1', salt, params);
    const key2 = await deriveKeyFromPassword('password2', salt, params);
    expect(key1).not.toEqual(key2);
  });

  it('should produce different keys for different salts', async () => {
    const salt1 = new Uint8Array(16);
    const salt2 = new Uint8Array(16);
    salt2[0] = 1;
    const key1 = await deriveKeyFromPassword('testpassword', salt1, params);
    const key2 = await deriveKeyFromPassword('testpassword', salt2, params);
    expect(key1).not.toEqual(key2);
  });

  it('should normalize password (lowercase and trim)', async () => {
    const salt = new Uint8Array(16);
    const key1 = await deriveKeyFromPassword('TestPhrase', salt, params);
    const key2 = await deriveKeyFromPassword('testphrase', salt, params);
    const key3 = await deriveKeyFromPassword('  testphrase  ', salt, params);
    expect(key1).toEqual(key2);
    expect(key2).toEqual(key3);
  }, 30000); // Increase timeout for 3 Argon2 derivations

  it('should produce deterministic results', async () => {
    const salt = new Uint8Array(16);
    const key1 = await deriveKeyFromPassword('testpassword', salt, params);
    const key2 = await deriveKeyFromPassword('testpassword', salt, params);
    expect(key1).toEqual(key2);
  });
});

describe('wrapVaultKey and unwrapVaultKey', () => {
  it('should wrap and unwrap vault key correctly', async () => {
    const vaultKey = new Uint8Array(32);
    crypto.getRandomValues(vaultKey);

    const derivedKey = new Uint8Array(32);
    crypto.getRandomValues(derivedKey);

    const wrapped = await wrapVaultKey(vaultKey, derivedKey);
    expect(wrapped.ciphertext).toBeTruthy();
    expect(wrapped.iv).toBeTruthy();
    expect(wrapped.salt).toBeTruthy();

    const unwrapped = await unwrapVaultKey(wrapped, derivedKey);
    expect(unwrapped).toEqual(vaultKey);
  });

  it('should return null for wrong derived key', async () => {
    const vaultKey = new Uint8Array(32);
    crypto.getRandomValues(vaultKey);

    const correctKey = new Uint8Array(32);
    crypto.getRandomValues(correctKey);

    const wrongKey = new Uint8Array(32);
    crypto.getRandomValues(wrongKey);

    const wrapped = await wrapVaultKey(vaultKey, correctKey);
    const unwrapped = await unwrapVaultKey(wrapped, wrongKey);
    expect(unwrapped).toBeNull();
  });

  it('should produce different ciphertexts for same input (random IV)', async () => {
    const vaultKey = new Uint8Array(32);
    crypto.getRandomValues(vaultKey);

    const derivedKey = new Uint8Array(32);
    crypto.getRandomValues(derivedKey);

    const wrapped1 = await wrapVaultKey(vaultKey, derivedKey);
    const wrapped2 = await wrapVaultKey(vaultKey, derivedKey);

    expect(wrapped1.ciphertext).not.toBe(wrapped2.ciphertext);
    expect(wrapped1.iv).not.toBe(wrapped2.iv);
  });
});
