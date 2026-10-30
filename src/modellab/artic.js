// v12：上传模型的关节（铰链 / 滑轨 / 球关节 / 固定）。
// 思路（我的补充）：
// 1) 固定关节两端并成一个刚体；没有被任何活动关节当作“子模块”的模块，统统并进“根”刚体（底座）。
// 2) 每个活动关节 = 一个 Rapier 关节：转动/滑动有原生限位；舵机 = 力控位置马达（最大力 = datasheet 堵转扭矩），
//    目标角按 datasheet 空载速度限速（和 octopus/loco.js 同一个模型）。球关节没有马达，限位是我自己写的“软限位”（见 ballLimit）。
// 3) 关节两端的模块之间不算碰撞（铰接处本来就贴在一起）；其它任意两块之间都正常碰撞、有摩擦。
// 关节的铰接点、轴存“原始模型坐标”（和上传文件同一套坐标），换单位/缩放时跟着模型走；显示和仿真时再乘模型变换 M。
import * as THREE from "three";
import { driveParams, DRIVES } from "./servos.js";
import { MATERIALS, newId } from "./modules.js";

export const JOINT_TYPES = { revolute: "转动（铰链）", prismatic: "滑动（导轨）", ball: "球关节", fixed: "固定（粘死）" };
export const unitOf = (type) => (type === "prismatic" ? "mm" : "°");
export const isMoving = (j) => j && j.type !== "fixed";

export function newJoint(parent, child, anchorRaw, axisRaw, i = 0, type = "revolute") {
  return {
    id: newId("jt"), name: `关节 ${i + 1}`, type, parent, child,
    anchor: anchorRaw.map((v) => +(+v).toFixed(5)), axis: axisRaw.map((v) => +(+v).toFixed(5)),
    limits: type === "prismatic" ? { min: 0, max: 20 } : type === "ball" ? { min: 0, max: 30 } : { min: -90, max: 90 },
    drive: { preset: type === "prismatic" ? "linear" : type === "revolute" ? "sg51r" : "none", volt: 4.8, torque: 1, speed: 300, forceN: 5, speedMm: 20 },
    home: 0,
  };
}
// 限位整理：舵机行程截到 ±travel，min ≤ home ≤ max
export function effLimits(j) {
  let { min, max } = j.limits || { min: -90, max: 90 };
  const notes = [];
  if (j.type === "ball") return { min: 0, max: Math.max(1, Math.min(170, max)), notes };
  const dp = driveParams(j);
  if (j.type === "revolute" && dp.on && dp.travel) {
    if (min < -dp.travel || max > dp.travel) notes.push(`${dp.P.zh}行程约 ±${dp.travel}°，限位已截到 ±${dp.travel}°`);
    min = Math.max(min, -dp.travel); max = Math.min(max, dp.travel);
  }
  if (j.type === "revolute") { min = Math.max(min, -180); max = Math.min(max, 180); }
  if (min > max) [min, max] = [max, min];
  return { min, max, notes };
}
export const clampVal = (j, v) => { const L = effLimits(j); return j.type === "ball" ? 0 : Math.min(L.max, Math.max(L.min, v)); };

