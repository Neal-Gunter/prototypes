// v21：构建时把“同一刚体内互相重叠的复合碰撞盒”换成近似凸分解（体素化 → 贪心合并成互不重叠的长方体）。
//   每个长方体都是凸的，彼此不重叠（体积和 ≤ 包围盒），整体贴着可见网格：
//     覆盖：网格表面采样点 100% 落在碰撞体内（容差 0.01 mm）
//     外扩：碰撞体里不属于网格实体的点，到网格表面的距离 ≤ 1 个体素对角线（逐件写进 meta.collider_decomp.tol_mm）
//   用法：node scripts/decompose-colliders.mjs [--check]（--check 只算不写）；然后 node scripts/build-catalog.mjs
//   原来的 AABB 复合盒保留在 meta.colliders_aabb，可回退。早期原型，简化仿真。
import fs from "node:fs"; import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const META = path.resolve(ROOT, "../libsrc/meta");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const CHECK = process.argv.includes("--check");
const MAXB = +(process.env.MAXB || 40);               // 每个零件最多几个长方体（Rapier 复合刚体）
const RES = [64, 48, 40, 32, 24, 18, 14, 10, 8, 6, 4];
const REFM = !!process.env.REFM;                      // v22：只重量（配合 --check），用细参考网格
const TARGET = +(process.env.TARGET || 0);           // v22：目标最大外扩（mm），只对超标的大件生效
const MAXB2 = +(process.env.MAXB2 || 300);            // v22：细分时每件最多几个长方体
const RES_FINE = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 64, 72, 80, 96, 112, 128];
const EXTRA = (process.env.IDS || "").split(",").filter(Boolean);
const r3 = (v) => Math.round(v * 1000) / 1000;

const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "public/lib/index.json"), "utf8"));
const cat = {}; for (const p of idx.parts) cat[p[0]] = p[3];
function overlapping(cs, dims) {
  if (!cs || cs.length < 2) return false;
  const vol = cs.reduce((s, c) => s + 8 * c.h[0] * c.h[1] * c.h[2], 0);
  const bv = (dims.x / 10) * (dims.y / 10) * (dims.z / 10);
  return vol > bv * 1.05 + 1e-4; // 和 parts-validate 同一判据：复合盒体积和 > 包围盒 × 1.05
}
function ovl(a, b) { let v = 1; for (let k = 0; k < 3; k++) { const d = Math.min(a.c[k] + a.h[k], b.c[k] + b.h[k]) - Math.max(a.c[k] - a.h[k], b.c[k] - b.h[k]); if (d <= 0) return 0; v *= d; } return v; }

