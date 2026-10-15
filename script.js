document.addEventListener('DOMContentLoaded', () => {
    // ---------- Element references ----------
    const markdownEditor = document.getElementById('markdownEditor');
    const previewContent = document.getElementById('previewContent');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const shareBtn = document.getElementById('shareBtn');
    const printNativeBtn = document.getElementById('printNativeBtn');
    const saveBtn = document.getElementById('saveBtn');
    const importBtn = document.getElementById('importBtn');
    const editBtn = document.getElementById('editBtn');
    const previewBtn = document.getElementById('previewBtn');
    const editorPanel = document.querySelector('.editor-panel');
    const previewPanel = document.querySelector('.preview-panel');
    const exportModal = document.getElementById('exportModal');
    const saveModal = document.getElementById('saveModal');
    const fileNameInput = document.getElementById('fileNameInput');
    const saveFileNameInput = document.getElementById('saveFileNameInput');
    const confirmExportBtn = document.getElementById('confirmExportBtn');
    const cancelExportBtn = document.getElementById('cancelExportBtn');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const cancelSaveBtn = document.getElementById('cancelSaveBtn');
    const fileInput = document.getElementById('fileInput');
    const notification = document.getElementById('notification');

    // ---------- Sample content ----------
    const SAMPLE_CONTENT = `# Welcome to SlideForge!

## Your Interactive Markdown Editor

This is a **Markdown** editor. You can type Markdown here and see the preview on the right.

### Key Features:
* Real-time Markdown to HTML conversion
* Export your content as a PDF
* Share content with others
* Use your device's native print function
* Save in multiple formats

\`\`\`javascript
function helloWorld() {
    console.log("Hello, SlideForge User!");
}
helloWorld();
\`\`\`

> "Write once, preview everywhere." - The SlideForge Motto

---

# About Your Presentation

This is a new slide. Use three hyphens (\`---\`) on a new line to create a new slide.

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
        notification.style.backgroundColor = isError ? '#e53e3e' : '#48bb78';
        notification.style.display = 'block';
        notificationTimeout = setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
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
            } else {
                localStorage.setItem(DRAFT_KEY, value);
            }
        } catch (error) {
            console.warn('Draft autosave unavailable:', error);
        }
    }

    function scheduleDraftSave() {
        clearTimeout(autosaveTimer);
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
    function chooseInitialContent() {
        const shared = readSharedContent();
        const draft = readDraft();
        const hasDraft = Boolean(draft && draft.trim() && draft !== SAMPLE_CONTENT);

        if (shared) {
            if (hasDraft && draft !== shared) {
                const append = window.confirm(
                    'Add the shared text to the end of your saved draft?\n\n' +
                    'OK: append it as a new slide.\n' +
                    'Cancel: open the shared text on its own (your draft is replaced once you edit).'
                );
                return append ? `${draft}\n\n---\n\n${shared}` : shared;
            }
            return shared;
        }

        if (hasDraft && window.confirm('Restore your last unsaved draft?')) {
            return draft;
        }
        return SAMPLE_CONTENT;
    }

    // ---------- Library checks ----------
    function librariesReady() {
        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            // Fail closed: never render unsanitized markdown.
            console.error('marked.js or DOMPurify not loaded');
            showNotification('Markdown libraries not loaded. Please refresh the page.', true);
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

    // ---------- Mermaid diagrams ----------
    const mermaidAvailable = typeof window.mermaid !== 'undefined';
    if (mermaidAvailable) {
        window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict', // mermaid sanitizes labels; no click handlers
            theme: 'default',
            suppressErrorRendering: true
        });
    }

    let renderGeneration = 0;

    async function renderDiagrams(generation) {
        if (!mermaidAvailable) return;

        const nodes = [];
        previewContent.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
            const diagram = document.createElement('div');
            diagram.className = 'mermaid';
            diagram.textContent = code.textContent; // text only, never HTML
            code.parentElement.replaceWith(diagram);
            nodes.push(diagram);
        });
        if (nodes.length === 0) return;

        try {
            await window.mermaid.run({ nodes, suppressErrors: true });
        } catch (error) {
            console.warn('Mermaid render failed:', error);
        }

        // A newer render replaced these nodes while we waited; leave it alone.
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

    function renderMarkdown() {
        clearTimeout(renderTimer);
        renderTimer = null;
        if (!librariesReady()) return lastRender;

        const generation = ++renderGeneration;
        try {
            previewContent.replaceChildren(...buildSlides(markdownEditor.value));
        } catch (error) {
            console.error('Markdown rendering error:', error);
            showNotification('Error rendering markdown', true);
            return lastRender;
        }
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

    // ---------- Panel display (mobile edit/preview toggle) ----------
    const updatePanelDisplay = () => {
        if (window.innerWidth <= 768) {
            if (editBtn.classList.contains('active')) {
                editorPanel.style.display = 'flex';
                previewPanel.style.display = 'none';
            } else {
                editorPanel.style.display = 'none';
                previewPanel.style.display = 'flex';
            }
        } else {
            editorPanel.style.display = 'flex';
            previewPanel.style.display = 'flex';
            editorPanel.style.flex = '1';
            previewPanel.style.flex = '1';
        }
        editorPanel.style.width = 'auto';
        previewPanel.style.width = 'auto';
    };

    // ---------- Initial setup ----------
    markdownEditor.value = chooseInitialContent();
    editBtn.classList.add('active');
    updatePanelDisplay();
    renderMarkdown();

    markdownEditor.addEventListener('input', () => {
        scheduleRender();
        scheduleDraftSave();
    });

    editBtn.addEventListener('click', () => {
        editBtn.classList.add('active');
        previewBtn.classList.remove('active');
        updatePanelDisplay();
    });

    previewBtn.addEventListener('click', () => {
        previewBtn.classList.add('active');
        editBtn.classList.remove('active');
        updatePanelDisplay();
    });

    window.addEventListener('resize', updatePanelDisplay);

    // ---------- PDF export (jsPDF + html2canvas-pro, one slide per page) ----------
    exportPdfBtn.addEventListener('click', () => {
        exportModal.style.display = 'flex';
        fileNameInput.value = 'presentation.pdf';
        fileNameInput.focus();
    });

    cancelExportBtn.addEventListener('click', () => {
        exportModal.style.display = 'none';
    });

    async function exportToPdf(fileName) {
        const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
        const renderToCanvas = typeof window.html2canvas === 'function'
            ? window.html2canvas
            : window.html2canvas && window.html2canvas.default;

        if (!jsPDFCtor || typeof renderToCanvas !== 'function') {
            showNotification('PDF export libraries not loaded. Please refresh the page.', true);
            return;
        }

        confirmExportBtn.disabled = true;
        confirmExportBtn.textContent = 'Exporting...';
        showNotification('Generating PDF...');

        try {
            await flushRender();

            const slides = previewContent.querySelectorAll('.slide');
            if (slides.length === 0) {
                showNotification('Nothing to export yet.', true);
                return;
            }

            const pdf = new jsPDFCtor({ unit: 'in', format: 'letter', orientation: 'portrait' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 0.5;
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

                const xOffset = margin + (usableWidth - renderWidth) / 2;
                pdf.addImage(imgData, 'JPEG', xOffset, margin, renderWidth, renderHeight);
            }

            pdf.save(fileName);
            showNotification('PDF exported successfully!');
        } catch (error) {
            console.error('PDF export failed:', error);
            showNotification('PDF export failed. Please try again.', true);
        } finally {
            confirmExportBtn.disabled = false;
            confirmExportBtn.textContent = 'Export';
        }
    }

    confirmExportBtn.addEventListener('click', () => {
        let fileName = fileNameInput.value.trim();
        if (!fileName) {
            showNotification('Please enter a file name for the PDF.', true);
            return;
        }
        if (!fileName.toLowerCase().endsWith('.pdf')) {
            fileName += '.pdf';
        }
        exportModal.style.display = 'none';
        exportToPdf(fileName);
    });

    // ---------- Share (outgoing, via the OS share sheet) ----------
    shareBtn.addEventListener('click', () => {
        const markdownText = markdownEditor.value;

        if (navigator.share) {
            navigator.share({
                title: 'Markdown Content from SlideForge',
                text: markdownText
            }).then(() => {
                showNotification('Content shared successfully!');
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
            showNotification('Content copied to clipboard!');
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(content)
                .then(() => showNotification('Content copied to clipboard!'))
                .catch(legacyCopy);
        } else {
            legacyCopy();
        }
    }

    // ---------- Native print ----------
    printNativeBtn.addEventListener('click', async () => {
        await flushRender();

        const appContainer = document.querySelector('.app-container');
        const sidebar = document.querySelector('.sidebar');
        const header = document.querySelector('.header');

        const originalStyles = {
            sidebarDisplay: sidebar.style.display,
            headerDisplay: header.style.display,
            appMargin: appContainer.style.margin,
            appBorderRadius: appContainer.style.borderRadius,
            appBoxShadow: appContainer.style.boxShadow,
            appHeight: appContainer.style.height
        };

        sidebar.style.display = 'none';
        header.style.display = 'none';
        appContainer.style.margin = '0';
        appContainer.style.borderRadius = '0';
        appContainer.style.boxShadow = 'none';
        appContainer.style.height = 'auto';

        editorPanel.style.display = 'none';
        previewPanel.style.display = 'block';
        previewPanel.style.flex = '1';
        previewPanel.style.width = '100%';

        window.print();

        setTimeout(() => {
            sidebar.style.display = originalStyles.sidebarDisplay;
            header.style.display = originalStyles.headerDisplay;
            appContainer.style.margin = originalStyles.appMargin;
            appContainer.style.borderRadius = originalStyles.appBorderRadius;
            appContainer.style.boxShadow = originalStyles.appBoxShadow;
            appContainer.style.height = originalStyles.appHeight;

            updatePanelDisplay();
        }, 1000);
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
                markdownEditor.value = event.target.result;
                renderMarkdown();
                scheduleDraftSave();
                showNotification('File imported successfully!');
            };
            reader.onerror = () => {
                showNotification('Error reading file.', true);
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
<title>SlideForge Export</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f7fafc; margin: 0; padding: 40px; }
  .slide { max-width: 800px; margin: 0 auto 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative; }
  .slide h1 { font-size: 2.5em; color: #2d3748; text-align: center; margin-bottom: 20px; }
  .slide h2 { font-size: 2em; color: #4a5568; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin: 30px 0 15px; }
  .slide h3 { font-size: 1.5em; color: #667eea; margin: 20px 0 10px; }
  .slide p, .slide li { font-size: 1.1em; line-height: 1.6; color: #4a5568; margin-bottom: 15px; }
  .slide pre { background: #edf2f7; padding: 15px; border-radius: 8px; overflow-x: auto; }
  .slide table { width: 100%; border-collapse: collapse; }
  .slide th, .slide td { border: 1px solid #e2e8f0; padding: 12px 15px; text-align: left; }
  .slide th { background: #ebf4ff; }
  .slide blockquote { border-left: 4px solid #4299e1; padding: 10px 20px; background: #ebf8ff; margin: 20px 0; font-style: italic; }
  .slide-number { position: absolute; bottom: 15px; right: 20px; font-size: 0.9em; color: #a0aec0; }
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
        saveModal.style.display = 'flex';
        saveFileNameInput.value = 'presentation';
        saveFileNameInput.focus();
    });

    cancelSaveBtn.addEventListener('click', () => {
        saveModal.style.display = 'none';
    });

    confirmSaveBtn.addEventListener('click', () => {
        const baseName = saveFileNameInput.value.trim() || 'presentation';
        const saveTypeInput = document.querySelector('input[name="saveType"]:checked');
        const markdownText = markdownEditor.value;

        if (!saveTypeInput) {
            showNotification('Please choose a save format.', true);
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
                showNotification('Please choose a save format.', true);
                return;
        }

        try {
            downloadFile(content, fileName, mimeType);
            saveModal.style.display = 'none';
            showNotification('File saved successfully!');
        } catch (error) {
            console.error('Save failed:', error);
            showNotification('Save failed. Please try again.', true);
        }
    });
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
