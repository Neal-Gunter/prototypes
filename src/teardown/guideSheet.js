// v35（我的补充）：拆解指南的打印版 / PDF。全部在浏览器里生成一份独立的 HTML（含本项目自绘的步骤插图 SVG），
// 用浏览器自带的“打印 → 存成 PDF”导出，不用任何付费服务、不上传任何东西。早期原型，简化仿真。
import { COMMON_SAFETY, UNVERIFIED } from "./devices.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const MATCH = { same: { zh: "零件库同类件", en: "Library part (same type)" }, similar: { zh: "零件库相近件（尺寸可能不同）", en: "Library part (similar; size may differ)" }, approx: { zh: "近似件（程序生成，尺寸估算）", en: "Approximate part (procedural, estimated size)" } };

// 和页面上的 StepFig 画法一致（纯字符串版，打印页不依赖 React）
export function figSvg(dev, fig, L, i) {
  const off = fig?.off || {}, hi = new Set(fig?.hi || []);
  const g = (dev.fig || []).map((s) => {
    const [dx, dy] = off[s.id] || [0, 0], on = hi.has(s.id);
    const x = Math.max(1, Math.min(199 - s.w, s.x + dx)), y = Math.max(1, Math.min(123 - s.h, s.y + dy));
    const txt = (on || !hi.size) && s.w >= 14 ? `<text x="${x + s.w / 2}" y="${y + s.h / 2 + 3}" text-anchor="middle" font-size="7" fill="${/#(2f6fd6|26272a|2f8f4e|5b6168)/.test(s.c) ? "#fff" : "#26272a"}">${esc(L(s.t))}</text>` : "";
    return `<g opacity="${hi.size && !on ? 0.45 : 1}"><rect x="${x}" y="${y}" width="${s.w}" height="${s.h}" rx="${s.round ? s.w / 2 : 2}" fill="${s.c}" stroke="${on ? "#d9792b" : "#26272a"}" stroke-width="${on ? 2 : 0.6}"/>${txt}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 124" role="img" aria-label="${esc(L({ zh: `第 ${i + 1} 步示意图（本项目自绘）`, en: `Step ${i + 1} diagram (drawn by this project)` }))}">${g}</svg>`;
}

export function guideHtml(dev, lang = "zh", { now = new Date(), prog = null } = {}) {
  const en = lang === "en", L = (x) => (x == null ? "" : typeof x === "string" ? x : en ? x.en : x.zh);
  const box = (on) => (on ? "☑" : "☐");
  const date = now.toISOString().slice(0, 10);
  const t = (zh, e) => (en ? e : zh);
  const steps = dev.steps.map((s, i) => `<li class="step"><div><h3>${box(prog?.steps?.includes(i))} ${i + 1}. ${esc(L(s.t))}</h3><p>${esc(L(s.d))}</p>${s.warn ? `<p class="warn">⚠ ${esc(L(s.warn))}</p>` : ""}${s.stop ? `<p class="stop">■ ${t("停止点", "Stop point")}：${esc(L(s.stop))}</p>` : ""}</div><div class="fig">${figSvg(dev, s.fig, L, i)}</div></li>`).join("");
  return `<!doctype html><html lang="${en ? "en" : "zh-CN"}"><head><meta charset="utf-8"><title>${esc(L(dev.name))} · ${t("拆解指南", "Teardown guide")}</title>
<style>
body{font:13px/1.5 system-ui,"PingFang SC","Noto Sans CJK SC",sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#111}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;border-bottom:2px solid #333;margin:18px 0 6px}h3{font-size:14px;margin:0 0 2px}
.note{background:#fff7e0;border:1px solid #b45309;padding:6px 10px}.safety{border:2px solid #b91c1c;background:#fef2f2;padding:6px 12px}
.step{display:grid;grid-template-columns:1fr 200px;gap:12px;border:1px solid #999;padding:8px;margin:8px 0;break-inside:avoid}
.warn{border-left:4px solid #d97706;padding-left:6px;color:#78350f}.stop{border-left:4px solid #b91c1c;padding-left:6px;color:#7f1d1d;font-weight:600}
.fig svg{width:200px;height:auto;border:1px solid #ccc;background:#fff}ol{padding-left:0;list-style:none}ul.mats{list-style:none;padding-left:0}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 6px;text-align:left}th{background:#eee}.mono{font-family:ui-monospace,monospace;font-size:11px}
@media print{body{margin:0;max-width:none;font-size:11px}.noprint{display:none}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body>
<p class="noprint"><button onclick="print()">${t("打印 / 存成 PDF", "Print / save as PDF")}</button></p>
<h1>${esc(L(dev.name))}</h1><p class="mono">${esc(dev.model)}</p>
<p class="note">${t("早期原型，简化仿真", "Early prototype, simplified simulation")} · ${esc(L(UNVERIFIED))} · ${t("你的设备可能和这里写的不一样，以实物为准", "Your device may differ; trust what you see")} · ${t("生成日期", "Generated")} ${date}</p>
<p>${esc(L(dev.summary))}</p>
<p>${t(`${dev.steps.length} 步 · 约 ${dev.minutes} 分钟 · ${dev.battery ? "含电池" : "无电池"} · ${dev.volts} V 直流`, `${dev.steps.length} steps · about ${dev.minutes} min · ${dev.battery ? "has a battery" : "no battery"} · ${dev.volts} V DC`)}</p>
<h2>${t("1. 安全（先读）", "1. Safety (read first)")}</h2><div class="safety"><ul>${[...dev.safety, ...COMMON_SAFETY].map((s) => `<li>${esc(L(s))}</li>`).join("")}</ul></div>
<h2>${t("2. 材料和工具", "2. Materials and tools")}</h2><ul class="mats">${dev.materials.map((m, i) => `<li>${box(prog?.mats?.includes(i))} ${esc(L(m))}</li>`).join("")}</ul>
<h2>${t("3. 拆解步骤", "3. Steps")}</h2><ol>${steps}</ol>
<h2>${t("4. 拆下来的模块", "4. Modules you get")}</h2><table><thead><tr><th>${t("模块", "Module")}</th><th>${t("零件库对应", "Library match")}</th><th>id</th></tr></thead><tbody>${dev.modules.map((m) => `<tr><td>${esc(L(m.t))}</td><td>${esc(L(MATCH[m.match]))}</td><td class="mono">${esc(m.part)}</td></tr>`).join("")}</tbody></table>
<h2>${t("5. 说明", "5. Notes")}</h2><p>${t("指南文字和插图都是本项目自己写、自己画的，没有复制任何外部拆解指南的文字或照片。", "All guide text and diagrams are written and drawn by this project. No text or photos were copied from any outside teardown guide.")}</p>
</body></html>`;
}
