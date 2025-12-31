import { invoke } from '@tauri-apps/api/core';

/**
 * Tauri-based storage adapter that replaces localStorage
 * Uses Tauri IPC to read/write files in app data directory
 */
export class TauriStorage {
  static async getItem(key: string): Promise<string | null> {
    try {
      const result = await invoke<string>('read_storage', { key });
      return result === 'null' ? null : result;
    } catch (error) {
      console.error('TauriStorage.getItem error:', error);
      return null;
    }
  }

  static async setItem(key: string, value: string): Promise<void> {
    try {
      await invoke('write_storage', { key, value });
    } catch (error) {
      console.error('TauriStorage.setItem error:', error);
      throw error;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      await invoke('remove_storage', { key });
    } catch (error) {
      console.error('TauriStorage.removeItem error:', error);
    }
  }
}

/**
 * Detect if running in Tauri or web browser
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * Universal storage adapter - uses Tauri storage if available, otherwise localStorage
 */
export const storage = {
  getItem: (key: string): Promise<string | null> => {
    if (isTauri()) {
      return TauriStorage.getItem(key);
    }
    return Promise.resolve(localStorage.getItem(key));
  },

  setItem: (key: string, value: string): Promise<void> => {
    if (isTauri()) {
      return TauriStorage.setItem(key, value);
    }
    localStorage.setItem(key, value);
    return Promise.resolve();
  },

  removeItem: (key: string): Promise<void> => {
    if (isTauri()) {
      return TauriStorage.removeItem(key);
    }
    localStorage.removeItem(key);
    return Promise.resolve();
  }
};
