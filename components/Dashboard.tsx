import React, { useState, useEffect } from 'react';
import { Plus, Search, LogOut, Copy, ExternalLink, Trash2, Key, Sparkles, ShieldCheck, Eye, EyeOff, Activity, Shield, Command } from 'lucide-react';
import { PasswordEntry } from '../types';
import { generateStrongPassword, checkPasswordStrength } from '../services/geminiService';

interface DashboardProps {
  passwords: PasswordEntry[];
  onAdd: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
  onLock: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ passwords, onAdd, onDelete, onLock }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showPassMap, setShowPassMap] = useState<Record<string, boolean>>({});
  const [loadingAI, setLoadingAI] = useState(false);

  const [newEntry, setNewEntry] = useState<Partial<PasswordEntry>>({
    site: '',
    username: '',
    password: '',
    category: 'other'
  });
  const [strengthInfo, setStrengthInfo] = useState<{ score: number, tip: string } | null>(null);

  const filteredPasswords = passwords.filter(p =>
    p.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleShow = (id: string) => {
    setShowPassMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleGenerate = async () => {
    if (!newEntry.site) return;
    setLoadingAI(true);
    const result = await generateStrongPassword(newEntry.site);
    if (result) {
      setNewEntry(prev => ({ ...prev, password: result.password }));
      setStrengthInfo({ score: 95, tip: result.reason });
    }
    setLoadingAI(false);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEntry.site && newEntry.username && newEntry.password) {
      onAdd({
        ...newEntry as PasswordEntry,
        id: crypto.randomUUID(),
        createdAt: Date.now()
      });
      setNewEntry({ site: '', username: '', password: '', category: 'other' });
      setIsAdding(false);
      setStrengthInfo(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#020408] text-slate-200 pb-20 selection:bg-[#00f2ff]/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-[#7000ff]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-[#00f2ff]/5 blur-[120px] rounded-full" />
      </div>

      {/* Navbar */}
      <nav className="border-b border-white/5 bg-[#020408]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#00f2ff] to-[#7000ff] blur opacity-40 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />
              <div className="relative p-2.5 bg-[#080a0f] rounded-xl border border-white/10 group-hover:border-[#00f2ff]/50 transition-colors">
                <Shield size={24} className="text-[#00f2ff]" strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white block">CipherGuard</span>
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#00f2ff]/60 block -mt-1">Quantum Vault</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Encrypted</div>
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-700" /> V4.2.0</div>
            </div>
            <div className="h-6 w-[1px] bg-white/5 hidden md:block" />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAdding(true)}
                className="relative group transition-all active:scale-95"
              >
                <div className="absolute inset-0 bg-[#00f2ff] blur-md opacity-0 group-hover:opacity-40 transition-opacity" />
                <div className="relative bg-[#080a0f] hover:bg-[#0c0f16] border border-[#00f2ff]/30 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all">
                  <Plus size={18} className="text-[#00f2ff]" /> New Secret
                </div>
              </button>
              <button
                onClick={onLock}
                className="p-2.5 bg-white/5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-400 border border-white/5 transition-all active:scale-90"
                title="Lock Vault"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full group relative">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-[#00f2ff]/20 via-[#7000ff]/20 to-[#00f2ff]/20 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f2ff] transition-colors" size={20} />
              <input
                type="text"
                placeholder="Search encrypted records..."
                className="w-full bg-[#080a0f]/50 border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-white focus:outline-none transition-all placeholder:text-slate-600 text-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] font-bold text-slate-500">
                <Command size={10} /> K
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full md:w-auto min-w-[340px]">
            <div className="glass p-5 rounded-2xl flex items-center gap-4 bg-[#080a0f]/40">
              <div className="w-12 h-12 rounded-xl bg-[#00f2ff]/10 flex items-center justify-center text-[#00f2ff] border border-[#00f2ff]/20">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Total Secrets</p>
                <p className="text-xl font-bold text-white leading-none mt-1">{passwords.length}</p>
              </div>
            </div>
            <div className="glass p-5 rounded-2xl flex items-center gap-4 bg-[#080a0f]/40">
              <div className="w-12 h-12 rounded-xl bg-[#7000ff]/10 flex items-center justify-center text-[#7000ff] border border-[#7000ff]/20">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Security Status</p>
                <p className="text-xl font-bold text-white leading-none mt-1">Prime</p>
              </div>
            </div>
          </div>
        </div>

        {/* Password List */}
        {filteredPasswords.length === 0 ? (
          <div className="text-center py-32 rounded-[3rem] border-2 border-dashed border-white/5 bg-[#080a0f]/20 animate-in fade-in zoom-in duration-700">
            <div className="inline-flex p-8 rounded-full bg-gradient-to-tr from-[#00f2ff]/5 to-[#7000ff]/5 text-slate-600 mb-6 border border-white/5">
              <Sparkles size={64} className="opacity-20 text-[#00f2ff]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Void Vault</h3>
            <p className="text-slate-500 max-w-sm mx-auto text-lg leading-relaxed">
              No encrypted records found matching your current query.
              <br /><span className="text-slate-700 text-sm mt-2 block font-mono">Status: Awaiting input...</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPasswords.map(entry => (
              <div key={entry.id} className="group relative">
                <div className="absolute -inset-[1px] bg-gradient-to-br from-[#00f2ff]/0 to-[#7000ff]/0 group-hover:from-[#00f2ff]/20 group-hover:to-[#7000ff]/20 rounded-3xl transition-all duration-500" />
                <div className="relative bg-[#080a0f] border border-white/5 rounded-[2rem] p-8 transition-all duration-500 group-hover:translate-y-[-4px] group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2 h-2 rounded-full ${entry.category === 'finance' ? 'bg-amber-400' :
                            entry.category === 'social' ? 'bg-[#00f2ff]' :
                              entry.category === 'work' ? 'bg-[#7000ff]' : 'bg-slate-500'
                          } shadow-[0_0_8px_currentColor]`} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          {entry.category}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-white truncate group-hover:text-[#00f2ff] transition-colors">{entry.site}</h3>
                    </div>
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="p-3 bg-white/0 hover:bg-red-500/10 rounded-xl text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/[0.03] group/item relative">
                      <p className="text-[9px] uppercase font-black text-slate-600 tracking-widest mb-2">Record Identifier</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-300 truncate pr-4">{entry.username}</span>
                        <button onClick={() => handleCopy(entry.username)} className="p-2 text-slate-500 hover:text-[#00f2ff] bg-white/0 hover:bg-[#00f2ff]/5 rounded-lg transition-all active:scale-90">
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="bg-black/40 p-4 rounded-2xl border border-white/[0.03] group/item relative">
                      <p className="text-[9px] uppercase font-black text-slate-600 tracking-widest mb-2">Decrypted Protocol</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm mono font-medium text-[#00f2ff] tracking-widest">
                          {showPassMap[entry.id] ? entry.password : '••••••••••••'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleShow(entry.id)} className="p-2 text-slate-500 hover:text-[#00f2ff] bg-white/0 hover:bg-[#00f2ff]/5 rounded-lg transition-all active:scale-90">
                            {showPassMap[entry.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button onClick={() => handleCopy(entry.password)} className="p-2 text-slate-500 hover:text-[#00f2ff] bg-white/0 hover:bg-[#00f2ff]/5 rounded-lg transition-all active:scale-90">
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020408]/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="absolute inset-0 z-[-1]" onClick={() => setIsAdding(false)} />
          <div className="w-full max-w-xl glass rounded-[2.5rem] p-10 border-white/10 relative animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 overflow-hidden">
            {/* Modal Background Decor */}
            <div className="absolute -top-[20%] -right-[20%] w-[60%] h-[60%] bg-[#00f2ff]/10 blur-[80px] rounded-full" />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-[#00f2ff]/10 rounded-2xl border border-[#00f2ff]/20">
                  <Key size={24} className="text-[#00f2ff]" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white leading-none">New Secret</h2>
                  <p className="text-slate-500 mt-1 font-medium italic">Encrypting at the edge...</p>
                </div>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Service Entity</label>
                    <input
                      type="text"
                      placeholder="e.g. Proton"
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#00f2ff]/50 outline-none transition-all placeholder:text-slate-700"
                      value={newEntry.site}
                      onChange={e => setNewEntry(p => ({ ...p, site: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Classification</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#00f2ff]/50 outline-none appearance-none cursor-pointer"
                        value={newEntry.category}
                        onChange={e => setNewEntry(p => ({ ...p, category: e.target.value as any }))}
                      >
                        <option value="other">General</option>
                        <option value="social">Social</option>
                        <option value="work">Corporate</option>
                        <option value="finance">Banking</option>
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                        <ChevronRight size={16} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Identity Identifier</label>
                  <input
                    type="text"
                    placeholder="Username or email address..."
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#00f2ff]/50 outline-none transition-all placeholder:text-slate-700 font-mono text-sm"
                    value={newEntry.username}
                    onChange={e => setNewEntry(p => ({ ...p, username: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Secret Protocol</label>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={loadingAI || !newEntry.site}
                      className="text-[10px] font-black text-[#00f2ff] hover:text-[#00f2ff]/80 flex items-center gap-1.5 disabled:opacity-30 transition-all uppercase tracking-widest"
                    >
                      <Sparkles size={12} /> {loadingAI ? 'Calculating...' : 'Quantum Generate'}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-[#00f2ff]/50 outline-none font-mono tracking-widest"
                    value={newEntry.password}
                    onChange={e => setNewEntry(p => ({ ...p, password: e.target.value }))}
                    required
                  />
                  {strengthInfo && (
                    <div className="mt-4 p-4 bg-[#00f2ff]/5 border border-[#00f2ff]/10 rounded-2xl animate-in slide-in-from-top-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black text-[#00f2ff] uppercase tracking-widest">Entropy Level</span>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{strengthInfo.score}% Prime</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed italic">"{strengthInfo.tip}"</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 h-14 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-slate-400 transition-all active:scale-95"
                  >
                    Abort
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-14 bg-gradient-to-r from-[#00f2ff] to-[#7000ff] text-black rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:shadow-[0_0_30px_rgba(0,242,255,0.3)] active:scale-95"
                  >
                    Commit Secret
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Internal component for dropdown icon
const ChevronRight = ({ size, className, ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default Dashboard;

