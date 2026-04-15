#!/usr/bin/env node
/* global console, process, fetch */

/**
 * Sync sites data from Sherlock Project
 * Fetches the latest data.json from Sherlock's GitHub repository
 * and generates src/sites.json in our format.
 *
 * Usage: node scripts/sync-sites.mjs
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHERLOCK_DATA_URL = 'https://data.sherlockproject.xyz';
const SHERLOCK_SCHEMA_URL =
  'https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.schema.json';
const SHERLOCK_EXCLUSIONS_URL =
  'https://raw.githubusercontent.com/sherlock-project/sherlock/refs/heads/exclusions/false_positive_exclusions.txt';
const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'sites.json');
const SITES_MD_PATH = resolve(__dirname, '..', 'SITES.md');
const INCLUDE_EXCLUDED = process.argv.includes('--include-excluded');
const STRICT_SCHEMA = process.argv.includes('--strict-schema');

/**
 * Maps Sherlock's errorType to our DetectionMethod enum values
 */
function mapErrorType(errorType) {
  if (Array.isArray(errorType)) {
    return errorType.map((value) => mapErrorType(value));
  }

  switch (errorType) {
    case 'status_code':
      return 'status_code';
    case 'message':
      return 'message';
    case 'response_url':
      return 'response_url';
    default:
      return 'status_code';
  }
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function validateManifest(manifest, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  if (validate(manifest)) {
    return null;
  }

  return (validate.errors ?? [])
    .slice(0, 10)
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'schema validation failed'}`)
    .join('; ');
}

/**
 * Transforms a Sherlock site entry to our SiteConfig format
 */
function transformSite(key, site, excludedSites) {
  const config = {
    name: key,
    url: site.url,
    urlMain: site.urlMain,
    errorType: mapErrorType(site.errorType),
  };

  if (site.urlProbe) {
    config.urlProbe = site.urlProbe;
  }
  if (site.errorMsg) {
    config.errorMsg = site.errorMsg;
  }
  if (site.errorCode) {
    config.errorCode = site.errorCode;
  }
  if (site.errorUrl) {
    config.errorUrl = site.errorUrl;
  }
  if (site.response_url) {
    config.responseUrl = site.response_url;
  }
  if (site.regexCheck) {
    config.regexCheck = site.regexCheck;
  }
  if (site.request_method) {
    config.requestMethod = site.request_method;
  }
  if (site.request_payload) {
    config.requestPayload = site.request_payload;
  }
  if (site.headers) {
    config.headers = site.headers;
  }
  if (site.isNSFW) {
    config.isNSFW = true;
  }
  if (excludedSites.has(key)) {
    config.isExcluded = true;
  }
  if (site.username_claimed) {
    config.usernameClaimed = site.username_claimed;
  }

  return config;
}

async function main() {
  console.log('Fetching Sherlock manifest, schema, and exclusions...');
  const [data, schema, exclusionsText] = await Promise.all([
    fetchJson(SHERLOCK_DATA_URL),
    fetchJson(SHERLOCK_SCHEMA_URL),
    fetchText(SHERLOCK_EXCLUSIONS_URL),
  ]);

  const validationError = validateManifest(data, schema);
  if (validationError) {
    const message = `Sherlock manifest failed schema validation: ${validationError}`;
    if (STRICT_SCHEMA) {
      throw new Error(message);
    }
    console.warn(`Warning: ${message}`);
  }

  const excludedSites = INCLUDE_EXCLUDED
    ? new Set()
    : new Set(
        exclusionsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      );

  const keys = Object.keys(data)
    .filter((k) => k !== '$schema')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  console.log(`Found ${keys.length} sites in Sherlock data`);

  const sites = {};
  for (const key of keys) {
    sites[key] = transformSite(key, data[key], excludedSites);
  }

  const activeKeys = keys.filter((key) => INCLUDE_EXCLUDED || !sites[key].isExcluded);
  const excludedCount = keys.length - activeKeys.length;
  const activeNsfwCount = activeKeys.filter((key) => sites[key].isNSFW).length;

  writeFileSync(OUTPUT_PATH, JSON.stringify(sites, null, 2) + '\n');
  console.log(
    `Written ${keys.length} site records (${activeKeys.length} active, ${excludedCount} excluded, ${activeNsfwCount} NSFW active) to src/sites.json`,
  );

  const lines = [];
  lines.push('# Supported Sites');
  lines.push('');
  lines.push(
    `This is the complete alphabetical list of ${activeKeys.length} active sites supported by username-checker.`,
  );
  if (!INCLUDE_EXCLUDED && excludedCount > 0) {
    lines.push('');
    lines.push(
      `Upstream false-positive exclusions are applied by default. ${excludedCount} excluded targets are kept in the bundled manifest for explicit debugging but are not listed here.`,
    );
  }
  lines.push('');
  lines.push('| Site | URL |');
  lines.push('|------|-----|');

  for (const key of activeKeys) {
    const site = sites[key];
    lines.push(`| ${key} | ${site.urlMain} |`);
  }

  writeFileSync(SITES_MD_PATH, lines.join('\n') + '\n');
  console.log(`Written ${activeKeys.length} active sites to SITES.md`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
