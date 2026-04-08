// SM-2 Spaced Repetition – port of srs.py

const MASTERED_REPS = 3;
const UNLOCK_THRESHOLD = 0.9;

function cardId(chapterNum, section, polish) {
  return `${chapterNum}:${section}:${polish}`;
}

function loadSrs() {
  try {
    const raw = localStorage.getItem('srs_state');
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

function saveSrs(state) {
  localStorage.setItem('srs_state', JSON.stringify(state));
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function updateCard(state, cid, correct) {
  const card = state[cid] || { interval: 1, ease: 2.5, reps: 0, lapses: 0 };
  const quality = correct ? 4 : 1;

  if (quality < 3) {
    card.interval = 1;
    card.lapses = (card.lapses || 0) + 1;
    card.reps = 0;
  } else {
    if (card.reps === 0) {
      card.interval = 1;
    } else if (card.reps === 1) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.ease);
    }
    card.reps += 1;
  }

  card.ease = Math.max(1.3, card.ease + 0.1 - (5 - quality) * 0.08);
  card.due = addDays(card.interval);
  state[cid] = card;
  return state;
}

function chapterMastery(srsState, chapterData) {
  let total = 0, mastered = 0;
  for (const sec of chapterData.vocabulary) {
    for (const item of sec.items) {
      const cid = cardId(chapterData.chapter, sec.section, item.polish);
      total++;
      const card = srsState[cid];
      if (card && card.reps >= MASTERED_REPS) mastered++;
    }
  }
  return total ? mastered / total : 0;
}

function chapterUnlockInfo(allChapters, chaptersData) {
  if (!allChapters.length) {
    return { active: [], frontier: null, mastery: 0, nextNum: null, masteries: {} };
  }
  const srsState = loadSrs();
  const active = [allChapters[0]];
  const masteries = {};

  for (let i = 0; i < allChapters.length - 1; i++) {
    const n = allChapters[i];
    const m = chapterMastery(srsState, chaptersData[n]);
    masteries[n] = m;
    if (m >= UNLOCK_THRESHOLD) {
      active.push(allChapters[i + 1]);
    } else {
      break;
    }
  }

  const frontier = active[active.length - 1];
  if (!(frontier in masteries)) {
    masteries[frontier] = chapterMastery(srsState, chaptersData[frontier]);
  }

  const idx = allChapters.indexOf(frontier);
  const nextNum = idx + 1 < allChapters.length ? allChapters[idx + 1] : null;

  return { active, frontier, mastery: masteries[frontier], nextNum, masteries };
}

function makeAnswerChars(answer) {
  const letterIndices = [];
  for (let i = 0; i < answer.length; i++) {
    if (/\p{L}/u.test(answer[i])) letterIndices.push(i);
  }
  if (!letterIndices.length) {
    return answer.split('').map(c => ({ char: c, gap: false }));
  }
  const nGaps = Math.max(1, Math.min(letterIndices.length - 1, Math.round(letterIndices.length * 0.4)));
  const shuffled = [...letterIndices].sort(() => Math.random() - 0.5);
  const gapSet = new Set(shuffled.slice(0, nGaps));
  return answer.split('').map((c, i) => ({ char: c, gap: gapSet.has(i) }));
}

function getStats(allChapters, chaptersData) {
  const srsState = loadSrs();
  let total = 0, notStarted = 0, learning = 0, mastered = 0;

  const forecastMap = {};
  for (let i = 0; i < 7; i++) forecastMap[addDays(i)] = 0;

  const chapterStats = [];
  for (const n of allChapters) {
    const ch = chaptersData[n];
    let chTotal = 0, chNotStarted = 0, chLearning = 0, chMastered = 0;
    for (const sec of ch.vocabulary) {
      for (const item of sec.items) {
        const cid = cardId(n, sec.section, item.polish);
        const card = srsState[cid];
        total++; chTotal++;
        if (!card) {
          notStarted++; chNotStarted++;
        } else if (card.reps >= MASTERED_REPS) {
          mastered++; chMastered++;
          if (card.due in forecastMap) forecastMap[card.due]++;
        } else {
          learning++; chLearning++;
          if (card.due in forecastMap) forecastMap[card.due]++;
        }
      }
    }
    chapterStats.push({ number: n, topic: ch.topic, total: chTotal, notStarted: chNotStarted, learning: chLearning, mastered: chMastered });
  }

  const forecast = Object.keys(forecastMap).sort().map((date, i) => ({
    date,
    count: forecastMap[date],
    label: new Date(date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }),
    isToday: i === 0,
  }));
  const maxForecast = Math.max(...forecast.map(f => f.count), 1);

  return { total, notStarted, learning, mastered, forecast, maxForecast, chapters: chapterStats };
}

function getDueCards(activeChapters, chaptersData, extraDays = 0) {
  const srsState = loadSrs();
  const cutoff = addDays(extraDays);
  const due = [];
  for (const n of activeChapters) {
    const ch = chaptersData[n];
    for (const sec of ch.vocabulary) {
      for (const item of sec.items) {
        const cid = cardId(n, sec.section, item.polish);
        const card = srsState[cid];
        if (!card || card.due <= cutoff) {
          due.push({
            type: 'flashcard',
            prompt: item.english,
            answer: item.polish,
            hint: item.pronunciation,
            section: sec.section,
            cardId: cid,
          });
        }
      }
    }
  }
  return due;
}
