// v45：路径末尾测验（键盘、存储、重做）、自学记录打印页（浅色、非正式证书），以及帮助 / 致谢。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v45 SHOTS=1 node e2e/v45-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v45", SHOT = process.env.SHOTS !== "0";
fs.mkdirSync(`${OUT}/logs`, { recursive: true });
if (SHOT) fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errs = [];
const page = async ({ lang = "zh", w = 1440, h = 900, theme = "light" } = {}) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme === "dark" ? "dark" : "light" });
  await c.addInitScript(([l, theme]) => {
    try {
      localStorage.setItem("asm-tour-v22-done", "1");
      localStorage.setItem("ui-lang", l);
      localStorage.setItem("wb-theme-v1", theme === "dark" ? "dark" : "light");
    } catch { /* */ }
  }, [lang, theme]);
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  return { c, p, T: (t) => p.locator(`[data-testid="${t}"]`) };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hexOf = async (p, sel) => p.evaluate((s) => {
  const el = s ? document.querySelector(s) : document.body;
  const cs = getComputedStyle(el);
  const c = cs.backgroundColor;
  const m = String(c).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!m) return c;
  const h = (n) => Number(n).toString(16).padStart(2, "0");
  return `#${h(+m[1])}${h(+m[2])}${h(+m[3])}`;
}, sel);

async function finishPath(T, n) {
  for (let i = 0; i < n; i++) {
    const btn = T(`bank-path-done-${i}`);
    if (!(await btn.count())) continue;
    if ((await btn.getAttribute("aria-pressed")) !== "true") {
      await btn.click();
      await wait(200);
    }
  }
}

const ANSWERS = { "nl-first": "b", "nl-cells": "b", "nl-stop": "b", "nl-sim": "b" };

// —— 帮助 / 致谢（中英文）——
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page({ lang, theme: "light" });
  await p.goto(BASE + "/help#whats-new", { waitUntil: "load", timeout: 60000 });
  await T("help-whats-new").waitFor({ timeout: 20000 });
  const news = await T("help-whats-new").innerText();
  const start = await T("help-whats-new").getAttribute("start");
  ok(+start === 45, `${lang}：本版更新起号为 45`, start);
  ok(/v45/.test(news) && /v41/.test(news), `${lang}：本版更新含 v45 和 v41`, news.slice(0, 180));
  ok(!/v40：/.test(news) && !/v32：/.test(news), `${lang}：本版更新不再列出 v32–v40`);
  ok(/测验|quiz|自学记录|self-study/i.test(news), `${lang}：v45 摘要提到测验和自学记录`);
  await p.goto(BASE + "/credits#v45-quiz");
  await T("credits-v45").waitFor({ timeout: 20000 });
  const cr = await T("credits-v45").innerText();
  ok(/v45/.test(cr) && /没有增加新的第三方|no new third-party/i.test(cr), `${lang}：致谢页有 v45 段落`, cr.slice(0, 160));
  await c.close();
}

// —— 测验锁定、作答、存储、重做、记录打印（中英文）——
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page({ lang, w: 1440, theme: "light" });
  await p.goto(BASE + "/bank?path=path-night-light", { waitUntil: "load", timeout: 60000 });
  await T("bank-path-detail").waitFor({ timeout: 20000 });
  await T("bank-path-quiz").waitFor({ timeout: 10000 });
  ok((await T("bank-path-quiz").getAttribute("data-complete")) === "0", `${lang}：未完成步骤时测验未解锁`);
  ok(await T("bank-path-quiz-locked").count(), `${lang}：有先完成步骤的提示`);
  ok(await T("bank-path-quiz-submit").isDisabled(), `${lang}：未完成时不能提交`);

  await finishPath(T, 3);
  await wait(300);
  ok((await T("bank-path-quiz").getAttribute("data-complete")) === "1", `${lang}：完成步骤后测验解锁`);

  // 键盘：焦点落到第一题的选项
  await T("bank-path-quiz-opt-nl-first-a").focus();
  await p.keyboard.press("ArrowDown");
  await wait(100);
  const focused = await p.evaluate(() => document.activeElement?.getAttribute("data-testid") || document.activeElement?.id || "");
  ok(/nl-first/.test(focused), `${lang}：方向键可在选项间移动`, focused);

  for (const [q, o] of Object.entries(ANSWERS)) {
    await T(`bank-path-quiz-opt-${q}-${o}`).click();
  }
  await T("bank-path-quiz-submit").click();
  await T("bank-path-quiz-result").waitFor({ timeout: 8000 });
  ok((await T("bank-path-quiz-result").getAttribute("data-correct")) === "4", `${lang}：全对成绩为 4`, await T("bank-path-quiz-result").innerText());
  ok(await T("bank-path-quiz-explain-nl-first-a").count(), `${lang}：提交后显示选项说明`);
  const stored = await p.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("wb-path-progress-v1") || "{}"); } catch { return {}; }
  });
  ok(stored.v === 1 && stored.paths?.["path-night-light"]?.quiz?.correct === 4, `${lang}：成绩写入 wb-path-progress-v1`);

  await T("bank-path-quiz-retry").click();
  await wait(200);
  ok((await T("bank-path-quiz").getAttribute("data-submitted")) === "0", `${lang}：可重做测验`);
  // 重做期间上次成绩仍在存储里，直到再次提交
  const mid = await p.evaluate(() => JSON.parse(localStorage.getItem("wb-path-progress-v1") || "{}"));
  ok(mid.paths?.["path-night-light"]?.quiz?.correct === 4, `${lang}：重做未提交前仍保留上次成绩`);
  await T("bank-path-quiz-opt-nl-first-a").click();
  for (const [q, o] of Object.entries(ANSWERS)) {
    if (q === "nl-first") continue;
    await T(`bank-path-quiz-opt-${q}-${o}`).click();
  }
  await T("bank-path-quiz-submit").click();
  await T("bank-path-quiz-result").waitFor({ timeout: 8000 });
  ok((await T("bank-path-quiz-result").getAttribute("data-correct")) === "3", `${lang}：重做后成绩更新为 3`);

  await T("bank-path-record-name").fill(lang === "en" ? "Alex Lee" : "李七");
  await T("bank-path-record-name").blur();
  await wait(200);
  const named = await p.evaluate(() => JSON.parse(localStorage.getItem("wb-path-progress-v1") || "{}"));
  ok((named.paths?.["path-night-light"]?.name || "") === (lang === "en" ? "Alex Lee" : "李七"), `${lang}：姓名只写入本机进度`);

  const popP = c.waitForEvent("page", { timeout: 10000 });
  await T("bank-path-record-print").click();
  const pop = await popP;
  await pop.waitForLoadState("domcontentloaded");
  const rec = await pop.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    scheme: document.documentElement.getAttribute("data-record"),
    bg: getComputedStyle(document.body).backgroundColor,
    text: document.body.innerText,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
  }));
  ok(rec.theme === "light" && rec.scheme === "1", `${lang}：打印页标记为浅色自学记录`, rec.theme);
  const bg = rec.bg;
  const lightish = /rgb\(\s*(255|244|247|239|231)/.test(bg) || /#ffffff|#f4f7fb|#f7f3ea|#efe6d6|#e7dfd0/i.test(bg);
  ok(lightish || /255|244|247|239|231/.test(bg), `${lang}：打印页背景为浅色`, bg);
  const tx = rec.text;
  ok(/自学记录|Self-study record/.test(tx) && /不是正式证书|not an official certificate/i.test(tx), `${lang}：打印页标明非正式证书`);
  ok(tx.includes(lang === "en" ? "Alex Lee" : "李七"), `${lang}：打印页有姓名`);
  ok(/3\s*\/\s*4|3 of 4/.test(tx), `${lang}：打印页有测验成绩`);
  if (SHOT) {
    await pop.setViewportSize({ width: 900, height: 1200 });
    await pop.screenshot({ path: `${OUT}/screenshots/record-${lang}-print.png`, fullPage: true });
  }
  await pop.close();
  await c.close();
}

