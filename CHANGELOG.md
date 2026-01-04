# Changelog

All notable changes to CipherGuard Local Vault will be documented in this file.

## [2.0.0] - 2026-01-03

### 🔒 Major Security Upgrade

This release completely overhauls the authentication system with industry-standard security practices.

### ⚠️ Breaking Changes

- **Authentication system replaced** - Security questions have been replaced with master password + recovery key
- **Existing vault data is not compatible** - Users must set up a new vault with the new authentication system
- **Key derivation upgraded** - Now uses Argon2id instead of PBKDF2

### ✨ New Features

- **Master Password Authentication**
  - Single strong master password (12+ characters recommended)
  - Real-time password strength validation with feedback
  - AI-powered password strength analysis via Google Gemini (optional)
  - Rule-based validation (entropy, patterns, length, character diversity)

- **Emergency Recovery Key**
  - Cryptographically random 32-byte recovery key generated at setup
  - Formatted as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX for easy copying
  - Can unlock vault if master password is forgotten
  - One-time display with copy/download options

- **Multi-Step Setup Flow**
  - Step 1: Create and confirm master password with strength validation
  - Step 2: Display recovery key with save options
  - Step 3: Confirm recovery key has been saved

- **Key Wrapping Architecture**
  - Random vault key (32 bytes) encrypts the password vault
  - Vault key wrapped (encrypted) with both master password and recovery key
  - Master password can be changed without re-encrypting entire vault
  - Forward secrecy maintained

### 🔐 Security Improvements

- **Argon2id Key Derivation**
  - Memory-hard algorithm (GPU-resistant)
  - 64MB memory requirement
  - 3 iterations (OWASP recommended)
  - 256-bit output key

- **Zero-Knowledge Architecture**
  - No password hashes stored
  - Authentication via successful decryption
  - Vault key only in memory while authenticated
  - Keys cleared from memory on lock

- **Enhanced Protection**
  - Lockout protection (3 failed attempts = 1 hour lockout)
  - Auto-lock after 5 minutes of inactivity
  - Memory protection - vault key cleared on lock

### 📦 Dependencies

- Added `@noble/hashes` for Argon2id key derivation

### 📚 Documentation

- Updated README with new security model
- Updated CLAUDE.md with new architecture details
- Added master password implementation design document

## [1.0.0] - 2025-12-31

### 🎉 Initial Release

First stable release of CipherGuard Local Vault.

### Features

- **Challenge-based Authentication** - Security questions for vault access
- **AES-256-GCM Encryption** - Military-grade encryption for password vault
- **AI-Powered Password Generation** - Smart password suggestions via Google Gemini
- **Password Strength Analysis** - Real-time security scoring
- **Auto-Lock Protection** - Locks after 5 minutes of inactivity
- **Lockout Protection** - 3 failed attempts = 1-hour lockout
- **Native macOS App** - Fast, secure desktop application via Tauri
- **Beautiful UI** - Modern security-themed interface

### Tech Stack

- React 19 + TypeScript
- Tauri 2.x (Rust + Web)
- Vite 6
- Google Gemini API (optional)

### Security

- Local-only storage - passwords never leave your computer
- AES-256-GCM encryption
- PBKDF2 key derivation (100,000 iterations)
- SHA-256 hashing for authentication
- Memory protection - keys cleared from memory on lock

---

[2.0.0]: https://github.com/ItamarS3917/cipherguard/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/ItamarS3917/cipherguard/releases/tag/v1.0.0
