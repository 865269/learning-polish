// Polish Practice – main app logic

const ALL_CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const APP_VERSION = 'v3.24';
const REVIEW_BATCH = 20;

const appState = {
  chaptersData: {},
  session: null,   // { questions, index, score, mode, chapterTopic, chapterNum }
};

// ── Utilities ────────────────────────────────────────────────────────────────

const DIACRITIC_MAP = { ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z' };
const PUNCT_RE = /[?!.,;:'"…]/g;

// Common English contractions expanded to full form so "I'm" matches "I am" etc.
const CONTRACTIONS = {
  "i'm":"i am", "it's":"it is", "he's":"he is", "she's":"she is",
  "we're":"we are", "you're":"you are", "they're":"they are",
  "there's":"there is", "that's":"that is", "what's":"what is", "who's":"who is",
  "i've":"i have", "you've":"you have", "we've":"we have", "they've":"they have",
  "i'll":"i will", "you'll":"you will", "he'll":"he will", "she'll":"she will",
  "we'll":"we will", "they'll":"they will", "it'll":"it will",
  "don't":"do not", "doesn't":"does not", "didn't":"did not",
  "can't":"cannot", "won't":"will not", "isn't":"is not",
  "aren't":"are not", "wasn't":"was not", "weren't":"were not",
};

function stripDiacritics(text) {
  return text.replace(/[ąćęłńóśźż]/g, c => DIACRITIC_MAP[c] || c);
}

function expandContractions(text) {
  // Must run before PUNCT_RE strips apostrophes
  return text.replace(/\b\w+'\w+\b/g, m => CONTRACTIONS[m] || m);
}

function answersMatch(user, expected) {
  const norm = s => expandContractions(stripDiacritics(s.trim().toLowerCase())).replace(PUNCT_RE, '').replace(/\s+/g, ' ').trim();
  return norm(user) === norm(expected);
}

const STOP_WORDS = new Set([
  'a','an','the','in','on','at','to','for','of','and','or','but','with','from','by',
  'is','are','was','were','be','been','being','am',
  'do','does','did','have','has','had','will','would','can','could','should','may','might','shall',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their',
  'this','that','these','those','not','no','up','out','so','as','if',
]);

function contentWords(str) {
  const norm = expandContractions(stripDiacritics(str.trim().toLowerCase())).replace(PUNCT_RE, '');
  return norm.split(/\s+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));
}

// Two words match if equal or one is a prefix of the other (for words ≥4 chars).
function wordStemMatch(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4) return a.startsWith(b) || b.startsWith(a);
  return false;
}

function answersMatchContent(user, expected) {
  const expWords = contentWords(expected);
  if (expWords.length < 2) return false; // too short to be meaningful
  const userWords = contentWords(user);
  return expWords.every(ew => userWords.some(uw => wordStemMatch(ew, uw)));
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
        const chNum = chapterData.chapter;
        questions.push({
          type: 'flashcard',
          prompt: item.english,
          answer: item.polish,
          hint: item.pronunciation,
          section: sec.section,
          cardId: cardId(chNum, sec.section, item.polish),
        });
        questions.push({
          type: 'flashcard_reverse',
          prompt: item.polish,
          answer: item.english,
          hint: item.pronunciation,
          section: sec.section,
          cardId: reverseCardId(chNum, sec.section, item.polish),
        });
      }
    }
  } else if (mode === 'matching') {
    const allPairs = [];
    for (const sec of chapterData.vocabulary) {
      if (section !== 'all' && sec.section !== section) continue;
      for (const item of sec.items) {
        allPairs.push({
          polish: item.polish,
          english: item.english,
          cardId: reverseCardId(chapterData.chapter, sec.section, item.polish),
          fwdCardId: cardId(chapterData.chapter, sec.section, item.polish),
          hint: item.pronunciation,
        });
      }
    }
    shuffle(allPairs);
    const limited = maxQuestions && maxQuestions < allPairs.length ? allPairs.slice(0, maxQuestions) : allPairs;
    for (let i = 0; i < limited.length; i += 5) {
      const group = limited.slice(i, i + 5);
      if (group.length < 2) {
        if (questions.length > 0) questions[questions.length - 1].pairs.push(...group);
      } else {
        questions.push({ type: 'matching', pairs: group });
      }
    }
    return questions;
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
    if (reps < cardGappingThreshold(q.answer)) {
      q.answerChars = makeAnswerChars(q.answer);
    }
  }
}

