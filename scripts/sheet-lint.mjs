// v36（我的补充）：拆解指南打印版的静态检查（不开浏览器，几百毫秒跑完）。每台设备 × 中英文生成打印页 HTML，检查：
//   步骤数和数据一致、每一步都有示意图（SVG 里至少 1 个图层，高亮的图层存在）、每步 CSS 不在中间分页（break-inside:avoid）、
//   有页码（@page counter(page) / counter(pages)）、目录里的每个链接都能跳到页面里的 id、英文版没有汉字、
//   示意图里每段文字按它实际的字号估算宽度，不超出它的方块（估算：汉字 1 个字号宽，其他字符 0.56 个字号宽；放不下的改成编号 + 图例）、
//   图例里的编号和方块里的编号对得上、停止点前缀不重复（v36 录演示时发现“停止点：停止点：”）。
// 真正分页后的检查（每页页码、步骤没被切开）在 e2e/sheet-pdf-lint.mjs。
// 用法：node scripts/sheet-lint.mjs   自测：MUTATE=1 node scripts/sheet-lint.mjs（故意改坏，必须每项都查出来）
const { DEVICES } = await import("../src/teardown/devices.js");
const { guideHtml, textW } = await import("../src/teardown/guideSheet.js");
const MUT = process.env.MUTATE === "1";
const CJK = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
const lint = (d, lang, html) => {
  const P = [], bad = (k, m) => P.push({ k, m: `${d.id}/${lang}: ${m}` });
  const L = (x) => (typeof x === "string" ? x : x[lang]);
  const steps = html.split('<li class="step"').slice(1);
  if (steps.length !== d.steps.length) bad("count", `打印页 ${steps.length} 步，数据 ${d.steps.length} 步`);
  steps.forEach((s, i) => {
    const svg = s.slice(s.indexOf("<svg"), s.indexOf("</svg>"));
    if (!svg || (svg.match(/<rect /g) || []).length < 1) bad("fig", `第 ${i + 1} 步没有示意图`);
  });
  d.steps.forEach((s, i) => { for (const h of s.fig?.hi || []) if (!(d.fig || []).some((g) => g.id === h)) bad("fig", `第 ${i + 1} 步高亮的图层 ${h} 不存在`); });
  if (!/\.step\{[^}]*break-inside:avoid/.test(html)) bad("break", "步骤没有设 break-inside:avoid（可能在步骤中间分页）");
  if (!/counter\(page\)/.test(html) || !/counter\(pages\)/.test(html)) bad("pageno", "没有页码（@page counter）");
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  if (!hrefs.length) bad("toc", "没有目录");
  for (const h of hrefs) if (!ids.has(h)) bad("toc", `目录链接 #${h} 找不到目标`);
  if (hrefs.filter((h) => /^step-/.test(h)).length !== d.steps.length) bad("toc", "目录里的步骤数和数据不一致");
  if (lang === "en") { const body = html.replace(/<style[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " "); const m = body.match(CJK); if (m) bad("cjk", `英文版有汉字“${m[0]}”`); }
  steps.forEach((st, i) => {
    const svg = st.slice(st.indexOf("<svg"), st.indexOf("</svg>"));
    const nums = [];
    for (const m of svg.matchAll(/<rect [^>]* width="([\d.]+)"[^>]*\/><text [^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)) {
      const [, w, fs, t] = m, tw = textW(t, +fs);
      if (/^\d+$/.test(t)) nums.push(t);
      if (tw > +w + 0.5) bad("label", `第 ${i + 1} 步示意图“${t}”字号 ${fs} 估算宽 ${tw.toFixed(0)}，方块只有 ${w}`);
    }
    const lg = (st.match(/<p class="legend">([\s\S]*?)<\/p>/) || [])[1] || "";
    for (const n of nums) if (!new RegExp(`<span>${n} = `).test(lg)) bad("legend", `第 ${i + 1} 步方块里写了编号 ${n}，图例里没有`);
  });
  if (/(停止点：\s*停止点：|Stop point:\s*Stop point:)/i.test(html)) bad("dup", "停止点前缀重复");
  return P;
};
let all = [], n = 0;
if (!MUT) {
  for (const d of DEVICES) for (const lang of ["zh", "en"]) { all.push(...lint(d, lang, guideHtml(d, lang))); n++; }
  for (const x of all) console.log("✗", x.m);
  console.log(`sheet-lint：${DEVICES.length} 台 × 2 种语言 = ${n} 份打印页，${DEVICES.reduce((a, d) => a + d.steps.length, 0) * 2} 步，${all.length} 个问题`);
  process.exit(all.length ? 1 : 0);
}
// 自测：每种改坏方式都必须被查出来
const d0 = DEVICES[0], h0 = guideHtml(d0, "en");
const cases = [
  ["count", h0.replace('<li class="step"', '<li class="stepx"')],
  ["fig", h0.replace(/(<li class="step"[\s\S]*?)<svg[\s\S]*?<\/svg>/, "$1")],
  ["break", h0.replace(/break-inside:avoid/g, "")],
  ["pageno", h0.replace(/counter\(page\)/g, "1")],
  ["toc", h0.replace('href="#step-1"', 'href="#step-99"')],
  ["cjk", h0.replace("</h1>", "汉</h1>")],
  ["dup", h0.replace('<p class="stop">■ ', '<p class="stop">■ Stop point: ')],
];
let ok = 0;
for (const [k, h] of cases) { const hit = lint(d0, "en", h).some((x) => x.k === k); console.log(hit ? "✓" : "✗", `改坏 ${k} → ${hit ? "查出" : "没查出"}`); ok += hit; }
const wide = { ...d0, fig: [{ id: "z", x: 1, y: 1, w: 20, h: 10, c: "#fff", t: { zh: "很长很长的标签", en: "a very long label" } }], steps: d0.steps.map((s) => ({ ...s, fig: {} })) };
const hw = guideHtml(wide, "zh");
for (const [k, h] of [["label", hw.replace(/>1<\/text>/, ">很长很长的标签</text>")], ["legend", hw.replace(/<span>1 = /, "<span>9 = ")]]) {
  const hit = lint(wide, "zh", h).some((x) => x.k === k); console.log(hit ? "✓" : "✗", `改坏 ${k} →`, hit ? "查出" : "没查出"); ok += hit;
}
console.log(`sheet-lint 自测：${ok}/${cases.length + 2}`);
process.exit(ok === cases.length + 2 ? 0 : 1);
