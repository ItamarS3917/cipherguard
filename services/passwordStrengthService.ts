export interface StrengthResult {
  score: number;        // 0-100
  feedback: string[];   // Array of suggestions
  level: 'weak' | 'fair' | 'good' | 'strong';
  isValid: boolean;     // Meets minimum requirements
}

/**
 * Calculate Shannon entropy of password
 */
function calculateEntropy(password: string): number {
  const freq: Record<string, number> = {};
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

/**
 * Validate password using rule-based algorithm
 */
export function validateWithRules(password: string): StrengthResult {
  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length < 8) {
    score = 0;
    feedback.push('Too short (minimum 12 characters)');
  } else if (password.length < 12) {
    score = 40;
    feedback.push('Almost there (12+ recommended)');
  } else if (password.length >= 12 && password.length < 16) {
    score += 20;
  } else if (password.length >= 16 && password.length < 20) {
    score += 25;
  } else {
    score += 30;
  }

  // Character diversity
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  if (hasLower) score += 10;
  if (hasUpper) score += 10;
  if (hasNumber) score += 10;
  if (hasSymbol) score += 15;
  if (hasLower && hasUpper && hasNumber && hasSymbol) score += 5;

  if (!hasUpper) feedback.push('Add uppercase letters');
  if (!hasNumber && !hasSymbol) feedback.push('Add numbers or symbols');

  // Entropy check
  const entropy = calculateEntropy(password);
  if (entropy < 3.0) {
    score -= 10;
    feedback.push('Too repetitive');
  } else if (entropy > 4.0) {
    score += 10;
  }

  // Pattern detection
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push('Too many repeated characters');
  }

  if (/(abc|bcd|cde|123|234|345|456|567|678|789)/i.test(password)) {
    score -= 15;
    feedback.push('Avoid sequences like "123" or "abc"');
  }

  if (/(qwerty|asdf|zxcv)/i.test(password)) {
    score -= 20;
    feedback.push('Avoid keyboard patterns');
  }

  // Common password check (basic)
  const commonPasswords = [
    'password', 'password123', '12345678', 'qwerty', 'abc123',
    'password1', '12345', '1234567890', 'letmein', 'welcome'
  ];

  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score = 0;
    feedback.push('This is a commonly used password');
  }

  // Cap score at 100
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 40) level = 'weak';
  else if (score < 60) level = 'fair';
  else if (score < 80) level = 'good';
  else level = 'strong';

  // Check minimum requirements
  const isValid = password.length >= 12 && score >= 60;

  return { score, feedback, level, isValid };
}
