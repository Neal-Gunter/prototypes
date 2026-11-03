// v23：重场景物理步耗时，体素盒 vs 凸包碰撞体（同一批零件、同一初始位置、同一步长）。早期原型，简化仿真。
// 需要 .tmp/eng-bundle.mjs / cat-bundle.mjs（sh scripts/engine-test.sh elec-bundle-only 会生成）；盒子版本读 ../libsrc/meta/<id>.json 的 colliders_boxes
import fs from "node:fs"; import path from "node:path";
import * as THREE from "three";
globalThis.fetch = async (u) => {
  const p = new URL("../public" + u, import.meta.url);
  if (!fs.existsSync(p)) return { ok: false, json: async () => [] };
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};
const { engine } = await import("../.tmp/eng-bundle.mjs");
const { getEntry, toDef } = await import("../.tmp/cat-bundle.mjs");
await engine.init(); engine.lodExp = !!process.env.LODEXP; if (process.env.SLOWDEPEN) engine.fastDepen = false; // v30：SLOWDEPEN=1 退回 v29 的逐碰撞体全查（对比用）
 if (process.env.ITER) engine.world.numSolverIterations = +process.env.ITER;
 for (const k of ["xtraIt", "xtraItBig", "xtraItDeep", "deepMm", "xtraMm", "smallMass", "stuckSmall", "stackPush", "stackMm", "coldEvery"]) if (process.env[k] != null) engine[k] = +process.env[k]; // v31：小件加时纠正参数（对比用）
