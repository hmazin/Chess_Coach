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
    board = chess.Board()
    for san in opening["setup"].split():
        board.push_san(san)

    frames = []
    for san in line["moves"].split():
        move = board.parse_san(san)
        if board.turn == side:
            key = opening["id"] + ":" + " ".join(board.fen().split()[:4])
            if recommendations.setdefault(key, move) != move:
                raise ValueError(f"Conflicting replies for {opening['name']} at {board.fen()}")
            if len(frames) >= len(line["notes"]):
                raise ValueError(f"Missing coaching note in {line['name']}")
            hint, reason = line["notes"][len(frames)]
            frames.append({
                **snapshot(board),
                "position": sha256(key.encode()).hexdigest()[:12],
                "move": move.uci(),
                "san": numbered_san(board, san),
                "hint": hint,
                "reason": reason,
                "legal": [legal.uci() for legal in board.legal_moves],
            })
        elif frames:
            frames[-1]["reply"] = numbered_san(board, san)
        board.push(move)

    study_from = line.get("studyFrom", 0)
    if len(frames) != len(line["notes"]) or not 0 <= study_from < len(frames):
        raise ValueError(f"Invalid practice steps in {line['name']}")
    if board.turn == side:
        raise ValueError(f"{line['name']} must end with the student's move")
    frames.append(snapshot(board))
    return {"name": line["name"], "studyFrom": study_from, "frames": frames}


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
