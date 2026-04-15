#!/usr/bin/env node
/**
 * CLI for username-checker
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { UsernameChecker } from './UsernameChecker.js';
import { ConfigLoader } from './ConfigLoader.js';
import { RunLifecycle } from './RunLifecycle.js';
import {
  buildDebugOptions,
  filterResults,
  parseCliOptions,
  parseNumericOption,
  parseOutputFormat,
  printProgress as printProgressInternal,
  runCliExecution,
  summarizeReports,
  type CliExecutionResult,
  type RawCliActionOptions,
} from './CliExecution.js';
import {
  buildAdditionalOutputWrites,
  buildOutputBasenames,
  buildPrimaryOutputWrites,
  ensureParentDirectory,
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
  sanitizeOutputBasename,
  type OutputFormat,
  type OutputWrite,
  type UsernameReport,
} from './CliReporting.js';
import packageJson from '../package.json' with { type: 'json' };

export {
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
  parseCliOptions,
  parseNumericOption,
  parseOutputFormat,
  runCliExecution,
  sanitizeOutputBasename,
  summarizeReports,
  type CliExecutionResult,
  type OutputFormat,
  type OutputWrite,
  type UsernameReport,
};

export function printProgress(progress: import('./types.js').CheckProgress, verbose: boolean): void {
  printProgressInternal(progress, verbose, chalk);
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
    .argument('<usernames...>', 'Username(s) to check')
    .option('-f, --format <format>', 'Primary output format: text, json, csv', 'text')
    .option('--json <filename>', 'Output results to JSON file')
    .option('--csv <filename>', 'Output results to CSV file')
    .option('-o, --output <path>', 'Primary output file path')
    .option('--output-dir <directory>', 'Directory for per-username output files')
    .option('--stdout', 'Print the primary output to stdout', false)
    .option('--no-write', 'Do not write primary or additional output files')
    .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '15000')
    .option('-c, --concurrency <num>', 'Maximum concurrent requests', '50')
    .option('-r, --retries <num>', 'Number of retries for failed requests', '2')
    .option('--nsfw', 'Include NSFW sites', false)
    .option('--include-excluded', 'Include sites marked as excluded in the bundled manifest')
    .option('--tor', 'Use Tor proxy (requires Tor running on localhost:9050)', false)
    .option('--proxy <url>', 'Use custom proxy (http, https, socks4, socks5)')
    .option('-s, --sites <sites>', 'Only check these sites (comma-separated)')
    .option('--cache <type>', 'Cache results: none, memory, file, or hybrid', 'memory')
    .option('--cache-dir <dir>', 'Directory for file-based cache', './.username-checker-cache')
    .option('--cache-ttl <ms>', 'Cache time-to-live in milliseconds', '3600000')
    .option('--no-config', 'Disable config file loading')
    .option('-v, --verbose', 'Show progress', false)
    .option('--available-only', 'Only show available usernames', false)
    .option('--taken-only', 'Only show taken usernames', false)
    .option('--debug', 'Print targeted debug details to stderr', false)
    .option('--debug-headers', 'Include response headers in debug output', false)
    .option('--debug-body', 'Include response body in debug output', false)
    .option('--debug-max-body <chars>', 'Maximum characters to include in debug bodies', '2000')
    .action(async (usernames: string[], options: RawCliActionOptions & { config: boolean }) => {
      const lifecycle = new RunLifecycle();
      try {
        const getCliValue = <T>(optionName: string): T | undefined => {
          return program.getOptionValueSource(optionName) === 'cli'
            ? (options[optionName as keyof typeof options] as T | undefined)
            : undefined;
        };

        // Load configuration from file and environment variables.
        /* v8 ignore start */
        const config = options.config === false ? {} : ConfigLoader.loadConfig();

        const timeout = getCliValue<string>('timeout') ?? String(config.timeout ?? 15000);
        const maxConcurrency = getCliValue<string>('concurrency') ?? String(config.maxConcurrency ?? 50);
        const retries = getCliValue<string>('retries') ?? String(config.retries ?? 2);
        const format = getCliValue<string>('format') ?? config.format ?? 'text';
        const sites = getCliValue<string>('sites') ?? config.defaultSites?.join(',');
        const useTor = getCliValue<boolean>('tor') ?? config.useTor ?? false;
        const proxy = getCliValue<string>('proxy') ?? config.proxy;
        const nsfw = getCliValue<boolean>('nsfw') ?? config.includeNSFW ?? false;
        const includeExcluded = getCliValue<boolean>('includeExcluded') ?? config.includeExcluded ?? false;
        const cacheType = getCliValue<string>('cache') ?? config.cache?.type ?? 'memory';
        const cacheTtl = getCliValue<string>('cacheTtl') ?? String(config.cache?.ttl ?? 3600000);
        const cacheDir = getCliValue<string>('cacheDir') ?? config.cache?.dir ?? './.username-checker-cache';
        const cache =
          cacheType !== 'none'
            ? {
                type: cacheType as 'memory' | 'file' | 'hybrid',
                ttl: parseNumericOption('cache TTL', cacheTtl, 0),
                dir: cacheDir,
              }
            : false;
        /* v8 ignore stop */

        const parsed = parseCliOptions(usernames, {
          ...options,
          format,
          timeout,
          concurrency: maxConcurrency,
          retries,
          sites,
          tor: useTor,
          proxy,
          nsfw,
          includeExcluded,
          cache: cacheType,
          cacheDir,
          cacheTtl,
        });

        if (!parsed.write && !parsed.stdout && parsed.verbose) {
          console.error(chalk.gray('No file output requested; verbose mode will only show progress and summaries.'));
        }

        const checker = new UsernameChecker({
          timeout: parsed.timeout,
          maxConcurrency: parsed.maxConcurrency,
          retries: parsed.retries,
          useTor: parsed.useTor,
          proxy: parsed.proxy,
          cache,
        });

        lifecycle.addProcessSignal('SIGINT', () => {
          if (parsed.verbose) {
            process.stderr.write('\n');
            console.error(chalk.yellow('\nAborting...'));
          }
          checker.abort();
          process.exit(130);
        });

        await runCliExecution(
          checker,
          {
            ...parsed,
            signal: lifecycle.signal,
          },
          {
            onUsernameStart: (username, index, total) => {
              if (!parsed.verbose) {
                return;
              }

              const prefix = total > 1 ? ` (${index + 1}/${total})` : '';
              console.error(chalk.blue(`\nChecking username${prefix}: ${chalk.bold(username)}\n\n`));
            },
            onUsernameComplete: () => {
              if (parsed.verbose) {
                process.stderr.write('\n\n');
              }
            },
            onProgress: (progress) => printProgressInternal(progress, parsed.verbose, chalk),
            onFilesWritten: (filesWritten) => {
              if (parsed.verbose && filesWritten.length > 0) {
                console.error(chalk.green(`\nOutput written to: ${filesWritten.join(', ')}`));
              }
            },
            onNoFilesWritten: () => {
              if (parsed.verbose && !parsed.write) {
                console.error(chalk.gray('\nNo files written (--no-write)'));
              }
            },
            onSummary: (summary) => {
              if (!parsed.verbose) {
                return;
              }

              console.error(chalk.blue('\nSummary:'));
              console.error(`  ${chalk.green('Available:')} ${summary.available}`);
              console.error(`  ${chalk.red('Taken:')} ${summary.taken}`);
              console.error(`  ${chalk.yellow('Errors:')} ${summary.errors}`);
              console.error(`  ${chalk.gray('Total:')} ${summary.total}`);
            },
            onDebugOutput: (output) => {
              console.error(chalk.yellow('\nDebug Report:'));
              console.error(output);
            },
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      } finally {
        lifecycle.dispose();
      }
    });

  await program.parseAsync();
}

// Export main for testing
export { main };

// Only run when executed directly (not when imported)
/* v8 ignore start */
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  });
}
/* v8 ignore stop */
