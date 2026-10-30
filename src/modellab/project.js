// v11 工程：JSON（模块、功能、绑定、视图）+ 资源（模型原文件、功能图）。导出 / 导入为 .zip。
import { zipStore, unzip } from "./zip.js";
import { FUNC_KINDS, MATERIALS, newId, PALETTE } from "./modules.js";
import { LIMITS, MODEL_EXT, extOf, mb } from "./limits.js";

export const SCHEMA = "proto-modellab/1";
export function emptyProject(name = "未命名工程") {
  return { schema: SCHEMA, id: newId("prj"), name, updated: Date.now(), model: null, modules: [], diagram: null, functions: [], notes: "", joints: [], poses: [], timeline: { loop: false, keys: [] }, sim: { fixBase: false } };
}
export function newFunction(name, i = 0, kind = "其他") {
  return { id: newId("fn"), name, kind, color: PALETTE[(i + 3) % PALETTE.length], regions: [], pins: [], modules: [], joints: [], note: "" };
}

const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v, lo, hi, d) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const color = (v, d) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
const ident = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null);

// 严格清洗导入的 JSON：未知字段丢掉，类型不对用默认值，引用不存在的 id 删掉
export function sanitize(j) {
  if (!j || typeof j !== "object") throw new Error("project.json 不是对象");
  if (j.schema !== SCHEMA) throw new Error(`工程格式不对（schema 应为 ${SCHEMA}，实际是 ${String(j.schema).slice(0, 40)}）`);
  const p = emptyProject(str(j.name, 80) || "导入的工程");
  if (ident(j.id)) p.id = j.id;
  p.notes = str(j.notes, 4000);
  p.builtin = j.builtin === true;
  if (j.model && typeof j.model === "object") {
    const f = str(j.model.file, 200);
    if (j.model.builtin && !MODEL_EXT[extOf(f)]) throw new Error("内置模型文件名不对");
    p.model = { file: f, format: MODEL_EXT[extOf(f)] || null, units: ["mm", "cm", "m", "in"].includes(j.model.units) ? j.model.units : "mm", scale: num(j.model.scale, 1e-4, 1e4, 1), upAxis: j.model.upAxis === "z" ? "z" : "y", unitWhy: str(j.model.unitWhy, 300), split: j.model.split === "connected" ? "connected" : "auto", builtin: str(j.model.builtin, 80) || undefined, size: num(j.model.size, 0, 1e10, 0) };
    if (!p.model.format) throw new Error("模型文件格式不认识：" + f);
  }
  const meshIdOk = (s) => typeof s === "string" && /^m\d+(c\d+)?$/.test(s);
  const mods = Array.isArray(j.modules) ? j.modules.slice(0, 500) : [];
  const modIds = new Set();
  for (const m of mods) {
    const id = ident(m?.id); if (!id || modIds.has(id)) continue;
    modIds.add(id);
    p.modules.push({ id, name: str(m.name, 60) || id, color: color(m.color, "#9aa3ad"), meshes: (Array.isArray(m.meshes) ? m.meshes : []).filter(meshIdOk).slice(0, 5000), collider: m.collider === "box" ? "box" : "hull", material: MATERIALS[m.material] ? m.material : "pla", massG: typeof m.massG === "number" && m.massG > 0 ? Math.min(m.massG, 1e6) : null, hidden: m.hidden === true });
  }
  if (j.diagram && typeof j.diagram === "object") p.diagram = { file: str(j.diagram.file, 200), mime: ["image/png", "image/jpeg", "image/svg+xml"].includes(j.diagram.mime) ? j.diagram.mime : "image/png", w: num(j.diagram.w, 1, 20000, 1000), h: num(j.diagram.h, 1, 20000, 700), fromPdf: j.diagram.fromPdf ? { page: num(j.diagram.fromPdf.page, 1, 9999, 1), pages: num(j.diagram.fromPdf.pages, 1, 9999, 1) } : undefined, builtin: str(j.diagram.builtin, 80) || undefined };
  const fns = Array.isArray(j.functions) ? j.functions.slice(0, 200) : [];
  const fnIds = new Set();
  fns.forEach((f, i) => {
    const id = ident(f?.id); if (!id || fnIds.has(id)) return;
    fnIds.add(id);
    p.functions.push({
      id, name: str(f.name, 40) || `功能 ${i + 1}`, kind: FUNC_KINDS.includes(f.kind) ? f.kind : "其他", color: color(f.color, PALETTE[i % PALETTE.length]),
      regions: (Array.isArray(f.regions) ? f.regions : []).slice(0, 50).map((r) => ({ x: num(r?.x, 0, 1, 0), y: num(r?.y, 0, 1, 0), w: num(r?.w, 0.001, 1, 0.05), h: num(r?.h, 0.001, 1, 0.05) })),
      pins: (Array.isArray(f.pins) ? f.pins : []).slice(0, 64).map((q) => ({ label: str(q?.label, 30), signal: str(q?.signal, 40) })).filter((q) => q.label || q.signal),
      modules: [...new Set((Array.isArray(f.modules) ? f.modules : []).filter((m) => modIds.has(m)))],
      note: str(f.note, 500),
      joints: Array.isArray(f.joints) ? f.joints.slice(0, 200) : [], // 关节 id 在下面清洗完关节后再过滤
    });
  });
  // v12：关节、姿态、时间轴
  const vec = (v, d) => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? v.map((x) => Math.min(1e7, Math.max(-1e7, x))) : d);
  const TYPES = ["revolute", "prismatic", "ball", "fixed"], PRESETS = ["none", "sg51r", "mg90s", "custom", "linear"];
  const jIds = new Set();
  for (const q of (Array.isArray(j.joints) ? j.joints : []).slice(0, 200)) {
    const id = ident(q?.id); if (!id || jIds.has(id)) continue;
    if (!modIds.has(q.parent) || !modIds.has(q.child) || q.parent === q.child) continue;
    const type = TYPES.includes(q.type) ? q.type : "revolute";
    const lo = type === "prismatic" ? -1000 : -180, hi = type === "prismatic" ? 1000 : 180;
    let mn = num(q.limits?.min, lo, hi, type === "prismatic" ? 0 : -90), mx = num(q.limits?.max, lo, hi, type === "prismatic" ? 20 : 90);
    if (mn > mx) [mn, mx] = [mx, mn];
    const d = q.drive || {};
    jIds.add(id);
    p.joints.push({
      id, name: str(q.name, 40) || id, type, parent: q.parent, child: q.child,
      anchor: vec(q.anchor, [0, 0, 0]), axis: vec(q.axis, [0, 1, 0]),
      limits: { min: mn, max: mx },
      drive: { preset: PRESETS.includes(d.preset) ? d.preset : "none", volt: num(d.volt, 0.1, 12, 4.8), torque: num(d.torque, 0, 100, 1), speed: num(d.speed, 1, 5000, 300), forceN: num(d.forceN, 0, 1000, 5), speedMm: num(d.speedMm, 0.1, 2000, 20) },
      home: Math.min(mx, Math.max(mn, num(q.home, lo, hi, 0))),
    });
  }
  for (const f of p.functions) f.joints = [...new Set(f.joints.filter((x) => jIds.has(x)))];
  const pIds = new Set();
  for (const q of (Array.isArray(j.poses) ? j.poses : []).slice(0, 100)) {
    const id = ident(q?.id); if (!id || pIds.has(id)) continue;
    pIds.add(id);
    const values = {};
    if (q.values && typeof q.values === "object") for (const k of Object.keys(q.values)) if (jIds.has(k) && typeof q.values[k] === "number" && Number.isFinite(q.values[k])) values[k] = Math.min(1000, Math.max(-1000, q.values[k]));
    p.poses.push({ id, name: str(q.name, 40) || id, values });
  }
  const tl = j.timeline && typeof j.timeline === "object" ? j.timeline : {};
  p.timeline = { loop: tl.loop === true, keys: (Array.isArray(tl.keys) ? tl.keys : []).slice(0, 200).filter((k) => pIds.has(k?.pose)).map((k) => ({ t: num(k.t, 0, 600, 0), pose: k.pose })).sort((a, b) => a.t - b.t) };
  p.sim = { fixBase: j.sim?.fixBase === true };
  const blk = vec(j.sim?.block, null);
  if (blk) p.sim.block = blk;
  return p;
}

