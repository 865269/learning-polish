#!/usr/bin/env python3
"""Polish practice web app."""

import json
import random
import secrets
from pathlib import Path

from flask import Flask, redirect, render_template, request, session, url_for
import srs as srs_mod

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

DATA_DIR = Path(__file__).parent / "data"

_DIACRITIC_MAP = str.maketrans({
    "ą": "a", "ć": "c", "ę": "e", "ł": "l",
    "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
})


def strip_diacritics(text: str) -> str:
    return text.translate(_DIACRITIC_MAP)


_PUNCT = str.maketrans("", "", "?!.,;:'\"")


def answers_match(user: str, expected: str) -> bool:
    u = strip_diacritics(user.strip().lower()).translate(_PUNCT)
    e = strip_diacritics(expected.strip().lower()).translate(_PUNCT)
    return u == e


def load_chapter(n: int) -> dict:
    with open(DATA_DIR / f"chapter{n}.json", encoding="utf-8") as f:
        return json.load(f)


def available_chapters() -> list[int]:
    return sorted(int(p.stem.replace("chapter", "")) for p in DATA_DIR.glob("chapter*.json"))


def chapter_sections(chapter: dict) -> list[str]:
    return [s["section"] for s in chapter["vocabulary"]]


def build_questions(chapter: dict, mode: str, section: str = "all", max_questions: int = 0) -> list[dict]:
    """Return a flat list of question dicts ready for the session."""
    questions = []

    if mode == "flashcards":
        for sec in chapter["vocabulary"]:
            if section != "all" and sec["section"] != section:
                continue
            for item in sec["items"]:
                questions.append({
                    "type": "flashcard",
                    "prompt": item["english"],
                    "answer": item["polish"],
                    "hint": item["pronunciation"],
                    "section": sec["section"],
                })

    elif mode == "fill_in":
        for ex in chapter["exercises"]:
            if ex["type"] != "fill_in_the_blank":
                continue
            for q in ex["questions"]:
                questions.append({
                    "type": "fill_in",
                    "prompt": q["question"],
                    "answer": q["answer"],
                    "note": q.get("note", ""),
                    "exercise": ex["id"],
                })

    elif mode == "multiple_choice":
        for ex in chapter["exercises"]:
            if ex["type"] != "multiple_choice":
                continue
            for q in ex["questions"]:
                options = list(q["options"])
                random.shuffle(options)
                questions.append({
                    "type": "multiple_choice",
                    "prompt": q["question"],
                    "answer": q["answer"],
                    "options": options,
                    "note": q.get("note", ""),
                    "exercise": ex["id"],
                })

    elif mode == "short_answer":
        for ex in chapter["exercises"]:
            if ex["type"] != "short_answer":
                continue
            for q in ex["questions"]:
                questions.append({
                    "type": "short_answer",
                    "prompt": q["question"],
                    "answer": q["answer"],
                    "note": q.get("note", ""),
                    "exercise": ex["id"],
                })

    random.shuffle(questions)
    if max_questions and max_questions < len(questions):
        questions = questions[:max_questions]
    return questions


def annotate_partial_answers(questions: list[dict], chapter_num: int) -> list[dict]:
    """Add partial_answer to flashcard questions for cards not yet mastered."""
    state = srs_mod.load_srs()
    for q in questions:
        if q["type"] != "flashcard":
            continue
        cid = q.get("card_id") or srs_mod.card_id(chapter_num, q["section"], q["answer"])
        card = state.get(cid)
        reps = card.get("reps", 0) if card else 0
        if reps < srs_mod.MASTERED_REPS:
            q["answer_chars"] = srs_mod.make_answer_chars(q["answer"])
    return questions


def check_answer(question: dict, user_answer: str) -> bool:
    qtype = question["type"]
    expected = question["answer"]

    if qtype in ("flashcard", "fill_in"):
        return answers_match(user_answer, expected)

    elif qtype == "multiple_choice":
        return user_answer.strip() == expected

    elif qtype == "short_answer":
        u = user_answer.strip().lower()
        e = expected.lower()
        return u == e or e in u or u in e

    return False


