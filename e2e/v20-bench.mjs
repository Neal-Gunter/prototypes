// v20：零件库浏览器走查。中英文搜索、分类 / 尺寸 / 接口 / 电压 / 许可 / 来源筛选、收藏和最近使用（刷新后保留）、两件对比、尺寸标尺、“用在哪里”链接、
// 程序生成零件 + 真实 CAD 抽样加载、装配台里也能搜到、素材页 / 指南 v20 章节、限速网络下的首屏加载
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v20 SHOTS=0 node e2e/v20-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v20", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv20";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const wait = (ms) => p.waitForTimeout(ms);
const T = (t) => p.locator(`[data-testid=${t}]`);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) { await T(t).scrollIntoViewIfNeeded(); await T(t).screenshot({ path: f, style: ".no-print.sticky { visibility: hidden !important; }" }); } else await p.screenshot({ path: f, style: ".no-print.sticky { visibility: hidden !important; }" }); };
const found = async () => +((await T("parts-found").innerText()).match(/找到 (\d+)/) || [])[1];
const search = async (q) => { await T("parts-search").fill(q); await wait(350); return found(); };
const names = () => p.$$eval("[data-testid=parts-list] li [data-testid^=pick-] span:first-child", (a) => a.slice(0, 40).map((x) => x.textContent));
const ids = () => p.$$eval("[data-testid=parts-list] li[data-testid^=row-]", (a) => a.slice(0, 40).map((x) => x.dataset.testid.slice(4)));

await p.goto(BASE + "/parts");
await p.waitForSelector("[data-testid=parts-total]", { timeout: 60000 });
const total = +(await T("parts-total").innerText()); res.total = total;
ok(total >= 2900, "零件库总数 ≥ 2900", String(total));
ok(/早期原型，简化仿真/.test(await p.locator("h1").innerText()), "标题带“早期原型，简化仿真”");
const all = await found(); ok(all === total, "不加条件时列表数 = 总数", `${all}`);
await shot("parts-page");

// 中英文搜索
const sv = await search("舵机"); const svN = await names(); const sv2 = await search("servo");
ok(sv > 5 && sv2 > 5, "“舵机”“servo”都能搜到", `舵机 ${sv}，servo ${sv2}`); res.servo = [sv, sv2];
ok(svN.slice(0, 12).every((x) => /舵机|servo/i.test(x)), "“舵机”前 12 个结果名称都含舵机 / servo（名称命中排在只命中分类名的前面）", `前 40 个里 ${svN.filter((x) => /舵机|servo/i.test(x)).length} 个：${svN.slice(0, 5).join(" | ")}`);
const rl = await search("继电器"), rl2 = await search("relay"); ok(rl > 0 && rl2 > 0, "“继电器”“relay”都能搜到", `${rl} / ${rl2}`); res.relay = [rl, rl2];
const rl5 = await search("继电器 5V"); ok(rl5 > 0 && rl5 <= rl, "多词搜索“继电器 5V”结果更少", `${rl5}`);
const b608 = await search("轴承 608"); ok(b608 >= 1 && (await names()).some((x) => /608/.test(x)), "“轴承 608”找到 608 轴承", (await names()).slice(0, 3).join(" | "));
const jx = await search("JST XH 4"); ok(jx >= 1, "“JST XH 4”有结果", `${jx}`);
const xt = await search("XT60"); ok(xt >= 1, "“XT60”有结果", `${xt}`);
const esp = await search("esp32"); ok(esp >= 20, "“esp32”至少 20 个（含乐鑫模组）", `${esp}`);
const nope = await search("zzqqxx不存在"); ok(nope === 0, "不存在的词 0 个结果");
await search("");

