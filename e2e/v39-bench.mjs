// v39：题库 50 题、hash 稳定不在浏览器测、新诊断题跳维修关卡、钥匙扣灯拆解、
// 打印目录页码、帮助 / 致谢 v39、中英文题库和拆解页无横向溢出。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v39 SHOTS=1 node e2e/v39-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { readFileSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v39", SHOT = process.env.SHOTS !== "0";
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

for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  const fetched = [];
  p.on("response", (r) => { const u = r.url(); if (/\/bank\//.test(u)) fetched.push(`${r.request().resourceType()} ${r.status()} ${u.replace(/^https?:\/\/[^/]+/, "")}`); });
  await p.goto(BASE + "/bank");
  await T("bank-index").waitFor({ timeout: 30000 });
  await wait(400);
  const total = await T("bank-total").innerText();
  ok(/50/.test(total) || /共 50/.test(total), `${lang}：目录显示 50 题`, total);
  const groupJson = fetched.filter((x) => /bank\/(firmware|workbench|assembly|diagnosis|code-check)\//.test(x));
  ok(fetched.some((x) => /bank\/index\.json/.test(x)) && groupJson.length === 0, `${lang}：首屏只加载 index.json`, fetched.join(" | "));
  await shot(p, `bank-index-${lang}`);
  await T("bank-cell-diagnosis-intro").click();
  await T("bank-list-ready").waitFor({ timeout: 20000 });
  const list = await T("bank-list-ready").innerText();
  ok(/dx-dead-battery-01|小夜灯完全不亮|battery first/i.test(list), `${lang}：诊断入门列出新题 dx-dead-battery-01`, list.slice(0, 200));
  await p.goto(BASE + "/bank?mode=diagnosis&diff=intro&id=dx-dead-battery-01");
  await T("bank-quiz").waitFor({ timeout: 20000 });
  await T("bank-opt-q1-b").click();
  await T("bank-run").click();
  await T("bank-result").waitFor({ timeout: 8000 });
  const href = await T("bank-repair-link").getAttribute("href");
  ok(/\/repair\?s=led-dead-battery/.test(href || ""), `${lang}：新诊断题跳到 led-dead-battery`, href);
  await shot(p, `bank-dx-battery-${lang}`);
  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/teardown/");
  await T("teardown-page").waitFor({ timeout: 30000 });
  await T("td-search").fill("钥匙扣");
  await wait(600);
  const cards = await p.locator("[data-testid^=td-device-]").allTextContents();
  ok(cards.some((t) => /钥匙扣|keychain|keyfob|CR2032/i.test(t)), "搜索“钥匙扣”能找到新设备", cards.join(" | ").slice(0, 200));
  await p.goto(BASE + "/teardown/?d=coin-keyfob");
  await T("td-guide").waitFor({ timeout: 20000 });
  const body = await T("td-guide").innerText();
  ok(/CR2032/.test(body) && /未经实物验证|按公开资料整理/.test(body), "钥匙扣灯指南标明按公开资料整理、未经实物验证");
  ok(/停止点/.test(body), "钥匙扣灯指南有停止点");
  await shot(p, "teardown-keyfob-zh");
  const [pop] = await Promise.all([p.context().waitForEvent("page", { timeout: 10000 }), T("td-print").click()]);
  await pop.waitForLoadState("load");
  const html = await pop.content();
  await pop.close();
  ok(/toc-pg/.test(html) && /第 2 页/.test(html) && /第 4 页/.test(html), "打印版目录写有页码（第 2 页、第 4 页）");
  ok(/toc-front/.test(html), "打印版封面和目录包在 toc-front 里以便强制分页");
  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/help");
  await T("help-page").waitFor({ timeout: 20000 });
  const limits = await T("help-limits").innerText();
  ok(/v39/.test(limits) && /contentHash|题面/.test(limits), "帮助页 LIMITS 写了 v39", limits.slice(-200));
  await p.goto(BASE + "/credits#v39-fresh");
  await T("credits-v39").waitFor({ timeout: 20000 });
  const cr = await T("credits-v39").innerText();
  ok(/v39/.test(cr) && /CR2032|钥匙扣/.test(cr), "致谢页有 v39 段落", cr.slice(0, 160));
  await shot(p, "credits-v39-zh");
  await c.close();
}

{
  // 手机宽度和超宽：题库、钥匙扣灯页没有横向溢出
  for (const [w, h, label] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) {
    const { c, p } = await page("zh", w, h);
    for (const path of ["/bank", "/teardown/?d=coin-keyfob", "/help", "/credits"]) {
      await p.goto(BASE + path, { waitUntil: "load", timeout: 60000 });
      await wait(path.includes("teardown") ? 1500 : 800);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      ok(!overflow, `${label} ${path} 无横向溢出`, `${w}×${h}`);
    }
    if (w === 390) await p.screenshot({ path: `${OUT}/05-bank-mobile-zh.png` }).catch(() => {});
    await c.close();
  }
}

await b.close();
const pageErr = errs.filter((e) => !/ResizeObserver|AbortError/.test(e));
ok(pageErr.length === 0, `没有页面错误（${errs.length} 条已记录，过滤后 ${pageErr.length}）`, pageErr.slice(0, 3).join(" | "));
ok(bad.length === 0, `没有 4xx/5xx（${bad.length}）`, bad.slice(0, 3).join(" | "));
fs.writeFileSync(`${OUT}/logs/v39-bench.json`, JSON.stringify({ pass, fail, errs, bad }, null, 1));
console.log(`v39-bench ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
