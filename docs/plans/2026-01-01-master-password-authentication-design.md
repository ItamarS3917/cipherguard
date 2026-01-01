# Master Password Authentication Design

**Date:** 2026-01-01
**Status:** Approved
**Author:** Design Session with User

## Executive Summary

This document outlines the architectural redesign of CipherGuard's authentication system, transitioning from challenge-based security questions to industry-standard master password authentication with emergency recovery key support.

**Key Changes:**
- Replace 3 security questions with single master password
- Implement Argon2id key derivation (upgrade from PBKDF2)
- Add emergency recovery key with key wrapping architecture
- Integrate AI-powered password strength validation (Gemini + rule-based fallback)
- Maintain zero-knowledge, local-first security model

**Security Level:** Professional password manager standard (comparable to 1Password, Bitwarden, KeePass)

---

## 1. High-Level Architecture & Data Model

### Current System
- **Authentication:** 3 security questions with SHA-256 hashed answers
- **Encryption:** Raw answers → PBKDF2 (100k iterations) → AES-256-GCM key
- **Weakness:** Security questions vulnerable to social engineering, low entropy

### New System
- **Authentication:** Master password OR recovery key → Argon2id → decrypt vault key
- **Encryption:** Random vault key (32 bytes) → AES-256-GCM
- **Key Wrapping:** Vault key encrypted with both master password-derived key and recovery key-derived key

### New Data Model (types.ts)

```typescript
export interface MasterPasswordConfig {
  // Wrapped vault keys (encrypted with derived keys)
  wrappedVaultKey_password: EncryptedData;  // Vault key encrypted with password-derived key
  wrappedVaultKey_recovery: EncryptedData;  // Vault key encrypted with recovery-derived key

  // Key derivation parameters
  salt: string;                // Base64 encoded salt for Argon2id (16 bytes)
  argon2Params: {
    memory: number;            // 65536 KB (64 MB) - OWASP recommended
    iterations: number;        // 3 - OWASP recommended for interactive use
    parallelism: number;       // 1 - browser limitation
    hashLength: number;        // 32 - 256-bit key
  };

  isSetup: boolean;
}

// Remove SecurityConfig interface (deprecated)
```

**EncryptedData structure** (already exists in crypto.ts):
```typescript
interface EncryptedData {
  ciphertext: string;  // Base64 encoded
  iv: string;          // Base64 encoded (12 bytes for GCM)
  salt: string;        // Base64 encoded (16 bytes) - note: different from argon2 salt
}
```

---

## 2. Cryptographic Layer (utils/crypto.ts)

### Key Wrapping Architecture

**Why Key Wrapping?**
- Allows multiple authentication paths (master password + recovery key) to decrypt same vault
- Enables master password changes without re-encrypting entire vault
- Industry standard: 1Password, Bitwarden, KeePass use this approach
- More secure: authentication via successful decryption (no stored hashes to attack)

### New Cryptographic Functions

#### 2.1 Argon2id Key Derivation

```typescript
/**
 * Derives a 256-bit key from password using Argon2id
 * @param password - Master password or recovery key
 * @param salt - 16-byte salt from config
 * @param params - Argon2 parameters from config
 * @returns 32-byte derived key as Uint8Array
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  params: Argon2Params
): Promise<Uint8Array>
```

**Implementation:**
- Library: `@noble/hashes/argon2` (~50KB, tree-shakeable, audited)
- Algorithm: Argon2id (hybrid mode - best for password hashing)
- Parameters:
  - Memory: 64 MB (65536 KB) - resistant to GPU attacks
  - Iterations: 3 - OWASP recommended for interactive use
  - Parallelism: 1 - browser limitation (single-threaded)
  - Output: 32 bytes (256-bit key)
- Normalization: Lowercase + trim before hashing (prevent case sensitivity issues)

**Why Argon2id over PBKDF2?**
- Winner of Password Hashing Competition (2015)
- Memory-hard algorithm (resistant to GPU/ASIC attacks)
- OWASP recommended for password storage
- Used by Bitwarden, 1Password, and modern password managers

#### 2.2 Vault Key Wrapping

```typescript
/**
 * Wraps (encrypts) the vault key with a derived key
 * @param vaultKey - 32-byte random vault key
 * @param derivedKey - Key derived from password via Argon2id
 * @returns EncryptedData (ciphertext, iv, salt)
 */
async function wrapVaultKey(
  vaultKey: Uint8Array,
  derivedKey: Uint8Array
): Promise<EncryptedData>
```

**Implementation:**
- Convert derivedKey (Uint8Array) to CryptoKey via `crypto.subtle.importKey()`
- Use existing `encrypt()` function with AES-256-GCM
- Returns EncryptedData structure

#### 2.3 Vault Key Unwrapping

```typescript
/**
 * Unwraps (decrypts) the vault key with a derived key
 * @param wrappedKey - EncryptedData containing wrapped vault key
 * @param derivedKey - Key derived from user input via Argon2id
 * @returns Vault key (32 bytes) or null if decryption fails
 */
async function unwrapVaultKey(
  wrappedKey: EncryptedData,
  derivedKey: Uint8Array
): Promise<Uint8Array | null>
```

**Implementation:**
- Use existing `decrypt()` function
- Catch decryption failures (wrong password) and return null
- Successful decryption = authentication passed

#### 2.4 Recovery Key Generation

```typescript
/**
 * Generates a cryptographically random recovery key
 * @returns Formatted recovery key string (XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX)
 */
function generateRecoveryKey(): string
```

**Implementation:**
- Generate 32 random bytes via `crypto.getRandomValues()`
- Convert to hex string (64 characters)
- Format into 8 groups of 4 characters separated by hyphens
- Example: `A3F2-89BC-1D4E-7A05-B9C3-E82F-4D6A-0B17`

**Recovery Key Parsing:**
```typescript
/**
 * Parses recovery key from user input (strips hyphens, validates format)
 */
function parseRecoveryKey(input: string): string | null
```

### Encryption Flow Diagrams

**Setup Flow:**
```
Master Password (user input)
    ↓ normalize (lowercase, trim)
    ↓ Argon2id(password, salt, params)
    ↓
Password-Derived Key (32 bytes)
    ↓
    ↓ wrapVaultKey(vaultKey, PDK)
    ↓
Wrapped Vault Key (password) → Store in config

Recovery Key (generated)
    ↓ Argon2id(recoveryKey, salt, params)
    ↓
Recovery-Derived Key (32 bytes)
    ↓
    ↓ wrapVaultKey(vaultKey, RDK)
    ↓
Wrapped Vault Key (recovery) → Store in config

Vault Key (32 random bytes)
    ↓ Used directly for AES-256-GCM
    ↓
Encrypted Password Vault → Store
```

