(async () => {
  if (location.protocol === "file:" || !new URLSearchParams(location.search).has("drills")) return;

  const root = document.getElementById("chess-coach");
  const get = selector => root.querySelector(selector);
  for (const selector of ["[data-trainer-setup]", "[data-explore-entry]", "[data-ai-coach]", "[data-feedback]", "[data-trainer-actions]"]) {
    get(selector).hidden = true;
  }
  get("[data-drill-setup]").hidden = false;
  const status = get("[data-drill-status]");
  const select = get("[data-drill-select]");
  const timed = get("[data-drill-timed]");
  const question = get("[data-board-question]");
  const title = get("[data-opening-title]");
  const instructions = get("[data-board-instructions]");
  const recommendation = get("[data-drill-recommendation]");
  const feedback = get("[data-drill-feedback]");
  const advice = get("[data-drill-advice]");
  const sourceLink = get("[data-drill-source]");
  const promotion = get("[data-drill-promotion]");
  const hint = get("[data-drill-hint]");
  const solution = get("[data-drill-solution]");
  const original = get("[data-drill-original]");
  const retry = get("[data-drill-retry]");
  const next = get("[data-drill-next]");
  const clock = get("[data-drill-clock]");
  const replay = get("[data-drill-replay]");
  const back = get("[data-drill-back]");
  const forward = get("[data-drill-forward]");
  const startClock = get("[data-drill-start]");
  const importedStatus = get("[data-drill-import-status]");
  const remove = get("[data-drill-remove]");
  const prefix = "chess-coach:v1:drill:";
  const importedKey = "imported-pgn";
  const localFallback = new Map();
  const increment = 2_000;

  let Chess, playCoordinate, moveLabel, lineLabel, drillPositions, readPracticePgn, maxDrillFileSize, StudyEngine;
  try {
    [{Chess}, {playCoordinate, moveLabel, lineLabel}, {drillPositions}, {readPracticePgn, maxDrillFileSize}, {StudyEngine}] = await Promise.all([
      import("./vendor/chess.js"), import("./chess-lines.js"), import("./drill-positions.js"), import("./drill-pgn.js"), import("./study-engine.js"),
    ]);
  } catch {
    status.textContent = "Drills could not load. Open Chess Coach while connected and try again.";
    return;
  }

  const board = new ChessCoachBoard(get("[data-board]"), get("[data-board-arrows]"), choose);
  let imported = [];
  let drill, game, state, lines, trap, selected, promotionMoves, assisted, arrows, hinted, engine;
  let replayMoves = [];
  let replayPly = 0;
  let remaining;
  let deadline = null;
  let timer;

  function read(key) {
    if (localFallback.has(key)) return localFallback.get(key);
    try {
      return localStorage.getItem(prefix + key);
    } catch {
      get("[data-storage-warning]").hidden = false;
      return null;
    }
  }

  function write(key, value) {
    try {
      if (value === null) localStorage.removeItem(prefix + key);
      else localStorage.setItem(prefix + key, value);
      localFallback.delete(key);
    } catch {
      get("[data-storage-warning]").hidden = false;
      localFallback.set(key, value);
    }
  }

  function allDrills() {
    return [...drillPositions, ...imported];
  }

  function progress(item) {
    return read("progress:" + item.id);
  }

  function recommended() {
    for (const drills of [imported, drillPositions]) {
      const next = drills.find(item => progress(item) === "review") ?? drills.find(item => !progress(item));
      if (next) return next;
    }
    return imported[0] ?? drillPositions[0];
  }

  function renderSetup() {
    const drills = allDrills();
    const solved = drills.filter(item => progress(item) === "solved").length;
    status.textContent = solved + " of " + drills.length + " solved without help";
    const item = recommended();
    const label = progress(item) === "review" ? "Review next" : solved === drills.length ? "Practice again" : "Recommended next";
    recommendation.textContent = label + " · " + item.title;
    for (const option of select.options) {
      const position = drills.find(item => item.id === option.value);
      const state = progress(position);
      option.textContent = position.title + (state === "solved" ? " · Solved" : state === "review" ? " · Review" : "");
    }
  }

  function fillSelect() {
    const groups = [["Blitz drills", drillPositions], ["My positions", imported]];
    select.replaceChildren(...groups.filter(([, drills]) => drills.length).map(([label, drills]) => {
      const group = document.createElement("optgroup");
      group.label = label;
      group.append(...drills.map(item => new Option(item.title, item.id)));
      return group;
    }));
    remove.hidden = imported.length === 0;
    renderSetup();
  }

  function record(result) {
    write("progress:" + drill.id, result);
    renderSetup();
  }

  function load(item, focus = false) {
    drill = item;
    select.value = item.id;
    timed.checked = Boolean(item.timed);
    reset();
    if (focus) title.focus();
  }

  function readLine(sequence) {
    const copy = new Chess(drill.fen);
    return sequence.map(san => copy.move(san, {strict: true}));
  }

  function stopTimer() {
    clearInterval(timer);
    if (deadline !== null) remaining = Math.max(0, deadline - performance.now());
    deadline = null;
  }

  function reset() {
    engine?.cancel();
    stopTimer();
    remaining = (drill.seconds ?? 10) * 1000;
    game = new Chess(drill.fen);
    lines = drill.lines.map(readLine);
    trap = drill.trap ? readLine(drill.trap.line) : [];
    state = timed.checked ? "ready" : "playing";
    selected = "";
    promotionMoves = [];
    arrows = [];
    assisted = false;
    hinted = false;
    replayMoves = [];
    replayPly = 0;
    title.textContent = drill.title;
    question.textContent = drill.context ?? "What would you play here?";
    startClock.textContent = "Start " + (drill.seconds ?? 10) + "-second clock";
    feedback.textContent = "";
    render();
  }

  function updateClock() {
    if (deadline !== null) remaining = Math.max(0, deadline - performance.now());
    clock.textContent = Math.ceil(remaining / 1000) + "s · +2s";
  }

  function checkTime() {
    updateClock();
    if (deadline === null || remaining > 0) return true;
    stopTimer();
    state = "timeout";
    selected = "";
    promotionMoves = [];
    feedback.textContent = "Time ran out. Try again or compare the checked line.";
    record("review");
    render();
    return false;
  }

  function paint(trail = game.history({verbose: true})) {
    board.render(chessBoardFrame(game, trail.at(-1) ?? drill.previousMove, selected), {
      side: drill.fen.split(" ")[1] === "w" ? "White" : "Black",
      disabled: state !== "playing",
      selected, arrows,
    });
    promotion.hidden = promotionMoves.length === 0;
  }

  function render() {
    const trail = game.history({verbose: true});
    const active = state === "playing";
    const done = state === "solved" || state === "revealed";
    const color = game.turn() === "w" ? "White" : "Black";
    const turnLabels = {
      solved: "Drill complete", alternative: "Sound alternative", missed: "Review the reply",
      timeout: "Time ran out", revealed: "Checked line", checking: "Checking move", ungraded: "Move played",
      original: "Game continuation",
    };
    paint(trail);
    get("[data-turn]").textContent = turnLabels[state] ?? color + " to move";
    instructions.textContent = state === "ready" ? "Start the clock when you are ready." : active ? "Choose a piece, then its destination." : "";
    get("[data-moves]").textContent = lineLabel(trail) || "Starting position";
    get("[data-drill-clock-controls]").hidden = !timed.checked;
    startClock.hidden = state !== "ready";
    hint.hidden = !active;
    hint.textContent = hinted ? "Show move hint" : "Hint";
    solution.hidden = done || state === "checking";
    solution.textContent = state === "alternative" || state === "original" ? "Compare checked line" : "Show checked line";
    retry.hidden = state === "ready" || (active && !trail.length && !assisted);
    next.hidden = active || state === "ready" || state === "checking";
    const reviewed = done || ["alternative", "missed", "original"].includes(state);
    original.hidden = !drill.gameLine || !reviewed || state === "original";
    advice.hidden = !drill.advice || !reviewed;
    advice.textContent = [state !== "original" && drill.gameNote, drill.advice].filter(Boolean).join(" ");
    sourceLink.hidden = !drill.source || !reviewed;
    if (drill.source) sourceLink.href = drill.source;
    replay.hidden = !replayMoves.length;
    back.disabled = replayPly === 0;
    forward.disabled = replayPly === replayMoves.length;
    get("[data-drill-ply]").textContent = replayPly + " of " + replayMoves.length + " half-moves";
    updateClock();
  }

  function choose(square) {
    if (state !== "playing" || !checkTime()) return;
    const piece = game.get(square);
    promotionMoves = [];
    if (piece?.color === game.turn()) {
      selected = selected === square ? "" : square;
    } else if (selected) {
      const moves = game.moves({square: selected, verbose: true}).filter(move => move.to === square);
      if (moves.length === 1) {
        play(moves[0]);
        return;
      }
      promotionMoves = moves;
      if (!moves.length) selected = "";
    }
    paint();
  }

  function play(move) {
    if (state !== "playing" || !checkTime()) return;
    if (deadline !== null) deadline += increment;
    const index = game.history().length;
    const matches = lines.filter(line => line[index]?.lan === move.lan);
    selected = "";
    promotionMoves = [];
    arrows = [];
    hinted = false;
    if (!matches.length) {
      if (index === 0 && trap[0]?.lan === move.lan) {
        stopTimer();
        state = "missed";
        feedback.textContent = drill.trap.explanation;
        record("review");
        showReplay(trap, 2);
      } else {
        checkAlternative(move);
      }
      render();
      return;
    }

    lines = matches;
    const line = lines[0];
    playCoordinate(game, move.lan);
    const reply = line[index + 1];
    if (reply) playCoordinate(game, reply.lan);
    if (line.length > index + 2) {
      feedback.textContent = moveLabel(reply) + ". " + (drill.followUp ?? "Find your next move.");
    } else {
      stopTimer();
      state = "solved";
      feedback.textContent = drill.explanation;
      record(assisted ? "review" : "solved");
      showReplay(game.history({verbose: true}));
    }
    render();
  }

  function finishUnverified() {
    if (state !== "checking") return;
    state = "ungraded";
    feedback.textContent = "Stockfish couldn't finish checking your move. You can still compare the checked line.";
    render();
  }

  function checkAlternative(move) {
    const moves = game.history({verbose: true}).map(move => move.lan);
    const position = game;
    const fen = drill.fen;
    playCoordinate(game, move.lan);
    stopTimer();
    state = "checking";
    feedback.textContent = "Checking " + moveLabel(move) + " with Stockfish on this device…";
    try {
      engine ??= new StudyEngine(finishUnverified);
    } catch {
      finishUnverified();
      return;
    }
    if (engine.failed) {
      finishUnverified();
      return;
    }
    engine.analyze(moves, ([best, ...others]) => {
      if (game !== position || state !== "checking") return;
      if (!best) {
        finishUnverified();
        return;
      }
      const found = [best, ...others].find(line => line.moves[0] === move.lan);
      if (found) finishAlternative(move, best, found);
      else engine.analyze(moves, ([candidate]) => {
        if (game !== position || state !== "checking") return;
        if (candidate?.moves[0] === move.lan) finishAlternative(move, best, candidate);
        else finishUnverified();
      }, {fen, candidate: move.lan});
    }, {fen});
  }

  function finishAlternative(move, best, candidate) {
    const mateValue = line => line.type === "mate" ? Math.sign(line.score) * (10000 - Math.abs(line.score)) : line.score;
    const top = mateValue(best);
    const played = mateValue(candidate);
    const sound = top - played <= 80 || (top >= 300 && played >= 300);
    const reply = candidate.moves[1] ? playCoordinate(game, candidate.moves[1]) : null;
    const bestMove = playCoordinate(new Chess(move.before), best.moves[0]);
    const consequence = !reply ? "" : reply.captured
      ? " With " + moveLabel(reply) + ", your opponent takes your " + chessPieceNames[reply.captured] + " on " + reply.to + "."
      : " One strong reply is " + moveLabel(reply) + ".";
    state = sound ? "alternative" : "missed";
    feedback.textContent = sound
      ? moveLabel(move) + " also works in Stockfish's short search." + consequence
      : moveLabel(move) + " gives up ground in Stockfish's short search." +
        consequence + " It prefers " + moveLabel(bestMove) + ".";
    record(sound && !assisted ? "solved" : "review");
    showReplay(game.history({verbose: true}));
    render();
  }

  function showReplay(moves, ply = moves.length) {
    replayMoves = moves.map(move => move.lan);
    seekReplay(ply);
  }

  function seekReplay(ply) {
    replayPly = Math.max(0, Math.min(ply, replayMoves.length));
    game = new Chess(drill.fen);
    for (const move of replayMoves.slice(0, replayPly)) playCoordinate(game, move);
  }

  for (const [button, step] of [[back, -1], [forward, 1]]) {
    button.addEventListener("click", () => {
      seekReplay(replayPly + step);
      render();
    });
  }

  startClock.addEventListener("click", () => {
    if (state !== "ready") return;
    state = "playing";
    deadline = performance.now() + remaining;
    timer = setInterval(checkTime, 100);
    render();
    get("[data-board] button").focus();
  });
  hint.addEventListener("click", () => {
    if (!checkTime()) return;
    assisted = true;
    record("review");
    const index = game.history().length;
    const cue = index === 0 ? drill.hint : drill.followUp;
    if (hinted || !cue) {
      const move = lines[0][index];
      arrows = [[move.from, move.to, "idea"]];
      feedback.textContent = "Look at the piece on " + move.from + ".";
    } else feedback.textContent = cue;
    hinted = true;
    render();
  });
  solution.addEventListener("click", () => {
    stopTimer();
    const compared = state === "alternative" || state === "original";
    const finalLine = state === "original" ? readLine(drill.lines[0]) : lines[0];
    state = "revealed";
    selected = "";
    promotionMoves = [];
    arrows = [];
    feedback.textContent = lineLabel(finalLine) + ". " + drill.explanation;
    if (!compared) record("review");
    showReplay(finalLine, 1);
    render();
  });
  original.addEventListener("click", () => {
    state = "original";
    feedback.textContent = drill.gameNote;
    showReplay(readLine(drill.gameLine), 2);
    render();
  });
  retry.addEventListener("click", reset);
  next.addEventListener("click", () => {
    const drills = allDrills();
    load(drills[(drills.indexOf(drill) + 1) % drills.length], true);
  });
  select.addEventListener("change", () => load(allDrills().find(item => item.id === select.value)));
  timed.addEventListener("change", reset);
  get("[data-drill-recommended]").addEventListener("click", () => load(recommended(), true));
  for (const button of promotion.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      const move = promotionMoves.find(move => move.promotion === button.dataset.promotion);
      if (move) play(move);
    });
  }

  function replaceImport(drills, source) {
    for (const item of imported) {
      if (!drills.some(next => next.id === item.id)) write("progress:" + item.id, null);
    }
    imported = drills;
    write(importedKey, source);
    fillSelect();
  }

  const fileInput = get("[data-drill-file]");
  fileInput.addEventListener("change", async () => {
    const [file] = fileInput.files;
    if (!file) return;
    fileInput.disabled = true;
    remove.disabled = true;
    try {
      if (file.size > maxDrillFileSize) throw new Error("Use a practice PGN under 100 KB.");
      const source = await file.text();
      const drills = readPracticePgn(source);
      replaceImport(drills, source);
      load(drills[0]);
      importedStatus.textContent = "Imported " + drills.length + (drills.length === 1 ? " position." : " positions.");
    } catch (error) {
      importedStatus.textContent = error.message;
    } finally {
      fileInput.value = "";
      fileInput.disabled = false;
      remove.disabled = false;
    }
  });
  remove.addEventListener("click", () => {
    replaceImport([], null);
    load(recommended());
    importedStatus.textContent = "Imported positions removed.";
  });
  const saved = read(importedKey);
  if (saved) {
    try {
      imported = readPracticePgn(saved);
    } catch (error) {
      importedStatus.textContent = error.message;
      remove.hidden = false;
    }
  }
  title.tabIndex = -1;
  question.hidden = false;
  get("[data-drill-guide]").hidden = false;
  fillSelect();
  remove.hidden = !saved;
  load(recommended());
})();
