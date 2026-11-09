import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(fileURLToPath(new URL("..", import.meta.url)));
const source = join(root, "app");
const output = resolve(root, "dist");
const template = await readFile(new URL("./sw-template.js", import.meta.url), "utf8");
const vendor = new Map([
  ["vendor/chess.js", "chess.js/dist/esm/chess.js"],
  ["vendor/chess-license.txt", "chess.js/LICENSE"],
  ["vendor/stockfish-19-lite-single.js", "stockfish/bin/stockfish-19-lite-single.js"],
  ["vendor/stockfish-19-lite-single.wasm", "stockfish/bin/stockfish-19-lite-single.wasm"],
  ["vendor/stockfish-license.txt", "stockfish/Copying.txt"],
]);

async function listFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(relative(source, path).split(sep).join("/"));
    else throw new Error("Unexpected entry in app: " + path);
  }
  return files;
}

const files = [...await listFiles(source), ...vendor.keys()].sort();
const hash = createHash("sha256").update(template);
for (const path of files) {
  const input = vendor.has(path) ? join(root, "node_modules", vendor.get(path)) : join(source, path);
  hash.update(path).update("\0").update(await readFile(input)).update("\0");
}
const version = hash.digest("hex").slice(0, 16);
// The recovery page must be available from the server even when an old worker is active.
const cached = files.filter(path => !path.endsWith(".txt") && path !== "refresh.html");
const worker = template
  .replace("__CACHE_VERSION__", version)
  .replace("/* __APP_FILES__ */ []", JSON.stringify(cached));

const existing = await lstat(output).catch(error => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (existing) {
  if (!existing.isDirectory() || existing.isSymbolicLink() || await realpath(output) !== output) {
    throw new Error("Refusing to replace unexpected build directory: " + output);
  }
  await rm(output, {recursive: true});
}
await cp(source, output, {recursive: true});
await mkdir(join(output, "vendor"), {recursive: true});
for (const [path, input] of vendor) await cp(join(root, "node_modules", input), join(output, path));
await writeFile(join(output, "sw.js"), worker);
console.log("Built Chess Coach " + version + " with " + cached.length + " offline assets.");
