// v18 时域求解器精度 + 器件行为 + 和稳态模型交叉核对。node scripts/transient-test.mjs
// 输出：每个用例的最大误差（相对阶跃幅度），日志写到 $OUT/logs/transient-test.txt（默认 ../v18）
import fs from "node:fs";
import path from "node:path";
import { transient } from "../src/sim/transient.js";
import { lipo, ldo, boost, mcu } from "../src/sim/devices.js";
import { TEMPLATES, makeBoard } from "../src/repair/boards.js";
import { simulate } from "../src/repair/board.js";
import { buildTransient } from "../src/repair/tboard.js";
import { prepare } from "../src/sim/transient.js";

const OUT = process.env.OUT || path.resolve("../v18");
fs.mkdirSync(path.join(OUT, "logs"), { recursive: true });
const lines = [];
const log = (...a) => { const s = a.join(" "); lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); };
const e3 = (x) => x.toExponential(2);
const step = (t) => (t > 0 ? 1 : 0);

function maxErr(els, probe, f, t1, N, method, scale = 1) {
  const r = transient(els(), { tStart: 0, tStop: t1, dt: t1 / N, method, init: "zero", probes: [probe] });
  let m = 0; const d = r.probes[0].data;
  for (let i = 0; i < r.t.length; i++) m = Math.max(m, Math.abs(d[i] - f(r.t[i])));
  return m / scale;
}

