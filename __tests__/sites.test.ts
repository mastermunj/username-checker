/**
 * Tests for Sites class
 */

import { describe, it, expect } from 'vitest';
import { Sites } from '../src/Sites.js';
import { DetectionMethod } from '../src/types.js';

describe('Sites', () => {
  describe('get()', () => {
    it('should return site config by key', () => {
      const github = Sites.get('GitHub');
      expect(github).toBeDefined();
      expect(github?.name).toBe('GitHub');
      expect(github?.url).toContain('github.com');
    });

    it('should return undefined for non-existent site', () => {
      expect(Sites.get('nonexistent-site-xyz')).toBeUndefined();
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

    it('should return empty array for empty includeKeys', () => {
      const filtered = Sites.filter({ includeKeys: [] });
      expect(filtered.length).toBe(0);
    });

    it('should skip non-existent keys in includeKeys', () => {
      const filtered = Sites.filter({ includeKeys: ['GitHub', 'nonexistent-key-xyz', 'GitLab'] });
      expect(filtered.length).toBe(2);
      expect(filtered.map((s) => s.key)).toEqual(['GitHub', 'GitLab']);
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

    it('should match filter() length when including all sites', () => {
      const allSites = Sites.filter({ includeNSFW: true });
      expect(Sites.count()).toBe(allSites.length);
    });
  });

  describe('has()', () => {
    it('should return true for existing site', () => {
      expect(Sites.has('GitHub')).toBe(true);
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
        expect(Object.values(DetectionMethod)).toContain(site.errorType);
      }
    });

    it('should have valid errorMsg when errorType is MESSAGE', () => {
      const list = Sites.filter({ includeNSFW: true });
      const messageSites = list.filter(({ config }) => config.errorType === DetectionMethod.MESSAGE);
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
      const urlSites = list.filter(({ config }) => config.errorType === DetectionMethod.RESPONSE_URL);
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
  });
});
