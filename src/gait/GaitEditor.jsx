// v13：台面步态编辑器（八爪鱼和模型实验室共用）。每个关节一行：波形 / 幅度 / 相位 / 偏置 / 频率 / 占空 + 实时预览曲线。
// 只负责编辑和显示；“在台面上跑”“测量”“导出”由调用方传进来（八爪鱼 = 固件孪生，模型实验室 = ArticCore）。
import { useMemo, useRef, useState } from "react";
import { WAVES, curvePath, maxRate, jointValue, gaitPeriod } from "./gait.js";

const B = ({ children, on, dis, t, cls = "" }) => <button type="button" disabled={dis} onClick={on} data-testid={t} className={`min-h-7 border border-line bg-white px-2 text-xs disabled:opacity-40 ${cls}`}>{children}</button>;
const Num = ({ v, set, step = 1, min, max, t, w = "w-14" }) => <input type="number" step={step} min={min} max={max} value={v} data-testid={t} onChange={(e) => set(+e.target.value)} className={`${w} border border-line px-0.5 text-right font-mono text-[11px]`} />;
const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));

// 全部关节叠在一张图里（2 个周期），竖线 = 当前时刻
function Overview({ g, range, t }) {
  const W = 300, H = 70, T = Math.min(6, 2 * gaitPeriod(g));
  const cols = ["#2f6fd6", "#d23a2f", "#1f9d55", "#e0b322", "#7b4bd6", "#e07a22", "#2aa6a6", "#a0506e"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-line bg-white" data-testid="gait-overview">
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#ddd" />
      {g.joints.map((J, i) => <path key={i} d={curvePath(J, W, H, T, range)} fill="none" stroke={cols[i % cols.length]} strokeWidth="1.2" />)}
      {t != null && <line x1={((t % T) / T) * W} x2={((t % T) / T) * W} y1="0" y2={H} stroke="#333" strokeDasharray="2 2" />}
      <text x="3" y="10" fontSize="8" fill="#666">±{+(+range).toFixed(1)}{g.joints[0]?.unit || "°"} · {T.toFixed(1)} s</text>
    </svg>
  );
}

