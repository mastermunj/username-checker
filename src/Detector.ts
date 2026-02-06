/**
 * Detector class - Static methods for detecting username availability
 */

import { DetectionMethod, ErrorCategory, type SiteConfig, type FetchResult, type AvailabilityStatus } from './types.js';

/**
 * Static class for availability detection operations
 */
export class Detector {
  /**
   * Detect username availability based on site configuration and response
   */
  static detect(config: SiteConfig, result: FetchResult, username: string): AvailabilityStatus {
    // If there was a fetch error, return error status
    if (result.errorCategory && result.errorCategory !== ErrorCategory.NONE) {
      return 'error';
    }

    const { errorType } = config;

    switch (errorType) {
      case DetectionMethod.STATUS_CODE:
        return this.detectByStatusCode(result);

      case DetectionMethod.MESSAGE:
        return this.detectByMessage(result, config, username);

      case DetectionMethod.RESPONSE_URL:
        return this.detectByResponseUrl(result, config, username);

      default:
        // Default to status code detection
        return this.detectByStatusCode(result);
    }
  }

  /**
   * Detect by HTTP status code
   * Available if status code indicates "not found" (typically 404)
   */
  private static detectByStatusCode(result: FetchResult): AvailabilityStatus {
    const { statusCode } = result;

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
    if (statusCode === 429) {
      return 'error';
    }
    if (statusCode >= 400 && statusCode < 500) {
      return 'taken';
    }

    // 5xx = server error
    if (statusCode >= 500) {
      return 'error';
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
      return this.detectByStatusCode(result);
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
    const { finalUrl, statusCode } = result;
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
      return this.detectByStatusCode(result);
    }

    // Replace username placeholder in error URL
    const expectedErrorUrl = errorUrl.replace('{}', username);

    // Check if we were redirected to the error URL
    if (finalUrl.includes(expectedErrorUrl) || finalUrl === expectedErrorUrl) {
      return 'available';
    }

    // Check partial match (some sites use different formats)
    const errorUrlParts = expectedErrorUrl.split('/').filter(Boolean);

    // If error URL is a substring pattern
    if (errorUrlParts.some((part) => finalUrl.includes(part) && part.length > 5)) {
      // More specific check needed
      const errorWithoutProtocol = expectedErrorUrl.replace(/^https?:\/\//, '');
      const finalWithoutProtocol = finalUrl.replace(/^https?:\/\//, '');

      if (finalWithoutProtocol.startsWith(errorWithoutProtocol)) {
        return 'available';
      }
    }

    // Not redirected to error URL = user exists = taken
    return 'taken';
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
   * Build request payload if needed (for POST requests)
   */
  static buildPayload(config: SiteConfig, username: string): object | undefined {
    const { requestPayload } = config;

    if (!requestPayload) {
      return undefined;
    }

    // Deep clone and replace username placeholders
    const payload = JSON.parse(JSON.stringify(requestPayload));
    this.replaceUsernameInObject(payload, username);

    return payload;
  }

  /**
   * Recursively replace username placeholders in an object
   */
  private static replaceUsernameInObject(obj: Record<string, unknown>, username: string): void {
    for (const key in obj) {
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
  static getMethod(config: SiteConfig): 'GET' | 'POST' {
    return config.requestMethod === 'POST' ? 'POST' : 'GET';
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

    try {
      const regex = new RegExp(config.regexCheck);
      return regex.test(username);
    } catch {
      // Invalid regex, assume it matches
      return true;
    }
  }
}
