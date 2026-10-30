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
  // v15（我的补充）：多工况鲁棒——每个候选在 TRAIN_CONDS 的 6 个工况上评，分数 = ½·平均 + ½·最差，再减“最差工况的漂移”（drift 项），
  // 这样不会拿直线换速度；舵机角速度按 80 % 上限（240 °/s）硬约束
  robust: { zh: "多工况鲁棒（v15）", w: { speed: 1, straight: 0.5, stable: 0, energy: 0, drift: 1 }, agg: "mix", conds: "train", rateLimit: 240 },
};
// v15：舵机空载角速度上限 300 °/s（固件里的限速，见 v10 页面）；搜索默认只用到 80 %（240 °/s），留余量给负载 / 电压下降（我的补充）
export const SERVO_RATE_MAX = 300, RATE_CAP = 0.8 * SERVO_RATE_MAX;
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
// 超速惩罚：limit = 300 时和 v14 一样（每超 100 °/s 扣 1）；limit < 300（v15 限速）时按硬约束扣（每超 10 °/s 扣 1）
export const ratePenalty = (g, limit = SERVO_RATE_MAX) => g.joints.reduce((a, J) => a + Math.max(0, Math.min(2000, maxRate(J)) - limit) / (limit < SERVO_RATE_MAX ? 10 : 100), 0);
export const gaitMaxRate = (g) => Math.max(...g.joints.map((J) => maxRate(J)));
// —— v15：训练工况 / 留出工况（互不重叠：μ、质量、坡度、随机种子都不同）——
const trims = (seed, n, amp = 2) => { const r = mulberry32(seed); return { trimDeg: Array.from({ length: n }, () => +(2 * amp * r() - amp).toFixed(2)), startDelay: +r().toFixed(2) }; };
export function trainConds(joints = 8) {
  return [
    { tag: "μ 0.35", mu: 0.35 }, { tag: "μ 0.7", mu: 0.7 },
    { tag: "质量 ×0.9 · 种子 A", mu: 0.5, massScale: 0.9, ...trims(101, joints) },
    { tag: "质量 ×1.15 · 种子 B", mu: 0.5, massScale: 1.15, ...trims(102, joints) },
    { tag: "横坡 1.5°（往右）", mu: 0.5, slope: { deg: 1.5, dir: "cross" } },
    { tag: "横坡 1.5°（往左）· 种子 C", mu: 0.5, slope: { deg: 1.5, dir: "crossL" }, ...trims(103, joints) },
  ];
}
export function heldOutConds(joints = 8) {
  return [
    { tag: "μ 0.3", mu: 0.3 }, { tag: "μ 0.8", mu: 0.8 },
    { tag: "μ 0.45 · 质量 ×0.85", mu: 0.45, massScale: 0.85 }, { tag: "μ 0.6 · 质量 ×1.2", mu: 0.6, massScale: 1.2 },
    { tag: "横坡 2°（往右）", mu: 0.5, slope: { deg: 2, dir: "cross" } }, { tag: "横坡 2.5°（往左）", mu: 0.5, slope: { deg: 2.5, dir: "crossL" } },
    { tag: "下坡 2°", mu: 0.5, slope: { deg: 2, dir: "down" } }, { tag: "上坡 2°", mu: 0.5, slope: { deg: 2, dir: "up" } },
    { tag: "种子 X（±3° 零位误差）", mu: 0.5, ...trims(9001, joints, 3) }, { tag: "种子 Y（±3°）", mu: 0.5, ...trims(9002, joints, 3) },
    { tag: "μ 0.4 · 质量 ×1.1 · 横坡 1°", mu: 0.4, massScale: 1.1, slope: { deg: 1, dir: "cross" }, ...trims(9003, joints) },
  ];
}
// 聚合：mean = 平均；worst = 最差；mix = ½ 平均 + ½ 最差
export const aggregate = (xs, agg = "mean") => { const m = xs.reduce((a, b) => a + b, 0) / xs.length, lo = Math.min(...xs); return agg === "worst" ? lo : agg === "mix" ? 0.5 * (m + lo) : m; };
export function multiScore(rs, w, { ratePen = 0, agg = "mean" } = {}) {
  const sc = rs.map((r) => scoreOf(r, w, { ratePen }).score), T = rs[0]?.t || 10;
  const driftWorst = Math.max(...rs.map((r) => (Math.abs(r.dx) + 0.2 * Math.abs(r.dh)) / (r.t || T)));
  return aggregate(sc, agg) - (w.drift || 0) * driftWorst;
}
export function summarize(rows) {
  const sp = rows.map((r) => r.speed), dr = rows.map((r) => Math.abs(r.dx)), dh = rows.map((r) => Math.abs(r.dh));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return { speedMin: Math.min(...sp), speedMean: mean(sp), driftMax: Math.max(...dr), driftMean: mean(dr), dhMax: Math.max(...dh), dhMean: mean(dh) };
}

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
// v15：conds = 每个候选要评的工况列表（默认 = mus 里每个 μ 一个）；agg = 工况聚合方式；rateLimit = 角速度上限（°/s）；
// parallel = true 时一代的所有候选 × 工况一起丢给 evalFn（evalFn 背后是 Worker 池），结果和串行完全一样（每次评估都是新的物理世界）
export async function runSearch({ evalFn, space, x0, weights, seed = 1, lambda = 0, sigma = 0.15, maxEvals = 120, maxSec = 300, mus = [0.5], conds = null, agg = "mean", rateLimit = SERVO_RATE_MAX, hw = null, parallel = false, onGen = null, shouldStop = () => false, now = () => Date.now() }) {
  const es = new SepCMA({ x0, sigma, lambda, seed, periodic: space.periodic });
  const CS = (conds || mus.map((mu) => ({ mu }))).map((c) => (hw ? { ...hw, ...c } : c));
  const t0 = now(); let evals = 0, best = null; const hist = [];
  const evalX = async (x, tag) => {
    const g = space.decode(x, tag), rp = ratePenalty(g, rateLimit);
    let rs;
    if (parallel) rs = await Promise.all(CS.map((c) => evalFn(g, c)));
    else { rs = []; for (const c of CS) { if (shouldStop()) return null; rs.push(await evalFn(g, c)); } }
    if (rs.some((r) => !r)) return null;
    evals++;
    return { x, g, score: multiScore(rs, weights, { ratePen: rp, agg }), r: conds ? rs[0] : rs[Math.floor(rs.length / 2)], rs, maxRate: gaitMaxRate(g) };
  };
  // 第 0 代：起点本身（保证结果不会比起点差）
  best = await evalX(x0, "起点"); const base = best;
  if (!best) return { best: null, base: null, hist, evals, sec: (now() - t0) / 1000, stopped: "已取消", lambda: es.lambda };
  hist.push({ gen: 0, evals, best: best.score, mean: best.score, sigma: es.sigma });
  onGen && (await onGen({ gen: 0, evals, best, hist, sec: (now() - t0) / 1000 }));
  let stopped = null;
  for (let gen = 1; ; gen++) {
    if (shouldStop()) { stopped = "已取消"; break; }
    if (evals + es.lambda > maxEvals) { stopped = "到评估次数上限"; break; }
    if ((now() - t0) / 1000 > maxSec) { stopped = "到时间上限"; break; }
    const xs = es.ask(); let out = [];
    if (parallel) out = await Promise.all(xs.map((x) => evalX(x, "候选")));
    else for (const x of xs) { if (shouldStop()) break; out.push(await evalX(x, "候选")); }
    if (out.length < xs.length || out.some((o) => !o) || shouldStop()) { stopped = "已取消"; break; }
    es.tell(xs, out.map((o) => o.score));
    for (const o of out) if (o.score > best.score) best = o;
    hist.push({ gen, evals, best: best.score, mean: out.reduce((a, o) => a + o.score, 0) / out.length, sigma: es.sigma });
    onGen && (await onGen({ gen, evals, best, hist, sec: (now() - t0) / 1000 }));
  }
  best.g.name = `自动搜索（种子 ${seed}）`;
  return { best, base, hist, evals, sec: (now() - t0) / 1000, stopped, lambda: es.lambda, conds: CS.length };
}

