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
    const childOf = new Map();
    let bad = null;
    for (const j of moving) {
      const gc = find(idx.get(j.child)), gp = find(idx.get(j.parent));
      if (gc === gp) { bad = [j, `“${j.name}”：两端已经被固定关节连成同一个刚体，已忽略`]; break; }
      if (childOf.has(gc)) { bad = [j, `“${j.name}”：子模块那一块已经有父关节“${childOf.get(gc).name}”（一块只能挂在一个关节上），已忽略`]; break; }
      childOf.set(gc, j);
    }
    if (!bad) {
      // 不是任何活动关节子模块的块 → 并成根
      const keys = [...new Set(mods.map((_, i) => find(i)))];
      const roots = keys.filter((k) => !childOf.has(k));
      if (!roots.length && keys.length) { bad = [moving[moving.length - 1], `“${moving[moving.length - 1].name}”：关节连成了环（没有底座），已忽略`]; }
      else {
        for (const r of roots.slice(1)) uni(roots[0], r);
        // 环检查：从每个子块往上走必须走到根
        const rootK = find(roots[0] ?? 0);
        for (const [gc, j] of childOf) {
          let g = gc, n = 0;
          while (find(g) !== rootK && n++ <= keys.length) { const pj = childOf.get(find(g)); if (!pj) break; g = find(idx.get(pj.parent)); }
          if (find(g) !== rootK) { bad = [j, `“${j.name}”：关节连成了环，已忽略`]; break; }
        }
        if (!bad) {
          const order = [rootK, ...[...new Set(mods.map((_, i) => find(i)))].filter((k) => k !== rootK)];
          const gi = new Map(order.map((k, i) => [k, i]));
          const groups = order.map((k, i) => ({ i, root: i === 0, mods: mods.filter((_, m) => find(m) === k) }));
          const groupOf = new Map(mods.map((m, i) => [m, gi.get(find(i))]));
          const mj = moving.map((j) => ({ j, gp: groupOf.get(j.parent), gc: groupOf.get(j.child) }));
          return { groups, groupOf, joints: mj, errors, warnings, fixedCount: joints.length - moving.length };
        }
      }
    }
    errors.push(bad[1]);
    joints = joints.filter((j) => j !== bad[0]);
  }
  throw new Error("buildGroups: too many rounds");
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
      const jd = R.JointData.fixed({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, plain(t), plainQ(r));
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
export function createLabWorld(R, project, an, M, { fixBase = false, gravity = true } = {}) {
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
      const d = (a.hull ? R.ColliderDesc.convexHull(a.hull) : null) || R.ColliderDesc.cuboid(Math.max(a.half.x, 0.005), Math.max(a.half.y, 0.005), Math.max(a.half.z, 0.005));
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
