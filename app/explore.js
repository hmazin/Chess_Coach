(async () => {
  const params = new URLSearchParams(location.search);
  const selfPlay = params.has("self-play");
  if (location.protocol === "file:" || (!selfPlay && !params.has("explore"))) return;

  const root = document.getElementById("chess-coach");
  const get = selector => root.querySelector(selector);
  const guide = get("[data-explore-guide]");
  const status = get("[data-explore-status]");
  const history = get("[data-moves]");
  const turn = get("[data-turn]");
  const best = get("[data-explore-best]");
  const back = get("[data-explore-back]");
  const flip = get("[data-explore-flip]");
  const reset = get("[data-self-play-reset]");
  const explain = get("[data-explore-explain]");
  const comparison = get("[data-explore-comparison]");
  const options = get("[data-explore-options]");
  const branches = get("[data-explore-branches]");
  const branchButtons = get("[data-explore-branch-buttons]");
  const promotion = get("[data-explore-promotion]");
  const opening = selfPlay ? null : chessRepertoire.find(item => item.id === params.get("opening"));
  let orientation = opening?.side ?? "White";
  let selected = "";
  let promotionMoves = [];
  let engine;
  let engineFailed = false;

  for (const selector of ["[data-trainer-setup]", "[data-explore-entry]", "[data-feedback]", "[data-action]", "[data-learn]"]) {
    get(selector).hidden = true;
  }
  get("[data-explore-setup]").hidden = false;
  guide.hidden = false;
  get("[data-opening-title]").textContent = selfPlay ? "Self-play" : opening?.name ?? "Explore both sides";
  get("[data-board-instructions]").textContent = "Choose a piece and its destination for either side.";
  best.disabled = true;
  if (selfPlay) {
    get("[data-explore-title]").textContent = "Self-play with Stockfish";
    get("[data-explore-description]").textContent = "Play White and Black. The arrow shows Stockfish’s best move for the side to move.";
    best.textContent = "Play best move";
  }

  let Chess, lineLabel, moveLabel, playCoordinate, StudyEngine;
  try {
    [{Chess}, {lineLabel, moveLabel, playCoordinate}, {StudyEngine}] = await Promise.all([
      import("./vendor/chess.js"), import("./chess-lines.js"), import("./study-engine.js"),
    ]);
  } catch {
    status.textContent = "The board could not load. Open Chess Coach while connected and try again.";
    return;
  }

  const game = new Chess();
  const startingPosition = {parent: null, children: new Map(), move: null, lines: null};
  let current = startingPosition;
  try {
    const start = selfPlay ? "" : params.get("explore");
    if (start.length > 500 || !/^[A-Za-z0-9 .+#=-]*$/.test(start)) throw new Error("Invalid starting line.");
    if (start) {
      const seed = new Chess();
      seed.loadPgn(start, {strict: true});
      for (const move of seed.history({verbose: true})) addMove(move.lan);
    }
  } catch {
    status.textContent = "This starting position could not load. Return to the lesson and reopen it.";
    return;
  }
  const board = new ChessCoachBoard(get("[data-board]"), get("[data-board-arrows]"), choose);

  function addMove(uci) {
    const move = playCoordinate(game, uci);
    if (!current.children.has(uci)) {
      current.children.set(uci, {parent: current, children: new Map(), move, lines: null});
    }
    current = current.children.get(uci);
  }

  function play(uci) {
    if (game.isGameOver()) return;
    addMove(uci);
    showPosition();
  }

  function choose(square) {
    const piece = game.get(square);
    if (piece?.color === game.turn()) {
      selected = selected === square ? "" : square;
      promotion.hidden = true;
    } else if (selected) {
      const moves = game.moves({square: selected, verbose: true}).filter(move => move.to === square);
      if (moves.length === 1) {
        play(moves[0].lan);
        return;
      }
      promotionMoves = moves;
      promotion.hidden = !moves.length;
      if (!moves.length) selected = "";
    }
    paint();
  }

  function paint() {
    const recommendation = selfPlay ? current.lines?.[0]?.moves[0] : null;
    const arrows = recommendation ? [[recommendation.slice(0, 2), recommendation.slice(2, 4), "idea"]] : [];
    board.render({
      board: chessSquareOrder.map(square => {
        const piece = game.get(square);
        return !piece ? "." : piece.color === "w" ? piece.type.toUpperCase() : piece.type;
      }).join(""),
      last: current.move ? [current.move.from, current.move.to] : [],
      legal: selected ? game.moves({square: selected, verbose: true}).map(move => move.lan) : [],
    }, {side: orientation, selected, arrows, disabled: game.isGameOver()});
  }

  function publishPosition() {
    const trail = game.history({verbose: true});
    root.dispatchEvent(new CustomEvent("coach-position", {detail: {
      history: lineLabel(trail) || "Starting position",
      exploration: {
        moves: trail.map(move => move.lan),
        lines: current.lines ?? [],
        before: current.parent?.lines ?? [],
      },
    }}));
  }

  function evaluation(info, side) {
    const favored = info.score >= 0 ? side : side === "w" ? "b" : "w";
    const color = favored === "w" ? "White" : "Black";
    if (info.type === "mate") return "mate for " + color + " in " + Math.abs(info.score);
    if (Math.abs(info.score) < 15) return "roughly even";
    return (Math.abs(info.score) / 100).toFixed(1) + " for " + color;
  }

  function moveButton(label, uci, detail) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lesson-choice explore-line";
    const title = document.createElement("span");
    title.textContent = label;
    button.append(title);
    if (detail) {
      const note = document.createElement("span");
      note.className = "secondary";
      note.textContent = detail;
      button.append(note);
    }
    button.addEventListener("click", () => play(uci));
    return button;
  }

  function renderAnalysis() {
    const lines = current.lines ?? [];
    const color = game.turn() === "w" ? "White" : "Black";
    best.disabled = !lines.length;
    explain.hidden = !current.move;
    explain.disabled = !current.lines && !engineFailed && !game.isGameOver();
    options.replaceChildren(...lines.map((info, index) => {
      const copy = new Chess(game.fen());
      const variation = info.moves.map(uci => playCoordinate(copy, uci));
      const recommended = selfPlay && index === 0;
      const button = moveButton((recommended ? "Best for " + color + " · " : "Play ") + moveLabel(variation[0]), info.moves[0],
        evaluation(info, game.turn()) + " · " + lineLabel(variation.slice(0, 5)));
      button.classList.toggle("is-comparison", recommended);
      return button;
    }));
    comparison.hidden = !current.parent?.lines?.length || !lines.length;
    if (!comparison.hidden) {
      const previous = current.parent.lines[0];
      const bestMove = playCoordinate(new Chess(current.move.before), previous.moves[0]);
      comparison.textContent = bestMove.lan === current.move.lan
        ? "Stockfish also chose " + moveLabel(current.move) + "."
        : "Before " + moveLabel(current.move) + ", Stockfish favored " + moveLabel(bestMove) + " (" +
          evaluation(previous, current.move.color) + "). After your move it estimates " + evaluation(lines[0], game.turn()) + ".";
    }
    if (game.isCheckmate()) status.textContent = "Checkmate.";
    else if (game.isDraw()) status.textContent = "Draw.";
    else if (engineFailed) status.textContent = "Stockfish could not load. You can still explore moves or reload while connected.";
    else if (!current.lines) status.textContent = "Stockfish is checking this position…";
    else status.textContent = lines.length ? "Short search · Depth " + lines[0].depth + " · Tap a line to play its first move." : "Stockfish found no line for this position.";
    paint();
    publishPosition();
  }

  function showPosition() {
    selected = "";
    promotion.hidden = true;
    const color = game.turn() === "w" ? "White" : "Black";
    turn.textContent = game.isGameOver() ? "Game over" : color + " to move" + (game.isCheck() ? " · Check" : "");
    history.textContent = lineLabel(game.history({verbose: true})) || "Starting position";
    back.disabled = !current.parent;
    reset.disabled = current === startingPosition && !startingPosition.children.size;
    branches.hidden = current.children.size === 0 || game.isGameOver();
    branchButtons.replaceChildren(...Array.from(current.children, ([uci, node]) => moveButton(moveLabel(node.move), uci)));
    renderAnalysis();
    if (current.lines || game.isGameOver()) {
      engine?.cancel();
      checkBefore();
      return;
    }
    if (engineFailed) return;
    if (!engine) {
      try {
        engine = new StudyEngine(() => {
          engineFailed = true;
          renderAnalysis();
        });
      } catch {
        engineFailed = true;
        renderAnalysis();
        return;
      }
    }
    const position = current;
    engine.analyze(game.history({verbose: true}).map(move => move.lan), lines => {
      position.lines = lines;
      if (current === position) {
        renderAnalysis();
        checkBefore();
      }
    });
  }

  function checkBefore() {
    const position = current;
    if (!engine || engineFailed || !position.parent || position.parent.lines) return;
    const moves = game.history({verbose: true}).slice(0, -1).map(move => move.lan);
    engine.analyze(moves, lines => {
      position.parent.lines = lines;
      if (current === position) renderAnalysis();
    });
  }

  back.addEventListener("click", () => {
    if (!current.parent) return;
    game.undo();
    current = current.parent;
    showPosition();
  });
  best.addEventListener("click", () => {
    if (current.lines?.length) play(current.lines[0].moves[0]);
  });
  flip.addEventListener("click", () => {
    orientation = orientation === "White" ? "Black" : "White";
    paint();
  });
  reset.addEventListener("click", () => {
    game.reset();
    startingPosition.children.clear();
    current = startingPosition;
    showPosition();
  });
  for (const button of promotion.querySelectorAll("[data-promote]")) {
    button.addEventListener("click", () => {
      const move = promotionMoves.find(move => move.promotion === button.dataset.promote);
      if (move) play(move.lan);
    });
  }
  explain.addEventListener("click", () => {
    root.dispatchEvent(new CustomEvent("coach-question", {detail:
      "What is the main consequence of " + moveLabel(current.move) + "? Start with any checked tactic or material loss. Show one concrete reply and, if Stockfish preferred another move, explain what it does differently.",
    }));
  });
  reset.hidden = !selfPlay;
  showPosition();
})();