// 筛选
await T("f-cat").selectOption("motor"); const mot = await found(); ok(mot >= 50, "分类：电机 / 舵机 / 步进", `${mot}`);
await T("f-cat").selectOption("mech"); const mech = await found(); ok(mech >= 150, "分类：轴承 / 齿轮 / 型材", `${mech}`);
await T("f-cat").selectOption("all"); await T("f-kind").selectOption("real"); const real = await found();
await T("f-kind").selectOption("proc"); const proc = await found(); ok(real + proc === total && proc >= 500 && real >= 2400, "真实 CAD + 程序生成 = 总数", `${real} + ${proc}`); res.real = real; res.proc = proc;
await T("f-kind").selectOption("all");
const srcs = {}; for (const s of ["ada", "kicad", "sfe", "esp", "seeed", "proc"]) { const o = await T("f-src").locator(`option[value="${s}"]`).count(); if (!o) continue; await T("f-src").selectOption(s); srcs[s] = await found(); }
await T("f-src").selectOption("all"); res.src = srcs;
ok(srcs.sfe >= 150 && srcs.esp >= 20 && srcs.kicad >= 1500 && srcs.ada >= 400, "来源筛选：SparkFun / 乐鑫 / KiCad / Adafruit 数量", JSON.stringify(srcs));
const licO = await T("f-lic").locator("option").evaluateAll((a) => a.map((o) => o.value).filter((v) => v !== "all")); const lics = {};
for (const l of licO) { await T("f-lic").selectOption(l); lics[l] = await found(); } await T("f-lic").selectOption("all"); res.lic = lics;
ok(Object.values(lics).reduce((a, b) => a + b, 0) === total, "许可筛选各项之和 = 总数", JSON.stringify(lics));
const ifO = await T("f-iface").locator("option").evaluateAll((a) => a.map((o) => o.value).filter((v) => v !== "all"));
await T("f-iface").selectOption(ifO.includes("i2c") ? "i2c" : ifO[0]); const i2c = await found(); ok(i2c > 10 && i2c < total, "接口筛选（I²C）", `${i2c}`); await T("f-iface").selectOption("all");
const vO = await T("f-volt").locator("option").evaluateAll((a) => a.map((o) => o.value).filter((v) => v !== "all"));
await T("f-volt").selectOption((vO.includes("5") ? "5" : vO.find((v) => /^5/.test(v)) || vO[0])); const v5 = await found(); ok(v5 > 0 && v5 < total, "电压筛选", `${(vO.includes("5") ? "5" : vO.find((v) => /^5/.test(v)) || vO[0])} → ${v5}`); await T("f-volt").selectOption("all");
await T("f-min").fill("20"); await T("f-max").fill("30"); await wait(350); const sz = await found();
const dims = await p.$$eval("[data-testid=parts-list] li[data-testid^=row-] [data-testid^=pick-] span:nth-child(2)", (a) => a.slice(0, 40).map((x) => x.textContent.match(/([\d.]+) × ([\d.]+) × ([\d.]+)/)).filter((v) => v !== "all").map((m) => Math.max(+m[1], +m[2], +m[3])));
ok(sz > 0 && dims.length > 0 && dims.every((d) => d >= 19.95 && d <= 30.05), "尺寸筛选：最大边 20–30 mm", `${sz} 个，前 ${dims.length} 个最大边 ${Math.min(...dims)}–${Math.max(...dims)} mm`);
await T("f-min").fill(""); await T("f-max").fill(""); await wait(300);
await T("f-cat").selectOption("motor"); await shot("filters", "parts-browser"); await T("f-cat").selectOption("all");

// 详情 + 标尺 + 用在哪里
await search("Pico"); await p.click("[data-testid=pick-kc-raspberrypi_pico]"); await wait(400);
await p.waitForSelector("[data-testid=ruler-label]", { state: "attached", timeout: 60000 });
const rul = await p.$$eval("[data-testid=ruler-label]", (a) => a.map((x) => x.textContent));
ok(rul.length >= 3 && rul.some((x) => /^长 21 mm/.test(x)) && rul.some((x) => /^宽 52\.3 mm/.test(x)), "尺寸标尺：Pico 21 × 52.3 mm（CAD 包围盒，含 USB 座外伸）", rul.join(" / "));
await shot("ruler-pico", "parts-page");
await p.click("[data-testid=ruler-toggle]"); await wait(300); ok((await p.$$("[data-testid=ruler-label]")).length === 0, "标尺可以关掉"); await p.click("[data-testid=ruler-toggle]");
await p.waitForFunction(() => !/…/.test(document.querySelector("[data-testid=used-in]")?.textContent || "…"), null, { timeout: 20000 });
const used = await T("used-in").innerText(); ok(/装配指南/.test(used), "“用在哪里”：Pico 用在装配指南", used);
await T("used-in").locator("a").first().click(); await p.waitForURL(/\/assembly\/guide/, { timeout: 20000 }); await wait(800);
ok(await p.locator("[id='bom-kc-raspberrypi_pico']").count() === 1, "“用在哪里”跳到指南物料清单那一行", p.url().replace(BASE, ""));
await p.goBack(); await p.waitForSelector("[data-testid=parts-total]");

// 收藏 + 最近使用 + 刷新后还在
await search("608"); const bid = (await ids())[0]; await p.click(`[data-testid=fav-${bid}]`); await p.click(`[data-testid=pick-${bid}]`);
await search("XT60"); const xid = (await ids())[0]; await p.click(`[data-testid=pick-${xid}]`);
await p.reload(); await p.waitForSelector("[data-testid=parts-total]");
await T("f-view").selectOption("fav"); const favIds = await ids(); ok(favIds.includes(bid), "收藏刷新后还在", favIds.join(","));
await T("f-view").selectOption("recent"); const rec = await ids(); ok(rec[0] === xid && rec.includes(bid) && rec.includes("kc-raspberrypi_pico"), "最近使用按时间倒序、刷新后还在", rec.slice(0, 4).join(","));
await T("f-view").selectOption("all");

