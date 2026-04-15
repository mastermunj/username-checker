/**
 * Configuration loader supporting config files (.usernamerc) and environment variables
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigOptions } from './types.js';

/**
 * Loads configuration from multiple sources following precedence:
 * 1. CLI flags (passed directly, not handled here)
 * 2. Environment variables (USERNAME_CHECKER_*)
 * 3. Config file (.usernamerc)
 * 4. Defaults
 */
export class ConfigLoader {
  private static readonly ENV_PREFIX = 'USERNAME_CHECKER_';

  /**
   * Load configuration from all available sources
   */
  static loadConfig(): ConfigOptions {
    const configFile = this.findConfigFile();
    const fileConfig = configFile ? this.parseConfigFile(configFile) : {};
    const envConfig = this.loadEnvironmentVariables();

    // Environment variables override file config
    // Only merge if env config has actual values
    const merged = { ...fileConfig };
    Object.entries(envConfig).forEach(([key, value]) => {
      merged[key as keyof ConfigOptions] = value;
    });

    return merged;
  }

  /**
   * Find config file in priority order:
   * 1. Current working directory
   * 2. Home directory
   * 3. XDG_CONFIG_HOME (Linux/macOS standard)
   */
  private static findConfigFile(): string | null {
    const explicitPath = process.env[`${this.ENV_PREFIX}CONFIG`];
    if (explicitPath && existsSync(explicitPath)) {
      return explicitPath;
    }

    const searchPaths = ['.usernamerc', '.usernamerc.json'];
    const homeDir = process.env.HOME;

    if (homeDir) {
      searchPaths.push(join(homeDir, '.usernamerc'));
      searchPaths.push(join(homeDir, '.usernamerc.json'));
    }

    if (process.env.XDG_CONFIG_HOME) {
      searchPaths.push(join(process.env.XDG_CONFIG_HOME, 'usernamerc.json'));
      searchPaths.push(join(process.env.XDG_CONFIG_HOME, 'username-checker', 'usernamerc.json'));
    }

    for (const path of searchPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  }

  /**
   * Parse config file (JSON format)
   */
  private static parseConfigFile(filepath: string): ConfigOptions {
    try {
      const content = readFileSync(filepath, 'utf-8');
      const config = JSON.parse(content);
      return this.validateConfig(config);
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn(`Warning: Config file ${filepath} contains invalid JSON: ${error.message}`);
      } else {
        console.warn(`Warning: Could not read config file ${filepath}: ${String(error)}`);
      }
      return {};
    }
  }

