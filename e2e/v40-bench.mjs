// v40：题库列表 ready 选择器、学习路径、帮助页「本版更新」、打印目录跨页回填。
// 早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v40 SHOTS=1 node e2e/v40-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v40", SHOT = process.env.SHOTS !== "0";
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
  await p.goto(BASE + "/bank");
  await T("bank-index").waitFor({ timeout: 30000 });
  await T("bank-paths").waitFor({ timeout: 10000 });
  const paths = await T("bank-paths").innerText();
  ok(/学习路径|Learning paths/.test(paths), `${lang}：题库页有学习路径区块`, paths.slice(0, 80));
  ok(await T("bank-path-path-night-light").count(), `${lang}：有小夜灯路径`);
  ok(await T("bank-path-path-led-polarity").count(), `${lang}：有极性路径`);
  ok(await T("bank-path-path-octo-power").count(), `${lang}：有八爪鱼供电路径`);
  await T("bank-cell-diagnosis-intro").click();
  await T("bank-list-ready").waitFor({ timeout: 20000 });
  const state = await T("bank-list").getAttribute("data-state");
  const count = await T("bank-list-ready").getAttribute("data-count");
  ok(state === "ready" && Number(count) >= 1, `${lang}：诊断入门列表 data-state=ready 且有题目`, `state=${state} count=${count}`);
  const list = await T("bank-list-ready").innerText();
  ok(/dx-dead-battery-01|小夜灯完全不亮|battery first|Completely dark|cells first/i.test(list), `${lang}：就绪列表含 dx-dead-battery-01`, list.slice(0, 200));
  await shot(p, `bank-ready-${lang}`);
  await T("bank-path-path-night-light").click();
  await T("bank-path-detail").waitFor({ timeout: 10000 });
  const nSteps = Number(await T("bank-path-detail").getAttribute("data-count") || "0");
  ok(nSteps >= 3 && nSteps <= 5, `${lang}：小夜灯路径 3–5 步`, String(nSteps));
  const detail = await T("bank-path-detail").innerText();
  ok(/night-light|小夜灯|AAA/.test(detail), `${lang}：路径含拆解小夜灯`, detail.slice(0, 160));
  const href0 = await T("bank-path-link-0").getAttribute("href");
  const href1 = await T("bank-path-link-1").getAttribute("href");
  const href2 = await T("bank-path-link-2").getAttribute("href");
  ok(/\/teardown\/\?d=night-light/.test(href0 || ""), `${lang}：第 1 步链到小夜灯拆解`, href0);
  ok(/mode=diagnosis/.test(href1 || "") && /id=dx-dead-battery-01/.test(href1 || ""), `${lang}：第 2 步链到诊断题`, href1);
  ok(/\/repair\?s=led-dead-battery/.test(href2 || ""), `${lang}：第 3 步链到维修关卡`, href2);
  await shot(p, `bank-path-${lang}`);
  await p.goto(BASE + "/bank?mode=diagnosis&diff=intro&id=dx-dead-battery-01&path=path-night-light");
  await T("bank-list-ready").waitFor({ timeout: 20000 });
  await T("bank-path-nav").waitFor({ timeout: 10000 });
  const nav = await T("bank-path-nav").innerText();
  ok(/2\s*\/\s*3|step 2 of 3/.test(nav), `${lang}：练习页显示路径第 2 / 3 步`, nav);
  const next = await T("bank-path-next").getAttribute("href");
  ok(/\/repair\?s=led-dead-battery/.test(next || ""), `${lang}：下一步是维修关卡`, next);
  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/help#whats-new");
  await T("help-whats-new").waitFor({ timeout: 20000 });
  const news = await T("help-whats-new").innerText();
  ok(/v40/.test(news) && /v32/.test(news) && /v39/.test(news) && /学习路径|回填/.test(news), "帮助页「本版更新」覆盖 v32–v40", news.slice(0, 220));
  const toc = await T("help-toc").innerText();
  ok(/本版更新/.test(toc), "帮助页目录有「本版更新」");
  await shot(p, "help-whats-new-zh");
  await p.goto(BASE + "/credits#v40-paths");
  await T("credits-v40").waitFor({ timeout: 20000 });
  const cr = await T("credits-v40").innerText();
  ok(/v40/.test(cr) && /学习路径|learning path/i.test(cr), "致谢页有 v40 段落", cr.slice(0, 160));
  await shot(p, "credits-v40-zh");
  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/teardown/?d=coin-keyfob");
  await T("td-guide").waitFor({ timeout: 20000 });
  const [pop] = await Promise.all([p.context().waitForEvent("page", { timeout: 10000 }), T("td-print").click()]);
  await pop.waitForLoadState("load");
  await pop.waitForFunction(() => document.documentElement.getAttribute("data-toc-ready") === "1", null, { timeout: 15000 }).catch(() => {});
  const tocInfo = await pop.evaluate(() => ({
    ready: document.documentElement.getAttribute("data-toc-ready"),
    total: document.documentElement.getAttribute("data-toc-total"),
    hasPg: !!document.querySelector(".toc-pg[data-sec='safety']"),
    safety: document.querySelector(".toc-pg[data-sec='safety']")?.textContent,
  }));
  await pop.close();
  ok(tocInfo.ready === "1" && tocInfo.hasPg, "钥匙扣灯打印版目录已回填 data-toc-ready", JSON.stringify(tocInfo));
  ok(/第\s*2/.test(tocInfo.safety || ""), "打印版安全节仍从第 2 页起", tocInfo.safety);
  await c.close();
}

{
  for (const [w, h, label] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) {
    const { c, p } = await page("zh", w, h);
    for (const path of ["/bank", "/bank?path=path-night-light", "/help#whats-new", "/credits#v40-paths"]) {
      await p.goto(BASE + path, { waitUntil: "load", timeout: 60000 });
      await wait(path.includes("path=") ? 1200 : 800);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      ok(!overflow, `${label} ${path} 无横向溢出`, `${w}×${h}`);
    }
    if (w === 390) await p.screenshot({ path: `${OUT}/05-bank-path-mobile-zh.png` }).catch(() => {});
    await c.close();
  }
}

await b.close();
const pageErr = errs.filter((e) => !/ResizeObserver|AbortError/.test(e));
ok(pageErr.length === 0, `没有页面错误（${errs.length} 条已记录，过滤后 ${pageErr.length}）`, pageErr.slice(0, 3).join(" | "));
ok(bad.length === 0, `没有 4xx/5xx（${bad.length}）`, bad.slice(0, 3).join(" | "));
fs.writeFileSync(`${OUT}/logs/v40-bench.json`, JSON.stringify({ pass, fail, errs, bad }, null, 1));
console.log(`v40-bench ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
