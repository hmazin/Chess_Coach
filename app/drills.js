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
  const promotion = get("[data-drill-promotion]");
  const hint = get("[data-drill-hint]");
  const solution = get("[data-drill-solution]");
  const retry = get("[data-drill-retry]");
  const next = get("[data-drill-next]");
  const clock = get("[data-drill-clock]");
  const startClock = get("[data-drill-start]");
  const importedStatus = get("[data-drill-import-status]");
  const remove = get("[data-drill-remove]");
  const prefix = "chess-coach:v1:drill:";
  const importedKey = "imported-pgn";
  const localFallback = new Map();
  const initialTime = 10_000;
  const increment = 2_000;

  let Chess, playCoordinate, moveLabel, lineLabel, drillPositions, readPracticePgn, maxDrillFileSize;
  try {
    [{Chess}, {playCoordinate, moveLabel, lineLabel}, {drillPositions}, {readPracticePgn, maxDrillFileSize}] = await Promise.all([
      import("./vendor/chess.js"), import("./chess-lines.js"), import("./drill-positions.js"), import("./drill-pgn.js"),
    ]);
  } catch {
    status.textContent = "Drills could not load. Open Chess Coach while connected and try again.";
    return;
  }

  const board = new ChessCoachBoard(get("[data-board]"), get("[data-board-arrows]"), choose);
  let imported = [];
  let drill, game, state, lines, trap, selected, promotionMoves, assisted, arrows;
  let deadline = null;
  let timer;
  let remaining = initialTime;

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

  function stopTimer() {
    clearInterval(timer);
    if (deadline !== null) remaining = Math.max(0, deadline - performance.now());
    deadline = null;
  }

  function reset() {
    stopTimer();
    remaining = initialTime;
    game = new Chess(drill.fen);
    const toMoves = sequence => {
      const copy = new Chess(drill.fen);
      return sequence.map(san => copy.move(san, {strict: true}));
    };
    lines = drill.lines.map(toMoves);
    trap = drill.trap ? toMoves(drill.trap.line) : [];
    state = timed.checked ? "ready" : "playing";
    selected = "";
    promotionMoves = [];
    arrows = [];
    assisted = false;
    title.textContent = drill.title;
    question.textContent = drill.prompt;
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
    feedback.textContent = "Time ran out. Try again or replay the solution.";
    record("review");
    render();
    return false;
  }

  function paint(trail = game.history({verbose: true})) {
    board.render(chessBoardFrame(game, trail.at(-1), selected), {
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
    const turnLabels = {solved: "Drill complete", missed: "Review the reply", timeout: "Time ran out", revealed: "Solution"};
    paint(trail);
    get("[data-turn]").textContent = turnLabels[state] ?? color + " to move";
    instructions.textContent = state === "ready" ? "Start the clock when you are ready." : active ? "Choose a piece, then its destination." : "";
    get("[data-moves]").textContent = lineLabel(trail) || "Starting position";
    get("[data-drill-clock-controls]").hidden = !timed.checked;
    startClock.hidden = state !== "ready";
    hint.hidden = !active;
    solution.hidden = done;
    retry.hidden = state === "ready" || (active && !trail.length && !assisted);
    next.hidden = active || state === "ready";
    advice.hidden = !drill.advice || state === "ready" || active;
    advice.textContent = drill.advice ?? "";
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
    const index = game.history().length;
    const matches = lines.filter(line => line[index]?.lan === move.lan);
    selected = "";
    promotionMoves = [];
    arrows = [];
    if (!matches.length) {
      assisted = true;
      record("review");
      if (index === 0 && trap[0]?.lan === move.lan) {
        for (const reply of trap) playCoordinate(game, reply.lan);
        stopTimer();
        state = "missed";
        feedback.textContent = drill.trap.explanation;
      } else {
        feedback.textContent = moveLabel(move) + " is outside this drill's solution. Try another move or show the line.";
      }
      render();
      return;
    }

    if (deadline !== null) deadline += increment;
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
    }
    render();
  }

  startClock.addEventListener("click", () => {
    if (state !== "ready") return;
    state = "playing";
    deadline = performance.now() + initialTime;
    timer = setInterval(checkTime, 100);
    render();
    get("[data-board] button").focus();
  });
  hint.addEventListener("click", () => {
    if (!checkTime()) return;
    assisted = true;
    record("review");
    const index = game.history().length;
    const move = lines[0][index];
    arrows = [[move.from, move.to, "idea"]];
    feedback.textContent = "Look at the piece on " + move.from + ". " +
      (index === 0 ? drill.hint ?? "" : drill.followUp ?? "");
    render();
  });
  solution.addEventListener("click", () => {
    stopTimer();
    const finalLine = lines[0];
    game = new Chess(drill.fen);
    for (const move of finalLine) playCoordinate(game, move.lan);
    state = "revealed";
    selected = "";
    promotionMoves = [];
    arrows = [];
    feedback.textContent = lineLabel(finalLine) + ". " + drill.explanation;
    record("review");
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
