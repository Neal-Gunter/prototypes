import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { containerClass } from "../container";
import { pub } from "../lib/base";

// v21：开发板 / 模组 / 驱动板引脚表。引脚号→名称来自 KiCad 官方符号库（CC BY-SA 4.0，含设计例外），
// 逻辑电平来自官方数据手册或厂家文档；没有开放来源的标“估算”。早期原型，简化仿真。
const ROLE = { gnd: ["GND", "bg-slate-800 text-white"], "3v3": ["3V3", "bg-orange-200"], "5v": ["5V", "bg-red-200"], power: ["电源", "bg-rose-100"], ctrl: ["复位/使能", "bg-violet-100"], ref: ["参考电压", "bg-amber-100"], nc: ["空脚", "bg-slate-100 text-ink-soft"], io: ["IO", "bg-emerald-50"] };
const TYPE_ZH = { bidirectional: "双向", input: "输入", output: "输出", power_in: "电源输入", power_out: "电源输出", passive: "无源", no_connect: "不接", tri_state: "三态", open_collector: "开集", open_emitter: "开射", unspecified: "未指定", free: "自由" };

export default function PinoutsPage() {
  const [sp, setSp] = useSearchParams();
  const [idx, setIdx] = useState(null);
  const [b, setB] = useState(null);
  const [q, setQ] = useState("");
  const id = sp.get("b") || "rpi-pico";
  useEffect(() => { document.title = "引脚表 · 早期原型"; fetch(pub("/pinouts/index.json")).then((r) => r.json()).then(setIdx).catch(() => setIdx({ boards: [] })); }, []);
  useEffect(() => { setB(null); fetch(pub(`/pinouts/${id}.json`)).then((r) => r.json()).then(setB).catch(() => setB({ err: true })); }, [id]);
  const pins = useMemo(() => (b?.pins || []).filter((p) => !q || `${p.num} ${p.name}`.toLowerCase().includes(q.toLowerCase())), [b, q]);
  return (
    <div className={`${containerClass} py-6`} data-testid="pinouts-page">
      <h1 className="text-2xl font-semibold">引脚表</h1>
      <p className="mt-1 text-sm text-ink-soft">早期原型，简化仿真。引脚号 → 名称来自 KiCad 官方符号库（固定到提交 {idx?.kicadSha?.slice(0, 8)}），逻辑电平来自各自的数据手册 / 厂家文档；台面接线时按这些电平检查“3V3 接 5V”“输出冲突”等问题。</p>
      <div className="mt-4 grid gap-4 md:grid-cols-[16rem_1fr]">
        <ul className="max-h-[70vh] overflow-auto rounded border border-line text-sm" data-testid="pinout-list">
          {(idx?.boards || []).map((x) => (
            <li key={x.id}>
              <button type="button" data-testid={`pinout-${x.id}`} onClick={() => setSp({ b: x.id })} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-paper-2 ${x.id === id ? "bg-paper-2 font-medium" : ""}`}>
                <span>{x.zh}</span>
                <span className="shrink-0 text-xs text-ink-soft">{x.logicV ? `${x.logicV} V` : "—"}{x.est ? " · 估算" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
        <section>
          {!b ? <p className="text-ink-soft">正在加载…</p> : b.err ? <p className="text-red-700">没有这块板的引脚表</p> : (
            <>
              <h2 className="text-xl font-semibold" data-testid="pinout-title">{b.zh}{b.est ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">估算</span> : null}</h2>
              <dl className="mt-2 grid grid-cols-[7em_1fr] gap-x-2 gap-y-1 text-sm">
                <dt className="text-ink-soft">逻辑电平</dt>
                <dd data-testid="pinout-logic">{b.logicV ? `${b.logicV} V` : "见说明"}，{b.tol5v ? "可以接 5 V 信号" : <b className="text-red-700">GPIO 不耐 5 V（接 5 V 信号要分压 / 电平转换）</b>}{b.levelSrc ? <> · <a className="underline" href={b.levelSrc} target="_blank" rel="noreferrer">电平来源</a></> : null}</dd>
                {b.note ? (<><dt className="text-ink-soft">说明</dt><dd>{b.note}</dd></>) : null}
                <dt className="text-ink-soft">引脚来源</dt>
                <dd className="break-all">{b.src ? <a className="underline" href={b.src} target="_blank" rel="noreferrer" data-testid="pinout-src">{b.src.replace(/^https:\/\//, "").slice(0, 90)}</a> : "无开放来源（估算）"}{b.srcBase ? <> · 继承自 <a className="underline" href={b.srcBase} target="_blank" rel="noreferrer">父符号</a></> : null}</dd>
                <dt className="text-ink-soft">许可</dt><dd>{b.lic}</dd>
                {b.datasheet ? (<><dt className="text-ink-soft">数据手册</dt><dd className="break-all"><a className="underline" href={b.datasheet} target="_blank" rel="noreferrer">{b.datasheet.slice(0, 90)}</a></dd></>) : null}
                {b.parts?.length ? (<><dt className="text-ink-soft">零件库</dt><dd>{b.parts.map((p) => <Link key={p} className="mr-2 underline" to={`/parts?id=${encodeURIComponent(p)}`}>{p}</Link>)}</dd></>) : null}
              </dl>
              <input className="mt-3 w-full rounded border border-line px-3 py-2 text-sm md:w-64" placeholder="筛选：脚号 / 名称，如 GPIO15、TX" value={q} onChange={(e) => setQ(e.target.value)} data-testid="pinout-filter" />
              <table className="mt-2 w-full text-sm" data-testid="pinout-table">
                <thead><tr className="border-b border-line text-left text-ink-soft"><th className="py-1 pr-2">脚号</th><th className="pr-2">名称</th><th className="pr-2">KiCad 类型</th><th>归类</th></tr></thead>
                <tbody>
                  {pins.map((p) => (
                    <tr key={p.num + p.name} className="border-b border-line/50">
                      <td className="py-1 pr-2 tabular-nums">{p.num}</td>
                      <td className="pr-2 font-mono">{p.name}</td>
                      <td className="pr-2 text-ink-soft">{TYPE_ZH[p.type] || p.type}</td>
                      <td><span className={`rounded px-1.5 py-0.5 text-xs ${ROLE[p.role]?.[1] || ""}`}>{ROLE[p.role]?.[0] || p.role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-ink-soft">我的补充：“归类”是按引脚名自动分的（GND / 3V3 / 5V / 电源 / 复位 / IO），方便台面检查用，不是数据手册原文；KiCad 类型为符号库原文。复用功能（ADC、UART、I²C 等）以各数据手册为准。</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