// ---------- 1. 解析解对比 ----------
log("== 1. 解析解对比（最大绝对误差 / 阶跃幅度 1 V 或 1/R A） ==");
const table = [];
function suite(name, els, probe, f, t1, scale, tolTrap) {
  const row = { name };
  for (const N of [50, 200, 1000]) for (const m of ["trap", "be"]) row[`${m}${N}`] = maxErr(els, probe, f, t1, N, m, scale);
  table.push(row);
  log(`${name.padEnd(28)} trap N=50 ${e3(row.trap50)} N=200 ${e3(row.trap200)} N=1000 ${e3(row.trap1000)} | BE N=50 ${e3(row.be50)} N=200 ${e3(row.be200)} N=1000 ${e3(row.be1000)}`);
  const oT = Math.log2(row.trap200 / row.trap1000) / Math.log2(5), oB = Math.log2(row.be200 / row.be1000) / Math.log2(5);
  check(`${name} 梯形法 N=1000 误差 < ${tolTrap}`, row.trap1000 < tolTrap, `收敛阶 trap≈${oT.toFixed(2)} BE≈${oB.toFixed(2)}`);
  check(`${name} 梯形法比后向欧拉准（N=1000）`, row.trap1000 < row.be1000);
}
// RC：R 1k，C 1 µF，τ = 1 ms，看 5τ
{
  const R = 1e3, C = 1e-6, tau = R * C;
  suite("RC 阶跃（τ=1 ms）", () => [{ t: "V", p: "IN", n: "GND", v: step, r: 1e-6 }, { t: "R", a: "IN", b: "OUT", r: R }, { t: "C", a: "OUT", b: "GND", c: C }], { id: "v", node: "OUT" }, (t) => 1 - Math.exp(-t / tau), 5 * tau, 1, 2e-4);
}
// RL：R 10 Ω，L 1 mH，τ = 100 µs，看电流
{
  const R = 10, L = 1e-3, tau = L / R;
  const els = () => { const l = { t: "L", a: "OUT", b: "GND", l: L }; return [{ t: "V", p: "IN", n: "GND", v: step, r: 1e-6 }, { t: "R", a: "IN", b: "OUT", r: R }, l]; };
  // 电流用电阻两端电压算：i = (V_IN − V_OUT)/R
  const mk = () => els();
  const run = (N, m) => { const e = mk(); const r = transient(e, { tStart: 0, tStop: 5 * tau, dt: (5 * tau) / N, method: m, init: "zero", probes: [{ id: "a", node: "IN" }, { id: "b", node: "OUT" }] }); let mx = 0; for (let i = 0; i < r.t.length; i++) { const ii = (r.probes[0].data[i] - r.probes[1].data[i]) / R; mx = Math.max(mx, Math.abs(ii - (1 / R) * (1 - Math.exp(-r.t[i] / tau)))); } return mx * R; };
  const row = { name: "RL 阶跃电流（τ=100 µs）" };
  for (const N of [50, 200, 1000]) for (const m of ["trap", "be"]) row[`${m}${N}`] = run(N, m);
  table.push(row);
  log(`${row.name.padEnd(28)} trap N=50 ${e3(row.trap50)} N=200 ${e3(row.trap200)} N=1000 ${e3(row.trap1000)} | BE N=50 ${e3(row.be50)} N=200 ${e3(row.be200)} N=1000 ${e3(row.be1000)}`);
  check("RL 梯形法 N=1000 误差 < 2e-4", row.trap1000 < 2e-4, `收敛阶 trap≈${(Math.log2(row.trap200 / row.trap1000) / Math.log2(5)).toFixed(2)}`);
  check("RL 梯形法比后向欧拉准", row.trap1000 < row.be1000);
}
// 串联 RLC，电容电压：欠阻尼 / 临界 / 过阻尼
{
  const L = 1e-3, C = 1e-6, w0 = 1 / Math.sqrt(L * C);
  const mk = (R) => () => [{ t: "V", p: "IN", n: "GND", v: step, r: 1e-6 }, { t: "R", a: "IN", b: "M", r: R }, { t: "L", a: "M", b: "OUT", l: L }, { t: "C", a: "OUT", b: "GND", c: C }];
  const Ru = 10, a = Ru / (2 * L), wd = Math.sqrt(w0 * w0 - a * a);
  suite("RLC 欠阻尼（R=10 Ω, ζ=0.16）", mk(Ru), { id: "v", node: "OUT" }, (t) => 1 - Math.exp(-a * t) * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t)), (5 * 2 * Math.PI) / wd, 1, 3e-3);
  const Rc = 2 * Math.sqrt(L / C), ac = Rc / (2 * L);
  suite("RLC 临界阻尼", mk(Rc), { id: "v", node: "OUT" }, (t) => 1 - (1 + ac * t) * Math.exp(-ac * t), 10 / ac, 1, 3e-4);
  const Ro = 200, ao = Ro / (2 * L), s1 = -ao + Math.sqrt(ao * ao - w0 * w0), s2 = -ao - Math.sqrt(ao * ao - w0 * w0);
  // 过阻尼这个例子是“刚性”的（快极点 ≈ 5 µs，比步长小）：梯形法在第一段会有一点数值振荡，所以门槛放宽到 5e-4，收敛阶也会低于 2（如实记录）
  suite("RLC 过阻尼（R=200 Ω，刚性）", mk(Ro), { id: "v", node: "OUT" }, (t) => 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2), 5 / -s1, 1, 5e-4);
}

