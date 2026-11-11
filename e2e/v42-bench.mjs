// v42：学习路径进度、题目与路径互链、新充电宝路径。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v42 SHOTS=1 node e2e/v42-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v42", SHOT = process.env.SHOTS !== "0";
fs.mkdirSync(`${OUT}/logs`, { recursive: true });
let pass = 0, fail = 0, n = 0;
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errs = [], bad = [];
const page = async (lang, w = 1440, h = 900) => {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  await c.addInitScript((l) => {
    try {
      localStorage.setItem("asm-tour-v22-done", "1");
      localStorage.setItem("ui-lang", l);
      localStorage.removeItem("wb-path-progress-v1");
    } catch { /* */ }
  }, lang);
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  p.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && !/favicon/.test(u)) bad.push(r.status() + " " + u.replace(/^https?:\/\/[^/]+/, "")); });
  return { c, p, T: (t) => p.locator(`[data-testid="${t}"]`) };
};
const shot = async (p, s) => { if (SHOT) await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${s}.png` }); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/bank", { waitUntil: "load", timeout: 60000 });
  await T("bank-paths").waitFor({ timeout: 20000 });
  const paths = await T("bank-paths").innerText();
  ok(/学习路径|Learning paths/.test(paths), `${lang}：题库页有学习路径`, paths.slice(0, 80));
  ok(await T("bank-path-path-night-light").count(), `${lang}：仍有小夜灯路径`);
  ok(await T("bank-path-path-powerbank-hot").count(), `${lang}：有充电宝新路径`);
  const bar = T("bank-path-progress-path-powerbank-hot");
  await bar.waitFor({ timeout: 10000 });
  ok(await bar.getAttribute("role") === "progressbar", `${lang}：进度条有 role=progressbar`);
  ok(await bar.getAttribute("aria-valuemin") === "0", `${lang}：进度条 aria-valuemin=0`);
  ok(await bar.getAttribute("aria-valuemax") === "3", `${lang}：充电宝路径 3 步`, String(await bar.getAttribute("aria-valuemax")));
  ok(await bar.getAttribute("aria-valuenow") === "0", `${lang}：初始进度为 0`);
  const label = await bar.getAttribute("aria-label");
  ok(lang === "en" ? /3/.test(label || "") && /progress|steps/i.test(label || "") : /3/.test(label || "") && /进度|步/.test(label || ""), `${lang}：进度条 aria-label`, label);

  await T("bank-path-path-powerbank-hot").click();
  await T("bank-path-detail").waitFor({ timeout: 10000 });
  ok((await T("bank-path-detail").getAttribute("data-path")) === "path-powerbank-hot", `${lang}：打开充电宝路径详情`);
  ok((await T("bank-path-detail").getAttribute("data-count")) === "3", `${lang}：详情为 3 步`);
  const detail = await T("bank-path-detail").innerText();
  ok(/未经实物验证|not verified on hardware/i.test(detail), `${lang}：新路径注明未经实物验证`, detail.slice(0, 80));
  ok(await T("bank-path-related-0").count(), `${lang}：拆解步骤链回相关题目`);
  const rel = T("bank-related-dx-psu-bridge-01").first();
  ok(await rel.count(), `${lang}：相关题包含短路诊断`);
  const resume = T("bank-path-resume-path-powerbank-hot");
  ok(await resume.count(), `${lang}：卡片上有继续/开始按钮`);
  await shot(p, `bank-path-${lang}`);
  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/bank?mode=diagnosis&diff=intermediate&id=dx-psu-bridge-01", { waitUntil: "load", timeout: 60000 });
  await T("bank-list-ready").waitFor({ timeout: 20000 });
  await T("bank-practice").waitFor({ timeout: 20000 });
  await T("bank-item-paths-dx-psu-bridge-01").waitFor({ timeout: 10000 });
  const link = T("bank-item-path-path-powerbank-hot").first();
  ok(await link.count(), "有映射的题目链到充电宝路径步骤");
  const href = await link.getAttribute("href");
  ok(/path=path-powerbank-hot/.test(href || "") && /dx-psu-bridge-01/.test(href || ""), "题目上的路径链接带 path 和题号", href);
  await shot(p, "bank-item-path-zh");

  await p.goto(BASE + "/bank?mode=firmware&diff=intro&id=fw-btn-led-01", { waitUntil: "load", timeout: 60000 });
  await T("bank-list-ready").waitFor({ timeout: 20000 });
  await T("bank-practice").waitFor({ timeout: 20000 });
  ok((await T("bank-item-paths-fw-btn-led-01").count()) === 0, "对不上的题目不显示路径链接");
  ok((await T("bank-item-path-flag-fw-btn-led-01").count()) === 0, "对不上的题目列表里也没有路径标记");
  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/bank?path=path-powerbank-hot", { waitUntil: "load", timeout: 60000 });
  await T("bank-path-detail").waitFor({ timeout: 20000 });
  await T("bank-path-done-0").click();
  await wait(200);
  const bar = T("bank-path-detail-progress");
  ok(await bar.getAttribute("aria-valuenow") === "1", "标记第 1 步后进度为 1", String(await bar.getAttribute("aria-valuenow")));
  ok((await T("bank-path-step-0").getAttribute("data-done")) === "1", "该步标为已完成");
  const resumeHref = await T("bank-path-detail-resume").getAttribute("href");
  ok(/dx-psu-bridge-01/.test(resumeHref || ""), "继续学习指向下一步诊断题", resumeHref);
  await shot(p, "bank-progress-zh");

  let asked = 0, lastMsg = "";
  p.once("dialog", async (d) => { asked++; lastMsg = d.message(); await d.dismiss(); });
  await T("bank-path-detail-reset").click();
  await wait(300);
  ok(asked === 1 && /清除|进度/.test(lastMsg), "重置会弹出确认", lastMsg);
  ok(await bar.getAttribute("aria-valuenow") === "1", "取消确认后进度仍为 1");

  p.once("dialog", async (d) => { await d.accept(); });
  await T("bank-path-detail-reset").click();
  await wait(300);
  ok(await bar.getAttribute("aria-valuenow") === "0", "确认重置后进度回到 0", String(await bar.getAttribute("aria-valuenow")));

  // 做对诊断题应记入进度（即使从目录打开、不带 path 参数）
  await p.goto(BASE + "/bank?mode=diagnosis&diff=intermediate&id=dx-psu-bridge-01", { waitUntil: "load", timeout: 60000 });
  await T("bank-quiz").waitFor({ timeout: 20000 });
  await T("bank-opt-q1-a").click();
  await T("bank-run").click();
  await T("bank-result").waitFor({ timeout: 10000 });
  ok((await T("bank-result").getAttribute("data-pass")) === "1", "诊断题作答通过");
  await p.goto(BASE + "/bank?path=path-powerbank-hot");
  await T("bank-path-detail").waitFor({ timeout: 20000 });
  ok(await T("bank-path-detail-progress").getAttribute("aria-valuenow") === "1", "通过题目后对应路径步骤记为完成");

  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/teardown/?d=powerbank-18650&path=path-powerbank-hot", { waitUntil: "load", timeout: 60000 });
  await T("path-follow-banner").waitFor({ timeout: 20000 });
  ok((await T("path-follow-banner").getAttribute("data-path")) === "path-powerbank-hot", "拆解页显示路径横条");
  await T("bank-path-done-0").click();
  await wait(200);
  ok(await T("path-follow-progress").getAttribute("aria-valuenow") === "1", "在拆解页可标记该步完成");
  await shot(p, "teardown-path-zh");
  await c.close();
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/help#whats-new", { waitUntil: "load", timeout: 60000 });
  await T("help-whats-new").waitFor({ timeout: 20000 });
  const news = await T("help-whats-new").innerText();
  ok(/v42/.test(news) && /v41/.test(news) && /v32/.test(news), "帮助页「本版更新」含 v42", news.slice(0, 200));
  ok((await T("help-whats-new").getAttribute("start")) === "42", "本版更新列表从 42 起号");
  await shot(p, "help-whats-new-zh");
  await p.goto(BASE + "/credits#v42-paths");
  await T("credits-v42").waitFor({ timeout: 20000 });
  const cr = await T("credits-v42").innerText();
  ok(/v42/.test(cr) && /进度|progress/i.test(cr), "致谢页有 v42 段落", cr.slice(0, 160));
  await shot(p, "credits-v42-zh");
  await c.close();
}

ok(errs.length === 0, "没有页面脚本错误", errs.slice(0, 3).join(" | "));
ok(bad.length === 0, "没有 4xx/5xx", bad.slice(0, 3).join(" | "));
await b.close();
console.log(`v42-bench ${pass}/${fail}`);
process.exit(fail ? 1 : 0);
