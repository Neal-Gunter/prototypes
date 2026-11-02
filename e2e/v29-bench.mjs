// v29：拆解模式 —— 设备列表 + 搜索、分步指南、安全（电池先处理 / 防静电 / 停止点）、材料清单、完成勾选（本机保存）、
//      存进零件库（本机工作台库存 → 零件库“拆解所得”→ 装配台）、自绘插图、交互爆炸图、入口链接、出处页、手机 / 宽屏中英文。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v29 SHOTS=0 node e2e/v29-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v29", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv29";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ slowMo: SHOT ? 60 : 0, executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
await ctx.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); if (!sessionStorage.getItem("v29-init")) { localStorage.setItem("ui-lang", "zh"); localStorage.removeItem("bench-inventory"); localStorage.removeItem("teardown-progress"); sessionStorage.setItem("v29-init", "1"); } } catch { /* */ } });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e))); p.on("dialog", (d) => d.accept());
const wait = (ms) => p.waitForTimeout(ms);
const T = (t) => p.locator(`[data-testid="${t}"]`);
const shot = async (s, pg = p) => { if (SHOT) await pg.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`, fullPage: false }); };
const CJK = /[\u4e00-\u9fff]/g;

// ① 列表 + 搜索
await p.goto(BASE + "/teardown"); await T("teardown-page").waitFor({ timeout: 30000 });
const nDev = await p.locator('[data-testid^="td-device-"]').count();
ok(nDev === 3, `设备列表 ${nDev} 台`);
ok(await T("td-unverified").isVisible() && /按公开资料整理，未经实物验证/.test(await T("td-unverified").innerText()), "页面标注“按公开资料整理，未经实物验证”");
const search = async (s) => { await T("td-search").fill(s); await wait(150); return p.locator('[data-testid^="td-device-"]').evaluateAll((a) => a.map((x) => x.dataset.testid.slice(10))); };
const s1 = await search("18650"), s2 = await search("SG90"), s3 = await search("fan"), s4 = await search("不存在的设备xyz");
res.search = { s1, s2, s3, s4 };
ok(s1.join() === "powerbank-18650" && s2.join() === "micro-servo" && s3.join() === "usb-mini-fan" && !s4.length && await T("td-none").isVisible(), "按名称 / 型号搜索（18650 / SG90 / fan / 无结果）", JSON.stringify(res.search));
await search("");
await shot("teardown-list-zh");

// ② 舵机指南：步骤、插图、安全、材料
await T("td-device-micro-servo").click(); await wait(300);
const steps = await T("td-step").count(), figs = await p.locator('[data-testid="td-step"] [data-testid="td-fig"]').count(), stops = await T("td-stop").count();
ok(steps >= 6 && figs === steps, `舵机：${steps} 步，每步一张自绘 SVG 插图（${figs}）`);
ok(stops >= 1, `舵机：停止点 ${stops} 处`);
const saf = await T("td-safety").innerText();
ok(/先处理电池/.test(saf) && /防静电/.test(saf) && /停止点/.test(saf), "安全提示含 电池先处理 / 防静电 / 停止点");
const unv = await p.locator('[data-testid="td-step"]').evaluateAll((a) => a.filter((x) => x.innerText.includes("按公开资料整理，未经实物验证")).length);
ok(unv === steps, `每一步都标“未经实物验证”（${unv}/${steps}）`);
const mats = await p.locator('[data-testid^="td-mat-"]').count();
ok(mats >= 4, `材料清单 ${mats} 项`);

// ③ 完成勾选存本机：勾 2 步 + 1 项材料，刷新后还在
await T("td-step-check-0").check(); await T("td-step-check-1").check(); await T("td-mat-0").check(); await wait(200);
await p.reload(); await T("td-guide").waitFor();
const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("teardown-progress") || "{}")["micro-servo"]);
const c0 = await T("td-step-check-0").isChecked(), c1 = await T("td-step-check-1").isChecked(), m0 = await T("td-mat-0").isChecked();
ok(c0 && c1 && m0 && kept?.steps?.length === 2, "勾选刷新后保留（localStorage teardown-progress）", JSON.stringify(kept));
ok(/2 \/ \d+/.test(await T("td-progress").innerText()), "进度显示 " + await T("td-progress").innerText());
await T("td-steps").scrollIntoViewIfNeeded(); await shot("servo-steps-zh");

// ④ 爆炸图
await T("td-explode-canvas").scrollIntoViewIfNeeded();
await p.waitForFunction(() => window.__tdExplode && window.__tdExplode.loaded === window.__tdExplode.total, null, { timeout: 60000 }).catch(() => {});
const ex0 = await p.evaluate(() => window.__tdExplode);
ok(ex0 && ex0.total >= 6 && ex0.loaded === ex0.total, `爆炸图：${ex0?.loaded}/${ex0?.total} 个模块加载（复用零件库 3D 网格）`);
await T("td-explode-slider").fill("1"); await wait(600);
const ex1 = await p.evaluate(() => window.__tdExplode.k);
const labels = await T("td-ex-label").count();
ok(ex1 === 1 && labels >= 5, `拖到 100% 拆开，模块标签 ${labels} 个`);
await shot("servo-explode-zh");
await T("td-explode-slider").fill("0"); await wait(300);
ok(await p.evaluate(() => window.__tdExplode.k) === 0, "拖回 0% 合拢");
await T("td-explode-slider").fill("0.8"); await wait(400);

// ⑤ 存进零件库
await T("td-save").click(); await wait(300);
let inv = await p.evaluate(() => JSON.parse(localStorage.getItem("bench-inventory") || "[]"));
const hasHorn = inv.some((r) => r.part === "fc-servo-sg90-horn1" && !r.approx), hasGear = inv.some((r) => r.part === "td-servo-gearset" && r.approx);
ok(inv.length === 8 && hasHorn && hasGear && await T("td-saved").isVisible(), `舵机 8 个模块存进本机库存（已有件 ${inv.filter((r) => !r.approx).length}，近似件 ${inv.filter((r) => r.approx).length}）`);
ok(await T("td-inv-row").count() === 8, "页面上的库存列表 8 行");
await T("td-save").click(); await wait(200);
inv = await p.evaluate(() => JSON.parse(localStorage.getItem("bench-inventory") || "[]"));
ok(inv.length === 8 && inv.every((r) => r.n === 2), "再存一次：数量累加，不重复建行");
await T("td-modules").scrollIntoViewIfNeeded(); await shot("servo-modules-zh");

// ⑥ 充电宝：电池先处理
await T("td-device-powerbank-18650").click(); await wait(400);
const pbSteps = await T("td-step").allInnerTexts();
const firstBatt = pbSteps.findIndex((s) => /断开电芯/.test(s)), firstBoard = pbSteps.findIndex((s) => /取出控制板/.test(s));
ok(/停止点/.test(pbSteps[0]) && firstBatt >= 0 && firstBatt < firstBoard, `充电宝：第 1 步是停止点检查；断开电芯（第 ${firstBatt + 1} 步）在碰控制板（第 ${firstBoard + 1} 步）之前`);
ok(/电池先处理/.test(await T("td-safety").innerText()) && await T("td-warn").count() >= 2, "充电宝：安全 + 警告");
const pbMods = await T("td-module").evaluateAll((a) => a.map((x) => x.dataset.match));
ok(pbMods.includes("same") && pbMods.includes("approx"), "模块对应：已有件 + 近似件 都有", pbMods.join(","));
await T("td-save").click(); await wait(200);
inv = await p.evaluate(() => JSON.parse(localStorage.getItem("bench-inventory") || "[]"));
ok(inv.some((r) => r.part === "p-cell-18650") && !inv.some((r) => r.part === "kc-batteryholder_keystone_1042_1x18650"), "18650 电芯用已有零件；“建议添置”的电池盒不算拆下的模块");
await shot("powerbank-zh");
// 风扇也有爆炸图
await T("td-device-usb-mini-fan").click(); await wait(400);
await p.waitForFunction(() => window.__tdExplode?.device === "usb-mini-fan" && window.__tdExplode.loaded === window.__tdExplode.total, null, { timeout: 60000 }).catch(() => {});
ok((await p.evaluate(() => window.__tdExplode)).loaded >= 4, "风扇爆炸图加载");
await T("td-save").click(); await wait(200);

// ⑦ 零件库“拆解所得” + 装配台使用
await p.goto(BASE + "/parts?view=inv"); await T("parts-list").waitFor({ timeout: 30000 }); await wait(800);
const rows = await p.locator('[data-testid="parts-list"] [data-testid^="row-"]').count();
inv = await p.evaluate(() => JSON.parse(localStorage.getItem("bench-inventory") || "[]"));
ok(rows === inv.length && rows >= 15, `零件库“拆解所得”视图 ${rows} 个（本机库存 ${inv.length}）`);
ok(await p.locator('[data-testid="row-td-servo-gearset"]').innerText().then((t) => /近似件/.test(t)).catch(() => false), "近似件在零件库里名字带“近似件 · 拆解模式”");
await shot("parts-inventory-zh");
await p.goto(BASE + "/assembly"); await p.waitForFunction(() => window.__engine, null, { timeout: 90000 }).catch(() => {}); await wait(1500);
await T("f-view").selectOption("inv"); await wait(400);
const before = await p.evaluate(() => window.__engine.parts.size);
await T("add-td-servo-gearset").click(); await wait(1500);
const after = await p.evaluate(() => [window.__engine.parts.size, [...window.__engine.parts.values()].some((x) => x.def?.id === "td-servo-gearset")]);
ok(after[0] === before + 1 && after[1], `装配台：从“拆解所得”加一个近似齿轮组到台面（${before} → ${after[0]}）`);
await shot("bench-from-inventory");

// ⑧ 入口：导航、命令面板、首页、使用说明、出处页
await p.goto(BASE + "/"); await wait(800);
ok(await T("nav-teardown").count() === 1 && await T("cta-teardown").count() === 1, "导航 + 首页按钮");
await p.keyboard.press("Control+k"); await wait(300); await p.keyboard.type("拆解"); await wait(300);
const pal = await p.locator('[role="dialog"]').innerText().catch(() => "");
ok(/拆解模式/.test(pal) && /微型舵机/.test(pal), "命令面板能搜到拆解模式和设备");
await p.keyboard.press("Escape");
await p.goto(BASE + "/help"); await wait(800);
ok(await p.locator('a[href$="/teardown"]').count() >= 1, "使用说明页有拆解模式");
await p.goto(BASE + "/credits#teardown"); await wait(800);
const cr = await T("credits-teardown-list").innerText();
ok(["Caleb-Guyer/teardown-library", "HardwareHackingHandbook/teardowns", "ttepatti/teardown-rivian-axm-1.0", "gipi/teardown", "nox-x/TG3442DE-Teardown"].every((r) => cr.includes(r)) && /CC BY-NC-SA 3\.0/.test(cr) && /CC BY 4\.0/.test(cr) && /没有看到许可/.test(cr), "出处页列出 5 个灵感来源和许可（如实，含“没看到许可”）");
await shot("credits-teardown");

// ⑨ 英文：手写译文，正文无汉字
{
  const c3 = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c3.addInitScript(() => { localStorage.setItem("ui-lang", "en"); });
  const q = await c3.newPage(); q.on("pageerror", (e) => errs.push(String(e)));
  for (const d of ["micro-servo", "powerbank-18650", "usb-mini-fan"]) {
    await q.goto(BASE + "/teardown?d=" + d); await q.locator('[data-testid="teardown-page"]').waitFor(); await q.waitForTimeout(1200);
    const t = await q.locator('[data-testid="teardown-page"]').innerText();
    const cjk = (t.match(CJK) || []).length;
    res["en_" + d] = { chars: t.length, cjk };
    ok(cjk === 0 && /Not verified|not verified/.test(t), `英文 ${d}：${t.length} 字符，汉字 ${cjk}`);
  }
  await q.goto(BASE + "/teardown?d=powerbank-18650"); await q.waitForTimeout(800); if (SHOT) await q.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-powerbank-en.png` });
  await q.goto(BASE + "/credits#teardown"); await q.waitForFunction(() => window.__mtActive, null, { timeout: 30000 }).catch(() => {}); await q.waitForTimeout(1500);
  const ce = await q.locator('[data-testid="credits-teardown"]').innerText();
  ok(!/[\u4e00-\u9fff]/.test(ce) && /No text, photos or code were copied/.test(ce), "英文出处页：拆解段落是手译", ce.slice(0, 60));
  await c3.close();
}
// ⑩ 手机 / 宽屏 × 中英文
for (const [w, h, tag] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) for (const lang of ["zh", "en"]) {
  const c2 = await b.newContext({ viewport: { width: w, height: h } }); await c2.addInitScript((l) => { localStorage.setItem("ui-lang", l); }, lang);
  const m = await c2.newPage(); const me = []; m.on("pageerror", (e) => me.push(String(e)));
  await m.goto(BASE + "/teardown?d=micro-servo"); await m.waitForTimeout(2500);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= w + 1 && !me.length, `${tag} ${w} 宽 ${lang}：不横向溢出（${sw}）、无报错`, me.slice(0, 1).join(""));
  if (SHOT) await m.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-teardown-${tag}-${lang}.png` });
  await c2.close();
}
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
await ctx.close(); await b.close();
fs.writeFileSync(`${OUT}/logs/v29-bench.json`, JSON.stringify({ pass, fail, res, errs }, null, 1));
if (SHOT && fs.existsSync(VID)) { const v = fs.readdirSync(VID).filter((f) => f.endsWith(".webm")).sort((x, y) => fs.statSync(`${VID}/${y}`).size - fs.statSync(`${VID}/${x}`).size)[0]; if (v) fs.copyFileSync(`${VID}/${v}`, `${OUT}/logs/v29-demo.webm`); }
console.log(`v29-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
