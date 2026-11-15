// The frame check, headless (app/frameCheck.ts: the pause page's Frame check button, the link ?framecheck=1): serves the built game
// (dist/), loads the link in headless Chromium and prints the result the page makes: the same code and scenes Ed's button runs
// on his machine, so a builder's numbers and his are of the same frames. Writes <out>/framecheck.json and framecheck.txt.
//   node tools/bench/framecheck.cjs [out dir] (default bench-out/)   FRAMES=quick|1 (default quick: half a second a scene; the
//   cloud's software renderer takes seconds a frame), FRAMES=quick,sail only the scenes named (the sail alone: 10 to 20 minutes here)   SIZE=1280x720   DIST=dist   SHOT=1 (framecheck.png, the page as it ends)
// Run `npm run build` first. In the cloud the numbers are the software renderer's: compare them only with the cloud's own.
const http = require("http");
const fs = require("fs");
const path = require("path");
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node22/lib/node_modules/playwright"); }

const root = path.resolve(process.env.DIST || path.join(__dirname, "../../dist"));
const out = path.resolve(process.argv[2] || path.join(__dirname, "../../bench-out"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, "index.html") : p;
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = await serve(), port = server.address().port;
  const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const [width, height] = (process.env.SIZE || "1280x720").split("x").map(Number);
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?framecheck=${process.env.FRAMES || "quick"}`);
  await page.waitForFunction(() => window.witch?.frameCheck?.done, null, { timeout: 3000000, polling: 1000 });
  const state = await page.evaluate(() => window.witch.frameCheck);
  if (process.env.SHOT) await page.screenshot({ path: path.join(out, "framecheck.png"), timeout: 300000 });
  await browser.close(); server.close();
  if (!state.result) { console.error(`frame check: no result (${state.error || "stopped"})`, errors.join("\n")); process.exit(1); }
  fs.writeFileSync(path.join(out, "framecheck.json"), JSON.stringify(state.result, null, 1));
  fs.writeFileSync(path.join(out, "framecheck.txt"), state.text + "\n");
  console.log(state.text);
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
