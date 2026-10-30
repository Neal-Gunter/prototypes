// v15：多工况鲁棒搜索 + 横坡侧滑补偿 + Worker 池走查。① 八爪鱼 v10：v15 预设 → 同一任务单线程 vs Worker 池（评估/秒、结果逐位相同）
// → “多工况鲁棒”目标 + 定向小轮 + 留出工况复评 → 横坡侧滑对比面板（5 组）→ 台面支点下拉框实时换 → 录屏 → demo.mp4
// 用法：npx vite preview --port 4173 & ; node e2e/v15-bench.mjs（BASE / OUT / SHOTS=0 可改）
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v15", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv15";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const L = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) await p.locator(`[data-testid=${t}]`).screenshot({ path: f }); else await p.screenshot({ path: f }); };
const into = (t) => L((t) => document.querySelector(`[data-testid=${t}]`)?.scrollIntoView({ block: "start", behavior: "instant" }), t);
const T = "octo-search";
const S = () => L((t) => { const s = window.__gaitSearch?.[t]; return s && { running: s.running, evals: s.evals, err: s.err || null, job: s.job, done: s.done ? { evals: s.done.evals, sec: s.done.sec, stopped: s.done.stopped, base: s.done.base?.score, pool: s.done.pool, conds: s.done.conds, robust: s.done.robust ? { heldOut: s.done.robust.heldOut, base: s.done.robust.base && { speedMin: s.done.robust.base.speedMin, speedMean: s.done.robust.base.speedMean, driftMax: s.done.robust.base.driftMax }, best: s.done.robust.best && { speedMin: s.done.robust.best.speedMin, speedMean: s.done.robust.best.speedMean, driftMax: s.done.robust.best.driftMax } } : null } : null, best: s.best && { score: s.best.score, maxRate: s.best.maxRate } }; }, T);
const check = async (t, want) => { const c = p.locator(`[data-testid=${t}]`); if ((await c.isChecked()) !== want) await c.click(); };
async function search({ cap = "40", seed = "3", obj = "speed", pool = true, robust = false, caster = "ball" }) {
  await p.selectOption(`[data-testid=${T}-obj]`, obj); await wait(100);
  await p.locator(`[data-testid=${T}-seed]`).fill(seed); await p.selectOption(`[data-testid=${T}-cap]`, cap);
  await check(`${T}-robust`, robust); await check(`${T}-pool`, pool); await p.selectOption(`[data-testid=${T}-caster]`, caster);
  const t0 = Date.now(); await p.click(`[data-testid=${T}-start]`);
  await p.waitForFunction((t) => window.__gaitSearch?.[t]?.running === false || window.__gaitSearch?.[t]?.done, T, { timeout: 30000 }).catch(() => {});
  await p.waitForFunction((t) => { const s = window.__gaitSearch?.[t]; return s && !s.running; }, T, { timeout: 900000 });
  const s = await S(); s.wall = (Date.now() - t0) / 1000; s.simsPerSec = s.done ? (s.done.evals * (s.done.conds || 1)) / s.done.sec : null; return s;
}

