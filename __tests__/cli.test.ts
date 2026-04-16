/**
 * Tests for CLI helper functions and main()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildAdditionalOutputWrites,
  buildDebugOptions,
  buildOutputBasenames,
  buildPrimaryOutputWrites,
  ensureParentDirectory,
  filterResults,
  formatCsv,
  formatCsvReport,
  formatDebugReport,
  formatJson,
  formatJsonReport,
  formatReport,
  formatSingleReport,
  formatText,
  formatTextReport,
  getOutputExtension,
  main,
  parseCliOptions,
  parseNumericOption,
  parseOutputFormat,
  printProgress,
  runCliExecution,
  sanitizeOutputBasename,
  summarizeReports,
  type UsernameReport,
} from '../src/cli.js';
import { DetectionMethod, ErrorCategory } from '../src/types.js';
import type { CheckResult, CheckProgress } from '../src/types.js';
import { UsernameChecker } from '../src/UsernameChecker.js';
import { ConfigLoader } from '../src/ConfigLoader.js';

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

const {
  mockCheck,
  mockAbort,
  MockUsernameChecker,
  mockWriteFileSync,
  mockMkdirSync,
  mockExistsSync,
  mockReadFileSync,
} = vi.hoisted(() => {
  const mockCheck = vi.fn<(username: string, options?: Record<string, unknown>) => Promise<CheckResult[]>>();
  const mockAbort = vi.fn<() => void>();
  const MockUsernameChecker = vi.fn<(this: { check: typeof mockCheck; abort: typeof mockAbort }) => void>(
    function (this: { check: typeof mockCheck; abort: typeof mockAbort }) {
      this.check = mockCheck;
      this.abort = mockAbort;
    },
  );
  const mockWriteFileSync = vi.fn<(filePath: string, content: string, encoding: string) => void>();
  const mockMkdirSync = vi.fn<(path: string, options: { recursive: boolean }) => void>();
  const mockExistsSync = vi.fn<(path: string) => boolean>(() => false);
  const mockReadFileSync = vi.fn<(path: string, encoding: string) => string>(() => '');
  return {
    mockCheck,
    mockAbort,
    MockUsernameChecker,
    mockWriteFileSync,
    mockMkdirSync,
    mockExistsSync,
    mockReadFileSync,
  };
});

vi.mock('../src/UsernameChecker.js', () => ({
  UsernameChecker: MockUsernameChecker,
}));

vi.mock('node:fs', () => ({
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

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

const secondaryResults: CheckResult[] = [
  {
    site: 'GitLab',
    siteName: 'GitLab',
    url: 'https://gitlab.com/testuser',
    status: 'available',
    responseTime: 90,
    httpStatus: 404,
    errorCategory: ErrorCategory.NONE,
  },
];

const sampleReports: UsernameReport[] = [
  { username: 'alice', results: sampleResults },
  { username: 'bob', results: secondaryResults },
];

const getMockOutput = (call: unknown[]): string => String(call[0]);

describe('CLI formatters', () => {
  describe('formatJson()', () => {
    it('should format results as JSON', () => {
      const output = formatJson(sampleResults);
      const parsed = JSON.parse(output);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].site).toBe('GitHub');
      expect(parsed[1].status).toBe('taken');
    });

    it('should handle empty results', () => {
      expect(formatJson([])).toBe('[]');
    });
  });

  describe('formatJsonReport()', () => {
    it('should keep single-user json compatible', () => {
      const parsed = JSON.parse(formatJsonReport([sampleReports[0]]));
      expect(parsed).toEqual(sampleResults);
    });

    it('should aggregate multiple usernames in json output', () => {
      const parsed = JSON.parse(formatJsonReport(sampleReports));
      expect(parsed).toHaveLength(2);
      expect(parsed[0].username).toBe('alice');
      expect(parsed[1].results[0].site).toBe('GitLab');
    });
  });

  describe('formatCsv()', () => {
    it('should format results as CSV', () => {
      const output = formatCsv(sampleResults);
      const lines = output.split('\n');

      expect(lines[0]).toBe('site,siteName,url,status,responseTime,httpStatus,errorCategory,errorMessage');
      expect(lines).toHaveLength(4);
    });

    it('should escape quotes in CSV values', () => {
      const output = formatCsv([
        {
          site: 'Test',
          siteName: 'Test "Site"',
          url: 'https://example.com',
          status: 'available',
          responseTime: 100,
          errorCategory: ErrorCategory.NONE,
        },
      ]);

      expect(output).toContain('Test ""Site""');
    });
  });

  describe('formatCsvReport()', () => {
    it('should keep single-user csv compatible', () => {
      expect(formatCsvReport([sampleReports[0]])).toBe(formatCsv(sampleResults));
    });

    it('should add a username column for aggregate csv output', () => {
      const output = formatCsvReport(sampleReports);
      const lines = output.split('\n');

      expect(lines[0]).toContain('username,site,siteName');
      expect(lines[1]).toContain('"alice"');
      expect(lines.at(-1)).toContain('"bob"');
    });
  });

  describe('formatText()', () => {
    it('should format results as text', () => {
      const output = formatText(sampleResults);

      expect(output).toContain('AVAILABLE:');
      expect(output).toContain('GitHub: https://github.com/testuser');
      expect(output).toContain('TAKEN:');
      expect(output).toContain('ERRORS:');
    });

    it('should include invalid results and diagnostics in the error section', () => {
      const output = formatText([
        {
          site: 'GitHub',
          siteName: 'GitHub',
          url: 'https://github.com/@alias',
          status: 'invalid',
          responseTime: 0,
          errorCategory: ErrorCategory.NONE,
          errorMessage: 'Username does not match site requirements',
          diagnostics: {
            probeUrl: 'https://github.com/@alias',
            requestMethod: 'HEAD',
            detectionMethods: [DetectionMethod.STATUS_CODE],
            followRedirects: true,
          },
        },
      ]);

      expect(output).toContain('HEAD https://github.com/@alias');
      expect(output).toContain('detection=status_code');
    });

    it('should describe manual redirect diagnostics in text output', () => {
      const output = formatText([
        {
          site: 'BOOTH',
          siteName: 'BOOTH',
          url: 'https://booth.pm/testuser',
          status: 'invalid',
          responseTime: 0,
          errorCategory: ErrorCategory.NONE,
          errorMessage: 'Username does not match site requirements',
          diagnostics: {
            probeUrl: 'https://testuser.booth.pm/',
            requestMethod: 'GET',
            detectionMethods: [DetectionMethod.RESPONSE_URL],
            followRedirects: false,
          },
        },
      ]);

      expect(output).toContain('manual-redirects');
    });
  });

  describe('formatTextReport()', () => {
    it('should keep single-user text compatible', () => {
      expect(formatTextReport([sampleReports[0]])).toBe(formatText(sampleResults));
    });

    it('should render multi-user text sections and no-result sections', () => {
      const output = formatTextReport([...sampleReports, { username: 'charlie', results: [] }]);

      expect(output).toContain('USERNAME: alice');
      expect(output).toContain('USERNAME: bob');
      expect(output).toContain('USERNAME: charlie');
      expect(output).toContain('NO RESULTS');
    });
  });

  describe('formatReport()', () => {
    it('should dispatch to text formatting', () => {
      expect(formatReport(sampleReports, 'text')).toContain('USERNAME: alice');
    });

    it('should dispatch to json formatting', () => {
      expect(JSON.parse(formatReport(sampleReports, 'json'))).toHaveLength(2);
    });

    it('should dispatch to csv formatting', () => {
      expect(formatReport(sampleReports, 'csv')).toContain('username,site,siteName');
    });
  });

  describe('formatDebugReport()', () => {
    it('should render debug data for multi-user reports', () => {
      const output = formatDebugReport([
        {
          username: 'alice',
          results: [
            {
              site: 'GitHub',
              siteName: 'GitHub',
              url: 'https://github.com/testuser',
              status: 'taken',
              responseTime: 100,
              httpStatus: 200,
              errorCategory: ErrorCategory.NONE,
              diagnostics: {
                probeUrl: 'https://github.com/testuser',
                requestMethod: 'HEAD',
                detectionMethods: [DetectionMethod.STATUS_CODE],
                followRedirects: true,
                finalUrl: 'https://github.com/testuser',
              },
              debug: {
                statusCode: 200,
                responseHeaders: { 'x-z': 'last', server: 'GitHub' },
                responseBody: 'profile page',
              },
            },
          ],
        },
      ]);

      expect(output).toContain('SITE: GitHub');
      expect(output).toContain('request: HEAD https://github.com/testuser');
      expect(output).toContain('server: GitHub');
      expect(output).toContain('x-z: last');
      expect(output).toContain('profile page');
    });

    it('should return an empty string when no debug data exists', () => {
      expect(formatDebugReport([{ username: 'alice', results: [] }])).toBe('');
    });

    it('should render multi-user debug sections with error codes and empty bodies', () => {
      const output = formatDebugReport([
        {
          username: 'alice',
          results: [
            {
              site: 'GitHub',
              siteName: 'GitHub',
              url: 'https://github.com/testuser',
              status: 'taken',
              responseTime: 100,
              httpStatus: 200,
              errorCategory: ErrorCategory.NONE,
              diagnostics: {
                probeUrl: 'https://github.com/testuser',
                requestMethod: 'HEAD',
                detectionMethods: [DetectionMethod.STATUS_CODE],
                followRedirects: false,
                errorCodes: [404, 410],
              },
              debug: {
                responseBody: '',
              },
            },
          ],
        },
        {
          username: 'bob',
          results: [
            {
              site: 'GitLab',
              siteName: 'GitLab',
              url: 'https://gitlab.com/testuser',
              status: 'available',
              responseTime: 100,
              httpStatus: 404,
              errorCategory: ErrorCategory.NONE,
              diagnostics: {
                probeUrl: 'https://gitlab.com/testuser',
                requestMethod: 'HEAD',
                detectionMethods: [DetectionMethod.STATUS_CODE],
                followRedirects: true,
              },
            },
          ],
        },
      ]);

      expect(output).toContain('DEBUG USERNAME: alice');
      expect(output).toContain('DEBUG USERNAME: bob');
      expect(output).toContain('error codes: 404, 410');
      expect(output).toContain('  body:');
    });

    it('should skip non-debug results and handle debug-only entries without diagnostics', () => {
      const output = formatDebugReport([
        {
          username: 'alice',
          results: [
            {
              site: 'GitHub',
              siteName: 'GitHub',
              url: 'https://github.com/testuser',
              status: 'taken',
              responseTime: 100,
              errorCategory: ErrorCategory.NONE,
            },
            {
              site: 'GitLab',
              siteName: 'GitLab',
              url: 'https://gitlab.com/testuser',
              status: 'taken',
              responseTime: 100,
              errorCategory: ErrorCategory.NONE,
              debug: {
                responseBody: 'debug-only body',
              },
            },
          ],
        },
      ]);

      expect(output).toContain('SITE: GitLab');
      expect(output).toContain('debug-only body');
      expect(output).not.toContain('SITE: GitHub');
      expect(output).not.toContain('request:');
      expect(output).not.toContain('  status:');
    });
  });

  describe('formatSingleReport()', () => {
    it('should render text, json, and csv single-report formats', () => {
      expect(formatSingleReport(sampleResults, 'text')).toContain('AVAILABLE:');
      expect(JSON.parse(formatSingleReport(sampleResults, 'json'))).toHaveLength(3);
      expect(formatSingleReport(sampleResults, 'csv')).toContain('site,siteName,url,status');
    });
  });
});

describe('CLI helpers', () => {
  it('should parse output formats', () => {
    expect(parseOutputFormat(undefined)).toBe('text');
    expect(parseOutputFormat('json')).toBe('json');
  });

  it('should reject invalid output formats', () => {
    expect(() => parseOutputFormat('xml')).toThrow(/Invalid output format/);
  });

  it('should build debug options only when debug is enabled', () => {
    expect(buildDebugOptions({ timeout: '1', concurrency: '1', retries: '0' })).toBeUndefined();
    expect(
      buildDebugOptions({
        timeout: '1',
        concurrency: '1',
        retries: '0',
        debug: true,
        debugHeaders: true,
        debugBody: true,
        debugMaxBody: '50',
      }),
    ).toEqual({
      includeHeaders: true,
      includeBody: true,
      maxBodyLength: 50,
    });
  });

  it('should parse CLI options into execution options', () => {
    expect(
      parseCliOptions(['alice'], {
        timeout: '5000',
        concurrency: '10',
        retries: '2',
        format: 'json',
        output: 'out.json',
        stdout: true,
        write: true,
        nsfw: true,
        includeExcluded: true,
        tor: true,
        proxy: 'http://localhost:8080',
        sites: 'GitHub, GitLab',
        verbose: true,
        debugHeaders: true,
      }),
    ).toEqual(
      expect.objectContaining({
        usernames: ['alice'],
        timeout: 5000,
        maxConcurrency: 10,
        retries: 2,
        format: 'json',
        outputFile: 'out.json',
        stdout: true,
        write: true,
        includeNSFW: true,
        useTor: true,
        proxy: 'http://localhost:8080',
        sites: ['GitHub', 'GitLab'],
        verbose: true,
        includeExcluded: true,
        debug: { includeHeaders: true, includeBody: false, maxBodyLength: 2000 },
      }),
    );
  });

  it('should parse numeric options with bounds', () => {
    expect(parseNumericOption('timeout', '5000', 1)).toBe(5000);
    expect(parseNumericOption('retries', '0', 0)).toBe(0);
  });

  it('should reject invalid numeric options', () => {
    expect(() => parseNumericOption('timeout', '1.5', 1)).toThrow(/whole number/);
    expect(() => parseNumericOption('concurrency', '0', 1)).toThrow(/>= 1/);
  });

  it('should filter results by status', () => {
    expect(filterResults(sampleResults, { availableOnly: true, takenOnly: false })).toHaveLength(1);
    expect(filterResults(sampleResults, { availableOnly: false, takenOnly: true })).toHaveLength(1);
    expect(filterResults(sampleResults, { availableOnly: false, takenOnly: false })).toHaveLength(3);
  });

  it('should reject conflicting result filters during CLI option parsing', () => {
    expect(() =>
      parseCliOptions(['alice'], {
        timeout: '1',
        concurrency: '1',
        retries: '0',
        availableOnly: true,
        takenOnly: true,
      }),
    ).toThrow(/Cannot combine --available-only and --taken-only/);
  });

  it('should sanitize output basenames and provide a fallback', () => {
    expect(sanitizeOutputBasename('te/st user')).toBe('te_st_user');
    expect(sanitizeOutputBasename('...')).toBe('username');
  });

  it('should provide output extensions', () => {
    expect(getOutputExtension('text')).toBe('txt');
    expect(getOutputExtension('json')).toBe('json');
    expect(getOutputExtension('csv')).toBe('csv');
  });

  it('should build collision-free output basenames', () => {
    expect(buildOutputBasenames(['Alice', 'alice', 'bob'])).toEqual(['Alice', 'alice-2', 'bob']);
  });

  it('should summarize reports counting available, taken, and errors', () => {
    const summary = summarizeReports(sampleReports);
    expect(summary.total).toBe(4);
    expect(summary.available).toBe(2);
    expect(summary.taken).toBe(1);
    expect(summary.errors).toBe(1);
  });

  it('should build no primary writes for empty reports', () => {
    expect(buildPrimaryOutputWrites([], { format: 'text' })).toEqual([]);
  });

  it('should build aggregate primary output writes when output file is provided', () => {
    expect(buildPrimaryOutputWrites(sampleReports, { format: 'json', outputFile: 'results.json' })).toEqual([
      { filePath: 'results.json', content: formatJsonReport(sampleReports) },
    ]);
  });

  it('should build per-user primary output writes in a directory', () => {
    expect(buildPrimaryOutputWrites(sampleReports, { format: 'text', outputDir: 'reports' })).toEqual([
      { filePath: 'reports/alice.txt', content: formatText(sampleResults) },
      { filePath: 'reports/bob.txt', content: formatText(secondaryResults) },
    ]);
  });

  it('should build additional json and csv writes', () => {
    expect(buildAdditionalOutputWrites(sampleReports, { jsonFile: 'results.json', csvFile: 'results.csv' })).toEqual([
      { filePath: 'results.json', content: formatJsonReport(sampleReports) },
      { filePath: 'results.csv', content: formatCsvReport(sampleReports) },
    ]);
  });

  it('should ensure parent directories exist', () => {
    ensureParentDirectory('reports/alice.txt');
    expect(mockMkdirSync).toHaveBeenCalledWith('reports', { recursive: true });
  });

  it('should orchestrate a CLI execution with hooks', async () => {
    mockCheck.mockResolvedValue([
      {
        ...sampleResults[0],
        diagnostics: {
          probeUrl: 'https://github.com/testuser',
          requestMethod: 'HEAD',
          detectionMethods: [DetectionMethod.STATUS_CODE],
          followRedirects: true,
        },
        debug: {
          statusCode: 404,
          responseHeaders: { server: 'GitHub' },
          responseBody: 'profile',
        },
      },
    ]);
    const checker = new UsernameChecker() as unknown as UsernameChecker;
    const onUsernameStart = vi.fn<(username: string, index: number, total: number) => void>();
    const onUsernameComplete =
      vi.fn<(username: string, index: number, total: number, results: CheckResult[]) => void>();
    const onFilesWritten = vi.fn<(filesWritten: string[]) => void>();
    const onSummary = vi.fn<(summary: { available: number; taken: number; errors: number; total: number }) => void>();
    const onDebugOutput = vi.fn<(output: string) => void>();

    const execution = await runCliExecution(
      checker,
      {
        usernames: ['alice'],
        sites: ['GitHub'],
        includeNSFW: false,
        includeExcluded: false,
        availableOnly: false,
        takenOnly: false,
        format: 'text',
        outputFile: 'alice.txt',
        stdout: false,
        write: true,
        verbose: false,
        debug: { includeHeaders: true, includeBody: true },
      },
      {
        onUsernameStart,
        onUsernameComplete,
        onFilesWritten,
        onSummary,
        onDebugOutput,
      },
    );

    expect(onUsernameStart).toHaveBeenCalledWith('alice', 0, 1);
    expect(onUsernameComplete).toHaveBeenCalledWith(
      'alice',
      0,
      1,
      expect.arrayContaining([
        expect.objectContaining({
          site: 'GitHub',
        }),
      ]),
    );
    expect(onFilesWritten).toHaveBeenCalledWith(['alice.txt']);
    expect(onSummary).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
    expect(onDebugOutput).toHaveBeenCalled();
    expect(execution.filesWritten).toEqual(['alice.txt']);
  });

  it('should prefer onStdout hook output over direct stdout writes', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    const checker = new UsernameChecker() as unknown as UsernameChecker;
    const onStdout = vi.fn<(output: string) => void>();

    await runCliExecution(
      checker,
      {
        usernames: ['alice'],
        includeNSFW: false,
        includeExcluded: false,
        availableOnly: false,
        takenOnly: false,
        format: 'json',
        stdout: true,
        write: false,
        verbose: false,
      },
      { onStdout },
    );

    expect(onStdout).toHaveBeenCalled();
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

    const output = stderrSpy.mock.calls.map(getMockOutput).join('');
    expect(output).toContain('50/100');
    expect(output).toContain('GitHub');
  });

  it('should not print when verbose is false', () => {
    printProgress(
      {
        total: 1,
        completed: 1,
        available: 1,
        taken: 0,
        errors: 0,
        percentage: 100,
      },
      false,
    );

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should handle missing currentSite', () => {
    printProgress(
      {
        total: 1,
        completed: 1,
        available: 1,
        taken: 0,
        errors: 0,
        percentage: 100,
      },
      true,
    );

    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });
});

describe('main()', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockCheck.mockReset();
    mockAbort.mockReset();
    MockUsernameChecker.mockClear();
    mockWriteFileSync.mockReset();
    mockMkdirSync.mockReset();
    mockExistsSync.mockReset();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReset();
    process.removeAllListeners('SIGINT');
  });

  afterEach(() => {
    process.argv = originalArgv;
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    stdoutSpy.mockRestore();
    process.removeAllListeners('SIGINT');
  });

  it('should write default text output for a single username', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '--sites', 'GitHub,Twitter'];

    await main();

    expect(mockCheck).toHaveBeenCalledWith(
      'testuser',
      expect.objectContaining({
        sites: ['GitHub', 'Twitter'],
        includeNSFW: false,
      }),
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith('testuser.txt', expect.any(String), 'utf-8');
  });

  it('should write per-user files for multiple usernames', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'alice', 'bob'];

    await main();

    expect(mockCheck).toHaveBeenNthCalledWith(1, 'alice', expect.any(Object));
    expect(mockCheck).toHaveBeenNthCalledWith(2, 'bob', expect.any(Object));
    expect(mockWriteFileSync).toHaveBeenCalledWith('alice.txt', expect.any(String), 'utf-8');
    expect(mockWriteFileSync).toHaveBeenCalledWith('bob.txt', expect.any(String), 'utf-8');
  });

  it('should write per-user files inside an output directory', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'alice', 'bob', '--output-dir', 'reports'];

    await main();

    expect(mockWriteFileSync).toHaveBeenCalledWith('reports/alice.txt', expect.any(String), 'utf-8');
    expect(mockWriteFileSync).toHaveBeenCalledWith('reports/bob.txt', expect.any(String), 'utf-8');
    expect(mockMkdirSync).toHaveBeenCalledWith('reports', { recursive: true });
  });

  it('should write aggregate primary output when --output is provided for multiple usernames', async () => {
    mockCheck.mockResolvedValueOnce(sampleResults).mockResolvedValueOnce(secondaryResults);
    process.argv = ['node', 'cli.js', 'alice', 'bob', '--format', 'json', '--output', 'results.json'];

    await main();

    const written = mockWriteFileSync.mock.calls.find((call) => call[0] === 'results.json');
    const parsed = JSON.parse(written?.[1] ?? '[]');
    expect(parsed).toHaveLength(2);
    expect(parsed[0].username).toBe('alice');
    expect(parsed[1].username).toBe('bob');
  });

  it('should keep legacy json sidecar output alongside a primary text file', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '--json', 'results.json', '--output', 'primary.txt'];

    await main();

    expect(mockWriteFileSync).toHaveBeenCalledWith('primary.txt', expect.any(String), 'utf-8');
    expect(mockWriteFileSync).toHaveBeenCalledWith('results.json', expect.any(String), 'utf-8');
  });

  it('should print aggregate output to stdout', async () => {
    mockCheck.mockResolvedValueOnce(sampleResults).mockResolvedValueOnce(secondaryResults);
    process.argv = ['node', 'cli.js', 'alice', 'bob', '--stdout', '--no-write', '--format', 'csv'];

    await main();

    const stdout = stdoutSpy.mock.calls.map(getMockOutput).join('');
    expect(stdout).toContain('username,site,siteName');
    expect(stdout).toContain('"alice"');
    expect(stdout).toContain('"bob"');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should support verbose no-write mode', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '--no-write', '-v'];

    await main();

    const errorOutput = consoleErrorSpy.mock.calls.map(getMockOutput).join(' ');
    expect(errorOutput).toContain('No file output requested');
    expect(errorOutput).toContain('No files written');
    expect(errorOutput).toContain('Summary');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should print explicit debug output when requested', async () => {
    mockCheck.mockResolvedValue([
      {
        ...sampleResults[0],
        status: 'taken',
        httpStatus: 200,
        diagnostics: {
          probeUrl: 'https://github.com/testuser',
          requestMethod: 'HEAD',
          detectionMethods: [DetectionMethod.STATUS_CODE],
          followRedirects: true,
          finalUrl: 'https://github.com/testuser',
        },
        debug: {
          statusCode: 200,
          responseHeaders: { server: 'GitHub' },
          responseBody: 'profile page',
        },
      },
    ]);
    process.argv = ['node', 'cli.js', 'testuser', '--debug', '--debug-headers', '--debug-body', '--no-write'];

    await main();

    const errorOutput = consoleErrorSpy.mock.calls.map(getMockOutput).join(' ');
    expect(errorOutput).toContain('Debug Report');
    expect(errorOutput).toContain('server: GitHub');
    expect(errorOutput).toContain('profile page');
    expect(mockCheck).toHaveBeenCalledWith(
      'testuser',
      expect.objectContaining({
        debug: {
          includeHeaders: true,
          includeBody: true,
          maxBodyLength: 2000,
        },
      }),
    );
  });

  it('should render unknown statuses without error messages in text output', () => {
    const output = formatText([
      {
        site: 'Unknown',
        siteName: 'Unknown Site',
        url: 'https://unknown.example/testuser',
        status: 'unknown',
        responseTime: 0,
        errorCategory: ErrorCategory.UNKNOWN,
      },
    ]);

    expect(output).toContain('Unknown Site: unknown');
  });

  it('should show multi-user verbose prefixes', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'alice', 'bob', '-v'];

    await main();

    const errorOutput = consoleErrorSpy.mock.calls.map(getMockOutput).join(' ');
    expect(errorOutput).toContain('Checking username (1/2): alice');
    expect(errorOutput).toContain('Checking username (2/2): bob');
  });

  it('should show progress and written files in verbose mode', async () => {
    mockCheck.mockImplementation(async (_username: string, options?: Record<string, unknown>) => {
      const onProgress = options?.onProgress as ((progress: CheckProgress) => void) | undefined;
      onProgress?.({
        total: 1,
        completed: 1,
        available: 1,
        taken: 0,
        errors: 0,
        percentage: 100,
        currentSite: 'GitHub',
      });
      return sampleResults;
    });
    process.argv = ['node', 'cli.js', 'testuser', '-v'];

    await main();

    const errorOutput = consoleErrorSpy.mock.calls.map(getMockOutput).join(' ');
    expect(errorOutput).toContain('Checking username');
    expect(errorOutput).toContain('Output written to');
    expect(errorOutput).toContain('Summary');
  });

  it('should apply config defaults when matching CLI flags are omitted', async () => {
    const loadConfigSpy = vi.spyOn(ConfigLoader, 'loadConfig').mockReturnValue({
      timeout: 9000,
      maxConcurrency: 25,
      retries: 1,
      includeNSFW: true,
      includeExcluded: true,
      useTor: true,
      proxy: 'http://config-proxy.local',
      format: 'json',
      defaultSites: ['GitHub', 'GitLab'],
      cache: {
        type: 'file',
        ttl: 7200000,
        dir: './configured-cache',
      },
    });
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser'];

    await main();

    expect(MockUsernameChecker).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 9000,
        maxConcurrency: 25,
        retries: 1,
        useTor: true,
        proxy: 'http://config-proxy.local',
        cache: {
          type: 'file',
          ttl: 7200000,
          dir: './configured-cache',
        },
      }),
    );
    expect(mockCheck).toHaveBeenCalledWith(
      'testuser',
      expect.objectContaining({
        sites: ['GitHub', 'GitLab'],
        includeNSFW: true,
        includeExcluded: true,
      }),
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith('testuser.json', expect.any(String), 'utf-8');

    loadConfigSpy.mockRestore();
  });

  it('should let explicit CLI flags override config defaults', async () => {
    const loadConfigSpy = vi.spyOn(ConfigLoader, 'loadConfig').mockReturnValue({
      timeout: 9000,
      maxConcurrency: 25,
      retries: 1,
      includeNSFW: true,
      includeExcluded: true,
      format: 'json',
      defaultSites: ['GitHub', 'GitLab'],
      cache: {
        type: 'file',
        ttl: 7200000,
        dir: './configured-cache',
      },
    });
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = [
      'node',
      'cli.js',
      'testuser',
      '--timeout',
      '5000',
      '--concurrency',
      '10',
      '--retries',
      '3',
      '--format',
      'csv',
      '--sites',
      'GitHub',
      '--cache',
      'hybrid',
      '--cache-ttl',
      '1800',
      '--cache-dir',
      './cli-cache',
    ];

    await main();

    expect(MockUsernameChecker).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 5000,
        maxConcurrency: 10,
        retries: 3,
        cache: {
          type: 'hybrid',
          ttl: 1800,
          dir: './cli-cache',
        },
      }),
    );
    expect(mockCheck).toHaveBeenCalledWith(
      'testuser',
      expect.objectContaining({
        sites: ['GitHub'],
        includeNSFW: true,
        includeExcluded: true,
      }),
    );
    expect(mockWriteFileSync).toHaveBeenCalledWith('testuser.csv', expect.any(String), 'utf-8');

    loadConfigSpy.mockRestore();
  });

  it('should handle SIGINT signal', async () => {
    let resolveCheck!: (results: CheckResult[]) => void;
    mockCheck.mockImplementation(
      () =>
        new Promise<CheckResult[]>((resolve) => {
          resolveCheck = resolve;
        }),
    );

    process.argv = ['node', 'cli.js', 'testuser', '-v'];
    const mainPromise = main();

    await new Promise((resolve) => setImmediate(resolve));

    processExitSpy.mockRestore();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    process.emit('SIGINT');

    expect(exitSpy).toHaveBeenCalledWith(130);
    expect(mockAbort).toHaveBeenCalled();

    resolveCheck(sampleResults);
    await mainPromise;

    exitSpy.mockRestore();
  });

  it('should handle SIGINT signal when verbose mode is off', async () => {
    let resolveCheck!: (results: CheckResult[]) => void;
    mockCheck.mockImplementation(
      () =>
        new Promise<CheckResult[]>((resolve) => {
          resolveCheck = resolve;
        }),
    );

    process.argv = ['node', 'cli.js', 'testuser'];
    const mainPromise = main();

    await new Promise((resolve) => setImmediate(resolve));

    processExitSpy.mockRestore();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    process.emit('SIGINT');

    expect(exitSpy).toHaveBeenCalledWith(130);
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Aborting'));

    resolveCheck(sampleResults);
    await mainPromise;

    exitSpy.mockRestore();
  });

  it('should clean up SIGINT listeners after repeated runs', async () => {
    mockCheck.mockResolvedValue([]);
    const initialListenerCount = process.listenerCount('SIGINT');

    process.argv = ['node', 'cli.js', 'testuser'];
    await main();

    process.argv = ['node', 'cli.js', 'another-user'];
    await main();

    expect(process.listenerCount('SIGINT')).toBe(initialListenerCount);
  });

  it('should reject invalid numeric options with a CLI error', async () => {
    process.argv = ['node', 'cli.js', 'testuser', '--timeout', '1.5'];

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid timeout'));
  });

  it('should bypass config loading when --no-config is provided', async () => {
    const loadConfigSpy = vi.spyOn(ConfigLoader, 'loadConfig');
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser', '--no-config'];

    await main();

    expect(loadConfigSpy).not.toHaveBeenCalled();
    loadConfigSpy.mockRestore();
  });

  it('should reject output conflicts with no-write', async () => {
    process.argv = ['node', 'cli.js', 'testuser', '--no-write', '--output', 'result.txt'];

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot combine --no-write'));
  });

  it('should report non-Error CLI failures cleanly', async () => {
    mockCheck.mockRejectedValue('boom');
    process.argv = ['node', 'cli.js', 'testuser'];

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: boom'));
  });

  it('should reject output-dir plus output conflicts', async () => {
    process.argv = ['node', 'cli.js', 'testuser', '--output-dir', 'reports', '--output', 'result.txt'];

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot combine --output-dir'));
  });

  it('should reject conflicting result filters', async () => {
    mockCheck.mockResolvedValue(sampleResults);
    process.argv = ['node', 'cli.js', 'testuser', '--available-only', '--taken-only'];

    await expect(main()).rejects.toThrow('process.exit(1)');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot combine --available-only'));
  });

  it('should pass checker construction options through', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = [
      'node',
      'cli.js',
      'testuser',
      '--timeout',
      '5000',
      '--concurrency',
      '10',
      '--retries',
      '3',
      '--tor',
      '--proxy',
      'http://localhost:8080',
    ];

    await main();

    expect(MockUsernameChecker).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 5000,
        maxConcurrency: 10,
        retries: 3,
        useTor: true,
        proxy: 'http://localhost:8080',
      }),
    );
  });

  it('should pass includeNSFW and site filters to checker.check', async () => {
    mockCheck.mockResolvedValue([]);
    process.argv = ['node', 'cli.js', 'testuser', '--nsfw', '--include-excluded', '--sites', 'GitHub,Twitter'];

    await main();

    expect(mockCheck).toHaveBeenCalledWith(
      'testuser',
      expect.objectContaining({
        includeNSFW: true,
        includeExcluded: true,
        sites: ['GitHub', 'Twitter'],
      }),
    );
  });

  it('should check all sites when none are specified', async () => {
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
