"""Generate the annotated chess positions for concept lessons."""

import json
from pathlib import Path

import chess

from build_repertoire import snapshot


def position(content):
    board = chess.Board()
    for san in content["moves"].split():
        board.push_san(san)
    for square in content.get("focus", []):
        chess.parse_square(square)
    for source, target, style in content.get("arrows", []):
        chess.parse_square(source)
        chess.parse_square(target)
        if source == target or style not in {"idea", "threat"}:
            raise ValueError(f"Invalid arrow from {source} to {target}")
    return snapshot(board)


def build_step(step):
    if "examples" in step:
        if len(step["examples"]) < 2 or "options" in step:
            raise ValueError(f"Invalid comparison in {step['title']}")
        return {
            **step,
            "examples": [{**example, "frame": position(example)} for example in step["examples"]],
        }
    options = step["options"]
    answer = step["answer"]
    if len(options) < 2 or not 0 <= answer < len(options):
        raise ValueError(f"Invalid question in {step['title']}")
    if any(not option.get("feedback") for index, option in enumerate(options) if index != answer):
        raise ValueError(f"Missing feedback in {step['title']}")
    return {**step, "frame": position(step)}


def main():
    directory = Path(__file__).resolve().parent
    lessons = json.loads((directory / "lessons.json").read_text(encoding="utf-8"))
    repertoire = json.loads((directory / "repertoire.json").read_text(encoding="utf-8"))
    practice_lines = {opening["id"]: {line["name"] for line in opening["lines"]} for opening in repertoire}
    ids = set()
    for lesson in lessons:
        if lesson["id"] in ids or lesson["practice"] not in practice_lines.get(lesson["opening"], set()):
            raise ValueError(f"Invalid practice link in {lesson['name']}")
        ids.add(lesson["id"])
        lesson["steps"] = [build_step(step) for step in lesson["steps"]]

    data = json.dumps(lessons, ensure_ascii=True, separators=(",", ":"))
    output = directory.parent / "app" / "lesson-data.js"
    temporary = output.with_suffix(".tmp")
    temporary.write_text(
        "// Generated from opening-practice/lessons.json.\n" + f"const conceptLessons = {data};\n",
        encoding="utf-8",
    )
    temporary.replace(output)
    print(f"Built {len(lessons)} concept lessons.")


if __name__ == "__main__":
    main()
