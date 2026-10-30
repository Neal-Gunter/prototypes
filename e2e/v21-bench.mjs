// v21：真实 CAD 替换 + 近似件标记、引脚表页面 + 零件详情跳转、碰撞体线框叠加、首屏预算（限速）、指南 / 致谢
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v21 SHOTS=0 node e2e/v21-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v21", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv21";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const wait = (ms) => p.waitForTimeout(ms);
const T = (t) => p.locator(`[data-testid=${t}]`);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) { await T(t).scrollIntoViewIfNeeded(); await T(t).screenshot({ path: f }); } else await p.screenshot({ path: f }); };
const found = async () => +((await T("parts-found").innerText()).match(/找到 (\d+)/) || [])[1];
const search = async (q) => { await T("parts-search").fill(q); await wait(400); return found(); };

await p.goto(BASE + "/parts");
await p.waitForSelector("[data-testid=parts-total]", { timeout: 60000 });
const total = +(await T("parts-total").innerText()); res.total = total;
ok(total >= 3081, "零件库总数 3081（真实 2556 + 程序生成 525）", String(total));
await T("f-kind").selectOption("real"); const real = await found(); await T("f-kind").selectOption("proc"); const proc = await found(); await T("f-kind").selectOption("all");
ok(real >= 2556 && proc >= 525, "真实 CAD / 程序生成数量", `${real} / ${proc}`); res.real = real; res.proc = proc;
const fcN = await (async () => { const o = await T("f-src").locator("option").evaluateAll((a) => a.map((x) => x.value)); const v = o.find((x) => /fc|freecad/i.test(x)); if (!v) return -1; await T("f-src").selectOption(v); const k = await found(); await T("f-src").selectOption("all"); return k; })();
ok(fcN === 141, "来源筛选：FreeCAD-library 141 个", String(fcN)); res.freecad = fcN;

// 近似件标记 + 指向真实版本
await search("齿轮"); const ap = await p.locator("[data-testid^=approx-]").count();
ok(ap > 0, "齿轮（没有许可干净的真实模型）标“近似形状（程序生成）”", `${ap} 个可见标记`);
await shot("approx-badge", "parts-list");
await search("舵机"); const sup = await p.locator("[data-testid^=sup-]").count(); const realServo = await p.locator("[data-testid=parts-list] li[data-testid^=row-fc-]").count();
ok(realServo > 0, "“舵机”能搜到 FreeCAD 真实舵机", `${realServo} 个真实 · ${sup} 个近似件带“真实 CAD”链接`);

// 碰撞体叠加：凸分解件
await search("Titano"); await p.click("[data-testid=pick-ada-4444]");
await p.waitForSelector("[data-testid=collider-toggle]", { timeout: 60000 }); await wait(1500);
await p.click("[data-testid=collider-toggle]"); await wait(800);
const ci = await T("collider-info").innerText(); res.colliderInfo = ci;
ok(/体素凸分解/.test(ci) && /容差 [\d.]+ mm/.test(ci) && /\d+ 个盒/.test(ci), "PyPortal Titano：显示碰撞体 + 凸分解体素 / 外扩 / 容差", ci.slice(0, 120));
const rul = await p.$$eval("[data-testid=ruler-label]", (a) => a.map((x) => x.textContent)); res.titanoRuler = rul;
ok(rul.some((x) => /92\.3/.test(x)) && rul.some((x) => /65\.66|65\.7/.test(x)), "ada-4444 尺寸警告修好：标尺 92.3 × 65.66 mm（和 CAD 一致）", rul.join(" / "));
await shot("collider-titano", "part-viewer");
await search("SparkFun"); const anyGlb = await p.locator("[data-testid=parts-list] li[data-testid^=row-sfe-]").first().getAttribute("data-testid");
await p.click(`[data-testid=pick-${anyGlb.slice(4)}]`); await wait(1500);
if (!(await T("collider-info").count())) await p.click("[data-testid=collider-toggle]"); await wait(500);
const ci2 = await T("collider-info").innerText(); ok(/碰撞体：\d+ 个盒/.test(ci2), "其它零件也能显示碰撞体线框（说明来源）", ci2.slice(0, 80));
await p.click("[data-testid=collider-toggle]"); await wait(300); ok((await T("collider-info").count()) === 0, "碰撞体线框可以关掉");

