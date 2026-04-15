/**
 * Sites compatibility facade over the default manifest repository.
 */

import type { SiteConfig, SiteEntry, SiteFilterOptions, SiteResolutionResult } from './types.js';
import {
  ManifestRepository,
  canonicalizeSiteKey,
  defaultManifestRepository,
  levenshteinDistance,
  mapDetectionMethod,
  mapSingleDetectionMethod,
  normalizeSiteKey,
  parseSites,
} from './ManifestRepository.js';

export {
  ManifestRepository,
  canonicalizeSiteKey,
  defaultManifestRepository,
  levenshteinDistance,
  mapDetectionMethod,
  mapSingleDetectionMethod,
  normalizeSiteKey,
  parseSites,
};

/**
 * Sites class - static compatibility helpers backed by the default repository.
 */
export class Sites {
  private static repository = defaultManifestRepository;

  static get sites(): Map<string, SiteConfig> {
    return Sites.repository.sites;
  }

  static get normalizedKeys(): Map<string, string> {
    return Sites.repository.normalizedKeys;
  }

  static getRepository(): ManifestRepository {
    return Sites.repository;
  }

  static setRepository(repository: ManifestRepository): void {
    Sites.repository = repository;
  }

  static resetRepository(): void {
    Sites.repository = defaultManifestRepository;
  }

  static resolveKey(key: string): string | undefined {
    return Sites.repository.resolveKey(key);
  }

  static suggestKeys(key: string, limit = 3): string[] {
    return Sites.repository.suggestKeys(key, limit);
  }

  static resolveKeys(keys: string[]): SiteResolutionResult {
    return Sites.repository.resolveKeys(keys);
  }

  static get(key: string): SiteConfig | undefined {
    return Sites.repository.get(key);
  }

  static filter(options: SiteFilterOptions = {}): SiteEntry[] {
    return Sites.repository.filter(options);
  }

  static count(options: Pick<SiteFilterOptions, 'includeExcluded'> = {}): number {
    return Sites.repository.count(options);
  }

  static has(key: string): boolean {
    return Sites.repository.has(key);
  }
}