// 导出：project.json + model.<ext> + diagram.<ext>（内置示例的资源也一起打包，别人打开不需要联网）
export async function exportZip(project, assets) {
  const enc = new TextEncoder();
  const files = [];
  const j = structuredClone({ ...project, updated: Date.now() });
  if (assets.model && j.model) { const e = extOf(j.model.file) || j.model.format; j.model.asset = `model.${e}`; files.push({ name: j.model.asset, data: new Uint8Array(assets.model) }); delete j.model.builtin; }
  if (assets.diagram && j.diagram) { const e = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg" }[j.diagram.mime] || "png"; j.diagram.asset = `diagram.${e}`; files.push({ name: j.diagram.asset, data: new Uint8Array(await assets.diagram.arrayBuffer()) }); delete j.diagram.builtin; }
  j.builtin = false;
  files.unshift({ name: "project.json", data: enc.encode(JSON.stringify(j, null, 1)) });
  files.push({ name: "README.txt", data: enc.encode("硬件验证原型 · 模型 + 功能图工程（早期原型，简化仿真）\n在 https://neal-gunter.github.io/prototypes/assembly/model 点“导入工程”打开。所有内容只在浏览器本地解析。\n") });
  return zipStore(files);
}
export async function importZip(buf) {
  if (buf.byteLength > LIMITS.projectBytes) throw new Error(`工程包太大：${mb(buf.byteLength)}，上限 ${mb(LIMITS.projectBytes)}`);
  const files = await unzip(buf);
  const pj = files.get("project.json");
  if (!pj) throw new Error("ZIP 里没有 project.json");
  let j;
  try { j = JSON.parse(new TextDecoder().decode(pj)); } catch { throw new Error("project.json 不是有效 JSON"); }
  const p = sanitize(j);
  const assets = {};
  const ma = typeof j.model?.asset === "string" ? j.model.asset : null;
  if (p.model) {
    if (!ma || !files.has(ma)) throw new Error("工程里写了模型，但 ZIP 里没有模型文件");
    assets.model = files.get(ma).slice().buffer;
    p.model.builtin = undefined;
  }
  const da = typeof j.diagram?.asset === "string" ? j.diagram.asset : null;
  if (p.diagram) {
    if (!da || !files.has(da)) throw new Error("工程里写了功能图，但 ZIP 里没有图片");
    assets.diagram = new Blob([files.get(da)], { type: p.diagram.mime });
    p.diagram.builtin = undefined;
  }
  p.id = newId("prj");
  p.updated = Date.now();
  return { project: p, assets };
}
