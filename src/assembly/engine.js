// 装配台物理引擎：Rapier 刚体 + 复合方块碰撞盒。
// 设计：
//  · 每个“刚体组”(body) 是一个 Rapier 动态刚体，挂着组内所有零件的碰撞盒；同组零件之间不再互相碰撞。
//  · 零件之间的关系是边：seat（放上去/插进去，拖走即分开）、fasten（拧紧/焊上/压紧，一起走）。
//  · 拖拽 = 速度控制朝光标目标走；默认 dominance −1：碰到东西就停（不穿模）；按住 Shift 变成 +1：推开别的。
//  · 松手时按“特征”（孔、螺纹、针脚、插口……）匹配吸附；吸附前检查新位置会不会和第三方零件穿模。
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { THREAD, CABLES, PROC_BY_ID } from "./procedural";

const G_PART = 1, G_BENCH = 2, G_ROPE = 4, G_TOOL = 8;
const grp = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);
const GROUPS = {
  part: grp(G_PART, G_PART | G_BENCH | G_ROPE | G_TOOL),
  bench: grp(G_BENCH, G_PART | G_ROPE),
  rope: grp(G_ROPE, G_PART | G_BENCH | G_TOOL),
  tool: grp(G_TOOL, G_PART | G_ROPE),
};
export const BENCH = { w: 60, d: 40 };
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const q2t = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const yawQ = (yaw) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
function yawOf(q) {
  const f = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  return Math.atan2(-f.z, f.x);
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let uidSeq = 1;
let bodySeq = 1;

// 桌面、左、右、后、前围栏：从零件指向它们的方向
const BENCH_N = [{ x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }];
class Engine {
  constructor() {
    this.ready = false;
    this.parts = new Map(); // uid → part
    this.bodies = new Map(); // id → body
    this.edges = []; // {a, b, kind:'seat'|'fasten', why}
    this.cables = [];
    this.colOwner = new Map(); // collider handle → uid / 'rope' / 'bench' / 'tool'
    this.listeners = new Set();
    this.toasts = [];
    this.acc = 0;
    this.drag = null;
    this.ops = []; // 进行中的“按住”操作
    this.tool = { kind: "hand", body: null, pos: new THREE.Vector3(0, 30, 0) };
    this.version = 0;
    this.log = [];
    this.history = []; // 装配步骤记录（导出装配指南用）
  }
  async init() {
    if (this.ready) return;
    await RAPIER.init();
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -981, z: 0 });
    this.world.timestep = 1 / 120;
    this.world.numSolverIterations = 8;
    // 接触调“硬”（默认 30 Hz 的软接触在 1 cm 单位下会压进去零点几毫米）
    this.world.integrationParameters.contact_natural_frequency = 600;
    // 桌面 + 看不见的围栏
    // 桌面用“运动学”刚体而不是 fixed：实测 fixed 刚体上的接触不吃上面的硬度参数，重物会压进桌面 0.3–0.6 mm
    const fixed = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const add = (hx, hy, hz, x, y, z) => {
      const c = this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.8).setCollisionGroups(GROUPS.bench), fixed);
      this.colOwner.set(c.handle, "bench");
      (this.benchCols ||= []).push(c);
    };
    add(BENCH.w / 2 + 5, 1, BENCH.d / 2 + 5, 0, -1, 0);
    add(0.5, 15, BENCH.d / 2, -BENCH.w / 2 - 0.5, 15, 0);
    add(0.5, 15, BENCH.d / 2, BENCH.w / 2 + 0.5, 15, 0);
    add(BENCH.w / 2, 15, 0.5, 0, 15, -BENCH.d / 2 - 0.5);
    add(BENCH.w / 2, 15, 0.5, 0, 15, BENCH.d / 2 + 0.5);
    this.fixed = fixed;
    // 工具（运动学刚体）
    this.ready = true;
    this.emit();
  }
  on(f) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  emit() {
    this.version++;
    for (const f of this.listeners) f(this.version);
  }
  toast(text, kind = "info") {
    const t = { id: Date.now() + Math.random(), text, kind };
    this.toasts = [...this.toasts.slice(-4), t];
    this.log.push(`[${kind}] ${text}`);
    this.emit();
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x !== t);
      this.emit();
    }, kind === "error" ? 6500 : 4200);
  }

  // ---------------- 零件 / 刚体组 ----------------
  worldPose(uid) {
    const p = this.parts.get(uid);
    const b = this.bodies.get(p.body);
    const t = b.rb.translation(), r = b.rb.rotation();
    const bq = q2t(r);
    const pos = p.rel.p.clone().applyQuaternion(bq).add(new THREE.Vector3(t.x, t.y, t.z));
    return { p: pos, q: bq.clone().multiply(p.rel.q) };
  }
  bodyPose(bid) {
    const b = this.bodies.get(bid);
    const t = b.rb.translation(), r = b.rb.rotation();
    return { p: new THREE.Vector3(t.x, t.y, t.z), q: q2t(r) };
  }
  // 零件局部点 → 世界
  toWorld(uid, local) {
    const w = this.worldPose(uid);
    return V(local).applyQuaternion(w.q).add(w.p);
  }
  addPart(def, pose, opts = {}) {
    const uid = opts.uid || `${def.id.replace(/[^a-z0-9]+/gi, "_").slice(0, 24)}#${uidSeq++}`;
    const part = { uid, def, body: null, rel: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, state: { joints: {}, ...(opts.state || {}) }, label: opts.label };
    this.parts.set(uid, part);
    // 出生点限制在桌面范围内
    pose = { p: pose.p.clone(), q: pose.q };
    pose.p.x = Math.max(-BENCH.w / 2 + 2, Math.min(BENCH.w / 2 - 2, pose.p.x));
    pose.p.z = Math.max(-BENCH.d / 2 + 2, Math.min(BENCH.d / 2 - 2, pose.p.z));
    this.makeBody([uid], new Map([[uid, { p: pose.p.clone(), q: pose.q.clone() }]]), opts.sleep);
    // 出生点和已有零件重叠就往上挪，直到不重叠（新零件从上方落下，不会一出现就穿模）
    if (!opts.allowOverlap) {
      const bid = part.body, bp = this.bodyPose(bid);
      for (let k = 0; k < 150 && this.overlapAt(bid, bp.p, bp.q, new Set()); k++) bp.p.y += 0.2;
      this.bodies.get(bid).rb.setTranslation({ x: bp.p.x, y: bp.p.y, z: bp.p.z }, true);
      this.world.propagateModifiedBodyPositionsToColliders();
      // 插脚等伸到桌面以下的部分：再往上抬到桌面之上
      this.depenetrate(bid, 6);
    }
    this.emit();
    return uid;
  }
  // 直接把一个单独的刚体摆到某个位姿（导入/预设用；随后仍走 trySnap 的同一套装配规则和穿模检查）
  teleport(uid, p, q) {
    const b = this.bodies.get(this.parts.get(uid).body);
    b.rb.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    b.rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.world.propagateModifiedBodyPositionsToColliders();
  }
  removePart(uid) {
    const p = this.parts.get(uid);
    if (!p) return;
    for (const c of this.cables.filter((c) => c.ends.includes(uid))) this.removeCable(c.id);
    const bid = p.body;
    const others = [...this.bodies.get(bid).parts].filter((u) => u !== uid);
    const poses = new Map(others.map((u) => [u, this.worldPose(u)]));
    this.edges = this.edges.filter((e) => e.a !== uid && e.b !== uid);
    this.destroyBody(bid);
    this.parts.delete(uid);
    this.splitIntoBodies(others, poses);
    this.emit();
  }
  makeBody(uids, poses, sleep = false) {
    const R = this.R;
    const lead = uids[0];
    // 四元数一律先归一化：没归一化的旋转会让 Rapier 里的形状被拉伸，看起来像穿模
    for (const u of uids) poses.get(u).q.normalize();
    const lp = poses.get(lead);
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(lp.p.x, lp.p.y, lp.p.z)
      .setRotation({ x: lp.q.x, y: lp.q.y, z: lp.q.z, w: lp.q.w })
      .setCcdEnabled(true)
      .setLinearDamping(0.6)
      .setAngularDamping(2.0)
      .setCanSleep(true);
    const rb = this.world.createRigidBody(desc);
    const id = bodySeq++;
    const body = { id, rb, parts: new Set(uids), colliders: new Map() };
    this.bodies.set(id, body);
    const inv = lp.q.clone().invert();
    for (const u of uids) {
      const p = this.parts.get(u);
      const w = poses.get(u);
      p.body = id;
      p.rel = { p: w.p.clone().sub(lp.p).applyQuaternion(inv), q: inv.clone().multiply(w.q).normalize() };
      this.addColliders(body, p);
    }
    if (sleep) rb.sleep();
    this.rebindCables();
    return id;
  }
  addColliders(body, p) {
    const R = this.R;
    const list = [];
    for (const c of p.def.colliders) {
      const cp = V(c.c).applyQuaternion(p.rel.q).add(p.rel.p);
      const d = R.ColliderDesc.cuboid(Math.max(c.h[0], 0.005), Math.max(c.h[1], 0.005), Math.max(c.h[2], 0.005))
        .setTranslation(cp.x, cp.y, cp.z)
        .setRotation({ x: p.rel.q.x, y: p.rel.q.y, z: p.rel.q.z, w: p.rel.q.w })
        .setDensity(p.def.density || 1.2)
        .setFriction(0.7)
        .setRestitution(0)
        .setCollisionGroups(GROUPS.part);
      const col = this.world.createCollider(d, body.rb);
      this.colOwner.set(col.handle, p.uid);
      list.push({ col, c });
    }
    body.colliders.set(p.uid, list);
  }
  // 零件在组内的相对位姿变了（拧螺丝、压舵盘）：只更新它自己的碰撞盒
  updateRel(uid) {
    const p = this.parts.get(uid);
    const body = this.bodies.get(p.body);
    for (const { col, c } of body.colliders.get(uid) || []) {
      const cp = V(c.c).applyQuaternion(p.rel.q).add(p.rel.p);
      col.setTranslationWrtParent({ x: cp.x, y: cp.y, z: cp.z });
      col.setRotationWrtParent({ x: p.rel.q.x, y: p.rel.q.y, z: p.rel.q.z, w: p.rel.q.w });
    }
  }
  destroyBody(bid) {
    const b = this.bodies.get(bid);
    if (!b) return;
    for (const list of b.colliders.values()) for (const { col } of list) this.colOwner.delete(col.handle);
    for (const c of this.cables) for (const j of c.endJoints) if (j && (j.b1 === b.rb || j.b2 === b.rb)) j.dead = true;
    this.world.removeRigidBody(b.rb);
    this.bodies.delete(bid);
  }
  // 按边（seat+fasten）把零件分成连通块，每块一个刚体
  splitIntoBodies(uids, poses) {
    const set = new Set(uids);
    const seen = new Set();
    const out = [];
    for (const u of uids) {
      if (seen.has(u)) continue;
      const comp = [];
      const st = [u];
      seen.add(u);
      while (st.length) {
        const x = st.pop();
        comp.push(x);
        for (const e of this.edges) {
          const y = e.a === x ? e.b : e.b === x ? e.a : null;
          if (y && set.has(y) && !seen.has(y)) {
            seen.add(y);
            st.push(y);
          }
        }
      }
      // 让“最底下的支撑”当组长（底板、面包板优先）
      comp.sort((a, b) => rank(this.parts.get(b).def) - rank(this.parts.get(a).def));
      out.push(this.makeBody(comp, poses));
    }
    return out;
  }
  // 把 uids（各自的世界位姿 poses）并入 targetBody
  mergeInto(targetBid, uids, poses) {
    const tb = this.bodies.get(targetBid);
    const all = [...tb.parts];
    const allPoses = new Map(all.map((u) => [u, this.worldPose(u)]));
    for (const u of uids) allPoses.set(u, poses.get(u));
    const vel = tb.rb.linvel();
    this.destroyBody(targetBid);
    const ordered = [...all, ...uids.filter((u) => !all.includes(u))];
    const nb = this.makeBody(ordered, allPoses);
    this.bodies.get(nb).rb.setLinvel(vel, true);
    return nb;
  }
  bodyOf(uid) {
    return this.bodies.get(this.parts.get(uid).body);
  }
  neighbors(uid, kind) {
    return this.edges.filter((e) => (!kind || e.kind === kind) && (e.a === uid || e.b === uid)).map((e) => (e.a === uid ? e.b : e.a));
  }
  link(a, b, kind, why) {
    if (a === b) return;
    this.history.push({ t: "link", a, b, kind, why });
    const ex = this.edges.find((e) => ((e.a === a && e.b === b) || (e.a === b && e.b === a)));
    if (ex) {
      if (kind === "fasten") ex.kind = "fasten";
      ex.why = why || ex.why;
      return;
    }
    this.edges.push({ a, b, kind, why }); // a 放在 b 上
  }
  unlink(a, b) {
    this.edges = this.edges.filter((e) => !((e.a === a && e.b === b) || (e.a === b && e.b === a)));
  }
  // 拖拽 X 时一起走的零件：fasten 连通块 + 放在它们上面的东西（递归）
  carryGroup(uid) {
    const body = this.bodyOf(uid);
    const inBody = body.parts;
    const g = new Set([uid]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const e of this.edges) {
        if (!inBody.has(e.a) || !inBody.has(e.b)) continue;
        const ina = g.has(e.a), inb = g.has(e.b);
        if (ina === inb) continue;
        if (e.kind === "fasten" || (e.kind === "seat" && inb && !ina)) {
          g.add(ina ? e.b : e.a);
          grew = true;
        }
      }
    }
    return g;
  }
  // 把 group 从它所在的刚体里拆出来，成为独立刚体；剩下的重新分组
  detach(group) {
    const any = [...group][0];
    const body = this.bodyOf(any);
    const all = [...body.parts];
    if (all.every((u) => group.has(u))) return body.id;
    const poses = new Map(all.map((u) => [u, this.worldPose(u)]));
    this.edges = this.edges.filter((e) => !(group.has(e.a) !== group.has(e.b) && body.parts.has(e.a) && body.parts.has(e.b)));
    this.destroyBody(body.id);
    const g = all.filter((u) => group.has(u));
    g.sort((a, b) => (a === any ? -1 : b === any ? 1 : rank(this.parts.get(b).def) - rank(this.parts.get(a).def)));
    const nb = this.makeBody(g, poses);
    this.splitIntoBodies(all.filter((u) => !group.has(u)), poses);
    return nb;
  }

  // ---------------- 拖拽 ----------------
  beginDrag(uid, hitPoint) {
    if (this.ops.some((o) => o.uids?.includes(uid))) return;
    const group = this.carryGroup(uid);
    const bid = this.detach(group);
    const body = this.bodies.get(bid);
    const pose = this.bodyPose(bid);
    const yaw = Math.round(yawOf(pose.q) / (Math.PI / 2)) * (Math.PI / 2); // 拿起来时摆正到最近的 90°（按 R 再转）
    body.rb.setGravityScale(0, true);
    body.rb.setDominanceGroup(0); // 和别的零件平等：能推开它们，也会被挡住
    body.rb.wakeUp();
    const grabLocal = hitPoint.clone().sub(pose.p).applyQuaternion(pose.q.clone().invert());
    this.drag = { uid, bid, grabLocal, planeY: hitPoint.y, lift: 0.8, yaw, target: hitPoint.clone(), push: false, startPos: pose.p.clone(), moved: 0 };
    this.emit();
  }
  setDragRay(ray, push) {
    const d = this.drag;
    if (!d) return;
    const y = d.planeY + d.lift;
    if (Math.abs(ray.direction.y) < 1e-4) return;
    const t = (y - ray.origin.y) / ray.direction.y;
    if (t < 0) return;
    const hit = ray.origin.clone().addScaledVector(ray.direction, t);
    hit.x = THREE.MathUtils.clamp(hit.x, -BENCH.w / 2 + 1, BENCH.w / 2 - 1);
    hit.z = THREE.MathUtils.clamp(hit.z, -BENCH.d / 2 + 1, BENCH.d / 2 - 1);
    d.target = hit;
    if (push !== d.push) {
      d.push = push;
      this.bodies.get(d.bid)?.rb.setDominanceGroup(push ? 1 : -1);
    }
  }
  dragLift(delta) {
    if (!this.drag) return;
    this.drag.lift = THREE.MathUtils.clamp(this.drag.lift + delta, 0, 18);
  }
  dragRotate(dyaw) {
    if (this.drag) this.drag.yaw = wrap(this.drag.yaw + dyaw);
  }
  // 直接把拖拽目标设在某个世界点（自动化测试用）
  dragTo(point) {
    if (!this.drag) return;
    this.drag.target = point.clone();
    this.drag.lift = 0;
    this.drag.planeY = point.y;
  }
  endDrag({ snap = true } = {}) {
    const d = this.drag;
    if (!d) return null;
    this.drag = null;
    const body = this.bodies.get(d.bid);
    let res = null;
    if (body) {
      body.rb.setGravityScale(1, true);
      body.rb.setDominanceGroup(0);
      body.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      if (snap) res = this.trySnap(d.bid, d.uid);
      const nb = this.parts.get(d.uid)?.body;
      if (nb != null) this.settle(nb);
    }
    this.emit();
    return res;
  }
  stepDrag() {
    const d = this.drag;
    if (!d) return;
    const body = this.bodies.get(d.bid);
    if (!body) return (this.drag = null);
    const pose = this.bodyPose(d.bid);
    const grabW = d.grabLocal.clone().applyQuaternion(pose.q).add(pose.p);
    const err = d.target.clone().sub(grabW);
    const dt = this.world.timestep;
    const v = err.multiplyScalar(0.35 / dt);
    const vmax = 60;
    if (v.length() > vmax) v.setLength(vmax);
    // 往下放：先沿竖直方向做一次形状扫掠（shape cast），碰到东西就停在接触面上，
    // 不会一步把零件压进下面的零件、也不会把下面的东西压进桌子
    if (v.y < 0) {
      let toi = dt;
      for (let i = 0; i < body.rb.numColliders(); i++) {
        const c1 = body.rb.collider(i);
        const hit = this.world.castShape(c1.translation(), c1.rotation(), { x: 0, y: v.y, z: 0 }, c1.shape, 0.001, dt, false, undefined, undefined, undefined, body.rb, (c) => {
          const o = this.colOwner.get(c.handle);
          return o !== "rope" && o !== "tool";
        });
        if (hit && hit.time_of_impact < toi) toi = hit.time_of_impact;
      }
      v.y *= toi / dt;
    }
    body.rb.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    // 保持直立 + 目标朝向
    const qt = yawQ(d.yaw);
    const qe = qt.clone().multiply(pose.q.clone().invert());
    if (qe.w < 0) qe.set(-qe.x, -qe.y, -qe.z, -qe.w);
    const ang = 2 * Math.acos(Math.min(1, qe.w));
    const s = Math.sqrt(1 - qe.w * qe.w);
    const k = 0.3 / dt;
    if (s > 1e-5) body.rb.setAngvel({ x: (qe.x / s) * ang * k, y: (qe.y / s) * ang * k, z: (qe.z / s) * ang * k }, true);
    else body.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // ---------------- 特征 & 吸附 ----------------
  // 一个刚体组里所有零件的特征（组局部坐标）
  features(bid) {
    const body = this.bodies.get(bid);
    const f = [];
    for (const u of body.parts) {
      const p = this.parts.get(u);
      const L = (pt) => V(pt).applyQuaternion(p.rel.q).add(p.rel.p);
      for (const a of p.def.anchors || []) f.push({ ...a, uid: u, lp: L(a.p) });
      for (const l of p.def.legs || []) f.push({ t: "leg", uid: u, lp: L(l.p), top: l.top, i: l.i, bend: p.def.legBend });
      for (const h of p.def.bbHoles || []) f.push({ t: "bbhole", uid: u, lp: L(h.p), name: h.name, net: h.net });
    }
    return f;
  }
  worldFeatures(bid) {
    const pose = this.bodyPose(bid);
    return this.features(bid).map((f) => ({ ...f, wp: f.lp.clone().applyQuaternion(pose.q).add(pose.p) }));
  }
  // 已经被铜柱/螺丝占用的螺纹孔不再参与吸附
  freeFeatures(tbid) {
    const T = this.worldFeatures(tbid);
    const plugs = this.edges.filter((e) => e.why === "standoff" || e.why === "screw");
    return T.filter((f) => {
      if (f.t !== "thread-f") return true;
      for (const e of plugs) {
        if (e.b !== f.uid) continue;
        const w = this.worldPose(e.a).p;
        if (Math.hypot(w.x - f.wp.x, w.z - f.wp.z) < 0.08) return false;
      }
      return true;
    });
  }
  trySnap(bid, leadUid) {
    const pose = this.bodyPose(bid);
    const yaw0 = yawOf(pose.q);
    const D = this.features(bid);
    const bottom = this.bodyBottom(bid);
    const cands = [];
    for (const [tbid] of this.bodies) {
      if (tbid === bid) continue;
      const T = this.freeFeatures(tbid);
      if (!T.length) continue;
      const tyaw = yawOf(this.bodyPose(tbid).q);
      for (const rule of RULES) {
        const dset = D.filter((f) => rule.d(f));
        if (!dset.length) continue;
        const tset = T.filter((f) => rule.t(f, dset[0]));
        if (!tset.length) continue;
        for (let k = 0; k < 4; k += rule.halfTurns ? 2 : 1) {
          const yaw = rule.freeYaw ? yaw0 : tyaw + (k * Math.PI) / 2;
          const c = this.matchPattern(rule, dset, tset, pose.p, yaw, bottom, pose.q);
          if (c) cands.push({ ...c, rule, tbid, yaw, dyaw: Math.abs(wrap(yaw - yaw0)) });
          if (rule.freeYaw) break;
        }
      }
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.rule.prio - a.rule.prio || b.count - a.count || a.err + a.dyaw * 0.3 - (b.err + b.dyaw * 0.3));
    let lastWhy = null;
    for (const c of cands.slice(0, 8)) {
      const why = c.rule.check?.(this, c, bid);
      if (why) {
        lastWhy = why;
        continue;
      }
      const hit = this.overlapAt(bid, c.pos, yawQ(c.yaw), c.rule.strict ? new Set() : new Set([...c.involved]));
      if (hit) {
        lastWhy = `放不进去：会和「${this.parts.get(hit).def.name_zh}」穿模`;
        continue;
      }
      this.applySnap(bid, c);
      return { ok: true, rule: c.rule.name, target: c.tbid };
    }
    if (lastWhy) this.toast(lastWhy, "error");
    return { ok: false, why: lastWhy };
  }
  bodyBottom(bid) {
    const body = this.bodies.get(bid);
    let lo = 1e9;
    for (const list of body.colliders.values())
      for (const { col } of list) {
        const t = col.translation(), h = col.halfExtents();
        const r = q2t(col.rotation());
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) lo = Math.min(lo, t.y + new THREE.Vector3(sx * h.x, sy * h.y, sz * h.z).applyQuaternion(r).y);
      }
    return lo;
  }
  // 模式匹配：找一个平移，让 dset 的特征（水平）对上 tset
  matchPattern(rule, dset, tset, bodyPos, yaw, bottom, curQ) {
    const q = yawQ(yaw);
    const dw = dset.map((f) => ({ f, xz: f.lp.clone().applyQuaternion(q) }));
    const tol = rule.name === "insert" && dset[0]?.bend ? Math.max(rule.tol, dset[0].bend) : rule.tol;
    const ref = dw[0];
    let best = null;
    // “够得着”按第 0 个特征现在的位置算（不是转过之后的位置），这样长排针转 90° 也能吸上
    // 两种都算“够得着”：原地转（绕刚体原点）或者绕第 0 个特征转
    const refA = ref.xz.clone().add(bodyPos);
    const refB = curQ ? dset[0].lp.clone().applyQuaternion(curQ).add(bodyPos) : refA;
    const r2 = rule.reach * rule.reach;
    for (const tp of tset) {
      const da = (tp.wp.x - refA.x) ** 2 + (tp.wp.z - refA.z) ** 2;
      const db = (tp.wp.x - refB.x) ** 2 + (tp.wp.z - refB.z) ** 2;
      if (da > r2 && db > r2) continue;
      const dist = Math.sqrt(Math.min(da, db));
      if (tp.wp.y > bottom + rule.above) continue;
      const tx = tp.wp.x - ref.xz.x, tz = tp.wp.z - ref.xz.z;
      let count = 0, err = 0;
      const pairs = [];
      const used = new Set();
      for (const d of dw) {
        const x = tx + d.xz.x, z = tz + d.xz.z;
        let bj = null, be = tol;
        for (const t of tset) {
          if (used.has(t)) continue;
          const e = Math.hypot(t.wp.x - x, t.wp.z - z);
          if (e < be) {
            be = e;
            bj = t;
          }
        }
        if (bj) {
          used.add(bj);
          count++;
          err += be;
          pairs.push([d.f, bj]);
        }
      }
      if (!rule.accept(count, dset.length, pairs, tset)) continue;
      const ys = pairs.map(([d, t]) => rule.y(d, t));
      const y = Math.max(...ys);
      if (rule.flatY && Math.max(...ys) - Math.min(...ys) > 0.04) continue;
      const pos = new THREE.Vector3(tx, y, tz);
      // 误差修正：用所有配对的平均偏差再微调一次
      let ax = 0, az = 0;
      for (const [d, t] of pairs) {
        const dd = d.lp.clone().applyQuaternion(q);
        ax += t.wp.x - (tx + dd.x);
        az += t.wp.z - (tz + dd.z);
      }
      pos.x += ax / pairs.length;
      pos.z += az / pairs.length;
      const c = { pos, count, err: err / count + dist * 0.05, pairs, involved: new Set(pairs.map(([, t]) => t.uid)) };
      if (!best || c.count > best.count || (c.count === best.count && c.err < best.err)) best = c;
    }
    return best;
  }
  // 检查：dragged 组放到 pos/q 时，除了 allowed 里的零件，会不会和别的零件重叠
  overlapAt(bid, pos, q, allowed) {
    const body = this.bodies.get(bid);
    const R = this.R;
    let hitUid = null;
    for (const [uid, list] of body.colliders) {
      const p = this.parts.get(uid);
      for (const { c } of list) {
        const lc = V(c.c).applyQuaternion(p.rel.q).add(p.rel.p);
        const wc = lc.applyQuaternion(q).add(pos);
        const wq = q.clone().multiply(p.rel.q);
        const shr = 0.02;
        const shape = new R.Cuboid(Math.max(0.003, c.h[0] - shr), Math.max(0.003, c.h[1] - shr), Math.max(0.003, c.h[2] - shr));
        this.world.intersectionsWithShape({ x: wc.x, y: wc.y, z: wc.z }, { x: wq.x, y: wq.y, z: wq.z, w: wq.w }, shape, (col) => {
          const o = this.colOwner.get(col.handle);
          if (o === "bench") {
            hitUid = hitUid || null;
            if (wc.y - c.h[1] < -0.03) hitUid = "__bench";
            return !hitUid;
          }
          if (!o || o === "rope" || o === "tool") return true;
          if (body.parts.has(o) || allowed.has(o)) return true;
          hitUid = o;
          return false;
        }, undefined, GROUPS.part, undefined, body.rb);
        if (hitUid) return hitUid === "__bench" ? null : hitUid;
      }
    }
    return null;
  }
  applySnap(bid, c) {
    const body = this.bodies.get(bid);
    const uids = [...body.parts];
    const q = yawQ(c.yaw);
    const start = new Map(uids.map((u) => [u, this.worldPose(u)]));
    const poses = new Map();
    for (const u of uids) {
      const p = this.parts.get(u);
      poses.set(u, { p: p.rel.p.clone().applyQuaternion(q).add(c.pos), q: q.clone().multiply(p.rel.q) });
    }
    // 动画起点：从当前位置滑过去（按住操作的另说）
    const lead = this.parts.get(uids[0]);
    this.destroyBody(bid);
    const nb = this.mergeInto(c.tbid, uids, poses);
    for (const [d, t] of c.pairs) this.link(d.uid, t.uid, "seat", c.rule.name);
    c.rule.after?.(this, c, uids, nb);
    // 视觉：吸附瞬间的位移做 0.15 s 插值，让人看清“插进去”
    for (const u of uids) this.parts.get(u).anim = { from: start.get(u), t0: performance.now(), dur: 150 };
    this.toast(c.rule.msg(this, c, lead), "ok");
    this.rebindCables();
    this.emit();
  }

  // ---------------- 按住操作（拧、压、焊） ----------------
  startOp(op) {
    this.ops.push(op);
    this.emit();
  }
  // 搭建器/测试用：把一个计时操作（焊接等）一次性推进 t 秒，不跑物理
  finishOpNow(op, t) {
    if (!op || typeof op !== "object") return false;
    for (let k = 0; k < 400 && !op.done; k++) op.step(this, t / 40);
    if (!op.done) op.onRelease?.(this);
    this.ops = this.ops.filter((o) => o !== op);
    return true;
  }
  stepOps(dt) {
    for (const op of [...this.ops]) {
      if (!this.parts.has(op.uid)) {
        this.ops = this.ops.filter((o) => o !== op);
        continue;
      }
      op.step(this, dt);
      if (op.done) this.ops = this.ops.filter((o) => o !== op);
    }
  }

  // ---------------- 线缆（绳子） ----------------
  addCable(kind, endUids, fixedEnd) {
    const R = this.R;
    const spec = CABLES[kind];
    const id = `cable${uidSeq++}`;
    const N = 20;
    const r = spec.r || 0.08; // 导线外皮半径（cm）；画面上的粗细用同一个值

    const A = this.cableEndWorld(endUids[0]);
    const B = endUids[1] ? this.cableEndWorld(endUids[1]) : fixedEnd.clone();
    const segLen = spec.len / N;
    const segs = [];
    // 初始形状：A→B 之间往侧面鼓出去的弧线，弧长 = 线长（二分求鼓出量），再按弧长等分成 N 段
    const nodes = ropeNodes(A, B, spec.len, N, r);
    for (let i = 0; i < N; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const p = a.clone().add(b).multiplyScalar(0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
      const rb = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setLinearDamping(3).setAngularDamping(3).setCcdEnabled(true));
      const col = this.world.createCollider(R.ColliderDesc.capsule(segLen / 2 - r * 0.9, r).setRotation(rotZtoX()).setDensity(1.5).setFriction(0.9).setCollisionGroups(GROUPS.rope), rb);
      this.colOwner.set(col.handle, "rope");
      segs.push(rb);
    }
    // 胶囊沿局部 x 轴（setRotation 把 y 轴转到 x 轴）
    const joints = [];
    for (let i = 0; i < N - 1; i++) {
      const jd = R.JointData.spherical({ x: segLen / 2, y: 0, z: 0 }, { x: -segLen / 2, y: 0, z: 0 });
      joints.push(this.world.createImpulseJoint(jd, segs[i], segs[i + 1], true));
    }
    let anchorBody = null;
    if (!endUids[1]) {
      anchorBody = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(B.x, B.y, B.z));
    }
    const cable = { id, kind, spec, ends: endUids.filter(Boolean), endUids, segs, joints, segLen, N, r, endJoints: [null, null], anchorBody, fixedEnd: fixedEnd?.clone() };
    this.cables.push(cable);
    this.bindCableEnds(cable);
    this.emit();
    return id;
  }
  cableEndWorld(uid) {
    const p = this.parts.get(uid);
    return this.toWorld(uid, p.def.wireEnd || cableAttach(p.def));
  }
  bindCableEnds(c) {
    const R = this.R;
    for (let k = 0; k < 2; k++) {
      const j = c.endJoints[k];
      if (j && !j.dead) {
        try {
          this.world.removeImpulseJoint(j.joint, true);
        } catch {}
      }
      c.endJoints[k] = null;
      const seg = k === 0 ? c.segs[0] : c.segs[c.N - 1];
      const segAnchor = { x: (k === 0 ? -1 : 1) * (c.segLen / 2), y: 0, z: 0 };
      const uid = c.endUids[k];
      let b2, a2;
      if (uid) {
        const p = this.parts.get(uid);
        const body = p && this.bodies.get(p.body);
        if (!body) continue;
        b2 = body.rb;
        const lp = V(p.def.wireEnd || cableAttach(p.def)).applyQuaternion(p.rel.q).add(p.rel.p);
        a2 = { x: lp.x, y: lp.y, z: lp.z };
      } else {
        b2 = c.anchorBody;
        a2 = { x: 0, y: 0, z: 0 };
      }
      const jd = R.JointData.spherical(a2, segAnchor);
      const joint = this.world.createImpulseJoint(jd, b2, seg, true);
      c.endJoints[k] = { joint, b1: b2, b2: seg };
    }
  }
  rebindCables() {
    for (const c of this.cables) {
      const stale = c.endJoints.some((j, k) => !j || j.dead || (c.endUids[k] && this.bodies.get(this.parts.get(c.endUids[k])?.body)?.rb !== j.b1));
      if (stale) this.bindCableEnds(c);
    }
  }
  removeCable(id) {
    const c = this.cables.find((x) => x.id === id);
    if (!c) return;
    for (const s of c.segs) {
      for (let i = 0; i < s.numColliders(); i++) this.colOwner.delete(s.collider(i).handle);
      this.world.removeRigidBody(s);
    }
    if (c.anchorBody) this.world.removeRigidBody(c.anchorBody);
    this.cables = this.cables.filter((x) => x !== c);
  }
  cablePoints(c) {
    const pts = [];
    const A = c.endUids[0] ? this.cableEndWorld(c.endUids[0]) : null;
    if (A) pts.push(A);
    for (const s of c.segs) {
      const t = s.translation();
      pts.push(new THREE.Vector3(t.x, t.y, t.z));
    }
    pts.push(c.endUids[1] ? this.cableEndWorld(c.endUids[1]) : c.fixedEnd.clone());
    return pts;
  }
  cableRadius(c) { return CABLES[c.kind]?.r || 0.08; }

  // ---------------- 工具（运动学碰撞体） ----------------
  setTool(kind) {
    const R = this.R;
    if (this.tool.body) {
      for (let i = 0; i < this.tool.body.numColliders(); i++) this.colOwner.delete(this.tool.body.collider(i).handle);
      this.world.removeRigidBody(this.tool.body);
      this.tool.body = null;
    }
    this.tool.kind = kind;
    const def = PROC_BY_ID[`p-tool-${kind}`];
    if (def) {
      const rb = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 30, 0));
      for (const c of def.colliders) {
        const col = this.world.createCollider(R.ColliderDesc.cuboid(...c.h).setTranslation(...c.c).setCollisionGroups(GROUPS.tool), rb);
        this.colOwner.set(col.handle, "tool");
      }
      this.tool.body = rb;
      this.tool.def = def;
    }
    this.emit();
  }
  setToolPos(p) {
    this.tool.pos.copy(p);
    if (this.tool.body) this.tool.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
  }

  // ---------------- 主循环 ----------------
  update(dt) {
    if (!this.ready) return;
    this.acc = Math.min(this.acc + dt, 4 / 120);
    while (this.acc >= this.world.timestep) {
      this.stepDrag();
      this.stepOps(this.world.timestep);
      // 休眠刚体被叫醒的那一步，它和桌面（运动学刚体）之间还没有接触，会白白自由落体一步（实测压进桌面 0.4 mm）。
      // 所以：这一步前睡着、这一步后醒了的刚体，把位置退回到步前、速度清零；下一步接触已经建立了。
      const asleep = [];
      for (const [bid, b] of this.bodies) if (b.rb.isSleeping() && this.drag?.bid !== bid) { const t = b.rb.translation(), r = b.rb.rotation(); asleep.push([b.rb, { x: t.x, y: t.y, z: t.z }, { x: r.x, y: r.y, z: r.z, w: r.w }]); }
      this.world.step();
      for (const [rb, t, r] of asleep) if (!rb.isSleeping() && rb.translation().y < t.y) {
        rb.setTranslation(t, false); rb.setRotation(r, false);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, false); rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
      }
      if (asleep.length) this.world.propagateModifiedBodyPositionsToColliders();
      this.dragDepenetrate();
      this.settleStep();
      this.acc -= this.world.timestep;
    }
    // 掉出桌面的零件拉回来（防御：理论上围栏挡住了）
    for (const b of this.bodies.values()) {
      const t = b.rb.translation();
      if (t.y < -5) {
        // 拉回桌子中间上方，找一个不和别的零件重叠的高度
        const q = q2t(b.rb.rotation()), p = new THREE.Vector3(0, 5, 0);
        for (const bid of this.bodies.keys()) if (this.bodies.get(bid) === b) { for (let k = 0; k < 150 && this.overlapAt(bid, p, q, new Set()); k++) p.y += 0.5; break; }
        b.rb.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
        b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }

  // 刚松手的零件：拖拽时被速度“压”进别的零件的那一点点，用位置投影推出来（休眠的刚体不会自己推开）
  settle(bid, sec = 0.6) {
    (this.settling ||= new Map()).set(bid, sec);
  }
  settleStep() {
    // 每 4 步把所有刚体都检查一遍（含休眠的），重物压在桌面上的软接触下陷也一起推出来
    this.stepN = (this.stepN || 0) + 1;
    // 醒着的刚体每步都查（落下、碰撞的瞬间最容易压进去），睡着的每 4 步查一次
    for (const [bid, b] of this.bodies) if (this.drag?.bid !== bid && (this.stepN % 4 === 0 || !b.rb.isSleeping())) this.depenetrate(bid, 2);
    if (!this.settling?.size) return;
    for (const [bid, t] of this.settling) {
      const left = t - this.world.timestep;
      if (left <= 0 || !this.bodies.has(bid) || this.drag?.bid === bid) this.settling.delete(bid);
      else this.settling.set(bid, left);
      if (this.bodies.has(bid)) this.depenetrate(bid);
    }
  }
  // 拖拽时：被拖的零件压到的零件，用位置投影推开；推不开（被桌面/别的零件顶住）就把被拖的零件退回来
  dragDepenetrate() {
    const d = this.drag;
    if (!d || !this.bodies.has(d.bid)) return;
    const dragRb = this.bodies.get(d.bid).rb;
    const lv = dragRb.linvel();
    const hv = new THREE.Vector3(lv.x, 0, lv.z);
    // 链式推开：被拖的零件推开碰到的零件，被推的零件再推开它碰到的（只水平推，往下推会压进桌面）
    let front = [dragRb];
    const seen = new Set([dragRb.handle]);
    for (let depth = 0; depth < 4 && front.length; depth++) {
      const next = [];
      for (const rbA of front) {
        for (let it = 0; it < 2; it++) {
          const push = new Map();
          for (let i = 0; i < rbA.numColliders(); i++) {
            const c1 = rbA.collider(i);
            this.world.contactPairsWith(c1, (c2) => {
              const rb = c2.parent();
              if (!rb || rb.handle === rbA.handle || rb.handle === dragRb.handle || !rb.isDynamic()) return;
              if (this.colOwner.get(c2.handle) === "rope") return;
              const sc = c1.contactCollider(c2, 0);
              if (!sc || sc.distance > -0.002) return;
              let n = new THREE.Vector3(sc.normal1.x, 0, sc.normal1.z);
              // 被拖的零件直接碰到的：沿拖动方向推（像手推着走），而不是沿接触法线（法线朝上时会“骑”上去）
              if (rbA === dragRb && hv.lengthSq() > 1e-4) n = hv.clone();
              if (n.lengthSq() < 0.04 * (rbA === dragRb ? 0 : 1) || n.lengthSq() < 1e-8) return;
              n.normalize().multiplyScalar(-sc.distance + 0.001);
              const cur = push.get(rb);
              if (!cur || n.lengthSq() > cur.lengthSq()) push.set(rb, n);
            });
          }
          if (!push.size) break;
          for (const [rb, n] of push) {
            const t = rb.translation();
            rb.setTranslation({ x: t.x + n.x, y: t.y, z: t.z + n.z }, true);
            if (!seen.has(rb.handle)) { seen.add(rb.handle); next.push(rb); }
          }
          this.world.propagateModifiedBodyPositionsToColliders();
        }
      }
      front = next;
    }
    // 推开之后还压着（被顶住、或从上往下压）：把被拖的零件退回来
    this.depenetrate(d.bid, 3);
  }
  depenetrate(bid, iters = 6) {
    const body = this.bodies.get(bid);
    if (!body) return 0;
    let moved = 0;
    for (let it = 0; it < iters; it++) {
      let worst = null;
      for (let i = 0; i < body.rb.numColliders(); i++) {
        const c1 = body.rb.collider(i);
        if (c1.isSensor() || this.colOwner.get(c1.handle) === undefined) continue;
        this.world.contactPairsWith(c1, (c2) => {
          if (this.colOwner.get(c2.handle) === "rope") return;
          if (c2.parent()?.handle === body.rb.handle) return;
          const o2 = this.colOwner.get(c2.handle);
          if (o2 === "bench" || o2 === undefined) return; // 桌面下面单独查
          const sc = c1.contactCollider(c2, 0);
          if (sc && sc.distance < -0.002 && (!worst || sc.distance < worst.distance)) worst = { distance: sc.distance, n: sc.normal1, who: "bench" + c2.handle + "/" + c1.handle + (c1.isSensor() ? "S" : "") };
        });
        // 桌面和围栏直接逐个算距离（刚醒来的刚体，接触对还没建立）
        for (let k = 0; k < (this.benchCols || []).length; k++) {
          const c2 = this.benchCols[k];
          const g1 = c1.collisionGroups(), g2 = c2.collisionGroups();
          if (!(((g1 >>> 16) & g2 & 0xffff) && ((g2 >>> 16) & g1 & 0xffff))) continue; // 本来就不和桌面碰的碰撞体（如插脚）
          const sc0 = c1.contactCollider(c2, 0);
          // 法线不用接触结果给的（实测符号不可靠），按桌面/四面围栏的朝向固定：总是往桌面里、往上推
          const sc = sc0 && { distance: sc0.distance, normal1: BENCH_N[k] };
          if (sc && sc.distance < -0.002 && (!worst || sc.distance < worst.distance)) worst = { distance: sc.distance, n: sc.normal1 };
        }
      }
      if (!worst) break;
      const t = body.rb.translation();
      const d = worst.distance - 0.001;
      body.rb.setTranslation({ x: t.x + worst.n.x * d, y: t.y + worst.n.y * d, z: t.z + worst.n.z * d }, true);
      // 速度里朝着对方的分量也清掉，不然下一步又压进去（位置推出来、速度还在累积）
      const v = body.rb.linvel(), vn = v.x * worst.n.x + v.y * worst.n.y + v.z * worst.n.z;
      if (vn > 0) body.rb.setLinvel({ x: v.x - vn * worst.n.x, y: v.y - vn * worst.n.y, z: v.z - vn * worst.n.z }, true);
      this.world.propagateModifiedBodyPositionsToColliders();
      moved++;
    }
    return moved;
  }

  // ---------------- 穿模测试 ----------------
  // 所有“不同刚体”之间的接触，取最深的穿透（contactDist < 0 = 穿进去了）
  overlapTest({ includeRopes = false } = {}) {
    let worst = 0;
    let worstPair = null;
    let pairs = 0;
    this.world.forEachCollider((c1) => {
      const o1 = this.colOwner.get(c1.handle);
      if (!o1 || o1 === "bench") return;
      if (!includeRopes && o1 === "rope") return;
      this.world.contactPairsWith(c1, (c2) => {
        const o2 = this.colOwner.get(c2.handle);
        if (!includeRopes && o2 === "rope") return;
        if (c1.handle > c2.handle && o2 !== "bench") return;
        // 精确的形状间距离（不依赖求解器的接触点缓存）
        const sc = c1.contactCollider(c2, 0.01);
        if (!sc) return;
        pairs++;
        if (sc.distance < worst) {
          worst = sc.distance;
          worstPair = [o1, o2];
        }
      });
    });
    const name = (o) => (this.parts.get(o)?.def.name_zh || o);
    return { maxPenetrationMm: +(-worst * 10).toFixed(3), contacts: pairs, worstPair: worstPair ? worstPair.map(name) : null };
  }
  debugLines() {
    return this.world.debugRender();
  }
  snapshot() {
    return {
      parts: [...this.parts.values()].map((p) => {
        const w = this.worldPose(p.uid);
        return { uid: p.uid, id: p.def.id, name: p.def.name_zh, body: p.body, pos: w.p.toArray().map((v) => +v.toFixed(3)), state: p.state };
      }),
      edges: this.edges.map((e) => ({ ...e })),
      bodies: this.bodies.size,
      cables: this.cables.length,
    };
  }
}

