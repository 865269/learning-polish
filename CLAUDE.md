# Polish Learning App — Project Reference

## The Book

**"Polish for Beginners: Learn Polish in 30 Days the Easy Way"** by Linda Matejek (188 pages, © 2022).
Visual companion to an audiobook. Consistent structure: vocabulary tables, grammar, exercises, Answer Key.

| # | Chapter | Key content |
|---|---------|-------------|
| 1 | Polish Basics | Alphabet, stress, grammar overview, colors, numbers |
| 2 | Meeting New People | Greetings, introductions, pronouns, verb "być" (to be) |
| 3 | Checking Into Your Room | Hotel vocabulary, room-related phrases |
| 4 | Going Shopping | Shopping phrases, prices, clothing |
| 5 | Going Sightseeing | Directions, landmarks, transport |
| 6 | Having a House Party | Food/drink, adjective agreement by gender |
| 7 | Eating Out | Restaurant vocabulary, ordering food |
| 8 | At the Movies | Entertainment, opinions |
| 9 | Talking About Your Past | Past tense, narrative |
| 10 | Grammar – A Summary | Consolidated grammar reference |
| – | Vocabulary Appendix | Full word list (p.141–151) |
| – | Answer Key | All exercise answers (p.152–178) |

## Stack

Pure JS PWA deployed via GitHub Pages. No build step, no server.

| File | Purpose |
|------|---------|
| `docs/index.html` | Shell, nav, CSS |
| `docs/app.js` | All UI logic, question rendering, session management |
| `docs/srs.js` | SM-2 algorithm, stats, unlock logic |
| `docs/sw.js` | Service worker (offline cache) |
| `docs/manifest.json` | PWA manifest |
| `docs/data/chapter{1–10}.json` | Vocab + exercises, one file per chapter |

SRS state lives in **`localStorage`** (`srs_state` key) — no backend, syncs per browser/device.

## Data Schema

Each `chapter{n}.json`:
```json
{
  "chapter": 1,
  "topic": "Polish Basics",
  "vocabulary": [
    {
      "section": "colors",
      "items": [
        { "english": "yellow", "polish": "żółty", "pronunciation": "zhoo-wty" }
      ]
    }
  ],
  "exercises": [
    {
      "id": "1.1",
      "type": "fill_in_the_blank | multiple_choice | short_answer",
      "questions": [
        { "question": "...", "answer": "...", "options": ["..."], "note": "..." }
      ]
    }
  ]
}
```

**Total: ~700 vocab items across chapters 1–10.**

## Key Constants (`srs.js`)

- `MASTERED_REPS = 3` — consecutive correct answers to count as mastered (used in stats, gapped-answer scaffold, and unlock logic)
- `UNLOCK_THRESHOLD = 0.9` — fraction of a chapter that must be mastered to unlock the next
- `REVIEW_BATCH = 20` — max cards per review session (in `app.js`)

## Technical Decisions

- **Diacritic tolerance**: `answersMatch()` strips Polish diacritics before comparing, so `zolty` matches `żółty`. Punctuation is also stripped.
- **Gapped answers**: unmastered flashcards show ~40% of letters blanked; individual `<input>` cells auto-advance focus. Mastered cards get a plain input.
- **Chapter unlock**: chain unlock — each chapter unlocks the next once ≥90% of its vocab is mastered (≥3 consecutive correct answers per card).
- **Study ahead**: when today's queue is empty, offers cards due within the next 7 days.
- **PDF extraction note**: `pdftotext -layout` garbles Polish diacritics (ą→¦, etc.). Workflow was: extract for structure, manually correct diacritics. All 10 chapters are done — this shouldn't be needed again.
- **Service worker**: network-first for app shell (index.html, app.js, srs.js, manifest.json) using `cache: 'no-cache'` to bypass HTTP cache. Cache-first for chapter JSON data. Cache name is `polish-v3`. Update banner via `controllerchange` event.
- **Mobile Go key**: inputs are wrapped in `<form id="answer-form">`. Form submit → `submitAnswer()`. Keydown Enter also calls `submitAnswer()` (needed for char-inputs). Double-fire guarded by checking `document.getElementById('answer-form')` exists at start of `submitAnswer`. `onEnterAdvance` has a 300ms debounce after submit to prevent residual keydown from skipping feedback.
- **Question card layout**: Check button at top, prompt + input below, meta (progress count) at bottom, progress bar + score at very bottom. Next button is `position: fixed` bottom-right (FAB). Nav header hides on keyboard open via `visualViewport` resize.
- **Versioning**: `APP_VERSION` in `app.js` displayed in nav header. Always bump before committing: minor version (v3.x → v3.x+1) for bug fixes and small changes; major version (v3 → v4) for significant new features. Never forget — a mismatch between deployed code and the displayed version causes confusion.

## Feature Ideas

### Pronunciation
- **TTS playback**: Web Speech API `SpeechSynthesis`, Polish voice (`pl-PL`), no server needed. Speaker button next to vocab words and on feedback screens.
- **Pronunciation guide**: `pronunciation` field already in JSON — show more prominently on feedback, or always visible under the Polish word.

### Speaking exercises
- **Listen and repeat**: play TTS, user speaks, `SpeechRecognition` transcribes, compare with diacritic tolerance. Chrome only. Could be a 5th practice mode.
- **Pronunciation scoring**: fuzzy match on transcript — same `answersMatch()` logic works.

### Engagement
- **Streak tracking**: consecutive days with ≥1 review; show on home page.
- **Weak-card drill**: button on stats to immediately review the N cards with most lapses.

### Content
- **Sentence mode**: fill-in-the-blank and short-answer exercises already have full sentences — surface as a dedicated mode with optional TTS audio.
- **Conjugation tables**: full present/past conjugation view or fill-in exercise for heavily conjugating verbs.

### Matching exercises
- **Duolingo-style word matching**: show 5 Polish words on the left, 5 English translations on the right (order scrambled). User taps a left item then a right item to pair them. When all pairs are matched correctly the round is complete. New question type `matching`; could appear in practice sessions and SRS review. Cards for the round drawn from the current chapter's vocab.

### Polish keyboard
- **On-screen diacritic picker**: since diacritic tolerance means it's not required, this is low priority — but a small toolbar of ą ć ę ł ń ó ś ź ż could help users learn correct spelling over time.
