/**
 * Validator class - Static methods for username validation
 */

import type { ValidationResult } from './types.js';

/**
 * Characters that are potentially dangerous or could cause issues
 */
const UNSAFE_CHARACTERS = /[<>'";&%$#@!`(){}[\]\\|^~]/;

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

    // Check minimum length
    if (trimmed.length < 2) {
      errors.push('Username must be at least 2 characters long');
    }

    // Check maximum length
    if (trimmed.length > 100) {
      errors.push('Username must be at most 100 characters long');
    }

    // Check for unsafe characters
    if (UNSAFE_CHARACTERS.test(trimmed)) {
      errors.push('Username contains potentially unsafe characters');
    }

    // Check if it's a reserved username
    if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) {
      warnings.push('Username may be reserved on some platforms');
    }

    // Check for common pattern compliance
    if (!COMMON_USERNAME_PATTERN.test(trimmed)) {
      if (/^[._-]/.test(trimmed)) {
        warnings.push('Username starts with a special character, which may not be allowed on some sites');
      }
      if (/[._-]$/.test(trimmed)) {
        warnings.push('Username ends with a special character, which may not be allowed on some sites');
      }
      if (/[._-]{2,}/.test(trimmed)) {
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
    if (username.length < 2 || username.length > 100) {
      return false;
    }
    if (UNSAFE_CHARACTERS.test(username)) {
      return false;
    }
    if (/\s/.test(username)) {
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
    // Use a new regex with global flag for replacement
    const unsafeGlobal = /[<>'";&%$#@!`(){}[\]\\|^~]/g;
    return username.trim().replace(unsafeGlobal, '').replace(/\s+/g, '').slice(0, 100);
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
