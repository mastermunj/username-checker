/**
 * Proxy class - Static methods for proxy configuration and agent creation
 */

import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

/**
 * Supported proxy protocols
 */
type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5';

/**
 * Default Tor proxy configuration
 */
const TOR_PROXY = 'socks5://127.0.0.1:9050';

/**
 * Static class for proxy operations
 */
export class Proxy {
  /**
   * Create a proxy agent from a URL string
   * Supports HTTP(S) and SOCKS proxies
   */
  static createAgent(proxyUrl: string): HttpsProxyAgent<string> | SocksProxyAgent {
    const protocol = this.parseProtocol(proxyUrl);

    if (protocol === 'socks4' || protocol === 'socks5') {
      return new SocksProxyAgent(proxyUrl);
    }
    return new HttpsProxyAgent(proxyUrl);
  }

  /**
   * Create a Tor proxy agent using default Tor SOCKS port
   */
  static createTorAgent(): SocksProxyAgent {
    return new SocksProxyAgent(TOR_PROXY);
  }

  /**
   * Parse proxy URL and extract components
   */
  static parseUrl(proxyUrl: string): {
    protocol: ProxyProtocol;
    host: string;
    port: number;
    auth?: { username: string; password: string };
  } {
    try {
      const url = new URL(proxyUrl);
      const protocol = this.parseProtocol(proxyUrl);

      let port = parseInt(url.port, 10);
      if (isNaN(port)) {
        // Default ports
        port = protocol === 'https' ? 443 : protocol === 'http' ? 8080 : 1080;
      }

      const result: {
        protocol: ProxyProtocol;
        host: string;
        port: number;
        auth?: { username: string; password: string };
      } = {
        protocol,
        host: url.hostname,
        port,
      };

      if (url.username && url.password) {
        result.auth = {
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
        };
      }

      return result;
    } catch {
      throw new Error(`Invalid proxy URL: ${proxyUrl}`);
    }
  }

  /**
   * Parse protocol from URL
   */
  private static parseProtocol(proxyUrl: string): ProxyProtocol {
    const lower = proxyUrl.toLowerCase();
    if (lower.startsWith('socks5://')) {
      return 'socks5';
    }
    if (lower.startsWith('socks4://')) {
      return 'socks4';
    }
    if (lower.startsWith('https://')) {
      return 'https';
    }
    return 'http';
  }

  /**
   * Validate a proxy URL format
   */
  static isValidUrl(proxyUrl: string): boolean {
    try {
      const url = new URL(proxyUrl);
      const protocol = url.protocol.replace(':', '');
      return ['http', 'https', 'socks4', 'socks5'].includes(protocol);
    } catch {
      return false;
    }
  }

  /**
   * Get the default Tor proxy URL
   */
  static get TOR_PROXY(): string {
    return TOR_PROXY;
  }
}
