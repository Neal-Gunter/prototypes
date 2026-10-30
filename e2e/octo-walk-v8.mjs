import { chromium } from "playwright";
import fs from "node:fs";
const OUT = "/workspace/proto-site/v8", BASE = "http://localhost:4173", FR = `${OUT}/frames`;
fs.rmSync("/tmp/pwv8", { recursive: true, force: true }); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const res = { frames: {} }; let n = 0;
async function pass(W, H, video, body) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(video ? { recordVideo: { dir: "/tmp/pwv8", size: { width: W, height: H } } } : {}) });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const shot = async (name, opts = {}) => { n++; const f = `${OUT}/${String(n).padStart(2, "0")}-${W}x${H}-${name}.png`; await p.screenshot({ path: f, ...opts }); console.log("shot", f); };
  const st = () => p.evaluate(() => { const s = window.__octo.sim.snapshot(); return { t: performance.now() / 1000, simT: s.t, pose: s.pose, motion: window.__octo.motion(), coll: s.servos.filter((x) => x.collide).length, peakI: s.peakI, halt: s.halted, bad: s.checks.filter((c) => !c.ok).length, pen: window.__asm.overlapTest().maxPenetrationMm }; });
  const waitBuilt = async () => { await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await p.waitForTimeout(2500); };
  const click = async (t) => { await p.evaluate(() => { window.__octoBuilt = null; }); await p.click(`[data-testid=${t}]`); await waitBuilt(); };
  const canvas = p.locator("canvas").first();
  const frames = async (tag, k = 6, dt = 350) => { const out = []; for (let i = 0; i < k; i++) { const f = `${FR}/${W}-${tag}-${i}.png`; await canvas.screenshot({ path: f }); out.push({ f, ...(await st()) }); await p.waitForTimeout(dt); } return out; };
  const layout = () => p.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), inView: b.bottom <= innerHeight && b.right <= innerWidth && b.top >= 0 }; }; return { vw: innerWidth, vh: innerHeight, docW: document.documentElement.scrollWidth, hOverflow: document.documentElement.scrollWidth > innerWidth + 1, canvas: r("canvas"), quick: r("[data-testid=octo-quickstart]"), quickB: r("[data-testid=octo-quickstart-B]"), panel: r("[data-testid=octo-panel]") }; });
  await p.goto(BASE + "/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await p.waitForTimeout(1500);
  await body({ p, shot, st, click, frames, layout, waitBuilt, errs });
  res[`errs${W}`] = errs; await ctx.close();
}
// 第 1 遍：笔记本 1366×768，录屏
await pass(1366, 768, true, async ({ p, shot, st, click, frames, layout }) => {
  res.layout1366 = await layout(); await shot("octo-tab");
  for (const k of ["B", "A"]) {
    const t = k === "B" ? "octo-quickstart-B" : "octo-quickstart";
    await click(t); await shot(`quick-${k}-default-cam`);
    await p.waitForTimeout(500); const s0 = await st();
    res.frames[`quick-${k}`] = await frames(`quick-${k}`, 6, 350);
    await p.waitForTimeout(4000); const s1 = await st();
    res[`quick${k}`] = { s0, s1, dz: s1.pose.z - s0.pose.z, dx: s1.pose.x - s0.pose.x, dhDeg: ((s1.pose.h - s0.pose.h) * 180) / Math.PI, wallSec: s1.t - s0.t, simSec: s1.simT - s0.simT, cmPerSimSec: (s0.pose.z - s1.pose.z) / (s1.simT - s0.simT), tether: await p.isVisible("[data-testid=octo-tether]") };
    await shot(`quick-${k}-crawling`);
    await p.click("[data-testid=cam-top]"); await p.waitForTimeout(1200); await shot(`quick-${k}-top`);
    await p.click("[data-testid=ser-STOP]");
  }
  await p.click("[data-testid=octo-adv] summary"); await p.click("[data-testid=octo-adv-gait] summary"); await p.click("[data-testid=octo-adv-ch] summary"); await p.waitForTimeout(400);
  res.advOpen = await p.evaluate(() => ({ phase: !!document.querySelector("[data-testid=octo-phase]")?.offsetParent, serial: !!document.querySelector("[data-testid=octo-serial]")?.offsetParent, ch: !!document.querySelector("[data-testid=octo-channels]")?.offsetParent }));
  await p.locator("[data-testid=octo-adv]").screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-1366x768-advanced-open.png` });
  await click("octo-preset-B"); await p.click("[data-testid=ser-GO]"); await p.waitForTimeout(500); const m0 = await st(); await p.waitForTimeout(4000); const m1 = await st();
  res.mdB = { dz: m1.pose.z - m0.pose.z, dx: m1.pose.x - m0.pose.x, dhDeg: ((m1.pose.h - m0.pose.h) * 180) / Math.PI, wallSec: m1.t - m0.t, simSec: m1.simT - m0.simT }; await shot("md-B-go"); await p.click("[data-testid=ser-STOP]");
  await p.click("[data-testid=octo-guide]"); await p.waitForSelector("[data-testid=og-toc]"); await p.waitForTimeout(800);
  res.guide = await p.evaluate(() => ({ url: location.href, toc: document.querySelectorAll("[data-testid=og-toc] a").length, changes: document.querySelectorAll("[data-testid=og-plus-changes] tbody tr").length, bom: document.querySelectorAll("[data-testid=og-plus-bom] tbody tr").length, build: document.querySelectorAll("[data-testid=og-build] tbody tr").length, safety: document.querySelectorAll("[data-testid=og-safety] li").length, issues: document.querySelectorAll("[data-testid=og-issues] li").length, hOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
  await shot("guide-top-toc");
  await p.click("[data-testid=og-toc] a[href='#s12']"); await p.waitForTimeout(1500);
  res.guide.s12Top = await p.evaluate(() => Math.round(document.getElementById("s12").getBoundingClientRect().top));
  await shot("guide-s12-build"); await p.locator("[data-testid=og-safety]").last().scrollIntoViewIfNeeded(); await shot("guide-s12-safety");
  await p.click("[data-testid=og-toc] a[href='#s11']").catch(async () => { await p.evaluate(() => scrollTo(0, 0)); await p.click("[data-testid=og-toc] a[href='#s11']"); }); await p.waitForTimeout(500); await shot("guide-s11-compile");
});
// 第 2 遍：1280×800，只看布局
await pass(1280, 800, false, async ({ p, shot, click, layout }) => {
  res.layout1280 = await layout(); await shot("octo-tab");
  await click("octo-quickstart"); res.layout1280built = await layout(); await shot("quick-A");
  await p.goto(BASE + "/assembly/octopus-guide?plan=B&variant=plus"); await p.waitForSelector("[data-testid=og-toc]"); await p.waitForTimeout(600);
  res.guide1280 = await p.evaluate(() => ({ hOverflow: document.documentElement.scrollWidth > innerWidth + 1, toc: document.querySelectorAll("[data-testid=og-toc] a").length })); await shot("guide-direct-B-plus");
});
fs.writeFileSync(`${OUT}/walk-result.json`, JSON.stringify(res, null, 1));
const pick = (k) => res[k] && { dz: +res[k].dz.toFixed(2), dx: +res[k].dx.toFixed(2), dh: +res[k].dhDeg.toFixed(1), wall: +res[k].wallSec.toFixed(2), sim: +(res[k].simSec ?? 0).toFixed(2), v: res[k].cmPerSimSec && +res[k].cmPerSimSec.toFixed(2), coll: res[k].s1?.coll, pen: res[k].s1?.pen, tether: res[k].tether };
console.log(JSON.stringify({ quickB: pick("quickB"), quickA: pick("quickA"), mdB: pick("mdB"), adv: res.advOpen, guide: res.guide, guide1280: res.guide1280, l1366: res.layout1366, l1280: res.layout1280, l1280b: res.layout1280built, errs: [res.errs1366, res.errs1280] }, null, 1));
await b.close();
