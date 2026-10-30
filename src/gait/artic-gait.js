// v13：通用步态（任何带关节的上传模型）。每个“带驱动”的关节一行：相位 / 幅度 / 偏置 / 频率 / 波形（和八爪鱼同一个公式，gait.js）。
// 值 = 关节“回中位置” + 步态值（转动关节 °，滑动关节 mm），最后按关节限位截断（ArticCore.setTarget 里做）。
// 测量：另建一个看不见的物理世界跑 N 秒，看整机（所有刚体的质心）走了多远。前方 = −z（同装配台），侧向 = x。
import * as THREE from "three";
import { newJoint, jointValue, sanitizeGait, sanitizeProjectGait } from "./gait.js";
export { sanitizeProjectGait };
import { createLabWorld, stepLab, labPenetration } from "../modellab/artic.js";
import { driveParams } from "../modellab/servos.js";
import { convexHull, supportMargin } from "../assembly/octopus/loco.js";
import { jointToBench } from "../modellab/artic.js";
import { SimImu, TiltCtrl, articCorrections, LAB_CTRL } from "./ctrl.js";
import { wave, frac } from "./gait.js";

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
// v14 选项：massScale = 机身（根刚体）质量倍数；trimDeg = 每个步态关节的装配零位误差（°，按 g.joints 顺序）；startDelay = 多等几秒再起步；
//   slope = {deg, dir}（dir: cross = 往右下坡、crossL、down = 往前下坡、up）；drop = {g, t, x, z}：t 秒时在机身上方 6 cm 放下一个真的方块（g 克，x/z = 相对质心偏移 cm）；
//   ctrl = 闭环增益（null = 开环）；imu = IMU 噪声 / 延迟（见 ctrl.js）
export async function measureArtic(R, project, an, M, g, { sec = 10, settle = 1, fixBase = !!project.sim?.fixBase, mu = null, damping = true, onProgress = null,
  massScale = 1, trimDeg = null, startDelay = 0, slope = null, drop = null, ctrl = null, imu = null, log = false } = {}) {
  const lab = createLabWorld(R, project, an, M, { fixBase });
  const geo = articGeo(lab, project, M, g);
  if (massScale !== 1) { const rb = lab.rbs[0]; rb.setAdditionalMass(rb.mass() * (massScale - 1), true); }
  if (slope && slope.deg) { const a = (slope.deg * Math.PI) / 180, s0 = 981 * Math.sin(a), c0 = -981 * Math.cos(a); lab.world.gravity = slope.dir === "crossL" ? { x: -s0, y: c0, z: 0 } : slope.dir === "down" ? { x: 0, y: c0, z: -s0 } : slope.dir === "up" ? { x: 0, y: c0, z: s0 } : { x: s0, y: c0, z: 0 }; }
  // 对照实验：把所有接触面的摩擦都改成 mu（例如 0 = 冰面）
  if (mu != null) lab.world.forEachCollider((c) => { c.setFriction(mu); c.setFrictionCombineRule?.(R.CoefficientCombineRule.Min); });
  // 对照实验：去掉刚体的速度阻尼（它相当于一点“空气阻力”，冰面上也能借它挪一点）
  if (!damping) for (const rb of lab.rbs) { rb.setLinearDamping(0); rb.setAngularDamping(0); }
  const dt = lab.world.timestep, core = lab.core;
  const rbSet = new Set(lab.rbs.map((rb) => rb.handle));
  const n0 = Math.round((settle + startDelay) / dt);
  for (let i = 0; i < n0; i++) stepLab(lab, dt);
  const root = lab.rbs[0];
  const c0 = com(lab).c.clone();
  let h0 = yaw(root.rotation()), hAcc = 0, hPrev = h0;
  const prevQ = new Map([...core.J].map(([k]) => [k, core.value(k)]));
  let maxTiltG = 0, sumTiltG = 0, energy = 0, maxTilt = 0, sumTilt = 0, sumContacts = 0, nS = 0, minMargin = Infinity, sumMargin = 0, nMargin = 0, outside = 0, slipNum = 0, slipDen = 0, maxPen = 0, peak = 0;
  // 步态 + 闭环修正（每个物理步：targets = 回中 + 偏置 + 修正偏置 + 摆幅 × 修正倍数 × 波形）
  const home = new Map((project.joints || []).map((j) => [j.id, j.home || 0]));
  const sim = ctrl ? new SimImu(imu || {}) : null, tc = ctrl ? new TiltCtrl({ ...LAB_CTRL, ...ctrl }) : null;
  let corr = null, vPrev = null, tSim = 0; const ctrlLog = [];
  const G0 = lab.world.gravity;
  core.play(`步态：${g.name || ""}`, (t) => {
    const o = {};
    g.joints.forEach((J, k) => { if (!J.jid) return; const c = corr?.get(J.jid), sc = c ? c.scale : 1, off = c ? c.off : 0;
      o[J.jid] = (home.get(J.jid) || 0) + (+J.offset || 0) + (trimDeg?.[k] || 0) + off + sc * (+J.amp || 0) * wave(J.wave, frac(t * (+J.freq || 0) + (+J.phase || 0) / 360), J.duty); });
    return o;
  });
  let block = null;
  const N = Math.round(sec / dt);
  for (let i = 0; i < N; i++) {
    if (drop && !block && i * dt >= (drop.t ?? 2)) {
      const c = com(lab).c, top = maxY(lab) + 6;
      block = lab.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(c.x + (drop.x || 0), top, c.z + (drop.z || 0)).setCanSleep(false));
      lab.world.createCollider(R.ColliderDesc.cuboid(1, 1, 1).setMass(drop.g || 50).setFriction(0.8), block);
    }
    stepLab(lab, dt); tSim += dt;
    if (sim) {
      const v = root.linvel(), gW = lab.world.gravity, q = root.rotation();
      const a = vPrev ? { x: (v.x - vPrev.x) / dt - gW.x, y: (v.y - vPrev.y) / dt - gW.y, z: (v.z - vPrev.z) / dt - gW.z } : { x: -gW.x, y: -gW.y, z: -gW.z }; vPrev = { x: v.x, y: v.y, z: v.z };
      const f = rotInvQ(q, [a.x / 981, a.y / 981, a.z / 981]), w = root.angvel(), wl = rotInvQ(q, [w.x, w.y, w.z]), k = 180 / Math.PI;
      sim.feed(tSim, { acc: [-f[2], -f[0], f[1]], gyro: [-wl[2] * k, -wl[0] * k, wl[1] * k] });
      if (i % 4 === 0) { const s2 = sim.read(tSim); if (s2) { const out = tc.step(s2, 4 * dt); corr = new Map(articCorrections(out, tc.o, geo).map((c) => [c.jid, c])); if (log && i % 48 === 0) ctrlLog.push([+tSim.toFixed(2), +out.u.toFixed(3), +out.eHdeg.toFixed(2), +out.roll.toFixed(2), +out.pitch.toFixed(2)]); } }
    }
    void G0;
    for (const [k, st] of core.J) {
      if (!st.dp.on || st.j.type === "ball") continue;
      const v = core.value(k), dq = v - prevQ.get(k); prevQ.set(k, v);
      const conv = st.j.type === "prismatic" ? 0.1 : Math.PI / 180;
      const T = Math.min(st.dp.maxF, st.k * Math.abs((st.cmd - v) * conv));
      peak = Math.max(peak, T / st.dp.maxF);
      energy += T * Math.abs(dq * conv);
    }
    const rq = root.rotation(), tl = tilt(rq); maxTilt = Math.max(maxTilt, tl); sumTilt += tl; nS++;
    { const gw = lab.world.gravity, gl = Math.hypot(gw.x, gw.y, gw.z) || 1, u = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(rq.x, rq.y, rq.z, rq.w)); const tg = (Math.acos(Math.max(-1, Math.min(1, -(u.x * gw.x + u.y * gw.y + u.z * gw.z) / gl))) * 180) / Math.PI; maxTiltG = Math.max(maxTiltG, tg); sumTiltG += tg; }
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
    contactsAvg: (sumContacts / Math.max(1, Math.ceil(N / 4))), tiltMax: maxTilt, tiltAvg: sumTilt / Math.max(1, nS), tiltGMax: maxTiltG, tiltGAvg: sumTiltG / Math.max(1, nS), marginMin: Number.isFinite(minMargin) ? minMargin : null, marginAvg: nMargin ? sumMargin / nMargin : null, outsideFrac: nMargin ? outside / nMargin : null,
    energyJ: eJ, powerW: eJ / t, costOfTransport: fwd > 0.05 ? eJ / ((m / 1000) * 9.81 * (fwd / 100)) : null, peakTorque: peak, pen: maxPen, mass: m, fixBase, col: 0, ctrlLog, geo: log ? geo : undefined };
  setTimeout(() => { try { lab.world.free(); } catch {} }, 0);
  return r;
}

