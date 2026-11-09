const chessSquareOrder = Array.from({length: 64}, (_, i) => "abcdefgh"[i % 8] + (8 - Math.floor(i / 8)));
const chessPieceNames = {k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn"};

class ChessCoachBoard {
  constructor(grid, arrows, choose) {
    this.arrows = arrows;
    this.squares = chessSquareOrder.map((_, index) => {
      const square = document.createElement("button");
      const piece = document.createElement("img");
      const file = document.createElement("span");
      const rank = document.createElement("span");
      square.type = "button";
      square.className = "square";
      piece.className = "piece";
      piece.alt = "";
      piece.draggable = false;
      file.className = "coordinate file";
      rank.className = "coordinate rank";
      file.setAttribute("aria-hidden", "true");
      rank.setAttribute("aria-hidden", "true");
      square.append(piece, file, rank);
      square.addEventListener("click", () => choose(square.dataset.square));
      square.addEventListener("keydown", event => {
        const row = Math.floor(index / 8);
        const column = index % 8;
        const neighbor = {
          ArrowUp: row > 0 ? index - 8 : index,
          ArrowDown: row < 7 ? index + 8 : index,
          ArrowLeft: column > 0 ? index - 1 : index,
          ArrowRight: column < 7 ? index + 1 : index,
        }[event.key];
        if (neighbor === undefined) return;
        event.preventDefault();
        this.squares[neighbor].square.focus();
      });
      grid.append(square);
      return {square, piece, file, rank};
    });
  }

  renderArrows(arrows, order) {
    this.arrows.replaceChildren(...arrows.map(([from, to, style]) => {
      const start = order.indexOf(from);
      const end = order.indexOf(to);
      const x = start % 8 + .5;
      const y = Math.floor(start / 8) + .5;
      const dx = end % 8 + .5 - x;
      const dy = Math.floor(end / 8) + .5 - y;
      const distance = Math.hypot(dx, dy);
      const arrow = document.createElementNS("http://www.w3.org/2000/svg", "line");
      arrow.setAttribute("class", style);
      arrow.setAttribute("x1", x + dx / distance * .24);
      arrow.setAttribute("y1", y + dy / distance * .24);
      arrow.setAttribute("x2", x + dx - dx / distance * .15);
      arrow.setAttribute("y2", y + dy - dy / distance * .15);
      arrow.setAttribute("marker-end", "url(#" + style + "-arrow)");
      return arrow;
    }));
  }

  render(frame, {side, disabled = false, selected = "", focus = [], arrows = []}) {
    const order = side === "White" ? chessSquareOrder : chessSquareOrder.slice().reverse();
    const targets = new Set(selected ? frame.legal.filter(move => move.startsWith(selected)).map(move => move.slice(2, 4)) : []);
    this.squares.forEach(({square, piece, file, rank}, index) => {
      const name = order[index];
      const man = frame.board[chessSquareOrder.indexOf(name)];
      const color = man === man.toUpperCase() ? "White" : "Black";
      const isSelected = name === selected;
      square.dataset.square = name;
      square.disabled = disabled;
      square.classList.toggle("is-dark", (Math.floor(index / 8) + index % 8) % 2 === 1);
      square.classList.toggle("is-reply", frame.last.includes(name));
      square.classList.toggle("is-selected", isSelected);
      square.classList.toggle("is-focus", focus.includes(name));
      square.classList.toggle("is-target", targets.has(name));
      square.classList.toggle("has-piece", man !== ".");
      square.setAttribute("aria-pressed", String(isSelected));
      square.setAttribute("aria-label", man === "." ? name + ", empty" : name + ", " + color + " " + chessPieceNames[man.toLowerCase()]);
      piece.hidden = man === ".";
      if (man !== ".") {
        const source = "assets/pieces/" + (color === "White" ? "w" : "b") + man.toUpperCase() + ".svg";
        if (piece.getAttribute("src") !== source) piece.src = source;
      }
      file.textContent = index >= 56 ? name[0] : "";
      rank.textContent = index % 8 === 7 ? name[1] : "";
    });
    this.renderArrows(arrows, order);
  }
}
