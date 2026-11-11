// v36（我的补充）：拆解指南打印版的 PDF 检查。每台设备 × 中英文：用 Chrome 生成 A4 PDF（和浏览器“存成 PDF”同一套排版），
// 再用 pdftotext 逐页取文字，检查：每页都有页码“第 N 页 / 共 M 页”（Page N of M）、第 1 页有目录、
// 每一步的标题和说明最后几个字在同一页（步骤没有被分页切开）、每一步的示意图文字也在这一页。早期原型，简化仿真。
// 自测：MUTATE=1 故意去掉“不在步骤中间分页”和页码，检查必须报出问题（退出码反过来：查出问题 = 0）。
// v45：同时用 A4 和 Letter 检查每条学习路径的自学记录打印页（页码、非正式证书说明、步骤和成绩都在同一页）。
// 用法：CHROME=/usr/bin/google-chrome node e2e/sheet-pdf-lint.mjs   （OUT 目录可选，写 logs/sheet-pdf-lint.json）
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const { DEVICES } = await import("../src/teardown/devices.js");
const { guideHtml, tocPageMap, tocPageLabel } = await import("../src/teardown/guideSheet.js");
const { PATHS, stepKey } = await import("../src/bank/paths.js");
const { recordHtml, formatQuizScore } = await import("../src/bank/recordSheet.js");
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
  if (MUT) html = html.replace(/break-inside:avoid/g, "").replace(/break-before:\s*page/g, "auto").replace(/break-after:\s*page/g, "auto").replace(/@bottom-center\{[^}]*\}/, "").replace("</style>", ".step{display:block}.fig{margin-top:8px}</style>");
  await p.setContent(html, { waitUntil: "load" });
  if (!MUT) {
    await p.waitForFunction(() => document.documentElement.getAttribute("data-toc-ready") === "1", null, { timeout: 15000 });
  }
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  const f = `/tmp/sheet-${d.id}-${lang}.pdf`; fs.writeFileSync(f, pdf);
  const pages = execFileSync("pdftotext", ["-enc", "UTF-8", f, "-"]).toString().split("\f").filter((t) => t.trim());
  const bad = (m) => probs.push(`${d.id}/${lang}: ${m}`);
  const M = pages.length;
  pages.forEach((t, k) => { const want = lang === "en" ? `Page ${k + 1} of ${M}` : `第${k + 1}页/共${M}页`; if (!W(t).includes(W(want))) bad(`第 ${k + 1} 页没有页码“${want}”`); });
  if (!/目录|Contents/.test(pages[0] || "")) bad("第 1 页没有目录");
  if (!MUT) {
    const pg = tocPageMap(d);
    const wantToc = (n) => lang === "en" ? `p.${n}` : `第${n}页`;
    const first = W(pages[0] || "");
    for (const [id, label] of [["safety", "安全|Safety"], ["mats", "材料|Materials"], ["steps", "拆解步骤|Steps"], ["modules", "模块|Modules"], ["notes", "说明|Notes"]]) {
      if (!first.includes(W(wantToc(pg[id])))) bad(`目录里没有“${id}”的页码 ${wantToc(pg[id])}`);
    }
    d.steps.forEach((s, i) => { if (!first.includes(W(wantToc(pg.step(i))))) bad(`目录里没有第 ${i + 1} 步的页码 ${wantToc(pg.step(i))}`); });
    const onPage = (n, re) => n >= 1 && n <= pages.length && re.test(pages[n - 1] || "");
    if (!onPage(pg.safety, /安全|Safety/)) bad(`安全须知不在目录所说的第 ${pg.safety} 页`);
    if (!onPage(pg.mats, /材料|Materials|工具|tools/i)) bad(`材料清单不在目录所说的第 ${pg.mats} 页`);
    if (!onPage(pg.modules, /模块|Modules/)) bad(`模块表不在目录所说的第 ${pg.modules} 页`);
    if (!onPage(pg.notes, /说明|Notes/)) bad(`说明不在目录所说的第 ${pg.notes} 页`);
    d.steps.forEach((s, i) => {
      const head = W(L(s.t)).slice(0, 14);
      const k = pg.step(i);
      if (!W(pages[k - 1] || "").includes(head)) bad(`第 ${i + 1} 步标题不在目录所说的第 ${k} 页`);
    });
  }
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

