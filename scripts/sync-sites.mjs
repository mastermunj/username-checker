#!/usr/bin/env node
/* eslint-env node */
/* global console, process, fetch */

/**
 * Sync sites data from Sherlock Project
 * Fetches the latest data.json from Sherlock's GitHub repository
 * and generates src/sites.json in our format.
 *
 * Usage: node scripts/sync-sites.mjs
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHERLOCK_DATA_URL =
  'https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json';
const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'sites.json');
const SITES_MD_PATH = resolve(__dirname, '..', 'SITES.md');

/**
 * Maps Sherlock's errorType to our DetectionMethod enum values
 */
function mapErrorType(errorType) {
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

/**
 * Transforms a Sherlock site entry to our SiteConfig format
 */
function transformSite(key, site) {
  const config = {
    name: key,
    url: site.url,
    urlMain: site.urlMain,
    errorType: mapErrorType(site.errorType),
  };

  if (site.urlProbe) config.urlProbe = site.urlProbe;
  if (site.errorMsg) config.errorMsg = site.errorMsg;
  if (site.errorUrl) config.errorUrl = site.errorUrl;
  if (site.regexCheck) config.regexCheck = site.regexCheck;
  if (site.request_method && site.request_method !== 'GET') config.requestMethod = site.request_method;
  if (site.request_payload) config.requestPayload = site.request_payload;
  if (site.headers) config.headers = site.headers;
  if (site.isNSFW) config.isNSFW = true;
  if (site.username_claimed) config.usernameClaimed = site.username_claimed;

  return config;
}

async function main() {
  console.log('Fetching Sherlock data from GitHub...');
  const response = await fetch(SHERLOCK_DATA_URL);

  if (!response.ok) {
    console.error(`Failed to fetch: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const data = await response.json();
  const keys = Object.keys(data)
    .filter((k) => k !== '$schema')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  console.log(`Found ${keys.length} sites in Sherlock data`);

  const sites = {};
  for (const key of keys) {
    sites[key] = transformSite(key, data[key]);
  }

  const nsfwCount = Object.values(sites).filter((s) => s.isNSFW).length;

  writeFileSync(OUTPUT_PATH, JSON.stringify(sites, null, 2) + '\n');
  console.log(`Written ${keys.length} sites (${nsfwCount} NSFW) to src/sites.json`);

  const lines = [];
  lines.push('# Supported Sites');
  lines.push('');
  lines.push(`This is the complete alphabetical list of ${keys.length} sites supported by username-checker.`);
  lines.push('');
  lines.push('| Site | URL |');
  lines.push('|------|-----|');

  for (const key of keys) {
    const site = sites[key];
    lines.push(`| ${key} | ${site.urlMain} |`);
  }

  writeFileSync(SITES_MD_PATH, lines.join('\n') + '\n');
  console.log(`Written ${keys.length} sites to SITES.md`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
