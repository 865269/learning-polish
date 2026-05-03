# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session (v3.18)

- **Matching exercise (v3.18)**: Single-word PL→EN reverse cards in daily review now appear as a tap-to-match grid instead of a typing input. `groupMatchingCards()` in `app.js` bundles consecutive single-word `flashcard_reverse` questions into groups of 2–5. Left column = Polish, right column = shuffled English. Tap left to select, tap right to match. Correct = green tick; wrong = red flash, try again. Each wrong tap fires `updateCard(false)`, each correct tap fires `updateCard(true)`. Score +1 if all pairs matched on first try. Polish phrases (prompt contains a space) still use typing mode.

## Outstanding bugs

None currently known.

## Next steps (in order)

1. **Master a chapter button** — Stats → By chapter table, per-row "✓ Master" button. Confirm via `window.confirm()`. Write `{ reps: 3, interval: 6, ease: 2.5, due: todayStr() }` directly into srsState for all forward + reverse card IDs in the chapter. Re-render stats after.

## Running tests

```
/home/matt/.vscode-server/bin/034f571df509819cc10b0c8129f66ef77a542f0e/node test/run.js
```

(No `node` on PATH in this WSL environment — use the VS Code binary above.)
