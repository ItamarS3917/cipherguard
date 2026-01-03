# 🔐 CipherGuard Local Vault

A secure-by-design local password manager with AI-powered password generation. CipherGuard uses master password authentication with Argon2id key derivation and encrypts all your passwords locally using AES-256-GCM encryption.

**Key Features:**
- Master password authentication with emergency recovery key
- Argon2id key derivation (memory-hard, GPU-resistant)
- AES-256-GCM encryption with key wrapping architecture
- AI-powered password generation via Google Gemini
- Real-time password strength analysis
- Auto-lock after 5 minutes of inactivity
- Lockout protection (3 failed attempts = 1 hour lockout)
- Available as both web app and native macOS desktop app

## 📥 Download

**Latest Release:** [v1.0.0](https://github.com/ItamarS3917/cipherguard/releases/latest)

**macOS Desktop App (Recommended):**
- Download `CipherGuard_1.0.0_aarch64.dmg` from [Releases](https://github.com/ItamarS3917/cipherguard/releases)
- Open the DMG and drag CipherGuard to Applications
- Launch and start securing your passwords!

**Requirements:** macOS 10.15+ | No API key needed for core features

## Quick Start

### Web Version

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set your Gemini API key:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your GEMINI_API_KEY
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

### Desktop Application (macOS)

For the native macOS desktop app with filesystem-based storage, see **[README-DESKTOP.md](README-DESKTOP.md)** for:
- Installation instructions
- Building from source
- Data storage locations
- Troubleshooting

**Quick start:**
```bash
# Install Rust (one-time setup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# Run desktop app in dev mode
npm run tauri:dev

# Build distributable
npm run tauri:build
```

## Architecture

### Security Model

**Authentication:** Master password + emergency recovery key
- Single strong master password (12+ characters recommended)
- Cryptographically random 32-byte recovery key for account recovery
- Both can authenticate and unlock the vault
- No passwords stored (authentication via successful decryption)

**Encryption:** AES-256-GCM with key wrapping
- Random **vault key** (32 bytes) encrypts your password vault
- Vault key is **wrapped** (encrypted) with both:
  - Master password-derived key (Argon2id: 64MB memory, 3 iterations)
  - Recovery key-derived key (Argon2id: 64MB memory, 3 iterations)
- Password vault encrypted/decrypted with vault key on-the-fly
- Master password can be changed without re-encrypting entire vault

**Key Derivation:**
- Argon2id (memory-hard, GPU-resistant)
- 64MB memory requirement
- 3 iterations (OWASP recommended)
- 256-bit output key

**Lockout Protection:**
- 3 failed authentication attempts triggers 1-hour lockout
- Auto-lock after 5 minutes of inactivity
- Vault key cleared from memory on lock

### Data Storage

**Web Version:**
- Uses browser localStorage
- Data persists until browser cache is cleared
- Three storage keys:
  - `cipherguard_master_config` - Wrapped vault keys + Argon2 parameters
  - `cipherguard_vault` - Encrypted password entries
  - `cipherguard_lockout` - Failed attempt tracking

**Desktop Version:**
- Uses filesystem storage via Tauri
- Data stored in: `~/Library/Application Support/com.cipherguard.vault/`
- Same encryption and security model as web version

### AI Integration

**Google Gemini API** (`gemini-3-flash-preview`):
- `generateStrongPassword(context)` - Generates secure passwords with reasoning
- `checkPasswordStrength(password)` - Returns 0-100 score + improvement tips
- Uses structured JSON output via response schemas

## Development

### Available Scripts

**Web development:**
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**Desktop development:**
- `npm run tauri:dev` - Start desktop app in dev mode
- `npm run tauri:build` - Build desktop distributable

### Project Structure

```
cipherguard/
├── App.tsx                 # Main app controller (state machine)
├── components/
│   ├── SetupScreen.tsx    # Multi-step master password setup
│   ├── LockScreen.tsx     # Authentication screen (password/recovery key)
│   └── Dashboard.tsx      # Password vault UI
├── utils/
│   ├── crypto.ts          # Argon2id + AES-256-GCM encryption
│   ├── storage.ts         # Key wrapping + encrypted storage
│   └── tauriStorage.ts    # Universal storage adapter (Tauri/localStorage)
├── services/
│   ├── geminiService.ts          # AI password generation
│   └── passwordStrengthService.ts # Rule-based + AI password validation
├── types.ts               # TypeScript interfaces
├── src-tauri/             # Desktop app Rust backend
│   ├── src/
│   │   ├── lib.rs        # Tauri entry point
│   │   └── storage.rs    # Filesystem IPC commands
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Desktop app configuration
└── CLAUDE.md             # Development guidance for AI tools
```

### Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6
- **Desktop Framework:** Tauri 2.x (Rust + Web)
- **AI:** Google Gemini API (`@google/genai`)
- **Styling:** Tailwind CSS (inline classes)
- **Icons:** Lucide React

## 🔒 Security & Privacy

**Your data never leaves your computer.** CipherGuard is designed with privacy and security as the top priority:

- **Local-only storage** - No cloud sync, no servers, no tracking
- **Military-grade encryption** - AES-256-GCM with Argon2id key derivation (64MB memory, GPU-resistant)
- **Zero-knowledge architecture** - Your master password never leaves your device
- **Emergency recovery** - Cryptographically random recovery key prevents permanent lockout
- **Open source** - Audit the code yourself

**Data Location:**
- **macOS:** `~/Library/Application Support/com.cipherguard.vault/`
- **Web:** Browser localStorage (encrypted)

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs via [Issues](https://github.com/ItamarS3917/cipherguard/issues)
- Submit feature requests
- Open pull requests

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Built with:
- [Tauri](https://tauri.app/) - Rust-based desktop framework
- [React](https://react.dev/) - UI framework
- [Google Gemini](https://ai.google.dev/) - AI-powered password generation
- [Vite](https://vite.dev/) - Build tool

---

**Made with ❤️ and [Claude Code](https://claude.com/claude-code)**
