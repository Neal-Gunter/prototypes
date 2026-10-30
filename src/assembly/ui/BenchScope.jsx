import { createPortal } from "react-dom";
// v19 工作台示波器：默认仿真“台面上真的摆好、接好的电路”（src/sim/benchNetlist.js 从零件 + 导线提取网表 → tboard.capture 时域仿真）。
//   · 八爪鱼 v10（3D 台面导线带 meta）和通用面包板台面（Pico / Feather + LED / 电阻 / 按键 / 电位器 / 舵机 + 杜邦线）都支持；
//   · 探头可以点任何网络（引脚）或任何导线的两端；
//   · 实时修改：电容容值、电池新旧、每根线的线规、拔掉 / 插回一根线 → 自动重抓，上一次的波形画成灰色虚线（前后对比），可以撤销；
//   · 八爪鱼上有“如果……会怎样”面板（估算）；
//   · 旧的 v18 参考板示波器保留为备用（标明“参考板”）。
// 早期原型，简化仿真。
import { useEffect, useMemo, useRef, useState } from "react";
import { capture } from "../../repair/tboard.js";
import ScopePanel, { defaultScope, captureOpts } from "../../repair/ui/ScopePanel.jsx";
import { BATT, CAPS, benchBoard } from "../../sim/refBench.js";
import { extractBench, probesOf, AWG_CHOICES, BATT_AGE, whatIf, WHATIF_CAPS, WHATIF_AWG } from "../../sim/benchNetlist.js";
import { buildCircuit, boardOf, boardPins, termLabel, elemKind } from "../netlist.js";
import { engine } from "../engine.js";
import { elec } from "../elecStore.js";

const btn = "min-h-9 border border-line bg-white px-2.5 text-sm hover:border-copper disabled:opacity-40";
const btnOn = "min-h-9 border border-copper bg-copper px-2.5 text-sm text-white";
const sel = "min-h-9 border border-line bg-white px-1 text-sm";
const NODES = ["VBAT", "5VA", "5VB", "EN", "SENSE"];
const X = { buildCircuit, boardOf, boardPins, termLabel, elemKind };
const CAP_OPTS = [0, 100e-6, 470e-6, 1000e-6];
const uF = (c) => (c ? `${Math.round(c * 1e6)} µF` : "不加");
const TRIG = { src: 0, slope: "rise", level: 1, mode: "auto" };

// —— 参考板（v18，备用）——
function RefScope() {
  const [batt, setBatt] = useState("fresh");
  const [cap, setCap] = useState(0);
  const [s, setS] = useState(() => { const d = defaultScope(["VBAT", "5VA"]); return { ...d, exp: "power", tdiv: 20e-3, pre: 0.05, trig: TRIG, chans: d.chans.map((c, i) => (i === 0 ? { ...c, off: -2 } : i === 1 ? { ...c, off: -3 } : c)) }; });
  const run = () => {
    setS((x) => ({ ...x, busy: true }));
    setTimeout(() => {
      const c = capture(benchBoard({ batt, cap }), { ...captureOpts(s), run: true });
      setS((x) => ({ ...x, busy: false, cap: c }));
      window.__benchScope = { src: "ref", cap: c, batt, cap0: cap };
    }, 20);
  };
  const extra = (
    <div className="space-y-1 border-t border-line pt-1">
      <div className="flex flex-wrap gap-1">{Object.entries(BATT).map(([k, v]) => <button key={k} type="button" className={batt === k ? btnOn : btn} onClick={() => setBatt(k)} data-testid={`bscope-batt-${k}`}>{v.zh}</button>)}</div>
      <div className="flex flex-wrap items-center gap-1">5VA 上并一个电容：{Object.entries(CAPS).map(([k, v]) => <button key={k} type="button" className={+cap === +k ? btnOn : btn} onClick={() => setCap(+k)} data-testid={`bscope-cap-${+k ? Math.round(+k * 1e6) : 0}`}>{v}</button>)}</div>
    </div>
  );
  return (
    <div data-testid="bscope-ref">
      <p className="mb-1 border-l-4 border-amber-500 bg-amber-50 px-2 py-1 text-xs">备用：v18 参考板（维修模式里的“八爪鱼 v10 紧凑版”电源树），<b>不是</b>你台面上此刻连的电路。早期原型，简化仿真，数值均为估算。</p>
      <ScopePanel s={s} set={setS} nodes={NODES} onCapture={run} testid="bscope" extra={extra} />
      <p className="mt-1 text-xs text-ink-soft">可以试：① 新电池、不加电容，抓“舵机起步那一下”；② 并 470 µF，跌落明显变小；③ 换老化电池：主控（接在电池上）欠压复位，电容救不了；④ 并 1000 µF 抓“开机那一下”：给大电容充电的冲击电流会把电池拉低。</p>
    </div>
  );
}

