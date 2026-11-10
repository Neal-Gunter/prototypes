// v38：题库页按需加载、黄标 / 过期提示、固件时序、代码检查、诊断跳转维修关卡、帮助 / 致谢、
// 手机 / 宽屏中英文无横向溢出。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v38 SHOTS=1 node e2e/v38-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v38", SHOT = process.env.SHOTS !== "0";
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
const CJK1 = /[\u4e00-\u9fff]/;
const BLINK = "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(500);digitalWrite(LED_BUILTIN,LOW);delay(500);}";
const TPL = readFileSync(new URL("../data/seeds/reference/cc-cpp-tpl-ring-01.cpp", import.meta.url), "utf8");

for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  const fetched = [];
  p.on("response", (r) => { const u = r.url(); if (/\/bank\//.test(u)) fetched.push(`${r.request().resourceType()} ${r.status()} ${u.replace(/^https?:\/\/[^/]+/, "")}`); });
  await p.goto(BASE + "/bank");
  await T("bank-index").waitFor({ timeout: 30000 });
  await wait(400);
  const total = await T("bank-total").innerText();
  ok(/\b3[0-9]\b|\b[4-9]\d\b/.test(total) || /38|共/.test(total), `${lang}：目录显示总题数`, total);
  // 首屏不应先把某一组 json 拉齐（只拉 index.json）
  const groupJson = fetched.filter((x) => /bank\/(firmware|workbench|assembly|diagnosis|code-check)\//.test(x));
  ok(fetched.some((x) => /bank\/index\.json/.test(x)) && groupJson.length === 0, `${lang}：首屏只加载 index.json`, fetched.join(" | "));
  const soon = T("bank-cell-firmware-intermediate");
  ok((await soon.getAttribute("data-freshness")) === "soon", `${lang}：firmware/intermediate 黄标（即将过期）`);
  const stale = T("bank-cell-code-check-intro");
  ok((await stale.getAttribute("data-freshness")) === "stale", `${lang}：code-check/intro 标为已过期`);
  if (lang === "zh") await shot(p, "bank-index-zh");
  await soon.click();
  await T("bank-list-ready").waitFor({ timeout: 20000 });
  await wait(300);
  ok(fetched.some((x) => /bank\/firmware\/intermediate\.json/.test(x)), `${lang}：点进一组后才加载对应 JSON`);
  await c.close();
}

for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/bank?mode=firmware&diff=intro&id=fw-led-blink-01");
  await T("bank-practice").waitFor({ timeout: 30000 });
  const title = await p.locator('[data-testid="bank-practice"] h2').innerText();
  ok(lang === "zh" ? /闪烁/.test(title) : /Blink/i.test(title) && !CJK1.test(title), `${lang}：深链打开闪烁题`, title);
  await T("bank-editor").fill(BLINK);
  await T("bank-run").click();
  await T("bank-result").waitFor({ timeout: 10000 });
  ok((await T("bank-result").getAttribute("data-pass")) === "1", `${lang}：参考固件通过时序检查`);
  if (lang === "zh") await shot(p, "bank-firmware-zh");
  await c.close();
}

for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/bank?mode=code-check&diff=advanced&id=cc-cpp-tpl-ring-01");
  await T("bank-practice").waitFor({ timeout: 30000 });
  await T("bank-editor").fill(TPL);
  await T("bank-run").click();
  await T("bank-result").waitFor({ timeout: 10000 });
  ok((await T("bank-result").getAttribute("data-pass")) === "1", `${lang}：模板类 RingBuffer（含 >>）通过结构检查`);
  if (lang === "zh") await shot(p, "bank-template-zh");
  await c.close();
}

for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/bank?mode=diagnosis&diff=intro&id=dx-reverse-01");
  await T("bank-quiz").waitFor({ timeout: 30000 });
  await T("bank-opt-q1-b").click();
  await T("bank-run").click();
  await T("bank-result").waitFor({ timeout: 5000 });
  ok((await T("bank-result").getAttribute("data-pass")) === "1", `${lang}：诊断题选对通过`);
  const href = await T("bank-repair-link").getAttribute("href");
  ok(/\/repair\?s=led-reversed/.test(href || ""), `${lang}：诊断题链到维修关卡 led-reversed`, href);
  if (lang === "zh") await shot(p, "bank-diagnosis-zh");
  await c.close();
}

for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/help/");
  await p.waitForTimeout(1200);
  const t = await p.locator("body").innerText();
  ok(lang === "zh" ? t.includes("题库（v38）") : t.includes("Problem bank (v38)"), `${lang}：帮助页有题库说明`);
  await p.goto(BASE + "/credits");
  await p.waitForTimeout(1200);
  const crt = await T("credits-v38").innerText();
  const li = await T("credits-v38-list").innerText();
  ok(/fromthetransistor/.test(li) && /awesome-electronics/.test(li) && /tree-sitter/.test(li) && /NASA/.test(li + crt), `${lang}：致谢页写明出处`, crt.slice(0, 40));
  ok(lang === "zh" ? /不复制|自己写/.test(crt) : /original|not copied|own words/i.test(crt) && !CJK1.test(crt), `${lang}：致谢页 v38 中英文手写`);
  await c.close();
}

for (const [w, h] of [[390, 844], [1920, 1080]]) for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang, w, h);
  for (const path of ["/bank", "/bank?mode=firmware&diff=intro&id=fw-led-blink-01", "/help/", "/credits"]) {
    await p.goto(BASE + path);
    await wait(path.startsWith("/bank") ? 1500 : 800);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(ov <= 1, `${w}px ${lang} ${path} 无横向溢出`, ov);
  }
  if (w === 390 && lang === "zh") await shot(p, "bank-mobile-zh");
  await c.close();
}

ok(!errs.length, "无页面错误", errs.slice(0, 3).join(" | "));
ok(!bad.length, "无 4xx/5xx", bad.slice(0, 3).join(" | "));
fs.writeFileSync(`${OUT}/logs/v38-bench.json`, JSON.stringify({ pass, fail, errs, bad }, null, 1));
console.log(`v38-bench ${pass} PASS / ${fail} FAIL`);
await b.close();
process.exit(fail ? 1 : 0);
