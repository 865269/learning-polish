#!/usr/bin/env node
// Unit tests for pure logic in app.js and srs.js
// Run with: node test/run.js

const fs = require('fs');
const path = require('path');

// ── Functions under test (pure, no DOM) ──────────────────────────────────────

const DIACRITIC_MAP = { ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z' };
const PUNCT_RE = /[?!.,;:'"]/g;
const CONTRACTIONS = {
  "i'm":"i am", "it's":"it is", "he's":"he is", "she's":"she is",
  "we're":"we are", "you're":"you are", "they're":"they are",
  "there's":"there is", "that's":"that is", "what's":"what is", "who's":"who is",
  "i've":"i have", "you've":"you have", "we've":"we have", "they've":"they have",
  "i'll":"i will", "you'll":"you will", "he'll":"he will", "she'll":"she will",
  "we'll":"we will", "they'll":"they will", "it'll":"it will",
  "don't":"do not", "doesn't":"does not", "didn't":"did not",
  "can't":"cannot", "won't":"will not", "isn't":"is not",
  "aren't":"are not", "wasn't":"was not", "weren't":"were not",
};

function stripDiacritics(text) {
  return text.replace(/[ąćęłńóśźż]/g, c => DIACRITIC_MAP[c] || c);
}
function expandContractions(text) {
  return text.replace(/\b\w+'\w+\b/g, m => CONTRACTIONS[m] || m);
}
function answersMatch(user, expected) {
  const norm = s => expandContractions(stripDiacritics(s.trim().toLowerCase())).replace(PUNCT_RE, '').replace(/\s+/g, ' ').trim();
  return norm(user) === norm(expected);
}
function checkReverseAnswer(userAnswer, expected) {
  if (answersMatch(userAnswer, expected)) return true;
  const stripped = expected.replace(/\s*\([^)]*\)/g, '').trim();
  if (stripped && answersMatch(userAnswer, stripped)) return true;
  const inner = expected.match(/\(([^)]+)\)/);
  if (inner && answersMatch(userAnswer, inner[1])) return true;
  const parts = stripped.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    for (const part of parts) {
      if (answersMatch(userAnswer, part)) return true;
    }
  }
  return false;
}
function genderNormBase(english) {
  return english
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/\b(male|female)\b/gi, '')
    .replace(/\b(\w{4,})woman\b/gi, '$1')
    .replace(/\b(\w{4,})man\b/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
function buildGenderGroups(chapterData) {
  const groups = {};
  for (const sec of chapterData.vocabulary) {
    for (const item of sec.items) {
      const base = genderNormBase(item.english);
      if (!groups[base]) groups[base] = [];
      groups[base].push(item.english);
    }
  }
  return groups;
}

// ── Test harness ──────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
function expect(desc, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${desc}`);
    pass++;
  } else {
    console.error(`  ✗ ${desc}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(actual)}`);
    fail++;
  }
}

// ── answersMatch ──────────────────────────────────────────────────────────────

console.log('\nanswersMatch — diacritics & case');
expect('exact match',                answersMatch('żółty', 'żółty'), true);
expect('diacritic tolerance',        answersMatch('zolty', 'żółty'), true);
expect('case insensitive',           answersMatch('ŻÓŁTY', 'żółty'), true);
expect('wrong answer',               answersMatch('niebieski', 'żółty'), false);

console.log('\nanswersMatch — contractions');
expect("I'm → I am",                 answersMatch("i'm from", "I am from"), true);
expect("it's → it is",               answersMatch("it's nice", "It is nice"), true);
expect("don't → do not",             answersMatch("don't go", "do not go"), true);

console.log('\nanswersMatch — whitespace / punctuation');
expect('trailing space after ellipsis strip', answersMatch("i am from", "I'm from ..."), true);
expect('leading/trailing whitespace', answersMatch("  żółty  ", "żółty"), true);
expect('punctuation stripped',       answersMatch("jak się masz", "Jak się masz?"), true);

// ── checkReverseAnswer ────────────────────────────────────────────────────────

console.log('\ncheckReverseAnswer — paren stripping');
expect('exact match',                checkReverseAnswer('Hello (informal)', 'Hello (informal)'), true);
expect('strip parens accepted',      checkReverseAnswer('Hello', 'Hello (informal)'), true);
expect('inner paren accepted',       checkReverseAnswer('informal', 'Hello (informal)'), true);
expect('wrong answer',               checkReverseAnswer('Goodbye', 'Hello (informal)'), false);

console.log('\ncheckReverseAnswer — slash alternatives');
expect('first alternative',          checkReverseAnswer('Hi', 'Hi / Hello (informal)'), true);
expect('second alternative',         checkReverseAnswer('Hello', 'Hi / Hello (informal)'), true);
expect('phrase first alternative',   checkReverseAnswer("Hi, I'm ...",  "Hi, I'm ... / Hello, I'm ..."), true);
expect('phrase second alternative',  checkReverseAnswer("Hello, I'm ...", "Hi, I'm ... / Hello, I'm ..."), true);

// ── genderNormBase ────────────────────────────────────────────────────────────

console.log('\ngenderNormBase');
expect('paren pair',    genderNormBase('a Pole (male)'),    'a pole');
expect('paren pair',    genderNormBase('a Pole (female)'),  'a pole');
expect('man suffix',    genderNormBase('an Englishman'),    'an english');
expect('woman suffix',  genderNormBase('an Englishwoman'),  'an english');
expect('Germany safe',  genderNormBase('Germany'),          'germany');
expect('male paren',    genderNormBase('a German (male)'),  'a german');
expect('female paren',  genderNormBase('a German (female)'),'a german');

// ── buildGenderGroups (integration with chapter2.json) ───────────────────────

console.log('\nbuildGenderGroups — chapter 2');
const ch2 = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/data/chapter2.json'), 'utf8'));
const groups = buildGenderGroups(ch2);

expect('Pole pair grouped',       groups['a pole']?.length,    2);
expect('German pair grouped',     groups['a german']?.length,  2);
expect('American pair grouped',   groups['an american']?.length, 2);
expect('English suffix pair',     groups['an english']?.length, 2);
expect('single word not grouped', (groups['poland'] || []).length, 1);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
