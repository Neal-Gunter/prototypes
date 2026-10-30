// v11 模型 + 功能图：上传 3D 模型和功能图，拆模块、标功能、互相绑定，双向高亮，隔离 / 爆炸，放到装配台做碰撞
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import * as THREE from "three";
import LabScene from "../modellab/ui/LabScene.jsx";
import DiagramPanel from "../modellab/ui/DiagramPanel.jsx";
import { parseForProject } from "../modellab/workspace.js";
import { analyzeModule, autoSplit, explodeOffsets, FUNC_KINDS, MATERIALS, mkModule, modelXform, PALETTE, newId } from "../modellab/modules.js";
import { emptyProject, exportZip, importZip, newFunction } from "../modellab/project.js";
import { deleteProject, listProjects, loadProject, saveProject } from "../modellab/idb.js";
import { loadDiagramFile, pdfPageToPng } from "../modellab/diagram.js";
import { loadBuiltinDemo } from "../modellab/demo.js";
import { LIMITS, MODEL_EXT, extOf, mb } from "../modellab/limits.js";

export const LAB_SIMPLIFICATIONS = [
  "全部在本机浏览器里解析：不上传文件，也不会去下载模型里引用的外部 .bin / 贴图（这种 glTF 会提示改用 GLB）",
  "只读三角网格和颜色；贴图、动画、骨骼、灯光、相机都忽略；NURBS（STEP）按 occt 三角化后的网格算",
  "单位靠猜（glTF 默认米，STL / OBJ 默认毫米，按最长边判断），猜错请手动改；STL / STEP 默认按 Z 朝上",
  "碰撞形状：每个模块一个凸包（凹进去的地方被填平）或一个轴对齐方块，不是逐三角形；整个模型在装配台上是一个刚体（各模块固定在一起）",
  "质量 = 体积 × 材料密度（估算）：闭合网格用真实体积，不闭合用凸包体积（偏大）；3D 打印件按实心算；可以直接填实测质量",
  "功能图热点是矩形框；功能 ↔ 模块绑定和引脚标注只是标签，不做电路仿真（八爪鱼示例的电路仿真在装配台的“八爪鱼”页）",
  "自动拆分按组名 / 网格；“按连通块拆”按顶点位置焊接后找连通块，相互接触但不共用顶点的零件不会被合并",
  "爆炸图是从整体中心沿方向推开的示意，不是真实拆卸顺序",
];
const UNITS = [["mm", "毫米"], ["cm", "厘米"], ["m", "米"], ["in", "英寸"]];
const clone = (p) => structuredClone(p);
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const btn = "min-h-9 border border-line bg-white px-2.5 text-sm hover:border-copper disabled:opacity-40";
const btnOn = "min-h-9 border border-copper bg-copper px-2.5 text-sm text-white";

