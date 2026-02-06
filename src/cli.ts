#!/usr/bin/env node
/**
 * CLI for username-checker
 */

import { writeFileSync } from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import { UsernameChecker } from './UsernameChecker.js';
import type { CheckResult, CheckProgress } from './types.js';
import packageJson from '../package.json' with { type: 'json' };

/**
 * Format output as JSON
 */
export function formatJson(results: CheckResult[]): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Format output as CSV
 */
export function formatCsv(results: CheckResult[]): string {
  const headers = ['site', 'siteName', 'url', 'status', 'responseTime', 'httpStatus', 'errorCategory', 'errorMessage'];
  const rows = results.map((r) =>
    [
      r.site,
      r.siteName,
      r.url,
      r.status,
      r.responseTime,
      r.httpStatus ?? '',
      r.errorCategory ?? '',
      r.errorMessage ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Format output as plain text
 */
export function formatText(results: CheckResult[]): string {
  const lines: string[] = [];
  const available = results.filter((r) => r.status === 'available');
  const taken = results.filter((r) => r.status === 'taken');
  const errors = results.filter((r) => r.status === 'error' || r.status === 'unknown');

  if (available.length > 0) {
    lines.push('AVAILABLE:');
    available.forEach((r) => {
      lines.push(`  ${r.siteName}: ${r.url}`);
    });
    lines.push('');
  }

  if (taken.length > 0) {
    lines.push('TAKEN:');
    taken.forEach((r) => {
      lines.push(`  ${r.siteName}: ${r.url}`);
    });
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push('ERRORS:');
    errors.forEach((r) => {
      lines.push(`  ${r.siteName}: ${r.errorMessage ?? r.status}`);
    });
  }

  return lines.join('\n');
}

/**
 * Print progress to stderr (so it doesn't interfere with output)
 */
export function printProgress(progress: CheckProgress, verbose: boolean): void {
  if (verbose) {
    process.stderr.write(
      `\r${chalk.cyan('Progress:')} ${progress.completed}/${progress.total} (${progress.percentage}%) | ` +
        `${chalk.green('Available:')} ${progress.available} | ` +
        `${chalk.red('Taken:')} ${progress.taken} | ` +
        `${chalk.yellow('Errors:')} ${progress.errors}`,
    );
    if (progress.currentSite) {
      process.stderr.write(` | ${chalk.gray(progress.currentSite)}`);
    } else {
      process.stderr.write('');
    }
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('username-checker')
    .description('Check username availability across multiple platforms')
    .version(packageJson.version);

  program
    .argument('<username>', 'Username to check')
    .option('--json <filename>', 'Output results to JSON file')
    .option('--csv <filename>', 'Output results to CSV file')
    .option('-o, --output <filename>', 'Output text results to file (default: {username}.txt)')
    .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '15000')
    .option('-c, --concurrency <num>', 'Maximum concurrent requests', '50')
    .option('-r, --retries <num>', 'Number of retries for failed requests', '2')
    .option('--nsfw', 'Include NSFW sites', false)
    .option('--tor', 'Use Tor proxy (requires Tor running on localhost:9050)', false)
    .option('--proxy <url>', 'Use custom proxy (http, https, socks4, socks5)')
    .option('-s, --sites <sites>', 'Only check these sites (comma-separated)')
    .option('-v, --verbose', 'Show progress', false)
    .option('--available-only', 'Only show available usernames', false)
    .option('--taken-only', 'Only show taken usernames', false)
    .action(async (username: string, options) => {
      // Parse options
      const timeout = parseInt(options.timeout, 10);
      const maxConcurrency = parseInt(options.concurrency, 10);
      const retries = parseInt(options.retries, 10);
      const includeNSFW = options.nsfw;
      const useTor = options.tor;
      const proxy = options.proxy;
      const jsonFile = options.json as string | undefined;
      const csvFile = options.csv as string | undefined;
      const outputFile = options.output as string | undefined;
      const verbose = options.verbose;
      const availableOnly = options.availableOnly;
      const takenOnly = options.takenOnly;

      const includeSites = options.sites ? options.sites.split(',').map((s: string) => s.trim()) : undefined;

      // Create checker
      const checker = new UsernameChecker({
        timeout,
        maxConcurrency,
        retries,
        useTor,
        proxy,
      });

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        if (verbose) {
          process.stderr.write('\n');
          console.error(chalk.yellow('\nAborting...'));
        }
        checker.abort();
        process.exit(130);
      });

      try {
        if (verbose) {
          console.error(chalk.blue(`\nChecking username: ${chalk.bold(username)}\n\n`));
        }

        const results = await checker.check(username, {
          sites: includeSites,
          includeNSFW,
          onProgress: (progress) => printProgress(progress, verbose),
        });

        // Clear progress line
        if (verbose) {
          process.stderr.write('\n\n');
        }

        // Filter results if needed
        let filteredResults = results;
        if (availableOnly) {
          filteredResults = results.filter((r) => r.status === 'available');
        } else if (takenOnly) {
          filteredResults = results.filter((r) => r.status === 'taken');
        }

        // Output to files based on format options
        const filesWritten: string[] = [];

        if (jsonFile) {
          const jsonOutput = formatJson(filteredResults);
          writeFileSync(jsonFile, jsonOutput, 'utf-8');
          filesWritten.push(jsonFile);
        }

        if (csvFile) {
          const csvOutput = formatCsv(filteredResults);
          writeFileSync(csvFile, csvOutput, 'utf-8');
          filesWritten.push(csvFile);
        }

        // Default: always write text output (unless only json/csv requested)
        if (!jsonFile && !csvFile) {
          const textFile = outputFile || `${username}.txt`;
          const textOutput = formatText(filteredResults);
          writeFileSync(textFile, textOutput, 'utf-8');
          filesWritten.push(textFile);
        } else if (outputFile) {
          // If -o specified along with --json or --csv, also write text
          const textOutput = formatText(filteredResults);
          writeFileSync(outputFile, textOutput, 'utf-8');
          filesWritten.push(outputFile);
        }

        // Print confirmation
        if (verbose) {
          console.error(chalk.green(`\nOutput written to: ${filesWritten.join(', ')}`));
        }

        // Summary in verbose mode
        if (verbose) {
          const available = results.filter((r) => r.status === 'available').length;
          const taken = results.filter((r) => r.status === 'taken').length;
          const errors = results.filter((r) => r.status === 'error' || r.status === 'unknown').length;

          console.error(chalk.blue('\nSummary:'));
          console.error(`  ${chalk.green('Available:')} ${available}`);
          console.error(`  ${chalk.red('Taken:')} ${taken}`);
          console.error(`  ${chalk.yellow('Errors:')} ${errors}`);
          console.error(`  ${chalk.gray('Total:')} ${results.length}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  await program.parseAsync();
}

// Export main for testing
export { main };

// Only run when executed directly (not when imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  });
}
