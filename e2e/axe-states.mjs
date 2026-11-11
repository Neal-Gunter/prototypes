// v36（我的补充）：axe-core 检查“打开状态”——命令面板（Ctrl + K，输入关键词后有结果列表）、装配页新手引导浮窗、
// 装配页三个标签（工具 / 通电 / 八爪鱼）各自展开全部折叠区、其他页面展开全部 <details>、手机宽度下的命令面板。
// 规则和 e2e/axe-check.mjs 一样（WCAG 2.0 / 2.1 A + AA，critical / serious 算失败）。axe 只在测试时注入，不进网站包。
// 用法：BASE=http://localhost:4173 LANG_UI=zh|en OUT=/tmp/axe node e2e/axe-states.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/tmp/axe", LANG = process.env.LANG_UI || "zh";
fs.mkdirSync(OUT, { recursive: true });
const openAll = async (p) => { await p.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; })); await p.waitForTimeout(400); };
const palette = (q) => async (p) => { await p.keyboard.press("Control+k"); await p.locator('[data-testid="palette-input"]').waitFor({ timeout: 5000 }); await p.keyboard.type(q); await p.waitForTimeout(800); return (await p.locator('[data-testid="palette-item"]').count()) > 0; };
const tab = (k) => async (p) => { await p.locator(`[data-testid="tab-${k}"]`).click(); await p.waitForTimeout(800); await openAll(p); return true; };
const STATES = [
  ["palette-home", "/", palette(LANG === "en" ? "servo" : "舵机")],
  ["palette-assembly", "/assembly", palette(LANG === "en" ? "wire" : "接线")],
  ["tour-assembly", "/assembly", async (p) => { if (!(await p.locator('[data-testid="tour"]').count())) { await p.locator('[data-testid="tour-btn"]').click(); await p.waitForTimeout(600); } return (await p.locator('[data-testid="tour"]').count()) > 0; }, { tour: true }],
  ["assembly-tools-open", "/assembly", tab("tools")],
  ["assembly-elec-open", "/assembly", tab("elec")],
  ["assembly-octo-open", "/assembly", tab("octo")],
  ["workbench-open", "/workbench", async (p) => { await openAll(p); return true; }],
  ["model-open", "/assembly/model", async (p) => { await openAll(p); return true; }],
  ["repair-open", "/repair", async (p) => { await openAll(p); return true; }],
  ["teardown-print-msg", "/teardown?d=ir-remote", async (p, c) => { const [pop] = await Promise.all([c.waitForEvent("page", { timeout: 10000 }), p.locator('[data-testid="td-print"]').click()]); await pop.close(); await p.waitForTimeout(400); return (await p.locator('[data-testid="td-print-msg"]').count()) > 0; }],
  ["palette-mobile", "/", palette(LANG === "en" ? "servo" : "舵机"), { w: 390, h: 844 }],
];
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = []; let fail = 0;
for (const [k, u, act, o = {}] of STATES) {
  if (ONLY && !ONLY.has(k)) continue;
  const c = await b.newContext({ viewport: { width: o.w || 1366, height: o.h || 768 } });
  await c.addInitScript(([l, tour, theme]) => { try { if (!tour) localStorage.setItem("asm-tour-v22-done", "1"); else localStorage.removeItem("asm-tour-v22-done"); localStorage.setItem("ui-lang", l); if (theme === "light" || theme === "dark" || theme === "system") localStorage.setItem("wb-theme-v1", theme); } catch { /* */ } }, [LANG, !!o.tour, process.env.THEME || "light"]);
  const p = await c.newPage();
  try {
    await p.goto(BASE + u, { waitUntil: "load", timeout: 60000 });
    await p.waitForTimeout(u.startsWith("/assembly") ? 6000 : 2500);
    const reached = await act(p, c);
    await p.addScriptTag({ path: AXE });
    const r = await p.evaluate(async () => {
      const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((x) => x.target.join(" ")) }));
    });
    const hard = r.filter((v) => v.impact === "critical" || v.impact === "serious");
    if (hard.length || !reached) fail++;
    rows.push({ k, u, reached, violations: r, hard: hard.length });
    console.log(`${hard.length || !reached ? "✗" : "✓"} ${k.padEnd(20)} ${reached ? "已打开" : "没打开"} 违规规则 ${r.length}（严重 ${hard.length}）${r.map((v) => ` ${v.id}[${v.impact}×${v.n}] ${v.sample[0] || ""}`).join("")}`);
  } catch (e) { fail++; rows.push({ k, u, error: String(e).slice(0, 200) }); console.log(`✗ ${k} 出错：${String(e).slice(0, 150)}`); }
  await c.close();
}
await b.close();
fs.writeFileSync(`${OUT}/axe-states-${LANG}-${process.env.THEME || "light"}.json`, JSON.stringify(rows, null, 1));
console.log(`axe-states（${LANG} / ${process.env.THEME || "light"}）：${rows.length - fail} PASS / ${fail} FAIL · 违规规则合计 ${rows.reduce((a, r) => a + (r.violations?.length || 0), 0)}`);
process.exit(fail ? 1 : 0);
