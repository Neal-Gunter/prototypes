// v31：真实录屏演示（Playwright recordVideo，不是截图拼接）：拆解 → 引导项目 → 维修关卡 → 装配台。早期原型，简化仿真。
// v32：每一步记录在录像里的起止时间，写出中文字幕 demo.srt（OUT 目录），再用 ffmpeg 烧进视频
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v32 node e2e/demo-record.mjs  然后用 ffmpeg 转 mp4
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v31";
const LANG = process.env.LANG_UI || "zh", VD = `${OUT}/.video`;
fs.rmSync(VD, { recursive: true, force: true }); fs.mkdirSync(VD, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const c = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: VD, size: { width: 1280, height: 720 } } });
await c.addInitScript((l) => { try { localStorage.setItem("asm-tour-v22-done", "1"); localStorage.setItem("ui-lang", l); } catch { /* */ } }, LANG);
const p = await c.newPage(); const V0 = Date.now(); const subs = [];
const T = (t) => p.locator(`[data-testid="${t}"]`);
const w = (ms) => p.waitForTimeout(ms);
const log = [];
const step = async (name, fn, cap) => { const t0 = Date.now(); try { await fn(); if (cap) subs.push([t0 - V0, Date.now() - V0, cap]); log.push(`✓ ${name} ${Date.now() - t0}ms`); } catch (e) { log.push(`✗ ${name}: ${String(e).slice(0, 120)}`); } };
const scroll = async (dy, n = 6, ms = 250) => { for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await w(ms); } };
await step("首页", async () => { await p.goto(BASE + "/"); await w(2500); await scroll(300, 4); }, "首页：几个模块的入口（早期原型，简化仿真）");
await step("拆解：设备列表 + 搜索", async () => {
  await p.goto(BASE + "/teardown/"); await T("teardown-page").waitFor({ timeout: 30000 }); await w(1500);
  await T("td-search").pressSequentially("tp4056", { delay: 120 }); await w(1500); await T("td-search").fill(""); await w(800);
}, "拆解模式：按名称或型号搜设备");
await step("拆解：市电提示 + 9V LED 测试器", async () => {
  await T("td-search").pressSequentially("充电头", { delay: 120 }); await w(2500); await T("td-search").fill(""); await w(500);
  await p.goto(BASE + "/teardown/?d=led-tester-9v"); await T("td-guide").waitFor({ timeout: 20000 }); await w(1500); await scroll(350, 6, 400);
}, "只收低压直流设备：搜“充电头”会提示不拆市电设备；新加的 9V LED 测试器");
await step("拆解：LED 手电指南 + 爆炸图", async () => {
  await p.goto(BASE + "/teardown/?d=led-flashlight"); await T("td-guide").waitFor({ timeout: 20000 }); await w(1500);
  await scroll(350, 8, 400);
  if (await T("td-explode-canvas").count()) {
    await T("td-explode-canvas").scrollIntoViewIfNeeded();
    await p.waitForFunction(() => window.__tdExplode && window.__tdExplode.loaded === window.__tdExplode.total, null, { timeout: 60000 }).catch(() => {});
    for (const v of ["0.25", "0.5", "0.75", "1", "0.4"]) { await T("td-explode-slider").fill(v); await w(700); }
  }
}, "LED 手电拆解指南：步骤、停止点和爆炸图（按公开资料整理，未经实物验证）");
await step("引导项目：零件清单", async () => {
  await p.goto(BASE + "/project/"); await T("project-page").waitFor({ timeout: 30000 }); await w(2000);
  if (await T("bom-search").count()) { await T("bom-search").scrollIntoViewIfNeeded(); await T("bom-search").pressSequentially("ESP32", { delay: 120 }); await w(1500); }
  await scroll(300, 5);
}, "引导项目：零件清单可以搜索");
await step("维修关卡：选关 + 量电压", async () => {
  await p.goto(BASE + "/repair/"); await T("scenario-list").waitFor({ timeout: 30000 }); await w(1500);
  await p.locator("[data-testid^=sc-]").first().click(); await w(2500);
  if (await T("power").count()) { await T("power").click().catch(() => {}); await w(1200); }
  if (await T("meter").count()) { await T("meter").scrollIntoViewIfNeeded().catch(() => {}); await w(1500); }
  if (await T("hint").count()) { await T("hint").first().click().catch(() => {}); await w(2000); }
}, "维修关卡：选一关、通电、用万用表量电压、看提示");
await step("装配台：3D 场景", async () => {
  await p.goto(BASE + "/assembly/?scene=electrics"); await w(9000);
  const cv = p.locator("canvas").first();
  if (await cv.count()) { const bb = await cv.boundingBox(); if (bb) { const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2; await p.mouse.move(cx, cy); await p.mouse.down({ button: "left" }); for (let i = 0; i < 30; i++) { await p.mouse.move(cx + i * 8, cy + Math.sin(i / 5) * 20); await w(60); } await p.mouse.up(); await w(1500); await p.mouse.wheel(0, -400); await w(2000); } }
}, "装配台：3D 物理场景，拖动零件、缩放视角");
await step("工作台", async () => { await p.goto(BASE + "/workbench/"); await w(4000); await scroll(300, 4); }, "工作台：项目和零件的汇总");
const vid = p.video(); await c.close(); const path = await vid.path(); await b.close();
fs.copyFileSync(path, `${OUT}/demo-raw.webm`); fs.rmSync(VD, { recursive: true, force: true });
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.writeFileSync(`${OUT}/logs/demo-record.txt`, log.join("\n") + "\n");
const ts = (ms) => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, r = ms % 1000; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(r).padStart(3, "0")}`; };
fs.writeFileSync(`${OUT}/demo.srt`, subs.map(([a, z, t], i) => `${i + 1}\n${ts(a)} --> ${ts(z)}\n${t}\n`).join("\n"));
console.log(log.join("\n"), "\n字幕", subs.length, "条");