async function tris(file) {
  const doc = await io.read(file); const T = [];
  for (const n of doc.getRoot().listNodes()) {
    const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const pa = p.getAttribute("POSITION"); const ix = p.getIndices(); const cnt = ix ? ix.getCount() : pa.getCount();
      const v = [0, 0, 0], P = (i) => { pa.getElement(i, v); return [W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13], W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]]; };
      for (let t = 0; t < cnt; t += 3) T.push([P(ix ? ix.getScalar(t) : t), P(ix ? ix.getScalar(t + 1) : t + 1), P(ix ? ix.getScalar(t + 2) : t + 2)]);
    }
  }
  return T;
}
// 表面采样点（顶点 + 三角形内部，间距 ≤ step）
function samples(T, step) {
  const S = [];
  for (const [a, b, c] of T) {
    const l = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]));
    const n = Math.min(400, Math.max(1, Math.ceil(l / step)));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, w = j / n, s = 1 - u - w; S.push([a[0] * s + b[0] * u + c[0] * w, a[1] * s + b[1] * u + c[1] * w, a[2] * s + b[2] * u + c[2] * w]); }
  }
  return S;
}
function voxel(S, lo, hi, R) {
  const span = [0, 1, 2].map((i) => hi[i] - lo[i]); const cell = Math.max(...span) / R;
  const n = span.map((s) => Math.max(1, Math.ceil(s / cell - 1e-9)));
  const N = [n[0] + 2, n[1] + 2, n[2] + 2]; const id = (x, y, z) => (z * N[1] + y) * N[0] + x;
  const surf = new Uint8Array(N[0] * N[1] * N[2]);
  for (const p of S) { const q = [0, 1, 2].map((i) => Math.min(n[i] - 1, Math.max(0, Math.floor((p[i] - lo[i]) / cell)))); surf[id(q[0] + 1, q[1] + 1, q[2] + 1)] = 1; }
  // 外部：从外围填充，剩下的（表面 + 被包住的内部）都算实体
  const ext = new Uint8Array(surf.length); const st = [0]; ext[0] = 1;
  while (st.length) { const k = st.pop(); const x = k % N[0], y = ((k / N[0]) | 0) % N[1], z = (k / (N[0] * N[1])) | 0;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const a = x + dx, b = y + dy, c = z + dz; if (a < 0 || b < 0 || c < 0 || a >= N[0] || b >= N[1] || c >= N[2]) continue; const j = id(a, b, c); if (!ext[j] && !surf[j]) { ext[j] = 1; st.push(j); } } }
  const solid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < n[0] && y < n[1] && z < n[2] && !ext[id(x + 1, y + 1, z + 1)];
  return { cell, n, solid };
}
// 粗网格 = 细网格（2 倍分辨率）2×2×2 取“有任一实体”：内部空腔按细网格判断，粗块不会把漏风的壳体整个填实
function coarsen(F) {
  const n = F.n.map((v) => Math.ceil(v / 2));
  const solid = (x, y, z) => { if (x < 0 || y < 0 || z < 0 || x >= n[0] || y >= n[1] || z >= n[2]) return false; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) if (F.solid(2 * x + a, 2 * y + b, 2 * z + c)) return true; return false; };
  return { cell: F.cell * 2, n, solid };
}
function boxes(V, lo, hi) {
  const { n, solid, cell } = V; const used = new Uint8Array(n[0] * n[1] * n[2]); const k = (x, y, z) => (z * n[1] + y) * n[0] + x;
  const free = (x, y, z) => solid(x, y, z) && !used[k(x, y, z)];
  const out = [];
  for (let z = 0; z < n[2]; z++) for (let y = 0; y < n[1]; y++) for (let x = 0; x < n[0]; x++) {
    if (!free(x, y, z)) continue;
    let x1 = x; while (free(x1 + 1, y, z)) x1++;
    let y1 = y; const rowOk = (yy, zz) => { for (let i = x; i <= x1; i++) if (!free(i, yy, zz)) return false; return true; };
    while (rowOk(y1 + 1, z)) y1++;
    let z1 = z; const slabOk = (zz) => { for (let j = y; j <= y1; j++) if (!rowOk(j, zz)) return false; return true; };
    while (slabOk(z1 + 1)) z1++;
    for (let c = z; c <= z1; c++) for (let b = y; b <= y1; b++) for (let a = x; a <= x1; a++) used[k(a, b, c)] = 1;
    const mn = [x, y, z].map((v, i) => lo[i] + v * cell), mx = [x1 + 1, y1 + 1, z1 + 1].map((v, i) => Math.min(hi[i], lo[i] + v * cell));
    out.push({ mn, mx });
  }
  return out;
}
const dBox = (p, b) => Math.hypot(...[0, 1, 2].map((i) => Math.max(b.mn[i] - p[i], 0, p[i] - b.mx[i])));
function metrics(T, S, B, lo, hi, cell, fine, SR = S) {
  // 覆盖：表面点到碰撞体的距离
  let cov = 0; for (const p of S) { let d = Infinity; for (const b of B) { d = Math.min(d, dBox(p, b)); if (d === 0) break; } if (d > 0.001) cov++; }
  // 外扩：在每个长方体里均匀取点；不在细网格实体里的点，量到最近表面采样点的距离
  const grid = new Map(), g = cell; const key = (p) => p.map((v) => Math.floor(v / g)).join(",");
  for (const p of SR) { const kk = key(p); (grid.get(kk) || grid.set(kk, []).get(kk)).push(p); }
  const near = (p) => { let d = Infinity; const c = p.map((v) => Math.floor(v / g)); for (let r = 1; r <= 3 && d === Infinity; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let e = -r; e <= r; e++) for (const q of grid.get(`${c[0] + a},${c[1] + b},${c[2] + e}`) || []) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); return d; };
  let exMax = 0, nOut = 0, nPts = 0; const ex = [];
  for (const b of B) { const m = 4; for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) for (let l = 0; l < m; l++) {
    const p = [b.mn[0] + (b.mx[0] - b.mn[0]) * (i + 0.5) / m, b.mn[1] + (b.mx[1] - b.mn[1]) * (j + 0.5) / m, b.mn[2] + (b.mx[2] - b.mn[2]) * (l + 0.5) / m]; nPts++;
    const q = [0, 1, 2].map((t) => Math.min(fine.n[t] - 1, Math.max(0, Math.floor((p[t] - lo[t]) / fine.cell))));
    if (fine.solid(q[0], q[1], q[2])) continue; nOut++; const dd = near(p); ex.push(dd); exMax = Math.max(exMax, dd); } }
  ex.sort((a, b) => a - b); const p99 = ex.length ? ex[Math.floor((ex.length - 1) * 0.99)] : 0, p50 = ex.length ? ex[Math.floor((ex.length - 1) * 0.5)] : 0;
  let ov = 0; for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) ov = Math.max(ov, ovl(c2(B[i]), c2(B[j])));
  return { coverMiss: cov, nSurf: S.length, exMax, p99, p50, outFrac: nOut / nPts, maxOverlap: ov };
}
const c2 = (b) => ({ c: b.mn.map((v, i) => (v + b.mx[i]) / 2), h: b.mn.map((v, i) => (b.mx[i] - v) / 2) });

