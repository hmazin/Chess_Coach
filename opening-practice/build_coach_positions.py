"""Prepare legal positions and Stockfish examples for the in-app tutor."""

from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sys

import chess
import chess.engine


def collect_positions(directory):
    repertoire = json.loads((directory / "repertoire.json").read_text(encoding="utf-8"))
    lessons = json.loads((directory / "lessons.json").read_text(encoding="utf-8"))
    positions = {}
    histories = {}

    def remember(board, preferred=None):
        key = " ".join(board.fen().split()[:4])
        histories[chess.Board().variation_san(board.move_stack)] = key
        entry = positions.setdefault(key, {"board": board.copy(), "preferred": None})
        if preferred:
            entry["preferred"] = preferred

    for opening in repertoire:
        side = chess.WHITE if opening["side"] == "White" else chess.BLACK
        setup = chess.Board()
        for san in opening["setup"].split():
            setup.push_san(san)
        for line in opening["lines"]:
            board = setup.copy()
            moves = line["moves"].split()
            for san in moves:
                if board.turn == side:
                    remember(board, board.parse_san(san))
                else:
                    remember(board)
                board.push_san(san)
            remember(board)

    for lesson in lessons:
        for step in lesson["steps"]:
            for example in step.get("examples", [step]):
                board = chess.Board()
                for san in example["moves"].split():
                    board.push_san(san)
                remember(board)

    return positions, histories


def describe(board, move, info):
    piece = board.piece_at(move.from_square)
    captured = board.piece_at(move.to_square)
    after = board.copy(stack=False)
    after.push(move)
    targets = [
        f"{chess.piece_name(target.piece_type)} on {chess.square_name(square)}"
        for square in after.attacks(move.to_square)
        if (target := after.piece_at(square)) and target.color != piece.color
    ]
    facts = [f"{chess.piece_name(piece.piece_type)} moves from {chess.square_name(move.from_square)} to {chess.square_name(move.to_square)}"]
    if captured or board.is_en_passant(move):
        facts.append(f"captures a {chess.piece_name(captured.piece_type) if captured else 'pawn'}")
    if after.is_check():
        facts.append("gives check")
    if targets:
        facts.append("on its new square it attacks " + ", ".join(targets))
    return {
        "san": board.san(move),
        "facts": "; ".join(facts),
        "line": board.variation_san(info["pv"][:5]),
        "score": info["score"].pov(board.turn).score(mate_score=10000),
        "depth": info["depth"],
    }


def analyze(engine_path, entries):
    output = {}
    with chess.engine.SimpleEngine.popen_uci(engine_path) as engine:
        engine.configure({"Threads": 1, "Hash": 32})
        for key, entry in entries:
            board, preferred = entry["board"], entry["preferred"]
            legal = list(board.legal_moves)
            lines = {}
            if legal:
                screen = engine.analyse(board, chess.engine.Limit(depth=8), multipv=len(legal))
                lines = {info["pv"][0].uci(): describe(board, info["pv"][0], info) for info in screen}
                if set(lines) != {move.uci() for move in legal}:
                    raise ValueError(f"Missing legal moves for {board.fen()}")
                main = engine.analyse(board, chess.engine.Limit(nodes=150_000), multipv=min(3, len(legal)))
                top = [info["pv"][0].uci() for info in main]
                for info in main:
                    move = info["pv"][0]
                    lines[move.uci()] = describe(board, move, info)
                if preferred and preferred.uci() not in top:
                    info = engine.analyse(board, chess.engine.Limit(nodes=120_000), root_moves=[preferred])
                    lines[preferred.uci()] = describe(board, preferred, info)
            else:
                top = []
            output[key] = {
                "turn": "White" if board.turn == chess.WHITE else "Black",
                "pieces": {
                    "White" if side else "Black": " ".join(
                        f"{piece.symbol().upper()}{chess.square_name(square)}"
                        for square, piece in sorted(board.piece_map().items()) if piece.color == side
                    )
                    for side in (chess.WHITE, chess.BLACK)
                },
                "preferred": preferred.uci() if preferred else None,
                "top": top,
                "moves": lines,
            }
    return output


def main():
    directory = Path(__file__).resolve().parent
    positions, histories = collect_positions(directory)
    entries = list(positions.items())
    workers = 6
    engine = sys.argv[1]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        completed = list(pool.map(lambda batch: analyze(engine, batch), (entries[i::workers] for i in range(workers))))
    analyses = {key: value for batch in completed for key, value in batch.items()}
    output = directory / "coach-positions.json"
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps({
        "engine": "Stockfish 19",
        "histories": histories,
        "positions": analyses,
    }, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(output)
    print(f"Checked {len(analyses)} positions and {sum(len(entry['moves']) for entry in analyses.values())} legal moves.")


if __name__ == "__main__":
    main()
