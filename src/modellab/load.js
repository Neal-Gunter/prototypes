// v11：在浏览器本地解析上传的 3D 模型（glTF/GLB、OBJ、STL、STEP）。不联网：外部资源（.bin / 贴图 URL）一律不去取。
import * as THREE from "three";
import { LIMITS, MODEL_EXT, UserError, extOf, mb } from "./limits.js";

// 解析结果：{ format, meshes:[{id, name, path:[...组名], geom(已烘焙到模型坐标), color}], warnings, srcUnitsHint }
export async function parseModel(bytes, fileName) {
  const ext = MODEL_EXT[extOf(fileName)];
  if (!ext) throw new UserError(`不支持的模型格式：“${fileName}”。支持 .glb / .gltf / .obj / .stl / .step / .stp`);
  const size = bytes.byteLength;
  if (size === 0) throw new UserError("文件是空的（0 字节）");
  const lim = ext === "step" ? LIMITS.stepBytes : LIMITS.modelBytes;
  if (size > lim) throw new UserError(`文件太大：${mb(size)}，${ext === "step" ? "STEP" : "模型"}上限 ${mb(lim)}。可以先在 CAD 里减面或拆成几个文件`);
  const warnings = [];
  let root;
  try {
    if (ext === "glb" || ext === "gltf") root = await parseGltf(bytes, ext, warnings);
    else if (ext === "obj") root = await parseObj(bytes, warnings);
    else if (ext === "stl") root = await parseStl(bytes, warnings);
    else root = await parseStep(bytes, warnings);
  } catch (e) {
    if (e.user) throw e;
    throw new UserError(`解析失败（文件可能损坏或不是 ${ext.toUpperCase()}）：${String(e.message || e).slice(0, 160)}`);
  }
  const meshes = collectMeshes(root, warnings);
  if (!meshes.length) throw new UserError("文件里没有找到任何三角网格（可能只有线、点或空场景）");
  return { format: ext, meshes, warnings, unitHint: root.userData?.unit || null };
}

function sniffGlb(bytes) {
  const u = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  return u[0] === 0x67 && u[1] === 0x6c && u[2] === 0x54 && u[3] === 0x46; // "glTF"
}

async function parseGltf(bytes, ext, warnings) {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
  const isGlb = sniffGlb(bytes);
  if (ext === "glb" && !isGlb) throw new UserError("这个 .glb 文件头不是 “glTF”，不是有效的二进制 glTF");
  let data = bytes;
  if (!isGlb) {
    // .gltf（JSON）：外部 .bin / 贴图不去取（不联网、也拿不到同目录文件）；只接受内嵌 data: URI 的
    const text = new TextDecoder().decode(bytes);
    let j;
    try { j = JSON.parse(text); } catch { throw new UserError(".gltf 不是有效的 JSON"); }
    const ext2 = [...(j.buffers || []), ...(j.images || [])].filter((b) => b.uri && !/^data:/.test(b.uri));
    if (ext2.some((b) => j.buffers?.includes(b))) throw new UserError(".gltf 引用了外部 .bin 文件（" + ext2.map((b) => b.uri).slice(0, 2).join("、") + "）。网页不会去读其它文件：请导出成 .glb（单文件）再上传");
    for (const im of j.images || []) if (im.uri && !/^data:/.test(im.uri)) { warnings.push(`贴图 “${im.uri}” 是外部文件，已忽略`); delete im.uri; }
    data = JSON.stringify(j);
  }
  if (isGlb) {
    // 检查 JSON 块里有没有外部 URI（贴图），有就去掉（不联网）
    data = stripExternalGlb(bytes, warnings);
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  // 不设置 Draco / KTX2 解码器：它们默认要从网上下载解码程序
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((u) => (/^(data:|blob:)/.test(u) ? u : "data:,"));
  loader.manager = manager;
  const gltf = await new Promise((res, rej) => loader.parse(data, "", res, (e) => rej(e)));
  const used = gltf.parser?.json?.extensionsUsed || [];
  if (used.includes("KHR_draco_mesh_compression")) throw new UserError("这个 GLB 用了 Draco 压缩：解码器要联网下载，这里不支持。请导出未压缩或 meshopt 压缩的 GLB");
  // GLTFLoader 会把节点名里的空格、点、斜杠换成下划线：用原始 JSON 里的名字（中文零件名、型号里的点）
  const nodesJ = gltf.parser?.json?.nodes || [];
  gltf.scene.traverse((o) => {
    const a = gltf.parser?.associations?.get(o);
    const nm = a && a.nodes !== undefined ? nodesJ[a.nodes]?.name : null;
    if (typeof nm === "string" && nm) o.name = nm.slice(0, 120);
  });
  return gltf.scene;
}

function stripExternalGlb(bytes, warnings) {
  const dv = new DataView(bytes);
  if (bytes.byteLength < 20) throw new UserError("GLB 文件太短");
  const total = dv.getUint32(8, true);
  if (total > bytes.byteLength + 8) throw new UserError("GLB 文件被截断了（头里写的长度比文件长）");
  const jlen = dv.getUint32(12, true), jtype = dv.getUint32(16, true);
  if (jtype !== 0x4e4f534a || 20 + jlen > bytes.byteLength) throw new UserError("GLB 的 JSON 块损坏");
  let j;
  try { j = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jlen))); } catch { throw new UserError("GLB 的 JSON 块不是有效 JSON"); }
  let changed = false;
  for (const im of j.images || []) if (im.uri && !/^data:/.test(im.uri)) { warnings.push(`贴图 “${im.uri}” 是外部文件，已忽略`); delete im.uri; changed = true; }
  for (const b of j.buffers || []) if (b.uri && !/^data:/.test(b.uri)) throw new UserError("GLB 引用了外部 .bin 文件，网页不会去读：请导出成完整的单文件 GLB");
  if (!changed) return bytes;
  // 重新打包 JSON 块
  let js = new TextEncoder().encode(JSON.stringify(j));
  const pad = (4 - (js.length % 4)) % 4;
  const jb = new Uint8Array(js.length + pad).fill(0x20); jb.set(js);
  const rest = new Uint8Array(bytes, 20 + jlen);
  const out = new Uint8Array(12 + 8 + jb.length + rest.length);
  const o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, out.length, true);
  o.setUint32(12, jb.length, true); o.setUint32(16, 0x4e4f534a, true);
  out.set(jb, 20); out.set(rest, 20 + jb.length);
  return out.buffer;
}

