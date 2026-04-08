# Polish Learning App – Notes

## About the Book

**"Polish for Beginners: Learn Polish in 30 Days the Easy Way"** by Linda Matejek (188 pages, © 2022)

Visual companion to an audiobook. Consistent structure across 10 chapters — vocabulary tables, grammar, exercises with an Answer Key covering every exercise.

### Chapter Topics

| # | Chapter | Key content |
|---|---------|-------------|
| 1 | Polish Basics | Alphabet, stress, grammar overview, colors, numbers |
| 2 | Meeting New People | Greetings, introductions, pronouns, verb "być" (to be) |
| 3 | Checking Into Your Room | Hotel vocabulary, room-related phrases |
| 4 | Going Shopping | Shopping phrases, prices, clothing |
| 5 | Going Sightseeing | Directions, landmarks, transport |
| 6 | Having a House Party | Food/drink, adjective agreement by gender |
| 7 | Eating Out | Restaurant vocabulary, ordering food |
| 8 | At the Movies | Entertainment, opinions |
| 9 | Talking About Your Past | Past tense, narrative |
| 10 | Grammar – A Summary | Consolidated grammar reference |
| – | Vocabulary Appendix | Full word list (p.141–151) |
| – | Answer Key | All exercise answers (p.152–178) |

---

## What's Been Built

### Stack
- **Data**: JSON files in `data/` — one per chapter
- **CLI**: `flashcards.py` — terminal-based drill with 4 modes
- **Web app**: `app.py` (Flask) + `templates/` — browser-based Duolingo-like UI
- **SRS**: `srs.py` — SM-2 spaced repetition, state persisted in `data/srs.json`
- **Virtualenv**: `venv/` — run with `venv/bin/python app.py`, open http://localhost:5000

### Data extracted

| File | Sections | Vocab items | Exercises |
|------|----------|-------------|-----------|
| `data/chapter1.json` | colors, numbers 0–19 | ~33 | 1.1, 1.3–1.6 |
| `data/chapter2.json` | greetings, pronouns, być, days, numbers 20–1000, countries | ~90 | 2.3–2.5, 2.9 + drills |
| `data/chapter3.json` | hotel phrases, rooms, furniture, appliances, accessories, prepositions, adjectives | ~73 | 3.1–3.5 |
| `data/chapter4.json` | shopping, demonstratives, numerals, interrogatives, fruits, vegetables, staples | ~66 | 4.1–4.7 |
| `data/chapter5.json` | directions, city places, adverbs of place, transport, modal verbs, time expressions | ~66 | 5.1–5.6 |
| `data/chapter6.json` | appearance, possessive pronouns, family, body parts | ~98 | 6.1–6.5 |
| `data/chapter7.json` | restaurant phrases, likes/dislikes, meals, food, drinks, conjunctions, comparatives | ~73 | 7.1–7.5 |
| `data/chapter8.json` | making plans, entertainment, time telling, future być, personality traits | ~90 | 8.1–8.4 |
| `data/chapter9.json` | past tense phrases, past być, indefinite pronouns, months, seasons, jobs | ~74 | 9.1–9.4 |
| `data/chapter10.json` | grammatical cases (names + question words), adjective comparison, modal verb conjugations (móc/umieć/musieć) | 37 | none |

**Total: ~700 vocab items across chapters 1–10**

### App features
- **4 practice modes**: flashcards (type Polish word), fill in the blank, multiple choice, short answer
- **Spaced repetition**: SM-2 algorithm; "Review due" button on home page shows cards due today, batched 20 at a time
- **Chapter unlock system**: only chapter 1 in review pool initially; each chapter unlocks the next once ≥90% mastery (reps ≥ 3 consecutive correct). Unlock threshold defined in `srs.UNLOCK_THRESHOLD`
- **Study ahead**: when today's queue is empty, offers to pull cards due in the next 7 days early (`/review?ahead=7`)
- **Gapped answers**: unmastered flashcards show the word with ~40% of letters blanked out (e.g. `ż_łt_`); individual character cells auto-advance focus as you type. Mastered cards get a blank input
- **Stats page** (`/stats`): summary (not started / learning / mastered), 7-day review forecast bar chart, per-chapter breakdown with mini progress bars and lock indicators
- **Diacritic tolerance**: typing `zolty` matches `żółty`, punctuation ignored — no Polish keyboard needed
- **Category filter**: flashcard mode lets you drill a single vocabulary section
- **Question count**: choose 10 / 20 / 30 / 50 / All per session
- **Keyboard flow**: Enter submits → Enter advances → Enter on results goes home

