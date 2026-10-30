// v11：模型模块（一组网格 = 一个模块）、自动拆分、合并、尺寸 / 体积 / 质量估算、碰撞体（方块 / 凸包），
// 以及把模块变成装配台引擎能用的零件定义（单位 cm、g）。
import * as THREE from "three";
import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";
import { UNIT_CM } from "./load.js";

// 材料：密度 g/cm³（常见值；PLA/ABS 按实心算，3D 打印有填充率时会更轻）、摩擦系数（估算）
export const MATERIALS = {
  pla: { zh: "PLA（3D 打印，按实心）", rho: 1.24, mu: 0.5 },
  abs: { zh: "ABS 塑料", rho: 1.05, mu: 0.5 },
  pcb: { zh: "电路板（FR4 + 元件）", rho: 1.85, mu: 0.6 },
  alu: { zh: "铝合金", rho: 2.7, mu: 0.45 },
  steel: { zh: "钢", rho: 7.85, mu: 0.4 },
  copper: { zh: "铜", rho: 8.9, mu: 0.4 },
  rubber: { zh: "橡胶 / 硅胶", rho: 1.2, mu: 1.0 },
  mixed: { zh: "混合（电机、电池等）", rho: 1.6, mu: 0.6 },
};
export const FUNC_KINDS = ["供电", "控制", "通信", "驱动", "传感", "结构", "执行", "连接", "其他"];
export const PALETTE = ["#d23a2f", "#2f6fd6", "#2f8f4e", "#e0b322", "#8a4fbf", "#e07a2b", "#1f9aa6", "#7a4a2a", "#c2477d", "#5b6168"];

let seq = 1;
export const newId = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

