// 批量把免费、许可清晰的 STEP 模型（Adafruit CAD Parts: MIT；KiCad packages3D: CC-BY-SA 4.0 + 设计例外）
// 转成网页用 GLB（真实尺寸：1 单位 = 1 cm），并从几何体里提取真实尺寸、碰撞盒、安装孔、引脚孔、引脚（腿）位置。
// 用法：node scripts/convert-library.mjs <起始序号> <数量>      （清单：../libsrc/manifest.json）
// 输出：public/lib/<分类>/<id>.glb ；元数据 ../libsrc/meta/<id>.json（再由 build-catalog.mjs 合并）
import fs from "node:fs";
import path from "node:path";
import occtimportjs from "occt-import-js";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { weld, dedup, prune, simplify, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const LIB = path.resolve("../libsrc");
const OUT = path.resolve("public/lib");
const META = path.join(LIB, "meta");
fs.mkdirSync(META, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(LIB, "manifest.json"), "utf8"));
const start = +(process.argv[2] || 0), count = +(process.argv[3] || manifest.length);
const MAX_TRIS = 9000;
const MAX_BOXES = 14;

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const occt = await occtimportjs();
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round(v * 100) / 100;

// 颜色 → 材质：按颜色量化合并
function matFor(c) {
  if (!c) c = [0.55, 0.55, 0.57];
  const [r, g, b] = c;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx > 0 ? (mx - mn) / mx : 0;
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  let metal = 0, rough = 0.55;
  if (sat < 0.12 && lum > 0.5) { metal = 0.85; rough = 0.35; } // 金属件（镀锡/镍）
  if (r > 0.6 && r > g && g > b && b < 0.5 && sat > 0.35 && sat < 0.75 && g > 0.45) { metal = 0.9; rough = 0.3; } // 镀金
  const q = (v) => Math.round(v * 12) / 12;
  return { key: `${q(r)}_${q(g)}_${q(b)}_${metal}`, c: [r, g, b], metal, rough };
}

// 简单并查集
function uf(n) { const p = new Int32Array(n); for (let i = 0; i < n; i++) p[i] = i; const f = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }; return { f, u: (a, b) => { a = f(a); b = f(b); if (a !== b) p[a] = b; } }; }

// 把一块三角网格拆成连通分量（按位置焊接顶点），返回每个分量的三角形索引列表
function components(pos, idx) {
  const key = new Map(); const vid = new Int32Array(pos.length / 3);
  for (let i = 0; i < vid.length; i++) {
    const k = `${Math.round(pos[i * 3] * 200)},${Math.round(pos[i * 3 + 1] * 200)},${Math.round(pos[i * 3 + 2] * 200)}`;
    let v = key.get(k); if (v === undefined) { v = key.size; key.set(k, v); } vid[i] = v;
  }
  const U = uf(key.size);
  for (let t = 0; t < idx.length; t += 3) { U.u(vid[idx[t]], vid[idx[t + 1]]); U.u(vid[idx[t]], vid[idx[t + 2]]); }
  const groups = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = U.f(vid[idx[t]]); let g = groups.get(r); if (!g) { g = []; groups.set(r, g); } g.push(t); }
  return [...groups.values()];
}

function boxOfTris(P, idx, tris) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const t of tris) for (let k = 0; k < 3; k++) { const v = idx[t + k] * 3; for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], P[v + a]); mx[a] = Math.max(mx[a], P[v + a]); } }
  return { mn, mx };
}
const vol = (b) => Math.max(0.01, b.mx[0] - b.mn[0]) * Math.max(0.01, b.mx[1] - b.mn[1]) * Math.max(0.01, b.mx[2] - b.mn[2]);
const union = (a, b) => ({ mn: a.mn.map((v, i) => Math.min(v, b.mn[i])), mx: a.mx.map((v, i) => Math.max(v, b.mx[i])) });
const inside = (a, b, e = 0.05) => a.mn.every((v, i) => v >= b.mn[i] - e) && a.mx.every((v, i) => v <= b.mx[i] + e);

// 贪心合并 AABB：每次合并“新增空体积”最小的一对，直到数量 ≤ MAX
function mergeBoxes(boxes, max) {
  boxes = boxes.filter((b) => !boxes.some((o) => o !== b && inside(b, o) && vol(o) > vol(b)));
  while (boxes.length > max) {
    let best = null, bc = Infinity;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const u = union(boxes[i], boxes[j]); const c = vol(u) - vol(boxes[i]) - vol(boxes[j]);
      if (c < bc) { bc = c; best = [i, j, u]; }
    }
    const [i, j, u] = best;
    boxes.splice(j, 1); boxes.splice(i, 1, u);
    boxes = boxes.filter((b) => b === u || !inside(b, u));
  }
  return boxes;
}

