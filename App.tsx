
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppView, MasterPasswordConfig, LockoutState, PasswordEntry } from './types';
import * as storage from './utils/storage';
import SetupScreen from './components/SetupScreen';
import LockScreen from './components/LockScreen';
import Dashboard from './components/Dashboard';

const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes in milliseconds

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LOCK);
  const [config, setConfig] = useState<MasterPasswordConfig | null>(null);
  const [lockout, setLockout] = useState<LockoutState>({ failedAttempts: 0, lockoutUntil: null });
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);

  const inactivityTimerRef = useRef<number | null>(null);

  // Initialize App
  useEffect(() => {
    const loadInitialData = async () => {
      const storedConfig = await storage.getMasterPasswordConfig();
      const storedLockout = await storage.getLockoutState();

      setConfig(storedConfig);
      setLockout(storedLockout);

      if (!storedConfig || !storedConfig.isSetup) {
        setView(AppView.SETUP);
      } else {
        setView(AppView.LOCK);
      }
    };

    loadInitialData();
  }, []);

  const handleLock = useCallback(() => {
    setView(AppView.LOCK);
    // Clear sensitive data from memory when locking
    setVaultKey(null);
    setPasswords([]);
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
    }
  }, []);

  // Inactivity Timer Logic
  useEffect(() => {
    if (view !== AppView.DASHBOARD) {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      return;
    }

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = window.setTimeout(() => {
        handleLock();
      }, INACTIVITY_LIMIT);
    };

    // Events that count as activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Initial start
    resetInactivityTimer();

    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [view, handleLock]);

  const handleSetupComplete = async (masterPassword: string, recoveryKey: string) => {
    // Generate random vault key (32 bytes)
    const vaultKeyBytes = crypto.getRandomValues(new Uint8Array(32));

    // Save config (wraps vault key with both master password and recovery key)
    await storage.saveMasterPasswordConfig(masterPassword, recoveryKey, vaultKeyBytes);

    // Load config into state
    const newConfig = await storage.getMasterPasswordConfig();
    setConfig(newConfig);

    // Initialize empty encrypted vault
    await storage.savePasswords([], vaultKeyBytes);

    // Store vault key in memory (unlocked state)
    setVaultKey(vaultKeyBytes);
    setPasswords([]);
    setView(AppView.DASHBOARD);
  };

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

  const handleFailedAttempt = async () => {
    const nextAttempts = lockout.failedAttempts + 1;
    let nextLockoutUntil = null;

    // "more than 2 times" means on the 3rd failed attempt, we lock.
    if (nextAttempts >= 3) {
      // Lock for 1 hour
      nextLockoutUntil = Date.now() + (60 * 60 * 1000);
    }

    const newState = {
      failedAttempts: nextAttempts >= 3 ? 0 : nextAttempts,
      lockoutUntil: nextLockoutUntil
    };

    await storage.saveLockoutState(newState);
    setLockout(newState);
  };

  const handleAddPassword = async (entry: PasswordEntry) => {
    if (!vaultKey) return; // Safety check

    const updated = [entry, ...passwords];
    setPasswords(updated);
    await storage.savePasswords(updated, vaultKey);
  };

  const handleDeletePassword = async (id: string) => {
    if (!vaultKey) return; // Safety check

    const updated = passwords.filter(p => p.id !== id);
    setPasswords(updated);
    await storage.savePasswords(updated, vaultKey);
  };

  // Rendering logic
  if (view === AppView.SETUP) {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  if (view === AppView.LOCK && config) {
    return (
      <LockScreen
        config={config}
        lockout={lockout}
        onUnlock={handleUnlock}
      />
    );
  }

  if (view === AppView.DASHBOARD) {
    return (
      <Dashboard 
        passwords={passwords} 
        onAdd={handleAddPassword} 
        onDelete={handleDeletePassword}
        onLock={handleLock}
      />
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
    </div>
  );
};

export default App;
