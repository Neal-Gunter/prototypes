// v34：3D 工作台的键盘操作和读屏标签（SceneA11y）、帮助页 v34 说明、手机 / 宽屏中英文无横向溢出。早期原型，简化仿真。
// 物理部分（按穿透深度放宽冷检间隔、细长件加时修穿透）在 Node 里测：e2e/hull-bench.mjs、e2e/peak-bench.mjs、e2e/thin-bench.mjs。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v34 SHOTS=0 node e2e/v34-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v34", SHOT = process.env.SHOTS !== "0";
fs.mkdirSync(`${OUT}/logs`, { recursive: true });
let pass = 0, fail = 0, n = 0; const res = {};
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
const CJK = /[\u4e00-\u9fff]/g;
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/assembly"); await p.waitForFunction(() => window.__asm, null, { timeout: 90000 }); await wait(800);
  await p.evaluate(async () => { await window.__asm.addAt("p-shaft-8x100", -6, 0); await window.__asm.addAt("p-ext-2020-150", 6, 4); });
  await wait(1500);
  const a = T("asm-a11y");
  const label = await a.getAttribute("aria-label");
  ok(lang === "zh" ? /方向键/.test(label) : /arrows/.test(label), `${lang}：3D 场景有键盘说明 aria-label`, label.slice(0, 40));
  ok((await a.getAttribute("role")) === "application" && (await a.getAttribute("tabindex")) === "0", `${lang}：场景可用 Tab 聚焦（role=application）`);
  const items = await p.locator('[data-testid="asm-a11y-list"] li').count();
  ok(items >= 2, `${lang}：隐藏零件清单 ${items} 项`);
  await a.focus(); await p.keyboard.press("ArrowRight"); await wait(400);
  const s1 = await T("asm-a11y-say").innerText();
  ok(lang === "zh" ? /已选中 .+（第 1 个/.test(s1) : /Selected .+ \(1 of/.test(s1), `${lang}：→ 选中第 1 个并读出`, s1.slice(0, 70));
  await p.keyboard.press("ArrowRight"); await wait(400);
  const s2 = await T("asm-a11y-say").innerText();
  ok(lang === "zh" ? /第 2 个/.test(s2) : /2 of/.test(s2), `${lang}：再按 → 换到第 2 个`, s2.slice(0, 70));
  const x0 = +(s2.match(/\bx (-?[\d.]+) (cm|厘米)/) || [])[1];
  await p.keyboard.press("Alt+ArrowRight"); await wait(600);
  const s3 = await T("asm-a11y-say").innerText();
  const x1 = +(s3.match(/\bx (-?[\d.]+) (cm|厘米)/) || [])[1];
  res[lang] = { s1, s2, s3, x0, x1 };
  ok(Math.abs(x1 - x0 - 1) < 0.35, `${lang}：Alt + → 平移约 1 cm`, `${x0} → ${x1}`);
  await p.keyboard.press("Escape"); await wait(300);
  ok(/没有选中|No part/.test(await T("asm-a11y-say").innerText()), `${lang}：Esc 取消选中`);
  const pen = await p.evaluate(() => window.__asm.overlapTest().maxPenetrationMm);
  ok(pen < 1, `${lang}：键盘移动后穿透 ${pen.toFixed(3)} mm（< 1）`);
  if (lang === "zh") { await a.focus(); await p.keyboard.press("ArrowRight"); await wait(300); await shot(p, "a11y-focus-zh"); }
  await c.close();
}
for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang);
  await p.goto(BASE + "/help/"); await p.waitForTimeout(1500);
  const t = await p.locator("body").innerText();
  ok(lang === "zh" ? t.includes("键盘和读屏（v34）") && t.includes("细长件（v34）") : t.includes("Keyboard and screen readers (v34)") && t.includes("Long thin parts (v34)"), `${lang}：帮助页有 v34 两段说明`);
  await p.goto(BASE + "/credits"); await p.waitForTimeout(1500);
  const cr = await p.locator('[data-testid="credits-v34-list"] li').count();
  const crt = await p.locator('[data-testid="credits-v34"]').innerText().catch(() => "");
  ok(cr >= 6 && (lang === "zh" ? /没有复制/.test(crt) : /No text, images or code were copied/.test(crt)), `${lang}：致谢页 v34 调研 ${cr} 条，写明没有复制`);
  if (lang === "en") { const k = (t.match(CJK) || []).length; ok(k / t.length < 0.02, `en 帮助页汉字占比 ${(k / t.length * 100).toFixed(2)}%`); }
  await c.close();
}
for (const [w, h] of [[390, 844], [1920, 1080]]) for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang, w, h);
  for (const path of ["/assembly", "/help/"]) {
    await p.goto(BASE + path); await p.waitForTimeout(2500);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(ov <= 1, `${w}px ${lang} ${path} 无横向溢出`, ov);
  }
  if (w === 390 && lang === "en") await shot(p, "help-mobile-en");
  await c.close();
}
ok(!errs.length, "无页面错误", errs.slice(0, 3).join(" | "));
ok(!bad.length, "无 4xx/5xx", bad.slice(0, 3).join(" | "));
fs.writeFileSync(`${OUT}/logs/v34-bench.json`, JSON.stringify({ pass, fail, res, errs, bad }, null, 1));
console.log(`v34-bench ${pass} PASS / ${fail} FAIL`);
await b.close();
process.exit(fail ? 1 : 0);
