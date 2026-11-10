// v35（我的补充）：拆解指南的打印版 / PDF。全部在浏览器里生成一份独立的 HTML（含本项目自绘的步骤插图 SVG），
// 用浏览器自带的“打印 → 存成 PDF”导出，不用任何付费服务、不上传任何东西。早期原型，简化仿真。
// v36：加目录（可点击跳转，PDF 里也是链接）和页码（CSS @page 页边框，“第 N 页 / 共 M 页”，页眉写设备名）；
//   每一步都带 data-step / data-fig，给 scripts/sheet-lint.mjs 和 e2e/sheet-pdf-lint.mjs 检查用。
// v39（我的补充）：用强制分页让目录页码可确定（封面+目录第 1 页，安全第 2 页，材料第 3 页，每一步独占一页，然后是模块表和说明）。Chrome 对 target-counter 支持不稳，所以页码写进目录本身。
import { COMMON_SAFETY, UNVERIFIED } from "./devices.js";
import { qrSvg, stepUrl, LIVE } from "./qr.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MATCH = { same: { zh: "零件库同类件", en: "Library part (same type)" }, similar: { zh: "零件库相近件（尺寸可能不同）", en: "Library part (similar; size may differ)" }, approx: { zh: "近似件（程序生成，尺寸估算）", en: "Approximate part (procedural, estimated size)" } };

// v36：示意图文字放不进方块时先缩小字号（最小 5），还放不下就在方块里写编号、图下面加图例。
// 宽度是估算（汉字约 1 个字号宽，其他字符约 0.56 个字号宽），scripts/sheet-lint.mjs 用同一个估算检查。
const CJK1 = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
export const textW = (t, fs = 7) => [...String(t || "")].reduce((a, c) => a + (CJK1.test(c) ? 1 : 0.56), 0) * fs;
export function labelFit(t, w) {
  const room = w - 2, full = textW(t, 7);
  if (full <= room) return { fs: 7, legend: false };
  const fs = Math.max(5, Math.floor((7 * room / full) * 10) / 10);
  return textW(t, fs) <= room ? { fs, legend: false } : { fs: 6, legend: true };
}
// 一台设备里要放图例的图层按出现顺序编号（每一步都用同一个编号）
export function legendNo(dev, L) { const m = new Map(); for (const s of dev.fig || []) if (s.w >= 14 && labelFit(L(s.t), s.w).legend) m.set(s.id, m.size + 1); return m; }
export function figLegend(dev, fig, L) {
  const no = legendNo(dev, L), hi = new Set(fig?.hi || []);
  return (dev.fig || []).filter((s) => no.has(s.id) && (!hi.size || hi.has(s.id))).map((s) => [no.get(s.id), L(s.t)]);
}

// 和页面上的 StepFig 画法一致（纯字符串版，打印页不依赖 React）
export function figSvg(dev, fig, L, i) {
  const off = fig?.off || {}, hi = new Set(fig?.hi || []), no = legendNo(dev, L);
  const g = (dev.fig || []).map((s) => {
    const [dx, dy] = off[s.id] || [0, 0], on = hi.has(s.id);
    const x = Math.max(1, Math.min(199 - s.w, s.x + dx)), y = Math.max(1, Math.min(123 - s.h, s.y + dy));
    const f = labelFit(L(s.t), s.w), label = f.legend ? String(no.get(s.id)) : L(s.t), fs = f.legend ? 6 : f.fs;
    const txt = (on || !hi.size) && s.w >= 14 ? `<text x="${x + s.w / 2}" y="${y + s.h / 2 + fs * 0.4}" text-anchor="middle" font-size="${fs}" fill="${/#(2f6fd6|26272a|2f8f4e|5b6168)/.test(s.c) ? "#fff" : "#26272a"}">${esc(label)}</text>` : "";
    return `<g opacity="${hi.size && !on ? 0.45 : 1}"><rect x="${x}" y="${y}" width="${s.w}" height="${s.h}" rx="${s.round ? s.w / 2 : 2}" fill="${s.c}" stroke="${on ? "#d9792b" : "#26272a"}" stroke-width="${on ? 2 : 0.6}"/>${txt}</g>`;
  }).join("");
  const lg = figLegend(dev, fig, L);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 124" role="img" aria-label="${esc(L({ zh: `第 ${i + 1} 步示意图（本项目自绘）`, en: `Step ${i + 1} diagram (drawn by this project)` }))}">${g}</svg>${lg.length ? `<p class="legend">${lg.map(([n, t]) => `<span>${n} = ${esc(t)}</span>`).join(" · ")}</p>` : ""}`;
}


