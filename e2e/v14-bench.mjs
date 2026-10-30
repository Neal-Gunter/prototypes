// v14：自动步态搜索 + 闭环反馈走查。① 八爪鱼（v10）：v14 预设 → Worker 里 CMA-ES 搜索（进度图 / 至今最好 / 取消）→ 应用 → 台面预览 → 导出 JSON / .h
// → 闭环：3° 横坡 + 负载 开环 vs 闭环 → 台面上实时闭环 → 导出 octopus_ctrl_custom.h；② 模型实验室四足：搜索 + 闭环（8° 横坡 + 掉块）。录屏 → demo.mp4
// 用法：npx vite preview --port 4173 & ; node e2e/v14-bench.mjs（BASE / OUT / SHOTS=0 可改）
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v14", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv14";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const L = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) await p.locator(`[data-testid=${t}]`).screenshot({ path: f }); else await p.screenshot({ path: f }); };
const into = (t) => L((t) => document.querySelector(`[data-testid=${t}]`)?.scrollIntoView({ block: "start", behavior: "instant" }), t);
async function dl(t) { const [d] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.click(`[data-testid=${t}]`)]); const f = `${OUT}/${d.suggestedFilename()}`; await d.saveAs(f); return { f, text: fs.readFileSync(f, "utf8") }; }
const S = (tid) => L((t) => { const s = window.__gaitSearch?.[t]; return s && { running: s.running, gen: s.gen, evals: s.evals, cancelled: !!s.cancelled, err: s.err || null, done: s.done ? { evals: s.done.evals, stopped: s.done.stopped, base: s.done.base?.score, robust: !!s.done.robust } : null, best: s.best && { score: s.best.score, r: s.best.r, name: s.best.g?.name }, hist: s.hist?.length }; }, tid);
async function search(tid, { cap = "40", robust = false, seed = "3", obj } = {}) {
  if (obj) await p.selectOption(`[data-testid=${tid}-obj]`, obj);
  await p.locator(`[data-testid=${tid}-seed]`).fill(seed);
  await p.selectOption(`[data-testid=${tid}-cap]`, cap);
  const rc = p.locator(`[data-testid=${tid}-robust]`); if ((await rc.isChecked()) !== robust) await rc.click();
  const t0 = Date.now();
  await p.click(`[data-testid=${tid}-start]`);
  await p.waitForFunction((t) => window.__gaitSearch?.[t]?.gen >= 1, tid, { timeout: 120000 });
  const mid = await S(tid);
  await p.waitForFunction((t) => { const s = window.__gaitSearch?.[t]; return s && !s.running; }, tid, { timeout: 600000 });
  return { mid, end: await S(tid), wall: (Date.now() - t0) / 1000 };
}
async function compare(tid) {
  await p.click(`[data-testid=${tid}-compare]`);
  await p.waitForFunction((t) => window.__ctrlLast?.[t] && !document.querySelector(`[data-testid=${t}-busy]`), tid, { timeout: 600000 });
  const r = await L((t) => window.__ctrlLast[t], tid); await L((t) => { delete window.__ctrlLast[t]; }, tid); return r;
}
const pick = (r) => r && { speed: +r.speed?.toFixed(3), dx: +r.dx?.toFixed(2), dh: +r.dh?.toFixed(1), tiltGMax: +(r.tiltGMax ?? 0).toFixed(2), tiltGAvg: +(r.tiltGAvg ?? 0).toFixed(2) };

