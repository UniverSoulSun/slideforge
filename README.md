# SlideForge

Write Markdown, get slides. A browser-based editor with live preview, a full-screen Present mode, PDF export, and Mermaid diagrams. No build step, no backend, no account. Installable as an app and usable offline.

**Live:** https://slideforge-chi.vercel.app

## Features

- **Live split-pane editor** — Markdown on the left, true 16:9 slides on the right
- **Present mode** — full screen, arrow keys or swipe, tap to advance; starts from the slide you are looking at
- **Insert shortcuts** — New slide, Heading, List, Table and Diagram buttons above the editor, so phones never need to type `---` or pipes
- **Slide-per-`---`** — three hyphens on their own line starts a new slide
- **Mermaid diagrams** — fenced ` ```mermaid ` blocks render as flowcharts, sequence diagrams and more; the 3.5 MB library loads only when a deck has one
- **PDF export** — one slide per page via `jsPDF` + `html2canvas-pro`; choose landscape (slides) or portrait (long text and tables)
- **Native print**, **Import** (`.md`/`.txt`/`.html`), and **Save a copy** as Markdown, plain text, or a standalone web page
- **Local autosave** — drafts persist in the browser; a banner offers to pick up where you left off (no blocking dialogs), with Undo
- **Share** — Web Share API on mobile, clipboard fallback on desktop
- **Installable PWA** — add to home screen, works offline
- **Share into SlideForge** — on Android (Chrome), SlideForge appears in the system share sheet for text
- **Send feedback** — a dialog in the app opens a prefilled GitHub bug or idea form (and an email button if the maintainer sets one)
- **Responsive and themed** — Write / Slides tabs on phones; light and dark follow the system; slides stay white

## Tech stack

Vanilla HTML, CSS, and JavaScript — no framework, no bundler.

| Purpose | Library | Version |
|---|---|---|
| Markdown parsing | [marked](https://marked.js.org) | 18.1.2 |
| HTML sanitization | [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.17 |
| Diagrams | [Mermaid](https://mermaid.js.org) | 11.17.2 |
| PDF generation | [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 |
| DOM-to-canvas rendering | [html2canvas-pro](https://github.com/yorickshan/html2canvas-pro) | 2.5.2 |

All five load from jsDelivr at exact pinned versions — no `npm install` needed to run the app. The same versions are listed as `devDependencies` in `package.json` so GitHub can flag security advisories against them, and a weekly workflow keeps them current (see [MAINTAINING.md](MAINTAINING.md)).

Icons are inline SVG. Fonts are self-hosted in `fonts/` under the SIL Open Font License (licenses in `fonts/LICENSES.txt`), so the app makes no third-party font requests:

| Role | Font |
|---|---|
| Interface and slide headings | [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) |
| Slide body text | [Source Serif 4](https://github.com/adobe-fonts/source-serif) |
| Editor | [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) |

## Design notes

The idea is a light table with a projector lamp: slides are the hero and sit as white 16:9 sheets on a cool grey-blue surface, and one lamp-amber (`#FFB000`) accent marks what is primary or active. Colours, type and spacing are CSS custom properties at the top of `styles.css`. Slides never change with the theme, because they are the artifact being produced. Mermaid is themed to the same palette in `script.js`.

## Getting started

```bash
git clone https://github.com/UniverSoulSun/slideforge.git
cd slideforge
npx serve .
```

Opening `index.html` straight from disk also works for editing and export, but the service worker (offline/install) needs `http://localhost` or HTTPS.

## Usage

- Type, paste, or **Import** markdown into the editor (on a phone, use the **Write** tab).
- Separate slides with `---` on its own line, or tap **New slide**.
- Add diagrams with a fenced block:

  ````markdown
  ```mermaid
  flowchart LR
      A --> B
  ```
  ````

- **Present** — full screen. Arrow keys, Space, Home/End, or swipe/tap on touch; Esc exits.
- **Export PDF** — prompts for a filename and page layout, then renders each slide as one PDF page.
- **More ▸ Print** — hands off to the browser's print dialog.
- **More ▸ Save a copy** — download as `.md`, `.txt` (markdown stripped), or standalone `.html`.

## Security

SlideForge renders markdown that can come from outside — imported files and text shared in from other apps — so rendering is treated as untrusted input.

- **Sanitization:** `marked` does not sanitize its output. Every render passes through DOMPurify before reaching the page, in both the live preview and the HTML export. Slides are split on `<hr>` elements in the sanitized DOM, not by string-splitting HTML.
- **Mermaid** runs with `securityLevel: 'strict'` (labels sanitized, no click handlers).
- **Content-Security-Policy** (set in `vercel.json`): scripts only from this origin and jsDelivr, fonts and styles only from this origin, no inline scripts, no `eval`, no plugins, no framing. Only applies to the Vercel deployment — CodePen and local servers don't send it.
- **Supply chain:** CDN versions are pinned exactly and every external tag carries a Subresource Integrity hash, so a tampered or swapped file is blocked by the browser. `bash scripts/verify-sri.sh` re-checks every hash against what the CDN serves today.
- **No backend, no accounts, no stored user data** — drafts live only in the user's own browser.

