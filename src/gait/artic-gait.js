// v13：通用步态（任何带关节的上传模型）。每个“带驱动”的关节一行：相位 / 幅度 / 偏置 / 频率 / 波形（和八爪鱼同一个公式，gait.js）。
// 值 = 关节“回中位置” + 步态值（转动关节 °，滑动关节 mm），最后按关节限位截断（ArticCore.setTarget 里做）。
// 测量：另建一个看不见的物理世界跑 N 秒，看整机（所有刚体的质心）走了多远。前方 = −z（同装配台），侧向 = x。
import * as THREE from "three";
import { newJoint, jointValue, sanitizeGait, sanitizeProjectGait } from "./gait.js";
export { sanitizeProjectGait };
import { createLabWorld, stepLab, labPenetration } from "../modellab/artic.js";
import { driveParams } from "../modellab/servos.js";
import { convexHull, supportMargin } from "../assembly/octopus/loco.js";

export const drivenJoints = (project) => (project.joints || []).filter((j) => j.type !== "ball" && j.type !== "fixed" && driveParams(j).on);
// 工程里存的步态（按关节 id）→ 编辑器用的步态（按顺序）。没有就给一个默认（幅度 = 行程的 40%）
export function gaitForProject(project) {
  const js = drivenJoints(project), saved = project.gait;
  const byId = new Map((saved?.joints || []).map((x) => [x.jid, x]));
  const joints = js.map((j, i) => {
    const s = byId.get(j.id);
    const span = Math.min((j.limits?.max ?? 90) - (j.home || 0), (j.home || 0) - (j.limits?.min ?? -90));
    return { ...newJoint(j.name, { amp: +Math.max(1, 0.4 * span).toFixed(1), phase: (i * 360) / Math.max(1, js.length), freq: 0.5 }), ...(s ? pick(s) : {}), name: j.name, jid: j.id, unit: j.type === "prismatic" ? "mm" : "°" };
  });
  return { name: saved?.name || (saved ? "工程里保存的步态" : "默认（波浪）"), joints };
}
const pick = (s) => ({ amp: s.amp, phase: s.phase, offset: s.offset, freq: s.freq, wave: s.wave, duty: s.duty });
// 存回工程（只留关节 id + 参数）
export function gaitToProject(g) {
  const s = sanitizeGait(g, g.joints.length);
  return { name: String(g.name || "步态").slice(0, 40), joints: s.joints.map((J, i) => ({ jid: g.joints[i].jid, ...pick(J) })) };
}
export function gaitTargets(project, g, t) {
  const home = new Map((project.joints || []).map((j) => [j.id, j.home || 0]));
  const o = {};
  for (const J of g.joints) if (J.jid) o[J.jid] = (home.get(J.jid) || 0) + jointValue(J, t);
  return o;
}
// 让装配台上的模型跟着步态动（用 ArticCore 自带的播放器；按“停止”就停）
export function playGait(core, project, g) {
  core.play(`步态：${g.name || ""}`, (t) => gaitTargets(project, g, t));
}

