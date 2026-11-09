# Chess Coach

Chess Coach is an offline opening trainer for blitz. Open [app/index.html](app/index.html) in a current browser. No installation, account, or internet connection is needed to practice.

The app includes ten Petrov Defense variations, four Bishop's Opening variations, and three Queen's Gambit Declined variations. Your opponent plays replies from the prepared repertoire. Click or tap a piece and its destination to play. With a keyboard, use the arrow keys to move between squares and Enter or Space to select one.

| Practice mode | What it does |
| --- | --- |
| Learn concepts | Explain a threat, compare positions with board arrows, and apply the same idea to a different reply. |
| Mix replies | Play each variation in shuffled order. |
| Choose a variation | Start at the key position of a selected line. |
| Review missed moves | Retry positions where you tried a different legal move or used a hint. |

Your progress and preferences are stored in the browser on the device where you play.

## Install on a phone

Open the deployed HTTPS address. On iPhone, open it in Safari and use **Share → Add to Home Screen** with **Open as Web App** enabled. On Android, use **Install app** when it appears, or use Chrome's **Add to Home screen** menu. Open the app once while connected and wait for **Ready offline** before practicing without a connection.

Each device keeps its own practice history. The hosted app serves the training files, and the browser handles replies and saves progress.

## Build for hosting

Run `node scripts/build.mjs` to generate the static site in `dist/`. The build uses the checked-in training repertoire and versions the offline cache from the app's contents. Vercel uses this command automatically through [vercel.json](vercel.json).

## Add or revise an opening

Edit [opening-practice/repertoire.json](opening-practice/repertoire.json). Each variation contains legal moves in standard algebraic notation and one hint and explanation for each move the student plays. The optional `studyFrom` value sets which decision starts a chosen variation, counting from zero.

Regenerate the app's repertoire after making a change.

```sh
python -m pip install python-chess
python opening-practice/build_repertoire.py app/repertoire.js
```

The generator checks legality and rejects inconsistent recommendations for the same position. The generated file is included so the app runs directly from a checkout. The separate PGN files contain the original starter lines for importing into another trainer.

Concept lessons live in [opening-practice/lessons.json](opening-practice/lessons.json). After changing a question, example, or board annotation, run `python opening-practice/build_lessons.py` to regenerate the lesson positions.

## Artwork

The Chessnut pieces are by Alexis Luengas and come from Lichess. See the bundled [notice](app/assets/pieces/NOTICE.txt) and [Apache 2.0 license](app/assets/pieces/LICENSE.txt).
