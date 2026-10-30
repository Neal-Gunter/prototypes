// v20：升压模块平均值模型校验。早期原型，简化仿真。
//   A. 和开关级参考电路（真实 PWM 开关管 + 整流二极管 + 电感 + 输出电容 + 积分调压）比稳态：输出电压、输入电流、效率，9 个工作点。
//   B. 单独的升压模块 + 0.2 A → 1.0 A 负载阶跃：不同步长下的最低点（旧模型 legacy vs 新模型 avg）。
//   C. 台面电路“舵机起步 · 不加电容”：不同点数 / 自适应下 5V 最低点（旧 vs 新），这是 v19 报的 ~20 mV 那个数。
// 用法：OUT=/tmp/ba node scripts/boost-avg-test.mjs
import fs from "node:fs";
import { transient } from "../src/sim/transient.js";
import { boost, BOOST_MODEL, boostLossK } from "../src/sim/devices.js";
import { benchSpec } from "../src/assembly/octopus/bench.js";
import { octoWiresFromSpec, octoBoard } from "../src/sim/benchNetlist.js";
import { capture } from "../src/repair/tboard.js";
const OUT = process.env.OUT || "/tmp/ba";
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const log = [], res = { A: [], B: [], C: [] };
const ok = (c, m, d = "") => { (c ? pass++ : fail++); const l = `${c ? "✓" : "✗"} ${m}${d ? " — " + d : ""}`; log.push(l); console.log(l); };
const P = { v: 5.2, L: 2.2e-6, dcr: 0.03, rds: 0.06, vd: 0.3, fsw: 4e5, rOut: 0.05 };

// ---------- A. 开关级参考 ----------
function avgTail(r, from) { const m = r.probes.map(() => 0); let n = 0; r.t.forEach((t, i) => { if (t >= from) { r.probes.forEach((p, j) => { m[j] += p.data[i]; }); n++; } }); return m.map((x) => x / n); }
function switchLevel2(vin, io) {
  const vt = P.v - P.rOut * io, T = 1 / P.fsw;
  let D = 1 - vin / vt, integ = 0, lastK = -1;
  const ctl = (t, ctx) => { const k = Math.floor(t / T + 1e-9); if (k !== lastK) { lastK = k; const e = vt - ctx.V("out"); integ += e * T; D = Math.min(0.85, Math.max(0, 1 - vin / vt + 0.05 * e + 300 * integ)); } return t / T - k < D; };
  const net = [
    { t: "V", p: "vs", n: "GND", v: vin, r: 0.1 }, { t: "R", a: "vs", b: "vin", r: 1e-3 },
    { t: "C", a: "vin", b: "GND", c: 10e-6, esr: 0.01 },
    { t: "L", a: "vin", b: "sw", l: P.L, dcr: P.dcr },
    { t: "S", a: "sw", b: "GND", ron: P.rds, roff: 1e9, on: ctl },
    { t: "D", a: "sw", k: "out", vf: P.vd, rs: 1e-3 },
    { t: "C", a: "out", b: "GND", c: 47e-6, esr: 0.005 },
    { t: "R", a: "out", b: "GND", r: vt / io },
  ];
  const tStop = 5e-3;
  const r = transient(net, { tStart: 0, tStop, dt: 25e-9, init: "zero", every: 4, probes: [{ id: "o", node: "out" }, { id: "iin", fn: (ctx) => (ctx.V("vs") - ctx.V("vin")) / 1e-3 }] });
  const [vo, iin] = avgTail(r, tStop - 1e-3);
  return { vo, iin, eff: (vo * vo / (vt / io)) / (vin * iin) };
}
function avgLevel(vin, io, kSw = 0) {
  const vt = P.v - P.rOut * io;
  const net = [
    { t: "V", p: "vs", n: "GND", v: vin, r: 0.1 }, { t: "R", a: "vs", b: "vin", r: 1e-3 },
    boost({ id: "B", vin: "vin", gnd: "GND", vout: "out", v: P.v, L: P.L, dcr: P.dcr, rds: P.rds, vd: P.vd, rOut: P.rOut, kSw, iq: 0, ilim35: 3, uvlo: 2.0, tss: 2e-4, ripple: false }), // 这里比的是“变换”本身：欠压保护阈值放低到 2.0 V，免得 3.0 V / 1 A 时输入一晃就触发欠压重启（开关级参考没有欠压保护）,
    { t: "R", a: "out", b: "GND", r: vt / io },
  ];
  const tStop = 3e-3;
  const r = transient(net, { tStart: 0, tStop, dt: 1e-6, init: "zero", probes: [{ id: "o", node: "out" }, { id: "iin", fn: (ctx) => (ctx.V("vs") - ctx.V("vin")) / 1e-3 }] });
  const [vo, iin] = avgTail(r, tStop - 0.5e-3);
  return { vo, iin, eff: (vo * vo / (vt / io)) / (vin * iin) };
}
BOOST_MODEL.mode = "avg";
for (const vin of [3.0, 3.7, 4.2]) for (const io of [0.2, 0.5, 1.0]) {
  const s = switchLevel2(vin, io), a = avgLevel(vin, io);
  const row = { vin, io, sw: s, avg: a, dV: a.vo - s.vo, dIin: (a.iin - s.iin) / s.iin };
  res.A.push(row);
  ok(Math.abs(row.dV) < 0.03 && Math.abs(row.dIin) < 0.05, `A 稳态 Vin ${vin} V · Io ${io} A：平均值模型 vs 开关级（输出差 < 30 mV、输入电流差 < 5%）`, `输出 ${a.vo.toFixed(3)} / ${s.vo.toFixed(3)} V，输入 ${a.iin.toFixed(3)} / ${s.iin.toFixed(3)} A（${(row.dIin * 100).toFixed(1)}%），效率 ${(a.eff * 100).toFixed(1)} / ${(s.eff * 100).toFixed(1)}%`);
}
const k = boostLossK({});
ok(k > 0 && k < 0.3, "开关损耗系数 kSw 按 3.7 V / 0.5 A 效率 85% 反推（估算）", `kSw = ${k.toFixed(3)}`);

