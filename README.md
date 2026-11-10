# Chess Coach

Chess Coach is an offline opening trainer for blitz. Open [app/index.html](app/index.html) in a current browser. No installation, account, or internet connection is needed to practice.

The app includes fifteen Petrov Defense variations, four Bishop's Opening variations, and three Queen's Gambit Declined variations. Your opponent plays replies from the prepared repertoire. Click or tap a piece and its destination to play. With a keyboard, use the arrow keys to move between squares and Enter or Space to select one.

| Practice mode | What it does |
| --- | --- |
| Learn openings | Step through any practice variation with a move-by-move explanation, or choose a concept lesson to compare positions. |
| Mix replies | Play each variation in shuffled order. |
| Choose a variation | Start at the key position of a selected line. |
| Review missed moves | Retry positions where you tried a different legal move or used a hint. |

Your progress and preferences are stored in the browser on the device where you play.

## Self-play with Stockfish

Choose **Self-play with Stockfish** in Practice setup to start a game from the standard position and make moves for both White and Black. The board arrow and the top analysis line show Stockfish’s recommended move for the side to move. You can choose your own move, play the recommendation, go back to try another reply, or start a new game.

## Explore both sides

Open **Explore both sides** under any study board. You can play White and Black, choose one of the live Stockfish suggestions, and use **Back one move** to try a different reply. Previously played replies remain available at that position while the exploration is open. **Explain last move** asks the private AI coach about the current branch and includes checked Stockfish continuations.

Stockfish runs on your device in the hosted app, including offline after the app has cached its files. The exploration uses the [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) single-threaded lite build under the GPLv3 and [chess.js](https://github.com/jhlywa/chess.js) under the BSD 2-Clause license. The hosted files include both license texts.

## Ask the AI coach

In the hosted app, open **Ask the AI coach** beside the board and unlock it with your personal access code. Ask what a move achieves, what the opponent might play next, or why a move you tried gives the opponent a chance. You can ask follow-up questions while looking at the same position.

The coach sends the practice position, your question, and recent messages from that position to an OpenAI model through Vercel AI Gateway. It uses Stockfish analysis of the practice positions, and its replies include expandable examples. It requires an internet connection. The drills still work offline.

To enable the coach on a deployment, set `COACH_ACCESS_HASH` to the SHA-256 hex digest of a high-entropy personal access code. Set `CHESS_COACH_MODEL` to an OpenAI model ID from Vercel AI Gateway, such as `openai/gpt-5.2`. The server uses Vercel's OpenID Connect token to authenticate with the gateway. Vercel requires card verification before the project can use its included AI credits.

## Install on a phone

Open the deployed HTTPS address. On iPhone, open it in Safari and use **Share → Add to Home Screen** with **Open as Web App** enabled. On Android, use **Install app** when it appears, or use Chrome's **Add to Home screen** menu. Open the app once while connected and wait for **Ready offline** before practicing without a connection.

Each device keeps its own practice history. The hosted app serves the training files, and the browser handles replies and saves progress.

## Build for hosting

Run `npm ci` and then `node scripts/build.mjs` to generate the static site in `dist/`. The build uses the checked-in training repertoire and versions the offline cache from the app's contents. Vercel uses this build command automatically through [vercel.json](vercel.json).

## Add or revise an opening

Edit [opening-practice/repertoire.json](opening-practice/repertoire.json). Each variation contains legal moves in standard algebraic notation and one hint and explanation for each move the student plays. The `teaching` entry adds an introduction and an explanation of each opponent reply in the walkthrough. The optional `studyFrom` value sets which decision starts practice, counting from zero. Use `teaching.from` to start the walkthrough at a different decision.

Regenerate the app's repertoire after making a change.

```sh
python -m pip install python-chess
python opening-practice/build_repertoire.py app/repertoire.js
```

The generator checks legality and rejects inconsistent recommendations for the same position. The generated file is included so the app runs directly from a checkout. The separate PGN files contain the original starter lines for importing into another trainer.

Concept lessons live in [opening-practice/lessons.json](opening-practice/lessons.json). After changing a question, example, or board annotation, run `python opening-practice/build_lessons.py` to regenerate the lesson positions.

When repertoire or lesson positions change, regenerate the coach's analysis with `python opening-practice/build_coach_positions.py PATH_TO_STOCKFISH` using Stockfish 19.

## Artwork

The Chessnut pieces are by Alexis Luengas and come from Lichess. See the bundled [notice](app/assets/pieces/NOTICE.txt) and [Apache 2.0 license](app/assets/pieces/LICENSE.txt).
