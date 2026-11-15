import { Chess } from "./vendor/chess.js";

export const maxDrillFileSize = 100_000;

export function readPracticePgn(source) {
  const games = source.trim().split(/(?=^\[Event\s)/m);
  if (source.length > maxDrillFileSize || games.length > 30) {
    throw new Error("Use a practice PGN under 100 KB with up to 30 positions.");
  }
  const drills = new Map();
  for (const [index, pgn] of games.entries()) {
    const game = new Chess();
    try {
      game.loadPgn(pgn, {strict: true});
    } catch {
      throw new Error("Position " + (index + 1) + " has invalid PGN or an illegal move.");
    }
    const headers = game.getHeaders();
    const trail = game.history({verbose: true});
    if (headers.SetUp !== "1" || !headers.FEN || !trail.length || trail.length > 9) {
      throw new Error("Position " + (index + 1) + " needs a starting FEN and a solution of 1 to 9 half-moves.");
    }
    const fen = trail[0].before;
    const id = "import:" + fen + "|" + trail.map(move => move.lan).join(" ");
    const comments = new Map(game.getComments().map(({fen, comment}) => [fen, comment.slice(0, 500)]));
    drills.set(id, {
      id, fen,
      title: headers.Event?.slice(0, 100) || "Imported position " + (index + 1),
      hint: comments.get(fen),
      lines: [trail.map(move => move.san)],
      explanation: comments.get(trail.at(-1).after) || "Replay the solution and check which squares each move controls.",
    });
  }
  return [...drills.values()];
}
