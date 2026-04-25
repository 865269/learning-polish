# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session (v3.16)

### What was done
- **Contraction tolerance + whitespace fix (v3.13)**: `norm()` in `answersMatch` collapses whitespace and trims after PUNCT_RE, fixing "I'm from ..." → "i am from".
- **Gender pair multiple choice (v3.13)**: `genderNormBase()` / `buildGenderGroups()` in `srs.js` shared by both `buildQuestions` and `getDueCards`. Strips parentheticals and compound man/woman suffixes (`\b(\w{4,})woman` then `\b(\w{4,})man` — order matters; prefix guard prevents "german" being affected). Gender pairs now show as multiple choice in both direct flashcard sessions and SRS reviews.
- **Greeting data fix (v3.13)**: "Cześć" → `"Hi / Hello (informal)"`, "Cześć, jestem" → `"Hi, I'm ... / Hello, I'm ..."`.
- **All flashcard sessions track SRS (v3.15)**: `buildQuestions` now sets `cardId` on every flashcard question; `processAnswer` calls `updateCard` for any question with a `cardId` — not just SRS review mode.
- **Per-word attempt stats (v3.14)**: `updateCard` tracks `total`, `correct`, `mastered_on` (date), `mastered_in` (total attempts at first mastery). Stats → Details button per chapter shows per-word table.
- **Home page redesign (v3.16)**: Home shows current chapter card (mastery %, vocab breakdown, unlock progress) + review status only. Lesson chooser moved to new **Practice** nav tab.
- **Flags (v3.16)**: 🇵🇱 shown top-left when answering in Polish (EN→PL), 🇬🇧 when answering in English (PL→EN).
- **Word stats improvements (v3.16)**: Progress column shows `1/3`/`2/3` while learning, `✓ N` (mastered in N total tries) once mastered. Sort toggle: by section (default) or worst-first (by wrong count).
- **Unit tests**: `test/run.js` — 43 tests covering `answersMatch`, `checkReverseAnswer`, `genderNormBase`, `buildGenderGroups`, `updateCard` lifecycle, `daysSince`.

## Outstanding bugs

- ~~**"on the dates…" never matched** (ch.3)~~: fixed in v3.17 — added `…` (U+2026) to `PUNCT_RE` so the Unicode ellipsis is stripped on both sides before comparison.
- ~~**Phrase answers too strict**~~: fixed in v3.17 — `checkReverseAnswer` now falls back to content-word overlap (`answersMatchContent`). Extracts non-stop-words from expected, checks each appears in user's answer via prefix matching (≥4 chars). "is breakfast included in the price" now matches "Does the price include breakfast?".

## Next steps (in order)

1. **Master a chapter button** — Stats → By chapter table, per-row "✓ Master" button. Confirm via `window.confirm()`. Write `{ reps: 3, interval: 6, ease: 2.5, due: todayStr() }` directly into srsState for all forward + reverse card IDs in the chapter. Re-render stats after.

## Running tests

```
/home/matt/.vscode-server/bin/560a9dba96f961efea7b1612916f89e5d5d4d679/node test/run.js
```

(No `node` on PATH in this WSL environment — use the VS Code binary above.)

## Feature ideas (backlog)
Pick from the Feature Ideas section in `CLAUDE.md` once the above are resolved. TTS playback or streak tracking are good candidates.