// 鲁棒性复评：μ × 质量倍数 × 随机种子（种子 = 每个关节 ±2° 装配零位误差（估算）+ 0–1 s 起步延迟）
export function robustCases({ mus = [0.3, 0.5, 0.8], masses = [0.9, 1, 1.1], seeds = 5, joints = 8, seed = 1 } = {}) {
  const cases = [];
  for (const mu of mus) cases.push({ mu, massScale: 1, tag: `μ ${mu}` });
  for (const m of masses) if (m !== 1) cases.push({ mu: 0.5, massScale: m, tag: `质量 ×${m}` });
  for (let s = 0; s < seeds; s++) { const r = mulberry32(subSeed(seed, s + 1)); cases.push({ mu: 0.5, massScale: 1, trimDeg: Array.from({ length: joints }, () => +(4 * r() - 2).toFixed(2)), startDelay: +r().toFixed(2), tag: `种子 ${s + 1}` }); }
  return cases;
}
export async function robustEval(evalFn, gait, cases, onCase = null, { parallel = false } = {}) {
  let rows = [];
  const row = (c, r) => (!r ? { ...c, speed: NaN, dx: NaN, dh: NaN } : { ...c, speed: r.speed, dx: r.dx, dh: r.dh, tiltMax: r.tiltMax, energyJ: r.energyJ, col: r.col });
  if (parallel) { let n = 0; rows = await Promise.all(cases.map(async (c) => { const r = await evalFn(gait, c); n++; onCase && (await onCase(n, cases.length)); return row(c, r); })); }
  else for (let i = 0; i < cases.length; i++) { const c = cases[i], r = await evalFn(gait, c); rows.push(row(c, r)); onCase && (await onCase(i + 1, cases.length)); }
  return { rows, ...summarize(rows) };
}
