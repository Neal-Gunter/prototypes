// v34（我的补充）：细长零件落地基准。每种长宽比 ≥ 4 的程序零件单独从“最低点离桌约 3 cm”斜着落下，记录：
// 穿透峰值、弹起次数、落地后滚/滑出去的水平距离、到静止的时间。只是仿真基准（简化仿真），不是实测。
// 用法：node e2e/thin-bench.mjs   环境变量：N（只测前 N 种）、以及 engine 属性（thinDamp 等）
import fs from "node:fs";
import * as THREE from "three";
globalThis.fetch = async (u) => { const p = new URL("../public" + u, import.meta.url); if (!fs.existsSync(p)) return { ok: false, json: async () => [] }; return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) }; };
const { engine } = await import("../.tmp/eng-bundle.mjs");
const { getEntry, toDef } = await import("../.tmp/cat-bundle.mjs");
const { PROCEDURAL } = await import("../.tmp/proc-bundle.mjs");
await engine.init();
for (const k of ["thinDamp", "thinAspect", "fallMax", "coldMax"]) if (process.env[k] != null) engine[k] = +process.env[k];
const ar = (d) => { const a = [d.dims_mm.x, d.dims_mm.y, d.dims_mm.z].sort((x, y) => x - y); return a[0] > 0 ? a[2] / a[1] : 0; };
// 比桌面（60 × 40 cm）还长的（≥ 500 mm，如 600 / 1000 mm 型材）放不平、会卡在侧墙上，不算在内
let ids = PROCEDURAL.filter((d) => ar(d) >= 4 && Math.max(d.dims_mm.x, d.dims_mm.y, d.dims_mm.z) < 500 && !/^p-(tool|handtool)-/.test(d.id)).map((d) => d.id);
if (process.env.N) ids = ids.slice(0, +process.env.N);
const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.61, 0.4, 0.3));
const rows = [];
for (const id of ids) {
  const D = PROCEDURAL.find((d) => d.id === id).dims_mm, half = Math.max(D.x, D.y, D.z) / 20; // cm
  const u = engine.addPart(toDef(await getEntry(id)), { p: new THREE.Vector3(0, 3 + half, 0), q: q.clone() });
  // PAIR=1：再在上面 1 cm 处放一根转了 90° 的同款，叠着落（细长件互相砸的情况）
  const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1.97, -0.4));
  const u2 = process.env.PAIR ? engine.addPart(toDef(await getEntry(id)), { p: new THREE.Vector3(0.4, 4 + 3 * half, 0.3), q: q2 }) : null;
  const rb = () => engine.bodies.get(engine.parts.get(u).body)?.rb;
  let peak = 0, bounces = 0, prevUp = false, touch = null, still = null, i = 0, pvy = null;
  for (; i < 480; i++) {
    engine.update(1 / 120);
    const r = rb(); if (!r) break;
    const m = engine.overlapTest().maxPenetrationMm; if (m > peak) peak = m;
    const v = r.linvel(), w = r.angvel(), t = r.translation();
    const up = v.y > 2; if (up && !prevUp && touch) bounces++; prevUp = up;
    if (!touch && pvy != null && v.y > pvy + 1) touch = { x: t.x, z: t.z, i }; // 速度不再按重力往下加 = 碰到桌面了
    pvy = v.y;
    const sp = Math.hypot(v.x, v.y, v.z), ws = Math.hypot(w.x, w.y, w.z);
    if (touch && still == null && (r.isSleeping() || (sp < 0.3 && ws < 0.3))) still = i;
    if (still != null && i > still + 10 && (!u2 || i > 240)) break;
  }
  const t = rb().translation();
  const drift = touch ? Math.hypot(t.x - touch.x, t.z - touch.z) * 10 : NaN;
  rows.push({ id, peak: +peak.toFixed(3), bounces, drift_mm: +drift.toFixed(1), settle_s: still == null ? null : +(still / 120).toFixed(2) });
  engine.removePart(u); if (u2) engine.removePart(u2); for (let k = 0; k < 4; k++) engine.update(1 / 120);
}
const avg = (k) => rows.reduce((s, r) => s + (r[k] ?? 4), 0) / rows.length, mx = (k) => Math.max(...rows.map((r) => r[k] ?? 4));
const sum = { n: rows.length, peakAvg: +avg("peak").toFixed(3), peakMax: mx("peak"), bounceAvg: +avg("bounces").toFixed(2), driftAvg_mm: +avg("drift_mm").toFixed(1), driftMax_mm: mx("drift_mm"), settleAvg_s: +avg("settle_s").toFixed(2), unsettled: rows.filter((r) => r.settle_s == null).length };
if (process.env.ROWS) for (const r of rows.sort((a, b) => b.drift_mm - a.drift_mm).slice(0, 12)) console.log(JSON.stringify(r));
console.log(JSON.stringify(sum));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ sum, rows }, null, 1));
