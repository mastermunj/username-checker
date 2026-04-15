/**
 * CliReporting - format reports and send them to output sinks.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CheckResult } from './types.js';

export type OutputFormat = 'text' | 'json' | 'csv';

export interface UsernameReport {
  username: string;
  results: CheckResult[];
}

export interface OutputWrite {
  filePath: string;
  content: string;
}

const CSV_HEADERS = [
  'site',
  'siteName',
  'url',
  'status',
  'responseTime',
  'httpStatus',
  'errorCategory',
  'errorMessage',
];
const DISALLOWED_FILENAME_CHARACTER_PATTERN = String.raw`[<>:"/\\|?*\u0000-\u001F\u007F]`;

function formatDiagnostics(result: CheckResult): string {
  if (!result.diagnostics) {
    return '';
  }

  const { detectionMethods, followRedirects, probeUrl, requestMethod } = result.diagnostics;
  const detectionSummary = detectionMethods.join('+');
  const redirectSummary = followRedirects ? 'follow-redirects' : 'manual-redirects';
  return ` [${requestMethod} ${probeUrl} detection=${detectionSummary} ${redirectSummary}]`;
}

function indentLines(value: string, prefix = '    '): string[] {
  return value.split('\n').map((line) => `${prefix}${line}`);
}

export function formatJson(results: CheckResult[]): string {
  return JSON.stringify(results, null, 2);
}

export function formatJsonReport(reports: UsernameReport[]): string {
  if (reports.length === 1) {
    return formatJson(reports[0].results);
  }

  return JSON.stringify(reports, null, 2);
}

export function formatCsv(results: CheckResult[]): string {
  const rows = results.map((result) =>
    [
      result.site,
      result.siteName,
      result.url,
      result.status,
      result.responseTime,
      result.httpStatus ?? '',
      result.errorCategory,
      result.errorMessage ?? '',
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(','),
  );

  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

export function formatCsvReport(reports: UsernameReport[]): string {
  if (reports.length === 1) {
    return formatCsv(reports[0].results);
  }

  const rows = reports.flatMap(({ username, results }) =>
    results.map((result) =>
      [
        username,
        result.site,
        result.siteName,
        result.url,
        result.status,
        result.responseTime,
        result.httpStatus ?? '',
        result.errorCategory,
        result.errorMessage ?? '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    ),
  );

  return [['username', ...CSV_HEADERS].join(','), ...rows].join('\n');
}

export function formatText(results: CheckResult[]): string {
  const lines: string[] = [];
  const available = results.filter((result) => result.status === 'available');
  const taken = results.filter((result) => result.status === 'taken');
  const errors = results.filter(
    (result) => result.status === 'error' || result.status === 'unknown' || result.status === 'invalid',
  );

  if (available.length > 0) {
    lines.push('AVAILABLE:');
    available.forEach((result) => {
      lines.push(`  ${result.siteName}: ${result.url}`);
    });
    lines.push('');
  }

  if (taken.length > 0) {
    lines.push('TAKEN:');
    taken.forEach((result) => {
      lines.push(`  ${result.siteName}: ${result.url}`);
    });
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push('ERRORS:');
    errors.forEach((result) => {
      lines.push(`  ${result.siteName}: ${result.errorMessage ?? result.status}${formatDiagnostics(result)}`);
    });
  }

  return lines.join('\n');
}

export function formatTextReport(reports: UsernameReport[]): string {
  if (reports.length === 1) {
    return formatText(reports[0].results);
  }

  return reports
    .map(({ username, results }) => {
      const formattedResults = formatText(results);
      return [`USERNAME: ${username}`, formattedResults || 'NO RESULTS', ''].join('\n');
    })
    .join('\n')
    .trimEnd();
}

export function formatDebugReport(reports: UsernameReport[]): string {
  const lines: string[] = [];
  const multipleUsernames = reports.length > 1;

  reports.forEach((report) => {
    const debugResults = report.results.filter((result) => result.diagnostics || result.debug);
    if (debugResults.length === 0) {
      return;
    }

    if (multipleUsernames) {
      lines.push(`DEBUG USERNAME: ${report.username}`);
    }

    debugResults.forEach((result) => {
      lines.push(`SITE: ${result.siteName}`);
      lines.push(`  availability: ${result.status}`);
      lines.push(`  error category: ${result.errorCategory}`);

      const statusCode = result.debug?.statusCode ?? result.httpStatus;
      if (statusCode !== undefined) {
        lines.push(`  status: ${statusCode}`);
      }

      if (result.diagnostics) {
        lines.push(`  request: ${result.diagnostics.requestMethod} ${result.diagnostics.probeUrl}`);
        lines.push(`  detection: ${result.diagnostics.detectionMethods.join('+')}`);
        lines.push(`  redirects: ${result.diagnostics.followRedirects ? 'follow' : 'manual'}`);

        if (result.diagnostics.finalUrl) {
          lines.push(`  final url: ${result.diagnostics.finalUrl}`);
        }
        if (result.diagnostics.errorCodes && result.diagnostics.errorCodes.length > 0) {
          lines.push(`  error codes: ${result.diagnostics.errorCodes.join(', ')}`);
        }
      }

      if (result.debug?.responseHeaders) {
        lines.push('  headers:');
        Object.entries(result.debug.responseHeaders)
          .sort(([left], [right]) => left.localeCompare(right))
          .forEach(([key, value]) => {
            lines.push(`    ${key}: ${value}`);
          });
      }

      if (result.debug?.responseBody !== undefined) {
        lines.push('  body:');
        lines.push(...indentLines(result.debug.responseBody));
      }

      lines.push('');
    });
  });

  return lines.join('\n').trimEnd();
}

export function formatReport(reports: UsernameReport[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJsonReport(reports);
    case 'csv':
      return formatCsvReport(reports);
    default:
      return formatTextReport(reports);
  }
}

export function formatSingleReport(results: CheckResult[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(results);
    case 'csv':
      return formatCsv(results);
    default:
      return formatText(results);
  }
}

export function sanitizeOutputBasename(username: string): string {
  const disallowedFilenameCharacters = new RegExp(DISALLOWED_FILENAME_CHARACTER_PATTERN, 'gu');
  const sanitized = username
    .trim()
    .replace(disallowedFilenameCharacters, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+|\.+$/g, '');

  return sanitized || 'username';
}

export function getOutputExtension(format: OutputFormat): string {
  switch (format) {
    case 'json':
      return 'json';
    case 'csv':
      return 'csv';
    default:
      return 'txt';
  }
}

export function buildOutputBasenames(usernames: string[]): string[] {
  const counts = new Map<string, number>();

  return usernames.map((username) => {
    const base = sanitizeOutputBasename(username);
    const key = base.toLowerCase();
    const nextCount = (counts.get(key) ?? 0) + 1;
    counts.set(key, nextCount);

    return nextCount === 1 ? base : `${base}-${nextCount}`;
  });
}

export function buildPrimaryOutputWrites(
  reports: UsernameReport[],
  options: {
    format: OutputFormat;
    outputFile?: string;
    outputDir?: string;
  },
): OutputWrite[] {
  if (reports.length === 0) {
    return [];
  }

  if (options.outputFile) {
    return [{ filePath: options.outputFile, content: formatReport(reports, options.format) }];
  }

  const extension = getOutputExtension(options.format);
  const outputDir = options.outputDir;
  const basenames = buildOutputBasenames(reports.map((report) => report.username));

  return reports.map((report, index) => ({
    filePath: outputDir ? join(outputDir, `${basenames[index]}.${extension}`) : `${basenames[index]}.${extension}`,
    content: formatSingleReport(report.results, options.format),
  }));
}

export function buildAdditionalOutputWrites(
  reports: UsernameReport[],
  options: { jsonFile?: string; csvFile?: string },
): OutputWrite[] {
  const writes: OutputWrite[] = [];

  if (options.jsonFile) {
    writes.push({ filePath: options.jsonFile, content: formatJsonReport(reports) });
  }

  if (options.csvFile) {
    writes.push({ filePath: options.csvFile, content: formatCsvReport(reports) });
  }

  return writes;
}

export function ensureParentDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function writeOutputWrites(writes: OutputWrite[]): string[] {
  const filesWritten: string[] = [];

  for (const writeTarget of writes) {
    ensureParentDirectory(writeTarget.filePath);
    writeFileSync(writeTarget.filePath, writeTarget.content, 'utf-8');
    filesWritten.push(writeTarget.filePath);
  }

  return filesWritten;
}

export function writeStdout(output: string): void {
  process.stdout.write(`${output}\n`);
}
