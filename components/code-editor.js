import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { python } from '@codemirror/lang-python';

const MOBILE_BREAKPOINT = 768;

const langMap = {
  javascript: javascript(),
  js: javascript(),
  html: html(),
  python: python(),
};

const pathioTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    backgroundColor: '#050A08',
    color: '#8FDFBA',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'Geist Mono', monospace",
  },
  '.cm-content': {
    fontFamily: "'Geist Mono', monospace",
    caretColor: '#3DFF8F',
    padding: '12px 0',
  },
  '.cm-gutters': {
    backgroundColor: '#0C1410',
    color: '#4A6355',
    border: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#111D17',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(61, 255, 143, 0.06)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(61, 255, 143, 0.18) !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#3DFF8F',
  },
});

let editor = null;
let currentLanguage = 'javascript';
let mobileTextarea = null;
let fillBlanksActive = false;
let mobileFillBlanksData = null;

function isMobileViewport() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function normalizeLanguage(language) {
  const key = String(language || 'javascript').toLowerCase();
  if (key === 'js') return 'javascript';
  if (langMap[key]) return key;
  return 'javascript';
}

function getCodeFromEditor() {
  if (fillBlanksActive) {
    return getFillBlanksCode();
  }
  if (isMobileViewport() && mobileTextarea) {
    return mobileTextarea.value;
  }
  if (editor) {
    return editor.state.doc.toString();
  }
  const fallback = document.getElementById('code-editor-mobile');
  return fallback ? fallback.value : '';
}

function getFillBlanksCode() {
  const panel = document.getElementById('fill-blanks-panel');
  if (!panel) return '';

  const template = panel.dataset.template || '';
  const inputs = panel.querySelectorAll('.blank-input');
  let blankIndex = 0;

  return template.replace(/<__>|<\/__>/g, (match) => {
    if (match === '<__>') {
      const value = inputs[blankIndex]?.value || '';
      blankIndex += 1;
      return value;
    }
    return '';
  });
}

export function destroyCodeEditor() {
  if (editor) {
    editor.destroy();
    editor = null;
  }
  mobileTextarea = null;
  fillBlanksActive = false;
  mobileFillBlanksData = null;
}

export function initCodeEditor(language, starterCode = '', options = {}) {
  destroyCodeEditor();

  currentLanguage = normalizeLanguage(language);
  mobileFillBlanksData = options.mobileFillBlanks || null;

  const container = document.getElementById('code-editor-container');
  const mobileEl = document.getElementById('code-editor-mobile');
  const fillPanel = document.getElementById('fill-blanks-panel');
  const code = starterCode || '';

  if (!container) return;

  container.innerHTML = '';
  container.classList.remove('hidden');

  if (mobileEl) {
    mobileEl.value = code;
    mobileEl.classList.add('hidden');
  }

  if (fillPanel) {
    fillPanel.classList.add('hidden');
    fillPanel.innerHTML = '';
  }

  if (isMobileViewport()) {
    container.classList.add('hidden');
    if (mobileEl) {
      mobileEl.classList.remove('hidden');
      mobileTextarea = mobileEl;
    }
    return;
  }

  const extensions = [
    basicSetup,
    pathioTheme,
    EditorView.lineWrapping,
  ];

  if (langMap[currentLanguage]) {
    extensions.push(langMap[currentLanguage]);
  }

  editor = new EditorView({
    doc: code,
    extensions,
    parent: container,
  });
}

