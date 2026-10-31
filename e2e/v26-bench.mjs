// v26：实测对比——填读数、偏差标记、校准建议 → 应用 / 撤销用户校准、照片只存本机、JSON 导出 / 导入、示例数据标明、制作单 4b、刷新、手机 / 宽屏。
// 这里填的数都是测试输入或“示例数据（不是实测）”，不是真实测量。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v26 SHOTS=0 node e2e/v26-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v26", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv26";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ slowMo: SHOT ? 120 : 0, executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
await ctx.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); } catch {} });
const p = await ctx.newPage(); const errs = []; const posts = [];
p.on("pageerror", (e) => errs.push(String(e))); p.on("dialog", (d) => d.accept());
p.on("request", (r) => { if (r.method() !== "GET" || /data:image/.test(r.url())) posts.push(`${r.method()} ${r.url().slice(0, 80)}`); });
const wait = (ms) => p.waitForTimeout(ms);
const T = (t) => p.locator(`[data-testid="${t}"]`);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) { await T(t).scrollIntoViewIfNeeded(); await T(t).screenshot({ path: f }); } else await p.screenshot({ path: f }); };
const st = async (id) => T(`m-st-${id}`).getAttribute("data-status");

await p.goto(BASE + "/project"); await T("project-page").waitFor({ timeout: 60000 });
await p.evaluate(() => { localStorage.removeItem("octo-project-v25"); localStorage.removeItem("octo-measure-photos-v26"); }); await p.reload(); await T("project-page").waitFor();
await p.waitForFunction(() => window.__project); await wait(300);
for (const k of ["bom", "assemble", "wire", "solder"]) { await T(`step-${k}`).click(); await T("auto-step").click(); await wait(100); }
await T("step-check").click(); await T("bat-plug").click(); await wait(200);
ok((await T("step-verdict").innerText()).trim() === "通过", "前 4 步示范 + 插电池 → 仿真检查通过");
await T("measure-panel").scrollIntoViewIfNeeded();
const rows = await p.locator("[data-testid^=m-row-]").count();
ok(rows >= 14 && (await p.locator("[data-testid^=m-row-][data-status=est]").count()) === rows, `实测对比 ${rows} 项，没填时全是“仅估算”`);
ok(/0 · .*仅估算 \d+ \/ \d+/.test(await T("measure-counts").innerText()), "计数", await T("measure-counts").innerText());
ok(/5\.2 V/.test(await T("m-est-v-bst1-on").innerText()), "升压估算 5.2 V（页面数字）");
// 手填（测试输入，不是实测）
await T("m-in-v-bst1-on").fill("5.18"); await wait(100);
ok((await st("v-bst1-on")) === "ok" && /已在实物上验证/.test(await T("m-st-v-bst1-on").innerText()), "填 5.18 V → 已在实物上验证", await T("m-txt-v-bst1-on").innerText());
await T("m-in-v-bst1-on").fill("4.6"); await wait(100);
ok((await st("v-bst1-on")) === "dev" && /偏差 -0\.6/.test(await T("m-txt-v-bst1-on").innerText()), "填 4.6 V → 有偏差，显示偏差", await T("m-txt-v-bst1-on").innerText());
ok(/升压 IN/.test(await T("cal-sug-v-bst1-on").innerText()), "偏差 → 建议先查升压 IN（不校准）");
ok((await T("step-meas-check").getAttribute("data-status")) === "dev", "步骤条上“仿真检查”标红点（有偏差）");
await T("m-in-c-bat-short").fill("0.3"); await wait(100);
ok((await st("c-bat-short")) === "dev" && /短路/.test(await T("cal-sug-c-bat-short").innerText()), "该 OL 却读到 0.3 Ω → 提示短路 / 连锡");
await T("m-in-c-bat-short").fill("OL"); await T("m-in-c-gnd").fill("2.5"); await wait(100);
ok(/接触电阻/.test(await T("cal-sug-c-gnd").innerText()), "GND 2.5 Ω → 建议查接触电阻", (await T("cal-sug-c-gnd").innerText()).slice(0, 80));
await T("cal-apply-c-gnd").click(); await wait(100);
ok(/接触电阻/.test(await T("cal-active-rContact").innerText()) && (await st("c-gnd")) === "cal", "应用 → 用户校准生效中，那一条标“已按这条实测校准”");
await T("cal-undo-rContact").click(); await wait(100);
ok((await T("cal-active").count()) === 0 && (await st("c-gnd")) === "dev", "撤销 → 回到默认估算、仍有偏差");
await shot("measure-user");
// 照片（只存本机）
const png = await p.screenshot({ clip: { x: 0, y: 0, width: 200, height: 120 } });
const [fc] = await Promise.all([p.waitForEvent("filechooser"), T("m-photo-add-v-bst1-on").click()]); await fc.setFiles({ name: "meter.png", mimeType: "image/png", buffer: png });
await T("m-photo-v-bst1-on").waitFor({ timeout: 5000 });
const ph = await p.evaluate(() => JSON.parse(localStorage.getItem("octo-measure-photos-v26") || "{}"));
ok(ph["v-bst1-on"]?.startsWith("data:image/jpeg") && !posts.length, `照片缩小后存在本机 localStorage（${Math.round((ph["v-bst1-on"] || "").length / 1024)} KB），没有任何上传请求`, posts.join(" "));
res.photoKB = Math.round((ph["v-bst1-on"] || "").length / 1024);
// 导出（默认不带照片）
const [d0] = await Promise.all([p.waitForEvent("download"), T("measure-export").click()]); const j0 = JSON.parse(fs.readFileSync(await d0.path(), "utf8"));
ok(j0.kind === "octo-measure" && j0.items["v-bst1-on"].raw === "4.6" && !j0.photos && /北京时间/.test(j0.exported), "导出 JSON：有读数、默认不带照片");
await T("measure-export-photos").check();
const [d1] = await Promise.all([p.waitForEvent("download"), T("measure-export").click()]); const j1path = `${OUT}/logs/v26-measure-test-input.json`; fs.copyFileSync(await d1.path(), j1path);
ok(!!JSON.parse(fs.readFileSync(j1path, "utf8")).photos?.["v-bst1-on"], "勾选后导出带照片");
await T("measure-clear").click(); await wait(100);
ok((await p.locator("[data-testid^=m-row-][data-status=est]").count()) === rows && (await T("m-photo-v-bst1-on").count()) === 0, "清空实测 → 全回到仅估算、照片删掉");
await T("measure-import-file").setInputFiles(j1path); await wait(200);
ok((await T("m-in-v-bst1-on").inputValue()) === "4.6" && (await T("m-photo-v-bst1-on").count()) === 1 && /导入了/.test(await T("measure-note").innerText()), "导入 JSON → 读数和照片回来了", await T("measure-note").innerText());
await T("measure-import-file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"kind":"nope"}') }); await wait(100);
ok(/不是实测对比/.test(await T("measure-note").innerText()), "坏文件 → 拒绝导入");
// 示例数据
await T("measure-example").click(); await wait(200);
ok(await T("example-banner").isVisible(), "示例数据 → 醒目的“示例数据（不是实测）”提示");
const exTxt = (await p.locator("[data-testid^=m-st-]").allInnerTexts()).filter((x) => x !== "仅估算");
ok(exTxt.length >= 14 && exTxt.every((x) => /示例数据/.test(x)), `示例数据的 ${exTxt.length} 个标记都写“示例数据”，没有一个写“已在实物上验证”`);
ok((await st("v-bat-load")) === "dev" && /电池内阻/.test(await T("cal-sug-v-bat-load").innerText()), "示例：负载压降偏大 → 建议电池内阻", (await T("cal-sug-v-bat-load").innerText()).slice(0, 90));
const railsBefore = await T("rails").innerText();
await T("cal-apply-v-bat-load").click(); await wait(200);
const railsAfter = await T("rails").innerText();
ok(/示例数据/.test(await T("cal-active-rint").innerText()) && (await st("v-bat-load")) === "cal", "应用到仿真：用户校准（标明来自示例数据）");
ok(railsBefore !== railsAfter, "仿真电源读数按校准重算", `${railsBefore} → ${railsAfter}`);
res.railsBefore = railsBefore; res.railsAfter = railsAfter;
res.sug = (await p.locator("[data-testid^=cal-sug-]").allInnerTexts()).map((x) => x.split("\n")[0]);
await shot("measure-example", "measure-panel");
await T("cal-panel").scrollIntoViewIfNeeded(); await shot("calibration", "cal-panel");
// 刷新：实测、校准还在
await p.reload(); await T("project-page").waitFor(); await wait(400); await T("step-check").click(); await wait(200);
ok((await T("m-in-v-bat-off").inputValue()) === "4.02" && (await T("cal-active-rint").count()) === 1, "刷新后实测和用户校准还在（本机 localStorage）");
// 制作单
await T("next-step").click(); await T("arms-on").click(); await wait(200);
ok(/示例数据/.test(await T("measure-summary").innerText()) && /用户校准生效中/.test(await T("measure-summary").innerText()), "制作单一步：实测汇总（示例数据 + 用户校准）", await T("measure-summary").innerText());
const [s1] = await Promise.all([p.waitForEvent("download"), T("sheet-md").click()]); const md = fs.readFileSync(await s1.path(), "utf8");
const [s2] = await Promise.all([p.waitForEvent("download"), T("sheet-html").click()]); const html = fs.readFileSync(await s2.path(), "utf8");
fs.writeFileSync(`${OUT}/logs/v26-sheet.md`, md); fs.writeFileSync(`${OUT}/logs/v26-sheet.html`, html);
ok(md.includes("## 4b. 实测对比") && html.includes("4b. 实测对比") && md.includes("### 用户校准") && md.includes("电池内阻 ="), `制作单 MD（${md.length} 字）/ HTML（${html.length} 字）有 4b 实测对比和用户校准`);
ok((md.match(/示例数据/g) || []).length >= 15 && html.includes('class="ex"'), "制作单处处标“示例数据（不是实测）”");
ok(!/\| 已在实物上验证 \|/.test(md), "示例数据从不写成“已在实物上验证”");
await T("sheet-preview").scrollIntoViewIfNeeded(); await wait(400);
await p.evaluate(() => { const f = document.querySelector("[data-testid=sheet-preview]"); const h = f.contentDocument.querySelector("h2:nth-of-type(5)"); h?.scrollIntoView(); });
await wait(300); await shot("sheet-4b", "sheet-preview");
// 全部撤销
await T("goto-measure").click(); await wait(200); await T("cal-undo-all").click(); await wait(100);
ok((await T("cal-active").count()) === 0, "全部撤销 → 没有用户校准");
// 重置也清掉实测和照片
await T("reset-project").click(); await wait(300);
const after = await p.evaluate(() => ({ s: JSON.parse(localStorage.getItem("octo-project-v25")), ph: JSON.parse(localStorage.getItem("octo-measure-photos-v26") || "{}") }));
ok(!after.s.measure && !Object.keys(after.ph).length, "重置项目 → 实测记录和照片也清空");
// 手机 / 宽屏（仿真检查一步，带实测面板）
for (const [w, h, tag] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) {
  const m = await b.newPage({ viewport: { width: w, height: h } }); const me = []; m.on("pageerror", (e) => me.push(String(e)));
  await m.goto(BASE + "/project?step=check"); await m.locator("[data-testid=project-page]").waitFor({ timeout: 60000 }); await m.waitForTimeout(400);
  await m.evaluate(() => { const P = window.__project; let s = P.state; for (const k of ["bom", "assemble", "wire", "solder", "check"]) s = P.P.autoStep(s, k); P.set(P.Mz.loadExample(s)); }); await m.waitForTimeout(300);
  await m.locator("[data-testid=measure-panel]").waitFor();
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= w + 1 && !me.length, `${tag} ${w} 宽：带实测面板不横向溢出（${sw}）`);
  const inp = m.locator("[data-testid=m-in-v-33-on]"); await inp.scrollIntoViewIfNeeded(); const bb = await inp.boundingBox();
  ok(bb && bb.x >= 0 && bb.x + bb.width <= w + 1, `${tag}：输入框在屏幕内`);
  if (SHOT) { await m.locator("[data-testid=measure-panel]").scrollIntoViewIfNeeded(); await m.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${tag}.png` }); }
  await m.close();
}
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
fs.writeFileSync(`${OUT}/logs/v26-bench.json`, JSON.stringify({ pass, fail, res, errs, note: "所有读数是测试输入或示例数据（不是实测）" }, null, 1));
await ctx.close(); await b.close();
if (SHOT) { const v = fs.readdirSync(VID).filter((f) => f.endsWith(".webm")).sort((x, y) => fs.statSync(`${VID}/${y}`).size - fs.statSync(`${VID}/${x}`).size)[0]; if (v) fs.copyFileSync(`${VID}/${v}`, `${OUT}/logs/v26-demo.webm`); }
console.log(`v26-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
