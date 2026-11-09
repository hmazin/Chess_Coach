import { Chess } from "chess.js";
import { lineLabel, moveLabel, playCoordinate } from "../app/chess-lines.js";

const names = {k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn"};
const colorName = color => color === "w" ? "White" : "Black";

function facts(game, move) {
  const attacks = [];
  const supports = [];
  for (const piece of game.board().flat().filter(Boolean)) {
    if (!game.attackers(piece.square, move.color).includes(move.to)) continue;
    const target = colorName(piece.color) + " " + names[piece.type] + " on " + piece.square;
    (piece.color === move.color ? supports : attacks).push(target);
  }
  return [
    colorName(move.color) + " " + names[move.piece] + " moves from " + move.from + " to " + move.to,
    move.captured ? "captures a " + names[move.captured] : "",
    game.isCheck() ? "gives check" : "",
    attacks.length ? "from its new square it attacks " + attacks.join(", ") : "",
    supports.length ? "from its new square it covers " + supports.join(", ") : "",
  ].filter(Boolean).join("; ");
}

function openedAttacks(game, move) {
  const previous = new Chess(move.before);
  return game.board().flat().filter(piece => piece && ["q", "r", "k"].includes(piece.type) &&
    previous.get(piece.square)?.type === piece.type && previous.get(piece.square)?.color === piece.color)
    .flatMap(piece => {
      const enemy = piece.color === "w" ? "b" : "w";
      const prior = previous.attackers(piece.square, enemy);
      return game.attackers(piece.square, enemy).filter(square => !prior.includes(square)).map(square =>
        colorName(enemy) + " " + names[game.get(square).type] + " on " + square + " now attacks the " +
        colorName(piece.color) + " " + names[piece.type] + " on " + piece.square);
    });
}

function searchLines(fen, examples) {
  if (!Array.isArray(examples) || examples.length > 3) throw new Error("Invalid study lines.");
  return examples.map(info => {
    if (!info || !["cp", "mate"].includes(info.type) || !Number.isInteger(info.depth) ||
        info.depth < 1 || info.depth > 100 || !Number.isInteger(info.score) || Math.abs(info.score) > 100000 ||
        !Array.isArray(info.moves) || !info.moves.length || info.moves.length > 8) {
      throw new Error("Invalid engine analysis.");
    }
    const board = new Chess(fen);
    const side = colorName(board.turn());
    const moves = info.moves.map(uci => playCoordinate(board, uci));
    const first = new Chess(moves[0].after);
    const line = lineLabel(moves);
    const score = info.type === "cp" ? info.score + " centipawns" : "mate " + info.score;
    const captures = moves.filter(move => move.captured).map(move =>
      moveLabel(move) + " removes " + colorName(move.color === "w" ? "b" : "w") + "'s " + names[move.captured]);
    return {line, context: line + " · " + facts(first, moves[0]) +
      " (depth " + info.depth + ", " + score + " from " + side + "'s perspective)." +
      (captures.length ? " Captures in this line: " + captures.join("; ") + "." : "")};
  });
}

export function exploreContext({moves, lines = [], before = []}) {
  if (!Array.isArray(moves) || moves.length > 256) throw new Error("Invalid study position.");
  const game = new Chess();
  const played = moves.map(uci => playCoordinate(game, uci));
  const last = played.at(-1);
  const afterLines = searchLines(game.fen(), lines);
  const beforeLines = last ? searchLines(last.before, before) : [];
  const opened = last ? openedAttacks(game, last) : [];
  const pieces = game.board().flat().filter(Boolean);
  return {
    context: [
      "The player is exploring both sides of a study position.",
      "Game moves: " + (lineLabel(played.slice(-24)) || "Starting position") + ".",
      colorName(game.turn()) + " to move. Legal replies: " + (game.moves().join(", ") || "none") + ".",
      ...["w", "b"].map(color => colorName(color) + ": " + pieces.filter(piece => piece.color === color)
        .map(piece => piece.type.toUpperCase() + piece.square).join(" ") + "."),
      last ? "Move being studied: " + moveLabel(last) + ". " + facts(game, last) + "." : "",
      opened.length ? "New attacks after the move: " + opened.join("; ") + "." : "",
      beforeLines.length ? "Stockfish options before that move, best first:\n" + beforeLines.map(info => info.context).join("\n") : "",
      afterLines.length ? "Stockfish options in the current position, best first:\n" + afterLines.map(info => info.context).join("\n") :
        "No browser engine lines are available for this position. Explain board facts and avoid claiming an engine recommendation.",
    ].filter(Boolean).join("\n"),
    checked: [...new Set([afterLines[0]?.line, beforeLines[0]?.line, afterLines[1]?.line])].filter(Boolean),
  };
}
