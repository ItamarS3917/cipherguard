import React, { useState, useEffect } from 'react';
import { Lock, Timer, ShieldAlert, Unlock } from 'lucide-react';
import { MasterPasswordConfig, LockoutState } from '../types';

interface LockScreenProps {
  config: MasterPasswordConfig;
  lockout: LockoutState;
  onUnlock: (input: string) => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ config, lockout, onUnlock }) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'password' | 'recovery'>('password');
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (lockout.lockoutUntil && Date.now() < lockout.lockoutUntil) {
      const interval = setInterval(() => {
        const remaining = lockout.lockoutUntil! - Date.now();
        if (remaining <= 0) {
          setTimeLeft('Expired');
          clearInterval(interval);
        } else {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockout.lockoutUntil]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    onUnlock(input);
    setInput(''); // Clear input after attempt
  };

  const isLocked = lockout.lockoutUntil && Date.now() < lockout.lockoutUntil;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#020408]">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="relative inline-block mb-6">
            <div className={`w-24 h-24 rounded-3xl border flex items-center justify-center ${
              isLocked ? 'border-red-500/50' : 'border-[#00f2ff]/50'
            }`}>
              {isLocked ? (
                <Timer size={40} className="text-red-500" />
              ) : (
                <Lock size={40} className="text-[#00f2ff]" />
              )}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isLocked ? 'Vault Secured' : 'Unlock Vault'}
          </h1>
          <p className="text-slate-500">
            {isLocked
              ? `Re-authentication available in ${timeLeft}`
              : mode === 'password'
                ? 'Enter your master password'
                : 'Enter your recovery key'}
          </p>
        </div>

        {!isLocked && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="password"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === 'password'
                    ? 'Enter master password'
                    : 'Enter recovery key (XXXX-XXXX-...)'
                }
                className="w-full bg-white/5 rounded-xl px-4 py-3 text-white border border-white/10 focus:border-[#00f2ff]/50 outline-none"
                required
              />
            </div>

            {/* Mode Toggle */}
            <button
              type="button"
              onClick={() => setMode(mode === 'password' ? 'recovery' : 'password')}
              className="text-sm text-[#00f2ff] hover:underline"
            >
              {mode === 'password'
                ? 'Use recovery key instead →'
                : '← Use master password instead'}
            </button>

            {/* Lockout Warning */}
            {lockout.failedAttempts > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <ShieldAlert size={16} />
                {3 - lockout.failedAttempts} attempts remaining
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full h-14 bg-[#00f2ff] rounded-xl text-black font-bold hover:bg-[#00d9e6] transition flex items-center justify-center gap-2"
            >
              Unlock Vault <Unlock size={18} />
            </button>
          </form>
        )}

        {isLocked && (
          <div className="glass rounded-2xl p-6 border-red-500/20 text-center">
            <ShieldAlert size={32} className="mx-auto text-red-500 mb-4" />
            <p className="text-sm text-slate-400">
              Multiple failed attempts detected. <br />
              System locked to prevent brute-force attacks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LockScreen;
