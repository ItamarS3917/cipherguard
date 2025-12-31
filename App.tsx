
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppView, SecurityConfig, LockoutState, PasswordEntry } from './types';
import * as storage from './utils/storage';
import SetupScreen from './components/SetupScreen';
import LockScreen from './components/LockScreen';
import Dashboard from './components/Dashboard';

const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes in milliseconds

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LOCK);
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [lockout, setLockout] = useState<LockoutState>({ failedAttempts: 0, lockoutUntil: null });
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  // Store user's raw answers in memory while authenticated (for encryption/decryption)
  const [userAnswers, setUserAnswers] = useState<[string, string, string] | null>(null);

  const inactivityTimerRef = useRef<number | null>(null);

  // Initialize App
  useEffect(() => {
    const loadInitialData = async () => {
      const storedConfig = await storage.getSecurityConfig();
      const storedLockout = await storage.getLockoutState();

      setConfig(storedConfig);
      setLockout(storedLockout);
      // Passwords will be loaded after authentication (they're encrypted)

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
    setUserAnswers(null);
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

  const handleSetupComplete = async (newConfig: SecurityConfig) => {
    // Save config with hashed answers, but keep raw answers for encryption
    const rawAnswers: [string, string, string] = [
      newConfig.answers[0],
      newConfig.answers[1],
      newConfig.answers[2]
    ];

    await storage.saveSecurityConfig(newConfig, rawAnswers);
    // Initialize empty encrypted vault
    await storage.savePasswords([], rawAnswers);

    setConfig(newConfig);
    setUserAnswers(rawAnswers);
    setPasswords([]);
    setView(AppView.DASHBOARD);
  };

  const handleUnlock = async (providedAnswers: [string, string, string]) => {
    if (!config) return;

    // Verify answers against hashed stored answers
    const isValid = await storage.verifyAnswers(providedAnswers, config);

    if (isValid) {
      // Reset failed attempts on success
      const newState = { failedAttempts: 0, lockoutUntil: null };
      await storage.saveLockoutState(newState);
      setLockout(newState);

      // Load encrypted vault with provided answers
      const decryptedPasswords = await storage.getPasswords(providedAnswers);
      setPasswords(decryptedPasswords);
      setUserAnswers(providedAnswers);
      setView(AppView.DASHBOARD);
    } else {
      // Invalid answers - increment failed attempts
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
    if (!userAnswers) return; // Safety check

    const updated = [entry, ...passwords];
    setPasswords(updated);
    await storage.savePasswords(updated, userAnswers);
  };

  const handleDeletePassword = async (id: string) => {
    if (!userAnswers) return; // Safety check

    const updated = passwords.filter(p => p.id !== id);
    setPasswords(updated);
    await storage.savePasswords(updated, userAnswers);
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
        onFailedAttempt={handleFailedAttempt} 
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