function ropeNodes(A, B, len, N, r) {
  const ab = B.clone().sub(A);
  const side = new THREE.Vector3(-ab.z, 0, ab.x);
  if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
  side.normalize();
  const curve = (s, t) => {
    const p = A.clone().lerp(B, t).addScaledVector(side, s * Math.sin(Math.PI * t));
    p.y = Math.max(p.y, r + 0.03);
    return p;
  };
  const arc = (s) => {
    let L = 0, prev = curve(s, 0);
    for (let i = 1; i <= 200; i++) {
      const p = curve(s, i / 200);
      L += p.distanceTo(prev);
      prev = p;
    }
    return L;
  };
  let lo = 0, hi = len;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (arc(m) < len) lo = m;
    else hi = m;
  }
  const pts = [];
  for (let i = 0; i <= 400; i++) pts.push(curve(lo, i / 400));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k <= N; k++) {
    const want = (total * k) / N;
    while (j < cum.length - 2 && cum[j + 1] < want) j++;
    const f = (want - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    out.push(pts[j].clone().lerp(pts[j + 1], Math.min(1, f)));
  }
  return out;
}
function rotZtoX() {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}
function cableAttach(def) {
  // 电池等零件：线从包围盒一侧中点引出
  const H = def.dims_mm.y / 10;
  return [-(def.dims_mm.x / 20) - 0.05, H / 2, 0];
}
function rank(def) {
  return { "p-baseplate": 100, "p-breadboard-half": 90 }[def.id] ?? (def.cat === "enclosure" ? 60 : def.cat === "breadboard" ? 80 : 0);
}

