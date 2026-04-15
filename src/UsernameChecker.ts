/**
 * UsernameChecker - Main class for checking username availability across sites
 */

import type { HttpsProxyAgent } from 'https-proxy-agent';
import type { SocksProxyAgent } from 'socks-proxy-agent';
import type {
  CheckOptions,
  CheckResult,
  SiteConfig,
  SiteFilterOptions,
  CheckDiagnostics,
  CheckDebugData,
  DebugOptions,
  RequestMethod,
  SiteRepository,
  BatchCheckOptions,
  BatchCheckResult,
  BatchCheckProgress,
} from './types.js';
import { ErrorCategory } from './types.js';
import { Sites } from './Sites.js';
import { Validator } from './Validator.js';
import { Fetcher } from './Fetcher.js';
import { Detector } from './Detector.js';
import { Proxy } from './Proxy.js';
import { ConcurrencyController, DomainRateLimiter } from './Concurrency.js';
import { RunLifecycle } from './RunLifecycle.js';
import { CheckResultCache } from './Cache.js';

/**
 * Default check options
 */
const DEFAULT_OPTIONS: Required<
  Omit<CheckOptions, 'proxy' | 'repository' | 'sites' | 'excludeSites' | 'onProgress' | 'signal' | 'debug' | 'cache'>
> = {
  timeout: 15000,
  maxConcurrency: 50,
  retries: 2,
  includeNSFW: false,
  includeExcluded: false,
  useTor: false,
};

/**
 * Main class for checking username availability across multiple platforms
 */
export class UsernameChecker {
  private options: typeof DEFAULT_OPTIONS;
  private readonly repository: SiteRepository;
  private proxyAgent: HttpsProxyAgent<string> | SocksProxyAgent | null = null;
  private controller: ConcurrencyController | null = null;
  private lifecycle: RunLifecycle | null = null;
  private cache: CheckResultCache | null = null;

  constructor(options: Partial<CheckOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.repository = options.repository ?? Sites.getRepository();

    // Set up proxy if configured
    if (options.useTor) {
      this.proxyAgent = Proxy.createTorAgent();
    } else if (options.proxy) {
      this.proxyAgent = Proxy.createAgent(options.proxy);
    }

    // Set up cache if configured
    if (options.cache) {
      this.cache = new CheckResultCache(options.cache);
    }
  }

  /**
   * Check username availability across all matching sites
   */
  async check(
    username: string,
    options: Pick<CheckOptions, 'sites' | 'includeNSFW' | 'includeExcluded' | 'onProgress' | 'signal' | 'debug'> = {},
  ): Promise<CheckResult[]> {
    const { sites: includeKeys, onProgress, signal, debug } = options;
    const includeNSFW = options.includeNSFW ?? this.options.includeNSFW;
    const includeExcluded = options.includeExcluded ?? this.options.includeExcluded;
    const resolvedSites = includeKeys ? this.repository.resolveKeys(includeKeys) : undefined;

    if (resolvedSites && resolvedSites.missing.length > 0) {
      const missingText = resolvedSites.missing
        .map(({ input, suggestions }) => {
          if (suggestions.length === 0) {
            return `"${input}"`;
          }

          return `"${input}" (did you mean ${suggestions.join(', ')}?)`;
        })
        .join(', ');
      const siteLabel = resolvedSites.missing.length === 1 ? 'site' : 'sites';

      throw new Error(`Unknown ${siteLabel}: ${missingText}`);
    }

    // Validate username
    const validation = Validator.validate(username);
    if (!validation.valid) {
      throw new Error(`Invalid username: ${validation.errors.join(', ')}`);
    }
    const normalizedUsername = validation.normalizedUsername;

    // Get sites to check
    const filterOptions: SiteFilterOptions = {
      includeNSFW,
      includeExcluded,
      includeKeys: resolvedSites?.resolvedKeys,
    };
    const sitesToCheck = this.repository.filter(filterOptions);

    if (sitesToCheck.length === 0) {
      return [];
    }

    const lifecycle = new RunLifecycle();
    lifecycle.linkSignal(signal);
    this.lifecycle = lifecycle;

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

    try {
      const results = await this.controller.run(
        sitesToCheck,
        async (site) => {
          const result = await this.checkSite(normalizedUsername, site.key, site.config, lifecycle.signal, debug);
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
          signal: lifecycle.signal,
        },
      );

      return results.filter((r): r is CheckResult => r !== undefined);
    } finally {
      lifecycle.dispose();
      this.lifecycle = null;
      this.controller = null;
    }
  }

  /**
   * Check multiple usernames across sites with optional callback for progress
   */
  async checkBatch(usernames: string[], options: BatchCheckOptions = {}): Promise<BatchCheckResult[]> {
    const { onBatchProgress, signal, onProgress, ...checkOptions } = options;

    const results: BatchCheckResult[] = [];

    for (let i = 0; i < usernames.length; i++) {
      const username = usernames[i];

      // Notify batch progress
      onBatchProgress?.({
        currentUsername: username,
        currentUsernameIndex: i,
        totalUsernames: usernames.length,
        usernamePercentage: Math.round(((i + 1) / usernames.length) * 100),
        totalPercentage: Math.round(((i + 1) / usernames.length) * 100),
      });

      /**
       * Check if signal is aborted before starting each username check
       */
      if (signal?.aborted) {
        break;
      }

      // Check current username
      const siteResults = await this.check(username, {
        ...checkOptions,
        signal,
        onProgress: (progress) => {
          const batchProgress: BatchCheckProgress = {
            currentUsername: username,
            currentUsernameIndex: i,
            totalUsernames: usernames.length,
            usernamePercentage: Math.round((i / usernames.length) * 100),
            totalPercentage: Math.round((i / usernames.length + progress.percentage / 100 / usernames.length) * 100),
            siteProgress: progress,
          };
          onBatchProgress?.(batchProgress);
          onProgress?.(progress);
        },
      });

      // Build batch result
      const summary = {
        total: siteResults.length,
        available: siteResults.filter((r) => r.status === 'available').length,
        taken: siteResults.filter((r) => r.status === 'taken').length,
        errors: siteResults.filter((r) => r.status === 'error').length,
      };

      const validation = Validator.validate(username);
      results.push({
        username,
        normalizedUsername: validation.normalizedUsername,
        results: siteResults,
        summary,
      });
    }

    return results;
  }