export default function ModelLabPage() {
  const [project, setProject] = useState(null);
  const [assets, setAssets] = useState({ model: null, diagram: null });
  const [parsed, setParsed] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState("view");
  const [selMods, setSelMods] = useState(new Set());
  const [selFn, setSelFn] = useState(null);
  const [selMeshes, setSelMeshes] = useState(new Set());
  const [isolate, setIsolate] = useState(null);
  const [explode, setExplode] = useState({ mode: "none", amount: 0.5 });
  const [showCard, setShowCard] = useState(true);
  const [wire, setWire] = useState(false);
  const [list, setList] = useState([]);
  const [pdf, setPdf] = useState(null);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const saveT = useRef(0);
  const anCache = useRef(new Map());

  const refreshList = () => listProjects().then(setList).catch(() => setList([]));
  const fail = (e) => { console.warn(e); setErr(String(e?.message || e)); setBusy(""); };

  // ---------- 打开工程 ----------
  async function openProject(p, a, msg) {
    setErr(""); setBusy("正在解析模型…");
    try {
      const pr = p.model && a.model ? await parseForProject(a.model, p.model) : null;
      anCache.current.clear();
      setProject(p); setAssets(a); setParsed(pr);
      setSelMods(new Set()); setSelFn(null); setSelMeshes(new Set()); setIsolate(null); setPdf(null);
      setNote(msg || (pr?.warnings?.length ? pr.warnings.join("；") : ""));
      localStorage.setItem("modellab-last", p.id);
    } catch (e) { fail(e); return; }
    setBusy("");
  }
  async function openDemo() {
    setBusy("正在读取内置示例…");
    try { const d = await loadBuiltinDemo(); await openProject(d.project, d.assets, "内置示例：v10 八爪鱼。点功能图上的框，或点 3D 里的零件试试双向高亮"); } catch (e) { fail(e); }
  }
  async function openSaved(id) {
    try { const r = await loadProject(id); if (!r) throw new Error("本机没有这个工程（可能已删除）"); await openProject(r.project, { model: r.model, diagram: r.diagram }); } catch (e) { fail(e); }
  }
  useEffect(() => {
    document.title = "模型 + 功能图 · 硬件工作台";
    refreshList();
    const id = params.get("p"), last = localStorage.getItem("modellab-last");
    if (params.get("demo") != null) openDemo();
    else if (id) openSaved(id);
    else if (last) loadProject(last).then((r) => r ? openProject(r.project, { model: r.model, diagram: r.diagram }) : null).catch(() => {});
  }, []);

  // 自动保存（IndexedDB，本机）
  useEffect(() => {
    if (!project || (!assets.model && !assets.diagram)) return;
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => saveProject({ ...project, updated: Date.now() }, assets).then(refreshList).catch((e) => setErr("保存到浏览器失败：" + (e?.message || e))), 500);
  }, [project, assets]);

  const upd = (f) => setProject((p) => { const q = clone(p); f(q); q.updated = Date.now(); return q; });

  // ---------- 上传 ----------
  async function onModelFile(file) {
    if (!file) return;
    setErr("");
    if (!MODEL_EXT[extOf(file.name)]) return setErr(`不支持的模型格式：“${file.name}”。支持 .glb / .gltf / .obj / .stl / .step / .stp`);
    setBusy(extOf(file.name).startsWith("st") && extOf(file.name) !== "stl" ? "正在本地解析 STEP（第一次要加载约 7.6 MB 的 occt 解析器，较慢）…" : "正在本地解析模型…");
    try {
      const bytes = await file.arrayBuffer();
      const fmt0 = MODEL_EXT[extOf(file.name)];
      const zUp = fmt0 === "stl" || fmt0 === "step";
      const model = { file: file.name.slice(0, 200), format: fmt0, units: "mm", scale: 1, upAxis: zUp ? "z" : "y", split: "auto", size: file.size, unitWhy: "" };
      const pr = await parseForProject(bytes, model);
      model.units = pr.unitGuess.guess;
      model.unitWhy = pr.unitGuess.why + (zUp ? "；STL / STEP 通常 Z 朝上，已按 Z 朝上转成 Y 朝上" : "");
      const sp = autoSplit(pr.meshes);
      const nm = file.name.replace(/\.[^.]+$/, "").slice(0, 60);
      const base = project ? clone(project) : emptyProject(nm);
      if (base.builtin) { base.id = newId("prj"); base.name = nm; }
      base.builtin = false;
      base.model = model; base.modules = sp.modules;
      base.functions.forEach((f) => { f.modules = []; });
      await openProject(base, { ...assets, model: bytes }, `${file.name}：${mb(file.size)}，${pr.meshes.length} 个网格，${sp.how}。${pr.warnings.join("；")}`);
    } catch (e) { fail(e); }
  }
  async function onDiagramFile(file, page = 1) {
    if (!file) return;
    setErr(""); setBusy(/\.pdf$/i.test(file.name) ? "正在本地渲染 PDF…" : "正在读取功能图…");
    try {
      const d = await loadDiagramFile(file, { page });
      const p = project ? clone(project) : emptyProject(file.name.replace(/\.[^.]+$/, "").slice(0, 60));
      if (p.builtin) { p.builtin = false; p.id = newId("prj"); }
      p.diagram = { file: file.name.slice(0, 200), mime: d.mime, w: d.w, h: d.h, fromPdf: d.fromPdf };
      setPdf(d.fromPdf ? { bytes: d.pdfBytes, pages: d.fromPdf.pages, page: d.fromPdf.page, name: file.name } : null);
      setProject(p); setAssets((a) => ({ ...a, diagram: d.blob }));
      if (!project) { setParsed(null); localStorage.setItem("modellab-last", p.id); }
      setNote(`功能图 ${file.name}：${d.w}×${d.h} 像素${d.fromPdf ? `（PDF 第 ${d.fromPdf.page} / ${d.fromPdf.pages} 页）` : ""}。点“画热点框”在图上框出各个功能`);
    } catch (e) { fail(e); return; }
    setBusy("");
  }
  async function pdfPage(n) {
    setBusy("正在渲染 PDF 页…");
    try {
      const r = await pdfPageToPng(pdf.bytes, n);
      setPdf({ ...pdf, page: n });
      upd((p) => { p.diagram = { ...p.diagram, mime: "image/png", w: r.w, h: r.h, fromPdf: { page: n, pages: r.pages } }; });
      setAssets((a) => ({ ...a, diagram: r.blob }));
    } catch (e) { fail(e); return; }
    setBusy("");
  }
  async function onImport(file) {
    if (!file) return;
    setErr(""); setBusy("正在导入工程包…");
    try {
      if (file.size > LIMITS.projectBytes) throw new Error(`工程包太大：${mb(file.size)}，上限 ${mb(LIMITS.projectBytes)}`);
      const r = await importZip(await file.arrayBuffer());
      await openProject(r.project, { model: r.assets.model || null, diagram: r.assets.diagram || null }, `已导入 ${file.name}：${r.project.modules.length} 个模块、${r.project.functions.length} 个功能`);
    } catch (e) { fail(e); }
  }
  async function onExport() {
    try {
      const blob = await exportZip(project, assets);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${(project.name || "工程").replace(/[\\/:*?"<>|]+/g, "_")}.modellab.zip`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setNote(`已导出 ${mb(blob.size)}（project.json + 模型 + 功能图）`);
    } catch (e) { fail(e); }
  }
  async function toBench() {
    try { await saveProject(project, assets); nav(`/assembly?custom=${encodeURIComponent(project.id)}`); } catch (e) { fail(e); }
  }

  // ---------- 派生数据 ----------
  const X = useMemo(() => (parsed && project?.model ? modelXform(parsed.meshes, project.model) : null), [parsed, project?.model?.units, project?.model?.scale, project?.model?.upAxis]);
  const byId = useMemo(() => new Map((parsed?.meshes || []).map((m) => [m.id, m])), [parsed]);
  const an = useMemo(() => {
    const out = new Map();
    if (!X || !project) return out;
    const xk = `${project.model.units}|${project.model.scale}|${project.model.upAxis}`;
    for (const mod of project.modules) {
      const k = `${xk}|${mod.meshes.join(",")}|${mod.collider}|${mod.material}|${mod.massG}`;
      let a = anCache.current.get(mod.id);
      if (!a || a.k !== k) { a = { k, v: analyzeModule(mod, byId, X.M) }; anCache.current.set(mod.id, a); }
      if (a.v) out.set(mod.id, a.v);
    }
    return out;
  }, [X, project?.modules, byId]);
  const modOf = useMemo(() => { const m = new Map(); project?.modules.forEach((mod) => mod.meshes.forEach((id) => m.set(id, mod.id))); return m; }, [project?.modules]);
  const fnOfMod = useMemo(() => { const m = new Map(); project?.functions.forEach((f) => f.modules.forEach((id) => m.set(id, [...(m.get(id) || []), f.id]))); return m; }, [project?.functions]);
  const hl = useMemo(() => { const s = new Set(selMods); if (selFn) project?.functions.find((f) => f.id === selFn)?.modules.forEach((m) => s.add(m)); return s; }, [selMods, selFn, project?.functions]);
  const hlFns = useMemo(() => new Set([...selMods].flatMap((m) => fnOfMod.get(m) || [])), [selMods, fnOfMod]);
  const visible = useMemo(() => new Set((project?.modules || []).filter((m) => !m.hidden && (!isolate || isolate.ids.includes(m.id))).map((m) => m.id)), [project?.modules, isolate]);
  const offsets = useMemo(() => {
    if (!project || !X || explode.mode === "none") return new Map();
    const centers = new Map([...an].filter(([id]) => visible.has(id)).map(([id, a]) => [id, a.center]));
    return explodeOffsets(project, centers, explode.mode, explode.amount * Math.max(X.sizeCm.x, X.sizeCm.z, 4) * 0.6);
  }, [project?.functions, an, explode, visible, X]);
  const diagramUrl = useMemo(() => (assets.diagram ? URL.createObjectURL(assets.diagram) : null), [assets.diagram]);
  useEffect(() => () => diagramUrl && URL.revokeObjectURL(diagramUrl), [diagramUrl]);
  const totalMass = [...an.values()].reduce((s, a) => s + a.massG, 0);
  const fnSel = project?.functions.find((f) => f.id === selFn) || null;
  const modSel = selMods.size === 1 ? project?.modules.find((m) => selMods.has(m.id)) : null;

  // 测试钩子
  useEffect(() => {
    window.__lab = { project, hl: [...hl], hlFns: [...hlFns], visible: [...visible], selMods: [...selMods], selFn, selMeshes: [...selMeshes], mode, isolate, explode, offsets: offsets.size, size: X ? X.sizeMm.toArray() : null, mass: totalMass, busy, err, meshes: parsed?.meshes.length || 0 };
  });

  // ---------- 操作 ----------
  function onPick(mod, mesh, ev) {
    if (!mod) { if (mode === "view") { setSelMods(new Set()); setSelFn(null); } return; }
    if (mode === "bind") {
      if (!selFn) return setNote("先在功能图上点一个热点，或在左边的列表里选一个功能，再点模块绑定");
      upd((p) => { const f = p.functions.find((x) => x.id === selFn); if (!f) return; f.modules = f.modules.includes(mod) ? f.modules.filter((m) => m !== mod) : [...f.modules, mod]; });
      return;
    }
    if (mode === "mesh") { setSelMeshes((s) => { const t = new Set(s); t.has(mesh) ? t.delete(mesh) : t.add(mesh); return t; }); return; }
    if (ev?.shiftKey || ev?.ctrlKey || ev?.metaKey) setSelMods((s) => { const t = new Set(s); t.has(mod) ? t.delete(mod) : t.add(mod); return t; });
    else { setSelMods(new Set([mod])); setSelFn(null); }
  }
  const selectFn = (id) => { setSelFn(id); if (mode !== "bind") setSelMods(new Set()); };
  function onDraw(r) {
    const reg = { x: +r.x.toFixed(4), y: +r.y.toFixed(4), w: +r.w.toFixed(4), h: +r.h.toFixed(4) };
    const has = project.functions.some((x) => x.id === selFn);
    const nf = has ? null : newFunction(`功能 ${project.functions.length + 1}`, project.functions.length);
    upd((p) => { if (nf) p.functions.push({ ...clone(nf), regions: [reg] }); else p.functions.find((x) => x.id === selFn).regions.push(reg); });
    if (nf) setSelFn(nf.id);
  }
  const dropEmpty = (p) => { const keep = new Set(p.modules.filter((m) => m.meshes.length).map((m) => m.id)); p.modules = p.modules.filter((m) => keep.has(m.id)); p.functions.forEach((f) => { f.modules = f.modules.filter((m) => keep.has(m)); }); };
  function splitSelectedMeshes() {
    if (!selMeshes.size) return;
    const nm = mkModule(`新模块 ${project.modules.length + 1}`, [...selMeshes], project.modules.length);
    upd((p) => { p.modules.forEach((m) => { m.meshes = m.meshes.filter((id) => !selMeshes.has(id)); }); p.modules.push(nm); dropEmpty(p); });
    setSelMeshes(new Set()); setSelMods(new Set([nm.id])); setMode("view");
    setNote(`已拆出“${nm.name}”（${nm.meshes.length} 个网格）`);
  }
  function mergeSelected() {
    const ids = project.modules.filter((m) => selMods.has(m.id)).map((m) => m.id);
    if (ids.length < 2) return;
    upd((p) => {
      const first = p.modules.find((m) => m.id === ids[0]);
      for (const m of p.modules) if (m.id !== ids[0] && ids.includes(m.id)) { first.meshes.push(...m.meshes); m.meshes = []; }
      p.functions.forEach((f) => { if (f.modules.some((m) => ids.includes(m))) f.modules = [...new Set(f.modules.map((m) => (ids.includes(m) ? ids[0] : m)))]; });
      dropEmpty(p);
    });
    setSelMods(new Set([ids[0]]));
    setNote(`已把 ${ids.length} 个模块合并成一个`);
  }
  function moveMesh(meshId, toMod) {
    upd((p) => {
      p.modules.forEach((m) => { m.meshes = m.meshes.filter((id) => id !== meshId); });
      if (toMod === "__new") p.modules.push(mkModule(`新模块 ${p.modules.length + 1}`, [meshId], p.modules.length));
      else p.modules.find((m) => m.id === toMod)?.meshes.push(meshId);
      dropEmpty(p);
    });
  }
  async function splitConnectedAll() {
    setBusy("正在按连通块拆分…");
    try {
      const model = { ...project.model, split: "connected" };
      const pr = await parseForProject(assets.model, model);
      const p = clone(project); p.model = model;
      const kids = (id) => pr.meshes.filter((m) => m.id === id || m.id.startsWith(id + "c")).map((m) => m.id);
      const mods = [];
      for (const mod of p.modules) {
        const ids = mod.meshes.flatMap(kids);
        if (mod.meshes.length === 1 && ids.length > 1) ids.forEach((id, i) => mods.push({ ...mkModule(`${mod.name} · 块 ${i + 1}`, [id], mods.length), material: mod.material, collider: mod.collider }));
        else mods.push({ ...mod, meshes: ids });
      }
      const oldToNew = new Map(p.modules.map((m) => [m.id, mods.filter((x) => x.id === m.id || x.name.startsWith(m.name + " · 块")).map((x) => x.id)]));
      p.modules = mods;
      p.functions.forEach((f) => { f.modules = [...new Set(f.modules.flatMap((m) => oldToNew.get(m) || []))]; });
      anCache.current.clear();
      setProject(p); setParsed(pr);
      setNote(`按连通块拆分后：${pr.meshes.length} 个网格、${mods.length} 个模块`);
    } catch (e) { fail(e); return; }
    setBusy("");
  }
  function resplit() {
    const sp = autoSplit(parsed.meshes);
    upd((p) => { p.modules = sp.modules; p.functions.forEach((f) => { f.modules = []; }); });
    anCache.current.clear(); setSelMods(new Set()); setNote(sp.how + "（功能绑定已清空）");
  }
  const updMod = (id, f) => upd((p) => { const m = p.modules.find((x) => x.id === id); if (m) f(m); });
  const updFn = (id, f) => upd((p) => { const x = p.functions.find((q) => q.id === id); if (x) f(x); });
  const isolateMods = () => selMods.size && setIsolate({ type: "module", ids: [...selMods], zh: `${selMods.size} 个模块` });
  const isolateFn = (id) => { const f = project.functions.find((x) => x.id === id); if (f) setIsolate({ type: "function", ids: [...f.modules], zh: `功能“${f.name}”` }); };
  async function newBlank() { const p = emptyProject(); setProject(p); setAssets({ model: null, diagram: null }); setParsed(null); setSelMods(new Set()); setSelFn(null); setIsolate(null); setNote("新工程：上传一个 3D 模型和 / 或一张功能图"); localStorage.setItem("modellab-last", p.id); }
  async function delCurrent() { if (!project) return; await deleteProject(project.id).catch(() => {}); localStorage.removeItem("modellab-last"); setProject(null); setAssets({ model: null, diagram: null }); setParsed(null); refreshList(); }

  // ---------- 渲染 ----------
  const unbound = project ? project.modules.filter((m) => !fnOfMod.get(m.id)) : [];
  const ModRow = ({ m, fnId }) => (
    <li data-mod={m.id} className={`flex items-center gap-1 px-1 ${hl.has(m.id) ? "bg-[#fff1d6]" : ""}`}>
      <input type="checkbox" aria-label={`选中 ${m.name}`} checked={selMods.has(m.id)} onChange={() => setSelMods((s) => { const t = new Set(s); t.has(m.id) ? t.delete(m.id) : t.add(m.id); return t; })} />
      <span className="inline-block h-3 w-3 shrink-0 border border-ink/30" style={{ background: m.color }} />
      <button className="min-w-0 flex-1 truncate text-left" onClick={() => { setSelMods(new Set([m.id])); if (!fnId) setSelFn(null); }} title={m.name}>{m.name}</button>
      <button className="text-xs text-ink-soft" onClick={() => updMod(m.id, (x) => { x.hidden = !x.hidden; })} aria-label={m.hidden ? "显示" : "隐藏"} data-testid="eye">{m.hidden ? "◌" : "●"}</button>
    </li>
  );
  const Meshes = ({ m }) => (
    <details className="ml-6 text-xs">
      <summary className="cursor-pointer text-ink-soft">{m.meshes.length} 个网格</summary>
      <ul>{m.meshes.map((id) => { const me = byId.get(id); return (
        <li key={id} className={`flex items-center gap-1 ${selMeshes.has(id) ? "bg-[#ffe9a8]" : ""}`}>
          <span className="min-w-0 flex-1 truncate" title={me?.name}>{me?.name || id} <span className="text-ink-soft">({me?.tris ?? "?"}△)</span></span>
          <select aria-label="移到模块" className="max-w-24 border border-line bg-white" value="" onChange={(e) => e.target.value && moveMesh(id, e.target.value)}>
            <option value="">移到…</option>
            {project.modules.filter((x) => x.id !== m.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            <option value="__new">新模块</option>
          </select>
        </li>); })}</ul>
    </details>
  );

  return (
    <main id="main" className="mx-auto max-w-[1600px] px-3 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-medium">模型 + 功能图 <span className="ml-1 border border-copper px-1.5 py-0.5 align-middle text-xs text-copper">早期原型，简化仿真</span></h1>
        <Link to="/assembly" className="text-sm underline">← 装配台</Link>
        <span className="ml-auto text-xs text-ink-soft">工程：</span>
        <select aria-label="本机工程" data-testid="project-list" className="min-h-9 max-w-56 border border-line bg-white px-1 text-sm" value={project?.id || ""} onChange={(e) => e.target.value && openSaved(e.target.value)}>
          <option value="">{project ? project.name : "（未打开）"}</option>
          {list.filter((r) => r.id !== project?.id).map((r) => <option key={r.id} value={r.id}>{r.name}（{r.mods} 模块 · {r.fns} 功能）</option>)}
        </select>
        <button className={btn} onClick={newBlank}>新建</button>
        <button className={btn} data-testid="load-demo" onClick={openDemo}>内置示例：八爪鱼</button>
        <label className={btn + " inline-flex cursor-pointer items-center"}>导入工程 .zip<input data-testid="import-input" type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => { onImport(e.target.files[0]); e.target.value = ""; }} /></label>
        <button className={btn} data-testid="export" disabled={!project} onClick={onExport}>导出工程 .zip</button>
        <button className={btn} data-testid="to-bench" disabled={!parsed || !project?.modules.length} onClick={toBench}>放到装配台 →</button>
        <button className={btn} disabled={!project} onClick={delCurrent}>删除</button>
      </div>
      <p className="mt-1 text-xs text-ink-soft" data-testid="local-note">🔒 只在本机浏览器里解析：文件不会上传到任何服务器，也不会去下载模型里引用的外部资源；工程自动保存在这个浏览器的 IndexedDB 里（清浏览器数据会丢，记得导出 .zip）。</p>

      <div className="mt-2 flex flex-wrap items-center gap-2 border border-line bg-paper-2 p-2 text-sm">
        <label className={btn + " inline-flex cursor-pointer items-center"}>① 上传 3D 模型<input data-testid="model-input" type="file" accept=".glb,.gltf,.obj,.stl,.step,.stp" className="sr-only" onChange={(e) => { onModelFile(e.target.files[0]); e.target.value = ""; }} /></label>
        <span className="text-xs text-ink-soft">GLB / glTF / OBJ / STL ≤ {mb(LIMITS.modelBytes)}，STEP ≤ {mb(LIMITS.stepBytes)}</span>
        <label className={btn + " inline-flex cursor-pointer items-center"}>② 上传功能图<input data-testid="diagram-input" type="file" accept=".png,.jpg,.jpeg,.svg,.pdf" className="sr-only" onChange={(e) => { onDiagramFile(e.target.files[0]); e.target.value = ""; }} /></label>
        <span className="text-xs text-ink-soft">PNG / JPG / SVG ≤ {mb(LIMITS.imageBytes)}，PDF ≤ {mb(LIMITS.pdfBytes)}（选一页）</span>
        <span className="mx-1 h-6 w-px bg-line" />
        {[["view", "查看"], ["bind", "绑定：点功能再点模块"], ["mesh", "选网格（拆分）"], ["draw", "画热点框"]].map(([k, zh]) => (
          <button key={k} data-testid={`mode-${k}`} className={mode === k ? btnOn : btn} onClick={() => setMode(k)}>{zh}</button>
        ))}
      </div>
      {busy && <p className="mt-2 border border-line bg-white p-2 text-sm" role="status">{busy}</p>}
      {err && <p className="mt-2 border border-mark bg-[#fbe9e7] p-2 text-sm text-mark" role="alert" data-testid="error">⚠ {err} <button className="ml-2 underline" onClick={() => setErr("")}>关闭</button></p>}
      {note && !err && <p className="mt-2 border border-line bg-white p-2 text-xs" data-testid="note">{note}</p>}

      {!project && !busy && (
        <div className="mt-6 border border-dashed border-line bg-paper-2 p-6 text-sm">
          <p className="font-medium">还没有打开工程。</p>
          <p className="mt-1">上传自己的 3D 模型（会按组名 / 网格自动拆成模块）和一张功能图（框图、原理图截图、PDF 某页），把“功能”框在图上，再绑定到模型的模块。也可以先看看 <button className="underline" onClick={openDemo}>内置的八爪鱼示例</button>。</p>
        </div>
      )}

      {project && (
        <div className="mt-2 grid gap-2 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,0.9fr)]">
          {/* 左：树 功能 → 模块 → 网格 */}
          <aside className="border border-line bg-paper-2 p-2 text-sm" data-testid="tree">
            <div className="flex items-center gap-1">
              <input aria-label="工程名" className="min-w-0 flex-1 border border-line bg-white px-1" value={project.name} onChange={(e) => upd((p) => { p.name = e.target.value.slice(0, 80); })} />
            </div>
            <div className="mt-2 flex items-center justify-between"><h2 className="font-medium">功能 → 模块 → 网格</h2>
              <button className="text-xs underline" data-testid="add-fn" onClick={() => { const f = newFunction(`功能 ${project.functions.length + 1}`, project.functions.length); upd((p) => p.functions.push(f)); setSelFn(f.id); }}>+ 功能</button></div>
            <ul className="mt-1 max-h-[62vh] overflow-auto">
              {project.functions.map((f) => (
                <li key={f.id} className="mt-1">
                  <div data-fn={f.id} className={`flex items-center gap-1 px-1 ${selFn === f.id || hlFns.has(f.id) ? "bg-[#fff1d6]" : ""}`}>
                    <span className="inline-block h-3 w-3 shrink-0" style={{ background: f.color }} />
                    <button className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => selectFn(f.id)}>{f.name}</button>
                    <span className="text-xs text-ink-soft">{f.kind}</span>
                    <button className="text-xs underline" onClick={() => isolateFn(f.id)} data-testid="isolate-fn">隔离</button>
                  </div>
                  <ul className="ml-3">{f.modules.map((id) => project.modules.find((m) => m.id === id)).filter(Boolean).map((m) => <div key={m.id}><ModRow m={m} fnId={f.id} /></div>)}</ul>
                </li>
              ))}
              <li className="mt-2">
                <div className="px-1 text-xs font-medium text-ink-soft">未绑定功能的模块（{unbound.length}）</div>
                <ul className="ml-3">{unbound.map((m) => <div key={m.id}><ModRow m={m} /><Meshes m={m} /></div>)}</ul>
              </li>
              {project.functions.length > 0 && <li className="mt-2">
                <div className="px-1 text-xs font-medium text-ink-soft">全部模块（{project.modules.length}）和网格</div>
                <ul className="ml-3">{project.modules.filter((m) => fnOfMod.get(m.id)).map((m) => <div key={m.id}><ModRow m={m} /><Meshes m={m} /></div>)}</ul>
              </li>}
            </ul>
          </aside>

          {/* 中：3D */}
          <section className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <button className={btn} data-testid="isolate-mod" disabled={!selMods.size} onClick={isolateMods}>隔离选中</button>
              <button className={btn} disabled={!selMods.size} onClick={() => upd((p) => p.modules.forEach((m) => { if (selMods.has(m.id)) m.hidden = true; }))}>隐藏选中</button>
              <button className={btn} data-testid="show-all" onClick={() => { setIsolate(null); upd((p) => p.modules.forEach((m) => { m.hidden = false; })); }}>全部显示</button>
              <label className="flex items-center gap-1">爆炸
                <select data-testid="explode-mode" className="min-h-9 border border-line bg-white" value={explode.mode} onChange={(e) => setExplode({ ...explode, mode: e.target.value })}>
                  <option value="none">不爆炸</option><option value="module">按模块</option><option value="function">按功能</option>
                </select>
                <input type="range" min="0.1" max="1.5" step="0.05" value={explode.amount} onChange={(e) => setExplode({ ...explode, amount: +e.target.value })} aria-label="爆炸距离" data-testid="explode-amt" />
              </label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showCard} onChange={(e) => setShowCard(e.target.checked)} />对照银行卡</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={wire} onChange={(e) => setWire(e.target.checked)} />线框</label>
            </div>
            {isolate && <p className="mt-1 text-xs" data-testid="isolate-note">正在隔离：{isolate.zh}（{isolate.ids.length} 个模块） <button className="underline" onClick={() => setIsolate(null)}>取消隔离</button></p>}
            <div className="relative mt-1 h-[58vh] min-h-[360px] border border-line bg-paper-2" data-testid="viewer">
              {parsed && X ? (
                <LabScene meshes={parsed.meshes} M={X.M} project={project} modOf={modOf} visible={visible} hl={hl} selMeshes={selMeshes} offsets={offsets} sizeCm={X.sizeCm} showCard={showCard} onPick={onPick} wire={wire} />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-soft">还没有 3D 模型。点“① 上传 3D 模型”（只在本机解析）</div>
              )}
              {mode !== "view" && <div className="pointer-events-none absolute left-2 top-2 bg-white/90 px-2 py-1 text-xs">{mode === "bind" ? (fnSel ? `绑定到“${fnSel.name}”：点模块 = 加入 / 移出` : "先点功能图上的热点或左边的功能") : mode === "mesh" ? `已选 ${selMeshes.size} 个网格（点网格切换）` : "在右边功能图上拖框"}</div>}
            </div>
            {parsed && X && (
              <div className="mt-2 grid gap-2 border border-line bg-paper-2 p-2 text-sm sm:grid-cols-2" data-testid="size-panel">
                <div>
                  <div className="font-medium">尺寸和单位</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <label>单位 <select data-testid="units" className="border border-line bg-white" value={project.model.units} onChange={(e) => upd((p) => { p.model.units = e.target.value; })}>{UNITS.map(([k, zh]) => <option key={k} value={k}>{zh}（{k}）</option>)}</select></label>
                    <label>缩放 <input data-testid="scale" type="number" min="0.001" max="1000" step="0.1" className="w-20 border border-line bg-white px-1" value={project.model.scale} onChange={(e) => { const v = +e.target.value; if (v > 0) upd((p) => { p.model.scale = v; }); }} /></label>
                    <label>朝上 <select data-testid="upaxis" className="border border-line bg-white" value={project.model.upAxis} onChange={(e) => upd((p) => { p.model.upAxis = e.target.value; })}><option value="y">Y 轴</option><option value="z">Z 轴</option></select></label>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">原始包围盒 {fmt(parsed.raw.x, 3)} × {fmt(parsed.raw.y, 3)} × {fmt(parsed.raw.z, 3)}（文件单位）。{project.model.unitWhy}</p>
                </div>
                <div>
                  <div className="font-medium">真实尺寸检查</div>
                  <p className="mt-1" data-testid="real-size">宽 {fmt(X.sizeMm.x)} × 高 {fmt(X.sizeMm.y)} × 深 {fmt(X.sizeMm.z)} mm</p>
                  <p className="text-xs text-ink-soft">旁边的蓝色薄片是一张银行卡（ISO/IEC 7810 ID‑1，85.60 × 53.98 mm）；地面格子 1 cm。总质量 {fmt(totalMass)} g（估算，可逐个模块改）</p>
                  {(Math.max(X.sizeMm.x, X.sizeMm.y, X.sizeMm.z) > 1500 || Math.max(X.sizeMm.x, X.sizeMm.y, X.sizeMm.z) < 2) && <p className="text-xs text-mark" data-testid="size-warn">⚠ 尺寸看起来不像桌面硬件，单位可能猜错了</p>}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button className={btn} onClick={resplit}>重新自动拆分</button>
                    <button className={btn} data-testid="split-connected" onClick={splitConnectedAll} disabled={project.model.split === "connected"}>按连通块拆网格</button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 右：功能图 + 检查器 */}
          <section className="min-w-0 space-y-2">
            <div className="border border-line bg-paper-2 p-2">
              <div className="flex items-center justify-between"><h2 className="font-medium">功能图</h2>
                {pdf && <label className="text-xs">PDF 页 <select className="border border-line bg-white" value={pdf.page} onChange={(e) => pdfPage(+e.target.value)}>{Array.from({ length: Math.min(pdf.pages, 200) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select> / {pdf.pages}</label>}</div>
              {diagramUrl && project.diagram ? (
                <DiagramPanel url={diagramUrl} w={project.diagram.w} h={project.diagram.h} functions={project.functions} selFn={selFn} hlFns={hlFns} drawing={mode === "draw"} onRegion={selectFn} onDraw={onDraw}
                  onRemoveRegion={(fid, i) => updFn(fid, (f) => { f.regions.splice(i, 1); })} />
              ) : <p className="p-4 text-sm text-ink-soft">还没有功能图。点“② 上传功能图”。没有图也可以只用左边的“+ 功能”列表绑定。</p>}
            </div>

            {mode === "mesh" && (
              <div className="border border-copper bg-white p-2 text-sm">
                <div>选网格拆分：已选 {selMeshes.size} 个</div>
                <div className="mt-1 flex gap-1.5"><button className={btn} data-testid="split-meshes" disabled={!selMeshes.size} onClick={splitSelectedMeshes}>拆成新模块</button><button className={btn} onClick={() => setSelMeshes(new Set())}>清空</button></div>
              </div>
            )}
            {selMods.size >= 2 && (
              <div className="border border-line bg-white p-2 text-sm">已选 {selMods.size} 个模块 <button className={btn + " ml-2"} data-testid="merge" onClick={mergeSelected}>合并成一个模块</button></div>
            )}

            {fnSel && (
              <div className="border border-line bg-white p-2 text-sm" data-testid="fn-panel">
                <div className="flex items-center gap-1">
                  <input type="color" aria-label="功能颜色" value={fnSel.color} onChange={(e) => updFn(fnSel.id, (f) => { f.color = e.target.value; })} />
                  <input data-testid="fn-name" aria-label="功能名称" className="min-w-0 flex-1 border border-line px-1" value={fnSel.name} onChange={(e) => updFn(fnSel.id, (f) => { f.name = e.target.value.slice(0, 40); })} />
                  <select data-testid="fn-kind" aria-label="功能类型" className="border border-line bg-white" value={fnSel.kind} onChange={(e) => updFn(fnSel.id, (f) => { f.kind = e.target.value; })}>{FUNC_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
                </div>
                <p className="mt-1 text-xs text-ink-soft">{fnSel.regions.length} 个热点区域 · 绑定 {fnSel.modules.length} 个模块</p>
                <textarea aria-label="说明" className="mt-1 w-full border border-line p-1 text-xs" rows={2} value={fnSel.note} placeholder="说明（可选）" onChange={(e) => updFn(fnSel.id, (f) => { f.note = e.target.value.slice(0, 500); })} />
                <details className="mt-1" open={fnSel.pins.length > 0}>
                  <summary className="cursor-pointer text-xs font-medium">引脚 / 信号标注（{fnSel.pins.length}）</summary>
                  <ul className="mt-1 space-y-0.5">{fnSel.pins.map((q, i) => (
                    <li key={i} className="flex gap-1 text-xs">
                      <input className="w-24 border border-line px-1" value={q.label} aria-label="引脚" onChange={(e) => updFn(fnSel.id, (f) => { f.pins[i].label = e.target.value.slice(0, 30); })} />
                      <input className="min-w-0 flex-1 border border-line px-1" value={q.signal} aria-label="信号" onChange={(e) => updFn(fnSel.id, (f) => { f.pins[i].signal = e.target.value.slice(0, 40); })} />
                      <button onClick={() => updFn(fnSel.id, (f) => { f.pins.splice(i, 1); })} aria-label="删除引脚">×</button>
                    </li>))}</ul>
                  <button className="mt-1 text-xs underline" data-testid="add-pin" onClick={() => updFn(fnSel.id, (f) => { f.pins.push({ label: `P${f.pins.length + 1}`, signal: "" }); })}>+ 引脚</button>
                </details>
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-medium">从列表里选模块</summary>
                  <ul className="mt-1 max-h-40 overflow-auto text-xs">{project.modules.map((m) => (
                    <li key={m.id}><label className="flex items-center gap-1"><input type="checkbox" checked={fnSel.modules.includes(m.id)} onChange={() => updFn(fnSel.id, (f) => { f.modules = f.modules.includes(m.id) ? f.modules.filter((x) => x !== m.id) : [...f.modules, m.id]; })} />{m.name}</label></li>))}</ul>
                </details>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button className={btn} onClick={() => isolateFn(fnSel.id)}>隔离这个功能</button>
                  <button className={btn} onClick={() => { setMode("draw"); }}>加热点框</button>
                  <button className={btn} onClick={() => { updFn(fnSel.id, (f) => { f.regions = []; }); }}>清空热点</button>
                  <button className={btn} onClick={() => { upd((p) => { p.functions = p.functions.filter((f) => f.id !== fnSel.id); }); setSelFn(null); }}>删除功能</button>
                </div>
              </div>
            )}

            {modSel && (
              <div className="border border-line bg-white p-2 text-sm" data-testid="mod-panel">
                <div className="flex items-center gap-1">
                  <input data-testid="mod-color" type="color" aria-label="模块颜色" value={modSel.color} onChange={(e) => updMod(modSel.id, (m) => { m.color = e.target.value; })} />
                  <input data-testid="mod-name" aria-label="模块名称" className="min-w-0 flex-1 border border-line px-1" value={modSel.name} onChange={(e) => updMod(modSel.id, (m) => { m.name = e.target.value.slice(0, 60); })} />
                </div>
                {an.get(modSel.id) && (() => { const a = an.get(modSel.id); return (
                  <p className="mt-1 text-xs" data-testid="mod-info">{fmt(a.sizeMm.x)} × {fmt(a.sizeMm.y)} × {fmt(a.sizeMm.z)} mm · 体积 {fmt(a.volCm3, 2)} cm³（{a.volHow}）· 质量 {fmt(a.massG, 1)} g（{a.massHow}）· 碰撞：{a.colliderUsed === "hull" ? `凸包 ${a.hullPts} 点` : "方块"}</p>); })()}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <label>碰撞体 <select data-testid="mod-collider" className="border border-line bg-white" value={modSel.collider} onChange={(e) => updMod(modSel.id, (m) => { m.collider = e.target.value; })}><option value="hull">凸包</option><option value="box">方块</option></select></label>
                  <label>材料 <select data-testid="mod-material" className="border border-line bg-white" value={modSel.material} onChange={(e) => updMod(modSel.id, (m) => { m.material = e.target.value; })}>{Object.entries(MATERIALS).map(([k, v]) => <option key={k} value={k}>{v.zh} · {v.rho} g/cm³</option>)}</select></label>
                  <label>实测质量 <input data-testid="mod-mass" type="number" min="0" step="0.1" placeholder="留空=估算" className="w-20 border border-line px-1" value={modSel.massG ?? ""} onChange={(e) => updMod(modSel.id, (m) => { const v = parseFloat(e.target.value); m.massG = v > 0 ? Math.min(v, 1e6) : null; })} /> g</label>
                </div>
                <div className="mt-1 text-xs">属于功能：{project.functions.length ? project.functions.map((f) => (
                  <label key={f.id} className="mr-2 inline-flex items-center gap-0.5"><input type="checkbox" checked={f.modules.includes(modSel.id)} onChange={() => updFn(f.id, (x) => { x.modules = x.modules.includes(modSel.id) ? x.modules.filter((y) => y !== modSel.id) : [...x.modules, modSel.id]; })} /><span style={{ color: f.color }}>■</span>{f.name}</label>)) : "（还没有功能）"}</div>
                <div className="mt-1 flex gap-1.5"><button className={btn} onClick={isolateMods}>隔离</button><button className={btn} onClick={() => updMod(modSel.id, (m) => { m.hidden = true; })}>隐藏</button></div>
              </div>
            )}
          </section>
        </div>
      )}

      <details className="mt-4 border border-line bg-paper-2 p-3 text-sm">
        <summary className="cursor-pointer font-medium">这里简化了什么（老实说）</summary>
        <ul className="mt-1 list-disc pl-5 text-xs leading-5">{LAB_SIMPLIFICATIONS.map((s) => <li key={s}>{s}</li>)}</ul>
        <p className="mt-1 text-xs">更多说明见 <Link className="underline" to="/assembly/guide#model-lab">装配指南 · 模型 + 功能图</Link>。</p>
      </details>
    </main>
  );
}
