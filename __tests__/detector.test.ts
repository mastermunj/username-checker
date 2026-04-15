/**
 * Tests for Detector class
 */

import { describe, it, expect } from 'vitest';
import { Detector } from '../src/Detector.js';
import { DetectionMethod, ErrorCategory } from '../src/types.js';
import type { SiteConfig, FetchResult } from '../src/types.js';
import { regressionSiteFixtures } from './fixtures/accuracy-fixtures.js';

describe('Detector', () => {
  describe('detect()', () => {
    describe('STATUS_CODE detection', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
      };

      it('should detect available on 404', () => {
        const result: FetchResult = {
          statusCode: 404,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('available');
      });

      it('should detect available when errorCode matches a 2xx response', () => {
        const configWithErrorCode: SiteConfig = {
          ...config,
          errorCode: 204,
        };
        const result: FetchResult = {
          statusCode: 204,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(configWithErrorCode, result, 'testuser')).toBe('available');
      });

      it('should detect available for non-success custom error codes outside the 2xx range', () => {
        const configWithErrorCode: SiteConfig = {
          ...config,
          errorCode: 204,
        };
        const result: FetchResult = {
          statusCode: 102,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(configWithErrorCode, result, 'testuser')).toBe('available');
      });

      it('should detect taken when a custom error-code site returns a normal success response', () => {
        const configWithErrorCode: SiteConfig = {
          ...config,
          errorCode: 204,
        };
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(configWithErrorCode, result, 'testuser')).toBe('taken');
      });

      it('should detect taken on 200', () => {
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('taken');
      });

      it('should detect error on 429', () => {
        const result: FetchResult = {
          statusCode: 429,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('error');
      });

      it('should detect error on 5xx', () => {
        const result: FetchResult = {
          statusCode: 500,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('error');
      });

      it('should detect taken on 3xx redirect', () => {
        const result: FetchResult = {
          statusCode: 302,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('taken');
      });

      it('should detect taken on 4xx (except 404)', () => {
        const result: FetchResult = {
          statusCode: 403,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('taken');
      });

      it('should return unknown for unexpected status codes', () => {
        const result: FetchResult = {
          statusCode: 0,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('unknown');
      });

      it('should return unknown for informational status codes', () => {
        const result: FetchResult = {
          statusCode: 102,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('unknown');
      });
    });

    describe('MESSAGE detection', () => {
      const config: SiteConfig = {
        name: 'Reddit',
        url: 'https://reddit.com/user/{}',
        urlMain: 'https://reddit.com',
        errorType: DetectionMethod.MESSAGE,
        errorMsg: 'nobody on Reddit goes by that name',
      };

      it('should detect available when error message found', () => {
        const result: FetchResult = {
          statusCode: 200,
          body: 'Sorry, nobody on Reddit goes by that name.',
          headers: {},
          finalUrl: 'https://reddit.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('available');
      });

      it('should detect taken when error message not found', () => {
        const result: FetchResult = {
          statusCode: 200,
          body: 'User profile page content',
          headers: {},
          finalUrl: 'https://reddit.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('taken');
      });

      it('should handle array of error messages', () => {
        const arrayConfig: SiteConfig = {
          ...config,
          errorMsg: ['not found', 'does not exist'],
        };
        const result: FetchResult = {
          statusCode: 200,
          body: 'This user does not exist',
          headers: {},
          finalUrl: 'https://reddit.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(arrayConfig, result, 'testuser')).toBe('available');
      });

      it('should detect error on 5xx server error', () => {
        const result: FetchResult = {
          statusCode: 500,
          body: 'Internal server error',
          headers: {},
          finalUrl: 'https://reddit.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('error');
      });

      it('should detect error on 429 rate limit', () => {
        const result: FetchResult = {
          statusCode: 429,
          body: 'Too many requests',
          headers: {},
          finalUrl: 'https://reddit.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('error');
      });

      it('should fall back to status code when no errorMsg defined', () => {
        const noMsgConfig: SiteConfig = {
          ...config,
          errorMsg: undefined,
        };
        const result: FetchResult = {
          statusCode: 404,
          body: '',
          headers: {},
          finalUrl: 'https://reddit.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(noMsgConfig, result, 'testuser')).toBe('available');
      });
    });

    describe('RESPONSE_URL detection', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/user/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.RESPONSE_URL,
        errorUrl: 'https://example.com/404',
      };

      it('should detect available when redirected to error URL', () => {
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/404',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('available');
      });

      it('should detect taken when not redirected', () => {
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('taken');
      });

      it('should detect error on 5xx server error', () => {
        const result: FetchResult = {
          statusCode: 500,
          body: 'Internal server error',
          headers: {},
          finalUrl: 'https://example.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('error');
      });

      it('should detect error on 429 rate limit', () => {
        const result: FetchResult = {
          statusCode: 429,
          body: 'Too many requests',
          headers: {},
          finalUrl: 'https://example.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('error');
      });

      it('should fall back to status code when no errorUrl defined', () => {
        const noUrlConfig: SiteConfig = {
          ...config,
          errorUrl: undefined,
        };
        const result: FetchResult = {
          statusCode: 404,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(noUrlConfig, result, 'testuser')).toBe('available');
      });

      it('should detect available with partial URL match', () => {
        const partialConfig: SiteConfig = {
          ...config,
          errorUrl: 'https://example.com/not-found-page',
        };
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/not-found-page/extra',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(partialConfig, result, 'testuser')).toBe('available');
      });

      it('should detect available with protocol mismatch but matching path', () => {
        const protocolConfig: SiteConfig = {
          ...config,
          errorUrl: 'https://example.com/notfound',
        };
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          // Different protocol (http vs https) but same domain/path
          finalUrl: 'http://example.com/notfound',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(protocolConfig, result, 'testuser')).toBe('available');
      });

      it('should detect taken when the error URL does not partially match the final URL', () => {
        const unrelatedConfig: SiteConfig = {
          ...config,
          errorUrl: 'https://missing.example.org/notfound',
        };
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(unrelatedConfig, result, 'testuser')).toBe('taken');
      });

      it('should ignore short matching URL segments when checking partial response URLs', () => {
        const shortSegmentConfig: SiteConfig = {
          ...config,
          errorUrl: 'https://a.co/abcde',
        };
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          finalUrl: 'https://a.co/profile/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(shortSegmentConfig, result, 'testuser')).toBe('taken');
      });

      it('should detect available on manual redirect responses', () => {
        const result: FetchResult = {
          statusCode: 302,
          body: '',
          headers: { location: 'https://example.com/404' },
          finalUrl: 'https://example.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('available');
      });

      it('should detect available on redirect responses without a location header', () => {
        const result: FetchResult = {
          statusCode: 302,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('available');
      });

      it('should detect taken on unusual statuses when the final URL does not match the error URL', () => {
        const result: FetchResult = {
          statusCode: 102,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/user/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('taken');
      });

      it('should fall back to final URL matching for unusual non-redirect statuses', () => {
        const result: FetchResult = {
          statusCode: 102,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/404',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(config, result, 'testuser')).toBe('available');
      });

      it('should handle error URL with username placeholder', () => {
        const userConfig: SiteConfig = {
          ...config,
          errorUrl: 'https://example.com/error/{}',
        };
        const result: FetchResult = {
          statusCode: 200,
          body: '',
          headers: {},
          finalUrl: 'https://example.com/error/testuser',
          errorCategory: ErrorCategory.NONE,
        };
        expect(Detector.detect(userConfig, result, 'testuser')).toBe('available');
      });
    });

    it('should return error when fetch had an error', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
      };
      const result: FetchResult = {
        statusCode: 0,
        body: '',
        headers: {},
        finalUrl: '',
        errorCategory: ErrorCategory.CONNECTION_ERROR,
        errorMessage: 'Connection failed',
      };
      expect(Detector.detect(config, result, 'testuser')).toBe('error');
    });

    it('should fall back to status code detection for unknown errorType', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: 'UNKNOWN_TYPE' as DetectionMethod,
      };
      const result: FetchResult = {
        statusCode: 404,
        body: '',
        headers: {},
        finalUrl: 'https://example.com/testuser',
        errorCategory: ErrorCategory.NONE,
      };
      expect(Detector.detect(config, result, 'testuser')).toBe('available');
    });

    it('should support multiple detection strategies from a single manifest entry', () => {
      const result: FetchResult = {
        statusCode: 404,
        body: 'profile unavailable',
        headers: {},
        finalUrl: 'https://example.com/missing',
        errorCategory: ErrorCategory.NONE,
      };

      expect(Detector.detect(regressionSiteFixtures.mixedDetection, result, 'missing')).toBe('available');
    });
  });

  describe('buildUrl()', () => {
    it('should replace placeholder in URL', () => {
      const config: SiteConfig = {
        name: 'GitHub',
        url: 'https://github.com/{}',
        urlMain: 'https://github.com',
        errorType: DetectionMethod.STATUS_CODE,
      };
      expect(Detector.buildUrl(config, 'testuser')).toBe('https://github.com/testuser');
    });

    it('should use urlProbe when available', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        urlProbe: 'https://api.example.com/check/{}',
        errorType: DetectionMethod.STATUS_CODE,
      };
      expect(Detector.buildUrl(config, 'testuser')).toBe('https://api.example.com/check/testuser');
    });
  });

  describe('buildProfileUrl()', () => {
    it('should always use main URL', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        urlProbe: 'https://api.example.com/check/{}',
        errorType: DetectionMethod.STATUS_CODE,
      };
      expect(Detector.buildProfileUrl(config, 'testuser')).toBe('https://example.com/testuser');
    });
  });

  describe('buildPayload()', () => {
    it('should return undefined when no payload configured', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
      };
      expect(Detector.buildPayload(config, 'testuser')).toBeUndefined();
    });

    it('should replace placeholder in payload', () => {
      const config: SiteConfig = {
        name: 'Discord',
        url: 'https://discord.com',
        urlMain: 'https://discord.com',
        errorType: DetectionMethod.MESSAGE,
        requestPayload: { username: '{}' },
      };
      const payload = Detector.buildPayload(config, 'testuser');
      expect(payload).toEqual({ username: 'testuser' });
    });

    it('should handle nested payload objects', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.MESSAGE,
        requestPayload: { query: 'query($name:String){User(name:$name){id}}', variables: { name: '{}' } },
      };
      const payload = Detector.buildPayload(config, 'testuser');
      expect(payload).toEqual({
        query: 'query($name:String){User(name:$name){id}}',
        variables: { name: 'testuser' },
      });
    });

    it('should preserve non-string primitive payload values', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.MESSAGE,
        requestPayload: { username: '{}', active: true, attempts: 2 },
      };
      const payload = Detector.buildPayload(config, 'testuser');
      expect(payload).toEqual({ username: 'testuser', active: true, attempts: 2 });
    });
  });

  describe('getMethod()', () => {
    it('should return GET by default', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
      };
      expect(Detector.getMethod(config)).toBe('HEAD');
    });

    it('should return GET by default when body content may be needed', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.MESSAGE,
      };
      expect(Detector.getMethod(config)).toBe('GET');
    });

    it('should return POST when configured', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.MESSAGE,
        requestMethod: 'POST',
      };
      expect(Detector.getMethod(config)).toBe('POST');
    });

    it('should return HEAD when configured', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
        requestMethod: 'HEAD',
      };
      expect(Detector.getMethod(config)).toBe('HEAD');
    });

    it('should return PUT when configured', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.MESSAGE,
        requestMethod: 'PUT',
      };
      expect(Detector.getMethod(config)).toBe('PUT');
    });
  });

  describe('shouldFollowRedirects()', () => {
    it('should disable redirect following for response URL detection', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.RESPONSE_URL,
        errorUrl: 'https://example.com/404',
      };
      expect(Detector.shouldFollowRedirects(config)).toBe(false);
    });

    it('should keep redirect following enabled for non response URL detection', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.MESSAGE,
      };
      expect(Detector.shouldFollowRedirects(config)).toBe(true);
    });
  });

  describe('getHeaders()', () => {
    it('should return base headers when no site headers', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
      };
      const baseHeaders = { 'User-Agent': 'Test' };
      expect(Detector.getHeaders(config, baseHeaders)).toEqual(baseHeaders);
    });

    it('should merge site headers with base headers', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
        headers: { Accept: 'text/html', Custom: 'value' },
      };
      const baseHeaders = { 'User-Agent': 'Test' };
      const result = Detector.getHeaders(config, baseHeaders);
      expect(result).toEqual({
        'User-Agent': 'Test',
        Accept: 'text/html',
        Custom: 'value',
      });
    });
  });

  describe('matchesRegex()', () => {
    it('should return true when no regex configured', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
      };
      expect(Detector.matchesRegex(config, 'anyuser')).toBe(true);
    });

    it('should validate against configured regex', () => {
      const config: SiteConfig = {
        name: 'GitHub',
        url: 'https://github.com/{}',
        urlMain: 'https://github.com',
        errorType: DetectionMethod.STATUS_CODE,
        regexCheck: '^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$',
      };
      expect(Detector.matchesRegex(config, 'validuser')).toBe(true);
      expect(Detector.matchesRegex(config, '-invalid')).toBe(false);
    });

    it('should return true for invalid regex patterns', () => {
      const config: SiteConfig = {
        name: 'TestSite',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com',
        errorType: DetectionMethod.STATUS_CODE,
        regexCheck: '[invalid',
      };
      expect(Detector.matchesRegex(config, 'anyuser')).toBe(true);
    });
  });
});
