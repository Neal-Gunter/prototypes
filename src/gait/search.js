// v14（我的补充）：台面里的“自动步态搜索”。浏览器 Worker 和 node 共用，只依赖 es.js（手写 sep-CMA-ES）。
// 编码：每个关节 4 个数（摆幅、相位、偏置、duty）+ 全体共用 1 个频率，全部归一化到 [0,1]（相位那一维回绕）。
// 打分（越大越好）：w.speed·前进速度 − w.straight·(|侧漂| + 0.2·|航向变化|)/T − w.stable·(最大倾斜/10 + 支撑裕度<0 的部分) − w.energy·(J / 10 cm)
//   − 碰撞惩罚（每个碰撞 tick 0.02，最多 2）− 角速度超 300 °/s 的惩罚（舵机跟不上）。
// 防过拟合：可选“多摩擦系数一起评”（每个候选在几个 μ 上取平均），搜索完再做鲁棒性复评（μ × 质量 × 随机种子）。
import { SepCMA } from "./es.js";
import { mulberry32, subSeed } from "./rng.js";
import { OCTO_NAMES, OCTO_SIDE, newJoint, maxRate } from "./gait.js";

export const OBJECTIVES = {
  speed: { zh: "速度优先", w: { speed: 1, straight: 0.3, stable: 0, energy: 0 } },
  straight: { zh: "走直线", w: { speed: 0.5, straight: 2, stable: 0, energy: 0 } },
  stable: { zh: "稳定（少晃）", w: { speed: 0.5, straight: 0.3, stable: 1, energy: 0 } },
  energy: { zh: "省电", w: { speed: 0.5, straight: 0.3, stable: 0, energy: 1 } },
  mix: { zh: "加权（自己调）", w: { speed: 1, straight: 1, stable: 0.5, energy: 0.5 } },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u, inv = (a, b, v) => clamp((v - a) / (b - a), 0, 1);

export function scoreOf(r, w, extra = {}) {
  const T = r.t || 10, speed = r.speed, fwd = r.fwd;
  const straight = (Math.abs(r.dx) + 0.2 * Math.abs(r.dh)) / T;
  const stable = (r.tiltMax || 0) / 10 + Math.max(0, -(r.marginMin ?? 0));
  const energy = (r.energyJ || 0) / (Math.max(fwd, 0.5) / 10);
  const col = Math.min(2, 0.02 * (r.col || 0)), rate = extra.ratePen || 0;
  const s = (w.speed || 0) * speed - (w.straight || 0) * straight - (w.stable || 0) * stable - (w.energy || 0) * energy - col - rate;
  return { score: Number.isFinite(s) ? s : -1e3, parts: { speed, straight, stable, energy, col, rate } };
}
const ratePenalty = (g, limit = 300) => g.joints.reduce((a, J) => a + Math.max(0, Math.min(2000, maxRate(J)) - limit) / 100, 0);

// —— 八爪鱼编码 ——（对称：只放开 0–4 号触手，7←1、6←2、5←3 镜像（摆幅、偏置取反，相位相同）；0 / 4 号偏置固定 0）
export function octoSpace({ symmetric = true, wave = "tri" } = {}) {
  const free = symmetric ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6, 7];
  const R = (a) => { const fb = Math.abs(OCTO_SIDE[a]) < 1e-3; return { amp: fb ? [-30, 30] : [-60, 60], off: fb && symmetric ? [0, 0] : [-20, 20] }; };
  const dims = [], periodic = [];
  for (const a of free) { dims.push(`amp${a}`, `ph${a}`, `off${a}`, `duty${a}`); periodic.push(false, true, false, false); }
  dims.push("freq"); periodic.push(false);
  const FR = [0.3, 2], DU = [0.15, 0.85];
  const decode = (x, name = "搜索结果") => {
    const per = new Map(); let k = 0;
    for (const a of free) { const r = R(a); per.set(a, { amp: lerp(r.amp[0], r.amp[1], x[k]), phase: 360 * x[k + 1], offset: lerp(r.off[0], r.off[1], x[k + 2]), duty: lerp(DU[0], DU[1], x[k + 3]) }); k += 4; }
    const freq = lerp(FR[0], FR[1], x[k]);
    const mirror = { 7: 1, 6: 2, 5: 3 };
    return { name, joints: OCTO_NAMES.map((nm, a) => { const p = per.get(a) || { ...per.get(mirror[a]) }; if (!per.has(a)) { p.amp = -p.amp; p.offset = -p.offset; } return newJoint(nm, { amp: +p.amp.toFixed(2), phase: +p.phase.toFixed(1), offset: +p.offset.toFixed(2), freq: +freq.toFixed(3), wave, duty: +p.duty.toFixed(3) }); }) };
  };
  const encode = (g) => {
    const x = [];
    for (const a of free) { const J = g.joints[a], r = R(a); x.push(inv(r.amp[0], r.amp[1], J.amp), (((J.phase || 0) % 360) + 360) % 360 / 360, r.off[0] === r.off[1] ? 0.5 : inv(r.off[0], r.off[1], J.offset || 0), inv(DU[0], DU[1], J.duty ?? 0.5)); }
    x.push(inv(FR[0], FR[1], g.joints[0].freq)); return x;
  };
  return { kind: "octo", n: dims.length, dims, periodic, decode, encode, joints: 8 };
}
// —— 通用模型编码 ——（每个带驱动的关节都放开；摆幅 ±行程，偏置 ±0.3 行程）
export function articSpace(project, base) {
  const js = base.joints, home = new Map((project.joints || []).map((j) => [j.id, j]));
  const span = (J) => { const j = home.get(J.jid) || {}; return Math.max(1, Math.min((j.limits?.max ?? 90) - (j.home || 0), (j.home || 0) - (j.limits?.min ?? -90))); };
  const dims = [], periodic = [];
  js.forEach((J, i) => { dims.push(`amp${i}`, `ph${i}`, `off${i}`, `duty${i}`); periodic.push(false, true, false, false); });
  dims.push("freq"); periodic.push(false);
  const FR = [0.3, 2], DU = [0.15, 0.85];
  const decode = (x, name = "搜索结果") => ({ name, joints: js.map((J, i) => { const s = span(J), k = 4 * i; return { ...J, amp: +lerp(-s, s, x[k]).toFixed(2), phase: +(360 * x[k + 1]).toFixed(1), offset: +lerp(-0.3 * s, 0.3 * s, x[k + 2]).toFixed(2), duty: +lerp(DU[0], DU[1], x[k + 3]).toFixed(3), freq: +lerp(FR[0], FR[1], x[4 * js.length]).toFixed(3) }; }) });
  const encode = (g) => { const x = []; g.joints.forEach((J) => { const s = span(J); x.push(inv(-s, s, J.amp), (((J.phase || 0) % 360) + 360) % 360 / 360, inv(-0.3 * s, 0.3 * s, J.offset || 0), inv(DU[0], DU[1], J.duty ?? 0.5)); }); x.push(inv(FR[0], FR[1], g.joints[0]?.freq ?? 0.5)); return x; };
  return { kind: "artic", n: dims.length, dims, periodic, decode, encode, joints: js.length };
}

