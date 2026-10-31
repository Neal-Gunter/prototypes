// v26：实测对比面板（我的补充）。填真实万用表读数 → 和求解器估算比 → 标“仅估算 / 已在实物上验证 / 有偏差”，
// 有偏差给校准建议，可应用到仿真（用户校准，可撤销）。照片只存在这台设备的浏览器里，从不上传。
import { useRef, useState } from "react";
import * as Mz from "./measure.js";
import { tr } from "../i18n.js";

const btn = "min-h-9 border border-line bg-white px-2.5 text-sm hover:border-copper disabled:opacity-40";
export const ST_CLS = { est: "border-line bg-paper text-ink-soft", ok: "border-green-600 bg-green-50 text-green-800", dev: "border-red-600 bg-red-50 text-red-800", cal: "border-blue-600 bg-blue-50 text-blue-800" };
const ST_EN = { est: "Estimate only", ok: "Verified on real hardware", dev: "Deviates", cal: "Calibrated from this reading" };
const EX_EN = { est: "Estimate only", ok: "Example data: matches (not measured)", dev: "Example data: deviates (not measured)", cal: "Example data: calibrated (not measured)" };
export const Badge = ({ s, ex, testid }) => <span className={`inline-block border px-1 text-[11px] ${ST_CLS[s]}`} data-testid={testid} data-status={s} data-example={ex ? "1" : "0"}>{ex ? tr(Mz.EXAMPLE_ZH[s], EX_EN[s]) : tr(Mz.STATUS_ZH[s], ST_EN[s])}</span>;
const download = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };

// 照片缩到最长边 640 px、JPEG 0.7，存本机 localStorage（不上传）
function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { const k = Math.min(1, 640 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.7)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bad image")); };
    img.src = url;
  });
}

