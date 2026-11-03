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
const META = new URL("../../libsrc/meta/", import.meta.url);
const ids = [];
for (const f of fs.readdirSync(new URL("../public/lib/catalog", import.meta.url))) for (const e of JSON.parse(fs.readFileSync(new URL("../public/lib/catalog/" + f, import.meta.url), "utf8"))) if (e.collider_decomp?.hull) ids.push(e.id);
const COPIES = +(process.env.COPIES || 3), STEPS = +(process.env.STEPS || 360), SPARSE = !!process.env.SPARSE, SPACING = +(process.env.SPACING || 14);
const P = (x, y, z) => ({ p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion() });
engine.colliderLod = !process.env.NOLOD; for (const k of ["xtraIt","xtraItBig","xtraItDeep","deepMm","xtraMm","smallMass","stuckSmall","stackPush","stackMm","coldEvery","fallMax"]) if (process.env[k]!=null) engine[k]=+process.env[k];
const us=[]; let k=0;
for (let c = 0; c < COPIES; c++) for (const id of ids) { const def = toDef(await getEntry(id)); const gx = k % 8, gz = Math.floor(k / 8) % 8, gy = Math.floor(k / 64); k++; us.push(engine.addPart(def, P((gx - 3.5) * 9, 1 + gy * 12 + (k % 3) * 0.7 + (((k * (+process.env.SEED || 0)) % 7) * 0.13), (gz - 3.5) * 9))); }
let peak=0, at=-1, pk=null, peakAfter=0; const xs=[];
if (process.env.T0) { const o0 = engine.overlapTest(); console.log("t0", o0.maxPenetrationMm, JSON.stringify(o0.worstPair)); }
for (let i = 0; i < 390; i++) { engine.update(1/120); if (process.env.T0 && i < 12) { const o = engine.overlapTest(); console.log("i", i, o.maxPenetrationMm, JSON.stringify(o.worstPair)); } if (i%5==4){const ot=engine.overlapTest(); xs.push(ot.maxPenetrationMm); if (ot.maxPenetrationMm>peak){peak=ot.maxPenetrationMm;at=i;pk=ot.worstPair;} if(i>=30&&ot.maxPenetrationMm>peakAfter)peakAfter=ot.maxPenetrationMm;} }
xs.sort((a,b)=>a-b);
console.log(JSON.stringify({peak, at, peakAfterWarmup:peakAfter, p95:xs[Math.floor(xs.length*0.95)], median:xs[xs.length>>1], end:engine.overlapTest().maxPenetrationMm, pk: process.env.PK ? pk : undefined}));