// ---------------- 吸附规则 ----------------
// d(f)：被拖零件的特征；t(f)：目标特征；y(d,t)：吸附后组原点的 y；accept：配对数够不够
const legY = (d, t) => t.wp.y - d.lp.y - d.top; // 腿插进孔：零件身体底面落在孔面上
const sizeOk = (a, b) => a === b;
export const RULES = [
  {
    name: "insert",
    prio: 5,
    tol: 0.07,
    reach: 1.2,
    above: 1.0,
    d: (f) => f.t === "leg",
    t: (f) => f.t === "bbhole" || f.t === "pinhole",
    accept: (n, total) => n === total,
    y: legY,
    flatY: true,
    msg: (e, c, lead) => `插好了：${lead.def.name_zh} 的 ${c.count} 根针脚进了 ${[...c.involved].map((u) => e.parts.get(u).def.name_zh).join("、")}`,
    check: (e, c, bid) => {
      // 孔被占了？
      for (const [, t] of c.pairs) {
        const occ = e.holeTaken(t);
        if (occ && !e.bodies.get(bid).parts.has(occ)) return `那个孔（${t.name || "通孔"}）已经插了东西`;
      }
      return null;
    },
  },
  {
    name: "onpins",
    prio: 5,
    tol: 0.07,
    reach: 1.2,
    above: 1.6,
    d: (f) => f.t === "pinhole",
    t: (f) => f.t === "pin-up",
    accept: (n) => n >= 3,
    y: (d, t) => t.base + (t.wp.y - t.p[1]) - (d.lp.y - d.p[1]),
    flatY: true,
    msg: (e, c, lead) => `${lead.def.name_zh} 套在排针上了（${c.count} 根），可以用烙铁逐个焊`,
  },
  {
    name: "mount",
    prio: 4,
    tol: 0.08,
    reach: 1.2,
    above: 1.6,
    d: (f) => f.t === "hole",
    t: (f, d) => (f.t === "thread-f" && THREAD[f.size] && THREAD[f.size].d <= d.d + 0.05) || f.t === "stud-up",
    accept: (n) => n >= 2,
    y: (d, t) => t.wp.y - (d.lp.y - d.th),
    flatY: true,
    msg: (e, c, lead) => `${lead.def.name_zh} 放到 ${c.count} 个安装点上了，拿螺丝刀把螺丝/螺母拧上才算固定`,
  },
  {
    name: "servo-seat",
    prio: 6,
    tol: 0.12,
    reach: 1.5,
    above: 2.5,
    d: (f) => f.t === "servo-body",
    t: (f) => f.t === "servo-slot",
    accept: (n) => n >= 1,
    y: (d, t) => t.wp.y - d.lp.y,
    strict: true,
    halfTurns: true,
    msg: () => "舵机放进支架了：耳朵搭在立柱上，用两颗舵机螺丝固定",
  },
  {
    name: "standoff",
    prio: 6,
    tol: 0.08,
    reach: 0.9,
    above: 0.8,
    d: (f) => f.t === "thread-m",
    t: (f, d) => f.t === "thread-f" && f.size === d.size,
    accept: (n, total) => n >= 1 && total === 1,
    y: (d, t) => t.wp.y - d.lp.y - d.len,
    msg: (e, c, lead) => `${lead.def.name_zh} 对上螺纹孔了：选螺丝刀（或手）按住它拧进去`,
    after: (e, c, uids) => e.pendThread(uids[0], c, "standoff"),
  },
  {
    name: "screw",
    prio: 7,
    tol: 0.08,
    reach: 0.9,
    above: 4,
    d: (f) => f.t === "screw",
    t: (f, d) => f.t === "thread-f" || (f.t === "hole" && false),
    accept: (n, total) => n >= 1 && total === 1,
    y: (d, t) => t.wp.y - 0,
    check: (e, c) => e.screwCheck(c),
    msg: (e, c, lead) => `${lead.def.name_zh} 放进孔了：选螺丝刀按住拧`,
    after: (e, c, uids) => e.pendScrew(uids[0], c),
  },
  {
    name: "nut",
    prio: 7,
    tol: 0.08,
    reach: 0.9,
    above: 3,
    d: (f) => f.t === "nut",
    t: (f, d) => f.t === "stud-up" && f.size === d.size,
    accept: (n, total) => n >= 1 && total === 1,
    y: (d, t) => t.wp.y + t.len - 0.05,
    check: (e, c) => e.nutCheck(c),
    msg: (e, c, lead) => `${lead.def.name_zh} 套上螺柱了：选螺丝刀（套筒）按住拧`,
    after: (e, c, uids) => e.pendNut(uids[0], c),
  },
  {
    name: "horn",
    prio: 6,
    tol: 0.12,
    reach: 0.9,
    above: 1.2,
    freeYaw: true,
    d: (f) => f.t === "hub",
    t: (f) => f.t === "shaft",
    accept: (n) => n >= 1,
    y: (d, t) => t.wp.y - 0.0,
    msg: () => "舵盘对上输出轴：按住鼠标压下去",
    after: (e, c, uids) => e.pendPress(uids[0], c, 0.35, "舵盘压到底了"),
  },
  {
    name: "tentacle",
    prio: 6,
    tol: 0.15,
    reach: 1.0,
    above: 1.2,
    freeYaw: true,
    d: (f) => f.t === "arm-mount",
    t: (f) => f.t === "arm-tip",
    accept: (n) => n >= 1,
    y: (d, t) => t.wp.y + 0.15,
    msg: () => "触手对上舵盘臂：按住鼠标卡进去",
    after: (e, c, uids) => e.pendPress(uids[0], c, 0.15, "触手卡紧了"),
  },
  {
    name: "dupont-f",
    prio: 6,
    tol: 0.07,
    reach: 0.8,
    above: 1.2,
    d: (f) => f.t === "dupont-f",
    t: (f) => f.t === "pin-up",
    accept: (n, total) => n === total,
    y: (d, t) => t.base + (t.wp.y - t.p[1]) - d.lp.y,
    check: (e, c) => (c.pairs.some(([, t]) => e.pinTaken(t)) ? "那根针上已经套了母头" : null),
    msg: (e, c) => (c.count > 1 ? `${c.count} pin 杜邦母头套上排针了` : "杜邦母头套上排针了"),
  },
  {
    name: "dupont-m",
    prio: 6,
    tol: 0.07,
    reach: 0.8,
    above: 1.2,
    d: (f) => f.t === "dupont-m",
    t: (f) => f.t === "bbhole",
    accept: (n) => n >= 1,
    y: (d, t) => t.wp.y - d.lp.y - d.depth,
    check: (e, c) => (e.holeTaken(c.pairs[0][1]) ? "那个孔已经插了东西" : null),
    msg: (e, c) => `杜邦公头插进面包板 ${c.pairs[0][1].name}`,
  },
  {
    name: "plug",
    prio: 8,
    tol: 0.25,
    reach: 1.5,
    above: 1.5,
    special: "plug",
    d: (f) => f.t === "plug",
    t: (f, d) => f.t === "port" && f.kind === d.kind,
    accept: (n) => n >= 1,
    y: (d, t) => t.wp.y - d.lp.y,
    msg: (e, c, lead) => `${lead.def.name_zh} 插上了`,
    after: (e, c, uids) => {
      e.parts.get(uids[0]).state.port = c.pairs[0][1].kind;
      e.parts.get(uids[0]).state.portOf = c.pairs[0][1].uid;
    },
  },
  {
    name: "bb-area",
    prio: 2,
    tol: 3.0,
    reach: 3.0,
    above: 0.6,
    d: (f) => f.t === "bb-base",
    t: (f) => f.t === "bb-area",
    accept: (n) => n >= 1,
    y: (d, t) => t.wp.y,
    strict: true,
    msg: () => "面包板贴在底板上了（背胶）",
  },
];

