// v29（我的补充）：拆解模式 —— 设备列表、分步拆解指南、安全提示、材料清单、完成勾选（存在本机浏览器）、
// “存进零件库”（写进本机工作台库存）、本项目自绘的步骤插图和交互爆炸图。文字全部自写，中文 / English 都是手写。
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { containerClass } from "../container";
import { useLang } from "../i18n";
import { DEVICES, DEVICE_BY_ID, COMMON_SAFETY, UNVERIFIED, searchDevices, isMainsQuery, MAX_VOLTS } from "../teardown/devices.js";
import { addToInventory, readInventory, removeFromInventory, readProgress, setProgress } from "../teardown/inventory.js";
import { PROC_BY_ID } from "../assembly/procedural.js";
import { guideHtml, labelFit, legendNo, figLegend, figLabelFill } from "../teardown/guideSheet.js";
const TeardownExplode = lazy(() => import("../teardown/TeardownExplode.jsx"));

const MATCH = {
  same: { zh: "零件库同类件", en: "Library part (same type)" },
  similar: { zh: "零件库相近件（尺寸可能不同）", en: "Library part (similar; size may differ)" },
  approx: { zh: "近似件（程序生成，尺寸估算）", en: "Approximate part (procedural, estimated size)" },
};

function StepFig({ dev, fig, L, i }) {
  const off = fig?.off || {}, hi = new Set(fig?.hi || []), no = legendNo(dev, L), lg = figLegend(dev, fig, L);
  return (
    <div className="w-full max-w-xs">
      <svg viewBox="0 0 200 124" className="h-auto w-full border border-line bg-paper-2" role="img" aria-label={L({ zh: `第 ${i + 1} 步示意图（本项目自绘）`, en: `Step ${i + 1} diagram (drawn by this project)` })} data-testid="td-fig">
        {dev.fig.map((s) => {
          const [dx, dy] = off[s.id] || [0, 0];
          const on = hi.has(s.id);
          const x = Math.max(1, Math.min(199 - s.w, s.x + dx)), y = Math.max(1, Math.min(123 - s.h, s.y + dy));
          const f = labelFit(L(s.t), s.w), fs = f.legend ? 6 : f.fs;
          return (
            <g key={s.id} opacity={hi.size && !on ? 0.45 : 1}>
              <rect x={x} y={y} width={s.w} height={s.h} rx={s.round ? s.w / 2 : 2} fill={s.c} stroke={on ? "#d9792b" : "#26272a"} strokeWidth={on ? 2 : 0.6} />
              {(on || !hi.size) && s.w >= 14 ? <text x={x + s.w / 2} y={y + s.h / 2 + fs * 0.4} textAnchor="middle" fontSize={fs} fill={figLabelFill(s.c)}>{f.legend ? no.get(s.id) : L(s.t)}</text> : null}
            </g>
          );
        })}
      </svg>
      {lg.length ? <p className="mt-1 text-xs text-ink-soft" data-testid="td-fig-legend">{lg.map(([n, t]) => `${n} = ${t}`).join(" · ")}</p> : null}
    </div>
  );
}

function Inventory({ L, en }) {
  const [inv, setInv] = useState(readInventory);
  useEffect(() => { const f = () => setInv(readInventory()); window.addEventListener("inventory-change", f); return () => window.removeEventListener("inventory-change", f); }, []);
  if (!inv.length) return <p className="text-sm text-ink-soft" data-testid="td-inv-empty">{L({ zh: "还没有存入任何模块。", en: "No modules saved yet." })}</p>;
  return (
    <ul className="space-y-1 text-sm" data-testid="td-inv">
      {inv.map((r) => {
        const d = PROC_BY_ID[r.part];
        return (
          <li key={r.part} className="flex flex-wrap items-center gap-2 border-b border-line py-1" data-testid="td-inv-row">
            <span className="font-mono text-xs">{r.part}</span>
            {d ? <span>{en ? d.name : d.name_zh}</span> : null}
            <span className="text-ink-soft">×{r.n}</span>
            {r.approx ? <span className="border border-amber-700 px-1 text-[11px] text-amber-800">{L({ zh: "近似件", en: "approximate" })}</span> : null}
            <Link to={`/parts?id=${encodeURIComponent(r.part)}`} className="underline">{L({ zh: "在零件库打开", en: "Open in parts" })}</Link>
            <button type="button" onClick={() => removeFromInventory(r.part)} className="ml-auto border border-line px-2 text-xs" data-testid="td-inv-remove">{L({ zh: "移除", en: "Remove" })}</button>
          </li>
        );
      })}
    </ul>
  );
}

