/**
 * Detector class - Static methods for detecting username availability
 */

import {
  DetectionMethod,
  ErrorCategory,
  type SiteConfig,
  type FetchResult,
  type AvailabilityStatus,
  type RequestMethod,
} from './types.js';

/**
 * Static class for availability detection operations
 */
export class Detector {
  private static readonly regexCache = new Map<string, RegExp>();

  private static getCompiledRegex(pattern: string): RegExp | null {
    const cached = this.regexCache.get(pattern);
    if (cached) {
      return cached;
    }
    try {
      const regex = new RegExp(pattern);
      this.regexCache.set(pattern, regex);
      return regex;
    } catch {
      return null;
    }
  }

  private static getDetectionMethods(errorType: SiteConfig['errorType']): DetectionMethod[] {
    return Array.isArray(errorType) ? errorType : [errorType];
  }

  private static getErrorCodes(config?: SiteConfig): number[] {
    if (!config?.errorCode) {
      return [];
    }

    return Array.isArray(config.errorCode) ? config.errorCode : [config.errorCode];
  }

  /**
   * Detect username availability based on site configuration and response
   */
  static detect(config: SiteConfig, result: FetchResult, username: string): AvailabilityStatus {
    // If there was a fetch error, return error status
    if (result.errorCategory && result.errorCategory !== ErrorCategory.NONE) {
      return 'error';
    }

    const methods = this.getDetectionMethods(config.errorType);
    let status: AvailabilityStatus | null = null;

    if (methods.includes(DetectionMethod.MESSAGE)) {
      status = this.detectByMessage(result, config, username);
      if (status === 'available' || status === 'error') {
        return status;
      }
    }

    if (methods.includes(DetectionMethod.STATUS_CODE)) {
      status = this.detectByStatusCode(result, config);
      if (status === 'available' || status === 'error') {
        return status;
      }
    }

    if (methods.includes(DetectionMethod.RESPONSE_URL)) {
      return this.detectByResponseUrl(result, config, username);
    }

    return status ?? this.detectByStatusCode(result, config);
  }

  /**
   * Detect by HTTP status code
   * Available if status code indicates "not found" (typically 404)
   */
  private static detectByStatusCode(result: FetchResult, config?: SiteConfig): AvailabilityStatus {
    const { statusCode } = result;
    const errorCodes = this.getErrorCodes(config);

    if (statusCode === 0) {
      return 'unknown';
    }

    if (errorCodes.includes(statusCode)) {
      return 'available';
    }

    if (statusCode === 429) {
      return 'error';
    }

    if (statusCode >= 500) {
      return 'error';
    }

    if (errorCodes.length > 0) {
      return statusCode >= 300 || statusCode < 200 ? 'available' : 'taken';
    }

    // 404 = user not found = available
    if (statusCode === 404) {
      return 'available';
    }

    // 2xx = user found = taken
    if (statusCode >= 200 && statusCode < 300) {
      return 'taken';
    }

    // 3xx = redirect, might need further investigation
    if (statusCode >= 300 && statusCode < 400) {
      return 'taken';
    }

    // 4xx (except 404) = likely taken or rate limited
    if (statusCode >= 400 && statusCode < 500) {
      return 'taken';
    }

    return 'unknown';
  }

  /**
   * Detect by checking for error message in response body
   * Available if error message is found in the response
   */
  private static detectByMessage(result: FetchResult, config: SiteConfig, username: string): AvailabilityStatus {
    const { body, statusCode } = result;
    const { errorMsg } = config;

    // Server errors = report as error
    if (statusCode >= 500) {
      return 'error';
    }
    if (statusCode === 429) {
      return 'error';
    }

    if (!errorMsg) {
      // Fall back to status code detection
      return this.detectByStatusCode(result, config);
    }

    // Check if error message is present
    const messages = Array.isArray(errorMsg) ? errorMsg : [errorMsg];

    for (const msg of messages) {
      // Replace username placeholder and check
      const searchMsg = msg.replace('{}', username);
      if (body.includes(searchMsg)) {
        return 'available';
      }
    }

    // Error message not found = user exists = taken
    return 'taken';
  }