function checkReverseAnswer(userAnswer, expected) {
  if (answersMatch(userAnswer, expected)) return true;
  // Strip parenthetical clarifications: "cheap (positive)" → "cheap"
  const stripped = expected.replace(/\s*\([^)]*\)/g, '').trim();
  if (stripped && answersMatch(userAnswer, stripped)) return true;
  // Also accept content inside parens: "0 (zero)" → accept "zero"
  const inner = expected.match(/\(([^)]+)\)/);
  if (inner && answersMatch(userAnswer, inner[1])) return true;
  // Accept any slash-separated alternative: "you can / you are allowed to" → accept either part
  const parts = stripped.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    for (const part of parts) {
      if (answersMatch(userAnswer, part)) return true;
    }
  }
  // Content-word overlap: all non-trivial words from expected must appear in user's answer
  // (allows paraphrasing like "is breakfast included" for "does the price include breakfast")
  if (answersMatchContent(userAnswer, stripped || expected)) return true;
  return false;
}

function checkAnswer(question, userAnswer) {
  if (question.type === 'flashcard_reverse') {
    return checkReverseAnswer(userAnswer, question.answer);
  }
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
  const stats = getStats(ALL_CHAPTERS, cd);
  const frontierStats = stats.chapters.find(c => c.number === unlock.frontier);

  // Current chapter card
  let chapterCard = '';
  if (unlock.frontier) {
    const topic = cd[unlock.frontier].topic;
    const masteryPct = Math.round(unlock.mastery * 100);
    const threshPct = Math.round(UNLOCK_THRESHOLD * 100);
    const unlockLine = unlock.nextNum
      ? `<p style="font-size:0.85rem;color:#666;margin:6px 0 12px">${masteryPct}% mastered · ${threshPct}% needed to unlock Ch ${unlock.nextNum}: ${escHtml(cd[unlock.nextNum].topic)}</p>
         ${progressBarHtml(unlock.mastery, UNLOCK_THRESHOLD, '#2d9e5f')}`
      : `<p style="font-size:0.85rem;color:#2d9e5f;font-weight:600;margin:6px 0 12px">All chapters unlocked — ${masteryPct}% mastered</p>`;
    const ns = frontierStats?.notStarted ?? '—';
    const lrn = frontierStats?.learning ?? '—';
    const mst = frontierStats?.mastered ?? '—';
    chapterCard = `
      <div class="card" style="margin-bottom:16px">
        <div class="meta" style="margin-bottom:4px">Currently studying</div>
        <h1 style="font-size:1.3rem;margin-bottom:0">Chapter ${unlock.frontier}: ${escHtml(topic)}</h1>
        ${unlockLine}
        <div class="stat-grid">
          <div class="stat-box stat-new"><div class="stat-num">${ns}</div><div class="stat-label">Not started</div></div>
          <div class="stat-box stat-learning"><div class="stat-num">${lrn}</div><div class="stat-label">Learning</div></div>
          <div class="stat-box stat-mastered"><div class="stat-num">${mst}</div><div class="stat-label">Mastered</div></div>
        </div>
      </div>`;
  }

  // Review status card
  let reviewCard = '';
  if (dueCount > 0) {
    reviewCard = `
      <div class="card" style="border:2px solid #e63946;margin-bottom:16px">
        <h2 style="margin:0 0 8px">Reviews due</h2>
        <p style="margin:0 0 12px;color:#555">${dueCount} card${dueCount !== 1 ? 's' : ''} due — up to ${REVIEW_BATCH} at a time.</p>
        <button class="btn btn-primary" data-action="review">Review now →</button>
      </div>`;
  } else if (upcomingCount > 0) {
    reviewCard = `
      <div class="card" style="border:2px solid #aaa;margin-bottom:16px">
        <h2 style="margin:0 0 8px">All done for today</h2>
        <p style="margin:0 0 12px;color:#555">${upcomingCount} card${upcomingCount !== 1 ? 's' : ''} scheduled in the next 7 days.</p>
        <button class="btn btn-secondary" data-action="review-ahead">Study ahead →</button>
      </div>`;
  } else {
    reviewCard = `
      <div class="card" style="border:2px solid #2d9e5f">
        <h2 style="margin:0 0 4px">All done for today</h2>
        <p style="margin:0;color:#555">No cards due — check back tomorrow.</p>
      </div>`;
  }

  setMain(`${chapterCard}${reviewCard}`);

  const reviewBtn = document.querySelector('[data-action="review"]');
  if (reviewBtn) reviewBtn.addEventListener('click', () => startReview(0));
  const aheadBtn = document.querySelector('[data-action="review-ahead"]');
  if (aheadBtn) aheadBtn.addEventListener('click', () => startReview(7));
}

