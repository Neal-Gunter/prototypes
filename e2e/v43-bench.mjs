// v43：3D 零件悬停/焦点高亮和示波器测量光标。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v43 SHOTS=1 node e2e/v43-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v43", SHOT = process.env.SHOTS !== "0";
fs.mkdirSync(`${OUT}/logs`, { recursive: true });
let pass = 0, fail = 0, n = 0;
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errs = [], bad = [];
const page = async (lang, w = 1440, h = 900, extraInit) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: extraInit?.reduced ? "reduce" : "no-preference" });
  await c.addInitScript((l) => { try { localStorage.setItem("asm-tour-v22-done", "1"); localStorage.setItem("ui-lang", l); } catch { /* */ } }, lang);
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  p.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && !/favicon/.test(u)) bad.push(r.status() + " " + u.replace(/^https?:\/\/[^/]+/, "")); });
  return { c, p, T: (t) => p.locator(`[data-testid="${t}"]`) };
};
const shot = async (p, s) => { if (SHOT) await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${s}.png` }); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitAsm(p, min = 6) {
  await p.waitForSelector("canvas", { timeout: 30000 });
  await p.waitForFunction((n) => window.__asm?.engine && window.__asm.engine.parts.size >= n, min, { timeout: 90000 });
  await p.waitForFunction(() => window.__asm && window.__asm.engine.extDrive !== true, { timeout: 120000 }).catch(() => {});
  await wait(400);
}

async function openBenchScope(p, T) {
  if (await T("tab-elec").count()) await T("tab-elec").click().catch(() => {});
  const details = T("bench-scope-panel");
  await details.waitFor({ timeout: 20000 });
  await details.scrollIntoViewIfNeeded();
  if ((await details.getAttribute("open")) == null) await details.locator("summary").first().click();
  const open = T("bench-scope-open");
  await open.first().waitFor({ timeout: 20000 });
  await open.first().scrollIntoViewIfNeeded();
  await open.first().click();
  await T("mscope").waitFor({ timeout: 20000 });
  const cap = T("mscope-capture");
  if (await cap.count()) { await cap.first().click(); await wait(2500); }
}

// —— 帮助 / 致谢（中英文）——
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/help#whats-new", { waitUntil: "load", timeout: 60000 });
  await T("help-whats-new").waitFor({ timeout: 20000 });
  const news = await T("help-whats-new").innerText();
  const start = await T("help-whats-new").getAttribute("start");
  ok(+start >= 43, `${lang}：本版更新起号 ≥ 43`, start);
  ok(/v43/.test(news) && /v42/.test(news) && /v32/.test(news), `${lang}：本版更新含 v43`, news.slice(0, 180));
  ok(/描边|outline|光标|cursor/i.test(news), `${lang}：v43 摘要提到高亮和光标`);
  await shot(p, `help-whats-new-${lang}`);
  await p.goto(BASE + "/credits#v43-measure");
  await T("credits-v43").waitFor({ timeout: 20000 });
  const cr = await T("credits-v43").innerText();
  ok(/v43/.test(cr) && /没有增加新的第三方|no new third-party/i.test(cr), `${lang}：致谢页有 v43 段落`, cr.slice(0, 160));
  await shot(p, `credits-v43-${lang}`);
  await c.close();
}

// —— 装配台高亮 / 提示 / 物理无副作用（中英文）——
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page(lang);
  await p.goto(BASE + "/assembly?scene=electrics", { waitUntil: "load", timeout: 60000 });
  await waitAsm(p);
  const nParts = await p.evaluate(() => window.__asm.engine.parts.size);
  ok(nParts >= 6, `${lang}：电路练习已装上零件`, String(nParts));

  const phys0 = await p.evaluate(() => {
    window.__asm.engine.extDrive = true;
    const parts = window.__asm.engine.snapshot().parts.map((x) => [x.uid, ...x.pos]);
    const pen = window.__asm.engine.overlapTest().maxPenetrationMm;
    return { parts, pen, n: window.__asm.engine.parts.size, bodies: window.__asm.engine.bodies.size };
  });
  const picked = await p.evaluate(() => {
    const u = [...window.__asm.engine.parts.keys()][0];
    window.__asm.select(u);
    window.__asm.hover(u);
    return u;
  });
  await wait(500);
  const tip = T("asm-part-tip");
  await p.waitForFunction(() => document.querySelector("[data-testid=asm-part-tip]")?.getAttribute("data-on") === "1", null, { timeout: 10000 }).catch(() => {});
  ok(await tip.getAttribute("data-on") === "1", `${lang}：选中后出现零件提示`);
  const tipText = ((await tip.innerText().catch(() => "")) || "").trim();
  ok(tipText.length > 0, `${lang}：提示有名称或规格`, tipText.slice(0, 80));
  if (lang === "en") ok(/[A-Za-z]/.test(tipText), "英文提示含拉丁字母", tipText.slice(0, 80));
  const hl = await p.evaluate(() => window.__asm.getHighlight?.());
  ok(hl && (hl.sel || hl.hover), `${lang}：高亮状态已挂上`, JSON.stringify(hl));
  await T("asm-a11y").focus();
  await p.keyboard.press("ArrowRight");
  await wait(300);
  ok(await tip.getAttribute("data-on") === "1", `${lang}：键盘改选后提示仍在`);
  await shot(p, `asm-highlight-${lang}`);

  const phys1 = await p.evaluate(() => {
    const parts = window.__asm.engine.snapshot().parts.map((x) => [x.uid, ...x.pos]);
    const pen = window.__asm.engine.overlapTest().maxPenetrationMm;
    return { parts, pen, n: window.__asm.engine.parts.size, bodies: window.__asm.engine.bodies.size };
  });
  const sameN = phys0.n === phys1.n && phys0.bodies === phys1.bodies;
  const samePos = phys0.parts.length === phys1.parts.length && phys0.parts.every((r, i) => r.every((v, j) => v === phys1.parts[i][j]));
  ok(sameN && samePos, `${lang}：高亮不改零件数和位姿`, `n ${phys0.n}→${phys1.n} pen ${phys0.pen}→${phys1.pen}`);
  ok(Math.abs(phys1.pen - phys0.pen) < 1e-6, `${lang}：高亮不改变穿透读数`, `${phys0.pen} → ${phys1.pen}`);
  await p.evaluate(() => { window.__asm.engine.extDrive = false; });
  await c.close();
  if (!picked) ok(false, `${lang}：没选到零件`);
}

// —— 减少动效：提示在，高亮标记 reduced ——
{
  const { c, p, T } = await page("zh", 1440, 900, { reduced: true });
  await p.goto(BASE + "/assembly?scene=electrics", { waitUntil: "load", timeout: 60000 });
  await waitAsm(p);
  await p.evaluate(() => {
    const u = [...window.__asm.engine.parts.keys()][0];
    window.__asm.select(u);
  });
  await wait(400);
  const red = await T("asm-part-tip").getAttribute("data-reduced");
  ok(red === "1", "减少动效时提示带 data-reduced=1", String(red));
  ok(await T("asm-part-tip").getAttribute("data-on") === "1", "减少动效时仍显示静态提示");
  await shot(p, "asm-reduced-motion");
  await c.close();
}

// —— 最繁忙可渲染场景：帧耗时前后对比 ——
{
  const { c, p } = await page("zh");
  await p.goto(BASE + "/assembly?scene=electrics", { waitUntil: "load", timeout: 60000 });
  await waitAsm(p);
  const busy = await p.evaluate(async () => {
    const e = window.__asm.engine;
    e.extDrive = true;
    const sample = [...e.parts.values()].find((x) => x.def?.id)?.def.id;
    const start = e.parts.size;
    let added = 0;
    const target = 93;
    if (sample) {
      for (let i = 0; e.parts.size < target && i < 200; i++) {
        const gx = (i % 12) - 5.5, gz = Math.floor(i / 12) - 4;
        try { await window.__asm.addAt(sample, gx * 2.4, -8 + gz * 2.4, 0.3); added++; } catch { break; }
      }
    }
    for (let i = 0; i < 24; i++) e.update(1 / 120);
    e.extDrive = false;
    return { start, added, total: e.parts.size, sample };
  });
  ok(busy.total >= 6, "性能场景已装上零件", JSON.stringify(busy));
  await wait(800);
  await p.evaluate(() => { window.__asm.hover(null); window.__asm.select(null); window.__asmPerf?.start(); });
  await wait(4500);
  const before = await p.evaluate(() => window.__asmPerf.stop());
  await p.evaluate(() => {
    const u = [...window.__asm.engine.parts.keys()][0];
    window.__asm.select(u);
    window.__asm.hover(u);
    window.__asmPerf.start();
  });
  await wait(4500);
  const after = await p.evaluate(() => window.__asmPerf.stop());
  const med0 = before.raf?.median || before.step?.median || 0;
  const med1 = after.raf?.median || after.step?.median || 0;
  const n0 = before.raf?.n || 0, n1 = after.raf?.n || 0;
  const budget = Math.max(3, med0 * 0.25); // 允许 +3 ms 或 +25%
  // 93 件在 swiftshader 下约 100 ms/帧，几秒只能采到十几帧；满 10 帧即可比中位数
  const okPerf = n0 >= 10 && n1 >= 10 && (med1 - med0) <= budget;
  ok(n0 >= 10 && n1 >= 10, "已采集到高亮前后的帧样本", `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
  ok(okPerf, "高亮后中位帧间隔未明显变差", `median raf ${med0} → ${med1} ms（余量 ${budget.toFixed(2)}），零件 ${busy.total}`);
  fs.writeFileSync(`${OUT}/logs/perf-highlight.json`, JSON.stringify({ scene: "electrics+grid≈93", busy, before, after, budget }, null, 2));
  await shot(p, "asm-busy-highlight");
  await c.close();
}

