/**
 * CliExecution - parse CLI options and orchestrate username checks.
 */

import type { UsernameChecker } from './UsernameChecker.js';
import type { CheckOptions, CheckProgress, DebugOptions, CheckResult } from './types.js';
import {
  buildAdditionalOutputWrites,
  buildPrimaryOutputWrites,
  formatDebugReport,
  formatReport,
  type OutputFormat,
  type UsernameReport,
  writeOutputWrites,
  writeStdout,
} from './CliReporting.js';

const VALID_OUTPUT_FORMATS: OutputFormat[] = ['text', 'json', 'csv'];

export interface CliSummary {
  available: number;
  taken: number;
  errors: number;
  total: number;
}

export interface CliExecutionOptions {
  usernames: string[];
  sites?: string[];
  includeNSFW: boolean;
  includeExcluded: boolean;
  availableOnly: boolean;
  takenOnly: boolean;
  format: OutputFormat;
  outputFile?: string;
  outputDir?: string;
  stdout: boolean;
  write: boolean;
  jsonFile?: string;
  csvFile?: string;
  verbose: boolean;
  debug?: DebugOptions;
  signal?: AbortSignal;
}

export interface ParsedCliOptions extends CliExecutionOptions {
  timeout: number;
  maxConcurrency: number;
  retries: number;
  useTor: boolean;
  proxy?: string;
}

export interface RawCliActionOptions {
  format?: string;
  json?: string;
  csv?: string;
  output?: string;
  outputDir?: string;
  cache?: string;
  cacheDir?: string;
  cacheTtl?: string;
  config?: boolean;
  stdout?: boolean;
  write?: boolean;
  timeout: string;
  concurrency: string;
  retries: string;
  nsfw?: boolean;
  includeExcluded?: boolean;
  tor?: boolean;
  proxy?: string;
  sites?: string;
  verbose?: boolean;
  availableOnly?: boolean;
  takenOnly?: boolean;
  debug?: boolean;
  debugHeaders?: boolean;
  debugBody?: boolean;
  debugMaxBody?: string;
}

export interface CliExecutionHooks {
  onUsernameStart?: (username: string, index: number, total: number) => void;
  onUsernameComplete?: (username: string, index: number, total: number, results: CheckResult[]) => void;
  onProgress?: (progress: CheckProgress) => void;
  onStdout?: (output: string) => void;
  onFilesWritten?: (filesWritten: string[]) => void;
  onNoFilesWritten?: () => void;
  onSummary?: (summary: CliSummary) => void;
  onDebugOutput?: (output: string) => void;
}

export interface CliExecutionResult {
  reports: UsernameReport[];
  filesWritten: string[];
  primaryOutput: string;
  debugOutput?: string;
  summary: CliSummary;
}

export function parseOutputFormat(format: string | undefined): OutputFormat {
  if (!format) {
    return 'text';
  }

  if (VALID_OUTPUT_FORMATS.includes(format as OutputFormat)) {
    return format as OutputFormat;
  }

  throw new Error(`Invalid output format: ${format}. Expected one of ${VALID_OUTPUT_FORMATS.join(', ')}`);
}

