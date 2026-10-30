// v14：闭环倾斜 / 航向反馈面板（八爪鱼和模型实验室共用）。增益滑杆、斜坡滑杆、IMU 噪声说明、开环 vs 闭环对比。
// runCompare({ctrl, slope, load}) 由调用方提供：返回 {open, closed} 两份测量报告
import { useState } from "react";
import { IMU_EST } from "./ctrl.js";
const B = ({ children, on, dis, t, cls = "" }) => <button type="button" disabled={dis} onClick={on} data-testid={t} className={`min-h-7 border border-line bg-white px-2 text-xs disabled:opacity-40 ${cls}`}>{children}</button>;
const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? "—" : (+v).toFixed(d));
const SL = ({ zh, k, c, set, min, max, step, t }) => <label className="flex items-center gap-0.5">{zh}<input type="range" min={min} max={max} step={step} value={c[k]} onChange={(e) => set({ ...c, [k]: +e.target.value })} data-testid={`${t}-${k}`} /><span className="w-10 font-mono">{(+c[k]).toFixed(step < 0.01 ? 3 : 2)}</span></label>;
// props: defaults（增益初值）, loadKind（"load" = 八爪鱼机身上加负载；"drop" = 真方块掉到机身上）, onLive(cfg|null, slope)（台面上实时开 / 关闭环）, runCompare, exports, note, tid
export default function CtrlPanel({ defaults, loadKind = "load", onLive, runCompare, exports = [], note, tid = "ctrl", slopeMax = 10, defaultSlope = 3 }) {
  const [c, setC] = useState(defaults);
  const [slope, setSlope] = useState(defaultSlope);
  const [dir, setDir] = useState("cross");
  const [load, setLoad] = useState(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState(null);
  async function compare() {
    setBusy(0);
    try { const r = await runCompare({ ctrl: c, slope: slope ? { deg: slope, dir } : null, load: load ? (loadKind === "drop" ? { g: 60, t: 2, x: 3 } : { g: 30, x: 3, z: 0, t: 2 }) : null, onProgress: (p) => new Promise((ok) => { setBusy(p); setTimeout(ok, 0); }) }); setRes(r); window.__ctrlLast = window.__ctrlLast || {}; window.__ctrlLast[tid] = r; }
    catch (e) { setRes({ err: String(e?.message || e) }); } finally { setBusy(null); }
  }
  const download = (o) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([o.text], { type: o.mime || "text/plain" })); a.download = o.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const rows = [["速度 cm/s", "speed", 3], ["侧向漂移 cm", "dx", 2], ["航向变化 °", "dh", 1], ["机身最大倾角（相对重力）°", "tiltGMax", 2], ["平均倾角（相对重力）°", "tiltGAvg", 2]];
  return (
    <fieldset className="flex flex-col gap-1 border border-line bg-white p-2 text-xs" data-testid={`${tid}-panel`}>
      <legend className="font-medium">闭环倾斜 / 航向反馈（v14 · 仿真 IMU + PD）· 早期原型，简化仿真</legend>
      <div className="flex flex-wrap gap-2" data-testid={`${tid}-gains`}>
        <SL zh="航向 Kp" k="kpH" c={c} set={setC} min={0} max={0.15} step={0.005} t={tid} />
        <SL zh="航向 Kd" k="kdH" c={c} set={setC} min={0} max={0.02} step={0.001} t={tid} />
        <SL zh="倾斜 Kp" k="kpT" c={c} set={setC} min={0} max={3} step={0.05} t={tid} />
        <SL zh="倾斜 Kd" k="kdT" c={c} set={setC} min={0} max={0.2} step={0.005} t={tid} />
        <label className="flex items-center gap-0.5">转向符号<select value={c.turnSign} onChange={(e) => setC({ ...c, turnSign: +e.target.value })} data-testid={`${tid}-turnsign`} className="border border-line bg-white"><option value={1}>+1</option><option value={-1}>−1</option></select></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-0.5">地面坡度<input type="range" min="0" max={slopeMax} step="0.5" value={slope} onChange={(e) => setSlope(+e.target.value)} data-testid={`${tid}-slope`} /><span className="w-10 font-mono" data-testid={`${tid}-slope-val`}>{slope}°</span></label>
        <select value={dir} onChange={(e) => setDir(e.target.value)} data-testid={`${tid}-dir`} className="border border-line bg-white"><option value="cross">横坡（往右下）</option><option value="crossL">横坡（往左下）</option><option value="down">顺坡（往前下）</option><option value="up">上坡</option></select>
        <label className="flex items-center gap-0.5"><input type="checkbox" checked={load} onChange={(e) => setLoad(e.target.checked)} data-testid={`${tid}-load`} />{loadKind === "drop" ? "2 s 时往机身右侧掉一个 60 g 方块" : "2 s 时机身右侧加 30 g 负载"}</label>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {onLive && <B t={`${tid}-live`} on={() => { const n = !live; setLive(n); onLive(n ? c : null, slope ? { deg: slope, dir } : null); }} cls={live ? "border-copper bg-copper text-white" : ""}>{live ? "台面上：闭环（点一下关）" : "台面上打开闭环 + 坡度"}</B>}
        <B t={`${tid}-compare`} dis={busy != null} on={compare} cls="border-copper">开环 vs 闭环对比（后台各跑一次）</B>
        {busy != null && <span data-testid={`${tid}-busy`}>对比中 {Math.round(busy * 100)}%…</span>}
        {exports.map((x) => <B key={x.k} t={`${tid}-export-${x.k}`} on={() => { const o = x.make(c); if (o) download(o); }}>{x.zh}</B>)}
      </div>
      {res?.err && <p className="text-red-700" data-testid={`${tid}-err`}>{res.err}</p>}
      {res?.open && <table className="w-full font-mono text-[11px]" data-testid={`${tid}-result`}><thead><tr className="text-ink-soft"><th className="text-left">{res.label}</th><th className="text-right">开环</th><th className="text-right">闭环</th></tr></thead><tbody>
        {rows.map(([zh, k, n]) => <tr key={k}><td>{zh}</td><td className="text-right">{f(res.open[k], n)}</td><td className="text-right" data-testid={`${tid}-r-${k}`}>{f(res.closed[k], n)}</td></tr>)}
      </tbody></table>}
      <details className="text-ink-soft"><summary>IMU 仿真（估算）</summary><ul className="list-disc pl-4">{Object.values(IMU_EST).map((x, i) => <li key={i}>{x}</li>)}</ul></details>
      {note && <p className="text-ink-soft">{note}</p>}
    </fieldset>
  );
}
