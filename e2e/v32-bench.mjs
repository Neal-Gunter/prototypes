// v32：两台新低压设备（9V LED 测试器 / USB OTG 集线器）、市电关键词提示、设备电压显示、低压安全规则、
//      /assembly/guide 和 /credits 英文手写译文（剩余汉字 < 1%）、3D 模型路径不 404、手机 / 宽屏中英文。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v32 SHOTS=0 node e2e/v32-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v32", SHOT = process.env.SHOTS !== "0";
fs.mkdirSync(`${OUT}/logs`, { recursive: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errs = [], bad = [], glbs = [];
const page = async (lang, w = 1440, h = 900) => {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  await c.addInitScript((l) => { try { localStorage.setItem("asm-tour-v22-done", "1"); localStorage.setItem("ui-lang", l); } catch { /* */ } }, lang);
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  p.on("response", (r) => { const u = r.url(); if (/\.(glb|gltf)(\?|$)/.test(u)) glbs.push(u); if (r.status() >= 400 && !/favicon/.test(u)) bad.push(r.status() + " " + u.replace(/^https?:\/\/[^/]+/, "")); });
  return { c, p, T: (t) => p.locator(`[data-testid="${t}"]`) };
};
const shot = async (p, s) => { if (SHOT) await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${s}.png` }); };
const CJK = /[\u4e00-\u9fff]/g;
const NEW = { "led-tester-9v": "9v", "usb-otg-hub": "OTG" };
{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/teardown/"); await T("teardown-page").waitFor({ timeout: 30000 });
  const nDev = await p.locator('[data-testid^="td-device-"]').count();
  ok(nDev >= 10, `设备列表 ${nDev} 台（v29 3 + v30 3 + v31 2 + v32 2）`);
  const subs = await p.locator('[data-testid^="td-device-"]').evaluateAll((a) => a.map((x) => x.innerText));
  const volts = subs.map((t) => +(t.match(/([\d.]+) V 直流/) || [])[1]);
  res.volts = volts;
  ok(volts.length >= 10 && volts.every((v) => v > 0 && v <= 24), `每台设备都显示电压且 ≤ 24 V 直流`, volts.join());
  for (const [id, q] of Object.entries(NEW)) {
    await T("td-search").fill(q); await p.waitForTimeout(150);
    const ids = await p.locator('[data-testid^="td-device-"]').evaluateAll((a) => a.map((x) => x.dataset.testid.slice(10)));
    ok(ids.includes(id), `搜索 “${q}” 找到 ${id}`, ids.join());
  }
  for (const q of ["充电头", "电源适配器", "220V"]) {
    await T("td-search").fill(q); await p.waitForTimeout(150);
    ok(await T("td-mains").count() === 1, `搜索 “${q}” 出现市电提示`);
  }
  await T("td-search").fill("充电头"); await p.waitForTimeout(150); await shot(p, "teardown-mains-zh");
  await T("td-search").fill("鼠标"); await p.waitForTimeout(150);
  ok(await T("td-mains").count() === 0, "搜索 “鼠标” 不出现市电提示");
  await T("td-search").fill(""); await shot(p, "teardown-list10-zh");
  for (const id of Object.keys(NEW)) {
    await p.goto(BASE + "/teardown/?d=" + id); await T("td-guide").waitFor({ timeout: 20000 });
    const steps = await T("td-step").count(), figs = await p.locator('[data-testid="td-step"] [data-testid="td-fig"]').count(), stops = await T("td-stop").count();
    const unv = await p.locator('[data-testid="td-step"]').evaluateAll((a) => a.filter((x) => x.innerText.includes("按公开资料整理，未经实物验证")).length);
    const safety = await T("td-safety").innerText();
    res[id] = { steps, figs, stops, unv };
    ok(steps >= 6 && figs === steps && unv === steps && stops >= 1, `${id}：${steps} 步 / ${figs} 张自绘插图 / ${unv} 步标“未经实物验证” / 停止点 ${stops}`);
    ok(safety.includes("只收低压直流设备"), `${id}：安全须知含低压规则`);
    await T("td-steps").scrollIntoViewIfNeeded(); await shot(p, id + "-zh");
  }
  await c.close();
}
{
  const { c, p, T } = await page("en");
  await p.goto(BASE + "/teardown/"); await T("teardown-page").waitFor({ timeout: 30000 });
  await T("td-search").fill("wall charger"); await p.waitForTimeout(150);
  const m = await T("td-mains").count() ? await T("td-mains").innerText() : "";
  ok(/mains/i.test(m) && !(m.match(CJK) || []).length, "英文：搜 “wall charger” 出现英文市电提示", m.slice(0, 80));
  for (const id of Object.keys(NEW)) {
    await p.goto(BASE + "/teardown/?d=" + id); await T("teardown-page").waitFor(); await p.waitForTimeout(1200);
    const t = await T("teardown-page").innerText(); const cjk = (t.match(CJK) || []).length;
    res[id + "-en"] = { chars: t.length, cjk };
    ok(cjk / t.length < 0.02, `${id} 英文页：${t.length} 字符，汉字 ${cjk}（只剩“按公开资料整理”这类原文标签）`);
    await shot(p, id + "-en");
  }
  for (const path of ["/assembly/guide", "/credits"]) {
    await p.goto(BASE + path + "/"); await p.waitForTimeout(3500);
    const t = await p.evaluate(() => (document.querySelector("main") || document.body).innerText);
    const cjk = (t.match(CJK) || []).length; res[path] = { chars: t.length, cjk };
    ok(t.length > 200 && cjk / t.length < 0.01, `${path} 英文：${t.length} 字符，剩余汉字 ${cjk}（< 1%）`);
    await shot(p, path.slice(1).replace("/", "-") + "-en");
  }
  await c.close();
}
for (const [w, h, tag] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang, w, h);
  await p.goto(BASE + "/teardown/?d=led-tester-9v"); await p.waitForTimeout(2500);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= w + 1, `${tag} ${w} 宽 ${lang}：9V 测试器页不横向溢出（${sw}）`);
  await shot(p, `led-tester-${tag}-${lang}`);
  await c.close();
}
const sub = new URL(BASE).pathname.replace(/\/$/, "");
res.glbs = [...new Set(glbs.map((u) => new URL(u).pathname))].slice(0, 12);
ok(glbs.every((u) => new URL(u).pathname.startsWith(sub + "/")), `3D 模型都从 ${sub || "/"} 下加载（${glbs.length} 次）`);
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
ok(!bad.length, "没有 4xx/5xx 请求", bad.slice(0, 3).join(" | "));
await b.close();
fs.writeFileSync(`${OUT}/logs/v32-bench${sub ? "-live" : ""}.json`, JSON.stringify({ pass, fail, res, errs, bad }, null, 1));
console.log(`v32-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