// 在薄板（PCB）上找圆孔：竖直侧壁三角形聚类，直径落在范围内且近似圆
function findHoles(P, N, idx, tris, plate) {
  const pts = [];
  for (const t of tris) {
    let nz = 0, cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { const v = idx[t + k] * 3; cx += P[v]; cy += P[v + 1]; cz += P[v + 2]; nz += Math.abs(N ? N[v + 2] : 0); }
    if (nz / 3 > 0.2) continue;
    cx /= 3; cy /= 3; cz /= 3;
    const e = 0.6;
    if (cx < plate.mn[0] + e || cx > plate.mx[0] - e || cy < plate.mn[1] + e || cy > plate.mx[1] - e) continue; // 外轮廓
    pts.push([cx, cy]);
  }
  if (!pts.length) return [];
  // 网格哈希聚类（0.7 mm 连接）
  const U = uf(pts.length), cell = new Map(), h = 0.7;
  pts.forEach((p, i) => { const k = `${Math.floor(p[0] / h)},${Math.floor(p[1] / h)}`; (cell.get(k) || cell.set(k, []).get(k)).push(i); });
  pts.forEach((p, i) => {
    const gx = Math.floor(p[0] / h), gy = Math.floor(p[1] / h);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of cell.get(`${gx + dx},${gy + dy}`) || []) if (j > i && Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]) < h) U.u(i, j);
  });
  const cl = new Map();
  pts.forEach((p, i) => { const r = U.f(i); (cl.get(r) || cl.set(r, []).get(r)).push(p); });
  const holes = [];
  for (const c of cl.values()) {
    if (c.length < 6) continue;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of c) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const w = x1 - x0, hh = y1 - y0;
    if (Math.abs(w - hh) > 0.25 * Math.max(w, hh)) continue;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rs = c.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
    const rm = rs.reduce((a, b) => a + b, 0) / rs.length;
    if (rs.some((r) => Math.abs(r - rm) > 0.18 + rm * 0.12)) continue;
    // 三角形质心在侧壁内侧一点点，直径按外接框近似加回
    const d = (w + hh) / 2 + 0.03;
    if (d < 0.7 || d > 3.8) continue;
    holes.push({ x: cx, y: cy, d });
  }
  return holes;
}

