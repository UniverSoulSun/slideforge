document.addEventListener('DOMContentLoaded', () => {
    // ---------- Element references ----------
    const markdownEditor = document.getElementById('markdownEditor');
    const previewContent = document.getElementById('previewContent');
    const previewPanel = document.getElementById('previewPanel');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const presentBtn = document.getElementById('presentBtn');
    const shareBtn = document.getElementById('shareBtn');
    const printNativeBtn = document.getElementById('printNativeBtn');
    const saveBtn = document.getElementById('saveBtn');
    const importBtn = document.getElementById('importBtn');
    const aboutBtn = document.getElementById('aboutBtn');
    const moreBtn = document.getElementById('moreBtn');
    const moreMenu = document.getElementById('moreMenu');
    const editBtn = document.getElementById('editBtn');
    const previewBtn = document.getElementById('previewBtn');
    const exportModal = document.getElementById('exportModal');
    const saveModal = document.getElementById('saveModal');
    const aboutModal = document.getElementById('aboutModal');
    const fileNameInput = document.getElementById('fileNameInput');
    const saveFileNameInput = document.getElementById('saveFileNameInput');
    const confirmExportBtn = document.getElementById('confirmExportBtn');
    const cancelExportBtn = document.getElementById('cancelExportBtn');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const cancelSaveBtn = document.getElementById('cancelSaveBtn');
    const closeAboutBtn = document.getElementById('closeAboutBtn');
    const feedbackBtn = document.getElementById('feedbackBtn');
    const feedbackModal = document.getElementById('feedbackModal');
    const closeFeedbackBtn = document.getElementById('closeFeedbackBtn');
    const feedbackBug = document.getElementById('feedbackBug');
    const feedbackIdea = document.getElementById('feedbackIdea');
    const feedbackMail = document.getElementById('feedbackMail');
    const appVersionEl = document.getElementById('appVersion');
    const analyticsRow = document.getElementById('analyticsRow');
    const analyticsToggle = document.getElementById('analyticsToggle');
    const fileInput = document.getElementById('fileInput');
    const notification = document.getElementById('notification');
    const banner = document.getElementById('banner');
    const bannerText = document.getElementById('bannerText');
    const bannerActions = document.getElementById('bannerActions');
    const slideCountEl = document.getElementById('slideCount');
    const saveStateEl = document.getElementById('saveState');
    const presenter = document.getElementById('presenter');
    const presenterStage = document.getElementById('presenterStage');
    const presentCount = document.getElementById('presentCount');
    const presentPrev = document.getElementById('presentPrev');
    const presentNext = document.getElementById('presentNext');
    const presentClose = document.getElementById('presentClose');

    // ---------- Settings and anonymous usage counts ----------
    const CONFIG = window.SLIDEFORGE_CONFIG || { version: '', repo: '', feedbackEmail: '' };
    const analytics = window.SlideForgeAnalytics;

    // Event names are fixed strings; nothing the person typed is ever passed in.
    function track(name) {
        try {
            if (analytics) analytics.track(name);
        } catch {
            // Counting must never get in the way.
        }
    }

    let editTracked = false;

    // ---------- Sample content ----------
    const SAMPLE_CONTENT = `# Welcome to SlideForge!

## Write Markdown, get slides

Type on the left and your slides appear on the right. On a phone, switch between **Write** and **Slides** with the tabs below.

### Key Features:
* Live preview as you type
* Present full screen, with arrow keys or swipes
* Export a PDF, save a web page, or print
* Works offline and autosaves on your device

\`\`\`javascript
function helloWorld() {
    console.log("Hello, SlideForge User!");
}
helloWorld();
\`\`\`

> "Write once, preview everywhere." - The SlideForge Motto

---

# About Your Presentation

This is a new slide. Use three hyphens (\`---\`) on a new line to start one, or tap **New slide** above the editor.

* **List Item 1**: Use asterisks or hyphens for bullet points
* **List Item 2**: You can nest lists too
    * Sub-item A
    * Sub-item B
* **List Item 3**: Numbered lists are also supported

1. First numbered item
2. Second numbered item

---

# Diagrams

Fenced \`mermaid\` blocks render as diagrams:

\`\`\`mermaid
flowchart LR
    A[Write markdown] --> B[Preview slides]
    B --> C[Export PDF]
    B --> D[Share]
\`\`\`

---

# Tables and More!

| Header 1 | Header 2 | Header 3 |
| :------- | :------- | :------- |
| Row 1 Col 1 | Row 1 Col 2 | Row 1 Col 3 |
| Row 2 Col 1 | Row 2 Col 2 | Row 2 Col 3 |

This is a blockquote:
> "The best way to predict the future is to create it."

Enjoy creating your presentations!
`;

    // ---------- Notifications ----------
    let notificationTimeout;
    function showNotification(message, isError = false) {
        clearTimeout(notificationTimeout);
        notification.textContent = message;
        notification.classList.toggle('is-error', isError);
        notification.classList.add('is-visible');
        notificationTimeout = setTimeout(() => {
            notification.classList.remove('is-visible');
        }, isError ? 5000 : 3000);
    }

    // ---------- Banner (replaces blocking confirm() prompts) ----------
    function hideBanner() {
        banner.hidden = true;
        bannerText.textContent = '';
        bannerActions.replaceChildren();
    }

    function showBanner(text, actions) {
        bannerText.textContent = text;
        bannerActions.replaceChildren(...actions.map((action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `btn ${action.primary ? 'btn-primary' : 'btn-ghost'}`;
            button.textContent = action.label;
            button.addEventListener('click', action.onClick);
            return button;
        }));
        banner.hidden = false;
    }

    // ---------- Status line (slide count + autosave state) ----------
    function updateSlideCount() {
        const count = previewContent.querySelectorAll('.slide').length;
        slideCountEl.textContent = `${count} ${count === 1 ? 'slide' : 'slides'}`;
    }

    const SAVE_STATES = {
        idle: 'Autosaves as you type',
        pending: 'Saving…',
        saved: 'Saved on this device',
        unavailable: 'Autosave unavailable here'
    };
    function setSaveState(state) {
        saveStateEl.textContent = SAVE_STATES[state] || SAVE_STATES.idle;
    }

    // ---------- Local autosave (device storage) ----------
    // A safety net, not an archive: Safari can evict site storage after
    // about a week without a visit.
    const DRAFT_KEY = 'slideforge-draft';
    const AUTOSAVE_DELAY_MS = 800;
    let autosaveTimer = null;

    function readDraft() {
        try {
            return localStorage.getItem(DRAFT_KEY);
        } catch {
            return null; // storage blocked (private mode, disabled cookies)
        }
    }

    function saveDraftNow() {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
        const value = markdownEditor.value;
        try {
            if (!value.trim() || value === SAMPLE_CONTENT) {
                localStorage.removeItem(DRAFT_KEY);
                setSaveState('idle');
            } else {
                localStorage.setItem(DRAFT_KEY, value);
                setSaveState('saved');
            }
        } catch (error) {
            console.warn('Draft autosave unavailable:', error);
            setSaveState('unavailable');
        }
    }

    function scheduleDraftSave() {
        clearTimeout(autosaveTimer);
        setSaveState('pending');
        autosaveTimer = setTimeout(saveDraftNow, AUTOSAVE_DELAY_MS);
    }

    // Mobile browsers can suspend the tab before a debounce fires, so write
    // any pending draft as soon as the page is hidden.
    function flushPendingDraft() {
        if (autosaveTimer !== null) saveDraftNow();
    }
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushPendingDraft();
    });
    window.addEventListener('pagehide', flushPendingDraft);

    // ---------- Incoming share (PWA share_target, Android/Chrome only) ----------
    function readSharedContent() {
        const params = new URLSearchParams(window.location.search);
        const title = (params.get('title') || '').trim();
        const text = (params.get('text') || '').trim();
        const url = (params.get('url') || '').trim();

        let body = text;
        if (url && !body.includes(url)) body = body ? `${body}\n\n${url}` : url;
        if (!body && title) body = title;

        if (body) {
            try {
                window.history.replaceState(null, '', '/');
            } catch {
                // Non-http contexts (file://, embeds) can refuse this; harmless.
            }
        }
        return body;
    }

    // ---------- Initial content: shared text > saved draft > sample ----------
    // Nothing here blocks the page. Choices are offered in a banner, and a
    // saved draft is never overwritten until the person edits.
    function chooseInitialContent() {
        const shared = readSharedContent();
        const draft = readDraft();
        const hasDraft = Boolean(draft && draft.trim() && draft !== SAMPLE_CONTENT);

        if (shared) {
            track('open-from-share');
            if (hasDraft && draft !== shared) {
                showBanner('Opened the text you shared. You also have a saved draft.', [
                    {
                        label: 'Add to my draft',
                        primary: true,
                        onClick: () => {
                            setEditorValue(`${draft}\n\n---\n\n${shared}`);
                            scheduleDraftSave();
                            hideBanner();
                        }
                    },
                    {
                        label: 'Open my draft',
                        onClick: () => {
                            setEditorValue(draft);
                            hideBanner();
                        }
                    }
                ]);
            }
            return shared;
        }

        if (hasDraft) {
            showBanner('Picked up where you left off.', [
                { label: 'Start over with the sample', onClick: () => startOverWithSample(draft) }
            ]);
            return draft;
        }
        return SAMPLE_CONTENT;
    }

    function startOverWithSample(previousDraft) {
        setEditorValue(SAMPLE_CONTENT);
        saveDraftNow(); // the sample is never stored as a draft
        showBanner('Replaced your draft with the sample.', [
            {
                label: 'Undo',
                primary: true,
                onClick: () => {
                    setEditorValue(previousDraft);
                    saveDraftNow();
                    hideBanner();
                }
            },
            { label: 'Dismiss', onClick: hideBanner }
        ]);
    }

    // ---------- Library checks ----------
    function librariesReady() {
        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            // Fail closed: never render unsanitized markdown.
            console.error('marked.js or DOMPurify not loaded');
            showNotification('Markdown libraries did not load. Check your connection and refresh.', true);
            return false;
        }
        return true;
    }

    // ---------- Markdown -> sanitized slides ----------
    // marked does not sanitize its output, so everything passes through
    // DOMPurify first. Slides are then split on top-level <hr> elements in
    // the DOM rather than by string-splitting the HTML: a string split on
    // "<hr>" can cut through an attribute value and re-assemble markup that
    // the sanitizer already neutralised.
    function buildSlides(markdownText) {
        const fragment = DOMPurify.sanitize(marked.parse(markdownText), {
            RETURN_DOM_FRAGMENT: true
        });

        const groups = [[]];
        Array.from(fragment.childNodes).forEach((node) => {
            if (node.nodeName === 'HR') {
                groups.push([]);
            } else {
                groups[groups.length - 1].push(node);
            }
        });

        return groups.map((nodes, index) => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            nodes.forEach((node) => slide.appendChild(node));

            const number = document.createElement('div');
            number.className = 'slide-number';
            number.textContent = `${index + 1}/${groups.length}`;
            slide.appendChild(number);
            return slide;
        });
    }

    // ---------- Mermaid diagrams (loaded only when a slide needs one) ----------
    // The URL and SRI hash live in the inert #mermaid-lazy tag in index.html.
    const MERMAID_TIMEOUT_MS = 20000;
    const MERMAID_RETRY_MS = 30000;
    let mermaidInstance = null;
    let mermaidPromise = null;
    let mermaidFailedAt = 0;
    let mermaidFailureShown = false;

    function initMermaid(mermaid) {
        if (!mermaidInstance) {
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'strict', // mermaid sanitizes labels; no click handlers
                suppressErrorRendering: true,
                // Match the slide palette: lamp-tinted nodes, ink text, slate lines.
                theme: 'base',
                themeVariables: {
                    fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", sans-serif',
                    fontSize: '15px',
                    primaryColor: '#fff3d1',
                    primaryBorderColor: '#e39a00',
                    primaryTextColor: '#121a26',
                    secondaryColor: '#e8eeff',
                    secondaryBorderColor: '#2447d6',
                    secondaryTextColor: '#121a26',
                    tertiaryColor: '#f1f4f8',
                    tertiaryBorderColor: '#cfd6e0',
                    tertiaryTextColor: '#121a26',
                    lineColor: '#596579',
                    textColor: '#121a26',
                    edgeLabelBackground: '#ffffff'
                }
            });
            mermaidInstance = mermaid;
        }
        return mermaidInstance;
    }

    function loadMermaid() {
        if (window.mermaid) return Promise.resolve(initMermaid(window.mermaid));
        if (mermaidPromise) return mermaidPromise;

        const source = document.getElementById('mermaid-lazy');
        if (!source) return Promise.resolve(null);

        // After a failure, wait before trying again so typing while offline
        // does not start a new download attempt on every keystroke.
        if (mermaidFailedAt && Date.now() - mermaidFailedAt < MERMAID_RETRY_MS) {
            return Promise.resolve(null);
        }

        mermaidPromise = new Promise((resolve) => {
            let settled = false;
            const script = document.createElement('script');
            const finish = (value) => {
                if (settled) return;
                settled = true;
                if (value) {
                    mermaidFailedAt = 0;
                    mermaidFailureShown = false;
                } else {
                    mermaidFailedAt = Date.now();
                    mermaidPromise = null;
                    script.remove();
                }
                resolve(value);
            };

            script.src = source.dataset.src;
            script.integrity = source.getAttribute('integrity');
            script.crossOrigin = 'anonymous';
            script.onload = () => finish(window.mermaid ? initMermaid(window.mermaid) : null);
            script.onerror = () => finish(null);
            document.head.appendChild(script);
            setTimeout(() => finish(null), MERMAID_TIMEOUT_MS);
        });
        return mermaidPromise;
    }

    let renderGeneration = 0;
    let diagramTracked = false;

    async function renderDiagrams(generation) {
        const blocks = Array.from(previewContent.querySelectorAll('pre > code.language-mermaid'));
        if (blocks.length === 0) return;

        blocks.forEach((code) => { code.parentElement.dataset.state = 'loading'; });
        const mermaid = await loadMermaid();

        // A newer render replaced these nodes while we waited; leave it alone.
        if (generation !== renderGeneration) return;

        if (!mermaid) {
            blocks.forEach((code) => { delete code.parentElement.dataset.state; });
            if (!mermaidFailureShown) {
                mermaidFailureShown = true;
                showNotification('Diagrams could not load, so they show as code for now.', true);
            }
            return;
        }

        const nodes = [];
        blocks.forEach((code) => {
            const diagram = document.createElement('div');
            diagram.className = 'mermaid';
            diagram.textContent = code.textContent; // text only, never HTML
            code.parentElement.replaceWith(diagram);
            nodes.push(diagram);
        });

        if (!diagramTracked) {
            diagramTracked = true;
            track('diagram');
        }

        try {
            await mermaid.run({ nodes, suppressErrors: true });
        } catch (error) {
            console.warn('Mermaid render failed:', error);
        }

        if (generation !== renderGeneration) return;

        nodes.forEach((diagram) => {
            if (!diagram.querySelector('svg')) {
                const message = document.createElement('div');
                message.className = 'mermaid-error';
                message.textContent = 'This diagram has a syntax error. Check the mermaid block in the editor.';
                diagram.replaceWith(message);
            }
        });
    }

    // ---------- Rendering (debounced while typing) ----------
    const RENDER_DELAY_MS = 200;
    let renderTimer = null;
    let lastRender = Promise.resolve();

    function renderEmptyState() {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        const title = document.createElement('strong');
        title.textContent = 'No slides yet';
        empty.append(title, 'Write something in the editor, or tap New slide to begin.');
        previewContent.replaceChildren(empty);
    }

    function renderMarkdown() {
        clearTimeout(renderTimer);
        renderTimer = null;
        if (!librariesReady()) return lastRender;

        const generation = ++renderGeneration;
        try {
            if (!markdownEditor.value.trim()) {
                renderEmptyState();
            } else {
                previewContent.replaceChildren(...buildSlides(markdownEditor.value));
            }
        } catch (error) {
            console.error('Markdown rendering error:', error);
            showNotification('Could not render this text. Check for unusual markup.', true);
            return lastRender;
        }
        updateSlideCount();
        lastRender = renderDiagrams(generation);
        return lastRender;
    }

    function scheduleRender() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(renderMarkdown, RENDER_DELAY_MS);
    }

    // Export/print must see the latest text with diagrams finished.
    function flushRender() {
        return renderTimer !== null ? renderMarkdown() : lastRender;
    }

    function setEditorValue(value) {
        markdownEditor.value = value;
        renderMarkdown();
    }

    // ---------- Write / Slides view (phones; both show side by side on desktop) ----------
    function setView(view) {
        document.body.dataset.view = view;
        const writing = view === 'write';
        editBtn.classList.toggle('active', writing);
        previewBtn.classList.toggle('active', !writing);
        editBtn.setAttribute('aria-pressed', String(writing));
        previewBtn.setAttribute('aria-pressed', String(!writing));
    }

    editBtn.addEventListener('click', () => setView('write'));
    previewBtn.addEventListener('click', () => setView('preview'));

    // ---------- Initial setup ----------
    markdownEditor.value = chooseInitialContent();
    setView('write');
    renderMarkdown();

    markdownEditor.addEventListener('input', () => {
        scheduleRender();
        scheduleDraftSave();
        if (!editTracked) {
            editTracked = true;
            track('edit'); // once per visit: tells us how many visitors actually write something
        }
    });

    // ---------- Insert shortcuts ----------
    const SNIPPETS = {
        slide: { text: '---\n\n# Slide title\n\n', select: 'Slide title' },
        heading: { text: '## Heading\n\n', select: 'Heading' },
        list: { text: '- First point\n- Second point\n- Third point\n', select: 'First point' },
        table: { text: '| Column | Column |\n| :----- | :----- |\n| Cell | Cell |\n' },
        diagram: { text: '```mermaid\nflowchart LR\n    A[Start] --> B[Finish]\n```\n' }
    };

    function insertSnippet(key) {
        const snippet = SNIPPETS[key];
        if (!snippet) return;

        const start = markdownEditor.selectionStart;
        const end = markdownEditor.selectionEnd;
        const before = markdownEditor.value.slice(0, start);
        const after = markdownEditor.value.slice(end);

        // Each snippet is a block: keep a blank line before it, and never
        // glue it to text that follows. A "---" straight under a line of
        // text would turn that text into a heading instead of a new slide.
        let prefix = '';
        if (before.length) prefix = before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
        const suffix = after.length && !after.startsWith('\n') ? '\n' : '';

        markdownEditor.setRangeText(prefix + snippet.text + suffix, start, end, 'end');
        markdownEditor.focus();

        if (snippet.select) {
            const from = start + prefix.length + snippet.text.indexOf(snippet.select);
            markdownEditor.setSelectionRange(from, from + snippet.select.length);
        }
        markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    document.querySelectorAll('[data-insert]').forEach((chip) => {
        // Keep focus (and the on-screen keyboard) in the editor while tapping.
        chip.addEventListener('mousedown', (event) => event.preventDefault());
        chip.addEventListener('click', () => insertSnippet(chip.dataset.insert));
    });

    // ---------- More menu ----------
    function closeMenu(returnFocus = false) {
        if (moreMenu.hidden) return;
        moreMenu.hidden = true;
        moreBtn.setAttribute('aria-expanded', 'false');
        if (returnFocus) moreBtn.focus();
    }

    function openMenu() {
        moreMenu.hidden = false;
        moreBtn.setAttribute('aria-expanded', 'true');
        const first = moreMenu.querySelector('.menu-item');
        if (first) first.focus();
    }

    moreBtn.addEventListener('click', () => (moreMenu.hidden ? openMenu() : closeMenu(true)));
    moreMenu.addEventListener('click', () => closeMenu(false));
    document.addEventListener('click', (event) => {
        if (!moreMenu.hidden && !event.target.closest('.menu-wrap')) closeMenu(false);
    });
    moreMenu.addEventListener('keydown', (event) => {
        const items = Array.from(moreMenu.querySelectorAll('.menu-item'));
        const index = items.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            items[(index + 1) % items.length].focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            items[(index - 1 + items.length) % items.length].focus();
        } else if (event.key === 'Tab') {
            closeMenu(false);
        }
    });

    // ---------- Modals ----------
    const modals = [exportModal, saveModal, aboutModal, feedbackModal];
    let modalOpener = null;

    function focusableIn(container) {
        return Array.from(container.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )).filter((el) => el.offsetParent !== null || el === document.activeElement);
    }

    function openModal(modal, focusTarget) {
        modalOpener = document.activeElement;
        modal.style.display = 'flex';
        (focusTarget || focusableIn(modal)[0] || modal).focus();
    }

    function closeModal(modal) {
        modal.style.display = 'none';
        const usable = modalOpener && document.contains(modalOpener) && modalOpener.offsetParent !== null;
        (usable ? modalOpener : moreBtn).focus();
        modalOpener = null;
    }

    modals.forEach((modal) => {
        modal.addEventListener('mousedown', (event) => {
            if (event.target === modal) closeModal(modal);
        });
    });

    // Keep Tab inside whichever dialog is open.
    function trapTab(event, container) {
        const items = focusableIn(container);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    // ---------- Present mode ----------
    let presentSlides = [];
    let presentIndex = 0;
    let presentOpener = null;
    const isPresenting = () => !presenter.hidden;

    function fitPresentedSlide() {
        const slide = presenterStage.firstElementChild;
        if (!slide || !slide.offsetWidth || !slide.offsetHeight) return;
        const scale = Math.min(
            (window.innerWidth * 0.95) / slide.offsetWidth,
            (window.innerHeight * 0.88) / slide.offsetHeight
        );
        slide.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    function showPresentedSlide(index) {
        presentIndex = Math.max(0, Math.min(presentSlides.length - 1, index));
        presenterStage.replaceChildren(presentSlides[presentIndex]);
        presentCount.textContent = `${presentIndex + 1} / ${presentSlides.length}`;
        presentPrev.disabled = presentIndex === 0;
        presentNext.disabled = presentIndex === presentSlides.length - 1;
        fitPresentedSlide();
    }

    // Start from the slide currently at the top of the preview, if it is on screen.
    function firstVisibleSlideIndex(slides) {
        if (getComputedStyle(previewPanel).visibility === 'hidden') return 0;
        const top = previewContent.getBoundingClientRect().top;
        const index = slides.findIndex((slide) => slide.getBoundingClientRect().bottom > top + 40);
        return index === -1 ? 0 : index;
    }

    async function openPresenter() {
        await flushRender();
        const slides = Array.from(previewContent.querySelectorAll('.slide'));
        if (slides.length === 0) {
            showNotification('Add a slide first, then present.', true);
            return;
        }
        presentOpener = document.activeElement;
        presentSlides = slides.map((slide) => slide.cloneNode(true));
        presenter.hidden = false;
        showPresentedSlide(firstVisibleSlideIndex(slides));
        presentClose.focus();
        track('present');

        if (presenter.requestFullscreen) {
            presenter.requestFullscreen().catch(() => {}); // optional; fine without it
        }
    }

    function closePresenter() {
        if (!isPresenting()) return;
        presenter.hidden = true;
        presenterStage.replaceChildren();
        presentSlides = [];
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        const usable = presentOpener && document.contains(presentOpener) && presentOpener.offsetParent !== null;
        (usable ? presentOpener : presentBtn).focus();
        presentOpener = null;
    }

    presentBtn.addEventListener('click', openPresenter);
    presentPrev.addEventListener('click', (event) => { event.stopPropagation(); showPresentedSlide(presentIndex - 1); });
    presentNext.addEventListener('click', (event) => { event.stopPropagation(); showPresentedSlide(presentIndex + 1); });
    presentClose.addEventListener('click', (event) => { event.stopPropagation(); closePresenter(); });

    // Tap the left third to go back, anywhere else to go forward.
    presenterStage.addEventListener('click', (event) => {
        showPresentedSlide(presentIndex + (event.clientX < window.innerWidth / 3 ? -1 : 1));
    });

    let swipeStartX = null;
    presenter.addEventListener('touchstart', (event) => {
        swipeStartX = event.touches.length === 1 ? event.touches[0].clientX : null;
    }, { passive: true });
    presenter.addEventListener('touchend', (event) => {
        if (swipeStartX === null) return;
        const delta = event.changedTouches[0].clientX - swipeStartX;
        swipeStartX = null;
        if (Math.abs(delta) > 50) {
            event.preventDefault(); // swipe handled; skip the synthetic tap
            showPresentedSlide(presentIndex + (delta < 0 ? 1 : -1));
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) closePresenter();
    });
    window.addEventListener('resize', () => { if (isPresenting()) fitPresentedSlide(); });

    // ---------- Keyboard ----------
    document.addEventListener('keydown', (event) => {
        if (isPresenting()) {
            const keys = {
                ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1, Enter: 1,
                ArrowLeft: -1, ArrowUp: -1, PageUp: -1, Backspace: -1
            };
            if (event.key === 'Escape') {
                event.preventDefault();
                closePresenter();
            } else if (event.key === 'Home') {
                event.preventDefault();
                showPresentedSlide(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                showPresentedSlide(presentSlides.length - 1);
            } else if (event.key in keys && !((event.key === ' ' || event.key === 'Enter') && event.target.tagName === 'BUTTON')) {
                event.preventDefault();
                showPresentedSlide(presentIndex + keys[event.key]);
            } else if (event.key === 'Tab') {
                trapTab(event, presenter);
            }
            return;
        }

        const openModalEl = modals.find((modal) => modal.style.display === 'flex');
        if (openModalEl) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeModal(openModalEl);
            } else if (event.key === 'Tab') {
                trapTab(event, openModalEl);
            } else if (event.key === 'Enter' && event.target.matches('input[type="text"]')) {
                event.preventDefault();
                (openModalEl === exportModal ? confirmExportBtn : confirmSaveBtn).click();
            }
            return;
        }

        if (event.key === 'Escape' && !moreMenu.hidden) closeMenu(true);
    });

    // ---------- PDF export (jsPDF + html2canvas-pro, one slide per page) ----------
    const ORIENTATION_KEY = 'slideforge-pdf-orientation';

    function readOrientation() {
        try {
            return localStorage.getItem(ORIENTATION_KEY) === 'portrait' ? 'portrait' : 'landscape';
        } catch {
            return 'landscape';
        }
    }

    exportPdfBtn.addEventListener('click', () => {
        fileNameInput.value = 'presentation.pdf';
        const radio = exportModal.querySelector(`input[name="pdfOrientation"][value="${readOrientation()}"]`);
        if (radio) radio.checked = true;
        openModal(exportModal, fileNameInput);
        fileNameInput.select();
    });

    cancelExportBtn.addEventListener('click', () => closeModal(exportModal));

    async function exportToPdf(fileName, orientation) {
        const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
        const renderToCanvas = typeof window.html2canvas === 'function'
            ? window.html2canvas
            : window.html2canvas && window.html2canvas.default;

        if (!jsPDFCtor || typeof renderToCanvas !== 'function') {
            showNotification('PDF tools did not load. Check your connection and refresh.', true);
            return;
        }

        confirmExportBtn.disabled = true;
        confirmExportBtn.textContent = 'Exporting…';
        showNotification('Building your PDF…');

        try {
            await flushRender();

            const slides = previewContent.querySelectorAll('.slide');
            if (slides.length === 0) {
                showNotification('Add a slide first, then export.', true);
                return;
            }

            const pdf = new jsPDFCtor({ unit: 'in', format: 'letter', orientation });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = orientation === 'landscape' ? 0.4 : 0.5;
            const usableWidth = pageWidth - margin * 2;
            const usableHeight = pageHeight - margin * 2;

            for (let i = 0; i < slides.length; i++) {
                const canvas = await renderToCanvas(slides[i], {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                let renderWidth = usableWidth;
                let renderHeight = (canvas.height * renderWidth) / canvas.width;

                // Each slide renders as one full page -- shrink to fit rather
                // than letting content split across a page boundary.
                if (renderHeight > usableHeight) {
                    renderHeight = usableHeight;
                    renderWidth = (canvas.width * renderHeight) / canvas.height;
                }

                if (i > 0) pdf.addPage();

                const xOffset = (pageWidth - renderWidth) / 2;
                const yOffset = orientation === 'landscape' ? (pageHeight - renderHeight) / 2 : margin;
                pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderWidth, renderHeight);

                // A hairline keeps the white slide readable against the white page.
                pdf.setDrawColor(207, 214, 224);
                pdf.setLineWidth(0.01);
                pdf.rect(xOffset, yOffset, renderWidth, renderHeight);
            }

            pdf.save(fileName);
            showNotification('PDF exported successfully!');
            track('export-pdf');
        } catch (error) {
            console.error('PDF export failed:', error);
            showNotification('PDF export failed. Try again, or use Print and save as PDF.', true);
        } finally {
            confirmExportBtn.disabled = false;
            confirmExportBtn.textContent = 'Export';
        }
    }

    confirmExportBtn.addEventListener('click', () => {
        let fileName = fileNameInput.value.trim();
        if (!fileName) {
            showNotification('Enter a file name for the PDF.', true);
            return;
        }
        if (!fileName.toLowerCase().endsWith('.pdf')) {
            fileName += '.pdf';
        }
        const chosen = exportModal.querySelector('input[name="pdfOrientation"]:checked');
        const orientation = chosen && chosen.value === 'portrait' ? 'portrait' : 'landscape';
        try {
            localStorage.setItem(ORIENTATION_KEY, orientation);
        } catch {
            // Remembering the choice is a convenience only.
        }
        closeModal(exportModal);
        exportToPdf(fileName, orientation);
    });

    // ---------- Share (outgoing, via the OS share sheet) ----------
    shareBtn.addEventListener('click', () => {
        const markdownText = markdownEditor.value;
        track('share');

        if (navigator.share) {
            navigator.share({
                title: 'Markdown from SlideForge',
                text: markdownText
            }).then(() => {
                showNotification('Shared.');
            }).catch((error) => {
                if (error && error.name === 'AbortError') return; // user closed the sheet
                console.error('Share failed:', error);
                fallbackShare(markdownText);
            });
        } else {
            fallbackShare(markdownText);
        }
    });

    function fallbackShare(content) {
        const legacyCopy = () => {
            const textarea = document.createElement('textarea');
            textarea.value = content;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showNotification('Markdown copied to your clipboard.');
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(content)
                .then(() => showNotification('Markdown copied to your clipboard.'))
                .catch(legacyCopy);
        } else {
            legacyCopy();
        }
    }

    // ---------- Native print (print.css rules live in styles.css) ----------
    printNativeBtn.addEventListener('click', async () => {
        await flushRender();
        window.print();
    });

    // ---------- Import ----------
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setEditorValue(event.target.result);
                scheduleDraftSave();
                hideBanner();
                showNotification('File imported.');
                track('import');
            };
            reader.onerror = () => {
                showNotification('Could not read that file.', true);
            };
            reader.readAsText(file);
        }
        fileInput.value = '';
    });

    // ---------- Save (Markdown / Text / HTML) ----------
    function stripMarkdown(md) {
        return md
            .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?|```/g, ''))
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/!\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/^>\s?/gm, '')
            .replace(/^[-*+]\s+/gm, '• ')
            .replace(/^\d+\.\s+/gm, '')
            .replace(/^-{3,}\s*$/gm, '\n----------\n')
            .trim();
    }

    // Uses the same sanitized slide builder as the preview. Mermaid blocks
    // are exported as their source code, not as rendered diagrams.
    function buildStandaloneHtml(markdownText) {
        const slideMarkup = buildSlides(markdownText)
            .map((slide) => slide.outerHTML)
            .join('\n');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>SlideForge Export</title>
<style>
  body { margin: 0; padding: 40px 16px; background: #e4e8ee; color: #2b3647; font-family: "Source Serif 4", Georgia, "Times New Roman", serif; }
  .slide { position: relative; max-width: 880px; margin: 0 auto 28px; padding: 6% 7% 7%; min-height: 380px; background: #fff; border-radius: 6px; box-shadow: 0 1px 2px rgba(18,26,38,.1), 0 18px 40px -18px rgba(18,26,38,.35); line-height: 1.55; }
  .slide::before { content: ""; position: absolute; top: 0; left: 7%; width: 2.6em; height: 6px; border-radius: 0 0 3px 3px; background: #ffb000; }
  .slide h1, .slide h2, .slide h3, .slide th { font-family: "Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #121a26; }
  .slide h1 { font-size: 2.2em; line-height: 1.08; letter-spacing: -0.025em; margin: 0 0 .5em; }
  .slide h2 { font-size: 1.5em; line-height: 1.15; margin: 1.1em 0 .45em; }
  .slide h3 { font-size: 1.1em; color: #2447d6; margin: 1em 0 .35em; }
  .slide p, .slide li { font-size: 1.05em; }
  .slide p { margin: 0 0 .8em; }
  .slide ul, .slide ol { margin: 0 0 .9em; padding-left: 1.35em; }
  .slide li { margin-bottom: .3em; }
  .slide li::marker { color: #e39a00; }
  .slide a { color: #2447d6; }
  .slide blockquote { margin: 1em 0; padding: .1em 0 .1em 1em; border-left: 3px solid #ffb000; font-size: 1.12em; font-style: italic; color: #121a26; }
  .slide code { padding: .1em .35em; border-radius: 4px; background: #f1f4f8; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .84em; color: #1d3aa8; }
  .slide pre { margin: 0 0 1em; padding: .9em 1.1em; border: 1px solid #dde3ec; border-radius: 8px; background: #f1f4f8; overflow-x: auto; }
  .slide pre code { padding: 0; background: none; color: #121a26; }
  .slide table { width: 100%; margin: 0 0 1em; border-collapse: collapse; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: .95em; }
  .slide th, .slide td { padding: .55em .8em; text-align: left; border-bottom: 1px solid #dde3ec; }
  .slide th { font-weight: 650; border-bottom: 2px solid #121a26; }
  .slide img { max-width: 100%; height: auto; }
  .slide-number { position: absolute; right: 1.4em; bottom: 1em; font-family: system-ui, sans-serif; font-size: .78em; color: #5f6b7e; }
  @media print { body { background: #fff; padding: 0; } .slide { box-shadow: none; border-radius: 0; margin: 0; max-width: none; page-break-after: always; } .slide::before, .slide-number { display: none; } }
</style>
</head>
<body>
${slideMarkup}
</body>
</html>`;
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    saveBtn.addEventListener('click', () => {
        saveFileNameInput.value = 'presentation';
        openModal(saveModal, saveFileNameInput);
        saveFileNameInput.select();
    });

    cancelSaveBtn.addEventListener('click', () => closeModal(saveModal));

    confirmSaveBtn.addEventListener('click', () => {
        const baseName = saveFileNameInput.value.trim() || 'presentation';
        const saveTypeInput = document.querySelector('input[name="saveType"]:checked');
        const markdownText = markdownEditor.value;

        if (!saveTypeInput) {
            showNotification('Choose a file format.', true);
            return;
        }

        let content, fileName, mimeType;

        switch (saveTypeInput.value) {
            case 'markdown':
                content = markdownText;
                fileName = `${baseName}.md`;
                mimeType = 'text/markdown';
                break;
            case 'text':
                content = stripMarkdown(markdownText);
                fileName = `${baseName}.txt`;
                mimeType = 'text/plain';
                break;
            case 'html':
                if (!librariesReady()) return;
                content = buildStandaloneHtml(markdownText);
                fileName = `${baseName}.html`;
                mimeType = 'text/html';
                break;
            default:
                showNotification('Choose a file format.', true);
                return;
        }

        try {
            downloadFile(content, fileName, mimeType);
            closeModal(saveModal);
            showNotification(`Saved ${fileName}.`);
            track(`save-${saveTypeInput.value}`);
        } catch (error) {
            console.error('Save failed:', error);
            showNotification('Could not save the file. Try again.', true);
        }
    });

    // ---------- Feedback ----------
    // Links are built when the dialog opens. They carry the app version and
    // basic device facts so a report can be reproduced, and never the slides.
    function deviceFacts() {
        const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        return {
            version: CONFIG.version || '',
            browser: navigator.userAgent,
            screen: `${window.screen ? window.screen.width : '?'}x${window.screen ? window.screen.height : '?'}`,
            installed: standalone ? 'yes' : 'no'
        };
    }

    function issueUrl(template) {
        const facts = deviceFacts();
        const params = new URLSearchParams({
            template,
            version: facts.version,
            environment: `${facts.browser} | screen ${facts.screen} | installed app: ${facts.installed}`
        });
        return `https://github.com/${CONFIG.repo}/issues/new?${params.toString()}`;
    }

    function openFeedback() {
        feedbackBug.href = issueUrl('bug_report.yml');
        feedbackIdea.href = issueUrl('feature_request.yml');

        if (CONFIG.feedbackEmail) {
            const facts = deviceFacts();
            const body = [
                'What happened, or what would you like?',
                '',
                '',
                '--- Added automatically (no slide content) ---',
                `Version: ${facts.version}`,
                `Browser: ${facts.browser}`,
                `Screen: ${facts.screen}`,
                `Installed app: ${facts.installed}`
            ].join('\n');
            feedbackMail.href = `mailto:${CONFIG.feedbackEmail}?subject=${encodeURIComponent('SlideForge feedback')}&body=${encodeURIComponent(body)}`;
            feedbackMail.hidden = false;
        } else {
            feedbackMail.hidden = true;
        }

        track('feedback');
        openModal(feedbackModal, feedbackBug);
    }

    feedbackBtn.addEventListener('click', openFeedback);
    closeFeedbackBtn.addEventListener('click', () => closeModal(feedbackModal));

    // ---------- About ----------
    function syncAnalyticsRow() {
        if (!analytics || !analytics.configured()) {
            analyticsRow.hidden = true;
            return;
        }
        analyticsRow.hidden = false;
        if (analytics.browserOptedOut()) {
            analyticsToggle.checked = false;
            analyticsToggle.disabled = true;
            analyticsToggle.nextElementSibling.insertAdjacentText('beforeend', ' Off, because your browser sends Do Not Track.');
        } else {
            analyticsToggle.checked = !analytics.isOff();
        }
    }

    if (appVersionEl && CONFIG.version) appVersionEl.textContent = CONFIG.version;
    syncAnalyticsRow();
    analyticsToggle.addEventListener('change', () => {
        if (analytics) analytics.setEnabled(analyticsToggle.checked);
        showNotification(analyticsToggle.checked ? 'Anonymous usage counts are on.' : 'Anonymous usage counts are off.');
    });

    aboutBtn.addEventListener('click', () => openModal(aboutModal, closeAboutBtn));
    closeAboutBtn.addEventListener('click', () => closeModal(aboutModal));
});

// ---------- Service worker (installable + offline) ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch((error) => {
            // Expected on CodePen and file:// -- the app still works without it.
            console.warn('Service worker not registered:', error);
        });
    });
}
