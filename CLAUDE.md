# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CipherGuard Local Vault is a secure-by-design local password manager built with React, TypeScript, and Vite. It uses challenge-based authentication (security questions) and integrates Google's Gemini AI for smart password generation and strength analysis. All data is stored locally in the browser's localStorage with base64 obfuscation.

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

1. **SETUP** → User creates 3 security questions/answers (first launch only)
2. **LOCK** → Challenge-based authentication using security questions
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
- Stores user's raw answers in memory (only while authenticated) for vault encryption
- Coordinates encrypted storage via `utils/storage.ts` and `utils/crypto.ts`
- Clears sensitive data from memory when locked

**components/SetupScreen.tsx** - Initial security question setup
**components/LockScreen.tsx** - Authentication screen with challenge questions
**components/Dashboard.tsx** - Password vault UI with add/delete/search

### Data Layer

**utils/crypto.ts** - Cryptographic primitives using Web Crypto API
- `deriveKeyFromAnswers(answers, salt)`: PBKDF2 key derivation (100k iterations)
- `encrypt(data, answers)`: AES-256-GCM encryption with random salt/IV
- `decrypt(encryptedData, answers)`: AES-256-GCM decryption
- Returns encrypted data as `{ ciphertext, iv, salt }` (all base64 encoded)

**utils/storage.ts** - Encrypted storage abstraction
- Three storage keys: `cipherguard_config`, `cipherguard_vault`, `cipherguard_lockout`
- `saveSecurityConfig(config, rawAnswers)`: Hashes answers with SHA-256 before storage
- `verifyAnswers(providedAnswers, config)`: Compares hashed answers for authentication
- `savePasswords(passwords, answers)`: Encrypts vault with AES-256-GCM
- `getPasswords(answers)`: Decrypts vault (throws error if wrong answers)

**types.ts** - Core TypeScript interfaces
- `SecurityConfig`: 3 security questions + hashed answers (SHA-256)
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

**Authentication**: Challenge-based with SHA-256 hashed security answers
- User sets 3 security questions during initial setup
- Answers are hashed with SHA-256 before storage (never stored in plaintext)
- Verification compares hashed inputs against stored hashes

**Encryption**: AES-256-GCM for password vault
- Master key derived from security answers using PBKDF2 (100,000 iterations)
- Each encryption generates unique salt and IV (stored with ciphertext)
- Vault data is encrypted/decrypted on-the-fly during lock/unlock
- Decryption key only exists in memory while authenticated

**Lockout**: 3 failed attempts = 1-hour lockout
**Auto-lock**: 5 minutes of inactivity (clears decryption keys from memory)
**Storage**: LocalStorage with encrypted vault + hashed authentication

**Key Derivation Flow**:
1. User enters security answers → normalized (lowercase, trimmed)
2. PBKDF2 derives AES-256 key from answers + random salt
3. Vault encrypted/decrypted with derived key
4. Raw answers kept in memory only while authenticated (cleared on lock)

### Path Aliases

`@/*` resolves to the project root directory (configured in `tsconfig.json` and `vite.config.ts`).

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **AI**: Google Gemini API (`@google/genai`)
- **Icons**: Lucide React
- **Styling**: Inline Tailwind classes (no separate CSS files)
