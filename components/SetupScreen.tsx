import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import { MasterPasswordConfig } from '../types';
import { generateRecoveryKey } from '../utils/crypto';
import { validateWithRules, StrengthResult } from '../services/passwordStrengthService';

interface SetupScreenProps {
  onComplete: (masterPassword: string, recoveryKey: string) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [savedRecoveryKey, setSavedRecoveryKey] = useState(false);
  const [confirmRecoveryInput, setConfirmRecoveryInput] = useState('');

  // Password strength (using rule-based for now)
  const [strength, setStrength] = useState<StrengthResult | null>(null);

  // Step 1: Master Password
  const handlePasswordChange = (value: string) => {
    setMasterPassword(value);
    if (value) {
      setStrength(validateWithRules(value));
    } else {
      setStrength(null);
    }
  };

  const canProceedStep1 =
    masterPassword.length >= 12 &&
    masterPassword === confirmPassword &&
    (strength?.score || 0) >= 60;

  const handleStep1Continue = () => {
    const key = generateRecoveryKey();
    setRecoveryKey(key);
    setStep(2);
  };

  // Step 2: Recovery Key Display
  const handleDownloadRecoveryKey = () => {
    const content = `CipherGuard Emergency Recovery Key
===================================
IMPORTANT: Keep this key safe and secret.
This is your only way to recover your vault if you forget your master password.

Recovery Key:
${recoveryKey}

Created: ${new Date().toISOString()}

Do NOT share this key with anyone.
Store it in a secure location (password manager, safe, etc.)`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cipherguard-recovery-key.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyRecoveryKey = async () => {
    await navigator.clipboard.writeText(recoveryKey);
    // Show copied toast (simple version)
    alert('Recovery key copied to clipboard!');
  };

  const canProceedStep2 = savedRecoveryKey;

  // Step 3: Confirm Recovery Key
  const handleStep3Complete = () => {
    onComplete(masterPassword, recoveryKey);
  };

  const canProceedStep3 =
    confirmRecoveryInput.toUpperCase() === recoveryKey.slice(0, 4);

  // Render based on step
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#020408]">
        <div className="max-w-lg w-full glass rounded-3xl p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <Shield size={48} className="text-[#00f2ff] mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Create Master Password</h1>
            <p className="text-slate-400">This is the only password you'll need to remember</p>
          </div>

          <div className="space-y-6">
            {/* Master Password Input */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Master Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className="w-full bg-white/5 rounded-xl px-4 py-3 text-white border border-white/10 focus:border-[#00f2ff]/50 outline-none"
                  placeholder="Enter a strong password (12+ characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 rounded-xl px-4 py-3 text-white border border-white/10 focus:border-[#00f2ff]/50 outline-none"
                placeholder="Re-enter your password"
              />
            </div>

            {/* Strength Meter */}
            {strength && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Password Strength</span>
                  <span className={
                    strength.level === 'weak' ? 'text-red-500' :
                    strength.level === 'fair' ? 'text-yellow-500' :
                    strength.level === 'good' ? 'text-green-500' :
                    'text-blue-500'
                  }>
                    {strength.level.toUpperCase()} ({strength.score}/100)
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      strength.level === 'weak' ? 'bg-red-500' :
                      strength.level === 'fair' ? 'bg-yellow-500' :
                      strength.level === 'good' ? 'bg-green-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
                {strength.feedback.length > 0 && (
                  <ul className="text-xs text-slate-400 space-y-1">
                    {strength.feedback.map((fb, i) => (
                      <li key={i}>• {fb}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Password Match Indicator */}
            {confirmPassword && (
              <div className={`text-sm ${masterPassword === confirmPassword ? 'text-green-500' : 'text-red-500'}`}>
                {masterPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </div>
            )}

            {/* Continue Button */}
            <button
              onClick={handleStep1Continue}
              disabled={!canProceedStep1}
              className="w-full h-14 bg-gradient-to-r from-[#00f2ff] to-[#7000ff] rounded-xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#020408]">
        <div className="max-w-2xl w-full glass rounded-3xl p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <Lock size={48} className="text-yellow-500 mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Save Your Emergency Recovery Key</h1>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-4">
              <p className="text-yellow-500 text-sm">
                ⚠️ This is your ONLY way to recover access if you forget your master password
              </p>
              <p className="text-yellow-500 text-sm mt-2">
                ⚠️ CipherGuard cannot reset your password - we never see it
              </p>
            </div>
          </div>

          {/* Recovery Key Display */}
          <div className="bg-white/5 rounded-xl p-6 mb-6">
            <div className="font-mono text-2xl text-center text-white tracking-wider break-all">
              {recoveryKey}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={handleCopyRecoveryKey}
              className="px-4 py-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition"
            >
              📋 Copy to Clipboard
            </button>
            <button
              onClick={handleDownloadRecoveryKey}
              className="px-4 py-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition"
            >
              💾 Download as File
            </button>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-center gap-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={savedRecoveryKey}
              onChange={(e) => setSavedRecoveryKey(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-white">I have saved my recovery key in a safe place</span>
          </label>

          {/* Continue Button */}
          <button
            onClick={() => setStep(3)}
            disabled={!canProceedStep2}
            className="w-full h-14 bg-gradient-to-r from-[#00f2ff] to-[#7000ff] rounded-xl text-white font-bold disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Confirm Recovery Key
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#020408]">
      <div className="max-w-lg w-full glass rounded-3xl p-10">
        <div className="flex flex-col items-center text-center mb-8">
          <Shield size={48} className="text-[#00f2ff] mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Confirm You Saved It</h1>
          <p className="text-slate-400">Enter the first 4 characters of your recovery key</p>
        </div>

        <div className="space-y-6">
          <input
            type="text"
            value={confirmRecoveryInput}
            onChange={(e) => setConfirmRecoveryInput(e.target.value.toUpperCase())}
            maxLength={4}
            className="w-full bg-white/5 rounded-xl px-4 py-3 text-white text-center font-mono text-2xl border border-white/10 focus:border-[#00f2ff]/50 outline-none uppercase"
            placeholder="XXXX"
          />

          <button
            onClick={handleStep3Complete}
            disabled={!canProceedStep3}
            className="w-full h-14 bg-gradient-to-r from-[#00f2ff] to-[#7000ff] rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Complete Setup <Sparkles size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;