let done = 0;
for (const E of manifest.slice(start, start + count)) {
  const metaPath = path.join(META, E.id + ".json");
  if (fs.existsSync(metaPath)) continue;
  const t0 = Date.now();
  try {
    const bytes = new Uint8Array(fs.readFileSync(path.join(LIB, E.src)));
    const r = occt.ReadStepFile(bytes, { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.003, angularDeflection: 0.45 });
    if (!r.success || !r.meshes.length) throw new Error("STEP 读取失败");
    // 收集所有三角形（STEP 坐标 mm，Z 向上），按颜色分组
    const solids = []; // {P,N,idx,tris:[{t,color}]}
    let gmn = [1e9, 1e9, 1e9], gmx = [-1e9, -1e9, -1e9], triCount = 0;
    for (const m of r.meshes) {
      const P = m.attributes.position.array, N = m.attributes.normal?.array, idx = m.index.array;
      for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { gmn[a] = Math.min(gmn[a], P[i + a]); gmx[a] = Math.max(gmx[a], P[i + a]); }
      const faceColor = new Array(idx.length / 3).fill(m.color || null);
      if (m.brep_faces) for (const f of m.brep_faces) if (f.color) for (let t = f.first; t <= f.last; t++) faceColor[t] = f.color;
      solids.push({ P, N, idx, faceColor, name: m.name || "" });
      triCount += idx.length / 3;
    }
    const sz = gmx.map((v, i) => v - gmn[i]);
    const cx = (gmn[0] + gmx[0]) / 2, cy = (gmn[1] + gmx[1]) / 2, z0 = gmn[2];
    // 输出坐标：x' = (x-cx)/10, y' = (z-z0)/10, z' = -(y-cy)/10  (cm, Y 向上)
    const tx = (x, y, z) => [(x - cx) * 0.1, (z - z0) * 0.1, -(y - cy) * 0.1];

    // 碰撞盒：每个实体（或单网格的连通分量）一个 AABB（STEP 坐标 mm）
    let boxes = [], legs = [], holes = [], plates = [];
    const isKicad = /^(kicad|espressif)\//.test(E.src) || (E.src.startsWith("sparkfun/") && E.cat !== "mcu"); // KiCad 约定：z=0 为 PCB 顶面
    for (const s of solids) {
      let triList = Array.from({ length: s.idx.length / 3 }, (_, i) => i * 3);
      if (isKicad) {
        // KiCad：z=0 为 PCB 顶面；完全在板面以下的三角形属于引脚（腿），按 XY 聚类
        const below = [], above = [];
        for (const t of triList) {
          let zmax = -1e9, zmin = 1e9, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          for (let k = 0; k < 3; k++) { const v = s.idx[t + k] * 3; zmax = Math.max(zmax, s.P[v + 2]); zmin = Math.min(zmin, s.P[v + 2]); x0 = Math.min(x0, s.P[v]); x1 = Math.max(x1, s.P[v]); y0 = Math.min(y0, s.P[v + 1]); y1 = Math.max(y1, s.P[v + 1]); }
          if (zmin < -0.3 && x1 - x0 < 1.6 && y1 - y0 < 1.6) below.push(t);
          if (zmax > 0.05 || !(zmin < -0.3)) above.push(t);
        }
        triList = above;
        const cs = below.map((t) => { let x = 0, y = 0; for (let k = 0; k < 3; k++) { x += s.P[s.idx[t + k] * 3]; y += s.P[s.idx[t + k] * 3 + 1]; } return [x / 3, y / 3, t]; });
        const U = uf(cs.length), cell = new Map(), h = 0.5;
        cs.forEach((p, i) => { const k = `${Math.floor(p[0] / h)},${Math.floor(p[1] / h)}`; (cell.get(k) || cell.set(k, []).get(k)).push(i); });
        cs.forEach((p, i) => { const gx = Math.floor(p[0] / h), gy = Math.floor(p[1] / h); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of cell.get(`${gx + dx},${gy + dy}`) || []) if (j > i && Math.hypot(p[0] - cs[j][0], p[1] - cs[j][1]) < h) U.u(i, j); });
        const cl = new Map(); cs.forEach((p, i) => { const r = U.f(i); (cl.get(r) || cl.set(r, []).get(r)).push(p[2]); });
        for (const tris of cl.values()) {
          const b = boxOfTris(s.P, s.idx, tris); const d = b.mx.map((v, i) => v - b.mn[i]);
          if (d[0] < 1.6 && d[1] < 1.6 && d[2] > 0.8) legs.push({ x: (b.mn[0] + b.mx[0]) / 2, y: (b.mn[1] + b.mx[1]) / 2, bottom: b.mn[2], top: 0, w: Math.max(d[0], d[1]) });
        }
      }
      const keep = new Set(triList);
      const comps = triList.length > 60000 ? [triList] : components(s.P, s.idx).map((c) => (isKicad ? c.filter((t) => keep.has(t)) : c)).filter((c) => c.length);
      for (const tris of comps) {
        const b = boxOfTris(s.P, s.idx, tris);
        const d = b.mx.map((v, i) => v - b.mn[i]);
        if (tris.length < 4) continue;
        if (isKicad) b.mn[2] = Math.max(b.mn[2], -0.1);
        boxes.push(b);
        // 薄板（PCB）：厚 0.6–2.2 mm、面积 > 80 mm²、靠近零件底部
        if (d[2] > 0.5 && d[2] < 2.2 && d[0] * d[1] > 80 && b.mn[2] - gmn[2] < 1.0) plates.push({ s, tris, b });
      }
    }
    for (const pl of plates) for (const h of findHoles(pl.s.P, pl.s.N, pl.s.idx, pl.tris, pl.b)) holes.push({ ...h, z: pl.b.mx[2] });
    // 去重孔
    holes = holes.filter((h, i) => !holes.some((o, j) => j < i && Math.hypot(o.x - h.x, o.y - h.y) < 0.5));
    if (!boxes.length) boxes.push({ mn: gmn, mx: gmx });
    // 去掉体积极小的盒子（< 总体积 0.2%），但保留至少一个
    const tv = vol({ mn: gmn, mx: gmx });
    let big = boxes.filter((b) => vol(b) > tv * 0.002 || (b.mx[2] - b.mn[2]) > sz[2] * 0.5);
    if (!big.length) big = boxes;
    const merged = mergeBoxes(big, MAX_BOXES);
    const colliders = merged.map((b) => {
      const a = tx(b.mn[0], b.mn[1], b.mn[2]), c = tx(b.mx[0], b.mx[1], b.mx[2]);
      return { c: [r3((a[0] + c[0]) / 2), r3((a[1] + c[1]) / 2), r3((a[2] + c[2]) / 2)], h: [r3(Math.max(0.01, Math.abs(c[0] - a[0]) / 2)), r3(Math.max(0.01, Math.abs(c[1] - a[1]) / 2)), r3(Math.max(0.01, Math.abs(c[2] - a[2]) / 2))] };
    });

    // GLB
    const doc = new Document();
    const buf = doc.createBuffer();
    const root = doc.createNode("root");
    doc.createScene(E.id).addChild(root);
    const groups = new Map();
    for (const s of solids) {
      for (let t = 0; t < s.idx.length / 3; t++) {
        const M = matFor(s.faceColor[t]);
        let g = groups.get(M.key); if (!g) { g = { M, items: [] }; groups.set(M.key, g); }
        g.items.push([s, t]);
      }
    }
    for (const g of groups.values()) {
      const n = g.items.length;
      const pos = new Float32Array(n * 9), nor = new Float32Array(n * 9);
      let o = 0;
      for (const [s, t] of g.items) for (let k = 0; k < 3; k++) {
        const v = s.idx[t * 3 + k] * 3;
        pos.set(tx(s.P[v], s.P[v + 1], s.P[v + 2]), o);
        if (s.N) nor.set([s.N[v], s.N[v + 2], -s.N[v + 1]], o); else nor.set([0, 1, 0], o);
        o += 3;
      }
      const idx = new Uint32Array(n * 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
      const mat = doc.createMaterial(g.M.key).setBaseColorFactor([...g.M.c.map((c) => Math.min(1, c)), 1]).setMetallicFactor(g.M.metal).setRoughnessFactor(g.M.rough);
      const prim = doc.createPrimitive()
        .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buf))
        .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nor).setBuffer(buf))
        .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buf)).setMaterial(mat);
      root.addChild(doc.createNode(g.M.key).setMesh(doc.createMesh(g.M.key).addPrimitive(prim)));
    }
    doc.createExtension(KHRMeshQuantization);
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const ratio = Math.min(1, MAX_TRIS / triCount);
    await doc.transform(
      dedup(),
      weld({ tolerance: 0.0001 }),
      simplify({ simplifier: MeshoptSimplifier, ratio, error: ratio < 0.3 ? 0.004 : 0.002, lockBorder: false }),
      prune(),
    );
    const countTris = () => { let n = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) n += (p.getIndices()?.getCount() || 0) / 3; return n; };
    let outTris = countTris();
    // 误差上限挡住了简化时，逐步放宽（仍以 CAD 尺寸为准，包围盒不变）
    for (const err of [0.01, 0.025]) {
      if (outTris <= MAX_TRIS * 1.4) break;
      await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, MAX_TRIS / outTris), error: err, lockBorder: false }), prune());
      outTris = countTris();
    }
    await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 8 }), meshopt({ encoder: MeshoptEncoder }));
    const dir = path.join(OUT, E.cat); fs.mkdirSync(dir, { recursive: true });
    const glb = path.join(dir, E.id + ".glb");
    await io.write(glb, doc);
    const size = fs.statSync(glb).size;

    // 局部坐标（mm，Y 向上；与 GLB 一致 ×10）
    const L = (x, y, z) => tx(x, y, z).map((v) => r2(v * 10));
    const meta = {
      id: E.id,
      dims_mm: { x: r2(sz[0]), y: r2(sz[2]), z: r2(sz[1]) }, // 宽（x）× 高（y）× 深（z）；来自 CAD 包围盒
      dims_src: "CAD 包围盒（已核实）",
      tris_src: triCount, tris: outTris, glb_bytes: size,
      colliders,
      legs: legs.length && legs.length <= 64 ? legs.map((l) => ({ p: L(l.x, l.y, l.bottom), top_y: r2((l.top - z0)), w: r2(l.w) })) : [],
      pcb_top_y: isKicad ? r2(-z0) : null, // KiCad：PCB 顶面在本地 y（mm）
      holes: holes.filter((h) => h.d >= 1.9).slice(0, 12).map((h) => ({ p: L(h.x, h.y, h.z), d: r2(h.d) })),
      pinholes: holes.filter((h) => h.d < 1.9 && h.d >= 0.75).slice(0, 96).map((h) => ({ p: L(h.x, h.y, h.z), d: r2(h.d) })),
      kicad_origin: isKicad ? L(0, 0, 0) : null,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta));
    done++;
    console.log(`${E.id}\t${triCount}->${outTris}\t${(size / 1024).toFixed(0)}KB\tbox${colliders.length}\tlegs${meta.legs.length}\tholes${meta.holes.length}/${meta.pinholes.length}\t${Date.now() - t0}ms`);
  } catch (e) {
    fs.writeFileSync(metaPath, JSON.stringify({ id: E.id, error: String(e.message || e) }));
    console.log(`${E.id}\tERROR ${e.message}`);
  }
}
console.log("CHUNK_DONE", start, done);
