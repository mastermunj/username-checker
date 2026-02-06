/**
 * UsernameChecker - Main class for checking username availability across sites
 */

import type { HttpsProxyAgent } from 'https-proxy-agent';
import type { SocksProxyAgent } from 'socks-proxy-agent';
import type { CheckOptions, CheckResult, SiteConfig, SiteFilterOptions, CheckProgress } from './types.js';
import { ErrorCategory } from './types.js';
import { Sites } from './Sites.js';
import { Validator } from './Validator.js';
import { Fetcher } from './Fetcher.js';
import { Detector } from './Detector.js';
import { Proxy } from './Proxy.js';
import { ConcurrencyController, DomainRateLimiter } from './Concurrency.js';

/**
 * Default check options
 */
const DEFAULT_OPTIONS: Required<Omit<CheckOptions, 'proxy' | 'sites' | 'excludeSites' | 'onProgress' | 'signal'>> = {
  timeout: 15000,
  maxConcurrency: 50,
  retries: 2,
  includeNSFW: false,
  useTor: false,
};

/**
 * Main class for checking username availability across multiple platforms
 */
export class UsernameChecker {
  private options: typeof DEFAULT_OPTIONS;
  private proxyAgent: HttpsProxyAgent<string> | SocksProxyAgent | null = null;
  private controller: ConcurrencyController | null = null;

  constructor(options: Partial<CheckOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Set up proxy if configured
    if (options.useTor) {
      this.proxyAgent = Proxy.createTorAgent();
    } else if (options.proxy) {
      this.proxyAgent = Proxy.createAgent(options.proxy);
    }
  }

  /**
   * Check username availability across all matching sites
   */
  async check(
    username: string,
    options: {
      sites?: string[];
      includeNSFW?: boolean;
      onProgress?: (progress: CheckProgress) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<CheckResult[]> {
    const { sites: includeKeys, onProgress, signal } = options;
    const includeNSFW = options.includeNSFW ?? this.options.includeNSFW;

    // Validate username
    const validation = Validator.validate(username);
    if (!validation.valid) {
      throw new Error(`Invalid username: ${validation.errors.join(', ')}`);
    }

    // Get sites to check
    const filterOptions: SiteFilterOptions = {
      includeNSFW,
      includeKeys,
    };
    const sitesToCheck = Sites.filter(filterOptions);

    if (sitesToCheck.length === 0) {
      return [];
    }

    // Create concurrency controller
    this.controller = new ConcurrencyController({
      maxConcurrency: this.options.maxConcurrency,
      timeout: this.options.timeout,
      domainDelay: 100,
    });

    const total = sitesToCheck.length;
    let completed = 0;
    let available = 0;
    let taken = 0;
    let errors = 0;

    const results = await this.controller.run(
      sitesToCheck,
      async (site) => {
        const result = await this.checkSite(username, site.key, site.config, signal);
        return result;
      },
      {
        onResult: (result) => {
          completed++;
          if (result.status === 'available') {
            available++;
          } else if (result.status === 'taken') {
            taken++;
          } else if (result.status === 'error') {
            errors++;
          }

          onProgress?.({
            total,
            completed,
            available,
            taken,
            errors,
            currentSite: result.site,
            percentage: Math.round((completed / total) * 100),
          });
        },
        onError: () => {
          completed++;
          errors++;
          onProgress?.({
            total,
            completed,
            available,
            taken,
            errors,
            percentage: Math.round((completed / total) * 100),
          });
        },
        getDomain: (site) => DomainRateLimiter.extractDomain(site.config.urlMain),
      },
    );

    return results.filter((r): r is CheckResult => r !== undefined);
  }

  /**
   * Check a single site
   */
  async checkSite(username: string, siteKey: string, config?: SiteConfig, signal?: AbortSignal): Promise<CheckResult> {
    const siteConfig = config ?? Sites.get(siteKey);

    if (!siteConfig) {
      return {
        site: siteKey,
        siteName: siteKey,
        url: '',
        status: 'error',
        errorCategory: ErrorCategory.UNKNOWN,
        errorMessage: `Site "${siteKey}" not found`,
        responseTime: 0,
      };
    }

    // Check if username matches site's regex requirement
    if (!Detector.matchesRegex(siteConfig, username)) {
      return {
        site: siteKey,
        siteName: siteConfig.name,
        url: Detector.buildProfileUrl(siteConfig, username),
        status: 'invalid',
        errorCategory: ErrorCategory.NONE,
        errorMessage: `Username doesn't match site requirements: ${siteConfig.regexCheck}`,
        responseTime: 0,
      };
    }

    const url = Detector.buildUrl(siteConfig, username);
    const profileUrl = Detector.buildProfileUrl(siteConfig, username);
    const startTime = Date.now();

    try {
      const method = Detector.getMethod(siteConfig);
      const headers = Detector.getHeaders(siteConfig);
      const body = Detector.buildPayload(siteConfig, username);

      const fetchResult = await Fetcher.fetch(url, {
        method,
        headers,
        body,
        timeout: this.options.timeout,
        proxy: this.proxyAgent ?? undefined,
        retryConfig: { maxRetries: this.options.retries },
        signal,
      });

      const responseTime = Date.now() - startTime;

      if (fetchResult.errorCategory && fetchResult.errorCategory !== ErrorCategory.NONE) {
        return {
          site: siteKey,
          siteName: siteConfig.name,
          url: profileUrl,
          status: 'error',
          errorCategory: fetchResult.errorCategory as ErrorCategory,
          errorMessage: fetchResult.errorMessage,
          responseTime,
          httpStatus: fetchResult.statusCode,
        };
      }

      const status = Detector.detect(siteConfig, fetchResult, username);

      return {
        site: siteKey,
        siteName: siteConfig.name,
        url: profileUrl,
        status,
        errorCategory: ErrorCategory.NONE,
        responseTime,
        httpStatus: fetchResult.statusCode,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorCategory = error instanceof Error ? Fetcher.categorizeError(error) : ErrorCategory.UNKNOWN;

      return {
        site: siteKey,
        siteName: siteConfig.name,
        url: profileUrl,
        status: 'error',
        errorCategory,
        errorMessage: errorMsg,
        responseTime,
      };
    }
  }

  /**
   * Abort any running check operations
   */
  abort(): void {
    this.controller?.abort();
  }

  /**
   * Get site count (convenience method)
   */
  static getSiteCount(): number {
    return Sites.count();
  }

  /**
   * Check if a site is supported (convenience method)
   */
  static hasSite(key: string): boolean {
    return Sites.has(key);
  }

  /**
   * Get a specific site configuration (convenience method)
   */
  static getSite(key: string): SiteConfig | undefined {
    return Sites.get(key);
  }
}