// 引脚表：零件详情 → /pinouts
await search("Pico"); await p.click("[data-testid=pick-kc-raspberrypi_pico]"); await wait(800);
await p.waitForSelector("[data-testid=pinout-link]", { timeout: 20000 });
const pl = await T("pinout-link").innerText(); ok(/脚/.test(pl) && /3\.3 V/.test(pl), "Pico 详情有“引脚表”链接（脚数 + 3.3 V 逻辑）", pl);
await T("pinout-link").click(); await p.waitForURL(/\/pinouts\?b=/, { timeout: 20000 }); await p.waitForSelector("[data-testid=pinout-table]", { timeout: 20000 });
const rows = await p.locator("[data-testid=pinout-table] tbody tr").count(); const lg = await T("pinout-logic").innerText(); const src = await T("pinout-src").getAttribute("href");
ok(rows >= 40 && /不耐 5 V/.test(lg) && /^https:\/\//.test(src), "引脚表：Pico ≥ 40 脚，标“GPIO 不耐 5 V”，带来源 URL", `${rows} 行 · ${src}`); res.picoRows = rows;
await T("pinout-filter").fill("GPIO15"); await wait(300); const fr = await p.locator("[data-testid=pinout-table] tbody tr").count(); ok(fr >= 1 && fr < rows, "引脚表筛选 GPIO15", `${fr} 行`);
await T("pinout-filter").fill("");
const boards = await p.locator("[data-testid=pinout-list] [data-testid^=pinout-]").count(); res.boards = boards; ok(boards === 29, "引脚表共 29 块板 / 模块", String(boards));
await shot("pinouts-pico");
const l298 = await T("pinout-l298n-module"); if (await l298.count()) { await l298.click(); await wait(400); const tt = await T("pinout-title").innerText(); ok(/估算/.test(tt), "L298N 模块引脚顺序标“估算”", tt); } else ok(false, "L298N 在引脚表里");

// 指南 / 致谢
await p.goto(BASE + "/assembly/guide"); await wait(800); const gv = await T("guide-v21").innerText().catch(() => "");
ok(/3081/.test(gv) && /引脚表/.test(gv) && /碰撞体/.test(gv), "装配指南有 v21 更新说明");
await p.goto(BASE + "/credits"); await wait(800); const cr = await p.locator("body").innerText();
ok(/FreeCAD-library/.test(cr) && /CC BY 3\.0/.test(cr) && /引脚表（v21）/.test(cr), "素材页列出 FreeCAD-library（CC BY 3.0）和引脚表来源");
ok(errs.length === 0, "没有页面错误", errs.join(" | "));

// 限速首屏（≈ 慢速 4G：1.6 Mbit/s，150 ms RTT，禁用缓存）：首页 + /parts
const thr = async (path, sel) => {
  const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p2 = await c2.newPage();
  const cdp = await c2.newCDPSession(p2); await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  let bytes = 0, rapier = false; cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; }); cdp.on("Network.requestWillBeSent", (e) => { if (/rapier|worker/i.test(e.request.url)) rapier = true; });
  const t0 = Date.now(); await p2.goto(BASE + path, { waitUntil: "domcontentloaded" }); await p2.waitForSelector(sel, { timeout: 120000 }); const ms = Date.now() - t0;
  await p2.waitForTimeout(1000); await c2.close(); return { ms, kb: Math.round(bytes / 1024), rapier };
};
const home = await thr("/", "h1"); const parts = await thr("/parts", "[data-testid=parts-total]"); res.throttle = { home, parts };
ok(home.ms < 5000 && home.kb < 400 && !home.rapier, "限速首页：< 5 s、< 400 KB、不加载 Rapier", `${(home.ms / 1000).toFixed(1)} s，${home.kb} KB`);
ok(parts.ms < 12000 && parts.kb < 1500 && !parts.rapier, "限速 /parts 列表：< 12 s、< 1.5 MB、不加载 Rapier", `${(parts.ms / 1000).toFixed(1)} s，${parts.kb} KB`);

fs.writeFileSync(`${OUT}/logs/v21-bench.json`, JSON.stringify(res, null, 1));
await ctx.close();
if (SHOT) {
  const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm"));
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "setpts=0.6*PTS,scale=1280:-2" -c:v libx264 -crf 32 -preset veryfast -an ${OUT}/demo.mp4`); const mb = fs.statSync(`${OUT}/demo.mp4`).size / 1e6; ok(mb < 20, "demo.mp4 < 20 MB", mb.toFixed(1) + " MB"); res.demoMB = mb; }
}
await b.close();
console.log(`v21 走查：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