@app.route("/")
def home():
    chapters = available_chapters()
    chapter_info = []
    sections_by_chapter = {}
    for n in chapters:
        ch = load_chapter(n)
        chapter_info.append({"number": n, "topic": ch["topic"]})
        sections_by_chapter[n] = chapter_sections(ch)

    unlock = srs_mod.chapter_unlock_info(chapters)
    due_count = len(srs_mod.get_due_cards(unlock["active"]))
    upcoming_count = max(0, len(srs_mod.get_due_cards(unlock["active"], extra_days=7)) - due_count)

    frontier_topic = load_chapter(unlock["frontier"])["topic"] if unlock["frontier"] else ""
    next_topic = load_chapter(unlock["next_num"])["topic"] if unlock["next_num"] else ""
    mastery_pct = round(unlock["mastery"] * 100)
    # Progress bar toward unlock threshold (capped at 100)
    unlock_bar_pct = min(100, round(unlock["mastery"] / srs_mod.UNLOCK_THRESHOLD * 100))

    return render_template("home.html",
                           chapters=chapter_info,
                           sections_by_chapter=sections_by_chapter,
                           due_count=due_count,
                           upcoming_count=upcoming_count,
                           frontier_num=unlock["frontier"],
                           frontier_topic=frontier_topic,
                           mastery_pct=mastery_pct,
                           unlock_bar_pct=unlock_bar_pct,
                           next_num=unlock["next_num"],
                           next_topic=next_topic,
                           unlock_threshold_pct=round(srs_mod.UNLOCK_THRESHOLD * 100))


REVIEW_BATCH = 20


@app.route("/stats")
def stats():
    chapters = available_chapters()
    unlock = srs_mod.chapter_unlock_info(chapters)
    data = srs_mod.get_stats(chapters)
    data["active_set"] = set(unlock["active"])
    return render_template("stats.html", **data)


@app.route("/review")
def review():
    chapters = available_chapters()
    unlock = srs_mod.chapter_unlock_info(chapters)
    extra_days = int(request.args.get("ahead", 0))
    questions = srs_mod.get_due_cards(unlock["active"], extra_days=extra_days)
    random.shuffle(questions)
    questions = questions[:REVIEW_BATCH]

    if not questions:
        return redirect(url_for("home"))

    annotate_partial_answers(questions, chapter_num=0)

    session["chapter_num"] = 0
    session["chapter_topic"] = "Spaced Repetition Review"
    session["mode"] = "srs"
    session["questions"] = questions
    session["index"] = 0
    session["score"] = 0
    session["total"] = len(questions)
    return redirect(url_for("question"))


@app.route("/start", methods=["POST"])
def start():
    chapter_num = int(request.form["chapter"])
    mode = request.form["mode"]
    section = request.form.get("section", "all")
    max_questions = int(request.form.get("max_questions", 0) or 0)
    chapter = load_chapter(chapter_num)
    questions = build_questions(chapter, mode, section=section, max_questions=max_questions)

    if not questions:
        return redirect(url_for("home"))

    annotate_partial_answers(questions, chapter_num)

    session["chapter_num"] = chapter_num
    session["chapter_topic"] = chapter["topic"]
    session["mode"] = mode
    session["questions"] = questions
    session["index"] = 0
    session["score"] = 0
    session["total"] = len(questions)
    return redirect(url_for("question"))


@app.route("/question")
def question():
    if "questions" not in session:
        return redirect(url_for("home"))

    idx = session["index"]
    questions = session["questions"]

    if idx >= len(questions):
        return redirect(url_for("results"))

    q = questions[idx]
    return render_template(
        "question.html",
        question=q,
        index=idx,
        total=session["total"],
        score=session["score"],
        chapter_topic=session["chapter_topic"],
        mode=session["mode"],
        feedback=None,
    )


@app.route("/answer", methods=["POST"])
def answer():
    if "questions" not in session:
        return redirect(url_for("home"))

    idx = session["index"]
    questions = session["questions"]
    q = questions[idx]
    user_answer = request.form.get("answer", "")
    correct = check_answer(q, user_answer)

    if correct:
        session["score"] += 1

    # Record SRS result if this is a review session
    if session.get("mode") == "srs" and "card_id" in q:
        state = srs_mod.load_srs()
        state = srs_mod.update_card(state, q["card_id"], correct)
        srs_mod.save_srs(state)

    # Show feedback on same question before advancing
    return render_template(
        "question.html",
        question=q,
        index=idx,
        total=session["total"],
        score=session["score"],
        chapter_topic=session["chapter_topic"],
        mode=session["mode"],
        feedback={"correct": correct, "user_answer": user_answer},
    )


@app.route("/next")
def next_question():
    session["index"] += 1
    if session["index"] >= session["total"]:
        return redirect(url_for("results"))
    return redirect(url_for("question"))


@app.route("/results")
def results():
    if "questions" not in session:
        return redirect(url_for("home"))
    score = session["score"]
    total = session["total"]
    pct = round(score / total * 100) if total else 0
    chapter_topic = session.get("chapter_topic", "")
    mode = session.get("mode", "")
    session.clear()
    return render_template("results.html", score=score, total=total, pct=pct,
                           chapter_topic=chapter_topic, mode=mode)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
