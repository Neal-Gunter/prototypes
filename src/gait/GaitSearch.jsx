// v14：台面里的“自动步态搜索”面板（八爪鱼和模型实验室共用）。真正的计算在 Web Worker 里（search.worker.js → search-job.js），
// 主线程只画进度。同一个种子 + 同一组设置 → 同一个结果（物理和随机数都是确定的、离线的）。
import { useEffect, useRef, useState } from "react";
import { OBJECTIVES } from "./search.js";
import { curvePath, gaitPeriod } from "./gait.js";

const B = ({ children, on, dis, t, cls = "" }) => <button type="button" disabled={dis} onClick={on} data-testid={t} className={`min-h-7 border border-line bg-white px-2 text-xs disabled:opacity-40 ${cls}`}>{children}</button>;
const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? "—" : (+v).toFixed(d));
const CAPS = [{ n: 40, zh: "40 次（约 1 分钟）" }, { n: 120, zh: "120 次" }, { n: 240, zh: "240 次" }, { n: 480, zh: "480 次（约 10 分钟）" }];

function Chart({ hist, tid }) {
  const W = 300, H = 80;
  if (!hist?.length) return <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-line bg-white" data-testid={`${tid}-chart`} />;
  const xs = hist.map((h) => h.evals), ys = hist.flatMap((h) => [h.best, h.mean]).filter(Number.isFinite);
  const x0 = 0, x1 = Math.max(...xs, 1), y0 = Math.min(...ys), y1 = Math.max(...ys, y0 + 1e-3);
  const X = (v) => ((v - x0) / (x1 - x0)) * (W - 30) + 26, Y = (v) => H - 12 - ((v - y0) / (y1 - y0)) * (H - 20);
  const path = (k) => hist.map((h, i) => `${i ? "L" : "M"}${X(h.evals).toFixed(1)},${Y(h[k]).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-line bg-white" data-testid={`${tid}-chart`}>
      <path d={path("mean")} fill="none" stroke="#bbb" strokeWidth="1" />
      <path d={path("best")} fill="none" stroke="#2f6fd6" strokeWidth="1.6" />
      <text x="2" y="10" fontSize="7" fill="#666">{f(y1)}</text><text x="2" y={H - 12} fontSize="7" fill="#666">{f(y0)}</text>
      <text x={W - 2} y={H - 2} fontSize="7" fill="#666" textAnchor="end">评估次数 {x1}</text>
      <text x="30" y="10" fontSize="7" fill="#2f6fd6">— 至今最好分数</text><text x="110" y="10" fontSize="7" fill="#999">— 每代平均</text>
    </svg>
  );
}
function Preview({ g, tid }) {
  const W = 300, H = 56, T = Math.min(6, 2 * gaitPeriod(g)), range = Math.max(10, ...g.joints.map((J) => Math.abs(J.offset || 0) + Math.abs(J.amp || 0)));
  const cols = ["#2f6fd6", "#d23a2f", "#1f9d55", "#e0b322", "#7b4bd6", "#e07a22", "#2aa6a6", "#a0506e"];
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-line bg-white" data-testid={`${tid}-preview`}><line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#eee" />{g.joints.map((J, i) => <path key={i} d={curvePath(J, W, H, T, range)} fill="none" stroke={cols[i % 8]} strokeWidth="1.1" />)}<text x="3" y="9" fontSize="7" fill="#666">至今最好：{g.joints.length} 个关节 · ±{range.toFixed(0)} · {T.toFixed(1)} s</text></svg>;
}

// props: kind ("octo" | "artic"), makeJob() → job 的模型部分（gait0、project…），onApply(g), onPreview(g), exports [{k, zh, make(g)}], note, tid
export default function GaitSearch({ kind, makeJob, onApply, onPreview, exports = [], note, tid = "search", defaultCap = 120 }) {
  const [obj, setObj] = useState("speed");
  const [w, setW] = useState(OBJECTIVES.mix.w);
  const [seed, setSeed] = useState(1);
  const [cap, setCap] = useState(defaultCap);
  const [maxSec, setMaxSec] = useState(600);
  const [multiMu, setMultiMu] = useState(false);
  const [robust, setRobust] = useState(true);
  const [sym, setSym] = useState(true);
  const [st, setSt] = useState(null); // {running, gen, evals, hist, best, sec, robust, done, err}
  const wk = useRef(null), killT = useRef(null);
  useEffect(() => () => { wk.current?.terminate(); clearTimeout(killT.current); }, []);
  useEffect(() => { window.__gaitSearch = window.__gaitSearch || {}; window.__gaitSearch[tid] = st; });
  const weights = obj === "mix" ? w : OBJECTIVES[obj].w;
  function start() {
    wk.current?.terminate();
    const W = new Worker(new URL("./search.worker.js", import.meta.url), { type: "module" }); wk.current = W;
    const job = { kind, weights, seed: +seed || 1, maxEvals: cap, maxSec, mus: multiMu ? [0.3, 0.5, 0.8] : [0.5], robust, symmetric: sym, ...makeJob() };
    setSt({ running: true, gen: 0, evals: 0, hist: [], best: null, sec: 0, job: { weights, seed: job.seed, cap, mus: job.mus } });
    W.onmessage = (e) => {
      const m = e.data;
      if (m.type === "gen") setSt((s) => ({ ...s, gen: m.gen, evals: m.evals, sec: m.sec, hist: m.hist, best: m.best }));
      else if (m.type === "robust") setSt((s) => ({ ...s, robustP: [m.done, m.total] }));
      else if (m.type === "done") { setSt((s) => ({ ...s, running: false, done: m, best: m.best, hist: m.hist })); W.terminate(); clearTimeout(killT.current); }
      else if (m.type === "error") { setSt((s) => ({ ...s, running: false, err: m.msg })); W.terminate(); }
    };
    W.onerror = (e) => setSt((s) => ({ ...s, running: false, err: String(e.message || "Worker 出错") }));
    W.postMessage({ type: "start", job });
  }
  function cancel() {
    wk.current?.postMessage({ type: "cancel" });
    // 一般 1 次评估（约 1 s）内就会停；3 s 还没停就直接结束 Worker
    clearTimeout(killT.current);
    killT.current = setTimeout(() => { if (wk.current) { wk.current.terminate(); setSt((s) => (s?.running ? { ...s, running: false, cancelled: true } : s)); } }, 3000);
  }
  const best = st?.best, d = st?.done, rb = d?.robust;
  const download = (o) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([o.text], { type: o.mime || "text/plain" })); a.download = o.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  return (
    <fieldset className="flex flex-col gap-1 border border-line bg-white p-2 text-xs" data-testid={`${tid}-panel`}>
      <legend className="font-medium">自动步态搜索（v14 · sep-CMA-ES，后台 Worker）· 早期原型，简化仿真</legend>
      <div className="flex flex-wrap items-center gap-1">
        <label>目标<select value={obj} onChange={(e) => setObj(e.target.value)} data-testid={`${tid}-obj`} className="ml-0.5 border border-line bg-white">{Object.entries(OBJECTIVES).map(([k, o]) => <option key={k} value={k}>{o.zh}</option>)}</select></label>
        <label>种子<input type="number" min="1" value={seed} onChange={(e) => setSeed(Math.max(1, Math.round(+e.target.value) || 1))} data-testid={`${tid}-seed`} className="ml-0.5 w-12 border border-line px-0.5 font-mono" /></label>
        <label>算力上限<select value={cap} onChange={(e) => setCap(+e.target.value)} data-testid={`${tid}-cap`} className="ml-0.5 border border-line bg-white">{CAPS.map((c) => <option key={c.n} value={c.n}>{c.zh}</option>)}{!CAPS.some((c) => c.n === cap) && <option value={cap}>{cap} 次</option>}</select></label>
        <label>最长<input type="number" min="10" max="3600" value={maxSec} onChange={(e) => setMaxSec(Math.min(3600, Math.max(10, +e.target.value || 600)))} data-testid={`${tid}-maxsec`} className="ml-0.5 w-14 border border-line px-0.5 font-mono" />s</label>
      </div>
      {obj === "mix" && <div className="flex flex-wrap gap-2" data-testid={`${tid}-weights`}>{[["speed", "速度"], ["straight", "直线"], ["stable", "稳定"], ["energy", "省电"]].map(([k, zh]) => <label key={k} className="flex items-center gap-0.5">{zh}<input type="range" min="0" max="3" step="0.1" value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value })} data-testid={`${tid}-w-${k}`} /><span className="font-mono">{w[k].toFixed(1)}</span></label>)}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-0.5"><input type="checkbox" checked={multiMu} onChange={(e) => setMultiMu(e.target.checked)} data-testid={`${tid}-multimu`} />每个候选在 μ 0.3 / 0.5 / 0.8 上取平均（防过拟合，慢 3 倍）</label>
        <label className="flex items-center gap-0.5"><input type="checkbox" checked={robust} onChange={(e) => setRobust(e.target.checked)} data-testid={`${tid}-robust`} />搜完做鲁棒性复评</label>
        {kind === "octo" && <label className="flex items-center gap-0.5"><input type="checkbox" checked={sym} onChange={(e) => setSym(e.target.checked)} data-testid={`${tid}-sym`} />左右对称（21 维；不勾 = 33 维）</label>}
      </div>
      <p className="text-ink-soft">打分 = {f(weights.speed, 1)}×速度 − {f(weights.straight, 1)}×(|侧漂| + 0.2×|航向变化|)/时长 − {f(weights.stable, 1)}×(最大倾角/10 + 质心出界) − {f(weights.energy, 1)}×焦耳每 10 cm − 碰撞 − 超 300 °/s。起点 = 编辑器里当前的步态（搜出来的结果不会比起点差）。</p>
      <div className="flex flex-wrap items-center gap-1">
        <B t={`${tid}-start`} dis={st?.running} on={start} cls="border-copper">开始搜索</B>
        <B t={`${tid}-cancel`} dis={!st?.running} on={cancel}>取消</B>
        {st && <span data-testid={`${tid}-status`}>{st.err ? `出错：${st.err}` : st.running ? (st.robustP ? `鲁棒性复评 ${st.robustP[0]}/${st.robustP[1]}…` : `第 ${st.gen} 代 · 已评 ${st.evals}/${st.job.cap} 次 · ${f(st.sec, 0)} s`) : st.cancelled ? "已取消（Worker 已结束）" : d ? `完成：${d.evals} 次评估、${f(d.sec, 0)} s，${d.stopped}` : ""}</span>}
      </div>
      <Chart hist={st?.hist} tid={tid} />
      {best && <>
        <Preview g={best.g} tid={tid} />
        <table className="w-full font-mono text-[11px]" data-testid={`${tid}-best`}><thead><tr className="text-ink-soft"><th className="text-left">μ 0.5</th><th className="text-right">起点</th><th className="text-right">至今最好</th></tr></thead><tbody>
          {[["分数", "score", 3], ["速度 cm/s", "speed", 3], ["侧向漂移 cm", "dx", 2], ["航向变化 °", "dh", 1], ["最大倾角 °", "tiltMax", 2], ["能量 J", "energyJ", 2]].map(([zh, k, n]) => <tr key={k}><td>{zh}</td><td className="text-right">{k === "score" ? f(d?.base?.score ?? st.hist?.[0]?.best, n) : f(d?.base?.r?.[k], n)}</td><td className="text-right" data-testid={`${tid}-best-${k}`}>{k === "score" ? f(best.score, n) : f(best.r?.[k], n)}</td></tr>)}
        </tbody></table>
        <div className="flex flex-wrap items-center gap-1">
          {onPreview && <B t={`${tid}-preview-run`} on={() => onPreview(best.g)}>在台面上预览</B>}
          {onApply && <B t={`${tid}-apply`} on={() => onApply(best.g)} cls="border-copper">应用到编辑器</B>}
          <B t={`${tid}-export-json`} on={() => download({ name: "gait-search.json", mime: "application/json", text: JSON.stringify({ schema: "proto-gait/1", ...best.g, search: { ...st.job, evals: d?.evals ?? st.evals, score: best.score, metrics: best.r, robust: rb ? { base: strip(rb.base), best: strip(rb.best) } : null } }, null, 1) })}>导出 JSON</B>
          {exports.map((x) => <B key={x.k} t={`${tid}-export-${x.k}`} on={() => { const o = x.make(best.g); if (o) download(o); }}>{x.zh}</B>)}
        </div>
      </>}
      {rb?.best && <RobustTable rb={rb} tid={tid} />}
      {note && <p className="text-ink-soft">{note}</p>}
    </fieldset>
  );
}
const strip = (x) => (x ? { speedMin: x.speedMin, speedMean: x.speedMean, driftMax: x.driftMax, driftMean: x.driftMean, rows: x.rows.map((r) => ({ tag: r.tag, speed: r.speed, dx: r.dx, dh: r.dh })) } : null);
function RobustTable({ rb, tid }) {
  return (
    <div data-testid={`${tid}-robust-table`}>
      <p className="font-medium">鲁棒性复评（防过拟合）：μ 0.3 / 0.5 / 0.8、机身质量 ×0.9 / ×1.1、5 个随机种子（每个关节 ±2° 装配零位误差 + 0–1 s 起步延迟，估算）</p>
      <table className="w-full font-mono text-[11px]"><thead><tr className="text-ink-soft"><th className="text-left">工况</th><th className="text-right">起点 速度 / 侧漂</th><th className="text-right">搜索结果 速度 / 侧漂</th></tr></thead><tbody>
        {rb.best.rows.map((r, i) => <tr key={i}><td>{r.tag}</td><td className="text-right">{f(rb.base.rows[i]?.speed, 3)} / {f(rb.base.rows[i]?.dx, 2)}</td><td className="text-right">{f(r.speed, 3)} / {f(r.dx, 2)}</td></tr>)}
        <tr className="font-semibold"><td>最差速度 / 平均速度</td><td className="text-right">{f(rb.base.speedMin, 3)} / {f(rb.base.speedMean, 3)}</td><td className="text-right" data-testid={`${tid}-robust-best`}>{f(rb.best.speedMin, 3)} / {f(rb.best.speedMean, 3)}</td></tr>
        <tr><td>最大 |侧漂|</td><td className="text-right">{f(rb.base.driftMax, 2)}</td><td className="text-right">{f(rb.best.driftMax, 2)}</td></tr>
      </tbody></table>
      <p className="text-ink-soft">{rb.best.speedMin >= rb.base.speedMin ? "最差工况也不比起点差。" : "注意：最差工况比起点差——这个结果可能只在 μ 0.5 上好（过拟合），建议勾“多 μ 平均”重搜。"}</p>
    </div>
  );
}
