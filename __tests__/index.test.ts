/**
 * Tests for main index exports
 */

import { describe, it, expect } from 'vitest';
import { ManifestRepository, UsernameChecker } from '../src/index.js';

describe('index exports', () => {
  it('should export UsernameChecker', () => {
    expect(UsernameChecker).toBeDefined();
    expect(typeof UsernameChecker).toBe('function');
  });

  it('should create UsernameChecker instance', () => {
    const checker = new UsernameChecker();
    expect(checker).toBeInstanceOf(UsernameChecker);
  });

  it('should export ManifestRepository', () => {
    expect(ManifestRepository).toBeDefined();
    expect(typeof ManifestRepository).toBe('function');
  });
});
