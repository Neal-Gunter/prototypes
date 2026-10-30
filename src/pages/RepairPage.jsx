// 维修关卡：拿到一块“坏板子”，看、量、拆、焊、换，修好后交付验收。早期原型，简化仿真。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Game, TOOLS, BIN, ACTIONS, HINT_COST, MODE_ZH, label } from "../repair/game.js";
import { meter } from "../repair/board.js";
import { SCENARIOS, STAR } from "../repair/scenarios.js";
import { SCOPE_SCENARIOS } from "../repair/scopeScenarios.js";
import ScopePanel, { defaultScope, captureOpts, CH_COLOR } from "../repair/ui/ScopePanel.jsx";
import { LS_KEY } from "../repair/editor.js";
import BoardView from "../repair/ui/BoardView.jsx";
import RepairEditor from "../repair/ui/RepairEditor.jsx";

const PROG_KEY = "repair.progress.v1";
const btn = "min-h-9 border border-line bg-white px-2.5 text-sm hover:border-copper disabled:opacity-40";
const btnOn = "min-h-9 border border-copper bg-copper px-2.5 text-sm text-white";
const loadJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const TOOL_ORDER = ["hand", "meter", "tweezers", "iron", "braid", "magnifier", "scope", "crimper"];
const TPL_ZH = { led: "LED 夜灯", psu: "稳压模块", sensor: "传感器", octo: "八爪鱼 v10", rig: "三板台架" };
// 板上可以夹探头的节点：测试点的网络优先，其次是其它网络（地除外）
export function scopeNodes(b) { const out = []; const add = (n) => { if (n && !out.includes(n) && !/^GND$/.test(n) && !/:/.test(n)) out.push(n); }; (b.testpoints || []).forEach((t) => add(t.net)); b.parts.forEach((p) => Object.values(p.pins || {}).forEach(add)); return out; }

function customList() { return loadJSON(LS_KEY, []).map((s) => ({ ...s, custom: true })); }