if (!MUT) {
  // v40：把安全节垫高到跨页，确认目录页码被回填，后文所在页与目录一致。
  const d = DEVICES[0];
  const lang = "zh";
  const L = (x) => (typeof x === "string" ? x : x[lang]);
  let html = guideHtml(d, lang, { now: new Date("2026-11-03T00:00:00Z") });
  html = html.replace('<h2 id="mats">', '<div class="span-pad" style="height:280mm" data-span-pad="1"></div><h2 id="mats">');
  await p.setContent(html, { waitUntil: "load" });
  await p.waitForFunction(() => document.documentElement.getAttribute("data-toc-ready") === "1", null, { timeout: 15000 });
  const info = await p.evaluate(() => {
    const g = (id) => document.querySelector(`.toc-pg[data-sec="${id}"]`);
    return {
      ready: document.documentElement.getAttribute("data-toc-ready"),
      spans: JSON.parse(document.documentElement.getAttribute("data-toc-spans") || "{}"),
      safetyPage: g("safety")?.getAttribute("data-page"),
      safetySpan: g("safety")?.getAttribute("data-span"),
      safetyText: g("safety")?.textContent,
      matsPage: g("mats")?.getAttribute("data-page"),
      stepsPage: g("steps")?.getAttribute("data-page"),
    };
  });
  const bad = (m) => probs.push(`span-backfill/${d.id}/${lang}: ${m}`);
  if (info.ready !== "1") bad("打印页没有 data-toc-ready");
  if (!((info.spans?.safety || 0) >= 2)) bad(`安全节应跨页，实际 spans.safety=${info.spans?.safety}`);
  if (!(Number(info.safetySpan) >= 2)) bad(`目录安全节 data-span 应为 ≥2，实际 ${info.safetySpan}`);
  if (!(Number(info.matsPage) >= 4)) bad(`材料页码应后移到 ≥4，实际 ${info.matsPage}`);
  if (!(Number(info.stepsPage) >= Number(info.matsPage) + 1)) bad(`步骤页码应在材料之后，steps=${info.stepsPage} mats=${info.matsPage}`);
  const wantRange = W(tocPageLabel(Number(info.safetyPage), Number(info.safetySpan), false));
  if (!W(info.safetyText || "").includes(wantRange)) bad(`目录安全节应写出范围“${wantRange}”，实际“${info.safetyText}”`);
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  const f = `/tmp/sheet-span-${d.id}-${lang}.pdf`; fs.writeFileSync(f, pdf);
  const pages = execFileSync("pdftotext", ["-enc", "UTF-8", f, "-"]).toString().split("\f").filter((t) => t.trim());
  const onPage = (n, re) => n >= 1 && n <= pages.length && re.test(pages[n - 1] || "");
  const matsN = Number(info.matsPage);
  if (!onPage(matsN, /材料|Materials|工具|tools/i)) bad(`垫高后材料清单不在目录所说的第 ${matsN} 页（共 ${pages.length} 页）`);
  const first = W(pages[0] || "");
  if (!first.includes(wantRange)) bad(`PDF 目录里没有安全节的跨页范围 ${wantRange}`);
  stat.push({ id: d.id + "-span", lang, pages: pages.length, steps: d.steps.length, cut: 0, kb: Math.round(pdf.length / 1024) });
  console.log(`span-backfill safety=${info.spans?.safety} mats=${info.matsPage} pdfPages=${pages.length}`);
}