**Authentication Flow:**
```
User Input (master password OR recovery key)
    ↓ normalize
    ↓ Argon2id(input, salt, params)
    ↓
Derived Key (32 bytes)
    ↓
    ├─→ Try unwrapVaultKey(wrappedVaultKey_password, derivedKey)
    │   ↓ Success? → Vault Key
    │   ↓ Failure? ↓
    └─→ Try unwrapVaultKey(wrappedVaultKey_recovery, derivedKey)
        ↓ Success? → Vault Key
        ↓ Failure? → Authentication failed

Vault Key (if unwrapped successfully)
    ↓ decrypt(encryptedVault, vaultKey)
    ↓
Password Vault (decrypted) → Load into memory
```

### Security Properties

✅ **No password storage:** Master password never stored (not even hashed)
✅ **Argon2id protection:** Memory-hard KDF prevents brute force
✅ **Key wrapping:** Vault key protected by both master password and recovery key
✅ **Authentication via decryption:** No timing attacks, no offline hash cracking
✅ **Forward secrecy:** Changing master password doesn't require vault re-encryption
✅ **Zero-knowledge:** All encryption/decryption happens client-side

---

## 3. Storage Layer (utils/storage.ts)

### Updated Storage Keys

```typescript
const STORAGE_KEYS = {
  CONFIG: 'cipherguard_master_config',  // Changed from cipherguard_config
  VAULT: 'cipherguard_vault',           // Unchanged
  LOCKOUT: 'cipherguard_lockout'        // Unchanged
};
```

### Core Storage Functions

#### 3.1 Save Master Password Configuration

```typescript
export async function saveMasterPasswordConfig(
  masterPassword: string,
  recoveryKey: string,
  vaultKey: Uint8Array
): Promise<void>
```

**Implementation:**
1. Generate random salt (16 bytes) for Argon2id
2. Define Argon2 parameters (memory: 65536, iterations: 3, parallelism: 1)
3. Derive key from master password: `passwordDerivedKey = deriveKeyFromPassword(masterPassword, salt, params)`
4. Derive key from recovery key: `recoveryDerivedKey = deriveKeyFromPassword(recoveryKey, salt, params)`
5. Wrap vault key with both:
   - `wrappedVaultKey_password = wrapVaultKey(vaultKey, passwordDerivedKey)`
   - `wrappedVaultKey_recovery = wrapVaultKey(vaultKey, recoveryDerivedKey)`
6. Store config:
   ```typescript
   const config: MasterPasswordConfig = {
     wrappedVaultKey_password,
     wrappedVaultKey_recovery,
     salt: bufferToBase64(salt),
     argon2Params: { memory: 65536, iterations: 3, parallelism: 1, hashLength: 32 },
     isSetup: true
   };
   await storage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
   ```

#### 3.2 Authenticate and Get Vault Key

```typescript
export async function authenticateAndGetVaultKey(
  input: string,
  config: MasterPasswordConfig
): Promise<{ success: boolean; vaultKey?: Uint8Array; error?: string }>
```

**Implementation:**
1. Parse input (handle recovery key formatting if needed)
2. Derive key from input: `derivedKey = deriveKeyFromPassword(input, base64ToBuffer(config.salt), config.argon2Params)`
3. Try to unwrap vault key with password path:
   ```typescript
   let vaultKey = await unwrapVaultKey(config.wrappedVaultKey_password, derivedKey);
   if (vaultKey) return { success: true, vaultKey };
   ```
4. Try to unwrap vault key with recovery path:
   ```typescript
   vaultKey = await unwrapVaultKey(config.wrappedVaultKey_recovery, derivedKey);
   if (vaultKey) return { success: true, vaultKey };
   ```
5. Both failed:
   ```typescript
   return { success: false, error: 'Invalid master password or recovery key' };
   ```

**Performance:** Argon2id derivation takes ~500ms-1s (by design - prevents brute force)

#### 3.3 Vault Operations (Updated)

```typescript
// Encrypt and save password vault
export async function savePasswords(
  passwords: PasswordEntry[],
  vaultKey: Uint8Array
): Promise<void>

// Decrypt and load password vault
export async function getPasswords(
  vaultKey: Uint8Array
): Promise<PasswordEntry[]>
```

**Changes:**
- Replace `answers: [string, string, string]` parameter with `vaultKey: Uint8Array`
- Use vault key directly for AES-256-GCM encryption/decryption
- Remove call to `deriveKeyFromAnswers()` (no longer needed)

#### 3.4 Config Retrieval

```typescript
export async function getMasterPasswordConfig(): Promise<MasterPasswordConfig | null>
```

**Implementation:**
- Renamed from `getSecurityConfig()`
- Same logic: fetch from storage, parse JSON, return null if not found

#### 3.5 Migration Helper (for existing users)

```typescript
export async function migrateFromSecurityQuestions(): Promise<boolean>
```

**Implementation:**
- Check if old `cipherguard_config` exists
- If yes, show migration screen (requires user to set new master password)
- Copy encrypted vault to new storage key
- Mark old config as migrated
- Return true if migration needed, false otherwise

---

## 4. UI Component Changes

### 4.1 SetupScreen.tsx - Master Password Setup

**New Multi-Step Flow:**

#### Step 1: Create Master Password

**UI Elements:**
- Header: "Create Master Password"
- Subheader: "This is the only password you'll need to remember"
- Input 1: Master password (type="password", show/hide toggle)
- Input 2: Confirm password (type="password")
- Real-time password strength meter:
  - Color-coded bar: Red (weak) → Yellow (fair) → Green (good) → Blue (strong)
  - Score: 0-100 (from Gemini AI or fallback algorithm)
  - Live feedback bullets:
    - ✅ "At least 12 characters" (turns green when met)
    - ✅ "Contains uppercase and lowercase"
    - ✅ "Contains numbers or symbols"
    - ⚠️ "Avoid common patterns like '123' or 'password'"
- Button: "Continue" (disabled until password strength >= 60 and passwords match)

**Validation:**
- Minimum 12 characters (enforced)
- Passwords must match (enforced)
- Strength score >= 60 (recommended, can override with warning)
- Real-time feedback as user types (debounced 300ms)

**Visual Design:**
- Keep existing futuristic theme (gradient borders, glass effect)
- Replace 3-question cards with single password card
- Animate strength meter fill (smooth transition)

#### Step 2: Save Recovery Key

