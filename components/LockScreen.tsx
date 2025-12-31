import React, { useState, useEffect } from 'react';
import { Lock, Timer, ShieldAlert, Unlock, Fingerprint } from 'lucide-react';
import { SecurityConfig, LockoutState } from '../types';

interface LockScreenProps {
  config: SecurityConfig;
  lockout: LockoutState;
  onUnlock: (answers: [string, string, string]) => void;
  onFailedAttempt: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ config, lockout, onUnlock, onFailedAttempt }) => {
  const [inputs, setInputs] = useState<[string, string, string]>(['', '', '']);
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
    if (lockout.lockoutUntil && Date.now() < lockout.lockoutUntil) return;
    onUnlock(inputs);
  };

  const isLocked = lockout.lockoutUntil && Date.now() < lockout.lockoutUntil;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#020408]">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] transition-colors duration-1000 ${isLocked ? 'bg-red-500/5' : 'bg-[#00f2ff]/5'}`} />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="relative inline-block mb-6">
            <div className={`absolute inset-0 blur-3xl rounded-full animate-pulse transition-colors duration-1000 ${isLocked ? 'bg-red-500/20' : 'bg-[#00f2ff]/20'}`} />
            <div className={`relative w-24 h-24 rounded-3xl border p-[1px] transition-all duration-500 transform ${isLocked ? 'border-red-500/50 scale-95' : 'border-[#00f2ff]/50'}`}>
              <div className="w-full h-full bg-[#080a0f] rounded-[23px] flex items-center justify-center overflow-hidden">
                {isLocked ? (
                  <Timer size={40} className="text-red-500 animate-pulse" />
                ) : (
                  <div className="relative">
                    <Lock size={40} className="text-[#00f2ff] transition-transform duration-500 group-hover:scale-110" />
                    <Fingerprint className="absolute -bottom-1 -right-1 text-[#7000ff] opacity-50" size={16} />
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            {isLocked ? 'Vault Secured' : 'Access Protocol'}
          </h1>
          <p className="text-slate-500 font-medium">
            {isLocked
              ? `Re-authentication available in ${timeLeft}`
              : `Verification required for decryption`}
          </p>
        </div>

        {!isLocked && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <div className="space-y-4">
              {config.questions.map((q, idx) => (
                <div key={idx} className="group relative">
                  <div className="absolute -inset-[1px] bg-gradient-to-r from-[#00f2ff]/30 to-[#7000ff]/30 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                  <div className="relative bg-[#080a0f] border border-white/5 rounded-2xl p-4 transition-all group-focus-within:bg-[#0c0f16]">
                    <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">{q}</label>
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder="Enter verification response..."
                      className="w-full bg-transparent text-white focus:outline-none mono text-sm"
                      value={inputs[idx]}
                      onChange={(e) => {
                        const next = [...inputs];
                        next[idx] = e.target.value;
                        setInputs(next as any);
                      }}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-1">
              {lockout.failedAttempts > 0 && (
                <div className="flex items-center gap-2 text-xs font-bold text-red-500/80 uppercase tracking-wider">
                  <ShieldAlert size={14} />
                  {3 - lockout.failedAttempts} attempts legacy
                </div>
              )}
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-auto">
                Secure Layer V4.2
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-14 relative group overflow-hidden rounded-2xl transition-all active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-[#00f2ff] transition-transform duration-500 transform translate-y-full group-hover:translate-y-0" />
              <div className="absolute inset-0 border border-[#00f2ff]/50 rounded-2xl" />
              <span className="relative flex items-center justify-center gap-2 text-[#00f2ff] font-bold group-hover:text-black transition-colors duration-300">
                Unlock Vault <Unlock size={18} />
              </span>
            </button>
          </form>
        )}

        {isLocked && (
          <div className="glass rounded-2xl p-6 border-red-500/20 text-center animate-in zoom-in-95 duration-500">
            <ShieldAlert size={32} className="mx-auto text-red-500 mb-4 opacity-50" />
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