// 插头：方向要对上插口，位置沿插入方向推进
const plugRule = RULES.find((r) => r.name === "plug");
Engine.prototype._plugMatch = null;
const origMatch = Engine.prototype.matchPattern;
Engine.prototype.matchPattern = function (rule, dset, tset, bodyPos, yaw, bottom, curQ) {
  if (rule !== plugRule) return origMatch.call(this, rule, dset, tset, bodyPos, yaw, bottom, curQ);
  const d = dset[0];
  let best = null;
  for (const t of tset) {
    if (this.portTaken(t)) continue;
    // 插口朝向（世界）
    const tb = this.bodyPose(this.parts.get(t.uid).body);
    const tp = this.parts.get(t.uid);
    const dirW = V(t.dir).applyQuaternion(tp.rel.q).applyQuaternion(tb.q);
    // 插头局部插入方向 −x：要等于 −dirW → yaw 使局部 +x 指向 dirW
    const pyaw = Math.atan2(-dirW.z, dirW.x);
    const q = yawQ(pyaw);
    const dl = d.lp.clone().applyQuaternion(q);
    const now = d.lp.clone().applyQuaternion(curQ || yawQ(yaw)).add(bodyPos);
    if (now.distanceTo(t.wp) > 2.0) continue;
    const pos = t.wp.clone().addScaledVector(dirW, -d.depth * 0.95).sub(dl);
    const c = { pos, count: 1, err: now.distanceTo(t.wp), pairs: [[d, t]], involved: new Set([t.uid]), yawOverride: pyaw };
    if (!best || c.err < best.err) best = c;
  }
  if (best) best.yaw = best.yawOverride;
  return best;
};
const origTry = Engine.prototype.trySnap;
Engine.prototype.trySnap = function (bid, lead) {
  return origTry.call(this, bid, lead);
};
// yawOverride：插头的朝向由插口决定
const origApply = Engine.prototype.applySnap;
Engine.prototype.applySnap = function (bid, c) {
  if (c.yawOverride != null) c.yaw = c.yawOverride;
  return origApply.call(this, bid, c);
};