// 自动拆分：找最浅的一层“组名”，能分成 ≥2 组就按它分；否则每个网格一个模块；只有一个网格就按连通块拆
export function autoSplit(meshes, { maxModules = 64 } = {}) {
  if (meshes.length > 1) {
    const depthMax = Math.max(...meshes.map((m) => m.path.length));
    for (let d = 0; d <= depthMax; d++) {
      const keyOf = (m) => (m.path.length > d ? m.path.slice(0, d + 1).join("/") : `#${m.id}`);
      const groups = new Map();
      for (const m of meshes) { const k = keyOf(m); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
      if (groups.size >= 2 && groups.size <= maxModules) {
        const named = [...groups.keys()].filter((k) => !k.startsWith("#")).length;
        if (named === 0 && groups.size === meshes.length && d < depthMax) continue;
        return { how: named ? `按第 ${d + 1} 层组名分成 ${groups.size} 个模块` : `每个网格一个模块（${groups.size} 个）`, modules: [...groups.entries()].map(([k, ms], i) => mkModule(k.startsWith("#") ? ms[0].name : k.split("/").pop() || `模块 ${i + 1}`, ms.map((m) => m.id), i)) };
      }
    }
    if (meshes.length <= maxModules) return { how: `每个网格一个模块（${meshes.length} 个）`, modules: meshes.map((m, i) => mkModule(m.name, [m.id], i)) };
    return { how: `网格太多（${meshes.length}），先合成 1 个模块，请手动拆`, modules: [mkModule("整体", meshes.map((m) => m.id), 0)] };
  }
  return { how: "只有 1 个网格", modules: [mkModule(meshes[0].name || "整体", [meshes[0].id], 0)] };
}
export function mkModule(name, meshIds, i = 0) {
  return { id: newId("mod"), name: String(name || `模块 ${i + 1}`).slice(0, 60), color: PALETTE[i % PALETTE.length], meshes: meshIds, collider: "hull", material: "pla", massG: null, hidden: false };
}

// 一个网格按连通块拆成几个网格（STL 常见：一个文件里几个零件）。顶点按位置焊接（1e-5 相对尺寸）
export function splitConnected(mesh, { max = 64 } = {}) {
  const g = mesh.geom;
  const pos = g.attributes.position;
  const n = pos.count;
  const idx = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
  g.computeBoundingBox();
  const sz = g.boundingBox.getSize(new THREE.Vector3()).length() || 1, q = 1e5 / sz;
  const key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * q)},${Math.round(pos.getY(i) * q)},${Math.round(pos.getZ(i) * q)}`;
    let w = key.get(k); if (w === undefined) { w = key.size; key.set(k, w); } weld[i] = w;
  }
  const par = new Int32Array(key.size).map((_, i) => i);
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(weld[idx[t]]), b = find(weld[idx[t + 1]]), c = find(weld[idx[t + 2]]);
    par[b] = a; par[find(c)] = a;
  }
  const comp = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(weld[idx[t]]); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(t); }
  if (comp.size < 2) return [mesh];
  // 太碎（比如几百个小块）就不拆
  if (comp.size > max) return [mesh];
  const parts = [...comp.values()].sort((a, b) => b.length - a.length);
  return parts.map((tris, ci) => {
    const P = new Float32Array(tris.length * 9);
    tris.forEach((t, j) => { for (let k = 0; k < 3; k++) { const v = idx[t + k]; P[j * 9 + k * 3] = pos.getX(v); P[j * 9 + k * 3 + 1] = pos.getY(v); P[j * 9 + k * 3 + 2] = pos.getZ(v); } });
    const ng = new THREE.BufferGeometry(); ng.setAttribute("position", new THREE.BufferAttribute(P, 3)); ng.computeVertexNormals();
    return { ...mesh, id: `${mesh.id}c${ci}`, name: `${mesh.name} · 块 ${ci + 1}`, geom: ng, tris: tris.length };
  });
}

// 模型坐标 → 装配台坐标（cm）：单位 × 缩放，Z 朝上的换成 Y 朝上，底面放在 y = 0、水平居中
export function modelXform(meshes, { units = "mm", scale = 1, upAxis = "y" } = {}) {
  const s = (UNIT_CM[units] || 1) * (scale || 1);
  const rot = new THREE.Matrix4();
  if (upAxis === "z") rot.makeRotationX(-Math.PI / 2);
  const m = new THREE.Matrix4().makeScale(s, s, s).premultiply(rot);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const me of meshes) {
    const p = me.geom.attributes.position;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
  }
  const c = box.getCenter(new THREE.Vector3());
  const off = new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z);
  const M = off.multiply(m);
  const size = box.getSize(new THREE.Vector3());
  return { M, s, sizeCm: size, sizeMm: size.clone().multiplyScalar(10) };
}

// 原始单位下的包围盒（猜单位用）
export function rawSize(meshes) {
  const box = new THREE.Box3();
  for (const m of meshes) { m.geom.computeBoundingBox(); box.union(m.geom.boundingBox); }
  return box.getSize(new THREE.Vector3());
}

// 模块的点（cm，装配台坐标）
function modulePoints(mod, meshById, M) {
  const pts = [];
  for (const id of mod.meshes) {
    const me = meshById.get(id); if (!me) continue;
    const p = me.geom.attributes.position;
    for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(M));
  }
  return pts;
}
// 闭合网格的体积（有向体积和）；检查每条边是不是正好两个三角形共用（=闭合）
function meshVolume(me, M) {
  const g = me.geom, p = g.attributes.position, idx = g.index ? g.index.array : null;
  const n = idx ? idx.length : p.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let vol = 0;
  const box = (g.boundingBox || (g.computeBoundingBox(), g.boundingBox)), q = 1e5 / (box.getSize(a).length() || 1);
  const keyOf = (i) => `${Math.round(p.getX(i) * q)},${Math.round(p.getY(i) * q)},${Math.round(p.getZ(i) * q)}`;
  const edges = new Map();
  for (let t = 0; t < n; t += 3) {
    const i0 = idx ? idx[t] : t, i1 = idx ? idx[t + 1] : t + 1, i2 = idx ? idx[t + 2] : t + 2;
    a.fromBufferAttribute(p, i0).applyMatrix4(M); b.fromBufferAttribute(p, i1).applyMatrix4(M); c.fromBufferAttribute(p, i2).applyMatrix4(M);
    vol += a.dot(b.clone().cross(c)) / 6;
    const k = [keyOf(i0), keyOf(i1), keyOf(i2)];
    for (let e = 0; e < 3; e++) { const ek = k[e] < k[(e + 1) % 3] ? k[e] + "|" + k[(e + 1) % 3] : k[(e + 1) % 3] + "|" + k[e]; edges.set(ek, (edges.get(ek) || 0) + 1); }
    if (edges.size > 400000) return { vol: Math.abs(vol), closed: false };
  }
  let closed = true;
  for (const v of edges.values()) if (v !== 2) { closed = false; break; }
  return { vol: Math.abs(vol), closed };
}

// 每个模块的尺寸、体积、质量、碰撞体（cm / g）
export function analyzeModule(mod, meshById, M, { hullMax = 2048 } = {}) {
  let pts = modulePoints(mod, meshById, M);
  if (!pts.length) return null;
  const box = new THREE.Box3().setFromPoints(pts);
  const c = box.getCenter(new THREE.Vector3()), h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  let hull = null, hullVol = 0;
  if (mod.collider === "hull" && pts.length >= 4) {
    // 点太多就先抽样（凸包会略小于真实外形，见“简化”）——保留包围盒 6 个极值点
    if (pts.length > 60000) { const st = Math.ceil(pts.length / 60000); pts = pts.filter((_, i) => i % st === 0).concat(extremes(pts)); }
    try {
      const ch = new ConvexHull().setFromPoints(pts);
      const vs = new Set();
      for (const f of ch.faces) { let e = f.edge; do { vs.add(e.head().point); e = e.next; } while (e !== f.edge); }
      let hv = [...vs];
      if (hv.length > hullMax) hv = hv.filter((_, i) => i % Math.ceil(hv.length / hullMax) === 0);
      // 凸包体积：从中心分锥体
      for (const f of ch.faces) { let e = f.edge; const p0 = e.head().point; e = e.next; while (e.next !== f.edge) { const p1 = e.head().point, p2 = e.next.head().point; hullVol += Math.abs(p0.clone().sub(c).dot(p1.clone().sub(c).cross(p2.clone().sub(c)))) / 6; e = e.next; } }
      if (hv.length >= 4 && hullVol > 1e-9) hull = new Float32Array(hv.flatMap((p) => [p.x - c.x, p.y - c.y, p.z - c.z]));
    } catch { hull = null; }
  }
  let vol = 0, closed = true;
  for (const id of mod.meshes) { const me = meshById.get(id); if (!me) continue; const r = meshVolume(me, M); vol += r.vol; closed &&= r.closed; }
  const boxVol = 8 * h.x * h.y * h.z;
  const useVol = closed && vol > 0 ? vol : hull ? hullVol : boxVol;
  const mat = MATERIALS[mod.material] || MATERIALS.pla;
  const massEst = useVol * mat.rho;
  return {
    center: c, half: h, sizeMm: h.clone().multiplyScalar(20), hull, hullPts: hull ? hull.length / 3 : 0,
    volCm3: useVol, volHow: closed && vol > 0 ? "闭合网格体积" : hull ? "凸包体积（网格不闭合，偏大）" : "包围盒体积（偏大）",
    massG: mod.massG > 0 ? mod.massG : massEst, massHow: mod.massG > 0 ? "用户填写" : `估算：${useVol.toFixed(2)} cm³ × ${mat.rho} g/cm³`,
    colliderUsed: hull ? "hull" : "box",
  };
}
function extremes(pts) {
  const out = [];
  for (const ax of ["x", "y", "z"]) { let lo = pts[0], hi = pts[0]; for (const p of pts) { if (p[ax] < lo[ax]) lo = p; if (p[ax] > hi[ax]) hi = p; } out.push(lo, hi); }
  return out;
}

// 装配台零件定义：每个模块一个零件，共用同一个原点（模型底面中心）
export function engineDefs(project, meshById, M, key) {
  const defs = [];
  for (const mod of project.modules) {
    if (!mod.meshes.length) continue;
    const a = analyzeModule(mod, meshById, M);
    if (!a) continue;
    const mat = MATERIALS[mod.material] || MATERIALS.pla;
    defs.push({
      id: `up-${key}-${mod.id}`,
      kind: "custom",
      custom: { key, module: mod.id, color: mod.color },
      name_zh: `${mod.name}（上传模型）`,
      cat: "upload",
      density: mat.rho,
      friction: mat.mu,
      colliders: [{ c: a.center.toArray(), h: a.half.toArray(), hull: a.hull || undefined, m: +a.massG.toFixed(3) }],
      dims_mm: { x: a.sizeMm.x, y: a.sizeMm.y, z: a.sizeMm.z },
      anchors: [],
      mass_est: a.massG,
      est: ["质量（" + a.massHow + "）", a.colliderUsed === "hull" ? "碰撞形状：凸包（凹进去的地方被填平）" : "碰撞形状：轴对齐方块"],
      src: "用户上传（只在本机浏览器里）",
    });
  }
  return defs;
}

// 爆炸图偏移（cm）：按功能分组或按模块，从整体中心往外推
export function explodeOffsets(project, centers, mode, amount) {
  const out = new Map();
  if (!amount || mode === "none") return out;
  const all = [...centers.values()];
  if (!all.length) return out;
  const C = all.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / all.length);
  const dirOf = (p, i, n) => {
    const d = p.clone().sub(C); d.y *= 0.5;
    if (d.length() < 1e-3) { const t = (i / Math.max(1, n)) * Math.PI * 2; d.set(Math.cos(t), 0.3, Math.sin(t)); }
    return d.normalize();
  };
  if (mode === "module") {
    const ids = [...centers.keys()];
    ids.forEach((id, i) => out.set(id, dirOf(centers.get(id), i, ids.length).multiplyScalar(amount)));
    return out;
  }
  // 按功能：每个功能组一起移动；同一个模块属于几个功能时跟第一个走；没绑定的留在原位
  const groups = [];
  const taken = new Set();
  for (const f of project.functions) {
    const ms = f.modules.filter((m) => centers.has(m) && !taken.has(m));
    ms.forEach((m) => taken.add(m));
    if (ms.length) groups.push(ms);
  }
  groups.forEach((ms, i) => {
    const g = ms.reduce((s, m) => s.add(centers.get(m).clone()), new THREE.Vector3()).multiplyScalar(1 / ms.length);
    const d = dirOf(g, i, groups.length).multiplyScalar(amount * 1.4);
    for (const m of ms) out.set(m, d.clone());
  });
  return out;
}