**UI Elements:**
- Header: "Save Your Emergency Recovery Key"
- Warning banner (red/yellow):
  - ⚠️ "This is your ONLY way to recover access if you forget your master password"
  - ⚠️ "CipherGuard cannot reset your password - we never see it"
- Recovery key display (monospace font, large, selectable):
  ```
  A3F2-89BC-1D4E-7A05-B9C3-E82F-4D6A-0B17
  ```
- Action buttons (horizontal layout):
  - 📋 "Copy to Clipboard" (shows "✓ Copied!" for 2s)
  - 💾 "Download as Text File" (saves `cipherguard-recovery-key.txt`)
  - 🖨️ "Print" (window.print())
- Checkbox (required): "I have saved my recovery key in a safe place"
- Button: "Continue" (disabled until checkbox checked)

**Download File Format:**
```
CipherGuard Emergency Recovery Key
===================================
IMPORTANT: Keep this key safe and secret.
This is your only way to recover your vault if you forget your master password.

Recovery Key:
A3F2-89BC-1D4E-7A05-B9C3-E82F-4D6A-0B17

Created: 2026-01-01 14:32:15 UTC

Do NOT share this key with anyone.
Store it in a secure location (password manager, safe, etc.)
```

#### Step 3: Confirm Recovery Key

**UI Elements:**
- Header: "Confirm You Saved It"
- Instruction: "Enter the first 4 characters of your recovery key to continue"
- Input: Single input field (4 characters, auto-uppercase, monospace)
- Validation: Must match first 4 chars of recovery key (case-insensitive)
- Button: "Complete Setup"

**Purpose:** Prevents accidental skip without saving recovery key

#### Final Step: Setup Complete

- Show success message: "✓ Vault Initialized"
- Transition to Dashboard (fade animation)

**Implementation Notes:**
- Use React state for multi-step wizard: `const [step, setStep] = useState<1 | 2 | 3>(1)`
- Generate recovery key in step 1 (keep in state throughout)
- Call `saveMasterPasswordConfig()` only after step 3 confirmation
- Clear recovery key from state after setup complete

---

### 4.2 LockScreen.tsx - Unified Authentication

**UI Changes:**

#### Single Input Mode

**Elements:**
- Header: "Unlock Vault"
- Single password input field:
  - Placeholder: "Enter master password" (default mode)
  - Type: "password" with show/hide toggle
  - Autofocus on mount
- Toggle link below input:
  - "Use recovery key instead →" (switches to recovery mode)
  - "Use master password instead ←" (switches back)
- Submit button: "Unlock Vault"
- Error display (below input, red text):
  - "Invalid password or recovery key" (on failed auth)
  - "3 attempts remaining" (lockout warning)

**Mode Switching:**
```typescript
const [mode, setMode] = useState<'password' | 'recovery'>('password');

// Update placeholder based on mode
placeholder={mode === 'password'
  ? 'Enter master password'
  : 'Enter recovery key (XXXX-XXXX-...)'
}
```

**Authentication Flow:**
- User enters input (either master password or recovery key)
- Click "Unlock" → call `authenticateAndGetVaultKey(input, config)`
- Function automatically tries both decryption paths
- If success → load vault, transition to Dashboard
- If failure → show error, increment lockout counter

**Lockout Display:**
- Keep existing lockout timer UI (unchanged)
- Show: "Vault Secured - Re-authentication available in 59:32"
- After lockout expires → allow retry

**Visual Changes:**
- Remove 3 question input fields
- Keep single unified input (cleaner, simpler UX)
- Keep existing futuristic theme (glowing borders, gradient button)
- Add subtle animation on mode switch (fade transition)

**Accessibility:**
- Enter key submits form
- Tab navigation works correctly
- Screen reader announces mode changes

---

### 4.3 Dashboard.tsx

**No changes required** - Dashboard operates on decrypted vault (agnostic to auth method)

---

## 5. App.tsx State Management

### State Changes

```typescript
// REMOVE (deprecated):
const [config, setConfig] = useState<SecurityConfig | null>(null);
const [userAnswers, setUserAnswers] = useState<[string, string, string] | null>(null);

// ADD (new):
const [config, setConfig] = useState<MasterPasswordConfig | null>(null);
const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);
```