// ---------------- 占用、螺丝、螺母、压入 ----------------
Object.assign(Engine.prototype, {
  holeTaken(t) {
    // 某个孔是否已被某零件的腿/公针占用（按几何判断）
    for (const e of this.edges) {
      if (e.b !== t.uid || (e.why !== "insert" && e.why !== "dupont-m")) continue;
      const p = this.parts.get(e.a);
      if (!p) continue;
      const pts = [...(p.def.legs || []).map((l) => l.p), ...(p.def.anchors || []).filter((a) => a.t === "dupont-m").map((a) => a.p)];
      for (const lp of pts) {
        const w = this.toWorld(e.a, lp);
        if (Math.hypot(w.x - t.wp.x, w.z - t.wp.z) < 0.08) return e.a;
      }
    }
    return null;
  },
  pinTaken(t) {
    for (const e of this.edges) {
      if (e.b !== t.uid || e.why !== "dupont-f") continue;
      for (const a of this.parts.get(e.a)?.def.anchors || []) {
        if (a.t !== "dupont-f") continue;
        const w = this.toWorld(e.a, a.p);
        if (Math.hypot(w.x - t.wp.x, w.z - t.wp.z) < 0.08) return true;
      }
    }
    return false;
  },
  portTaken(t) {
    return this.edges.some((e) => e.b === t.uid && e.why === "plug" && this.parts.get(e.a)?.state.port === t.kind);
  },
  // 夹在螺丝头和螺纹之间的零件（孔在同一 xz、高于螺纹口）
  stackAt(tbid, xz, threadTopY, exclude) {
    const T = this.worldFeatures(tbid);
    const holes = T.filter((f) => f.t === "hole" && Math.hypot(f.wp.x - xz.x, f.wp.z - xz.z) < 0.1 && f.wp.y > threadTopY - 0.02 && !exclude?.has(f.uid));
    let top = threadTopY;
    for (const h of holes) top = Math.max(top, h.wp.y);
    return { top, holes };
  },
  screwCheck(c) {
    const [d, t] = c.pairs[0];
    const S = this.parts.get(d.uid).def;
    const T = THREAD[d.size];
    if (t.size !== d.size) return `规格不对：${S.name_zh} 拧不进 ${t.size} 的螺纹`;
    const { top, holes } = this.stackAt(c.tbid, t.wp, t.wp.y);
    for (const h of holes) if (h.d + 0.05 < T.d) return `孔太小：${this.parts.get(h.uid).def.name_zh} 的孔 Ø${h.d} mm 穿不过 ${d.size}`;
    const s = top - t.wp.y; // 夹层厚度 cm
    const engage = d.len - s;
    const depth = t.depth ?? 0.6;
    if (engage < T.pitch * 3 * 0.1) return `螺丝太短：${(d.len * 10).toFixed(0)} mm 减去夹层 ${(s * 10).toFixed(1)} mm，只剩 ${(engage * 10).toFixed(1)} mm 咬合，咬不住`;
    if (engage > depth + 0.02) return `螺丝太长：会顶到螺纹孔底（孔深约 ${(depth * 10).toFixed(1)} mm，需要的是 ≤ ${((depth + s) * 10).toFixed(1)} mm 的螺丝）`;
    c.stack = { top, s, engage, holes, thread: t };
    // 起点：螺丝尖刚碰螺纹口 → 组原点 y = 螺纹口（螺丝局部原点在尖端）
    c.pos.y = t.wp.y;
    for (const h of holes) c.involved.add(h.uid);
    return null;
  },
  pendScrew(uid, c) {
    const p = this.parts.get(uid);
    const { stack } = c;
    const T = THREAD[p.def.proc.size];
    const travel = stack.engage; // 起点尖端在螺纹口，终点头贴合
    p.state.screw = { travel, pitch: T.pitch / 10, done: 0, stage: "放入", tight: 0, stripped: false, target: stack.thread.uid, clamps: stack.holes.map((h) => h.uid), metal: this.parts.get(stack.thread.uid).def.cat === "fastener", y0: p.rel.p.y, q0: p.rel.q.clone() };
  },
  nutCheck(c) {
    const [d, t] = c.pairs[0];
    const { top, holes } = this.stackAt(c.tbid, t.wp, t.wp.y);
    const studTop = t.wp.y + t.len;
    const m = d.m;
    if (top + m > studTop + 0.01) return `螺柱太短：夹层到 ${(top - t.wp.y) * 10} mm，螺母拧不上`;
    c.stack = { top, holes, stud: t, studTop };
    c.pos.y = studTop - 0.06;
    for (const h of holes) c.involved.add(h.uid);
    return null;
  },
  pendNut(uid, c) {
    const p = this.parts.get(uid);
    const T = THREAD[p.def.proc.size];
    p.state.screw = { travel: c.stack.studTop - 0.06 - c.stack.top, pitch: T.pitch / 10, done: 0, stage: "放入", tight: 0, stripped: false, target: c.stack.stud.uid, clamps: c.stack.holes.map((h) => h.uid), metal: true, y0: p.rel.p.y, q0: p.rel.q.clone(), nut: true };
  },
  pendThread(uid, c, kind) {
    const p = this.parts.get(uid);
    const [d, t] = c.pairs[0];
    // 公头先搭在螺纹口上（抬高螺柱长度），拧进去
    p.rel.p.y += d.len;
    this.updateRel(uid);
    const T = THREAD[d.size];
    p.state.screw = { travel: d.len, pitch: T.pitch / 10, done: 0, stage: "放入", tight: 0, stripped: false, target: t.uid, clamps: [], metal: this.parts.get(t.uid).def.id !== "p-baseplate" ? true : false, y0: p.rel.p.y, q0: p.rel.q.clone(), byHand: true };
  },
  pendPress(uid, c, depth, doneMsg) {
    const p = this.parts.get(uid);
    p.rel.p.y += depth;
    this.updateRel(uid);
    p.state.press = { depth, done: 0, y0: p.rel.p.y, msg: doneMsg, target: c.pairs[0][1].uid };
  },
  // 按住：拧（dir=+1 拧紧，−1 拧松）
  holdScrew(uid, dir = 1) {
    const p = this.parts.get(uid);
    if (!p?.state.screw) return false;
    const op = {
      uid,
      uids: [uid],
      t: 0,
      step: (e, dt) => e._screwStep(p, dt, dir, op),
    };
    this.startOp(op);
    return op;
  },
  _screwStep(p, dt, dir, op) {
    const s = p.state.screw;
    if (s.stripped && dir > 0) {
      s.stage = "滑丝";
      return;
    }
    const turnsPerSec = s.byHand ? 3 : 6;
    const dTravel = turnsPerSec * s.pitch * dt * dir;
    if (dir > 0 && s.done < s.travel) {
      s.done = Math.min(s.travel, s.done + dTravel);
      s.stage = "拧入";
      if (s.done >= s.travel) {
        s.stage = "贴合";
        this.toast(s.nut ? "螺母贴合了，再拧一下就紧了" : "螺丝头贴合了，再拧一下就紧了", "info");
      }
    } else if (dir > 0) {
      s.tight += dt;
      if (s.tight > 0.25 && s.stage !== "拧紧" && s.stage !== "过紧") {
        s.stage = "拧紧";
        this.fastenScrew(p);
        this.toast(s.nut ? "螺母拧紧了" : s.byHand ? "铜柱拧紧了" : "螺丝拧紧了（再硬拧会滑丝）", "ok");
      }
      const limit = s.metal ? 1.5 : 0.8;
      if (s.tight > 0.25 + limit * 0.6 && s.stage === "拧紧") s.stage = "过紧";
      if (s.tight > 0.25 + limit) {
        s.stripped = true;
        s.stage = "滑丝";
        this.unfastenScrew(p);
        this.toast(s.metal ? "拧过头了：螺纹滑丝（模拟），这颗螺丝不再吃力" : "拧过头了：塑料螺纹孔被拧花了（模拟），这个孔不再吃力", "error");
      }
    } else if (dir < 0) {
      if (s.tight > 0) {
        s.tight = 0;
        s.stage = "拧入";
        this.unfastenScrew(p);
      }
      s.done = Math.max(0, s.done + dTravel);
      if (s.done <= 0) {
        s.stage = "放入";
        if (s.stripped) s.stripped = false;
      }
    }
    // 位姿：沿 −y 前进 + 旋转
    p.rel.p.y = s.y0 - s.done;
    const ang = (s.done / s.pitch) * Math.PI * 2 + s.tight * 2;
    p.rel.q = s.q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang)).normalize();
    this.updateRel(p.uid);
    op.t += dt;
    if (this.audio && Math.floor((op.t - dt) * 10) !== Math.floor(op.t * 10)) this.audio(s.stage);
  },
  fastenScrew(p) {
    const s = p.state.screw;
    this.link(p.uid, s.target, "fasten", "screw");
    for (const c of s.clamps) {
      this.link(p.uid, c, "fasten", "screw");
      this.link(c, s.target, "fasten", "clamp");
    }
    this.emit();
  },
  unfastenScrew(p) {
    const s = p.state.screw;
    this.link(p.uid, s.target, "seat", "screw");
    const e = this.edges.find((x) => (x.a === p.uid && x.b === s.target) || (x.b === p.uid && x.a === s.target));
    if (e) e.kind = "seat";
    for (const c of s.clamps) {
      const e2 = this.edges.find((x) => (x.a === p.uid && x.b === c) || (x.b === p.uid && x.a === c));
      if (e2) e2.kind = "seat";
      // 夹层零件：如果还有别的拧紧的螺丝，保持固定
      const stillTight = [...this.parts.values()].some((q) => q !== p && q.state.screw?.stage === "拧紧" && q.state.screw.clamps.includes(c) && q.state.screw.target === s.target);
      if (!stillTight) {
        const e3 = this.edges.find((x) => (x.a === c && x.b === s.target) || (x.b === c && x.a === s.target));
        if (e3 && e3.why === "clamp") e3.kind = "seat";
      }
    }
    this.emit();
  },
  holdPress(uid) {
    const p = this.parts.get(uid);
    if (!p?.state.press || p.state.press.done >= p.state.press.depth) return false;
    const op = {
      uid,
      uids: [uid],
      step: (e, dt) => {
        const s = p.state.press;
        s.done = Math.min(s.depth, s.done + dt * s.depth / 0.6);
        p.rel.p.y = s.y0 - s.done;
        e.updateRel(uid);
        if (s.done >= s.depth) {
          op.done = true;
          e.link(uid, s.target, "fasten", "press");
          e.toast(s.msg, "ok");
        }
      },
    };
    this.startOp(op);
    return op;
  },
  // 按住烙铁：焊点。找烙铁尖附近、里面穿着针脚的焊盘孔（插件/套排针形成的 seat 边），焊上后这条边变成 fasten
  findSolderJoint(wp) {
    let best = null;
    for (const b of this.bodies.keys()) {
      for (const f of this.worldFeatures(b)) {
        if (f.t !== "pinhole") continue;
        const dist = Math.hypot(f.wp.x - wp.x, f.wp.z - wp.z);
        if (dist > 0.2 || Math.abs(f.wp.y - wp.y) > 0.6) continue;
        const board = f.uid;
        // 孔里确实有针：和这块板插在一起的某个零件，它的腿或排针正好在这个孔的位置
        const wf = this.worldFeatures(b);
        const other = this.edges
          .filter((e) => (e.a === board || e.b === board) && (e.why === "insert" || e.why === "onpins" || e.why === "solder"))
          .map((e) => (e.a === board ? e.b : e.a))
          .find((o) => wf.some((g) => g.uid === o && (g.t === "leg" || g.t === "pin-up") && Math.hypot(g.wp.x - f.wp.x, g.wp.z - f.wp.z) < 0.08));
        if (!other) continue;
        if (!best || dist < best.dist) best = { dist, board, other, f };
      }
    }
    return best;
  },
  // 焊点质量（简化模型，时间阈值为估算）：need = 润湿所需时间（有助焊剂 0.6 s，没有 1.4 s）
  //   松开时 t < 0.4·need：没焊上；< need：虚焊；≤ G：合格；再久：附近有焊盘就连锡，否则仍合格；≥ 3.5·need：焊盘烫坏（自动停止）
  //   有助焊剂时 G = 2.5·need，没有时 G = 1.6·need（锡更容易拉尖、堆锡）
  solderGrade(t, flux, hasNeighbor) {
    const need = flux ? 0.6 : 1.4;
    const G = (flux ? 2.5 : 1.6) * need;
    if (t < 0.4 * need) return null;
    if (t < need) return "cold";
    if (t <= G) return "good";
    if (t < 3.5 * need) return hasNeighbor ? "bridge" : "good";
    return "burnt";
  },
  holdSolder(wp, { flux = true, hold = null, desolder = false } = {}) {
    const j = this.findSolderJoint(wp);
    if (!j) {
      this.toast("烙铁下面没有穿着针脚的焊盘孔", "warn");
      return false;
    }
    const p = this.parts.get(j.board);
    p.state.solder ||= [];
    p.state.lifted ||= [];
    const lp = this.toLocal(j.board, j.f.wp);
    const at = (q) => (Array.isArray(q) ? q : q.p);
    const idx = p.state.solder.findIndex((q) => Math.hypot(at(q)[0] - lp.x, at(q)[2] - lp.z) < 0.05);
    const old = idx >= 0 ? (Array.isArray(p.state.solder[idx]) ? { p: p.state.solder[idx], q: "good" } : p.state.solder[idx]) : null;
    if (p.state.lifted.includes(j.f.i) && !desolder) {
      this.toast("这个焊盘已经烫掉了：真实中只能刮开铜箔或用飞线补救", "error");
      return false;
    }
    if (desolder && !old) {
      this.toast("这里没有焊锡可吸", "info");
      return false;
    }
    if (!desolder && old?.q === "good") {
      this.toast("这个焊点已经焊好了（Shift + 烙铁可以拆焊）", "info");
      return false;
    }
    if (!desolder && old?.q === "burnt") {
      this.toast("焊盘已经烫坏，先 Shift + 烙铁拆掉", "warn");
      return false;
    }
    // 最近的相邻焊盘（连锡对象）
    let nb = null;
    for (const a of p.def.anchors || []) {
      if (a.t !== "pinhole" || a.i === j.f.i) continue;
      const d = Math.hypot(a.p[0] - j.f.p[0], a.p[2] - j.f.p[2]);
      if (d < 0.27 && (!nb || d < nb.d)) nb = { d, i: a.i };
    }
    const need = flux ? 0.6 : 1.4;
    const finish = (e) => {
      if (op.finished) return;
      op.finished = true;
      op.done = true;
      if (desolder) {
        if (op.t < 0.8) { e.toast("吸锡时间太短，锡还没化开", "warn"); return; }
        p.state.solder.splice(p.state.solder.indexOf(op.entry), 1);
        if (old.q === "burnt" && !p.state.lifted.includes(j.f.i)) p.state.lifted.push(j.f.i);
        // 这两个零件之间没有焊点了：恢复成“只是插着”
        if (!p.state.solder.some((q) => !Array.isArray(q) && q.other === j.other)) {
          const ed = e.edges.find((x) => (x.a === j.board && x.b === j.other) || (x.b === j.board && x.a === j.other));
          if (ed && ed.why === "solder") { ed.kind = "seat"; ed.why = "onpins"; }
        }
        e.toast(old.q === "burnt" ? "拆下烫坏的焊点：这个焊盘已经不能再焊（真实中需要飞线）" : "拆焊完成（吸锡）", old.q === "burnt" ? "warn" : "ok");
        e.history.push({ t: "desolder", board: j.board, i: j.f.i });
        e.emit();
        return;
      }
      let q = e.solderGrade(op.t, flux, !!nb);
      if (old) {
        // 补焊：有助焊剂可以把虚焊、连锡修好；没有助焊剂连锡拉不开
        if (!q) { e.toast("补焊时间太短", "warn"); return; }
        if (q === "burnt") q = "burnt";
        else if (old.q === "bridge" && !flux) q = "bridge";
        else if (q === "bridge" && old.q === "cold") q = "bridge";
        else q = q === "cold" ? (old.q === "bridge" && flux ? "good" : "cold") : q;
        Object.assign(old, { q, bridge: q === "bridge" ? nb?.i : undefined });
        if (idx >= 0 && Array.isArray(p.state.solder[idx])) p.state.solder[idx] = old;
        e.toast(q === "good" ? "补焊成功：焊点变成光亮的小锥形" : `补焊后仍是「${{ cold: "虚焊", bridge: "连锡", burnt: "焊盘烫坏" }[q]}」`, q === "good" ? "ok" : "warn");
      } else {
        if (!q) { e.toast("时间太短，锡没熔到焊盘上", "warn"); return; }
        p.state.solder.push({ p: [lp.x, lp.y + 0.02, lp.z], q, i: j.f.i, other: j.other, bridge: q === "bridge" ? nb?.i : undefined });
        e.link(j.board, j.other, "fasten", "solder");
        const n = p.state.solder.length;
        const msg = {
          good: `焊好 ${n} 个点${flux ? "" : "（没涂助焊剂，焊得慢）"}`,
          cold: `虚焊：加热不够（${op.t.toFixed(1)} s < ${need} s），焊点发灰、不导通——涂助焊剂再补焊`,
          bridge: "连锡：加热太久，锡流到旁边的焊盘上把两针短路了——涂助焊剂再补焊",
          burnt: "加热太久，焊盘烫坏了（松开烙铁！）",
        }[q];
        e.toast(msg, q === "good" ? "ok" : q === "burnt" ? "error" : "warn");
      }
      e.history.push({ t: "solder", board: j.board, i: j.f.i, q: old ? old.q : q });
      e.emit();
    };
    const op = {
      uid: j.board,
      uids: [j.board],
      t: 0,
      kind: desolder ? "desolder" : "solder",
      need,
      entry: old && (idx >= 0 ? p.state.solder[idx] : null),
      step: (e, dt) => {
        op.t += dt;
        op.progress = Math.min(1, op.t / (desolder ? 0.8 : need));
        op.grade = desolder ? null : e.solderGrade(op.t, flux, !!nb);
        if ((hold != null && op.t >= hold - 1e-6) || (!desolder && op.t >= 3.5 * need) || (desolder && op.t >= 0.8 && hold == null)) finish(e);
      },
      onRelease: (e) => finish(e),
    };
    this.startOp(op);
    return op;
  },
  toLocal(uid, wp) {
    const w = this.worldPose(uid);
    return wp.clone().sub(w.p).applyQuaternion(w.q.clone().invert());
  },
  releaseOps() {
    for (const o of this.ops) if (!o.keep) o.onRelease?.(this);
    this.ops = this.ops.filter((o) => o.keep);
    this.emit();
  },
});

export const engine = new Engine();
if (typeof window !== "undefined") window.__engine = engine;