export function parseNumericOption(name: string, value: string, minimum: number): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid ${name}: ${value}. Expected a whole number.`);
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (parsed < minimum) {
    throw new Error(`Invalid ${name}: ${value}. Expected a value >= ${minimum}.`);
  }

  return parsed;
}

export function buildDebugOptions(options: RawCliActionOptions): DebugOptions | undefined {
  const enabled = options.debug || options.debugHeaders || options.debugBody;
  if (!enabled) {
    return undefined;
  }

  return {
    includeHeaders: Boolean(options.debugHeaders),
    includeBody: Boolean(options.debugBody),
    maxBodyLength: parseNumericOption('debug max body', options.debugMaxBody ?? '2000', 0),
  };
}

export function parseCliOptions(usernames: string[], options: RawCliActionOptions): ParsedCliOptions {
  const timeout = parseNumericOption('timeout', options.timeout, 1);
  const maxConcurrency = parseNumericOption('concurrency', options.concurrency, 1);
  const retries = parseNumericOption('retries', options.retries, 0);
  const format = parseOutputFormat(options.format);
  const outputFile = options.output;
  const outputDir = options.outputDir;
  const stdout = Boolean(options.stdout);
  const write = options.write ?? true;
  const jsonFile = options.json;
  const csvFile = options.csv;
  const availableOnly = Boolean(options.availableOnly);
  const takenOnly = Boolean(options.takenOnly);

  if (outputDir && outputFile) {
    throw new Error('Cannot combine --output-dir with --output');
  }
  if (!write && (outputFile || outputDir || jsonFile || csvFile)) {
    throw new Error('Cannot combine --no-write with file output options');
  }
  if (availableOnly && takenOnly) {
    throw new Error('Cannot combine --available-only and --taken-only');
  }

  const sites = options.sites
    ?.split(',')
    .map((site) => site.trim())
    .filter(Boolean);

  return {
    usernames,
    timeout,
    maxConcurrency,
    retries,
    includeNSFW: Boolean(options.nsfw),
    includeExcluded: Boolean(options.includeExcluded),
    useTor: Boolean(options.tor),
    proxy: options.proxy,
    sites: sites && sites.length > 0 ? sites : undefined,
    availableOnly,
    takenOnly,
    format,
    outputFile,
    outputDir,
    stdout,
    write,
    jsonFile,
    csvFile,
    verbose: Boolean(options.verbose),
    debug: buildDebugOptions(options),
  };
}

export function filterResults(
  results: CheckResult[],
  options: { availableOnly: boolean; takenOnly: boolean },
): CheckResult[] {
  if (options.availableOnly) {
    return results.filter((result) => result.status === 'available');
  }

  if (options.takenOnly) {
    return results.filter((result) => result.status === 'taken');
  }

  return results;
}

export function summarizeReports(reports: UsernameReport[]): CliSummary {
  const summary: CliSummary = { available: 0, taken: 0, errors: 0, total: 0 };

  for (const report of reports) {
    for (const result of report.results) {
      summary.total++;
      if (result.status === 'available') {
        summary.available++;
      } else if (result.status === 'taken') {
        summary.taken++;
      } else {
        summary.errors++;
      }
    }
  }

  return summary;
}

export function printProgress(progress: CheckProgress, verbose: boolean, theme: typeof import('chalk').default): void {
  if (!verbose) {
    return;
  }

  process.stderr.write(
    `\r${theme.cyan('Progress:')} ${progress.completed}/${progress.total} (${progress.percentage}%) | ` +
      `${theme.green('Available:')} ${progress.available} | ` +
      `${theme.red('Taken:')} ${progress.taken} | ` +
      `${theme.yellow('Errors:')} ${progress.errors}`,
  );

  if (progress.currentSite) {
    process.stderr.write(` | ${theme.gray(progress.currentSite)}`);
  } else {
    process.stderr.write('');
  }
}

export async function runCliExecution(
  checker: UsernameChecker,
  options: CliExecutionOptions,
  hooks: CliExecutionHooks = {},
): Promise<CliExecutionResult> {
  const reports: UsernameReport[] = [];

  for (const [index, username] of options.usernames.entries()) {
    hooks.onUsernameStart?.(username, index, options.usernames.length);

    const results = await checker.check(username, {
      sites: options.sites,
      includeNSFW: options.includeNSFW,
      includeExcluded: options.includeExcluded,
      onProgress: hooks.onProgress,
      signal: options.signal,
      debug: options.debug,
    } satisfies Pick<CheckOptions, 'sites' | 'includeNSFW' | 'includeExcluded' | 'onProgress' | 'signal' | 'debug'>);

    const filteredResults = filterResults(results, {
      availableOnly: options.availableOnly,
      takenOnly: options.takenOnly,
    });

    reports.push({ username, results: filteredResults });
    hooks.onUsernameComplete?.(username, index, options.usernames.length, filteredResults);
  }

  const primaryOutput = formatReport(reports, options.format);
  if (options.stdout) {
    if (hooks.onStdout) {
      hooks.onStdout(primaryOutput);
    } else {
      writeStdout(primaryOutput);
    }
  }

  let filesWritten: string[] = [];
  if (options.write) {
    const writes = [
      ...buildPrimaryOutputWrites(reports, {
        format: options.format,
        outputFile: options.outputFile,
        outputDir: options.outputDir,
      }),
      ...buildAdditionalOutputWrites(reports, {
        jsonFile: options.jsonFile,
        csvFile: options.csvFile,
      }),
    ];
    filesWritten = writeOutputWrites(writes);
    hooks.onFilesWritten?.(filesWritten);
  } else {
    hooks.onNoFilesWritten?.();
  }

  const debugOutput = options.debug ? formatDebugReport(reports) : undefined;
  if (debugOutput) {
    hooks.onDebugOutput?.(debugOutput);
  }

  const summary = summarizeReports(reports);
  hooks.onSummary?.(summary);

  return {
    reports,
    filesWritten,
    primaryOutput,
    debugOutput,
    summary,
  };
}
