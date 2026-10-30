import { createPortal } from "react-dom";
// 工作台里的示波器：用八爪鱼 v10 参考板（维修模式同一块板）的电源树做时域仿真。
// 可以换电池状态、在 5VA 上并一个储能电容，看开机波形和舵机起步时的电压跌落。早期原型，简化仿真。
import { useState } from "react";
import { capture } from "../../repair/tboard.js";
import ScopePanel, { defaultScope, captureOpts } from "../../repair/ui/ScopePanel.jsx";

const btn = "min-h-9 border border-line bg-white px-2.5 text-sm hover:border-copper disabled:opacity-40";
const btnOn = "min-h-9 border border-copper bg-copper px-2.5 text-sm text-white";
import { BATT, CAPS, benchBoard } from "../../sim/refBench.js";
const NODES = ["VBAT", "5VA", "5VB", "EN", "SENSE"];

export default function BenchScope() {
  const [open, setOpen] = useState(false);
  const [batt, setBatt] = useState("fresh");
  const [cap, setCap] = useState(0);
  const [s, setS] = useState(() => { const d = defaultScope(["VBAT", "5VA"]); return { ...d, exp: "power", tdiv: 20e-3, pre: 0.05, trig: { src: 0, slope: "rise", level: 1, mode: "auto" }, chans: d.chans.map((c, i) => (i === 0 ? { ...c, off: -2 } : i === 1 ? { ...c, off: -3 } : c)) }; });
  const run = () => {
    setS((x) => ({ ...x, busy: true }));
    setTimeout(() => {
      const o = captureOpts(s);
      const c = capture(benchBoard({ batt, cap }), { ...o, run: true });
      setS((x) => ({ ...x, busy: false, cap: c }));
      window.__benchScope = { cap: c, batt, cap0: cap };
    }, 20);
  };
  const extra = (
    <div className="space-y-1 border-t border-line pt-1">
      <div className="flex flex-wrap gap-1">{Object.entries(BATT).map(([k, v]) => <button key={k} type="button" className={batt === k ? btnOn : btn} onClick={() => setBatt(k)} data-testid={`bscope-batt-${k}`}>{v.zh}</button>)}</div>
      <div className="flex flex-wrap items-center gap-1">5VA 上并一个电容：{Object.entries(CAPS).map(([k, v]) => <button key={k} type="button" className={+cap === +k ? btnOn : btn} onClick={() => setCap(+k)} data-testid={`bscope-cap-${+k ? Math.round(+k * 1e6) : 0}`}>{v}</button>)}</div>
    </div>
  );
  if (!open) return <button type="button" className={btn} onClick={() => setOpen(true)} data-testid="bench-scope-open">打开示波器（大窗口）</button>;
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-auto bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
    <div className="mx-auto max-w-6xl bg-white p-3 shadow-xl" data-testid="bench-scope">
      <div className="mb-1 flex items-center justify-between"><b>工作台示波器 · 八爪鱼 v10 参考板（时域模式）</b><button type="button" className={btn} onClick={() => setOpen(false)} data-testid="bench-scope-close">关闭</button></div>
      <p className="mb-1 text-xs text-ink-soft">这里仿真的是维修模式里的“八爪鱼 v10 紧凑版”参考板电源树（电池 → 两个 5 V 升压 → 8 个舵机，主控直接吃电池电压）——不是你工作台上此刻连的电路：工作台的电路检查是直流模型，没有时间概念。早期原型，简化仿真，数值均为估算。</p>
      <ScopePanel s={s} set={setS} nodes={NODES} onCapture={run} testid="bscope" extra={extra} />
      <p className="mt-1 text-xs text-ink-soft">可以试：① 新电池、不加电容，抓“舵机起步那一下”，看 5VA 的跌落；② 并 470 µF，跌落明显变小；③ 换老化电池：VBAT 跟着舵机一起往下掉，主控（接在电池上）会欠压复位——这时在 5VA 上加多大的电容都救不了，要换电池或者给主控单独稳压；④ 并 1000 µF 再抓“开机那一下”：升压模块给大电容充电的冲击电流会把电池拉低（这也是真实会遇到的）。</p>
    </div>
    </div>, document.body);
}
