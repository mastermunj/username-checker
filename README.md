# Username Checker

username-checker checks username availability across hundreds of bundled sites from Node.js or the command line.

It uses Sherlock-derived site intelligence, but it is built as a TypeScript-first package for Node.js workflows. You can use it as a CLI for quick reconnaissance, or as a library inside scripts, apps, and internal tooling.

## Highlights

- Large bundled site catalog
- Concurrent checks with retry and timeout controls
- Memory, file, and hybrid cache modes
- Proxy and Tor support
- Multiple output formats for CLI usage
- Batch API for checking more than one username
- Debug diagnostics for request and detection troubleshooting

## Installation

Requires Node.js 20.10 or later.

Install locally:

```bash
npm install username-checker
```

Install globally:

```bash
npm install -g username-checker
```

After a global install, both commands are available:

- `username-checker`
- `uc`

## CLI Overview

The CLI is file-oriented by default.

- One username writes one primary report file.
- Multiple usernames write one primary report per username.
- `--format` changes the primary report format.
- `--stdout` prints the primary report to stdout.
- `--json` and `--csv` write additional sidecar reports.
- Debug output is printed to stderr, so it does not corrupt stdout pipelines.

If you run the default text format with a single username:

```bash
uc octocat
```

the CLI writes `octocat.txt` in the current directory.

If you run JSON as the primary format:

```bash
uc octocat --format json
```

the CLI writes `octocat.json`.

## CLI Quick Start

Check one username across the default enabled site set:

```bash
uc octocat
```

Check only specific sites. Site names are resolved case-insensitively:

```bash
uc octocat --sites github,gitlab,reddit
```

Check multiple usernames in one run:

```bash
uc octocat torvalds
```

Write per-user reports into a folder:

```bash
uc octocat torvalds --output-dir reports
```

Print machine-readable output to stdout without writing files:

```bash
uc octocat --format json --stdout --no-write
```

Write sidecar JSON and CSV artifacts in addition to the primary report:

```bash
uc octocat --json results.json --csv results.csv
```

Show only available results:

```bash
uc octocat --available-only
```

Use cache settings explicitly:

```bash
uc octocat --cache hybrid --cache-dir ./.username-checker-cache --cache-ttl 3600000
```

Disable CLI caching entirely:

```bash
uc octocat --cache none
```

Use a custom proxy:

```bash
uc octocat --proxy http://localhost:8080
```

Use Tor:

```bash
uc octocat --tor
```

Inspect excluded manifest entries as well:

```bash
uc octocat --include-excluded
```

## Common CLI Workflows

Developer handle discovery:

```bash
uc myhandle --sites github,gitlab,stackoverflow
```

Brand sweep across many sites with CSV output:

```bash
uc mybrand --format csv --output mybrand.csv
```

Batch checks for a team list:

```bash
uc alice bob charlie --output-dir team-results
```

CI-friendly stdout JSON:

```bash
uc candidate --format json --stdout --no-write
```

Targeted troubleshooting for one site:

```bash
uc octocat --sites github --debug --debug-headers --debug-body --no-write
```

## CLI Options

Site selection:

- `--sites <sites>` limits the run to a comma-separated site list.
- `--nsfw` includes NSFW entries in the candidate site set.
- `--include-excluded` includes manifest entries marked as excluded.

Output:

- `--format <text|json|csv>` sets the primary output format.
- `--output <path>` writes one aggregate primary report to a specific path.
- `--output-dir <directory>` writes per-username primary reports into a directory.
- `--stdout` prints the primary output to stdout.
- `--no-write` disables all file writes.
- `--json <filename>` writes an additional JSON report.
- `--csv <filename>` writes an additional CSV report.

Network and execution controls:

- `--timeout <ms>` controls request timeout.
- `--concurrency <num>` controls maximum concurrent requests.
- `--retries <num>` controls retry attempts.
- `--proxy <url>` uses an HTTP, HTTPS, SOCKS4, or SOCKS5 proxy.
- `--tor` routes requests through Tor on `localhost:9050`.

Cache:

- `--cache <type>` accepts `none`, `memory`, `file`, or `hybrid`.
- `--cache-dir <dir>` sets the file-cache directory.
- `--cache-ttl <ms>` sets cache TTL in milliseconds.

Debugging:

- `--debug` enables debug reporting to stderr.
- `--debug-headers` includes response headers in debug output.
- `--debug-body` includes response bodies in debug output.
- `--debug-max-body <chars>` caps debug body size.

Configuration:

- `--no-config` disables config-file and environment-variable loading for the run.

## Configuration

Configuration precedence is:

1. Explicit CLI flags
2. Environment variables
3. Config file
4. Built-in defaults

Config files are searched in this order:

