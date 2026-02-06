# Username Checker

[![npm version](https://img.shields.io/npm/v/username-checker.svg)](https://www.npmjs.com/package/username-checker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Check username availability across 478 social networks, coding platforms, and online services. Inspired by the [Sherlock Project](https://github.com/sherlock-project/sherlock).

## Features

- **478 supported sites** - Social networks, coding platforms, gaming, creative communities, and more
- **Multiple detection methods** - Status code, error message, and redirect-based detection
- **Concurrent checking** - Check multiple sites simultaneously with rate limiting
- **Proxy & Tor support** - Route requests through HTTP/SOCKS proxies or Tor
- **Retry logic** - Exponential backoff for failed requests
- **OOP design** - Clean class-based API with static utility methods
- **CLI included** - Command-line interface similar to Sherlock
- **TypeScript support** - Full type definitions included
- **ESM native** - Pure ES modules
- **Zero browser dependencies** - Pure Node.js (18+)

## Installation

```bash
npm install username-checker
```

## Quick Start

### As a Library

#### ESM (recommended)

```typescript
import { UsernameChecker } from 'username-checker';

const checker = new UsernameChecker();

// Check username across all sites
const results = await checker.check('octocat');

console.log(`Checked ${results.length} sites`);
const available = results.filter(r => r.status === 'available');
const taken = results.filter(r => r.status === 'taken');

console.log(`Available: ${available.length}`);
console.log(`Taken: ${taken.length}`);

// Print available sites
available.forEach(r => console.log(`✓ ${r.siteName}: ${r.url}`));

// Check specific sites
const filtered = await checker.check('octocat', {
  sites: ['GitHub', 'Twitter', 'Reddit'],
});

// Get total site count
console.log(`Total sites: ${UsernameChecker.getSiteCount()}`);
```

### As a CLI

```bash
# Check a username across all sites (outputs to octocat.txt)
npx username-checker octocat

# Check specific sites only
npx username-checker octocat --sites GitHub,Twitter,Reddit

# Output as JSON to a file
npx username-checker octocat --json results.json

# Output as CSV to a file
npx username-checker octocat --csv results.csv

# Custom output filename for text format
npx username-checker octocat -o custom-output.txt

# Use a proxy
npx username-checker octocat --proxy http://localhost:8080

# Use Tor (requires Tor to be running on port 9050)
npx username-checker octocat --tor
```

## CLI Options

```
Usage: username-checker [options] <username>

Arguments:
  username                    Username to check

Options:
  -s, --sites <sites>         Only check specific sites (comma-separated)
  --nsfw                      Include NSFW sites
  --timeout <ms>              Request timeout in milliseconds (default: 15000)
  --proxy <url>               Proxy URL (http:// or socks5://)
  --tor                       Use Tor (socks5://127.0.0.1:9050)
  --retries <n>               Maximum retry attempts (default: 2)
  --json <filename>           Output results as JSON to file
  --csv <filename>            Output results as CSV to file
  -o, --output <filename>     Custom output filename (default: {username}.txt)
  --available-only            Only show available usernames
  --taken-only                Only show taken usernames
  -v, --verbose               Show detailed output
  -V, --version               Output version number
  -h, --help                  Display help
```

By default, results are saved to `{username}.txt` in a text format similar to Sherlock.

## API Reference

### `UsernameChecker`

Main class for checking username availability.

#### Constructor Options

```typescript
const checker = new UsernameChecker({
  // Request timeout in ms (default: 15000)
  timeout: 15000,

  // Max concurrent requests (default: 50)
  maxConcurrency: 50,

  // Retry attempts (default: 2)
  retries: 2,

  // Include NSFW sites (default: false)
  includeNSFW: false,

  // Use Tor proxy (default: false)
  useTor: false,

  // Custom proxy URL
  proxy: 'http://localhost:8080',
});
```

#### Methods

##### `check(username, options?)`

Check username availability across sites.

```typescript
const results = await checker.check('octocat', {
  // Specific sites to check
  sites: ['GitHub', 'Twitter'],
  
  // Include NSFW sites
  includeNSFW: false,
  
  // Progress callback
  onProgress: (progress) => {
    console.log(`${progress.completed}/${progress.total} (${progress.percentage}%)`);
  },
  
  // AbortSignal for cancellation
  signal: controller.signal,
});
```

Returns `CheckResult[]`:

```typescript
interface CheckResult {
  site: string;           // Site key
  siteName: string;       // Display name
  url: string;            // Profile URL
  status: 'available' | 'taken' | 'error' | 'unknown' | 'invalid';
  httpStatus?: number;
  responseTime: number;
  errorCategory: ErrorCategory;
  errorMessage?: string;
}
```

##### `checkSite(username, siteKey, config?)`

Check username on a single site.

```typescript
const result = await checker.checkSite('octocat', 'GitHub');
console.log(result.status); // 'taken' or 'available'
```

##### `abort()`

Abort running check operations.

```typescript
checker.abort();
```

#### Static Methods

```typescript
// Get site count
UsernameChecker.getSiteCount(); // 478

// Check if site exists
UsernameChecker.hasSite('GitHub'); // true

// Get site config
UsernameChecker.getSite('GitHub'); // SiteConfig | undefined
```

## Supported Sites

Supports 478 sites including GitHub, Twitter, Instagram, Reddit, YouTube, TikTok, Discord, LinkedIn, and many more.

See [SITES.md](SITES.md) for the complete alphabetical list.

Use `--sites Site1,Site2` in CLI or pass `sites: ['Site1', 'Site2']` in the check options.

## Requirements

- Node.js 18+ (uses native `fetch` API)

## Acknowledgments

This project is inspired by the [Sherlock Project](https://github.com/sherlock-project/sherlock), an excellent Python tool for finding social media accounts by username. The site detection patterns and methodology are adapted from their work.

## License

[MIT](LICENSE)