**Key Difference:**
- **Old:** Store raw security answers in memory (authentication credentials)
- **New:** Store vault key in memory (encryption key only, cannot re-authenticate)
- **Security:** Vault key is useless to attacker without master password (can't unlock again)

### Updated Handler Functions

#### 5.1 handleSetupComplete

```typescript
const handleSetupComplete = async (masterPassword: string, recoveryKey: string) => {
  // Generate random vault key (32 bytes)
  const vaultKey = crypto.getRandomValues(new Uint8Array(32));

  // Save config (wraps vault key with both master password and recovery key)
  await storage.saveMasterPasswordConfig(masterPassword, recoveryKey, vaultKey);

  // Load config into state
  const newConfig = await storage.getMasterPasswordConfig();
  setConfig(newConfig);

  // Initialize empty encrypted vault
  await storage.savePasswords([], vaultKey);

  // Store vault key in memory (unlocked state)
  setVaultKey(vaultKey);
  setPasswords([]);
  setView(AppView.DASHBOARD);
};
```

#### 5.2 handleUnlock

```typescript
const handleUnlock = async (input: string) => {
  if (!config) return;

  // Authenticate and get vault key (tries both password and recovery paths)
  const result = await storage.authenticateAndGetVaultKey(input, config);

  if (result.success && result.vaultKey) {
    // Authentication passed - reset lockout
    const newLockoutState = { failedAttempts: 0, lockoutUntil: null };
    await storage.saveLockoutState(newLockoutState);
    setLockout(newLockoutState);

    // Load encrypted vault with vault key
    const decryptedPasswords = await storage.getPasswords(result.vaultKey);

    // Update state (unlock)
    setVaultKey(result.vaultKey);
    setPasswords(decryptedPasswords);
    setView(AppView.DASHBOARD);
  } else {
    // Authentication failed - increment lockout counter
    handleFailedAttempt();
  }
};
```

**Performance Note:** Argon2id takes ~500ms-1s, so add loading spinner during authentication

#### 5.3 handleLock

```typescript
const handleLock = useCallback(() => {
  setView(AppView.LOCK);

  // Clear sensitive data from memory when locking
  setVaultKey(null);      // Changed from setUserAnswers(null)
  setPasswords([]);

  // Clear inactivity timer
  if (inactivityTimerRef.current) {
    window.clearTimeout(inactivityTimerRef.current);
  }
}, []);
```

#### 5.4 handleAddPassword / handleDeletePassword

```typescript
const handleAddPassword = async (entry: PasswordEntry) => {
  if (!vaultKey) return; // Safety check (changed from userAnswers check)

  const updated = [entry, ...passwords];
  setPasswords(updated);
  await storage.savePasswords(updated, vaultKey); // Changed from userAnswers
};

const handleDeletePassword = async (id: string) => {
  if (!vaultKey) return;

  const updated = passwords.filter(p => p.id !== id);
  setPasswords(updated);
  await storage.savePasswords(updated, vaultKey);
};
```

### Initialization Logic

```typescript
useEffect(() => {
  const loadInitialData = async () => {
    // Check if migration needed (old security questions system)
    const needsMigration = await storage.migrateFromSecurityQuestions();
    if (needsMigration) {
      // Show migration screen (future enhancement)
      // For now, treat as new setup
    }

    const storedConfig = await storage.getMasterPasswordConfig();
    const storedLockout = await storage.getLockoutState();

    setConfig(storedConfig);
    setLockout(storedLockout);

    // Determine initial view
    if (!storedConfig || !storedConfig.isSetup) {
      setView(AppView.SETUP);
    } else {
      setView(AppView.LOCK);
    }
  };

  loadInitialData();
}, []);
```

### Auto-Lock Behavior (Unchanged)

- 5-minute inactivity timer (unchanged)
- Activity events: mousedown, mousemove, keypress, scroll, touchstart
- On lock → clear vaultKey from memory

---

## 6. Password Strength Validation (AI + Fallback)

### New Service: `services/passwordStrengthService.ts`

### Hybrid Validation Strategy

**Goal:** Instant feedback (rule-based) + intelligent insights (AI-powered)

**Two-tier approach:**
1. **Rule-based validation** (runs instantly, always available)
2. **Gemini AI enhancement** (runs in background, enhances feedback if API available)

### 6.1 Rule-Based Validation (Fallback)

```typescript
interface StrengthResult {
  score: number;        // 0-100
  feedback: string[];   // Array of suggestions
  level: 'weak' | 'fair' | 'good' | 'strong';
  isValid: boolean;     // Meets minimum requirements
}

function validateWithRules(password: string): StrengthResult
```

**Validation Checks:**

1. **Length Check**
   - < 8 chars: score = 0, "Too short (minimum 12 characters)"
   - 8-11 chars: score capped at 40, "Almost there (12+ recommended)"
   - 12-15 chars: +20 points
   - 16-19 chars: +25 points
   - 20+ chars: +30 points

2. **Character Diversity**
   - Has lowercase: +10 points
   - Has uppercase: +10 points
   - Has numbers: +10 points
   - Has symbols: +15 points
   - All 4 types: +5 bonus

3. **Entropy Calculation** (Shannon entropy)
   ```typescript
   function calculateEntropy(password: string): number {
     const freq = {};
     for (const char of password) {
       freq[char] = (freq[char] || 0) + 1;
     }
     let entropy = 0;
     for (const count of Object.values(freq)) {
       const p = count / password.length;
       entropy -= p * Math.log2(p);
     }
     return entropy;
   }
   ```
   - Entropy < 3.0: -10 points, "Too repetitive"
   - Entropy 3.0-4.0: No bonus
   - Entropy > 4.0: +10 points

4. **Common Password Check**
   - Check against top 10,000 common passwords (embedded list)
   - If found: score = 0, "This is a commonly used password"
   - List source: https://github.com/danielmiessler/SecLists

5. **Pattern Detection**
   - Sequential chars (e.g., "abc", "123"): -15 points, "Avoid sequences"
   - Repeated chars (e.g., "aaa", "111"): -10 points, "Too many repeated characters"
   - Keyboard patterns (e.g., "qwerty", "asdf"): -20 points, "Avoid keyboard patterns"

6. **Dictionary Words** (basic check)
   - Common English words (embedded list ~500 words): -5 points per word
   - Feedback: "Consider using a passphrase instead"

**Score to Level Mapping:**
- 0-39: "weak" (red)
- 40-59: "fair" (yellow)
- 60-79: "good" (green)
- 80-100: "strong" (blue)

**Minimum Requirements:**
- Length >= 12
- Score >= 60
- Not in common password list

### 6.2 Gemini AI Enhancement

```typescript
async function validateWithGemini(
  password: string,
  timeout: number = 3000
): Promise<StrengthResult>
```

**Implementation:**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

async function validateWithGemini(password: string, timeout: number): Promise<StrengthResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            score: { type: 'number', description: 'Score 0-100' },
            level: { type: 'string', enum: ['weak', 'fair', 'good', 'strong'] },
            feedback: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of improvement suggestions'
            },
            reasoning: { type: 'string', description: 'Explanation of score' }
          },
          required: ['score', 'level', 'feedback']
        }
      }
    });

    const prompt = `Analyze the strength of this master password for a password manager.

Password: "${password}"

Evaluate based on:
- Length and complexity
- Entropy and randomness
- Resistance to dictionary attacks
- Memorability vs security trade-off
- Common password patterns

Provide:
1. Score (0-100) - be strict, this protects all user passwords
2. Level (weak/fair/good/strong)
3. Specific, actionable feedback (max 3 suggestions)
4. Brief reasoning

IMPORTANT: Minimum acceptable score is 60. Encourage passphrases (4+ random words) over complex short passwords.`;

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);

    const response = result.response;
    const analysis = JSON.parse(response.text());

    return {
      score: analysis.score,
      level: analysis.level,
      feedback: analysis.feedback,
      isValid: analysis.score >= 60 && password.length >= 12
    };
  } catch (error) {
    console.warn('Gemini validation failed, using rule-based fallback:', error);
    throw error; // Let caller handle fallback
  }
}
```

**API Configuration:**
- Model: `gemini-2.0-flash-exp` (fast, cheap, good for validation)
- Timeout: 3 seconds (fail fast, don't block UX)
- Rate limit: 15 req/min (free tier) - more than enough for setup
- Security: Password sent to Gemini (acceptable for strength check, not logged by Google)

### 6.3 Unified Validation Hook (React)

```typescript
export function usePasswordStrength(password: string) {
  const [strength, setStrength] = useState<StrengthResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!password) {
      setStrength(null);
      return;
    }

    setIsLoading(true);

    // 1. Instant rule-based validation
    const ruleBasedResult = validateWithRules(password);
    setStrength(ruleBasedResult);
    setIsLoading(false);

    // 2. Try Gemini enhancement (background)
    const enhanceWithAI = async () => {
      try {
        const aiResult = await validateWithGemini(password, 3000);
        setStrength(aiResult); // Override with better insights
      } catch {
        // Keep rule-based result (already set)
      }
    };

    enhanceWithAI();
  }, [password]); // Debounce handled by caller

  return { strength, isLoading };
}
```

**Usage in SetupScreen:**

```typescript
// Debounce password input (avoid excessive validations)
const [password, setPassword] = useState('');
const debouncedPassword = useDebounce(password, 300); // 300ms delay
const { strength, isLoading } = usePasswordStrength(debouncedPassword);

