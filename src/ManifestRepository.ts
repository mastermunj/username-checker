/**
 * ManifestRepository - Load, normalize, and query site manifests.
 */

import type {
  DetectionStrategy,
  SiteConfig,
  SiteEntry,
  SiteFilterOptions,
  SiteRepository,
  SiteResolutionResult,
} from './types.js';
import { DetectionMethod } from './types.js';
import sitesData from './sites.json' with { type: 'json' };

export type RawManifestEntry = Record<string, unknown>;
export type RawManifest = Record<string, RawManifestEntry>;

export function normalizeSiteKey(key: string): string {
  return key.trim().toLowerCase();
}

export function canonicalizeSiteKey(key: string): string {
  return normalizeSiteKey(key).replace(/[^a-z0-9]+/g, '');
}

export function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from<number>({ length: right.length + 1 }).fill(0);

  for (let row = 1; row <= left.length; row++) {
    current[0] = row;

    for (let column = 1; column <= right.length; column++) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      );
    }

    for (let index = 0; index < current.length; index++) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

export function mapSingleDetectionMethod(errorType: string): DetectionMethod {
  switch (errorType) {
    case 'message':
      return DetectionMethod.MESSAGE;
    case 'response_url':
      return DetectionMethod.RESPONSE_URL;
    default:
      return DetectionMethod.STATUS_CODE;
  }
}

export function mapDetectionMethod(errorType: string | string[]): DetectionStrategy {
  if (Array.isArray(errorType)) {
    return errorType.map((value) => mapSingleDetectionMethod(value));
  }

  return mapSingleDetectionMethod(errorType);
}

export function parseSites(data: RawManifest): Map<string, SiteConfig> {
  const map = new Map<string, SiteConfig>();

  for (const [key, raw] of Object.entries(data)) {
    const config: SiteConfig = {
      name: raw.name as string,
      url: raw.url as string,
      urlMain: raw.urlMain as string,
      errorType: mapDetectionMethod(raw.errorType as string | string[]),
    };

    if (raw.urlProbe) {
      config.urlProbe = raw.urlProbe as string;
    }
    if (raw.errorMsg) {
      config.errorMsg = raw.errorMsg as string | string[];
    }
    if (raw.errorCode) {
      config.errorCode = raw.errorCode as number | number[];
    }
    if (raw.errorUrl) {
      config.errorUrl = raw.errorUrl as string;
    }
    if (raw.responseUrl) {
      config.responseUrl = raw.responseUrl as string;
    }
    if (raw.regexCheck) {
      config.regexCheck = raw.regexCheck as string;
    }
    if (raw.requestMethod) {
      config.requestMethod = raw.requestMethod as SiteConfig['requestMethod'];
    }
    if (raw.requestPayload) {
      config.requestPayload = raw.requestPayload as Record<string, unknown>;
    }
    if (raw.headers) {
      config.headers = raw.headers as Record<string, string>;
    }
    if (raw.isNSFW) {
      config.isNSFW = true;
    }
    if (raw.isExcluded) {
      config.isExcluded = true;
    }
    if (raw.usernameClaimed) {
      config.usernameClaimed = raw.usernameClaimed as string;
    }

    map.set(key, config);
  }

  return map;
}

function cloneSiteConfig(config: SiteConfig): SiteConfig {
  return structuredClone(config);
}

export class ManifestRepository implements SiteRepository {
  public readonly sites: Map<string, SiteConfig>;
  public readonly normalizedKeys: Map<string, string>;

  constructor(sites: Map<string, SiteConfig>) {
    this.sites = sites;
    this.normalizedKeys = new Map(Array.from(this.sites.keys(), (key) => [normalizeSiteKey(key), key]));
  }

  static fromRawData(data: RawManifest): ManifestRepository {
    return new ManifestRepository(parseSites(data));
  }

