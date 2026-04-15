/**
 * Tests for Sites class
 */

import { describe, it, expect } from 'vitest';
import {
  ManifestRepository,
  Sites,
  canonicalizeSiteKey,
  levenshteinDistance,
  mapDetectionMethod,
  mapSingleDetectionMethod,
  normalizeSiteKey,
  parseSites,
} from '../src/Sites.js';
import { DetectionMethod } from '../src/types.js';

describe('Sites', () => {
  describe('helper functions', () => {
    it('should normalize and canonicalize site keys', () => {
      expect(normalizeSiteKey(' GitHub ')).toBe('github');
      expect(canonicalizeSiteKey('Git Hub!')).toBe('github');
    });

    it('should compute levenshtein distance for empty strings', () => {
      expect(levenshteinDistance('same', 'same')).toBe(0);
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });

    it('should map single and array detection methods', () => {
      expect(mapSingleDetectionMethod('message')).toBe(DetectionMethod.MESSAGE);
      expect(mapDetectionMethod(['message', 'response_url'])).toEqual([
        DetectionMethod.MESSAGE,
        DetectionMethod.RESPONSE_URL,
      ]);
    });

    it('should parse raw site data with responseUrl and array error types', () => {
      const parsed = parseSites({
        Example: {
          name: 'Example',
          url: 'https://example.com/{}',
          urlMain: 'https://example.com/',
          errorType: ['message', 'response_url'],
          responseUrl: 'https://example.com/missing',
          requestPayload: { username: '{}' },
        },
      });

      expect(parsed.get('Example')).toEqual(
        expect.objectContaining({
          errorType: [DetectionMethod.MESSAGE, DetectionMethod.RESPONSE_URL],
          responseUrl: 'https://example.com/missing',
          requestPayload: { username: '{}' },
        }),
      );
    });

    it('should score prefix and substring suggestions differently', () => {
      expect(Sites.suggestKeys('git')).toContain('GitHub');
      expect(Sites.suggestKeys('hub')).toContain('GitHub');
    });
  });

  describe('get()', () => {
    it('should return site config by key', () => {
      const github = Sites.get('GitHub');
      expect(github).toBeDefined();
      expect(github?.name).toBe('GitHub');
      expect(github?.url).toContain('github.com');
    });

    it('should resolve site config case-insensitively', () => {
      const github = Sites.get('github');
      expect(github).toBeDefined();
      expect(github?.name).toBe('GitHub');
    });

    it('should return undefined for non-existent site', () => {
      expect(Sites.get('nonexistent-site-xyz')).toBeUndefined();
    });
  });

  describe('resolveKeys()', () => {
    it('should de-duplicate resolved site keys', () => {
      expect(Sites.resolveKeys(['GitHub', 'github', 'GITHUB']).resolvedKeys).toEqual(['GitHub']);
    });

    it('should collect missing site keys with suggestions', () => {
      const resolved = Sites.resolveKeys(['gitub']);
      expect(resolved.missing).toHaveLength(1);
      expect(resolved.missing[0].suggestions).toContain('GitHub');
    });
  });

  describe('repository facade', () => {
    it('should expose normalized key mappings and resolve keys through the facade', () => {
      expect(Sites.normalizedKeys.get('github')).toBe('GitHub');
      expect(Sites.resolveKey('github')).toBe('GitHub');
    });

    it('should allow swapping and resetting the backing repository', () => {
      const customRepository = ManifestRepository.fromSiteConfigs({
        Example: {
          name: 'Example',
          url: 'https://example.com/{}',
          urlMain: 'https://example.com/',
          errorType: DetectionMethod.STATUS_CODE,
        },
      });

      Sites.setRepository(customRepository);

      try {
        expect(Sites.getRepository()).toBe(customRepository);
        expect(Sites.has('Example')).toBe(true);
        expect(Sites.has('GitHub')).toBe(false);
      } finally {
        Sites.resetRepository();
      }

      expect(Sites.has('GitHub')).toBe(true);
    });
  });

  describe('suggestKeys()', () => {
    it('should suggest similar site names', () => {
      expect(Sites.suggestKeys('gitub')).toContain('GitHub');
    });

    it('should return empty suggestions for non-alphanumeric input', () => {
      expect(Sites.suggestKeys('!!!')).toEqual([]);
    });
  });

  describe('filter()', () => {
    it('should return all non-NSFW sites by default', () => {
      const filtered = Sites.filter();
      expect(filtered.length).toBeGreaterThan(200);
      // Check that all returned sites are non-NSFW
      filtered.forEach((site) => {
        expect(site.config.isNSFW || false).toBe(false);
      });
      expect(filtered.some((site) => site.key === 'Reddit')).toBe(false);
    });

    it('should include NSFW sites when requested', () => {
      const withNsfw = Sites.filter({ includeNSFW: true });
      const withoutNsfw = Sites.filter({ includeNSFW: false });
      expect(withNsfw.length).toBeGreaterThan(withoutNsfw.length);
    });

    it('should filter to specific keys', () => {
      const filtered = Sites.filter({ includeKeys: ['GitHub', 'GitLab'] });
      expect(filtered.length).toBe(2);
      expect(filtered.map((s) => s.key)).toContain('GitHub');
      expect(filtered.map((s) => s.key)).toContain('GitLab');
    });

    it('should resolve includeKeys case-insensitively', () => {
      const filtered = Sites.filter({ includeKeys: ['github', 'gitlab'] });
      expect(filtered.map((s) => s.key)).toEqual(['GitHub', 'GitLab']);
    });

    it('should allow explicitly selected excluded sites', () => {
      const filtered = Sites.filter({ includeKeys: ['GitHub', 'Reddit'] });
      expect(filtered.length).toBe(2);
      expect(filtered.map((s) => s.key)).toEqual(['GitHub', 'Reddit']);
    });

    it('should include excluded sites when requested globally', () => {
      const filtered = Sites.filter({ includeNSFW: true, includeExcluded: true });
      expect(filtered.some((site) => site.key === 'Reddit')).toBe(true);
    });

    it('should return empty array for empty includeKeys', () => {
      const filtered = Sites.filter({ includeKeys: [] });
      expect(filtered.length).toBe(0);
    });

    it('should skip non-existent keys in includeKeys', () => {
      const filtered = Sites.filter({ includeKeys: ['GitHub', 'nonexistent-key-xyz', 'GitLab'] });
      expect(filtered.length).toBe(2);
      expect(filtered.map((s) => s.key)).toEqual(['GitHub', 'GitLab']);
    });

    it('should skip keys whose normalized mapping exists but whose site config is missing', () => {
      const github = Sites.sites.get('GitHub');
      expect(github).toBeDefined();

      Sites.sites.delete('GitHub');

      try {
        expect(Sites.filter({ includeKeys: ['github'] })).toEqual([]);
      } finally {
        Sites.sites.set('GitHub', github!);
      }
    });

    it('should filter out NSFW sites from includeKeys when includeNSFW is false', () => {
      // 'Pornhub' is an NSFW site
      const filtered = Sites.filter({ includeKeys: ['GitHub', 'Pornhub'], includeNSFW: false });
      expect(filtered.length).toBe(1);
      expect(filtered[0].key).toBe('GitHub');
    });

    it('should include NSFW sites from includeKeys when includeNSFW is true', () => {
      const filtered = Sites.filter({ includeKeys: ['GitHub', 'Pornhub'], includeNSFW: true });
      expect(filtered.length).toBe(2);
      expect(filtered.map((s) => s.key)).toContain('GitHub');
      expect(filtered.map((s) => s.key)).toContain('Pornhub');
    });
  });

  describe('count()', () => {
    it('should return number of sites', () => {
      const count = Sites.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(200);
    });

    it('should increase when excluded sites are included', () => {
      expect(Sites.count({ includeExcluded: true })).toBeGreaterThan(Sites.count());
    });

    it('should match filter() length when including all sites', () => {
      const allSites = Sites.filter({ includeNSFW: true });
      expect(Sites.count()).toBe(allSites.length);
    });
  });

  describe('has()', () => {
    it('should return true for existing site', () => {
      expect(Sites.has('GitHub')).toBe(true);
    });

    it('should return true for existing site with different casing', () => {
      expect(Sites.has('github')).toBe(true);
    });

    it('should return false for non-existent site', () => {
      expect(Sites.has('nonexistent-site')).toBe(false);
    });
  });

  describe('site configurations', () => {
    it('should have required fields for each site', () => {
      const list = Sites.filter({ includeNSFW: true });
      for (const { config: site } of list) {
        expect(site.name).toBeDefined();
        expect(typeof site.name).toBe('string');
        expect(site.name.length).toBeGreaterThan(0);

        expect(site.url).toBeDefined();
        expect(site.url).toMatch(/^https?:\/\//);

        expect(site.urlMain).toBeDefined();
        expect(site.urlMain).toMatch(/^https?:\/\//);

        expect(site.errorType).toBeDefined();
        const errorTypes = Array.isArray(site.errorType) ? site.errorType : [site.errorType];
        errorTypes.forEach((errorType) => {
          expect(Object.values(DetectionMethod)).toContain(errorType);
        });
      }
    });

    it('should have valid errorMsg when errorType is MESSAGE', () => {
      const list = Sites.filter({ includeNSFW: true });
      const messageSites = list.filter(({ config }) => {
        const errorTypes = Array.isArray(config.errorType) ? config.errorType : [config.errorType];
        return errorTypes.includes(DetectionMethod.MESSAGE);
      });
      for (const { config: site } of messageSites) {
        expect(site.errorMsg).toBeDefined();
        if (Array.isArray(site.errorMsg)) {
          expect(site.errorMsg.length).toBeGreaterThan(0);
        } else {
          expect(typeof site.errorMsg).toBe('string');
          expect((site.errorMsg as string).length).toBeGreaterThan(0);
        }
      }
    });

    it('should have valid errorUrl when errorType is RESPONSE_URL', () => {
      const list = Sites.filter({ includeNSFW: true });
      const urlSites = list.filter(({ config }) => {
        const errorTypes = Array.isArray(config.errorType) ? config.errorType : [config.errorType];
        return errorTypes.includes(DetectionMethod.RESPONSE_URL);
      });
      for (const { config: site } of urlSites) {
        expect(site.errorUrl).toBeDefined();
        expect(typeof site.errorUrl).toBe('string');
      }
    });

    it('should have correct GitHub configuration', () => {
      const github = Sites.get('GitHub');
      expect(github).toBeDefined();
      expect(github?.url).toContain('github.com/{}');
      expect(github?.errorType).toBe(DetectionMethod.STATUS_CODE);
    });

    it('should have correct Twitter configuration', () => {
      const twitter = Sites.get('Twitter');
      expect(twitter).toBeDefined();
      expect(twitter?.url).toContain('x.com/{}');
      expect(twitter?.errorType).toBe(DetectionMethod.MESSAGE);
    });

    it('should have correct Reddit configuration', () => {
      const reddit = Sites.get('Reddit');
      expect(reddit).toBeDefined();
      expect(reddit?.url).toBe('https://www.reddit.com/user/{}');
      expect(reddit?.errorType).toBe(DetectionMethod.MESSAGE);
      expect(reddit?.errorMsg).toBeDefined();
    });

    it('should preserve status-code regression fields for representative sites', () => {
      expect(Sites.get('Slides')?.errorCode).toBe(204);
      expect(Sites.get('Platzi')?.errorCode).toBe(404);
      expect(Sites.get('Wowhead')?.errorCode).toBe(404);
      expect(Sites.get('addons.wago.io')?.errorCode).toBe(404);
    });

    it('should preserve explicit request methods from the bundled manifest', () => {
      expect(Sites.get('Platzi')?.requestMethod).toBe('GET');
      expect(Sites.get('LinkedIn')?.requestMethod).toBe('GET');
    });
  });
});
