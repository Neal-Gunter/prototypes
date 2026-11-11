// v41：视觉润色走查（装配台 / 示波器 / 题库 / 使用说明 / 致谢许可）。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v41 SHOTS=1 node e2e/v41-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v41", SHOT = process.env.SHOTS !== "0";
fs.mkdirSync(`${OUT}/logs`, { recursive: true });
let pass = 0, fail = 0, n = 0;
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errs = [], bad = [];
const page = async (lang, w = 1440, h = 900) => {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  await c.addInitScript((l) => { try { localStorage.setItem("asm-tour-v22-done", "1"); localStorage.setItem("ui-lang", l); } catch { /* */ } }, lang);
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  p.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && !/favicon/.test(u)) bad.push(r.status() + " " + u.replace(/^https?:\/\/[^/]+/, "")); });
  return { c, p, T: (t) => p.locator(`[data-testid="${t}"]`) };
};
const shot = async (p, s) => { if (SHOT) await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${s}.png` }); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lum = (hex) => {
  const h = String(hex || "").trim().replace("#", "");
  if (h.length !== 6) return 1;
  const ch = (i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
};
const contrast = (a, b) => { const L1 = lum(a), L2 = lum(b), hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); };
const rgbToHex = (c) => {
  const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("");
};

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/");
  await p.waitForSelector("h1", { timeout: 20000 });
  const h1 = await p.locator("h1").first().innerText();
  ok(/把一个硬件想法/.test(h1), "首页中文标题还在", h1.slice(0, 40));
  await shot(p, "home-zh");

  await p.goto(BASE + "/assembly?scene=electrics");
  await p.waitForSelector("canvas", { timeout: 30000 });
  await wait(3000);
  const canvas = await p.locator("canvas").count();
  ok(canvas >= 1, "装配台有 3D canvas", String(canvas));
  await shot(p, "assembly-zh");

  await T("tab-elec").click();
  const details = T("bench-scope-panel");
  await details.waitFor({ timeout: 20000 });
  await details.scrollIntoViewIfNeeded();
  await details.locator("summary").first().click();
  const open = T("bench-scope-open");
  await open.first().waitFor({ timeout: 20000 });
  await open.first().scrollIntoViewIfNeeded();
  await open.first().click();
  await T("bench-scope").waitFor({ timeout: 20000 });
  await T("mscope").waitFor({ timeout: 20000 });
  const cap = T("mscope-capture");
  if (await cap.count()) { await cap.first().click(); await wait(3000); }
  await T("mscope").scrollIntoViewIfNeeded();
  const scopeText = await T("bench-scope").innerText();
  ok(/示波器/.test(scopeText), "示波器面板打开", scopeText.slice(0, 80));
  ok(await T("mscope-screen").count(), "示波器有屏幕");
  await shot(p, "scope-zh");
  await c.close();
}

for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/bank?path=path-night-light");
  await T("bank-paths").waitFor({ timeout: 20000 });
  await T("bank-path-detail").waitFor({ timeout: 10000 });
  const paths = await T("bank-paths").innerText();
  ok(/学习路径|Learning paths/.test(paths), `${lang}：题库页有学习路径`, paths.slice(0, 80));
  const h = await p.locator("h1").first().innerText();
  ok(/题库|Problem bank/.test(h), `${lang}：题库标题`, h);
  await shot(p, `bank-path-${lang}`);
  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/help#whats-new");
  await T("help-whats-new").waitFor({ timeout: 20000 });
  const news = await T("help-whats-new").innerText();
  ok(/v41/.test(news) && /v40/.test(news) && /v32/.test(news) && /frontend-design|纸/.test(news), "帮助页「本版更新」含 v41", news.slice(0, 240));
  const start = await T("help-whats-new").getAttribute("start");
  ok(start === "41", "本版更新列表从 41 起号", String(start));
  await shot(p, "help-whats-new-zh");

  await p.goto(BASE + "/credits#v41-ui");
  await T("credits-v41").waitFor({ timeout: 20000 });
  const cr = await T("credits-v41").innerText();
  ok(/frontend-design/.test(cr) && /Apache/.test(cr), "致谢页有 v41 skill 许可说明", cr.slice(0, 200));
  await shot(p, "credits-v41-zh");

  await p.goto(BASE + "/teardown/?d=coin-keyfob");
  await T("td-guide").waitFor({ timeout: 20000 });
  ok(await p.locator('[data-testid="td-fig"]').count() >= 1, "拆解页有自绘示意图");
  await shot(p, "teardown-keyfob-zh");
  await c.close();
}

{
  const { c, p } = await page("zh");
  await p.goto(BASE + "/help");
  await p.waitForSelector("h1", { timeout: 20000 });
  const tokens = await p.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const pick = (n) => s.getPropertyValue(n).trim();
    const body = getComputedStyle(document.body);
    return {
      paper: pick("--color-paper"),
      ink: pick("--color-ink"),
      inkSoft: pick("--color-ink-soft"),
      copper: pick("--color-copper"),
      copperDeep: pick("--color-copper-deep"),
      pcb: pick("--color-pcb"),
      bench: pick("--color-bench"),
      scopeBg: pick("--color-scope-bg"),
      bodyBg: body.backgroundColor,
      bodyFg: body.color,
    };
  });
  ok(tokens.pcb === "#2a4a34" && tokens.bench === "#8a6844" && tokens.scopeBg === "#0a120e", "v41 补充 token 已挂上", JSON.stringify(tokens));
  const inkPaper = contrast(rgbToHex(tokens.bodyFg) || tokens.ink, rgbToHex(tokens.bodyBg) || tokens.paper);
  const softPaper = contrast(tokens.inkSoft, tokens.paper);
  const copperPaper = contrast(tokens.copper, tokens.paper);
  ok(inkPaper >= 4.5, "正文墨色在纸色底上 ≥ 4.5:1", inkPaper.toFixed(2));
  ok(softPaper >= 4.5, "次要文字在纸色底上 ≥ 4.5:1", softPaper.toFixed(2));
  ok(copperPaper >= 4.5, "铜色在纸色底上 ≥ 4.5:1", copperPaper.toFixed(2));
  await c.close();
}

ok(!errs.length, "没有页面脚本错误", errs.slice(0, 3).join(" | "));
ok(!bad.length, "没有 4xx/5xx", bad.slice(0, 5).join(" | "));
await b.close();
console.log(`v41-bench ${pass}/${fail}`);
process.exit(fail ? 1 : 0);
