#!/usr/bin/env node
// Changes the GoatCounter site code in config.js and vercel.json together, so
// the Content-Security-Policy always allows exactly the host the app sends to.
//
// Usage:
//   node scripts/set-analytics.mjs mycode     -> https://mycode.goatcounter.com/count
//   node scripts/set-analytics.mjs off        -> analytics disabled, host removed from the CSP
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (process.argv[2] || '').trim().toLowerCase();

if (!/^(off|[a-z0-9][a-z0-9-]{1,30})$/.test(code)) {
    console.error('Usage: node scripts/set-analytics.mjs <goatcounter-site-code | off>');
    process.exit(2);
}

const configPath = join(root, 'config.js');
const vercelPath = join(root, 'vercel.json');
let config = readFileSync(configPath, 'utf8');
let vercel = readFileSync(vercelPath, 'utf8');

const newEndpoint = code === 'off' ? '' : `https://${code}.goatcounter.com/count`;
const newHost = code === 'off' ? '' : ` https://${code}.goatcounter.com`;

config = config.replace(/analyticsEndpoint: '[^']*'/, `analyticsEndpoint: '${newEndpoint}'`);
// Replace any existing goatcounter host in connect-src (or add/remove it).
vercel = vercel.replace(/ https:\/\/[a-z0-9-]+\.goatcounter\.com/g, '');
vercel = vercel.replace(/(connect-src 'self' https:\/\/cdn\.jsdelivr\.net)/, `$1${newHost}`);

writeFileSync(configPath, config);
writeFileSync(vercelPath, vercel);
console.log(code === 'off' ? 'Analytics off.' : `Analytics endpoint: ${newEndpoint}`);
