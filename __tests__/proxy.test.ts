/**
 * Tests for Proxy class
 */

import { describe, it, expect } from 'vitest';
import { Proxy } from '../src/Proxy.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

describe('Proxy', () => {
  describe('createAgent()', () => {
    it('should create HTTP proxy agent', () => {
      const agent = Proxy.createAgent('http://127.0.0.1:8080');
      expect(agent).toBeInstanceOf(HttpsProxyAgent);
    });

    it('should create HTTPS proxy agent', () => {
      const agent = Proxy.createAgent('https://127.0.0.1:8080');
      expect(agent).toBeInstanceOf(HttpsProxyAgent);
    });

    it('should create SOCKS5 proxy agent', () => {
      const agent = Proxy.createAgent('socks5://127.0.0.1:9050');
      expect(agent).toBeInstanceOf(SocksProxyAgent);
    });

    it('should create SOCKS4 proxy agent', () => {
      const agent = Proxy.createAgent('socks4://127.0.0.1:1080');
      expect(agent).toBeInstanceOf(SocksProxyAgent);
    });
  });

  describe('createTorAgent()', () => {
    it('should create SOCKS proxy agent for Tor', () => {
      const agent = Proxy.createTorAgent();
      expect(agent).toBeInstanceOf(SocksProxyAgent);
    });
  });

  describe('parseUrl()', () => {
    it('should parse HTTP proxy URL', () => {
      const result = Proxy.parseUrl('http://127.0.0.1:8080');
      expect(result.protocol).toBe('http');
      expect(result.host).toBe('127.0.0.1');
      expect(result.port).toBe(8080);
      expect(result.auth).toBeUndefined();
    });

    it('should parse SOCKS5 proxy URL with auth', () => {
      const result = Proxy.parseUrl('socks5://user:pass@127.0.0.1:1080');
      expect(result.protocol).toBe('socks5');
      expect(result.host).toBe('127.0.0.1');
      expect(result.port).toBe(1080);
      expect(result.auth).toEqual({ username: 'user', password: 'pass' });
    });

    it('should use default port when not specified', () => {
      const httpResult = Proxy.parseUrl('http://127.0.0.1');
      expect(httpResult.port).toBe(8080);

      const httpsResult = Proxy.parseUrl('https://127.0.0.1');
      expect(httpsResult.port).toBe(443);

      const socksResult = Proxy.parseUrl('socks5://127.0.0.1');
      expect(socksResult.port).toBe(1080);
    });

    it('should throw for invalid URL', () => {
      expect(() => Proxy.parseUrl('not-a-valid-url')).toThrow('Invalid proxy URL');
    });

    it('should decode URL-encoded auth credentials', () => {
      const result = Proxy.parseUrl('http://user%40name:pass%3Dword@127.0.0.1:8080');
      expect(result.auth?.username).toBe('user@name');
      expect(result.auth?.password).toBe('pass=word');
    });
  });

  describe('isValidUrl()', () => {
    it('should return true for valid HTTP proxy URL', () => {
      expect(Proxy.isValidUrl('http://127.0.0.1:8080')).toBe(true);
    });

    it('should return true for valid HTTPS proxy URL', () => {
      expect(Proxy.isValidUrl('https://proxy.example.com:443')).toBe(true);
    });

    it('should return true for valid SOCKS proxy URLs', () => {
      expect(Proxy.isValidUrl('socks4://127.0.0.1:1080')).toBe(true);
      expect(Proxy.isValidUrl('socks5://127.0.0.1:9050')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(Proxy.isValidUrl('not-a-url')).toBe(false);
      expect(Proxy.isValidUrl('ftp://invalid.protocol')).toBe(false);
    });
  });

  describe('TOR_PROXY', () => {
    it('should return default Tor proxy URL', () => {
      expect(Proxy.TOR_PROXY).toBe('socks5://127.0.0.1:9050');
    });
  });
});
