import axios, { AxiosError, AxiosResponse } from 'axios';
import { UsernameCheckerRuleNameEnum, UsernameCheckerServices } from './config';
import https from 'https';

type UsernameCheckerResponseType = {
  service: keyof typeof UsernameCheckerServices;
  url: string;
  available?: boolean;
  reason?: string;
};

export default class UsernameChecker {
  public async isAvailable<T extends keyof typeof UsernameCheckerServices>(
    service: T,
    username: string,
  ): Promise<UsernameCheckerResponseType> {
    const serviceDetail = this.getServiceDetail(service);

    const result: UsernameCheckerResponseType = {
      service,
      url: serviceDetail.url.replace('{{ username }}', username),
      available: false,
    };

    let response: AxiosResponse;
    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
      response = await axios.get(result.url, {
        httpsAgent,
        timeout: 5000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
        },
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.code === 'ECONNABORTED') {
          result.available = undefined;
          result.reason = `Unable to connect to ${service}`;
          return result;
        } else if (error.response?.status) {
          if (error.response.status >= 500) {
            result.available = undefined;
            result.reason = `${service} faced internal server error.`;
            return result;
          } else if (error.response.status >= 400 && ![404, 410].includes(error.response.status)) {
            result.available = undefined;
            result.reason = `Unknown error occured with ${service}`;
            return result;
          }
        }
      }
      response = (error as AxiosError).response as AxiosResponse;
    }

    for (const rule of serviceDetail.rules) {
      switch (rule.name) {
        case UsernameCheckerRuleNameEnum.STATUS_404:
          if ([404, 410].includes(response.status)) {
            result.available = true;
          }
          break;
        case UsernameCheckerRuleNameEnum.AVAILABLE:
          if (rule.matches) {
            let data = response.data;
            if (response.headers['content-type']?.toString().includes('application/json')) {
              data = JSON.stringify(data);
            }
            for (const match of rule.matches) {
              const test = new RegExp(match, 'gi').test(data);
              if (test) {
                result.available = true;
                break;
              }
            }
          }
          break;
      }
      if (result.available) {
        break;
      }
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
