// v19：自适应步长求解器测试（解析解 + 和细步长固定步长对照 + 事件定位）。早期原型，简化仿真。
// 用法：OUT=/tmp/ad node scripts/adaptive-test.mjs
import fs from "node:fs";
import { transient } from "../src/sim/transient.js";
import { benchSpec } from "../src/assembly/octopus/bench.js";
import { octoWiresFromSpec, octoBoard } from "../src/sim/benchNetlist.js";
import { capture } from "../src/repair/tboard.js";
const OUT = process.env.OUT || "/tmp/ad";
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const log = [], rows = [];
const ok = (c, m, d = "") => { (c ? pass++ : fail++); const l = `${c ? "✓" : "✗"} ${m}${d ? " — " + d : ""}`; log.push(l); console.log(l); };
const now = () => performance.now();
const maxErr = (r, f) => { let e = 0; r.t.forEach((t, i) => { e = Math.max(e, Math.abs(r.probes[0].data[i] - f(t))); }); return e; };
// 1 RC 阶跃
const rc = () => [{ t: "V", p: "in", n: "GND", v: (t) => (t > 0 ? 1 : 0), r: 1e-3 }, { t: "R", a: "in", b: "o", r: 1000 }, { t: "C", a: "o", b: "GND", c: 1e-6 }];
const fRC = (t) => (t <= 0 ? 0 : 1 - Math.exp(-t / 1e-3));
const a1 = transient(rc(), { tStart: 0, tStop: 5e-3, dt: 1e-5, init: "zero", probes: [{ id: "o", node: "o" }], adaptive: true });
const f1 = transient(rc(), { tStart: 0, tStop: 5e-3, dt: 1e-5, init: "zero", probes: [{ id: "o", node: "o" }] });
const e1a = maxErr(a1, fRC), e1f = maxErr(f1, fRC);
ok(e1a < 1e-3 && a1.stats.steps < f1.stats.steps / 3, "RC 阶跃（τ = 1 ms）：自适应误差 < 1 mV，步数不到固定步长的 1/3", `误差 ${(e1a * 1e3).toFixed(3)} mV（固定 ${(e1f * 1e3).toFixed(3)} mV），步数 ${a1.stats.steps} vs ${f1.stats.steps}`);
rows.push({ case: "RC 阶跃", adaptErr: e1a, fixedErr: e1f, adaptSteps: a1.stats.steps, fixedSteps: f1.stats.steps });
// 2 RLC 欠阻尼阶跃
const R = 1, L = 1e-3, C = 1e-6, al = R / (2 * L), w0 = 1 / Math.sqrt(L * C), wd = Math.sqrt(w0 * w0 - al * al);
const rlc = () => [{ t: "V", p: "in", n: "GND", v: (t) => (t > 0 ? 1 : 0), r: 1e-6 }, { t: "R", a: "in", b: "m", r: R }, { t: "L", a: "m", b: "q", l: L }, { t: "C", a: "q", b: "GND", c: C }];
const fRLC = (t) => (t <= 0 ? 0 : 1 - Math.exp(-al * t) * (Math.cos(wd * t) + (al / wd) * Math.sin(wd * t)));
let t0 = now(); const a2 = transient(rlc(), { tStart: 0, tStop: 2e-3, dt: 2e-6, init: "zero", probes: [{ id: "q", node: "q" }], adaptive: true }); const ma2 = now() - t0;
t0 = now(); const f2 = transient(rlc(), { tStart: 0, tStop: 2e-3, dt: 2e-6, init: "zero", probes: [{ id: "q", node: "q" }] }); const mf2 = now() - t0;
const e2a = maxErr(a2, fRLC), e2f = maxErr(f2, fRLC);
ok(e2a < 0.03, "RLC 欠阻尼（f0 ≈ 5 kHz，Q ≈ 32）：自适应误差 < 30 mV（峰值 ~2 V）", `误差 ${(e2a * 1e3).toFixed(1)} mV（固定 dt=2 µs：${(e2f * 1e3).toFixed(1)} mV），步数 ${a2.stats.steps} vs ${f2.stats.steps}，${ma2.toFixed(1)} vs ${mf2.toFixed(1)} ms`);
rows.push({ case: "RLC 欠阻尼", adaptErr: e2a, fixedErr: e2f, adaptSteps: a2.stats.steps, fixedSteps: f2.stats.steps });
// 3 开关事件定位：开关在 t = 1.2345 ms 闭合
const tsw = 1.2345e-3;
const sw = () => [{ t: "V", p: "in", n: "GND", v: 1, r: 1e-3 }, { t: "S", a: "in", b: "m", ron: 1e-3, roff: 1e9, on: (t) => t >= tsw }, { t: "R", a: "m", b: "o", r: 1000 }, { t: "C", a: "o", b: "GND", c: 1e-7 }];
const fSW = (t) => (t < tsw ? 0 : 1 - Math.exp(-(t - tsw) / 1e-4));
const a3 = transient(sw(), { tStart: 0, tStop: 2e-3, dt: 2e-5, init: "zero", probes: [{ id: "o", node: "o" }], adaptive: true });
const f3 = transient(sw(), { tStart: 0, tStop: 2e-3, dt: 2e-5, init: "zero", probes: [{ id: "o", node: "o" }] });
const e3a = maxErr(a3, fSW), e3f = maxErr(f3, fSW);
ok(a3.stats.eventRejects > 0 && e3a < e3f, "开关事件：跨事件的大步被退回、用 ≤ dtEvent 的小步走过，误差比固定步长小", `误差 ${(e3a * 1e3).toFixed(1)} vs ${(e3f * 1e3).toFixed(1)} mV，退回 ${a3.stats.eventRejects} 次，最小步 ${(a3.stats.hMin * 1e9).toFixed(1)} ns`);
ok(a3.stats.hMin >= 2e-5 / 2048 * 0.999, "最小步长有下限（dt / 2048）", `${a3.stats.hMin.toExponential(2)} s`);
rows.push({ case: "开关事件", adaptErr: e3a, fixedErr: e3f, adaptSteps: a3.stats.steps, fixedSteps: f3.stats.steps });
// 4 台面电路：自适应 vs 固定（2500 点）vs 细步长固定（25000 点，当“真值”）
const W = octoWiresFromSpec(benchSpec({ variant: "v10" }));
const bench = [];
const cases = [
  ["舵机起步 · 不加电容", { exp: "run", tdiv: 2e-3 }, { caps: { CAP1: 0, CAP2: 0 } }],
  ["开机 · 默认电容", { exp: "power", tdiv: 20e-3 }, {}],
  ["老化电池 · 欠压复位", { exp: "run", tdiv: 2e-3 }, { rint: 0.25, caps: { CAP1: 0, CAP2: 0 } }],
  ["舵机全部堵转 · 升压限流", { exp: "run", tdiv: 10e-3 }, { caps: { CAP1: 0, CAP2: 0 }, stall: true }],
];
for (const [nm, o, ed] of cases) {
  const base = { ...o, run: true, pre: 0.05, trig: { src: 0, slope: "rise", level: 1, mode: "auto" }, chans: [{ node: "CHG:BAT" }, { node: "BST1:OUT" }, { node: "QTPY:BAT" }] };
  const mkb = () => { const b = octoBoard(W, ed).board; if (ed.stall) for (const p of b.parts) if (p.kind === "servo") p.state.stalled = true; return b; };
  const fine = capture(mkb(), { ...base, points: 25000 }), fx = capture(mkb(), base), ad = capture(mkb(), { ...base, adaptive: {} });
  const err = (c) => { let e = 0, j = 0; const tf = fine.t; c.t.forEach((t, i) => { while (j < tf.length - 1 && tf[j + 1] < t) j++; for (const k of [0, 1]) e = Math.max(e, Math.abs(c.ch[k][i] - fine.ch[k][j])); }); return e; };
  const evT = (c, kind) => c.allEvents.filter((e) => e.kind === kind).map((e) => e.t);
  const row = { case: nm, fineMs: fine.ms, fixedMs: fx.ms, adaptMs: ad.ms, fineSteps: fine.stats.steps, fixedSteps: fx.stats.steps, adaptSteps: ad.stats.steps, rejected: ad.stats.rejected, eventRejects: ad.stats.eventRejects, forced: ad.stats.forced, fixedErr: err(fx), adaptErr: err(ad), min5: [fine.meas[1].min, fx.meas[1].min, ad.meas[1].min], resets: [fine.dev.QTPY.resets, fx.dev.QTPY.resets, ad.dev.QTPY.resets], hiccups: [fine.dev.BST1.hiccups, fx.dev.BST1.hiccups, ad.dev.BST1.hiccups], resetT: [evT(fine, "reset"), evT(fx, "reset"), evT(ad, "reset")] };
  bench.push(row);
  ok(row.adaptErr <= row.fixedErr * 1.05 + 1e-3, `${nm}：自适应对“细步长真值”的最大误差不比固定步长大`, `自适应 ${(row.adaptErr * 1e3).toFixed(1)} mV · 固定 ${(row.fixedErr * 1e3).toFixed(1)} mV；耗时 ${ad.ms.toFixed(0)} / ${fx.ms.toFixed(0)} / 细步长 ${fine.ms.toFixed(0)} ms；步数 ${ad.stats.steps} / ${fx.stats.steps} / ${fine.stats.steps}`);
  ok(row.resets[2] === row.resets[0] && row.hiccups[2] === row.hiccups[0], `${nm}：复位 / 打嗝次数和真值一致`, `复位 ${row.resets.join("/")}，打嗝 ${row.hiccups.join("/")}（真值 / 固定 / 自适应）`);
  if (row.resetT[0].length) { const d = Math.max(...row.resetT[0].map((t, i) => Math.abs(t - (row.resetT[2][i] ?? Infinity)))); const df = Math.max(...row.resetT[0].map((t, i) => Math.abs(t - (row.resetT[1][i] ?? Infinity)))); row.resetDtAdapt = d; row.resetDtFixed = df; ok(d < 50e-6, `${nm}：复位时刻和真值差 < 50 µs`, `自适应 ${(d * 1e6).toFixed(1)} µs · 固定 ${(df * 1e6).toFixed(1)} µs`); }
  // 已知：升压模块的限流 / 调节环是“显式”的（每步按上一步的电感电流算），舵机起步那一下的最低点和步长有 ~15 mV 的相关性（细步长 BE 4.949 / 梯形 4.942 V 也差 7 mV），所以这里放宽到 20 mV
  ok(Math.abs(row.min5[2] - row.min5[0]) < 0.02, `${nm}：5V 最低值和真值差 < 20 mV`, `真值 ${row.min5[0].toFixed(4)} · 固定 ${row.min5[1].toFixed(4)} · 自适应 ${row.min5[2].toFixed(4)} V`);
}
fs.writeFileSync(`${OUT}/adaptive-test.json`, JSON.stringify({ pass, fail, analytic: rows, bench, log }, null, 2));
console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
