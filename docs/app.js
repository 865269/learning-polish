// Polish Practice – main app logic

const ALL_CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const APP_VERSION = 'v3.6';
const REVIEW_BATCH = 20;

const appState = {
  chaptersData: {},
  session: null,   // { questions, index, score, mode, chapterTopic, chapterNum }
};

// ── Utilities ────────────────────────────────────────────────────────────────

const DIACRITIC_MAP = { ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z' };
const PUNCT_RE = /[?!.,;:'"]/g;

function stripDiacritics(text) {
  return text.replace(/[ąćęłńóśźż]/g, c => DIACRITIC_MAP[c] || c);
}

function answersMatch(user, expected) {
  const norm = s => stripDiacritics(s.trim().toLowerCase()).replace(PUNCT_RE, '');
  return norm(user) === norm(expected);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function loadAllChapters() {
  const promises = ALL_CHAPTERS.map(n =>
    fetch(`data/chapter${n}.json`).then(r => r.json())
  );
  const chapters = await Promise.all(promises);
  ALL_CHAPTERS.forEach((n, i) => { appState.chaptersData[n] = chapters[i]; });
}

// ── Question building ─────────────────────────────────────────────────────────

function buildQuestions(chapterData, mode, section = 'all', maxQuestions = 0) {
  const questions = [];

  if (mode === 'flashcards') {
    for (const sec of chapterData.vocabulary) {
      if (section !== 'all' && sec.section !== section) continue;
      for (const item of sec.items) {
        questions.push({
          type: 'flashcard',
          prompt: item.english,
          answer: item.polish,
          hint: item.pronunciation,
          section: sec.section,
        });
      }
    }
  } else if (mode === 'fill_in') {
    for (const ex of chapterData.exercises) {
      if (ex.type !== 'fill_in_the_blank') continue;
      for (const q of ex.questions) {
        questions.push({ type: 'fill_in', prompt: q.question, answer: q.answer, note: q.note || '', exercise: ex.id });
      }
    }
  } else if (mode === 'multiple_choice') {
    for (const ex of chapterData.exercises) {
      if (ex.type !== 'multiple_choice') continue;
      for (const q of ex.questions) {
        questions.push({ type: 'multiple_choice', prompt: q.question, answer: q.answer, options: shuffle([...q.options]), note: q.note || '', exercise: ex.id });
      }
    }
  } else if (mode === 'short_answer') {
    for (const ex of chapterData.exercises) {
      if (ex.type !== 'short_answer') continue;
      for (const q of ex.questions) {
        questions.push({ type: 'short_answer', prompt: q.question, answer: q.answer, note: q.note || '', exercise: ex.id });
      }
    }
  }

  shuffle(questions);
  return maxQuestions && maxQuestions < questions.length ? questions.slice(0, maxQuestions) : questions;
}

function annotatePartialAnswers(questions, chapterNum) {
  const srsState = loadSrs();
  for (const q of questions) {
    if (q.type !== 'flashcard') continue;
    const cid = q.cardId || cardId(chapterNum, q.section, q.answer);
    const card = srsState[cid];
    const reps = card ? (card.reps || 0) : 0;
    if (reps < MASTERED_REPS) {
      q.answerChars = makeAnswerChars(q.answer);
    }
  }
}

function checkAnswer(question, userAnswer) {
  if (question.type === 'flashcard' || question.type === 'fill_in') {
    return answersMatch(userAnswer, question.answer);
  }
  if (question.type === 'multiple_choice') {
    return userAnswer.trim() === question.answer;
  }
  if (question.type === 'short_answer') {
    const u = userAnswer.trim().toLowerCase();
    const e = question.answer.toLowerCase();
    return u === e || e.includes(u) || u.includes(e);
  }
  return false;
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

function setMain(html) {
  document.getElementById('main').innerHTML = html;
}

function progressBarHtml(value, max, color = '#e63946') {
  const pct = max ? Math.round(value / max * 100) : 0;
  return `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

// ── Home screen ───────────────────────────────────────────────────────────────

function showHome() {
  const cd = appState.chaptersData;
  const unlock = chapterUnlockInfo(ALL_CHAPTERS, cd);
  const dueCards = getDueCards(unlock.active, cd);
  const dueCount = dueCards.length;
  const upcomingCount = Math.max(0, getDueCards(unlock.active, cd, 7).length - dueCount);

  const frontierTopic = unlock.frontier ? cd[unlock.frontier].topic : '';
  const nextTopic = unlock.nextNum ? cd[unlock.nextNum].topic : '';
  const masteryPct = Math.round(unlock.mastery * 100);
  const unlockBarPct = Math.min(100, Math.round(unlock.mastery / UNLOCK_THRESHOLD * 100));
  const unlockThresholdPct = Math.round(UNLOCK_THRESHOLD * 100);

  // Sections by chapter for the category dropdown
  const sectionsByChapter = {};
  for (const n of ALL_CHAPTERS) {
    sectionsByChapter[n] = cd[n].vocabulary.map(s => s.section);
  }

  // Status card
  let statusCard = '';
  if (dueCount > 0) {
    statusCard = `
      <div class="card" style="border:2px solid #e63946;margin-bottom:16px">
        <h2 style="margin:0 0 8px">Review due</h2>
        <p style="margin:0 0 12px;color:#555">${dueCount} card${dueCount !== 1 ? 's' : ''} due — reviewing up to ${REVIEW_BATCH} at a time.</p>
        <button class="btn btn-primary" data-action="review">Review now →</button>
      </div>`;
  } else if (upcomingCount > 0) {
    statusCard = `
      <div class="card" style="border:2px solid #aaa;margin-bottom:16px">
        <h2 style="margin:0 0 8px">All done for today</h2>
        <p style="margin:0 0 12px;color:#555">${upcomingCount} card${upcomingCount !== 1 ? 's' : ''} scheduled in the next 7 days — study them early?</p>
        <button class="btn btn-secondary" data-action="review-ahead">Study ahead →</button>
      </div>`;
  } else {
    statusCard = `
      <div class="card" style="border:2px solid #2d9e5f;margin-bottom:16px">
        <h2 style="margin:0 0 4px">All done for today</h2>
        <p style="margin:0;color:#555">No cards due — check back tomorrow.</p>
      </div>`;
  }

  // Unlock card
  let unlockCard = '';
  if (unlock.frontier) {
    const progressHtml = unlock.nextNum
      ? `<p style="color:#666;margin:4px 0 14px;font-size:0.9rem">${masteryPct}% mastered — reach ${unlockThresholdPct}% to unlock Chapter ${unlock.nextNum}</p>
         ${progressBarHtml(unlock.mastery, UNLOCK_THRESHOLD, '#2d9e5f')}`
      : `<p style="color:#2d9e5f;font-weight:600;margin:4px 0 0">All chapters unlocked! ${masteryPct}% mastered on this chapter.</p>`;

    unlockCard = `
      <div class="card" style="margin-bottom:16px">
        <div class="meta" style="margin-bottom:6px">Currently studying</div>
        <h2 style="margin:0 0 4px">Chapter ${unlock.frontier}: ${escHtml(frontierTopic)}</h2>
        ${progressHtml}
      </div>`;
  }

  // Chapter options
  const chapterOptions = ALL_CHAPTERS.map(n => {
    const isActive = unlock.active.includes(n);
    const label = isActive ? `Chapter ${n}: ${escHtml(cd[n].topic)}` : `🔒 Chapter ${n}: ${escHtml(cd[n].topic)}`;
    return `<option value="${n}" ${!isActive ? 'disabled' : ''}>${label}</option>`;
  }).join('');

  const html = `
    ${unlockCard}
    ${statusCard}
    <div class="card">
      <h1>Choose a lesson</h1>
      <h2>Pick a chapter and practice mode</h2>


      <label for="chapter">Chapter</label>
      <select id="chapter">
        ${chapterOptions}
      </select>

      <label>Mode</label>
      <div class="mode-grid">
        <input class="mode-option" type="radio" name="mode" id="m1" value="flashcards" checked>
        <label for="m1">🗂 Flashcards<br><small style="font-weight:400;color:#666">Type the Polish word</small></label>
        <input class="mode-option" type="radio" name="mode" id="m2" value="fill_in">
        <label for="m2">✏️ Fill in blank<br><small style="font-weight:400;color:#666">Complete the phrase</small></label>
        <input class="mode-option" type="radio" name="mode" id="m3" value="multiple_choice">
        <label for="m3">☑️ Multiple choice<br><small style="font-weight:400;color:#666">Pick the right answer</small></label>
        <input class="mode-option" type="radio" name="mode" id="m4" value="short_answer">
        <label for="m4">💬 Short answer<br><small style="font-weight:400;color:#666">Grammar facts</small></label>
      </div>

      <div id="section-row">
        <label for="section">Category</label>
        <select id="section">
          <option value="all">All categories</option>
        </select>
      </div>

      <label for="max_questions">Number of questions</label>
      <select id="max_questions">
        <option value="0">All</option>
        <option value="10">10</option>
        <option value="20" selected>20</option>
        <option value="30">30</option>
        <option value="50">50</option>
      </select>

      <br>
      <button class="btn btn-primary" style="margin-top:8px" data-action="start">Start →</button>
    </div>`;

  setMain(html);

  // Wire up home screen JS
  const sectionsByChapterData = sectionsByChapter;
  const chapterEl = document.getElementById('chapter');
  const sectionEl = document.getElementById('section');
  const sectionRow = document.getElementById('section-row');
  const modeInputs = document.querySelectorAll('.mode-option');

  function updateSections() {
    const n = parseInt(chapterEl.value);
    const sections = sectionsByChapterData[n] || [];
    sectionEl.innerHTML = '<option value="all">All categories</option>';
    sections.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
      sectionEl.appendChild(opt);
    });
  }

  function updateSectionVisibility() {
    const mode = document.querySelector('.mode-option:checked').value;
    sectionRow.style.display = mode === 'flashcards' ? '' : 'none';
  }

  chapterEl.addEventListener('change', updateSections);
  modeInputs.forEach(el => el.addEventListener('change', updateSectionVisibility));
  updateSections();
  updateSectionVisibility();

  document.querySelector('[data-action="start"]').addEventListener('click', () => {
    const chapterNum = parseInt(chapterEl.value);
    const mode = document.querySelector('.mode-option:checked').value;
    const section = sectionEl.value;
    const maxQ = parseInt(document.getElementById('max_questions').value);
    startSession(chapterNum, mode, section, maxQ);
  });

  const reviewBtn = document.querySelector('[data-action="review"]');
  if (reviewBtn) reviewBtn.addEventListener('click', () => startReview(0));

  const aheadBtn = document.querySelector('[data-action="review-ahead"]');
  if (aheadBtn) aheadBtn.addEventListener('click', () => startReview(7));
}

// ── Session start ─────────────────────────────────────────────────────────────

function startSession(chapterNum, mode, section, maxQuestions) {
  const chapterData = appState.chaptersData[chapterNum];
  const questions = buildQuestions(chapterData, mode, section, maxQuestions);
  if (!questions.length) { showHome(); return; }

  annotatePartialAnswers(questions, chapterNum);

  appState.session = {
    questions,
    index: 0,
    score: 0,
    mode,
    chapterTopic: chapterData.topic,
    chapterNum,
  };
  showQuestion();
}

function startReview(extraDays) {
  const unlock = chapterUnlockInfo(ALL_CHAPTERS, appState.chaptersData);
  let questions = getDueCards(unlock.active, appState.chaptersData, extraDays);
  shuffle(questions);
  questions = questions.slice(0, REVIEW_BATCH);
  if (!questions.length) { showHome(); return; }

  annotatePartialAnswers(questions, 0);

  appState.session = {
    questions,
    index: 0,
    score: 0,
    mode: 'srs',
    chapterTopic: 'Spaced Repetition Review',
    chapterNum: 0,
  };
  showQuestion();
}

// ── Question screen ───────────────────────────────────────────────────────────

function showQuestion(feedback = null) {
  const { questions, index, score, chapterTopic, mode } = appState.session;
  const total = questions.length;
  const q = questions[index];

  const progressPct = Math.round(index / total * 100);
  const header = `
    <div class="header-row">
      <span style="font-size:0.9rem;color:#888">${escHtml(chapterTopic)}</span>
      <span class="score-badge">${score} / ${index}</span>
    </div>
    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${progressPct}%"></div></div>`;

  let body = '';

  if (q.type === 'flashcard') {
    body = renderFlashcard(q, index, total, feedback);
  } else if (q.type === 'fill_in' || q.type === 'short_answer') {
    body = renderTextQuestion(q, index, total, feedback);
  } else if (q.type === 'multiple_choice') {
    body = renderMultipleChoice(q, index, total, feedback);
  }

  setMain(`<div class="card">${body}${header}</div>`);
  setupQuestionEvents(q, feedback);
}

function renderFlashcard(q, index, total, feedback) {
  const meta = `<div class="meta">${escHtml(q.section)} · flashcard ${index + 1} of ${total}</div>`;
  const prompt = `<div class="prompt">${escHtml(q.prompt)}</div>`;

  if (!feedback) {
    let inputHtml;
    if (q.answerChars) {
      const gapIndices = q.answerChars.reduce((a, ac, i) => (ac.gap ? [...a, i] : a), []);
      const lastGap = gapIndices[gapIndices.length - 1];
      const cells = q.answerChars.map((ac, i) => {
        if (ac.char === ' ') return `<span class="char-space" data-pos="${i}" data-fixed=" "> </span>`;
        if (ac.gap) return `<input class="char-input" data-pos="${i}" maxlength="1" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"${i === lastGap ? ' enterkeyhint="go"' : ''}>`;
        return `<span class="char-fixed" data-pos="${i}" data-fixed="${escHtml(ac.char)}">${escHtml(ac.char)}</span>`;
      }).join('');
      inputHtml = `<form id="answer-form"><div class="char-cell-wrap" id="gapped-word">${cells}</div><input type="hidden" id="reconstructed-answer"></form>`;
    } else {
      inputHtml = `<form id="answer-form"><input type="text" id="plain-answer" placeholder="Type the Polish word…" autocomplete="off" autocorrect="off" autocapitalize="off" enterkeyhint="go"></form>`;
    }
    return `<div class="question-actions">
        <a href="#" style="color:#aaa;font-size:0.9rem;text-decoration:none" id="reveal-link">reveal</a>
        <button class="btn btn-primary" id="check-btn">Check →</button>
      </div>${prompt}${inputHtml}${meta}`;
  }

  let feedbackHtml;
  if (feedback.correct) {
    feedbackHtml = `<div class="feedback-correct">✓ Correct! — <strong>${escHtml(q.answer)}</strong>
      <div style="font-weight:400;margin-top:4px;color:#444">${escHtml(q.hint)}</div></div>`;
  } else if (feedback.userAnswer === '?') {
    feedbackHtml = `<div class="feedback-wrong"><div>Revealed:</div>
      <div class="answer">${escHtml(q.answer)}</div>
      <div class="note">${escHtml(q.hint)}</div></div>`;
  } else {
    feedbackHtml = `<div class="feedback-wrong">
      <div>Your answer: <em>${escHtml(feedback.userAnswer || '(blank)')}</em></div>
      <div class="answer">✗ Correct: ${escHtml(q.answer)}</div>
      <div class="note">${escHtml(q.hint)}</div></div>`;
  }
  return `${meta}${prompt}${feedbackHtml}<a class="btn btn-primary next-fab" id="next-btn">Next →</a>`;
}

function renderTextQuestion(q, index, total, feedback) {
  const label = q.type === 'fill_in' ? `exercise ${escHtml(q.exercise)}` : `exercise ${escHtml(q.exercise)}`;
  const meta = `<div class="meta">${label} · ${index + 1} of ${total}</div>`;
  const prompt = `<div class="prompt">${escHtml(q.prompt)}</div>`;

  if (!feedback) {
    return `<div class="question-actions">
        <button class="btn btn-primary" id="check-btn">Check →</button>
      </div>${prompt}
      <form id="answer-form"><input type="text" id="plain-answer" placeholder="Your answer…" autocomplete="off" enterkeyhint="go"></form>
      ${meta}`;
  }

  let feedbackHtml;
  if (feedback.correct) {
    feedbackHtml = `<div class="feedback-correct">✓ Correct! — <strong>${escHtml(q.answer)}</strong></div>`;
  } else {
    feedbackHtml = `<div class="feedback-wrong">
      <div>Your answer: <em>${escHtml(feedback.userAnswer || '(blank)')}</em></div>
      <div class="answer">✗ Correct: ${escHtml(q.answer)}</div>
      ${q.note ? `<div class="note">${escHtml(q.note)}</div>` : ''}</div>`;
  }
  return `${meta}${prompt}${feedbackHtml}<a class="btn btn-primary next-fab" id="next-btn">Next →</a>`;
}

function renderMultipleChoice(q, index, total, feedback) {
  const meta = `<div class="meta">exercise ${escHtml(q.exercise)} · ${index + 1} of ${total}</div>`;
  const prompt = `<div class="prompt">${escHtml(q.prompt)}</div>`;

  if (!feedback) {
    const buttons = q.options.map(opt =>
      `<button class="option-btn" data-value="${escHtml(opt)}">${escHtml(opt)}</button>`
    ).join('');
    return `${meta}${prompt}<div class="options">${buttons}</div>`;
  }

  const options = q.options.map(opt => {
    if (opt === q.answer && feedback.correct) return `<div class="option-btn selected-correct">✓ ${escHtml(opt)}</div>`;
    if (opt === feedback.userAnswer && !feedback.correct) return `<div class="option-btn selected-wrong">✗ ${escHtml(opt)}</div>`;
    if (opt === q.answer && !feedback.correct) return `<div class="option-btn reveal-correct">✓ ${escHtml(opt)}</div>`;
    return `<div class="option-btn" style="opacity:0.5">${escHtml(opt)}</div>`;
  }).join('');

  return `${meta}${prompt}<div class="options">${options}</div>
    ${q.note ? `<div style="margin-top:16px;font-size:0.9rem;color:#666">${escHtml(q.note)}</div>` : ''}
    <a class="btn btn-primary next-fab" id="next-btn">Next →</a>`;
}

function setupQuestionEvents(q, feedback) {
  if (feedback) {
    // Feedback shown — Next button and Enter key advance
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
      nextBtn.focus();
      nextBtn.addEventListener('click', advanceQuestion);
    }
    document.addEventListener('keydown', onEnterAdvance);
    return;
  }

  // Gapped word inputs
  const gapInputs = Array.from(document.querySelectorAll('.char-input'));
  if (gapInputs.length) {
    gapInputs[0].focus();
    gapInputs.forEach((inp, idx) => {
      inp.addEventListener('input', () => {
        if (inp.value.length > 1) inp.value = inp.value.slice(-1);
        if (inp.value && idx + 1 < gapInputs.length) gapInputs[idx + 1].focus();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
        if (e.key === 'Backspace' && inp.value === '' && idx > 0) {
          gapInputs[idx - 1].value = '';
          gapInputs[idx - 1].focus();
          e.preventDefault();
        }
      });
    });
  }

  const plainInput = document.getElementById('plain-answer');
  if (plainInput) {
    plainInput.focus();
    plainInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
    });
  }

  // Check button + Go key (form submit fires when mobile keyboard Go is tapped)
  const checkBtn = document.getElementById('check-btn');
  if (checkBtn) checkBtn.addEventListener('click', submitAnswer);
  const answerForm = document.getElementById('answer-form');
  if (answerForm) answerForm.addEventListener('submit', e => { e.preventDefault(); submitAnswer(); });

  // Reveal link
  const revealLink = document.getElementById('reveal-link');
  if (revealLink) {
    revealLink.addEventListener('click', e => {
      e.preventDefault();
      processAnswer('?');
    });
  }

  // Multiple choice options
  document.querySelectorAll('.option-btn[data-value]').forEach(btn => {
    btn.addEventListener('click', () => processAnswer(btn.dataset.value));
  });
}

function onEnterAdvance(e) {
  if (e.key === 'Enter' && Date.now() - _lastSubmitAt > 300) {
    e.preventDefault();
    document.removeEventListener('keydown', onEnterAdvance);
    advanceQuestion();
  }
}

let _lastSubmitAt = 0;
function submitAnswer() {
  if (!document.getElementById('answer-form')) return; // guard: already submitted
  _lastSubmitAt = Date.now();
  document.activeElement?.blur(); // dismiss keyboard so feedback is visible
  const gapInputs = Array.from(document.querySelectorAll('.char-input'));
  let userAnswer;
  if (gapInputs.length) {
    const allEls = Array.from(document.querySelectorAll('[data-pos]'))
      .sort((a, b) => +a.dataset.pos - +b.dataset.pos);
    userAnswer = allEls.map(el => el.tagName === 'INPUT' ? (el.value || '') : (el.dataset.fixed || '')).join('');
  } else {
    const inp = document.getElementById('plain-answer');
    userAnswer = inp ? inp.value : '';
  }
  processAnswer(userAnswer);
}

function processAnswer(userAnswer) {
  document.removeEventListener('keydown', onEnterAdvance);
  const sess = appState.session;
  const q = sess.questions[sess.index];
  const correct = checkAnswer(q, userAnswer);

  if (correct) sess.score++;

  // Update SRS if this is a review session
  if (sess.mode === 'srs' && q.cardId) {
    const state = loadSrs();
    updateCard(state, q.cardId, correct);
    saveSrs(state);
  }

  showQuestion({ correct, userAnswer });
}

function advanceQuestion() {
  document.removeEventListener('keydown', onEnterAdvance);
  appState.session.index++;
  if (appState.session.index >= appState.session.questions.length) {
    showResults();
  } else {
    showQuestion();
  }
}

// ── Results screen ────────────────────────────────────────────────────────────

function showResults() {
  const { score, questions, chapterTopic } = appState.session;
  const total = questions.length;
  const pct = total ? Math.round(score / total * 100) : 0;

  let emoji = '📚 Review and try again';
  if (pct === 100) emoji = '🎉 Perfect score!';
  else if (pct >= 75) emoji = '👏 Great work!';
  else if (pct >= 50) emoji = '💪 Keep practising!';

  setMain(`
    <div class="card" style="text-align:center">
      <h1>Lesson complete!</h1>
      <div style="color:#666;margin-top:4px">${escHtml(chapterTopic)}</div>
      <div class="big-score">${pct}%</div>
      <div class="big-score-label">${score} out of ${total} correct</div>
      <div style="font-size:2rem">${emoji}</div>
      <div class="results-actions">
        <button class="btn btn-primary" id="home-btn">Home</button>
      </div>
    </div>`);

  appState.session = null;

  document.getElementById('home-btn').focus();
  document.getElementById('home-btn').addEventListener('click', showHome);
  document.addEventListener('keydown', function onEnter(e) {
    if (e.key === 'Enter') { e.preventDefault(); document.removeEventListener('keydown', onEnter); showHome(); }
  });
}

// ── Stats screen ──────────────────────────────────────────────────────────────

function showStats() {
  const unlock = chapterUnlockInfo(ALL_CHAPTERS, appState.chaptersData);
  const stats = getStats(ALL_CHAPTERS, appState.chaptersData);
  const activeSet = new Set(unlock.active);

  const seenPct = stats.total ? Math.round((stats.learning + stats.mastered) / stats.total * 100) : 0;
  const masteredPct = stats.total ? Math.round(stats.mastered / stats.total * 100) : 0;

  const forecastBars = stats.forecast.map(day => {
    const heightPct = Math.round(day.count / stats.maxForecast * 100);
    const todayCls = day.isToday ? ' forecast-today' : '';
    return `<div class="forecast-col${todayCls}">
      <div class="forecast-bar-wrap"><div class="forecast-bar" style="height:${heightPct}%"></div></div>
      <div class="forecast-count">${day.count || ''}</div>
      <div class="forecast-label">${day.label}</div>
    </div>`;
  }).join('');

  const chapterRows = stats.chapters.map(ch => {
    const isActive = activeSet.has(ch.number);
    const nameHtml = isActive
      ? `<strong>Ch ${ch.number}</strong> <span style="color:#666;font-weight:400">${escHtml(ch.topic)}</span>`
      : `<span style="font-size:0.9rem">🔒 Ch ${ch.number}</span> <span style="color:#999;font-size:0.9rem">${escHtml(ch.topic)}</span>`;
    const miniBar = isActive && ch.total > 0
      ? `<div class="mini-bar-wrap">
           <div class="mini-bar-green" style="width:${Math.round(ch.mastered/ch.total*100)}%"></div>
           <div class="mini-bar-amber" style="width:${Math.round(ch.learning/ch.total*100)}%"></div>
         </div>` : '';
    const dim = isActive ? '' : ' style="opacity:0.45"';
    return `<tr${dim}>
      <td>${nameHtml}</td>
      <td class="num">${ch.total}</td>
      <td class="num">${isActive ? ch.notStarted : '—'}</td>
      <td class="num">${isActive ? ch.learning : '—'}</td>
      <td class="num">${isActive ? ch.mastered : '—'}</td>
      <td>${miniBar}</td>
    </tr>`;
  }).join('');

  setMain(`
    <div class="card" style="margin-bottom:16px">
      <h1>Progress</h1>
      <h2>${stats.total} vocab cards across all chapters</h2>
      <div class="stat-grid">
        <div class="stat-box stat-new"><div class="stat-num">${stats.notStarted}</div><div class="stat-label">Not started</div></div>
        <div class="stat-box stat-learning"><div class="stat-num">${stats.learning}</div><div class="stat-label">Learning</div></div>
        <div class="stat-box stat-mastered"><div class="stat-num">${stats.mastered}</div><div class="stat-label">Mastered</div></div>
      </div>
      <div style="margin-top:24px">
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#666;margin-bottom:6px">
          <span>Overall progress</span><span>${seenPct}% seen</span>
        </div>
        <div class="progress-bar-wrap" style="height:14px">
          <div class="progress-bar-fill" style="width:${masteredPct}%;background:#2d9e5f"></div>
        </div>
        <div style="font-size:0.8rem;color:#999;margin-top:4px">Green = mastered (${stats.mastered}), grey = remaining</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h2 style="margin-bottom:20px">Reviews due — next 7 days</h2>
      <div class="forecast">${forecastBars}</div>
    </div>

    <div class="card">
      <h2 style="margin-bottom:16px">By chapter</h2>
      <table class="ch-table">
        <thead><tr>
          <th style="text-align:left">Chapter</th>
          <th>Total</th><th>Not started</th><th>Learning</th><th>Mastered</th>
          <th style="min-width:120px"></th>
        </tr></thead>
        <tbody>${chapterRows}</tbody>
      </table>
      <p style="font-size:0.8rem;color:#aaa;margin-top:12px">Green = mastered &nbsp;·&nbsp; Amber = learning &nbsp;·&nbsp; Grey = not started</p>
    </div>`);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  document.getElementById('app-version').textContent = APP_VERSION;
  setMain('<div style="text-align:center;padding:60px;color:#888">Loading…</div>');
  await loadAllChapters();
  showHome();
}

// Header nav
document.getElementById('nav-home').addEventListener('click', e => { e.preventDefault(); appState.session = null; showHome(); });
document.getElementById('nav-stats').addEventListener('click', e => { e.preventDefault(); showStats(); });

init();

// Hide the nav header when the keyboard opens to free up vertical space.
// Keyboard is considered open when the visual viewport shrinks to <75% of window height.
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const ratio = window.visualViewport.height / window.innerHeight;
    document.body.classList.toggle('keyboard-open', ratio < 0.75);
  });
}
