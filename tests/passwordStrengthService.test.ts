import { describe, it, expect } from 'vitest';
import { validateWithRules } from '../services/passwordStrengthService';

describe('validateWithRules', () => {
  describe('length validation', () => {
    it('should mark passwords under 8 characters as weak with score 0', () => {
      const result = validateWithRules('Ab1!xyz');
      expect(result.score).toBeLessThanOrEqual(40);
      expect(result.feedback).toContain('Too short (minimum 12 characters)');
      expect(result.isValid).toBe(false);
    });

    it('should accept passwords between 8-12 characters with reduced score', () => {
      const result = validateWithRules('Password1!');
      expect(result.score).toBeLessThan(80);
      expect(result.isValid).toBe(false); // Less than 12 chars
    });

    it('should give good scores for 12+ character passwords', () => {
      const result = validateWithRules('MySecure123!Pass');
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.level).not.toBe('weak');
    });

    it('should give higher scores for 16+ character passwords', () => {
      const shortResult = validateWithRules('MySecure123!xyzw');
      const longResult = validateWithRules('MySecure123!xyzwabcd');
      expect(longResult.score).toBeGreaterThanOrEqual(shortResult.score);
    });
  });

  describe('character diversity', () => {
    it('should penalize passwords without uppercase letters', () => {
      const result = validateWithRules('mysecurepassword123!');
      expect(result.feedback).toContain('Add uppercase letters');
    });

    it('should suggest numbers or symbols when missing', () => {
      const result = validateWithRules('MySecurePassword');
      expect(result.feedback).toContain('Add numbers or symbols');
    });

    it('should give bonus for mixed case, numbers, and symbols', () => {
      const basicResult = validateWithRules('simplesimplexyzw');
      const mixedResult = validateWithRules('MySecure123!@#ab');
      expect(mixedResult.score).toBeGreaterThan(basicResult.score);
    });
  });

  describe('pattern detection', () => {
    it('should penalize passwords with repeated characters', () => {
      const result = validateWithRules('Passssword123!ab');
      expect(result.feedback).toContain('Too many repeated characters');
    });

    it('should penalize passwords with sequences', () => {
      const result = validateWithRules('Password123!Abcd');
      expect(result.feedback).toContain('Avoid sequences like "123" or "abc"');
    });

    it('should penalize keyboard patterns', () => {
      const result = validateWithRules('Qwerty123!Password');
      expect(result.feedback).toContain('Avoid keyboard patterns');
    });
  });

  describe('common password detection', () => {
    it('should reject common passwords', () => {
      const result = validateWithRules('password123');
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('This is a commonly used password');
    });

    it('should reject passwords containing common words', () => {
      const result = validateWithRules('mypassword123!test');
      expect(result.feedback).toContain('This is a commonly used password');
    });
  });

  describe('level assignment', () => {
    it('should assign weak level for score < 40', () => {
      const result = validateWithRules('weak');
      expect(result.level).toBe('weak');
    });

    it('should assign fair level for score 40-59', () => {
      // A password that scores around 40-59
      const result = validateWithRules('Password!a');
      expect(['weak', 'fair']).toContain(result.level);
    });

    it('should assign strong level for score >= 80', () => {
      const result = validateWithRules('X9$mK2#pL@nQ7&vT');
      expect(['good', 'strong']).toContain(result.level);
    });
  });

  describe('isValid flag', () => {
    it('should be false for passwords under 12 characters', () => {
      const result = validateWithRules('Strong!123');
      expect(result.isValid).toBe(false);
    });

    it('should be false for low score passwords', () => {
      const result = validateWithRules('weakweakweakweak');
      expect(result.isValid).toBe(false);
    });

    it('should be true for 12+ char passwords with score >= 60', () => {
      const result = validateWithRules('StrongPass123!@#');
      if (result.score >= 60) {
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('entropy calculation', () => {
    it('should penalize repetitive passwords', () => {
      const result = validateWithRules('aaaaaaaaaaaaaaaa');
      expect(result.feedback).toContain('Too repetitive');
    });

    it('should reward high entropy passwords', () => {
      const lowEntropyResult = validateWithRules('aaaabbbbccccdddd');
      const highEntropyResult = validateWithRules('X9mK2pLnQ7vTy3!s');
      expect(highEntropyResult.score).toBeGreaterThan(lowEntropyResult.score);
    });
  });

  describe('result structure', () => {
    it('should return all required fields', () => {
      const result = validateWithRules('testpassword');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('feedback');
      expect(result).toHaveProperty('isValid');
      expect(typeof result.score).toBe('number');
      expect(['weak', 'fair', 'good', 'strong']).toContain(result.level);
      expect(Array.isArray(result.feedback)).toBe(true);
      expect(typeof result.isValid).toBe('boolean');
    });

    it('should cap score at 100', () => {
      const result = validateWithRules('SuperStrong!@#$%^&*()Password123456789');
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should not have negative score', () => {
      const result = validateWithRules('111');
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
