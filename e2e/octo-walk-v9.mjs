// v9 走查：物理行走（Rapier）。侧面镜头看触手抬起/下压推地；记录速度、接触、导线拉紧提示、零件穿模
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = "/workspace/proto-site/v9", BASE = "http://localhost:4173", FR = `${OUT}/frames`;
fs.rmSync("/tmp/pwv9", { recursive: true, force: true }); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const res = { frames: {} }; let n = 0;
const W = 1366, H = 768;
const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: "/tmp/pwv9", size: { width: W, height: H } } });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const shot = async (name, opts = {}) => { n++; const f = `${OUT}/${String(n).padStart(2, "0")}-${name}.png`; await p.screenshot({ path: f, ...opts }); console.log("shot", f); };
const st = () => p.evaluate(() => { const s = window.__octo.sim.snapshot(); const L = s.loco; return { t: performance.now() / 1000, simT: s.t, pose: s.pose, motion: window.__octo.motion(), coll: s.servos.filter((x) => x.collide).length, bad: s.checks.filter((c) => !c.ok).length, pen: window.__asm.overlapTest().maxPenetrationMm, loco: L && { v: L.v, fwd: L.fwd, perCycle: L.perCycle, slip: L.slip, contacts: L.contacts, load: L.load, y: L.y, bodyLoad: L.bodyLoad, peakTorque: L.peakTorque, sinkMm: L.pen * 10 } }; });
const waitBuilt = async () => { await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await p.waitForTimeout(2500); };
const click = async (t) => { await p.evaluate(() => { window.__octoBuilt = null; }); await p.click(`[data-testid=${t}]`); await waitBuilt(); };
const canvas = p.locator("canvas").first();
// 侧面镜头跟着机身：每张截图前重新对准
const side = () => p.evaluate(() => window.__octo.cam("walk"));
const frames = async (tag, k = 8, dt = 250) => { const out = []; for (let i = 0; i < k; i++) { await side(); const f = `${FR}/${tag}-${i}.png`; await canvas.screenshot({ path: f }); out.push({ f, ...(await st()) }); await p.waitForTimeout(dt); } return out; };
const ui = () => p.evaluate(() => { const q = (t) => document.querySelector(`[data-testid=${t}]`)?.textContent?.trim() || null; return { box: !!document.querySelector("[data-testid=octo-loco]"), v: q("loco-v"), cyc: q("loco-cyc"), slip: q("loco-slip"), contacts: q("loco-contacts"), legs: q("loco-legs"), tether: q("octo-tether") }; });
await p.goto(BASE + "/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await p.waitForTimeout(1500);
await shot("octo-tab");
for (const k of ["B", "A"]) {
  await click(k === "B" ? "octo-quickstart-B" : "octo-quickstart");
  await side(); await p.waitForTimeout(800); await shot(`plus-${k}-side-start`);
  const s0 = await st();
  res.frames[k] = await frames(`plus-${k}-side`, 10, 250);
  await shot(`plus-${k}-side-walking`);
  await p.waitForTimeout(3000); await side(); await p.waitForTimeout(400);
  const s1 = await st(); res[`ui${k}`] = await ui();
  await shot(`plus-${k}-side-later`);
  await p.locator("[data-testid=octo-loco]").screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-plus-${k}-loco-box.png` }).catch(() => {});
  res[`plus${k}`] = { s0, s1, dz: s1.pose.z - s0.pose.z, dx: s1.pose.x - s0.pose.x, dhDeg: ((s1.pose.h - s0.pose.h) * 180) / Math.PI, wallSec: s1.t - s0.t, simSec: s1.simT - s0.simT, cmPerSimSec: (s0.pose.z - s1.pose.z) / Math.max(1e-6, s1.simT - s0.simT) };
  await p.click("[data-testid=cam-top]"); await p.waitForTimeout(1200); await shot(`plus-${k}-top-trace`);
  await p.click("[data-testid=ser-STOP]");
}
// 摩擦 μ=0：只走 2 s，应原地打滑
await click("octo-quickstart-B"); await p.waitForTimeout(500);
await p.evaluate(() => { const el = document.querySelector("[data-testid=loco-mu] input, input[data-testid=loco-mu]"); if (el) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "0"); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } });
await p.waitForTimeout(1500); const z0 = await st(); await p.waitForTimeout(3000); const z1 = await st();
res.mu0 = { uiMu: await p.evaluate(() => document.querySelector("[data-testid=loco-mu-v]")?.textContent?.trim()), physMu: await p.evaluate(() => window.__octo.sim.phys?.mu), dz: z1.pose.z - z0.pose.z, dx: z1.pose.x - z0.pose.x, simSec: z1.simT - z0.simT };
await side(); await shot("plus-B-mu0-slipping");
// md B：没有支撑相下压，原地踏步
await click("octo-preset-B"); await p.click("[data-testid=ser-GO]"); await p.waitForTimeout(800); const m0 = await st(); await p.waitForTimeout(4000); const m1 = await st();
res.mdB = { dz: m1.pose.z - m0.pose.z, dx: m1.pose.x - m0.pose.x, simSec: m1.simT - m0.simT, loco: m1.loco }; await side(); await shot("md-B-side-no-advance");
res.errs = errs; await ctx.close(); await b.close();
fs.writeFileSync(`${OUT}/walk-result.json`, JSON.stringify(res, null, 1));
const pick = (k) => res[k] && { dz: +res[k].dz.toFixed(2), dx: +res[k].dx.toFixed(2), dh: res[k].dhDeg != null ? +res[k].dhDeg.toFixed(1) : undefined, wall: res[k].wallSec && +res[k].wallSec.toFixed(1), sim: +res[k].simSec.toFixed(2), v: res[k].cmPerSimSec && +res[k].cmPerSimSec.toFixed(2), coll: res[k].s1?.coll, pen: res[k].s1?.pen, loco: res[k].s1?.loco, taut: res[k].s1?.motion?.taut };
console.log(JSON.stringify({ plusB: pick("plusB"), plusA: pick("plusA"), uiB: res.uiB, uiA: res.uiA, mu0: res.mu0, mdB: { dz: res.mdB.dz, dx: res.mdB.dx, sim: res.mdB.simSec }, errs }, null, 1));
