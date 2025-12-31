# Desktop Executable with Tauri Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert CipherGuard web app into a native macOS desktop application executable

**Architecture:** Wrap the existing React/Vite frontend with Tauri's Rust backend. Replace localStorage with Tauri's filesystem API for encrypted data persistence. Keep all React components and crypto logic intact. Use Tauri IPC for secure frontend-backend communication.

**Tech Stack:** Tauri 2.x, Rust (backend), React 19 (frontend), TypeScript, Vite 6, Tauri's fs API

---

## Task 1: Install Tauri CLI and Initialize Project

**Files:**
- Modify: `package.json`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`

**Step 1: Install Tauri CLI as dev dependency**

Run: `npm install --save-dev @tauri-apps/cli`

Expected: Package added to devDependencies

**Step 2: Initialize Tauri in the project**

Run: `npx tauri init`

Answer prompts:
- App name: `CipherGuard`
- Window title: `CipherGuard Local Vault`
- Web assets location: `../dist`
- Dev server URL: `http://localhost:3000`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

Expected: Creates `src-tauri/` directory with Rust backend

**Step 3: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

**Step 4: Verify Tauri initialization**

Run: `npm run tauri:dev`

Expected: Desktop window opens showing the web app (using localStorage still)

**Step 5: Commit**

```bash
git add package.json package-lock.json src-tauri/
git commit -m "feat: initialize Tauri for desktop app"
```

---

## Task 2: Configure Tauri Permissions and File System Access

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`

**Step 1: Update Cargo.toml dependencies**

Add to `src-tauri/Cargo.toml` dependencies section:

```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-fs = "2"
```

**Step 2: Update tauri.conf.json for file system access**

In `src-tauri/tauri.conf.json`, update the `plugins` section:

```json
{
  "plugins": {
    "fs": {
      "scope": [
        "$APPDATA/*",
        "$APPDATA/**/*"
      ]
    }
  }
}
```

**Step 3: Update tauri.conf.json app identifier**

```json
{
  "identifier": "com.cipherguard.vault"
}
```

**Step 4: Register filesystem plugin in main.rs**

Modify `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 5: Verify Tauri builds with new dependencies**

Run: `cd src-tauri && cargo build`

Expected: Rust compilation succeeds

**Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/src/main.rs
git commit -m "feat: configure Tauri fs permissions and plugins"
```

---

## Task 3: Create Tauri IPC Commands for File Operations

**Files:**
- Create: `src-tauri/src/storage.rs`
- Modify: `src-tauri/src/main.rs`

**Step 1: Create storage module**

Create `src-tauri/src/storage.rs`:

```rust
use tauri::{AppHandle, Manager};
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn read_storage(key: String, app: AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    let file_path = app_data_dir.join(format!("{}.json", key));

    if !file_path.exists() {
        return Ok(String::from("null"));
    }

    fs::read_to_string(file_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_storage(key: String, value: String, app: AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| e.to_string())?;

    let file_path = app_data_dir.join(format!("{}.json", key));

    fs::write(file_path, value)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_storage(key: String, app: AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    let file_path = app_data_dir.join(format!("{}.json", key));

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

**Step 2: Register commands in main.rs**

Update `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod storage;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            storage::read_storage,
            storage::write_storage,
            storage::remove_storage
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Verify Rust compilation**

Run: `cd src-tauri && cargo build`

Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add src-tauri/src/storage.rs src-tauri/src/main.rs
git commit -m "feat: add Tauri IPC commands for file storage"
```

---

## Task 4: Create TypeScript Wrapper for Tauri Storage API

**Files:**
- Create: `utils/tauriStorage.ts`

**Step 1: Install Tauri API package**

Run: `npm install @tauri-apps/api`

Expected: Package installed

**Step 2: Create Tauri storage wrapper**

Create `utils/tauriStorage.ts`:

```typescript
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
```

**Step 3: Commit**

```bash
git add utils/tauriStorage.ts package.json package-lock.json
git commit -m "feat: create Tauri storage wrapper with fallback"
```

---

## Task 5: Migrate storage.ts to Use Tauri Storage

**Files:**
- Modify: `utils/storage.ts`

**Step 1: Import storage adapter**

Add to top of `utils/storage.ts`:

```typescript
import { storage } from './tauriStorage';
```

**Step 2: Replace localStorage.getItem calls**

Find line 49-50:
```typescript
export const getSecurityConfig = (): SecurityConfig | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
```

Replace with:
```typescript
export const getSecurityConfig = async (): Promise<SecurityConfig | null> => {
  const stored = await storage.getItem(STORAGE_KEYS.CONFIG);
```

**Step 3: Replace localStorage.setItem in saveSecurityConfig**

Find line 42:
```typescript
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(configToStore));
```

Replace with:
```typescript
  await storage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(configToStore));
```

**Step 4: Replace localStorage in savePasswords**

Find line 76:
```typescript
  localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(encryptedData));
```

Replace with:
```typescript
  await storage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(encryptedData));
```

**Step 5: Replace localStorage in getPasswords**

Find line 84:
```typescript
  const stored = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
```

Replace with:
```typescript
  const stored = await storage.getItem(STORAGE_KEYS.PASSWORDS);
```

**Step 6: Replace localStorage in getLockoutState**

Find lines 101-103:
```typescript
export const getLockoutState = (): LockoutState => {
  const stored = localStorage.getItem(STORAGE_KEYS.LOCKOUT);
```

Replace with:
```typescript
export const getLockoutState = async (): Promise<LockoutState> => {
  const stored = await storage.getItem(STORAGE_KEYS.LOCKOUT);
```

**Step 7: Replace localStorage in saveLockoutState**

Find lines 111-112:
```typescript
export const saveLockoutState = (state: LockoutState) => {
  localStorage.setItem(STORAGE_KEYS.LOCKOUT, JSON.stringify(state));
```

Replace with:
```typescript
export const saveLockoutState = async (state: LockoutState) => {
  await storage.setItem(STORAGE_KEYS.LOCKOUT, JSON.stringify(state));
```

**Step 8: Replace localStorage in clearAllData**

Find lines 119-121:
```typescript
export const clearAllData = () => {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
};
```

Replace with:
```typescript
export const clearAllData = async () => {
  await Promise.all(
    Object.values(STORAGE_KEYS).map(key => storage.removeItem(key))
  );
};
```

**Step 9: Commit**

```bash
git add utils/storage.ts
git commit -m "feat: migrate storage.ts to async Tauri storage"
```

---

## Task 6: Update App.tsx to Handle Async Storage

**Files:**
- Modify: `App.tsx`

**Step 1: Read current App.tsx**

Run: `cat App.tsx | head -50`

Expected: See current implementation

**Step 2: Update useEffect for config loading**

Find the useEffect that loads security config (around line 20-30).

Change from:
```typescript
const config = getSecurityConfig();
```

To:
```typescript
getSecurityConfig().then(config => {
  if (config) {
    setCurrentView('LOCK');
  } else {
    setCurrentView('SETUP');
  }
});
```

**Step 3: Update lock screen verification handler**

Find the handleUnlock function that calls `verifyAnswers`.

Wrap the `getPasswords` call in proper async handling:
```typescript
const passwords = await getPasswords(rawAnswers);
```

**Step 4: Update lockout state loading**

Find where `getLockoutState()` is called.

Change to:
```typescript
const lockoutState = await getLockoutState();
```

**Step 5: Update all saveLockoutState calls**

Find all `saveLockoutState()` calls and add `await`:
```typescript
await saveLockoutState(state);
```

**Step 6: Verify TypeScript compilation**

Run: `npm run build`

Expected: No TypeScript errors

**Step 7: Commit**

```bash
git add App.tsx
git commit -m "feat: update App.tsx for async storage operations"
```

---

## Task 7: Update React Components for Async Storage

**Files:**
- Modify: `components/SetupScreen.tsx`
- Modify: `components/LockScreen.tsx`
- Modify: `components/Dashboard.tsx`

**Step 1: Update SetupScreen.tsx**

Find where `saveSecurityConfig` is called.

Change to:
```typescript
await saveSecurityConfig(config, rawAnswers);
```

**Step 2: Update LockScreen.tsx**

Find where `verifyAnswers` and `getLockoutState` are called.

Add `await` to async calls:
```typescript
const lockout = await getLockoutState();
const isValid = await verifyAnswers(providedAnswers, config);
```

**Step 3: Update Dashboard.tsx**

Find where `savePasswords` is called.

Change to:
```typescript
await savePasswords(updatedPasswords, answers);
```

**Step 4: Verify TypeScript compilation**

Run: `npm run build`

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add components/
git commit -m "feat: update components for async storage"
```

---

## Task 8: Configure Tauri Window Settings

**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Update window configuration**

In `src-tauri/tauri.conf.json`, find the `windows` section and update:

```json
{
  "app": {
    "windows": [
      {
        "title": "CipherGuard Local Vault",
        "width": 900,
        "height": 700,
        "resizable": true,
        "fullscreen": false,
        "center": true,
        "minWidth": 600,
        "minHeight": 500
      }
    ]
  }
}
```

**Step 2: Update app metadata**

```json
{
  "productName": "CipherGuard",
  "version": "1.0.0"
}
```

**Step 3: Test window opens correctly**

Run: `npm run tauri:dev`

Expected: Desktop window opens with correct size and title

**Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat: configure Tauri window settings"
```

---

## Task 9: Handle Environment Variables in Tauri

**Files:**
- Modify: `vite.config.ts`
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Update vite.config.ts for Tauri**

Replace current content with:

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Tauri expects a static server in dev mode
    const host = process.env.TAURI_DEV_HOST || 'localhost';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        strictPort: true,
      },
      // Prevent vite from obscuring rust errors
      clearScreen: false,
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Build configuration for Tauri
      build: {
        target: 'esnext',
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
      }
    };
});
```

**Step 2: Verify dev server works**

Run: `npm run tauri:dev`

Expected: App opens and Gemini API still works

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: update vite config for Tauri compatibility"
```

