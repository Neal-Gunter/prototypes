// v35（我的补充）：用 axe-core（MPL-2.0，只作开发依赖，只在测试时注入页面，不进网站包）做自动无障碍检查。
// 每页跑 WCAG 2.0 / 2.1 A + AA 规则，按严重度统计；critical / serious 的问题算失败（KNOWN 里列的已知例外除外，并写出原因）。
// 用法：BASE=http://localhost:4173 LANG_UI=zh|en OUT=/tmp/axe node e2e/axe-check.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/tmp/axe", LANG = process.env.LANG_UI || "zh";
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [["home", "/"], ["example", "/example"], ["workbench", "/workbench"], ["assembly", "/assembly"], ["parts", "/parts"], ["guide", "/assembly/guide"], ["octo-guide", "/assembly/octopus-guide"], ["model", "/assembly/model"], ["repair", "/repair"], ["project", "/project"], ["pinouts", "/pinouts"], ["credits", "/credits"], ["teardown", "/teardown"], ["teardown-car", "/teardown?d=aa-toy-car"], ["help", "/help"], ["bank", "/bank"], ["404", "/no-such-page"]];
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
// 已知例外：rule id -> 原因（只放确实是误报或第三方组件的）
const KNOWN = {};
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = []; let fail = 0;
for (const [k, u] of PAGES) {
  if (ONLY && !ONLY.has(k)) continue;
  const c = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await c.addInitScript(([l, theme]) => { try { localStorage.setItem("asm-tour-v22-done", "1"); localStorage.setItem("ui-lang", l); if (theme === "light" || theme === "dark" || theme === "system") localStorage.setItem("wb-theme-v1", theme); } catch { /* */ } }, [LANG, process.env.THEME || "light"]);
  const p = await c.newPage();
  try {
    await p.goto(BASE + u, { waitUntil: "load", timeout: 60000 });
    await p.waitForTimeout(k.startsWith("assembly") || k === "model" ? 6000 : 2500);
    await p.addScriptTag({ path: AXE });
    const r = await p.evaluate(async () => {
      const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((x) => x.target.join(" ")) }));
    });
    const hard = r.filter((v) => (v.impact === "critical" || v.impact === "serious") && !KNOWN[v.id]);
    if (hard.length) fail++;
    rows.push({ k, u, violations: r, hard: hard.length });
    console.log(`${hard.length ? "✗" : "✓"} ${k.padEnd(13)} 违规规则 ${r.length}（严重 ${hard.length}）${r.map((v) => ` ${v.id}[${v.impact}×${v.n}]`).join("")}`);
  } catch (e) { fail++; rows.push({ k, u, error: String(e).slice(0, 200) }); console.log(`✗ ${k} 出错：${String(e).slice(0, 150)}`); }
  await c.close();
}
await b.close();
fs.writeFileSync(`${OUT}/axe-${LANG}-${process.env.THEME || "light"}.json`, JSON.stringify(rows, null, 1));
const tot = rows.reduce((a, r) => a + (r.violations?.length || 0), 0);
console.log(`axe-check（${LANG} / ${process.env.THEME || "light"}）：${rows.length - fail} PASS / ${fail} FAIL · 违规规则合计 ${tot}`);
process.exit(fail ? 1 : 0);
