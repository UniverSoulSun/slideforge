// Real-browser smoke test. Serves the repo with vercel.json's headers and rewrite,
// then drives Chromium through the main flows and the analytics promises.
//
//   npm install && npx playwright install chromium && npm run test:smoke
//
// Libraries load from the real CDN, so this also proves the pinned versions and
// SRI hashes work together. For offline runs, set SF_LOCAL_LIBS to a folder laid
// out as <pkg>-<version>/package/<file> and CDN requests are answered from it.
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (error) {
    console.error('Playwright is not installed. Run: npm install && npx playwright install chromium');
    process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const LOCAL_LIBS = process.env.SF_LOCAL_LIBS || '';
const HOST = 'app.example.org'; // mapped to 127.0.0.1 below; analytics ignores localhost on purpose
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const globalHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
const csp = globalHeaders['Content-Security-Policy'];
const config = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
const endpoint = (config.match(/analyticsEndpoint: '([^']*)'/) || [])[1] || '';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/share-target') p = '/';
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', ...globalHeaders });
    fs.createReadStream(file).pipe(res);
});

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? '  ' + detail : ''}`);
    ok ? passed++ : failed++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, { viewport = { width: 1280, height: 800 }, dnt = false, url = '/' } = {}) {
    const context = await browser.newContext({ viewport, acceptDownloads: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    const log = { errors: [], csp: [], counts: [] };
    page.on('console', (m) => {
        const text = m.text();
        if (m.type() === 'error') log.errors.push(text);
        if (/Content Security Policy|Refused to/i.test(text)) log.csp.push(text);
    });
    page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));

    // The automation flag would switch analytics off; real visitors don't have it.
    await page.addInitScript((doNotTrack) => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        if (doNotTrack) Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
    }, dnt);

    await context.route(/https:\/\/[a-z0-9-]+\.goatcounter\.com\/.*/, (route) => {
        log.counts.push(route.request().url());
        route.fulfill({ status: 200, body: '' });
    });
    if (LOCAL_LIBS) {
        await context.route('https://cdn.jsdelivr.net/**', (route) => {
            const m = route.request().url().match(/\/npm\/([^@/]+)@([^/]+)\/(.+)$/);
            const file = m && path.join(LOCAL_LIBS, `${m[1]}-${m[2]}`, 'package', m[3]);
            if (!file || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
            route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(file) });
        });
    }
    await page.goto(`http://${HOST}:${server.address().port}${url}`);
    return { context, page, log };
}

const eventNames = (log) => log.counts
    .map((u) => new URL(u))
    .filter((u) => u.searchParams.get('e') === 'true')
    .map((u) => u.searchParams.get('p'));

