// v31：真实录屏演示（Playwright recordVideo，不是截图拼接）：拆解 → 引导项目 → 维修关卡 → 装配台。早期原型，简化仿真。
// v32：每一步记录在录像里的起止时间，写出中文字幕 demo.srt（OUT 目录），再用 ffmpeg 烧进视频
// v33：演示新设备换成 AA 电池玩具车。
// v34：加一段键盘操作 3D 场景（Tab 聚焦、方向键选零件、Alt + 方向键平移）和致谢页的 v34 调研。
// v35：新设备换成红外遥控器，加打印版指南（弹出页内容放回主页面录下来）、键盘 R 旋转、致谢页 v35。
// v36：新设备换成电子厨房计时器，打印版指南录目录 + 图例，键盘加 T / F 倾斜、N 摆正，致谢页 v36。
// v37：新设备换成电池感应小夜灯，打印版录二维码，再打开二维码指向的那一步；键盘倾斜来回按回原样、转不开时往旁边挪；致谢页 v37。
// v38：加题库目录、黄标、固件时序练习、模板代码检查、诊断跳转维修关卡、致谢页 v38。
// v39：题库扩到 50 题，演示新诊断题、CR2032 钥匙扣灯、打印目录页码、致谢页 v39。
// v40：演示学习路径、帮助页「本版更新」、致谢页 v40；题库列表等 bank-list-ready。
// v41：演示装配台新台面、示波器波形、题库/说明页字号，以及致谢页 v41 许可说明。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v33 node e2e/demo-record.mjs  然后用 ffmpeg 转 mp4
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

