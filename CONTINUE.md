# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session (v3.19)

- **Matching moved to practice mode**: Removed from daily review. Now a dedicated "Matching" option in the Practice screen. Builds groups of 5 pairs from chapter vocab (filterable by section). `buildQuestions` handles the `matching` mode directly.
- **Multiple choice removed from flashcards**: All EN→PL and PL→EN cards now require typed answers. The gender/form pair detection (`buildGenderGroups`, `genderNormBase`, `q.choices`) and `groupMatchingCards`/`isSingleWord` are all removed. `checkReverseAnswer` already handles gender variants via paren-stripping fuzzy match.

## Outstanding bugs

None currently known.

## Next steps (in order)

1. **Master a chapter button** — Stats → By chapter table, per-row "✓ Master" button. Confirm via `window.confirm()`. Write `{ reps: 3, interval: 6, ease: 2.5, due: todayStr() }` directly into srsState for all forward + reverse card IDs in the chapter. Re-render stats after.