// ---- 刚体分组 ----
// v13（我的补充）：支持闭环连杆（四连杆、曲柄滑块、平行连杆）。
// 1) 固定关节两端并成一个刚体组；不是任何活动关节“子模块”的组都并进根（底座）。
// 2) 从根出发按关节顺序做生成树：树上的关节 = 普通关节；多出来的关节 = “闭环关节”（loop: true），
//    Rapier 冲量关节本来就允许成环，所以它照样建成一个关节约束，只是在自由度分析里多算一个闭环。
// 3) 连不到底座、自己成环的那一团：报错并去掉一个关节。
export function buildGroups(project) {
  const mods = project.modules.filter((m) => m.meshes.length).map((m) => m.id);
  const idx = new Map(mods.map((m, i) => [m, i]));
  const errors = [], warnings = [];
  let joints = (project.joints || []).filter((j) => {
    if (!idx.has(j.parent) || !idx.has(j.child)) { errors.push(`“${j.name}”：模块不存在或是空模块，已忽略`); return false; }
    if (j.parent === j.child) { errors.push(`“${j.name}”：父模块和子模块是同一个，已忽略`); return false; }
    return true;
  });
  for (let round = 0; round < 64; round++) {
    const uf = mods.map((_, i) => i);
    const find = (i) => (uf[i] === i ? i : (uf[i] = find(uf[i])));
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) uf[b] = a; };
    for (const j of joints) if (j.type === "fixed") uni(idx.get(j.parent), idx.get(j.child));
    const moving = joints.filter(isMoving);
    let bad = null;
    const isChild = new Set();
    for (const j of moving) {
      const gc = find(idx.get(j.child)), gp = find(idx.get(j.parent));
      if (gc === gp) { bad = [j, `“${j.name}”：两端已经被固定关节连成同一个刚体，已忽略`]; break; }
      isChild.add(gc);
    }
    if (!bad) {
      const keys = [...new Set(mods.map((_, i) => find(i)))];
      let roots = keys.filter((k) => !isChild.has(k));
      if (!roots.length && keys.length && moving.length) {
        roots = [find(idx.get(moving[0].parent))];
        warnings.push(`没有“不挂在任何关节下面”的模块：把“${moving[0].parent}”所在的那块当底座（我的补充）`);
      }
      for (const r of roots.slice(1)) uni(roots[0], r);
      const rootK = find(roots[0] ?? 0);
      // 生成树（按关节顺序，BFS）
      const seen = new Set([rootK]), tree = new Set();
      let grew = true;
      while (grew) {
        grew = false;
        for (const j of moving) {
          if (tree.has(j)) continue;
          const gp = find(idx.get(j.parent)), gc = find(idx.get(j.child));
          if (seen.has(gp) && !seen.has(gc)) { seen.add(gc); tree.add(j); grew = true; }
          else if (seen.has(gc) && !seen.has(gp)) { seen.add(gp); tree.add(j); grew = true; }
        }
      }
      const stray = moving.find((j) => !seen.has(find(idx.get(j.parent))) || !seen.has(find(idx.get(j.child))));
      if (stray) bad = [stray, `“${stray.name}”：这几块只和彼此连成了环、没有连到底座，已忽略这个关节`];
      else {
        const order = [rootK, ...[...new Set(mods.map((_, i) => find(i)))].filter((k) => k !== rootK)];
        const gi = new Map(order.map((k, i) => [k, i]));
        const groups = order.map((k, i) => ({ i, root: i === 0, mods: mods.filter((_, m) => find(m) === k) }));
        const groupOf = new Map(mods.map((m, i) => [m, gi.get(find(i))]));
        const mj = moving.map((j) => ({ j, gp: groupOf.get(j.parent), gc: groupOf.get(j.child), loop: !tree.has(j) }));
        // 树上每个组的“上一个关节”（往根走），给闭环找路径用
        const up = new Map();
        for (const e of mj) if (!e.loop) { const ds = depthOf(e, mj); up.set(ds.far, { e, near: ds.near }); }
        const loops = mj.filter((e) => e.loop).length;
        for (const e of mj) if (e.loop) warnings.push(`“${e.j.name}”是闭环关节（第 ${mj.filter((x) => x.loop).indexOf(e) + 1} 个环）：两端已经通过别的关节连着，Rapier 把它当成额外约束一起解`);
        return { groups, groupOf, joints: mj, errors, warnings, fixedCount: joints.length - moving.length, loops, up };
      }
    }
    errors.push(bad[1]);
    joints = joints.filter((j) => j !== bad[0]);
  }
  throw new Error("buildGroups: too many rounds");
}
// 树边：哪一端离根近（BFS 顺序里先出现的那端）
function depthOf(e, mj) {
  const d = new Map([[0, 0]]);
  let grew = true;
  while (grew) { grew = false; for (const x of mj) { if (x.loop) continue; if (d.has(x.gp) && !d.has(x.gc)) { d.set(x.gc, d.get(x.gp) + 1); grew = true; } else if (d.has(x.gc) && !d.has(x.gp)) { d.set(x.gp, d.get(x.gc) + 1); grew = true; } } }
  return (d.get(e.gp) ?? 0) <= (d.get(e.gc) ?? 0) ? { near: e.gp, far: e.gc } : { near: e.gc, far: e.gp };
}

