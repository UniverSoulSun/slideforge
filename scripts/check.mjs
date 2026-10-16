#!/usr/bin/env node
// Offline consistency check. Catches the mistakes that are easy to make when a
// library version, a file or a setting changes in one place but not another.
//
//   node scripts/check.mjs
//
// Exit code 0 only if everything agrees. It needs no network and no install.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPinnedLibraries } from './lib-cdn.mjs';

const root = process.env.SF_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');
const problems = [];
let checks = 0;
function expect(ok, message) {
    checks++;
    if (!ok) problems.push(message);
}

const html = read('index.html');
const script = read('script.js');
const sw = read('service-worker.js');
const pkg = JSON.parse(read('package.json'));
const vercel = JSON.parse(read('vercel.json'));
const config = read('config.js');

// 1. Pinned libraries: hash present, package.json and service worker agree.
const libs = readPinnedLibraries(root);
expect(libs.length >= 5, `Expected at least 5 pinned libraries in index.html, found ${libs.length}.`);
const swAssets = new Set([...sw.matchAll(/'(https:\/\/cdn\.jsdelivr\.net\/[^']+)'/g)].map((m) => m[1]));
for (const lib of libs) {
    expect(/^sha384-[A-Za-z0-9+/]{64}$/.test(lib.integrity), `${lib.name}: missing or malformed sha384 integrity hash in index.html.`);
    expect(pkg.devDependencies && pkg.devDependencies[lib.name] === lib.version,
        `${lib.name}: index.html pins ${lib.version} but package.json has ${pkg.devDependencies && pkg.devDependencies[lib.name]}.`);
    expect(lib.lazy ? !swAssets.has(lib.url) : swAssets.has(lib.url),
        lib.lazy ? `${lib.name}: lazy library should not be precached in service-worker.js.`
            : `${lib.name}: ${lib.url} is not listed in service-worker.js CDN_ASSETS.`);
}
const eagerUrls = new Set(libs.filter((l) => !l.lazy).map((l) => l.url));
for (const url of swAssets) {
    expect(eagerUrls.has(url), `service-worker.js lists ${url}, which index.html does not load.`);
}

// 2. Service worker shell: every listed file exists; every local asset the page loads is listed.
const shell = [...(sw.match(/APP_SHELL = \[([\s\S]*?)\];/) || [, ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
expect(shell.length > 0, 'Could not read APP_SHELL from service-worker.js.');
for (const entry of shell) {
    if (entry !== '/') expect(existsSync(join(root, entry)), `APP_SHELL lists ${entry}, which does not exist.`);
}
const localAssets = [
    ...[...html.matchAll(/<script[^>]+src="([^"/][^":]*)"/g)].map((m) => '/' + m[1]),
    ...[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"/][^":]*)"/g)].map((m) => '/' + m[1])
];
for (const asset of localAssets) {
    expect(shell.includes(asset), `${asset} is loaded by index.html but missing from APP_SHELL, so it would not work offline.`);
}
for (const font of [...css().matchAll(/url\("?\/?(fonts\/[^")]+)"?\)/g)].map((m) => '/' + m[1])) {
    expect(shell.includes(font), `${font} is used by styles.css but missing from APP_SHELL.`);
}
function css() {
    return read('styles.css');
}
expect(/CACHE_NAME = 'slideforge-v\d+'/.test(sw), "CACHE_NAME must look like 'slideforge-v<number>'.");

// 3. Every element script.js looks up by id exists in index.html.
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const m of script.matchAll(/getElementById\('([^']+)'\)/g)) {
    expect(htmlIds.has(m[1]), `script.js looks up #${m[1]}, which index.html does not define.`);
}

// 4. One version everywhere.
const version = (config.match(/version: '([^']+)'/) || [])[1];
expect(version === pkg.version, `config.js version (${version}) and package.json version (${pkg.version}) differ.`);
expect(new RegExp(`id="appVersion">${pkg.version.replace(/\./g, '\\.')}<`).test(html), 'index.html About text shows a different version than package.json.');

// 5. Content-Security-Policy stays tight and matches the analytics setting.
const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy');
expect(Boolean(csp), 'vercel.json has no Content-Security-Policy header.');
if (csp) {
    const directive = (name) => (csp.value.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) || '');
    expect(directive('script-src') === "script-src 'self' https://cdn.jsdelivr.net", `script-src should allow only 'self' and jsDelivr, got: ${directive('script-src')}`);
    expect(directive('frame-ancestors') === "frame-ancestors 'none'", 'frame-ancestors should be none.');
    expect(directive('object-src') === "object-src 'none'", 'object-src should be none.');
    const endpoint = (config.match(/analyticsEndpoint: '([^']*)'/) || [])[1] || '';
    const connect = directive('connect-src');
    if (endpoint) {
        expect(connect.includes(new URL(endpoint).origin), `connect-src must allow ${new URL(endpoint).origin} (the analytics host in config.js). Run: node scripts/set-analytics.mjs <code>`);
    } else {
        expect(!/goatcounter/.test(connect), 'Analytics is off in config.js but connect-src still allows GoatCounter. Run: node scripts/set-analytics.mjs off');
    }
}

// 6. JSON and JavaScript files parse.
for (const file of ['manifest.json', 'package.json', 'vercel.json']) {
    try {
        JSON.parse(read(file));
        checks++;
    } catch (error) {
        problems.push(`${file} is not valid JSON: ${error.message}`);
    }
}
for (const file of ['script.js', 'analytics.js', 'config.js', 'service-worker.js']) {
    const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
    expect(result.status === 0, `${file} has a syntax error:\n${result.stderr}`);
}

if (problems.length) {
    console.error(`\n${problems.length} problem(s) found:\n`);
    problems.forEach((p) => console.error(` - ${p}`));
    process.exit(1);
}
console.log(`OK: ${checks} checks passed.`);
