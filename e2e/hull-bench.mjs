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
await engine.init();
const META = new URL("../../libsrc/meta/", import.meta.url);
const ids = [];
for (const f of fs.readdirSync(new URL("../public/lib/catalog", import.meta.url))) for (const e of JSON.parse(fs.readFileSync(new URL("../public/lib/catalog/" + f, import.meta.url), "utf8"))) if (e.collider_decomp?.hull) ids.push(e.id);
const COPIES = +(process.env.COPIES || 3), STEPS = +(process.env.STEPS || 360);
const P = (x, y, z) => ({ p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion() });
async function scene(useBoxes) {
  const us = []; let nCol = 0, k = 0;
  for (let c = 0; c < COPIES; c++) for (const id of ids) {
    const def = toDef(await getEntry(id));
    if (useBoxes) { const m = JSON.parse(fs.readFileSync(new URL(id + ".json", META), "utf8")); def.colliders = m.colliders_boxes; }
    nCol += def.colliders.length;
    const gx = k % 8, gz = Math.floor(k / 8) % 8, gy = Math.floor(k / 64); k++;
    us.push(engine.addPart(def, P((gx - 3.5) * 9, 1 + gy * 12 + (k % 3) * 0.7, (gz - 3.5) * 9)));
  }
  for (let i = 0; i < 30; i++) engine.update(1 / 120); // 预热
  const t = []; let pen = 0;
  for (let i = 0; i < STEPS; i++) { const t0 = performance.now(); engine.update(1 / 120); t.push(performance.now() - t0); }
  pen = engine.overlapTest().maxPenetrationMm;
  for (const u of us) engine.removePart(u);
  t.sort((a, b) => a - b);
  return { parts: us.length, colliders: nCol, ms_mean: +(t.reduce((s, v) => s + v, 0) / t.length).toFixed(3), ms_p50: +t[t.length >> 1].toFixed(3), ms_p95: +t[Math.floor(t.length * 0.95)].toFixed(3), maxPenetration_mm: pen };
}
const res = {};
for (const r of [0, 1]) { res["boxes" + r] = await scene(true); res["hulls" + r] = await scene(false); } // 交替两轮，减少 JIT/缓存顺序偏差
const avg = (a, b, k) => +((a[k] + b[k]) / 2).toFixed(3);
const out = { ids: ids.length, copies: COPIES, steps: STEPS,
  boxes: { parts: res.boxes0.parts, colliders: res.boxes0.colliders, ms_mean: avg(res.boxes0, res.boxes1, "ms_mean"), ms_p95: avg(res.boxes0, res.boxes1, "ms_p95"), pen_mm: Math.max(res.boxes0.maxPenetration_mm, res.boxes1.maxPenetration_mm) },
  hulls: { parts: res.hulls0.parts, colliders: res.hulls0.colliders, ms_mean: avg(res.hulls0, res.hulls1, "ms_mean"), ms_p95: avg(res.hulls0, res.hulls1, "ms_p95"), pen_mm: Math.max(res.hulls0.maxPenetration_mm, res.hulls1.maxPenetration_mm) }, raw: res };
console.log(`重场景：${out.boxes.parts} 个零件（凸包零件 ${ids.length} 种 × ${COPIES}），${STEPS} 步 @120 Hz`);
console.log(`  体素盒：${out.boxes.colliders} 个碰撞体，每步 ${out.boxes.ms_mean} ms（p95 ${out.boxes.ms_p95}），最大穿透 ${out.boxes.pen_mm} mm`);
console.log(`  凸包：  ${out.hulls.colliders} 个碰撞体，每步 ${out.hulls.ms_mean} ms（p95 ${out.hulls.ms_p95}），最大穿透 ${out.hulls.pen_mm} mm`);
const O = process.env.OUT || "/tmp/v23hull"; fs.mkdirSync(O, { recursive: true }); fs.writeFileSync(path.join(O, "hull-bench.json"), JSON.stringify(out, null, 1));
