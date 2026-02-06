/**
 * Tests for CLI helper functions and main()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatJson, formatCsv, formatText, printProgress, main } from '../src/cli.js';
import { ErrorCategory } from '../src/types.js';
import type { CheckResult, CheckProgress } from '../src/types.js';

// Mock chalk to avoid ANSI codes in tests
vi.mock('chalk', () => ({
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    gray: (s: string) => s,
    blue: (s: string) => s,
    bold: (s: string) => s,
  },
}));

// Use vi.hoisted to create mock functions that can be used in vi.mock
const { mockCheck, mockAbort, MockUsernameChecker, mockWriteFileSync } = vi.hoisted(() => {
  const mockCheck = vi.fn();
  const mockAbort = vi.fn();
  const MockUsernameChecker = vi.fn(function (this: { check: typeof mockCheck; abort: typeof mockAbort }) {
    this.check = mockCheck;
    this.abort = mockAbort;
  });
  const mockWriteFileSync = vi.fn();
  return { mockCheck, mockAbort, MockUsernameChecker, mockWriteFileSync };
});

vi.mock('../src/UsernameChecker.js', () => ({
  UsernameChecker: MockUsernameChecker,
}));

vi.mock('fs', () => ({
  writeFileSync: mockWriteFileSync,
}));

describe('CLI formatters', () => {
  const sampleResults: CheckResult[] = [
    {
      site: 'GitHub',
      siteName: 'GitHub',
      url: 'https://github.com/testuser',
      status: 'available',
      responseTime: 100,
      httpStatus: 404,
      errorCategory: ErrorCategory.NONE,
    },
    {
      site: 'Twitter',
      siteName: 'Twitter',
      url: 'https://twitter.com/testuser',
      status: 'taken',
      responseTime: 150,
      httpStatus: 200,
      errorCategory: ErrorCategory.NONE,
    },
    {
      site: 'Reddit',
      siteName: 'Reddit',
      url: 'https://reddit.com/user/testuser',
      status: 'error',
      responseTime: 0,
      errorCategory: ErrorCategory.CONNECTION_ERROR,
      errorMessage: 'Connection refused',
    },
  ];

  describe('formatJson()', () => {
    it('should format results as JSON', () => {
      const output = formatJson(sampleResults);
      const parsed = JSON.parse(output);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].site).toBe('GitHub');
      expect(parsed[0].status).toBe('available');
      expect(parsed[1].site).toBe('Twitter');
      expect(parsed[1].status).toBe('taken');
      expect(parsed[2].site).toBe('Reddit');
      expect(parsed[2].status).toBe('error');
    });

    it('should handle empty results', () => {
      const output = formatJson([]);
      expect(output).toBe('[]');
    });
  });

  describe('formatCsv()', () => {
    it('should format results as CSV', () => {
      const output = formatCsv(sampleResults);
      const lines = output.split('\n');

      expect(lines[0]).toBe('site,siteName,url,status,responseTime,httpStatus,errorCategory,errorMessage');
      expect(lines).toHaveLength(4); // header + 3 rows
      expect(lines[1]).toContain('GitHub');
      expect(lines[2]).toContain('Twitter');
      expect(lines[3]).toContain('Reddit');
    });

    it('should escape quotes in CSV values', () => {
      const resultsWithQuotes: CheckResult[] = [
        {
          site: 'Test',
          siteName: 'Test "Site"',
          url: 'https://example.com',
          status: 'available',
          responseTime: 100,
          errorCategory: ErrorCategory.NONE,
        },
      ];
      const output = formatCsv(resultsWithQuotes);
      expect(output).toContain('Test ""Site""');
    });

    it('should handle empty results', () => {
      const output = formatCsv([]);
      const lines = output.split('\n');
      expect(lines).toHaveLength(1); // header only
    });
  });

  describe('formatText()', () => {
    it('should format results as text', () => {
      const output = formatText(sampleResults);

      expect(output).toContain('AVAILABLE:');
      expect(output).toContain('GitHub: https://github.com/testuser');
      expect(output).toContain('TAKEN:');
      expect(output).toContain('Twitter: https://twitter.com/testuser');
      expect(output).toContain('ERRORS:');
      expect(output).toContain('Reddit: Connection refused');
    });

    it('should handle only available results', () => {
      const availableOnly: CheckResult[] = [
        {
          site: 'GitHub',
          siteName: 'GitHub',
          url: 'https://github.com/testuser',
          status: 'available',
          responseTime: 100,
          errorCategory: ErrorCategory.NONE,
        },
      ];
      const output = formatText(availableOnly);

      expect(output).toContain('AVAILABLE:');
      expect(output).not.toContain('TAKEN:');
      expect(output).not.toContain('ERRORS:');
    });

    it('should handle only taken results', () => {
      const takenOnly: CheckResult[] = [
        {
          site: 'Twitter',
          siteName: 'Twitter',
          url: 'https://twitter.com/testuser',
          status: 'taken',
          responseTime: 150,
          errorCategory: ErrorCategory.NONE,
        },
      ];
      const output = formatText(takenOnly);

      expect(output).not.toContain('AVAILABLE:');
      expect(output).toContain('TAKEN:');
      expect(output).not.toContain('ERRORS:');
    });

    it('should handle unknown status as errors', () => {
      const unknownResults: CheckResult[] = [
        {
          site: 'Unknown',
          siteName: 'Unknown Site',
          url: 'https://unknown.com/testuser',
          status: 'unknown',
          responseTime: 0,
          errorCategory: ErrorCategory.UNKNOWN,
        },
      ];
      const output = formatText(unknownResults);

      expect(output).toContain('ERRORS:');
      expect(output).toContain('Unknown Site: unknown');
    });

    it('should handle empty results', () => {
      const output = formatText([]);
      expect(output).toBe('');
    });
  });
});

describe('printProgress()', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should print progress when verbose is true', () => {
    const progress: CheckProgress = {
      total: 100,
      completed: 50,
      available: 10,
      taken: 30,
      errors: 10,
      percentage: 50,
      currentSite: 'GitHub',
    };

    printProgress(progress, true);

    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(output).toContain('50/100');
    expect(output).toContain('50%');
    expect(output).toContain('10'); // available
    expect(output).toContain('30'); // taken
    expect(output).toContain('GitHub');
  });

  it('should not print when verbose is false', () => {
    const progress: CheckProgress = {
      total: 100,
      completed: 50,
      available: 10,
      taken: 30,
      errors: 10,
      percentage: 50,
      currentSite: 'GitHub',
    };

    printProgress(progress, false);

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should handle missing currentSite', () => {
    const progress: CheckProgress = {
      total: 100,
      completed: 50,
      available: 10,
      taken: 30,
      errors: 10,
      percentage: 50,
    };

    printProgress(progress, true);

    // Called twice: once for main progress, once for empty string (no currentSite)
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });
});

describe('main()', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  const sampleResults: CheckResult[] = [
    {
      site: 'GitHub',
      siteName: 'GitHub',
      url: 'https://github.com/testuser',
      status: 'available',
      responseTime: 100,
      httpStatus: 404,
      errorCategory: ErrorCategory.NONE,
    },
    {
      site: 'Twitter',
      siteName: 'Twitter',
      url: 'https://twitter.com/testuser',
      status: 'taken',
      responseTime: 150,
      httpStatus: 200,
      errorCategory: ErrorCategory.NONE,
    },
  ];

  beforeEach(() => {
    originalArgv = process.argv;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    mockCheck.mockReset();
    mockAbort.mockReset();
    MockUsernameChecker.mockClear();
    mockWriteFileSync.mockReset();
    // Remove all SIGINT listeners added by previous tests
    process.removeAllListeners('SIGINT');
  });

  afterEach(() => {
    process.argv = originalArgv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    // Clean up any SIGINT listeners
    process.removeAllListeners('SIGINT');
  });

  it('should check username with default options', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub,Twitter'];

    await main();

    expect(mockCheck).toHaveBeenCalledWith(
      'testuser',
      expect.objectContaining({
        sites: ['GitHub', 'Twitter'],
        includeNSFW: false,
      }),
    );
    // Default output goes to {username}.txt
    expect(mockWriteFileSync).toHaveBeenCalledWith('testuser.txt', expect.any(String), 'utf-8');
  });

  it('should output JSON to file with --json', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '--json', 'output.json'];

    await main();

    expect(mockWriteFileSync).toHaveBeenCalledWith('output.json', expect.any(String), 'utf-8');
    const jsonOutput = mockWriteFileSync.mock.calls.find((c: string[]) => c[0] === 'output.json')?.[1];
    const parsed = JSON.parse(jsonOutput);
    expect(parsed).toHaveLength(2);
  });

  it('should output CSV to file with --csv', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '--csv', 'output.csv'];

    await main();

    expect(mockWriteFileSync).toHaveBeenCalledWith('output.csv', expect.any(String), 'utf-8');
    const csvOutput = mockWriteFileSync.mock.calls.find((c: string[]) => c[0] === 'output.csv')?.[1];
    expect(csvOutput).toContain('site,siteName');
    expect(csvOutput).toContain('GitHub');
  });

  it('should filter available-only results', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '--available-only', '--json', 'filtered.json'];

    await main();

    const jsonOutput = mockWriteFileSync.mock.calls.find((c: string[]) => c[0] === 'filtered.json')?.[1];
    const parsed = JSON.parse(jsonOutput);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].status).toBe('available');
  });

  it('should filter taken-only results', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '--taken-only', '--json', 'taken.json'];

    await main();

    const jsonOutput = mockWriteFileSync.mock.calls.find((c: string[]) => c[0] === 'taken.json')?.[1];
    const parsed = JSON.parse(jsonOutput);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].status).toBe('taken');
  });

  it('should output to custom file with -o option', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '-o', 'custom.txt'];

    await main();

    expect(mockWriteFileSync).toHaveBeenCalledWith('custom.txt', expect.any(String), 'utf-8');
  });

  it('should show verbose output', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '-v'];

    await main();

    // Verbose mode prints to stderr
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(errorOutput).toContain('Checking username');
    expect(errorOutput).toContain('Summary');
  });

  it('should call onProgress callback in verbose mode', async () => {
    // Mock check to call onProgress
    mockCheck.mockImplementation(async (_username: string, options: { onProgress?: (p: CheckProgress) => void }) => {
      if (options.onProgress) {
        options.onProgress({
          total: 1,
          completed: 1,
          available: 1,
          taken: 0,
          errors: 0,
          percentage: 100,
          currentSite: 'GitHub',
        });
      }
      return sampleResults;
    });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '-v'];

    await main();

    // onProgress should have been called and printed to stderr
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it('should handle SIGINT signal', async () => {
    // Set up a check that resolves after a delay to allow SIGINT
    let resolveCheck: (results: CheckResult[]) => void;
    mockCheck.mockImplementation(
      () =>
        new Promise<CheckResult[]>((resolve) => {
          resolveCheck = resolve;
        }),
    );

    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '-v'];

    // Start main but don't await - this will set up the SIGINT handler
    const mainPromise = main();

    // Wait for SIGINT listener to be registered
    await new Promise((r) => setImmediate(r));

    // We need to temporarily replace process.exit to not throw for this test
    processExitSpy.mockRestore();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    // Emit SIGINT - this will call process.exit(130)
    process.emit('SIGINT');

    // Verify exit code and abort were called
    expect(exitSpy).toHaveBeenCalledWith(130);
    expect(mockAbort).toHaveBeenCalled();

    // Resolve check to let main complete
    resolveCheck!(sampleResults);
    await mainPromise;

    exitSpy.mockRestore();
  });

  it('should handle errors and exit with code 1', async () => {
    mockCheck.mockRejectedValue(new Error('Check failed'));
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub'];

    await expect(main()).rejects.toThrow('process.exit(1)');

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should pass timeout option', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '-t', '5000'];

    await main();

    expect(MockUsernameChecker).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 5000,
      }),
    );
  });

  it('should pass concurrency option', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '-c', '10'];

    await main();

    expect(MockUsernameChecker).toHaveBeenCalledWith(
      expect.objectContaining({
        maxConcurrency: 10,
      }),
    );
  });

  it('should pass retries option', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '-r', '3'];

    await main();

    expect(MockUsernameChecker).toHaveBeenCalledWith(
      expect.objectContaining({
        retries: 3,
      }),
    );
  });

  it('should pass nsfw option', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '--nsfw'];

    await main();

    expect(mockCheck).toHaveBeenCalledWith(
      'testuser',
      expect.objectContaining({
        includeNSFW: true,
      }),
    );
  });

  it('should pass tor option', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '--tor'];

    await main();

    expect(MockUsernameChecker).toHaveBeenCalledWith(
      expect.objectContaining({
        useTor: true,
      }),
    );
  });

  it('should pass proxy option', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser', '-s', 'GitHub', '--proxy', 'http://localhost:8080'];

    await main();

    expect(MockUsernameChecker).toHaveBeenCalledWith(
      expect.objectContaining({
        proxy: 'http://localhost:8080',
      }),
    );
  });

  it('should check all sites when none specified', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser'];

    await main();

    expect(mockCheck).toHaveBeenCalledWith(
      'testuser',
      expect.objectContaining({
        sites: undefined,
      }),
    );
  });
});
