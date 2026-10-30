// v11：上传模型的几何体登记表（装配台渲染 kind: "custom" 的零件时按 key + 模块取几何体）
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
const REG = new Map();
// meshes：已经变换到装配台坐标（cm）的网格；modules：[{id, meshes, color}]
export function registerModel(key, meshes, modules, M) {
  const byId = new Map(meshes.map((m) => [m.id, m]));
  const mods = new Map();
  for (const mod of modules) {
    const gs = mod.meshes.map((id) => byId.get(id)).filter(Boolean).map((m) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", m.geom.attributes.position.clone()); if (m.geom.index) g.setIndex(m.geom.index.clone()); return g.applyMatrix4(M); });
    if (!gs.length) continue;
    const merged = gs.length === 1 ? gs[0] : mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    merged.computeVertexNormals();
    mods.set(mod.id, { geom: merged, color: mod.color });
  }
  REG.set(key, mods);
}
export const getModuleGeom = (key, modId) => REG.get(key)?.get(modId) || null;
export const hasModel = (key) => REG.has(key);
