/**
 * Type definitions for username-checker
 * Inspired by Sherlock Project (https://github.com/sherlock-project/sherlock)
 */

/**
 * Detection method types
 */
export enum DetectionMethod {
  STATUS_CODE = 'status_code',
  MESSAGE = 'message',
  RESPONSE_URL = 'response_url',
}

export type DetectionStrategy = DetectionMethod | DetectionMethod[];

/**
 * HTTP request methods
 */
export type RequestMethod = 'GET' | 'POST' | 'HEAD' | 'PUT';

/**
 * Error categories for username check results
 */
export enum ErrorCategory {
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  BLOCKED = 'blocked',
  SERVER_ERROR = 'server_error',
  CONNECTION_ERROR = 'connection_error',
  UNKNOWN = 'unknown',
  NONE = 'none',
}

export interface CheckDiagnostics {
  probeUrl: string;
  requestMethod: RequestMethod;
  detectionMethods: DetectionMethod[];
  followRedirects: boolean;
  finalUrl?: string;
  errorCodes?: number[];
}

export interface CheckDebugData {
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

export interface DebugOptions {
  includeBody?: boolean;
  includeHeaders?: boolean;
  maxBodyLength?: number;
}

/**
 * Availability status for a username check
 */
export type AvailabilityStatus = 'available' | 'taken' | 'error' | 'unknown' | 'invalid';

/**
 * Site configuration schema (Sherlock-compatible)
 */
export interface SiteConfig {
  name: string;
  url: string;
  urlMain: string;
  urlProbe?: string;
  errorType: DetectionStrategy;
  errorMsg?: string | string[];
  errorCode?: number | number[];
  errorUrl?: string;
  responseUrl?: string;
  regexCheck?: string;
  requestMethod?: RequestMethod;
  requestPayload?: Record<string, unknown>;
  headers?: Record<string, string>;
  isNSFW?: boolean;
  isExcluded?: boolean;
  usernameClaimed?: string;
}

/**
 * Result of checking a single site
 */
export interface CheckResult {
  site: string;
  siteName: string;
  url: string;
  status: AvailabilityStatus;
  httpStatus?: number;
  responseTime: number;
  errorCategory: ErrorCategory;
  errorMessage?: string;
  diagnostics?: CheckDiagnostics;
  debug?: CheckDebugData;
}

/**
 * Progress information during check
 */
export interface CheckProgress {
  total: number;
  completed: number;
  available: number;
  taken: number;
  errors: number;
  currentSite?: string;
  percentage: number;
}

/**
 * Validation result for username
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedUsername: string;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

/**
 * Concurrency options
 */
export interface ConcurrencyOptions {
  maxConcurrency: number;
  domainDelay?: number;
  timeout?: number;
}

/**
 * Check options for UsernameChecker
 */
export interface CheckOptions {
  timeout?: number;
  maxConcurrency?: number;
  retries?: number;
  includeNSFW?: boolean;
  includeExcluded?: boolean;
  useTor?: boolean;
  proxy?: string;
  cache?: CacheOptions | false;
  repository?: SiteRepository;
  sites?: string[];
  onProgress?: (progress: CheckProgress) => void;
  signal?: AbortSignal;
  debug?: DebugOptions;
}

/**
 * Fetch result from Fetcher
 */
export interface FetchResult {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  finalUrl: string;
  errorCategory: ErrorCategory | string;
  errorMessage?: string;
}

/**
 * Site filter options
 */
export interface SiteFilterOptions {
  includeNSFW?: boolean;
  includeExcluded?: boolean;
  includeKeys?: string[];
}

export interface SiteEntry {
  key: string;
  config: SiteConfig;
}

export interface SiteResolutionResult {
  resolvedKeys: string[];
  missing: Array<{ input: string; suggestions: string[] }>;
}

export interface SiteRepository {
  resolveKey(key: string): string | undefined;
  suggestKeys(key: string, limit?: number): string[];
  resolveKeys(keys: string[]): SiteResolutionResult;
  get(key: string): SiteConfig | undefined;
  filter(options?: SiteFilterOptions): SiteEntry[];
  count(options?: Pick<SiteFilterOptions, 'includeExcluded'>): number;
  has(key: string): boolean;
}

/**
 * Batch check result for a single username
 */
export interface BatchCheckResult {
  username: string;
  normalizedUsername: string;
  results: CheckResult[];
  summary: {
    total: number;
    available: number;
    taken: number;
    errors: number;
  };
}

/**
 * Batch check progress information
 */
export interface BatchCheckProgress {
  currentUsername: string;
  currentUsernameIndex: number;
  totalUsernames: number;
  usernamePercentage: number;
  totalPercentage: number;
  siteProgress?: CheckProgress;
}

/**
 * Batch check options
 */
export interface BatchCheckOptions extends Pick<
  CheckOptions,
  'sites' | 'includeNSFW' | 'includeExcluded' | 'signal' | 'debug' | 'onProgress'
> {
  onBatchProgress?: (progress: BatchCheckProgress) => void;
}

/**
 * Cache options
 */
export interface CacheOptions {
  type?: 'memory' | 'file' | 'hybrid';
  ttl?: number; // Time to live in milliseconds
  dir?: string; // Directory for file-based cache
  maxSize?: number; // Maximum number of entries in cache
}

/**
 * Cached check result
 */
export interface CachedCheckResult {
  result: CheckResult;
  timestamp: number;
}

/**
 * Configuration options
 */
export interface ConfigOptions {
  timeout?: number;
  maxConcurrency?: number;
  retries?: number;
  includeNSFW?: boolean;
  includeExcluded?: boolean;
  useTor?: boolean;
  proxy?: string;
  cache?: CacheOptions;
  format?: string;
  defaultSites?: string[];
}
