# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Use the private **GitHub Security Advisory** form instead:

-> [Report a vulnerability privately](https://github.com/mastermunj/username-checker/security/advisories/new)

We will:

- Acknowledge your report within **48 hours**.
- Provide an estimated fix timeline within **5 business days**.
- Release a patch and publish a coordinated disclosure once the fix is available.

## Scope

| In scope | Examples                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------- |
| Yes      | Unsafe handling that could lead to arbitrary code execution, path traversal, or credential leakage |
| Yes      | Supply chain issues such as malicious dependencies or compromised release artifacts                |
| Yes      | Vulnerabilities that allow misuse of network or proxy features beyond intended behavior            |
| No       | Incorrect availability results for a site or username                                              |
| No       | Missing site support, detector accuracy gaps, or manifest regressions without a security impact    |

## Disclosure

Please give us a reasonable opportunity to investigate and patch the issue before any public disclosure.

We will coordinate on release timing and advisory details once a fix is ready.
