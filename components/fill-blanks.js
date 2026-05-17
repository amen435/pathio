let activeData = null;
let activeLanguage = 'javascript';
let attemptCount = 0;
let focusedBlank = null;

const WRONG_OPTIONS = {
  javascript: [
    'function',
    'const',
    'let',
    'var',
    'return',
    'console.log',
    '"Hello"',
    "'Hello'",
    'name',
    'true',
    'false',
    '=>',
    'undefined',
  ],
  html: ['<div>', '<span>', '<p>', 'class=', 'id=', '</div>', '<html>', '<body>'],
  python: ['def', 'print', 'import', 'self', 'True', 'False', 'len()', 'str()'],
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeLanguage(language) {
  const key = String(language || 'javascript').toLowerCase();
  if (key === 'js') return 'javascript';
  if (WRONG_OPTIONS[key]) return key;
  return 'javascript';
}

/** Convert legacy <__>...</__> markers to _B1_, _B2_, … */
function normalizeTemplate(template) {
  let text = String(template || '');
  let index = 1;

  if (text.includes('<__>')) {
    text = text.replace(/<\/?__>/g, (match) => (match === '<__>' ? `_B${index++}_` : ''));
  }

  return text;
}

function buildCodeHtml(template) {
  const normalized = normalizeTemplate(template);
  const parts = normalized.split(/(_B\d+_)/g);

  return parts
    .map((part) => {
      const match = part.match(/^_B(\d+)_$/);
      if (!match) {
        return `<span class="fill-code-text">${escapeHtml(part)}</span>`;
      }
      const num = match[1];
      return `<input type="text" class="blank" data-blank="${num}" readonly inputmode="none" autocomplete="off" aria-label="Blank ${num}" />`;
    })
    .join('');
}

function shuffle(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function buildOptionChips(correctAnswers, language) {
  const lang = normalizeLanguage(language);
  const pool = WRONG_OPTIONS[lang] || WRONG_OPTIONS.javascript;
  const options = [...correctAnswers];

  for (const candidate of pool) {
    if (options.length >= correctAnswers.length + 5) break;
    if (!correctAnswers.includes(candidate)) {
      options.push(candidate);
    }
  }

  return shuffle(options);
}

function getBlankInputs(root) {
  return Array.from(root.querySelectorAll('.blank')).sort(
    (a, b) => Number(a.dataset.blank) - Number(b.dataset.blank)
  );
}

export function getFillBlanksCode() {
  const panel = document.getElementById('fill-blanks-panel');
  if (!panel || !activeData) return '';

  const template = normalizeTemplate(activeData.template);
  const inputs = getBlankInputs(panel);

  return template.replace(/_B(\d+)_/g, (_, num) => {
    const input = inputs.find((el) => el.dataset.blank === num);
    return input?.value || '';
  });
}

function showResult(message, type) {
  const resultEl = document.getElementById('fill-result');
  if (!resultEl) return;

  resultEl.textContent = message;
  resultEl.classList.remove('fill-result-success', 'fill-result-error', 'fill-result-hint');
  resultEl.classList.add(
    type === 'success' ? 'fill-result-success' : type === 'hint' ? 'fill-result-hint' : 'fill-result-error'
  );
}

function clearBlankStates(root) {
  getBlankInputs(root).forEach((input) => {
    input.classList.remove('blank-correct', 'blank-wrong');
  });
}

function applyHintLevel(root) {
  if (!activeData?.explanation) return;

  if (attemptCount >= 2) {
    const hintEl = root.querySelector('.fill-hint-text');
    if (hintEl) {
      hintEl.textContent = activeData.explanation;
      hintEl.classList.remove('hidden');
    }
  }

  if (attemptCount >= 3) {
    const answers = activeData.blanks || [];
    getBlankInputs(root).forEach((input, index) => {
      const answer = answers[index];
      if (answer && !input.value) {
        input.placeholder = answer.charAt(0) + '…';
      }
    });
  }
}

export function testFillBlanks() {
  const panel = document.getElementById('fill-blanks-panel');
  if (!panel || !activeData) return;

  const inputs = getBlankInputs(panel);
  const correctAnswers = activeData.blanks || [];
  const userAnswers = inputs.map((input) => input.value.trim());

  attemptCount += 1;
  clearBlankStates(panel);

  let allCorrect = true;

  userAnswers.forEach((answer, index) => {
    const expected = (correctAnswers[index] ?? '').trim();
    const input = inputs[index];
    if (answer === expected) {
      input.classList.add('blank-correct');
    } else {
      input.classList.add('blank-wrong');
      allCorrect = false;
    }
  });

  if (allCorrect) {
    showResult('✓ Correct! You got it.', 'success');
    return;
  }

  const wrongNums = userAnswers
    .map((answer, index) => (answer !== (correctAnswers[index] ?? '').trim() ? index + 1 : null))
    .filter((n) => n !== null);

  const label =
    wrongNums.length === 1
      ? `Blank ${wrongNums[0]} is incorrect. Try again.`
      : `Blanks ${wrongNums.join(', ')} are incorrect. Try again.`;

  showResult(label, 'error');
  applyHintLevel(panel);
}

function insertOptionIntoBlank(value) {
  if (!focusedBlank) {
    const panel = document.getElementById('fill-blanks-panel');
    const firstEmpty = getBlankInputs(panel).find((input) => !input.value);
    focusedBlank = firstEmpty || getBlankInputs(panel)[0];
  }

  if (!focusedBlank) return;

  focusedBlank.value = value;
  focusedBlank.classList.remove('blank-wrong');
  focusedBlank.dispatchEvent(new Event('input', { bubbles: true }));

  const panel = document.getElementById('fill-blanks-panel');
  const inputs = getBlankInputs(panel);
  const currentIndex = inputs.indexOf(focusedBlank);
  if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
    focusedBlank = inputs[currentIndex + 1];
    focusedBlank.focus();
  }
}

function wireInteractions(root) {
  const inputs = getBlankInputs(root);

  inputs.forEach((input) => {
    input.addEventListener('focus', () => {
      focusedBlank = input;
      inputs.forEach((el) => el.classList.remove('blank-focused'));
      input.classList.add('blank-focused');
    });
  });

  root.querySelectorAll('.fill-option').forEach((chip) => {
    chip.addEventListener('click', () => {
      insertOptionIntoBlank(chip.dataset.value || chip.textContent);
    });
  });

  root.querySelector('#fill-test-btn')?.addEventListener('click', testFillBlanks);

}

export function destroyFillBlanks() {
  activeData = null;
  activeLanguage = 'javascript';
  attemptCount = 0;
  focusedBlank = null;

  const panel = document.getElementById('fill-blanks-panel');
  if (panel) {
    panel.innerHTML = '';
    panel.classList.add('hidden');
    delete panel.dataset.template;
  }
}

/**
 * @param {{ template: string, blanks: string[], explanation?: string }} fillBlanksData
 * @param {string} language
 * @param {HTMLElement|string} [target] panel element or id
 */
export function renderFillBlanks(fillBlanksData, language, target = 'fill-blanks-panel', options = {}) {
  const panel =
    typeof target === 'string' ? document.getElementById(target) : target;

  if (!panel || !fillBlanksData) return null;

  const onBack = typeof options.onBack === 'function' ? options.onBack : null;

  activeData = {
    template: fillBlanksData.template || '',
    blanks: Array.isArray(fillBlanksData.blanks) ? fillBlanksData.blanks : [],
    explanation: fillBlanksData.explanation || '',
  };
  activeLanguage = normalizeLanguage(language);
  attemptCount = 0;
  focusedBlank = null;

  const normalizedTemplate = normalizeTemplate(activeData.template);
  panel.dataset.template = normalizedTemplate;

  const codeHtml = buildCodeHtml(normalizedTemplate);
  const options = buildOptionChips(activeData.blanks, activeLanguage);

  panel.innerHTML = `
    <div class="fill-blanks-container">
      <div class="fill-blanks-code" id="fill-blanks-code">${codeHtml}</div>

      <div class="fill-blanks-options">
        <p class="fill-options-label">Fill in the blanks — tap a chip, then tap a blank:</p>
        <div class="fill-options-chips" role="listbox" aria-label="Answer options">
          ${options
            .map(
              (opt) =>
                `<button type="button" class="fill-option" data-value="${escapeHtml(opt)}" role="option">${escapeHtml(opt)}</button>`
            )
            .join('')}
        </div>
      </div>

      <p class="fill-hint-text hidden" aria-live="polite"></p>

      <div class="fill-blanks-actions">
        <button type="button" class="test-btn" id="fill-test-btn">Test My Answer</button>
        <button type="button" class="fill-back-btn" id="fill-back-btn">← Back to editor</button>
      </div>

      <div class="fill-result" id="fill-result" aria-live="polite"></div>
    </div>
  `;

  panel.classList.remove('hidden');
  wireInteractions(panel);

  const backBtn = panel.querySelector('#fill-back-btn');
  if (backBtn && onBack) {
    backBtn.addEventListener('click', onBack);
  }

  const firstBlank = getBlankInputs(panel)[0];
  if (firstBlank) {
    focusedBlank = firstBlank;
    firstBlank.classList.add('blank-focused');
  }

  return panel;
}
