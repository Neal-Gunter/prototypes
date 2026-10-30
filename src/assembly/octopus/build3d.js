// 把 bench.js 的接线表摆成 3D：真实零件（库里的 CAD）+ 程序生成零件，导线按引脚连，舵机转动驱动触手画面。
import * as THREE from "three";
import { getEntry, toDef } from "../catalog.js";
import { pinsOf, FRAME } from "./parts.js";
import { Gait } from "./firmware.js";
import { LocoPhys } from "./loco.js";

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const rotY = (deg) => new THREE.Quaternion().setFromAxisAngle(UP, (deg * Math.PI) / 180);
export const OCTO_C = V3(12, 0, 1);
// 台面位置（cm）：主控和外设放在机身外面，按 md“20~30 cm 杜邦线把主控放体外”
export const BENCH_POS = {
  ESP: { p: [-11, 0, 3], yaw: 0 },
  MIC: { p: [-24, 0, 13], yaw: 0 },
  AMP: { p: [-17, 0, -9], yaw: 0 },
  SPK: { p: [-25, 0, -12], yaw: 0 },
  BAT: { p: [-22, 0, 1], yaw: 90 },
  U1: { p: [-1, 0, -14], yaw: 0 },
  U2: { p: [-10, 0, -14], yaw: 0 },
  OLED: { p: [25, 0, -16.5], yaw: 0 },
  PCA: { p: [0, 0, 10], yaw: 0 },
  DIV: { p: [-16, 0, 10], yaw: 0 }, // 完善版：电池分压板（我的补充） // 阶段 1–2 在桌上；阶段 3 起装在机身上层板
};
const DEF_OF = { DIV: "p-octo-vdiv", ESP: "p-octo-devkitc1", PCA: "ada-815", MIC: "p-octo-inmp441", AMP: "ada-3006", SPK: "ada-3923", BAT: "p-octo-2s-lipo", U1: "p-octo-xl4015-6v", U2: "p-octo-xl4015-5v", OLED: "p-octo-oled096" };
// v9：不再把机身“拴”在原位 8 cm 内（v8 的 TETHER 会把机身瞬移回边上）。导线不拽机身；只在导线直线距离接近线长时提示“实物里会拉紧”。
export const TAUT = 0.9; // 两端直线距离 ≥ 线长 × 0.9 就提示（估算：杜邦线有弯、扎带也占长度）
const defCache = {};
async function D(id) { return (defCache[id] ||= toDef(await getEntry(id))); }
const servoLocal = { shaft: [0, 3.07, 0.52], lead: [0, 0.45, -1.2] };

