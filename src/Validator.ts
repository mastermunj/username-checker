/**
 * Validator class - Static methods for username validation
 */

import type { ValidationResult } from './types.js';

/**
 * Characters that would break URL interpolation or output file handling
 */
const DISALLOWED_CHARACTER_PATTERN = String.raw`[<>:'";/\\|?*#%&=\u0000-\u001F\u007F]`;
const DISALLOWED_CHARACTERS = new RegExp(DISALLOWED_CHARACTER_PATTERN, 'u');

/**
 * Common username patterns - most sites allow these
 */
const COMMON_USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Reserved usernames that might cause issues
 */
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'null',
  'undefined',
  'api',
  'www',
  'mail',
  'ftp',
  'localhost',
  'support',
  'help',
  'contact',
  'about',
  'terms',
  'privacy',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'account',
  'settings',
  'profile',
  'user',
  'users',
  'home',
  'index',
  'search',
  'new',
  'edit',
  'delete',
  'create',
  'update',
  'remove',
]);

/**
 * Static class for username validation operations
 */
export class Validator {
  /**
   * Validate a username and return detailed validation result
   */
  static validate(username: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty username
    if (!username || username.trim().length === 0) {
      errors.push('Username cannot be empty');
      return { valid: false, errors, warnings, normalizedUsername: '' };
    }

    const trimmed = username.trim();

    // Check maximum length
    if (trimmed.length > 100) {
      errors.push('Username must be at most 100 characters long');
    }

    // Keep global validation focused on characters that would break requests or file output.
    if (DISALLOWED_CHARACTERS.test(trimmed)) {
      errors.push('Username contains characters that would break URL or file output');
    }

    // Check if it's a reserved username
    if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) {
      warnings.push('Username may be reserved on some platforms');
    }

    // Very short usernames are valid globally, but many sites will reject them.
    if (trimmed.length < 2) {
      warnings.push('Very short usernames may not be allowed on some sites');
    }

    // Check for common pattern compliance
    if (!COMMON_USERNAME_PATTERN.test(trimmed)) {
      if (/^[^a-zA-Z0-9]/.test(trimmed)) {
        warnings.push('Username starts with a special character, which may not be allowed on some sites');
      }
      if (/[^a-zA-Z0-9]$/.test(trimmed)) {
        warnings.push('Username ends with a special character, which may not be allowed on some sites');
      }
      if (/[^a-zA-Z0-9]{2,}/.test(trimmed)) {
        warnings.push('Username contains consecutive special characters, which may not be allowed on some sites');
      }
    }

    // Check for spaces
    if (/\s/.test(trimmed)) {
      errors.push('Username cannot contain spaces');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedUsername: trimmed,
    };
  }

  /**
   * Check if a username is safe (quick check, no detailed feedback)
   */
  static isSafe(username: string): boolean {
    if (!username || username.trim().length === 0) {
      return false;
    }
    const trimmed = username.trim();
    if (trimmed.length > 100) {
      return false;
    }
    if (DISALLOWED_CHARACTERS.test(trimmed)) {
      return false;
    }
    if (/\s/.test(trimmed)) {
      return false;
    }
    return true;
  }

  /**
   * Normalize a username by trimming and optionally lowercasing
   */
  static normalize(username: string, lowercase = false): string {
    const normalized = username.trim();
    return lowercase ? normalized.toLowerCase() : normalized;
  }

  /**
   * Sanitize a username by removing unsafe characters
   */
  static sanitize(username: string): string {
    const disallowedGlobal = new RegExp(DISALLOWED_CHARACTER_PATTERN, 'gu');
    return username.trim().replace(disallowedGlobal, '').replace(/\s+/g, '').slice(0, 100);
  }

  /**
   * Validate username against a specific regex pattern (from site config)
   */
  static matchesPattern(username: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(username);
    } catch {
      // Invalid regex pattern, assume it matches
      return true;
    }
  }
}