export default function RepairPage() {
  const [tab, setTab] = useState(() => (new URLSearchParams(location.search).get("tab") === "editor" ? "editor" : "play"));
  const [customs, setCustoms] = useState(customList);
  const all = useMemo(() => [...SCENARIOS, ...customs], [customs]);
  const [sid, setSid] = useState(SCENARIOS[0].id);
  const [game, setGame] = useState(() => new Game(SCENARIOS[0]));
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [sel, setSel] = useState(null);
  const [side, setSide] = useState("front");
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState([0, 0]);
  const [nextProbe, setNextProbe] = useState("red");
  const [item, setItem] = useState("res-150");
  const [orient, setOrient] = useState(1);
  const [flash, setFlash] = useState(null);
  const [hintsShown, setHintsShown] = useState([]);
  const [progress, setProgress] = useState(() => loadJSON(PROG_KEY, {}));
  const [report, setReport] = useState(null);
  const logRef = useRef(null);
  const [td, setTd] = useState(false); // 时域模式：显示示波器
  const initScope = (sc, b) => { const n = scopeNodes(b); const s0 = defaultScope(sc.scopeStart || n.slice(0, 2)); return s0; };
  const [scope, setScope] = useState(() => initScope(SCENARIOS[0], game.board));
  const scopeRef = useRef(scope); scopeRef.current = scope;

  const setScenario = useCallback((id) => {
    const sc = [...SCENARIOS, ...SCOPE_SCENARIOS, ...customList()].find((s) => s.id === id);
    if (!sc) return;
    setSid(id); const g = new Game(sc); setGame(g); setScope(initScope(sc, g.board)); if (sc.scope) setTd(true); setSel(null); setSide("front"); setRot(0); setZoom(1); setPan([0, 0]); setHintsShown([]); setReport(null); setFlash(null); setNextProbe("red");
  }, []);

  const act = useCallback((a) => {
    const r = game.act(a);
    if (a.a === "hint" && r.ok) setHintsShown((h) => [...h, r.text]);
    if (a.a === "deliver") {
      const rep = game.report();
      setReport({ ...rep, checks: r.checks, order: r.order });
      if (game.solved) { const p = { ...loadJSON(PROG_KEY, {}) }; p[game.sc.id] = Math.max(p[game.sc.id] || 0, rep.stars); localStorage.setItem(PROG_KEY, JSON.stringify(p)); setProgress(p); }
    }
    setFlash(r.text ? { text: r.text, bad: !r.ok } : null);
    rerender();
    return r;
  }, [game]);

  const doCapture = useCallback((over) => {
    const s0 = { ...scopeRef.current, ...(over || {}) };
    setScope({ ...s0, busy: true });
    setTimeout(() => { const r = act({ a: "scope", ...captureOpts(s0) }); setScope((x) => ({ ...x, ...(over || {}), busy: false, cap: r.ok ? r.cap : x.cap })); }, 20);
  }, [act]);
  const probeTarget = (t) => (t.type === "pin" ? { ref: t.ref, pin: t.pin } : t.type === "tp" ? { net: t.net, tp: t.tp } : t.type === "pad" ? { net: t.net } : null);
  const pick = useCallback((t) => {
    setSel(t);
    const pr = probeTarget(t);
    if (game.tool === "meter" && pr) { act({ a: "probe", [nextProbe]: pr, mode: game.mode }); setNextProbe((n) => (n === "red" ? "black" : "red")); return; }
    if (game.tool === "scope" && pr) {
      const node = pr.net || game.board.parts.find((p) => p.ref === pr.ref)?.pins?.[pr.pin];
      if (node) { setTd(true); setScope((x) => { const i = x.active; const chans = x.chans.map((c, j) => (j === i ? { ...c, node, on: true } : c)); return { ...x, chans, active: (i + 1) % 4 }; }); }
      return;
    }
    if (game.tool === "magnifier" && (t.ref || t.id)) { act({ a: "inspect", ref: t.ref || t.id, mag: 3 }); return; }
    if (t.type === "cover") { act({ a: "cover", id: t.id }); return; }
  }, [game, act, nextProbe]);

  useEffect(() => { window.__repair = { get game() { return game; }, get scope() { return scopeRef.current; }, setScope: (p) => setScope((x) => ({ ...x, ...p })), capture: doCapture, act, pick, setScenario, setTool: (k) => { game.tool = k; rerender(); }, setSide }; }, [game, act, pick, setScenario, doCapture]);
  useEffect(() => {
    const k = (e) => { if (e.target.closest?.("input,textarea,select")) return; const t = TOOL_ORDER.find((x) => TOOLS[x].key === e.key); if (t) { game.tool = t; rerender(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [game]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [game.log.length]);

  const sc = game.sc, b = game.board, o = game.sim.obs;
  const reading = meter(b, game.sim, game.red, game.black, game.mode);
  const bat = b.parts.find((p) => p.kind === "bat");
  const hasRun = (b.spec || []).some((s) => s.run);
  const need = (a) => ACTIONS[a].tool;
  const A = ({ a, children, ...rest }) => {
    const t = need(a.a);
    return <button type="button" className={btn} onClick={() => act(a)} data-testid={`act-${a.a}`} {...rest}>{children}{t && t !== "meter" && <span className="ml-1 text-xs text-ink-soft">（{TOOLS[t].zh}）</span>}</button>;
  };
  const selPart = sel?.ref ? b.parts.find((p) => p.ref === sel.ref) : null;
  const binFor = selPart ? Object.entries(BIN).filter(([, v]) => v.kind === selPart.kind) : [];

  return (
    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">维修关卡</h1>
        <span className="border border-line bg-white px-2 py-0.5 text-xs text-ink-soft">早期原型，简化仿真 · 不替代真实安全培训</span>
        <div className="ml-auto flex gap-1">
          <button type="button" className={tab === "play" ? btnOn : btn} onClick={() => setTab("play")} data-testid="tab-play">闯关</button>
          <button type="button" className={tab === "editor" ? btnOn : btn} onClick={() => setTab("editor")} data-testid="tab-editor">关卡编辑器</button>
        </div>
      </div>
      {tab === "editor" ? (
        <RepairEditor onSaved={() => setCustoms(customList())} onPlay={(id) => { setCustoms(customList()); setTab("play"); setTimeout(() => setScenario(id), 0); }} />
      ) : (<>
      <div className="grid gap-3 lg:grid-cols-[230px_1fr_330px]">
        {/* 关卡列表 */}
        <aside className="space-y-1" data-testid="scenario-list">
          {all.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setScenario(s.id)} data-testid={`sc-${s.id}`}
              className={`block w-full border px-2 py-1.5 text-left text-sm ${s.id === sid ? "border-copper bg-[#fbf3ea]" : "border-line bg-white hover:border-copper"}`}>
              <div className="flex justify-between"><span>{s.custom ? "自制" : i + 1}. {s.title}</span><span className="text-xs text-ink-soft">{progress[s.id] ? "★".repeat(progress[s.id]) : ""}</span></div>
              <div className="text-xs text-ink-soft">难度 {STAR(s.stars || 1)} · {s.template === "bench" || s.board ? "自制板" : TPL_ZH[s.template]}</div>
            </button>
          ))}
          <h3 className="pt-2 text-sm font-medium">示波器关卡（v18，时域仿真）</h3>
          {SCOPE_SCENARIOS.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setScenario(s.id)} data-testid={`scope-sc-${s.id}`}
              className={`block w-full border px-2 py-1.5 text-left text-sm ${s.id === sid ? "border-copper bg-[#fbf3ea]" : "border-line bg-white hover:border-copper"}`}>
              <div className="flex justify-between"><span>S{i + 1}. {s.title}</span><span className="text-xs text-ink-soft">{progress[s.id] ? "★".repeat(progress[s.id]) : ""}</span></div>
              <div className="text-xs text-ink-soft">难度 {STAR(s.stars || 1)} · {TPL_ZH[s.template]}</div>
            </button>
          ))}
          <p className="pt-2 text-xs text-ink-soft">星星：3 星 = 90 分以上。提示扣 {HINT_COST.join(" / ")} 分；带电焊接 / 改线扣 15 分。工时都是估算。</p>
        </aside>

        {/* 板子 */}
        <main className="min-w-0 space-y-2">
          <div className="border border-line bg-white p-2 text-sm" data-testid="complaint">
            <b>客户：</b>{sc.complaint}
            <ul className="mt-1 list-disc pl-5 text-ink-soft">{sc.symptoms?.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="flex flex-wrap items-center gap-1" data-testid="toolbar">
            {TOOL_ORDER.map((k) => (
              <button key={k} type="button" className={game.tool === k ? btnOn : btn} onClick={() => { game.tool = k; rerender(); }} data-testid={`tool-${k}`} title={`快捷键 ${TOOLS[k].key}`}>{TOOLS[k].key} {TOOLS[k].zh}</button>
            ))}
            <span className="mx-1 h-6 w-px bg-line" />
            <button type="button" className={btn} onClick={() => setSide((s) => (s === "front" ? "back" : "front"))} data-testid="flip">翻面（现在：{side === "front" ? "正面" : "背面"}）</button>
            <button type="button" className={btn} onClick={() => setRot((r) => (r + 90) % 360)} data-testid="rotate">旋转 90°</button>
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(6, z * 1.5))} data-testid="zoom-in">放大</button>
            <button type="button" className={btn} onClick={() => { setZoom(1); setPan([0, 0]); }}>复位视图</button>
            <button type="button" className={td ? btnOn : btn} onClick={() => setTd((v) => !v)} disabled={!!sc.scope} data-testid="td-toggle" title="时域模式：打开示波器，看电压随时间怎么变">{td ? "时域（示波器）已开" : "时域模式"}</button>
          </div>
          <BoardView board={b} obs={o} side={side} rot={rot} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan} loupe={game.tool === "magnifier"} running={game.running} onPick={pick} selected={sel} probes={{ red: game.red, black: game.black }} scopeProbes={td ? scope.chans.map((c, i) => (c.on && c.node ? { net: c.node, color: CH_COLOR[i], label: `CH${i + 1}` } : null)).filter(Boolean) : []} />
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <button type="button" className={game.power ? btnOn : btn} onClick={() => act({ a: "power", on: !game.power })} data-testid="power">{game.power ? "● 已通电（点击断电）" : "○ 已断电（点击通电）"}</button>
            {hasRun && <button type="button" className={game.running ? btnOn : btn} onClick={() => act({ a: "run", on: !game.running })} data-testid="run" disabled={!game.power}>{game.running ? "停止运行测试" : "运行测试（舵机动起来）"}</button>}
            {bat && (bat.state.present === false
              ? <><button type="button" className={btn} onClick={() => act({ a: "battery", op: "insert", orient })} data-testid="bat-insert">装回原来的电池</button>
                  {Object.entries(BIN).filter(([, v]) => v.kind === "bat" && v.chem === bat.props.chem).map(([k, v]) => <button key={k} type="button" className={btn} onClick={() => act({ a: "battery", op: "insert", item: k, orient })} data-testid={`bat-${k}`}>装 {v.zh}</button>)}</>
              : <button type="button" className={btn} onClick={() => act({ a: "battery", op: "remove" })} data-testid="bat-remove">拆下电池 {bat.ref}</button>)}
            <span className="mx-1 h-6 w-px bg-line" />
            <button type="button" className={btn} onClick={() => act({ a: "hint" })} disabled={game.hints >= 3} data-testid="hint">提示 {game.hints}/3{game.hints < 3 ? `（扣 ${HINT_COST[game.hints]} 分）` : ""}</button>
            <button type="button" className={btnOn} onClick={() => act({ a: "deliver" })} disabled={game.done} data-testid="deliver">交付验收</button>
            <button type="button" className={btn} onClick={() => setScenario(sid)} data-testid="restart">重来</button>
            <span className="ml-auto text-xs text-ink-soft">工时 {game.minutes.toFixed(1)} 分钟（估算，标准 {sc.parMin}）</span>
          </div>
          {flash && <p className={`border px-2 py-1 text-sm ${flash.bad ? "border-red-300 bg-red-50 text-red-800" : "border-line bg-white"}`} data-testid="flash">{flash.text}</p>}
          {hintsShown.length > 0 && <ol className="list-decimal border border-amber-300 bg-amber-50 py-1 pl-6 pr-2 text-sm" data-testid="hints">{hintsShown.map((h) => <li key={h}>{h}</li>)}</ol>}
          {report && <ReportCard r={report} onNext={() => { const L = sc.scope ? SCOPE_SCENARIOS : all; const i = L.findIndex((s) => s.id === sid); if (L[i + 1]) setScenario(L[i + 1].id); }} />}
        </main>

        {/* 右栏：选中对象、万用表、状态、记录 */}
        <aside className="space-y-2 text-sm">
          <section className="border border-line bg-white p-2" data-testid="context">
            <h2 className="mb-1 font-medium">选中：{!sel ? "（在板子上点一下）" : sel.type === "pin" ? `${sel.ref} 的 ${sel.pin} 脚` : sel.type === "pad" ? `背面焊盘 ${sel.ref}.${sel.pin}（${sel.net}）` : sel.type === "tp" ? `测试点 ${sel.tp}（${sel.net}）` : sel.ref || sel.id}</h2>
            {selPart && <p className="mb-1 text-xs text-ink-soft">{selPart.zh}{selPart.state.present === false ? "（空焊盘）" : ""}</p>}
            <div className="flex flex-wrap gap-1">
              {probeTarget(sel || {}) && <>
                <button type="button" className={btn} onClick={() => act({ a: "probe", red: probeTarget(sel), mode: game.mode })} data-testid="probe-red">红表笔放这</button>
                <button type="button" className={btn} onClick={() => act({ a: "probe", black: probeTarget(sel), mode: game.mode })} data-testid="probe-black">黑表笔放这</button>
              </>}
              {(sel?.ref || ["wire", "trace", "short"].includes(sel?.type)) && <>
                <A a={{ a: "inspect", ref: sel.ref || sel.id }}>看</A>
                <A a={{ a: "inspect", ref: sel.ref || sel.id, mag: 3 }}>放大镜看</A>
              </>}
              {selPart && selPart.state.present !== false && !selPart.offBoard && <>
                <A a={{ a: "wiggle", ref: selPart.ref, pin: sel.pin }}>拨一拨</A>
                <A a={{ a: "reflow", ref: selPart.ref, pin: sel.pin }}>补焊{sel.pin ? "这只脚" : "所有脚"}</A>
                {!["conn", "bat"].includes(selPart.kind) && <A a={{ a: "desolder", ref: selPart.ref }}>拆下</A>}
              </>}
              {selPart?.kind === "conn" && <><A a={{ a: "reseat", ref: selPart.ref }}>插紧</A><A a={{ a: "flipConn", ref: selPart.ref }}>插头掉个头</A><A a={{ a: "replaceConn", ref: selPart.ref }}>换插座</A></>}
              {selPart?.kind === "dcin" && <A a={{ a: "fixPolarity", ref: selPart.ref }}>换成极性正确的线</A>}
              {sel?.type === "short" && <><A a={{ a: "wick", id: sel.id }}>吸锡</A><A a={{ a: "removeWire", id: sel.id }}>拆飞线</A></>}
              {sel?.type === "trace" && <A a={{ a: "jumper", trace: sel.id, item: "wire-30" }}>30AWG 飞线跨过去</A>}
              {sel?.type === "wire" && b.wires.find((w) => w.id === sel.id)?.cable && <A a={{ a: "recrimp", id: sel.id }}>重新压端子</A>}
              {selPart?.kind === "servo" && <A a={{ a: "swapServo", ref: selPart.ref }}>换一个舵机</A>}
              {sel?.type === "wire" && !b.wires.find((w) => w.id === sel.id)?.cable && Object.entries(BIN).filter(([, v]) => v.kind === "wire").map(([k, v]) => <A key={k} a={{ a: "rewire", id: sel.id, item: k }}>换成 {v.zh}</A>)}
            </div>
            {selPart && selPart.state.present === false && (
              <div className="mt-2 border-t border-line pt-2" data-testid="bin">
                <p className="mb-1 font-medium">零件箱（装错有后果）</p>
                <div className="flex flex-wrap gap-1">{binFor.map(([k, v]) => <button key={k} type="button" className={item === k ? btnOn : btn} onClick={() => setItem(k)} data-testid={`bin-${k}`}>{v.zh}</button>)}</div>
                {(["led", "diode"].includes(selPart.kind) || (selPart.kind === "cap" && BIN[item]?.polar)) && <div className="mt-1 flex gap-1"><button type="button" className={orient === 1 ? btnOn : btn} onClick={() => setOrient(1)} data-testid="orient-ok">按丝印方向{selPart.kind === "cap" ? "（负极条对着 − 号）" : ""}</button><button type="button" className={orient === -1 ? btnOn : btn} onClick={() => setOrient(-1)} data-testid="orient-rev">反着装</button></div>}
                <div className="mt-1"><A a={{ a: "place", ref: selPart.ref, item: binFor.some(([k]) => k === item) ? item : binFor[0]?.[0], orient }} disabled={!binFor.length}>焊上</A></div>
              </div>
            )}
          </section>

          <section className="border border-line bg-white p-2" data-testid="meter">
            <h2 className="mb-1 font-medium">万用表</h2>
            <div className="mb-1 flex flex-wrap gap-1">{Object.entries(MODE_ZH).map(([k, v]) => <button key={k} type="button" className={game.mode === k ? btnOn : btn} onClick={() => { game.mode = k; rerender(); }} data-testid={`mode-${k}`}>{v}</button>)}</div>
            <div className="bg-[#c8d4b8] px-2 py-2 font-mono text-lg text-[#1d2a12]" data-testid="reading">{reading.text}</div>
            <p className="mt-1 text-xs">红 <b className="text-red-700">{label(game.red)}</b> · 黑 <b>{label(game.black)}</b>{game.tool === "meter" && <> · 下一次点击放 {nextProbe === "red" ? "红" : "黑"}表笔</>}</p>
            {reading.warn && <p className="text-xs text-red-700">{reading.warn}</p>}
            <p className="mt-1 text-xs text-ink-soft">只量低压板子。永远不要用表笔去碰市电（220 V 插座、适配器里面）。</p>
          </section>

          <section className="border border-line bg-white p-2" data-testid="status">
            <h2 className="mb-1 font-medium">现象{game.power ? "" : "（断电中）"}</h2>
            <ul className="space-y-0.5 text-xs">
              {Object.entries(o.leds).map(([k, l]) => <li key={k}>{k}：{l.state}</li>)}
              {o.mcu && <li>主控：{o.mcu.state}</li>}
              {o.serial?.slice(-3).map((s, i) => <li key={i} className="font-mono">串口&gt; {s}</li>)}
              {Object.entries(o.servos || {}).length > 0 && <li>舵机：{Object.entries(o.servos).filter(([, s]) => s.moving).length} / {Object.keys(o.servos).length} 在动</li>}
              {o.hot?.map((h) => <li key={h.ref} className="text-orange-700">{h.ref} 烫手</li>)}
              {o.warn?.map((w) => <li key={w} className="text-red-700">{w}</li>)}
            </ul>
          </section>

          <section className="border border-line bg-white p-2">
            <h2 className="mb-1 font-medium">维修记录</h2>
            <ol ref={logRef} className="max-h-56 space-y-0.5 overflow-auto text-xs" data-testid="log">
              {game.log.map((e, i) => <li key={i} className={e.bad ? "text-red-700" : ""}><span className="text-ink-soft">{e.t}′ [{e.kind}]</span> {e.text}</li>)}
            </ol>
          </section>
        </aside>
      </div>
      {td && <div className="mt-3"><ScopePanel s={scope} set={setScope} nodes={scopeNodes(b)} onCapture={() => doCapture()} running={game.running} /></div>}
      </>)}
    </div>
  );
}

