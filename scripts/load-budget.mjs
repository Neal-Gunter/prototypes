// v21：首屏加载预算（读 dist/，先 npx vite build）。早期原型，简化仿真。
//   首页入口（index.html 直接引用的 JS + CSS + modulepreload）gzip 后 ≤ 150 KB；
//   /parts 页面另外按需加载（three.js、R3F、零件索引）gzip 后 ≤ 900 KB；Rapier / Worker 只在装配台 / 搜索时才加载。
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
const D = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist");
const BUDGET_ENTRY_KB = 150, BUDGET_PARTS_KB = 900;
const gz = (f) => zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length;
const html = fs.readFileSync(path.join(D, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1].replace(/^.*\/assets\//, "assets/"));
// 入口 JS 的静态 import 也算首屏（浏览器会立即去取）
const seen = new Set();
const walk = (r) => { if (seen.has(r)) return; seen.add(r); if (!r.endsWith(".js")) return; const s = fs.readFileSync(path.join(D, r), "utf8"); for (const m of s.matchAll(/(?:^|[;\n])\s*import\s*(?:[^"'()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)) walk("assets/" + m[1]); };
refs.forEach(walk);
const entry = [...seen].map((r) => ({ f: r, kb: gz(path.join(D, r)) / 1024 }));
const entryKB = entry.reduce((s, x) => s + x.kb, 0);
// /parts 的按需包：PartsPage 及其静态依赖
const pp = fs.readdirSync(path.join(D, "assets")).find((f) => /^PartsPage-.*\.js$/.test(f));
const before = new Set(seen); walk("assets/" + pp);
const parts = [...seen].filter((r) => !before.has(r)).map((r) => ({ f: r, kb: gz(path.join(D, r)) / 1024 }));
const idx = path.join(D, "lib/index.json"); if (fs.existsSync(idx)) parts.push({ f: "lib/index.json", kb: gz(idx) / 1024 });
const partsKB = parts.reduce((s, x) => s + x.kb, 0);
const rapierInEntry = [...seen].some((r) => /rapier|worker/.test(r));
const r = { entryKB: +entryKB.toFixed(1), budgetEntryKB: BUDGET_ENTRY_KB, partsKB: +partsKB.toFixed(1), budgetPartsKB: BUDGET_PARTS_KB, rapierOnParts: rapierInEntry, entry, parts };
const out = process.env.OUT || "/tmp/v21budget"; fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "load-budget.json"), JSON.stringify(r, null, 1));
const ok = entryKB <= BUDGET_ENTRY_KB && partsKB <= BUDGET_PARTS_KB && !rapierInEntry;
console.log(`${ok ? "✓" : "✗"} 首屏预算：入口 ${entryKB.toFixed(1)} KB gzip（预算 ${BUDGET_ENTRY_KB}）· /parts 按需 ${partsKB.toFixed(1)} KB gzip（预算 ${BUDGET_PARTS_KB}）· 首页和 /parts 都不加载 Rapier / Worker：${!rapierInEntry}`);
process.exit(ok ? 0 : 1);