// —— 截图：测验 + 记录，浅色/深色，1920/390 ——
if (SHOT) {
  for (const theme of ["light", "dark"]) {
    for (const w of [1920, 390]) {
      const { c, p, T } = await page({ lang: "zh", w, h: w === 390 ? 844 : 1080, theme });
      await p.goto(BASE + "/bank?path=path-night-light", { waitUntil: "load", timeout: 60000 });
      await T("bank-path-detail").waitFor({ timeout: 20000 });
      await finishPath(T, 3);
      for (const [q, o] of Object.entries(ANSWERS)) await T(`bank-path-quiz-opt-${q}-${o}`).click();
      await T("bank-path-quiz-submit").click();
      await T("bank-path-quiz-result").waitFor({ timeout: 8000 });
      const resolved = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
      ok(resolved === theme, `截图前 quiz ${theme} ${w} 主题正确`, resolved);
      await T("bank-path-quiz").scrollIntoViewIfNeeded();
      await T("bank-path-quiz").screenshot({ path: `${OUT}/screenshots/quiz-zh-${theme}-${w}.png` });
      await T("bank-path-record-name").fill("李七");
      await T("bank-path-record").scrollIntoViewIfNeeded();
      await T("bank-path-record").screenshot({ path: `${OUT}/screenshots/record-form-zh-${theme}-${w}.png` });
      await c.close();
    }
  }
  // 深色应用下打开的打印页仍应是浅色
  const { c, p, T } = await page({ lang: "zh", w: 1440, theme: "dark" });
  await p.goto(BASE + "/bank?path=path-night-light", { waitUntil: "load", timeout: 60000 });
  await T("bank-path-detail").waitFor({ timeout: 20000 });
  await finishPath(T, 3);
  for (const [q, o] of Object.entries(ANSWERS)) await T(`bank-path-quiz-opt-${q}-${o}`).click();
  if ((await T("bank-path-quiz").getAttribute("data-submitted")) !== "1") {
    await T("bank-path-quiz-submit").click();
    await T("bank-path-quiz-result").waitFor({ timeout: 8000 });
  }
  await T("bank-path-record-name").fill("李七");
  const popP = c.waitForEvent("page", { timeout: 10000 });
  await T("bank-path-record-print").click();
  const pop = await popP;
  await pop.waitForLoadState("domcontentloaded");
  const paper = await hexOf(pop, "body");
  ok(/^#ffffff$/i.test(paper) || /^#f4f7fb$/i.test(paper), "深色应用下打印页仍为浅纸色", paper);
  await pop.screenshot({ path: `${OUT}/screenshots/record-print-from-dark.png`, fullPage: true });
  await pop.close();
  await c.close();
}

await b.close();
if (errs.length) {
  console.log("page errors:", errs.slice(0, 8).join(" | "));
}
fs.writeFileSync(`${OUT}/logs/v45-bench.json`, JSON.stringify({ pass, fail, errs }, null, 2));
console.log(`v45-bench ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