// v32：PROF=1 时把每步耗时拆成 world.step / settleStep（穿透修正）/ lodTick / 其它
const PROF = {}; if (process.env.PROF) { const wrap = (o, k, name) => { const f = o[k].bind(o); o[k] = (...a) => { const t0 = performance.now(); const r = f(...a); PROF[name] = (PROF[name] || 0) + performance.now() - t0; return r; }; }; wrap(engine.world, "step", "world.step"); wrap(engine, "settleStep", "settleStep"); wrap(engine, "lodTick", "lodTick"); wrap(engine, "dragDepenetrate", "dragDepen"); }
const META = new URL("../../libsrc/meta/", import.meta.url);
const ids = [];
for (const f of fs.readdirSync(new URL("../public/lib/catalog", import.meta.url))) for (const e of JSON.parse(fs.readFileSync(new URL("../public/lib/catalog/" + f, import.meta.url), "utf8"))) if (e.collider_decomp?.hull) ids.push(e.id);
const COPIES = +(process.env.COPIES || 3), STEPS = +(process.env.STEPS || 360), SPARSE = !!process.env.SPARSE, SPACING = +(process.env.SPACING || 14);
const P = (x, y, z) => ({ p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion() });
async function scene(useBoxes, lod = false) {
  engine.colliderLod = lod;
  const us = []; let nCol = 0, k = 0;
  for (let c = 0; c < COPIES; c++) for (const id of ids) {
    const def = toDef(await getEntry(id));
    if (useBoxes) { const m = JSON.parse(fs.readFileSync(new URL(id + ".json", META), "utf8")); def.colliders = m.colliders_boxes; }
    nCol += def.colliders.length;
    const gx = k % 8, gz = Math.floor(k / 8) % 8, gy = Math.floor(k / 64); k++;
    // SPARSE=1（v28）：稀疏摆放（单层、间距 SPACING cm），对应“零件散放在桌上”的情形；默认是密集两层堆
    if (SPARSE) { const n = Math.ceil(Math.sqrt(COPIES * ids.length)), i = k - 1; us.push(engine.addPart(def, P((i % n - n / 2) * SPACING, 1, (Math.floor(i / n) - n / 2) * SPACING))); }
    else us.push(engine.addPart(def, P((gx - 3.5) * 9, 1 + gy * 12 + (k % 3) * 0.7, (gz - 3.5) * 9)));
  }
  for (let i = 0; i < 30; i++) engine.update(1 / 120); // 预热
  const t = []; let pen = 0; for (const k in PROF) PROF[k] = 0;
  for (let i = 0; i < STEPS; i++) { const t0 = performance.now(); engine.update(1 / 120); t.push(performance.now() - t0); }
  if (process.env.PROF) { const tot = t.reduce((s, v) => s + v, 0); console.log("  prof ms/step:", Object.entries(PROF).map(([k, v]) => `${k} ${(v / STEPS).toFixed(2)}`).join(" · "), `· 其它 ${((tot - Object.values(PROF).reduce((s, v) => s + v, 0)) / STEPS).toFixed(2)}`); }
  const ot = engine.overlapTest(); pen = ot.maxPenetrationMm; if (process.env.WORST) console.log("  worst", JSON.stringify(ot.worstPair?.map((u) => engine.parts.get(u)?.def?.id || u)), pen);
  let fb = 0, fo = 0; for (const b of engine.bodies.values()) if (b.fine) { fb++; if (b.fineOn !== false) fo++; }
  if (lod) { const t0 = performance.now(); for (let i = 0; i < 20; i++) engine.lodTick(1 / 120, true); let sl = 0; for (const b of engine.bodies.values()) if (b.rb.isSleeping()) sl++; console.log("  fine on:", fo, "/", fb, "bodies; lodTick", ((performance.now() - t0) / 20).toFixed(3), "ms; sleeping", sl); }
  for (const u of us) engine.removePart(u);
  t.sort((a, b) => a - b);
  return { parts: us.length, colliders: nCol, ms_mean: +(t.reduce((s, v) => s + v, 0) / t.length).toFixed(3), ms_p50: +t[t.length >> 1].toFixed(3), ms_p95: +t[Math.floor(t.length * 0.95)].toFixed(3), maxPenetration_mm: pen };
}
const res = {};
for (const r of [0, 1]) { res["boxes" + r] = await scene(true); res["hulls" + r] = await scene(false); res["lod" + r] = await scene(false, true); } // 交替两轮，减少 JIT/缓存顺序偏差
const avg = (a, b, k) => +((a[k] + b[k]) / 2).toFixed(3);
const out = { ids: ids.length, copies: COPIES, steps: STEPS,
  boxes: { parts: res.boxes0.parts, colliders: res.boxes0.colliders, ms_mean: avg(res.boxes0, res.boxes1, "ms_mean"), ms_p95: avg(res.boxes0, res.boxes1, "ms_p95"), pen_mm: Math.max(res.boxes0.maxPenetration_mm, res.boxes1.maxPenetration_mm) },
  hulls: { parts: res.hulls0.parts, colliders: res.hulls0.colliders, ms_mean: avg(res.hulls0, res.hulls1, "ms_mean"), ms_p95: avg(res.hulls0, res.hulls1, "ms_p95"), pen_mm: Math.max(res.hulls0.maxPenetration_mm, res.hulls1.maxPenetration_mm) },
  lod: { parts: res.lod0.parts, colliders: res.lod0.colliders, ms_mean: avg(res.lod0, res.lod1, "ms_mean"), ms_p95: avg(res.lod0, res.lod1, "ms_p95"), pen_mm: Math.max(res.lod0.maxPenetration_mm, res.lod1.maxPenetration_mm) }, raw: res };
console.log(`重场景：${out.boxes.parts} 个零件（凸包零件 ${ids.length} 种 × ${COPIES}），${STEPS} 步 @120 Hz`);
console.log(`  体素盒：${out.boxes.colliders} 个碰撞体，每步 ${out.boxes.ms_mean} ms（p95 ${out.boxes.ms_p95}），最大穿透 ${out.boxes.pen_mm} mm`);
console.log(`  凸包：  ${out.hulls.colliders} 个碰撞体，每步 ${out.hulls.ms_mean} ms（p95 ${out.hulls.ms_p95}），最大穿透 ${out.hulls.pen_mm} mm`);
console.log(`  凸包 + 分层（v28：桌面只碰外凸包）：每步 ${out.lod.ms_mean} ms（p95 ${out.lod.ms_p95}），最大穿透 ${out.lod.pen_mm} mm`);
const O = process.env.OUT || "/tmp/v23hull"; fs.mkdirSync(O, { recursive: true }); fs.writeFileSync(path.join(O, "hull-bench.json"), JSON.stringify(out, null, 1));
