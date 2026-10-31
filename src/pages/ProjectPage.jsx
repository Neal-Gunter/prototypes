// v25：引导项目“从零做一只八爪鱼”（v10 紧凑无线版）：选零件 → 装配 → 接线 → 焊接 → 仿真检查 → 装触手 → 制作单。
// 进度存在本机浏览器（localStorage）。早期原型，简化仿真。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as P from "../project/octoProject.js";
import { buildSheet, sheetMarkdown, sheetHtml } from "../project/buildSheet.js";
import { loadIndex } from "../assembly/catalog.js";
import { LIC_ZH, SRC_ZH } from "../assembly/partsSearch.js";
import { DECK_V10 } from "../assembly/octopus/layout-v10.js";
import BODY_H from "../assembly/octopus/plus/octopus_plus/octopus_body.h?raw";
import BATT_H from "../assembly/octopus/plus/octopus_plus/octopus_batt.h?raw";
import { useLang, tr } from "../i18n.js";

const FW = P.firmwarePins(BODY_H, BATT_H);
const btn = "min-h-9 border border-line bg-white px-2.5 text-sm hover:border-copper disabled:opacity-40";
const btnOn = "min-h-9 border border-copper bg-copper px-2.5 text-sm text-white";
const PROC_ROWS = [["p-octo-frame-v10", "PLA 骨架 + 上层板（v10）", "v10 frame", "struct", [90, 90, 37], "CC0", "proc", ""], ["p-octo-arm-v10", "PLA 短触手（v10）", "v10 arm", "struct", [60, 8, 4], "CC0", "proc", ""], ["p-octo-vdiv-1s", "100k/100k 电池检测分压小板", "1S divider", "passive", [10, 6, 2], "CC0", "proc", ""]];
const load = () => { try { const s = JSON.parse(localStorage.getItem(P.PROJECT_KEY)); return s && s.v === 25 ? s : P.emptyState(); } catch { return P.emptyState(); } };
const Q_ZH = { good: "合格", cold: "虚焊", bridge: "连锡", lifted: "焊盘翘起" };
const Q_CLS = { good: "text-green-700", cold: "text-amber-700", bridge: "text-red-700", lifted: "text-red-700" };
const download = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };

function Checks({ list }) {
  return (
    <ul className="space-y-1" data-testid="checks">
      {list.map((c, i) => {
        const st = c.ok ? (c.level === "warn" ? "warn" : "ok") : c.level === "warn" ? "warn" : "fail";
        return (
          <li key={i} className="text-sm" data-testid="check" data-state={st}>
            <span className={st === "ok" ? "text-green-700" : st === "warn" ? "text-amber-700" : "text-red-700"}>{st === "ok" ? "✓" : st === "warn" ? "⚠" : "✗"}</span> {c.group ? <b className="text-ink-soft">{c.group} · </b> : null}{c.zh}
            {!c.ok && c.hint ? <div className="ml-5 text-xs text-ink-soft" data-testid="hint">{tr("提示")}：{c.hint}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}

function DeckView({ state, dims }) {
  const S = 24; // px / cm
  const roles = Object.keys(DECK_V10);
  return (
    <svg viewBox="-110 -110 220 220" className="h-64 w-64 border border-line bg-white" data-testid="deck-view" role="img" aria-label={tr("上层板俯视图")}>
      <circle r={P.DECK_R * S} fill="#f6f1e7" stroke="#999" />
      {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; const on = state.placed?.[`S${i}`] === `S${i}`; return <rect key={i} x={Math.cos(a) * 3.9 * S - 6} y={Math.sin(a) * 3.9 * S - 6} width="12" height="12" fill={on ? "#b87333" : "none"} stroke="#b87333" strokeDasharray={on ? "" : "2 2"} />; })}
      {roles.map((r) => { const at = state.placed?.[r]; if (!at) return null; const f = P.footprint(r, at, dims); if (!f) return null; return (
        <g key={r}><rect x={f.x0 * S} y={f.z0 * S} width={(f.x1 - f.x0) * S} height={(f.z1 - f.z0) * S} fill={f.layer ? "rgba(70,120,200,.35)" : at === r ? "rgba(90,160,90,.35)" : "rgba(220,60,60,.4)"} stroke="#333" strokeWidth=".6" /><text x={(f.x0 + f.x1) * S / 2} y={(f.z0 + f.z1) * S / 2 + 3} fontSize="8" textAnchor="middle">{r}</text></g>
      ); })}
    </svg>
  );
}

export default function ProjectPage() {
  useLang();
  const [state, setState] = useState(load);
  const [rows, setRows] = useState(null);
  const [step, setStep] = useState(() => new URLSearchParams(location.search).get("step") || null);
  const [q, setQ] = useState("");
  const [wa, setWa] = useState(""); const [wb, setWb] = useState("");
  const [t, setT] = useState(1.0); const [flux, setFlux] = useState(true); const [des, setDes] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { loadIndex().then((i) => setRows([...i.parts, ...PROC_ROWS])); }, []);
  useEffect(() => { localStorage.setItem(P.PROJECT_KEY, JSON.stringify(state)); }, [state]);
  const dims = useMemo(() => Object.fromEntries((rows || []).map((r) => [r[0], r[4]])), [rows]);
  const prog = useMemo(() => P.progress(state, { dims, fw: FW }), [state, dims]);
  const cur = step || P.STEPS[Math.max(0, prog.first)]?.k || "finish";
  const ci = P.STEPS.findIndex((s) => s.k === cur);
  // 打开时停在第一个没做完的步骤；之后不自动跳走（做完一步由“下一步”前进）
  useEffect(() => { if (!step && rows) setStep(cur); }, [step, rows, cur]);
  const nodes = useMemo(() => P.nodeList(), []);
  const sim = useMemo(() => (cur === "check" ? P.checkSim(state, FW) : null), [cur, state]);
  const sheet = useMemo(() => (cur === "finish" && rows ? buildSheet(state, rows, { fw: FW }) : null), [cur, state, rows]);
  const meter = useMemo(() => (cur === "check" || cur === "finish" ? P.meterTable(state) : []), [cur, state]);
  useEffect(() => { window.__project = { get state() { return state; }, set: setState, P, FW, get prog() { return prog; }, sheet: () => rows && buildSheet(state, rows, { fw: FW }) }; }, [state, prog, rows]);
  const upd = (f) => setState((s) => { const n = structuredClone(s); f(n); return n; });

  const results = useMemo(() => {
    if (!rows || !q.trim()) return [];
    const k = q.trim().toLowerCase();
    return rows.filter((r) => r[0].toLowerCase().includes(k) || String(r[1]).toLowerCase().includes(k) || String(r[2]).toLowerCase().includes(k) || String(r[7]).toLowerCase().includes(k)).slice(0, 12);
  }, [rows, q]);
  const byId = useMemo(() => Object.fromEntries((rows || []).map((r) => [r[0], r])), [rows]);

  const req = P.bomRequired();
  const pads = P.padsInUse(state);
  const seq = P.solderSequence(state);
  const lifted = [...new Set(pads.filter((n) => state.joints?.[n]?.q === "lifted").map((n) => n.split(":")[0]))];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6" data-testid="project-page">
      <p className="text-xs text-ink-soft">{tr("早期原型，简化仿真")} · {tr("进度只存在这台设备的浏览器里")}</p>
      <h1 className="mt-1 text-2xl font-semibold">{tr("从零做一只八爪鱼", "Build the octopus from scratch")} <span className="text-base font-normal text-ink-soft">v10 {tr("紧凑无线版")}</span></h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">{tr("跟着 6 步把在线仿真和动手制作连起来：每一步都有通过 / 不通过的检查和提示；做完生成可打印的制作单（零件、接线、焊接顺序、万用表读数、安全）。数字标“估算”的是模型值，没在实物上测过。")}</p>
      <ol className="mt-4 flex flex-wrap gap-1" data-testid="stepper">
        {P.STEPS.map((s, i) => (
          <li key={s.k}><button type="button" className={s.k === cur ? btnOn : btn} onClick={() => setStep(s.k)} data-testid={`step-${s.k}`} data-done={prog.done[i] ? "1" : "0"}>{prog.done[i] ? "✓ " : `${i + 1}. `}{tr(s.zh, s.en)}</button></li>
        ))}
        <li className="ml-auto"><button type="button" className={btn} onClick={() => { if (confirm(tr("清空本机保存的项目进度？"))) { setState(P.emptyState()); setStep(null); setMsg(null); } }} data-testid="reset-project">{tr("重置项目")}</button></li>
      </ol>
      <div className="mt-1 h-1.5 w-full bg-line"><div className="h-1.5 bg-copper" style={{ width: `${(prog.done.filter(Boolean).length / 6) * 100}%` }} data-testid="progress-bar" /></div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section data-testid={`panel-${cur}`}>
          <h2 className="text-lg font-semibold">{ci + 1}. {tr(P.STEPS[ci].zh, P.STEPS[ci].en)}</h2>

          {cur === "bom" && (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-ink-soft">{tr("在零件库里搜零件，加到清单里。v10 需要的零件和数量见右边的检查。价格不写（全部未核实）。")}</p>
              <input className="w-full border border-line px-2 py-1" placeholder={tr("搜零件：例如 qt py、servo、ada-4654、lipo")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="bom-search" />
              {!rows && <p className="text-sm">{tr("正在加载零件库…")}</p>}
              <ul className="divide-y divide-line border border-line" data-testid="bom-results">
                {results.map((r) => (
                  <li key={r[0]} className="flex items-center gap-2 px-2 py-1 text-sm"><span className="flex-1">{r[1]} <span className="text-ink-soft">· {r[0]} · {LIC_ZH[r[5]] || r[5]} · {SRC_ZH[r[6]] || r[6]}</span></span><button type="button" className={btn} onClick={() => upd((s) => { s.bom[r[0]] = (s.bom[r[0]] || 0) + 1; })} data-testid={`bom-add-${r[0]}`}>+ {tr("加入")}</button></li>
                ))}
              </ul>
              <h3 className="font-semibold">{tr("我的清单")}</h3>
              <table className="w-full text-sm" data-testid="bom-table"><tbody>
                {Object.entries(state.bom).filter(([, n]) => n > 0).map(([id, n]) => (
                  <tr key={id} className="border-b border-line"><td className="py-1">{byId[id]?.[1] || id} <span className="text-ink-soft">{id}</span></td><td className="w-40 text-right"><button type="button" className={btn} onClick={() => upd((s) => { s.bom[id] = Math.max(0, n - 1); })} aria-label="−">−</button> <span className="inline-block w-6 text-center" data-testid={`bom-qty-${id}`}>{n}</span> <button type="button" className={btn} onClick={() => upd((s) => { s.bom[id] = n + 1; })} aria-label="+">+</button> <span className={n === req[id] ? "text-green-700" : "text-red-700"}>/ {req[id] ?? 0}</span></td></tr>
                ))}
              </tbody></table>
            </div>
          )}

          {cur === "assemble" && (
            <div className="mt-2 flex flex-wrap gap-4">
              <div className="flex-1 space-y-1 text-sm">
                <p className="text-ink-soft">{tr("给每个零件选位置（顺序有关：骨架第一；充电板和 QT Py 贴在电池上面，电池要先放）。重叠和超出上层板按库里外形尺寸算。")}</p>
                {P.SLOTS.map((r) => (
                  <label key={r} className="flex items-center gap-2"><span className="w-28">{r === "FRAME" ? tr("骨架") : P.roleZh(r)}</span>
                    <select className="border border-line px-1" value={state.placed[r] || ""} data-testid={`asm-sel-${r}`} onChange={(e) => { const v = e.target.value; upd((s) => { if (v) { s.placed[r] = v; s.order = [...s.order.filter((x) => x !== r), r]; } else { delete s.placed[r]; s.order = s.order.filter((x) => x !== r); } }); }}>
                      <option value="">{tr("（还没放）")}</option>
                      {(r === "FRAME" ? ["FRAME"] : /^S\d$/.test(r) ? P.SLOTS.filter((x) => /^S\d$/.test(x)) : Object.keys(DECK_V10)).map((x) => <option key={x} value={x}>{x === "FRAME" ? tr("桌面") : /^S\d$/.test(x) ? `${tr("舵机槽")} ${x}` : `${tr("位置")}：${P.roleZh(x)}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <DeckView state={state} dims={dims} />
            </div>
          )}

          {cur === "wire" && (
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-ink-soft">{tr("选两个引脚连一根线（引脚名来自 Adafruit 引脚图）。JST 电池线是插头，不焊；接线检查按“线都焊好、电池插上”算。")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select className="max-w-xs border border-line px-1" value={wa} onChange={(e) => setWa(e.target.value)} data-testid="wire-a"><option value="">{tr("从…")}</option>{nodes.map((n) => <option key={n.n} value={n.n}>{P.nodeLabel(n.n)}</option>)}</select>
                <span>→</span>
                <select className="max-w-xs border border-line px-1" value={wb} onChange={(e) => setWb(e.target.value)} data-testid="wire-b"><option value="">{tr("到…")}</option>{nodes.map((n) => <option key={n.n} value={n.n}>{P.nodeLabel(n.n)}</option>)}</select>
                <button type="button" className={btn} disabled={!wa || !wb || wa === wb} data-testid="wire-add" onClick={() => { upd((s) => { if (!s.wires.some((w) => P.keyOf(w.a, w.b) === P.keyOf(wa, wb))) s.wires.push({ a: wa, b: wb }); }); setWa(""); setWb(""); }}>+ {tr("连线")}</button>
              </div>
              <p className="text-xs text-ink-soft" data-testid="wire-count">{tr("已接")} {state.wires.length} / {P.refConnections().length}</p>
              <ul className="max-h-80 overflow-auto border border-line" data-testid="wire-list">
                {state.wires.map((w, i) => <li key={i} className="flex items-center gap-2 border-b border-line px-2 py-0.5"><span className="flex-1">{P.nodeLabel(w.a)} → {P.nodeLabel(w.b)}</span><button type="button" className="text-xs text-red-700" onClick={() => upd((s) => { s.wires.splice(i, 1); })} data-testid={`wire-del-${i}`}>{tr("删除")}</button></li>)}
              </ul>
            </div>
          )}

          {cur === "solder" && (
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-ink-soft">{tr("按推荐顺序点焊盘焊接。加热时间和助焊剂决定焊点质量（和 3D 装配台同一套估算模型）：太短虚焊、太长或没助焊剂在相邻焊盘边容易连锡、再长烫坏焊盘。想在 3D 里练：")} <Link className="underline" to="/assembly?scene=electrics">{tr("电路练习")}</Link> · <Link className="underline" to="/assembly?scene=fault">{tr("故障练习（虚焊 + 反装）")}</Link></p>
              <div className="flex flex-wrap items-center gap-3 border border-line bg-white p-2">
                <label className="flex items-center gap-1">{tr("电池")} <button type="button" className={state.batPlugged ? btnOn : btn} onClick={() => upd((s) => { s.batPlugged = !s.batPlugged; })} data-testid="bat-plug">{state.batPlugged ? tr("插着") : tr("拔掉了")}</button></label>
                <label className="flex items-center gap-1">{tr("加热")} <input type="range" min="0.2" max="6" step="0.1" value={t} onChange={(e) => setT(+e.target.value)} data-testid="solder-t" /> <span className="w-12" data-testid="solder-t-val">{t.toFixed(1)} s</span></label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={flux} onChange={(e) => setFlux(e.target.checked)} data-testid="solder-flux" /> {tr("助焊剂")}</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={des} onChange={(e) => setDes(e.target.checked)} data-testid="solder-mode" /> {tr("拆焊（吸锡带）")}</label>
              </div>
              {msg && <p className={msg.ok ? "text-green-700" : "text-red-700"} data-testid="solder-msg">{msg.text}</p>}
              {lifted.map((r) => <button key={r} type="button" className={btn} onClick={() => { setState((s) => P.replaceBoard(s, r)); setMsg({ ok: true, text: `${P.roleZh(r)} ${tr("换了一块新板（焊点清空）")}` }); }} data-testid={`replace-${r}`}>{tr("换新板")}：{P.roleZh(r)}</button>)}
              {!pads.length && <p>{tr("先完成接线：焊点从接线里来。")}</p>}
              <ol className="grid gap-1 sm:grid-cols-2" data-testid="pad-list">
                {seq.map((x, i) => { const j = state.joints?.[x.n]; return (
                  <li key={x.n}><button type="button" className={`${btn} w-full text-left`} title={x.why} data-testid={`pad-${x.n}`} data-q={j?.q || ""} onClick={() => { const r = P.solderOp(state, x.n, { t, flux, desolder: des }); setState(r.state); setMsg({ ok: r.ok, text: `${P.nodeLabel(x.n)}：${r.msg}` }); }}>
                    <span className="text-ink-soft">{i + 1}.</span> {P.nodeLabel(x.n)} <span className={Q_CLS[j?.q] || "text-ink-soft"}>{j?.q ? Q_ZH[j.q] : tr("未焊")}{j?.wear ? ` · ${tr("返修")} ${j.wear}` : ""}</span>
                  </button></li>
                ); })}
              </ol>
            </div>
          )}

          {cur === "check" && sim && (
            <div className="mt-2 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-3 border border-line bg-white p-2">
                <label className="flex items-center gap-1">{tr("电池")} <button type="button" className={state.batPlugged ? btnOn : btn} onClick={() => upd((s) => { s.batPlugged = !s.batPlugged; })} data-testid="bat-plug">{state.batPlugged ? tr("插着") : tr("拔掉了")}</button></label>
                <label className="flex items-center gap-1">{tr("开关")} <button type="button" className={state.swOn ? btnOn : btn} onClick={() => upd((s) => { s.swOn = !s.swOn; })} data-testid="sw-on">{state.swOn ? "ON" : "OFF"}</button></label>
                <span data-testid="rails">{tr("电池")} {sim.idle.rails.vbat} V · {tr("升压")} {sim.idle.rails.boost?.BST1?.v ?? 0} / {sim.idle.rails.boost?.BST2?.v ?? 0} V · 3V3 {sim.idle.rails.v33} V · {tr("电流")} {(sim.idle.rails.iBat * 1000).toFixed(0)} mA（{tr("估算")}）</span>
              </div>
              <h3 className="font-semibold">{tr("万用表应该读到（求解器）")}</h3>
              <MeterTable rows={meter} />
            </div>
          )}

          {cur === "finish" && (
            <div className="mt-2 space-y-3 text-sm">
              <p className="text-ink-soft">{tr("固件把舵机回中（90°）后再装舵盘和触手，否则触手角度会偏。")}</p>
              <button type="button" className={state.armsOn ? btnOn : btn} onClick={() => upd((s) => { s.armsOn = !s.armsOn; })} data-testid="arms-on">{state.armsOn ? tr("✓ 8 条触手已装上") : tr("舵机回中 → 装上 8 条触手")}</button>
              <h3 className="font-semibold">{tr("制作单")}</h3>
              {sheet && <p data-testid="sheet-status">{sheet.complete ? tr("按你完成的台面生成。") : tr("项目还没做完：制作单按参考设计生成（单子上会写明）。")}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} disabled={!sheet} onClick={() => download("octopus-v10-build-sheet.md", sheetMarkdown(sheet), "text/markdown;charset=utf-8")} data-testid="sheet-md">{tr("下载 Markdown")}</button>
                <button type="button" className={btn} disabled={!sheet} onClick={() => download("octopus-v10-build-sheet.html", sheetHtml(sheet), "text/html;charset=utf-8")} data-testid="sheet-html">{tr("下载 HTML")}</button>
                <button type="button" className={btn} disabled={!sheet} onClick={() => { const w = window.open(URL.createObjectURL(new Blob([sheetHtml(sheet)], { type: "text/html;charset=utf-8" })), "_blank"); if (!w) setMsg({ ok: false, text: tr("浏览器拦截了新窗口：用下载 HTML") }); }} data-testid="sheet-print">{tr("打印版（新窗口）")}</button>
              </div>
              {sheet && <iframe title={tr("制作单预览")} className="h-[32rem] w-full border border-line bg-white" srcDoc={sheetHtml(sheet)} data-testid="sheet-preview" />}
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <div className="border border-line bg-white p-3">
            <h3 className="mb-1 font-semibold">{tr("这一步的检查")} <span className={prog.done[ci] ? "text-green-700" : "text-red-700"} data-testid="step-verdict">{prog.done[ci] ? tr("通过") : tr("未通过")}</span></h3>
            <Checks list={prog.checks[cur]} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => setState((s) => P.autoStep(s, cur))} data-testid="auto-step" title={tr("会在制作单上注明用了示范")}>{tr("示范：自动完成这一步")}</button>
            {ci < 5 && <button type="button" className={btn} disabled={!prog.done[ci]} onClick={() => setStep(P.STEPS[ci + 1].k)} data-testid="next-step">{tr("下一步")} →</button>}
          </div>
          {state.auto?.length ? <p className="text-xs text-ink-soft" data-testid="auto-used">{tr("用了示范的步骤")}：{state.auto.join("、")}</p> : null}
          <p className="text-xs text-ink-soft">{tr("参考：")} <Link className="underline" to="/assembly/octopus-guide?variant=v10">{tr("八爪鱼指南")}</Link> · <Link className="underline" to="/assembly?scene=octo">{tr("3D 八爪鱼")}</Link> · <Link className="underline" to="/pinouts">{tr("引脚表")}</Link></p>
        </aside>
      </div>
    </div>
  );
}

function MeterTable({ rows }) {
  return (
    <div className="overflow-x-auto"><table className="w-full text-xs" data-testid="meter-table"><thead><tr className="bg-paper text-left"><th className="p-1">{tr("阶段")}</th><th className="p-1">{tr("测哪里")}</th><th className="p-1">{tr("档位")}</th><th className="p-1">{tr("期望")}</th><th className="p-1">{tr("依据")}</th></tr></thead>
      <tbody>{rows.map((m, i) => <tr key={i} className="border-b border-line"><td className="p-1">{m.stage}</td><td className="p-1">{m.where}</td><td className="p-1">{m.mode}</td><td className="p-1">{m.expect}</td><td className="p-1">{m.basis}</td></tr>)}</tbody></table></div>
  );
}
