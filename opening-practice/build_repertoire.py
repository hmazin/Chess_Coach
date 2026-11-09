"""Build verified positions for the standalone app or the in-chat practice board."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
import re

import chess


def numbered_san(board, san):
    separator = "." if board.turn == chess.WHITE else "..."
    return f"{board.fullmove_number}{separator}{san}"


def snapshot(board):
    placement = "".join(
        piece.symbol() if (piece := board.piece_at(square)) else "."
        for square in chess.SQUARES_180
    )
    last = board.peek().uci()
    return {
        "board": placement,
        "last": [last[:2], last[2:4]],
        "history": chess.Board().variation_san(board.move_stack),
    }


def build_line(opening, line, recommendations):
    side = {"White": chess.WHITE, "Black": chess.BLACK}[opening["side"]]
    study_from = line.get("studyFrom", 0)
    teaching = line["teaching"]
    teach_from = teaching.get("from", study_from)
    reply_notes = teaching["replies"]
    if not 0 <= teach_from < len(line["notes"]) or len(reply_notes) != len(line["notes"]) - teach_from - 1:
        raise ValueError(f"Invalid teaching steps in {line['name']}")
    if not all(isinstance(note, str) and note.strip() for note in [teaching["intro"], *reply_notes]):
        raise ValueError(f"Missing teaching explanation in {line['name']}")
    replies = iter(reply_notes)

    board = chess.Board()
    for san in opening["setup"].split():
        last_san = numbered_san(board, san)
        board.push_san(san)

    frames = []
    steps = []
    for san in line["moves"].split():
        move = board.parse_san(san)
        played_by_student = board.turn == side
        notation = numbered_san(board, san)
        if played_by_student:
            key = opening["id"] + ":" + " ".join(board.fen().split()[:4])
            if recommendations.setdefault(key, move) != move:
                raise ValueError(f"Conflicting replies for {opening['name']} at {board.fen()}")
            if len(frames) >= len(line["notes"]):
                raise ValueError(f"Missing coaching note in {line['name']}")
            hint, reason = line["notes"][len(frames)]
            before = snapshot(board)
            frame = {
                **before,
                "position": sha256(key.encode()).hexdigest()[:12],
                "move": move.uci(),
                "san": notation,
                "hint": hint,
                "reason": reason,
                "legal": [legal.uci() for legal in board.legal_moves],
            }
            if len(frames) == teach_from:
                steps.append({"title": f"After {last_san}", "explanation": teaching["intro"], "frame": before})
            frames.append(frame)
        elif frames:
            frames[-1]["reply"] = notation
        board.push(move)
        if steps:
            actor = "Your move" if played_by_student else "Opponent's reply"
            steps.append({
                "title": f"{actor} · {notation}",
                "explanation": reason if played_by_student else next(replies),
                "frame": snapshot(board),
            })
        last_san = notation

    if len(frames) != len(line["notes"]) or not 0 <= study_from < len(frames):
        raise ValueError(f"Invalid practice steps in {line['name']}")
    if board.turn == side:
        raise ValueError(f"{line['name']} must end with the student's move")
    frames.append(snapshot(board))
    name = line["name"]
    lesson = {
        "id": f"variation:{name}", "name": name, "practice": name,
        "walkthrough": True, "steps": steps,
    }
    return {"name": name, "studyFrom": study_from, "frames": frames, "lesson": lesson}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="App repertoire.js or an existing HTML practice board")
    args = parser.parse_args()
    source = Path(__file__).with_name("repertoire.json")
    repertoire = json.loads(source.read_text(encoding="utf-8"))
    recommendations = {}
    openings = []
    for opening in repertoire:
        openings.append({
            "id": opening["id"],
            "name": opening["name"],
            "side": opening["side"],
            "lines": [build_line(opening, line, recommendations) for line in opening["lines"]],
        })

    data = json.dumps(openings, ensure_ascii=True, separators=(",", ":"))
    if args.output.suffix == ".js":
        markup = "// Generated from opening-practice/repertoire.json.\n"
        markup += f"const chessRepertoire = {data};\n"
    else:
        markup = args.output.read_text(encoding="utf-8")
        markup, replacements = re.subn(
            r"(?m)^      const drills = .+;$",
            lambda _: f"      const drills = {data};",
            markup,
        )
        if replacements != 1:
            raise ValueError("Expected one repertoire declaration in the practice board")
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(markup, encoding="utf-8")
    temporary.replace(args.output)
    print(f"Built {sum(len(opening['lines']) for opening in openings)} variations and "
          f"{len(recommendations)} distinct decisions.")


if __name__ == "__main__":
    main()
