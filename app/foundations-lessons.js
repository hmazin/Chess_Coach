import { drillPositions } from "./drill-positions.js";

const positions = new Map(drillPositions.map(position => [position.id, position]));
const italian = positions.get("6alsZRAX-27");
const fourKnights = positions.get("Xga4RqU5-20");
const petrov = positions.get("sCmkagFD-47");
const slav = positions.get("GTSqsDeA-52");

export const syllabus = [
  {
    id: "read-the-threat",
    name: "Read the threat",
    practice: slav.id,
    habit: "After every opponent move, ask what changed. Before playing your move, look at the lines it would open.",
    alternate: {
      title: "Independent check",
      fen: "r1r3k1/2p1qppp/3b4/1PpPp3/4Pn2/3B1P2/P1NQ2PP/1R1R2K1 w - - 1 28",
      prompt: "You have White after 27...Nf4. What should you notice before moving your rook?",
      check: "transfer",
      options: [
        {label: "The knight on f4 can take the bishop on d3. Consider 28.Bc4.", correct: true, line: ["Bc4", "f5"], feedback: "Black’s last move made d3 a target. 28.Bc4 moves the bishop out of the knight’s reach and puts it on a more active square."},
        {label: "The knight on f4 attacks my queen on d2. Move the queen.", feedback: "Count the squares from f4. The knight reaches d3 and d5. Your bishop on d3 is the piece to check."},
      ],
    },
    steps: [
      {
        title: "Starting check",
        fen: fourKnights.fen,
        setup: ["b3", "Qc3+"],
        prompt: "You have White. The queen on c3 gives check. Tap the second piece that the queen attacks.",
        square: "a1",
        check: "baseline",
        retry: "Trace the other diagonal down from c3. Which White piece does it reach?",
        explanation: "The queen attacks the king on e1 through d2 and the rook on a1 through b2. A fork attacks two targets in one move. Here the check has to be answered first.",
        arrows: [["c3", "e1", "threat"], ["c3", "a1", "threat"]],
      },
      {
        title: "Trace the line",
        fen: fourKnights.fen,
        previousMove: fourKnights.previousMove,
        prompt: "Back up to before 11.b3. What was keeping the queen out of a1?",
        show: true,
        explanation: "The pawn on b2 blocks the diagonal c3–b2–a1. After b3, a check from c3 also attacks the rook. When a pawn moves, check the lines it was blocking as well as what it attacks from its new square.",
        focus: ["b2"],
        arrows: [["c3", "a1", "threat"]],
      },
      {
        title: "Try the defense",
        fen: fourKnights.fen,
        previousMove: fourKnights.previousMove,
        prompt: "Play a White queen check from the e-file that makes Black respond without opening b2.",
        move: "Qe5+",
        retry: "Keep the b2-pawn in place. Trace where your queen can check the king on e8.",
        explanation: "11.Qe5+ forces a reply. After 11...Be7, 12.Qxg7 attacks the rook on h8. Checking the opponent's king first changes who has to react.",
        focus: ["e5", "e8"],
      },
      {
        title: "Apply it again",
        fen: slav.fen,
        setup: ["Kf2"],
        prompt: "You’re calculating as White after 27.Kf2. Play the Black knight capture that opens a queen check.",
        move: "Nxf1+",
        retry: "The knight on g3 is the blocker. Trace the h4–g3–f2 diagonal and find a capture that clears it.",
        explanation: "The knight takes the rook on f1 and leaves g3. Now the queen can see the king on f2 along h4–g3–f2. That is a discovered check.",
        arrows: [["h4", "f2", "threat"]],
        focus: ["g3"],
      },
      {
        title: "Independent check",
        fen: "r4rk1/pbp2ppp/2q2n2/1pb5/8/2NB4/PPPP1PPP/R1BQ1RK1 w - - 2 11",
        previousMove: {from: "c8", to: "b7"},
        prompt: "New game position. You have White after 10...Bb7. Which plan accounts for Black’s queen on c6?",
        check: "transfer",
        options: [
          {label: "11.Ne4. My d3-bishop can take back on e4.", feedback: "After 11...Nxe4 12.Bxe4, Black can take on e4 with the queen along c6–d5–e4."},
          {label: "11.Qf3. Check the pressure on e4 before moving my knight there.", correct: true, line: ["Qf3", "Qb6"], feedback: "11.Qf3 keeps the position playable. On 11.Ne4, Black can answer ...Nxe4, and Bxe4 invites ...Qxe4. Trace every attacker on the destination before committing."},
          {label: "11.Bxh7+. The check is worth the bishop.", feedback: "11...Nxh7 takes the bishop. A check is forcing, so count what Black can capture before choosing it."},
        ],
      },
    ],
  },
  {
    id: "count-the-capture",
    name: "Calculate the whole exchange",
    practice: petrov.id,
    habit: "Before taking material, name the recapture and keep counting until the captures stop.",
    alternate: {
      title: "Independent check",
      fen: "r2q1rk1/1Qpbbppp/5n2/2pPp3/2P1P3/2NB1N2/P4PPP/1R3RK1 b - - 2 17",
      setup: ["Rb8", "Qxb8"],
      prompt: "You have Black. If you recapture with 18...Qxb8, what is exchanged once the captures on b8 end?",
      check: "transfer",
      options: [
        {label: "Black wins a queen for one rook.", feedback: "After ...Qxb8, White’s rook on b1 can take Black’s queen on b8."},
        {label: "Each side gives up a queen and a rook.", correct: true, line: ["Qxb8", "Rxb8", "Rxb8"], feedback: "18...Qxb8 19.Rxb8 Rxb8 finishes the exchange. Count all four captures, including White’s rook on b1 and Black’s remaining rook on f8."},
        {label: "White wins a queen for a rook.", feedback: "After White’s rook takes on b8, Black has a second rook on f8 that can recapture."},
      ],
    },
    steps: [
      {
        title: "Starting check",
        fen: petrov.fen,
        previousMove: petrov.previousMove,
        prompt: "You have Black. Before 24...Rxb3, tap the White piece that could recapture on b3.",
        square: "d1",
        check: "baseline",
        retry: "Start from b3 and trace the diagonals both ways. Which one reaches a White defender?",
        explanation: "The bishop on d1 defends b3 through c2. Your rook can reach the pawn, but the bishop can take the rook.",
        arrows: [["d1", "b3", "threat"]],
      },
      {
        title: "Count the pieces",
        fen: petrov.fen,
        setup: ["Rxb3"],
        prompt: "You’re still looking from Black’s side. Play White’s recapture and count what each side gives up.",
        move: "Bxb3",
        retry: "Use the piece on the d1–c2–b3 diagonal.",
        explanation: "White loses a pawn and Black loses a rook. The exchange costs Black about four pawns of material. The first capture tells you what you win. The recapture tells you what you pay.",
        focus: ["b3"],
      },
      {
        title: "Check again",
        fen: petrov.fen,
        setup: ["Red8", "Be2"],
        prompt: "In the stronger line, Black plays 24...Red8 and White develops the bishop to e2. Play the Black capture that is now safe.",
        move: "Rxb3",
        retry: "Where did the bishop go, and which pawn has lost its defender?",
        explanation: "25...Rxb3 now wins the pawn. The bishop on e2 cannot reach b3. Decide whether a capture works in the position you have now, each time a defender moves.",
        focus: ["b3", "e2"],
      },
      {
        title: "Look one move deeper",
        fen: italian.fen,
        setup: ["Qxe7", "exd6", "cxd6"],
        prompt: "Black recaptured with the queen and the e-file just opened. Play White's forcing capture.",
        move: "Rxe7+",
        retry: "White’s rook is on e1. What can it see now that the e5-pawn has moved?",
        explanation: "16.Rxe7+ wins the queen. If 16...Nxe7, White has traded a rook for the queen. When you compare recaptures, watch what each one exposes to the next forcing move.",
        focus: ["e7"],
      },
      {
        title: "Independent check",
        fen: "r2q3k/p1p3pp/1pQ3n1/8/3p4/6N1/PPP1RPPP/6K1 b - - 0 22",
        prompt: "New Petrov position. You have Black. Choose a plan and calculate what happens if the pieces are traded.",
        check: "transfer",
        options: [
          {label: "22...Ne7. My queen on d8 can recapture if the knight is taken.", feedback: "After 22...Ne7 23.Rxe7, ...Qxe7 lets White play Qxa8+. Black can only delay mate by blocking with the queen."},
          {label: "22...Rc8. Keep the queen on d8 and move the rook off the c6–b7–a8 diagonal.", correct: true, line: ["Rc8", "Re4"], feedback: "22...Rc8 is sound. Check the full sequence after ...Ne7 Rxe7 Qxe7. Qxa8+ Qf8 Qxf8# is why the apparent queen recapture fails."},
        ],
      },
    ],
  },
];