  static fromSiteConfigs(configs: Record<string, SiteConfig> | Map<string, SiteConfig>): ManifestRepository {
    const entries = configs instanceof Map ? Array.from(configs.entries()) : Object.entries(configs);
    return new ManifestRepository(new Map(entries.map(([key, config]) => [key, cloneSiteConfig(config)])));
  }

  resolveKey(key: string): string | undefined {
    if (this.sites.has(key)) {
      return key;
    }

    return this.normalizedKeys.get(normalizeSiteKey(key));
  }

  suggestKeys(key: string, limit = 3): string[] {
    const normalizedInput = normalizeSiteKey(key);
    const canonicalInput = canonicalizeSiteKey(key);

    if (!canonicalInput) {
      return [];
    }

    return Array.from(this.sites.keys())
      .map((candidate) => {
        const normalizedCandidate = normalizeSiteKey(candidate);
        const canonicalCandidate = canonicalizeSiteKey(candidate);
        const distance = levenshteinDistance(canonicalInput, canonicalCandidate);
        const startsWithBonus =
          normalizedCandidate.startsWith(normalizedInput) || canonicalCandidate.startsWith(canonicalInput) ? -2 : 0;
        const includesBonus =
          normalizedCandidate.includes(normalizedInput) || canonicalCandidate.includes(canonicalInput) ? -1 : 0;

        return {
          candidate,
          score: distance + startsWithBonus + includesBonus,
        };
      })
      .filter(({ candidate, score }) => {
        const normalizedCandidate = normalizeSiteKey(candidate);
        return score <= 3 || normalizedCandidate.includes(normalizedInput);
      })
      .sort((left, right) => left.score - right.score || left.candidate.localeCompare(right.candidate))
      .slice(0, limit)
      .map(({ candidate }) => candidate);
  }

  resolveKeys(keys: string[]): SiteResolutionResult {
    const resolvedKeys: string[] = [];
    const missing: Array<{ input: string; suggestions: string[] }> = [];
    const seen = new Set<string>();

    for (const key of keys) {
      const resolvedKey = this.resolveKey(key);
      if (!resolvedKey) {
        missing.push({ input: key, suggestions: this.suggestKeys(key) });
        continue;
      }

      if (seen.has(resolvedKey)) {
        continue;
      }

      seen.add(resolvedKey);
      resolvedKeys.push(resolvedKey);
    }

    return { resolvedKeys, missing };
  }

  get(key: string): SiteConfig | undefined {
    const resolvedKey = this.resolveKey(key);
    return resolvedKey ? this.sites.get(resolvedKey) : undefined;
  }

  filter(options: SiteFilterOptions = {}): SiteEntry[] {
    const { includeNSFW = false, includeExcluded = false, includeKeys } = options;

    if (includeKeys !== undefined) {
      if (includeKeys.length === 0) {
        return [];
      }

      const result: SiteEntry[] = [];
      const seen = new Set<string>();

      for (const key of includeKeys) {
        const resolvedKey = this.resolveKey(key);
        if (!resolvedKey || seen.has(resolvedKey)) {
          continue;
        }

        const config = this.sites.get(resolvedKey);
        if (!config) {
          continue;
        }
        if (!includeNSFW && config.isNSFW) {
          continue;
        }

        seen.add(resolvedKey);
        result.push({ key: resolvedKey, config });
      }

      return result;
    }

    const result: SiteEntry[] = [];
    for (const [key, config] of this.sites.entries()) {
      if (!includeNSFW && config.isNSFW) {
        continue;
      }
      if (!includeExcluded && config.isExcluded) {
        continue;
      }
      result.push({ key, config });
    }

    return result;
  }

  count(options: Pick<SiteFilterOptions, 'includeExcluded'> = {}): number {
    return this.filter({ includeNSFW: true, includeExcluded: options.includeExcluded }).length;
  }

  has(key: string): boolean {
    return this.resolveKey(key) !== undefined;
  }
}

export const defaultManifestRepository = ManifestRepository.fromRawData(sitesData as RawManifest);