// ---- v13：自由度分析（我的补充，老实说只是“瞬时”的） ----
// 三种算法一起给：空间 Grübler–Kutzbach 公式、平面机构公式（所有转轴平行时）、按当前姿态的旋量矩阵秩。
// 前两种只数零件和关节，不看几何；第三种看几何，但只在当前这个姿态成立（奇异位置会不一样）。
export function mobility(project, G, M) {
  const mj = G.joints, n = G.groups.length;
  const f = (e) => (e.j.type === "ball" ? 3 : 1);
  const sumF = mj.reduce((s, e) => s + f(e), 0);
  const grubler = 6 * (n - 1) - mj.reduce((s, e) => s + 6 - f(e), 0);
  const geo = mj.map((e) => jointToBench(e.j, M));
  // 平面：没有球关节，所有转轴互相平行，滑轨方向都垂直于转轴
  const rev = mj.map((e, i) => [e, geo[i]]).filter(([e]) => e.j.type === "revolute");
  const nrm = rev[0]?.[1].axis;
  let planar = !!nrm && !mj.some((e) => e.j.type === "ball");
  if (planar) for (const [e, g] of mj.map((e, i) => [e, geo[i]])) {
    if (e.j.type === "revolute" && Math.abs(Math.abs(g.axis.dot(nrm)) - 1) > 1e-3) planar = false;
    if (e.j.type === "prismatic" && Math.abs(g.axis.dot(nrm)) > 1e-3) planar = false;
  }
  const grublerPlanar = planar ? 3 * (n - 1) - mj.reduce((s, e) => s + 3 - f(e), 0) : null;
  // 旋量：每个关节自由度一列（ω, v），v 用特征长度归一化
  let Lc = 1;
  for (const g of geo) Lc = Math.max(Lc, g.p.length());
  const cols = []; // {e, k, tw:[6]}
  mj.forEach((e, i) => {
    const { p, axis } = geo[i];
    const ax = e.j.type === "ball" ? [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)] : [axis];
    for (const a of ax) {
      if (e.j.type === "prismatic") cols.push({ e, tw: [0, 0, 0, a.x, a.y, a.z] });
      else { const v = new THREE.Vector3().crossVectors(p, a).divideScalar(Lc); cols.push({ e, tw: [a.x, a.y, a.z, v.x, v.y, v.z] }); }
    }
  });
  // 每个闭环：闭环关节 + 树上从 gc 到 gp 的路径。约束：路径上（带方向）的旋量之和 − 闭环关节旋量 = 0
  const pathToRoot = (g) => { const out = []; let n2 = 0; while (g !== 0 && n2++ < 999) { const u = G.up.get(g); if (!u) break; out.push(u.e); g = u.near; } return out; };
  const rows = [];
  for (const e of mj.filter((x) => x.loop)) {
    const pa = pathToRoot(e.gp), pc = pathToRoot(e.gc);
    const shared = new Set(pa.filter((x) => pc.includes(x)));
    // 旋量方向：沿“从根往外”走时，关节的父端在近根一侧 → +1，否则 −1
    const sgn = (x) => (G.up.get(x.gc)?.e === x ? 1 : -1);
    const coef = new Map();
    for (const x of pc) if (!shared.has(x)) coef.set(x, (coef.get(x) || 0) + sgn(x));
    for (const x of pa) if (!shared.has(x)) coef.set(x, (coef.get(x) || 0) - sgn(x));
    coef.set(e, (coef.get(e) || 0) - 1);
    for (let r = 0; r < 6; r++) rows.push(cols.map((c) => (coef.get(c.e) || 0) * c.tw[r]));
  }
  const rank = matRank(rows, cols.length);
  const dof = cols.length - rank;
  const redundant = rows.length - rank;
  // 被锁死的关节：e_i 落在约束的行空间里 = 这个关节的速度被强制为 0
  const locked = [];
  if (rows.length) mj.forEach((e) => {
    if (e.j.type === "ball") return;
    const ci = cols.findIndex((c) => c.e === e);
    const r2 = matRank([...rows, cols.map((_, k) => (k === ci ? 1 : 0))], cols.length);
    if (r2 === rank) locked.push(e.j.name);
  });
  const driven = mj.filter((e) => e.j.type !== "ball" && driveParams(e.j).on).length;
  const loopJ = new Set();
  for (const e of mj.filter((x) => x.loop)) { loopJ.add(e); for (const x of [...pathToRoot(e.gp), ...pathToRoot(e.gc)]) loopJ.add(x); }
  const msgs = [];
  if (G.loops) {
    msgs.push({ lvl: "info", t: `${G.loops} 个闭环；空间公式 M = ${grubler}${planar ? `，平面公式 M = ${grublerPlanar}` : ""}；按当前姿态的旋量秩：自由度 ${dof}、冗余约束 ${redundant}` });
    if (dof === 0) msgs.push({ lvl: "err", t: `机构锁死：自由度 0，关节动不了（${locked.join("、") || "全部"}）。检查轴线 / 杆长是不是画对了` });
    else if (locked.length) msgs.push({ lvl: "warn", t: `这些关节被闭环锁死、动不了：${locked.join("、")}` });
    if (redundant > 0) msgs.push({ lvl: planar ? "info" : "warn", t: planar ? `平面机构在三维里有 ${redundant} 个冗余约束（正常现象：转轴必须严格平行，实物要靠加工精度 / 间隙；Rapier 迭代求解能处理，但会有一点抖动 / 漂移）` : `过约束：有 ${redundant} 个冗余约束且不是平面机构，实物很可能装不上或卡死；仿真里关节会互相拉扯` });
    if (planar && grublerPlanar != null && dof !== grublerPlanar) msgs.push({ lvl: "warn", t: `平面公式说 M = ${grublerPlanar}，但按当前几何是 ${dof}：几何特殊（比如三根等长平行的曲柄）或处在奇异位置（比如杆共线），换个姿态再看` });
    const drivenLoop = [...loopJ].filter((x) => x.j.type !== "ball" && driveParams(x.j).on).length;
    if (drivenLoop > dof && dof > 0) msgs.push({ lvl: "warn", t: `过驱动：环里有 ${drivenLoop} 个带马达的关节，但只有 ${dof} 个自由度，马达会互相顶（只给 ${dof} 个关节配驱动，其余选“无驱动”）` });
  }
  return { n, sumF, grubler, planar, grublerPlanar, dof, rank, redundant, loops: G.loops, locked, driven, msgs, ok: !G.loops || dof > 0 };
}
function matRank(rows, nc) {
  const A = rows.map((r) => r.slice());
  let rank = 0;
  for (let c = 0; c < nc && rank < A.length; c++) {
    let piv = rank, best = 0;
    for (let r = rank; r < A.length; r++) if (Math.abs(A[r][c]) > best) { best = Math.abs(A[r][c]); piv = r; }
    if (best < 1e-7) continue;
    [A[rank], A[piv]] = [A[piv], A[rank]];
    for (let r = 0; r < A.length; r++) if (r !== rank) { const k = A[r][c] / A[rank][c]; if (k) for (let q = c; q < nc; q++) A[r][q] -= k * A[rank][q]; }
    rank++;
  }
  return rank;
}

