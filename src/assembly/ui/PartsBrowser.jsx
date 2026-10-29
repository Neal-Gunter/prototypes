// 零件库浏览：搜索、分类、缩略图、真实尺寸（不显示价格）
import { useEffect, useMemo, useState } from "react";
import { loadIndex, getEntry } from "../catalog.js";
import { PROCEDURAL } from "../procedural.js";

const LIC_ZH = { MIT: "MIT", "CC-BY-SA-4.0": "CC BY‑SA 4.0（KiCad 例外条款）" };
const fmt = (d) => (d ? `${d.x} × ${d.z} × ${d.y} mm` : "—");
export function estMassG(e) {
  if (e.mass) return { g: e.mass, est: false };
  const dens = e.density || (e.cat === "motor" ? 1.6 : e.cat === "connector" ? 1.2 : 1.85);
  const v = (e.colliders || []).reduce((s, c) => s + 8 * c.h[0] * c.h[1] * c.h[2], 0);
  return { g: +(v * dens).toFixed(v * dens < 1 ? 2 : 1), est: true };
}
export function useLibrary() {
  const [idx, setIdx] = useState(null);
  useEffect(() => { loadIndex().then(setIdx); }, []);
  const rows = useMemo(() => {
    if (!idx) return [];
    const real = idx.parts.map(([id, name, name_zh, cat, d, lic]) => ({ id, name, name_zh, cat, dims: { x: d[0], y: d[2], z: d[1] }, lic, real: true }));
    const proc = PROCEDURAL.filter((d) => !d.notPlaceable).map((d) => ({ id: d.id, name: d.name, name_zh: d.name_zh, cat: d.cat, dims: d.dims_mm, lic: "CC0（本项目程序生成）", real: false }));
    return [...real, ...proc];
  }, [idx]);
  return { idx, rows };
}
function Thumb({ id, real }) {
  const [bad, setBad] = useState(false);
  if (bad || !real) return <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center border border-line bg-paper-2 text-[10px] text-ink-soft">{real ? "CAD" : "程序"}</div>;
  return <img src={`/lib/thumbs/${id}.webp`} alt="" loading="lazy" width="48" height="48" className="size-12 shrink-0 border border-line bg-white object-contain" onError={() => setBad(true)} />;
}
export default function PartsBrowser({ onAdd, compact = false, onPick }) {
  const { idx, rows } = useLibrary();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [kind, setKind] = useState("all");
  const counts = useMemo(() => {
    const m = {};
    for (const r of rows) { m[r.cat] ||= { real: 0, proc: 0 }; m[r.cat][r.real ? "real" : "proc"]++; }
    return m;
  }, [rows]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (cat === "all" || r.cat === cat) && (kind === "all" || (kind === "real") === r.real) && (!s || `${r.id} ${r.name} ${r.name_zh}`.toLowerCase().includes(s)));
  }, [rows, q, cat, kind]);
  const limit = compact ? 60 : 300;
  if (!idx) return <p className="text-sm text-ink-soft">正在加载零件目录…</p>;
  return (
    <div className="flex min-h-0 flex-col gap-2" data-testid="parts-browser">
      <label className="text-sm">
        <span className="sr-only">搜索零件</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索：pico、舵机、M3、排针、OLED…" className="w-full border border-line bg-white px-2 py-1.5 text-sm" data-testid="parts-search" />
      </label>
      <div className="flex flex-wrap gap-1 text-xs">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="border border-line bg-white px-1 py-1" aria-label="分类">
          <option value="all">全部分类（{rows.length}）</option>
          {idx.cats.map((c) => {
            const n = counts[c.key] || { real: 0, proc: 0 };
            return <option key={c.key} value={c.key}>{c.label}（真实 {n.real}{n.proc ? ` + 程序 ${n.proc}` : ""}）</option>;
          })}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-line bg-white px-1 py-1" aria-label="来源">
          <option value="all">真实 CAD + 程序生成</option>
          <option value="real">只看真实 CAD 模型</option>
          <option value="proc">只看程序生成</option>
        </select>
      </div>
      <p className="text-xs text-ink-soft">找到 {list.length} 个{list.length > limit ? `，先显示前 ${limit} 个` : ""}。尺寸为 长 × 宽 × 高。</p>
      <ul className={`min-h-0 flex-1 divide-y divide-line overflow-y-auto border border-line bg-white ${compact ? "max-h-[46vh]" : ""}`}>
        {list.slice(0, limit).map((r) => (
          <li key={r.id} className="flex items-center gap-2 px-2 py-1.5">
            <Thumb id={r.id} real={r.real} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onPick?.(r.id)}>
              <span className="block truncate text-sm">{r.name_zh}</span>
              <span className="block truncate text-xs text-ink-soft">{fmt(r.dims)} · {r.real ? LIC_ZH[r.lic] || r.lic : "程序生成"}</span>
            </button>
            {onAdd && (
              <button type="button" onClick={() => onAdd(r.id)} className="shrink-0 border border-ink px-2 py-1 text-xs hover:bg-ink hover:text-paper-2" data-testid={`add-${r.id}`}>
                放到桌上
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
export function PartDetail({ id }) {
  const [e, setE] = useState(null);
  useEffect(() => { if (id) getEntry(id).then(setE).catch(() => setE(null)); }, [id]);
  if (!e) return null;
  const m = estMassG(e);
  const holes = e.holes || (e.anchors || []).filter((a) => /hole|thread/.test(a.t));
  return (
    <dl className="grid grid-cols-[6em_1fr] gap-x-2 gap-y-1 text-sm" data-testid="part-detail">
      <dt className="text-ink-soft">名称</dt><dd>{e.name_zh}{e.name && e.name !== e.name_zh ? <span className="text-ink-soft"> · {e.name}</span> : null}</dd>
      <dt className="text-ink-soft">尺寸</dt><dd>{fmt(e.dims_mm)}<span className="text-ink-soft">（{e.dims_src}）</span></dd>
      <dt className="text-ink-soft">质量</dt><dd>{m.g} g{m.est ? <span className="text-ink-soft">（估算：碰撞盒体积 × 密度）</span> : null}</dd>
      <dt className="text-ink-soft">安装孔</dt><dd>{holes.length ? `${holes.length} 个${e.holes?.[0]?.d ? `，孔径 ${e.holes[0].d} mm` : ""}${e.holes_src ? `（${e.holes_src}）` : e.holes ? "（从 CAD 几何提取）" : ""}` : "无"}</dd>
      <dt className="text-ink-soft">引脚间距</dt><dd>{e.pitch_mm ? `${e.pitch_mm} mm（从 CAD 提取）` : e.spec || (e.pinholes ? `${e.pinholes.length} 个引脚孔` : "—")}</dd>
      <dt className="text-ink-soft">来源</dt><dd>{e.url ? <a className="underline" href={e.url} target="_blank" rel="noreferrer">{e.source}</a> : "本项目程序生成"}</dd>
      <dt className="text-ink-soft">许可</dt><dd>{LIC_ZH[e.licence] || e.licence}</dd>
      {e.est?.length ? (<><dt className="text-ink-soft">估算项</dt><dd>{e.est.join("、")}</dd></>) : null}
    </dl>
  );
}
