import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { containerClass } from "../container";
import PartsBrowser, { PartDetail, useLibrary } from "../assembly/ui/PartsBrowser.jsx";

export default function PartsPage() {
  const [sel, setSel] = useState("kc-raspberrypi_pico");
  const { idx, rows } = useLibrary();
  useEffect(() => { document.title = "零件库 · 硬件工作台"; }, []);
  const stats = useMemo(() => {
    if (!idx) return null;
    const proc = rows.filter((r) => !r.real).length;
    const thin = idx.cats.filter((c) => c.real < 15);
    const src = rows.filter((r) => r.real).reduce((m, r) => ((m[r.lic] = (m[r.lic] || 0) + 1), m), {});
    return { real: idx.total, proc, thin, src };
  }, [idx, rows]);
  return (
    <section className={`${containerClass} py-8`} data-testid="parts-page">
      <h1 className="text-3xl font-medium tracking-tight">零件库 <span className="ml-1 border border-copper px-1.5 py-0.5 align-middle text-xs text-copper">早期原型，简化仿真</span></h1>
      {stats && (
        <div className="mt-3 max-w-3xl text-sm leading-6 text-ink-soft" data-testid="parts-counts">
          <p>
            现在有 <b className="text-ink">{stats.real}</b> 个真实 CAD 模型（Adafruit CAD Parts，MIT：{stats.src.MIT || 0} 个；KiCad 3D 模型库，CC BY‑SA 4.0：{stats.src["CC-BY-SA-4.0"] || 0} 个），
            加上 <b className="text-ink">{stats.proc}</b> 个按标准尺寸程序生成的零件（螺丝、螺母、铜柱、底板、支架、面包板、插头等）。
          </p>
          <p className="mt-1">
            这远不是市面上的全部零件。偏少的分类：{stats.thin.map((c) => `${c.label} ${c.real} 个`).join("、")}；紧固件和工具没有真实 CAD 模型，只有程序生成的。
          </p>
          <p className="mt-1">不显示价格。尺寸来自 CAD 包围盒或标准（ISO），没核实的标“估算”。</p>
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex h-[70vh] flex-col"><PartsBrowser onPick={setSel} /></div>
        <aside className="border border-line bg-white p-3">
          <h2 className="mb-2 font-medium">零件详情</h2>
          {sel && <img src={`/lib/thumbs/${sel}.webp`} alt="" className="mb-2 aspect-square w-40 border border-line object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
          <PartDetail id={sel} />
          <Link to="/assembly" className="mt-4 inline-flex min-h-10 items-center border border-ink px-3 hover:bg-ink hover:text-paper-2">去装配台试装</Link>
        </aside>
      </div>
      <p className="mt-6 text-sm text-ink-soft">来源和许可证全文见 <Link className="underline" to="/credits">素材与许可</Link> 和仓库里的 LICENSES.md。</p>
    </section>
  );
}
