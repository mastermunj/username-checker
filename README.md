# Username Checker

[![npm version](https://img.shields.io/npm/v/username-checker)](https://www.npmjs.com/package/username-checker)
[![Node.js](https://img.shields.io/node/v/username-checker)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/mastermunj/username-checker/actions/workflows/release-please.yml/badge.svg)](https://github.com/mastermunj/username-checker/actions)

TypeScript-first username checking for Node.js, inspired by Sherlock's site intelligence.

username-checker checks username availability across 478 bundled sites. Use it as a CLI for quick reconnaissance, or as a library inside scripts, apps, and internal tooling.

## Table of Contents

- [Highlights](#highlights)
- [Installation](#installation)
- [CLI Quick Start](#cli-quick-start)
- [Common CLI Workflows](#common-cli-workflows)
- [CLI Reference](#cli-reference)
- [Configuration](#configuration)
- [Library Quick Start](#library-quick-start)
- [Library Examples](#library-examples)
- [Library Reference](#library-reference)
  - [UsernameChecker](#usernamechecker)
  - [CheckResult](#checkresult)
  - [ErrorCategory](#errorcategory)
  - [BatchCheckResult](#batchcheckresult)
  - [CheckResultCache](#checkresultcache)
  - [ManifestRepository](#manifestrepository)
  - [ConfigLoader](#configloader)
- [How Detection Works](#how-detection-works)
- [Site Catalog](#site-catalog)
- [Operational Notes](#operational-notes)
- [Attribution](#attribution)

## Highlights

- 478 bundled sites derived from Sherlock's site intelligence
- Concurrent checks with per-domain rate limiting, retry, and timeout controls
- Memory, file, and hybrid cache modes with configurable TTL
- Proxy (HTTP, HTTPS, SOCKS4, SOCKS5) and Tor support
- Three output formats: text, JSON, CSV — with per-username file output
- Batch API for checking multiple usernames in one pass
- Live progress callbacks for both single and batch checks
- Cancellation via `AbortSignal`
- Debug diagnostics for request and detection troubleshooting
- Config file (`.usernamerc`) and environment variable support

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

```bash
username-checker --help
uc --help
```

## CLI Quick Start

Check one username across all enabled sites:

```bash
uc octocat
```

This writes `octocat.txt` in the current directory. To print to stdout instead:

```bash
uc octocat --stdout --no-write
```

Check specific sites (case-insensitive names):

```bash
uc octocat -s github,gitlab,reddit
```

Check multiple usernames and write per-user reports into a folder:

```bash
uc octocat torvalds --output-dir reports
```

Show live progress during a long run:

```bash
uc octocat --verbose
```

Print machine-readable JSON without writing files:

```bash
uc octocat --format json --stdout --no-write
```

## Common CLI Workflows

**Developer handle discovery:**

```bash
uc myhandle -s github,gitlab,stackoverflow,npm
```

**Brand sweep with CSV output:**

```bash
uc mybrand --format csv -o mybrand.csv
```

**Batch check a team list with per-user reports:**

```bash
uc alice bob charlie --output-dir team-results
```

**Write sidecar JSON and CSV alongside the primary text report:**

```bash
uc octocat --json results.json --csv results.csv
```

**CI-friendly stdout JSON (available handles only):**

```bash
uc candidate --format json --stdout --no-write --available-only
```

**Targeted troubleshooting for one site:**

```bash
uc octocat -s github --debug --debug-headers --debug-body --no-write
```

**Filter results:**

```bash
uc octocat --available-only   # show only available
uc octocat --taken-only       # show only taken
```

**Use Tor or a custom proxy:**

```bash
uc octocat --tor
uc octocat --proxy socks5://127.0.0.1:1080
```

**Include sites normally excluded due to unreliable detection:**

```bash
uc octocat --include-excluded
```

## CLI Reference

### Usage

```
uc <usernames...> [options]
```

### Site Selection

| Flag                 | Short | Description                                     |
| -------------------- | ----- | ----------------------------------------------- |
| `--sites <sites>`    | `-s`  | Comma-separated list of site names to check     |
| `--nsfw`             |       | Include NSFW sites                              |
| `--include-excluded` |       | Include sites marked unreliable in the manifest |

### Output

| Flag                 | Short | Default | Description                                          |
| -------------------- | ----- | ------- | ---------------------------------------------------- |
| `--format <fmt>`     | `-f`  | `text`  | Primary output format: `text`, `json`, or `csv`      |
| `--output <path>`    | `-o`  |         | Write an aggregate primary report to a specific path |
| `--output-dir <dir>` |       |         | Write per-username primary reports into a directory  |
| `--stdout`           |       | `false` | Print the primary output to stdout                   |
| `--no-write`         |       |         | Disable all file writes                              |
| `--json <filename>`  |       |         | Write an additional JSON sidecar report              |
| `--csv <filename>`   |       |         | Write an additional CSV sidecar report               |
| `--available-only`   |       | `false` | Only include available results in output             |
| `--taken-only`       |       | `false` | Only include taken results in output                 |
| `--verbose`          | `-v`  | `false` | Print live progress to stderr                        |

### Network and Execution

| Flag                | Short | Default | Description                                    |
| ------------------- | ----- | ------- | ---------------------------------------------- |
| `--timeout <ms>`    | `-t`  | `15000` | Request timeout in milliseconds                |
| `--concurrency <n>` | `-c`  | `50`    | Maximum concurrent requests                    |
| `--retries <n>`     | `-r`  | `2`     | Retry attempts on failure                      |
| `--proxy <url>`     |       |         | HTTP, HTTPS, SOCKS4, or SOCKS5 proxy URL       |
| `--tor`             |       | `false` | Route requests through Tor on `localhost:9050` |

### Cache

| Flag                | Default                     | Description                                       |
| ------------------- | --------------------------- | ------------------------------------------------- |
| `--cache <type>`    | `memory`                    | Cache mode: `none`, `memory`, `file`, or `hybrid` |
| `--cache-dir <dir>` | `./.username-checker-cache` | Directory for file-based cache                    |
| `--cache-ttl <ms>`  | `3600000`                   | Cache time-to-live in milliseconds (1 hour)       |

### Debugging

| Flag                   | Default | Description                                     |
| ---------------------- | ------- | ----------------------------------------------- |
| `--debug`              | `false` | Print per-site debug details to stderr          |
| `--debug-headers`      | `false` | Include response headers in debug output        |
| `--debug-body`         | `false` | Include response bodies in debug output         |
| `--debug-max-body <n>` | `2000`  | Maximum characters to capture per response body |

### Configuration

| Flag          | Description                                                       |
| ------------- | ----------------------------------------------------------------- |
| `--no-config` | Disable config file and environment variable loading for this run |

### Output Behaviour

The CLI is file-oriented by default:

- One username → one primary report file (`<username>.<ext>`)
- Multiple usernames → one primary file per username, unless `--output` is given
- `--output-dir` places per-username files inside that directory
- `--stdout` prints the primary report to stdout; use with `--no-write` to suppress file creation
- `--json` and `--csv` write sidecar reports alongside the primary output
- Debug output always goes to stderr so stdout pipelines remain machine-readable

## Configuration

Configuration is layered. Later sources override earlier ones for the same key:

1. Built-in defaults
2. Config file
3. Environment variables
4. Explicit CLI flags (highest priority)

### Config File

Config files are searched in this order:

1. Path in `USERNAME_CHECKER_CONFIG` env var
2. `./.usernamerc`
3. `./.usernamerc.json`
4. `~/.usernamerc`
5. `~/.usernamerc.json`
6. `$XDG_CONFIG_HOME/usernamerc.json`
7. `$XDG_CONFIG_HOME/username-checker/usernamerc.json`

Config files use JSON format:

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

`defaultSites` restricts which sites are checked when `--sites` is omitted.

### Environment Variables

| Variable                           | Description                             |
| ---------------------------------- | --------------------------------------- |
| `USERNAME_CHECKER_TIMEOUT`         | Request timeout in ms                   |
| `USERNAME_CHECKER_CONCURRENCY`     | Alias for `maxConcurrency`              |
| `USERNAME_CHECKER_MAX_CONCURRENCY` | Maximum concurrent requests             |
| `USERNAME_CHECKER_RETRIES`         | Retry attempts                          |
| `USERNAME_CHECKER_NSFW`            | `true`/`false` — include NSFW sites     |
| `USERNAME_CHECKER_EXCLUDED`        | `true`/`false` — include excluded sites |
| `USERNAME_CHECKER_TOR`             | `true`/`false` — use Tor                |
| `USERNAME_CHECKER_PROXY`           | Proxy URL                               |
| `USERNAME_CHECKER_FORMAT`          | Default output format                   |
| `USERNAME_CHECKER_CACHE_TYPE`      | Cache mode                              |
| `USERNAME_CHECKER_CACHE_TTL`       | Cache TTL in ms                         |
| `USERNAME_CHECKER_DEFAULT_SITES`   | Comma-separated default site list       |
| `USERNAME_CHECKER_CONFIG`          | Explicit path to config file            |

Boolean env vars accept `true`/`1`/`yes` or `false`/`0`/`no`.

Examples:

```bash
export USERNAME_CHECKER_TIMEOUT=10000
export USERNAME_CHECKER_DEFAULT_SITES=GitHub,GitLab,Reddit
uc octocat
```

```bash
USERNAME_CHECKER_PROXY=socks5://127.0.0.1:1080 uc octocat --format json --stdout --no-write
```

## Library Quick Start

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker();
const results = await checker.check('octocat');

const available = results.filter((r) => r.status === 'available');
console.log(`Available on ${available.length} sites`);
```

## Library Examples

### Check with site filter and custom options

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker({ timeout: 12000, retries: 1 });
const results = await checker.check('octocat', {
  sites: ['GitHub', 'GitLab', 'npm'],
});

for (const result of results) {
  console.log(result.siteName, result.status, result.url);
}
```

### Live progress during a single-username check

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker();
const results = await checker.check('octocat', {
  onProgress: (p) => {
    process.stdout.write(`\r${p.completed}/${p.total} (${p.percentage}%)`);
  },
});
console.log('\nDone');
```

### Batch check multiple usernames

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker({ maxConcurrency: 25 });

const batch = await checker.checkBatch(['octocat', 'torvalds'], {
  sites: ['GitHub', 'GitLab'],
  onBatchProgress: (p) => {
    console.log(`${p.currentUsername} — ${p.currentUsernameIndex + 1}/${p.totalUsernames}`, `(${p.totalPercentage}%)`);
  },
});

for (const entry of batch) {
  console.log(entry.username, entry.summary);
}
```

### Cancellation with AbortController

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker();
const controller = new AbortController();

// Cancel after 10 seconds
setTimeout(() => controller.abort(), 10_000);

const results = await checker.check('octocat', {
  signal: controller.signal,
});
```

### Proxy and Tor

```ts
import { UsernameChecker } from 'username-checker';

// HTTP/HTTPS/SOCKS proxy
const checker = new UsernameChecker({ proxy: 'socks5://127.0.0.1:1080' });

// Tor (requires Tor running on localhost:9050)
const torChecker = new UsernameChecker({ useTor: true });
```

### Cache modes

```ts
import { UsernameChecker } from 'username-checker';

// Memory cache (default) — fast, not persistent across runs
const memChecker = new UsernameChecker({ cache: { type: 'memory', ttl: 60_000 } });

// File cache — persists to disk across runs
const fileChecker = new UsernameChecker({
  cache: { type: 'file', ttl: 3_600_000, dir: './.username-checker-cache' },
});

// Hybrid — memory for speed, file for persistence
const hybridChecker = new UsernameChecker({
  cache: { type: 'hybrid', ttl: 3_600_000 },
});

// Disable caching entirely
const noCache = new UsernameChecker({ cache: false });
```

### Debug diagnostics

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

const r = results[0];
console.log(r.diagnostics); // probeUrl, requestMethod, detectionMethods, followRedirects, finalUrl
console.log(r.debug); // statusCode, responseHeaders, responseBody
```

### Custom site repository

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

### Error handling

```ts
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker();

try {
  const results = await checker.check('octocat', {
    sites: ['GitHub', 'UnknownSite'],
  });
} catch (err) {
  // Thrown when a site name cannot be resolved.
  // The error message includes fuzzy suggestions:
  //   "Unknown site: "UnknownSite" (did you mean GitHub?)"
  console.error(err.message);
}

try {
  await checker.check(''); // throws: "Invalid username: Username cannot be empty"
} catch (err) {
  console.error(err.message);
}
```

### TypeScript type imports

```ts
import type {
  CheckResult,
  CheckOptions,
  CheckProgress,
  BatchCheckResult,
  BatchCheckOptions,
  BatchCheckProgress,
  CacheOptions,
  DebugOptions,
  CheckDiagnostics,
  CheckDebugData,
  ErrorCategory,
  AvailabilityStatus,
} from 'username-checker';
```

## Library Reference

### UsernameChecker

```ts
new UsernameChecker(options?: CheckOptions)
```

#### Constructor options

| Option            | Type                    | Default          | Description                                |
| ----------------- | ----------------------- | ---------------- | ------------------------------------------ |
| `timeout`         | `number`                | `15000`          | Request timeout in ms                      |
| `maxConcurrency`  | `number`                | `50`             | Maximum concurrent requests                |
| `retries`         | `number`                | `2`              | Retry attempts on failure                  |
| `includeNSFW`     | `boolean`               | `false`          | Include NSFW sites by default              |
| `includeExcluded` | `boolean`               | `false`          | Include excluded sites by default          |
| `useTor`          | `boolean`               | `false`          | Route requests through Tor                 |
| `proxy`           | `string`                |                  | HTTP, HTTPS, SOCKS4, or SOCKS5 proxy URL   |
| `cache`           | `CacheOptions \| false` | `false`          | Cache configuration, or `false` to disable |
| `repository`      | `SiteRepository`        | bundled manifest | Custom site repository                     |

#### `checker.check(username, options?)`

Check a single username across sites. Returns `Promise<CheckResult[]>`.

Throws if the username is invalid or if any specified site name cannot be resolved.

| Option            | Type                         | Description                                  |
| ----------------- | ---------------------------- | -------------------------------------------- |
| `sites`           | `string[]`                   | Limit to these site names (case-insensitive) |
| `includeNSFW`     | `boolean`                    | Override instance-level setting              |
| `includeExcluded` | `boolean`                    | Override instance-level setting              |
| `onProgress`      | `(p: CheckProgress) => void` | Called after each site completes             |
| `signal`          | `AbortSignal`                | Cancellation signal                          |
| `debug`           | `DebugOptions`               | Enable diagnostic data on results            |

#### `checker.checkBatch(usernames, options?)`

Check multiple usernames in sequence. Returns `Promise<BatchCheckResult[]>`.

Accepts all options from `check()`, plus:

| Option            | Type                              | Description                                                       |
| ----------------- | --------------------------------- | ----------------------------------------------------------------- |
| `onBatchProgress` | `(p: BatchCheckProgress) => void` | Called at the start of each username and on every site completion |

#### `checker.checkSite(username, siteKey, config?, signal?, debug?)`

Check a single username against a single named site. Returns `Promise<CheckResult>`. Useful for targeted checks or custom retry loops.

### CheckResult

```ts
interface CheckResult {
  site: string; // canonical site key
  siteName: string; // human-readable name
  url: string; // profile URL for this username
  status: AvailabilityStatus; // 'available' | 'taken' | 'invalid' | 'unknown' | 'error'
  httpStatus?: number; // raw HTTP status code
  responseTime: number; // request duration in ms
  errorCategory: ErrorCategory;
  errorMessage?: string;
  diagnostics?: CheckDiagnostics; // present when debug is enabled
  debug?: CheckDebugData; // present when debug is enabled
}
```

#### `AvailabilityStatus` values

| Value       | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `available` | Username appears to be free on that site                   |
| `taken`     | Username appears to exist on that site                     |
| `invalid`   | Username does not match the site's own format constraints  |
| `unknown`   | Request succeeded but detection was inconclusive           |
| `error`     | Transport, rate-limit, block, timeout, or upstream failure |

#### `CheckDiagnostics` (when `debug` is enabled)

```ts
interface CheckDiagnostics {
  probeUrl: string;
  requestMethod: 'GET' | 'POST' | 'HEAD' | 'PUT';
  detectionMethods: DetectionMethod[];
  followRedirects: boolean;
  finalUrl?: string;
  errorCodes?: number[];
}
```

#### `CheckDebugData` (when `debug` is enabled)

```ts
interface CheckDebugData {
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}
```

### ErrorCategory

The `errorCategory` field distinguishes the root cause when `status` is `error`:

| Value              | Meaning                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `timeout`          | Request exceeded the configured timeout                            |
| `rate_limited`     | Site returned HTTP 429 or equivalent                               |
| `blocked`          | WAF, Cloudflare challenge, or bot detection blocked the request    |
| `server_error`     | Site returned a 5xx response                                       |
| `connection_error` | DNS, TCP, or TLS failure                                           |
| `unknown`          | Error could not be classified                                      |
| `none`             | No error — result is `available`, `taken`, `invalid`, or `unknown` |

### BatchCheckResult

```ts
interface BatchCheckResult {
  username: string;
  normalizedUsername: string; // trimmed and lowercased form
  results: CheckResult[];
  summary: {
    total: number;
    available: number;
    taken: number;
    errors: number;
  };
}
```

#### `BatchCheckProgress`

```ts
interface BatchCheckProgress {
  currentUsername: string;
  currentUsernameIndex: number; // 0-based
  totalUsernames: number;
  usernamePercentage: number; // 0–100 for the current username's sites
  totalPercentage: number; // 0–100 across all usernames and sites
  siteProgress?: CheckProgress; // site-level progress for the current username
}
```

### CheckResultCache

`CheckResultCache` is a standalone cache you can use independently of `UsernameChecker`, for example to pre-warm entries or share a single cache across multiple checker instances.

```ts
import { CheckResultCache } from 'username-checker';

const cache = new CheckResultCache({ type: 'hybrid', ttl: 3_600_000 });

// Query
const cached = cache.get('GitHub', 'octocat'); // CheckResult | null

// Store
cache.set('GitHub', 'octocat', result);

// Check existence without reading
cache.has('GitHub', 'octocat'); // boolean

// Inspect cache size
const { type, memorySize, fileSize } = cache.stats();

// Clear all entries
cache.clear();
```

#### `CacheOptions`

| Option    | Type                             | Default                     | Description                          |
| --------- | -------------------------------- | --------------------------- | ------------------------------------ |
| `type`    | `'memory' \| 'file' \| 'hybrid'` | `'memory'`                  | Cache backend                        |
| `ttl`     | `number`                         | `3600000`                   | Time-to-live in ms (1 hour)          |
| `dir`     | `string`                         | `./.username-checker-cache` | Directory for file-based caches      |
| `maxSize` | `number`                         | `1000`                      | Maximum entries for the memory cache |

### ManifestRepository

`ManifestRepository` implements `SiteRepository` and provides case-insensitive site resolution with fuzzy suggestions.

```ts
import { ManifestRepository } from 'username-checker';

// Use the pre-built repository for the bundled manifest
import { defaultManifestRepository } from 'username-checker'; // re-exported from Sites.ts
```

#### Static factories

```ts
// From Sherlock-format raw JSON data
const repo = ManifestRepository.fromRawData({
  GitHub: {
    name: 'GitHub',
    url: 'https://github.com/{}',
    urlMain: 'https://github.com/',
    errorType: 'status_code',
  },
});

// From an array of SiteConfig objects
const repo = ManifestRepository.fromSiteConfigs([
  { name: 'GitHub', url: 'https://github.com/{}', urlMain: 'https://github.com/', errorType: 'status_code' },
]);
```

#### Instance methods

```ts
repo.has('GitHub'); // boolean — case-insensitive
repo.get('github'); // SiteConfig | undefined
repo.resolveKey('GITHUB'); // 'GitHub' | undefined (canonical key)
repo.suggestKeys('githb', 3); // string[] — fuzzy suggestions
repo.count(); // number of non-excluded sites
repo.count({ includeExcluded: true }); // total including excluded
repo.filter({ includeNSFW: true }); // SiteEntry[] — { key, config }
repo.resolveKeys(['GitHub', 'typo']); // { resolvedKeys: string[], missing: [...] }
```

### ConfigLoader

`ConfigLoader` exposes the same configuration loading pipeline the CLI uses internally.

```ts
import { ConfigLoader } from 'username-checker';

const config = ConfigLoader.loadConfig();
// Returns a ConfigOptions object merged from config file + env vars.
// CLI flags are not included — apply those on top manually.

console.log(config.timeout);
console.log(config.defaultSites);
```

## How Detection Works

Each site entry in the manifest specifies one of three detection strategies:

| Strategy       | Description                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status_code`  | The site returns a distinct HTTP status for missing profiles (typically 404). A 2xx indicates the username is taken.                                                                     |
| `message`      | The site always returns 200. Detection compares the response body against a known error string present only when the profile is missing. If the string is absent, the username is taken. |
| `response_url` | The site redirects missing profiles to a known URL. Detection checks the final URL after following redirects.                                                                            |

Sites may declare multiple strategies as an array; all must pass for a `taken` determination. Sites marked `isExcluded` are in the manifest but excluded from default runs because their detection is known to produce false positives.

## Site Catalog

The bundled manifest contains **478 sites** (419 enabled, 38 excluded, 19 NSFW). See [SITES.md](SITES.md) for the full list with detection strategy and URL for each entry.

To regenerate the manifest from the upstream Sherlock project:

```bash
node scripts/sync-sites.mjs
```

## Operational Notes

- Site name matching is case-insensitive everywhere: `--sites Github` and `--sites github` are equivalent.
- When a site name cannot be resolved, the error message includes fuzzy suggestions.
- Multiple usernames are processed in order; `onBatchProgress` fires at the start of each username.
- Runtime depends heavily on network conditions, site selection, timeout, retries, and concurrency.
- The CLI's debug output always goes to stderr so stdout can remain machine-readable.
- The `--cache` default is `memory`, which only persists for the lifetime of a single CLI invocation. Use `file` or `hybrid` for cross-run persistence.

## Attribution

This project is independent software, but it builds on upstream site intelligence from the Sherlock project:

- Sherlock repository: https://github.com/sherlock-project/sherlock
- Published site manifest: https://data.sherlockproject.xyz

The bundled site catalog, schema checks, and false-positive exclusions are synced from Sherlock sources and adapted to this package's TypeScript runtime and CLI/library API. username-checker is not the Sherlock CLI, and it is not affiliated with or endorsed by the Sherlock maintainers.
