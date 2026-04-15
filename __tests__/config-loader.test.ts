/**
 * Tests for ConfigLoader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigLoader } from '../src/ConfigLoader.js';

describe('ConfigLoader', () => {
  const originalCwd = process.cwd();
  const originalHome = process.env.HOME;
  const originalXdg = process.env.XDG_CONFIG_HOME;

  beforeEach(() => {
    // Save original env vars
    vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '');
    vi.stubEnv('USERNAME_CHECKER_CONCURRENCY', '');
    vi.stubEnv('USERNAME_CHECKER_MAX_CONCURRENCY', '');
    vi.stubEnv('USERNAME_CHECKER_RETRIES', '');
    vi.stubEnv('USERNAME_CHECKER_NSFW', '');
    vi.stubEnv('USERNAME_CHECKER_EXCLUDED', '');
    vi.stubEnv('USERNAME_CHECKER_TOR', '');
    vi.stubEnv('USERNAME_CHECKER_PROXY', '');
    vi.stubEnv('USERNAME_CHECKER_FORMAT', '');
    vi.stubEnv('USERNAME_CHECKER_CACHE_TYPE', '');
    vi.stubEnv('USERNAME_CHECKER_CACHE_TTL', '');
    vi.stubEnv('USERNAME_CHECKER_DEFAULT_SITES', '');
    vi.stubEnv('USERNAME_CHECKER_CONFIG', '');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    if (originalXdg !== undefined) {
      process.env.XDG_CONFIG_HOME = originalXdg;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }

    vi.unstubAllEnvs();
  });

  describe('loadConfig', () => {
    it('should return empty config when no env vars or file', () => {
      const config = ConfigLoader.loadConfig();
      expect(config).toEqual({});
    });
  });

  describe('environment variables', () => {
    it('should parse USERNAME_CHECKER_TIMEOUT', () => {
      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '5000');
      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBe(5000);
    });

    it('should parse USERNAME_CHECKER_CONCURRENCY', () => {
      vi.stubEnv('USERNAME_CHECKER_CONCURRENCY', '100');
      const config = ConfigLoader.loadConfig();
      expect(config.maxConcurrency).toBe(100);
    });

    it('should parse USERNAME_CHECKER_MAX_CONCURRENCY', () => {
      vi.stubEnv('USERNAME_CHECKER_MAX_CONCURRENCY', '50');
      const config = ConfigLoader.loadConfig();
      expect(config.maxConcurrency).toBe(50);
    });

    it('should parse USERNAME_CHECKER_RETRIES', () => {
      vi.stubEnv('USERNAME_CHECKER_RETRIES', '3');
      const config = ConfigLoader.loadConfig();
      expect(config.retries).toBe(3);
    });

    it('should parse USERNAME_CHECKER_NSFW boolean', () => {
      vi.stubEnv('USERNAME_CHECKER_NSFW', 'true');
      let config = ConfigLoader.loadConfig();
      expect(config.includeNSFW).toBe(true);

      vi.stubEnv('USERNAME_CHECKER_NSFW', 'false');
      config = ConfigLoader.loadConfig();
      expect(config.includeNSFW).toBe(false);

      vi.stubEnv('USERNAME_CHECKER_NSFW', '1');
      config = ConfigLoader.loadConfig();
      expect(config.includeNSFW).toBe(true);

      vi.stubEnv('USERNAME_CHECKER_NSFW', 'yes');
      config = ConfigLoader.loadConfig();
      expect(config.includeNSFW).toBe(true);
    });

    it('should parse USERNAME_CHECKER_EXCLUDED boolean', () => {
      vi.stubEnv('USERNAME_CHECKER_EXCLUDED', 'true');
      const config = ConfigLoader.loadConfig();
      expect(config.includeExcluded).toBe(true);
    });

    it('should parse USERNAME_CHECKER_TOR boolean', () => {
      vi.stubEnv('USERNAME_CHECKER_TOR', 'true');
      const config = ConfigLoader.loadConfig();
      expect(config.useTor).toBe(true);
    });

    it('should parse USERNAME_CHECKER_PROXY', () => {
      vi.stubEnv('USERNAME_CHECKER_PROXY', 'http://localhost:8080');
      const config = ConfigLoader.loadConfig();
      expect(config.proxy).toBe('http://localhost:8080');
    });

    it('should parse USERNAME_CHECKER_FORMAT', () => {
      vi.stubEnv('USERNAME_CHECKER_FORMAT', 'json');
      const config = ConfigLoader.loadConfig();
      expect(config.format).toBe('json');
    });

    it('should parse USERNAME_CHECKER_CACHE_TYPE and TTL', () => {
      vi.stubEnv('USERNAME_CHECKER_CACHE_TYPE', 'file');
      vi.stubEnv('USERNAME_CHECKER_CACHE_TTL', '7200000');
      const config = ConfigLoader.loadConfig();
      expect(config.cache).toEqual({
        type: 'file',
        ttl: 7200000,
      });
    });

    it('should parse USERNAME_CHECKER_DEFAULT_SITES', () => {
      vi.stubEnv('USERNAME_CHECKER_DEFAULT_SITES', 'GitHub,Twitter,Reddit');
      const config = ConfigLoader.loadConfig();
      expect(config.defaultSites).toEqual(['GitHub', 'Twitter', 'Reddit']);
    });

    it('should handle comma-separated sites with spaces', () => {
      vi.stubEnv('USERNAME_CHECKER_DEFAULT_SITES', 'GitHub, Twitter , Reddit');
      const config = ConfigLoader.loadConfig();
      expect(config.defaultSites).toEqual(['GitHub', 'Twitter', 'Reddit']);
    });

    it('should ignore invalid number values', () => {
      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', 'invalid');
      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBeUndefined();
    });

    it('should ignore invalid boolean values', () => {
      vi.stubEnv('USERNAME_CHECKER_NSFW', 'maybe');
      const config = ConfigLoader.loadConfig();
      expect(config.includeNSFW).toBeUndefined();
    });
  });

  describe('configuration precedence', () => {
    it('should combine multiple env vars', () => {
      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '5000');
      vi.stubEnv('USERNAME_CHECKER_CONCURRENCY', '100');
      vi.stubEnv('USERNAME_CHECKER_NSFW', 'true');

      const config = ConfigLoader.loadConfig();

      expect(config.timeout).toBe(5000);
      expect(config.maxConcurrency).toBe(100);
      expect(config.includeNSFW).toBe(true);
    });

    it('should prioritize CONCURRENCY over MAX_CONCURRENCY', () => {
      vi.stubEnv('USERNAME_CHECKER_CONCURRENCY', '50');
      vi.stubEnv('USERNAME_CHECKER_MAX_CONCURRENCY', '100');

      const config = ConfigLoader.loadConfig();
      expect(config.maxConcurrency).toBe(50);
    });

    it('should let environment override file config', () => {
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-config-'));
      process.chdir(dir);

      writeFileSync(
        join(dir, '.usernamerc'),
        JSON.stringify({ timeout: 15000, maxConcurrency: 10, includeNSFW: false }),
      );

      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '5000');
      vi.stubEnv('USERNAME_CHECKER_NSFW', 'true');

      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBe(5000);
      expect(config.maxConcurrency).toBe(10);
      expect(config.includeNSFW).toBe(true);

      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('config file loading', () => {
    it('should load config from cwd .usernamerc', () => {
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-cwd-'));
      process.chdir(dir);
      writeFileSync(
        join(dir, '.usernamerc'),
        JSON.stringify({
          timeout: 12000,
          maxConcurrency: 80,
          retries: 3,
          includeNSFW: true,
          includeExcluded: true,
          useTor: true,
          proxy: 'http://proxy.local',
          format: 'json',
          cache: { type: 'hybrid', ttl: 1200, dir: './cache' },
          defaultSites: ['GitHub', 'Reddit'],
        }),
      );

      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBe(12000);
      expect(config.maxConcurrency).toBe(80);
      expect(config.retries).toBe(3);
      expect(config.includeNSFW).toBe(true);
      expect(config.includeExcluded).toBe(true);
      expect(config.useTor).toBe(true);
      expect(config.proxy).toBe('http://proxy.local');
      expect(config.format).toBe('json');
      expect(config.cache).toEqual({ type: 'hybrid', ttl: 1200, dir: './cache' });
      expect(config.defaultSites).toEqual(['GitHub', 'Reddit']);

      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });

    it('should load config from explicit USERNAME_CHECKER_CONFIG path', () => {
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-explicit-'));
      const configPath = join(dir, 'my-config.json');
      writeFileSync(configPath, JSON.stringify({ timeout: 9876 }));
      vi.stubEnv('USERNAME_CHECKER_CONFIG', configPath);

      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBe(9876);

      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });

    it('should ignore missing explicit config path and continue normally', () => {
      vi.stubEnv('USERNAME_CHECKER_CONFIG', join(tmpdir(), 'does-not-exist-usernamerc.json'));
      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '4321');

      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBe(4321);
    });

    it('should load config from XDG_CONFIG_HOME fallback', () => {
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-xdg-'));
      const xdg = join(dir, 'xdg');
      const file = join(xdg, 'usernamerc.json');
      mkdirSync(xdg, { recursive: true });
      writeFileSync(file, JSON.stringify({ retries: 4 }), { flag: 'w' });
      vi.stubEnv('XDG_CONFIG_HOME', xdg);

      const config = ConfigLoader.loadConfig();
      expect(config.retries).toBe(4);

      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });

    it('should still load cwd config when HOME is unset', () => {
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-no-home-'));
      process.chdir(dir);
      vi.stubEnv('HOME', '');
      writeFileSync(join(dir, '.usernamerc'), JSON.stringify({ timeout: 4321 }));

      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBe(4321);

      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });

    it('should warn for invalid JSON config file', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-invalid-'));
      process.chdir(dir);
      writeFileSync(join(dir, '.usernamerc'), '{ not-json');

      const config = ConfigLoader.loadConfig();
      expect(config).toEqual({});
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });

    it('should warn when config path cannot be read as a file', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-unreadable-'));
      vi.stubEnv('USERNAME_CHECKER_CONFIG', dir);

      const config = ConfigLoader.loadConfig();
      expect(config).toEqual({});
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    });

    it('should safely ignore non-record config file values', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-array-'));
      process.chdir(dir);
      writeFileSync(join(dir, '.usernamerc'), JSON.stringify(['not', 'an', 'object']));

      const config = ConfigLoader.loadConfig();
      expect(config).toEqual({});
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });

    it('should return empty config for null file content', () => {
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-null-'));
      process.chdir(dir);
      writeFileSync(join(dir, '.usernamerc'), 'null');

      const config = ConfigLoader.loadConfig();
      expect(config).toEqual({});

      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });

    it('should drop invalid values from config file', () => {
      const dir = mkdtempSync(join(tmpdir(), 'username-checker-invalid-values-'));
      process.chdir(dir);
      writeFileSync(
        join(dir, '.usernamerc'),
        JSON.stringify({
          timeout: -1,
          maxConcurrency: 0,
          retries: -2,
          cache: { type: 'invalid', ttl: -1, dir: 123 },
          defaultSites: ['GitHub', 42],
        }),
      );

      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBeUndefined();
      expect(config.maxConcurrency).toBeUndefined();
      expect(config.retries).toBeUndefined();
      expect(config.cache).toEqual({});
      expect(config.defaultSites).toBeUndefined();

      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('sample config generation', () => {
    it('should generate valid sample config', () => {
      const sample = ConfigLoader.getSampleConfigContent();
      expect(sample).toContain('timeout');
      expect(sample).toContain('maxConcurrency');
      expect(sample).toContain('retries');
      expect(sample).toContain('includeNSFW');

      // Should be valid JSON
      const config = JSON.parse(sample);
      expect(config.timeout).toBe(15000);
      expect(config.maxConcurrency).toBe(50);
      expect(config.retries).toBe(2);
    });

    it('sample config should contain cache configuration', () => {
      const sample = ConfigLoader.getSampleConfigContent();
      const config = JSON.parse(sample);

      expect(config.cache).toBeDefined();
      expect(config.cache.type).toBe('memory');
      expect(config.cache.ttl).toBe(3600000);
    });

    it('sample config should contain default sites', () => {
      const sample = ConfigLoader.getSampleConfigContent();
      const config = JSON.parse(sample);

      expect(config.defaultSites).toBeDefined();
      expect(Array.isArray(config.defaultSites)).toBe(true);
      expect(config.defaultSites.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero timeout', () => {
      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '0');
      const config = ConfigLoader.loadConfig();
      // 0 is not > 0, so should be ignored
      expect(config.timeout).toBeUndefined();
    });

    it('should handle negative values', () => {
      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '-1000');
      vi.stubEnv('USERNAME_CHECKER_RETRIES', '-1');
      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBeUndefined();
      expect(config.retries).toBeUndefined();
    });

    it('should handle empty string env vars', () => {
      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '');
      vi.stubEnv('USERNAME_CHECKER_PROXY', '');
      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBeUndefined();
      expect(config.proxy).toBeUndefined();
    });

    it('should handle large numbers', () => {
      vi.stubEnv('USERNAME_CHECKER_TIMEOUT', '999999999');
      const config = ConfigLoader.loadConfig();
      expect(config.timeout).toBe(999999999);
    });
  });
});
