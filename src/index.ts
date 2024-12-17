/* eslint-disable @typescript-eslint/no-require-imports */
require('isomorphic-fetch');

import { UsernameCheckerRuleNameEnum, UsernameCheckerServices } from './config';

type UsernameCheckerResponseType = {
  service: keyof typeof UsernameCheckerServices;
  url: string;
  available?: boolean;
  reason?: string;
};

async function fetchData(url: string): Promise<{ response: Response; reason?: string }> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(); // Abort the request if it takes too long
  }, 5000);

  let response;

  try {
    response = await fetch(url, {
      signal: abortController.signal,
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId); // Clear the timeout if the request completes within time
    return { response };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { response: response!, reason: 'Request timed out.' };
    } else if (error.code === 'ECONNABORTED') {
      return { response: response!, reason: 'Connection aborted.' };
    } else {
      return { response: response!, reason: 'An error occurred during the request.' };
    }
  }
}

export class UsernameChecker {
  public async isAvailable<T extends keyof typeof UsernameCheckerServices>(
    service: T,
    username: string,
  ): Promise<UsernameCheckerResponseType> {
    const serviceDetail = this.getServiceDetail(service);

    const result: UsernameCheckerResponseType = {
      service,
      url: serviceDetail.url.replace('{{ username }}', encodeURIComponent(username)),
      available: false,
    };

    const { response, reason } = await fetchData(result.url);

    if (reason) {
      result.reason = reason;
      result.available = undefined;
      return result;
    }

    if (response.status >= 500) {
      result.available = undefined;
      result.reason = `${service} faced internal server error.`;
      return result;
    } else if (response.status >= 400 && ![404, 410, 403].includes(response.status)) {
      result.available = undefined;
      result.reason = `Unknown error occured with ${service}`;
      return result;
    }

    for (const rule of serviceDetail.rules) {
      switch (rule.name) {
        case UsernameCheckerRuleNameEnum.STATUS_404:
          if ([404, 410].includes(response.status)) {
            result.available = true;
          }
          break;
        case UsernameCheckerRuleNameEnum.STATUS_403:
          if ([403].includes(response.status)) {
            result.available = true;
          }
          break;
        case UsernameCheckerRuleNameEnum.REGEX:
          if (rule.matches) {
            const data = await response.text();

            for (const match of rule.matches!) {
              const test = new RegExp(match.replace('USERNAME', username), 'gi').test(data);
              if (test) {
                result.available = true;
                break;
              }
            }
          }
          if (rule.notMatches) {
            const data = await response.text();

            for (const match of rule.notMatches!) {
              const test = new RegExp(match.replace('USERNAME', username), 'gi').test(data);
              if (test) {
                result.available = false;
                return result;
              }
            }

            result.available = true;
            break;
          }
          break;
        case UsernameCheckerRuleNameEnum.URL_NOT_IN_CONTENT:
          try {
            const data = await response.text();

            if (!data.includes(result.url)) {
              result.available = true;
            }
            // eslint-disable-next-line no-empty, @typescript-eslint/no-unused-vars
          } catch (error) {}

          break;
      }
      if (result.available) {
        break;
      }
    }

    if (serviceDetail.publicUrl) {
      result.url = serviceDetail.publicUrl.replace('{{ username }}', encodeURIComponent(username));
    }

    return result;
  }

  public getServiceDetail<T extends keyof typeof UsernameCheckerServices>(
    service: T,
  ): (typeof UsernameCheckerServices)[T] {
    return UsernameCheckerServices[service];
  }

  public getServices(): string[] {
    return Object.keys(UsernameCheckerServices);
  }
}