// Render strength meter
<StrengthMeter strength={strength} isLoading={isLoading} />
```

### 6.4 Graceful Degradation

**Scenarios:**
1. **No API key** → Rule-based only (works perfectly offline)
2. **API key invalid** → Rule-based only (silent fallback, log warning)
3. **Rate limit exceeded** → Rule-based only (no user-facing error)
4. **Network timeout** → Rule-based only (after 3s timeout)
5. **API error** → Rule-based only (resilient)

**User Experience:**
- Always get instant feedback (rule-based)
- Sometimes get better feedback (AI-enhanced) after ~1-2 seconds
- Never blocked or stuck waiting for AI

---

## 7. Error Handling & Edge Cases

### 7.1 Corrupted Wrapped Vault Key

**Symptom:** Both master password and recovery key fail to decrypt wrapped vault key

**Causes:**
- Storage corruption (disk failure, browser bug)
- Manual tampering with localStorage
- Malicious code modifying storage

**Handling:**
```typescript
// In authenticateAndGetVaultKey()
if (!result.success) {
  // Check if this is corruption vs wrong password
  const isLikelyCorruption = await detectCorruption(config);

  if (isLikelyCorruption) {
    return {
      success: false,
      error: 'CORRUPTION_DETECTED',
      message: 'Vault corruption detected - unable to decrypt. This may be due to storage corruption or tampering.'
    };
  }
}
```

**UI Response:**
- Show error modal with red warning icon
- Message: "Vault Corruption Detected"
- Explanation: "Your vault data appears to be corrupted and cannot be decrypted. This may be due to storage corruption or tampering."
- Options:
  - "Try Recovery Key" (if not already tried)
  - "Export Encrypted Vault" (save encrypted data for forensics)
  - "Reset Vault (ALL DATA WILL BE LOST)"
- Reset requires typing: "DELETE ALL DATA" to confirm

### 7.2 Argon2id Library Load Failure

**Symptom:** `@noble/hashes/argon2` fails to load

**Causes:**
- Network error (CDN down)
- Content Security Policy blocking script
- Browser compatibility issue

**Detection:**
```typescript
// In App initialization
try {
  const { argon2id } = await import('@noble/hashes/argon2');
  setArgon2Available(true);
} catch (error) {
  console.error('Argon2 library failed to load:', error);
  setArgon2Available(false);

  // Show error to user
  showError({
    title: 'Security Module Failed to Load',
    message: 'The password hashing library could not be loaded. Please check your internet connection and reload the app.',
    actions: [
      { label: 'Reload App', onClick: () => window.location.reload() },
      { label: 'Continue with PBKDF2 (Less Secure)', onClick: () => setFallbackMode(true) }
    ]
  });
}
```

**Fallback Strategy:**
- Option 1: Block app until library loads (most secure)
- Option 2: Offer PBKDF2 fallback with warning banner (acceptable for emergency access)

### 7.3 Web Crypto API Unavailable

**Symptom:** `window.crypto.subtle` is undefined

**Causes:**
- Very old browser (pre-2017)
- Insecure context (HTTP instead of HTTPS)
- Browser privacy settings blocking crypto API

**Detection:**
```typescript
// In App.tsx useEffect
if (!window.crypto || !window.crypto.subtle) {
  showFatalError({
    title: 'Incompatible Browser',
    message: 'CipherGuard requires the Web Crypto API, which is not available in your browser. This usually means you are accessing the app over HTTP instead of HTTPS.',
    recommendation: 'Please access CipherGuard via HTTPS or use a modern browser (Chrome, Firefox, Safari, Edge).',
    cannotContinue: true
  });
  return;
}
```

**UI:**
- Show full-screen error (cannot proceed)
- No dismiss button (fatal error)
- Provide link to documentation: "Why is HTTPS required?"

### 7.4 Gemini API Failure (Non-Critical)

**Symptom:** Gemini API returns error or times out

**Causes:**
- Invalid API key
- Rate limit exceeded (15 req/min on free tier)
- Network error
- API service down

**Handling:**
```typescript
// In validateWithGemini()
try {
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
  ]);
  // ... process result
} catch (error) {
  // Silent fallback to rule-based validation
  console.warn('Gemini validation failed, using rule-based fallback:', error.message);
  throw error; // Caller (usePasswordStrength) handles gracefully
}
```

**User Experience:**
- No error message shown (graceful degradation)
- Rule-based validation used instead
- Log warning to console (dev mode only)

### 7.5 Recovery Key Lost + Master Password Forgotten

**Symptom:** User is permanently locked out

**Prevention:**
- Force recovery key confirmation during setup (step 3)
- Show warning banner during setup: "Cannot be recovered"

**If it happens:**
- After 3 failed attempts → lockout screen shows:
  - "Invalid master password or recovery key"
  - "If you've lost both, your vault cannot be recovered due to zero-knowledge encryption"
  - "This is by design - CipherGuard never sees your password"
- Options:
  - "Wait for Lockout to Expire" (1 hour)
  - "Reset Vault (ALL DATA WILL BE LOST)"
- Reset requires:
  - Typing "DELETE ALL DATA" (case-sensitive)
  - Checkbox: "I understand this cannot be undone"
  - Confirmation button (10-second countdown before enabled)

**Post-Reset:**
- Clear all storage (`cipherguard_master_config`, `cipherguard_vault`, `cipherguard_lockout`)
- Redirect to setup screen
- Show info banner: "Vault reset complete. Your old passwords are permanently lost."

### 7.6 Tauri Storage Failure

**Symptom:** `storage.setItem()` throws error

**Causes:**
- Disk full
- File system permissions denied
- Storage quota exceeded (localStorage limit)
- File system corruption

**Detection:**
```typescript
// In savePasswords(), saveMasterPasswordConfig(), etc.
try {
  await storage.setItem(key, value);
} catch (error) {
  console.error('Storage write failed:', error);
  throw new Error('STORAGE_WRITE_FAILED');
}
```

**Handling:**
```typescript
// In App.tsx handlers
try {
  await storage.savePasswords(updated, vaultKey);
} catch (error) {
  if (error.message === 'STORAGE_WRITE_FAILED') {
    showError({
      title: 'Failed to Save',
      message: 'Your changes could not be saved. This may be due to insufficient disk space or storage permissions.',
      actions: [
        { label: 'Retry', onClick: () => handleSaveRetry() },
        { label: 'Export Vault as JSON', onClick: () => handleExportVault() }
      ]
    });

    // DO NOT logout (keep vault key in memory until save succeeds)
    return;
  }
}
```

**Emergency Export:**
```typescript
function handleExportVault() {
  const vaultData = {
    passwords: passwords,
    exportedAt: new Date().toISOString(),
    warning: 'This is an UNENCRYPTED backup. Store it securely.'
  };

  const blob = new Blob([JSON.stringify(vaultData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cipherguard-vault-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 7.7 Inactivity Auto-Lock Edge Cases

**Scenario 1:** User is typing password entry when auto-lock triggers

**Handling:**
- Show warning toast 30 seconds before lock: "Auto-lock in 30s - any activity resets timer"
- If lock triggers mid-edit → show modal: "Session expired - your unsaved changes were lost"

**Scenario 2:** Multiple tabs open

**Handling:**
- Each tab has independent timer (localStorage lock state is shared)
- If one tab locks → broadcast event to other tabs
- All tabs lock simultaneously

**Implementation:**
```typescript
// Listen for storage events (cross-tab communication)
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'cipherguard_lock_signal' && e.newValue === 'locked') {
      handleLock();
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, [handleLock]);

// Broadcast lock to other tabs
const handleLock = () => {
  localStorage.setItem('cipherguard_lock_signal', 'locked');
  // ... rest of lock logic
};
```

---

## 8. Migration Strategy

### 8.1 Detecting Old Users

**Check for old config:**
```typescript
const oldConfig = await storage.getItem('cipherguard_config'); // Old key
const newConfig = await storage.getItem('cipherguard_master_config'); // New key

if (oldConfig && !newConfig) {
  // User has old security questions config, needs migration
  return 'NEEDS_MIGRATION';
}
```

### 8.2 Migration Flow

**Option A: Forced Migration (Recommended)**
- On app load, detect old config
- Show migration screen: "CipherGuard has been upgraded to use master password authentication"
- Require user to:
  1. Authenticate with old security questions (one last time)
  2. Set new master password
  3. Save new recovery key
- Behind the scenes:
  - Decrypt vault with old method
  - Re-encrypt with new master password
  - Delete old config, save new config
- Mark migration complete

**Option B: Gradual Migration**
- Support both systems simultaneously
- Show banner: "Upgrade to master password authentication (recommended)"
- User can continue using old system until they choose to migrate
- More complex codebase

**Recommendation:** Option A (forced migration on first launch after update)

### 8.3 Migration Implementation

```typescript
// New component: MigrationScreen.tsx
async function handleMigration(oldAnswers: [string, string, string], newMasterPassword: string) {
  // 1. Verify old answers
  const oldConfig = await getSecurityConfig();
  const isValid = await verifyAnswers(oldAnswers, oldConfig);
  if (!isValid) throw new Error('Invalid security answers');

  // 2. Decrypt vault with old method
  const passwords = await getPasswords(oldAnswers);

  // 3. Generate new recovery key
  const recoveryKey = generateRecoveryKey();

  // 4. Generate new vault key
  const vaultKey = crypto.getRandomValues(new Uint8Array(32));

  // 5. Save new config
  await saveMasterPasswordConfig(newMasterPassword, recoveryKey, vaultKey);

  // 6. Re-encrypt vault with new vault key
  await savePasswords(passwords, vaultKey);

  // 7. Delete old config
  await storage.removeItem('cipherguard_config');

  // 8. Show recovery key to user (MUST save it)
  showRecoveryKeyModal(recoveryKey);
}
```

### 8.4 Rollback Plan

**If migration fails mid-process:**
- Keep old config until migration fully completes
- Atomic operation: only delete old config after new config is confirmed saved
- If error occurs → show error, allow retry, do NOT lock user out

---

## 9. Implementation Checklist

### Phase 1: Core Cryptography
- [ ] Install `@noble/hashes` package (`npm install @noble/hashes`)
- [ ] Implement `deriveKeyFromPassword()` with Argon2id in `utils/crypto.ts`
- [ ] Implement `wrapVaultKey()` function
- [ ] Implement `unwrapVaultKey()` function
- [ ] Implement `generateRecoveryKey()` function
- [ ] Implement `parseRecoveryKey()` helper
- [ ] Add unit tests for all crypto functions
- [ ] Verify Argon2id parameters (memory: 64MB, iterations: 3)

### Phase 2: Storage Layer
- [ ] Create `MasterPasswordConfig` interface in `types.ts`
- [ ] Implement `saveMasterPasswordConfig()` in `utils/storage.ts`
- [ ] Implement `authenticateAndGetVaultKey()` in `utils/storage.ts`
- [ ] Update `savePasswords()` to use `vaultKey` instead of `answers`
- [ ] Update `getPasswords()` to use `vaultKey` instead of `answers`
- [ ] Rename `getMasterPasswordConfig()` (from `getSecurityConfig()`)
- [ ] Add migration helper `migrateFromSecurityQuestions()`
- [ ] Test storage functions with mock data

### Phase 3: Password Strength Validation
- [ ] Create `services/passwordStrengthService.ts`
- [ ] Implement rule-based validation (`validateWithRules()`)
- [ ] Add common password list (top 10k)
- [ ] Add pattern detection (sequences, keyboard patterns)
- [ ] Implement entropy calculation
- [ ] Implement Gemini AI validation (`validateWithGemini()`)
- [ ] Create `usePasswordStrength()` React hook
- [ ] Add debounce utility for password input
- [ ] Test fallback behavior (no API key, timeout, error)

### Phase 4: UI Components
- [ ] Update `SetupScreen.tsx` - Step 1: Master password input
- [ ] Add real-time password strength meter component
- [ ] Update `SetupScreen.tsx` - Step 2: Recovery key display
- [ ] Add download/copy/print buttons for recovery key
- [ ] Update `SetupScreen.tsx` - Step 3: Recovery key confirmation
- [ ] Update `LockScreen.tsx` - Single input with mode toggle
- [ ] Add loading spinner for Argon2id authentication (500ms-1s)
- [ ] Update error messages (new error types)
- [ ] Test UI flows (happy path + error cases)

### Phase 5: App State Management
- [ ] Update `App.tsx` state (`vaultKey` instead of `userAnswers`)
- [ ] Update `handleSetupComplete()` handler
- [ ] Update `handleUnlock()` handler
- [ ] Update `handleLock()` handler
- [ ] Update `handleAddPassword()` / `handleDeletePassword()` handlers
- [ ] Test state transitions (SETUP → DASHBOARD → LOCK)

### Phase 6: Error Handling
- [ ] Implement corruption detection logic
- [ ] Add vault reset flow (with "DELETE ALL DATA" confirmation)
- [ ] Add Argon2id load failure detection + fallback modal
- [ ] Add Web Crypto API availability check
- [ ] Add storage write failure handling + export fallback
- [ ] Test all error scenarios

### Phase 7: Migration (Optional)
- [ ] Implement migration detection (old config present)
- [ ] Create `MigrationScreen.tsx` component
- [ ] Implement `handleMigration()` flow
- [ ] Test migration with mock old data
- [ ] Add rollback safety (atomic config swap)

### Phase 8: Testing & QA
- [ ] Unit tests for crypto functions (100% coverage)
- [ ] Integration tests for auth flow (setup → lock → unlock)
- [ ] Test password strength validation (rule-based + Gemini)
- [ ] Test error scenarios (corruption, API failures, storage errors)
- [ ] Test cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Test performance (Argon2id should take ~500ms-1s)
- [ ] Security audit (no password leaks in console, memory, storage)

### Phase 9: Documentation
- [ ] Update README.md with new auth system
- [ ] Update CLAUDE.md with new architecture
- [ ] Add user guide: "How to use recovery key"
- [ ] Add troubleshooting guide (lost password, corruption, etc.)
- [ ] Document Argon2id parameters and rationale

### Phase 10: Deployment
- [ ] Run final security audit
- [ ] Test on production build (`npm run build && npm run preview`)
- [ ] Verify HTTPS requirement (Web Crypto API)
- [ ] Deploy to production
- [ ] Monitor for errors (Sentry, LogRocket, etc.)

---

## 10. Testing Strategy

### Unit Tests

**Crypto Functions (`utils/crypto.test.ts`):**
```typescript
describe('Argon2id Key Derivation', () => {
  test('derives consistent key from same password + salt', async () => {
    const password = 'test-password-123';
    const salt = new Uint8Array(16).fill(1);
    const key1 = await deriveKeyFromPassword(password, salt, argon2Params);
    const key2 = await deriveKeyFromPassword(password, salt, argon2Params);
    expect(key1).toEqual(key2);
  });

  test('derives different keys from different passwords', async () => {
    const salt = new Uint8Array(16).fill(1);
    const key1 = await deriveKeyFromPassword('password1', salt, argon2Params);
    const key2 = await deriveKeyFromPassword('password2', salt, argon2Params);
    expect(key1).not.toEqual(key2);
  });

  test('derives different keys from different salts', async () => {
    const password = 'test-password';
    const salt1 = new Uint8Array(16).fill(1);
    const salt2 = new Uint8Array(16).fill(2);
    const key1 = await deriveKeyFromPassword(password, salt1, argon2Params);
    const key2 = await deriveKeyFromPassword(password, salt2, argon2Params);
    expect(key1).not.toEqual(key2);
  });
});

describe('Key Wrapping', () => {
  test('wraps and unwraps vault key successfully', async () => {
    const vaultKey = crypto.getRandomValues(new Uint8Array(32));
    const derivedKey = crypto.getRandomValues(new Uint8Array(32));

    const wrapped = await wrapVaultKey(vaultKey, derivedKey);
    const unwrapped = await unwrapVaultKey(wrapped, derivedKey);

    expect(unwrapped).toEqual(vaultKey);
  });

  test('fails to unwrap with wrong derived key', async () => {
    const vaultKey = crypto.getRandomValues(new Uint8Array(32));
    const correctKey = crypto.getRandomValues(new Uint8Array(32));
    const wrongKey = crypto.getRandomValues(new Uint8Array(32));

    const wrapped = await wrapVaultKey(vaultKey, correctKey);
    const unwrapped = await unwrapVaultKey(wrapped, wrongKey);

    expect(unwrapped).toBeNull();
  });
});

describe('Recovery Key', () => {
  test('generates valid formatted recovery key', () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^[A-F0-9]{4}(-[A-F0-9]{4}){7}$/);
  });

  test('parses recovery key correctly (with and without hyphens)', () => {
    const original = 'A3F2-89BC-1D4E-7A05-B9C3-E82F-4D6A-0B17';
    expect(parseRecoveryKey(original)).toBe('A3F289BC1D4E7A05B9C3E82F4D6A0B17');
    expect(parseRecoveryKey('A3F289BC1D4E7A05B9C3E82F4D6A0B17')).toBe('A3F289BC1D4E7A05B9C3E82F4D6A0B17');
  });
});
```

**Storage Functions (`utils/storage.test.ts`):**
```typescript
describe('Master Password Config', () => {
  test('saves and retrieves config correctly', async () => {
    const masterPassword = 'super-secure-password-123';
    const recoveryKey = generateRecoveryKey();
    const vaultKey = crypto.getRandomValues(new Uint8Array(32));

    await saveMasterPasswordConfig(masterPassword, recoveryKey, vaultKey);
    const config = await getMasterPasswordConfig();

    expect(config).toBeDefined();
    expect(config.wrappedVaultKey_password).toBeDefined();
    expect(config.wrappedVaultKey_recovery).toBeDefined();
    expect(config.salt).toBeDefined();
  });
});

describe('Authentication', () => {
  test('authenticates with correct master password', async () => {
    const masterPassword = 'test-password-123';
    const recoveryKey = generateRecoveryKey();
    const vaultKey = crypto.getRandomValues(new Uint8Array(32));

    await saveMasterPasswordConfig(masterPassword, recoveryKey, vaultKey);
    const config = await getMasterPasswordConfig();

    const result = await authenticateAndGetVaultKey(masterPassword, config);

    expect(result.success).toBe(true);
    expect(result.vaultKey).toEqual(vaultKey);
  });

  test('authenticates with correct recovery key', async () => {
    const masterPassword = 'test-password-123';
    const recoveryKey = generateRecoveryKey();
    const vaultKey = crypto.getRandomValues(new Uint8Array(32));

    await saveMasterPasswordConfig(masterPassword, recoveryKey, vaultKey);
    const config = await getMasterPasswordConfig();

    const result = await authenticateAndGetVaultKey(recoveryKey, config);

    expect(result.success).toBe(true);
    expect(result.vaultKey).toEqual(vaultKey);
  });

  test('fails with wrong password', async () => {
    const masterPassword = 'correct-password';
    const recoveryKey = generateRecoveryKey();
    const vaultKey = crypto.getRandomValues(new Uint8Array(32));

    await saveMasterPasswordConfig(masterPassword, recoveryKey, vaultKey);
    const config = await getMasterPasswordConfig();

    const result = await authenticateAndGetVaultKey('wrong-password', config);

    expect(result.success).toBe(false);
    expect(result.vaultKey).toBeUndefined();
  });
});
```

**Password Strength (`services/passwordStrengthService.test.ts`):**
```typescript
describe('Rule-Based Validation', () => {
  test('rejects short passwords', () => {
    const result = validateWithRules('short');
    expect(result.score).toBeLessThan(40);
    expect(result.isValid).toBe(false);
    expect(result.feedback).toContain('Too short (minimum 12 characters)');
  });

  test('rejects common passwords', () => {
    const result = validateWithRules('password123');
    expect(result.score).toBe(0);
    expect(result.isValid).toBe(false);
  });

  test('accepts strong passphrase', () => {
    const result = validateWithRules('correct-horse-battery-staple');
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.isValid).toBe(true);
    expect(result.level).toMatch(/good|strong/);
  });
});
```

### Integration Tests

**Auth Flow (`App.integration.test.tsx`):**
```typescript
describe('Complete Auth Flow', () => {
  test('setup → lock → unlock flow', async () => {
    const { getByText, getByPlaceholderText } = render(<App />);

    // 1. Setup screen
    expect(getByText(/Initialize CipherGuard/i)).toBeInTheDocument();

    // Enter master password
    const passwordInput = getByPlaceholderText(/master password/i);
    fireEvent.change(passwordInput, { target: { value: 'super-secure-passphrase-2024' } });

    // Continue (skip steps 2-3 for brevity)
    // ... complete setup

    // 2. Should now be at Dashboard
    expect(getByText(/Password Vault/i)).toBeInTheDocument();

    // 3. Lock vault
    fireEvent.click(getByText(/Lock/i));
    expect(getByText(/Access Protocol/i)).toBeInTheDocument();

    // 4. Unlock with master password
    const unlockInput = getByPlaceholderText(/enter master password/i);
    fireEvent.change(unlockInput, { target: { value: 'super-secure-passphrase-2024' } });
    fireEvent.click(getByText(/Unlock Vault/i));

    // Should be back at Dashboard
    await waitFor(() => {
      expect(getByText(/Password Vault/i)).toBeInTheDocument();
    });
  });
});
```

### Security Tests

**Memory Leaks:**
```typescript
test('clears vault key from memory on lock', async () => {
  const app = render(<App />);
  // ... setup and unlock

  // Get reference to app state
  const { vaultKey } = app.container.querySelector('[data-testid="app-state"]');
  expect(vaultKey).toBeDefined();

  // Lock vault
  fireEvent.click(app.getByText(/Lock/i));

  // Vault key should be cleared
  const { vaultKey: clearedKey } = app.container.querySelector('[data-testid="app-state"]');
  expect(clearedKey).toBeNull();
});
```

**No Password in Console:**
```typescript
test('does not log passwords to console', () => {
  const consoleLogSpy = jest.spyOn(console, 'log');
  const consoleErrorSpy = jest.spyOn(console, 'error');

  // ... perform full auth flow

  expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('password'));
  expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('password'));
});
```

### Performance Tests

**Argon2id Performance:**
```typescript
test('Argon2id takes reasonable time (~500ms-2s)', async () => {
  const start = performance.now();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  await deriveKeyFromPassword('test-password', salt, argon2Params);

  const duration = performance.now() - start;
  expect(duration).toBeGreaterThan(300); // Not too fast (security)
  expect(duration).toBeLessThan(3000);   // Not too slow (UX)
});
```

---

## 11. Security Audit Checklist

Before deployment, verify:

- [ ] Master password never stored (not even hashed)
- [ ] Vault key cleared from memory on lock
- [ ] No passwords logged to console (production mode)
- [ ] Argon2id parameters match OWASP recommendations
- [ ] Recovery key generated with cryptographically secure RNG
- [ ] Web Crypto API used exclusively (no custom crypto)
- [ ] HTTPS enforced (Web Crypto requirement)
- [ ] No timing attacks in authentication (constant-time comparison)
- [ ] Storage corruption handled gracefully (no data loss)
- [ ] Lockout mechanism works correctly (3 attempts = 1 hour)
- [ ] Auto-lock clears sensitive data from memory
- [ ] Cross-tab locking works (shared lock signal)
- [ ] Emergency vault export is unencrypted (user warned)
- [ ] Gemini API does not log passwords (verify Google's policy)
- [ ] Recovery key confirmation prevents accidental skip

---

## 12. Future Enhancements (Out of Scope)

**V2 Features:**
- [ ] Biometric authentication (WebAuthn) as alternative to password
- [ ] Two-factor authentication (TOTP) for additional security layer
- [ ] Password history (track old passwords, prevent reuse)
- [ ] Breach detection (check passwords against HaveIBeenPwned)
- [ ] Secure password sharing (encrypt for specific recipients)
- [ ] Vault sync (encrypted cloud backup with E2EE)
- [ ] Mobile app (React Native with same crypto core)
- [ ] Browser extension (autofill passwords)
- [ ] Password strength monitoring (alert on weak passwords)
- [ ] Auto-lock customization (user-configurable timeout)

---

## Conclusion

This design upgrades CipherGuard from a security-questions-based system to a professional-grade master password manager with industry-standard cryptography (Argon2id), key wrapping architecture, and AI-powered password validation.

**Key Security Improvements:**
- **Argon2id** (vs PBKDF2): Memory-hard, GPU-resistant
- **Key wrapping** (vs direct derivation): Enables dual auth paths, password changes
- **No stored hashes** (vs SHA-256 hashes): Authentication via decryption (more secure)
- **Emergency recovery** (vs no recovery): Prevents permanent lockout

**Implementation Complexity:** Medium
- New dependency: `@noble/hashes` (~50KB)
- Crypto changes: ~200 lines
- Storage changes: ~150 lines
- UI changes: ~300 lines (SetupScreen, LockScreen)
- Total: ~650 lines of new/modified code

**Estimated Timeline:** 2-3 days for experienced developer
- Day 1: Crypto + Storage layer
- Day 2: UI components + State management
- Day 3: Testing + QA + Security audit

**Risk Assessment:** Low
- Well-established algorithms (Argon2id, AES-256-GCM)
- Minimal breaking changes (migration path available)
- Graceful degradation (Gemini API failures handled)
- Comprehensive error handling (no data loss scenarios)

**Approval Status:** ✅ Approved for implementation