export default function MeasurePanel({ state, setState, photos, setPhotos, report }) {
  const [note, setNote] = useState(null); const [withPhotos, setWithPhotos] = useState(false);
  const fileRef = useRef(null); const photoFor = useRef(null); const photoInput = useRef(null);
  const r = report; const stages = [...new Set(r.rows.map((x) => x.stage))];
  const onPhoto = async (e) => {
    const file = e.target.files?.[0]; const id = photoFor.current; e.target.value = "";
    if (!file || !id) return;
    try { const u = await shrink(file); setPhotos((p) => ({ ...p, [id]: u })); setState((s) => Mz.setPhotoFlag(s, id, true)); setNote({ ok: true, text: tr("照片只存在这台设备的浏览器里（不上传）") }); }
    catch { setNote({ ok: false, text: tr("读不了这张图片") }); }
  };
  const onImport = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    const res = Mz.importMeasure(state, await file.text());
    if (!res.ok) { setNote({ ok: false, text: res.msg }); return; }
    setState(res.state); setPhotos(res.photos || {}); setNote({ ok: true, text: res.msg });
  };
  return (
    <div className="space-y-3 border border-line bg-white p-3" data-testid="measure-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{tr("实测对比（我的补充）", "Measured vs estimated (my addition)")}</h3>
        <span className="text-xs" data-testid="measure-counts">{tr("已验证")} {r.counts.ok} · {tr("校准后吻合")} {r.counts.cal} · {tr("有偏差")} {r.counts.dev} · {tr("仅估算")} {r.counts.est} / {r.counts.n}</span>
      </div>
      <p className="text-xs text-ink-soft">{tr("在实物上量到的读数填在这里（OL = 不导通）。容差也是估算。只有你填的值会被当成实测；记录存在这台设备的浏览器里。")}</p>
      {r.example && <p className="border border-amber-500 bg-amber-50 p-2 text-sm font-semibold text-amber-900" data-testid="example-banner">⚠️ {tr("现在显示的是示例数据（不是实测）：只用来演示，不代表任何真实硬件。")}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => { if (!Object.keys(state.measure?.items || {}).length || confirm(tr("用示例数据替换现在的实测记录？"))) { setState((s) => Mz.loadExample(s)); setPhotos({}); } }} data-testid="measure-example">{tr("填入示例数据（不是实测）")}</button>
        <button type="button" className={btn} onClick={() => download("octopus-v10-measure.json", Mz.exportMeasure(state, { photos: withPhotos ? photos : null }), "application/json")} data-testid="measure-export">{tr("导出 JSON")}</button>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} data-testid="measure-export-photos" /> {tr("导出时带上照片")}</label>
        <button type="button" className={btn} onClick={() => fileRef.current?.click()} data-testid="measure-import">{tr("导入 JSON")}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} data-testid="measure-import-file" />
        <button type="button" className={btn} onClick={() => { if (confirm(tr("清空实测记录、照片和用户校准？"))) { setState((s) => Mz.clearMeasure(s)); setPhotos({}); } }} data-testid="measure-clear">{tr("清空实测")}</button>
      </div>
      {note && <p className={note.ok ? "text-sm text-green-700" : "text-sm text-red-700"} data-testid="measure-note">{note.text}</p>}
      <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} data-testid="measure-photo-file" />
      {stages.map((sg) => (
        <div key={sg} className="overflow-x-auto">
          <h4 className="mt-1 text-sm font-semibold">{sg}</h4>
          <table className="w-full text-xs"><thead><tr className="bg-paper text-left"><th className="p-1">{tr("测哪里")}</th><th className="p-1">{tr("估算")}</th><th className="p-1">{tr("实测")}</th><th className="p-1">{tr("对比")}</th></tr></thead>
            <tbody>{r.rows.filter((x) => x.stage === sg).map((x) => (
              <tr key={x.id} className="border-b border-line align-top" data-testid={`m-row-${x.id}`} data-status={x.status}>
                <td className="p-1">{x.where}<div className="text-ink-soft">{x.mode}{x.optional ? ` · ${tr("可选")}` : ""}</div></td>
                <td className="p-1 whitespace-nowrap" title={x.basis} data-testid={`m-est-${x.id}`}>{x.kind === "open" ? "OL" : `${Mz.fmt(x.est, x.unit === "mA" ? 0 : x.unit === "V" ? 2 : 2)} ${x.unit}`}<div className="max-w-[14rem] whitespace-normal text-ink-soft">{x.basis}</div></td>
                <td className="p-1"><input className="w-20 border border-line px-1 py-0.5" inputMode="decimal" aria-label={`${tr("实测")} ${x.where}`} placeholder={x.kind === "open" || x.kind === "ohm" ? "OL / Ω" : x.unit} value={x.entry?.raw ?? ""} onChange={(e) => setState((s) => Mz.setReading(s, x.id, e.target.value))} data-testid={`m-in-${x.id}`} /> {x.unit}
                  {x.entry?.example ? <div className="text-amber-700" data-testid={`m-example-${x.id}`}>{tr("示例数据")}</div> : null}
                  <div className="mt-0.5 flex items-center gap-1">
                    {photos[x.id] ? <><img src={photos[x.id]} alt={tr("实测照片")} className="h-10 w-10 border border-line object-cover" data-testid={`m-photo-${x.id}`} /><button type="button" className="text-[11px] underline" onClick={() => { setPhotos((p) => { const n = { ...p }; delete n[x.id]; return n; }); setState((s) => Mz.setPhotoFlag(s, x.id, false)); }} data-testid={`m-photo-del-${x.id}`}>{tr("删照片")}</button></>
                      : <button type="button" className="text-[11px] underline" onClick={() => { photoFor.current = x.id; photoInput.current?.click(); }} data-testid={`m-photo-add-${x.id}`}>{tr("加照片（只存本机）")}</button>}
                  </div>
                </td>
                <td className="p-1"><Badge s={x.status} ex={x.example} testid={`m-st-${x.id}`} /><div className="text-ink-soft" data-testid={`m-txt-${x.id}`}>{x.txt}</div></td>
              </tr>
            ))}</tbody></table>
        </div>
      ))}
      <div data-testid="cal-panel">
        <h4 className="text-sm font-semibold">{tr("校准建议")}</h4>
        {!r.suggestions.length && <p className="text-xs text-ink-soft" data-testid="cal-none">{tr("没有偏差的实测，就没有建议。")}</p>}
        <ul className="space-y-2">{r.suggestions.map((sg, i) => (
          <li key={i} className="border border-line p-2 text-xs" data-testid={`cal-sug-${sg.id}`}>
            <b>{sg.title}</b>
            <div>{tr("该查")}：{sg.param ? <span className="font-semibold">{Mz.PARAM_ZH[sg.param]}</span> : tr("接线 / 焊点（不是参数）")}。{sg.check}</div>
            {sg.apply && <div className="mt-1 flex flex-wrap items-center gap-2"><span>{tr("建议值")}：{Mz.PARAM_ZH[sg.param]} = {sg.value} {Mz.PARAM_UNIT[sg.param]}（{sg.how}）</span>
              <button type="button" className={btn} disabled={r.cal[sg.param]?.value === sg.value} onClick={() => setState((s) => Mz.applyCal(s, sg))} data-testid={`cal-apply-${sg.id}`}>{r.cal[sg.param]?.value === sg.value ? tr("已应用") : tr("应用到仿真（用户校准）")}</button></div>}
          </li>
        ))}</ul>
        {Object.keys(r.cal).length > 0 && (
          <div className="mt-2 border border-blue-600 bg-blue-50 p-2 text-xs" data-testid="cal-active">
            <b>{tr("用户校准生效中")}</b>（{tr("仿真里的这些参数换成了按你的实测反推的值；撤销就回到默认估算")}）
            <ul>{Object.entries(r.cal).map(([k, c]) => <li key={k} data-testid={`cal-active-${k}`}>{Mz.PARAM_ZH[k]} = {c.value} {Mz.PARAM_UNIT[k]} · {tr("来自")} {c.from}{c.example ? ` · ${tr("示例数据（不是实测）")}` : ""} <button type="button" className="underline" onClick={() => setState((s) => Mz.undoCal(s, k))} data-testid={`cal-undo-${k}`}>{tr("撤销")}</button></li>)}</ul>
            <button type="button" className={`${btn} mt-1`} onClick={() => setState((s) => Mz.undoCal(s))} data-testid="cal-undo-all">{tr("全部撤销")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
