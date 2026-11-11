// v18 示波器面板（维修台 / 工作台共用）。2–4 通道、t/div、V/div、DC/AC 耦合、触发（上升 / 下降沿、电平、自动 / 单次）、
// 光标读数、数学 A−B、欠压复位阈值线、事件标记。波形来自 src/repair/tboard.js 的时域仿真。早期原型，简化仿真。
import { useMemo, useRef } from "react";
import { CH_COLOR as CH_PHOS, channelInk, scopeBg } from "../../ui/palette.js";
import { useTheme } from "../../theme.js";
import { useT } from "../../i18n.js";
import { pairOr, voltAtFrac, deltaV, timeAtFrac, deltaT, invDeltaT, CUR_DEFAULT, VCUR_DEFAULT } from "../scopeCursors.js";

const btn = "min-h-11 border border-line bg-paper-2 px-2.5 text-sm hover:border-copper disabled:opacity-40";
const btnOn = "min-h-11 border border-copper bg-copper px-2.5 text-sm text-paper";
const sel = "min-h-11 border border-line bg-paper-2 px-1 text-sm";
export const CH_COLOR = CH_PHOS;
const MATH_COLOR = "#e09a5a";
const MATH_INK = "#8a4a14";
export const TDIVS = [1e-6, 2e-6, 5e-6, 10e-6, 20e-6, 50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3];
export const VDIVS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
const fT = (t) => { const a = Math.abs(t); return a >= 1e-3 ? `${+(t * 1e3).toPrecision(3)} ms` : a >= 1e-6 || a === 0 ? `${+(t * 1e6).toPrecision(3)} µs` : `${+(t * 1e9).toPrecision(3)} ns`; };
const fV = (v) => (!Number.isFinite(v) ? "—" : Math.abs(v) < 1 ? `${(v * 1000).toFixed(1)} mV` : `${v.toFixed(3)} V`);
const EXP = { steady: "一直开着（连续）", power: "抓开机那一下", run: "抓舵机起步那一下" };
export const defaultScope = (nodes = []) => ({
  exp: "steady", tdiv: 1e-3, pre: 0.1,
  chans: [0, 1, 2, 3].map((i) => ({ on: i < 2 && !!nodes[i], node: nodes[i] || "", vdiv: 1, off: i === 0 ? -2 : -3, ac: false })),
  trig: { src: 0, slope: "rise", level: 2.5, mode: "auto" }, math: false, cur: [0.3, 0.7], vcur: [0.3, 0.7], active: 0, cap: null, busy: false,
});

// 把面板设置变成 capture 参数
export function captureOpts(s) {
  const chans = s.chans.map((c) => (c.on && c.node ? { node: c.node, label: c.node } : null));
  return { exp: s.exp, run: s.exp !== "steady" || undefined, tdiv: s.tdiv, pre: s.pre, chans, math: s.math ? { a: 0, b: 1 } : null, trig: s.trig.src === "none" ? null : { src: s.trig.src, slope: s.trig.slope, level: s.trig.level, mode: s.trig.mode === "single" ? "normal" : "auto" } };
}


function svgFrac(e, svg, GW, GH) {
  try {
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const loc = pt.matrixTransform(ctm.inverse());
      return { fx: Math.max(0, Math.min(1, loc.x / GW)), fy: Math.max(0, Math.min(1, loc.y / GH)) };
    }
  } catch { /* 回退到盒子比例 */ }
  const r = svg.getBoundingClientRect();
  return { fx: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), fy: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
}
function svgPxDistX(svg, userX, clientX) {
  try {
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint(); pt.x = userX; pt.y = 0;
      return Math.abs(clientX - pt.matrixTransform(ctm).x);
    }
  } catch { /* */ }
  const r = svg.getBoundingClientRect();
  return Math.abs(clientX - (r.left + (userX / 500) * r.width));
}
function svgPxDistY(svg, userY, clientY) {
  try {
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint(); pt.x = 0; pt.y = userY;
      return Math.abs(clientY - pt.matrixTransform(ctm).y);
    }
  } catch { /* */ }
  const r = svg.getBoundingClientRect();
  return Math.abs(clientY - (r.top + (userY / 320) * r.height));
}

