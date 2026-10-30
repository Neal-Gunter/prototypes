// v23：把体素长方体碰撞体换成凸包（只在“更贴合”或“个数更少”时换）。早期原型，简化仿真。（我的补充）
//   ① 每个长方体 → 包住“盒内的网格表面采样点 + 盒面上落在实体里的点”的凸包（凸包 ⊆ 长方体，所以只会更贴、不会更鼓）
//   ② 相邻凸包贪心合并：合并后的凸包实测最大外扩 ≤ 上限（默认 = min(原长方体实测最大外扩, 3 mm)）才合并
//   ③ 覆盖：网格顶点全部在凸包里（容差 0.01 mm）；外扩：凸包内均匀取点，不在细参考网格实体里的点量到最近表面点的距离
//   用法：node scripts/hull-colliders.mjs [--check]；然后 node scripts/build-catalog.mjs。原来的长方体保存在 meta.colliders_boxes，可回退
import fs from "node:fs"; import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { Vector3 } from "three";
import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";
await MeshoptDecoder.ready;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const META = path.resolve(ROOT, "../libsrc/meta");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const CHECK = process.argv.includes("--check");
const IDS = (process.env.IDS || "").split(",").filter(Boolean);
const CAP = +(process.env.CAP || 3);          // mm：合并上限的绝对封顶
const MAXV = +(process.env.MAXV || 96);       // 每个凸包最多顶点数（多了就不合并）
const RREF = +(process.env.RREF || 160);
const r3 = (v) => Math.round(v * 1000) / 1000, r6 = (v) => Math.round(v * 1e6) / 1e6;
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "public/lib/index.json"), "utf8"));
const cat = {}; for (const p of idx.parts) cat[p[0]] = p[3];

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
  const ext = new Uint8Array(surf.length); const st = [0]; ext[0] = 1;
  while (st.length) { const k = st.pop(); const x = k % N[0], y = ((k / N[0]) | 0) % N[1], z = (k / (N[0] * N[1])) | 0;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const a = x + dx, b = y + dy, c = z + dz; if (a < 0 || b < 0 || c < 0 || a >= N[0] || b >= N[1] || c >= N[2]) continue; const j = id(a, b, c); if (!ext[j] && !surf[j]) { ext[j] = 1; st.push(j); } } }
  const solidP = (p) => { const q = [0, 1, 2].map((i) => Math.floor((p[i] - lo[i]) / cell)); if (q.some((v, i) => v < 0 || v >= n[i])) return false; return !ext[id(q[0] + 1, q[1] + 1, q[2] + 1)]; };
  return { cell, n, solidP };
}
// 凸包：顶点 + 面（法线 n、常数 k：n·p − k ≤ 0 在里面）
let _seed = 1; const rnd = () => ((_seed = (_seed * 16807) % 2147483647) / 2147483647 - 0.5);
function hullOf(pts0) {
  // 去重（同一条边上的采样点重复很多）+ 1e-6 cm 的确定性抖动（three 的 ConvexHull 遇到大量共面点会算错）；算完逐点验证，不对就返回 null（退回长方体）
  const seen = new Set(), pts = [];
  for (const p of pts0) { const k = `${Math.round(p[0] * 2e4)},${Math.round(p[1] * 2e4)},${Math.round(p[2] * 2e4)}`; if (!seen.has(k)) { seen.add(k); pts.push(p); } }
  if (pts.length < 4) return null;
  const H = new ConvexHull().setFromPoints(pts.map((p) => new Vector3(p[0] + rnd() * 2e-6, p[1] + rnd() * 2e-6, p[2] + rnd() * 2e-6)));
  if (!H.faces.length) return null;
  const vs = new Map(), F = [];
  for (const f of H.faces) { F.push([f.normal.x, f.normal.y, f.normal.z, f.constant]); let e = f.edge; do { const q = e.head().point; vs.set(`${q.x},${q.y},${q.z}`, [q.x, q.y, q.z]); e = e.next; } while (e !== f.edge); }
  const V = [...vs.values()]; const lo = [0, 1, 2].map((i) => Math.min(...V.map((v) => v[i]))), hi = [0, 1, 2].map((i) => Math.max(...V.map((v) => v[i])));
  let vol = 0; for (const f of H.faces) { let e = f.edge; const a = e.head().point; e = e.next; while (e.next !== f.edge) { const b = e.head().point, c = e.next.head().point; vol += a.dot(new Vector3().crossVectors(b, c)) / 6; e = e.next; } }
  const R = { V, F, lo, hi, vol: Math.abs(vol) };
  for (const p of pts) if (outDist(R, p) > 5e-4) return null;
  return R;
}
const inHull = (h, p, eps = 0) => h.F.every(([a, b, c, k]) => a * p[0] + b * p[1] + c * p[2] - k <= eps);
const outDist = (h, p) => Math.max(0, ...h.F.map(([a, b, c, k]) => a * p[0] + b * p[1] + c * p[2] - k));
const boxHull = (b) => { const P = []; for (let i = 0; i < 8; i++) P.push([0, 1, 2].map((k) => (i >> k) & 1 ? b.c[k] + b.h[k] : b.c[k] - b.h[k])); return hullOf(P); };

