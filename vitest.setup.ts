import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Web Crypto API for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  // Use the native Node.js crypto module
  const crypto = await import('node:crypto');
  globalThis.crypto = crypto.webcrypto as Crypto;
}

// Mock localStorage for tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
