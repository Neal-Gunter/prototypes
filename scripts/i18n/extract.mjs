// v27：抽取源码 / 公开数据里的中文片段，供离线机翻（Argos Translate）生成 public/i18n/en-mt.json
// 用法：node scripts/i18n/extract.mjs > .tmp/i18n-src.json
import fs from "node:fs";
import path from "node:path";
import { RUN_RE, SUB_RE, HAS_CJK } from "../../src/i18n-runs.js";
const out = { whole: new Set(), runs: new Set(), subs: new Set(), exact: {} };
const paired = new Set(); // v31

const addRun = (r) => { r = r.trim(); if (!HAS_CJK.test(r)) return; out.runs.add(r); for (const s of r.match(SUB_RE) || []) out.subs.add(s); };
const addText = (t) => { const w = t.replace(/\s+/g, " ").trim(); if (HAS_CJK.test(w) && w.length < 400) out.whole.add(w); for (const m of t.match(RUN_RE) || []) addRun(m); };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([;,{}\])])\s*\/\/ .*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const STR = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
for (const f of walk("src").filter((f) => /\.(jsx?|mjs)$/.test(f))) {
  const s = stripComments(fs.readFileSync(f, "utf8"));
  for (const m of s.matchAll(STR)) { const body = m[2]; if (!HAS_CJK.test(body)) continue; if (m[1] === "`") { for (const piece of body.split(/\$\{[^}]*\}/)) addText(piece); } else addText(body); }
  // v31：源码里自带英文的 T("中文", "English") 成对文字，运行时直接用英文，不需要机翻：记成 exact（不算“未翻译”）
  for (const m of s.matchAll(/\bT\(\s*"((?:\\.|[^"\\\n])*)"\s*,\s*"((?:\\.|[^"\\\n])*)"/g)) if (HAS_CJK.test(m[1]) && !HAS_CJK.test(m[2])) { const w = m[1].replace(/\s+/g, " ").trim(); paired.add(w); out.exact[w] = m[2].replace(/\\"/g, '"'); }
  // v31：同样的成对写法还有 L({ zh: "…", en: "…" }) 和近似件 make("id", "中文名", "English name", …)
  for (const re of [/\bzh:\s*"((?:\\.|[^"\\\n])*)"\s*,\s*en:\s*"((?:\\.|[^"\\\n])*)"/g, /\bmake\(\s*"[^"]*"\s*,\s*"((?:\\.|[^"\\\n])*)"\s*,\s*"((?:\\.|[^"\\\n])*)"/g])
    for (const m of s.matchAll(re)) if (HAS_CJK.test(m[1]) && !HAS_CJK.test(m[2])) { const w = m[1].replace(/\s+/g, " ").trim(); paired.add(w); out.exact[w] = m[2].replace(/\\"/g, '"'); }
  // JSX 文本（标签之间）
  for (const m of s.matchAll(/>([^<>{}"'`]*[\u4e00-\u9fff][^<>{}"'`]*)</g)) addText(m[1]);
  for (const m of s.match(RUN_RE) || []) addRun(m);
}
// 公开 JSON（指南、零件库元数据、引脚图）
const jsonStrings = (o, fn) => { if (typeof o === "string") fn(o); else if (Array.isArray(o)) o.forEach((v) => jsonStrings(v, fn)); else if (o && typeof o === "object") Object.values(o).forEach((v) => jsonStrings(v, fn)); };
const jfiles = [...walk("public/guides"), ...(fs.existsSync("public/pinouts") ? walk("public/pinouts") : [])].filter((f) => f.endsWith(".json"));
for (const f of jfiles) jsonStrings(JSON.parse(fs.readFileSync(f, "utf8")), addText);
// 零件：中文名 → 原英文名（直接用原名，不机翻）；其余中文字段机翻
const idx = JSON.parse(fs.readFileSync("public/lib/index.json", "utf8"));
for (const p of idx.parts) if (p[1] && p[2] && HAS_CJK.test(p[1]) && p[1] !== p[2]) out.exact[p[1]] = p[2];
for (const f of walk("public/lib/catalog").filter((f) => f.endsWith(".json"))) {
  const d = JSON.parse(fs.readFileSync(f, "utf8")); const items = Array.isArray(d) ? d : Object.values(d.parts || d);
  for (const p of items) if (p && typeof p === "object") { if (p.name_zh && p.name && p.name_zh !== p.name) out.exact[p.name_zh] = p.name; for (const k of ["dims_src", "tags_src", "author", "licence", "rating_src", "method", "measured", "why", "note", "holes_src"]) if (typeof p[k] === "string") addText(p[k]); }
}
for (const k of Object.keys(out.exact)) { out.whole.delete(k); }
// v31：只出现在成对文字里的片段（runs / subs）也不需要机翻
{ const rest = [...out.whole].filter((w) => !paired.has(w)).join("\n"); for (const set of [out.runs, out.subs]) for (const r of [...set]) if (!rest.includes(r) && [...paired].some((w) => w.includes(r))) set.delete(r); }
const res = { whole: [...out.whole].sort(), runs: [...out.runs].filter((r) => !out.whole.has(r)).sort(), subs: [...out.subs].filter((r) => !out.whole.has(r) && !out.runs.has(r)).sort(), exact: out.exact };
console.log(JSON.stringify(res));
console.error(`paired ${paired.size} whole ${res.whole.length} runs ${res.runs.length} subs ${res.subs.length} exact ${Object.keys(res.exact).length} chars ${[...res.whole, ...res.runs, ...res.subs].join("").length}`);