function ReportCard({ r, onNext }) {
  return (
    <section className={`border p-3 text-sm ${r.solved ? "border-copper bg-[#fbf3ea]" : "border-red-300 bg-red-50"}`} data-testid="report">
      <h2 className="text-lg font-semibold">{r.solved ? `修好了！${"★".repeat(r.stars)}${"☆".repeat(3 - r.stars)}  ${r.total} 分` : "还没修好"}</h2>
      <ul className="my-1 text-xs">{r.checks?.map((c) => <li key={c.zh} className={c.ok ? "" : "text-red-700"}>{c.ok ? "✓" : "✗"} {c.zh}：{c.info}</li>)}{r.order === false && <li className="text-red-700">✗ 修理顺序不对</li>}</ul>
      {r.solved && <>
        <ul className="text-xs">{r.items.map((x) => <li key={x.zh}>{x.zh}：{x.v > 0 ? "+" : ""}{x.v}</li>)}</ul>
        <p className="mt-2"><b>根本原因：</b>{r.rootCause}</p>
        <p><b>这一关学到：</b>{r.lesson}</p>
        <p><b>安全：</b>{r.safety?.join("；")}；永远不要用表笔碰市电。</p>
        <p className="text-xs text-ink-soft">用到的零件：{r.parts.join("、") || "无"}。{r.cost}。工时 {r.minutes} 分钟 / 标准 {r.parMin} 分钟（估算）。</p>
        <button type="button" className={btnOn + " mt-2"} onClick={onNext} data-testid="next">下一关</button>
      </>}
    </section>
  );
}
