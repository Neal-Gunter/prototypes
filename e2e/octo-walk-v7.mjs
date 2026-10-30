import { chromium } from "playwright";
import fs from "node:fs";
const OUT = "/workspace/proto-site/v7", BASE = "http://localhost:4173", FR = `${OUT}/frames`;
fs.rmSync("/tmp/pwv7", { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: "/tmp/pwv7", size: { width: 1440, height: 1000 } } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
let n = 0; const res = { frames: {} };
const shot = async (name, opts = {}) => { n++; const f = `${OUT}/${String(n).padStart(2, "0")}-${name}.png`; await p.screenshot({ path: f, ...opts }); console.log("shot", f); };
const pen = () => p.evaluate(() => { const o = window.__asm.overlapTest(); return [o.maxPenetrationMm, o.worstPair]; });
const st = () => p.evaluate(() => { const s = window.__octo.sim.snapshot(), e = window.__asm.engine; const vis = [...e.parts.values()].filter((x) => x.vis).map((x) => +(x.vis.ang ?? 0).toFixed(3)); let gap = 0; for (const c of e.cables) { const pts = e.cablePoints(c); for (let i = 1; i < pts.length; i++) gap = Math.max(gap, pts[i].distanceTo(pts[i - 1]) - c.segLen); } return { pose: s.pose, motion: window.__octo.motion(), ang: s.servos.map((x) => +x.ang.toFixed(1)), vis, cableStretchCm: +gap.toFixed(2), halt: s.halted, bad: s.checks.filter((c) => !c.ok).length }; });
const waitBuilt = async () => { await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await p.waitForTimeout(2500); };
const preset = async (k) => { await p.evaluate(() => { window.__octoBuilt = null; }); await p.click(`[data-testid=octo-preset-${k}]`); await waitBuilt(); };
const canvas = p.locator("canvas").first();
const frames = async (tag, k = 6, dt = 350) => { const out = []; for (let i = 0; i < k; i++) { const f = `${FR}/${tag}-${i}.png`; await canvas.screenshot({ path: f }); out.push({ f, ...(await st()) }); await p.waitForTimeout(dt); } return out; };
await p.goto(BASE + "/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await p.waitForTimeout(1500);
await shot("octo-tab");
for (const k of ["A-plus", "B-plus", "A", "B"]) {
  await preset(k);
  res[k] = { pen: await pen(), tip: await p.textContent("[data-testid=octo-variant-tip]").catch(() => null) };
  await shot(`${k}-built`);
  if (k.endsWith("plus")) for (const c of ["overview", "top", "body", "wires"]) { await p.click(`[data-testid=cam-${c}]`); await p.waitForTimeout(900); await shot(`${k}-cam-${c}`); }
  await p.click("[data-testid=cam-side]"); await p.waitForTimeout(900);
  res.frames[`${k}-still`] = await frames(`${k}-still`, 3, 300);
  await p.click("[data-testid=ser-GO]").catch(() => p.click("[data-testid=mcp-crawl]"));
  await p.waitForTimeout(600);
  res.frames[`${k}-go`] = await frames(`${k}-go`, 6, 350);
  await p.click("[data-testid=cam-body]"); await p.waitForTimeout(2500); await shot(`${k}-crawling`);
  if (k === "A-plus") { await p.click("[data-testid=ser-LEFT]").catch(() => {}); await p.waitForTimeout(4000); res.frames["A-plus-left"] = await frames("A-plus-left", 2, 500); await p.click("[data-testid=cam-top]"); await p.waitForTimeout(1500); await shot("A-plus-turn-left-top"); }
  await p.waitForTimeout(6000); res[k].after = { pen: await pen(), tether: await p.isVisible("[data-testid=octo-tether]"), ...(await st()) };
  await p.click("[data-testid=ser-STOP]").catch(() => {});
  if (k === "B-plus") {
    await p.click("[data-testid=octo-guide]"); await p.waitForSelector("[data-testid=octo-guide]"); await p.waitForTimeout(800);
    res.guidePlus = await p.evaluate(() => ({ url: location.href, title: document.querySelector("h1").textContent, changes: document.querySelectorAll("[data-testid=og-plus-changes] tbody tr").length, bom: document.querySelectorAll("[data-testid=og-plus-bom] tbody tr").length, files: document.querySelectorAll("[data-testid^=og-plus-save]").length, src: document.querySelector("[data-testid=og-plus-src]")?.textContent.slice(0, 120), issues: document.querySelectorAll("[data-testid=og-issues] li").length }));
    await shot("guide-plus-top"); await p.locator("[data-testid=og-plus-changes]").scrollIntoViewIfNeeded().catch(() => {}); await shot("guide-plus-changes");
    await shot("guide-plus-full", { fullPage: true });
    await p.goBack(); await p.waitForSelector("[data-testid=octo-panel]"); await p.waitForTimeout(1500);
  }
}
res.errs = errs;
fs.writeFileSync(`${OUT}/walk-result.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ guide: res.guidePlus, errs, pens: ["A-plus", "B-plus", "A", "B"].map((k) => [res[k].pen[0], res[k].after.pen[0], res[k].after.cableStretchCm, res[k].after.tether]) }, null, 1));
await ctx.close(); await b.close();