  /**
   * Detect by checking if response URL matches error URL pattern
   * Available if redirected to error URL
   */
  private static detectByResponseUrl(result: FetchResult, config: SiteConfig, username: string): AvailabilityStatus {
    const { finalUrl, headers, statusCode } = result;
    const { errorUrl } = config;

    // Server errors = report as error
    if (statusCode >= 500) {
      return 'error';
    }
    if (statusCode === 429) {
      return 'error';
    }

    if (!errorUrl) {
      // Fall back to status code detection
      return this.detectByStatusCode(result, config);
    }

    // Replace username placeholder in error URL
    const expectedErrorUrl = errorUrl.replace('{}', username);
    const location = headers.location;

    if (statusCode >= 200 && statusCode < 300) {
      return this.matchesResponseUrl(finalUrl, expectedErrorUrl) ? 'available' : 'taken';
    }

    if (location) {
      return 'available';
    }

    if (statusCode >= 300 && statusCode < 500) {
      return 'available';
    }

    return this.matchesResponseUrl(finalUrl, expectedErrorUrl) ? 'available' : 'taken';
  }

  private static matchesResponseUrl(actualUrl: string, expectedErrorUrl: string): boolean {
    // Check if we were redirected to the error URL
    if (actualUrl.includes(expectedErrorUrl) || actualUrl === expectedErrorUrl) {
      return true;
    }

    // Check partial match (some sites use different formats)
    const errorWithoutProtocol = expectedErrorUrl.replace(/^https?:\/\//, '');
    const finalWithoutProtocol = actualUrl.replace(/^https?:\/\//, '');
    const errorUrlParts = errorWithoutProtocol.split('/').filter(Boolean);

    // If error URL is a substring pattern
    if (errorUrlParts.some((part) => actualUrl.includes(part) && part.length > 5)) {
      // More specific check needed
      if (finalWithoutProtocol.startsWith(errorWithoutProtocol)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build the URL to check for a username
   */
  static buildUrl(config: SiteConfig, username: string): string {
    const { url, urlProbe } = config;
    const targetUrl = urlProbe || url;
    return targetUrl.replace('{}', username);
  }

  /**
   * Build the profile URL (for reporting to user)
   */
  static buildProfileUrl(config: SiteConfig, username: string): string {
    return config.url.replace('{}', username);
  }

  /**
   * Determine whether redirects should be followed for this site
   */
  static shouldFollowRedirects(config: SiteConfig): boolean {
    return !this.getDetectionMethods(config.errorType).includes(DetectionMethod.RESPONSE_URL);
  }

  /**
   * Build request payload if needed (for POST requests)
   */
  static buildPayload(config: SiteConfig, username: string): object | undefined {
    const { requestPayload } = config;

    if (!requestPayload) {
      return undefined;
    }

    // Deep clone and replace username placeholders
    const payload = structuredClone(requestPayload);
    this.replaceUsernameInObject(payload, username);

    return payload;
  }

  /**
   * Recursively replace username placeholders in an object
   */
  private static replaceUsernameInObject(obj: Record<string, unknown>, username: string): void {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = (obj[key] as string).replace('{}', username);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.replaceUsernameInObject(obj[key] as Record<string, unknown>, username);
      }
    }
  }

  /**
   * Get the HTTP method for a site request
   */
  static getMethod(config: SiteConfig): RequestMethod {
    if (config.requestMethod) {
      return config.requestMethod;
    }

    const methods = this.getDetectionMethods(config.errorType);
    return methods.length === 1 && methods[0] === DetectionMethod.STATUS_CODE ? 'HEAD' : 'GET';
  }

  /**
   * Get merged headers for a site request
   */
  static getHeaders(config: SiteConfig, baseHeaders: Record<string, string> = {}): Record<string, string> {
    return { ...baseHeaders, ...config.headers };
  }

  /**
   * Check if username matches site's regex requirement
   */
  static matchesRegex(config: SiteConfig, username: string): boolean {
    if (!config.regexCheck) {
      return true;
    }

    const regex = this.getCompiledRegex(config.regexCheck);
    return regex ? regex.test(username) : true;
  }
}