const report = [];
for (const f of fs.readdirSync(META)) {
  const id = f.replace(/\.json$/, ""); if (!cat[id]) continue;
  const mf = path.join(META, f); const meta = JSON.parse(fs.readFileSync(mf, "utf8"));
  const cs0 = meta.colliders_aabb || meta.colliders;
  if (!EXTRA.includes(id) && !overlapping(cs0, meta.dims_mm) && !meta.collider_decomp) continue;
  const glb = path.join(ROOT, "public/lib", cat[id], id + ".glb"); if (!fs.existsSync(glb)) continue;
  const T = await tris(glb);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of T) for (const p of t) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  // v22：外扩用固定的细参考网格量（不随候选分辨率变粗；否则粗网格把薄板整块算成"实体"，外扩被低估成 0）
  const RREF = +(process.env.RREF || 160), cref = Math.max(...[0, 1, 2].map((i) => hi[i] - lo[i])) / RREF;
  const SREF = (TARGET || REFM) ? samples(T, cref / 2) : null, FREF = SREF ? voxel(SREF, lo, hi, RREF) : null;
  const MET = (S, B, cell, F) => FREF ? metrics(T, S, B, lo, hi, cell, FREF, SREF) : metrics(T, S, B, lo, hi, cell, F);
  let best = null, m = null;
  let cur = null;
  if (TARGET && !EXTRA.includes(id)) { // 先用细参考网格重量现有分解（v21 算法），已经 ≤ TARGET 的不动
    for (const R of RES) { const cell = Math.max(...[0, 1, 2].map((i) => hi[i] - lo[i])) / R; const S = samples(T, cell / 4); const F = voxel(S, lo, hi, 2 * R); const V = coarsen(F); const B = boxes(V, lo, hi); if (B.length <= MAXB) { cur = MET(S, B, V.cell, F); break; } }
    if (cur && cur.exMax * 10 <= TARGET) { report.push({ id, kept: true, exMax_mm: r3(cur.exMax * 10), p50_mm: r3(cur.p50 * 10), after: meta.colliders.length }); console.log(`${id}\t保持 v21：实测最大外扩 ${r3(cur.exMax * 10)} mm ≤ ${TARGET}`); if (!CHECK && meta.collider_decomp) { meta.collider_decomp.exMax_mm = r3(cur.exMax * 10); meta.collider_decomp.p50_mm = r3(cur.p50 * 10); meta.collider_decomp.p99_mm = r3(cur.p99 * 10); meta.collider_decomp.measured = "v22 细参考网格"; fs.writeFileSync(mf, JSON.stringify(meta, null, 1)); } continue; }
  }
  if (TARGET) {
    // v22：大件细分——从粗到细试分辨率，取第一个"实测最大外扩 ≤ TARGET mm"且盒子数 ≤ MAXB2 的；都不行就取实测最小的
    for (const R of RES_FINE) {
      const cell = Math.max(...[0, 1, 2].map((i) => hi[i] - lo[i])) / R;
      const S = samples(T, cell / 4); const F = voxel(S, lo, hi, 2 * R); const V = coarsen(F); const B = boxes(V, lo, hi);
      if (B.length > MAXB2) break;
      const mm = MET(S, B, V.cell, F);
      if (!best || mm.exMax < m.exMax) { best = { R, cell: V.cell, S, B, F }; m = mm; }
      if (mm.exMax * 10 <= TARGET) break;
    }
  } else {
    for (const R of RES) {
      const cell = Math.max(...[0, 1, 2].map((i) => hi[i] - lo[i])) / R;
      const S = samples(T, cell / 4); const F = voxel(S, lo, hi, 2 * R); const V = coarsen(F); const B = boxes(V, lo, hi);
      if (B.length <= MAXB) { best = { R, cell: V.cell, S, B, F }; break; }
    }
    m = MET(best.S, best.B, best.cell, best.F);
  }
  const tol = best.cell * Math.sqrt(3);
  // 存 6 位小数（cm）：只保留 3 位时相邻盒子会因舍入叠进约 0.005 mm，大零件的交叠体积就到几十 mm³
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const cols = best.B.map((b) => { const c = c2(b); return { c: c.c.map(r6), h: c.h.map((v) => r6(Math.max(1e-4, v))) }; });
  const vol = cols.reduce((s, c) => s + 8 * c.h[0] * c.h[1] * c.h[2], 0), bv = [0, 1, 2].reduce((s, i) => s * (hi[i] - lo[i]), 1);
  const rec = { id, before: cs0.length, after: cols.length, res: best.R, cell_mm: r3(best.cell * 10), tol_mm: r3(tol * 10), exMax_mm: r3(m.exMax * 10), p99_mm: r3(m.p99 * 10), p50_mm: r3(m.p50 * 10), outFrac: r3(m.outFrac), coverMiss: m.coverMiss, nSurf: m.nSurf, maxOverlap_mm3: r3(m.maxOverlap * 1000), volRatio: r3(vol / bv),
    mesh_mm: [0, 1, 2].map((i) => r3((hi[i] - lo[i]) * 10)) };
  report.push(rec);
  console.log(`${id}\t${rec.before}→${rec.after} 盒\t体素 ${rec.cell_mm} mm\t外扩 中位 ${rec.p50_mm} p99 ${rec.p99_mm} 最大 ${rec.exMax_mm} / 容差 ${rec.tol_mm} mm\t覆盖缺 ${rec.coverMiss}/${rec.nSurf}\t体积比 ${rec.volRatio}`);
  if (!CHECK) {
    if (!meta.colliders_aabb) meta.colliders_aabb = meta.colliders;
    meta.colliders = cols;
    meta.collider_decomp = { method: "体素化 + 贪心长方体（互不重叠的凸块）", res: best.R, cell_mm: rec.cell_mm, tol_mm: rec.tol_mm, exMax_mm: rec.exMax_mm, p99_mm: rec.p99_mm, p50_mm: rec.p50_mm, n: cols.length, ...(TARGET ? { target_mm: TARGET, v: 22, measured: "v22 细参考网格" } : {}) };
    fs.writeFileSync(mf, JSON.stringify(meta, null, 1));
  }
}
const out = process.env.OUT || "/tmp/v21decomp"; fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "decompose-colliders.json"), JSON.stringify(report, null, 1));
console.log(`共 ${report.length} 个零件重新分解`);
