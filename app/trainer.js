(() => {
  const params = new URLSearchParams(location.search);
  if (location.protocol !== "file:" && (params.has("explore") || params.has("self-play"))) return;
  const root = document.getElementById("chess-coach");
  if (location.protocol === "file:") {
    root.querySelector("[data-self-play-link]").href = "https://hmazin-chess-coach.vercel.app/?self-play";
  }
  const openingSelect = root.querySelector("[data-opening]");
  const mode = root.querySelector("[data-mode]");
  const lineControl = root.querySelector("[data-line-control]");
  const lineLabel = root.querySelector("[data-line-label]");
  const lineSelect = root.querySelector("[data-line]");
  const board = new ChessCoachBoard(root.querySelector("[data-board]"), root.querySelector("[data-board-arrows]"), choose);
  const boardQuestion = root.querySelector("[data-board-question]");
  const boardInstructions = root.querySelector("[data-board-instructions]");
  const exploreLink = root.querySelector("[data-explore-link]");
  const openingTitle = root.querySelector("[data-opening-title]");
  const modeDescription = root.querySelector("[data-mode-description]");
  const turn = root.querySelector("[data-turn]");
  const stepLabel = root.querySelector("[data-step]");
  const moves = root.querySelector("[data-moves]");
  const action = root.querySelector("[data-action]");
  const learnButton = root.querySelector("[data-learn]");
  const lessonTitle = root.querySelector("[data-lesson-title]");
  const lessonChoices = root.querySelector("[data-lesson-choices]");
  const variationGuide = root.querySelector("[data-variation-guide]");
  const variationTitle = variationGuide.querySelector("[data-variation-title]");
  const variationExplanation = variationGuide.querySelector("[data-variation-explanation]");
  const variationBack = variationGuide.querySelector("[data-variation-back]");
  const variationNext = variationGuide.querySelector("[data-variation-next]");
  const feedback = root.querySelector("[data-feedback]");
  const reviewCount = root.querySelector("[data-review-count]");
  const coverageLabel = root.querySelector("[data-coverage]");
  const coverage = root.querySelector("#coverage");
  const storageWarning = root.querySelector("[data-storage-warning]");
  const storagePrefix = "chess-coach:v1:";
  const descriptions = {
    learn: "Explore each variation move by move or study a concept.",
    mixed: "Play against different replies in shuffled order.",
    study: "Pick a reply and learn the plan from that position.",
    review: "Retry moves where you needed a hint or tried another line.",
  };
  const pending = new Set();
  const practiced = new Set();
  const decisions = new Map();
  const mixBags = new Map();
  let opening, line, step, firstStep, selected, hintShown, neededHelp, complete, reviewEmpty;
  let lesson, displayedStep;
  let lastAttempt = null;

  function read(key) {
    try {
      return localStorage.getItem(storagePrefix + key);
    } catch {
      storageWarning.hidden = false;
      return null;
    }
  }

  function write(key, value) {
    try {
      if (value === null) localStorage.removeItem(storagePrefix + key);
      else localStorage.setItem(storagePrefix + key, value);
    } catch {
      storageWarning.hidden = false;
    }
  }

  function lineKey(opening, line) {
    return opening.id + ":" + line.frames.at(-1).history;
  }

  for (const opening of chessRepertoire) {
    openingSelect.add(new Option(opening.name + " · " + opening.side, opening.id));
    for (const line of opening.lines) {
      const key = lineKey(opening, line);
      if (read("played:" + key)) practiced.add(key);
      line.frames.forEach((frame, step) => {
        if (frame.move && !decisions.has(frame.position)) {
          decisions.set(frame.position, {opening, line, step});
          if (read("review:" + frame.position)) pending.add(frame.position);
        }
      });
    }
  }
  function current() {
    return line.frames[step];
  }

  function renderBoard(frame, focus = [], arrows = []) {
    board.render(frame, {side: opening.side, disabled: mode.value === "learn", selected, focus, arrows});
    const explore = new URLSearchParams({explore: frame.history, opening: opening.id});
    const base = location.protocol === "file:" ? "https://hmazin-chess-coach.vercel.app/" : "";
    exploreLink.href = base + "?" + explore;
    root.dispatchEvent(new CustomEvent("coach-position", {detail: {
      history: frame.history,
      attempted: lastAttempt,
      side: opening.side,
    }}));
  }

  function reviewEntries() {
    return Array.from(pending, key => decisions.get(key)).filter(entry => entry.opening === opening);
  }

  function availableLessons() {
    return conceptLessons.filter(lesson => lesson.opening === opening.id);
  }

  function renderLesson() {
    const step = lesson.step;
    const position = lesson.position;
    const walkthrough = lesson.lesson.walkthrough;
    const comparing = Boolean(step.examples);
    const showAnnotations = comparing || lesson.revealed;
    renderBoard(position.frame, showAnnotations ? position.focus : [], showAnnotations ? position.arrows : []);
    moves.textContent = position.frame.history;
    boardQuestion.textContent = walkthrough ? lesson.lesson.name : lesson.finished ? "" : step.prompt;
    boardQuestion.hidden = lesson.finished;
    boardInstructions.textContent = walkthrough ? "The last move is highlighted." :
      comparing ? "Select a move or line in the Coach panel." :
        lesson.revealed ? "Follow the arrows on the board." : "Use the position to answer.";
    turn.textContent = lesson.finished ? "Lesson complete" : walkthrough || comparing ? "Explore the line" : "Find the idea";
    stepLabel.textContent = lesson.finished ? "" : "Step " + (lesson.index + 1) + " of " + lesson.lesson.steps.length;
    lessonChoices.hidden = lesson.finished || walkthrough;
    if (walkthrough) {
      variationTitle.textContent = step.title;
      variationExplanation.textContent = lesson.explanation;
      variationBack.disabled = lesson.index === 0;
      variationNext.textContent = lesson.action;
      return;
    }

    lessonTitle.textContent = lesson.finished ? "Take this to your next game" : step.title;
    feedback.textContent = lesson.explanation;
    action.textContent = lesson.action;
    if (lesson.finished) return;

    if (displayedStep !== step) {
      lessonChoices.replaceChildren(...(step.examples ?? step.options).map(({label}, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lesson-choice";
        button.textContent = label;
        button.addEventListener("click", () => {
          lesson.select(index);
          renderLesson();
        });
        return button;
      }));
      displayedStep = step;
    }
    Array.from(lessonChoices.children).forEach((button, index) => {
      const correct = !comparing && lesson.revealed && step.answer === index;
      const incorrect = !comparing && lesson.choice === index && step.answer !== index;
      const example = comparing && lesson.example === index;
      button.classList.toggle("is-correct", correct);
      button.classList.toggle("is-incorrect", incorrect);
      button.classList.toggle("is-comparison", example);
      button.setAttribute("aria-pressed", String(correct || incorrect || example));
      button.setAttribute("aria-disabled", String(!comparing && lesson.revealed));
    });
  }

  function render() {
    const learning = mode.value === "learn";
    const walkthrough = learning && lesson.lesson.walkthrough;
    const reviewing = mode.value === "review";
    const count = reviewEntries().length;
    root.classList.toggle("is-learning", learning);
    openingTitle.textContent = opening.name;
    modeDescription.textContent = descriptions[mode.value];
    lineControl.hidden = !learning && mode.value !== "study";
    lineLabel.textContent = learning ? "Lesson" : "Variation";
    learnButton.hidden = learning;
    lessonTitle.hidden = !learning || walkthrough;
    feedback.hidden = walkthrough;
    action.hidden = walkthrough;
    variationGuide.hidden = !walkthrough;
    reviewCount.textContent = count ? count + (count === 1 ? " move to review" : " moves to review") : "No moves to review yet";
    coverage.max = opening.lines.length;
    coverage.value = opening.lines.filter(line => practiced.has(lineKey(opening, line))).length;
    coverageLabel.textContent = coverage.value + " of " + coverage.max;
    if (learning) {
      renderLesson();
      return;
    }

    const frame = current();
    renderBoard(frame);
    moves.textContent = frame.history;
    boardQuestion.hidden = true;
    lessonChoices.hidden = true;
    boardInstructions.textContent = "Choose a piece, then its destination.";
    stepLabel.textContent = reviewing || complete ? "" : "Move " + (step - firstStep + 1) + " of " + (line.frames.length - firstStep - 1);

    if (reviewEmpty) {
      turn.textContent = "No moves to review";
      action.textContent = "Mix replies";
    } else if (complete) {
      turn.textContent = reviewing ? "Move reviewed" : "Variation complete";
      action.textContent = {review: "Next review", study: "Practice again", mixed: "Next variation"}[mode.value];
    } else {
      turn.textContent = opening.side + " to move";
      action.textContent = hintShown ? "Show move" : "Hint";
    }
  }

  function nextMixedLine() {
    let bag = mixBags.get(opening.id);
    if (!bag?.remaining.length) {
      const remaining = opening.lines.slice();
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      if (remaining.length > 1 && remaining[0] === bag?.last) {
        [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
      }
      bag = {remaining, last: null};
      mixBags.set(opening.id, bag);
    }
    bag.last = bag.remaining.shift();
    return bag.last;
  }

  function start() {
    selected = "";
    lastAttempt = null;
    if (mode.value === "learn") {
      const lessons = [...availableLessons(), ...opening.lines.map(line => line.lesson)];
      lesson = new ConceptLesson(lessons.find(item => item.id === lineSelect.value));
      reviewEmpty = false;
      render();
      return;
    }

    const review = mode.value === "review" ? reviewEntries()[0] : null;
    reviewEmpty = mode.value === "review" && !review;
    firstStep = 0;
    if (mode.value === "mixed") {
      line = nextMixedLine();
    } else if (mode.value === "study") {
      line = opening.lines[lineSelect.selectedIndex];
      firstStep = line.studyFrom;
    } else {
      line = review?.line ?? opening.lines[0];
      firstStep = review?.step ?? 0;
    }
    step = firstStep;
    complete = false;
    hintShown = false;
    neededHelp = false;
    feedback.textContent = reviewEmpty
      ? "Play a variation and moves you need help with will appear here."
      : "What would you play here?";
    render();
  }

  function selectMode(selection) {
    if (mode.value === "learn") {
      const groups = [
        ["Concept lessons", availableLessons()],
        ["Variation walkthroughs", opening.lines.map(line => line.lesson)],
      ];
      lineSelect.replaceChildren(...groups.filter(([, lessons]) => lessons.length).map(([name, lessons]) => {
        const group = document.createElement("optgroup");
        group.label = name;
        group.append(...lessons.map(lesson => new Option(lesson.name, lesson.id)));
        return group;
      }));
    } else {
      lineSelect.replaceChildren(...opening.lines.map(line => new Option(line.name)));
    }
    if ([...lineSelect.options].some(option => option.value === selection)) lineSelect.value = selection;
    start();
  }

  function selectOpening(variation) {
    opening = chessRepertoire[openingSelect.selectedIndex];
    selectMode(variation);
  }

  function savePreferences() {
    write("preferences", JSON.stringify({
      opening: openingSelect.value,
      mode: mode.value,
      variation: lineSelect.value,
    }));
  }

  function loadPreferences() {
    try {
      return JSON.parse(read("preferences"));
    } catch {
      return null;
    }
  }

  function markForReview(frame) {
    neededHelp = true;
    if (pending.has(frame.position)) return;
    pending.add(frame.position);
    write("review:" + frame.position, "1");
  }

  function advance() {
    const frame = current();
    const reviewing = mode.value === "review";
    if (!neededHelp && pending.delete(frame.position)) {
      write("review:" + frame.position, null);
    } else if (reviewing && neededHelp && pending.delete(frame.position)) {
      pending.add(frame.position);
    }
    step++;
    lastAttempt = null;
    complete = reviewing || !current().move;
    if (complete && !reviewing) {
      const key = lineKey(opening, line);
      practiced.add(key);
      write("played:" + key, "1");
    }
    selected = "";
    hintShown = false;
    neededHelp = false;
    const reply = frame.reply ? " Opponent plays " + frame.reply + "." : "";
    feedback.textContent = frame.san + ". " + frame.reason + reply;
    render();
  }

  function choose(name) {
    if (mode.value === "learn" || complete || reviewEmpty) return;
    const frame = current();
    const man = frame.board[chessSquareOrder.indexOf(name)];
    const ownsPiece = man !== "." && (man === man.toUpperCase()) === (opening.side === "White");
    if (ownsPiece) {
      selected = selected === name ? "" : name;
      render();
    } else if (selected) {
      const attempted = selected + name;
      if (attempted === frame.move) {
        advance();
      } else {
        selected = "";
        if (frame.legal.includes(attempted)) {
          markForReview(frame);
          lastAttempt = attempted;
          feedback.textContent = "That move is legal. This variation uses a different response. Try a hint.";
        } else {
          feedback.textContent = "Choose a legal destination for that piece.";
        }
        render();
      }
    }
  }

  openingSelect.addEventListener("change", () => {
    selectOpening();
    savePreferences();
  });
  mode.addEventListener("change", () => {
    selectMode();
    savePreferences();
  });
  lineSelect.addEventListener("change", () => {
    start();
    savePreferences();
  });
  learnButton.addEventListener("click", () => {
    mode.value = "learn";
    selectMode(line.lesson.id);
    savePreferences();
    boardQuestion.scrollIntoView({block: "nearest"});
  });
  function advanceLesson() {
    if (lesson.readyToPractice) {
      mode.value = "study";
      selectMode(lesson.lesson.practice);
      savePreferences();
    } else {
      const previous = lesson.index;
      lesson.advance();
      renderLesson();
      if (!lesson.lesson.walkthrough && previous !== lesson.index) boardQuestion.scrollIntoView({block: "nearest"});
    }
  }
  variationNext.addEventListener("click", advanceLesson);
  variationBack.addEventListener("click", () => {
    lesson.back();
    renderLesson();
  });
  action.addEventListener("click", () => {
    if (mode.value === "learn") {
      advanceLesson();
    } else if (reviewEmpty) {
      mode.value = "mixed";
      start();
      savePreferences();
    } else if (complete) {
      start();
    } else if (hintShown) {
      advance();
    } else {
      const frame = current();
      hintShown = true;
      markForReview(frame);
      feedback.textContent = frame.hint;
      render();
    }
  });
  window.addEventListener("storage", ({key, newValue}) => {
    if (!key?.startsWith(storagePrefix)) return;
    const [kind, id] = key.slice(storagePrefix.length).split(/:(.*)/s);
    if (kind === "review" && decisions.has(id)) {
      if (newValue) pending.add(id);
      else pending.delete(id);
    } else if (kind === "played") {
      if (newValue) practiced.add(id);
      else practiced.delete(id);
    } else {
      return;
    }
    if (reviewEmpty && reviewEntries().length) start();
    else render();
  });

  const saved = loadPreferences();
  if (chessRepertoire.some(opening => opening.id === saved?.opening)) openingSelect.value = saved.opening;
  if ([...mode.options].some(option => option.value === saved?.mode)) mode.value = saved.mode;
  selectOpening(saved?.variation);
})();
