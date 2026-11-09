class ConceptLesson {
  constructor(lesson) {
    this.lesson = lesson;
    this.index = 0;
    this.choice = null;
    this.example = 0;
    this.revealed = false;
    this.finished = false;
  }

  get step() {
    return this.lesson.steps[this.index];
  }

  get position() {
    return this.step.examples?.[this.example] ?? this.step;
  }

  get explanation() {
    if (this.finished) return this.lesson.takeaway;
    if (!this.step.options || this.revealed) return this.position.explanation;
    return this.step.options[this.choice]?.feedback ?? "Look at the board, then choose a reason.";
  }

  get readyToPractice() {
    return this.finished || (this.lesson.walkthrough && this.index === this.lesson.steps.length - 1);
  }

  get action() {
    if (this.lesson.walkthrough) return this.readyToPractice ? "Practice this variation" : "Next move";
    if (this.finished) return "Practice this idea";
    if (!this.step.examples && !this.revealed) return "Show explanation";
    return this.index === this.lesson.steps.length - 1 ? "Finish lesson" : "Next step";
  }

  select(index) {
    if (this.step.examples) this.example = index;
    else if (!this.revealed) {
      this.choice = index;
      this.revealed = index === this.step.answer;
    }
  }

  advance() {
    if (this.step.options && !this.revealed) {
      this.revealed = true;
    } else if (this.index + 1 === this.lesson.steps.length) {
      this.finished = true;
    } else {
      this.index++;
      this.choice = null;
      this.example = 0;
      this.revealed = false;
    }
  }

  back() {
    if (this.lesson.walkthrough && this.index > 0) this.index--;
  }
}