// ---------- 2. 非线性 / 器件 ----------
log("== 2. 非线性和器件行为 ==");
{ // 半波整流 + 滤波电容：纹波 ≈ I/(f·C)
  const f = 50, A = 5, C = 470e-6, R = 1000;
  const r = transient([{ t: "V", p: "AC", n: "GND", v: (t) => A * Math.sin(2 * Math.PI * f * t), r: 0.1 }, { t: "D", a: "AC", k: "OUT", vf: 0.7, rs: 0.1 }, { t: "C", a: "OUT", b: "GND", c: C }, { t: "R", a: "OUT", b: "GND", r: R }], { tStart: 0, tStop: 0.2, dt: 2e-5, init: "zero", probes: [{ id: "o", node: "OUT" }] });
  const d = r.probes[0].data; let mn = Infinity, mx = -Infinity; for (let i = 0; i < r.t.length; i++) if (r.t[i] > 0.14) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); }
  const pk = A - 0.7, rip = pk / R / (f * C);
  check("半波整流峰值 ≈ A − Vf", Math.abs(mx - pk) < 0.08, `仿真 ${mx.toFixed(3)} V，估算 ${pk.toFixed(3)} V`);
  check("半波整流纹波 ≈ I/(f·C)（±25%）", Math.abs(mx - mn - rip) / rip < 0.25, `仿真 ${(mx - mn).toFixed(3)} V，公式 ${rip.toFixed(3)} V`);
}
{ // LiPo：2 A 阶跃 → 瞬间掉 2·r0，再按 τ 继续掉到 2·rint
  const dev = lipo({ id: "B", p: "P", n: "GND", ocv: 3.85, rint: 0.06, tau: 2, mAh: 1000 });
  const r = transient([dev, { t: "I", from: "P", to: "GND", i: (t) => (t > 0.001 ? 2 : 0) }], { tStart: 0, tStop: 10, dt: 1e-3, init: "dc", probes: [{ id: "v", node: "P" }] });
  const d = r.probes[0].data, at = (tt) => d[Math.round(tt / 1e-3)];
  const v0 = at(0.0005), v1 = at(0.003), vEnd = at(10);
  const soc = dev.soc;
  check("LiPo 瞬间压降 ≈ I·r0", Math.abs(v0 - v1 - 2 * 0.036) < 0.004, `${((v0 - v1) * 1000).toFixed(1)} mV（理论 72 mV）`);
  check("LiPo 10 s 后（5τ）压降 ≈ I·rint + 掉电量", Math.abs(v0 - vEnd - 0.12) < 0.02, `${((v0 - vEnd) * 1000).toFixed(0)} mV（内阻部分 120 mV，另有电量下降 ${((1 - soc / dev.soc) * 0).toFixed(0)}）`);
}
{ // LDO：负载 10 → 200 mA 阶跃，输出先掉再回来；压差
  const mk = (vin, cout) => [{ t: "V", p: "IN", n: "GND", v: vin, r: 0.01 }, ldo({ id: "U", vin: "IN", gnd: "GND", vout: "OUT", vset: 3.3, drop: 0.25, ilim: 0.6 }), { t: "C", a: "OUT", b: "GND", c: cout, esr: 0.01 }, { t: "I", from: "OUT", to: "GND", i: (t) => (t > 1e-4 ? 0.2 : 0.01) }];
  const run = (vin, cout) => { const r = transient(mk(vin, cout), { tStart: 0, tStop: 6e-4, dt: 1e-7, init: "dc", probes: [{ id: "o", node: "OUT" }] }); const d = r.probes[0].data; return { v0: d[0], min: Math.min(...d), end: d[d.length - 1] }; };
  const a = run(5, 10e-6), b = run(5, 1e-6), c = run(3.4, 10e-6);
  check("LDO 直流初值 = 3.3 V", Math.abs(a.v0 - 3.3) < 0.002, `${a.v0.toFixed(4)} V`);
  check("LDO 负载阶跃后回到 3.3 V（±5 mV）", Math.abs(a.end - 3.3) < 0.005, `末值 ${a.end.toFixed(4)} V`);
  check("LDO 输出电容越小、阶跃掉得越深", b.min < a.min, `10 µF 最低 ${a.min.toFixed(3)} V，1 µF 最低 ${b.min.toFixed(3)} V`);
  check("LDO 压差：输入 3.4 V → 输出 ≈ 3.15 V", Math.abs(c.end - 3.15) < 0.02, `${c.end.toFixed(3)} V`);
}
{ // 升压：软启动、限流、短路打嗝
  const mk = (load) => [{ t: "V", p: "VB", n: "GND", v: 3.7, r: 0.05 }, boost({ id: "U", vin: "VB", gnd: "GND", vout: "OUT", en: null, v: 5.2, eff: 0.85, ilim35: 1.1, uvlo: 2.5 }), { t: "R", a: "OUT", b: "GND", r: load }];
  const r = transient([{ t: "V", p: "VB", n: "GND", v: (t) => (t > 0 ? 3.7 : 0), r: 0.05 }, ...mk(26).slice(1)], { tStart: 0, tStop: 3e-3, dt: 1e-6, init: "dc", probes: [{ id: "o", node: "OUT" }] });
  const d = r.probes[0].data; const t90 = r.t[d.findIndex((v) => v > 0.9 * 5.2)];
  check("升压软启动：0→90% 约 1 ms（估算 tss）", t90 > 0.6e-3 && t90 < 1.3e-3, `${(t90 * 1e3).toFixed(2)} ms`);
  check("升压稳态 5.2 V", Math.abs(d[d.length - 1] - 5.2) < 0.03, `${d[d.length - 1].toFixed(3)} V`);
  const dev = mk(1)[1]; const r2 = transient([mk(1)[0], dev, mk(1)[2]], { tStart: 0, tStop: 0.06, dt: 2e-6, init: "zero", probes: [{ id: "o", node: "OUT" }] });
  const io = Math.max(...r2.probes[0].data) / 1;
  check("升压 1 Ω 负载：限流 + 打嗝", dev.hiccups >= 2 && io < 1.6, `打嗝 ${dev.hiccups} 次，峰值电流 ≈ ${io.toFixed(2)} A`);
}
{ // 主控欠压复位：电源从 3.7 掉到 3.2 再回来
  const d = mcu({ id: "U", vcc: "V", gnd: "GND", i: 0.08, vnom: 3.7, bo: 3.4, tBoot: 1e-3 });
  const r = transient([{ t: "V", p: "V", n: "GND", v: (t) => (t > 1e-3 && t < 2e-3 ? 3.2 : 3.7), r: 0.01 }, d], { tStart: 0, tStop: 5e-3, dt: 1e-6, init: "dc" });
  const rs = r.events.filter((e) => e.kind === "reset"), bt = r.events.filter((e) => e.kind === "boot");
  check("主控欠压：复位 1 次、恢复后 ≈1 ms 重新启动", rs.length === 1 && bt.length === 1 && Math.abs(bt[0].t - rs[0].t - 2e-3) < 0.05e-3, `复位 @${(rs[0]?.t * 1e3).toFixed(3)} ms，启动 @${(bt[0]?.t * 1e3).toFixed(3)} ms`);
}

