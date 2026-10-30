// v10 走查（我的补充）：紧凑无线版。装好看机身（电池在身上、没有桌上的线）→ 一键 GO 物理爬 → μ=0 不走 → 低电停运动 → 和 v9 方案B 同一镜头对比大小
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const OUT = "/workspace/proto-site/v10", BASE = process.env.BASE || "http://localhost:4173", FR = `${OUT}/frames`, VID = "/tmp/pwv10";
fs.rmSync(VID, { recursive: true, force: true }); for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) if (/\.(png|mp4|json|zip)$/.test(f)) fs.rmSync(`${OUT}/${f}`); fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const W = 1366, H = 768, res = {}; let n = 0;
const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: VID, size: { width: W, height: H } } });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const name = (s) => `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`;
const shot = async (s) => { const f = name(s); await p.screenshot({ path: f }); console.log("shot", f); };
const el = async (t, s) => { const f = name(s); await p.locator(`[data-testid=${t}]`).screenshot({ path: f }).catch((e) => console.log("skip", t, e.message.slice(0, 80))); };
const cam = (k) => p.evaluate((k) => window.__octo.cam(k), k);
const waitBuilt = async () => { await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await p.waitForTimeout(2000); };
const click = async (t) => { await p.evaluate(() => { window.__octoBuilt = null; }); await p.click(`[data-testid=${t}]`); await waitBuilt(); };
const st = () => p.evaluate(() => { const s = window.__octo.sim.snapshot(); const L = s.loco; return { simT: s.t, pose: s.pose, espOn: s.espOn, boots: s.boots, halted: s.halted, rails: s.rails, pBatAvg: s.pBatAvg, peakI: s.peakI, coll: s.servos.filter((x) => x.collide).length, errs: s.checks.filter((c) => !c.ok && c.level === "err").map((c) => c.zh), warns: s.checks.filter((c) => !c.ok && c.level === "warn").map((c) => c.zh), pen: window.__asm.overlapTest().maxPenetrationMm, log: s.log.slice(-6), events: s.events.slice(-4).map((e) => e.zh), loco: L && { v: L.v, fwd: L.fwd, perCycle: L.perCycle, slip: L.slip, contacts: L.contacts, y: L.y, bodyLoad: L.bodyLoad, mass: L.mass, sinkMm: L.pen * 10 } }; });
// 机身包络：和骨架同一个刚体的全部零件的碰撞盒（建好时的姿态）。只算“随身”的零件；桌上的零件、桌面不算
const envelope = () => p.evaluate(() => {
  const E = window.__asm.engine, parts = [...E.parts.values()], fr = parts.find((q) => /^p-octo-frame/.test(q.def.id));
  if (!fr) return null;
  const mine = parts.filter((q) => q.body === fr.body), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], c = E.worldPose(fr.uid).p;
  let rMax = 0;
  for (const q of mine) { const w = E.worldPose(q.uid); for (const k of q.def.colliders || []) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = new w.p.constructor(k.c[0] + sx * k.h[0], k.c[1] + sy * k.h[1], k.c[2] + sz * k.h[2]).applyQuaternion(w.q).add(w.p);
    lo[0] = Math.min(lo[0], v.x); lo[1] = Math.min(lo[1], v.y); lo[2] = Math.min(lo[2], v.z); hi[0] = Math.max(hi[0], v.x); hi[1] = Math.max(hi[1], v.y); hi[2] = Math.max(hi[2], v.z);
    rMax = Math.max(rMax, Math.hypot(v.x - c.x, v.z - c.z));
  } }
  const onBody = mine.length, all = parts.filter((q) => q.def.id !== "bench").length;
  const cablesOff = E.cables.filter((cb) => cb.endUids.length > 1 && cb.endUids.some((u) => E.parts.get(u)?.body !== fr.body)).length;
  return { span: +(2 * rMax).toFixed(1), x: +(hi[0] - lo[0]).toFixed(1), z: +(hi[2] - lo[2]).toFixed(1), h: +(hi[1] - lo[1]).toFixed(1), cyl: Math.round(Math.PI * rMax * rMax * (hi[1] - lo[1])), onBody, parts: all, cables: E.cables.length, cablesOffBody: cablesOff };
});
await p.goto(BASE + "/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await p.waitForTimeout(1500);
await shot("octo-tab-v10-buttons");
// ① 装好（不走）：看机身
await click("octo-preset-v10");
res.built = await p.evaluate(() => window.__octoBuilt); res.env10 = await envelope();
await cam("body"); await p.waitForTimeout(900); await shot("v10-body-closeup");
await cam("top"); await p.waitForTimeout(900); await shot("v10-top");
await cam("overview"); await p.waitForTimeout(900); await shot("v10-overview-no-desk-wires");
await el("octo-power", "v10-power-onboard-battery");
res.idle = await st();
// ② 一键 GO：近侧视跟着机身爬
await click("octo-quickstart-v10");
await p.waitForTimeout(1500); const s0 = await st();
for (let i = 0; i < 8; i++) { await cam("near"); await p.locator("canvas").first().screenshot({ path: `${FR}/near-${i}.png` }); await p.waitForTimeout(300); }
await cam("near"); await shot("v10-walking-near-side");
await p.waitForTimeout(6000); await cam("body"); await p.waitForTimeout(500); await shot("v10-walking-body");
const s1 = await st();
res.walk = { s0, s1, dz: s1.pose.z - s0.pose.z, dx: s1.pose.x - s0.pose.x, dhDeg: ((s1.pose.h - s0.pose.h) * 180) / Math.PI, simSec: s1.simT - s0.simT };
res.walk.cmPerSimSec = -res.walk.dz / Math.max(1e-6, res.walk.simSec);
await p.click("[data-testid=cam-top]"); await p.waitForTimeout(1000); await shot("v10-top-trace");
await el("octo-loco", "v10-loco-box"); await el("octo-power", "v10-power-walking-runtime");
res.ui = await p.evaluate(() => ({ onboard: document.querySelector("[data-testid=octo-v10-onboard]")?.textContent, tether: !!document.querySelector("[data-testid=octo-tether]") }));
await p.click("[data-testid=ser-STOP]");
// ③ μ = 0：只靠摩擦走，没摩擦就不走
await click("octo-quickstart-v10"); await p.waitForTimeout(400);
await p.evaluate(() => { const e = document.querySelector("input[data-testid=loco-mu]"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(e, "0"); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
await p.waitForTimeout(1500); const z0 = await st(); await p.waitForTimeout(4000); const z1 = await st();
res.mu0 = { physMu: await p.evaluate(() => window.__octo.sim.phys?.mu), dz: z1.pose.z - z0.pose.z, dx: z1.pose.x - z0.pose.x, simSec: z1.simT - z0.simT, slip: z1.loco?.slip };
await cam("near"); await shot("v10-mu0-slipping-in-place");
// ④ 低电：3.55 V 停运动（估算阈值）
await p.evaluate(() => { window.__octoBuilt = null; return window.__octo.build({ plan: "A", phase: 3, fault: "lowbat", variant: "v10", mode: "ino", go: true, cam: "body" }); }); await waitBuilt(); await p.waitForTimeout(4000);
res.lowbat = await st(); await el("octo-power", "v10-lowbat-stop");
// ⑤ 同一个镜头看 v9 方案B（449 g）——大小对比
await click("octo-preset-B-plus"); res.env9 = await envelope(); res.built9 = await p.evaluate(() => window.__octoBuilt);
await cam("body"); await p.waitForTimeout(900); await shot("v9B-same-camera-for-size");
await cam("overview"); await p.waitForTimeout(900); await shot("v9B-overview-desk-wires");
await click("octo-preset-v10"); await cam("body"); await p.waitForTimeout(900); await shot("v10-same-camera-for-size");
res.errs = errs; await ctx.close(); await b.close();
fs.writeFileSync(`${OUT}/walk-result.json`, JSON.stringify(res, null, 1));
const vid = fs.readdirSync(VID).find((f) => f.endsWith(".webm"));
if (vid) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${vid} -vf "scale=1280:-2,fps=20" -c:v libx264 -preset veryfast -crf 32 -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4`); console.log("demo.mp4", (fs.statSync(`${OUT}/demo.mp4`).size / 1e6).toFixed(1), "MB"); }
console.log(JSON.stringify({ built: res.built, env10: res.env10, env9: res.env9, built9: res.built9, walk: { dz: +res.walk.dz.toFixed(2), dx: +res.walk.dx.toFixed(2), dh: +res.walk.dhDeg.toFixed(1), sim: +res.walk.simSec.toFixed(1), v: +res.walk.cmPerSimSec.toFixed(2), loco: s1.loco, pen: s1.pen, coll: s1.coll, boots: s1.boots, errs: s1.errs, pBatAvg: s1.pBatAvg }, ui: res.ui, mu0: res.mu0, lowbat: { halted: res.lowbat.halted, log: res.lowbat.log, events: res.lowbat.events, vbat: res.lowbat.rails?.vbat, boots: res.lowbat.boots }, errs }, null, 1));