// v39：按强制分页推算目录页码（与打印 CSS 同步）。step 是 0-based 数组。
// v40：若某一节实际占多页，传入 spans 把后面的页码往后推（回填）。默认每节 1 页，与 v39 相同。
export function tocPageMap(dev, spans = {}) {
  const n = (dev.steps || []).length;
  const k = (v) => Math.max(1, Math.floor(Number(v) || 1));
  const stepSpans = Array.isArray(spans.step) ? spans.step : [];
  let p = 1;
  const front = 1;
  p += k(spans.front);
  const safety = p; p += k(spans.safety);
  const mats = p; p += k(spans.mats);
  const steps = p;
  const stepAt = [];
  for (let i = 0; i < n; i++) { stepAt[i] = p; p += k(stepSpans[i]); }
  const modules = p; p += k(spans.modules);
  const notes = p; p += k(spans.notes);
  return { front, safety, mats, steps, modules, notes, step: (i) => stepAt[i], stepAt, total: p - 1 };
}
export function tocPageLabel(start, span = 1, en = false) {
  const a = start, b = start + Math.max(1, span) - 1;
  if (b > a) return en ? `p. ${a}–${b}` : `第 ${a}–${b} 页`;
  return en ? `p. ${a}` : `第 ${a} 页`;
}
// 打印页内联脚本：按实测高度回填目录页码。A4 正文区 186×263 mm（页边 16/12/18 mm）。
export function tocBackfillScript(en = false) {
  const lab = en
    ? 'var b=start+Math.max(1,span)-1;return b>start?("p. "+start+"–"+b):("p. "+start);'
    : 'var b=start+Math.max(1,span)-1;return b>start?("\\u7b2c "+start+"–"+b+" \\u9875"):("\\u7b2c "+start+" \\u9875");';
  return `(function(){
  var PAGE_H = (297-16-18)*96/25.4;
  function q(s){ return document.querySelector(s); }
  function heightUntil(start, end){
    var a = typeof start === "string" ? q(start) : start;
    if (!a) return 0;
    var b = end ? (typeof end === "string" ? q(end) : end) : null;
    var top = a.getBoundingClientRect().top;
    var bottom = b ? b.getBoundingClientRect().top : document.body.getBoundingClientRect().bottom;
    return Math.max(0, bottom - top);
  }
  function pagesFor(px){ return Math.max(1, Math.ceil((px - 2) / PAGE_H)); }
  function k(v){ return Math.max(1, Math.floor(Number(v) || 1)); }
  function label(start, span){ ${lab} }
  function backfill(){
    document.body.classList.add("toc-measure");
    void document.body.offsetHeight;
    var steps = document.querySelectorAll("li.step");
    var frontN = pagesFor(heightUntil(".toc-front", "#safety"));
    var safetyN = pagesFor(heightUntil("#safety", "#mats"));
    var matsN = pagesFor(heightUntil("#mats", "#steps"));
    var stepN = [];
    for (var i = 0; i < steps.length; i++){
      var end = steps[i+1] || q("#modules");
      stepN[i] = pagesFor(i === 0 ? heightUntil("#steps", end) : heightUntil(steps[i], end));
    }
    var modulesN = pagesFor(heightUntil("#modules", "#notes"));
    var notesN = pagesFor(heightUntil("#notes", null));
    var spans = { front: frontN, safety: safetyN, mats: matsN, step: stepN, modules: modulesN, notes: notesN };
    var p = 1, map = { front: 1 };
    p += k(spans.front);
    map.safety = p; p += k(spans.safety);
    map.mats = p; p += k(spans.mats);
    map.steps = p;
    for (var i = 0; i < stepN.length; i++){ map["step-" + (i+1)] = p; p += k(stepN[i]); }
    map.modules = p; p += k(spans.modules);
    map.notes = p; p += k(spans.notes);
    var stepsSpan = stepN.reduce(function(a,x){ return a + k(x); }, 0) || 1;
    document.querySelectorAll(".toc-pg").forEach(function(el){
      var id = el.getAttribute("data-sec");
      var start = map[id];
      if (!start) return;
      var span = 1;
      if (id === "steps") span = stepsSpan;
      else if (id && id.indexOf("step-") === 0) span = k(spans.step[parseInt(id.slice(5), 10) - 1]);
      else if (id && spans[id] != null) span = k(spans[id]);
      el.setAttribute("data-page", String(start));
      el.setAttribute("data-span", String(span));
      el.textContent = label(start, span);
    });
    var root = document.documentElement;
    root.setAttribute("data-toc-ready", "1");
    root.setAttribute("data-toc-total", String(p - 1));
    root.setAttribute("data-toc-spans", JSON.stringify(spans));
    return spans;
  }
  window.__tocBackfill = backfill;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", backfill);
  else backfill();
  window.addEventListener("beforeprint", backfill);
})();`;
}
export const TOC_BACKFILL_JS = tocBackfillScript(false);
export function guideHtml(dev, lang = "zh", { now = new Date(), prog = null, base = LIVE } = {}) {
  const en = lang === "en", L = (x) => (x == null ? "" : typeof x === "string" ? x : en ? x.en : x.zh);
  const box = (on) => (on ? "☑" : "☐");
  const date = now.toISOString().slice(0, 10);
  const t = (zh, e) => (en ? e : zh);
  const steps = dev.steps.map((s, i) => `<li class="step" id="step-${i + 1}" data-step="${i + 1}" data-fig="${(s.fig?.hi || []).length || (dev.fig || []).length}"><div><h3>${box(prog?.steps?.includes(i))} ${i + 1}. ${esc(L(s.t))}</h3><p>${esc(L(s.d))}</p>${s.warn ? `<p class="warn">⚠ ${esc(L(s.warn))}</p>` : ""}${s.stop ? `<p class="stop">■ ${stopText(L(s.stop), t)}</p>` : ""}</div><div class="fig">${figSvg(dev, s.fig, L, i)}<div class="qrbox">${qrSvg(stepUrl(base, dev.id, i + 1), { mm: 20, label: t(`第 ${i + 1} 步网页版的二维码`, `QR code for step ${i + 1} on the web`) })}<span>${t(`扫码看第 ${i + 1} 步网页版（可交互爆炸图）`, `Scan for step ${i + 1} on the web (interactive exploded view)`)}</span></div></div></li>`).join("");
  const css = (x) => String(x).replace(/[\\"\n]/g, " ");
  const sec = [["safety", t("1. 安全（先读）", "1. Safety (read first)")], ["mats", t("2. 材料和工具", "2. Materials and tools")], ["steps", t("3. 拆解步骤", "3. Steps")], ["modules", t("4. 拆下来的模块", "4. Modules you get")], ["notes", t("5. 说明", "5. Notes")]];
  const pg = tocPageMap(dev);
  const pgSpan = (id, n, span = 1) => ` <span class="toc-pg" data-sec="${id}" data-page="${n}" data-span="${span}">${tocPageLabel(n, span, en)}</span>`;
  const toc = `<nav class="toc" aria-label="${t("目录", "Contents")}"><h2 id="toc">${t("目录", "Contents")}</h2><ol>${sec.map(([id, h]) => `<li><a href="#${id}">${esc(h)}</a>${pgSpan(id, pg[id], id === "steps" ? (dev.steps || []).length : 1)}${id === "steps" ? `<ol>${dev.steps.map((s, i) => `<li><a href="#step-${i + 1}">${i + 1}. ${esc(L(s.t))}</a>${s.stop ? ` <span class="tag">${t("停止点", "stop")}</span>` : ""}${pgSpan("step-" + (i + 1), pg.step(i))}</li>`).join("")}</ol>` : ""}</li>`).join("")}</ol></nav>`;
  const H = Object.fromEntries(sec);
  return `<!doctype html><html lang="${en ? "en" : "zh-CN"}"><head><meta charset="utf-8"><title>${esc(L(dev.name))} · ${t("拆解指南", "Teardown guide")}</title>
<style>
body{font:13px/1.5 system-ui,"PingFang SC","Noto Sans CJK SC",sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#111}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;border-bottom:2px solid #333;margin:18px 0 6px}h3{font-size:14px;margin:0 0 2px}
.note{background:#fff7e0;border:1px solid #b45309;padding:6px 10px}.safety{border:2px solid #b91c1c;background:#fef2f2;padding:6px 12px}
.step{display:grid;grid-template-columns:1fr 200px;gap:12px;border:1px solid #999;padding:8px;margin:8px 0;break-inside:avoid}
.warn{border-left:4px solid #d97706;padding-left:6px;color:#78350f}.stop{border-left:4px solid #b91c1c;padding-left:6px;color:#7f1d1d;font-weight:600}
.legend{font-size:10px;margin:2px 0 0;color:#333}.fig svg{width:200px;height:auto;border:1px solid #ccc;background:#fff}ol{padding-left:0;list-style:none}ul.mats{list-style:none;padding-left:0}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 6px;text-align:left}th{background:#eee}.mono{font-family:ui-monospace,monospace;font-size:11px}
@page{size:A4;margin:16mm 12mm 18mm;@top-right{content:"${css(L(dev.name))}";font-size:9px;color:#555}@bottom-center{content:${en ? '"Page " counter(page) " of " counter(pages)' : '"第 " counter(page) " 页 / 共 " counter(pages) " 页"'};font-size:9px;color:#555}}
.cover{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.qrbox{display:flex;flex-direction:column;gap:3px;align-items:center;text-align:center;margin-top:6px;font-size:9px;color:#333;break-inside:avoid}.qrbox svg{flex:none}.qrbox span{display:block;width:34mm;max-width:100%;line-height:1.3}.qrcover{flex-direction:column;text-align:center;width:30mm;margin:0}
.toc ol{list-style:none;padding-left:0;margin:0}.toc ol ol{padding-left:16px;columns:2}.toc a{color:#1d4ed8;text-decoration:none}.toc-pg{float:right;color:#555;font-variant-numeric:tabular-nums}.tag{font-size:10px;border:1px solid #b91c1c;color:#7f1d1d;padding:0 3px;border-radius:3px}
body.toc-measure{width:186mm;max-width:186mm;margin:0 auto;padding:0;font-size:11px}body.toc-measure .noprint{display:none}
@media print{.toc-front{break-after:page}#safety,#mats,#steps,#modules,#notes{break-before:page}.step+.step{break-before:page}body{margin:0;max-width:none;padding:0;font-size:11px}.noprint{display:none}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body>
<p class="noprint"><button onclick="print()">${t("打印 / 存成 PDF", "Print / save as PDF")}</button></p>
<div class="toc-front"><div class="cover"><div><h1>${esc(L(dev.name))}</h1><p class="mono">${esc(dev.model)}</p></div><div class="qrbox qrcover">${qrSvg(stepUrl(base, dev.id, 0), { mm: 26, label: t("这份指南网页版的二维码", "QR code for this guide on the web") })}<span>${t("扫码打开网页版", "Scan to open on the web")}</span></div></div>
<p class="note">${t("早期原型，简化仿真", "Early prototype, simplified simulation")} · ${esc(L(UNVERIFIED))} · ${t("你的设备可能和这里写的不一样，以实物为准", "Your device may differ; trust what you see")} · ${t("生成日期", "Generated")} ${date}</p>
<p>${esc(L(dev.summary))}</p>
<p>${t(`${dev.steps.length} 步 · 约 ${dev.minutes} 分钟 · ${dev.battery ? "含电池" : "无电池"} · ${dev.volts} V 直流`, `${dev.steps.length} steps · about ${dev.minutes} min · ${dev.battery ? "has a battery" : "no battery"} · ${dev.volts} V DC`)}</p>
${toc}</div>
<h2 id="safety">${H.safety}</h2><div class="safety"><ul>${[...dev.safety, ...COMMON_SAFETY].map((s) => `<li>${esc(L(s))}</li>`).join("")}</ul></div>
<h2 id="mats">${H.mats}</h2><ul class="mats">${dev.materials.map((m, i) => `<li>${box(prog?.mats?.includes(i))} ${esc(L(m))}</li>`).join("")}</ul>
<h2 id="steps">${H.steps}</h2><ol>${steps}</ol>
<h2 id="modules">${H.modules}</h2><table><thead><tr><th>${t("模块", "Module")}</th><th>${t("零件库对应", "Library match")}</th><th>id</th></tr></thead><tbody>${dev.modules.map((m) => `<tr><td>${esc(L(m.t))}</td><td>${esc(L(MATCH[m.match]))}</td><td class="mono">${esc(m.part)}</td></tr>`).join("")}</tbody></table>
<h2 id="notes">${H.notes}</h2><p>${t("指南文字和插图都是本项目自己写、自己画的，没有复制任何外部拆解指南的文字或照片。", "All guide text and diagrams are written and drawn by this project. No text or photos were copied from any outside teardown guide.")}</p>
</body><script>${tocBackfillScript(en)}</script></html>`;
}

// v36：数据里的停止点文字本来就以“停止点：”开头，只在缺前缀时补上，避免重复
export function stopText(x, t) { const p = t("停止点：", "Stop point: "); const e = esc(x); return /^(停止点[：:]|stop point:)/i.test(x.trim()) ? e : p + e; }
