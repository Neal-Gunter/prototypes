// v21：铝型材按长度出变体。截面来自 FreeCAD-library 的真实 STEP（CC BY 3.0），只沿型材长度方向拉伸/缩短，
// 截面几何一点不改；碰撞盒同样只沿长度方向缩放。每个变体写进 manifest（derived_from 指向原件）。
// 用法：node scripts/make-extrusion-variants.mjs   （先跑过 convert-library.mjs 生成原件 GLB 和 meta）
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import { EXT_BASES, EXT_LENGTHS } from "./lib/freecad.mjs";

const LIB = path.resolve("../libsrc");
const MF = path.join(LIB, "manifest.json");
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const r3 = (v) => Math.round(v * 1000) / 1000;
const man = JSON.parse(fs.readFileSync(MF, "utf8"));
let n = 0;
for (const [prof, [base, zh]] of Object.entries(EXT_BASES)) {
  const be = man.find((e) => e.id === base);
  const meta = JSON.parse(fs.readFileSync(path.join(LIB, "meta", base + ".json"), "utf8"));
  const d = meta.dims_mm;
  const ax = ["x", "y", "z"].reduce((a, k) => (d[k] > d[a] ? k : a), "x"); // 最长边 = 型材长度方向
  const ai = { x: 0, y: 1, z: 2 }[ax];
  for (const L of EXT_LENGTHS) {
    const s = L / d[ax];
    const id = `${base}-l${L}`;
    const doc = await io.read(path.join("public/lib", be.cat, base + ".glb"));
    const root = doc.getRoot(); const scene = root.getDefaultScene() || root.listScenes()[0];
    const wrap = doc.createNode("len-scale").setScale(ax === "x" ? [s, 1, 1] : ax === "y" ? [1, s, 1] : [1, 1, s]);
    for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); }
    scene.addChild(wrap);
    await io.write(path.join("public/lib", be.cat, id + ".glb"), doc);
    const m2 = JSON.parse(JSON.stringify(meta));
    m2.id = id; m2.dims_mm[ax] = L; m2.dims_src = `截面：CAD 包围盒（已核实）；长度：按 ${L} mm 切割（只沿长度方向缩放原件 ${d[ax]} mm）`;
    m2.colliders = m2.colliders.map((c) => { const cc = { ...c, c: [...c.c], h: [...c.h] }; cc.c[ai] = r3(cc.c[ai] * s); cc.h[ai] = r3(cc.h[ai] * s); return cc; });
    m2.glb_bytes = fs.statSync(path.join("public/lib", be.cat, id + ".glb")).size;
    for (const k of ["holes", "pinholes", "legs"]) m2[k] = [];
    fs.writeFileSync(path.join(LIB, "meta", id + ".json"), JSON.stringify(m2));
    n++;
  }
}
console.log("variants", n, "（manifest 由 scripts/lib/manifest.mjs 生成）");
