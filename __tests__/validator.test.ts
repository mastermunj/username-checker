/**
 * Tests for Validator class
 */

import { describe, it, expect } from 'vitest';
import { Validator } from '../src/Validator.js';

describe('Validator', () => {
  describe('validate()', () => {
    it('should return valid for normal usernames', () => {
      const result = Validator.validate('johndoe');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedUsername).toBe('johndoe');
    });

    it('should return invalid for empty username', () => {
      const result = Validator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return invalid for whitespace-only username', () => {
      const result = Validator.validate('   ');
      expect(result.valid).toBe(false);
    });

    it('should return invalid for very short username', () => {
      const result = Validator.validate('a');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username must be at least 2 characters long');
    });

    it('should return invalid for very long username', () => {
      const result = Validator.validate('a'.repeat(101));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username must be at most 100 characters long');
    });

    it('should return invalid for usernames with unsafe characters', () => {
      const result = Validator.validate('user<script>');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username contains potentially unsafe characters');
    });

    it('should return invalid for usernames with spaces', () => {
      const result = Validator.validate('user name');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username cannot contain spaces');
    });

    it('should warn for reserved usernames', () => {
      const result = Validator.validate('admin');
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('reserved');
    });

    it('should warn for username starting with special character', () => {
      const result = Validator.validate('.username');
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('starts with a special character'))).toBe(true);
    });

    it('should warn for username ending with special character', () => {
      const result = Validator.validate('.username.');
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('ends with a special character'))).toBe(true);
    });

    it('should warn for consecutive special characters', () => {
      const result = Validator.validate('.user..name');
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('consecutive special characters'))).toBe(true);
    });

    it('should trim whitespace', () => {
      const result = Validator.validate('  username  ');
      expect(result.normalizedUsername).toBe('username');
    });
  });

  describe('isSafe()', () => {
    it('should return true for normal usernames', () => {
      expect(Validator.isSafe('johndoe')).toBe(true);
      expect(Validator.isSafe('user123')).toBe(true);
      expect(Validator.isSafe('my-user_name')).toBe(true);
    });

    it('should return false for empty username', () => {
      expect(Validator.isSafe('')).toBe(false);
    });

    it('should return false for very short/long usernames', () => {
      expect(Validator.isSafe('a')).toBe(false);
      expect(Validator.isSafe('a'.repeat(101))).toBe(false);
    });

    it('should return false for unsafe characters', () => {
      expect(Validator.isSafe('user<script>')).toBe(false);
      expect(Validator.isSafe("user'drop")).toBe(false);
      expect(Validator.isSafe('user;rm')).toBe(false);
    });

    it('should return false for usernames with spaces', () => {
      expect(Validator.isSafe('user name')).toBe(false);
    });
  });

  describe('normalize()', () => {
    it('should trim whitespace', () => {
      expect(Validator.normalize('  username  ')).toBe('username');
      expect(Validator.normalize('\tusername\n')).toBe('username');
    });

    it('should preserve case by default', () => {
      expect(Validator.normalize('UserName')).toBe('UserName');
    });

    it('should lowercase when requested', () => {
      expect(Validator.normalize('UserName', true)).toBe('username');
    });
  });

  describe('sanitize()', () => {
    it('should remove unsafe characters', () => {
      expect(Validator.sanitize('user<name>')).toBe('username');
      expect(Validator.sanitize("user'name")).toBe('username');
    });

    it('should remove spaces', () => {
      expect(Validator.sanitize('user name')).toBe('username');
    });

    it('should trim whitespace', () => {
      expect(Validator.sanitize('  username  ')).toBe('username');
    });

    it('should truncate to 100 characters', () => {
      const result = Validator.sanitize('a'.repeat(150));
      expect(result.length).toBe(100);
    });
  });

  describe('matchesPattern()', () => {
    it('should validate against regex pattern', () => {
      const githubPattern = '^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$';
      expect(Validator.matchesPattern('validuser', githubPattern)).toBe(true);
      expect(Validator.matchesPattern('user-name', githubPattern)).toBe(true);
      expect(Validator.matchesPattern('-invalid', githubPattern)).toBe(false);
    });

    it('should return true for invalid regex patterns', () => {
      expect(Validator.matchesPattern('test', '[invalid regex')).toBe(true);
    });

    it('should validate Twitter pattern', () => {
      const twitterPattern = '^[a-zA-Z0-9_]{1,15}$';
      expect(Validator.matchesPattern('elonmusk', twitterPattern)).toBe(true);
      expect(Validator.matchesPattern('a'.repeat(16), twitterPattern)).toBe(false);
    });
  });
});