(async () => {
    await new Promise((resolve) => server.listen(0, resolve));
    const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });

    // ----- Main flow -----
    let { context, page, log } = await open(browser);
    await page.waitForSelector('.slide .mermaid svg', { timeout: 60000 });
    check('page loads with slides and a rendered diagram (libraries + SRI work)',
        (await page.locator('.slide').count()) >= 4 && (await page.locator('.slide .mermaid svg').count()) >= 1);
    check('no console errors', log.errors.length === 0, JSON.stringify(log.errors));
    check('no Content-Security-Policy violations', log.csp.length === 0, JSON.stringify(log.csp));

    await page.fill('#markdownEditor', '# SECRET-TEXT-123\n\n---\n\n# Second\n\n---\n\n# Third');
    await sleep(500);
    check('typing updates the slide count', (await page.textContent('#slideCount')).trim() === '3 slides');

    await page.click('#presentBtn');
    await sleep(400);
    check('present mode opens on slide 1', (await page.textContent('#presentCount')).trim() === '1 / 3');
    await page.keyboard.press('ArrowRight');
    await sleep(200);
    check('arrow key advances the slide', (await page.textContent('#presentCount')).trim() === '2 / 3');
    await page.keyboard.press('Escape');
    await sleep(200);
    check('Escape closes present mode', await page.evaluate(() => document.getElementById('presenter').hidden));

    await page.click('#exportPdfBtn');
    await page.fill('#fileNameInput', 'smoke');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#confirmExportBtn')]);
    const pdfPath = path.join(require('os').tmpdir(), `slideforge-smoke-${process.pid}.pdf`);
    await download.saveAs(pdfPath);
    const pdf = fs.readFileSync(pdfPath);
    fs.unlinkSync(pdfPath);
    check('PDF export downloads a real PDF with one page per slide',
        pdf.slice(0, 5).toString() === '%PDF-' && (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 3);
    await sleep(300);

    // ----- Feedback dialog -----
    await page.click('#moreBtn');
    await page.click('#feedbackBtn');
    await sleep(200);
    const bug = await page.getAttribute('#feedbackBug', 'href');
    const version = (config.match(/version: '([^']*)'/) || [])[1];
    check('feedback opens a prefilled GitHub bug form', bug.includes('template=bug_report.yml') && bug.includes(`version=${encodeURIComponent(version)}`), bug);
    check('feedback link never contains slide text', !bug.includes('SECRET'));
    await page.keyboard.press('Escape');

    // ----- Analytics promises -----
    if (endpoint) {
        await sleep(300);
        const events = eventNames(log);
        const pageviews = log.counts.filter((u) => new URL(u).searchParams.get('e') !== 'true');
        check('one page view sent', pageviews.length === 1 && new URL(pageviews[0]).searchParams.get('p') === '/', JSON.stringify(log.counts.slice(0, 2)));
        for (const name of ['edit', 'present', 'export-pdf', 'diagram', 'feedback']) {
            check(`event "${name}" sent`, events.includes(name), JSON.stringify(events));
        }
        check('no analytics request contains slide text', !log.counts.some((u) => /SECRET/i.test(decodeURIComponent(u))));

        await page.click('#moreBtn');
        await page.click('#aboutBtn');
        await page.uncheck('#analyticsToggle');
        const before = log.counts.length;
        await page.keyboard.press('Escape');
        await page.click('#moreBtn');
        await page.click('#feedbackBtn');
        await sleep(300);
        check('switching usage counts off in About stops all sending', log.counts.length === before);
    }
    await context.close();

    if (endpoint) {
        // Do Not Track
        ({ context, page, log } = await open(browser, { dnt: true }));
        await page.waitForSelector('.slide', { timeout: 60000 });
        await page.fill('#markdownEditor', '# x');
        await sleep(400);
        check('Do Not Track: nothing is sent', log.counts.length === 0, JSON.stringify(log.counts));
        await context.close();

        // Share target: shared text must never reach analytics
        ({ context, page, log } = await open(browser, { url: '/share-target?text=SECRETSHARE' }));
        await page.waitForSelector('.slide', { timeout: 60000 });
        await sleep(400);
        check('share-target: counted as an event, text not sent',
            eventNames(log).includes('open-from-share') && !log.counts.some((u) => /SECRETSHARE/i.test(decodeURIComponent(u))),
            JSON.stringify(log.counts));
        await context.close();

        check('CSP allows exactly the configured analytics host', csp.includes(`connect-src 'self' https://cdn.jsdelivr.net ${new URL(endpoint).origin}`));
    }

    // ----- Phone layout -----
    ({ context, page, log } = await open(browser, { viewport: { width: 390, height: 844 } }));
    // On a phone the Slides pane is hidden until its tab is chosen.
    await page.waitForSelector('.slide', { state: 'attached', timeout: 60000 });
    await page.click('#previewBtn');
    await page.waitForSelector('.slide .mermaid svg', { timeout: 60000 });
    const width = await page.evaluate(() => document.querySelector('.slide .mermaid svg').getBoundingClientRect().width);
    check('phone: diagram renders at a real size in the Slides tab', width > 100, String(width));
    check('phone: no horizontal page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await context.close();

    await browser.close();
    server.close();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
