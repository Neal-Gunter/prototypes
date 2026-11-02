// v31：拆解新设备（LED 手电 / TP4056 充电板）+ 手电爆炸图、英文“Client: ”空格、/workbench 手写译文、
//      3D 模型路径在 /prototypes/ 子路径下能加载（不 404）、手机 / 宽屏中英文。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173/prototypes OUT=/workspace/proto-site/v31 SHOTS=0 node e2e/v31-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v31", SHOT = process.env.SHOTS !== "0";
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
const NEW = { "led-flashlight": "flashlight", "tp4056-board": "tp4056" };

// ① 中文：列表 6 台，搜索新设备
{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/teardown/"); await T("teardown-page").waitFor({ timeout: 30000 });
  const nDev = await p.locator('[data-testid^="td-device-"]').count();
  ok(nDev >= 8, `设备列表 ${nDev} 台（v29 3 + v30 3 + v31 2）`);
  for (const [id, q] of Object.entries(NEW)) {
    await T("td-search").fill(q); await p.waitForTimeout(150);
    const ids = await p.locator('[data-testid^="td-device-"]').evaluateAll((a) => a.map((x) => x.dataset.testid.slice(10)));
    ok(ids.includes(id), `搜索 “${q}” 找到 ${id}`, ids.join());
  }
  await T("td-search").fill(""); await shot(p, "teardown-list8-zh");
  // ② 新设备的指南：步骤、插图、每步“未经实物验证”、停止点
  for (const id of Object.keys(NEW)) {
    await p.goto(BASE + "/teardown/?d=" + id); await T("td-guide").waitFor({ timeout: 20000 });
    const steps = await T("td-step").count(), figs = await p.locator('[data-testid="td-step"] [data-testid="td-fig"]').count(), stops = await T("td-stop").count();
    const unv = await p.locator('[data-testid="td-step"]').evaluateAll((a) => a.filter((x) => x.innerText.includes("按公开资料整理，未经实物验证")).length);
    res[id] = { steps, figs, stops, unv };
    ok(steps >= 6 && figs === steps && unv === steps && stops >= 1, `${id}：${steps} 步 / ${figs} 张自绘插图 / ${unv} 步标“未经实物验证” / 停止点 ${stops}`);
    await T("td-steps").scrollIntoViewIfNeeded(); await shot(p, id + "-zh");
  }
  // ③ LED 手电爆炸图（v31 新设备）+ 3D 模型从 /prototypes/ 下加载
  await p.goto(BASE + "/teardown/?d=led-flashlight"); await T("td-guide").waitFor({ timeout: 20000 });
  const hasEx = await T("td-explode-canvas").count();
  ok(hasEx === 1, "LED 手电有交互爆炸图");
  if (hasEx) {
    await T("td-explode-canvas").scrollIntoViewIfNeeded();
    await p.waitForFunction(() => window.__tdExplode && window.__tdExplode.loaded === window.__tdExplode.total, null, { timeout: 60000 }).catch(() => {});
    const ex = await p.evaluate(() => window.__tdExplode);
    res.pbExplode = ex;
    ok(ex && ex.total >= 3 && ex.loaded === ex.total, `LED 手电爆炸图 ${ex?.loaded}/${ex?.total} 个模块加载`);
    await T("td-explode-slider").fill("1"); await p.waitForTimeout(700); await shot(p, "flashlight-explode-zh");
  }
  await c.close();
}
const sub = new URL(BASE).pathname.replace(/\/$/, "");
res.glbs = [...new Set(glbs.map((u) => new URL(u).pathname))].slice(0, 12);
ok(glbs.length > 0 && glbs.every((u) => new URL(u).pathname.startsWith(sub + "/")), `3D 模型 ${glbs.length} 次请求，全部在 ${sub || "/"}/ 下`, res.glbs.slice(0, 2).join(" "));

// ④ 英文：新设备无汉字；维修关卡 “Client: ” 后面有空格；/workbench 手写译文
{
  const { c, p, T } = await page("en");
  for (const id of Object.keys(NEW)) {
    await p.goto(BASE + "/teardown/?d=" + id); await T("teardown-page").waitFor(); await p.waitForTimeout(1200);
    const t = await T("teardown-page").innerText(); const cjk = (t.match(CJK) || []).length;
    res["en_" + id] = { chars: t.length, cjk };
    ok(cjk === 0 && /not verified/i.test(t), `英文 ${id}：${t.length} 字符，汉字 ${cjk}`);
  }
  await shot(p, "tp4056-en");
  await p.goto(BASE + "/repair/"); await T("scenario-list").waitFor({ timeout: 30000 }).catch(() => {});
  await p.locator("[data-testid^=sc-]").first().click(); await p.waitForTimeout(800);
  await p.waitForFunction(() => window.__mtActive !== undefined, null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1500);
  const cpl = await T("complaint").innerText(); res.complaint = cpl.slice(0, 120);
  ok(/^Client: \S/.test(cpl.trim()) && !/Client:\S/.test(cpl), "维修关卡英文：“Client: ” 冒号后有空格", cpl.slice(0, 60));
  await shot(p, "repair-client-en");
  await p.goto(BASE + "/workbench/"); await p.waitForTimeout(4000);
  const wb = await p.evaluate(() => (document.querySelector("main") || document.body).innerText);
  const wcjk = (wb.match(CJK) || []).length; res.workbench = { chars: wb.length, cjk: wcjk };
  ok(wb.length > 200 && wcjk / wb.length < 0.01, `/workbench 英文：${wb.length} 字符，剩余汉字 ${wcjk}（< 1%）`);
  await shot(p, "workbench-en");
  await c.close();
}
// ⑤ 手机 / 宽屏 × 中英文（新设备页）
for (const [w, h, tag] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang, w, h);
  await p.goto(BASE + "/teardown/?d=tp4056-board"); await p.waitForTimeout(2500);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= w + 1, `${tag} ${w} 宽 ${lang}：不横向溢出（${sw}）`);
  await shot(p, `tp4056-${tag}-${lang}`);
  await c.close();
}
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
ok(!bad.length, "没有 4xx/5xx 请求", bad.slice(0, 3).join(" | "));
await b.close();
fs.writeFileSync(`${OUT}/logs/v31-bench.json`, JSON.stringify({ pass, fail, res, errs, bad }, null, 1));
console.log(`v31-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