// ── Practice screen (lesson chooser) ─────────────────────────────────────────

function showPractice() {
  const cd = appState.chaptersData;
  const unlock = chapterUnlockInfo(ALL_CHAPTERS, cd);

  const sectionsByChapter = {};
  for (const n of ALL_CHAPTERS) {
    sectionsByChapter[n] = cd[n].vocabulary.map(s => s.section);
  }

  const chapterOptions = ALL_CHAPTERS.map(n => {
    const isActive = unlock.active.includes(n);
    const label = isActive ? `Chapter ${n}: ${cd[n].topic}` : `🔒 Chapter ${n}: ${cd[n].topic}`;
    return `<option value="${n}" ${!isActive ? 'disabled' : ''}>${escHtml(label)}</option>`;
  }).join('');

  setMain(`
    <div class="card">
      <h1>Practice</h1>
      <h2>Pick a chapter and mode</h2>

      <label for="chapter">Chapter</label>
      <select id="chapter">${chapterOptions}</select>

      <label>Mode</label>
      <div class="mode-grid">
        <input class="mode-option" type="radio" name="mode" id="m1" value="matching" checked>
        <label for="m1">🔗 Matching<br><small style="font-weight:400;color:#666">Tap pairs to match</small></label>
        <input class="mode-option" type="radio" name="mode" id="m2" value="flashcards">
        <label for="m2">🗂 Flashcards<br><small style="font-weight:400;color:#666">Type the translation</small></label>
        <input class="mode-option" type="radio" name="mode" id="m3" value="fill_in">
        <label for="m3">✏️ Fill in blank<br><small style="font-weight:400;color:#666">Complete the phrase</small></label>
        <input class="mode-option" type="radio" name="mode" id="m4" value="multiple_choice">
        <label for="m4">☑️ Multiple choice<br><small style="font-weight:400;color:#666">Pick the right answer</small></label>
        <input class="mode-option" type="radio" name="mode" id="m5" value="short_answer">
        <label for="m5">💬 Short answer<br><small style="font-weight:400;color:#666">Grammar facts</small></label>
      </div>

      <div id="section-row">
        <label for="section">Category</label>
        <select id="section"><option value="all">All categories</option></select>
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
    </div>`);

  const chapterEl = document.getElementById('chapter');
  const sectionEl = document.getElementById('section');
  const sectionRow = document.getElementById('section-row');
  const modeInputs = document.querySelectorAll('.mode-option');

  function updateSections() {
    const n = parseInt(chapterEl.value);
    sectionEl.innerHTML = '<option value="all">All categories</option>';
    (sectionsByChapter[n] || []).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
      sectionEl.appendChild(opt);
    });
  }

  function updateSectionVisibility() {
    const mode = document.querySelector('.mode-option:checked').value;
    sectionRow.style.display = (mode === 'flashcards' || mode === 'matching') ? '' : 'none';
  }

  chapterEl.addEventListener('change', updateSections);
  modeInputs.forEach(el => el.addEventListener('change', updateSectionVisibility));
  updateSections();
  updateSectionVisibility();

  document.querySelector('[data-action="start"]').addEventListener('click', () => {
    startSession(
      parseInt(chapterEl.value),
      document.querySelector('.mode-option:checked').value,
      sectionEl.value,
      parseInt(document.getElementById('max_questions').value)
    );
  });
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

  // Meta text varies by question type
  let metaText;
  if (q.type === 'flashcard' || q.type === 'flashcard_reverse') {
    const dirLabel = q.type === 'flashcard_reverse' ? 'PL→EN' : 'EN→PL';
    metaText = `${escHtml(q.section)} · ${dirLabel} · ${index + 1} of ${total}`;
  } else if (q.type === 'matching') {
    metaText = `matching · ${index + 1} of ${total}`;
  } else {
    metaText = `exercise ${escHtml(q.exercise)} · ${index + 1} of ${total}`;
  }

  // Footer always sits at the bottom of the card, separated by a thin rule.
  // Putting score + progress here (not at the top) means the keyboard can push
  // them offscreen without obscuring the prompt or input.
  const footer = `
    <div class="session-footer">
      <div class="session-footer-row">
        <span class="meta" style="margin-bottom:0">${metaText}</span>
        <span class="score-badge">${score} / ${index}</span>
      </div>
      <div class="progress-bar-wrap" style="margin-bottom:0"><div class="progress-bar-fill" style="width:${progressPct}%"></div></div>
    </div>`;

  let body = '';

  if (q.type === 'flashcard' || q.type === 'flashcard_reverse') {
    body = renderFlashcard(q, index, total, feedback);
  } else if (q.type === 'fill_in' || q.type === 'short_answer') {
    body = renderTextQuestion(q, index, total, feedback);
  } else if (q.type === 'multiple_choice') {
    body = renderMultipleChoice(q, index, total, feedback);
  } else if (q.type === 'matching') {
    body = renderMatching(q);
  }

  setMain(`<div class="card">${body}${footer}</div>`);
  setupQuestionEvents(q, feedback);
}

