# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session

Bug-fix and mobile polish pass. Current version: **v3.8**.

### What was done
- **Service worker**: switched to network-first for app shell (index.html, app.js, srs.js) so updates deploy without requiring cache clear. Green update banner appears when new SW takes over, reassuring users SRS progress is safe.
- **Mobile keyboard / layout**: Check button moved to top of card, progress bar moved to bottom. Nav header hides when keyboard opens (visualViewport ratio < 0.75). `interactive-widget` approach abandoned — caused button to overlap input.
- **Go key**: inputs wrapped in `<form id="answer-form">` so mobile "Go" fires form submit → `submitAnswer()`. Double-fire guard: `submitAnswer` returns early if `#answer-form` is gone from DOM (already submitted). `onEnterAdvance` has a 300ms timestamp guard so a residual keydown from Go can't immediately skip the feedback screen.
- **Next button**: moved to `position: fixed; bottom: 28px; right: 24px` (FAB pattern) so it's reachable by thumb after keyboard dismisses.
- **Version in header**: `APP_VERSION` shown in nav header via `<span id="app-version">` populated on init. Increment on every push (minor: v3.x until next major feature).
- **Nav home**: tapping "🇵🇱 Polish Practice" now always returns home, even mid-session (sets `appState.session = null`).
- **Feedback layout fix (v3.8)**: moved the header (score badge + progress bar) to the TOP of the question card instead of the bottom. Previously, the feedback box was sandwiched between the prompt and the score/progress bar; its `margin-bottom` had nowhere to breathe. Now feedback sits at the bottom of the card with card padding below it.
- **First flashcard Go→home bug fix (v3.8)**: `showResults` added a `document` keydown listener (`onEnterGoHome`) that only cleaned itself up when Enter was pressed — not when the Home button was clicked. The orphaned listener would fire on the next session when Go sent a keydown Enter event (browser-dependent), calling `showHome()` and overriding the feedback screen. Fixed by making the Home button click also remove the listener.
- **Stats mobile overflow fix (v3.8)**: added `overflow: hidden` to `.card` CSS so colored stat-boxes and table content can't bleed outside the rounded 16px corners. Also added mobile responsive CSS to reduce stat-box padding/font-size on narrow screens, and reduced the mini-bar column `min-width` from 120px to 60px so the by-chapter table fits on narrow screens without overflowing.

## Next

### Outstanding issues
- ~~**Feedback box bottom margin not working**~~ — fixed (v3.8, moved header to top of card)
- ~~**Go key on first flashcard returns to home screen**~~ — fixed (v3.8, cleaned up orphaned keydown listener from results screen)
- ~~**Stats mobile: Mastered box not within card border**~~ — fixed (v3.8, overflow:hidden on .card + responsive stat-box)
- ~~**Stats mobile: By-chapter progress bars not within card border**~~ — fixed (v3.8, overflow:hidden + smaller min-width)
- ~~**Service worker / cache update UX**~~ — fixed (v3)
- ~~**Sticky button not working on mobile**~~ — fixed with card reorder + FAB Next button (v3.5)

### Upcoming features

#### 1. Reverse flashcards (Polish → English)
Add a new flashcard mode where the Polish word is shown and the user types the **full English translation**. No gapped hints — must type the complete answer.

- Add a 5th mode option to the home screen mode grid: `"flashcards_reverse"` (or label "🔄 Reverse cards")
- In `buildQuestions`, when `mode === 'flashcards_reverse'`, push questions with `prompt: item.polish` and `answer: item.english`
- Skip `annotatePartialAnswers` for this mode (or skip for reverse cards specifically — the `if (q.type !== 'flashcard') continue` check already handles it if we give the type a different name, e.g. `'flashcard_reverse'`)
- The render path in `renderFlashcard` would need to not apply `q.answerChars` for reverse mode (plain input always). Simplest: set `q.answerChars = null` explicitly, or check question type in `annotatePartialAnswers`.
- `answersMatch()` already strips diacritics, so `dobry` would match `dobry`. English answers typically have no diacritics anyway.
- SRS update: if using this in review mode it'd need a `cardId` with a different key prefix (e.g. `rev:1:colors:żółty`) to avoid conflating with forward-card SRS state. For practice-only (non-SRS) mode, no change needed — just use it like the regular flashcard mode (no SRS update unless `sess.mode === 'srs'`).

#### 2. Master a chapter (progress recovery button)
In case of cache/localStorage loss, add a way to immediately mark all cards in a chapter as mastered so the user can skip ahead to where they were.

- Add a "Master this chapter" button on the home screen or within the chapter-start flow. Most natural location: in the **Stats → By chapter** table as an action per row, or as a modal when clicking a chapter on the home screen.
- Suggested placement: in `showStats`, add a small "✓ Master" button next to each active chapter row in the by-chapter table. Locked chapters don't need this.
- On click: confirm with a simple `window.confirm()` prompt ("Mark all N cards in Chapter X as mastered? This sets each to 3 correct reps.").
- Implementation: iterate over `chaptersData[n].vocabulary` sections and items, call `updateCard` in a loop with `correct = true` **three times** for each card (since `MASTERED_REPS = 3` and `updateCard` increments `reps` by 1 per correct answer). Or directly write `{ reps: 3, interval: 6, ease: 2.5, due: todayStr() }` into `srsState` for each card. Direct write is simpler and more reliable.
- After mastering, call `saveSrs(state)` and re-render `showStats()` to show updated counts.
- Chain unlock logic in `chapterUnlockInfo` runs on every render, so mastering chapter N will automatically unlock chapter N+1 next time the home screen renders.

### Feature ideas (backlog)
Pick from the Feature Ideas section in `CLAUDE.md` once the above are resolved. TTS playback or streak tracking are good candidates.
