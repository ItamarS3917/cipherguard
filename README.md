# 🔐 CipherGuard Local Vault

A secure-by-design local password manager with AI-powered password generation. CipherGuard uses challenge-based authentication (security questions) and encrypts all your passwords locally using AES-256-GCM encryption.

**Key Features:**
- Challenge-based authentication (no master password to forget)
- AES-256-GCM encryption for password vault
- AI-powered password generation via Google Gemini
- Password strength analysis
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

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

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

**Authentication:**
- Users create 3 security questions during initial setup
- Answers are hashed with SHA-256 before storage (never stored in plaintext)
- Authentication compares hashed inputs against stored hashes

**Encryption:**
- Master key derived from security answers using PBKDF2 (100,000 iterations)
- Password vault encrypted with AES-256-GCM
- Each encryption generates unique salt and IV
- Decryption key only exists in memory while authenticated, cleared on lock

**Lockout Protection:**
- 3 failed authentication attempts triggers 1-hour lockout
- Auto-lock after 5 minutes of inactivity

### Data Storage

**Web Version:**
- Uses browser localStorage
- Data persists until browser cache is cleared
- Three storage keys:
  - `cipherguard_config` - Security questions + hashed answers
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
│   ├── SetupScreen.tsx    # Initial security question setup
│   ├── LockScreen.tsx     # Authentication screen
│   └── Dashboard.tsx      # Password vault UI
├── utils/
│   ├── crypto.ts          # AES-256-GCM encryption/decryption
│   ├── storage.ts         # Encrypted storage abstraction
│   └── tauriStorage.ts    # Universal storage adapter (Tauri/localStorage)
├── services/
│   └── geminiService.ts   # AI password generation
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
- **Military-grade encryption** - AES-256-GCM with PBKDF2 key derivation (100,000 iterations)
- **Zero-knowledge architecture** - Your security answers never leave your device
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