### Key constants (srs.py)
- `MASTERED_REPS = 3` — consecutive correct answers to be considered mastered (shared between stats, gapped-answer scaffold, and unlock logic)
- `UNLOCK_THRESHOLD = 0.9` — chapter mastery fraction required to unlock the next chapter

### PDF extraction note
`pdftotext -layout` extracts the text but garbles Polish diacritics (ą→¦, ę→¸, ł→Ï, etc.) in most sections. The Answer Key at the back often comes through clean. Workflow: extract with pdftotext for structure, manually correct Polish characters when building the JSON.

---

## Build Order

| Step | Status | Notes |
|------|--------|-------|
| 1. Extract Chapter 1 data into JSON | ✅ Done | |
| 2. Flashcard CLI loop | ✅ Done | `flashcards.py` |
| 3. Add multiple choice | ✅ Done | |
| 4. Add browser UI | ✅ Done | Flask + HTML/CSS |
| 5. Extract chapters 3–9 | ✅ Done | All 9 chapters complete |
| 6. Spaced repetition (SM-2) | ✅ Done | `srs.py`, state in `data/srs.json` |
| 7. Stats page | ✅ Done | `/stats` — summary, forecast, chapter table |
| 8. Gapped-answer scaffold | ✅ Done | Random letter gaps, per-char inputs, auto-advance |
| 9. Chapter unlock system | ✅ Done | Chain unlock at 90% mastery |
| 10. Study-ahead | ✅ Done | Pull future-due cards when today's queue is empty |
| 11. Extract Chapter 10 | ✅ Done | Grammar summary: 7 cases, adjective comparison, modal verb conjugations |

### Next up
- Pick a feature from the Feature Ideas section below

---

## Feature Ideas

### Pronunciation
- **Text-to-speech playback**: use the Web Speech API (`SpeechSynthesis`) — no server needed, works in Chrome/Edge. Polish voice (`pl-PL`) is available. Add a speaker button next to every vocab word and on feedback screens. Could also auto-play the answer after a correct or wrong response.
- **Pronunciation guide overlay**: the JSON already has a `pronunciation` field (romanised approximation). Show it more prominently — e.g. always visible under the Polish word on feedback, or togglable during a card.
- **IPA or phonetic hints**: extend the JSON data with IPA transcriptions for words where the romanised hint isn't enough (e.g. words with ą, ę, ó, rz, sz, cz, dz, dź, dż).

### Speaking / pronunciation exercises
- **Listen and repeat**: play TTS audio, user speaks into the microphone, Web Speech API `SpeechRecognition` transcribes, compare against expected Polish text (with diacritic tolerance). Works in Chrome. Could be a 5th practice mode.
- **Shadowing mode**: auto-play a sentence, pause, play user recording back alongside — useful for prosody rather than just word recognition.
- **Pronunciation scoring**: browser-native speech recognition gives a transcript; a fuzzy match (same diacritic-stripped comparison already in `answers_match`) tells you if you were understood. Doesn't need a backend.

### Mobile app
- **Progressive Web App (PWA)**: the Flask app is already close — add a `manifest.json` and a service worker with an offline cache of the question templates. Installable on Android/iOS from the browser, works offline once cached. Lowest-effort path to "mobile app".
- **React Native / Expo**: if a native feel is important, reuse the JSON data files and `srs.py` logic (port to JS or call a thin Flask API). Expo makes it easy to publish to both iOS and Android without separate codebases.
- **Backend considerations for mobile**: move SRS state from a local `data/srs.json` file to a small database (SQLite via SQLAlchemy is enough) with a user session, so progress syncs across devices. This is the one prerequisite before going mobile.

### Other ideas
- **Streak tracking**: count consecutive days with at least one review; show on home page. Strong motivator.
- **Sentence mode**: the exercises already have full Polish sentences in the fill-in-the-blank and short-answer data — could surface these as a dedicated "read the sentence" mode with audio.
- **Weak-card drill**: a button on the stats page to immediately review the N cards with the most lapses (wrong answers), regardless of due date.
- **Conjugation tables**: Polish verbs conjugate heavily. A dedicated view that shows a verb's full present/past conjugation as a reference or as a fill-in exercise could be valuable alongside the vocab drills.
- **Difficulty adjustment**: currently mastery = 3 consecutive correct. Could expose this as a user setting (easy: 2, hard: 5) so the unlock pace is configurable.