  /**
   * Load configuration from environment variables
   * Supported variables:
   * - USERNAME_CHECKER_TIMEOUT
   * - USERNAME_CHECKER_CONCURRENCY (maxConcurrency)
   * - USERNAME_CHECKER_MAX_CONCURRENCY
   * - USERNAME_CHECKER_RETRIES
   * - USERNAME_CHECKER_NSFW (true/false)
   * - USERNAME_CHECKER_EXCLUDED (includeExcluded, true/false)
   * - USERNAME_CHECKER_TOR (true/false)
   * - USERNAME_CHECKER_PROXY
   * - USERNAME_CHECKER_FORMAT
   * - USERNAME_CHECKER_CACHE_TYPE
   * - USERNAME_CHECKER_CACHE_TTL
   * - USERNAME_CHECKER_DEFAULT_SITES (comma-separated)
   */
  private static loadEnvironmentVariables(): ConfigOptions {
    const config: ConfigOptions = {};

    const parseEnvNumber = (key: string): number | undefined => {
      const value = process.env[key];
      if (!value) {
        return undefined;
      } // Return undefined for empty/missing
      const num = Number.parseInt(value, 10);
      return Number.isNaN(num) || num <= 0 ? undefined : num; // Return undefined for invalid or non-positive
    };

    const parseEnvBoolean = (key: string): boolean | undefined => {
      const value = process.env[key];
      if (!value) {
        return undefined;
      } // Return undefined for empty/missing
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
        return true;
      } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
        return false;
      }
      return undefined; // Return undefined for invalid values
    };

    const parseEnvString = (key: string): string | undefined => {
      const value = process.env[key];
      return value && value.trim() ? value : undefined; // Return undefined for empty/missing
    };

    // Parse individual environment variables
    const timeout = parseEnvNumber(`${this.ENV_PREFIX}TIMEOUT`);
    if (timeout !== undefined) {
      config.timeout = timeout;
    }

    const maxConcurrency =
      parseEnvNumber(`${this.ENV_PREFIX}CONCURRENCY`) ?? parseEnvNumber(`${this.ENV_PREFIX}MAX_CONCURRENCY`);
    if (maxConcurrency !== undefined) {
      config.maxConcurrency = maxConcurrency;
    }

    const retries = parseEnvNumber(`${this.ENV_PREFIX}RETRIES`);
    if (retries !== undefined) {
      config.retries = retries;
    }

    const nsfw = parseEnvBoolean(`${this.ENV_PREFIX}NSFW`);
    if (nsfw !== undefined) {
      config.includeNSFW = nsfw;
    }

    const excluded = parseEnvBoolean(`${this.ENV_PREFIX}EXCLUDED`);
    if (excluded !== undefined) {
      config.includeExcluded = excluded;
    }

    const tor = parseEnvBoolean(`${this.ENV_PREFIX}TOR`);
    if (tor !== undefined) {
      config.useTor = tor;
    }

    const proxy = parseEnvString(`${this.ENV_PREFIX}PROXY`);
    if (proxy !== undefined) {
      config.proxy = proxy;
    }

    const format = parseEnvString(`${this.ENV_PREFIX}FORMAT`);
    if (format !== undefined) {
      config.format = format;
    }

    const cacheType = parseEnvString(`${this.ENV_PREFIX}CACHE_TYPE`);
    const cacheTtl = parseEnvNumber(`${this.ENV_PREFIX}CACHE_TTL`);
    if (cacheType !== undefined || cacheTtl !== undefined) {
      config.cache = {
        type: cacheType as 'memory' | 'file' | 'hybrid' | undefined,
        ttl: cacheTtl,
      };
    }

    const defaultSites = parseEnvString(`${this.ENV_PREFIX}DEFAULT_SITES`);
    if (defaultSites !== undefined) {
      config.defaultSites = defaultSites.split(',').map((s) => s.trim());
    }

    return config;
  }

  /**
   * Validate and normalize config object
   */
  private static validateConfig(config: unknown): ConfigOptions {
    if (typeof config !== 'object' || config === null) {
      return {};
    }

    const validated: ConfigOptions = {};
    const cfg = config as Record<string, unknown>;

    // Validate timeout
    if (typeof cfg.timeout === 'number' && cfg.timeout > 0) {
      validated.timeout = cfg.timeout;
    }

    // Validate concurrency
    if (typeof cfg.maxConcurrency === 'number' && cfg.maxConcurrency > 0) {
      validated.maxConcurrency = cfg.maxConcurrency;
    }

    // Validate retries
    if (typeof cfg.retries === 'number' && cfg.retries >= 0) {
      validated.retries = cfg.retries;
    }

    // Validate boolean flags
    if (typeof cfg.includeNSFW === 'boolean') {
      validated.includeNSFW = cfg.includeNSFW;
    }

    if (typeof cfg.includeExcluded === 'boolean') {
      validated.includeExcluded = cfg.includeExcluded;
    }

    if (typeof cfg.useTor === 'boolean') {
      validated.useTor = cfg.useTor;
    }

    // Validate proxy
    if (typeof cfg.proxy === 'string') {
      validated.proxy = cfg.proxy;
    }

    // Validate format
    if (typeof cfg.format === 'string') {
      validated.format = cfg.format;
    }

    // Validate cache options
    if (typeof cfg.cache === 'object' && cfg.cache !== null) {
      const cacheConfig = cfg.cache as Record<string, unknown>;
      validated.cache = {};

      if (typeof cacheConfig.type === 'string' && ['memory', 'file', 'hybrid'].includes(cacheConfig.type)) {
        validated.cache.type = cacheConfig.type as 'memory' | 'file' | 'hybrid';
      }

      if (typeof cacheConfig.ttl === 'number' && cacheConfig.ttl > 0) {
        validated.cache.ttl = cacheConfig.ttl;
      }

      if (typeof cacheConfig.dir === 'string') {
        validated.cache.dir = cacheConfig.dir;
      }
    }

    // Validate default sites
    if (Array.isArray(cfg.defaultSites) && cfg.defaultSites.every((s) => typeof s === 'string')) {
      validated.defaultSites = cfg.defaultSites;
    }

    return validated;
  }

  /**
   * Create sample config file content
   */
  static getSampleConfigContent(): string {
    return JSON.stringify(
      {
        timeout: 15000,
        maxConcurrency: 50,
        retries: 2,
        includeNSFW: false,
        includeExcluded: false,
        format: 'text',
        cache: {
          type: 'memory',
          ttl: 3600000,
        },
        defaultSites: ['GitHub', 'Twitter', 'Reddit', 'StackOverflow'],
      },
      null,
      2,
    );
  }
}
