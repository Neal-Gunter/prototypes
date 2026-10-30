// 关卡编辑器：选板子（模板或装配台导入）→ 从列表里挑故障 → 写客户描述和提示 → 校验 → 保存 / 导出
import { useMemo, useRef, useState } from "react";
import { TEMPLATES, makeBoard } from "../boards.js";
import { faultOptions } from "../faults.js";
import { validateScenario, fromBench, exportPack, importPack, LS_KEY } from "../editor.js";
import { BENCH_KEY } from "../benchImport.js";

const btn = "min-h-9 border border-line bg-white px-2.5 text-sm hover:border-copper disabled:opacity-40";
const btnOn = "min-h-9 border border-copper bg-copper px-2.5 text-sm text-white";
const inp = "w-full border border-line bg-white px-2 py-1 text-sm";
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } };
const benchDesc = () => { try { return JSON.parse(localStorage.getItem(BENCH_KEY)); } catch { return null; } };

export default function RepairEditor({ onSaved, onPlay }) {
  const [src, setSrc] = useState(() => (new URLSearchParams(location.search).get("import") === "bench" && benchDesc() ? "bench" : "led"));
  const bench = useMemo(() => benchDesc(), [src]); // eslint-disable-line react-hooks/exhaustive-deps
  const board = useMemo(() => (src === "bench" ? (bench ? fromBench(bench) : null) : makeBoard(src)), [src, bench]);
  const opts = useMemo(() => (board ? faultOptions(board) : []), [board]);
  const [faults, setFaults] = useState([]);
  const [optI, setOptI] = useState(0);
  const [f, setF] = useState({ title: "我的维修关卡", complaint: "客户说：东西不工作了。", symptoms: "", hints: "先量电源。\n再看看焊点。\n", rootCause: "", lesson: "", stars: 2, parMin: 20 });
  const [list, setList] = useState(load);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const sc = useMemo(() => ({
    id: "custom-" + (f.title || "x").replace(/\s+/g, "-").slice(0, 24) + "-" + faults.length,
    stars: +f.stars, title: f.title, complaint: f.complaint, parMin: +f.parMin || 20,
    symptoms: f.symptoms.split("\n").map((x) => x.trim()).filter(Boolean),
    hints: f.hints.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 3),
    rootCause: f.rootCause || "（作者没写）", lesson: f.lesson || "（作者没写）", safety: ["先断电、拔电池再动烙铁", "永远不要用表笔碰市电"],
    ...(src === "bench" ? { board, template: "bench" } : { template: src }),
    faults: faults.map(({ type, target, arg }) => ({ type, target, arg })),
  }), [f, faults, src, board]);
  const v = useMemo(() => (board ? validateScenario(sc) : null), [sc, board]);

  const persist = (L) => { localStorage.setItem(LS_KEY, JSON.stringify(L)); setList(L); onSaved?.(); };
  const save = () => {
    if (!v?.ok) { setMsg("还不能保存：" + v.errors.join("；")); return; }
    while (sc.hints.length < 3) sc.hints.push("（作者没写这一级提示）");
    const L = [...list.filter((x) => x.id !== sc.id), sc];
    persist(L); setMsg(`已保存到本机浏览器（${L.length} 个自制关卡）`);
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(exportPack(list), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "repair-pack.json"; a.click(); URL.revokeObjectURL(a.href);
  };
  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const got = importPack(JSON.parse(await file.text())); const L = [...list.filter((x) => !got.some((g) => g.id === x.id)), ...got]; persist(L); setMsg(`导入了 ${got.length} 个关卡`); }
    catch (err) { setMsg("导入失败：" + err.message); }
    e.target.value = "";
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_360px]" data-testid="editor">
      <div className="space-y-2 text-sm">
        <section className="border border-line bg-white p-2">
          <h2 className="mb-1 font-medium">1. 选板子</h2>
          <div className="flex flex-wrap gap-1">
            {Object.entries(TEMPLATES).map(([k, t]) => <button key={k} type="button" className={src === k ? btnOn : btn} onClick={() => { setSrc(k); setFaults([]); setOptI(0); }} data-testid={`ed-tpl-${k}`}>{t.zh}</button>)}
            <button type="button" className={src === "bench" ? btnOn : btn} onClick={() => { setSrc("bench"); setFaults([]); setOptI(0); }} disabled={!benchDesc()} data-testid="ed-bench">从装配台导入当前电路</button>
          </div>
          <p className="mt-1 text-xs text-ink-soft">{src === "bench" ? (bench ? `导入于 ${new Date(bench.at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}（北京时间）：${board.parts.length} 个零件。只导入电阻、LED 和板子的 3V3 / USB 5V 电源脚；GPIO、按钮、舵机不导入（我的补充：保持简单）。` : "") : "要导入自己的电路：去「装配台」→ 电路面板，点「做成维修关卡」。"}</p>
        </section>
        <section className="border border-line bg-white p-2">
          <h2 className="mb-1 font-medium">2. 注入故障（从列表里选，{opts.length} 种可选）</h2>
          <div className="flex gap-1">
            <select className={inp} value={optI} onChange={(e) => setOptI(+e.target.value)} data-testid="ed-fault-select">{opts.map((o, i) => <option key={i} value={i}>{o.zh}</option>)}</select>
            <button type="button" className={btn} onClick={() => opts[optI] && setFaults([...faults, opts[optI]])} data-testid="ed-fault-add">加入</button>
          </div>
          <ul className="mt-1 text-xs" data-testid="ed-faults">{faults.map((x, i) => <li key={i}>{i + 1}. {x.zh} <button type="button" className="text-red-700 underline" onClick={() => setFaults(faults.filter((_, j) => j !== i))}>删</button></li>)}</ul>
        </section>
        <section className="grid gap-2 border border-line bg-white p-2 md:grid-cols-2">
          <h2 className="font-medium md:col-span-2">3. 关卡文字</h2>
          <label>标题<input className={inp} value={f.title} onChange={set("title")} data-testid="ed-title" /></label>
          <label>难度 / 标准工时（分钟，估算）<div className="flex gap-1"><select className={inp} value={f.stars} onChange={set("stars")}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select><input className={inp} type="number" value={f.parMin} onChange={set("parMin")} /></div></label>
          <label className="md:col-span-2">客户描述<textarea className={inp} rows={2} value={f.complaint} onChange={set("complaint")} data-testid="ed-complaint" /></label>
          <label>现象（一行一条）<textarea className={inp} rows={3} value={f.symptoms} onChange={set("symptoms")} /></label>
          <label>3 级提示（一行一级）<textarea className={inp} rows={3} value={f.hints} onChange={set("hints")} /></label>
          <label>根本原因<textarea className={inp} rows={2} value={f.rootCause} onChange={set("rootCause")} /></label>
          <label>教训<textarea className={inp} rows={2} value={f.lesson} onChange={set("lesson")} /></label>
        </section>
      </div>
      <aside className="space-y-2 text-sm">
        <section className="border border-line bg-white p-2" data-testid="ed-validate">
          <h2 className="mb-1 font-medium">校验</h2>
          {!v ? <p>先选一块板子</p> : <ul className="text-xs">
            {v.errors.map((e) => <li key={e} className="text-red-700">✗ {e}</li>)}
            {v.ok && <li>{v.observable ? "✓ 故障能被观察到（验收项 / LED / 电压有变化）" : "✗ 故障看不出来"}</li>}
            {v.ok && <li>{v.healthyOk ? "✓ 没有故障的板子能通过验收" : "⚠ 没有故障的板子本身也过不了验收"}</li>}
            {v.warn.map((w) => <li key={w} className="text-amber-700">⚠ {w}</li>)}
          </ul>}
          <div className="mt-2 flex flex-wrap gap-1">
            <button type="button" className={btnOn} onClick={save} data-testid="ed-save">保存到本机</button>
            <button type="button" className={btn} onClick={() => { save(); if (v?.ok) onPlay?.(sc.id); }} disabled={!v?.ok} data-testid="ed-play">保存并试玩</button>
          </div>
          {msg && <p className="mt-1 text-xs" data-testid="ed-msg">{msg}</p>}
        </section>
        <section className="border border-line bg-white p-2">
          <h2 className="mb-1 font-medium">自制关卡（{list.length}）</h2>
          <ul className="text-xs">{list.map((s) => <li key={s.id} className="flex justify-between gap-1"><span>{s.title}（{s.faults.length} 个故障）</span><span><button type="button" className="underline" onClick={() => onPlay?.(s.id)}>玩</button> <button type="button" className="text-red-700 underline" onClick={() => persist(list.filter((x) => x.id !== s.id))}>删</button></span></li>)}</ul>
          <div className="mt-2 flex flex-wrap gap-1">
            <button type="button" className={btn} onClick={download} disabled={!list.length} data-testid="ed-export">导出关卡包 JSON</button>
            <button type="button" className={btn} onClick={() => fileRef.current?.click()} data-testid="ed-import">导入关卡包</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={upload} data-testid="ed-file" />
          </div>
          <p className="mt-1 text-xs text-ink-soft">只存在这台电脑的浏览器里（localStorage），不上传。格式 proto-repair/1。</p>
        </section>
      </aside>
    </div>
  );
}
