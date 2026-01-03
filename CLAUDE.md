# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CipherGuard Local Vault is a secure-by-design local password manager built with React, TypeScript, and Vite. It uses master password authentication with Argon2id key derivation and integrates Google's Gemini AI for smart password generation and strength analysis. All data is stored locally with AES-256-GCM encryption.

## Development Commands

### Setup
```bash
npm install                    # Install dependencies
```

Set `GEMINI_API_KEY` in `.env.local` before running the app.

### Development
```bash
npm run dev                    # Start dev server on http://localhost:3000
npm run build                  # Build for production
npm run preview                # Preview production build
```

## Architecture

### Application Flow

The app follows a three-screen state machine managed in `App.tsx`:

1. **SETUP** → Multi-step master password creation + recovery key generation (first launch only)
2. **LOCK** → Authentication using master password OR recovery key
3. **DASHBOARD** → Password vault management (unlocked state)

State transitions:
- SETUP → DASHBOARD (on setup completion)
- LOCK → DASHBOARD (on successful authentication)
- DASHBOARD → LOCK (on manual lock or 5-minute inactivity)

### Core Components

**App.tsx** - Main application controller
- Manages app view state (SETUP/LOCK/DASHBOARD)
- Implements inactivity timer (5 minutes) that auto-locks the app
- Handles lockout logic: 3 failed auth attempts = 1 hour lockout
- Stores vault key in memory (only while authenticated) for encryption/decryption
- Coordinates encrypted storage via `utils/storage.ts` and `utils/crypto.ts`
- Clears vault key from memory when locked

**components/SetupScreen.tsx** - Multi-step master password setup (3 steps)
- Step 1: Password creation with real-time strength validation
- Step 2: Recovery key display with copy/download options
- Step 3: Recovery key confirmation

**components/LockScreen.tsx** - Authentication screen
- Single input for master password OR recovery key
- Mode toggle between password/recovery key
- Shows lockout timer and attempt warnings

**components/Dashboard.tsx** - Password vault UI with add/delete/search

### Data Layer

**utils/crypto.ts** - Cryptographic primitives using Web Crypto API + Argon2id
- `deriveKeyFromPassword(password, salt, params)`: Argon2id key derivation (64MB memory, 3 iterations)
- `wrapVaultKey(vaultKey, derivedKey)`: Encrypts vault key with AES-256-GCM
- `unwrapVaultKey(wrappedKey, derivedKey)`: Decrypts vault key (returns null if wrong key)
- `generateRecoveryKey()`: Generates 32-byte random recovery key (formatted: XXXX-XXXX-...)
- `parseRecoveryKey(input)`: Parses and validates recovery key input
- Returns encrypted data as `{ ciphertext, iv, salt }` (all base64 encoded)

**utils/storage.ts** - Key wrapping + encrypted storage
- Three storage keys: `cipherguard_master_config`, `cipherguard_vault`, `cipherguard_lockout`
- `saveMasterPasswordConfig(masterPassword, recoveryKey, vaultKey)`: Wraps vault key with both credentials
- `authenticateAndGetVaultKey(input, config)`: Tries both password and recovery paths
- `savePasswords(passwords, vaultKey)`: Encrypts vault with AES-256-GCM
- `getPasswords(vaultKey)`: Decrypts vault (throws error if wrong key)

**services/passwordStrengthService.ts** - Password strength validation
- `validateWithRules(password)`: Rule-based validation (entropy, patterns, length)
- `validateWithGemini(password)`: AI-powered validation with Gemini (optional, with timeout)
- Returns `{ score, level, feedback, isValid }`

**types.ts** - Core TypeScript interfaces
- `MasterPasswordConfig`: Wrapped vault keys + Argon2 parameters
- `PasswordEntry`: site, username, password, category, timestamps
- `LockoutState`: failed attempt counter and lockout expiration timestamp
- `AppView`: enum for state machine

### AI Integration

**services/geminiService.ts** - Gemini AI integration
- `generateStrongPassword(context)`: Generates secure passwords with reasoning
- `checkPasswordStrength(password)`: Returns 0-100 score + improvement tips
- Uses structured JSON output via `responseMimeType` and `responseSchema`
- Model: `gemini-3-flash-preview`

API key is injected via Vite's `define` config from `GEMINI_API_KEY` env var (mapped to `process.env.API_KEY` in code).

### Security Model

**Authentication**: Master password + emergency recovery key
- User sets one strong master password during initial setup
- System generates cryptographically random 32-byte recovery key
- Both can authenticate and derive encryption key via Argon2id
- No passwords stored (authentication happens via successful decryption)

**Encryption**: AES-256-GCM with key wrapping
- Random vault key (32 bytes) is the actual AES encryption key
- Vault key is wrapped (encrypted) with master password-derived key
- Vault key is also wrapped with recovery key-derived key
- Password vault encrypted/decrypted with vault key on-the-fly

**Lockout**: 3 failed attempts = 1-hour lockout
**Auto-lock**: 5 minutes of inactivity (clears vault key from memory)
**Storage**: LocalStorage with encrypted vault + wrapped keys

**Key Derivation Flow**:
1. User enters master password → normalized (lowercase, trimmed)
2. Argon2id derives 256-bit key from password + salt (64MB memory, 3 iterations)
3. Derived key unwraps vault key
4. Vault key decrypts password vault
5. Raw vault key kept in memory only while authenticated (cleared on lock)

### Path Aliases

`@/*` resolves to the project root directory (configured in `tsconfig.json` and `vite.config.ts`).

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **AI**: Google Gemini API (`@google/genai`)
- **Icons**: Lucide React
- **Styling**: Inline Tailwind classes (no separate CSS files)