const tilt = (q) => { const u = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)); return (Math.acos(Math.max(-1, Math.min(1, u.y))) * 180) / Math.PI; };
const yaw = (q) => { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)); return Math.atan2(-f.x, -f.z); };
// 刚体上一点的速度 = v + ω × (p − 质心)
function velAt(rb, p) { const v = rb.linvel(), w = rb.angvel(), c = rb.worldCom(), rx = p.x - c.x, ry = p.y - c.y, rz = p.z - c.z; return { x: v.x + w.y * rz - w.z * ry, y: v.y + w.z * rx - w.x * rz, z: v.z + w.x * ry - w.y * rx }; }
function com(lab) {
  let m = 0; const c = new THREE.Vector3();
  for (const rb of lab.rbs) { const mm = rb.mass(), w = rb.worldCom(); c.x += w.x * mm; c.y += w.y * mm; c.z += w.z * mm; m += mm; }
  return { c: c.divideScalar(Math.max(1e-9, m)), m };
}
// 测一段步态。返回和八爪鱼同一套指标（能量 = ∫|扭矩·角速度| dt，扭矩按“误差 × 刚度”截到驱动上限，估算）
export async function measureArtic(R, project, an, M, g, { sec = 10, settle = 1, fixBase = !!project.sim?.fixBase, mu = null, damping = true, onProgress = null } = {}) {
  const lab = createLabWorld(R, project, an, M, { fixBase });
  // 对照实验：把所有接触面的摩擦都改成 mu（例如 0 = 冰面）
  if (mu != null) lab.world.forEachCollider((c) => { c.setFriction(mu); c.setFrictionCombineRule?.(R.CoefficientCombineRule.Min); });
  // 对照实验：去掉刚体的速度阻尼（它相当于一点“空气阻力”，冰面上也能借它挪一点）
  if (!damping) for (const rb of lab.rbs) { rb.setLinearDamping(0); rb.setAngularDamping(0); }
  const dt = lab.world.timestep, core = lab.core;
  const rbSet = new Set(lab.rbs.map((rb) => rb.handle));
  const n0 = Math.round(settle / dt);
  for (let i = 0; i < n0; i++) stepLab(lab, dt);
  const root = lab.rbs[0];
  const c0 = com(lab).c.clone();
  let h0 = yaw(root.rotation()), hAcc = 0, hPrev = h0;
  const prevQ = new Map([...core.J].map(([k]) => [k, core.value(k)]));
  let energy = 0, maxTilt = 0, sumTilt = 0, sumContacts = 0, nS = 0, minMargin = Infinity, sumMargin = 0, nMargin = 0, outside = 0, slipNum = 0, slipDen = 0, maxPen = 0, peak = 0;
  playGait(core, project, g);
  const N = Math.round(sec / dt);
  for (let i = 0; i < N; i++) {
    stepLab(lab, dt);
    for (const [k, st] of core.J) {
      if (!st.dp.on || st.j.type === "ball") continue;
      const v = core.value(k), dq = v - prevQ.get(k); prevQ.set(k, v);
      const conv = st.j.type === "prismatic" ? 0.1 : Math.PI / 180;
      const T = Math.min(st.dp.maxF, st.k * Math.abs((st.cmd - v) * conv));
      peak = Math.max(peak, T / st.dp.maxF);
      energy += T * Math.abs(dq * conv);
    }
    const rq = root.rotation(), tl = tilt(rq); maxTilt = Math.max(maxTilt, tl); sumTilt += tl; nS++;
    const h = yaw(rq); let d = h - hPrev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; hAcc += d; hPrev = h;
    if (i % 4 === 0) {
      const pts = [], feet = new Set(), gc = lab.ground.collider(0);
      lab.world.contactPairsWith(gc, (c2) => {
        const rb = c2.parent(); if (!rb || !rbSet.has(rb.handle)) return;
        lab.world.contactPair(gc, c2, (man) => {
          for (let k = 0; k < man.numSolverContacts(); k++) {
            const p = man.solverContactPoint(k); pts.push([p.x, p.z]); feet.add(rb.handle);
            const v = velAt(rb, p), rv = velAt(root, p);
            slipNum += Math.hypot(v.x, v.z); slipDen += Math.hypot(v.x - rv.x, v.z - rv.z);
          }
        });
      });
      sumContacts += feet.size;
      const { c } = com(lab);
      if (pts.length >= 3) { const hull = convexHull(pts); const mg = supportMargin(hull, [c.x, c.z]); if (mg != null) { minMargin = Math.min(minMargin, mg); sumMargin += mg; nMargin++; if (mg < 0) outside++; } }
      if (i % 48 === 0) maxPen = Math.max(maxPen, labPenetration(lab).mm);
    }
    if (onProgress && i % 240 === 239) await onProgress((i + 1) / N);
  }
  const { c, m } = com(lab);
  const t = N * dt, fwd = -(c.z - c0.z), dx = c.x - c0.x, eJ = energy * 1e-7;
  const r = { t, fwd, speed: fwd / t, dx, drift: dx, dist: Math.hypot(c.x - c0.x, c.z - c0.z), dh: (hAcc * 180) / Math.PI, slip: slipDen > 1e-6 ? slipNum / slipDen : 0,
    contactsAvg: (sumContacts / Math.max(1, Math.ceil(N / 4))), tiltMax: maxTilt, tiltAvg: sumTilt / Math.max(1, nS), marginMin: Number.isFinite(minMargin) ? minMargin : null, marginAvg: nMargin ? sumMargin / nMargin : null, outsideFrac: nMargin ? outside / nMargin : null,
    energyJ: eJ, powerW: eJ / t, costOfTransport: fwd > 0.05 ? eJ / ((m / 1000) * 9.81 * (fwd / 100)) : null, peakTorque: peak, pen: maxPen, mass: m, fixBase };
  setTimeout(() => { try { lab.world.free(); } catch {} }, 0);
  return r;
}