await p.goto(BASE + "/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await wait(1500);
await L(() => { window.__octoBuilt = null; }); await p.click("[data-testid=octo-preset-v10]");
await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await wait(1500);
await p.waitForSelector(`[data-testid=${T}-panel]`, { timeout: 20000 });
const hc = await L(() => navigator.hardwareConcurrency); res.hardwareConcurrency = hc;
ok(await p.locator("[data-testid=octo-gait-preset-v15]").count() === 1, "步态编辑器多了“v15 多工况鲁棒”预设");
ok(await p.locator(`[data-testid=${T}-obj] option[value=robust]`).count() === 1, "搜索目标多了“多工况鲁棒（v15）”");
// ① 单线程 vs Worker 池：同一任务（速度优先，40 次，种子 3，起点 = 同步划桨）
await p.click("[data-testid=octo-gait-preset-row]"); await wait(200); await into(`${T}-panel`);
const s1 = await search({ pool: false }), s2 = await search({ pool: true });
res.poolBench = { before: { pool: s1.done?.pool, evals: s1.done?.evals, sec: s1.done?.sec, evalsPerSec: s1.simsPerSec, score: s1.best?.score }, after: { pool: s2.done?.pool, evals: s2.done?.evals, sec: s2.done?.sec, evalsPerSec: s2.simsPerSec, score: s2.best?.score } };
ok(s1.done && s2.done && !s1.err && !s2.err && s2.done.pool === hc, `Worker 池用了 navigator.hardwareConcurrency = ${hc} 个评估 Worker`);
ok(s2.best.score === s1.best.score, "单线程和 Worker 池结果逐位相同", `${s1.best.score} / ${s2.best.score}`);
ok(s2.simsPerSec > s1.simsPerSec * 1.5, "Worker 池评估速度提高 1.5 倍以上", `${s1.simsPerSec.toFixed(2)} → ${s2.simsPerSec.toFixed(2)} 次/s`);
await shot("pool-speed", `${T}-panel`);
// ② 多工况鲁棒 + 定向小轮 + 留出工况复评（40 次 × 6 工况）
await p.selectOption(`[data-testid=${T}-obj]`, "robust"); await wait(100);
ok(await p.locator(`[data-testid=${T}-robust-note]`).count() === 1 && await p.locator(`[data-testid=${T}-heldout]`).count() === 1, "选鲁棒目标后出现说明和“留出工况”复选框");
await check(`${T}-heldout`, true);
const s3 = await search({ obj: "robust", robust: true, caster: "wheel", seed: "1" }); res.robustSearch = { evals: s3.done?.evals, conds: s3.done?.conds, sec: s3.done?.sec, simsPerSec: s3.simsPerSec, best: s3.best, robust: s3.done?.robust };
ok(s3.done && s3.done.conds === 6 && s3.best.maxRate <= 240.5, "鲁棒搜索：每个候选 6 个工况，结果最大角速度 ≤ 240 °/s", `${s3.done?.evals} 次 × ${s3.done?.conds}，${s3.simsPerSec?.toFixed(2)} 次仿真/s，maxRate ${s3.best?.maxRate?.toFixed(0)}`);
ok(s3.done?.robust?.heldOut && await p.locator(`[data-testid=${T}-robust-table]`).count() === 1, "留出工况复评表（11 个工况）", JSON.stringify(s3.done?.robust));
await shot("robust-heldout", `${T}-panel`);
// ③ 横坡侧滑对比
await p.click("[data-testid=octo-gait-preset-row]"); await wait(200);
await into("octo-slip");
await p.click("[data-testid=octo-slip-run]");
await p.waitForFunction(() => window.__octoSlip?.length === 5, null, { timeout: 600000 });
const sl = await L(() => window.__octoSlip.map((r) => ({ k: r.k, dx: +r.dx.toFixed(2), dh: +r.dh.toFixed(1), speed: +r.speed.toFixed(3) }))); res.slip = sl;
const by = Object.fromEntries(sl.map((r) => [r.k, r]));
ok(Math.abs(by["wheel-open"].dx) < Math.abs(by["ball-open"].dx) / 3, "3° 横坡：定向小轮侧漂降到万向珠的 1/3 以下", `${by["ball-open"].dx} → ${by["wheel-open"].dx} cm`);
ok(Math.abs(by["wheel-path"].dx) < Math.abs(by["wheel-open"].dx) * 0.6, "路径保持 PI 再降 40% 以上（代价：速度）", `${by["wheel-open"].dx} cm @ ${by["wheel-open"].speed} → ${by["wheel-path"].dx} cm @ ${by["wheel-path"].speed} cm/s`);
ok(Math.abs(by["ball-ctrl"].dx) > 20, "诚实对照：万向珠 + v14 闭环仍然漂 20 cm 以上", `${by["ball-ctrl"].dx} cm`);
await shot("slip-table", "octo-slip");
// ④ 台面支点实时换
await p.selectOption("[data-testid=octo-slip-caster]", "wheel"); await wait(200);
ok(await L(() => window.__octo.sim.phys.casterKind) === "wheel", "台面支点下拉框：3D 台面里的支点换成定向小轮");
await p.click("[data-testid=octo-gait-preset-v15]"); await wait(200);
const z0 = await L(() => window.__octo.sim.phys.snapshot().fwd);
await p.click("[data-testid=octo-gait-run]"); await L(() => window.__octo.cam("overview")); await wait(8000);
const z1 = await L(() => window.__octo.sim.phys.snapshot().fwd); res.v15Run = +(z1 - z0).toFixed(2);
ok(z1 - z0 > 8, "v15 预设 + 定向小轮在台面上往前爬", `8 s 前进 ${(z1 - z0).toFixed(1)} cm`);
await L(() => window.scrollTo(0, 0)); await shot("octo-v15-running");
await p.click("[data-testid=octo-gait-stop]");
{ const pt = await p.locator("[data-testid=pen-readout]").innerText(); const mx = +(/本次最深 ([\d.]+)/.exec(pt)?.[1] ?? 99); res.penMaxMm = mx; ok(mx < 0.5, "整段不穿模", `本次最深 ${mx} mm`); }
ok(!errs.length, "没有页面错误", errs.join(" | "));
fs.writeFileSync(`${OUT}/logs/v15-bench-results.json`, JSON.stringify(res, null, 1));
await ctx.close(); await b.close();
if (SHOT) {
  const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm"));
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "setpts=0.25*PTS,scale=1280:-2,fps=24" -an -c:v libx264 -crf 32 -preset veryfast -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4`); console.log("demo.mp4", (fs.statSync(`${OUT}/demo.mp4`).size / 1e6).toFixed(1), "MB"); }
}
console.log(`\nv15 e2e：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