// props: gait, setGait, presets [{k, zh, make}], rateLimit (°/s), onRun(g), onStop(), onMeasure(g, {sec, mu, onProgress}) → report,
//        exports [{k, zh, make(g) → {name, text, mime}}], note, tid（data-testid 前缀）, time（当前播放时刻，可选）
export default function GaitEditor({ gait, setGait, presets = [], rateLimit = 300, onRun, onStop, onMeasure, exports = [], note, tid = "gait", time = null, measureSec = 15, controlLabel = "冰面对照（μ = 0）" }) {
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState([]);
  const [sec, setSec] = useState(measureSec);
  const [allF, setAllF] = useState("");
  const fileRef = useRef(null);
  const range = useMemo(() => Math.max(10, ...gait.joints.map((J) => Math.abs(+J.offset || 0) + Math.abs(+J.amp || 0))), [gait]);
  const upd = (i, k, v) => setGait({ ...gait, name: gait.name?.endsWith("（已改）") ? gait.name : `${gait.name || "步态"}（已改）`, joints: gait.joints.map((J, n) => (n === i ? { ...J, [k]: v } : J)) });
  const all = (k, v) => setGait({ ...gait, joints: gait.joints.map((J) => ({ ...J, [k]: v })) });
  async function measure(mu = null) {
    if (!onMeasure || busy) return;
    setBusy(0);
    try {
      const r = await onMeasure(gait, { sec, mu, onProgress: (p) => new Promise((ok) => { setBusy(p); setTimeout(ok, 0); }) });
      setRes((x) => [...x.slice(-3), { name: gait.name, mu, sec, r }]);
    } catch (e) { setRes((x) => [...x, { name: gait.name, err: String(e?.message || e) }]); } finally { setBusy(null); }
  }
  const download = (o) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([o.text], { type: o.mime || "text/plain" })); a.download = o.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const importJson = async (file) => {
    try {
      const j = JSON.parse(await file.text());
      if (!Array.isArray(j?.joints)) throw new Error("不是步态 JSON（缺 joints）");
      setGait({ ...gait, name: String(j.name || file.name).slice(0, 40), joints: gait.joints.map((J, i) => ({ ...J, ...pickJ(j.joints[i] || {}) })) });
    } catch (e) { setRes((x) => [...x, { name: file.name, err: "导入失败：" + e.message }]); }
  };
  const last = res.filter((x) => x.r).slice(-2);
  return (
    <fieldset className="flex flex-col gap-1 text-xs" data-testid={`${tid}-editor`}>
      <legend className="font-medium">步态编辑器（v13）· 早期原型，简化仿真</legend>
      <div className="flex flex-wrap items-center gap-1" data-testid={`${tid}-presets`}>
        <span>预设：</span>{presets.map((p) => <B key={p.k} t={`${tid}-preset-${p.k}`} on={() => setGait(p.make())}>{p.zh}</B>)}
      </div>
      <p className="text-ink-soft" data-testid={`${tid}-name`}>当前：<b>{gait.name}</b> · 公式：值 = 偏置 + 幅度 × 波形(时间 × 频率 + 相位/360°)</p>
      <Overview g={gait} range={range} t={time} />
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[11px]" data-testid={`${tid}-table`}>
          <thead><tr className="text-ink-soft"><th className="text-left">关节</th><th>波形</th><th>幅度</th><th>相位°</th><th>偏置</th><th>频率 Hz</th><th>占空</th><th>预览</th></tr></thead>
          <tbody>{gait.joints.map((J, i) => {
            const r = maxRate(J), fast = r > rateLimit;
            return (
              <tr key={i} data-testid={`${tid}-row-${i}`} className={fast ? "bg-amber-50" : ""}>
                <td className="max-w-[7rem] truncate text-left" title={J.name}>{J.name}</td>
                <td><select value={J.wave} data-testid={`${tid}-wave-${i}`} onChange={(e) => upd(i, "wave", e.target.value)} className="border border-line bg-white text-[11px]">{Object.entries(WAVES).map(([k, zh]) => <option key={k} value={k}>{zh}</option>)}</select></td>
                <td><Num v={J.amp} set={(v) => upd(i, "amp", v)} t={`${tid}-amp-${i}`} /></td>
                <td><Num v={J.phase} set={(v) => upd(i, "phase", v)} step={15} t={`${tid}-phase-${i}`} /></td>
                <td><Num v={J.offset} set={(v) => upd(i, "offset", v)} t={`${tid}-offset-${i}`} w="w-12" /></td>
                <td><Num v={J.freq} set={(v) => upd(i, "freq", v)} step={0.1} min={0.05} max={3} t={`${tid}-freq-${i}`} w="w-12" /></td>
                <td><Num v={J.duty} set={(v) => upd(i, "duty", v)} step={0.05} min={0.05} max={0.95} t={`${tid}-duty-${i}`} w="w-12" /></td>
                <td title={fast ? `最大角速度 ${Number.isFinite(r) ? r.toFixed(0) : "∞（突变）"} ${J.unit === "mm" ? "mm" : "°"}/s，超过 ${rateLimit}：舵机跟不上，会被限速` : `最大 ${r.toFixed(0)} /s`}>
                  <svg width="96" height="22" className="border border-line bg-white" data-testid={`${tid}-curve-${i}`}><line x1="0" x2="96" y1="11" y2="11" stroke="#eee" /><path d={curvePath(J, 96, 22, 2, range, 60)} fill="none" stroke={fast ? "#b45309" : "#2f6fd6"} strokeWidth="1.2" />{time != null && <circle cx={((time % 2) / 2) * 96} cy={11 - (jointValue(J, time) / range) * 11} r="2" fill="#d23a2f" />}</svg>
                  {fast && <span className="ml-0.5 text-amber-700" data-testid={`${tid}-fast-${i}`}>快</span>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span>全部频率</span><input type="number" step="0.1" min="0.05" max="3" value={allF} onChange={(e) => setAllF(e.target.value)} data-testid={`${tid}-allfreq`} className="w-14 border border-line px-0.5 font-mono" /><B t={`${tid}-allfreq-set`} dis={!(+allF > 0)} on={() => all("freq", Math.min(3, Math.max(0.05, +allF)))}>统一</B>
        {onRun && <B t={`${tid}-run`} on={() => onRun(gait)} cls="border-copper">在台面上跑</B>}
        {onStop && <B t={`${tid}-stop`} on={onStop}>停</B>}
      </div>
      {onMeasure && <div className="flex flex-wrap items-center gap-1">
        <B t={`${tid}-measure`} dis={busy != null} on={() => measure(null)} cls="border-copper">测量（后台跑 {sec} s）</B>
        <B t={`${tid}-measure-mu0`} dis={busy != null} on={() => measure(0)}>{controlLabel}</B>
        <label className="flex items-center gap-0.5">时长<input type="number" min="3" max="60" value={sec} onChange={(e) => setSec(Math.min(60, Math.max(3, +e.target.value || 15)))} className="w-12 border border-line px-0.5 font-mono" data-testid={`${tid}-sec`} />s</label>
        {busy != null && <span data-testid={`${tid}-busy`}>测量中 {Math.round(busy * 100)}%…</span>}
      </div>}
      {res.length > 0 && <Report rows={last} tid={tid} errs={res.filter((x) => x.err).slice(-1)} />}
      <div className="flex flex-wrap items-center gap-1">
        <span>保存 / 导出：</span>
        {exports.map((x) => <B key={x.k} t={`${tid}-export-${x.k}`} on={() => { const o = x.make(gait); if (o) download(o); }}>{x.zh}</B>)}
        <B t={`${tid}-export-json`} on={() => download({ name: "gait.json", mime: "application/json", text: JSON.stringify({ schema: "proto-gait/1", ...gait }, null, 1) })}>步态 JSON</B>
        <B t={`${tid}-import`} on={() => fileRef.current?.click()}>导入 JSON</B>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" data-testid={`${tid}-import-file`} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) importJson(fl); e.target.value = ""; }} />
      </div>
      {note && <p className="text-ink-soft">{note}</p>}
    </fieldset>
  );
}
const pickJ = (s) => Object.fromEntries(["amp", "phase", "offset", "freq", "wave", "duty"].filter((k) => s[k] != null).map((k) => [k, s[k]]));

// 测量结果表（最近两次并排 = 前后对比）
function Report({ rows, tid, errs }) {
  const L = [
    ["前进距离", (r) => `${f(r.fwd)} cm`, "fwd"], ["速度", (r) => `${f(r.speed, 3)} cm/s`, "speed"], ["侧向漂移", (r) => `${f(r.dx)} cm`, "dx"], ["航向变化", (r) => `${f(r.dh, 1)}°`, "dh"],
    ["打滑率", (r) => f(r.slip), "slip"], ["平均着地", (r) => f(r.contactsAvg, 1), "contacts"], ["机身最大倾角", (r) => `${f(r.tiltMax)}°`, "tilt"],
    ["支撑多边形最小裕度", (r) => (r.marginMin == null ? "—" : `${f(r.marginMin)} cm${r.marginMin < 0 ? "（质心出界，靠动态平衡）" : ""}`), "margin"],
    ["能量（估算）", (r) => `${f(r.energyJ, 2)} J · ${f(r.powerW, 3)} W`, "energy"], ["峰值力矩", (r) => (r.peakTorque == null ? "—" : `${Math.round(r.peakTorque * 100)}% 堵转力矩`), "peak"],
  ];
  return (
    <div data-testid={`${tid}-report`}>
      {rows.length > 0 && <table className="w-full font-mono text-[11px]"><thead><tr className="text-ink-soft"><th className="text-left">指标</th>{rows.map((x, i) => <th key={i} className="text-right">{rows.length > 1 ? (i ? "这次" : "上次") : "结果"}：{x.name}{x.mu === 0 ? "（μ=0）" : ""}</th>)}</tr></thead>
        <tbody>{L.map(([zh, fn, k]) => <tr key={k}><td>{zh}</td>{rows.map((x, i) => <td key={i} className="text-right" data-testid={i === rows.length - 1 ? `${tid}-r-${k}` : undefined}>{fn(x.r)}</td>)}</tr>)}</tbody></table>}
      {errs.map((e, i) => <p key={i} className="text-red-700" data-testid={`${tid}-err`}>{e.err}</p>)}
      <p className="text-ink-soft">前方 = 台面 −z。能量 = ∫|扭矩 × 角速度| dt（扭矩按“跟随误差 × 刚度”截到舵机上限，估算，偏大）。支撑裕度 = 质心到着地点凸包边的距离（正 = 在里面）。</p>
    </div>
  );
}