async function parseObj(bytes, warnings) {
  const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
  const text = new TextDecoder().decode(bytes);
  if (!/^\s*v\s/m.test(text) || !/^\s*f\s/m.test(text)) throw new UserError("OBJ 里没有顶点（v）或面（f）");
  if (/^\s*mtllib\s/m.test(text)) warnings.push("OBJ 引用的 .mtl 材质文件不会去读（颜色用默认，可以在模块里改色）");
  return new OBJLoader().parse(text);
}

async function parseStl(bytes, warnings) {
  const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
  // 二进制 STL：80 字节头 + 4 字节三角形数；长度要对得上
  const isAscii = /^\s*solid[\s\S]{0,400}facet/i.test(new TextDecoder().decode(new Uint8Array(bytes, 0, Math.min(600, bytes.byteLength))));
  if (!isAscii) {
    if (bytes.byteLength < 84) throw new UserError("STL 文件太短");
    const n = new DataView(bytes).getUint32(80, true);
    if (84 + n * 50 > bytes.byteLength) throw new UserError(`二进制 STL 被截断：头里写 ${n} 个三角形，文件只够 ${Math.floor((bytes.byteLength - 84) / 50)} 个`);
    if (n > LIMITS.triangles) throw new UserError(`三角形太多（${n.toLocaleString()}），上限 ${LIMITS.triangles.toLocaleString()}`);
  }
  const g = new STLLoader().parse(bytes);
  if (!g.attributes.position || g.attributes.position.count < 3) throw new UserError("STL 里没有三角形");
  warnings.push("STL 只有一整块网格、没有单位：单位按尺寸猜（多数 STL 是毫米），请核对；可以按连通块自动拆模块");
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#9aa3ad" }));
  m.name = "STL";
  const grp = new THREE.Group(); grp.add(m);
  return grp;
}