// 原始坐标 → 台面坐标（cm）
export function jointToBench(j, M) {
  const p = new THREE.Vector3(...j.anchor).applyMatrix4(M);
  const a = new THREE.Vector3(...j.axis);
  if (a.lengthSq() < 1e-12) a.set(0, 1, 0);
  a.transformDirection(M);
  return { p, axis: a.normalize() };
}
export function benchToRaw(p, M) { return new THREE.Vector3().copy(p).applyMatrix4(M.clone().invert()).toArray(); }
export function axisToRaw(a, M) { const inv = M.clone().invert(); return new THREE.Vector3().copy(a).transformDirection(inv).toArray(); }

const t3 = (v) => new THREE.Vector3(v.x, v.y, v.z);
const q4 = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const plain = (v) => ({ x: v.x, y: v.y, z: v.z });
const plainQ = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });
const toSim = (j, v) => (j.type === "prismatic" ? v / 10 : (v * Math.PI) / 180);
const fromSim = (j, v) => (j.type === "prismatic" ? v * 10 : (v * 180) / Math.PI);

// ---- 关节仿真核心：给定世界 + 每个刚体组的刚体，建关节、马达，按目标驱动 ----
// frame：模型在世界里的摆放（台面坐标 → 世界），{p, q}
export class ArticCore {
  constructor(R, world, project, M, G, rbOf, { frame, onPair, fixTo } = {}) {
    Object.assign(this, { R, world, project, M, G, rbOf });
    this.frame = frame || { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    this.J = new Map();
    this.pairs = new Set();
    this.player = null;
    this.time = 0;
    this.lost = null;
    for (const { j, gp, gc } of G.joints) this.addJoint(j, gp, gc, onPair);
    if (fixTo) {
      const rb = rbOf(0), t = rb.translation(), r = rb.rotation();
      // 把底座“拧”在桌面/地面上：一个固定关节（我的补充：相当于用螺丝固定）
      const ft = t3(fixTo.translation()), fq = q4(fixTo.rotation());
      const a2 = t3(t).sub(ft).applyQuaternion(fq.clone().invert()), q2 = fq.clone().invert().multiply(q4(r));
      const jd = R.JointData.fixed({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, plain(a2), plainQ(q2));
      jd.limitsEnabled = false;
      this.baseFix = world.createImpulseJoint(jd, rb, fixTo, true);
    }
  }
  addJoint(j, gp, gc, onPair) {
    const R = this.R, rb1 = this.rbOf(gp), rb2 = this.rbOf(gc);
    const b = jointToBench(j, this.M);
    const wp = b.p.clone().applyQuaternion(this.frame.q).add(this.frame.p);
    const wa = b.axis.clone().applyQuaternion(this.frame.q);
    const loc = (rb, v) => v.clone().sub(t3(rb.translation())).applyQuaternion(q4(rb.rotation()).invert());
    const a1 = loc(rb1, wp), a2 = loc(rb2, wp);
    const ax1 = wa.clone().applyQuaternion(q4(rb1.rotation()).invert()).normalize();
    const rel0 = q4(rb1.rotation()).invert().multiply(q4(rb2.rotation()));
    const L = effLimits(j);
    let jd;
    if (j.type === "revolute") jd = R.JointData.revolute(plain(a1), plain(a2), plain(ax1));
    else if (j.type === "prismatic") jd = R.JointData.prismatic(plain(a1), plain(a2), plain(ax1));
    else jd = R.JointData.spherical(plain(a1), plain(a2));
    if (j.type !== "ball") { jd.limitsEnabled = true; jd.limits = [toSim(j, L.min), toSim(j, L.max)]; }
    const joint = this.world.createImpulseJoint(jd, rb1, rb2, true);
    joint.setContactsEnabled(false);
    if (j.type !== "ball" && joint.setLimits) joint.setLimits(toSim(j, L.min), toSim(j, L.max));
    const dp = driveParams(j);
    const st = { j, gp, gc, joint, a1, a2, ax1, rel0, L, dp, target: clampVal(j, j.home || 0), cmd: clampVal(j, j.home || 0), k: 0 };
    if (dp.on) {
      joint.configureMotorModel(R.MotorModel.ForceBased);
      st.k = j.type === "prismatic" ? dp.maxF / 0.2 : dp.maxF / ((5 * Math.PI) / 180); // 误差 5°（滑轨 2 mm）= 满扭矩（估算，同 loco.js）
      joint.setMotorMaxForce(dp.maxF);
      joint.configureMotorPosition(toSim(j, st.cmd), st.k, 0.08 * st.k);
      if (dp.armI) rb2.setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: dp.armI, y: dp.armI, z: dp.armI }, { x: 0, y: 0, z: 0, w: 1 }, true);
    }
    this.J.set(j.id, st);
    const key = pairKey(rb1.handle, rb2.handle);
    this.pairs.add(key);
    onPair?.(rb1, rb2);
  }
  alive() {
    if (this.lost) return false;
    for (const st of this.J.values()) {
      const a = this.rbOf(st.gp), b = this.rbOf(st.gc);
      if (!a || !b || !this.world.getRigidBody(a.handle) || !this.world.getRigidBody(b.handle)) { this.lost = "有零件被拆开或删除了，关节已断开"; return false; }
    }
    return true;
  }
  value(id) {
    const st = this.J.get(id);
    if (!st) return 0;
    const rb1 = this.rbOf(st.gp), rb2 = this.rbOf(st.gc);
    const q1 = q4(rb1.rotation()), q2 = q4(rb2.rotation());
    if (st.j.type === "revolute") {
      const qr = this.relQ(st, q1, q2);
      const s = qr.x * st.ax1.x + qr.y * st.ax1.y + qr.z * st.ax1.z;
      let a = 2 * Math.atan2(s, qr.w);
      if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI;
      return fromSim(st.j, a);
    }
    const w1 = st.a1.clone().applyQuaternion(q1).add(t3(rb1.translation()));
    const w2 = st.a2.clone().applyQuaternion(q2).add(t3(rb2.translation()));
    if (st.j.type === "prismatic") return fromSim(st.j, w2.sub(w1).applyQuaternion(q1.clone().invert()).dot(st.ax1));
    // 球关节：子块相对父块“歪”了多少度（摆角）
    const qr = this.relQ(st, q1, q2);
    const ax = st.ax1.clone().applyQuaternion(qr);
    return (Math.acos(Math.min(1, Math.max(-1, ax.dot(st.ax1)))) * 180) / Math.PI;
  }
  // 父块坐标系里，子块从起始姿态转了多少（四元数）
  relQ(st, q1, q2) { return q1.clone().invert().multiply(q2).multiply(st.rel0.clone().invert()); }
  setTarget(id, v) {
    const st = this.J.get(id);
    if (!st) return;
    st.target = clampVal(st.j, +v || 0);
    this.rbOf(st.gc)?.wakeUp();
    this.rbOf(st.gp)?.wakeUp();
  }
  setTargets(vals) { for (const k in vals) this.setTarget(k, vals[k]); }
  targets() { const o = {}; for (const [k, st] of this.J) if (st.j.type !== "ball") o[k] = +st.target.toFixed(2); return o; }
  step(dt) {
    if (!this.alive()) return;
    this.time += dt;
    if (this.player) {
      const v = this.player.fn(this.player.t);
      this.player.t += dt;
      if (v) this.setTargets(v); else { this.player.done?.(); this.player = null; }
    }
    for (const st of this.J.values()) {
      if (st.j.type === "ball") { this.ballLimit(st, dt); continue; }
      if (!st.dp.on) continue;
      const sp = fromSim(st.j, st.dp.speed) * dt;
      const d = st.target - st.cmd;
      st.cmd += Math.abs(d) <= sp ? d : Math.sign(d) * sp;
      if (Math.abs(d) > 1e-6) { this.rbOf(st.gc)?.wakeUp(); this.rbOf(st.gp)?.wakeUp(); }
      st.joint.configureMotorPosition(toSim(st.j, st.cmd), st.k, 0.08 * st.k);
    }
  }
  // 球关节软限位（我的补充）：摆角超过上限时，去掉子块继续往外摆的那部分角速度，并往回拉一点
  ballLimit(st, dt) {
    const max = (st.L.max * Math.PI) / 180;
    const rb1 = this.rbOf(st.gp), rb2 = this.rbOf(st.gc);
    const q1 = q4(rb1.rotation()), q2 = q4(rb2.rotation());
    const a0 = st.ax1.clone().applyQuaternion(q1);
    const a1 = st.ax1.clone().applyQuaternion(q2.clone().multiply(st.rel0.clone().invert()));
    const ang = Math.acos(Math.min(1, Math.max(-1, a0.dot(a1))));
    if (ang <= max) return;
    const n = a0.clone().cross(a1);
    if (n.lengthSq() < 1e-12) return;
    n.normalize();
    const w1 = t3(rb1.angvel()), w2 = t3(rb2.angvel());
    const out = w2.clone().sub(w1).dot(n);
    const fix = Math.max(0, out) + ((ang - max) / dt) * 0.3;
    const dw = n.multiplyScalar(fix);
    // 绕关节点转：角速度去掉 dw，质心线速度也要同步去掉 dw ×（质心 − 关节点），否则关节约束会把线速度又变回摆动
    const piv = st.a2.clone().applyQuaternion(q2).add(t3(rb2.translation()));
    const com = t3(rb2.worldCom ? rb2.worldCom() : rb2.translation());
    const dv = dw.clone().cross(com.sub(piv));
    rb2.setAngvel(plain(w2.sub(dw)), true);
    rb2.setLinvel(plain(t3(rb2.linvel()).sub(dv)), true);
  }
  stats() {
    const out = [];
    for (const [id, st] of this.J) {
      const v = this.value(id);
      const err = st.cmd - v;
      const unitErr = st.j.type === "prismatic" ? 2 : 5;
      out.push({ id, name: st.j.name, type: st.j.type, value: v, target: st.target, cmd: st.cmd, limits: st.L, load: st.dp.on ? Math.min(100, (Math.abs(err) / unitErr) * 100) : 0, stalled: st.dp.on && Math.abs(err) > unitErr && Math.abs(st.target - st.cmd) < 1e-6 });
    }
    return out;
  }
  // ---- 动作播放 ----
  stop() { this.player = null; }
  playing() { return this.player?.what || null; }
  play(what, fn, done) { this.player = { what, fn, t: 0, done }; }
  // 单个关节测试：回中 → 最大 → 最小 → 回中（时长按驱动速度算）
  testSweep(id) {
    const st = this.J.get(id); if (!st) return;
    const L = st.L, h = clampVal(st.j, st.j.home || 0);
    const sp = st.dp.on ? fromSim(st.j, st.dp.speed) : st.j.type === "prismatic" ? 20 : 120;
    const seq = [h, L.max, L.min, h];
    const durs = seq.slice(1).map((v, i) => Math.abs(v - seq[i]) / sp + 0.35);
    const total = durs.reduce((a, b) => a + b, 0);
    this.play(`测试 ${st.j.name}`, (t) => {
      if (t > total + 0.4) return null;
      let acc = 0;
      for (let i = 0; i < durs.length; i++) { if (t < acc + durs[i]) return { [id]: seq[i + 1] }; acc += durs[i]; }
      return { [id]: h };
    });
  }
  // 功能播放：绑定到这个功能的关节一起“波浪”摆两圈（相位按顺序错开）
  playFunction(fn, { cycles = 2, period = 1.6 } = {}) {
    const ids = (fn.joints || []).filter((id) => this.J.has(id) && this.J.get(id).j.type !== "ball");
    if (!ids.length) return false;
    this.play(`功能：${fn.name}`, (t) => {
      if (t > cycles * period) return t > cycles * period + 0.6 ? null : Object.fromEntries(ids.map((id) => [id, this.J.get(id).j.home || 0]));
      const o = {};
      ids.forEach((id, i) => {
        const st = this.J.get(id), h = clampVal(st.j, st.j.home || 0);
        const amp = 0.8 * Math.min(st.L.max - h, h - st.L.min) || 0.8 * (st.L.max - st.L.min) / 2;
        o[id] = h + amp * Math.sin(2 * Math.PI * (t / period - i / ids.length));
      });
      return o;
    });
    return true;
  }
  playTimeline(project, { loop = project.timeline?.loop } = {}) {
    const keys = (project.timeline?.keys || []).slice().sort((a, b) => a.t - b.t);
    if (keys.length < 1) return false;
    const end = keys[keys.length - 1].t;
    this.play("时间轴", (t) => {
      if (t > end + 0.5) { if (loop && end > 0) { this.player.t = 0; t = 0; } else return null; }
      return sampleTimeline(project, keys, t);
    });
    return true;
  }
}
export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function poseValues(project, poseId) { return project.poses?.find((p) => p.id === poseId)?.values || null; }
export function sampleTimeline(project, keys, t) {
  const homes = Object.fromEntries((project.joints || []).filter((j) => j.type === "revolute" || j.type === "prismatic").map((j) => [j.id, j.home || 0]));
  const vals = (k) => ({ ...homes, ...(poseValues(project, k.pose) || {}) });
  if (t <= keys[0].t) return vals(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = vals(keys[i - 1]), b = vals(keys[i]), u = (t - keys[i - 1].t) / Math.max(1e-6, keys[i].t - keys[i - 1].t);
      const o = {};
      for (const k in homes) o[k] = a[k] + (b[k] - a[k]) * u;
      return o;
    }
  }
  return vals(keys[keys.length - 1]);
}

