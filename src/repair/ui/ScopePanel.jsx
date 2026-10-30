// v18 示波器面板（维修台 / 工作台共用）。2–4 通道、t/div、V/div、DC/AC 耦合、触发（上升 / 下降沿、电平、自动 / 单次）、
// 光标读数、数学 A−B、欠压复位阈值线、事件标记。波形来自 src/repair/tboard.js 的时域仿真。早期原型，简化仿真。
import { useMemo } from "react";

const btn = "min-h-9 border border-line bg-white px-2.5 text-sm hover:border-copper disabled:opacity-40";
const btnOn = "min-h-9 border border-copper bg-copper px-2.5 text-sm text-white";
const sel = "min-h-9 border border-line bg-white px-1 text-sm";
export const CH_COLOR = ["#e8d33a", "#3ad1e8", "#e85ad1", "#5ae86a"];
const MATH_COLOR = "#ff8a3a";
export const TDIVS = [1e-6, 2e-6, 5e-6, 10e-6, 20e-6, 50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3];
export const VDIVS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
const fT = (t) => { const a = Math.abs(t); return a >= 1e-3 ? `${+(t * 1e3).toPrecision(3)} ms` : a >= 1e-6 || a === 0 ? `${+(t * 1e6).toPrecision(3)} µs` : `${+(t * 1e9).toPrecision(3)} ns`; };
const fV = (v) => (!Number.isFinite(v) ? "—" : Math.abs(v) < 1 ? `${(v * 1000).toFixed(1)} mV` : `${v.toFixed(3)} V`);
const EXP = { steady: "一直开着（连续）", power: "抓开机那一下", run: "抓舵机起步那一下" };
export const defaultScope = (nodes = []) => ({
  exp: "steady", tdiv: 1e-3, pre: 0.1,
  chans: [0, 1, 2, 3].map((i) => ({ on: i < 2 && !!nodes[i], node: nodes[i] || "", vdiv: 1, off: i === 0 ? -2 : -3, ac: false })),
  trig: { src: 0, slope: "rise", level: 2.5, mode: "auto" }, math: false, cur: [0.3, 0.7], active: 0, cap: null, busy: false,
});

// 把面板设置变成 capture 参数
export function captureOpts(s) {
  const chans = s.chans.map((c) => (c.on && c.node ? { node: c.node, label: c.node } : null));
  return { exp: s.exp, run: s.exp !== "steady" || undefined, tdiv: s.tdiv, pre: s.pre, chans, math: s.math ? { a: 0, b: 1 } : null, trig: s.trig.src === "none" ? null : { src: s.trig.src, slope: s.trig.slope, level: s.trig.level, mode: s.trig.mode === "single" ? "normal" : "auto" } };
}

