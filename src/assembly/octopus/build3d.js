// 把 bench.js 的接线表摆成 3D：真实零件（库里的 CAD）+ 程序生成零件，导线按引脚连，舵机转动驱动触手画面。
import * as THREE from "three";
import { getEntry, toDef } from "../catalog.js";
import { pinsOf, FRAME } from "./parts.js";
import { Gait } from "./firmware.js";

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
  PCA: { p: [0, 0, 10], yaw: 0 }, // 阶段 1–2 在桌上；阶段 3 起装在机身上层板
};
const DEF_OF = { ESP: "p-octo-devkitc1", PCA: "ada-815", MIC: "p-octo-inmp441", AMP: "ada-3006", SPK: "ada-3923", BAT: "p-octo-2s-lipo", U1: "p-octo-xl4015-6v", U2: "p-octo-xl4015-5v", OLED: "p-octo-oled096" };
const defCache = {};
async function D(id) { return (defCache[id] ||= toDef(await getEntry(id))); }
const servoLocal = { shaft: [0, 3.07, 0.52], lead: [0, 0.45, -1.2] };

export async function buildOcto(engine, sim, { run, say } = {}) {
  const B = sim.bench, roles = {}, rotors = [];
  const label = (r) => ({ ESP: "ESP32‑S3 开发板", PCA: "PCA9685 舵机驱动板", MIC: "INMP441 麦克风", AMP: "MAX98357A 功放", SPK: "喇叭", BAT: "2S 锂电池", U1: "降压 6 V（舵机）", U2: "降压 5 V（ESP32，补充）", OLED: "OLED" }[r] || r);
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
  for (const r of ["MIC", "AMP", "SPK", "BAT", "U1", "U2", "OLED"]) {
    if (!B.roles.includes(r)) continue;
    const P = BENCH_POS[r];
    roles[r] = engine.addPart(await D(DEF_OF[r]), { p: V3(...P.p), q: rotY(P.yaw) }, { label: label(r) });
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
    engine.addCable(w.kind, [ua, ub], null, { endLocal: [la, lb], via, color: w.color, N: Math.max(6, Math.min(16, Math.round(len / 2.2))), meta: { a: w.a, b: [w.b[0], pin2], why: w.why, md: w.md } });
    if (++k % 6 === 0) await run?.(0.05);
  }
  // —— 舵机 → 画面（只改画面，不推动刚体） ——
  for (const s of sim.servos) {
    if (B.robot && B.plan === "B") {
      rotors.push({ s, kind: s.slot === 0 ? "yawB" : "pitchB", arm: s.arm });
    } else if (B.robot) rotors.push({ s, kind: "yaw", servo: roles[`S${s.arm}`], part: roles[`A${s.arm}`] });
    else rotors.push({ s, kind: "yaw", servo: roles[`S${s.arm}`], part: roles[`H${s.arm}`] });
  }
  const tmpQ = new THREE.Quaternion();
  const apply = () => {
    for (const r of rotors) {
      if (r.kind === "yaw") {
        const p = engine.parts.get(r.part); if (!p) continue;
        const w = engine.worldPose(r.servo);
        p.vis = { ang: ((r.s.ang - 90) * Math.PI) / 180, axis: UP.clone().applyQuaternion(w.q), pivot: engine.toWorld(r.servo, servoLocal.shaft) };
      }
    }
    if (B.robot && B.plan === "B") {
      for (let a = 0; a < 8; a++) {
        const ys = sim.servos.find((s) => s.arm === a && s.slot === 0), ps = sim.servos.find((s) => s.arm === a && s.slot === 1);
        const sy = roles[`S${a}`], sp = roles[`P${a}`];
        const wy = engine.worldPose(sy), pivY = engine.toWorld(sy, servoLocal.shaft), axY = UP.clone().applyQuaternion(wy.q);
        const qY = tmpQ.clone().setFromAxisAngle(axY, ((ys.ang - 90) * Math.PI) / 180);
        const wp = engine.worldPose(sp), pivP0 = engine.toWorld(sp, servoLocal.shaft), axP0 = UP.clone().applyQuaternion(wp.q);
        const pivP = pivP0.clone().sub(pivY).applyQuaternion(qY).add(pivY), axP = axP0.clone().applyQuaternion(qY);
        const qP = new THREE.Quaternion().setFromAxisAngle(axP, ((ps.ang - 90) * Math.PI) / 180);
        const setPose = (uid, pitch) => {
          const part = engine.parts.get(uid); if (!part) return;
          const w = engine.worldPose(uid);
          let p = w.p.clone().sub(pivY).applyQuaternion(qY).add(pivY), q = qY.clone().multiply(w.q);
          if (pitch) { p = p.sub(pivP).applyQuaternion(qP).add(pivP); q = qP.clone().multiply(q); }
          part.vis = { pose: { p, q } };
        };
        setPose(roles[`BR${a}`], false); setPose(sp, false); setPose(roles[`A${a}`], true);
      }
    }
  };
  apply();
  return { roles, rotors, apply };
}
