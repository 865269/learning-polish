# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session (v3.24)

- **Card difficulty + global difficulty mode (v3.24)**: Gapping removal is now decoupled from mastery. `cardGappingThreshold(polishText)` in `srs.js` returns the reps needed before letter gaps are removed, based on word count (1 word = 3, 2–3 words = 6, 4+ words = 10). A global difficulty mode (`localStorage: difficulty_mode`) overrides this: Easy = 10 for all, Medium = adaptive, Hard = 3 for all (original behavior). Mastery/unlock threshold stays at `MASTERED_REPS = 3` regardless. Lapse forgiveness is automatic: lapse resets `reps` to 0 which falls below any threshold. Difficulty picker added to Settings tab (replaces "Coming soon" placeholder). Saves to localStorage with a "Saved ✓" confirmation.

## Outstanding bugs

None currently known.

## Next steps (in order)

1. **Streak tracking** — consecutive days with ≥1 review; show streak count on home page
2. **Weak-card drill** — button on Stats to immediately review the N cards with most lapses
3. **TTS playback** — Web Speech API, Polish voice (`pl-PL`), speaker button on feedback screens
