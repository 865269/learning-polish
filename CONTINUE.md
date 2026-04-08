# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session

Migrated from Python/Flask to static JS PWA. Cleaned up repo — Python files (`app.py`, `flashcards.py`, `srs.py`, `templates/`, `static/`, `venv/`) removed.

## Next

### Outstanding issues
- **Sticky button not working on mobile**: the `position: sticky` fix for keeping Check/Next above the keyboard (v2) shows no visible difference. Needs investigation — sticky may not work as expected when the keyboard resizes the viewport. May need `visualViewport` API or a `position: fixed` approach instead.
- **Service worker / cache update UX**: updating the app currently requires clearing site data, which wipes `localStorage` and loses SRS progress. Need to separate app cache from user data — SRS state is safe in `localStorage` but users don't know that. Two things to fix:
  1. Make cache updates seamless (service worker should update without requiring manual cache clear)
  2. Reassure users / provide an export/backup for SRS progress before they clear anything

### Feature ideas
Pick a feature from the Feature Ideas section in `CLAUDE.md` once the above are resolved. TTS playback or streak tracking are good candidates.