// 默认通道：八爪鱼看电池 / 两路 5 V / 主控；通用台面看 USB 5 V / 3V3 / 舵机 V / LED
function defaultsFor(ext) {
  const b = ext.board, P = (k) => b.parts.find((p) => p.kind === k);
  if (ext.kind === "octo") {
    const nodes = ["CHG:BAT", "BST1:OUT", "BST2:OUT", "QTPY:BAT"].filter((n) => b.nets[n]);
    const lay = { "CHG:BAT": [0.5, -3.7], "BST1:OUT": [0.1, -5.0], "BST2:OUT": [0.1, -5.0], "QTPY:BAT": [0.5, -3.7] };
    const d = defaultScope(nodes);
    return { ...d, exp: "run", tdiv: 2e-3, pre: 0.05, trig: TRIG, chans: d.chans.map((c, i) => (nodes[i] ? { ...c, on: i < 3, vdiv: lay[nodes[i]][0], off: lay[nodes[i]][1] } : c)) };
  }
  const nodes = [P("dcin")?.pins["+"], P("ldo")?.pins.OUT, P("servo")?.pins.V, P("led")?.pins.A].filter(Boolean);
  const d = defaultScope(nodes);
  const lay = [[1, -2.5], [1, -2], [0.05, -4.9], [1, -1]];
  return { ...d, exp: "power", tdiv: 2e-3, pre: 0.1, trig: TRIG, chans: d.chans.map((c, i) => (nodes[i] ? { ...c, on: i < 3, vdiv: lay[i][0], off: lay[i][1] } : c)) };
}

