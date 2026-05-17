import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { python } from '@codemirror/lang-python';
import {
  renderFillBlanks,
  getFillBlanksCode,
  destroyFillBlanks,
  testFillBlanks,
} from './fill-blanks.js';

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

export function destroyCodeEditor() {
  if (editor) {
    editor.destroy();
    editor = null;
  }
  destroyFillBlanks();
  mobileTextarea = null;
  fillBlanksActive = false;
  mobileFillBlanksData = null;
}

function showMobileFillBlanks() {
  const container = document.getElementById('code-editor-container');
  const mobileEl = document.getElementById('code-editor-mobile');
  const fillPanel = document.getElementById('fill-blanks-panel');

  if (!fillPanel || !mobileFillBlanksData) return false;

  fillBlanksActive = true;
  container?.classList.add('hidden');
  mobileEl?.classList.add('hidden');

  renderFillBlanks(mobileFillBlanksData, currentLanguage, fillPanel, {
    onBack: () => {
      fillBlanksActive = false;
      destroyFillBlanks();
      if (isMobileViewport()) {
        mobileEl?.classList.remove('hidden');
        mobileTextarea = mobileEl;
      } else {
        container?.classList.remove('hidden');
      }
    },
  });

  return true;
}

export function initCodeEditor(language, starterCode = '', options = {}) {
  if (editor) {
    editor.destroy();
    editor = null;
  }
  destroyFillBlanks();

  currentLanguage = normalizeLanguage(language);
  mobileFillBlanksData = options.mobileFillBlanks || null;
  fillBlanksActive = false;

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
    mobileTextarea = null;
  }

  if (fillPanel) {
    fillPanel.classList.add('hidden');
    fillPanel.innerHTML = '';
  }

  if (isMobileViewport() && mobileFillBlanksData) {
    showMobileFillBlanks();
    return;
  }

  if (isMobileViewport()) {
    container.classList.add('hidden');
    if (mobileEl) {
      mobileEl.classList.remove('hidden');
      mobileTextarea = mobileEl;
    }
    return;
  }

  const extensions = [basicSetup, pathioTheme, EditorView.lineWrapping];

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

  showMobileFillBlanks();
}

export { testFillBlanks };

export function showOutput(text, type = 'success') {
  const outputEl = document.getElementById('code-output');
  if (!outputEl) return;

  outputEl.classList.remove('output-success', 'output-error', 'output-neutral');
  outputEl.classList.add(
    type === 'error' ? 'output-error' : type === 'success' ? 'output-success' : 'output-neutral'
  );

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

window.addEventListener('resize', () => {
  const container = document.getElementById('code-editor-container');
  if (!container) return;

  const onMobile = isMobileViewport();

  if (onMobile && editor) {
    const code = editor.state.doc.toString();
    editor.destroy();
    editor = null;
    container.classList.add('hidden');
    if (mobileFillBlanksData) {
      showMobileFillBlanks();
    } else {
      const mobileEl = document.getElementById('code-editor-mobile');
      if (mobileEl) {
        mobileEl.value = code;
        mobileEl.classList.remove('hidden');
        mobileTextarea = mobileEl;
        fillBlanksActive = false;
      }
    }
  } else if (!onMobile && fillBlanksActive && mobileFillBlanksData) {
    destroyFillBlanks();
    fillBlanksActive = false;
    document.getElementById('code-editor-mobile')?.classList.add('hidden');
    const code = getFillBlanksCode() || '';
    initCodeEditor(currentLanguage, code, { mobileFillBlanks: mobileFillBlanksData });
  } else if (!onMobile && !editor && mobileTextarea) {
    const code = mobileTextarea.value;
    mobileTextarea.classList.add('hidden');
    initCodeEditor(currentLanguage, code, { mobileFillBlanks: mobileFillBlanksData });
  }
});
