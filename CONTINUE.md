# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session (v3.13)

### What was done
- **Mixed EN↔PL flashcards (v3.12)**: Single "Flashcards" mode now includes both EN→PL and PL→EN questions randomly shuffled in the same session. Each direction tracked independently in SRS (`rev:` prefix for reverse card IDs). Both directions count toward chapter mastery and unlock.
- **Contraction tolerance + whitespace fix (v3.13)**: `expandContractions()` runs before punctuation stripping. `norm()` in `answersMatch` now also collapses whitespace and trims after PUNCT_RE, fixing "I'm from ..." → "i am from" matching.
- **Gender pair multiple choice (v3.13)**: `genderNormBase()` helper in `srs.js` strips parentheticals AND compound man/woman suffixes (using two separate replacements: `woman` first, then `man`, with `\b(\w{4,})` prefix guard so "german" is not affected). Both `buildQuestions` (direct sessions) and `getDueCards` (SRS reviews) now set `choices` on reverse flashcards for pairs/groups. `buildGenderGroups()` is the shared helper.
- **Greeting data fix (v3.13)**: "Cześć" changed to `"Hi / Hello (informal)"` so both are accepted. "Cześć, jestem" changed to `"Hi, I'm ... / Hello, I'm ..."` so both greetings are accepted. Slash-alternatives in `checkReverseAnswer` handle these.
- **Unit tests (v3.13)**: `test/run.js` — run with VS Code node binary. Covers `answersMatch`, `checkReverseAnswer`, `genderNormBase`, `buildGenderGroups`.

## Outstanding bugs

None currently known.

## Next steps (in order)

1. **Master a chapter button** — Stats → By chapter table, per-row "✓ Master" button. Confirm via `window.confirm()`. Write `{ reps: 3, interval: 6, ease: 2.5, due: todayStr() }` directly into srsState for all forward + reverse card IDs in the chapter. Re-render stats after.

## Running tests

```
/home/matt/.vscode-server/bin/41dd792b5e652393e7787322889ed5fdc58bd75b/node test/run.js
```

(No `node` on PATH in this WSL environment — use the VS Code binary above.)

## Feature ideas (backlog)
Pick from the Feature Ideas section in `CLAUDE.md` once the above are resolved. TTS playback or streak tracking are good candidates.