// —— 我的电路（台面）——
function MyScope() {
  const [edits, setEdits] = useState({});
  const [undo, setUndo] = useState([]);
  const [tick, setTick] = useState(0); // “重新提取”
  const [s, setS] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [showGhost, setShowGhost] = useState(true);
  const [adaptive, setAdaptive] = useState(false);
  const sRef = useRef(null); sRef.current = s;
  const undoRef = useRef(0); undoRef.current = undo.length;
  const base = useMemo(() => extractBench(engine, X, elec.fw, {}), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const ext = useMemo(() => extractBench(engine, X, elec.fw, edits), [tick, edits]); // eslint-disable-line react-hooks/exhaustive-deps
  const probes = useMemo(() => probesOf(base.board), [base]);
  useEffect(() => { setS(defaultsFor(base)); setGhost(null); }, [base]);
  const doCapture = (st, keepGhost) => {
    if (!st || !ext.ok) { window.__benchScope = { src: "bench", kind: ext.kind, edits, cap: null, diag: { ok: ext.ok, errors: ext.errors, warnings: ext.warnings, stats: ext.stats }, probes: probes.length }; return; }
    setS((x) => ({ ...x, busy: true }));
    setTimeout(() => {
      const prev = sRef.current?.cap;
      const c = capture(ext.board, { ...captureOpts(st), run: true, adaptive: adaptive || null });
      if (keepGhost && prev) setGhost(prev);
      setS((x) => ({ ...x, busy: false, cap: c }));
      window.__benchScope = { src: "bench", kind: ext.kind, edits, cap: c, ghost: keepGhost && !!prev, diag: { ok: ext.ok, errors: ext.errors, warnings: ext.warnings, stats: ext.stats }, probes: probes.length, adaptive, parts: ext.board.parts.map((q) => ({ ref: q.ref, kind: q.kind, pins: q.pins })), wires: base.board.wires.map((w) => ({ id: w.id, a: w.a, b: w.b, awg: w.awg, zh: w.zh })), undo: undoRef.current };
    }, 20);
  };
  // 修改后自动重抓（上一张变成灰色对比）
  const pending = useRef(false);
  useEffect(() => { if (pending.current && s) { pending.current = false; doCapture(s, true); } }, [ext]); // eslint-disable-line react-hooks/exhaustive-deps
  const edit = (fn) => { setUndo((u) => [...u.slice(-29), edits]); pending.current = true; setEdits((e) => fn(structuredClone(e))); };
  const doUndo = () => { if (!undo.length) return; pending.current = true; setEdits(undo[undo.length - 1]); setUndo((u) => u.slice(0, -1)); };
  const doReset = () => { if (!Object.keys(edits).length) return; setUndo((u) => [...u, edits]); pending.current = true; setEdits({}); };
  if (!s) return null;
  const octo = ext.kind === "octo";
  const capRoles = octo ? base.board.parts.filter((p) => p.kind === "cap").map((p) => p.ref) : [];
  const removed = new Set(edits.removed || []);
  const wireRows = base.board.wires;
  const nEd = Object.values(edits).reduce((a, v) => a + (Array.isArray(v) ? v.length : typeof v === "object" ? Object.keys(v).length : 1), 0);
  const extra = (
    <div className="space-y-1 border-t border-line pt-1 text-sm" data-testid="bscope-edits">
      <div className="flex flex-wrap items-center gap-1">
        <b>实时修改</b>（改完自动重抓，灰色虚线 = 改之前）：
        <button type="button" className={btn} disabled={!undo.length} onClick={doUndo} data-testid="bscope-undo">撤销（{undo.length}）</button>
        <button type="button" className={btn} disabled={!nEd} onClick={doReset} data-testid="bscope-reset">全部还原</button>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showGhost} onChange={(e) => setShowGhost(e.target.checked)} data-testid="bscope-ghost" />显示改前波形</label>
        <label className="flex items-center gap-1" title="误差控制的变步长（v19）：步长自动放大缩小，开关 / 欠压 / 限流事件处自动细分"><input type="checkbox" checked={adaptive} onChange={(e) => setAdaptive(e.target.checked)} data-testid="bscope-adaptive" />自适应步长</label>
      </div>
      {octo && (
        <div className="flex flex-wrap items-center gap-1">电池：{Object.entries(BATT_AGE).map(([k, v]) => <button key={k} type="button" className={(edits.rint ?? BATT_AGE.fresh.rint) === v.rint ? btnOn : btn} onClick={() => edit((e) => ({ ...e, rint: v.rint }))} data-testid={`bscope-age-${k}`} title={v.zh}>{k === "fresh" ? "新" : k === "mid" ? "用了一阵" : "老化"}（{v.rint} Ω）</button>)}</div>
      )}
      {capRoles.map((r) => (
        <div key={r} className="flex flex-wrap items-center gap-1">{r} 电容：{CAP_OPTS.map((c) => <button key={c} type="button" className={(edits.caps?.[r] ?? 100e-6) === c ? btnOn : btn} onClick={() => edit((e) => ({ ...e, caps: { ...(e.caps || {}), [r]: c } }))} data-testid={`bscope-${r}-${Math.round(c * 1e6)}`}>{uF(c)}</button>)}</div>
      ))}
      <details data-testid="bscope-wires"><summary className="cursor-pointer">导线（{wireRows.length} 根，已拔 {removed.size}）：线规 / 拔掉</summary>
        <div className="max-h-48 overflow-auto">
          <table className="w-full text-xs"><tbody>
            {wireRows.map((w) => (
              <tr key={w.id} className={removed.has(w.id) ? "text-ink-soft line-through" : ""}>
                <td className="pr-1">{w.zh || `${w.a} → ${w.b}`}</td>
                <td className="whitespace-nowrap">{(w.len * 100).toFixed(0)} cm</td>
                <td><select className={sel} value={edits.awg?.[w.id] ?? w.awg} onChange={(ev) => { const v = +ev.target.value; edit((e) => ({ ...e, awg: { ...(e.awg || {}), [w.id]: v } })); }} data-testid={`bscope-awg-${w.id}`}>{AWG_CHOICES.map((a) => <option key={a} value={a}>{a} AWG</option>)}</select></td>
                <td><button type="button" className={btn} onClick={() => edit((e) => { const r = new Set(e.removed || []); r.has(w.id) ? r.delete(w.id) : r.add(w.id); return { ...e, removed: [...r] }; })} data-testid={`bscope-rm-${w.id}`}>{removed.has(w.id) ? "插回" : "拔掉"}</button></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </details>
    </div>
  );
  return (
    <div data-testid="bscope-mine">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="border border-line bg-paper px-1" data-testid="bscope-kind">{octo ? "八爪鱼 v10（按 3D 台面实际接线提取）" : "通用台面（面包板 / 杜邦线 / 主控板）"}</span>
        <span>{ext.stats.parts} 个零件 · {ext.stats.wires} 根线 · {ext.stats.nets} 个网络 · 探头点 {probes.length} 个</span>
        <button type="button" className={btn} onClick={() => setTick((t) => t + 1)} data-testid="bscope-extract">按台面重新提取</button>
      </div>
      <div className="mb-1 space-y-0.5 text-xs" data-testid="bscope-diag">
        {ext.errors.map((e, i) => <div key={"e" + i} className={e.fatal ? "border-l-4 border-red-600 bg-red-50 px-1" : "border-l-4 border-amber-500 bg-amber-50 px-1"}>{e.fatal ? "无法仿真：" : "注意："}{e.zh}</div>)}
        {ext.warnings.map((e, i) => <div key={"w" + i} className="border-l-4 border-line px-1 text-ink-soft">{e.zh}</div>)}
        {ext.ok && !ext.errors.length && <div className="text-ink-soft">网表检查通过：没有悬空网络、短路或缺地。</div>}
      </div>
      <ScopePanel s={s} set={setS} nodes={probes} onCapture={() => doCapture(s, false)} testid="mscope" extra={extra} ghost={showGhost ? ghost : null} />
      {s.cap?.stats && <p className="mt-1 text-xs text-ink-soft" data-testid="mscope-stats">求解：{s.cap.stats.adaptive ? `自适应步长 ${s.cap.stats.steps} 步（拒绝 ${s.cap.stats.rejected}，事件细分 ${s.cap.stats.eventRejects}），最小步 ${(s.cap.stats.hMin * 1e6).toFixed(2)} µs` : `固定步长 ${s.cap.stats.steps ?? "—"} 步`}，用时 {s.cap.ms?.toFixed(0)} ms。</p>}
      {octo && <WhatIf W={base.W} />}
    </div>
  );
}

// —— 八爪鱼“如果……会怎样”（估算）——
function WhatIf({ W }) {
  const [o, setO] = useState({ cap: 100e-6, batt: "fresh", awg: 0 });
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const r = whatIf(W, { cap: o.cap, batt: o.batt, awg: o.awg || null });
      const next = [...rows, r].slice(-8);
      setRows(next); setBusy(false);
      window.__whatIf = next.map((x) => ({ opt: x.opt, ok: x.ok, resets: x.resets, minRail: x.minRail, servoDip: x.servoDip, ipk: x.ipk, ipkInrush: x.ipkInrush, ms: x.ms }));
    }, 20);
  };
  const ch = (k, v) => setO((x) => ({ ...x, [k]: v }));
  return (
    <section className="mt-2 border border-line p-2" data-testid="whatif">
      <b>如果……会怎样？（八爪鱼 v10，估算）</b>
      <p className="text-xs text-ink-soft">每次跑两段仿真：开机（50 ms）+ 8 个舵机起步（20 ms）。电池内阻、电容 ESR、舵机起步电流、线规都是估算值；结果用来比较“哪个选择更好”，不是精确预测。早期原型，简化仿真。</p>
      <div className="my-1 flex flex-wrap items-center gap-1 text-sm">
        储能电容（CAP1 + CAP2 各）：{WHATIF_CAPS.map((c) => <button key={c} type="button" className={o.cap === c ? btnOn : btn} onClick={() => ch("cap", c)} data-testid={`whatif-cap-${Math.round(c * 1e6)}`}>{uF(c)}</button>)}
      </div>
      <div className="my-1 flex flex-wrap items-center gap-1 text-sm">
        电池：{Object.entries(BATT_AGE).map(([k, v]) => <button key={k} type="button" className={o.batt === k ? btnOn : btn} onClick={() => ch("batt", k)} data-testid={`whatif-batt-${k}`} title={v.zh}>{k === "fresh" ? "新" : k === "mid" ? "用了一阵" : "老化"}（{v.rint} Ω）</button>)}
      </div>
      <div className="my-1 flex flex-wrap items-center gap-1 text-sm">
        电源线线规：<button type="button" className={!o.awg ? btnOn : btn} onClick={() => ch("awg", 0)} data-testid="whatif-awg-0">原样</button>{WHATIF_AWG.map((a) => <button key={a} type="button" className={o.awg === a ? btnOn : btn} onClick={() => ch("awg", a)} data-testid={`whatif-awg-${a}`}>{a} AWG</button>)}
        <button type="button" className={btnOn} disabled={busy} onClick={run} data-testid="whatif-run">{busy ? "仿真中…" : "算一下"}</button>
        {rows.length > 0 && <button type="button" className={btn} onClick={() => { setRows([]); window.__whatIf = []; }} data-testid="whatif-clear">清空</button>}
      </div>
      {rows.length > 0 && (
        <table className="w-full border-collapse text-xs" data-testid="whatif-table">
          <thead><tr className="border-b border-line text-left"><th>电容</th><th>电池</th><th>线规</th><th>主控复位</th><th>5 V 最低（运行）</th><th>舵机起步跌落</th><th>电池峰值电流（估算）</th><th>上电浪涌（估算）</th><th>用时</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className="border-b border-line" data-testid={`whatif-row-${i}`}>
              <td>{uF(r.opt.cap)}</td><td>{r.opt.batt === "fresh" ? "新" : r.opt.batt === "mid" ? "一阵" : "老化"}</td><td>{r.opt.awg ? `${r.opt.awg} AWG` : "原样"}</td>
              {r.ok ? <>
                <td className={r.resets ? "font-bold text-red-700" : ""}>{r.resets} 次</td><td>{r.minRail.toFixed(3)} V</td><td>{(r.servoDip * 1000).toFixed(0)} mV</td><td>{r.ipk.toFixed(2)} A</td><td>{r.ipkInrush.toFixed(1)} A</td><td>{r.ms} ms</td>
              </> : <td colSpan={6}>{r.errors.map((e) => e.zh).join("；")}</td>}
            </tr>
          ))}</tbody>
        </table>
      )}
      <p className="mt-1 text-xs text-ink-soft">我的补充：电池电流 = 电芯模型里欧姆内阻那一段（内阻 × 0.6）上的压降 ÷ 电阻；“上电浪涌”是开关合上那一瞬间给电容充电的微秒级尖峰，真实值还受开关 / 接触电阻 / 电池保护板影响。</p>
    </section>
  );
}

export default function BenchScope() {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("bench");
  if (!open) return <button type="button" className={btn} onClick={() => setOpen(true)} data-testid="bench-scope-open">打开示波器（大窗口）</button>;
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-auto bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="mx-auto max-w-6xl bg-white p-3 shadow-xl" data-testid="bench-scope">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <b>工作台示波器（时域模式 · 早期原型，简化仿真）</b>
          <div className="flex gap-1">
            <button type="button" className={src === "bench" ? btnOn : btn} onClick={() => setSrc("bench")} data-testid="bscope-src-bench">我的电路（台面）</button>
            <button type="button" className={src === "ref" ? btnOn : btn} onClick={() => setSrc("ref")} data-testid="bscope-src-ref">参考板（v18，备用）</button>
            <button type="button" className={btn} onClick={() => setOpen(false)} data-testid="bench-scope-close">关闭</button>
          </div>
        </div>
        {src === "bench" ? <MyScope /> : <RefScope />}
      </div>
    </div>, document.body);
}
