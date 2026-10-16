// SlideForge settings you may want to change. Loaded before every other script.
//
// analyticsEndpoint  Where anonymous usage counts go (GoatCounter). Empty = analytics off.
//                    If you change the site code, run: node scripts/set-analytics.mjs <code>
//                    so vercel.json's Content-Security-Policy stays in step.
// feedbackEmail      Shows an "Email us" button in the feedback dialog. Empty = hidden.
// repo               "owner/name" on GitHub; feedback links open issue forms there.
window.SLIDEFORGE_CONFIG = Object.freeze({
    version: '1.3.0',
    repo: 'UniverSoulSun/slideforge',
    analyticsEndpoint: 'https://slideforge.goatcounter.com/count',
    feedbackEmail: ''
});
