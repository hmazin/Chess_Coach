export class StudyEngine {
  constructor(onError) {
    this.onError = onError;
    this.worker = new Worker(new URL("./vendor/stockfish-19-lite-single.js", import.meta.url));
    this.worker.onmessage = ({data}) => {
      for (const line of String(data).split("\n")) this.read(line.trim());
    };
    this.worker.onerror = () => this.fail();
    this.timer = setTimeout(() => this.fail(), 15000);
    this.worker.postMessage("uci");
  }

  read(line) {
    if (line === "uciok") {
      this.worker.postMessage("setoption name MultiPV value 3");
      this.worker.postMessage("isready");
    } else if (line === "readyok") {
      clearTimeout(this.timer);
      this.ready = true;
      this.start();
    } else if (this.active && line.startsWith("bestmove ")) {
      clearTimeout(this.timer);
      const done = this.active;
      this.active = null;
      if (!done.cancelled) {
        const choices = [...done.lines].sort(([left], [right]) => left - right).map(([, info]) => info);
        const bestMove = line.split(" ")[1];
        const best = choices.find(info => info.moves[0] === bestMove);
        const ordered = best ? [best, ...choices.filter(info => info.moves[0] !== bestMove)] : choices;
        done.callback(ordered);
      }
      this.start();
    } else if (this.active && !this.active.cancelled) {
      const info = /^info depth (\d+) .*?\bmultipv (\d+) score (cp|mate) (-?\d+) (.*?)\bpv ([a-h1-8qrbn ]+)$/.exec(line);
      if (info && !/\b(?:lowerbound|upperbound)\b/.test(info[5])) {
        const [, depth, index, type, score, , pv] = info;
        this.active.lines.set(Number(index), {depth: Number(depth), type, score: Number(score), moves: pv.trim().split(" ").slice(0, 8)});
      }
    }
  }

  start() {
    if (!this.ready || this.active || !this.next) return;
    this.active = this.next;
    this.next = null;
    const moves = this.active.moves.join(" ");
    this.worker.postMessage(moves ? "position startpos moves " + moves : "position startpos");
    this.worker.postMessage("go depth 18 movetime 1500");
    this.timer = setTimeout(() => this.fail(), 10000);
  }

  analyze(moves, callback) {
    if (this.failed) return;
    this.cancel();
    this.next = {moves, callback, lines: new Map()};
    this.start();
  }

  cancel() {
    this.next = null;
    if (this.active && !this.active.cancelled) {
      this.active.cancelled = true;
      this.worker.postMessage("stop");
    }
  }

  fail() {
    clearTimeout(this.timer);
    this.failed = true;
    this.ready = false;
    this.next = null;
    this.active = null;
    this.worker.terminate();
    this.onError();
  }
}