## Privacy

Your slides never leave your device. There is no account, no server and no cookie.

SlideForge counts visits and feature use with [GoatCounter](https://www.goatcounter.com/), a cookieless analytics service that [stores no IP address and no tracker ID](https://www.goatcounter.com/help/privacy). What is sent, in full:

- a page visit, with the referrer or a `?ref=` tag and your screen width
- an event name when you use a feature: `edit`, `present`, `export-pdf`, `diagram`, `save-markdown`, `save-text`, `save-html`, `share`, `import`, `install`, `open-from-share`, `feedback`

Never sent: slide text, file names, shared text, or any other part of the address.

Nothing is sent when your browser signals Do Not Track or Global Privacy Control, when you switch it off in **More ▸ About**, on localhost, or when `analyticsEndpoint` in `config.js` is empty. Fork the project and set it empty (or run `node scripts/set-analytics.mjs off`) to run it with no analytics at all.

Feedback links open a GitHub issue form with your app version, browser and screen size prefilled. They never include your slides.

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
- **CSS** panel: `styles.css` (the self-hosted fonts won't load there, so it falls back to system fonts)
- **JS** panel: `script.js`; under Settings → JS add, in this order, the DOMPurify, marked, jsPDF, and html2canvas-pro URLs from `index.html`. Mermaid loads itself on demand from the `#mermaid-lazy` tag, so add that tag to the HTML panel too.

The service worker won't register inside CodePen — expected, and the editor works without it. Vercel is the supported host.

### GitHub Pages
Settings → Pages → deploy from `main`, root. Note: GitHub Pages can't send the CSP header or the `/share-target` rewrite, so Vercel is the primary host.

## Project structure

```
slideforge/
├── index.html
├── styles.css
├── script.js
├── config.js               (version, repo, analytics endpoint, feedback email)
├── analytics.js            (anonymous usage counts; see Privacy)
├── service-worker.js
├── manifest.json
├── icons/                  (192, 512, and maskable 512 PNGs)
├── fonts/                  (self-hosted woff2 + LICENSES.txt)
├── scripts/
│   ├── check.mjs           (offline consistency checks)
│   ├── update-deps.mjs     (finds and applies library updates, with new SRI hashes)
│   ├── set-analytics.mjs   (changes the GoatCounter code and the CSP together)
│   └── verify-sri.sh       (checks SRI hashes against the live CDN)
├── tests/smoke.cjs         (real-browser smoke test)
├── package.json
├── vercel.json
├── MAINTAINING.md          (what runs by itself, what needs you)
├── README.md
├── LICENSE
├── .gitignore
└── .github/
    ├── ISSUE_TEMPLATE/     (bug report and idea forms)
    ├── workflows/          (ci.yml, update-deps.yml)
    └── dependabot.yml
```

## Keeping dependencies current

Automatic. Every Monday the **Update libraries** workflow checks the five browser libraries. Patch and minor releases are applied (URL, SRI hash, service-worker entry, cache name, `package.json`, this README's table), tested in a real browser, and offered as a pull request with a Vercel preview. Major or deprecated releases, and any update that fails its tests, become an issue labelled `manual-action`. Details and the one-time GitHub settings are in [MAINTAINING.md](MAINTAINING.md).

Useful commands:

```bash
npm test                                   # consistency checks + browser smoke test
node scripts/check.mjs                     # offline checks only
node scripts/update-deps.mjs               # list available updates, change nothing
node scripts/update-deps.mjs --apply --allow-major --only marked   # update one library by hand
bash scripts/verify-sri.sh                 # compare every hash with what the CDN serves today
```

## Known limitations

- **Share into SlideForge is Android/Chrome only.** iOS Safari doesn't support the Web Share Target API. Sharing *out* works everywhere.
- **Only shared text is accepted, not files.** Receiving a `.md` file would need a POST share target handled by the service worker.
- **Autosave is a safety net, not storage.** Safari can clear site data after about a week without a visit. Use **Save** for anything you want to keep.
- **HTML export keeps Mermaid blocks as source code**, not rendered diagrams.
- **Diagrams need the network the first time.** Mermaid is fetched when a deck first contains a diagram, then cached; offline before that, diagram blocks show as code.
- **Bullet colour is lost in PDF export** (the amber markers render black), a `html2canvas` limitation.
- **Very long slides shrink to fit one PDF page** rather than spanning pages (by design).

## Roadmap

- Slide themes and a speaker-notes view
- "Save to Google Drive" (`drive.file` scope, token held in memory only)
- Optional share-link backend, only if users ask for no-login links

## Contributing and feedback

Found a bug or have an idea? Use **More ▸ Send feedback** in the app, or open an [issue](https://github.com/UniverSoulSun/slideforge/issues/new/choose) directly. Pull requests welcome; run `npm test` first.

## License

MIT — see [LICENSE](LICENSE).