// ① 八爪鱼
await p.goto(BASE + "/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await wait(1500);
await L(() => { window.__octoBuilt = null; }); await p.click("[data-testid=octo-preset-v10]");
await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 120000 }); await wait(1500);
await p.waitForSelector("[data-testid=octo-search-panel]", { timeout: 20000 });
ok(await p.locator("[data-testid=octo-gait-preset-v14]").count() === 1, "步态编辑器多了“v14 自动搜索（速度优先）”预设");
await p.click("[data-testid=octo-gait-preset-row]"); await wait(200);
ok((await p.locator("[data-testid=octo-search-obj] option").count()) >= 5, "目标可选：速度 / 直线 / 稳定 / 省电 / 加权混合");
await p.selectOption("[data-testid=octo-search-obj]", "mix"); await wait(100);
ok(await p.locator("[data-testid^=octo-search-w-]").count() === 4, "加权混合：4 个权重滑块");
await p.selectOption("[data-testid=octo-search-obj]", "speed");
await into("octo-search-panel");
const o1 = await search("octo-search", { cap: "120", seed: "2" }); res.octoSearch = o1;
ok(o1.mid.running && o1.mid.gen >= 1 && o1.mid.hist >= 1, "Worker 在后台搜索：搜索中页面不卡，进度（代数 / 评估次数）实时更新", JSON.stringify(o1.mid));
ok(o1.end.done && o1.end.done.evals >= 100 && !o1.end.err, "到算力上限（120 次）自动停下", `${o1.end.done?.evals} 次，${o1.wall.toFixed(0)} s，${o1.end.done?.stopped}`);
ok(o1.end.best.score >= o1.end.done.base - 1e-9, "至今最好 ≥ 起点（起点 = 编辑器当前步态）", `${o1.end.done.base} → ${o1.end.best.score}`);
ok(await p.locator("[data-testid=octo-search-chart] path").count() >= 1, "进度图（最好 / 平均）画出来了");
await shot("octo-search-done", "octo-search-panel");
const sj = await dl("octo-search-export-json"); fs.renameSync(sj.f, `${OUT}/octo-search.json`);
const sjo = JSON.parse(sj.text);
ok(sjo.schema === "proto-gait/1" && sjo.joints.length === 8 && sjo.search?.evals >= 100, "导出 JSON（proto-gait/1 + 搜索元数据）");
const sh = await dl("octo-search-export-h");
ok(/#pragma once/.test(sh.text) && /namespace/.test(sh.text), "导出固件头文件（同一份 toFirmwareHeader）", sh.f);
await p.click("[data-testid=octo-search-apply]"); await wait(300);
ok(/搜索|v14/.test(await p.locator("[data-testid=octo-gait-name]").innerText()), "应用到编辑器：步态名字变成搜索结果", await p.locator("[data-testid=octo-gait-name]").innerText());
// 取消
const o2t = Date.now();
await p.click("[data-testid=octo-search-start]");
await p.waitForFunction(() => window.__gaitSearch?.["octo-search"]?.evals >= 3, null, { timeout: 60000 });
await p.click("[data-testid=octo-search-cancel]");
await p.waitForFunction(() => !window.__gaitSearch?.["octo-search"]?.running, null, { timeout: 10000 });
const o2 = await S("octo-search");
ok(!o2.running && (o2.cancelled || /取消/.test(o2.done?.stopped || "")), "取消：Worker 停下（最多 3 s 后强制结束）", `${((Date.now() - o2t) / 1000).toFixed(1)} s，${o2.evals} 次`);
// 台面预览 v14 预设
await p.click("[data-testid=octo-gait-preset-v14]"); await wait(200);
const z0 = await L(() => window.__octo.sim.phys.snapshot().fwd);
await p.click("[data-testid=octo-gait-run]"); await L(() => window.__octo.cam("overview")); await wait(8000);
const z1 = await L(() => window.__octo.sim.phys.snapshot().fwd);
ok(z1 - z0 > 10, "v14 预设在台面上跑：页面上的八爪鱼往前爬", `8 s 前进 ${(z1 - z0).toFixed(1)} cm`); res.octoV14Run = +(z1 - z0).toFixed(2);
await L(() => window.scrollTo(0, 0)); await shot("octo-v14-running");
await p.click("[data-testid=octo-gait-stop]");
// 闭环
await into("octo-ctrl-panel");
ok(await p.locator("[data-testid=octo-ctrl-gains] input[type=range]").count() === 4, "闭环：4 个增益滑块（航向 Kp / Kd、倾斜 Kp / Kd）");
await p.locator("[data-testid=octo-ctrl-slope]").fill("3"); await p.selectOption("[data-testid=octo-ctrl-dir]", "cross");
const c1 = await compare("octo-ctrl"); res.octoSlope3 = { open: pick(c1.open), closed: pick(c1.closed) };
ok(Math.abs(c1.closed.dh) < Math.abs(c1.open.dh) * 0.75, "3° 横坡（v14 步态）：闭环航向偏差比开环小 25% 以上（侧滑不修）", `开环 ${c1.open.dh.toFixed(1)}° / ${c1.open.dx.toFixed(1)} cm → 闭环 ${c1.closed.dh.toFixed(1)}° / ${c1.closed.dx.toFixed(1)} cm`);
await shot("octo-ctrl-slope", "octo-ctrl-panel");
await p.locator("[data-testid=octo-ctrl-slope]").fill("0"); await p.click("[data-testid=octo-ctrl-load]");
const c2 = await compare("octo-ctrl"); res.octoLoad = { open: pick(c2.open), closed: pick(c2.closed) };
ok(Math.abs(c2.closed.dh) < Math.abs(c2.open.dh), "平地 + 2 s 时右侧加 30 g：闭环航向偏差更小", `开环 ${c2.open.dh.toFixed(1)}° → 闭环 ${c2.closed.dh.toFixed(1)}°`);
await p.click("[data-testid=octo-ctrl-load]");
await p.locator("[data-testid=octo-ctrl-slope]").fill("3");
await p.click("[data-testid=octo-ctrl-live]"); await p.click("[data-testid=octo-gait-run]"); await wait(6000);
const live = await L(() => { const S = window.__octo.sim; return { slope: S.phys?.slope?.deg ?? null, ctrl: !!S.rt?.body?.ctrl_, out: S.rt?.body?.ctrlOut ? { u: +S.rt.body.ctrlOut.u.toFixed(3), roll: +S.rt.body.ctrlOut.roll.toFixed(2) } : null }; });
await L(() => window.scrollTo(0, 0)); await shot("octo-ctrl-live");
ok(live.slope === 3 && live.ctrl && live.out && Math.abs(live.out.roll) > 1, "台面上打开闭环 + 3° 坡度（实时）：控制器在跑、IMU 读到横滚", JSON.stringify(live));
await p.click("[data-testid=octo-gait-stop]"); await p.click("[data-testid=octo-ctrl-live]");
{ const pt = await p.locator("[data-testid=pen-readout]").innerText(); const mx = +(/本次最深 ([\d.]+)/.exec(pt)?.[1] ?? 99); const wr = await L(() => window.__octo.sim.phys.wraps);
  res.octoBench = { penMaxMm: mx, wraps: wr };
  ok(mx < 0.5 && wr >= 1, "台面上一共走了 30+ cm：走到台边自动搬回起点，整段不穿模（不会走出 60×40 cm 台面掉下去）", `本次最深 ${mx} mm，搬回 ${wr} 次`); }
const ch = await dl("octo-ctrl-export-h");
ok(/ctrl_cfg/.test(ch.text) && /kKpH/.test(ch.text), "导出 octopus_ctrl_custom.h（固件 MPU-6050 闭环用）", ch.f);

// ② 四足
await p.goto(`${BASE}/assembly/model?demo=quad`);
await p.waitForFunction(() => window.__lab?.meshes > 0 && !window.__lab.busy, null, { timeout: 90000 }); await wait(1000);
await p.click("[data-testid=sim-toggle]"); await p.waitForFunction(() => window.__labSim, null, { timeout: 30000 });
await p.waitForSelector("[data-testid=lab-search-panel]", { timeout: 20000 }); await wait(500);
await into("lab-search-panel");
const q1 = await search("lab-search", { cap: "120", seed: "1", robust: true }); res.quadSearch = q1;
ok(q1.end.done && !q1.end.err && q1.end.best.score >= q1.end.done.base - 1e-9, "四足（上传模型）也能在 Worker 里搜索：结果 ≥ 起点", `${q1.end.done?.base} → ${q1.end.best?.score}，${q1.end.done?.evals} 次，${q1.wall.toFixed(0)} s`);
ok(q1.end.done.robust && await p.locator("[data-testid=lab-search-robust-table]").count() === 1, "鲁棒性复评表（μ / 质量 / 种子）");
await shot("quad-search-done", "lab-search-panel");
await p.click("[data-testid=lab-search-apply]"); await wait(300);
await into("lab-ctrl-panel");
await p.locator("[data-testid=lab-ctrl-slope]").fill("8"); await p.selectOption("[data-testid=lab-ctrl-dir]", "cross");
const c3 = await compare("lab-ctrl"); res.quadSlope8 = { open: pick(c3.open), closed: pick(c3.closed) };
ok(c3.closed.tiltGAvg < c3.open.tiltGAvg, "四足 8° 横坡：闭环平均倾角更小", `${c3.open.tiltGAvg.toFixed(2)}° → ${c3.closed.tiltGAvg.toFixed(2)}°`);
await shot("quad-ctrl-slope", "lab-ctrl-panel");
const pen = await L(() => window.__labSim.pen());
ok(pen.mm < 0.5, "跑完不穿模", JSON.stringify(pen));
ok(!errs.length, "没有页面错误", errs.join(" | "));
fs.writeFileSync(`${OUT}/logs/v14-bench-results.json`, JSON.stringify(res, null, 1));
await ctx.close(); await b.close();
if (SHOT) {
  const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm"));
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "setpts=0.5*PTS,scale=1280:-2,fps=24" -an -c:v libx264 -crf 32 -preset veryfast -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4`); console.log("demo.mp4", (fs.statSync(`${OUT}/demo.mp4`).size / 1e6).toFixed(1), "MB"); }
}
console.log(`\nv14 e2e：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
