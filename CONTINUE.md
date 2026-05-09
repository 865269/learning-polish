# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session (v3.23)

- **Matching moved to practice mode (v3.19)**: Removed from daily review. Dedicated "Matching" option in Practice, first in the list and default-selected. Builds groups of 5 pairs from chapter vocab (filterable by section). Counts toward both forward (EN→PL) and reverse (PL→EN) card mastery on each tap.
- **Matching UI fixes (v3.20)**: Selected card highlights blue (not red). No tick on matched cards. Switched to CSS grid layout so long words don't misalign columns.
- **Multiple choice removed from flashcards (v3.19)**: All EN→PL and PL→EN cards now require typed answers. Gender/form pair detection removed — `checkReverseAnswer` fuzzy matching handles variants.
- **Settings tab (v3.23)**: New nav item. "Restore progress" section: multi-chapter checkbox selector, staggered due dates (most recent chapter: +5 days, each older chapter: +5 more, per-card ±2 day jitter). Existing stats preserved. Difficulty placeholder (coming soon). Master button removed from Stats table.

## Outstanding bugs

None currently known.

## Next steps (in order)

1. **Streak tracking** — consecutive days with ≥1 review; show streak count on home page
2. **Weak-card drill** — button on Stats to immediately review the N cards with most lapses
3. **TTS playback** — Web Speech API, Polish voice (`pl-PL`), speaker button on feedback screens
