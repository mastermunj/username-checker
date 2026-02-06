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

/**
 * HTTP request methods
 */
export type RequestMethod = 'GET' | 'POST' | 'HEAD';

/**
 * Error categories for username check results
 */
export enum ErrorCategory {
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  SERVER_ERROR = 'server_error',
  CONNECTION_ERROR = 'connection_error',
  UNKNOWN = 'unknown',
  NONE = 'none',
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
  errorType: DetectionMethod;
  errorMsg?: string | string[];
  errorUrl?: string;
  regexCheck?: string;
  requestMethod?: RequestMethod;
  requestPayload?: Record<string, unknown>;
  headers?: Record<string, string>;
  isNSFW?: boolean;
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
  useTor?: boolean;
  proxy?: string;
  sites?: string[];
  onProgress?: (progress: CheckProgress) => void;
  signal?: AbortSignal;
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
  includeKeys?: string[];
}
