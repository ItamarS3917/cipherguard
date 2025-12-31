# CipherGuard Desktop Application

CipherGuard is available as a native macOS desktop application, providing secure local password storage with filesystem-based data persistence.

## Installation

### Option 1: Download Pre-built Application

1. Download `CipherGuard.app` from the releases page
2. Move `CipherGuard.app` to your Applications folder
3. Double-click to launch

### Option 2: Build from Source

**Prerequisites:**
- Node.js (v18 or higher)
- Rust toolchain (install via [rustup](https://rustup.rs))

**Build Steps:**

1. Clone the repository and install dependencies:
   ```bash
   git clone <repository-url>
   cd cipherguard
   npm install
   ```

2. Set your Gemini API key in `.env.local`:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Build the desktop application:
   ```bash
   source ~/.cargo/env
   npm run tauri:build
   ```

4. Find the built application at:
   ```
   src-tauri/target/release/bundle/macos/CipherGuard.app
   ```

## Development

To run the desktop app in development mode with hot-reload:

```bash
source ~/.cargo/env
npm run tauri:dev
```

This starts both the Vite dev server and the Tauri desktop window.

## Data Storage Location

Unlike the web version which uses browser localStorage, the desktop app stores encrypted data in your system's application data directory:

**macOS:**
```
~/Library/Application Support/com.cipherguard.vault/
```

The following files are stored:
- `cipherguard_config.json` - Security questions and hashed answers
- `cipherguard_vault.json` - Encrypted password vault (AES-256-GCM)
- `cipherguard_lockout.json` - Failed login attempt tracking

## Security Model

The desktop version maintains the same security model as the web version:

- **Authentication:** Challenge-based with SHA-256 hashed security answers
- **Encryption:** AES-256-GCM for password vault with PBKDF2 key derivation (100,000 iterations)
- **Lockout:** 3 failed attempts = 1-hour lockout
- **Auto-lock:** 5 minutes of inactivity
- **In-memory keys:** Decryption keys only exist in memory while authenticated, cleared on lock

## Differences from Web Version

| Feature | Web Version | Desktop Version |
|---------|-------------|-----------------|
| Storage | Browser localStorage | Filesystem (app data directory) |
| Data portability | Browser-specific | System-wide, survives browser cache clears |
| Installation | No installation needed | Requires .app bundle installation |
| Updates | Automatic (refresh page) | Manual (download new version) |
| Platform support | Any modern browser | macOS (Windows/Linux coming soon) |

## Troubleshooting

### Application won't open
- Check that you have macOS 10.15 (Catalina) or higher
- Right-click the app and select "Open" if macOS blocks it due to security settings

### Data not persisting after restart
- Verify the app data directory exists: `ls -la ~/Library/Application\ Support/com.cipherguard.vault/`
- Check file permissions on the app data directory

### Build failures

**"cargo not found":**
```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env
```

**"failed to bundle project" (DMG creation fails):**
- The .app bundle is still created successfully in `src-tauri/target/release/bundle/macos/`
- DMG creation failure doesn't affect the primary .app deliverable

### Runtime errors

**"Failed to read/write storage":**
- Ensure the app has proper filesystem permissions
- Check that ~/Library/Application Support/ is writable

**"Gemini API not working":**
- Verify `GEMINI_API_KEY` is set in `.env.local` before building
- Rebuild the app after updating environment variables

## Feature Compatibility

All features from the web version are fully supported in the desktop app:
- AI-powered password generation (via Gemini API)
- Password strength analysis
- Security question-based authentication
- Encrypted vault storage
- Auto-lock on inactivity
- Password search and categorization

## Building for Other Platforms

To build for Windows or Linux, update `src-tauri/tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "targets": ["dmg", "msi", "appimage"],
  ...
}
```

Then run the build on the target platform.
