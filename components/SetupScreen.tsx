import React, { useState } from 'react';
import { Shield, Lock, Terminal, Sparkles, ChevronRight } from 'lucide-react';
import { SecurityConfig } from '../types';

interface SetupScreenProps {
  onComplete: (config: SecurityConfig) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [questions, setQuestions] = useState<[string, string, string]>(['', '', '']);
  const [answers, setAnswers] = useState<[string, string, string]>(['', '', '']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (questions.every(q => q.trim()) && answers.every(a => a.trim())) {
      onComplete({
        questions,
        answers: answers.map(a => a.toLowerCase().trim()) as [string, string, string],
        isSetup: true
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#020408] selection:bg-[#00f2ff]/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#7000ff]/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-[#00f2ff]/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-2xl w-full glass rounded-[2.5rem] p-10 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[#00f2ff]/20 blur-2xl rounded-full animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00f2ff] to-[#7000ff] p-[1px] shadow-[0_0_30px_rgba(0,242,255,0.3)]">
              <div className="w-full h-full bg-[#020408] rounded-[15px] flex items-center justify-center text-[#00f2ff]">
                <Shield size={40} strokeWidth={1.5} />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-3">
            Initialize CipherGuard
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            Deploy your secure vault by setting up challenge-based authentication.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 gap-6">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="group relative">
                <div className="absolute -inset-[1px] bg-gradient-to-r from-[#00f2ff]/0 via-[#00f2ff]/20 to-[#7000ff]/0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative p-6 rounded-2xl bg-[#080a0f]/50 border border-white/5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Terminal size={14} className="text-[#00f2ff]" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#00f2ff]/60">Protocol 0{idx + 1}</span>
                  </div>
                  <input
                    type="text"
                    placeholder={`Security Question ${idx + 1}`}
                    className="w-full bg-transparent border-b border-white/10 pb-2 text-white placeholder:text-slate-600 focus:border-[#00f2ff] outline-none transition-all text-lg"
                    value={questions[idx]}
                    onChange={(e) => {
                      const newQ = [...questions];
                      newQ[idx] = e.target.value;
                      setQuestions(newQ as any);
                    }}
                    required
                  />
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Input highly specific secret answer..."
                      className="w-full bg-white/5 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 border border-white/5 focus:border-[#7000ff]/50 focus:bg-white/[0.08] outline-none transition-all mono text-sm"
                      value={answers[idx]}
                      onChange={(e) => {
                        const newA = [...answers];
                        newA[idx] = e.target.value;
                        setAnswers(newA as any);
                      }}
                      required
                    />
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="w-full h-16 relative group overflow-hidden rounded-2xl transition-all active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#00f2ff] via-[#7000ff] to-[#00f2ff] bg-[length:200%_auto] animate-gradient group-hover:bg-right transition-all duration-1000" />
            <div className="absolute inset-[1px] bg-[#020408] rounded-[15px] transition-colors group-hover:bg-transparent" />
            <span className="relative flex items-center justify-center gap-3 text-white font-bold text-lg group-hover:text-black">
              Commence Initialization
              <Sparkles size={20} className="animate-pulse" />
            </span>
          </button>
        </form>

        <div className="mt-8 flex justify-center gap-8 text-[10px] font-bold tracking-[0.2em] text-slate-600 uppercase">
          <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" /> E2E Encrypted</div>
          <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#00f2ff]/50" /> Zero Knowledge</div>
          <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#7000ff]/50" /> Local Vault</div>
        </div>
      </div>

      <style>{`
        @keyframes gradient {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .animate-gradient {
          animation: gradient 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default SetupScreen;

