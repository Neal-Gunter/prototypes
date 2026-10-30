import "../lib/three-base";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { pub } from "../lib/base";
import { Link, useSearchParams } from "react-router-dom";
import { containerClass } from "../container";
import PartsBrowser, { PartDetail, useLibrary, useFavs } from "../assembly/ui/PartsBrowser.jsx";
import { SRC_ZH, LIC_ZH } from "../assembly/partsSearch.js";
const PartViewer = lazy(() => import("../assembly/ui/PartViewer.jsx"));

function Compare({ ids, rows, onClear }) {
  const [a, b] = ids.map((id) => rows.find((r) => r.id === id));
  if (!a || !b) return null;
  const vol = (r) => +(r.dims.x * r.dims.y * r.dims.z / 1000).toFixed(2);
  const line = (k, f) => <tr className="border-b border-line"><th className="py-1 pr-2 text-left font-normal text-ink-soft">{k}</th><td className="pr-2">{f(a)}</td><td>{f(b)}</td></tr>;
  return (
    <section className="mt-6 border border-line bg-white p-3" data-testid="compare-panel">
      <div className="flex items-center justify-between"><h2 className="font-medium">两个零件对比</h2><button type="button" className="border border-line px-2 text-xs" onClick={onClear}>清空对比</button></div>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="border-b border-ink"><th></th><th className="text-left">{a.name_zh}</th><th className="text-left">{b.name_zh}</th></tr></thead>
        <tbody>
          {line("缩略图", (r) => r.real ? <img src={pub(`/lib/thumbs/${r.id}.webp`)} alt="" className="size-20 border border-line object-contain" /> : "程序生成")}
          {line("长", (r) => `${r.dims.x} mm`)}{line("宽", (r) => `${r.dims.z} mm`)}{line("高", (r) => `${r.dims.y} mm`)}
          {line("包围盒体积", (r) => `${vol(r)} cm³`)}
          {line("分类", (r) => r.catLabel || r.cat)}{line("接口", (r) => (r.iface || []).join(" / ") || "—")}
          {line("电压", (r) => (r.vr ? `${r.vr[0]}${r.vr[1] !== r.vr[0] ? `–${r.vr[1]}` : ""} V（名称推断）` : "—"))}
          {line("来源", (r) => SRC_ZH[r.src] || r.src)}{line("许可", (r) => LIC_ZH[r.lic] || r.lic)}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-ink-soft">尺寸差：长 {(a.dims.x - b.dims.x).toFixed(2)} mm，宽 {(a.dims.z - b.dims.z).toFixed(2)} mm，高 {(a.dims.y - b.dims.y).toFixed(2)} mm（前者减后者）。</p>
    </section>
  );
}

export default function PartsPage() {
  const [params, setParams] = useSearchParams();
  const sel = params.get("id") || "kc-raspberrypi_pico";
  const setSel = (id) => setParams((p) => { p.set("id", id); return p; }, { replace: true });
  const { idx, rows } = useLibrary();
  const favs = useFavs();
  const [cmp, setCmp] = useState([]);
  const onCmp = (id) => setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  useEffect(() => { document.title = "零件库 · 硬件工作台"; }, []);
  const stats = useMemo(() => {
    if (!idx) return null;
    const proc = rows.filter((r) => !r.real).length;
    const src = rows.reduce((m, r) => ((m[r.src] = (m[r.src] || 0) + 1), m), {});
    const cats = idx.cats.map((c) => ({ ...c, n: rows.filter((r) => r.cat === c.key).length })).filter((c) => c.n);
    return { real: idx.total, proc, src, cats };
  }, [idx, rows]);
  return (
    <section className={`${containerClass} py-8`} data-testid="parts-page">
      <h1 className="text-3xl font-medium tracking-tight">零件库 <span className="ml-1 border border-copper px-1.5 py-0.5 align-middle text-xs text-copper">早期原型，简化仿真</span></h1>
      {stats && (
        <div className="mt-3 max-w-4xl text-sm leading-6 text-ink-soft" data-testid="parts-counts">
          <p>
            现在共 <b className="text-ink" data-testid="parts-total">{stats.real + stats.proc}</b> 个零件：<b className="text-ink">{stats.real}</b> 个真实 CAD 模型
            （{["ada", "kicad", "sfe", "esp", "seeed", "freecad"].map((k) => `${SRC_ZH[k]} ${stats.src[k] || 0}`).join("、")}），
            加上 <b className="text-ink">{stats.proc}</b> 个按标准尺寸程序生成的零件（ISO 螺丝螺母垫圈、ISO 15 轴承、齿轮、GT2 带轮、铝型材、NEMA 步进电机、舵机尺寸档、电池、保险丝、JST / 杜邦 / XT 插头等）。
          </p>
          <p className="mt-1">按分类：{stats.cats.map((c) => `${c.label} ${c.n}`).join("、")}。</p>
          <p className="mt-1">这仍不是市面上的全部零件：只收许可干净（MIT / CC0 / CC BY / CC BY‑SA）的模型。v21 起电机、舵机、轴承、型材的一部分换成了 FreeCAD 零件库（CC BY 3.0）的真实 CAD（<b className="text-ink" data-testid="parts-replaced">{Object.keys(idx?.replaced || {}).length}</b> 个程序生成零件已有真实版本，筛选“只看最佳模型”可隐藏它们）；其余仍是按标准或估算外形程序生成的近似形状，详情里标“近似形状”。不显示价格。尺寸来自 CAD 包围盒或标准（ISO / JEDEC），没核实的标“估算”。</p>
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="flex h-[72vh] flex-col"><PartsBrowser onPick={setSel} favs={favs} cmp={cmp} onCmp={onCmp} /></div>
        <aside className="border border-line bg-white p-3">
          <h2 className="mb-2 font-medium">零件详情</h2>
          <Suspense fallback={<div className="aspect-square w-full border border-line bg-paper-2" />}><PartViewer id={sel} /></Suspense>
          <div className="mt-2 flex gap-2 text-xs">
            <button type="button" onClick={() => favs.toggleFav(sel)} className="border border-line px-2 py-1" data-testid="detail-fav">{favs.fav.includes(sel) ? "★ 已收藏" : "☆ 收藏"}</button>
            <button type="button" onClick={() => onCmp(sel)} className="border border-line px-2 py-1" data-testid="detail-cmp">{cmp.includes(sel) ? "移出对比" : "加入对比"}（{cmp.length}/2）</button>
          </div>
          <div className="mt-2"><PartDetail id={sel} /></div>
          <Link to="/assembly" className="mt-4 inline-flex min-h-10 items-center border border-ink px-3 hover:bg-ink hover:text-paper-2">去装配台试装</Link>
        </aside>
      </div>
      {cmp.length === 2 && <Compare ids={cmp} rows={rows} onClear={() => setCmp([])} />}
      <p className="mt-6 text-sm text-ink-soft">来源、作者和许可证全文见 <Link className="underline" to="/credits">素材与许可</Link> 和仓库里的 LICENSES.md。</p>
    </section>
  );
}