const only = new Set(IDS); const report = [];
for (const f of fs.readdirSync(META)) {
  const id = f.replace(/\.json$/, ""); if (!cat[id]) continue; if (only.size && !only.has(id)) continue;
  const mf = path.join(META, f); const meta = JSON.parse(fs.readFileSync(mf, "utf8"));
  if (!meta.collider_decomp) continue;
  const B = meta.colliders_boxes || meta.colliders; if (B.some((c) => c.hull)) continue;
  const glb = path.join(ROOT, "public/lib", cat[id], id + ".glb"); if (!fs.existsSync(glb)) continue;
  const t0 = Date.now();
  const T = await tris(glb);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of T) for (const p of t) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  const cref = Math.max(...[0, 1, 2].map((i) => hi[i] - lo[i])) / RREF;
  const S = samples(T, cref / 2), FR = voxel(S, lo, hi, RREF);
  const g = cref * 2, grid = new Map(), key = (c) => c.join(",");
  for (const p of S) { const kk = key(p.map((v) => Math.floor(v / g))); (grid.get(kk) || grid.set(kk, []).get(kk)).push(p); }
  const near = (p) => { let d = Infinity; const c = p.map((v) => Math.floor(v / g)); for (let r = 1; r <= 12 && d > (r - 1) * g; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let e = -r; e <= r; e++) { if (Math.max(Math.abs(a), Math.abs(b), Math.abs(e)) !== r && r > 1) continue; for (const q of grid.get(`${c[0] + a},${c[1] + b},${c[2] + e}`) || []) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); } return d; };
  // 外扩（cm）：凸包包围盒里 m³ 网格点，落在凸包内、不在实体里的，量到表面
  // v23：外扩用固定的全局网格点量（间距 1.5 × 参考体素）：前后同一批点，凸包 ⊆ 长方体时结果只会变小，没有采样噪声
  const gs = cref * 1.5, GN = [0, 1, 2].map((i) => Math.max(1, Math.ceil((hi[i] - lo[i]) / gs))); const memo = new Float32Array(GN[0] * GN[1] * GN[2]).fill(-1);
  // 距离场：每个网格点“最近的表面采样点”用向量传播（正反两遍扫描 × 2）算，几秒内算完整件（误差远小于一个格子）
  const NS = new Int32Array(GN[0] * GN[1] * GN[2]).fill(-1); const ND = new Float32Array(NS.length).fill(Infinity);
  const cen = (x, y, z) => [lo[0] + (x + 0.5) * gs, lo[1] + (y + 0.5) * gs, lo[2] + (z + 0.5) * gs];
  const dd = (k, si, x, y, z) => { const q = S[si]; return Math.hypot(lo[0] + (x + 0.5) * gs - q[0], lo[1] + (y + 0.5) * gs - q[1], lo[2] + (z + 0.5) * gs - q[2]); };
  S.forEach((q, si) => { const x = Math.min(GN[0] - 1, Math.max(0, Math.floor((q[0] - lo[0]) / gs))), y = Math.min(GN[1] - 1, Math.max(0, Math.floor((q[1] - lo[1]) / gs))), z = Math.min(GN[2] - 1, Math.max(0, Math.floor((q[2] - lo[2]) / gs))); const k = (z * GN[1] + y) * GN[0] + x; const d = dd(k, si, x, y, z); if (d < ND[k]) { ND[k] = d; NS[k] = si; } });
  for (let pass = 0; pass < 4; pass++) {
    const fw = pass % 2 === 0;
    for (let zi = 0; zi < GN[2]; zi++) for (let yi = 0; yi < GN[1]; yi++) for (let xi = 0; xi < GN[0]; xi++) {
      const x = fw ? xi : GN[0] - 1 - xi, y = fw ? yi : GN[1] - 1 - yi, z = fw ? zi : GN[2] - 1 - zi; const k = (z * GN[1] + y) * GN[0] + x;
      for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const X = x + a, Y = y + b, Z = z + c; if (X < 0 || Y < 0 || Z < 0 || X >= GN[0] || Y >= GN[1] || Z >= GN[2]) continue; const si = NS[(Z * GN[1] + Y) * GN[0] + X]; if (si < 0 || si === NS[k]) continue; const d = dd(k, si, x, y, z); if (d < ND[k]) { ND[k] = d; NS[k] = si; } }
    }
  }
  const gd = (x, y, z) => { const k = (z * GN[1] + y) * GN[0] + x; if (memo[k] < 0) memo[k] = FR.solidP(cen(x, y, z)) ? 0 : ND[k]; return memo[k]; };
  const exOf = (h) => { let mx = 0; const ex = []; const a = [0, 1, 2].map((i) => Math.max(0, Math.ceil((h.lo[i] - lo[i]) / gs - 0.5))), b = [0, 1, 2].map((i) => Math.min(GN[i] - 1, Math.floor((h.hi[i] - lo[i]) / gs - 0.5)));
    for (let z = a[2]; z <= b[2]; z++) for (let y = a[1]; y <= b[1]; y++) for (let x = a[0]; x <= b[0]; x++) { const p = [lo[0] + (x + 0.5) * gs, lo[1] + (y + 0.5) * gs, lo[2] + (z + 0.5) * gs]; if (!inHull(h, p, 1e-7)) continue; const d = gd(x, y, z); ex.push(d); if (d > mx) mx = d; }
    return { mx, ex }; };
  const exOld = (h, m = 8) => { let mx = 0; const ex = []; for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) for (let l = 0; l < m; l++) { const p = [0, 1, 2].map((k, kk) => h.lo[k] + (h.hi[k] - h.lo[k]) * ([i, j, l][kk] + 0.5) / m); if (!inHull(h, p, -1e-6)) continue; if (FR.solidP(p)) { ex.push(0); continue; } const d = near(p); ex.push(d); mx = Math.max(mx, d); } return { mx, ex }; };
  // 长方体本身（同一把尺子重量，作为“之前”）
  const bx = B.map(boxHull); const bxEx = bx.map((h) => exOf(h)); const boxMax = Math.max(...bxEx.map((e) => e.mx)); const boxAll = bxEx.flatMap((e) => e.ex).filter((v) => v > 0).sort((a, b) => a - b);
  // ① 每个长方体 → 收紧的凸包
  const inBox = (b, p, e = 1e-5) => [0, 1, 2].every((k) => Math.abs(p[k] - b.c[k]) <= b.h[k] + e);
  const ptsOf = B.map(() => []);
  const dB = (b, p) => Math.hypot(...[0, 1, 2].map((k) => Math.max(0, Math.abs(p[k] - b.c[k]) - b.h[k])));
  for (const p of S) { let bi = -1, bd = Infinity; for (let i = 0; i < B.length; i++) { const d = dB(B[i], p); if (d < bd) { bd = d; bi = i; } if (d === 0) break; } if (bd < 2e-3) ptsOf[bi].push(bd > 0 ? p.map((v, k) => Math.min(B[bi].c[k] + B[bi].h[k], Math.max(B[bi].c[k] - B[bi].h[k], v))) : p); }
  // 网格顶点（覆盖检查的对象）也直接放进去：离盒子 ≤ 0.02 mm 的顶点原样加入（凸包可以比盒子多出这一点点）
  for (const t of T) for (const p of t) { let bi = -1, bd = Infinity; for (let i = 0; i < B.length; i++) { const d = dB(B[i], p); if (d < bd) { bd = d; bi = i; } if (d === 0) break; } if (bd > 0 && bd < 2e-3) ptsOf[bi].push(p); }
  B.forEach((b, i) => { const m = 8; for (let k = 0; k < 3; k++) for (const s of [-1, 1]) for (let u = 0; u <= m; u++) for (let v = 0; v <= m; v++) { const p = [0, 0, 0]; const a = (k + 1) % 3, c = (k + 2) % 3; p[k] = b.c[k] + s * b.h[k]; p[a] = b.c[a] - b.h[a] + 2 * b.h[a] * u / m; p[c] = b.c[c] - b.h[c] + 2 * b.h[c] * v / m; if (FR.solidP(p)) ptsOf[i].push(p); } });
  const LIM = Math.min(CAP / 10, boxMax * (+process.env.LIMF || 0.97));
  // ①b 收紧后仍超上限的块：沿最长边对半切（最多切 SPLIT 层），每半再收紧——切开的块之后还能在 ② 里合回去
  const SPLIT = +(process.env.SPLIT ?? 3);
  const tight = (b, P, depth) => {
    const h = hullOf(P); const use = h && h.vol > 1e-9 && h.V.length <= MAXV ? h : boxHull(b); const e = exOf(use).mx;
    if (process.env.DEBUG) { const bad = P.filter((p) => outDist(use, p) > 1e-3); if (bad.length) console.log("tight miss", depth, P.length, bad.length, use === h, h?.V.length, JSON.stringify(bad[0]), JSON.stringify(b)); }
    if (e <= LIM || depth >= SPLIT || P.length < 8) return [{ h: use, b, ex: e }];
    const ax = [0, 1, 2].sort((x, y) => b.h[y] - b.h[x])[0];
    const out = [];
    for (const sg of [-1, 1]) {
      const c = [...b.c], hh = [...b.h]; hh[ax] /= 2; c[ax] += sg * hh[ax]; const nb = { c, h: hh };
      const Q = P.filter((p) => sg < 0 ? p[ax] <= b.c[ax] + 1e-9 : p[ax] >= b.c[ax] - 1e-9);
      const m = 8, a1 = (ax + 1) % 3, a2 = (ax + 2) % 3; // 切面上落在实体里的点也进两半
      for (let u = 0; u <= m; u++) for (let v = 0; v <= m; v++) { const p = [0, 0, 0]; p[ax] = b.c[ax]; p[a1] = b.c[a1] - b.h[a1] + 2 * b.h[a1] * u / m; p[a2] = b.c[a2] - b.h[a2] + 2 * b.h[a2] * v / m; if (FR.solidP(p)) Q.push(p); }
      out.push(...tight(nb, Q, depth + 1));
    }
    return out;
  };
  const pieces = []; B.forEach((b, i) => { for (const t of tight(b, ptsOf[i], 0)) pieces.push({ ...t, src: i }); });
  if (process.env.DEBUG) { let m0 = 0, m1 = 0; for (const t of T) for (const p of t) { if (!pieces.some((q) => outDist(q.h, p) <= 1e-3)) m0++; if (!B.some((b) => dB(b, p) <= 1e-3)) m1++; } console.log("debug pieces miss", m0, "box miss", m1, pieces.length, pieces.map((q) => q.h.V.length).join(",")); }
  let C = pieces.map((q, i) => ({ h: q.h, boxes: [i], alive: true, ex: q.ex }));
  const PB = pieces.map((q) => q.b);
  // ② 相邻合并
  const touch = (a, b) => [0, 1, 2].every((k) => Math.abs(a.c[k] - b.c[k]) <= a.h[k] + b.h[k] + 2e-4);
  const nb = C.map(() => new Set()); for (let i = 0; i < PB.length; i++) for (let j = i + 1; j < PB.length; j++) if (touch(PB[i], PB[j])) { nb[i].add(j); nb[j].add(i); }
  const cand = []; const tryPair = (i, j) => { const h = hullOf([...C[i].h.V, ...C[j].h.V]); if (!h || h.V.length > MAXV) return; const e = exOf(h).mx; if (e <= LIM) cand.push({ i, j, h, e, cost: h.vol - C[i].h.vol - C[j].h.vol }); };
  for (let i = 0; i < C.length; i++) for (const j of nb[i]) if (j > i) tryPair(i, j);
  let evals = cand.length;
  while (cand.length) {
    cand.sort((a, b) => a.e - b.e || a.cost - b.cost); const k = cand.shift();
    if (!C[k.i].alive || !C[k.j].alive) continue;
    C[k.j].alive = false; C[k.i] = { h: k.h, boxes: [...C[k.i].boxes, ...C[k.j].boxes], alive: true, ex: k.e };
    for (const x of nb[k.j]) if (x !== k.i) { nb[k.i].add(x); nb[x].delete(k.j); nb[x].add(k.i); } nb[k.i].delete(k.j);
    for (let q = cand.length - 1; q >= 0; q--) if (cand[q].i === k.i || cand[q].j === k.i || cand[q].i === k.j || cand[q].j === k.j) cand.splice(q, 1);
    for (const x of nb[k.i]) if (C[x].alive) { tryPair(Math.min(k.i, x), Math.max(k.i, x)); evals++; }
  }
  const H = C.filter((c) => c.alive);
  // ③ 覆盖 + 外扩（整件）
  let miss = 0, worst = 0; for (const t of T) for (const p of t) { let d = Infinity; for (const c of H) { d = Math.min(d, outDist(c.h, p)); if (d <= 1e-3) break; } if (d > 1e-3) { miss++; worst = Math.max(worst, d); } }
  const hx = H.map((c) => exOf(c.h)); const hullMax = Math.max(...hx.map((e) => e.mx)); const hullAll = hx.flatMap((e) => e.ex).filter((v) => v > 0).sort((a, b) => a - b);
  const med = (a) => a.length ? a[a.length >> 1] : 0;
  const nHull = H.filter((c) => c.h.V.length !== 8 || c.boxes.length > 1).length;
  const better = miss === 0 && (H.length < B.length && hullMax <= boxMax + 1e-4 || hullMax < boxMax - 0.01 && H.length <= Math.max(B.length, +(process.env.MAXH || 300)));
  const rec = { id, boxes: B.length, hulls: H.length, convex: nHull, box_exMax_mm: r3(boxMax * 10), box_p50_mm: r3(med(boxAll) * 10), hull_exMax_mm: r3(hullMax * 10), hull_p50_mm: r3(med(hullAll) * 10), maxVerts: Math.max(...H.map((c) => c.h.V.length)), coverMiss: miss, coverWorst_mm: r3(worst * 10), pieces: pieces.length, evals, adopted: better && !CHECK, sec: (Date.now() - t0) / 1000 };
  report.push(rec);
  console.log(`${id}\t盒 ${rec.boxes} → 凸包 ${rec.hulls}\t外扩 最大 ${rec.box_exMax_mm} → ${rec.hull_exMax_mm} mm · 中位 ${rec.box_p50_mm} → ${rec.hull_p50_mm} mm\t顶点≤${rec.maxVerts}\t覆盖缺 ${miss}\t${better ? "采用" : "不换"}\t${rec.sec}s`);
  if (!CHECK && better) {
    if (!meta.colliders_boxes) meta.colliders_boxes = meta.colliders;
    meta.colliders = H.map((c) => { const cc = c.h.lo.map((v, k) => (v + c.h.hi[k]) / 2); return { c: cc.map(r6), h: cc.map((v, k) => r6(Math.max(1e-4, c.h.hi[k] - v))), hull: c.h.V.flatMap((p) => p.map((v, k) => r6(v - cc[k]))) }; });
    Object.assign(meta.collider_decomp, { hull: { v: 23, method: "长方体收紧成凸包 + 相邻贪心合并", boxes: B.length, n: H.length, exMax_mm: rec.hull_exMax_mm, p50_mm: rec.hull_p50_mm, box_exMax_mm: rec.box_exMax_mm, box_p50_mm: rec.box_p50_mm, maxVerts: rec.maxVerts, lim_mm: r3(LIM * 10) }, n: H.length, exMax_mm: rec.hull_exMax_mm, p50_mm: rec.hull_p50_mm });
    fs.writeFileSync(mf, JSON.stringify(meta, null, 1));
  }
}
const out = process.env.OUT || "/tmp/v23hull"; fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "hull-colliders.json"), JSON.stringify(report, null, 1));
console.log(`共 ${report.length} 个零件；采用凸包 ${report.filter((r) => r.adopted).length} 个`);