---

## Task 10: Test Desktop App Functionality

**Files:**
- None (testing phase)

**Step 1: Clean any existing localStorage data**

Open browser DevTools → Application → Local Storage → Clear all

**Step 2: Start Tauri dev mode**

Run: `npm run tauri:dev`

Expected: Desktop app opens

**Step 3: Test setup flow**

1. Create 3 security questions and answers
2. Complete setup
3. Verify app transitions to dashboard

Expected: Data saved to files (not localStorage)

**Step 4: Verify file creation**

Run: `ls ~/Library/Application\ Support/com.cipherguard.vault/`

Expected: See `cipherguard_config.json` file

**Step 5: Test lock/unlock cycle**

1. Lock the app from dashboard
2. Answer security questions
3. Verify unlock works

Expected: Encrypted vault decrypts successfully

**Step 6: Test password management**

1. Add a new password entry
2. Lock and unlock app
3. Verify password persists

Expected: Password data encrypted and saved to file

**Step 7: Test lockout mechanism**

1. Enter wrong answers 3 times
2. Verify 1-hour lockout triggers

Expected: Lockout state saved to file

**Step 8: Verify inactivity auto-lock**

1. Unlock app
2. Wait 5 minutes
3. Verify auto-lock triggers

Expected: App locks and clears memory

---

## Task 11: Build macOS Distributable

**Files:**
- None (build phase)

**Step 1: Build production executable**

Run: `npm run tauri:build`

Expected: Tauri builds .app bundle and .dmg installer

Build output location: `src-tauri/target/release/bundle/`

**Step 2: Verify .app bundle**

Run: `open src-tauri/target/release/bundle/macos/CipherGuard.app`

Expected: App launches successfully

**Step 3: Test production app**

1. Complete full setup flow
2. Add passwords
3. Lock/unlock
4. Verify data persists after closing and reopening

Expected: All features work in production build

**Step 4: Locate .dmg installer**

Run: `ls src-tauri/target/release/bundle/dmg/`

Expected: See `CipherGuard_1.0.0_aarch64.dmg` or `CipherGuard_1.0.0_x64.dmg`

**Step 5: Document build artifacts**

Create a note of:
- .app bundle location
- .dmg installer location
- File size
- Architecture (arm64 or x64)

**Step 6: Commit final changes**

```bash
git add .
git commit -m "feat: complete Tauri desktop app conversion"
```

---

## Task 12: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Add desktop app instructions:

```markdown
## Desktop App (macOS)

### Running in Development
\`\`\`bash
npm install
npm run tauri:dev
\`\`\`

### Building Executable
\`\`\`bash
npm run tauri:build
\`\`\`

Output: `src-tauri/target/release/bundle/macos/CipherGuard.app`

### Data Storage
Desktop app stores encrypted data in:
`~/Library/Application Support/com.cipherguard.vault/`

- `cipherguard_config.json` - Security questions and hashed answers
- `cipherguard_vault.json` - AES-256-GCM encrypted password vault
- `cipherguard_lockout.json` - Lockout state
```

**Step 2: Update CLAUDE.md architecture section**

Add:

```markdown
### Desktop Mode (Tauri)

When running as a desktop app via Tauri:
- Storage uses Tauri's fs API instead of localStorage
- Data files stored in app data directory (`~/Library/Application Support/`)
- `utils/tauriStorage.ts` provides universal storage adapter
- Automatically detects Tauri environment and switches storage backend
```

**Step 3: Commit documentation**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update for Tauri desktop app"
```

---

## Testing Checklist

After completing all tasks, verify:

- [ ] Desktop app launches successfully
- [ ] Setup screen creates security questions
- [ ] Lock screen authenticates correctly
- [ ] Dashboard shows password vault
- [ ] Add/delete password operations work
- [ ] Data persists after app restart
- [ ] Lock/unlock cycle preserves data
- [ ] Lockout mechanism triggers after 3 failed attempts
- [ ] Auto-lock works after 5 minutes inactivity
- [ ] Gemini AI password generation works
- [ ] Production build (.dmg) installs and runs
- [ ] File encryption verified (view files - should be encrypted)
- [ ] Web version still works with localStorage fallback

---

## Notes

**DRY:** Reuse existing React components and crypto utilities - only change storage layer

**YAGNI:** Don't add cross-platform builds (Windows/Linux) until requested

**Security:** Tauri IPC provides secure communication. File system permissions scoped to app data directory only.

**Backwards Compatibility:** Storage adapter maintains web version compatibility via localStorage fallback

**Data Migration:** Users starting fresh - no migration needed. Document how to manually export from web version if needed later.