let occtP = null;
async function parseStep(bytes, warnings) {
  // occt-import-js（LGPL-2.1，wasm 约 7.6 MB）只在第一次上传 STEP 时从本站加载，不联网
  occtP ||= (async () => {
    const [{ default: occtimportjs }, { default: wasmUrl }] = await Promise.all([import("occt-import-js"), import("occt-import-js/dist/occt-import-js.wasm?url")]);
    return occtimportjs({ locateFile: () => wasmUrl });
  })();
  const occt = await occtP;
  const r = occt.ReadStepFile(new Uint8Array(bytes), { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.002, angularDeflection: 0.5 });
  if (!r.success || !r.meshes?.length) throw new UserError("STEP 读取失败或里面没有实体（可能是损坏文件或只有线框）");
  warnings.push("STEP 已在本机三角化（单位换成了毫米）；每个实体一个网格，装配层级按 STEP 里的名字");
  const grp = new THREE.Group();
  const walk = (node, parent) => {
    const g = new THREE.Group(); g.name = node.name || ""; parent.add(g);
    for (const mi of node.meshes || []) {
      const m = r.meshes[mi];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
      if (m.attributes.normal) geo.setAttribute("normal", new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
      if (m.index) geo.setIndex(m.index.array);
      const c = m.color || [0.6, 0.62, 0.65];
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0], c[1], c[2]) }));
      mesh.name = m.name || `实体 ${mi + 1}`;
      g.add(mesh);
    }
    for (const ch of node.children || []) walk(ch, g);
  };
  if (r.root) walk(r.root, grp);
  else r.meshes.forEach((m, i) => walk({ name: m.name, meshes: [i] }, grp));
  grp.userData.unit = "mm";
  return grp;
}

// 把所有网格的世界变换烘焙进几何体，记下组路径（用来自动拆模块）
function collectMeshes(root, warnings) {
  root.updateMatrixWorld(true);
  const out = [];
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (out.length >= LIMITS.meshes) return;
    let g = o.geometry.clone();
    // 量化 / 交错属性 → 普通 Float32
    const pos = g.attributes.position;
    const P = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { P[3 * i] = pos.getX(i); P[3 * i + 1] = pos.getY(i); P[3 * i + 2] = pos.getZ(i); }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.BufferAttribute(P, 3));
    if (g.index) ng.setIndex(Array.from(g.index.array));
    ng.applyMatrix4(o.matrixWorld);
    for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i])) throw new UserError(`网格 “${o.name || out.length + 1}” 里有无效坐标（NaN / 无穷大）`);
    ng.computeVertexNormals();
    const t = (ng.index ? ng.index.count : pos.count) / 3;
    tris += t;
    if (tris > LIMITS.triangles) throw new UserError(`三角形太多（超过 ${LIMITS.triangles.toLocaleString()}）：请先减面`);
    const path = [];
    for (let p = o.parent; p && p !== root; p = p.parent) path.unshift(p.name || "");
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const color = mat?.color ? "#" + mat.color.getHexString() : "#9aa3ad";
    out.push({ id: `m${out.length}`, name: o.name || `网格 ${out.length + 1}`, path, geom: ng, color, tris: Math.round(t) });
  });
  if (out.length >= LIMITS.meshes) warnings.push(`网格超过 ${LIMITS.meshes} 个，后面的没有导入`);
  return out;
}

// 单位：按包围盒最长边猜（我的补充，可在界面里改）。返回 {guess, why}
export function guessUnits(sizeMax, fmt, hint) {
  if (hint) return { guess: hint, why: "文件里写明了单位" };
  if (fmt === "glb" || fmt === "gltf") {
    // glTF 规范单位是米；但很多导出的其实是毫米或厘米
    if (sizeMax >= 20) return { guess: "mm", why: `最长边 ${sizeMax.toFixed(1)} 单位：按米会是 ${sizeMax.toFixed(0)} m，太大，猜是毫米` };
    if (sizeMax >= 1.5) return { guess: "cm", why: `最长边 ${sizeMax.toFixed(2)} 单位：按米太大、按毫米太小，猜是厘米` };
    return { guess: "m", why: "glTF 规范单位是米，尺寸也合理" };
  }
  if (sizeMax < 1.5) return { guess: "m", why: `最长边只有 ${sizeMax.toFixed(3)} 单位，按毫米太小，猜是米` };
  if (sizeMax < 6) return { guess: "cm", why: `最长边 ${sizeMax.toFixed(2)} 单位，按毫米太小，猜是厘米` };
  return { guess: "mm", why: `${fmt.toUpperCase()} 没有单位信息，最长边 ${sizeMax.toFixed(1)}，按最常见的毫米` };
}
export const UNIT_CM = { mm: 0.1, cm: 1, m: 100, in: 2.54 };
