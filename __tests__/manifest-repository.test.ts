/**
 * Tests for ManifestRepository
 */

import { describe, it, expect } from 'vitest';
import { ManifestRepository, defaultManifestRepository } from '../src/ManifestRepository.js';
import { DetectionMethod } from '../src/types.js';

describe('ManifestRepository', () => {
  it('should create a repository from raw manifest data', () => {
    const repository = ManifestRepository.fromRawData({
      Example: {
        name: 'Example',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com/',
        errorType: ['message', 'status_code'],
        errorMsg: 'missing',
      },
    });

    expect(repository.get('Example')).toEqual(
      expect.objectContaining({
        name: 'Example',
        errorType: [DetectionMethod.MESSAGE, DetectionMethod.STATUS_CODE],
        errorMsg: 'missing',
      }),
    );
  });

  it('should create a repository from site config records and clone them', () => {
    const source = {
      Example: {
        name: 'Example',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com/',
        errorType: DetectionMethod.STATUS_CODE,
        headers: { 'x-test': 'one' },
      },
    };
    const repository = ManifestRepository.fromSiteConfigs(source);

    source.Example.headers!['x-test'] = 'two';

    expect(repository.get('Example')?.headers).toEqual({ 'x-test': 'one' });
  });

  it('should create a repository from site config maps', () => {
    const repository = ManifestRepository.fromSiteConfigs(
      new Map([
        [
          'Example',
          {
            name: 'Example',
            url: 'https://example.com/{}',
            urlMain: 'https://example.com/',
            errorType: DetectionMethod.STATUS_CODE,
          },
        ],
      ]),
    );

    expect(repository.has('example')).toBe(true);
  });

  it('should expose the bundled default repository', () => {
    expect(defaultManifestRepository.has('GitHub')).toBe(true);
    expect(defaultManifestRepository.count()).toBeGreaterThan(200);
  });
});
