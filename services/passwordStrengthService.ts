import { GoogleGenerativeAI } from '@google/generative-ai';

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

/**
 * Validate password using Gemini AI (with timeout)
 */
export async function validateWithGemini(
  password: string,
  timeout: number = 3000
): Promise<StrengthResult> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');
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
              description: 'Array of improvement suggestions (max 3)'
            }
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

IMPORTANT: Minimum acceptable score is 60. Encourage passphrases (4+ random words) over complex short passwords.`;

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);

    const response = await result.response;
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
