# Maintaining SlideForge

What runs by itself, what needs a person, and where to look.

## What runs by itself

| What | When | Result |
|---|---|---|
| **CI** (`.github/workflows/ci.yml`) | Every push to `main` and every pull request | Runs the consistency checks, compares SRI hashes with the CDN, and drives a real browser through load, diagram, present, PDF export, feedback and analytics. A red check means do not merge. |
| **Update libraries** (`.github/workflows/update-deps.yml`) | Mondays 09:17 UTC, or on demand | Applies patch and minor releases of the five browser libraries, tests them, and opens a pull request. |
| **Dependabot** (`.github/dependabot.yml`) | Monthly | Updates the GitHub Actions versions and the two dev tools (`serve`, `live-server`). Ignores the five browser libraries on purpose. |
| **Vercel** | Every push to `main`, and every pull request gets a preview | Production deploys on merge. |

## What needs you

Everything below arrives as a GitHub notification (email or the GitHub app). Items from automation carry the label `manual-action`.

| You see | It means | Do this |
|---|---|---|
| Pull request "Update …" | A tested library update | Open the Vercel preview, click around, merge. |
| Issue "Library update needs your decision" | A major or deprecated release was found and not applied | Read the release notes. To try it: `node scripts/update-deps.mjs --apply --allow-major --only <library>`, then `npm test`, then a pull request. Or close the issue to hold back. |
| Issue "Library update failed its checks" | A new version broke something. Production is untouched | Open the linked run, read the failing step, fix the app or wait for the next release. |
| Issue "Open the pull request for …" | The update passed but GitHub would not let the workflow open a pull request | Do the one-time setting 2 below, then open the pull request from that branch. |
| A "Dependabot security alert" email | A library has a known vulnerability | Run **Update libraries** from the Actions tab. If Dependabot also opened a pull request for one of the five libraries, close it: it only changes `package.json`. |
| A bug or idea issue from the app | A user sent feedback | Triage: reproduce, label, reply. |

## One-time GitHub settings (about 5 minutes, cannot be set from code)

1. **Settings, Code security**: turn on **Dependabot alerts**.
2. **Settings, Actions, General, Workflow permissions**: choose **Read and write permissions** and tick **Allow GitHub Actions to create and approve pull requests**.
3. **Your profile, Settings, Notifications**: keep email on for "Actions" failed runs and for issues and pull requests on repositories you own.
4. Optional: **Settings, Branches**: protect `main` and require the **CI** check, so a red build cannot be merged.
5. Optional: **Settings, General**: turn on **Discussions** if you want a place for questions that are not bugs.

## Things that quietly stop

- GitHub pauses scheduled workflows in a public repository after 60 days without repository activity. If the Monday run stops appearing, push any small commit or press **Run workflow** once.
- The weekly workflow watches only the five browser libraries. The fonts are static files and do not update.
- Browser behaviour can change without a library change. The smoke test runs in Chromium only, so open the live site in Safari and Firefox now and then.

## Analytics

Counts go to GoatCounter. Sign in at `https://<your-code>.goatcounter.com`. The code is set in `config.js`; to change it, run `node scripts/set-analytics.mjs <code>` so the Content-Security-Policy follows. Tag a link with `?ref=name` (for example `https://slideforge-chi.vercel.app/?ref=reddit-webdev`) and that name appears as the referrer, which is how you tell channels apart.

## Releasing a change

1. `npm test`
2. If any file listed in `service-worker.js` changed, bump `CACHE_NAME`.
3. If the version changes, update it in `package.json`, `config.js` and the About text in `index.html` (the check script fails if they differ).
4. Push. Vercel deploys.
