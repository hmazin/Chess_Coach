export function playCoordinate(board, uci) {
  if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new Error("Invalid coordinate move.");
  }
  return board.move({from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4]});
}

export function moveLabel(move) {
  return move.before.split(" ").at(-1) + (move.color === "w" ? "." : "...") + move.san;
}

export function lineLabel(moves) {
  return moves.map((move, index) => index === 0 || move.color === "w" ? moveLabel(move) : move.san).join(" ");
}