export default function TeardownPage() {
  const [lang] = useLang(); const en = lang === "en";
  const L = (x) => (x == null ? "" : typeof x === "string" ? x : en ? x.en : x.zh);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const list = useMemo(() => searchDevices(q), [q]);
  const dev = DEVICE_BY_ID[params.get("d")] || DEVICES[0];
  const [prog, setProg] = useState(() => readProgress(dev.id));
  // v37：打印页二维码带 &s=N，打开后滚到第 N 步并把焦点放上去
  const sN = Math.max(0, Math.min(dev.steps.length, parseInt(params.get("s"), 10) || 0));
  useEffect(() => { if (!sN) return; const el = document.getElementById(`td-step-${sN}`); if (el) { el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true }); } }, [sN, dev.id]);
  useEffect(() => setProg(readProgress(dev.id)), [dev.id]);
  const [saved, setSaved] = useState("");
  useEffect(() => { document.title = (en ? "Teardown mode" : "拆解模式") + " · Prototypes"; setSaved(""); }, [en, dev.id]);
  const toggle = (kind, i) => {
    const s = new Set(prog[kind]); s.has(i) ? s.delete(i) : s.add(i);
    const v = { ...prog, [kind]: [...s].sort((a, b) => a - b) }; setProg(v); setProgress(dev.id, v);
  };
  const save = () => {
    const mods = dev.modules.filter((m) => !m.suggest);
    addToInventory(mods.map((m) => ({ part: m.part, from: dev.id, key: m.key, approx: m.match === "approx" })));
    const na = mods.filter((m) => m.match === "approx").length;
    setSaved(L({ zh: `已存入 ${mods.length} 个模块（其中 ${na} 个是近似件）。在零件库或装配台的零件列表里选“拆解所得”就能看到。`, en: `Saved ${mods.length} modules (${na} approximate). Pick 'From teardowns' in the parts list on the Parts page or the assembly bench to see them.` }));
  };
  const done = prog.steps.length, total = dev.steps.length;
  // v35：打印版 / PDF（浏览器里生成，用浏览器的“打印 → 存成 PDF”）
  const [pmsg, setPmsg] = useState("");
  const sheet = () => guideHtml(dev, lang, { prog, base: window.location.origin + import.meta.env.BASE_URL });
  const openPrint = () => {
    const url = URL.createObjectURL(new Blob([sheet()], { type: "text/html;charset=utf-8" }));
    const w = window.open(url, "_blank");
    setPmsg(w ? L({ zh: "已在新标签页打开打印版，点上面的“打印 / 存成 PDF”，目标选“另存为 PDF”。", en: "The print version opened in a new tab. Click 'Print / save as PDF' there and choose 'Save as PDF'." }) : L({ zh: "浏览器拦住了新标签页，请改用“下载 HTML”，再用浏览器打开打印。", en: "The browser blocked the new tab. Use 'Download HTML' and print it from the browser instead." }));
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const dlHtml = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([sheet()], { type: "text/html;charset=utf-8" })); a.download = `teardown-${dev.id}-${lang}.html`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  return (
    <div className={`${containerClass} py-8`} data-testid="teardown-page" lang={en ? "en" : "zh"} translate="no" data-no-mt>
      <p className="text-xs text-ink-soft">{L({ zh: "早期原型，简化仿真", en: "Early prototype, simplified simulation" })}</p>
      <h1 className="mt-1 text-2xl font-semibold">{L({ zh: "拆解模式", en: "Teardown mode" })}</h1>
      <p className="mt-2 max-w-3xl text-sm text-ink-soft">{L({ zh: "一步一步拆开常见的小设备，看懂里面的模块，再把拆下来的模块存进本机的零件库，拿到装配台上用。指南文字和插图都是本项目自己写、自己画的。", en: "Take common small devices apart step by step, understand the modules inside, then save the removed modules to the parts library in this browser and use them on the assembly bench. All guide text and diagrams are written and drawn by this project." })}</p>
      <p className="mt-2 inline-block border border-amber-700 bg-amber-50 px-2 py-1 text-sm text-amber-900" data-testid="td-unverified">{L(UNVERIFIED)}{L({ zh: "。你的设备可能和这里写的不一样，以实物为准。", en: ". Your device may differ; trust what you see." })}</p>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 [overflow-wrap:anywhere] lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside>
          <label className="text-sm">
            <span className="sr-only">{L({ zh: "搜索设备", en: "Search devices" })}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L({ zh: "按名称或型号搜：舵机、18650、风扇…", en: "Search by name or model: servo, 18650, fan…" })} className="w-full border border-line bg-white px-2 py-1.5 text-sm" data-testid="td-search" />
          </label>
          {isMainsQuery(q) && <p className="mt-2 border border-red-700 bg-red-50 px-2 py-1 text-xs text-red-900" role="alert" data-testid="td-mains">{L({ zh: `这里只收低压直流设备（电池或 USB 供电，≤ ${MAX_VOLTS} V）。插市电的设备（充电头、适配器、家电）有高压和断电后仍带电的电容，不提供拆解步骤，也请不要自己拆。`, en: `Low-voltage DC devices only (battery or USB powered, ${MAX_VOLTS} V or less). Mains devices (chargers, adapters, appliances) carry high voltage and capacitors that stay charged after unplugging, so there are no teardown steps for them. Please do not open them yourself.` })}</p>}
          <ul className="mt-2 space-y-2" data-testid="td-list">
            {list.map((d) => {
              const p = readProgress(d.id).steps.length;
              return (
                <li key={d.id}>
                  <button type="button" onClick={() => setParams({ d: d.id })} className={`w-full border px-3 py-2 text-left text-sm ${d.id === dev.id ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink"}`} data-testid={`td-device-${d.id}`} aria-current={d.id === dev.id ? "true" : undefined}>
                    <span className="block font-medium">{L(d.name)}</span>
                    <span className={`block font-mono text-[11px] ${d.id === dev.id ? "text-paper-2" : "text-ink-soft"}`}>{d.model}</span>
                    <span className={`block text-[11px] ${d.id === dev.id ? "text-paper-2" : "text-ink-soft"}`}>{L({ zh: `${d.steps.length} 步 · 约 ${d.minutes} 分钟 · ${d.battery ? "含电池" : "无电池"} · ${d.volts} V 直流 · 已完成 ${p}`, en: `${d.steps.length} steps · about ${d.minutes} min · ${d.battery ? "has a battery" : "no battery"} · ${d.volts} V DC · ${p} done` })}</span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li className="text-sm text-ink-soft" data-testid="td-none">{L({ zh: `没有找到。目前共有 ${DEVICES.length} 台设备。`, en: `Nothing found. There are ${DEVICES.length} devices so far.` })}</li>}
          </ul>
        </aside>

        <article data-testid="td-guide" data-device={dev.id}>
          <h2 className="text-xl font-semibold" data-testid="td-title">{L(dev.name)}</h2>
          <p className="mt-1 font-mono text-xs text-ink-soft">{dev.model}</p>
          <p className="mt-2 text-sm">{L(dev.summary)}</p>
          <p className="mt-1 text-xs text-amber-800">{L(UNVERIFIED)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="td-print-bar">
            <button type="button" onClick={openPrint} className="border border-ink px-3 py-1.5 text-sm hover:bg-ink hover:text-paper" data-testid="td-print">{L({ zh: "打印 / 存成 PDF", en: "Print / save as PDF" })}</button>
            <button type="button" onClick={dlHtml} className="border border-line px-3 py-1.5 text-sm hover:border-ink" data-testid="td-print-html">{L({ zh: "下载打印版 HTML", en: "Download print version (HTML)" })}</button>
            <span className="text-xs text-ink-soft">{L({ zh: "在浏览器里生成，不上传；含安全、材料、步骤插图、停止点和模块表", en: "Made in your browser, nothing uploaded; includes safety, materials, step diagrams, stop points and modules" })}</span>
          </div>
          {pmsg ? <p className="mt-1 text-xs text-ink-soft" role="status" data-testid="td-print-msg">{pmsg}</p> : null}

          <section className="mt-5 border border-red-700 bg-red-50 p-3" data-testid="td-safety">
            <h3 className="font-semibold text-red-900">{L({ zh: "安全（先读）", en: "Safety (read first)" })}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-950">
              {dev.safety.map((s, i) => <li key={"d" + i}>{L(s)}</li>)}
              {COMMON_SAFETY.map((s, i) => <li key={"c" + i}>{L(s)}</li>)}
            </ul>
          </section>

          <section className="mt-5" data-testid="td-materials">
            <h3 className="font-semibold">{L({ zh: "材料和工具清单", en: "Materials and tools" })}</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {dev.materials.map((m, i) => (
                <li key={i}><label className="flex items-start gap-2"><input type="checkbox" checked={prog.mats.includes(i)} onChange={() => toggle("mats", i)} data-testid={`td-mat-${i}`} className="mt-1" />{L(m)}</label></li>
              ))}
            </ul>
          </section>

          <section className="mt-5">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">{L({ zh: "拆解步骤", en: "Steps" })}</h3>
              <span className="text-sm text-ink-soft" data-testid="td-progress">{L({ zh: `已完成 ${done} / ${total}`, en: `${done} of ${total} done` })}</span>
              <span className="h-2 flex-1 bg-paper-2"><span className="block h-2 bg-ink" style={{ width: `${(done / total) * 100}%` }} /></span>
            </div>
            <ol className="mt-2 space-y-4" data-testid="td-steps">
              {dev.steps.map((s, i) => (
                <li key={i} id={`td-step-${i + 1}`} tabIndex={-1} aria-current={sN === i + 1 ? "step" : undefined} className={`grid gap-3 border p-3 sm:grid-cols-[1fr_14rem] ${prog.steps.includes(i) ? "border-green-700 bg-green-50" : "border-line bg-white"} ${sN === i + 1 ? "outline outline-4 outline-blue-700" : ""}`} data-testid="td-step">
                  <div>
                    <label className="flex items-start gap-2 font-medium">
                      <input type="checkbox" checked={prog.steps.includes(i)} onChange={() => toggle("steps", i)} data-testid={`td-step-check-${i}`} className="mt-1" />
                      <span>{i + 1}. {L(s.t)}</span>
                    </label>
                    <p className="mt-1 text-sm">{L(s.d)}</p>
                    {s.warn ? <p className="mt-1 border-l-4 border-amber-600 pl-2 text-sm text-amber-900" data-testid="td-warn">{L(s.warn)}</p> : null}
                    {s.stop ? <p className="mt-1 border-l-4 border-red-700 pl-2 text-sm font-medium text-red-900" data-testid="td-stop">{L(s.stop)}</p> : null}
                    <p className="mt-1 text-[11px] text-ink-soft">{L(UNVERIFIED)}</p>
                  </div>
                  <StepFig dev={dev} fig={s.fig} L={L} i={i} />
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-6" data-testid="td-modules">
            <h3 className="font-semibold">{L({ zh: "拆下来的模块", en: "Modules you get" })}</h3>
            <table className="mt-2 w-full text-left text-sm">
              <thead><tr className="border-b border-ink text-xs text-ink-soft"><th className="py-1 pr-2">{L({ zh: "模块", en: "Module" })}</th><th className="py-1 pr-2">{L({ zh: "零件库对应", en: "Library match" })}</th><th className="py-1">id</th></tr></thead>
              <tbody>
                {dev.modules.map((m) => (
                  <tr key={m.key} className="border-b border-line" data-testid="td-module" data-match={m.match}>
                    <td className="py-1 pr-2">{L(m.t)}</td>
                    <td className={`py-1 pr-2 ${m.match === "approx" ? "text-amber-800" : ""}`}>{L(MATCH[m.match])}</td>
                    <td className="py-1"><Link to={`/parts?id=${encodeURIComponent(m.part)}`} className="font-mono text-xs underline">{m.part}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={save} className="mt-3 border border-ink bg-ink px-3 py-2 text-sm text-paper hover:bg-white hover:text-ink" data-testid="td-save">{L({ zh: "存进零件库（本机工作台库存）", en: "Save modules to parts library (local bench inventory)" })}</button>
            {saved ? <p className="mt-2 text-sm text-green-800" role="status" data-testid="td-saved">{saved}</p> : null}
          </section>

          {dev.explode ? (
            <section className="mt-6">
              <h3 className="font-semibold">{L({ zh: "交互爆炸图", en: "Interactive exploded view" })}</h3>
              <Suspense fallback={<p className="text-sm text-ink-soft">{L({ zh: "正在加载 3D…", en: "Loading 3D…" })}</p>}><TeardownExplode device={dev} L={L} /></Suspense>
            </section>
          ) : null}

          <section className="mt-6">
            <h3 className="font-semibold">{L({ zh: "我的工作台库存（本机）", en: "My bench inventory (this browser)" })}</h3>
            <p className="mb-2 text-xs text-ink-soft">{L({ zh: "只存在这台浏览器的 localStorage 里。在 ", en: "Stored only in this browser's localStorage. Use it on the " })}<Link to="/parts?view=inv" className="underline">{L({ zh: "零件库", en: "Parts page" })}</Link>{L({ zh: " 或 ", en: " or the " })}<Link to="/assembly" className="underline">{L({ zh: "装配台", en: "assembly bench" })}</Link>{L({ zh: " 的零件列表里选“拆解所得”。", en: " (choose 'From teardowns' in the parts list)." })}</p>
            <Inventory L={L} en={en} />
          </section>
          <p className="mt-6 text-xs text-ink-soft">{L({ zh: "灵感来源和许可见 ", en: "Inspirations and licences: " })}<Link to="/credits#teardown" className="underline">{L({ zh: "出处与许可", en: "Credits" })}</Link>{L({ zh: "。本页没有复制任何外部拆解指南的文字或照片。", en: ". No text or photos were copied from any outside teardown guide." })}</p>
        </article>
      </div>
    </div>
  );
}