// v14：闭环用的几何（我的补充）。每个步态关节：r = 下游子树质心相对整机质心的水平位置 [x, z]（cm），
// infl = 关节转 +1 rad 时下游子树质心升高多少（cm）≈ (轴 × (子树质心 − 转轴点)).y。在建世界后、开动前算（刚体还在台面坐标里）
export function articGeo(lab, project, M, g) {
  const kids = new Map(); for (const { gp, gc } of lab.G.joints) { if (!kids.has(gp)) kids.set(gp, []); kids.get(gp).push(gc); }
  const sub = (i, acc = []) => { acc.push(i); for (const k of kids.get(i) || []) sub(k, acc); return acc; };
  const all = com(lab).c;
  const byId = new Map(lab.G.joints.map((x) => [x.j.id, x]));
  return g.joints.filter((J) => J.jid && byId.has(J.jid)).map((J) => {
    const { j, gc } = byId.get(J.jid), b = jointToBench(j, M);
    let m = 0; const c = new THREE.Vector3();
    for (const i of sub(gc)) { const rb = lab.rbs[i], mm = rb.mass(), w = rb.worldCom(); c.x += w.x * mm; c.y += w.y * mm; c.z += w.z * mm; m += mm; }
    c.divideScalar(Math.max(1e-9, m));
    const infl = new THREE.Vector3().crossVectors(b.axis, c.clone().sub(b.p)).y;
    return { jid: J.jid, r: [c.x - all.x, c.z - all.z], infl, revolute: j.type === "revolute" };
  });
}
function maxY(lab) { let y = -1e9; for (const rb of lab.rbs) y = Math.max(y, rb.worldCom().y); return y; }
function rotInvQ(q, v) { const Q = new THREE.Quaternion(q.x, q.y, q.z, q.w).invert(); const r = new THREE.Vector3(...v).applyQuaternion(Q); return [r.x, r.y, r.z]; }
