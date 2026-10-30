// v21：凸分解碰撞体的离线校验（只读仓库内文件：public/lib/catalog/*.json + GLB）。早期原型，简化仿真。
//   对每个带 collider_decomp 的零件：
//   1) 盒子数 ≤ 300（v22：大件细分；v21 为 ≤ 40），每个盒子都是凸的长方体，两两不重叠（交叠深度 < 0.001 mm）
//   2) 盒子全部在网格包围盒内（0.01 mm）
//   3) 可见网格的每个顶点都落在某个盒子内（容差 0.01 mm）→ 碰撞体完整包住外形
//   4) 构建时测得的最大外扩 exMax_mm ≤ 声明的容差 tol_mm（= 体素对角线）
//   退出码 0 = 全部通过；报告写到 $OUT/collider-test.json
import fs from "node:fs"; import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const EPS = 0.001; // cm = 0.01 mm
const parts = [];
for (const f of fs.readdirSync(path.join(ROOT, "public/lib/catalog"))) for (const e of JSON.parse(fs.readFileSync(path.join(ROOT, "public/lib/catalog", f), "utf8"))) if (e.collider_decomp) parts.push(e);
let fails = 0; const rep = [];
const ok = (c, msg) => { if (!c) { fails++; console.log("FAIL", msg); } };
for (const e of parts) {
  const B = e.colliders, cd = e.collider_decomp;
  ok(B.length <= 300 && B.length === cd.n, `${e.id} 盒子数 ${B.length}`);
  let maxOv = 0;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    let v = Infinity; for (let k = 0; k < 3; k++) { const d = Math.min(B[i].c[k] + B[i].h[k], B[j].c[k] + B[j].h[k]) - Math.max(B[i].c[k] - B[i].h[k], B[j].c[k] - B[j].h[k]); v = Math.min(v, Math.max(0, d)); }
    maxOv = Math.max(maxOv, v);
  }
  ok(maxOv < 1e-4, `${e.id} 盒子互相重叠 ${(maxOv * 10).toFixed(4)} mm 深`);
  const doc = await io.read(path.join(ROOT, "public", e.glb));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let nV = 0, miss = 0, worst = 0;
  const vtx = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const pa = p.getAttribute("POSITION"), v = [0, 0, 0];
      for (let i = 0; i < pa.getCount(); i++) { pa.getElement(i, v); const q = [W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13], W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]]; vtx.push(q); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); } }
    }
  }
  for (const q of vtx) {
    nV++;
    let d = Infinity;
    for (const b of B) { const dd = Math.hypot(...[0, 1, 2].map((k) => Math.max(b.c[k] - b.h[k] - q[k], 0, q[k] - b.c[k] - b.h[k]))); if (dd < d) d = dd; if (d <= EPS) break; }
    if (d > EPS) { miss++; worst = Math.max(worst, d); }
  }
  ok(miss === 0, `${e.id} ${miss}/${nV} 个网格顶点在碰撞体外（最远 ${(worst * 10).toFixed(3)} mm）`);
  const outB = B.some((b) => [0, 1, 2].some((k) => b.c[k] - b.h[k] < lo[k] - EPS || b.c[k] + b.h[k] > hi[k] + EPS));
  ok(!outB, `${e.id} 有盒子超出网格包围盒`);
  ok(cd.exMax_mm <= cd.tol_mm, `${e.id} 外扩 ${cd.exMax_mm} mm > 容差 ${cd.tol_mm} mm`);
  rep.push({ id: e.id, boxes: B.length, verts: nV, miss, maxOverlapDepth_mm: +(maxOv * 10).toFixed(6), cell_mm: cd.cell_mm, exMax_mm: cd.exMax_mm, p50_mm: cd.p50_mm, tol_mm: cd.tol_mm });
}
const out = process.env.OUT || "/tmp/v21coll"; fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "collider-test.json"), JSON.stringify(rep, null, 1));
const tolMax = Math.max(...rep.map((r) => r.tol_mm)), tolMed = rep.map((r) => r.tol_mm).sort((a, b) => a - b)[rep.length >> 1];
const over3 = rep.filter((r) => r.exMax_mm > 3); const exs = rep.map((r) => r.exMax_mm).sort((a, b) => a - b);
console.log(`v22 细参考网格实测外扩：中位 ${exs[exs.length >> 1]} mm，最大 ${exs[exs.length - 1]} mm；> 3 mm 的零件 ${over3.length} 个${over3.length ? '（' + over3.map((r) => r.id + ' ' + r.exMax_mm + ' mm / ' + r.boxes + ' 盒').join('，') + '）' : ''}`);
console.log(`凸分解零件 ${parts.length} 个 · 网格顶点 ${rep.reduce((s, r) => s + r.verts, 0)} 个全部在碰撞体内=${rep.every((r) => !r.miss)} · 外扩 ≤ 容差（中位 ${tolMed} mm，最大 ${tolMax} mm）· ${fails ? fails + " 失败" : "全部通过"}`);
process.exit(fails ? 1 : 0);
