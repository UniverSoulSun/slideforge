// Shared helpers: find the pinned CDN libraries in index.html.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TAG = /<script\b[^>]*>/g;
const URL_RE = /(src|data-src)="(https:\/\/cdn\.jsdelivr\.net\/npm\/([^@"]+)@(\d+\.\d+\.\d+)\/([^"]+))"/;
const INTEGRITY_RE = /integrity="([^"]+)"/;

// Returns one entry per pinned library: { name, version, path, url, integrity, lazy }.
// "lazy" libraries (Mermaid) sit in an inert data-src tag and are not precached.
export function readPinnedLibraries(root) {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const libraries = [];
    for (const tag of html.match(TAG) || []) {
        const url = tag.match(URL_RE);
        if (!url) continue;
        const integrity = tag.match(INTEGRITY_RE);
        libraries.push({
            name: url[3],
            version: url[4],
            path: url[5],
            url: url[2],
            integrity: integrity ? integrity[1] : '',
            lazy: url[1] === 'data-src'
        });
    }
    return libraries;
}

export function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
    }
    return 0;
}
