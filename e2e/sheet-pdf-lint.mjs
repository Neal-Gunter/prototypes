// v36（我的补充）：拆解指南打印版的 PDF 检查。每台设备 × 中英文：用 Chrome 生成 A4 PDF（和浏览器“存成 PDF”同一套排版），
// 再用 pdftotext 逐页取文字，检查：每页都有页码“第 N 页 / 共 M 页”（Page N of M）、第 1 页有目录、
// 每一步的标题和说明最后几个字在同一页（步骤没有被分页切开）、每一步的示意图文字也在这一页。早期原型，简化仿真。
// 自测：MUTATE=1 故意去掉“不在步骤中间分页”和页码，检查必须报出问题（退出码反过来：查出问题 = 0）。
// 用法：CHROME=/usr/bin/google-chrome node e2e/sheet-pdf-lint.mjs   （OUT 目录可选，写 logs/sheet-pdf-lint.json）
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const { DEVICES } = await import("../src/teardown/devices.js");
const { guideHtml } = await import("../src/teardown/guideSheet.js");
const MUT = process.env.MUTATE === "1";
const OUT = process.env.OUT || "/tmp/sheet-lint";
fs.mkdirSync(`${OUT}/logs`, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" });
const p = await (await b.newContext()).newPage();
// pdftotext 会把部分汉字取成康熙部首等兼容字（如“⼿”），先做 NFKC 归一
const W = (s) => String(s).normalize("NFKC").replace(/\s+/g, "");
const probs = [], stat = [];
for (const d of DEVICES) for (const lang of ["zh", "en"]) {
  const L = (x) => (typeof x === "string" ? x : x[lang]);
  let html = guideHtml(d, lang, { now: new Date("2026-11-03T00:00:00Z") });
  if (MUT) html = html.replace(/break-inside:avoid/g, "").replace(/@bottom-center\{[^}]*\}/, "").replace("</style>", ".step{display:block}.fig{margin-top:8px}</style>");
  await p.setContent(html, { waitUntil: "load" });
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  const f = `/tmp/sheet-${d.id}-${lang}.pdf`; fs.writeFileSync(f, pdf);
  const pages = execFileSync("pdftotext", ["-enc", "UTF-8", f, "-"]).toString().split("\f").filter((t) => t.trim());
  const bad = (m) => probs.push(`${d.id}/${lang}: ${m}`);
  const M = pages.length;
  pages.forEach((t, k) => { const want = lang === "en" ? `Page ${k + 1} of ${M}` : `第${k + 1}页/共${M}页`; if (!W(t).includes(W(want))) bad(`第 ${k + 1} 页没有页码“${want}”`); });
  if (!/目录|Contents/.test(pages[0] || "")) bad("第 1 页没有目录");
  let cut = 0;
  d.steps.forEach((s, i) => {
    const head = W(L(s.t)).slice(0, 14), tail = W(L(s.d)).slice(-10);
    const on = pages.map((t, k) => [k, W(t)]).filter(([k, t]) => k > 0 && t.includes(head)).map(([k]) => k);
    if (!on.length) { bad(`第 ${i + 1} 步标题在 PDF 里找不到`); return; }
    const k = on[on.length - 1];
    if (!W(pages[k]).includes(tail)) { cut++; bad(`第 ${i + 1} 步被分页切开（标题在第 ${k + 1} 页，说明结尾不在这页）`); }
    const lbl = (d.fig || []).filter((g) => g.w >= 14 && (!(s.fig?.hi || []).length || s.fig.hi.includes(g.id))).map((g) => W(L(g.t))).filter(Boolean);
    if (lbl.length && !lbl.some((x) => W(pages[k]).includes(x.slice(-4)))) bad(`第 ${i + 1} 步的示意图文字不在同一页`);
  });
  stat.push({ id: d.id, lang, pages: M, steps: d.steps.length, cut, kb: Math.round(pdf.length / 1024) });
}
await b.close();
for (const s of stat) console.log(`${s.id.padEnd(16)} ${s.lang} ${s.pages} 页 ${s.steps} 步 切开 ${s.cut} ${s.kb} KB`);
for (const x of probs) console.log("✗", x);
if (MUT) { const cuts = stat.reduce((a, s) => a + s.cut, 0), nopg = probs.filter((x) => /页码/.test(x)).length; console.log(`自测：故意改坏后查出 ${cuts} 处切开、${nopg} 处缺页码`); process.exit(cuts > 0 && nopg > 0 ? 0 : 1); }
fs.writeFileSync(`${OUT}/logs/sheet-pdf-lint.json`, JSON.stringify({ stat, probs }, null, 1));
console.log(`sheet-pdf-lint：${stat.length} 份 PDF，${probs.length} 个问题`);
process.exit(probs.length ? 1 : 0);
