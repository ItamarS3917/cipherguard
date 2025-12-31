
export interface PasswordEntry {
  id: string;
  site: string;
  username: string;
  password: string;
  category: 'social' | 'work' | 'finance' | 'other';
  createdAt: number;
}

export interface SecurityConfig {
  questions: [string, string, string];
  answers: [string, string, string]; // Ideally hashed, but we'll use simple storage for this local demo
  isSetup: boolean;
}

export interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number | null;
}

export enum AppView {
  SETUP = 'SETUP',
  LOCK = 'LOCK',
  DASHBOARD = 'DASHBOARD'
}