// 主循环。evalFn(gait, {mu}) → 测量报告（和 octo-measure / measureArtic 同一套字段）
// 上限：maxEvals（评估次数）和 maxSec（墙钟秒）谁先到算谁；shouldStop() 返回 true 就停（取消按钮）
export async function runSearch({ evalFn, space, x0, weights, seed = 1, lambda = 0, sigma = 0.15, maxEvals = 120, maxSec = 300, mus = [0.5], onGen = null, shouldStop = () => false, now = () => Date.now() }) {
  const es = new SepCMA({ x0, sigma, lambda, seed, periodic: space.periodic });
  const t0 = now(); let evals = 0, best = null; const hist = [];
  const evalX = async (x, tag) => {
    const g = space.decode(x, tag), rp = ratePenalty(g);
    let s = 0, rs = [];
    for (const mu of mus) { const r = await evalFn(g, { mu }); rs.push(r); s += scoreOf(r, weights, { ratePen: rp }).score; }
    evals++;
    return { x, g, score: s / mus.length, r: rs[Math.floor(rs.length / 2)] , rs };
  };
  // 第 0 代：起点本身（保证结果不会比起点差）
  best = await evalX(x0, "起点"); const base = best;
  hist.push({ gen: 0, evals, best: best.score, mean: best.score, sigma: es.sigma });
  onGen && (await onGen({ gen: 0, evals, best, hist, sec: (now() - t0) / 1000 }));
  let stopped = null;
  for (let gen = 1; ; gen++) {
    if (shouldStop()) { stopped = "已取消"; break; }
    if (evals + es.lambda > maxEvals) { stopped = "到评估次数上限"; break; }
    if ((now() - t0) / 1000 > maxSec) { stopped = "到时间上限"; break; }
    const xs = es.ask(), out = [];
    for (const x of xs) { if (shouldStop()) break; out.push(await evalX(x, "候选")); }
    if (out.length < xs.length) { stopped = "已取消"; break; }
    es.tell(xs, out.map((o) => o.score));
    for (const o of out) if (o.score > best.score) best = o;
    hist.push({ gen, evals, best: best.score, mean: out.reduce((a, o) => a + o.score, 0) / out.length, sigma: es.sigma });
    onGen && (await onGen({ gen, evals, best, hist, sec: (now() - t0) / 1000 }));
  }
  best.g.name = `自动搜索（种子 ${seed}）`;
  return { best, base, hist, evals, sec: (now() - t0) / 1000, stopped, lambda: es.lambda };
}

// 鲁棒性复评：μ × 质量倍数 × 随机种子（种子 = 每个关节 ±2° 装配零位误差（估算）+ 0–1 s 起步延迟）
export function robustCases({ mus = [0.3, 0.5, 0.8], masses = [0.9, 1, 1.1], seeds = 5, joints = 8, seed = 1 } = {}) {
  const cases = [];
  for (const mu of mus) cases.push({ mu, massScale: 1, tag: `μ ${mu}` });
  for (const m of masses) if (m !== 1) cases.push({ mu: 0.5, massScale: m, tag: `质量 ×${m}` });
  for (let s = 0; s < seeds; s++) { const r = mulberry32(subSeed(seed, s + 1)); cases.push({ mu: 0.5, massScale: 1, trimDeg: Array.from({ length: joints }, () => +(4 * r() - 2).toFixed(2)), startDelay: +r().toFixed(2), tag: `种子 ${s + 1}` }); }
  return cases;
}
export async function robustEval(evalFn, gait, cases, onCase = null) {
  const rows = [];
  for (let i = 0; i < cases.length; i++) { const c = cases[i], r = await evalFn(gait, c); rows.push({ ...c, speed: r.speed, dx: r.dx, dh: r.dh, tiltMax: r.tiltMax, energyJ: r.energyJ, col: r.col }); onCase && (await onCase(i + 1, cases.length)); }
  const sp = rows.map((r) => r.speed), dr = rows.map((r) => Math.abs(r.dx));
  return { rows, speedMin: Math.min(...sp), speedMean: sp.reduce((a, b) => a + b, 0) / sp.length, driftMax: Math.max(...dr), driftMean: dr.reduce((a, b) => a + b, 0) / dr.length };
}
