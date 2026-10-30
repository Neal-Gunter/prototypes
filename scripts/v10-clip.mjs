// v10 机身穿模检查（我的补充）：同一个刚体里的零件 Rapier 不报接触，所以这里用碰撞盒（只绕竖直轴转）做分离轴检查：
// ① 零件两两之间 ② 舵机线折线到零件的距离 ≥ 线半径 ③ 每条触手在软件限位 ±55° 内扫一遍，碰不碰邻居舵机/上层板/板上零件。
import { readFileSync } from "node:fs";
import { OCTO_PROCEDURAL, pinsOf } from "../src/assembly/octopus/parts.js";
import { DECK_V10, servoPoseV10, armPoseV10, servoRouteV10 } from "../src/assembly/octopus/layout-v10.js";
import { benchSpec } from "../src/assembly/octopus/bench.js";
const root = new URL("../public/lib/", import.meta.url);
const idx = JSON.parse(readFileSync(new URL("index.json", root)));
const lib = (id) => { const proc = OCTO_PROCEDURAL.find((p) => p.id === id); if (proc) return proc; const row = idx.parts.find((p) => p[0] === id); return JSON.parse(readFileSync(new URL(`catalog/${row[3]}.json`, root))).find((e) => e.id === id); };
const rot = (yaw, [x, y, z]) => { const t = (yaw * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t); return [c * x + s * z, y, -s * x + c * z]; }; // three.js rotY
const obbs = (name, def, p, yaw) => (def.colliders || []).map((b) => { const c = rot(yaw, b.c); return { name, c: [c[0] + p[0], c[1] + p[1], c[2] + p[2]], h: b.h, yaw }; });
// 2D OBB（xz）+ y 区间：返回穿透深度（cm，<=0 表示不重叠）
function pen(a, b) {
  let m = Math.min(a.c[1] + a.h[1], b.c[1] + b.h[1]) - Math.max(a.c[1] - a.h[1], b.c[1] - b.h[1]);
  const ax = (o) => { const t = (o.yaw * Math.PI) / 180; return [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]]; };
  const A = ax(a), Bx = ax(b), d = [b.c[0] - a.c[0], b.c[2] - a.c[2]];
  for (const n of [...A, ...Bx]) {
    const r = (o, X) => o.h[0] * Math.abs(X[0][0] * n[0] + X[0][1] * n[1]) + o.h[2] * Math.abs(X[1][0] * n[0] + X[1][1] * n[1]);
    m = Math.min(m, r(a, A) + r(b, Bx) - Math.abs(d[0] * n[0] + d[1] * n[1]));
  }
  return m;
}
function ptDist(q, o) { // 点到 OBB 的距离（负 = 在里面）
  const t = (-o.yaw * Math.PI) / 180, dx = q[0] - o.c[0], dz = q[2] - o.c[2];
  const l = [Math.cos(t) * dx + Math.sin(t) * dz, q[1] - o.c[1], -Math.sin(t) * dx + Math.cos(t) * dz];
  const e = l.map((v, i) => Math.abs(v) - o.h[i]);
  const out = Math.hypot(...e.map((v) => Math.max(0, v)));
  return out > 0 ? out : Math.max(...e);
}
export function clipV10() {
  const bench = benchSpec({ variant: "v10" }), parts = [];
  parts.push({ name: "FRAME", boxes: obbs("FRAME", lib("p-octo-frame-v10"), [0, 0, 0], 0) });
  for (let a = 0; a < 8; a++) {
    const S = servoPoseV10(a), A = armPoseV10(a);
    parts.push({ name: `S${a}`, boxes: obbs(`S${a}`, lib("ada-2201"), S.p, S.yaw), pose: S, def: lib("ada-2201") });
    parts.push({ name: `A${a}`, boxes: obbs(`A${a}`, lib("p-octo-arm-v10"), A.p, A.yaw), arm: a });
  }
  for (const r of bench.roles) { const L = DECK_V10[r]; parts.push({ name: r, boxes: obbs(r, lib(bench.defs[r]), L.p, L.yaw), pose: L, def: lib(bench.defs[r]) }); }
  const TOUCH = 0.005; // 0.05 mm：贴着放（螺丝/胶固定）算接触，不算穿模
  let worst = { d: 0 }, list = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) for (const a of parts[i].boxes) for (const b of parts[j].boxes) {
    const d = pen(a, b); if (d > TOUCH) { list.push(`${parts[i].name}×${parts[j].name} ${(d * 10).toFixed(2)} mm`); if (d > worst.d) worst = { d, pair: [parts[i].name, parts[j].name] }; }
  }
  // 舵机线
  const all = parts.flatMap((p) => p.boxes.map((b) => ({ ...b, owner: p.name })));
  const pinW = (role, pin) => { const P = parts.find((p) => p.name === role); const l = pinsOf(P.def).pins[pin].p; const r = rot(P.pose.yaw, l); return [r[0] + P.pose.p[0], r[1] + P.pose.p[1], r[2] + P.pose.p[2]]; };
  let wireMin = 1e9, wireWorst = null;
  for (const w of bench.wires.filter((x) => x.kind === "octo-v10-servo")) {
    const a = +w.a[0].slice(1);
    for (const [j, tgt, R] of [[0, ["QTPY", w.b[1]], 0.06], [1, [w.rail, "OUT"], 0.09]]) {
      const start = pinW(w.a[0], "LEAD"), end = pinW(...tgt), via = servoRouteV10(a, end, j), pts = [start, ...via, end];
      for (let s = 1; s < pts.length; s++) for (let u = 0; u <= 20; u++) {
        const f = u / 20, q = pts[s - 1].map((v, k) => v + (pts[s][k] - v) * f);
        if (Math.hypot(...q.map((v, k) => v - start[k])) < 0.6 || Math.hypot(...q.map((v, k) => v - end[k])) < 0.6) continue; // 线头焊在焊盘 / 从舵机里出来
        for (const o of all) { const d = ptDist(q, o) - R; if (d < wireMin) { wireMin = d; wireWorst = `${w.a[0]}→${tgt.join(".")} 碰 ${o.owner} @${q.map((v) => v.toFixed(2))} seg${s}`; } }
      }
    }
  }
  // 触手扫 ±55°
  let sweep = { d: 0 };
  for (let a = 0; a < 8; a++) {
    const A = armPoseV10(a), def = lib("p-octo-arm-v10");
    for (let dy = -55; dy <= 55; dy += 5) {
      const bx = obbs(`A${a}`, def, A.p, A.yaw + dy).slice(1); // 去掉舵盘（和自己的输出轴贴着）
      for (const P of parts) { if (P.name === `A${a}` || P.name === `S${a}` || P.arm != null) continue; for (const b of P.boxes) for (const x of bx) { const d = pen(x, b); if (d > sweep.d) sweep = { d, a, dy, with: P.name }; } }
    }
  }
  return { worstMm: +(worst.d * 10).toFixed(3), worstPair: worst.pair || null, list, wireClearMm: +(wireMin * 10).toFixed(2), wireWorst, sweepMm: +(sweep.d * 10).toFixed(3), sweep };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(clipV10(), null, 1));
