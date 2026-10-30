// v13：v10 紧凑版八爪鱼步态参数搜索（随机搜索 + 局部细化，固定种子，可复现）
// node scripts/gait-search.mjs <seed> <n> <sec> [center.json]  → 每行一个 JSON 结果
import { runGait, fmt } from "./gait-run.mjs";
import { OCTO_SIDE, newJoint, OCTO_NAMES } from "../src/gait/gait.js";
import fs from "node:fs";
let S = 1; const rnd = () => ((S = (S * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
// 参数化（我的补充）：8 条触手由一组参数生成
//   A 摆幅、f 频率、wave、duty、gamma（侧向权重 sign(c)|c|^gamma；1 = 固件 cos 权重）、
//   phase 模式：ring（相位 = step·arm，固件同款）/ mirror（左右镜像同相，按前中后三排 step·排号）、
//   fb：正前 / 正后两条的摆幅（固件里是 0）及其相位，off：左右舷对称外张偏置
export function build(p) {
  const row = [null, 0, 1, 2, null, 2, 1, 0];
  return { name: p.name || "搜索步态", params: p, joints: OCTO_NAMES.map((nm, a) => {
    const c = OCTO_SIDE[a], sg = Math.sign(Math.abs(c) < 1e-3 ? 0 : c);
    let amp = sg ? sg * p.A * Math.abs(c) ** p.gamma : p.fb * p.A;
    let ph = p.mode === "ring" ? p.step * a : sg ? p.step * row[a] : (a === 0 ? p.fbPh : p.fbPh + 180);
    return newJoint(nm, { amp: +amp.toFixed(3), phase: +(((ph % 360) + 360) % 360).toFixed(2), offset: +(sg * p.off).toFixed(2), freq: p.f, wave: p.wave, duty: p.duty });
  }) };
}
export function sample() {
  return { A: 15 + rnd() * 40, f: 0.4 + rnd() * 1.0, wave: pick(["tri", "tri", "sine"]), duty: 0.35 + rnd() * 0.5, gamma: pick([0, 0.5, 1, 1]), mode: pick(["ring", "mirror"]), step: pick([0, 45, 90, 120, 180, 270, 315]) + (rnd() < 0.3 ? rnd() * 90 : 0), fb: rnd() < 0.5 ? 0 : rnd() * 2 - 1, fbPh: rnd() * 360, off: rnd() < 0.5 ? 0 : rnd() * 30 - 15 };
}
export function perturb(p, s = 1) {
  const q = { ...p }, j = (x, r) => x + (rnd() * 2 - 1) * r * s;
  q.A = Math.min(55, Math.max(5, j(q.A, 6))); q.f = Math.min(1.6, Math.max(0.2, j(q.f, 0.12))); q.duty = Math.min(0.9, Math.max(0.15, j(q.duty, 0.06)));
  q.step = j(q.step, 15); q.fb = Math.min(1, Math.max(-1, j(q.fb, 0.15))); q.fbPh = j(q.fbPh, 30); q.off = Math.min(20, Math.max(-20, j(q.off, 3)));
  if (rnd() < 0.1) q.gamma = pick([0, 0.5, 1]);
  return q;
}
export const score = (r) => r.fwd - 0.5 * Math.abs(r.dx) - 0.1 * Math.abs(r.dh) - (r.col ? 5 : 0);
if (import.meta.url === `file://${process.argv[1]}`) {
  const [seed = "1", n = "20", sec = "10", center] = process.argv.slice(2); S = +seed * 7919 + 1;
  const c = center ? JSON.parse(fs.readFileSync(center, "utf8")) : null;
  for (let i = 0; i < +n; i++) {
    const p = c ? perturb(c, i < +n / 2 ? 1 : 0.4) : sample();
    const r = await runGait({ gait: build(p), sec: +sec });
    console.log(JSON.stringify({ p, m: fmt(r), score: +score(r).toFixed(3), ok: r.checksOk }));
  }
}
