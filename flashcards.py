#!/usr/bin/env python3
"""Polish flashcard drill — vocabulary and exercises from the book."""

import json
import random
import sys
import unicodedata
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

# Map plain ASCII approximations to Polish diacritics so you can type
# without a Polish keyboard. e.g. "zolty" still matches "żółty".
_DIACRITIC_MAP = str.maketrans({
    "ą": "a", "ć": "c", "ę": "e", "ł": "l",
    "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
})


def _strip_diacritics(text: str) -> str:
    """Return text with Polish diacritics replaced by their ASCII base letters."""
    return text.translate(_DIACRITIC_MAP)


def _match(user: str, expected: str) -> bool:
    """Return True if user's answer matches expected, ignoring case and diacritics."""
    u = _strip_diacritics(user.strip().lower())
    e = _strip_diacritics(expected.strip().lower())
    return u == e


def load_chapter(n: int) -> dict:
    path = DATA_DIR / f"chapter{n}.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def run_flashcards(chapter: dict):
    """Show English word, user types Polish, answer is checked."""
    items = []
    for section in chapter["vocabulary"]:
        items.extend(section["items"])

    print(f"\n=== Chapter {chapter['chapter']}: {chapter['topic']} — Flashcards ===")
    print("Type the Polish word. You can skip diacritics (e.g. 'zolty' counts as 'żółty').")
    print("Type '?' to reveal the answer without penalty. Press Ctrl-C to quit.\n")

    random.shuffle(items)
    correct = 0
    skipped = 0

    for i, item in enumerate(items, 1):
        print(f"[{i}/{len(items)}] {item['english']}")
        try:
            user = input("  Your answer: ").strip()
        except KeyboardInterrupt:
            print("\nStopped early.")
            break

        if user == "?":
            print(f"  Answer: {item['polish']}  /{item['pronunciation']}/")
            skipped += 1
        elif _match(user, item["polish"]):
            print(f"  ✓ Correct! ({item['polish']})  /{item['pronunciation']}/")
            correct += 1
        else:
            print(f"  ✗ Answer: {item['polish']}  /{item['pronunciation']}/")
        print()

    done = correct + (len(items) - i + (0 if user else 0))
    answered = i - skipped
    print(f"Result: {correct}/{answered} correct  ({skipped} skipped)")


def run_fill_in(chapter: dict):
    exercises = [e for e in chapter["exercises"] if e["type"] == "fill_in_the_blank"]
    if not exercises:
        print("No fill-in-the-blank exercises in this chapter.")
        return

    print(f"\n=== Chapter {chapter['chapter']}: {chapter['topic']} — Fill in the blank ===")
    print("You can skip diacritics (e.g. 'piecc' counts as 'pięć').\n")

    correct = 0
    total = 0

    for ex in exercises:
        print(f"Exercise {ex['id']}: {ex['title']}")
        for q in ex["questions"]:
            total += 1
            print(f"\n  {q['question']}")
            user = input("  Your answer: ").strip()
            if _match(user, q["answer"]):
                print(f"  ✓ Correct! ({q['answer']})")
                correct += 1
            else:
                print(f"  ✗ Answer: {q['answer']}")
                if "note" in q:
                    print(f"    Note: {q['note']}")
        print()

    print(f"Result: {correct}/{total} correct")


def run_multiple_choice(chapter: dict):
    exercises = [e for e in chapter["exercises"] if e["type"] == "multiple_choice"]
    if not exercises:
        print("No multiple-choice exercises in this chapter.")
        return

    print(f"\n=== Chapter {chapter['chapter']}: {chapter['topic']} — Multiple Choice ===\n")

    correct = 0
    total = 0

    for ex in exercises:
        print(f"Exercise {ex['id']}: {ex['title']}")
        for q in ex["questions"]:
            total += 1
            print(f"\n  {q['question']}")
            options = list(q["options"])
            random.shuffle(options)
            for j, opt in enumerate(options, 1):
                print(f"    {j}. {opt}")
            choice = input("  Your choice (number): ").strip()
            try:
                chosen = options[int(choice) - 1]
            except (ValueError, IndexError):
                chosen = ""
            if chosen == q["answer"]:
                print("  ✓ Correct!")
                correct += 1
            else:
                print(f"  ✗ Answer: {q['answer']}")
                if "note" in q:
                    print(f"    Note: {q['note']}")
        print()

    print(f"Result: {correct}/{total} correct")


def run_short_answer(chapter: dict):
    exercises = [e for e in chapter["exercises"] if e["type"] == "short_answer"]
    if not exercises:
        print("No short-answer exercises in this chapter.")
        return

    print(f"\n=== Chapter {chapter['chapter']}: {chapter['topic']} — Short Answer ===\n")

    correct = 0
    total = 0

    for ex in exercises:
        print(f"Exercise {ex['id']}: {ex['title']}")
        for q in ex["questions"]:
            total += 1
            print(f"\n  {q['question']}")
            user = input("  Your answer: ").strip().lower()
            expected = q["answer"].lower()
            # Accept if the key answer is contained in the user's answer or vice versa
            if user == expected or expected in user or user in expected:
                print(f"  ✓ Correct! ({q['answer']})")
                correct += 1
            else:
                print(f"  ✗ Answer: {q['answer']}")
                if "note" in q:
                    print(f"    Note: {q['note']}")
        print()

    print(f"Result: {correct}/{total} correct")


MODES = {
    "1": ("Flashcards — type the Polish word", run_flashcards),
    "2": ("Fill in the blank", run_fill_in),
    "3": ("Multiple choice", run_multiple_choice),
    "4": ("Short answer (grammar facts)", run_short_answer),
}


def main():
    chapter_num = 1
    if len(sys.argv) > 1:
        try:
            chapter_num = int(sys.argv[1])
        except ValueError:
            pass

    try:
        chapter = load_chapter(chapter_num)
    except FileNotFoundError:
        print(f"No data found for chapter {chapter_num}.")
        sys.exit(1)

    print(f"\nPolish Practice — Chapter {chapter['chapter']}: {chapter['topic']}")
    print("=" * 50)
    for key, (label, _) in MODES.items():
        print(f"  {key}. {label}")
    print("  q. Quit")

    choice = input("\nChoose a mode: ").strip().lower()
    if choice == "q":
        return
    if choice in MODES:
        MODES[choice][1](chapter)
    else:
        print("Invalid choice.")


if __name__ == "__main__":
    main()
