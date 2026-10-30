import { pub } from "../../lib/base";
// 零件库浏览：搜索、分类、缩略图、真实尺寸（不显示价格）
import { useEffect, useMemo, useState } from "react";
import { loadIndex, getEntry } from "../catalog.js";
import { PROCEDURAL } from "../procedural.js";
import { Link } from "react-router-dom";

import { filterRows, voltRange, SRC_ZH, LIC_ZH as LIC_SHORT, IFACE_ZH } from "../partsSearch.js";

const LIC_ZH = { MIT: "MIT", "CC-BY-SA-4.0": "CC BY‑SA 4.0（KiCad 例外条款）", "CC-BY-4.0": "CC BY 4.0", "CC-BY-3.0": "CC BY 3.0（署名，作者见下）", CC0: "CC0（本项目程序生成）" };
const fmt = (d) => (d ? `${d.x} × ${d.z} × ${d.y} mm` : "—");
export function estMassG(e) {
  if (e.mass) return { g: e.mass, est: false };
  const dens = e.density || (e.cat === "motor" ? 1.6 : e.cat === "connector" ? 1.2 : 1.85);
  const v = (e.colliders || []).reduce((s, c) => s + (c.vol ?? 8 * c.h[0] * c.h[1] * c.h[2]), 0); // v23：凸包带体积 vol（cm³）
  return { g: +(v * dens).toFixed(v * dens < 1 ? 2 : 1), est: true };
}
// v20：收藏和最近使用存在浏览器 localStorage（不上传）
const LS = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式 */ } } };
export function useFavs() {
  const [fav, setFav] = useState(() => LS.get("parts-fav"));
  const [recent, setRecent] = useState(() => LS.get("parts-recent"));
  const toggleFav = (id) => setFav((f) => { const n = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]; LS.set("parts-fav", n); return n; });
  const touch = (id) => setRecent((r) => { const n = [id, ...r.filter((x) => x !== id)].slice(0, 30); LS.set("parts-recent", n); return n; });
  return { fav, recent, toggleFav, touch };
}
export function useLibrary() {
  const [idx, setIdx] = useState(null);
  useEffect(() => { loadIndex().then(setIdx); }, []);
  const rows = useMemo(() => {
    if (!idx) return [];
    const catLabel = Object.fromEntries(idx.cats.map((c) => [c.key, c.label]));
    const real = idx.parts.map(([id, name, name_zh, cat, d, lic, src, tags]) => {
      const t = (tags || "").split(" ").filter(Boolean);
      const volts = t.filter((x) => /V$/.test(x)).map((x) => parseFloat(x));
      return { id, name, name_zh, cat, catLabel: catLabel[cat], dims: { x: d[0], y: d[2], z: d[1] }, lic, src: src || (lic === "MIT" ? "ada" : "kicad"), iface: t.filter((x) => !/V$/.test(x)), vr: voltRange(volts.length ? volts : null), tags, real: true };
    });
    const proc = PROCEDURAL.filter((d) => !d.notPlaceable).map((d) => ({ id: d.id, name: d.name, name_zh: d.name_zh, cat: d.cat, catLabel: catLabel[d.cat], dims: d.dims_mm, lic: "CC0", src: "proc", iface: d.iface || [], vr: voltRange(d.volt), tags: `${d.spec || ""} ${d.volt || ""} ${d.rating || ""}`, real: false, sup: idx.replaced?.[d.id] }));
    return [...real, ...proc];
  }, [idx]);
  return { idx, rows };
}
function Thumb({ id, real }) {
  const [bad, setBad] = useState(false);
  if (bad || !real) return <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center border border-line bg-paper-2 text-[10px] text-ink-soft">{real ? "CAD" : "程序"}</div>;
  return <img src={pub(`/lib/thumbs/${id}.webp`)} alt="" loading="lazy" width="48" height="48" className="size-12 shrink-0 border border-line bg-white object-contain" onError={() => setBad(true)} />;
}
const VOLTS = ["1.5", "3", "3.3", "3.7", "5", "6", "9", "12", "24", "48", "250"];
const SEL = "border border-line bg-white px-1 py-1";
export default function PartsBrowser({ onAdd, compact = false, onPick, favs: favsIn, cmp, onCmp }) {
  const { idx, rows } = useLibrary();
  const own = useFavs();
  const favs = favsIn || own;
  const [q, setQ] = useState("");
  const [f, setF] = useState({ cat: "all", kind: "all", iface: "all", volt: "all", lic: "all", src: "all", minMm: "", maxMm: "", view: "all" });
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const [limit, setLimit] = useState(compact ? 60 : 200);
  useEffect(() => setLimit(compact ? 60 : 200), [q, f, compact]);
  const counts = useMemo(() => {
    const m = {};
    for (const r of rows) { m[r.cat] ||= { real: 0, proc: 0 }; m[r.cat][r.real ? "real" : "proc"]++; }
    return m;
  }, [rows]);
  const ifaces = useMemo(() => { const m = {}; for (const r of rows) for (const i of r.iface || []) m[i] = (m[i] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [rows]);
  const list = useMemo(() => {
    const only = f.view === "fav" ? new Set(favs.fav) : f.view === "recent" ? new Set(favs.recent) : null;
    let out = filterRows(rows, { ...f, q, only });
    if (f.view === "recent") { const o = favs.recent; out = out.sort((a, b) => o.indexOf(a.id) - o.indexOf(b.id)); }
    return out;
  }, [rows, q, f, favs.fav, favs.recent]);
  const pick = (id) => { favs.touch(id); onPick?.(id); };
  if (!idx) return <p className="text-sm text-ink-soft">正在加载零件目录…</p>;
  return (
    <div className={`flex min-h-0 flex-col gap-2 ${compact ? "shrink-0" : ""}`} data-testid="parts-browser">
      <label className="text-sm">
        <span className="sr-only">搜索零件</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="中英文都能搜：舵机 / servo、继电器 5V、JST XH 4、轴承 608、2020 型材…" className="w-full border border-line bg-white px-2 py-1.5 text-sm" data-testid="parts-search" />
      </label>
      <div className="flex flex-wrap gap-1 text-xs" data-testid="parts-filters">
        <select value={f.view} onChange={set("view")} className={SEL} aria-label="视图" data-testid="f-view">
          <option value="all">全部</option><option value="fav">收藏（{favs.fav.length}）</option><option value="recent">最近使用（{favs.recent.length}）</option>
        </select>
        <select value={f.cat} onChange={set("cat")} className={SEL} aria-label="分类" data-testid="f-cat">
          <option value="all">全部分类（{rows.length}）</option>
          {idx.cats.map((c) => {
            const n = counts[c.key] || { real: 0, proc: 0 };
            if (!n.real && !n.proc) return null;
            return <option key={c.key} value={c.key}>{c.label}（真实 {n.real}{n.proc ? ` + 程序 ${n.proc}` : ""}）</option>;
          })}
        </select>
        {!compact && (<>
          <select value={f.iface} onChange={set("iface")} className={SEL} aria-label="接口" data-testid="f-iface">
            <option value="all">任意接口</option>
            {ifaces.map(([k, n]) => <option key={k} value={k}>{IFACE_ZH[k] || k}（{n}）</option>)}
          </select>
          <select value={f.volt} onChange={set("volt")} className={SEL} aria-label="电压" data-testid="f-volt">
            <option value="all">任意电压</option>
            {VOLTS.map((v) => <option key={v} value={v}>适用 {v} V</option>)}
          </select>
          <select value={f.lic} onChange={set("lic")} className={SEL} aria-label="许可" data-testid="f-lic">
            <option value="all">任意许可</option>
            {Object.entries(LIC_SHORT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={f.src} onChange={set("src")} className={SEL} aria-label="来源" data-testid="f-src">
            <option value="all">任意来源</option>
            {Object.entries(SRC_ZH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span className="flex items-center gap-1">最大边
            <input value={f.minMm} onChange={set("minMm")} inputMode="decimal" placeholder="≥ mm" aria-label="最大边下限 mm" className="w-14 border border-line bg-white px-1 py-1" data-testid="f-min" />–
            <input value={f.maxMm} onChange={set("maxMm")} inputMode="decimal" placeholder="≤ mm" aria-label="最大边上限 mm" className="w-14 border border-line bg-white px-1 py-1" data-testid="f-max" />
          </span>
        </>)}
        <select value={f.kind} onChange={set("kind")} className={SEL} aria-label="真实或程序" data-testid="f-kind">
          <option value="all">真实 CAD + 程序生成</option>
          <option value="real">只看真实 CAD 模型</option>
          <option value="proc">只看程序生成</option>
          <option value="best">隐藏已有真实 CAD 的近似件</option>
          <option value="sup">只看已被真实 CAD 替换的近似件</option>
        </select>
      </div>
      <p className="text-xs text-ink-soft" data-testid="parts-found">找到 {list.length} 个{list.length > limit ? `，显示前 ${limit} 个` : ""}。尺寸为 长 × 宽 × 高。接口 / 电压标签多数从名称推断（我的补充），以数据手册为准。</p>
      <ul className={`min-h-0 flex-1 divide-y divide-line overflow-y-auto border border-line bg-white ${compact ? "max-h-[46vh] min-h-[9rem]" : ""}`} data-testid="parts-list">
        {list.slice(0, limit).map((r) => (
          <li key={r.id} className="flex items-center gap-2 px-2 py-1.5" data-testid={`row-${r.id}`}>
            <Thumb id={r.id} real={r.real} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => pick(r.id)} data-testid={`pick-${r.id}`}>
              <span className="block truncate text-sm">{r.name_zh}</span>
              {!r.real ? <span className="mr-1 inline-block border border-amber-700 px-1 text-[10px] text-amber-800" data-testid={`approx-${r.id}`}>近似形状（程序生成）</span> : null}
              <span className="block truncate text-xs text-ink-soft">{fmt(r.dims)} · {SRC_ZH[r.src] || r.src} · {LIC_SHORT[r.lic] || r.lic}{r.iface?.length ? ` · ${r.iface.map((i) => IFACE_ZH[i] || i).join("/")}` : ""}</span>
            </button>
            {r.sup ? <button type="button" onClick={() => pick(r.sup)} className="shrink-0 border border-line px-1 text-[10px] underline" title="这个近似件已有真实 CAD 版本" data-testid={`sup-${r.id}`}>真实 CAD：{r.sup}</button> : null}
            <button type="button" onClick={() => favs.toggleFav(r.id)} aria-pressed={favs.fav.includes(r.id)} aria-label={favs.fav.includes(r.id) ? "取消收藏" : "收藏"} className="shrink-0 px-1 text-base" data-testid={`fav-${r.id}`}>{favs.fav.includes(r.id) ? "★" : "☆"}</button>
            {onCmp && (
              <label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={!!cmp?.includes(r.id)} onChange={() => onCmp(r.id)} data-testid={`cmp-${r.id}`} />对比</label>
            )}
            {onAdd && (
              <button type="button" onClick={() => { favs.touch(r.id); onAdd(r.id); }} className="shrink-0 border border-ink px-2 py-1 text-xs hover:bg-ink hover:text-paper-2" data-testid={`add-${r.id}`}>
                放到桌上
              </button>
            )}
          </li>
        ))}
        {list.length > limit && (
          <li className="p-2 text-center"><button type="button" onClick={() => setLimit((l) => l + 200)} className="border border-line px-3 py-1 text-xs" data-testid="parts-more">再显示 200 个</button></li>
        )}
      </ul>
    </div>
  );
}
// v20：“用在哪里”——查装配指南的物料清单
let guideP = null;
const loadGuide = () => (guideP ||= fetch(pub("/guides/electrics.json")).then((r) => r.json()).catch(() => null));
let pinIdxP = null;
const pinIdx = () => (pinIdxP ||= fetch(pub("/pinouts/index.json")).then((r) => r.json()).catch(() => ({ boards: [] })));
function PinoutLink({ id }) {
  const [b, setB] = useState(null);
  useEffect(() => { let live = true; pinIdx().then((x) => live && setB(x.boards.find((y) => y.parts?.includes(id)) || null)); return () => { live = false; }; }, [id]);
  if (!b) return null;
  return (<><dt className="text-ink-soft">引脚表</dt><dd><Link className="underline" data-testid="pinout-link" to={`/pinouts?b=${b.id}`}>{b.zh}（{b.n} 脚，{b.logicV ? `${b.logicV} V 逻辑` : "电平见说明"}{b.est ? "，估算" : ""}）</Link></dd></>);
}
export function PartDetail({ id }) {
  const [e, setE] = useState(null);
  const [used, setUsed] = useState(null);
  const [sup, setSup] = useState(null);
  useEffect(() => { if (id) getEntry(id).then(setE).catch(() => setE(null)); }, [id]);
  useEffect(() => { setSup(null); loadIndex().then((x) => setSup(x?.replaced?.[id] || null)).catch(() => {}); }, [id]);
  useEffect(() => {
    setUsed(null);
    loadGuide().then((g) => {
      const b = g?.bom?.find((x) => x.id === id);
      setUsed(b ? [{ zh: `装配指南「${g.title}」物料 ${b.refs.join(" ")}`, href: `/assembly/guide#bom-${id}` }] : []);
    });
  }, [id]);
  if (!e) return null;
  const m = estMassG(e);
  const holes = e.holes || (e.anchors || []).filter((a) => /hole|thread/.test(a.t));
  return (
    <dl className="grid grid-cols-[6em_1fr] gap-x-2 gap-y-1 text-sm" data-testid="part-detail">
      <dt className="text-ink-soft">名称</dt><dd>{e.name_zh}{e.name && e.name !== e.name_zh ? <span className="text-ink-soft"> · {e.name}</span> : null}</dd>
      <dt className="text-ink-soft">模型</dt><dd data-testid="model-kind">{e.glb ? (e.derived_from ? `真实 CAD（截面来自 ${e.derived_from}，只沿长度方向缩放到 ${Math.max(e.dims_mm.x, e.dims_mm.y, e.dims_mm.z)} mm）` : "真实 CAD（由来源 STEP 转换）") : <span className="text-amber-800">近似形状（程序生成）：外形按公开标准尺寸拼的简化几何，细节不真实{sup ? `；已有真实 CAD 版本：${sup}` : "；目前没找到许可清楚的真实 CAD"}</span>}</dd>
      <dt className="text-ink-soft">尺寸</dt><dd>{fmt(e.dims_mm)}<span className="text-ink-soft">（{e.dims_src}）</span></dd>
      <dt className="text-ink-soft">质量</dt><dd>{m.g} g{m.est ? <span className="text-ink-soft">（估算：碰撞盒体积 × 密度）</span> : null}</dd>
      <dt className="text-ink-soft">安装孔</dt><dd>{holes.length ? `${holes.length} 个${e.holes?.[0]?.d ? `，孔径 ${e.holes[0].d} mm` : ""}${e.holes_src ? `（${e.holes_src}）` : e.holes ? "（从 CAD 几何提取）" : ""}` : "无"}</dd>
      <dt className="text-ink-soft">引脚间距</dt><dd>{e.pitch_mm ? `${e.pitch_mm} mm（从 CAD 提取）` : e.spec || (e.pinholes ? `${e.pinholes.length} 个引脚孔` : "—")}</dd>
      <PinoutLink id={e.id || id} />
      {e.pins ? (<><dt className="text-ink-soft">针数</dt><dd>{e.pins}</dd></>) : null}
      {e.rating ? (<><dt className="text-ink-soft">额定</dt><dd>{e.rating}<span className="text-ink-soft">（{e.rating_src || "估算"}）</span></dd></>) : null}
      {e.volt ? (<><dt className="text-ink-soft">电压</dt><dd>{e.volt}</dd></>) : null}
      {e.iface?.length ? (<><dt className="text-ink-soft">接口</dt><dd>{e.iface.map((i) => IFACE_ZH[i] || i).join("、")}{e.tags_src ? <span className="text-ink-soft">（{e.tags_src}）</span> : null}</dd></>) : null}
      <dt className="text-ink-soft">来源</dt><dd>{e.url ? <a className="underline" href={e.url} target="_blank" rel="noreferrer">{e.source}</a> : "本项目程序生成"}</dd>
      {e.author ? (<><dt className="text-ink-soft">作者</dt><dd>{e.author}</dd></>) : null}
      <dt className="text-ink-soft">许可</dt><dd>{LIC_ZH[e.licence] || e.licence || "CC0（本项目程序生成）"}</dd>
      <dt className="text-ink-soft">用在</dt><dd data-testid="used-in">{used === null ? "…" : used.length ? used.map((u) => <Link key={u.href} to={u.href} className="mr-2 underline">{u.zh}</Link>) : "现有装配指南里还没用到"}</dd>
      {e.est?.length ? (<><dt className="text-ink-soft">估算项</dt><dd>{e.est.join("、")}</dd></>) : null}
    </dl>
  );
}
