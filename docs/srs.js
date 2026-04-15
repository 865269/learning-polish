// SM-2 Spaced Repetition – port of srs.py

const MASTERED_REPS = 3;
const UNLOCK_THRESHOLD = 0.9;

function cardId(chapterNum, section, polish) {
  return `${chapterNum}:${section}:${polish}`;
}

function reverseCardId(chapterNum, section, polish) {
  return `rev:${chapterNum}:${section}:${polish}`;
}

// Compute a normalised base key for grouping gender/form pairs.
// Strips parentheticals first ("a Pole (male)" → "a pole"), then strips
// gender words at word boundaries so suffix pairs also group:
//   "an Englishman" → "an english",  "an Englishwoman" → "an english"
// "Germany" is safe: "many" is not a word-boundary match for "man".
function genderNormBase(english) {
  // 1. Strip parentheticals: "a Pole (male)" → "a Pole"
  // 2. Lowercase
  // 3. Strip standalone male/female: "a German (male)" → "a german"
  // 4. Strip man/woman compound suffixes: "Englishman" → "english"
  //    Uses \w{4,} so "german" (prefix "ger" = 3 chars) is NOT stripped.
  return english
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/\b(male|female)\b/gi, '')
    .replace(/\b(\w{4,})woman\b/gi, '$1')
    .replace(/\b(\w{4,})man\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build a map of genderNormBase → [english strings] for one chapter's vocabulary.
function buildGenderGroups(chapterData) {
  const groups = {};
  for (const sec of chapterData.vocabulary) {
    for (const item of sec.items) {
      const base = genderNormBase(item.english);
      if (!groups[base]) groups[base] = [];
      groups[base].push(item.english);
    }
  }
  return groups;
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

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(todayStr()) - new Date(dateStr)) / 86400000);
}

function updateCard(state, cid, correct) {
  const card = state[cid] || { interval: 1, ease: 2.5, reps: 0, lapses: 0 };
  const quality = correct ? 4 : 1;

  if (quality < 3) {
    card.interval = 1;
    card.lapses = (card.lapses || 0) + 1;
    card.reps = 0;
    delete card.mastered_on;  // lapsed — reset mastered date
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

  // Attempt counters
  card.total = (card.total || 0) + 1;
  if (correct) card.correct = (card.correct || 0) + 1;

  // Record when card first reaches (or re-reaches after lapse) mastered threshold
  if (correct && card.reps >= MASTERED_REPS && !card.mastered_on) {
    card.mastered_on = todayStr();
    card.mastered_in = card.total;  // total attempts at time of first mastery
  }

  state[cid] = card;
  return state;
}

function chapterMastery(srsState, chapterData) {
  let total = 0, mastered = 0;
  for (const sec of chapterData.vocabulary) {
    for (const item of sec.items) {
      const fwd = cardId(chapterData.chapter, sec.section, item.polish);
      const rev = reverseCardId(chapterData.chapter, sec.section, item.polish);
      total += 2;
      if ((srsState[fwd]?.reps || 0) >= MASTERED_REPS) mastered++;
      if ((srsState[rev]?.reps || 0) >= MASTERED_REPS) mastered++;
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

  function countCard(card) {
    if (!card) return 'notStarted';
    if (card.reps >= MASTERED_REPS) return 'mastered';
    return 'learning';
  }

  const chapterStats = [];
  for (const n of allChapters) {
    const ch = chaptersData[n];
    let chTotal = 0, chNotStarted = 0, chLearning = 0, chMastered = 0;
    for (const sec of ch.vocabulary) {
      for (const item of sec.items) {
        // Count forward and reverse cards separately
        for (const cid of [cardId(n, sec.section, item.polish), reverseCardId(n, sec.section, item.polish)]) {
          const card = srsState[cid];
          const bucket = countCard(card);
          total++; chTotal++;
          if (bucket === 'notStarted') { notStarted++; chNotStarted++; }
          else if (bucket === 'mastered') { mastered++; chMastered++; if (card.due in forecastMap) forecastMap[card.due]++; }
          else { learning++; chLearning++; if (card.due in forecastMap) forecastMap[card.due]++; }
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

function getChapterWordStats(chapterNum, chapterData) {
  const srsState = loadSrs();
  const items = [];
  for (const sec of chapterData.vocabulary) {
    for (const item of sec.items) {
      const fwd = srsState[cardId(chapterNum, sec.section, item.polish)] || {};
      const rev = srsState[reverseCardId(chapterNum, sec.section, item.polish)] || {};
      items.push({
        english: item.english,
        polish: item.polish,
        section: sec.section,
        fwd: { total: fwd.total||0, correct: fwd.correct||0, reps: fwd.reps||0, mastered_on: fwd.mastered_on||null, mastered_in: fwd.mastered_in||null },
        rev: { total: rev.total||0, correct: rev.correct||0, reps: rev.reps||0, mastered_on: rev.mastered_on||null, mastered_in: rev.mastered_in||null },
      });
    }
  }
  return items;
}

function getDueCards(activeChapters, chaptersData, extraDays = 0) {
  const srsState = loadSrs();
  const cutoff = addDays(extraDays);
  const due = [];
  for (const n of activeChapters) {
    const ch = chaptersData[n];
    const genderGroups = buildGenderGroups(ch);
    for (const sec of ch.vocabulary) {
      for (const item of sec.items) {
        const fwdId = cardId(n, sec.section, item.polish);
        const revId = reverseCardId(n, sec.section, item.polish);

        if (!srsState[fwdId] || srsState[fwdId].due <= cutoff) {
          due.push({
            type: 'flashcard',
            prompt: item.english,
            answer: item.polish,
            hint: item.pronunciation,
            section: sec.section,
            cardId: fwdId,
          });
        }
        if (!srsState[revId] || srsState[revId].due <= cutoff) {
          const group = genderGroups[genderNormBase(item.english)];
          const revCard = {
            type: 'flashcard_reverse',
            prompt: item.polish,
            answer: item.english,
            hint: item.pronunciation,
            section: sec.section,
            cardId: revId,
          };
          if (group && group.length > 1) revCard.choices = group;
          due.push(revCard);
        }
      }
    }
  }
  return due;
}