if (!MUT) {
  const sample = (path) => {
    const done = {};
    (path.steps || []).forEach((st, i) => { done[stepKey(path.id, st, i)] = true; });
    const quiz = { answers: {}, correct: 3, total: 4, at: "2026-11-11T04:00:00.000Z" };
    return { path, name: "Alex Lee", prog: { v: 1, paths: { [path.id]: { done, quiz, name: "Alex Lee" } } }, quiz, now: new Date("2026-11-11T04:00:00.000Z") };
  };
  for (const path of PATHS) for (const lang of ["zh", "en"]) for (const paper of ["A4", "Letter"]) {
    const html = recordHtml({ ...sample(path), lang, paper });
    await p.setContent(html, { waitUntil: "load" });
    const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    const f = `/tmp/record-${path.id}-${lang}-${paper}.pdf`;
    fs.writeFileSync(f, pdf);
    const pages = execFileSync("pdftotext", ["-enc", "UTF-8", f, "-"]).toString().split("\f").filter((t) => t.trim());
    const bad = (m) => probs.push(`record/${path.id}/${lang}/${paper}: ${m}`);
    const M = pages.length;
    const text = pages.map((t) => W(t)).join("");
    pages.forEach((t, k) => {
      const want = lang === "en" ? `Page ${k + 1} of ${M}` : `第${k + 1}页/共${M}页`;
      if (!W(t).includes(W(want))) bad(`第 ${k + 1} 页没有页码“${want}”`);
    });
    if (M !== 1) bad(`应为 1 页，实际 ${M} 页（应同时放入 ${paper}）`);
    const title = W(lang === "en" ? (path.titleEn || path.title) : path.title);
    if (title && !text.includes(title)) bad("没有路径标题");
    if (!text.includes(W("Alex Lee"))) bad("没有姓名");
    if (!text.includes(W("2026-11-11"))) bad("没有日期");
    const score = formatQuizScore({ correct: 3, total: 4 }, lang === "en");
    if (!text.includes(W(score))) bad(`没有测验成绩“${score}”`);
    if (lang === "en") {
      if (!text.toLowerCase().includes(W("Self-study record").toLowerCase()) || !text.toLowerCase().includes(W("not an official certificate").toLowerCase())) bad("没有标明自学记录 / 非正式证书");
      const m = (pages.join(" ")).match(/[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/);
      if (m) bad(`英文版有汉字“${m[0]}”`);
    } else {
      if (!text.includes(W("自学记录")) || !text.includes(W("不是正式证书"))) bad("没有标明自学记录 / 非正式证书");
    }
    (path.steps || []).forEach((st, i) => {
      const label = W(lang === "en" ? (st.titleEn || st.title) : st.title);
      if (label && !text.includes(label)) bad(`缺少第 ${i + 1} 步`);
    });
    // 标题和最后一步应在同一页（没有被切开）
    const last = path.steps[path.steps.length - 1];
    const lastLabel = W(lang === "en" ? (last.titleEn || last.title) : last.title);
    if (M === 1 && title && lastLabel && !(text.includes(title) && text.includes(lastLabel))) bad("标题和步骤不在同一页");
    stat.push({ id: `record-${path.id}-${paper}`, lang, pages: M, steps: path.steps.length, cut: M === 1 ? 0 : 1, kb: Math.round(pdf.length / 1024) });
  }
}

await b.close();
for (const s of stat) console.log(`${s.id.padEnd(16)} ${s.lang} ${s.pages} 页 ${s.steps} 步 切开 ${s.cut} ${s.kb} KB`);
for (const x of probs) console.log("✗", x);
if (MUT) { const cuts = stat.reduce((a, s) => a + s.cut, 0), nopg = probs.filter((x) => /页码/.test(x)).length; console.log(`自测：故意改坏后查出 ${cuts} 处切开、${nopg} 处缺页码`); process.exit(cuts > 0 && nopg > 0 ? 0 : 1); }
fs.writeFileSync(`${OUT}/logs/sheet-pdf-lint.json`, JSON.stringify({ stat, probs }, null, 1));
console.log(`sheet-pdf-lint：${stat.length} 份 PDF，${probs.length} 个问题`);
process.exit(probs.length ? 1 : 0);
