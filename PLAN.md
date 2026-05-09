# Polish App — Plan

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

### Settings (future)
- [ ] Difficulty setting — adjust MASTERED_REPS or ease starting value; placeholder already in Settings tab

### Input
- [ ] On-screen diacritic picker — small toolbar of ą ć ę ł ń ó ś ź ż. Low priority since diacritic tolerance means it's not required for correct answers.

## Archived

- [x] Duolingo-style word matching — tap-to-match grid in Practice mode. Counts toward both EN→PL and PL→EN card mastery. Removed from daily review (wasn't working well there).
- [x] Master a chapter button — replaced by Settings → Restore progress with multi-chapter staggered scheduling.