export default function ScopePanel({ s, set, nodes, onCapture, running, testid = "scope", extra = null, ghost = null }) {
  const [, , theme] = useTheme();
  const inkCh = channelInk(theme);
  const mathInk = theme === "dark" ? MATH_COLOR : MATH_INK;
  const tr = useT();
  const drag = useRef(null);
  const upd = (p) => set({ ...s, ...p });
  const updCh = (i, p) => set({ ...s, chans: s.chans.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const cap = s.cap;
  const cur = pairOr(s.cur, CUR_DEFAULT);
  const vcur = pairOr(s.vcur, VCUR_DEFAULT);
  const chActive = s.chans[s.active] || s.chans[0] || { vdiv: 1, off: 0 };
  const v1 = voltAtFrac(vcur[0], chActive), v2 = voltAtFrac(vcur[1], chActive), dV = deltaV(vcur[0], vcur[1], chActive);
  const t1 = timeAtFrac(cur[0], cap, s.tdiv), t2 = timeAtFrac(cur[1], cap, s.tdiv), dT = deltaT(cur[0], cur[1], cap, s.tdiv), invT = invDeltaT(dT);
  const GW = 500, GH = 320, DX = GW / 10, DY = GH / 8;
  const traces = useMemo(() => {
    if (!cap?.t?.length) return [];
    const W = cap.W, t0 = cap.t[0];
    const xOf = (t) => ((t - t0) / W) * GW;
    const out = [];
    const mk = (d, vdiv, off, ac, color, key, src = cap, g = false) => {
      const mean = ac ? d.reduce((a, b) => a + b, 0) / d.length : 0;
      const step = Math.max(1, Math.floor(d.length / 1200));
      const gx = (t) => ((t - src.t[0]) / src.W) * GW;
      let p = "";
      for (let i = 0; i < d.length; i += step) { const y = GH / 2 - ((d[i] - mean + off) / vdiv) * DY; p += `${i ? "L" : "M"}${(g ? gx(src.t[i]) : xOf(src.t[i])).toFixed(1)},${Math.max(-5, Math.min(GH + 5, y)).toFixed(1)}`; }
      out.push({ key, p, color, mean, ghost: g });
    };
    // v19：前后对比——上一次抓到的波形（改动之前）画成灰色虚线
    if (ghost?.t?.length) s.chans.forEach((c, i) => { const d = ghost.ch?.[i]; if (c.on && d) mk(d, c.vdiv, c.off, c.ac, CH_COLOR[i], "g" + i, ghost, true); });
    s.chans.forEach((c, i) => { const d = cap.ch?.[i]; if (c.on && d) mk(d, c.vdiv, c.off, c.ac, CH_COLOR[i], "ch" + i); });
    if (s.math && cap.math) mk(cap.math, s.chans[0].vdiv, 0, false, MATH_COLOR, "math");
    return out;
  }, [cap, s.chans, s.math, ghost]);
  const at = (f) => { if (!cap?.t?.length) return null; const i = Math.min(cap.t.length - 1, Math.max(0, Math.round(f * (cap.t.length - 1)))); return { t: cap.t[i], v: s.chans.map((c, k) => (c.on && cap.ch?.[k] ? cap.ch[k][i] : null)), m: cap.math ? cap.math[i] : null }; };
  const c1 = at(cur[0]), c2 = at(cur[1]);
  const trigCh = s.chans[s.trig.src];
  const trigY = trigCh && s.trig.src !== "none" ? GH / 2 - ((s.trig.level + trigCh.off) / trigCh.vdiv) * DY : null;
  const evs = (cap?.events || []).filter((e) => ["reset", "boot", "boost-hiccup", "lowStop"].includes(e.kind));
  return (
    <section className="border border-line bg-paper-2 p-3 text-sm" data-testid={testid}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="font-medium">示波器（时域仿真）</h2>
        <span className="text-xs text-ink-soft">早期原型，简化仿真 · 理想元件，没有 EMI / 热 / 寄生参数（只算写明的 ESR、线阻、端子接触电阻）</span>
      </div>
      <div className="grid gap-2 xl:grid-cols-[1fr_250px]">
        <div>
          <svg viewBox={`-2 -2 ${GW + 4} ${GH + 4}`} className="max-h-[400px] w-full touch-none" style={{ background: scopeBg, touchAction: "none" }} data-testid={`${testid}-screen`}
            onPointerDown={(e) => {
              const svg = e.currentTarget;
              const { fx, fy } = svgFrac(e, svg, GW, GH);
              const slop = 16;
              const hits = [
                { kind: "t", k: 0, d: svgPxDistX(svg, cur[0] * GW, e.clientX) },
                { kind: "t", k: 1, d: svgPxDistX(svg, cur[1] * GW, e.clientX) },
                { kind: "v", k: 0, d: svgPxDistY(svg, vcur[0] * GH, e.clientY) },
                { kind: "v", k: 1, d: svgPxDistY(svg, vcur[1] * GH, e.clientY) },
              ].filter((h) => h.d <= slop).sort((a, b) => a.d - b.d);
              const hit = hits[0];
              if (hit) {
                drag.current = { kind: hit.kind, k: hit.k, moved: false };
                try { svg.setPointerCapture(e.pointerId); } catch { /* */ }
                e.preventDefault();
              } else {
                // 点空白处：仍按就近移动时间光标（兼容 v18）
                const k = Math.abs(fx - cur[0]) < Math.abs(fx - cur[1]) ? 0 : 1;
                const next = cur.slice(); next[k] = fx; upd({ cur: next });
                drag.current = { kind: "t", k, moved: false, placed: true };
                try { svg.setPointerCapture(e.pointerId); } catch { /* */ }
              }
            }}
            onPointerMove={(e) => {
              const d = drag.current; if (!d) return;
              if (d.placed && !d.moved && !(e.buttons & 1)) return;
              if (!(e.buttons & 1) && e.pointerType !== "touch" && !d.moved) return;
              const { fx, fy } = svgFrac(e, e.currentTarget, GW, GH);
              if (d.kind === "t") { const next = (s.cur && s.cur.length >= 2 ? s.cur.slice() : cur.slice()); if (Math.abs(next[d.k] - fx) > 0.002) d.moved = true; next[d.k] = fx; upd({ cur: next }); }
              else { const next = (s.vcur && s.vcur.length >= 2 ? s.vcur.slice() : vcur.slice()); if (Math.abs(next[d.k] - fy) > 0.002) d.moved = true; next[d.k] = fy; upd({ vcur: next }); }
            }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}>
            <defs>
              <filter id={`${testid}-glow`} x="-8%" y="-8%" width="116%" height="116%">
                <feGaussianBlur stdDeviation="1.15" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {[...Array(51)].map((_, i) => <line key={"xm" + i} x1={i * DX / 5} y1={0} x2={i * DX / 5} y2={GH} stroke="#14241d" strokeWidth={0.25} />)}
            {[...Array(41)].map((_, i) => <line key={"ym" + i} x1={0} y1={i * DY / 5} x2={GW} y2={i * DY / 5} stroke="#14241d" strokeWidth={0.25} />)}
            {[...Array(11)].map((_, i) => <line key={"x" + i} x1={i * DX} y1={0} x2={i * DX} y2={GH} stroke="#1c3328" strokeWidth={i === 5 ? 1.1 : 0.55} />)}
            {[...Array(9)].map((_, i) => <line key={"y" + i} x1={0} y1={i * DY} x2={GW} y2={i * DY} stroke="#1c3328" strokeWidth={i === 4 ? 1.1 : 0.55} />)}
            {cap && cap.t?.length > 0 && <line x1={(cap.pre ?? 0.1) * GW} y1={0} x2={(cap.pre ?? 0.1) * GW} y2={GH} stroke="#888" strokeDasharray="3 3" strokeWidth={0.6} />}
            {trigY != null && trigY > 0 && trigY < GH && <g><line x1={0} y1={trigY} x2={GW} y2={trigY} stroke={CH_COLOR[s.trig.src]} strokeDasharray="2 4" strokeWidth={0.6} /><text x={GW - 2} y={trigY - 2} fontSize={9} fill={CH_COLOR[s.trig.src]} textAnchor="end">T {fV(s.trig.level)}</text></g>}
            {(cap?.thresholds || []).map((th) => { const c = s.chans[th.ch]; if (!c?.on || c.ac) return null; const y = GH / 2 - ((th.v + c.off) / c.vdiv) * DY; return y > 0 && y < GH && <g key={"th" + th.ch} data-testid={`${testid}-bo`}><line x1={0} y1={y} x2={GW} y2={y} stroke="#ff4040" strokeDasharray="6 3" strokeWidth={0.8} /><text x={3} y={y - 3} fontSize={9} fill="#ff7070">{th.zh}</text></g>; })}
            {traces.map((tr) => <path key={tr.key} d={tr.p} stroke={tr.color} strokeWidth={tr.ghost ? 1.1 : 1.65} strokeOpacity={tr.ghost ? 0.45 : 1} strokeDasharray={tr.ghost ? "3 2" : undefined} fill="none" strokeLinecap="round" strokeLinejoin="round" filter={tr.ghost ? undefined : `url(#${testid}-glow)`} data-testid={`${testid}-trace-${tr.key}`} />)}
            {cap?.t?.length > 0 && evs.map((e, i) => { const x = ((e.t - cap.t[0]) / cap.W) * GW; return x >= 0 && x <= GW && <g key={i}><line x1={x} y1={0} x2={x} y2={14} stroke={e.kind === "boot" ? "#7f7" : "#f55"} strokeWidth={1.5} /><text x={x + 2} y={10} fontSize={8} fill={e.kind === "boot" ? "#7f7" : "#f88"}>{{ reset: "复位", boot: "启动", "boost-hiccup": "打嗝", lowStop: "低压停" }[e.kind]}</text></g>; })}
            {cur.map((f, k) => (
              <g key={"t" + k} data-testid={`${testid}-cur-t${k + 1}-line`}>
                <line x1={f * GW} y1={0} x2={f * GW} y2={GH} stroke="transparent" strokeWidth={14} pointerEvents="stroke" />
                <line x1={f * GW} y1={0} x2={f * GW} y2={GH} stroke="#ddd" strokeWidth={0.8} strokeDasharray={k ? "4 2" : undefined} pointerEvents="none" />
                <text x={f * GW + 3} y={12} fontSize={9} fill="#ddd" pointerEvents="none">T{k + 1}</text>
              </g>
            ))}
            {vcur.map((f, k) => (
              <g key={"v" + k} data-testid={`${testid}-cur-v${k + 1}-line`}>
                <line x1={0} y1={f * GH} x2={GW} y2={f * GH} stroke="transparent" strokeWidth={14} pointerEvents="stroke" />
                <line x1={0} y1={f * GH} x2={GW} y2={f * GH} stroke="#d4a574" strokeWidth={0.8} strokeDasharray={k ? "4 2" : undefined} pointerEvents="none" />
                <text x={3} y={f * GH - 3} fontSize={9} fill="#d4a574" pointerEvents="none">V{k + 1}</text>
              </g>
            ))}
            {!cap && <text x={GW / 2} y={GH / 2} fontSize={13} fill="#7a9" textAnchor="middle">选通道和节点，按“抓一次”</text>}
            {cap?.waiting && <text x={GW / 2} y={GH / 2} fontSize={13} fill="#fc6" textAnchor="middle">等待触发……（没有满足条件的边沿）</text>}
          </svg>
          {s.err && <div className="mt-1 text-xs text-[#b03a2e]" data-testid={`${testid}-err`}>{s.err}</div>}
          <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-xs" data-testid={`${testid}-readout`}>
            <span>{fT(s.tdiv)}/div</span>
            {s.chans.map((c, i) => c.on && <span key={i} style={{ color: inkCh[i] }}>CH{i + 1} {c.node} {fV(c.vdiv)}/div{c.ac ? " AC" : ""}{cap?.meas?.[i] ? ` 峰峰 ${fV(cap.meas[i].pp)} 均值 ${fV(cap.meas[i].mean)} 最低 ${fV(cap.meas[i].min)}` : ""}</span>)}
            {s.math && cap?.mathMeas && <span style={{ color: mathInk }}>A−B 最大 {fV(cap.mathMeas.max)} 峰峰 {fV(cap.mathMeas.pp)}</span>}
          </div>
          <div className="font-mono text-xs leading-5" data-testid={`${testid}-cursors`}>
            {tr("光标", "Cursors")} t1 {fT(c1 ? c1.t : t1)} · t2 {fT(c2 ? c2.t : t2)} · Δt {fT(c1 && c2 ? c2.t - c1.t : dT)}{((c1 && c2 && c2.t !== c1.t) || invT) ? ` · 1/Δt ${(c1 && c2 && c2.t !== c1.t ? 1 / Math.abs(c2.t - c1.t) : invT).toPrecision(3)} Hz` : ""}
            {` · V1 ${fV(v1)} · V2 ${fV(v2)} · ΔV ${fV(dV)}`}
            {c1 && c2 ? s.chans.map((c, i) => c.on && c1.v[i] != null ? ` · CH${i + 1} ${fV(c1.v[i])}→${fV(c2.v[i])}（Δ ${fV(c2.v[i] - c1.v[i])}）` : "").join("") : ""}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4" data-testid={`${testid}-cur-sliders`}>
            {[["t", 0, tr("时间光标 1", "Time cursor 1"), "horizontal"], ["t", 1, tr("时间光标 2", "Time cursor 2"), "horizontal"], ["v", 0, tr("电压光标 1", "Voltage cursor 1"), "vertical"], ["v", 1, tr("电压光标 2", "Voltage cursor 2"), "vertical"]].map(([kind, k, label, ori]) => {
              const val = kind === "t" ? cur[k] : vcur[k];
              const now = Math.round(val * 100);
              return (
                <label key={kind + k} className="flex min-h-11 min-w-0 flex-col justify-center gap-0.5 border border-line bg-paper px-1.5 py-1 text-[11px] text-ink">
                  <span className="truncate">{label} {now}%</span>
                  <input type="range" min="0" max="100" step="1" value={now} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={now} aria-orientation={ori} className="h-6 w-full accent-[#9e461d]" data-testid={`${testid}-cur-${kind}${k + 1}`}
                    onChange={(e) => { const f = +e.target.value / 100; if (kind === "t") { const n = cur.slice(); n[k] = f; upd({ cur: n }); } else { const n = vcur.slice(); n[k] = f; upd({ vcur: n }); } }} />
                </label>
              );
            })}
          </div>
          {cap && <div className="text-xs text-ink-soft" data-testid={`${testid}-stats`}>仿真：{cap.stats?.steps ?? "?"} 步，步长 {fT(cap.dt || 0)}，用时 {Math.round(cap.ms || 0)} ms{cap.dev ? " · " + Object.entries(cap.dev).filter(([, d]) => d.kind === "mcu" || d.kind === "boost").map(([k, d]) => (d.kind === "mcu" ? `${k} 复位 ${d.resets} 次` : `${k} 打嗝 ${d.hiccups} 次`)).join("，") : ""}</div>}
          {(cap?.notes || []).map((n) => <p key={n} className="text-xs text-copper-deep">{n}</p>)}
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex flex-wrap gap-1">{Object.entries(EXP).map(([k, v]) => <button key={k} type="button" className={s.exp === k ? btnOn : btn} onClick={() => upd({ exp: k, pre: k === "steady" ? 0.1 : 0.05, tdiv: k === "steady" ? s.tdiv : Math.max(s.tdiv, 2e-3) })} data-testid={`${testid}-exp-${k}`}>{v}</button>)}</div>
          <label className="flex items-center gap-1">时基 <select className={sel} value={s.tdiv} onChange={(e) => upd({ tdiv: +e.target.value })} data-testid={`${testid}-tdiv`}>{TDIVS.map((t) => <option key={t} value={t}>{fT(t)}/div</option>)}</select></label>
          {s.chans.map((c, i) => (
            <div key={i} className={`flex flex-wrap items-center gap-1 border-l-4 pl-1 ${s.active === i ? "bg-paper" : ""}`} style={{ borderColor: CH_COLOR[i] }} data-testid={`${testid}-ch${i + 1}`}>
              <button type="button" className={c.on ? btnOn : btn} onClick={() => updCh(i, { on: !c.on })} data-testid={`${testid}-ch${i + 1}-on`}>CH{i + 1}</button>
              <select className={sel} value={c.node} onChange={(e) => updCh(i, { node: e.target.value, on: true })} data-testid={`${testid}-ch${i + 1}-node`}><option value="">（未接）</option>{nodes.map((n, k) => (typeof n === "string" ? <option key={n} value={n}>{n}</option> : <option key={k} value={n.node}>{n.zh}</option>))}</select>
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
          <p className="text-ink-soft">{tr("拖竖线调时间光标，拖横线调电压光标；点空白处会按就近移动时间光标。下面的滑块可以用键盘的方向键调节。", "Drag the vertical lines for time cursors and the horizontal lines for voltage cursors. A click on empty screen still moves the nearer time cursor. The sliders below can be adjusted from the keyboard with the arrow keys.")}{running === false && s.exp === "steady" ? tr("现在没在运行：舵机不动、无线不发射。", " Not running now: servos stay still and radios do not transmit.") : ""}</p>
          <p className="text-ink-soft" data-testid={`${testid}-ground-note`}>探头地夹提醒：示波器每个探头的地夹在仪器里是连在一起的、并且通过电源线接大地。地夹只能夹在板子的地上；夹到别的节点（或者另一块板的“地”）等于用导线把它短到地——真实测量会短路、冒烟或掩盖问题。看两块板之间的地压差请用两个通道 + 数学差值（这里也是这么算的）。高频小信号要用地弹簧代替长地线，否则会多出振铃（这里不模拟）。</p>
        </div>
      </div>
    </section>
  );
}