export async function buildOcto(engine, sim, { run, say } = {}) {
  const B = sim.bench, roles = {}, rotors = [];
  const label = (r) => ({ ESP: "ESP32‑S3 开发板", PCA: "PCA9685 舵机驱动板", MIC: "INMP441 麦克风", AMP: "MAX98357A 功放", SPK: "喇叭", BAT: B.variant === "plus" ? "3S 锂电组 11.1 V（我的补充）" : "2S 锂电池", DIV: "电池分压 100k/22k → GPIO10（我的补充）", U1: "降压 6 V（舵机）", U2: B.variant === "plus" ? "降压 5 V（ESP32，我的补充）" : "降压 5 V（ESP32，补充）", OLED: "OLED" }[r] || r);
  // ESP32 开发板 + 板上的真实 ESP32‑S3‑WROOM‑1 模组（同一个刚体）
  say?.("放主控：ESP32‑S3‑DevKitC‑1（模组用库里的 ESP32‑S3‑WROOM‑1 CAD）");
  {
    const P = BENCH_POS.ESP;
    const [u0, u1] = engine.addAssembly([
      { def: await D(DEF_OF.ESP), p: V3(...P.p), q: rotY(P.yaw), label: label("ESP") },
      { def: await D("kc-esp32-s3-wroom-1"), p: V3(P.p[0] - 1.875, 0.16, P.p[2]), q: rotY(90), label: "ESP32‑S3‑WROOM‑1 模组" },
    ], { why: "模组焊在开发板上" });
    roles.ESP = u0; roles.ESPMOD = u1;
  }
  for (const r of ["MIC", "AMP", "SPK", "BAT", "DIV", "U1", "U2", "OLED"]) {
    if (!B.roles.includes(r)) continue;
    const P = BENCH_POS[r];
    roles[r] = engine.addPart(await D(B.defs?.[r] || DEF_OF[r]), { p: V3(...P.p), q: rotY(P.yaw) }, { label: label(r) });
  }
  const servoDef = await D("ada-1143");
  if (B.robot) {
    say?.(B.plan === "B" ? "装机身：骨架 + 16 个 MG90S + 8 条触手 + PCA9685" : "装机身：骨架 + 8 个 MG90S（竖装，轴朝外）+ 8 条触手 + PCA9685");
    const items = [{ def: await D("p-octo-frame"), p: OCTO_C.clone(), label: "八爪鱼躯干骨架" }];
    const armDef = await D(B.plan === "B" ? "p-octo-arm-b" : "p-octo-arm");
    const capDef = await D("kc-cp_radial_d6.3mm_p2.50mm");
    const idx = {};
    for (let a = 0; a < 8; a++) {
      const th = Gait.MountAngle(a), t = (th * Math.PI) / 180, dir = V3(Math.cos(t), 0, Math.sin(t));
      const sp = OCTO_C.clone().addScaledVector(dir, 3.285).setY(FRAME.t);
      idx[`S${a}`] = items.length; items.push({ def: servoDef, p: sp, q: rotY(90 - th), label: `${a} 号触手舵机${B.plan === "B" ? "（偏航）" : ""}${B.servos.find((s) => s.arm === a && s.slot === 0)?.type === "360" ? "（买错：360° 连续旋转版）" : ""}` });
      if (B.plan === "B") {
        // 俯仰舵机侧躺在偏航舵机的舵盘支架上，输出轴沿切向（估算布置）
        const bp = OCTO_C.clone().addScaledVector(dir, 3.8).setY(3.37);
        idx[`BR${a}`] = items.length; items.push({ def: await D("p-octo-bracket-b"), p: bp, q: rotY(-th), label: `${a} 号俯仰舵机支架` });
        const tan = V3(-Math.sin(t), 0, Math.cos(t));
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir.clone(), tan.clone().negate().cross(dir).normalize().negate(), tan.clone()));
        // 局部：y 轴（输出轴）→ 切向，z 轴 → 径向外，x 轴 → 竖直
        const qq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(UP.clone(), tan.clone(), dir.clone()));
        const pp = bp.clone().addScaledVector(dir, 1.6).add(V3(0, 0.25 + 0.6, 0)).addScaledVector(tan, -1.55);
        idx[`P${a}`] = items.length; items.push({ def: servoDef, p: pp, q: qq, label: `${a} 号触手舵机（俯仰）` });
        void q;
        const ap = pp.clone().addScaledVector(dir, 0.52).addScaledVector(tan, 3.07);
        idx[`A${a}`] = items.length; items.push({ def: armDef, p: ap, q: rotY(-th), label: `${a} 号触手` });
      } else {
        const ap = OCTO_C.clone().addScaledVector(dir, 3.8).setY(FRAME.t + 3.07);
        idx[`A${a}`] = items.length; items.push({ def: armDef, p: ap, q: rotY(-th), label: `${a} 号触手` });
      }
      const ct = ((th + 22.5) * Math.PI) / 180;
      items.push({ def: capDef, p: OCTO_C.clone().add(V3(4.3 * Math.cos(ct), FRAME.t, 4.3 * Math.sin(ct))), label: `220µF 电容（${a} 号舵机旁）` });
    }
    idx.PCA = items.length; items.push({ def: await D("ada-815"), p: OCTO_C.clone().setY(FRAME.deckY + FRAME.deckT), label: label("PCA") });
    const uids = engine.addAssembly(items, { why: "八爪鱼机身（预设整体装好）", allowOverlap: true });
    roles.FRAME = uids[0]; roles.PCA = uids[idx.PCA];
    for (let a = 0; a < 8; a++) {
      roles[`S${a}`] = uids[idx[`S${a}`]]; roles[`A${a}`] = uids[idx[`A${a}`]];
      if (B.plan === "B") { roles[`P${a}`] = uids[idx[`P${a}`]]; roles[`BR${a}`] = uids[idx[`BR${a}`]]; }
    }
  } else if (B.phase >= 1) {
    say?.(`阶段 ${B.phase}：PCA9685 和 ${B.servos.length} 个舵机摆在桌上`);
    const P = BENCH_POS.PCA;
    roles.PCA = engine.addPart(await D("ada-815"), { p: V3(...P.p), q: rotY(0) }, { label: label("PCA") });
    const horn = await D("p-servo-horn");
    for (let k = 0; k < B.servos.length; k++) {
      const sp = V3(6 + k * 4.2, 0, 13);
      const [su, hu] = engine.addAssembly([{ def: servoDef, p: sp, q: rotY(180), label: `舵机 ${k}` }, { def: horn, p: sp.clone().add(V3(0, 3.07, -0.52)), q: rotY(0), label: `舵盘 ${k}` }], { why: "舵盘装在输出轴上" });
      roles[`S${k}`] = su; roles[`H${k}`] = hu;
    }
  }
  await run?.(0.5);
  // —— 导线 ——
  say?.(`接线：${B.wires.length} 根（颜色按 md：红 V+ / 黑 GND / 橙 3V3 / 蓝 SDA / 黄 SCL）`);
  const pinLocal = (role, pin) => {
    if (/^S\d/.test(role)) return servoLocal.lead;
    const base = role === "PCA" ? "PCA" : role;
    const u = roles[base]; if (!u) return null;
    const pt = pinsOf(engine.parts.get(u).def).pins[pin];
    return pt ? pt.p : null;
  };
  const sroleUid = (role) => roles[role.replace(/y$/, "").replace(/^S(\d)p$/, "P$1")] || roles[role];
  let k = 0;
  for (const w of B.wires) {
    const ua = w.kind === "octo-servo" ? sroleUid(w.a[0]) : roles[w.a[0]], ub = roles[w.b[0]];
    const pin2 = w.kind === "octo-servo" ? `${w.b[1]}.V+` : w.b[1];
    const la = pinLocal(w.a[0], w.a[1]), lb = pinLocal(w.b[0], pin2);
    if (!ua || !ub || !la || !lb) continue;
    const A = engine.toWorld(ua, la), Bp = engine.toWorld(ub, lb);
    let via;
    if (w.kind === "octo-servo" && B.robot) {
      const a = +w.a[0].slice(1, 2), th = (Gait.MountAngle(a) * Math.PI) / 180, dir = V3(Math.cos(th), 0, Math.sin(th));
      const slot = B.servos.findIndex((s) => s.role === w.a[0]), n = B.servos.length;
      const xk = OCTO_C.x - 1.15 + (2.3 * slot) / Math.max(1, n - 1);
      if (B.plan === "B" && /p$/.test(w.a[0])) via = [A.clone().add(V3(0, 0.6, 0)), V3(xk, 5.7, OCTO_C.z + 1.75), Bp.clone().add(V3(0, 0.5, 0.25))];
      else via = [A.clone().addScaledVector(dir, -0.35).setY(0.6), OCTO_C.clone().addScaledVector(dir, 1.3).setY(1.0), V3(xk, 2.6, OCTO_C.z + 1.75), V3(xk, 5.6, OCTO_C.z + 1.75), Bp.clone().add(V3(0, 0.5, 0.25))];
    } else {
      const h = Math.max(A.y, Bp.y) + 2.2 + (k % 4) * 0.35;
      via = [A.clone().add(V3(0, 0.9, 0)), A.clone().lerp(Bp, 0.3).setY(h), A.clone().lerp(Bp, 0.7).setY(h), Bp.clone().add(V3(0, 0.9, 0))];
    }
    const len = via.reduce((s, p, i) => s + (i ? p.distanceTo(via[i - 1]) : p.distanceTo(A)), 0) + via.at(-1).distanceTo(Bp);
    // 我的补充：舵机线在底板上扎成一束（扎带点 = 途经点），沿底板走到中心立柱再上到 PCA9685；机身走动时线不再甩圈
    let ties;
    if (w.kind === "octo-servo" && B.robot && roles.FRAME) {
      const pts = [A, ...via, Bp], cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const idx = via.length >= 5 ? [2, 3, 4] : [2];
      ties = idx.map((i) => ({ at: cum[i] / cum.at(-1), uid: roles.FRAME }));
    }
    engine.addCable(w.kind, [ua, ub], null, { endLocal: [la, lb], via, ties, color: w.color, N: Math.max(6, Math.min(16, Math.round(len / 2.2))), meta: { a: w.a, b: [w.b[0], pin2], why: w.why, md: w.md } });
    if (++k % 6 === 0) await run?.(0.05);
  }
  // —— v9：走路是物理（loco.js）。3D 画面 = 物理刚体的位姿：机身整体 + 每条触手的连杆（只摆画面/机身刚体，导线不拽机身）——
  let lp = null;
  if (B.robot) { lp = await LocoPhys.create(sim, { c: [OCTO_C.x, 0, OCTO_C.z], mu: sim.o.mu ?? 0.5 }); sim.attachPhys(lp); }
  for (const s of sim.servos) if (!B.robot) rotors.push({ s, kind: "yaw", servo: roles[`S${s.arm}`], part: roles[`H${s.arm}`] });
  const base = B.robot ? engine.worldPose(roles.FRAME) : null;
  // 每个跟着物理连杆走的零件：记下建好时的世界位姿 W0 和连杆建好时的位置 L0（连杆建的时候不转）
  const follow = [];
  if (lp) {
    const tv = (rb) => { const t = rb.translation(); return V3(t.x, t.y, t.z); };
    for (const L of lp.legs) {
      const add = (uid, rb) => { if (uid && engine.parts.get(uid)) { const w = engine.worldPose(uid); follow.push({ uid, rb, W0p: w.p.clone(), W0q: w.q.clone(), L0: tv(rb) }); } };
      if (B.plan === "B") { add(roles[`BR${L.a}`], L.links[0]); add(roles[`P${L.a}`], L.links[0]); add(roles[`A${L.a}`], L.links[1]); }
      else add(roles[`A${L.a}`], L.arm);
    }
  }
  const B0 = lp ? (() => { const t = lp.body.translation(); return V3(t.x, t.y, t.z); })() : null;
  const motion = { taut: 0, tautCable: null, last: null, dx: 0, dz: 0, h: 0, y: 0, frames: 0 };
  const rbPose = (rb) => { const t = rb.translation(), r = rb.rotation(); return { p: V3(t.x, t.y, t.z), q: new THREE.Quaternion(r.x, r.y, r.z, r.w) }; };
  // 刚体从建好时（L0，不转）到现在（Lt）的变换，作用到零件建好时的世界位姿上
  const carry = (L0, Lt, W0p, W0q) => ({ p: W0p.clone().sub(L0).applyQuaternion(Lt.q).add(Lt.p), q: Lt.q.clone().multiply(W0q) });
  const moveBody = () => {
    if (!lp || !base || !engine.parts.get(roles.FRAME)) return;
    const P = sim.pose; motion.dx = P.x; motion.dz = P.z; motion.h = P.h;
    const Bt = rbPose(lp.body); motion.y = Bt.p.y - B0.y;
    const key = `${Bt.p.x.toFixed(4)},${Bt.p.y.toFixed(4)},${Bt.p.z.toFixed(4)},${Bt.q.x.toFixed(4)},${Bt.q.y.toFixed(4)},${Bt.q.z.toFixed(4)}`;
    if (key !== motion.last) {
      motion.last = key;
      const w = carry(B0, Bt, base.p, base.q);
      engine.teleport(roles.FRAME, w.p, w.q, true);
    }
    for (const f of follow) { const part = engine.parts.get(f.uid); if (!part) continue; const w = carry(f.L0, rbPose(f.rb), f.W0p, f.W0q); part.vis = { pose: { p: w.p, q: w.q } }; }
    // 导线拉紧提示：一端在机身上、另一端在桌上的线，两端直线距离 / 线长
    if (++motion.frames % 10 === 0) {
      const onFrame = (u) => u && engine.parts.get(u)?.body === engine.parts.get(roles.FRAME)?.body;
      let worst = 0, wc = null;
      for (const c of engine.cables) {
        if (c.endUids.length < 2 || onFrame(c.endUids[0]) === onFrame(c.endUids[1])) continue;
        const d = engine.cableEndWorld(c.endUids[0], c.endLocal?.[0]).distanceTo(engine.cableEndWorld(c.endUids[1], c.endLocal?.[1])) / c.len;
        if (d > worst) { worst = d; wc = c.meta?.a?.join?.(".") || c.id; }
      }
      motion.taut = worst; motion.tautCable = wc;
    }
  };
  const apply = () => {
    moveBody();
    for (const r of rotors) {
      const p = engine.parts.get(r.part); if (!p) continue;
      const w = engine.worldPose(r.servo);
      p.vis = { ang: ((r.s.ang - 90) * Math.PI) / 180, axis: UP.clone().applyQuaternion(w.q), pivot: engine.toWorld(r.servo, servoLocal.shaft) };
    }
  };
  apply();
  return { roles, rotors, apply, motion, lp };
}