// ---------- 3. 和稳态模型交叉核对 ----------
log("== 3. 稳态交叉核对：时域跑到稳定后的平均值 vs 稳态模型 ==");
let worst = 0;
for (const t of Object.keys(TEMPLATES)) {
  for (const run of [false, true]) {
    const b = makeBoard(t);
    if (run && !b.parts.some((p) => p.kind === "servo")) continue;
    const s = simulate(b, { power: true, run });
    const ph = s.phases[0];
    const built = buildTransient(b, { exp: "steady", run });
    const net = prepare(built.els, built.ground);
    const nodes = Object.keys(b.nets).filter((n) => ph.sol.v(n) != null && n !== built.ground);
    const T = 4e-3, dt = 2e-6;
    const r = transient(net, { tStart: 0, tStop: T, dt, init: "dc", probes: nodes.map((n) => ({ id: n, node: n })), ground: built.ground });
    let mx = 0, at = "";
    r.probes.forEach((p, i) => { const d = p.data; let s2 = 0, k = 0; for (let j = Math.floor(d.length / 2); j < d.length; j++) { s2 += d[j]; k++; } const mean = s2 / k; const dv = Math.abs(mean - ph.sol.v(nodes[i])); if (dv > mx) { mx = dv; at = nodes[i]; } });
    worst = Math.max(worst, mx);
    check(`${t}${run ? "（运行）" : "（静止）"} ${nodes.length} 个网络`, mx < 0.02, `最大差 ${(mx * 1000).toFixed(2)} mV @ ${at}`);
  }
}
log(`稳态交叉核对最大差：${(worst * 1000).toFixed(2)} mV`);
log(`\n合计 ${pass} 通过，${fail} 失败`);
fs.writeFileSync(path.join(OUT, "logs", "transient-test.txt"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "logs", "transient-accuracy.json"), JSON.stringify(table, null, 1));
process.exit(fail ? 1 : 0);