function renderFlashcard(q, index, total, feedback) {
  const flag = q.type === 'flashcard_reverse' ? '🇬🇧' : '🇵🇱';
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
      const placeholder = q.type === 'flashcard_reverse' ? 'Type the English…' : 'Type the Polish…';
      inputHtml = `<form id="answer-form"><input type="text" id="plain-answer" placeholder="${placeholder}" autocomplete="off" autocorrect="off" autocapitalize="off" enterkeyhint="go"></form>`;
    }
    const revealLink = q.type === 'flashcard_reverse'
      ? ''
      : `<a href="#" style="color:#aaa;font-size:0.9rem;text-decoration:none" id="reveal-link">reveal</a>`;
    return `<div class="question-actions">
        <span class="lang-flag">${flag}</span>
        ${revealLink}
        <button class="btn btn-primary" id="check-btn">Check →</button>
      </div>${prompt}${inputHtml}`;
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
  return `<span class="lang-flag">${flag}</span>${prompt}${feedbackHtml}<a class="btn btn-primary next-fab" id="next-btn">Next →</a>`;
}

function renderTextQuestion(q, index, total, feedback) {
  const prompt = `<div class="prompt">${escHtml(q.prompt)}</div>`;

  if (!feedback) {
    return `<div class="question-actions">
        <button class="btn btn-primary" id="check-btn">Check →</button>
      </div>${prompt}
      <form id="answer-form"><input type="text" id="plain-answer" placeholder="Your answer…" autocomplete="off" enterkeyhint="go"></form>`;
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
  return `${prompt}${feedbackHtml}<a class="btn btn-primary next-fab" id="next-btn">Next →</a>`;
}

function renderMultipleChoice(q, index, total, feedback) {
  const prompt = `<div class="prompt">${escHtml(q.prompt)}</div>`;

  if (!feedback) {
    const buttons = q.options.map(opt =>
      `<button class="option-btn" data-value="${escHtml(opt)}">${escHtml(opt)}</button>`
    ).join('');
    return `${prompt}<div class="options">${buttons}</div>`;
  }

  const options = q.options.map(opt => {
    if (opt === q.answer && feedback.correct) return `<div class="option-btn selected-correct">✓ ${escHtml(opt)}</div>`;
    if (opt === feedback.userAnswer && !feedback.correct) return `<div class="option-btn selected-wrong">✗ ${escHtml(opt)}</div>`;
    if (opt === q.answer && !feedback.correct) return `<div class="option-btn reveal-correct">✓ ${escHtml(opt)}</div>`;
    return `<div class="option-btn" style="opacity:0.5">${escHtml(opt)}</div>`;
  }).join('');

  return `${prompt}<div class="options">${options}</div>
    ${q.note ? `<div style="margin-top:16px;font-size:0.9rem;color:#666">${escHtml(q.note)}</div>` : ''}
    <a class="btn btn-primary next-fab" id="next-btn">Next →</a>`;
}

function renderMatching(q) {
  if (!q.rightOrder) {
    q.rightOrder = shuffle(Array.from({length: q.pairs.length}, (_, i) => i));
  }
  const rows = q.pairs.map((pair, i) => {
    const rightPairIdx = q.rightOrder[i];
    return `<div class="match-card match-left" data-idx="${i}">${escHtml(pair.polish)}</div>
      <div class="match-card match-right" data-idx="${i}">${escHtml(q.pairs[rightPairIdx].english)}</div>`;
  }).join('');
  return `
    <div class="match-instruction">Match each Polish word to its translation</div>
    <div class="matching-grid">${rows}</div>`;
}

function setupQuestionEvents(q, feedback) {
  if (q.type === 'matching') {
    setupMatchingEvents(q);
    return;
  }

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

function setupMatchingEvents(q) {
  const pairs = q.pairs;
  let selectedLeftIdx = null;
  const matched = new Set();
  let hadWrong = false;
  const srsState = loadSrs();

  document.querySelectorAll('.match-left').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      if (matched.has(idx)) return;
      document.querySelectorAll('.match-left.selected').forEach(c => c.classList.remove('selected'));
      selectedLeftIdx = idx;
      card.classList.add('selected');
    });
  });

  document.querySelectorAll('.match-right').forEach(card => {
    card.addEventListener('click', () => {
      if (selectedLeftIdx === null) return;
      const rightPos = parseInt(card.dataset.idx);
      const pairIdx = q.rightOrder[rightPos];
      if (matched.has(pairIdx)) return;

      const leftCard = document.querySelector(`.match-left[data-idx="${selectedLeftIdx}"]`);

      if (pairIdx === selectedLeftIdx) {
        leftCard.classList.remove('selected');
        leftCard.classList.add('matched');
        leftCard.textContent = pairs[selectedLeftIdx].polish;
        card.classList.add('matched');
        card.textContent = pairs[pairIdx].english;
        matched.add(pairIdx);
        updateCard(srsState, pairs[selectedLeftIdx].cardId, true);
        updateCard(srsState, pairs[selectedLeftIdx].fwdCardId, true);
        saveSrs(srsState);
        selectedLeftIdx = null;

        if (matched.size === pairs.length) {
          if (!hadWrong) appState.session.score++;
          const nextBtn = document.createElement('a');
          nextBtn.className = 'btn btn-primary next-fab';
          nextBtn.id = 'next-btn';
          nextBtn.textContent = 'Next →';
          document.querySelector('.card').appendChild(nextBtn);
          nextBtn.addEventListener('click', () => {
            document.removeEventListener('keydown', onEnterAdvance);
            advanceQuestion();
          });
          document.addEventListener('keydown', onEnterAdvance);
        }
      } else {
        hadWrong = true;
        leftCard.classList.add('wrong');
        card.classList.add('wrong');
        updateCard(srsState, pairs[selectedLeftIdx].cardId, false);
        updateCard(srsState, pairs[selectedLeftIdx].fwdCardId, false);
        saveSrs(srsState);
        selectedLeftIdx = null;
        setTimeout(() => {
          leftCard.classList.remove('wrong', 'selected');
          card.classList.remove('wrong');
        }, 600);
      }
    });
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

  // Update SRS for any flashcard with a cardId (review sessions and direct flashcard sessions)
  if (q.cardId) {
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

  function onEnterGoHome(e) {
    if (e.key === 'Enter') { e.preventDefault(); document.removeEventListener('keydown', onEnterGoHome); showHome(); }
  }
  document.getElementById('home-btn').addEventListener('click', () => {
    document.removeEventListener('keydown', onEnterGoHome);
    showHome();
  });
  document.addEventListener('keydown', onEnterGoHome);
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
    const detailBtn = isActive
      ? `<button class="btn-detail" data-chapter="${ch.number}" style="margin-top:4px">Details →</button>`
      : '';
    return `<tr${dim}>
      <td>${nameHtml}</td>
      <td class="num">${ch.total}</td>
      <td class="num">${isActive ? ch.notStarted : '—'}</td>
      <td class="num">${isActive ? ch.learning : '—'}</td>
      <td class="num">${isActive ? ch.mastered : '—'}</td>
      <td>${miniBar}${detailBtn}</td>
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
          <th style="min-width:60px"></th>
        </tr></thead>
        <tbody>${chapterRows}</tbody>
      </table>
      <p style="font-size:0.8rem;color:#aaa;margin-top:12px">Green = mastered &nbsp;·&nbsp; Amber = learning &nbsp;·&nbsp; Grey = not started</p>
    </div>`);

  document.querySelectorAll('.btn-detail').forEach(btn => {
    btn.addEventListener('click', () => showWordStats(parseInt(btn.dataset.chapter)));
  });
}

// ── Word stats screen ─────────────────────────────────────────────────────────

function showWordStats(chapterNum, sortMode = 'section') {
  const cd = appState.chaptersData[chapterNum];
  const words = getChapterWordStats(chapterNum, cd);

  // Build a flat list of card rows (one per direction)
  const allRows = [];
  for (const w of words) {
    allRows.push({ word: w, dir: 'EN→PL', prompt: w.english, answer: w.polish, s: w.fwd });
    allRows.push({ word: w, dir: 'PL→EN', prompt: w.polish, answer: w.english, s: w.rev });
  }

  const makeRow = ({ word, dir, prompt, answer, s }) => {
    const wrong = s.total - s.correct;
    const mastered = s.reps >= MASTERED_REPS;
    const days = mastered ? daysSince(s.mastered_on) : null;
    const heldCell = mastered
      ? (days === null ? '—' : days === 0 ? 'today' : `${days}d`)
      : '—';
    // Progress: "1/3", "2/3", "✓ in X" (or "✓" if mastered_in not tracked yet)
    let progress;
    if (mastered) {
      progress = s.mastered_in ? `✓ ${s.mastered_in}` : '✓';
    } else if (s.total === 0) {
      progress = '—';
    } else {
      progress = `${Math.min(s.reps, MASTERED_REPS - 1)}/${MASTERED_REPS}`;
    }
    const dimStyle = s.total === 0 ? ' style="opacity:0.35"' : '';
    const progressStyle = mastered ? ' style="color:#2d9e5f;font-weight:600"' : '';
    const flag = dir === 'EN→PL' ? '🇵🇱' : '🇬🇧';
    return `<tr${dimStyle}>
      <td style="font-size:0.85rem">${escHtml(prompt)}</td>
      <td style="font-size:0.8rem;color:#666">${escHtml(answer)}</td>
      <td class="num" style="font-size:1rem">${flag}</td>
      <td class="num">${s.total || '—'}</td>
      <td class="num">${s.total ? `${s.correct}/${wrong}` : '—'}</td>
      <td class="num"${progressStyle}>${progress}</td>
      <td class="num">${heldCell}</td>
    </tr>`;
  };

  let tableBody;
  if (sortMode === 'worst') {
    // Flat list sorted by wrong count desc, then by total desc; skip not-attempted
    const sorted = allRows
      .filter(r => r.s.total > 0)
      .sort((a, b) => (b.s.total - b.s.correct) - (a.s.total - a.s.correct) || b.s.total - a.s.total);
    tableBody = sorted.map(makeRow).join('');
    if (!tableBody) tableBody = `<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px">No attempts recorded yet</td></tr>`;
  } else {
    // Group by section
    let lastSection = null;
    tableBody = allRows.map(r => {
      let sectionRow = '';
      if (r.word.section !== lastSection) {
        lastSection = r.word.section;
        const label = r.word.section.charAt(0).toUpperCase() + r.word.section.slice(1).replace(/_/g, ' ');
        sectionRow = `<tr><td colspan="7" style="padding:10px 4px 4px;font-size:0.8rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em">${escHtml(label)}</td></tr>`;
      }
      return sectionRow + makeRow(r);
    }).join('');
  }

  const sortBtn = sortMode === 'section'
    ? `<button class="btn btn-secondary" id="sort-toggle" style="font-size:0.8rem;padding:6px 12px">Sort: worst first</button>`
    : `<button class="btn btn-secondary" id="sort-toggle" style="font-size:0.8rem;padding:6px 12px">Sort: by section</button>`;

  setMain(`
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-secondary" id="back-to-stats">← Stats</button>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.8rem;color:#888">Chapter ${chapterNum}</div>
          <strong>${escHtml(cd.topic)}</strong>
        </div>
        ${sortBtn}
      </div>
      <div style="overflow-x:auto">
        <table class="ch-table" style="min-width:440px">
          <thead><tr>
            <th style="text-align:left">Prompt</th>
            <th style="text-align:left">Answer</th>
            <th></th>
            <th>Tries</th>
            <th title="Correct / Wrong">✓/✗</th>
            <th title="Reps toward mastery, or total attempts when mastered">Progress</th>
            <th title="Days held since mastered">Held</th>
          </tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
      <p style="font-size:0.8rem;color:#aaa;margin-top:12px">
        Progress: reps/3 while learning · ✓ N = mastered in N total tries &nbsp;·&nbsp;
        Held = days since mastered
      </p>
    </div>`);

  document.getElementById('back-to-stats').addEventListener('click', showStats);
  document.getElementById('sort-toggle').addEventListener('click', () => {
    showWordStats(chapterNum, sortMode === 'section' ? 'worst' : 'section');
  });
}

// ── Settings screen ───────────────────────────────────────────────────────────

function showSettings() {
  const cd = appState.chaptersData;

  const chapterCheckboxes = ALL_CHAPTERS.map(n => `
    <label class="chapter-check-label">
      <input type="checkbox" class="chapter-check" value="${n}">
      <span>Chapter ${n}: ${escHtml(cd[n].topic)}</span>
    </label>`
  ).join('');

  setMain(`
    <div class="card" style="margin-bottom:16px">
      <h1>Settings</h1>
      <h2 style="margin-top:8px">Restore progress</h2>
      <p style="color:#555;font-size:0.95rem;margin-bottom:20px">
        Select the chapters you've already studied. The most recently selected chapter
        will be due in 5 days; each older chapter adds another 5 days, so your current
        chapter stays front and centre in daily reviews.
      </p>
      <div id="chapter-checks" style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
        ${chapterCheckboxes}
      </div>
      <button class="btn btn-primary" id="apply-restore" disabled>Apply →</button>
    </div>

    <div class="card">
      <h2>Difficulty</h2>
      <p style="color:#555;font-size:0.95rem;margin:8px 0 16px">
        Controls when letter gaps are removed. <em>Easy</em> keeps gaps longer so you build up muscle memory before typing full answers. A lapsed card always re-enables gaps regardless of this setting.
      </p>
      <div class="mode-grid" style="margin-bottom:20px">
        <input class="mode-option" type="radio" name="difficulty" id="d-easy" value="easy">
        <label for="d-easy">Easy<br><small style="font-weight:400;color:#666">All cards: gaps until 10 correct answers</small></label>
        <input class="mode-option" type="radio" name="difficulty" id="d-medium" value="medium">
        <label for="d-medium">Medium<br><small style="font-weight:400;color:#666">1 word → 3 · 2–3 words → 6 · 4+ words → 10</small></label>
        <input class="mode-option" type="radio" name="difficulty" id="d-hard" value="hard">
        <label for="d-hard">Hard<br><small style="font-weight:400;color:#666">All cards: gaps until 3 correct answers</small></label>
      </div>
      <button class="btn btn-primary" id="apply-difficulty">Save difficulty →</button>
    </div>`);

  // Difficulty setting
  const currentMode = loadDifficultyMode();
  const difficultyRadio = document.querySelector(`input[name="difficulty"][value="${currentMode}"]`);
  if (difficultyRadio) difficultyRadio.checked = true;
  document.getElementById('apply-difficulty').addEventListener('click', () => {
    const selected = document.querySelector('input[name="difficulty"]:checked');
    if (selected) {
      saveDifficultyMode(selected.value);
      document.getElementById('apply-difficulty').textContent = 'Saved ✓';
      setTimeout(() => { document.getElementById('apply-difficulty').textContent = 'Save difficulty →'; }, 1500);
    }
  });

  const applyBtn = document.getElementById('apply-restore');
  const checks = Array.from(document.querySelectorAll('.chapter-check'));

  checks.forEach(cb => cb.addEventListener('change', () => {
    applyBtn.disabled = !checks.some(c => c.checked);
  }));

  applyBtn.addEventListener('click', () => {
    const selected = checks
      .filter(c => c.checked)
      .map(c => parseInt(c.value))
      .sort((a, b) => a - b);
    if (!selected.length) return;

    const names = selected.map(n => `Ch ${n}: ${cd[n].topic}`).join('\n');
    if (!window.confirm(`Mark as mastered with staggered reviews?\n\n${names}`)) return;

    const srsState = loadSrs();
    const total = selected.length;

    selected.forEach((chNum, i) => {
      const fromEnd = total - 1 - i; // 0 = most recent chapter
      const interval = (fromEnd + 1) * 5;
      const chData = cd[chNum];

      for (const sec of chData.vocabulary) {
        for (const item of sec.items) {
          const jitter = Math.floor(Math.random() * 5) - 2; // -2 to +2 days
          const due = addDays(Math.max(1, interval + jitter));
          const applyMaster = id => {
            const existing = srsState[id] || {};
            srsState[id] = { ...existing, reps: 3, ease: 2.5, interval, due, mastered_on: existing.mastered_on || todayStr() };
          };
          applyMaster(cardId(chNum, sec.section, item.polish));
          applyMaster(reverseCardId(chNum, sec.section, item.polish));
        }
      }
    });

    saveSrs(srsState);
    showSettings();
  });
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
document.getElementById('nav-practice').addEventListener('click', e => { e.preventDefault(); showPractice(); });
document.getElementById('nav-stats').addEventListener('click', e => { e.preventDefault(); showStats(); });
document.getElementById('nav-settings').addEventListener('click', e => { e.preventDefault(); showSettings(); });

init();

// Hide the nav header when the keyboard opens to free up vertical space.
// Keyboard is considered open when the visual viewport shrinks to <75% of window height.
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const ratio = window.visualViewport.height / window.innerHeight;
    document.body.classList.toggle('keyboard-open', ratio < 0.75);
  });
}
