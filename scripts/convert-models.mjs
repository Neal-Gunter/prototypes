// 把 Adafruit CAD Parts（MIT）的 STEP 模型转成网页用的 GLB。
// 用法：node scripts/convert-models.mjs <STEP 源目录>
// 依赖（devDependencies，全部免费开源）：occt-import-js（OpenCascade WASM）、@gltf-transform/*、meshoptimizer。
// 坐标：STEP 是 Z 向上、毫米；输出 Y 向上、厘米（1 = 1 cm），并按 CENTER 居中、底面在 y=0。
import fs from "node:fs";
import path from "node:path";
import occtimportjs from "occt-import-js";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { weld, dedup, prune, simplify, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const SRC = process.argv[2] || "../modelsrc";
const OUT = "public/models";

// 简单的 PBR 材质表
const MAT = {
  mask: { c: [0.035, 0.035, 0.04], m: 0, r: 0.42 }, // 开发板阻焊层（贴图在页面里叠加）
  modulePcb: { c: [0.05, 0.05, 0.055], m: 0, r: 0.45 },
  shield: { c: [0.78, 0.79, 0.8], m: 1, r: 0.32 },
  gold: { c: [0.95, 0.74, 0.36], m: 1, r: 0.25 },
  silver: { c: [0.82, 0.82, 0.84], m: 1, r: 0.22 },
  black: { c: [0.03, 0.03, 0.03], m: 0, r: 0.55 },
  plasticDark: { c: [0.06, 0.06, 0.065], m: 0, r: 0.6 },
  ceramic: { c: [0.62, 0.5, 0.33], m: 0, r: 0.5 },
  resistor: { c: [0.04, 0.04, 0.04], m: 0, r: 0.5 },
  ledGreen: { c: [0.55, 0.95, 0.6], m: 0, r: 0.15 },
  white: { c: [0.92, 0.92, 0.9], m: 0, r: 0.4 },
  servoBody: { c: [0.035, 0.04, 0.05], m: 0, r: 0.35 },
  brass: { c: [0.85, 0.66, 0.32], m: 1, r: 0.3 },
  batPlastic: { c: [0.03, 0.03, 0.03], m: 0, r: 0.62 },
};

function bbox(m) {
  const p = m.attributes.position.array;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[i + k]); mx[k] = Math.max(mx[k], p[i + k]); }
  return { mn, mx, sz: mx.map((v, k) => v - mn[k]) };
}

const MODELS = [
  {
    file: "feather_s3.step",
    out: "feather_esp32s3.glb",
    center: [25.4, 11.43, 0], // 板子中心（不含 USB‑C 突出部分）
    uvMesh: (m, i) => i === 0, // Board：生成俯视平面 UV，页面里叠加丝印/焊盘贴图
    uvRect: [0, 0, 50.8, 22.86],
    material(m, i, b) {
      const n = m.name || "";
      if (i === 0) return "mask";
      if (/^0603|^0805/.test(n)) return i % 3 === 0 ? "resistor" : "ceramic";
      if (/SOT|SOD|RESPACK/.test(n)) return "black";
      if (/USB_C/.test(n)) return "silver";
      if (/BTN/.test(n)) return "silver";
      if (i === 44) return "modulePcb";
      if (i === 45) return "shield";
      if (i === 46) return "black";
      if (i === 132) return "modulePcb";
      if (i >= 47 && i <= 66) return "gold";
      if (i === 14 || i === 158) return "plasticDark";
      if (i === 20 || i === 25) return "ledGreen";
      if (i >= 141 && i <= 150) return "black";
      if (i === 165 || i === 166) return "white";
      if (b.sz[2] < 0.25 && b.sz[0] < 0.6 && b.sz[1] < 0.6) return "silver";
      return "silver";
    },
  },
  {
    file: "servo.step",
    out: "micro_servo.glb",
    center: [0, 5.3, -18.8],
    material(m, i) {
      if (i === 5) return "brass";
      if (i === 4) return "servoBody";
      return "servoBody";
    },
  },
  {
    file: "bat4aa.step",
    out: "battery_4xaa.glb",
    center: [32.3, 35, 0],
    material: () => "batPlastic",
  },
];

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const occt = await occtimportjs();
fs.mkdirSync(OUT, { recursive: true });

for (const M of MODELS) {
  const r = occt.ReadStepFile(new Uint8Array(fs.readFileSync(path.join(SRC, M.file))), {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: 0.0015,
    angularDeflection: 0.35,
  });
  if (!r.success) throw new Error("读取失败 " + M.file);
  const doc = new Document();
  const buf = doc.createBuffer();
  const scene = doc.createScene(M.out);
  const root = doc.createNode("root");
  scene.addChild(root);
  const mats = {};
  const getMat = (k) => {
    if (!mats[k]) {
      const d = MAT[k];
      mats[k] = doc.createMaterial(k).setBaseColorFactor([...d.c, 1]).setMetallicFactor(d.m).setRoughnessFactor(d.r);
    }
    return mats[k];
  };
  // 同材质合并成一个 primitive，减少 draw call
  const groups = {};
  r.meshes.forEach((m, i) => {
    const b = bbox(m);
    const key = M.material(m, i, b);
    const isUv = M.uvMesh?.(m, i);
    const gk = isUv ? key + ":uv" : key;
    (groups[gk] ||= { key, isUv, parts: [] }).parts.push(m);
  });
  const [cx, cy, cz] = M.center;
  for (const [gk, g] of Object.entries(groups)) {
    let nv = 0, ni = 0;
    for (const m of g.parts) { nv += m.attributes.position.array.length / 3; ni += m.index.array.length; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    const uv = g.isUv ? new Float32Array(nv * 2) : null;
    let vo = 0, io = 0;
    for (const m of g.parts) {
      const p = m.attributes.position.array, n = m.attributes.normal?.array, ix = m.index.array;
      const cnt = p.length / 3;
      for (let i = 0; i < cnt; i++) {
        const x = p[i * 3] - cx, y = p[i * 3 + 1] - cy, z = p[i * 3 + 2] - cz;
        pos.set([x * 0.1, z * 0.1, -y * 0.1], (vo + i) * 3);
        if (n) nor.set([n[i * 3], n[i * 3 + 2], -n[i * 3 + 1]], (vo + i) * 3);
        if (uv) {
          const [ux, uy, uw, uh] = M.uvRect;
          uv.set([(p[i * 3] - ux) / uw, 1 - (p[i * 3 + 1] - uy) / uh], (vo + i) * 2);
        }
      }
      for (let k = 0; k < ix.length; k++) idx[io + k] = ix[k] + vo;
      vo += cnt;
      io += ix.length;
    }
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buf))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nor).setBuffer(buf))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buf))
      .setMaterial(getMat(g.key));
    if (uv) prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(uv).setBuffer(buf));
    const mesh = doc.createMesh(gk).addPrimitive(prim);
    root.addChild(doc.createNode(gk.replace(":uv", "_uv")).setMesh(mesh));
  }
  doc.createExtension(KHRMeshQuantization);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(
    dedup(),
    weld({ tolerance: 0.0001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.6, error: 0.0005 }),
    prune(),
    quantize({ quantizePosition: 14, quantizeNormal: 10 }),
    meshopt({ encoder: MeshoptEncoder }),
  );
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  await io.write(path.join(OUT, M.out), doc);
  console.log(M.out, (fs.statSync(path.join(OUT, M.out)).size / 1024).toFixed(1), "KB", Object.keys(groups).join(","));
}
