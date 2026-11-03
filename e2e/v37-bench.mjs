// v37：3D 场景倾斜旋转（T / F / Shift / Alt / N，角度吸附）、第 13 台设备（电子厨房计时器）、打印版目录 + 页码 + 图例、
// 真 PDF 逐页读出页码、帮助 / 致谢页 v37 说明、手机 / 宽屏中英文无横向溢出。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v37 SHOTS=0 node e2e/v36-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v37", SHOT = process.env.SHOTS !== "0";
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
const tipOf = (s) => +(s.match(/（倾斜 (\d+)°）|\(tilt (\d+)°\)/) || []).slice(1).find((x) => x != null) || 0;
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/assembly"); await p.waitForFunction(() => window.__asm, null, { timeout: 90000 }); await wait(800);
  await p.evaluate(async () => { await window.__asm.addAt("p-ext-2020-150", 0, 0); });
  await wait(1800);
  const a = T("asm-a11y"), say = () => T("asm-a11y-say").innerText();
  await a.focus(); await p.keyboard.press("ArrowRight"); await wait(400);
  const s0 = await say(), y0 = yawOf(s0);
  const q0 = await p.evaluate(() => { const e = window.__asm.engine; const u = [...e.parts.keys()].pop(); const q = e.worldPose(u).q; return [q.x, q.y, q.z, q.w]; });
  // 15° 一格：前后倾两格、左右倾两格，再反着按回去；读的是每次按键后的目标姿态
  // 测的是键盘叠加本身：先关掉重力，免得斜着的长条在两次按键之间倒下（松手后的物理另有测试）
  await p.evaluate(() => { const w = window.__asm.engine.world; window.__g0 = { ...w.gravity }; w.gravity = { x: 0, y: 0, z: 0 }; });
  const seq = ["Alt+t", "Alt+t", "Alt+f", "Alt+f", "Shift+Alt+f", "Shift+Alt+f", "Shift+Alt+t", "Shift+Alt+t"];
  const tips = [];
  for (const k of seq) { await p.keyboard.press(k); await wait(40); tips.push(tipOf(await say())); }
  const s1 = await say();
  await p.evaluate(() => { window.__asm.engine.world.gravity = window.__g0; });
  ok(tips[1] >= 28 && tips[1] <= 32 && Math.max(...tips) <= 45, `${lang}：前后倾两格读出倾斜约 30°、叠加左右倾不超过 45°`, tips.join(","));
  ok(tips[7] === 0 && !/倾斜|tilted/.test(s1) && yawOf(s1) === y0, `${lang}：反着按回去后不倾斜、朝向 ${yawOf(s1)}° 和开始一样（${y0}°）`, s1.slice(-40));
  // 四个 90°：T、F、Shift+F、Shift+T（按欧拉角吸附时这里会卡在万向节死锁附近）
  for (const k of ["t", "f", "Shift+F", "Shift+T"]) { await p.keyboard.press(k); await wait(250); }
  await wait(1200);
  const dq = await p.evaluate((q0) => { const e = window.__asm.engine; const u = [...e.parts.keys()].pop(); const q = e.worldPose(u).q; const d = Math.abs(q.x * q0[0] + q.y * q0[1] + q.z * q0[2] + q.w * q0[3]); return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; }, q0);
  ok(dq < 3, `${lang}：T → F → Shift+F → Shift+T 后和开始姿态相差 ${dq.toFixed(2)}°（< 3）`);
  // 原地转不开：旁边竖一根固定的立柱，按 R 转 90° 会扫到它，抬 3 cm 也躲不开 → 往旁边挪
  await p.evaluate(async () => {
    const A = window.__asm; await A.addAt("p-ext-2020-150", 30, 30);
    const e = A.engine; const u = [...e.parts.keys()].pop(); const w = e.worldPose(u);
    const S = Math.SQRT1_2; e.teleport(u, w.p.clone().set(0, 7.6, 4), w.q.clone().set(0, 0, S, S));
    for (const bid of [e.parts.get(u).body]) e.bodies.get(bid).rb.setBodyType(1, true);
    e.world.propagateModifiedBodyPositionsToColliders();
  });
  await wait(600);
  await a.focus(); await p.evaluate(() => { const e = window.__asm.engine; window.__asm.select([...e.parts.keys()].at(-2)); }); await wait(300);
  await p.keyboard.press("r"); await wait(120);
  const sr = await say();
  await wait(1500);
  const pen = await p.evaluate(() => window.__asm.overlapTest().maxPenetrationMm);
  const mv = +(sr.match(/挪了 ([\d.]+) 厘米|moved ([\d.]+) cm/) || []).slice(1).find((x) => x != null);
  ok(mv > 0 && mv <= 6 || /转不开|Can't turn/.test(sr), `${lang}：原地转不开时往旁边挪 ${mv || "-"} cm（或明确拒绝）`, sr.slice(-60));
  ok(pen < 1, `${lang}：挪完穿透 ${pen.toFixed(3)} mm（< 1）`);
  res[lang] = { tips, y0, dq, mv, pen, sr: sr.slice(-80) };
  if (lang === "zh") await shot(p, "side-move-zh");
  await c.close();
}
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/teardown/"); await T("td-guide").waitFor({ timeout: 20000 }).catch(() => {});
  const nDev = await p.locator('[data-testid^="td-device-"]').count();
  ok(nDev >= 14 && await T("td-device-night-light").count() === 1, `${lang}：设备列表 ${nDev} 台，有电池小夜灯`);
  await T("td-device-night-light").click(); await wait(500);
  const g = await T("td-guide").innerText();
  ok(lang === "zh" ? /停止点/.test(g) && /光敏/.test(g) && /AAA/.test(g) : /Stop point/.test(g) && /LDR|light sensor|photo/i.test(g) && !CJK1.test(g.replace(/[（）]/g, "")), `${lang}：小夜灯指南有停止点和光敏电阻${lang === "en" ? "、英文无汉字" : ""}`);
  const [pop] = await Promise.all([c.waitForEvent("page", { timeout: 10000 }), T("td-print").click()]);
  await pop.waitForLoadState("load"); await wait(300);
  const q = await pop.evaluate(() => [...document.querySelectorAll("svg.qr")].map((s) => ({ u: s.getAttribute("data-qr"), mm: +s.getAttribute("data-qr-size"), inStep: !!s.closest("li.step") })));
  const cover = q.filter((x) => !x.inStep), steps = q.filter((x) => x.inStep);
  ok(q.length === 8 && cover.length === 1 && /\/teardown\/\?d=night-light$/.test(cover[0].u), `${lang}：打印页 ${q.length} 个二维码（封面 1 个指向这台设备）`, cover[0]?.u);
  ok(steps.length === 7 && steps.every((x, i) => x.u.endsWith(`/teardown/?d=night-light&s=${i + 1}`) && x.u.startsWith(BASE)), `${lang}：7 步每步一个二维码、网址带步号、指向当前站点`, steps[0]?.u);
  const capW = await pop.evaluate(() => Math.min(...[...document.querySelectorAll(".qrbox span")].map((e) => e.getBoundingClientRect().width)));
  ok(capW >= 60, `${lang}：二维码说明文字没被挤成一列（最窄 ${Math.round(capW)} px）`);
  ok(q.every((x) => x.mm >= 20), `${lang}：二维码印出来 ≥ 20 mm`, q.map((x) => x.mm).join(","));
  if (lang === "zh" && SHOT) await pop.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-print-qr-zh.png` });
  await pop.close();
  // 扫码后打开的那一步
  await p.goto(BASE + "/teardown/?d=night-light&s=3"); await T("td-guide").waitFor({ timeout: 20000 }).catch(() => {}); await wait(800);
  const fo = await p.evaluate(() => ({ id: document.activeElement?.id, cur: document.getElementById("td-step-3")?.getAttribute("aria-current"), top: document.getElementById("td-step-3")?.getBoundingClientRect().top, h: innerHeight }));
  ok(fo.id === "td-step-3" && fo.cur === "step" && fo.top >= 0 && fo.top < fo.h, `${lang}：深链 s=3 聚焦并滚到第 3 步`, JSON.stringify(fo));
  await p.keyboard.press("Tab"); await wait(100);
  const nx = await p.evaluate(() => !!document.activeElement?.closest("#td-step-3"));
  ok(nx, `${lang}：从第 3 步按 Tab 落在这一步里的第一个控件`);
  if (lang === "zh") await shot(p, "deeplink-step3-zh");
  await c.close();
}
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/workbench"); await T("code").waitFor({ timeout: 30000 });
  const code = T("code"); await code.focus();
  const v0 = await code.inputValue();
  await p.keyboard.press("Tab"); await wait(100);
  const out1 = await p.evaluate(() => document.activeElement?.dataset?.testid !== "code");
  ok(out1 && (await code.inputValue()) === v0, `${lang}：键盘进入编辑器后 Tab 移到下一个控件、代码不变`);
  await code.focus(); await p.keyboard.press("Shift+Tab"); await wait(100);
  ok(await p.evaluate(() => document.activeElement?.dataset?.testid !== "code"), `${lang}：Shift + Tab 往回移出编辑器`);
  await code.focus(); await p.keyboard.press("End"); await p.keyboard.type("x"); await p.keyboard.press("Tab"); await wait(100);
  const v2 = await code.inputValue(), in2 = await p.evaluate(() => document.activeElement?.dataset?.testid === "code");
  ok(in2 && v2.length === v0.length + 3, `${lang}：开始打字后 Tab 插入两个空格`);
  await p.keyboard.press("Escape"); await p.keyboard.press("Tab"); await wait(100);
  ok(await p.evaluate(() => document.activeElement?.dataset?.testid !== "code"), `${lang}：按 Esc 后 Tab 又能移出编辑器`);
  const hint = await p.locator("#code-tab-hint").innerText().catch(() => "");
  ok(lang === "zh" ? /Esc/.test(hint) : /Esc/.test(hint) && !CJK1.test(hint), `${lang}：编辑器有 Tab / Esc 读屏提示`, hint.slice(0, 50));
  await c.close();
}
for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang);
  await p.goto(BASE + "/help/"); await p.waitForTimeout(1500);
  const t = await p.locator("body").innerText();
  ok(lang === "zh" ? t.includes("倾斜不再漂移（v37）") && t.includes("打印版二维码（v37）") && t.includes("键盘焦点检查（v37）") : t.includes("No more tilt drift (v37)") && t.includes("QR codes on the print sheet (v37)") && t.includes("Keyboard focus check (v37)"), `${lang}：帮助页有 v37 三段说明`);
  if (lang === "en") { const k = (t.match(/[\u4e00-\u9fff]/g) || []).length; ok(k / t.length < 0.02, `en 帮助页汉字占比 ${(k / t.length * 100).toFixed(2)}%`); }
  await p.goto(BASE + "/credits"); await p.waitForTimeout(1500);
  const crt = await p.locator('[data-testid="credits-v37"]').innerText().catch(() => "");
  const li = await p.locator('[data-testid="credits-v37-list"]').innerText().catch(() => "");
  ok(/uqr/.test(li) && /MIT/.test(li) && /jsQR/.test(li) && /Apache-2\.0/.test(li) && (lang === "zh" || !CJK1.test(crt + li)), `${lang}：致谢页 v37 写明 uqr MIT、jsQR Apache-2.0`, crt.slice(0, 50));
  await c.close();
}
for (const [w, h] of [[390, 844], [1920, 1080]]) for (const lang of ["zh", "en"]) {
  const { c, p } = await page(lang, w, h);
  for (const path of ["/assembly", "/teardown/?d=night-light&s=3", "/workbench", "/help/", "/credits"]) {
    await p.goto(BASE + path); await p.waitForTimeout(2500);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(ov <= 1, `${w}px ${lang} ${path} 无横向溢出`, ov);
  }
  if (w === 390 && lang === "zh") await shot(p, "nightlight-mobile-zh");
  await c.close();
}
ok(!errs.length, "无页面错误", errs.slice(0, 3).join(" | "));
ok(!bad.length, "无 4xx/5xx", bad.slice(0, 3).join(" | "));
fs.writeFileSync(`${OUT}/logs/v37-bench.json`, JSON.stringify({ pass, fail, res, errs, bad }, null, 1));
console.log(`v37-bench ${pass} PASS / ${fail} FAIL`);
await b.close();
process.exit(fail ? 1 : 0);
