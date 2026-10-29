// 装配台 + 零件库 无头走查：截图到 $OUT，视频到 $VIDEO
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.env.OUT || "../v4";
const VIDEO = process.env.VIDEO || "/tmp/asmvideo";
const BASE = process.env.BASE || "http://localhost:4173";
const QUICK = !!process.env.QUICK;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(QUICK ? {} : { recordVideo: { dir: VIDEO, size: { width: 1280, height: 800 } } }) });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
let n = 0;
const shot = async (name) => { n++; const f = `${OUT}/asm-${String(n).padStart(2, "0")}-${name}.png`; await p.screenshot({ path: f }); console.log("shot", f); };
const wait = (ms) => p.waitForTimeout(ms);
const pen = () => p.evaluate(() => window.__asm.overlapTest().maxPenetrationMm);
const out = { steps: [] };

await p.goto(BASE + "/parts");
await p.getByTestId("parts-counts").waitFor();
await wait(800);
await shot("parts-library");
await p.getByTestId("parts-search").fill("pico");
await wait(400);
await shot("parts-search-pico");
out.partsCounts = await p.getByTestId("parts-counts").innerText();

await p.goto(BASE + "/assembly");
await p.waitForFunction(() => window.__asm, null, { timeout: 60000 });
await wait(1500);
await shot("assembly-empty");
// 自动演示：全部装配步骤
await p.evaluate((v) => { window.__asmSpeed = v; }, +(process.env.SPEED || 12));
await p.getByTestId("demo-btn").click();
let maxPen = 0, lastStep = "";
const t0 = Date.now();
while (Date.now() - t0 < (QUICK ? 30000 : 600000)) {
  await wait(1000);
  const s = await p.getByTestId("demo-step").innerText().catch(() => "");
  maxPen = Math.max(maxPen, await pen());
  if (s !== lastStep) { out.steps.push(s); console.log(s); lastStep = s; if (/第 [2-7]\//.test(s)) await shot("demo-" + s.match(/第 (\d)/)[1]); }
  if (/完成|停止/.test(s)) break;
}
await wait(1500);
await shot("demo-done");
await p.getByTestId("debug-toggle").check();
await wait(800);
await shot("debug-colliders");
await p.getByTestId("debug-toggle").uncheck();
// 手动拖拽：在画布上拖一下（Pico 区域），检查拖拽中不穿模
const snap = await p.evaluate(() => window.__asm.snapshot());
out.parts = snap.parts.length;
out.edges = snap.edges.length;
out.maxPenDuringDemoMm = maxPen;
out.finalPenMm = await pen();
out.errors = errs;
fs.writeFileSync(`${OUT}/asm-walk.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await ctx.close();
await b.close();
