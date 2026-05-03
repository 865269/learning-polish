# Polish App — Plan

## Active

- [ ] Master a chapter button — Stats → By chapter table, per-row "✓ Master" button. Confirm via `window.confirm()`. Write `{ reps: 3, interval: 6, ease: 2.5, due: todayStr() }` directly into srsState for all forward + reverse card IDs in the chapter. Re-render stats after.

## Backlog

Work through these in order; discard anything that doesn't add value after trying it.

### Engagement
- [ ] Streak tracking — consecutive days with ≥1 review; show on home page
- [ ] Weak-card drill — button on stats to immediately review the N cards with most lapses

### Audio
- [ ] TTS playback — Web Speech API `SpeechSynthesis`, Polish voice (`pl-PL`), no server needed. Speaker button next to vocab words and on feedback screens.
- [ ] Pronunciation guide — show `pronunciation` field more prominently on feedback, or always visible under the Polish word
- [ ] Listen and repeat — play TTS, user speaks, `SpeechRecognition` transcribes, compare with diacritic tolerance. Chrome only.
- [ ] Pronunciation scoring — fuzzy match on transcript using `answersMatch()` logic

### Content & Modes
- [ ] Sentence mode — fill-in-the-blank and short-answer exercises surfaced as a dedicated mode with optional TTS audio
- [ ] Conjugation tables — full present/past conjugation view or fill-in exercise for heavily conjugating verbs
- [x] Duolingo-style word matching — 5 Polish/English pairs, tap to match. New question type `matching`; drawn from current chapter vocab.

### Input
- [ ] On-screen diacritic picker — small toolbar of ą ć ę ł ń ó ś ź ż. Low priority since diacritic tolerance means it's not required for correct answers.

## Archived
