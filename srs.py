"""SM-2 spaced repetition for Polish vocabulary."""

import json
import random
from datetime import date, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
SRS_FILE = DATA_DIR / "srs.json"


def _today() -> str:
    return date.today().isoformat()


def load_srs() -> dict:
    if SRS_FILE.exists():
        with open(SRS_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_srs(state: dict) -> None:
    with open(SRS_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def card_id(chapter_num: int, section: str, polish: str) -> str:
    return f"{chapter_num}:{section}:{polish}"


def update_card(state: dict, cid: str, correct: bool) -> dict:
    """Apply SM-2 update to a card. Returns updated state dict."""
    card = state.get(cid, {"interval": 1, "ease": 2.5, "reps": 0, "lapses": 0})

    quality = 4 if correct else 1

    if quality < 3:
        # Wrong: reset
        card["interval"] = 1
        card["lapses"] = card.get("lapses", 0) + 1
        card["reps"] = 0
    else:
        reps = card["reps"]
        if reps == 0:
            card["interval"] = 1
        elif reps == 1:
            card["interval"] = 6
        else:
            card["interval"] = round(card["interval"] * card["ease"])
        card["reps"] += 1

    # Adjust ease factor
    card["ease"] = max(1.3, card["ease"] + 0.1 - (5 - quality) * 0.08)

    due = date.today() + timedelta(days=card["interval"])
    card["due"] = due.isoformat()

    state[cid] = card
    return state


def _load_chapter(n: int) -> dict:
    with open(DATA_DIR / f"chapter{n}.json", encoding="utf-8") as f:
        return json.load(f)


MASTERED_REPS = 3      # consecutive correct answers to be considered mastered
UNLOCK_THRESHOLD = 0.9  # chapter mastery required to unlock the next chapter


def chapter_mastery(state: dict, chapter_num: int) -> float:
    """Return fraction of vocab cards in chapter_num that are mastered."""
    ch = _load_chapter(chapter_num)
    total = mastered = 0
    for sec in ch["vocabulary"]:
        for item in sec["items"]:
            cid = card_id(chapter_num, sec["section"], item["polish"])
            total += 1
            card = state.get(cid)
            if card and card.get("reps", 0) >= MASTERED_REPS:
                mastered += 1
    return mastered / total if total else 0.0


def chapter_unlock_info(all_chapters: list[int]) -> dict:
    """Return unlock state for all chapters in a single SRS state load.

    Returns:
        active      – ordered list of unlocked chapter numbers
        frontier    – highest active chapter number
        mastery     – mastery fraction of the frontier chapter
        next_num    – next chapter number to unlock, or None
        masteries   – dict mapping chapter_num -> mastery fraction (active only)
    """
    if not all_chapters:
        return {"active": [], "frontier": None, "mastery": 0.0, "next_num": None, "masteries": {}}

    state = load_srs()
    active = [all_chapters[0]]
    masteries: dict[int, float] = {}

    for i, n in enumerate(all_chapters[:-1]):
        m = chapter_mastery(state, n)
        masteries[n] = m
        if m >= UNLOCK_THRESHOLD:
            active.append(all_chapters[i + 1])
        else:
            break

    frontier = active[-1]
    if frontier not in masteries:
        masteries[frontier] = chapter_mastery(state, frontier)

    idx = all_chapters.index(frontier)
    next_num = all_chapters[idx + 1] if idx + 1 < len(all_chapters) else None

    return {
        "active": active,
        "frontier": frontier,
        "mastery": masteries[frontier],
        "next_num": next_num,
        "masteries": masteries,
    }


def make_answer_chars(answer: str) -> list[dict]:
    """Return a list of {char, gap} dicts for gapped-word rendering.

    ~40% of alphabetic characters are randomly chosen as gaps.  Spaces and
    punctuation are always shown.  At least one letter is always visible.
    """
    letter_indices = [i for i, c in enumerate(answer) if c.isalpha()]
    if not letter_indices:
        return [{"char": c, "gap": False} for c in answer]
    n_gaps = max(1, min(len(letter_indices) - 1, round(len(letter_indices) * 0.4)))
    gap_set = set(random.sample(letter_indices, n_gaps))
    return [{"char": c, "gap": i in gap_set} for i, c in enumerate(answer)]


def get_stats(chapters: list[int]) -> dict:
    """Return progress statistics across all chapters."""
    state = load_srs()
    today = date.today()

    total = not_started = learning = mastered = 0
    forecast = {(today + timedelta(days=i)).isoformat(): 0 for i in range(7)}
    chapter_stats = []

    for n in chapters:
        ch = _load_chapter(n)
        ch_total = ch_not_started = ch_learning = ch_mastered = 0

        for sec in ch["vocabulary"]:
            for item in sec["items"]:
                cid = card_id(n, sec["section"], item["polish"])
                card = state.get(cid)
                total += 1
                ch_total += 1

                if card is None:
                    not_started += 1
                    ch_not_started += 1
                elif card.get("reps", 0) >= MASTERED_REPS:
                    mastered += 1
                    ch_mastered += 1
                    if card.get("due") in forecast:
                        forecast[card["due"]] += 1
                else:
                    learning += 1
                    ch_learning += 1
                    if card.get("due") in forecast:
                        forecast[card["due"]] += 1

        chapter_stats.append({
            "number": n,
            "topic": ch["topic"],
            "total": ch_total,
            "not_started": ch_not_started,
            "learning": ch_learning,
            "mastered": ch_mastered,
        })

    forecast_list = [
        {"date": d, "count": forecast[d], "label": date.fromisoformat(d).strftime("%a")}
        for d in sorted(forecast)
    ]
    max_forecast = max((f["count"] for f in forecast_list), default=1) or 1

    return {
        "total": total,
        "not_started": not_started,
        "learning": learning,
        "mastered": mastered,
        "forecast": forecast_list,
        "max_forecast": max_forecast,
        "chapters": chapter_stats,
    }


def get_due_cards(chapters: list[int], extra_days: int = 0) -> list[dict]:
    """Return list of vocab items due for review.

    extra_days > 0 extends the window beyond today, enabling study-ahead.
    Cards with no SRS record (never seen) are always included.
    """
    state = load_srs()
    cutoff = (date.today() + timedelta(days=extra_days)).isoformat()
    due = []

    for n in chapters:
        ch = _load_chapter(n)
        for sec in ch["vocabulary"]:
            for item in sec["items"]:
                cid = card_id(n, sec["section"], item["polish"])
                card = state.get(cid)
                if card is None or card["due"] <= cutoff:
                    due.append({
                        "type": "flashcard",
                        "prompt": item["english"],
                        "answer": item["polish"],
                        "hint": item["pronunciation"],
                        "section": sec["section"],
                        "card_id": cid,
                    })

    return due
