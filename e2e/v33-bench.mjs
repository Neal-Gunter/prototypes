// v33：AA 电池玩具小车（新低压设备，3 V）、爆炸图说明中英文、帮助页“落地限速”说明、手机 / 宽屏中英文。早期原型，简化仿真。
// 物理部分（同帧放置重叠预检、下落限速、拖动推挤）在 Node 里测：e2e/peak-bench.mjs、e2e/hull-bench.mjs、e2e/engine-node.mjs。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v33 SHOTS=0 node e2e/v33-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v33", SHOT = process.env.SHOTS !== "0";
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
const CJK = /[\u4e00-\u9fff]/g;
const ID = "aa-toy-car";
{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/teardown/"); await T("teardown-page").waitFor({ timeout: 30000 });
  const nDev = await p.locator('[data-testid^="td-device-"]').count();
  ok(nDev >= 11, `设备列表 ${nDev} 台（v29 3 + v30 3 + v31 2 + v32 2 + v33 1）`);
  const volts = (await p.locator('[data-testid^="td-device-"]').evaluateAll((a) => a.map((x) => x.innerText))).map((t) => +(t.match(/([\d.]+) V 直流/) || [])[1]);
  ok(volts.length >= 11 && volts.every((v) => v > 0 && v <= 24), "每台设备都显示电压且 ≤ 24 V 直流", volts.join());
  for (const q of ["玩具车", "toy car", "齿轮箱"]) {
    await T("td-search").fill(q); await p.waitForTimeout(150);
    const ids = await p.locator('[data-testid^="td-device-"]').evaluateAll((a) => a.map((x) => x.dataset.testid.slice(10)));
    ok(ids.includes(ID), `搜索 “${q}” 找到 ${ID}`, ids.join());
  }
  await T("td-search").fill("");
  await p.goto(BASE + "/teardown/?d=" + ID); await T("td-guide").waitFor({ timeout: 20000 });
  const steps = await T("td-step").count(), figs = await p.locator('[data-testid="td-step"] [data-testid="td-fig"]').count(), stops = await T("td-stop").count();
  const unv = await p.locator('[data-testid="td-step"]').evaluateAll((a) => a.filter((x) => x.innerText.includes("按公开资料整理，未经实物验证")).length);
  const safety = await T("td-safety").innerText();
  res[ID] = { steps, figs, stops, unv };
  ok(steps >= 6 && figs === steps && unv === steps && stops >= 1, `${ID}：${steps} 步 / ${figs} 张自绘插图 / ${unv} 步标“未经实物验证” / 停止点 ${stops}`);
  ok(safety.includes("只收低压直流设备") && safety.includes("电池先处理"), `${ID}：安全须知含低压规则和“电池先处理”`);
  ok(/3 V 直流/.test(await T("teardown-page").innerText()), `${ID}：显示 3 V 直流`);
  await T("td-steps").scrollIntoViewIfNeeded(); await shot(p, "toy-car-steps-zh");
  await T("td-explode-note").waitFor({ timeout: 30000 }).catch(() => {});
  await p.waitForFunction(() => /(\d+)\/\1 个模块已加载/.test(document.querySelector('[data-testid="td-explode-note"]')?.innerText || ""), null, { timeout: 40000 }).catch(() => {});
  const note = await T("td-explode-note").innerText().catch(() => "");
  res.noteZh = note;
  ok(/6\/6 个模块已加载/.test(note), "爆炸图：6/6 个模块已加载", note.slice(0, 60));
  await T("td-explode-note").scrollIntoViewIfNeeded().catch(() => {}); await shot(p, "toy-car-explode-zh");
  await p.goto(BASE + "/help/"); await p.waitForTimeout(1500);
  ok((await p.locator("body").innerText()).includes("落地限速（v33）"), "帮助页有“落地限速（v33）”说明（标估算）");
  await c.close();
}
{
  const { c, p, T } = await page("en");
  await p.goto(BASE + "/teardown/?d=" + ID); await T("teardown-page").waitFor(); await p.waitForTimeout(1500);
  const t = await T("teardown-page").innerText(); const cjk = (t.match(CJK) || []).length;
  res[ID + "-en"] = { chars: t.length, cjk };
  ok(cjk / t.length < 0.02, `${ID} 英文页：${t.length} 字符，汉字 ${cjk}`);
  await p.waitForFunction(() => /(\d+)\/\1 modules loaded/.test(document.querySelector('[data-testid="td-explode-note"]')?.innerText || ""), null, { timeout: 40000 }).catch(() => {});
  const note = await T("td-explode-note").innerText().catch(() => "");
  res.noteEn = note;
  ok(/modules loaded/.test(note) && !(note.match(CJK) || []).length, "英文爆炸图说明是英文（没有汉字）", note.slice(0, 80));
  await shot(p, "toy-car-en");
  await p.goto(BASE + "/help/"); await p.waitForTimeout(1500);
  ok((await p.locator("body").innerText()).includes("Landing speed cap (v33)"), "英文帮助页有 “Landing speed cap (v33)”");
  await c.close();
}
for (const [w, h, tag] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang, w, h);
  await p.goto(BASE + "/teardown/?d=" + ID); await p.waitForTimeout(2500);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= w + 1, `${tag} ${w} 宽 ${lang}：玩具车页不横向溢出（${sw}）`);
  await shot(p, `toy-car-${tag}-${lang}`);
  await c.close();
}
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
ok(!bad.length, "没有 4xx/5xx 请求", bad.slice(0, 3).join(" | "));
await b.close();
const sub = new URL(BASE).pathname.replace(/\/$/, "");
fs.writeFileSync(`${OUT}/logs/v33-bench${sub ? "-live" : ""}.json`, JSON.stringify({ pass, fail, res, errs, bad }, null, 1));
console.log(`v33-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
