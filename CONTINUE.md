# Polish App — Current State

## What's running

Pure JS PWA in `docs/`, deployed on GitHub Pages. Accessible on phone via browser (installable).
No server, no build step. SRS state in `localStorage`.

All 10 chapters extracted and complete (~700 vocab items). Full feature parity with the old Python/Flask version.

## Last session (v3.12)

### What was done
- **Mixed EN↔PL flashcards (v3.12)**: Single "Flashcards" mode now includes both EN→PL and PL→EN questions randomly shuffled in the same session. Each direction tracked independently in SRS (`rev:` prefix for reverse card IDs). Both directions count toward chapter mastery and unlock.
- **Contraction tolerance (v3.12)**: `expandContractions()` runs before punctuation stripping in `answersMatch()`. "I'm from" and "I am from" now treated as equivalent. Common contractions mapped: I'm, it's, he's, she's, we're, you're, they're, there's, that's, what's, who's, I've, you've, we've, they've, I'll, you'll, he'll, she'll, we'll, they'll, it'll, don't, doesn't, didn't, can't, won't, isn't, aren't, wasn't, weren't.
- **Gender pair multiple choice (v3.12, partial)**: Reverse flashcards for vocab items sharing a base English string (after stripping parentheticals, e.g. "a Pole (male)" / "a Pole (female)") now render as multiple-choice buttons instead of free-text. Implemented `checkReverseAnswer()` for flexible matching (strips parens, accepts inner paren content, accepts slash-separated variants).
- **Session footer layout**: Score badge + progress bar moved to bottom of card with border-top separator. Keyboard can push it off-screen without obscuring prompt/input.

## Outstanding bugs

### BUG: Contraction tolerance not working for "Jestem z" / "I'm from ..."
- The English answer for this card is `"I'm from ..."` (with ellipsis).
- User typed `"i am from"` — was marked wrong.
- Root cause: after `expandContractions("i'm from ...") → "i am from ..."`, then PUNCT_RE strips the dots but leaves trailing space → `"i am from "`. User input normalizes to `"i am from"` (no trailing space). String mismatch due to whitespace.
- **Fix**: add `.trim()` (or whitespace collapse) after the PUNCT_RE replace in `answersMatch`'s `norm` function:
  ```js
  const norm = s => expandContractions(stripDiacritics(s.trim().toLowerCase())).replace(PUNCT_RE, '').replace(/\s+/g, ' ').trim();
  ```

### BUG: Gender pair detection misses man/woman suffix pairs
- Current grouping strips parentheticals: `"a Pole (male)"` → base `"a pole"`. Works for paren-style pairs.
- Fails for compound-word pairs: `"an Englishman"` / `"an Englishwoman"` → bases `"an englishman"` / `"an englishwoman"` — different strings, not grouped.
- Many similar pairs exist across chapters: Anglik/Angielka, Niemiec/Niemka, Amerykanin/Amerykanka, kuzyn/kuzynka, pracownik/pracownica, nauczyciel/nauczycielka, etc.
- **Fix**: in `buildQuestions`, compute gender-normalised base by also stripping `man`/`woman`/`male`/`female` words from the paren-stripped base, then group by that. Must be careful not to over-match (e.g. "Germany" contains "many" — use word-boundary regex `\b(man|woman|male|female)\b`).
  - "an Englishman" → strip parens → "an englishman" → strip `\bman\b` → "an english"
  - "an Englishwoman" → strip parens → "an englishwoman" → strip `\bwoman\b` → "an english"
  - These now share the same base and get grouped → multiple choice on reverse card.
  - Verify "Germany" → strip parens → "germany" → no word-boundary match on "man" → unchanged ✓
  - Verify "fireman" → strip parens → "fireman" → strip `\bman\b`... `man` IS at a word boundary here → "fire". But "fireman" has no female counterpart in the data, so it won't pair with anything (group size = 1 → no choices shown). Safe.
  - Full regex: `/\b(man|woman|male|female)\b/gi` applied after paren strip, then collapse whitespace.

## Next steps (in order)

1. **Fix `answersMatch` whitespace** — tiny one-liner, do first.
2. **Fix gender pair detection** — update `buildQuestions` base-key computation to also strip gender words.
3. **Master a chapter button** — Stats → By chapter table, per-row "✓ Master" button. Confirm via `window.confirm()`. Write `{ reps: 3, interval: 6, ease: 2.5, due: todayStr() }` directly into srsState for all forward + reverse card IDs in the chapter. Re-render stats after.

## Feature ideas (backlog)
Pick from the Feature Ideas section in `CLAUDE.md` once the above are resolved. TTS playback or streak tracking are good candidates.
