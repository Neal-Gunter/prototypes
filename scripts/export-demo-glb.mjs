// v11：把装配台里 v10 八爪鱼（预设按钮建好的那只）导出成 GLB，作为“模型 + 功能图”的内置示例。
// 每个零件一个组（组名 = 零件标签），导线合成一个组；材质只保留颜色（不带贴图，文件小）。需要先 npx vite build && npx vite preview（4173），并用 npx esbuild scripts/gltfx-entry.js --bundle --format=iife --outfile=.tmp/gx.js 把 GLTFExporter 打成一个脚本。
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173"; // vite preview（dev 模式下 Rapier 有 StrictMode 双初始化问题）
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(BASE + "/assembly?scene=octo", { waitUntil: "networkidle", timeout: 120000 });
const btn = p.getByTestId("octo-preset-v10");
await btn.waitFor({ timeout: 90000 });
await p.waitForFunction(() => !document.querySelector('[data-testid="octo-preset-v10"]').disabled, null, { timeout: 120000 });
await btn.click();
await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 240000 });
await p.waitForTimeout(5000);
await p.addScriptTag({ content: fs.readFileSync(".tmp/gx.js", "utf8") });
const out = await p.evaluate(async () => {
  const { THREE, GLTFExporter } = window.__GLTFX;
  const eng = window.__asm.engine, scene = window.__asmScene;
  scene.updateMatrixWorld(true);
  const root = new THREE.Group(); root.name = "八爪鱼 v10（紧凑无线版）";
  const mats = new Map();
  const matOf = (m) => { const c = m?.color ? "#" + [m.color.r, m.color.g, m.color.b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("") : "#9aa3ad"; if (!mats.has(c)) { const mm = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1 }); mm.name = c; mats.set(c, mm); } return mats.get(c); };
  const copyMeshes = (src, grp, exclude) => {
    src.traverse((o) => {
      if (!o.isMesh || !o.visible || exclude?.(o)) return;
      for (let a = o.parent; a; a = a.parent) if (a.visible === false) return;
      if (o.material?.transparent && o.material.opacity < 0.99) return;
      const g = new THREE.BufferGeometry();
      const pos = o.geometry.attributes.position, P = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { P[3 * i] = pos.getX(i); P[3 * i + 1] = pos.getY(i); P[3 * i + 2] = pos.getZ(i); }
      g.setAttribute("position", new THREE.BufferAttribute(P, 3));
      if (o.geometry.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(o.geometry.index.array), 1));
      // 统一成米（glTF 规范），场景里是厘米
      g.applyMatrix4(new THREE.Matrix4().makeScale(0.01, 0.01, 0.01).multiply(new THREE.Matrix4().fromArray(o.matrixWorld.elements)));
      const m = new THREE.Mesh(g, matOf(Array.isArray(o.material) ? o.material[0] : o.material));
      m.name = o.name || grp.name;
      grp.add(m);
    });
  };
  const labels = [];
  for (const [uid, part] of eng.parts) {
    const obj = scene.getObjectByName(uid);
    if (!obj) continue;
    const grp = new THREE.Group(); grp.name = part.label || part.def.name_zh || uid;
    copyMeshes(obj, grp);
    if (grp.children.length) { root.add(grp); labels.push({ uid, label: grp.name, id: part.def.id, meshes: grp.children.length }); }
  }
  const cab = scene.getObjectByName("cables");
  if (cab && cab.children.length) { const grp = new THREE.Group(); grp.name = `导线（${cab.children.length} 根）`; copyMeshes(cab, grp); root.add(grp); labels.push({ label: grp.name, meshes: grp.children.length }); }
  const buf = await new Promise((res, rej) => new GLTFExporter().parse(root, res, rej, { binary: true }));
  const u8 = new Uint8Array(buf); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return { b64: btoa(s), labels };
});
fs.writeFileSync("/tmp/octo-v10-raw.glb", Buffer.from(out.b64, "base64"));
fs.writeFileSync("/tmp/octo-v10-labels.json", JSON.stringify(out.labels, null, 1));
console.log("raw", fs.statSync("/tmp/octo-v10-raw.glb").size, out.labels.length, "groups");
console.log(out.labels.map((l) => `${l.label}(${l.meshes})`).join(" | "));
await b.close();
