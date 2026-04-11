# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session

Worked through a series of mobile UX fixes. Current version: **v3.7**.

### What was done
- **Service worker**: switched to network-first for app shell (index.html, app.js, srs.js) so updates deploy without requiring cache clear. Green update banner appears when new SW takes over, reassuring users SRS progress is safe.
- **Mobile keyboard / layout**: Check button moved to top of card, progress bar moved to bottom. Nav header hides when keyboard opens (visualViewport ratio < 0.75). `interactive-widget` approach abandoned — caused button to overlap input.
- **Go key**: inputs wrapped in `<form id="answer-form">` so mobile "Go" fires form submit → `submitAnswer()`. Double-fire guard: `submitAnswer` returns early if `#answer-form` is gone from DOM (already submitted). `onEnterAdvance` has a 300ms timestamp guard so a residual keydown from Go can't immediately skip the feedback screen.
- **Next button**: moved to `position: fixed; bottom: 28px; right: 24px` (FAB pattern) so it's reachable by thumb after keyboard dismisses.
- **Version in header**: `APP_VERSION` shown in nav header via `<span id="app-version">` populated on init. Increment on every push (minor: v3.x until next major feature).
- **Nav home**: tapping "🇵🇱 Polish Practice" now always returns home, even mid-session (sets `appState.session = null`).

## Next

### Outstanding issues
- **Feedback box bottom margin not working**: `.feedback-correct` and `.feedback-wrong` have `margin-bottom: 24px` added in v3.7 but the border still touches the question number (meta) below it. Needs investigation — the meta div may have its own top margin collapsing, or the feedback is rendered differently than expected. Check the DOM structure in DevTools.
- ~~**Service worker / cache update UX**~~ — fixed (v3).
- ~~**Sticky button not working on mobile**~~ — fixed with card reorder + FAB Next button (v3.5).

### Feature ideas
Pick a feature from the Feature Ideas section in `CLAUDE.md` once the above are resolved. TTS playback or streak tracking are good candidates.