1. `USERNAME_CHECKER_CONFIG`
2. `./.usernamerc`
3. `./.usernamerc.json`
4. `~/.usernamerc`
5. `~/.usernamerc.json`
6. `$XDG_CONFIG_HOME/usernamerc.json`
7. `$XDG_CONFIG_HOME/username-checker/usernamerc.json`

Config files are JSON today.

Example config:

```json
{
  "timeout": 15000,
  "maxConcurrency": 50,
  "retries": 2,
  "includeNSFW": false,
  "includeExcluded": false,
  "format": "text",
  "defaultSites": ["GitHub", "GitLab", "Reddit"],
  "cache": {
    "type": "hybrid",
    "ttl": 3600000,
    "dir": "./.username-checker-cache"
  }
}
```

`defaultSites` is used when `--sites` is omitted.

Supported environment variables:

- `USERNAME_CHECKER_TIMEOUT`
- `USERNAME_CHECKER_CONCURRENCY`
- `USERNAME_CHECKER_MAX_CONCURRENCY`
- `USERNAME_CHECKER_RETRIES`
- `USERNAME_CHECKER_NSFW`
- `USERNAME_CHECKER_EXCLUDED`
- `USERNAME_CHECKER_TOR`
- `USERNAME_CHECKER_PROXY`
- `USERNAME_CHECKER_FORMAT`
- `USERNAME_CHECKER_CACHE_TYPE`
- `USERNAME_CHECKER_CACHE_TTL`
- `USERNAME_CHECKER_DEFAULT_SITES`
- `USERNAME_CHECKER_CONFIG`

Examples:

```bash
export USERNAME_CHECKER_TIMEOUT=10000
export USERNAME_CHECKER_DEFAULT_SITES=GitHub,GitLab,Reddit
uc octocat
```

```bash
USERNAME_CHECKER_PROXY=http://localhost:8080 uc octocat --format json --stdout --no-write
```

## Library Quick Start

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker();
const results = await checker.check('octocat');

const available = results.filter((result) => result.status === 'available');
console.log('available:', available.length);
```

## Library Examples

Check one username on selected sites:

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker({ timeout: 12000, retries: 1 });
const results = await checker.check('octocat', {
  sites: ['GitHub', 'GitLab'],
});

console.log(results);
```

Batch-check multiple usernames:

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker({ maxConcurrency: 25 });

const batch = await checker.checkBatch(['octocat', 'torvalds'], {
  sites: ['GitHub', 'GitLab'],
  onBatchProgress: (progress) => {
    console.log(
      progress.currentUsername,
      `${progress.currentUsernameIndex + 1}/${progress.totalUsernames}`,
      progress.totalPercentage,
    );
  },
});

console.log(batch);
```

Use a cached checker instance:

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker({
  cache: {
    type: 'hybrid',
    ttl: 60 * 60 * 1000,
    dir: './.username-checker-cache',
  },
});

await checker.check('octocat');
```

Disable caching in library usage:

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker({
  cache: false,
});

await checker.check('octocat');
```

Inspect diagnostics and debug payloads:

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker();

const results = await checker.check('octocat', {
  sites: ['GitHub'],
  debug: {
    includeHeaders: true,
    includeBody: true,
    maxBodyLength: 1500,
  },
});

console.log(results[0].diagnostics);
console.log(results[0].debug);
```

Inject a small custom repository for focused checks or tests:

```ts
import { ManifestRepository, UsernameChecker } from 'username-checker';

const repository = ManifestRepository.fromRawData({
  Example: {
    name: 'Example',
    url: 'https://example.com/{}',
    urlMain: 'https://example.com/',
    errorType: 'status_code',
  },
});

const checker = new UsernameChecker({ repository });
const results = await checker.check('octocat');

console.log(results);
```

## Result Status Meanings

- `available`: the username appears free on that site
- `taken`: the username appears to exist on that site
- `invalid`: the username does not match that site's own constraints
- `unknown`: the request succeeded but the result was not conclusive
- `error`: transport, rate-limit, block, timeout, or upstream failure prevented a reliable answer

## Operational Notes

- Site matching is case-insensitive for `--sites` and library site lists.
- Multiple usernames are processed in order, and the CLI writes one primary file per username by default.
- The CLI's debug report goes to stderr so stdout can stay machine-readable.
- Runtime depends heavily on network conditions, site selection, timeout, retries, and concurrency.
- Slower cache and concurrency tests are expected locally because they intentionally exercise timers, expiration, and throttling paths.

## Attribution

This project is independent software, but it builds on upstream work from the Sherlock project:

- Sherlock repository: https://github.com/sherlock-project/sherlock
- Published site manifest: https://data.sherlockproject.xyz

The bundled site catalog, schema checks, and false-positive exclusions are synced from Sherlock sources and adapted to this package's TypeScript runtime and CLI/library API. username-checker is not the Sherlock CLI, and it is not affiliated with or endorsed by the Sherlock maintainers.
