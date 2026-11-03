// v36：3D 场景倾斜旋转（T / F / Shift / Alt / N，角度吸附）、第 13 台设备（电子厨房计时器）、打印版目录 + 页码 + 图例、
// 真 PDF 逐页读出页码、帮助 / 致谢页 v36 说明、手机 / 宽屏中英文无横向溢出。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v36 SHOTS=0 node e2e/v36-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v36", SHOT = process.env.SHOTS !== "0";
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
const CJK1 = /[\u4e00-\u9fff]/;
const tiltOf = (s) => { const m = s.match(/前后倾 (-?\d+)°，左右倾 (-?\d+)°/) || s.match(/tipped (-?\d+)° front-back, (-?\d+)° side/); return m ? [+m[1], +m[2]] : [0, 0]; };
const yawOf = (s) => +(s.match(/(?:turned|朝向) (-?\d+)°/) || [])[1];
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/assembly"); await p.waitForFunction(() => window.__asm, null, { timeout: 90000 }); await wait(800);
  await p.evaluate(async () => { await window.__asm.addAt("p-ext-2020-150", -8, -6); await window.__asm.addAt("p-shaft-8x100", 8, 6); });
  await wait(2000);
  const a = T("asm-a11y"), say = () => T("asm-a11y-say").innerText();
  const label = await a.getAttribute("aria-label");
  ok(lang === "zh" ? /T 前后倾/.test(label) && /F 左右倾/.test(label) && /N 摆正/.test(label) : /\bT\b.*front-back/.test(label) && /\bF\b.*sideways/.test(label) && /\bN\b/.test(label), `${lang}：键盘说明里有 T / F / N`);
  await a.focus(); await p.keyboard.press("ArrowRight"); await wait(400);
  const s0 = await say();
  ok(!/前后倾|tipped/.test(s0), `${lang}：平放时不读倾斜`, s0.slice(-30));
  await p.keyboard.press("t"); await wait(500);
  const s1 = await say(), t1 = tiltOf(s1);
  ok(Math.abs(Math.abs(t1[0]) - 90) <= 3 || /转不开|No room/.test(s1), `${lang}：T 前后倾 90°（或放不下时拒绝）`, s1.slice(-50));
  const pen1 = await p.evaluate(() => window.__asm.overlapTest().maxPenetrationMm);
  ok(pen1 < 1, `${lang}：倾斜后穿透 ${pen1.toFixed(3)} mm（< 1）`);
  await p.keyboard.press("Shift+T"); await wait(500);
  const s2 = await say(), t2 = tiltOf(s2);
  ok(Math.abs(t2[0]) <= 3, `${lang}：Shift + T 倾回来`, s2.slice(-40));
  await p.keyboard.press("Alt+f"); await wait(500);
  const s3 = await say(), t3 = tiltOf(s3);
  ok(Math.abs(Math.abs(t3[1]) - 15) <= 3, `${lang}：Alt + F 左右倾 15°`, s3.slice(-40));
  // 斜 15° 的长条件松手后会被重力放平，所以连按两次、马上读出（读的是吸附后的目标角度）
  await p.keyboard.press("Shift+Alt+f"); await p.keyboard.press("Shift+Alt+f"); await wait(60);
  const t4 = tiltOf(await say());
  ok([30, 330].includes(t4[1]), `${lang}：连按两次 Shift + Alt + F 到 30°（对齐到 15° 格）`, t4.join(","));
  await p.keyboard.press("Alt+r"); await wait(500);
  await p.keyboard.press("n"); await wait(500);
  const s5 = await say(), t5 = tiltOf(s5), y5 = yawOf(s5);
  ok(t5[0] === 0 && t5[1] === 0 && y5 % 90 === 0, `${lang}：N 摆正到 90° 格`, s5.slice(-40));
  const pen = await p.evaluate(() => window.__asm.overlapTest().maxPenetrationMm);
  ok(pen < 1, `${lang}：摆正后穿透 ${pen.toFixed(3)} mm（< 1）`);
  await p.evaluate(() => { for (const b of window.__asm.engine.bodies.values()) b.rb.setBodyType(1, true); });
  await p.keyboard.press("t"); await wait(400);
  const sf = await say();
  ok(/固定住了|fixed/.test(sf), `${lang}：固定件按 T 被拒绝`, sf.slice(0, 50));
  await p.evaluate(() => { for (const b of window.__asm.engine.bodies.values()) b.rb.setBodyType(0, true); });
  res[lang] = { t1, t2, t3, t4, t5, y5, pen1, pen };
  if (lang === "zh") { await p.keyboard.press("t"); await wait(500); await shot(p, "tilt-zh"); }
  await c.close();
}
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/teardown/"); await T("td-guide").waitFor({ timeout: 20000 }).catch(() => {});
  const nDev = await p.locator('[data-testid^="td-device-"]').count();
  ok(nDev >= 13 && await T("td-device-kitchen-timer").count() === 1, `${lang}：设备列表 ${nDev} 台，有厨房计时器`);
  await T("td-device-kitchen-timer").click(); await wait(500);
  const g = await T("td-guide").innerText();
  ok(lang === "zh" ? /停止点/.test(g) && /导电胶条/.test(g) && /AAA/.test(g) : /Stop point/.test(g) && /elastomer/i.test(g) && !CJK1.test(g.replace(/[（）]/g, "")), `${lang}：计时器指南有停止点和胶条${lang === "en" ? "、英文无汉字" : ""}`);
  const [pop] = await Promise.all([c.waitForEvent("page", { timeout: 10000 }), T("td-print").click()]);
  await pop.waitForLoadState("load"); await wait(300);
  const st = await pop.evaluate(() => {
    const links = [...document.querySelectorAll("nav.toc a[href^='#']")].map((a) => a.getAttribute("href"));
    const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("");
    return { steps: document.querySelectorAll("li.step").length, svgs: document.querySelectorAll("li.step svg").length, links: links.length, dead: links.filter((h) => !document.getElementById(h.slice(1))).length, tocSteps: document.querySelectorAll("nav.toc a[href^='#step-']").length, pageno: /counter\(page\)/.test(css) && /counter\(pages\)/.test(css), legends: document.querySelectorAll(".legend").length, text: document.body.innerText };
  });
  ok(st.steps === 7 && st.svgs === 7, `${lang}：打印页 ${st.steps} 步、每步一张图`);
  ok(st.links >= 12 && st.dead === 0 && st.tocSteps === 7, `${lang}：目录 ${st.links} 个链接、0 个死链、7 步都在目录里`, `dead ${st.dead}`);
  ok(st.pageno, `${lang}：打印样式里有页码（counter(page) / counter(pages)）`);
  ok(lang === "zh" ? /目录/.test(st.text) && /未经实物验证/.test(st.text) : /Contents/i.test(st.text) && !CJK1.test(st.text), `${lang}：打印页有目录${lang === "en" ? "、无汉字" : "和“未经实物验证”"}`);
  const pdf = await pop.pdf({ preferCSSPageSize: true, printBackground: true });
  const fp = `${OUT}/teardown-kitchen-timer-${lang}.pdf`; fs.writeFileSync(fp, pdf);
  const txt = execFileSync("pdftotext", ["-layout", fp, "-"]).toString().normalize("NFKC").replace(/\s+/g, "");
  const pages = (txt.match(/\f/g) || []).length;
  ok(lang === "zh" ? /第1页\/共\d+页/.test(txt) : /Page1of\d+/.test(txt), `${lang}：PDF 里读出第 1 页页码（${(pdf.length / 1024).toFixed(0)} KB）`);
  res["pdf-" + lang] = { kb: Math.round(pdf.length / 1024), legends: st.legends };
  if (lang === "zh" && SHOT) await pop.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-print-toc-zh.png` });
  await pop.close();
  let legends = 0, legendOk = true;
  for (const id of ["micro-servo", "powerbank-18650", "bt-speaker", "kitchen-scale", "ir-remote", "kitchen-timer"]) {
    if (!(await T(`td-device-${id}`).count())) continue;
    await T(`td-device-${id}`).click(); await wait(300);
    const L = await T("td-fig-legend").allInnerTexts(); legends += L.length;
    if (L.some((s) => !/\d+\s*=\s*\S/.test(s))) legendOk = false;
  }
  ok(legendOk, `${lang}：示意图编号对照格式正确（${legends} 处）`);
  res["legend-" + lang] = legends;
  if (lang === "zh") await shot(p, "teardown-kitchen-timer-zh");
  await c.close();
}
for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang);
  await p.goto(BASE + "/help/"); await p.waitForTimeout(1500);
  const t = await p.locator("body").innerText();
  ok(lang === "zh" ? t.includes("倾斜旋转（v36）") && t.includes("打印版目录和页码（v36）") && t.includes("自动检查（v36）") : t.includes("Tilt rotate (v36)") && t.includes("Print contents and page numbers (v36)") && t.includes("Automated checks (v36)"), `${lang}：帮助页有 v36 三段说明`);
  if (lang === "en") { const k = (t.match(/[\u4e00-\u9fff]/g) || []).length; ok(k / t.length < 0.02, `en 帮助页汉字占比 ${(k / t.length * 100).toFixed(2)}%`); }
  await p.goto(BASE + "/credits"); await p.waitForTimeout(1500);
  const crt = await p.locator('[data-testid="credits-v36"]').innerText().catch(() => "");
  const li = await p.locator('[data-testid="credits-v36-list"]').innerText().catch(() => "");
  ok(/pdftotext/.test(li) && /GPL-2\.0/.test(li) && (lang === "zh" ? /未经实物验证/.test(crt) : /not verified/.test(crt) && !CJK1.test(crt)), `${lang}：致谢页 v36 写明 pdftotext GPL-2.0、只在测试里用`, crt.slice(0, 50));
  await c.close();
}
for (const [w, h] of [[390, 844], [1920, 1080]]) for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang, w, h);
  for (const path of ["/assembly", "/teardown/?d=kitchen-timer", "/help/", "/credits"]) {
    await p.goto(BASE + path); await p.waitForTimeout(2500);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(ov <= 1, `${w}px ${lang} ${path} 无横向溢出`, ov);
  }
  if (w === 390 && lang === "zh") await shot(p, "credits-mobile-zh");
  await c.close();
}
ok(!errs.length, "无页面错误", errs.slice(0, 3).join(" | "));
ok(!bad.length, "无 4xx/5xx", bad.slice(0, 3).join(" | "));
fs.writeFileSync(`${OUT}/logs/v36-bench.json`, JSON.stringify({ pass, fail, res, errs, bad }, null, 1));
console.log(`v36-bench ${pass} PASS / ${fail} FAIL`);
await b.close();
process.exit(fail ? 1 : 0);
