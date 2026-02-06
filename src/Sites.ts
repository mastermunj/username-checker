/**
 * Sites class - Static class for managing site configurations
 * Data synced from Sherlock Project (https://github.com/sherlock-project/sherlock)
 * Run `npm run sync-sites` to update the data from Sherlock's latest release.
 */

import type { SiteConfig, SiteFilterOptions } from './types.js';
import { DetectionMethod } from './types.js';
import sitesData from './sites.json' with { type: 'json' };

/**
 * Map raw JSON errorType strings to DetectionMethod enum values
 */
function mapDetectionMethod(errorType: string): DetectionMethod {
  switch (errorType) {
    case 'message':
      return DetectionMethod.MESSAGE;
    case 'response_url':
      return DetectionMethod.RESPONSE_URL;
    default:
      return DetectionMethod.STATUS_CODE;
  }
}

/**
 * Parse raw JSON site data into typed SiteConfig objects
 */
function parseSites(data: Record<string, Record<string, unknown>>): Map<string, SiteConfig> {
  const map = new Map<string, SiteConfig>();

  for (const [key, raw] of Object.entries(data)) {
    const config: SiteConfig = {
      name: raw.name as string,
      url: raw.url as string,
      urlMain: raw.urlMain as string,
      errorType: mapDetectionMethod(raw.errorType as string),
    };

    if (raw.urlProbe) config.urlProbe = raw.urlProbe as string;
    if (raw.errorMsg) config.errorMsg = raw.errorMsg as string | string[];
    if (raw.errorUrl) config.errorUrl = raw.errorUrl as string;
    if (raw.regexCheck) config.regexCheck = raw.regexCheck as string;
    if (raw.requestMethod) config.requestMethod = raw.requestMethod as SiteConfig['requestMethod'];
    if (raw.requestPayload) config.requestPayload = raw.requestPayload as Record<string, unknown>;
    if (raw.headers) config.headers = raw.headers as Record<string, string>;
    if (raw.isNSFW) config.isNSFW = true;
    if (raw.usernameClaimed) config.usernameClaimed = raw.usernameClaimed as string;

    map.set(key, config);
  }

  return map;
}

/**
 * Sites class - Static methods for managing site configurations
 */
export class Sites {
  public static sites: Map<string, SiteConfig> = parseSites(
    sitesData as unknown as Record<string, Record<string, unknown>>,
  );

  /**
   * Get a site configuration by key
   */
  static get(key: string): SiteConfig | undefined {
    return Sites.sites.get(key);
  }

  /**
   * Filter sites based on options (optimized)
   */
  static filter(options: SiteFilterOptions = {}): Array<{ key: string; config: SiteConfig }> {
    const { includeNSFW = false, includeKeys } = options;

    // If includeKeys is explicitly provided (even if empty), use it
    if (includeKeys !== undefined) {
      // Empty array = no sites
      if (includeKeys.length === 0) {
        return [];
      }

      const result: Array<{ key: string; config: SiteConfig }> = [];

      for (const key of includeKeys) {
        const config = Sites.sites.get(key);
        if (!config) {
          continue;
        }
        if (!includeNSFW && config.isNSFW) {
          continue;
        }

        result.push({ key, config });
      }

      return result;
    }

    const result: Array<{ key: string; config: SiteConfig }> = [];
    const entries = Sites.sites.entries();
    for (const [key, config] of entries) {
      if (!includeNSFW && config.isNSFW) {
        continue;
      }
      result.push({ key, config });
    }

    return result;
  }

  /**
   * Get total number of sites
   */
  static count(): number {
    return Sites.sites.size;
  }

  /**
   * Check if a site exists
   */
  static has(key: string): boolean {
    return Sites.sites.has(key);
  }
}