export default function ScopePanel({ s, set, nodes, onCapture, running, testid = "scope", extra = null }) {
  const upd = (p) => set({ ...s, ...p });
  const updCh = (i, p) => set({ ...s, chans: s.chans.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const cap = s.cap;
  const GW = 500, GH = 320, DX = GW / 10, DY = GH / 8;
  const traces = useMemo(() => {
    if (!cap?.t?.length) return [];
    const W = cap.W, t0 = cap.t[0];
    const xOf = (t) => ((t - t0) / W) * GW;
    const out = [];
    const mk = (d, vdiv, off, ac, color, key) => {
      const mean = ac ? d.reduce((a, b) => a + b, 0) / d.length : 0;
      const step = Math.max(1, Math.floor(d.length / 1200));
      let p = "";
      for (let i = 0; i < d.length; i += step) { const y = GH / 2 - ((d[i] - mean + off) / vdiv) * DY; p += `${i ? "L" : "M"}${xOf(cap.t[i]).toFixed(1)},${Math.max(-5, Math.min(GH + 5, y)).toFixed(1)}`; }
      out.push({ key, p, color, mean });
    };
    s.chans.forEach((c, i) => { const d = cap.ch?.[i]; if (c.on && d) mk(d, c.vdiv, c.off, c.ac, CH_COLOR[i], "ch" + i); });
    if (s.math && cap.math) mk(cap.math, s.chans[0].vdiv, 0, false, MATH_COLOR, "math");
    return out;
  }, [cap, s.chans, s.math]);
  const at = (f) => { if (!cap?.t?.length) return null; const i = Math.min(cap.t.length - 1, Math.max(0, Math.round(f * (cap.t.length - 1)))); return { t: cap.t[i], v: s.chans.map((c, k) => (c.on && cap.ch?.[k] ? cap.ch[k][i] : null)), m: cap.math ? cap.math[i] : null }; };
  const c1 = at(s.cur[0]), c2 = at(s.cur[1]);
  const trigCh = s.chans[s.trig.src];
  const trigY = trigCh && s.trig.src !== "none" ? GH / 2 - ((s.trig.level + trigCh.off) / trigCh.vdiv) * DY : null;
  const evs = (cap?.events || []).filter((e) => ["reset", "boot", "boost-hiccup", "lowStop"].includes(e.kind));
  return (
    <section className="border border-line bg-white p-2 text-sm" data-testid={testid}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="font-medium">示波器（时域仿真）</h2>
        <span className="text-xs text-ink-soft">早期原型，简化仿真 · 理想元件，没有 EMI / 热 / 寄生参数（只算写明的 ESR、线阻、端子接触电阻）</span>
      </div>
      <div className="grid gap-2 xl:grid-cols-[1fr_250px]">
        <div>
          <svg viewBox={`-2 -2 ${GW + 4} ${GH + 4}`} className="max-h-[400px] w-full bg-[#0c1410]" data-testid={`${testid}-screen`}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); const k = Math.abs(f - s.cur[0]) < Math.abs(f - s.cur[1]) ? 0 : 1; const cur = s.cur.slice(); cur[k] = f; upd({ cur }); }}>
            {[...Array(11)].map((_, i) => <line key={"x" + i} x1={i * DX} y1={0} x2={i * DX} y2={GH} stroke="#24382c" strokeWidth={i === 5 ? 1 : 0.5} />)}
            {[...Array(9)].map((_, i) => <line key={"y" + i} x1={0} y1={i * DY} x2={GW} y2={i * DY} stroke="#24382c" strokeWidth={i === 4 ? 1 : 0.5} />)}
            {cap && cap.t?.length > 0 && <line x1={(cap.pre ?? 0.1) * GW} y1={0} x2={(cap.pre ?? 0.1) * GW} y2={GH} stroke="#888" strokeDasharray="3 3" strokeWidth={0.6} />}
            {trigY != null && trigY > 0 && trigY < GH && <g><line x1={0} y1={trigY} x2={GW} y2={trigY} stroke={CH_COLOR[s.trig.src]} strokeDasharray="2 4" strokeWidth={0.6} /><text x={GW - 2} y={trigY - 2} fontSize={9} fill={CH_COLOR[s.trig.src]} textAnchor="end">T {fV(s.trig.level)}</text></g>}
            {(cap?.thresholds || []).map((th) => { const c = s.chans[th.ch]; if (!c?.on || c.ac) return null; const y = GH / 2 - ((th.v + c.off) / c.vdiv) * DY; return y > 0 && y < GH && <g key={"th" + th.ch} data-testid={`${testid}-bo`}><line x1={0} y1={y} x2={GW} y2={y} stroke="#ff4040" strokeDasharray="6 3" strokeWidth={0.8} /><text x={3} y={y - 3} fontSize={9} fill="#ff7070">{th.zh}</text></g>; })}
            {traces.map((tr) => <path key={tr.key} d={tr.p} stroke={tr.color} strokeWidth={1.2} fill="none" data-testid={`${testid}-trace-${tr.key}`} />)}
            {cap?.t?.length > 0 && evs.map((e, i) => { const x = ((e.t - cap.t[0]) / cap.W) * GW; return x >= 0 && x <= GW && <g key={i}><line x1={x} y1={0} x2={x} y2={14} stroke={e.kind === "boot" ? "#7f7" : "#f55"} strokeWidth={1.5} /><text x={x + 2} y={10} fontSize={8} fill={e.kind === "boot" ? "#7f7" : "#f88"}>{{ reset: "复位", boot: "启动", "boost-hiccup": "打嗝", lowStop: "低压停" }[e.kind]}</text></g>; })}
            {[c1, c2].map((c, k) => c && <line key={"c" + k} x1={s.cur[k] * GW} y1={0} x2={s.cur[k] * GW} y2={GH} stroke="#ddd" strokeWidth={0.7} strokeDasharray={k ? "4 2" : undefined} />)}
            {!cap && <text x={GW / 2} y={GH / 2} fontSize={13} fill="#7a9" textAnchor="middle">选通道和节点，按“抓一次”</text>}
            {cap?.waiting && <text x={GW / 2} y={GH / 2} fontSize={13} fill="#fc6" textAnchor="middle">等待触发……（没有满足条件的边沿）</text>}
          </svg>
          {s.err && <div className="mt-1 text-xs text-[#b03a2e]" data-testid={`${testid}-err`}>{s.err}</div>}
          <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-xs" data-testid={`${testid}-readout`}>
            <span>{fT(s.tdiv)}/div</span>
            {s.chans.map((c, i) => c.on && <span key={i} style={{ color: CH_COLOR[i] === "#e8d33a" ? "#a08a00" : CH_COLOR[i] }}>CH{i + 1} {c.node} {fV(c.vdiv)}/div{c.ac ? " AC" : ""}{cap?.meas?.[i] ? ` 峰峰 ${fV(cap.meas[i].pp)} 均值 ${fV(cap.meas[i].mean)} 最低 ${fV(cap.meas[i].min)}` : ""}</span>)}
            {s.math && cap?.mathMeas && <span style={{ color: MATH_COLOR }}>A−B 最大 {fV(cap.mathMeas.max)} 峰峰 {fV(cap.mathMeas.pp)}</span>}
          </div>
          {c1 && c2 && <div className="font-mono text-xs" data-testid={`${testid}-cursors`}>光标 t1 {fT(c1.t)} · t2 {fT(c2.t)} · Δt {fT(c2.t - c1.t)}{c2.t !== c1.t ? ` · 1/Δt ${(1 / Math.abs(c2.t - c1.t)).toPrecision(3)} Hz` : ""}{s.chans.map((c, i) => c.on && c1.v[i] != null ? ` · CH${i + 1} ${fV(c1.v[i])}→${fV(c2.v[i])}（Δ ${fV(c2.v[i] - c1.v[i])}）` : "").join("")}</div>}
          {cap && <div className="text-xs text-ink-soft" data-testid={`${testid}-stats`}>仿真：{cap.stats?.steps ?? "?"} 步，步长 {fT(cap.dt || 0)}，用时 {Math.round(cap.ms || 0)} ms{cap.dev ? " · " + Object.entries(cap.dev).filter(([, d]) => d.kind === "mcu" || d.kind === "boost").map(([k, d]) => (d.kind === "mcu" ? `${k} 复位 ${d.resets} 次` : `${k} 打嗝 ${d.hiccups} 次`)).join("，") : ""}</div>}
          {(cap?.notes || []).map((n) => <p key={n} className="text-xs text-amber-700">{n}</p>)}
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex flex-wrap gap-1">{Object.entries(EXP).map(([k, v]) => <button key={k} type="button" className={s.exp === k ? btnOn : btn} onClick={() => upd({ exp: k, pre: k === "steady" ? 0.1 : 0.05, tdiv: k === "steady" ? s.tdiv : Math.max(s.tdiv, 2e-3) })} data-testid={`${testid}-exp-${k}`}>{v}</button>)}</div>
          <label className="flex items-center gap-1">时基 <select className={sel} value={s.tdiv} onChange={(e) => upd({ tdiv: +e.target.value })} data-testid={`${testid}-tdiv`}>{TDIVS.map((t) => <option key={t} value={t}>{fT(t)}/div</option>)}</select></label>
          {s.chans.map((c, i) => (
            <div key={i} className={`flex flex-wrap items-center gap-1 border-l-4 pl-1 ${s.active === i ? "bg-[#f5f0e6]" : ""}`} style={{ borderColor: CH_COLOR[i] }} data-testid={`${testid}-ch${i + 1}`}>
              <button type="button" className={c.on ? btnOn : btn} onClick={() => updCh(i, { on: !c.on })} data-testid={`${testid}-ch${i + 1}-on`}>CH{i + 1}</button>
              <select className={sel} value={c.node} onChange={(e) => updCh(i, { node: e.target.value, on: true })} data-testid={`${testid}-ch${i + 1}-node`}><option value="">（未接）</option>{nodes.map((n) => <option key={n} value={n}>{n}</option>)}</select>
              <select className={sel} value={c.vdiv} onChange={(e) => updCh(i, { vdiv: +e.target.value })} data-testid={`${testid}-ch${i + 1}-vdiv`}>{VDIVS.map((v) => <option key={v} value={v}>{fV(v)}/div</option>)}</select>
              <button type="button" className={c.ac ? btnOn : btn} onClick={() => updCh(i, { ac: !c.ac, off: !c.ac ? 0 : -2 })} data-testid={`${testid}-ch${i + 1}-ac`}>{c.ac ? "AC" : "DC"}</button>
              <button type="button" className={btn} onClick={() => updCh(i, { off: c.off + c.vdiv })} title="波形下移一格">▼</button>
              <button type="button" className={btn} onClick={() => updCh(i, { off: c.off - c.vdiv })} title="波形上移一格">▲</button>
              <button type="button" className={s.active === i ? btnOn : btn} onClick={() => upd({ active: i })} title="在板子上点一下，探头就夹到那里" data-testid={`${testid}-ch${i + 1}-clip`}>夹探头</button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-1">触发
            <select className={sel} value={s.trig.src} onChange={(e) => upd({ trig: { ...s.trig, src: e.target.value === "none" ? "none" : +e.target.value } })} data-testid={`${testid}-trig-src`}><option value="none">不触发</option>{[0, 1, 2, 3].map((i) => <option key={i} value={i}>CH{i + 1}</option>)}</select>
            <button type="button" className={btn} onClick={() => upd({ trig: { ...s.trig, slope: s.trig.slope === "rise" ? "fall" : "rise" } })} data-testid={`${testid}-trig-slope`}>{s.trig.slope === "rise" ? "↑ 上升沿" : "↓ 下降沿"}</button>
            <input type="number" step="0.05" className={sel + " w-20"} value={s.trig.level} onChange={(e) => upd({ trig: { ...s.trig, level: +e.target.value } })} data-testid={`${testid}-trig-level`} /> V
            <button type="button" className={s.trig.mode === "single" ? btnOn : btn} onClick={() => upd({ trig: { ...s.trig, mode: s.trig.mode === "single" ? "auto" : "single" } })} data-testid={`${testid}-single`}>{s.trig.mode === "single" ? "单次（等边沿）" : "自动"}</button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" className={s.math ? btnOn : btn} onClick={() => upd({ math: !s.math })} data-testid={`${testid}-math`}>数学 CH1 − CH2</button>
            <button type="button" className={btnOn} disabled={s.busy} onClick={onCapture} data-testid={`${testid}-capture`}>{s.busy ? "仿真中……" : s.exp === "steady" ? "抓一次" : "通电并抓一次"}</button>
          </div>
          {extra}
          <p className="text-ink-soft">点屏幕放光标（离哪条近就移哪条）。{running === false && s.exp === "steady" ? "现在没在运行：舵机不动、无线不发射。" : ""}</p>
          <p className="text-ink-soft" data-testid={`${testid}-ground-note`}>探头地夹提醒：示波器每个探头的地夹在仪器里是连在一起的、并且通过电源线接大地。地夹只能夹在板子的地上；夹到别的节点（或者另一块板的“地”）等于用导线把它短到地——真实测量会短路、冒烟或掩盖问题。看两块板之间的地压差请用两个通道 + 数学差值（这里也是这么算的）。高频小信号要用地弹簧代替长地线，否则会多出振铃（这里不模拟）。</p>
        </div>
      </div>
    </section>
  );
}
