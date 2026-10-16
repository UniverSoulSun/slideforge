#!/usr/bin/env node
// Looks for newer versions of the pinned browser libraries and, with --apply,
// updates everything that has to change together:
//   index.html (URL + SRI hash), service-worker.js (URL + cache name),
//   package.json (pin) and the version table in README.md.
//
// Patch and minor releases are applied. Major releases and deprecated versions
// are never applied: they go in the report as "needs a decision".
//
//   node scripts/update-deps.mjs                 look only, change nothing
//   node scripts/update-deps.mjs --apply         apply patch/minor updates
//   node scripts/update-deps.mjs --apply --report report.md
//   node scripts/update-deps.mjs --apply --allow-major --only marked
//                                                update one library by hand, even across a major version
//
// Environment (all optional; tests use these):
//   SF_ROOT      folder to work on (default: the repo)
//   SF_REGISTRY  npm registry base URL (default https://registry.npmjs.org)
//   SF_CDN       CDN base URL used for downloading files to hash (default https://cdn.jsdelivr.net)
//   GITHUB_OUTPUT  if set, writes changed/manual/branch outputs for the workflow
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, readPinnedLibraries } from './lib-cdn.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const allowMajor = args.includes('--allow-major');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : '';
const root = process.env.SF_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = (process.env.SF_REGISTRY || 'https://registry.npmjs.org').replace(/\/$/, '');
const cdn = (process.env.SF_CDN || 'https://cdn.jsdelivr.net').replace(/\/$/, '');

const file = (name) => join(root, name);
const readText = (name) => readFileSync(file(name), 'utf8');

async function getJson(url) {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return response.json();
}

async function sha384Of(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000) throw new Error(`${url} returned only ${bytes.length} bytes, which is too small to be the library.`);
    return `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
}

function replaceOnce(text, from, to, where) {
    if (!text.includes(from)) throw new Error(`Could not find ${from} in ${where}.`);
    return text.replace(from, to);
}

const libs = readPinnedLibraries(root).filter((lib) => !only || lib.name === only);
if (only && libs.length === 0) {
    console.error(`No pinned library named "${only}" in index.html.`);
    process.exit(2);
}
const applied = [];
const manual = [];
const errors = [];
const current = [];

for (const lib of libs) {
    try {
        const latestDoc = await getJson(`${registry}/${lib.name}/latest`);
        const latest = latestDoc.version;
        if (!/^\d+\.\d+\.\d+$/.test(latest)) throw new Error(`unexpected version "${latest}"`);
        if (compareVersions(latest, lib.version) <= 0) {
            current.push(lib);
            continue;
        }
        const major = Number(latest.split('.')[0]) > Number(lib.version.split('.')[0]);
        const change = { name: lib.name, from: lib.version, to: latest, lib, path: lib.path };
        if (major && !allowMajor) {
            manual.push({ ...change, reason: 'Major version: may break the app. Read the release notes, then update by hand.' });
        } else if (latestDoc.deprecated) {
            manual.push({ ...change, reason: `The new version is deprecated by its maintainers: ${latestDoc.deprecated}` });
        } else {
            applied.push(change);
        }
    } catch (error) {
        errors.push(`${lib.name}: ${error.message}`);
    }
}

if (apply && applied.length) {
    let html = readText('index.html');
    let sw = readText('service-worker.js');
    let pkg = readText('package.json');
    let readme = readText('README.md');

    for (const change of [...applied]) {
        const { lib } = change;
        const newUrl = `https://cdn.jsdelivr.net/npm/${lib.name}@${change.to}/${lib.path}`;
        try {
            change.integrity = await sha384Of(`${cdn}/npm/${lib.name}@${change.to}/${lib.path}`);
            html = replaceOnce(html, lib.url, newUrl, 'index.html');
            html = replaceOnce(html, lib.integrity, change.integrity, 'index.html');
            if (!lib.lazy) sw = replaceOnce(sw, lib.url, newUrl, 'service-worker.js');
            pkg = replaceOnce(pkg, `"${lib.name}": "${change.from}"`, `"${lib.name}": "${change.to}"`, 'package.json');
            readme = readme.split('\n').map((line) =>
                line.toLowerCase().includes(lib.name.toLowerCase()) && line.includes(`| ${lib.version} |`)
                    ? line.replace(`| ${lib.version} |`, `| ${change.to} |`)
                    : line).join('\n');
        } catch (error) {
            errors.push(`${lib.name}: not applied (${error.message})`);
            applied.splice(applied.indexOf(change), 1);
        }
    }

    if (applied.length) {
        sw = sw.replace(/CACHE_NAME = 'slideforge-v(\d+)'/, (_, n) => `CACHE_NAME = 'slideforge-v${Number(n) + 1}'`);
        writeFileSync(file('index.html'), html);
        writeFileSync(file('service-worker.js'), sw);
        writeFileSync(file('package.json'), pkg);
        writeFileSync(file('README.md'), readme);
    }
}

const lines = [];
const row = (c) => `- **${c.name}** ${c.from} → ${c.to}`;
if (applied.length) {
    lines.push(apply ? '### Updated' : '### Updates available (not applied)', '', ...applied.map(row), '');
    if (apply) lines.push('Changed together: `index.html` (URL and SRI hash), `service-worker.js` (URL and cache name), `package.json`, and the README version table.', '');
}
if (manual.length) {
    lines.push('### Needs a decision from you', '', ...manual.map((c) => `${row(c)}\n  - ${c.reason}\n  - Release notes: https://www.npmjs.com/package/${c.name}`), '');
}
if (errors.length) lines.push('### Could not check or apply', '', ...errors.map((e) => `- ${e}`), '');
if (!applied.length && !manual.length && !errors.length) lines.push(`All ${libs.length} libraries are on their latest version.`, '');
const report = lines.join('\n');
console.log(report);
if (reportPath) writeFileSync(reportPath, report);

const stamp = applied.map((c) => `${c.name}-${c.to}`).join('_').replace(/[^A-Za-z0-9._-]/g, '');
const outputs = {
    changed: apply && applied.length > 0,
    manual: manual.length > 0,
    errors: errors.length > 0,
    branch: `deps/cdn-${stamp}`.slice(0, 120),
    title: applied.length ? `Update ${applied.map((c) => `${c.name} ${c.to}`).join(', ')}`.slice(0, 200) : '',
    manual_title: manual.length ? `Library update needs your decision: ${manual.map((c) => `${c.name} ${c.from} to ${c.to}`).join(', ')}`.slice(0, 200) : ''
};
if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
}
// Errors alone should not fail the run; the workflow reports them.
process.exit(0);
