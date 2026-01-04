# CipherGuard v2.0.0 - Master Password Authentication 🔐

Major security upgrade replacing security questions with industry-standard master password authentication.

## ⚠️ Breaking Changes

This is a **breaking change** release. The authentication system has been completely redesigned:
- Security questions replaced with master password + recovery key
- Existing vault data is not compatible - set up a new vault
- Key derivation upgraded from PBKDF2 to Argon2id

## ✨ New Features

### Master Password Authentication
- **Single strong master password** - 12+ characters recommended
- **Real-time strength validation** - Entropy, patterns, length, character diversity
- **AI-powered analysis** - Optional Gemini AI for advanced strength feedback
- **Emergency recovery key** - 32-byte cryptographic key for account recovery

### Key Wrapping Architecture
- **Forward secrecy** - Change master password without re-encrypting vault
- **Dual authentication** - Both password and recovery key can unlock vault
- **Zero-knowledge** - No password hashes stored, auth via decryption

### Multi-Step Setup Flow
1. Create and confirm master password with strength feedback
2. Save recovery key (copy or download)
3. Confirm recovery key has been saved

## 🔐 Security Improvements

- **Argon2id key derivation** - Memory-hard (64MB), GPU-resistant, 3 iterations
- **No stored password hashes** - Authentication via successful decryption
- **Memory protection** - Vault key cleared from memory on lock
- **Lockout protection** - 3 failed attempts = 1-hour lockout
- **Auto-lock** - 5 minutes of inactivity

## 📦 Installation

1. Download `CipherGuard_2.0.0_aarch64.dmg`
2. Open the DMG file
3. Drag CipherGuard.app to your Applications folder
4. Launch and create your master password

## 💻 Requirements

- macOS 10.15 (Catalina) or later
- Apple Silicon (M1/M2/M3) recommended
- No API key required for core features (AI features optional)

## 🔒 Security Architecture

- **Local-only storage** - Your passwords never leave your computer
- **AES-256-GCM encryption** - Industry-standard encryption
- **Argon2id key derivation** - 64MB memory, 3 iterations (OWASP recommended)
- **Key wrapping** - Vault key encrypted with both auth credentials
- **Memory protection** - Keys cleared from memory on lock

## 📂 Data Location

Your encrypted vault is stored at:
`~/Library/Application Support/com.cipherguard.vault/`

## 🛠️ Tech Stack

- React 19 + TypeScript
- Tauri 2.x (Rust + Web)
- Vite 6
- Google Gemini API (optional)
- @noble/hashes for Argon2id

---

**Full Changelog:** https://github.com/ItamarS3917/cipherguard/compare/v1.0.0...v2.0.0

**First time using CipherGuard v2.0.0?** Create a strong master password and save your recovery key in a secure location.