// ---------- B. 单独模块负载阶跃 ----------
const stepNet = () => [
  { t: "V", p: "vin", n: "GND", v: 3.7, r: 0.08 },
  boost({ id: "B", vin: "vin", gnd: "GND", vout: "out", ripple: false }),
  { t: "R", a: "out", b: "GND", r: 26 },
  { t: "S", a: "out", b: "ld", ron: 1e-3, roff: 1e9, on: (t) => t >= 3e-3 }, { t: "R", a: "ld", b: "GND", r: 6.5 },
];
for (const mode of ["legacy", "avg"]) {
  BOOST_MODEL.mode = mode; const mins = {};
  for (const dt of [8e-6, 4e-6, 2e-6, 1e-6, 0.25e-6]) {
    const r = transient(stepNet(), { tStart: 0, tStop: 5e-3, dt, init: "zero", probes: [{ id: "o", node: "out" }] });
    let mn = Infinity; r.t.forEach((t, i) => { if (t > 3e-3) mn = Math.min(mn, r.probes[0].data[i]); }); mins[dt * 1e6 + " µs"] = mn;
  }
  const v = Object.values(mins), spread = Math.max(...v) - Math.min(...v);
  res.B.push({ mode, mins, spread });
  console.log(`  B ${mode}: ` + Object.entries(mins).map(([a, b]) => `${a} ${b.toFixed(4)}`).join(" · ") + ` → 差 ${(spread * 1e3).toFixed(1)} mV`);
}
const fineSp = (r) => { const v = Object.entries(r.mins).filter(([k]) => parseFloat(k) <= 2).map(([, x]) => x); return Math.max(...v) - Math.min(...v); };
const e4 = (r) => Math.abs(r.mins["4 µs"] - r.mins["0.25 µs"]);
res.B.forEach((r) => { r.spreadLe2us = fineSp(r); r.err4us = e4(r); });
ok(res.B[1].spreadLe2us < 0.008 && res.B[1].err4us < res.B[0].err4us / 2, "B 负载阶跃最低点：新模型在步长 ≤ 2 µs 内差 < 8 mV，4 µs 步长的误差不到旧模型的一半", `≤2 µs 内：旧 ${(res.B[0].spreadLe2us * 1e3).toFixed(1)} → 新 ${(res.B[1].spreadLe2us * 1e3).toFixed(1)} mV；4 µs 对 0.25 µs：旧 ${(res.B[0].err4us * 1e3).toFixed(1)} → 新 ${(res.B[1].err4us * 1e3).toFixed(1)} mV（剩下的是输出 LC 本身的积分误差，8 µs 已经接近输出 LC 振荡周期的 1/4）`);

// ---------- C. 台面：舵机起步 ----------
const W = octoWiresFromSpec(benchSpec({ variant: "v10" }));
const base = { exp: "run", tdiv: 2e-3, run: true, pre: 0.05, trig: { src: 0, slope: "rise", level: 1, mode: "auto" }, chans: [{ node: "CHG:BAT" }, { node: "BST1:OUT" }, { node: "QTPY:BAT" }] };
const mkb = () => octoBoard(W, { caps: { CAP1: 0, CAP2: 0 } }).board;
for (const mode of ["legacy", "avg"]) {
  BOOST_MODEL.mode = mode; const mins = {};
  for (const pts of [1000, 2500, 5000, 25000, "自适应"]) { const c = capture(mkb(), pts === "自适应" ? { ...base, adaptive: {} } : { ...base, points: pts }); mins[pts] = c.meas[1].min; }
  const v = Object.values(mins), spread = Math.max(...v) - Math.min(...v), sp2 = Math.abs(mins[2500] - mins[25000]);
  res.C.push({ mode, mins, spread, d2500: sp2, dAd: Math.abs(mins["自适应"] - mins[25000]) });
  console.log(`  C ${mode}: ` + Object.entries(mins).map(([a, b]) => `${a} ${b.toFixed(4)}`).join(" · ") + ` → 全部差 ${(spread * 1e3).toFixed(1)} mV，2500 vs 25000 ${(sp2 * 1e3).toFixed(1)} mV`);
}
const [cl, ca] = res.C;
ok(ca.d2500 < cl.d2500 / 2 && ca.dAd < 0.02, "C 舵机起步最低点：2500 点对 25000 点的差不到旧模型的一半，自适应对 25000 点 < 20 mV", `2500 vs 25000：旧 ${(cl.d2500 * 1e3).toFixed(1)} → 新 ${(ca.d2500 * 1e3).toFixed(1)} mV；自适应 vs 25000：旧 ${(cl.dAd * 1e3).toFixed(1)} → 新 ${(ca.dAd * 1e3).toFixed(1)} mV；全部 5 种设置的极差：旧 ${(cl.spread * 1e3).toFixed(1)} → 新 ${(ca.spread * 1e3).toFixed(1)} mV`);
BOOST_MODEL.mode = "avg";
fs.writeFileSync(`${OUT}/boost-avg-test.json`, JSON.stringify({ pass, fail, P, kSw: k, ...res, log }, null, 2));
console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