// ---- 模型页自己的小世界：地面 + 每个刚体组一个刚体 ----
// v13（我的补充）：凸包碰撞体改成“圆角凸包”（圆角 0.5 mm，顶点先往里收 0.5 mm，外形基本不变）。
// 原因：Rapier 的尖角凸包和地面接触时，偶尔给出斜的接触法线，μ = 0 的冰面上整机也会“自己滑走”（实测 10 s 漂 14 cm，
// 违反动量守恒）；圆角后同一测试只漂 0.1 cm。对照实验见 scripts/gait-test.mjs。
// 只在工程勾了 sim.roundHulls 时用（会让本来刚好贴着的零件互相碰到，旧的关节/连杆示例不适合），四足示例默认勾上。
const HULL_R = 0.05;
function roundHull(R, a) {
  const h = a.hull, n = h.length / 3, r = Math.min(HULL_R, 0.25 * Math.min(a.half.x, a.half.y, a.half.z));
  if (r < 0.005) return R.ColliderDesc.convexHull(h);
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += h[3 * i]; cy += h[3 * i + 1]; cz += h[3 * i + 2]; }
  cx /= n; cy /= n; cz /= n;
  const p = new Float32Array(h.length);
  for (let i = 0; i < n; i++) {
    const dx = h[3 * i] - cx, dy = h[3 * i + 1] - cy, dz = h[3 * i + 2] - cz, L = Math.hypot(dx, dy, dz) || 1, k = Math.max(0, 1 - r / L);
    p[3 * i] = cx + dx * k; p[3 * i + 1] = cy + dy * k; p[3 * i + 2] = cz + dz * k;
  }
  return R.ColliderDesc.roundConvexHull(p, r) || R.ColliderDesc.convexHull(h);
}
export function createLabWorld(R, project, an, M, { fixBase = false, gravity = true, roundHulls = !!project.sim?.roundHulls } = {}) {
  const G = buildGroups(project);
  const world = new R.World({ x: 0, y: gravity ? -981 : 0, z: 0 });
  world.timestep = 1 / 240;
  world.numSolverIterations = 8;
  world.integrationParameters.contact_natural_frequency = 600; // 与装配台引擎相同的“硬”接触
  // 地面用运动学刚体（同装配台：fixed 刚体上的接触不吃上面的硬度参数）
  const ground = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
  world.createCollider(R.ColliderDesc.cuboid(200, 1, 200).setTranslation(0, -1, 0).setFriction(0.6), ground); // 地面摩擦 0.6（估算）
  const rbs = [], colMod = new Map(), modBody = new Map();
  for (const g of G.groups) {
    const rb = world.createRigidBody(R.RigidBodyDesc.dynamic().setCcdEnabled(true).setLinearDamping(0.1).setAngularDamping(0.5).setCanSleep(false));
    for (const m of g.mods) {
      const a = an.get(m), mod = project.modules.find((x) => x.id === m);
      if (!a) continue;
      const mat = MATERIALS[mod.material] || MATERIALS.pla;
      const d = (a.hull ? (roundHulls ? roundHull(R, a) : R.ColliderDesc.convexHull(a.hull)) : null) || R.ColliderDesc.cuboid(Math.max(a.half.x, 0.005), Math.max(a.half.y, 0.005), Math.max(a.half.z, 0.005));
      d.setTranslation(a.center.x, a.center.y, a.center.z).setFriction(mat.mu).setRestitution(0).setMass(Math.max(0.01, a.massG));
      const col = world.createCollider(d, rb);
      colMod.set(col.handle, m);
      modBody.set(m, rb);
    }
    rbs.push(rb);
  }
  const core = new ArticCore(R, world, project, M, G, (i) => rbs[i], { fixTo: fixBase ? ground : null });
  const lab = { world, rbs, colMod, modBody, ground, core, G, blocks: [] };
  lab.restOverlaps = restOverlaps(lab, project);
  return lab;
}
// 起始就重叠、又不是关节两端的模块对（它们一开动就会互相顶开）
export function restOverlaps(lab, project) {
  const cols = [];
  lab.world.forEachCollider((c) => { if (lab.colMod.has(c.handle)) cols.push(c); });
  const name = (h) => project.modules.find((m) => m.id === lab.colMod.get(h))?.name || "?";
  const out = [];
  for (let i = 0; i < cols.length; i++) for (let k = i + 1; k < cols.length; k++) {
    const a = cols[i], b = cols[k];
    if (a.parent().handle === b.parent().handle || lab.core.pairs.has(pairKey(a.parent().handle, b.parent().handle))) continue;
    const sc = a.contactCollider(b, 0);
    if (sc && sc.distance < -0.02) out.push({ a: name(a.handle), b: name(b.handle), mm: +(-sc.distance * 10).toFixed(2) });
  }
  return out;
}
// 实时最大穿模（mm）：不算关节两端、不算同一刚体
export function labPenetration(lab) {
  let worst = 0, pair = null, contacts = 0;
  lab.world.forEachCollider((c1) => {
    lab.world.contactPairsWith(c1, (c2) => {
      if (c1.handle > c2.handle) return;
      const b1 = c1.parent()?.handle, b2 = c2.parent()?.handle;
      if (b1 === b2 || lab.core.pairs.has(pairKey(b1, b2))) return;
      const sc = c1.contactCollider(c2, 0.01);
      if (!sc) return;
      contacts++;
      if (sc.distance < worst) { worst = sc.distance; pair = [c1.handle, c2.handle]; }
    });
  });
  return { mm: +(-worst * 10).toFixed(3), contacts, pair };
}
// 测试方块（2 cm，PLA 实心 ≈ 9.9 g）：看关节能不能推动别的东西
export function addBlock(R, lab, p, size = 2) {
  const rb = lab.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p[0], p[1] ?? size / 2, p[2]).setCcdEnabled(true).setCanSleep(false));
  lab.world.createCollider(R.ColliderDesc.cuboid(size / 2, size / 2, size / 2).setFriction(MATERIALS.pla.mu).setMass(size ** 3 * MATERIALS.pla.rho), rb);
  lab.blocks.push({ rb, size });
  return rb;
}
export function stepLab(lab, dt) {
  lab.acc = Math.min((lab.acc || 0) + dt, 8 / 240);
  while (lab.acc >= lab.world.timestep) {
    lab.core.step(lab.world.timestep);
    lab.world.step();
    lab.acc -= lab.world.timestep;
  }
}
export { DRIVES };