// 两件对比
await search("Pico"); await p.check("[data-testid=cmp-kc-raspberrypi_pico]");
await search("esp32-s3"); const eid = (await ids()).find((i) => /^esp-|^kc-/.test(i)) || (await ids())[0]; await p.check(`[data-testid=cmp-${eid}]`);
await p.waitForSelector("[data-testid=compare-panel]"); const cmpT = await T("compare-panel").innerText();
ok(/尺寸差/.test(cmpT) && /52\.3/.test(cmpT) && /许可/.test(cmpT), "两件对比：尺寸、尺寸差、许可并排", `Pico vs ${eid}`);
await shot("compare", "compare-panel");

// 程序生成零件和各来源抽样都能在 3D 里加载
const sample = ["p-nema17-40", "p-608zz", "p-2020-100", "p-xt60-male", "p-18650", "p-servo-mg996r"];
const pick1 = async (q) => { await search(q); const i = (await ids())[0]; if (!i) return null; await p.click(`[data-testid=pick-${i}]`); await p.waitForFunction(() => document.querySelectorAll("[data-testid=ruler-label]").length >= 3, null, { timeout: 60000 }).catch(() => {}); return { i, r: (await p.$$eval("[data-testid=ruler-label]", (a) => a.map((x) => x.textContent))).join(" / ") }; };
const loaded = []; for (const q of ["NEMA 17", "轴承 608", "2020 型材", "XT60", "18650", "25 kg 舵机", "SparkFun", "ESP32-C6", "XIAO"]) { const r = await pick1(q); loaded.push(r && r.r ? `${r.i}: ${r.r}` : `${q}: ✗`); }
ok(loaded.every((x) => !/✗/.test(x)) && loaded.every((x) => /mm/.test(x)), "抽样 9 个（程序生成 + SparkFun / 乐鑫 / Seeed）在 3D 预览里加载并标出尺寸", loaded.join(" | "));
void sample; res.loaded = loaded;

// 装配台里也能搜
await p.goto(BASE + "/assembly"); await p.waitForSelector("[data-testid=parts-search]", { timeout: 120000 });
await p.fill("[data-testid=parts-search]", "继电器"); await wait(400); const asmN = await found();
ok(asmN === rl, "装配台的零件面板用同一套搜索", `${asmN}`);

// 素材页 / 指南
await p.goto(BASE + "/credits"); await wait(800); const cr = await p.locator("body").innerText();
ok(/SparkFun KiCad Libraries/.test(cr) && /Espressif KiCad Libraries/.test(cr) && /Seeed Studio OPL KiCad Library/.test(cr) && /CC BY 4\.0/.test(cr), "素材页列出 v20 新来源和许可");
await p.goto(BASE + "/assembly/guide"); await wait(800); const gd = await p.locator("body").innerText();
ok(/零件库/.test(gd) && /2940/.test(gd), "装配指南有零件库（v20）章节");
ok(errs.length === 0, "没有页面错误", errs.join(" | "));

// 限速网络（≈ 慢速 4G：1.6 Mbit/s 下行，150 ms RTT）下 /parts 首屏
const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p2 = await c2.newPage();
const cdp = await c2.newCDPSession(p2); await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
let bytes = 0; const byType = {}; cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; }); cdp.on("Network.responseReceived", (e) => { const t = e.type; byType[t] = (byType[t] || 0) + 1; });
const t0 = Date.now(); await p2.goto(BASE + "/parts", { waitUntil: "domcontentloaded" });
await p2.waitForSelector("[data-testid=parts-total]", { timeout: 120000 }); const tList = Date.now() - t0;
await p2.waitForSelector("[data-testid=ruler-label]", { state: "attached", timeout: 180000 }); const t3d = Date.now() - t0;
await p2.waitForTimeout(1500); res.throttle = { listMs: tList, viewerMs: t3d, kb: Math.round(bytes / 1024), byType };
ok(tList < 15000 && bytes < 3 * 1048576, "限速 1.6 Mbit/s：列表 < 15 s、首屏下载 < 3 MB", `列表 ${(tList / 1000).toFixed(1)} s，3D 预览 ${(t3d / 1000).toFixed(1)} s，下载 ${(bytes / 1024).toFixed(0)} KB`);
await c2.close();

fs.writeFileSync(`${OUT}/logs/v20-bench.json`, JSON.stringify(res, null, 1));
await ctx.close();
if (SHOT) {
  const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm"));
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "setpts=0.6*PTS,scale=1280:-2" -c:v libx264 -crf 32 -preset veryfast -an ${OUT}/demo.mp4`); const mb = fs.statSync(`${OUT}/demo.mp4`).size / 1e6; ok(mb < 20, "demo.mp4 < 20 MB", mb.toFixed(1) + " MB"); }
}
await b.close();
console.log(`v20 走查：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
