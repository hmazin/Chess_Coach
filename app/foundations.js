(async () => {
  if (location.protocol === "file:" || !new URLSearchParams(location.search).has("foundations")) return;

  const root = document.getElementById("chess-coach");
  const get = selector => root.querySelector(selector);
  const select = get("[data-foundations-select]");
  const progress = get("[data-foundations-progress]");
  const guide = get("[data-foundations-guide]");
  const choices = get("[data-foundations-answers]");
  const feedback = get("[data-foundations-feedback]");
  const reveal = get("[data-foundations-reveal]");
  const back = get("[data-foundations-back]");
  const next = get("[data-foundations-next]");
  const practice = get("[data-foundations-practice]");
  const title = get("[data-opening-title]");
  const question = get("[data-board-question]");
  const storageKey = "chess-coach:v1:foundations:";

  for (const selector of ["[data-trainer-setup]", "[data-explore-entry]", "[data-coach-panel]"]) {
    get(selector).hidden = true;
  }
  get("[data-foundations-setup]").hidden = false;
  title.textContent = "Blitz fundamentals";
  title.tabIndex = -1;

  let Chess, syllabus, lineLabel, playCoordinate;
  try {
    [{Chess}, {syllabus}, {lineLabel, playCoordinate}] = await Promise.all([
      import("./vendor/chess.js"), import("./foundations-lessons.js"), import("./chess-lines.js"),
    ]);
  } catch {
    progress.textContent = "The lessons could not load. Open Chess Coach while connected and try again.";
    return;
  }

  const board = new ChessCoachBoard(get("[data-board]"), get("[data-board-arrows]"), choose);
  const results = new Map();
  for (const unit of syllabus) {
    try {
      results.set(unit.id, JSON.parse(localStorage.getItem(storageKey + unit.id)));
    } catch {
      // Lesson results are still available while this page is open.
    }
  }
  select.replaceChildren(...syllabus.map(unit => new Option(unit.name, unit.id)));
  guide.hidden = false;
  question.hidden = false;

  let unit, step, game, initialLast, currentIndex, selected, attempted, resolved, completed, grades;

  function start(nextUnit) {
    unit = nextUnit;
    select.value = unit.id;
    currentIndex = 0;
    completed = false;
    grades = new Map();
    loadStep();
  }

  function loadStep() {
    step = unit.steps[currentIndex];
    if (step.check === "transfer" && (results.get(unit.id)?.attempts ?? 0) % 2) step = unit.alternate;
    game = new Chess(step.fen);
    const history = (step.setup ?? []).map(move => game.move(move, {strict: true}));
    initialLast = history.at(-1) ?? step.previousMove;
    selected = "";
    attempted = false;
    resolved = Boolean(step.show);
    question.textContent = step.prompt;
    feedback.textContent = step.show ? step.explanation : "";
    choices.replaceChildren(...(step.options ?? []).map(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lesson-choice";
      button.textContent = option.label;
      button.addEventListener("click", () => {
        if (resolved) return;
        answer(Boolean(option.correct), option.feedback, option.line);
        button.classList.add(option.correct ? "is-correct" : "is-incorrect");
      });
      return button;
    }));
    render();
  }

  function render() {
    title.textContent = unit.name;
    const ready = [...results.values()].filter(result => result?.outcome === "ready").length;
    progress.textContent = ready + " of " + syllabus.length + " lessons passed the independent check";
    for (const option of select.options) {
      const lesson = syllabus.find(item => item.id === option.value);
      const result = results.get(lesson.id)?.outcome;
      option.textContent = lesson.name + (result === "ready" ? " · Passed" : result === "review" ? " · Review" : "");
    }
    const interactive = !resolved && (step.move || step.square);
    const trail = game.history({verbose: true});
    const frame = chessBoardFrame(game, trail.at(-1) ?? initialLast, selected);
    board.render(frame, {
      side: step.side ?? (step.fen.split(" ")[1] === "w" ? "White" : "Black"),
      selected, disabled: !interactive,
      focus: resolved ? step.focus : undefined,
      arrows: resolved ? step.arrows : undefined,
    });
    get("[data-turn]").textContent = completed ? "Lesson complete" : step.title;
    get("[data-step]").textContent = completed ? "" : "Step " + (currentIndex + 1) + " of " + unit.steps.length;
    get("[data-board-instructions]").textContent = completed ? "" : lineLabel(trail);
    choices.hidden = completed || !step.options;
    for (const button of choices.children) button.setAttribute("aria-disabled", String(resolved));
    reveal.hidden = resolved;
    back.hidden = completed || currentIndex === 0;
    next.disabled = !resolved;
    next.textContent = completed ? completionAction() : currentIndex + 1 === unit.steps.length ? "Finish lesson" : "Next step";
    practice.hidden = !completed;
    practice.href = "?drills&position=" + encodeURIComponent(unit.practice);
  }

  function mark(correct) {
    if (!attempted && step.check && !grades.has(step.check)) grades.set(step.check, correct);
    attempted = true;
  }

  function answer(correct, message, line) {
    mark(correct);
    selected = "";
    if (correct) {
      resolved = true;
      for (const san of line ?? []) game.move(san, {strict: true});
    }
    feedback.textContent = message || step.explanation;
    render();
  }

  function choose(square) {
    if (resolved) return;
    if (step.square) {
      answer(square === step.square, square === step.square ? step.explanation : step.retry);
      return;
    }
    if (!step.move) return;
    if (game.get(square)?.color === game.turn()) {
      selected = selected === square ? "" : square;
      render();
      return;
    }
    if (!selected) return;
    const move = game.moves({square: selected, verbose: true}).find(candidate => candidate.to === square);
    if (!move) {
      selected = "";
      render();
      return;
    }
    if (move.san === step.move) {
      playCoordinate(game, move.lan);
      answer(true, step.explanation);
    } else answer(false, step.retry);
  }

  function finish() {
    completed = true;
    const passed = grades.get("transfer") === true;
    const result = {outcome: passed ? "ready" : "review", attempts: (results.get(unit.id)?.attempts ?? 0) + 1};
    results.set(unit.id, result);
    try {
      localStorage.setItem(storageKey + unit.id, JSON.stringify(result));
    } catch {
      // Keep the result in this session.
    }
    question.textContent = unit.habit;
    const baseline = grades.get("baseline") ? "You saw the opening example on your first try." : "You needed another look at the opening example.";
    const transfer = passed ? "You solved the independent check on your first try." : "Review the example, then try the lesson again with a different final position.";
    feedback.textContent = baseline + " " + transfer;
    render();
  }

  function completionAction() {
    return results.get(unit.id)?.outcome === "ready" && syllabus.indexOf(unit) + 1 < syllabus.length ? "Next lesson" : "Repeat lesson";
  }

  next.addEventListener("click", () => {
    if (completed) {
      start(completionAction() === "Next lesson" ? syllabus[syllabus.indexOf(unit) + 1] : unit);
    } else if (currentIndex + 1 === unit.steps.length) {
      finish();
    } else {
      currentIndex++;
      loadStep();
    }
    title.focus();
  });
  back.addEventListener("click", () => {
    if (completed || currentIndex === 0) return;
    currentIndex--;
    loadStep();
    title.focus();
  });
  reveal.addEventListener("click", () => {
    mark(false);
    const worked = step.options?.find(option => option.correct);
    answer(true, worked?.feedback ?? step.explanation, worked?.line ?? (step.move ? [step.move] : []));
  });
  select.addEventListener("change", () => start(syllabus.find(unit => unit.id === select.value)));
  start(syllabus.find(lesson => results.get(lesson.id)?.outcome !== "ready") ?? syllabus[0]);
})();