// —— 示波器光标：桌面宽 + 390 宽 ——
async function checkCursors(p, T, tag, w) {
  await T("mscope-cur-t1").waitFor({ timeout: 10000 });
  ok(await T("mscope-cur-t1").count() && await T("mscope-cur-t2").count() && await T("mscope-cur-v1").count() && await T("mscope-cur-v2").count(), `${tag}：四个光标滑块都在`);
  const lab = await T("mscope-cur-t1").getAttribute("aria-label");
  ok(/时间|Time/i.test(lab || ""), `${tag}：时间光标有 aria-label`, lab);
  ok(await T("mscope-cur-v2").getAttribute("aria-valuenow") != null, `${tag}：电压光标有 aria-valuenow`);
  const cur0 = await T("mscope-cursors").innerText();
  ok(/Δt/.test(cur0) && /ΔV/.test(cur0), `${tag}：读数含 Δt 和 ΔV`, cur0.slice(0, 120));
  // 键盘微调时间光标 1
  const v0 = +(await T("mscope-cur-t1").inputValue());
  await T("mscope-cur-t1").focus();
  await p.keyboard.press("ArrowRight");
  await p.keyboard.press("ArrowRight");
  const v1 = +(await T("mscope-cur-t1").inputValue());
  ok(v0 === 100 ? v1 === 100 : v1 > v0, `${tag}：键盘可调时间光标`, `${v0} → ${v1}`);
  // 拖电压光标：先把屏幕滚进滚动栏，再按光标组的屏幕盒子拖（避免点到旁边的 3D 画布）
  const screen = T("mscope-screen");
  await screen.scrollIntoViewIfNeeded();
  await wait(200);
  const box = await screen.boundingBox();
  const vBefore = +(await T("mscope-cur-v1").inputValue());
  const gb = await T("mscope-cur-v1-line").boundingBox();
  if (gb) {
    await p.mouse.move(gb.x + gb.width * 0.5, gb.y + gb.height * 0.5);
    await p.mouse.down();
    await p.mouse.move(gb.x + gb.width * 0.5, gb.y + gb.height * 0.5 - Math.max(36, box ? box.height * 0.15 : 36), { steps: 8 });
    await p.mouse.up();
    await wait(200);
  } else if (box) {
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.15, { steps: 8 });
    await p.mouse.up();
    await wait(200);
  }
  const vVal = +(await T("mscope-cur-v1").inputValue());
  ok(vVal !== vBefore, `${tag}：拖过电压光标后位置已变`, `${vBefore} → ${vVal}`);
  const cur1 = await T("mscope-cursors").innerText();
  ok(/Δt/.test(cur1) && /1\/Δt/.test(cur1) && /ΔV/.test(cur1), `${tag}：读数含 Δt、1/Δt、ΔV`, cur1.slice(0, 140));
  if (/CH1/.test(cur1) || /CH1/.test(cur0)) ok(true, `${tag}：抓波后仍有通道差值（CH1）`);
  else ok(/ΔV/.test(cur1), `${tag}：即使尚未抓到波形也有 ΔV`);
  // 390：面板不要撑破视口太多（允许父级滚动）
  if (w <= 400) {
    const geo = await p.evaluate(() => {
      const el = document.querySelector("[data-testid=mscope]");
      const sl = document.querySelector("[data-testid=mscope-cur-sliders]");
      if (!el) return null;
      const r = el.getBoundingClientRect(), s = sl?.getBoundingClientRect();
      return { w: Math.round(r.width), sw: el.scrollWidth, cw: el.clientWidth, sliders: s ? { w: Math.round(s.width), h: Math.round(s.height) } : null, vw: window.innerWidth };
    });
    ok(geo && geo.w <= geo.vw + 24, `${tag}：示波器宽度适合 ${w} 视口`, JSON.stringify(geo));
    ok(geo?.sliders && geo.sliders.h >= 40, `${tag}：390 下光标滑块仍然可见`, JSON.stringify(geo?.sliders));
  }
  await shot(p, `scope-cursors-${tag}`);
}

{
  const { c, p, T } = await page("zh");
  await p.goto(BASE + "/assembly?scene=electrics", { waitUntil: "load", timeout: 60000 });
  await waitAsm(p);
  await openBenchScope(p, T);
  await checkCursors(p, T, "1440", 1440);
  await c.close();
}

{
  const { c, p, T } = await page("zh", 390, 844);
  await p.goto(BASE + "/assembly?scene=electrics", { waitUntil: "load", timeout: 60000 });
  await waitAsm(p);
  await openBenchScope(p, T);
  await T("mscope").scrollIntoViewIfNeeded();
  await checkCursors(p, T, "390", 390);
  await c.close();
}

const pagesErr = errs.filter((e) => !/favicon/.test(e));
ok(pagesErr.length === 0, "走查过程无页面报错", pagesErr.slice(0, 3).join(" | "));
console.log(`v43-bench ${pass}/${fail}`);
if (bad.length) console.log("4xx", bad.slice(0, 8).join(" | "));
await b.close();
if (fail) process.exit(1);