await step("题库：目录和新鲜度", async () => {
  await p.goto(BASE + "/bank"); await T("bank-index").waitFor({ timeout: 30000 }); await w(2500);
  await T("bank-cell-firmware-intermediate").scrollIntoViewIfNeeded(); await w(1500);
  await T("bank-cell-firmware-intermediate").click(); await T("bank-list-ready").waitFor({ timeout: 20000 }); await w(2000);
  await scroll(200, 3, 300);
}, "v38 题库：先加载目录，再点进一组。黄底表示最早过期日距今不到 30 天；过期条目仍可练习");
await step("题库：固件时序", async () => {
  await p.goto(BASE + "/bank?mode=firmware&diff=intro&id=fw-led-blink-01"); await T("bank-practice").waitFor({ timeout: 20000 }); await w(1500);
  const blink = "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(500);digitalWrite(LED_BUILTIN,LOW);delay(500);}";
  await T("bank-editor").fill(blink); await w(800);
  await T("bank-run").click(); await T("bank-result").waitFor({ timeout: 10000 }); await w(2500);
}, "固件题：用已有的类 Arduino 解释器跑代码，对照 LED 闪烁时序（简化仿真）");
await step("题库：模板代码检查", async () => {
  await p.goto(BASE + "/bank?mode=code-check&diff=advanced&id=cc-cpp-tpl-ring-01"); await T("bank-practice").waitFor({ timeout: 20000 }); await w(1200);
  const src = "template<typename T> class Slot {};\ntemplate<typename T, typename Buf = Slot<Slot<T>>> class RingBuffer {\npublic:\n  void push(const T&) {}\n};\n";
  await T("bank-editor").fill(src); await w(800);
  await T("bank-run").click(); await T("bank-result").waitFor({ timeout: 10000 }); await w(2500);
}, "代码检查：轻量 C/C++ 解析器识别模板类，模板参数里的 >> 也能跳过；不编译，不加载 WASM");
await step("题库：诊断连到维修关卡", async () => {
  await p.goto(BASE + "/bank?mode=diagnosis&diff=intro&id=dx-dead-battery-01"); await T("bank-quiz").waitFor({ timeout: 20000 }); await w(1500);
  await T("bank-opt-q1-b").click(); await w(800);
  await T("bank-run").click(); await T("bank-result").waitFor({ timeout: 8000 }); await w(2000);
  await T("bank-repair-link").scrollIntoViewIfNeeded(); await w(2000);
}, "v39 诊断题：小夜灯不亮先查电池，做完跳到已有的维修关卡 led-dead-battery");
await step("题库：学习路径", async () => {
  await p.goto(BASE + "/bank"); await T("bank-paths").waitFor({ timeout: 20000 }); await w(1500);
  await T("bank-path-path-night-light").scrollIntoViewIfNeeded(); await w(800);
  await T("bank-path-path-night-light").click(); await T("bank-path-detail").waitFor({ timeout: 10000 }); await w(2000);
  await scroll(200, 4, 300);
  await T("bank-path-link-1").click(); await T("bank-path-nav").waitFor({ timeout: 20000 }); await w(2500);
}, "v40：把拆解、诊断和维修关卡串成 3 到 5 步的学习路径；说明自己写，是简化仿真");
await step("使用说明：本版更新", async () => {
  await p.goto(BASE + "/help#whats-new"); await T("help-whats-new").waitFor({ timeout: 20000 }); await w(1500);
  await T("help-whats-new").scrollIntoViewIfNeeded(); await w(2000); await scroll(250, 6, 350);
}, "v41：使用说明「本版更新」汇总到 v41，说明按开源 frontend-design skill 润色了图形");
await step("拆解：设备列表 + 搜索", async () => {
  await p.goto(BASE + "/teardown/"); await T("teardown-page").waitFor({ timeout: 30000 }); await w(1500);
  await T("td-search").pressSequentially("tp4056", { delay: 120 }); await w(1500); await T("td-search").fill(""); await w(800);
}, "拆解模式：按名称或型号搜设备");
await step("拆解：市电提示 + 钥匙扣灯", async () => {
  await T("td-search").pressSequentially("充电头", { delay: 120 }); await w(2500); await T("td-search").fill(""); await w(500);
  await T("td-search").pressSequentially("钥匙扣", { delay: 120 }); await w(1500); await T("td-search").fill(""); await w(400);
  await p.goto(BASE + "/teardown/?d=coin-keyfob"); await T("td-guide").waitFor({ timeout: 20000 }); await w(1500); await scroll(350, 6, 400);
}, "只收低压直流设备：搜“充电头”会提示不拆市电设备；v39 新加的 CR2032 钥匙扣灯（3 V，按公开资料整理，未经实物验证）");
await step("拆解：打印版指南", async () => {
  await T("td-print-bar").scrollIntoViewIfNeeded(); await w(1200);
  const [pop] = await Promise.all([c.waitForEvent("page", { timeout: 10000 }), T("td-print").click()]);
  await pop.waitForLoadState("load"); const html = await pop.content(); await pop.close(); await w(800);
  await p.setContent(html); await w(2500); await scroll(400, 10, 450);
}, "v37：打印版封面和每一步旁边都有二维码，扫码打开网页版的那一步（二维码在浏览器里生成，不上传）；v36：目录和页码");
await step("拆解：二维码打开的那一步", async () => {
  await p.goto(BASE + "/teardown/?d=coin-keyfob&s=3"); await T("td-guide").waitFor({ timeout: 20000 }); await w(3500);
  await p.keyboard.press("Tab"); await w(1500);
}, "二维码网址带步号（…&s=3），打开后直接滚到第 3 步并把键盘焦点放在这一步上");
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
}, "v41：装配台台面换成带切割垫细格的木纹，灯光和阴影更软，导线颜色更接近 PVC");
await step("装配台：示波器", async () => {
  await T("tab-elec").click().catch(() => {});
  const details = T("bench-scope-panel");
  await details.waitFor({ timeout: 20000 });
  await details.scrollIntoViewIfNeeded();
  if ((await details.getAttribute("open")) == null) await details.locator("summary").first().click();
  await w(400);
  await T("bench-scope-open").click();
  await T("bench-scope").waitFor({ timeout: 20000 });
  await T("mscope").waitFor({ timeout: 20000 });
  if (await T("mscope-capture").count()) await T("mscope-capture").click();
  await w(4500);
}, "v41：示波器改成更深的磷光屏、更细的刻度和略粗带一点辉光的波形；读数在纸色底上用过对比度的颜色");
await step("装配台：键盘操作", async () => {
  await T("asm-a11y").focus(); await w(800);
  for (let i = 0; i < 3; i++) { await p.keyboard.press("ArrowRight"); await w(700); }
  for (let i = 0; i < 4; i++) { await p.keyboard.press("Alt+ArrowRight"); await w(450); }
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Alt+ArrowUp"); await w(450); }
  for (let i = 0; i < 2; i++) { await p.keyboard.press("r"); await w(900); }
  await p.keyboard.press("t"); await w(1200); await p.keyboard.press("f"); await w(1200); await p.keyboard.press("Shift+f"); await w(900); await p.keyboard.press("Shift+t"); await w(900);
  for (let i = 0; i < 6; i++) { await p.keyboard.press("r"); await w(700); }
  await p.keyboard.press("Alt+r"); await w(600); await p.keyboard.press("n"); await w(900);
  await p.keyboard.press("Enter"); await w(1200);
}, "v37：倾斜改用四元数叠加，来回按回到原样、朝向不漂；原地转不开时往旁边找空位并读出挪了多少；v36：T 前后倾、F 左右倾（Shift 反向，Alt 15°），N 摆正到 90°，角度自动吸附，倾斜后放不下会先抬起；v35：键盘也能转零件——R 转 90°，Alt + R 转 15°，会穿模时不转；v34：3D 场景可以用键盘操作——Tab 聚焦，方向键选零件，Alt + 方向键平移 1 cm，读屏会读出选中的零件和位置");
await step("致谢：v37", async () => {
  await p.goto(BASE + "/credits#v37-qr"); await w(1500);
  await T("credits-v37").scrollIntoViewIfNeeded().catch(() => {}); await w(3500);
}, "v37：二维码编码用 uqr（MIT），测试里用 jsQR（Apache-2.0）解码核对；新增 11 个页面的键盘焦点顺序检查");
await step("致谢：v38", async () => {
  await p.goto(BASE + "/credits#v38-bank"); await w(1500);
  await T("credits-v38").scrollIntoViewIfNeeded().catch(() => {}); await w(2500);
}, "v38：题面全部自己写；fromthetransistor 只取标题和 LOC；NASA 公有领域资料用自己的话；tree-sitter 只在构建期使用");
await step("致谢：v39", async () => {
  await p.goto(BASE + "/credits#v39-fresh"); await w(1500);
  await T("credits-v39").scrollIntoViewIfNeeded().catch(() => {}); await w(2500);
}, "v39：内容 hash 只算题面；Actions 默认离线；找空位不推出桌边并会试叠高；焦点环对比度至少 3:1；打印目录带页码");
await step("致谢：v40", async () => {
  await p.goto(BASE + "/credits#v40-paths"); await w(1500);
  await T("credits-v40").scrollIntoViewIfNeeded().catch(() => {}); await w(2500);
}, "v40：章节跨页时回填打印目录页码；题库列表等加载完成再检查；学习路径说明和使用说明「本版更新」都是自己写的");
await step("致谢：v41", async () => {
  await p.goto(BASE + "/credits#v41-ui"); await w(1500);
  await T("credits-v41").scrollIntoViewIfNeeded().catch(() => {}); await w(4000);
}, "v41：视觉参考是 Apache-2.0 的 frontend-design skill；规则用自己的话写下，没有把 skill 原文写进产品，也没有加新的网页字体");
await step("工作台：固件编辑器", async () => {
  await p.goto(BASE + "/workbench/"); await T("code").waitFor({ timeout: 30000 }); await w(2500);
  await T("code").focus(); await w(800); await p.keyboard.press("Tab"); await w(1500);
}, "v37：修好了固件编辑器的焦点陷阱——用 Tab 进来时 Tab 照常移到下一个控件，开始打字后才缩进，Esc 恢复");
const vid = p.video(); await c.close(); const path = await vid.path(); await b.close();
fs.copyFileSync(path, `${OUT}/demo-raw.webm`); fs.rmSync(VD, { recursive: true, force: true });
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.writeFileSync(`${OUT}/logs/demo-record.txt`, log.join("\n") + "\n");
const ts = (ms) => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, r = ms % 1000; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(r).padStart(3, "0")}`; };
fs.writeFileSync(`${OUT}/demo.srt`, subs.map(([a, z, t], i) => `${i + 1}\n${ts(a)} --> ${ts(z)}\n${t}\n`).join("\n"));
console.log(log.join("\n"), "\n字幕", subs.length, "条");