  /**
   * Check a single site
   */
  async checkSite(
    username: string,
    siteKey: string,
    config?: SiteConfig,
    signal?: AbortSignal,
    debug?: DebugOptions,
  ): Promise<CheckResult> {
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(siteKey, username);
      if (cached) {
        return cached;
      }
    }

    const siteConfig = config ?? this.repository.get(siteKey);

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

    const url = Detector.buildUrl(siteConfig, username);
    const profileUrl = Detector.buildProfileUrl(siteConfig, username);
    const method = Detector.getMethod(siteConfig);
    const followRedirects = Detector.shouldFollowRedirects(siteConfig);
    const diagnosticsBase = this.buildDiagnostics(siteConfig, url, method, followRedirects);

    // Check if username matches site's regex requirement
    if (!Detector.matchesRegex(siteConfig, username)) {
      return {
        site: siteKey,
        siteName: siteConfig.name,
        url: profileUrl,
        status: 'invalid',
        errorCategory: ErrorCategory.NONE,
        errorMessage: `Username doesn't match site requirements: ${siteConfig.regexCheck}`,
        responseTime: 0,
        diagnostics: diagnosticsBase,
      };
    }

    const startTime = Date.now();

    try {
      const headers = Detector.getHeaders(siteConfig);
      const body = Detector.buildPayload(siteConfig, username);

      const fetchResult = await Fetcher.fetch(url, {
        method,
        headers,
        body,
        timeout: this.options.timeout,
        proxy: this.proxyAgent ?? undefined,
        retryConfig: { maxRetries: this.options.retries },
        followRedirects: Detector.shouldFollowRedirects(siteConfig),
        signal,
      });

      const responseTime = Date.now() - startTime;

      if (fetchResult.errorCategory && fetchResult.errorCategory !== ErrorCategory.NONE) {
        const result = {
          site: siteKey,
          siteName: siteConfig.name,
          url: profileUrl,
          status: 'error' as const,
          errorCategory: fetchResult.errorCategory as ErrorCategory,
          errorMessage: fetchResult.errorMessage,
          responseTime,
          httpStatus: fetchResult.statusCode,
          diagnostics: {
            ...diagnosticsBase,
            finalUrl: fetchResult.finalUrl,
          },
          debug: this.buildDebugData(fetchResult, debug),
        };
        this.cache?.set(siteKey, username, result);
        return result;
      }

      const status = Detector.detect(siteConfig, fetchResult, username);

      const result = {
        site: siteKey,
        siteName: siteConfig.name,
        url: profileUrl,
        status,
        errorCategory: ErrorCategory.NONE,
        responseTime,
        httpStatus: fetchResult.statusCode,
        diagnostics: {
          ...diagnosticsBase,
          finalUrl: fetchResult.finalUrl,
        },
        debug: this.buildDebugData(fetchResult, debug),
      };
      this.cache?.set(siteKey, username, result);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorCategory = error instanceof Error ? Fetcher.categorizeError(error) : ErrorCategory.UNKNOWN;

      const result = {
        site: siteKey,
        siteName: siteConfig.name,
        url: profileUrl,
        status: 'error' as const,
        errorCategory,
        errorMessage: errorMsg,
        responseTime,
        diagnostics: diagnosticsBase,
      };
      this.cache?.set(siteKey, username, result);
      return result;
    }
  }

  private buildDebugData(
    fetchResult: { statusCode: number; headers: Record<string, string>; body: string },
    debug?: DebugOptions,
  ): CheckDebugData | undefined {
    if (!debug) {
      return undefined;
    }

    const maxBodyLength = debug.maxBodyLength ?? 2000;
    const responseBody = debug.includeBody
      ? fetchResult.body.length > maxBodyLength
        ? `${fetchResult.body.slice(0, maxBodyLength)}\n... [truncated ${fetchResult.body.length - maxBodyLength} chars]`
        : fetchResult.body
      : undefined;

    return {
      statusCode: fetchResult.statusCode,
      responseHeaders: debug.includeHeaders ? { ...fetchResult.headers } : undefined,
      responseBody,
    };
  }

  private buildDiagnostics(
    siteConfig: SiteConfig,
    probeUrl: string,
    requestMethod: RequestMethod,
    followRedirects: boolean,
  ): CheckDiagnostics {
    const detectionMethods = Array.isArray(siteConfig.errorType) ? siteConfig.errorType : [siteConfig.errorType];
    const errorCodes = siteConfig.errorCode
      ? Array.isArray(siteConfig.errorCode)
        ? siteConfig.errorCode
        : [siteConfig.errorCode]
      : undefined;

    return {
      probeUrl,
      requestMethod,
      detectionMethods,
      followRedirects,
      errorCodes,
    };
  }

  /**
   * Abort any running check operations
   */
  abort(): void {
    this.lifecycle?.abort();
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