export function switchToFillBlanks() {
  if (!mobileFillBlanksData) {
    showOutput('Fill-in-the-blanks is not available for this week.', 'error');
    return;
  }

  const container = document.getElementById('code-editor-container');
  const mobileEl = document.getElementById('code-editor-mobile');
  const fillPanel = document.getElementById('fill-blanks-panel');

  if (!fillPanel) return;

  fillBlanksActive = true;
  container?.classList.add('hidden');
  mobileEl?.classList.add('hidden');

  const template = String(mobileFillBlanksData.template || '');
  const blanks = Array.isArray(mobileFillBlanksData.blanks) ? mobileFillBlanksData.blanks : [];

  let blankIndex = 0;
  const rendered = template.replace(/<\/?__>/g, (match) => {
    if (match === '<__>') {
      const placeholder = blanks[blankIndex] ? `e.g. ${blanks[blankIndex]}` : 'type here';
      const input = `<input type="text" class="blank-input" data-blank-index="${blankIndex}" placeholder="${escapeHtml(placeholder)}" />`;
      blankIndex += 1;
      return input;
    }
    return '';
  });

  fillPanel.dataset.template = template;
  fillPanel.innerHTML = `
    <p class="fill-blanks-hint">${escapeHtml(mobileFillBlanksData.explanation || 'Fill in the blanks to complete the code.')}</p>
    <div class="fill-blanks-code">${rendered}</div>
    <button type="button" class="fill-back-btn" id="fill-back-btn">← Back to editor</button>
  `;

  fillPanel.classList.remove('hidden');

  document.getElementById('fill-back-btn')?.addEventListener('click', () => {
    fillBlanksActive = false;
    fillPanel.classList.add('hidden');
    if (isMobileViewport()) {
      mobileEl?.classList.remove('hidden');
    } else {
      container?.classList.remove('hidden');
    }
  });
}

export function showOutput(text, type = 'success') {
  const outputEl = document.getElementById('code-output');
  if (!outputEl) return;

  outputEl.classList.remove('output-success', 'output-error', 'output-neutral');
  outputEl.classList.add(type === 'error' ? 'output-error' : type === 'success' ? 'output-success' : 'output-neutral');

  if (type === 'html-preview') {
    outputEl.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.className = 'html-preview-frame';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    iframe.srcdoc = text;
    outputEl.appendChild(iframe);
    return;
  }

  const line = document.createElement('pre');
  line.className = 'output-line';
  line.textContent = text || '(no output)';
  outputEl.innerHTML = '';
  outputEl.appendChild(line);
}

export function runCode(language) {
  const lang = normalizeLanguage(language || currentLanguage);
  const code = getCodeFromEditor();
  const outputEl = document.getElementById('code-output');

  if (!outputEl) return;

  if (lang === 'python') {
    showOutput('Python code runs in the BUILD tab using Pyodide.', 'neutral');
    return;
  }

  if (lang === 'html') {
    showOutput(code, 'html-preview');
    return;
  }

  if (lang === 'javascript') {
    const logs = [];
    const originalLog = console.log;

    console.log = (...args) => {
      logs.push(args.map((arg) => String(arg)).join(' '));
    };

    try {
      const result = eval(code);
      const lines = [...logs];
      if (result !== undefined) {
        lines.push(`// Returns: ${result}`);
      }
      showOutput(lines.length ? lines.join('\n') : '// Code executed successfully (no output)', 'success');
    } catch (err) {
      showOutput(err.message, 'error');
    } finally {
      console.log = originalLog;
    }
    return;
  }

  showOutput(`Running ${lang} is not supported in the live preview.`, 'error');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.addEventListener('resize', () => {
  const container = document.getElementById('code-editor-container');
  if (!container || fillBlanksActive) return;

  const hasDesktopEditor = Boolean(editor);
  const onMobile = isMobileViewport();

  if (onMobile && hasDesktopEditor) {
    const code = editor.state.doc.toString();
    destroyCodeEditor();
    const mobileEl = document.getElementById('code-editor-mobile');
    if (mobileEl) {
      mobileEl.value = code;
      mobileEl.classList.remove('hidden');
      mobileTextarea = mobileEl;
    }
    container.classList.add('hidden');
  } else if (!onMobile && !hasDesktopEditor && mobileTextarea) {
    const code = mobileTextarea.value;
    mobileTextarea.classList.add('hidden');
    initCodeEditor(currentLanguage, code, { mobileFillBlanks: mobileFillBlanksData });
  }
});
