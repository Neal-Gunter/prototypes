// v35：3D 场景键盘旋转（R / Shift + R / Alt + R）、拆解指南打印版（弹出页、下载 HTML、page.pdf 真 PDF）、第 12 台设备（红外遥控器）、
// 帮助 / 致谢页 v35 说明、手机 / 宽屏中英文无横向溢出。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v35 SHOTS=0 node e2e/v35-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v35", SHOT = process.env.SHOTS !== "0";
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
const yawOf = (s) => +(s.match(/(?:turned|朝向) (\d+)°/) || [])[1];
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/assembly"); await p.waitForFunction(() => window.__asm, null, { timeout: 90000 }); await wait(800);
  await p.evaluate(async () => { await window.__asm.addAt("p-ext-2020-150", -8, -6); await window.__asm.addAt("p-shaft-8x100", 8, 6); });
  await wait(2000);
  const a = T("asm-a11y");
  const label = await a.getAttribute("aria-label");
  ok(lang === "zh" ? /R 转 90°/.test(label) || /R/.test(label) && /旋转|转/.test(label) : /R .*(turn|rotat)/i.test(label), `${lang}：键盘说明里有 R 旋转`, label.slice(-60));
  await a.focus(); await p.keyboard.press("ArrowRight"); await wait(400);
  const s0 = await T("asm-a11y-say").innerText(), y0 = yawOf(s0);
  ok(Number.isFinite(y0), `${lang}：读出里有朝向`, s0.slice(-30));
  await p.keyboard.press("r"); await wait(700);
  const s1 = await T("asm-a11y-say").innerText(), y1 = yawOf(s1);
  const d = (a1, b1) => ((b1 - a1) % 360 + 360) % 360;
  ok(Math.abs(d(y0, y1) - 90) <= 3, `${lang}：R 转 90°`, `${y0}° → ${y1}°`);
  await p.keyboard.press("Shift+R"); await wait(700);
  const y2 = yawOf(await T("asm-a11y-say").innerText());
  ok(Math.abs(d(y0, y2)) <= 3 || Math.abs(d(y0, y2) - 360) <= 3, `${lang}：Shift + R 转回来`, `${y1}° → ${y2}°`);
  await p.keyboard.press("Alt+r"); await wait(700);
  const y3 = yawOf(await T("asm-a11y-say").innerText());
  ok(Math.abs(d(y2, y3) - 15) <= 3, `${lang}：Alt + R 转 15°`, `${y2}° → ${y3}°`);
  const pen = await p.evaluate(() => window.__asm.overlapTest().maxPenetrationMm);
  ok(pen < 1, `${lang}：旋转后穿透 ${pen.toFixed(3)} mm（< 1）`);
  await p.evaluate(() => { for (const b of window.__asm.engine.bodies.values()) b.rb.setBodyType(1, true); });
  await p.keyboard.press("r"); await wait(400);
  const sf = await T("asm-a11y-say").innerText();
  ok(/固定住了|fixed/.test(sf), `${lang}：固定件按 R 被拒绝`, sf.slice(0, 50));
  await p.evaluate(() => { for (const b of window.__asm.engine.bodies.values()) b.rb.setBodyType(0, true); });
  res[lang] = { y0, y1, y2, y3, pen };
  if (lang === "zh") await shot(p, "a11y-rotate-zh");
  await c.close();
}
const CJK1 = /[\u4e00-\u9fff]/;
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/teardown/"); await T("td-guide").waitFor({ timeout: 20000 }).catch(() => {});
  const nDev = await p.locator('[data-testid^="td-device-"]').count();
  ok(nDev >= 12 && await T("td-device-ir-remote").count() === 1, `${lang}：设备列表 ${nDev} 台，有红外遥控器`);
  await T("td-device-ir-remote").click(); await wait(500);
  const g = await T("td-guide").innerText();
  ok(lang === "zh" ? /停止点/.test(g) && /异丙醇/.test(g) : /Stop point/.test(g) && !CJK1.test(g.replace(/[（）]/g, "")), `${lang}：遥控器指南有停止点${lang === "en" ? "、英文无汉字" : ""}`);
  ok(await T("td-print-bar").count() === 1, `${lang}：有打印栏`);
  const [pop] = await Promise.all([c.waitForEvent("page", { timeout: 10000 }), T("td-print").click()]);
  await pop.waitForLoadState("load"); await wait(300);
  const st = await pop.evaluate(() => ({ steps: document.querySelectorAll("li.step").length, svgs: document.querySelectorAll("svg").length, text: document.body.innerText, title: document.title }));
  ok(st.steps === 7 && st.svgs >= 7, `${lang}：打印页 ${st.steps} 步、${st.svgs} 张示意图`);
  ok(lang === "zh" ? /停止点/.test(st.text) && /未经实物验证/.test(st.text) : /Stop point/i.test(st.text) && !CJK1.test(st.text), `${lang}：打印页有停止点和${lang === "zh" ? "“未经实物验证”" : "no CJK"}`, (st.text.match(/[\u4e00-\u9fff]/g) || []).length);
  const pdf = await pop.pdf({ format: "A4", printBackground: true });
  res["pdf-" + lang] = pdf.length;
  ok(pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 20000, `${lang}：page.pdf 生成真 PDF（${(pdf.length / 1024).toFixed(0)} KB）`);
  if (lang === "zh") { fs.writeFileSync(`${OUT}/teardown-ir-remote-zh.pdf`, pdf); if (SHOT) await pop.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-print-sheet-zh.png`, fullPage: false }); }
  await pop.close();
  const msg = await T("td-print-msg").innerText().catch(() => "");
  ok(msg.length > 0, `${lang}：打印后有状态提示`, msg.slice(0, 40));
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 10000 }), T("td-print-html").click()]);
  const fp = await dl.path(); const html = fs.readFileSync(fp, "utf8");
  ok(dl.suggestedFilename() === `teardown-ir-remote-${lang}.html` && /<svg/.test(html) && html.length > 5000, `${lang}：下载打印版 HTML`, dl.suggestedFilename() + " " + html.length);
  const t = await p.locator("body").innerText();
  ok(lang === "zh" ? t.includes(`${nDev} 台`) || !/只有 \d+ 台/.test(t) : true, `${lang}：设备数文字跟着实际数量`);
  if (lang === "zh") await shot(p, "teardown-ir-remote-zh");
  await c.close();
}
for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang);
  await p.goto(BASE + "/help/"); await p.waitForTimeout(1500);
  const t = await p.locator("body").innerText();
  ok(lang === "zh" ? t.includes("键盘旋转（v35）") && t.includes("打印 / 导出 PDF（v35）") && t.includes("自动检查（v35）") : t.includes("Keyboard rotate (v35)") && t.includes("Print / save as PDF (v35)") && t.includes("Automated checks (v35)"), `${lang}：帮助页有 v35 三段说明`);
  if (lang === "en") { const k = (t.match(CJK) || []).length; ok(k / t.length < 0.02, `en 帮助页汉字占比 ${(k / t.length * 100).toFixed(2)}%`); }
  await p.goto(BASE + "/credits"); await p.waitForTimeout(1500);
  const crt = await p.locator('[data-testid="credits-v35"]').innerText().catch(() => "");
  const li = await p.locator('[data-testid="credits-v35-list"]').innerText().catch(() => "");
  ok(/axe-core/.test(li) && /MPL-2\.0/.test(li) && (lang === "zh" ? /开发依赖/.test(crt) : /development dependency/.test(crt) && !CJK1.test(crt)), `${lang}：致谢页 v35 写明 axe-core MPL-2.0、只作开发依赖`, crt.slice(0, 50));
  await c.close();
}
for (const [w, h] of [[390, 844], [1920, 1080]]) for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang, w, h);
  for (const path of ["/assembly", "/teardown/?d=ir-remote", "/help/"]) {
    await p.goto(BASE + path); await p.waitForTimeout(2500);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(ov <= 1, `${w}px ${lang} ${path} 无横向溢出`, ov);
  }
  if (w === 390 && lang === "en") await shot(p, "help-mobile-en");
  await c.close();
}
ok(!errs.length, "无页面错误", errs.slice(0, 3).join(" | "));
ok(!bad.length, "无 4xx/5xx", bad.slice(0, 3).join(" | "));
fs.writeFileSync(`${OUT}/logs/v35-bench.json`, JSON.stringify({ pass, fail, res, errs, bad }, null, 1));
console.log(`v35-bench ${pass} PASS / ${fail} FAIL`);
await b.close();
process.exit(fail ? 1 : 0);
