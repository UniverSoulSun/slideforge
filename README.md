# SlideForge

A lightweight, browser-based markdown-to-presentation editor. Import or write markdown, watch it become slides in real time, and export to PDF — no build step, no backend, no account required. Installable as an app and usable offline.

## Features

- **Live split-pane editor** — markdown on the left, rendered slides on the right
- **Slide-per-`---`** — three hyphens on their own line starts a new slide
- **Mermaid diagrams** — fenced ` ```mermaid ` blocks render as flowcharts, sequence diagrams, and more
- **PDF export** — one slide per page via `jsPDF` + `html2canvas-pro`, so tables never split across a page break
- **Native print** — the browser's own print-to-PDF as a lighter alternative
- **Import / Save** — load `.md`/`.txt`/`.html`, or save as Markdown, plain text, or a standalone HTML file
- **Local autosave** — your draft is kept in the browser and offered back when you return
- **Share** — Web Share API on mobile, clipboard fallback on desktop
- **Installable PWA** — add to home screen, works offline
- **Share into SlideForge** — on Android (Chrome), SlideForge appears in the system share sheet for text
- **Responsive** — edit/preview toggle on small screens

## Tech stack

Vanilla HTML, CSS, and JavaScript — no framework, no bundler.

| Purpose | Library | Version |
|---|---|---|
| Markdown parsing | [marked](https://marked.js.org) | 18.0.14 |
| HTML sanitization | [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.15 |
| Diagrams | [Mermaid](https://mermaid.js.org) | 11.17.2 |
| PDF generation | [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 |
| DOM-to-canvas rendering | [html2canvas-pro](https://github.com/yorickshan/html2canvas-pro) | 2.4.4 |
| Icons | [Font Awesome Free](https://fontawesome.com) | 6.5.1 |

All loaded from CDNs at exact pinned versions — no `npm install` needed to run the app. The same versions are listed as `devDependencies` in `package.json` purely so Dependabot can flag security advisories against them.

## Getting started

```bash
git clone https://github.com/RaMindz/slideforge.git
cd slideforge
npx serve .
```

Opening `index.html` straight from disk also works for editing and export, but the service worker (offline/install) needs `http://localhost` or HTTPS.

## Usage

- Type, paste, or **Import** markdown into the left panel.
- Separate slides with `---` on its own line.
- Add diagrams with a fenced block:

  ````markdown
  ```mermaid
  flowchart LR
      A --> B
  ```
  ````

- **Export PDF** — prompts for a filename, then renders each slide as one PDF page.
- **Print** — hands off to the browser's print dialog.
- **Save** — download as `.md`, `.txt` (markdown stripped), or standalone `.html`.

## Security

SlideForge renders markdown that can come from outside — imported files and text shared in from other apps — so rendering is treated as untrusted input.

- **Sanitization:** `marked` does not sanitize its output. Every render passes through DOMPurify before reaching the page, in both the live preview and the HTML export. Slides are split on `<hr>` elements in the sanitized DOM, not by string-splitting HTML.
- **Mermaid** runs with `securityLevel: 'strict'` (labels sanitized, no click handlers).
- **Content-Security-Policy** (set in `vercel.json`): scripts only from this origin and the two pinned CDNs, no inline scripts, no `eval`, no plugins, no framing. Only applies to the Vercel deployment — CodePen and local servers don't send it.
- **Supply chain:** CDN versions are pinned exactly and every external tag carries a Subresource Integrity hash, so a tampered or swapped file is blocked by the browser. `bash scripts/verify-sri.sh` re-checks every hash against what the CDN serves today.
- **No backend, no accounts, no stored user data** — drafts live only in the user's own browser.

## Deployment

### Vercel
Static site, zero build. Connect the repo in the Vercel dashboard, or:
```bash
npx vercel --prod
```
`vercel.json` provides the security headers and the `/share-target` rewrite the PWA needs.

### CodePen (demo)
Create a new Pen, then:
- **HTML** panel: the contents of `<body>` from `index.html`
- **CSS** panel: `styles.css`; under Settings → CSS add the Font Awesome URL from `index.html`
- **JS** panel: `script.js`; under Settings → JS add, in this order, the DOMPurify, marked, jsPDF, html2canvas-pro, and Mermaid URLs from `index.html`

The service worker won't register inside CodePen — expected, and the editor works without it.

### GitHub Pages
Settings → Pages → deploy from `main`, root. Note: GitHub Pages can't send the CSP header or the `/share-target` rewrite, so Vercel is the primary host.

## Project structure

```
slideforge/
├── index.html
├── styles.css
├── script.js
├── service-worker.js
├── manifest.json
├── icons/                  (192, 512, and maskable 512 PNGs)
├── scripts/verify-sri.sh   (checks SRI hashes against the live CDN)
├── package.json
├── vercel.json
├── README.md
├── LICENSE
├── .gitignore
└── .github/dependabot.yml
```

## Keeping dependencies current

When Dependabot opens a PR for one of the browser libraries, do all of this in the same commit:
1. Update the version in the CDN URL in `index.html` **and** `service-worker.js`.
2. Regenerate that tag's SRI hash: `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`, then prefix `sha384-`.
3. Run `bash scripts/verify-sri.sh` and confirm every line says OK.
4. Bump `CACHE_NAME` in `service-worker.js`.

## Known limitations

- **Share into SlideForge is Android/Chrome only.** iOS Safari doesn't support the Web Share Target API. Sharing *out* works everywhere.
- **Only shared text is accepted, not files.** Receiving a `.md` file would need a POST share target handled by the service worker.
- **Autosave is a safety net, not storage.** Safari can clear site data after about a week without a visit. Use **Save** for anything you want to keep.
- **HTML export keeps Mermaid blocks as source code**, not rendered diagrams.
- **Very long slides shrink to fit one PDF page** rather than spanning pages (by design).

## Roadmap

- "Save to Google Drive" (`drive.file` scope, token held in memory only)
- Optional share-link backend, only if users ask for no-login links

## Contributing

Issues and pull requests welcome.

## License

MIT — see [LICENSE](LICENSE).
