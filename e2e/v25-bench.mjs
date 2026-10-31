// v25：引导项目“从零做一只八爪鱼”——6 步全部在浏览器里走一遍（含故意做错再改对）、下载制作单（MD + HTML）、刷新后进度还在、手机 / 宽屏。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v25 SHOTS=0 node e2e/v25-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v25", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv25";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
await ctx.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); } catch {} });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e))); p.on("dialog", (d) => d.accept());
const wait = (ms) => p.waitForTimeout(ms);
const T = (t) => p.locator(`[data-testid="${t}"]`);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) { await T(t).scrollIntoViewIfNeeded(); await T(t).screenshot({ path: f }); } else await p.screenshot({ path: f }); };
const verdict = async () => (await T("step-verdict").innerText()).trim();
const fails = async () => p.locator('[data-testid=check][data-state=fail]').allInnerTexts();
const done = async (k) => (await T(`step-${k}`).getAttribute("data-done")) === "1";

await p.goto(BASE + "/project"); await T("project-page").waitFor({ timeout: 60000 });
await p.evaluate(() => localStorage.removeItem("octo-project-v25")); await p.reload(); await T("project-page").waitFor();
ok(await T("nav-project").isVisible(), "导航里有“动手做”");
ok((await T("panel-bom").count()) === 1 && (await verdict()) === "未通过", "新项目从第 1 步“选零件”开始，未通过");
// ① BOM：真的在零件库里搜、加
await T("bom-search").fill("QT Py ESP32-S3"); await T("bom-add-ada-5426").waitFor({ timeout: 30000 }); await T("bom-add-ada-5426").click();
await T("bom-search").fill("ada-2201"); for (let i = 0; i < 7; i++) await T("bom-add-ada-2201").click();
ok((await T("bom-qty-ada-2201").innerText()) === "7", "舵机加了 7 个");
const f1 = await fails(); ok(f1.some((x) => /ada-2201 × 8（现在 7）/.test(x)), "检查指出少 1 个舵机", f1.find((x) => /2201/.test(x)));
await T("bom-add-ada-2201").click();
await T("bom-search").fill("ada-1185"); await T("bom-add-ada-1185").click();
ok((await p.locator('[data-testid=check][data-state=warn]').allInnerTexts()).some((x) => /清单外/.test(x)), "多加了清单外的零件 → 警告");
await shot("bom");
await T("auto-step").click(); await wait(200);
ok(await done("bom"), "示范补齐其余零件 → 第 1 步通过");
// 清单外的零件只是警告；删掉
await T("next-step").click();
// ② 装配：故意先放 QT Py（没骨架、没电池）
await T("asm-sel-QTPY").selectOption("QTPY"); await wait(100);
const f2 = await fails(); ok(f2.some((x) => /骨架/.test(x)) && f2.some((x) => /比电池先放/.test(x)), "QT Py 先放 → 提示先放骨架、先放电池", f2.slice(0, 2).join(" / "));
await T("asm-sel-BST1").selectOption("BST2"); await T("asm-sel-BST2").selectOption("BST2"); await wait(100);
const f2b = await fails(); ok(f2b.some((x) => /重叠/.test(x)), "两个升压放在同一位置 → 重叠", f2b.find((x) => /重叠/.test(x)));
await shot("assemble-wrong");
await T("auto-step").click(); await wait(200); ok(await done("assemble"), "示范摆放 → 第 2 步通过（无重叠、不超出上层板）");
await shot("assemble-ok", "deck-view");
await T("next-step").click();
// ③ 接线：手接一根对的、一根错的
await T("wire-a").selectOption("S0:PWM"); await T("wire-b").selectOption("QTPY:A0"); await T("wire-add").click();
await T("wire-a").selectOption("S1:PWM"); await T("wire-b").selectOption("QTPY:A0"); await T("wire-add").click(); await wait(100);
const f3 = await fails(); ok(f3.some((x) => /没有多余/.test(x)), "S1 也接到 A0 → 检查指出接错", f3.find((x) => /没有多余/.test(x)));
ok((await p.locator("[data-testid=hint]").allInnerTexts()).some((x) => /下一根/.test(x)), "提示下一根该接什么");
await T("wire-del-1").click();
await T("auto-step").click(); await wait(200); ok(await done("wire"), "示范补齐接线 → 第 3 步通过");
res.wires = await T("wire-count").innerText();
await T("next-step").click();
// ④ 焊接：插着电池焊 → 拒绝；连锡；助焊剂补焊
await T("bat-plug").click(); await T("pad-BST1:IN").click(); await wait(100);
ok(/拔电池/.test(await T("solder-msg").innerText()), "插着电池焊 → 拒绝", await T("solder-msg").innerText());
await T("bat-plug").click(); await T("solder-flux").uncheck(); await T("solder-t").fill("2.6"); await T("pad-BST1:IN").click(); await wait(100);
ok((await T("pad-BST1:IN").getAttribute("data-q")) === "bridge", "2.6 s 不加助焊剂 → 连锡", await T("solder-msg").innerText());
await T("solder-flux").check(); await T("solder-t").fill("1"); await T("pad-BST1:IN").click(); await wait(100);
ok((await T("pad-BST1:IN").getAttribute("data-q")) === "good", "加助焊剂补焊 → 合格");
await T("solder-t").fill("0.5"); await T("solder-flux").uncheck(); await T("pad-DIV:IN").click(); await wait(100);
ok(/太短|虚焊/.test(await T("solder-msg").innerText()), "0.5 s 没助焊剂 → 锡没上去 / 虚焊", await T("solder-msg").innerText());
await T("solder-mode").check(); await T("solder-flux").check(); await T("solder-t").fill("1"); await T("pad-BST1:IN").click(); await T("solder-t").fill("5"); await T("solder-mode").uncheck(); await T("pad-BST1:IN").click(); await T("solder-mode").check(); await T("pad-BST1:IN").click(); await wait(100);
ok((await T("pad-BST1:IN").getAttribute("data-q")) === "lifted", "拆焊加热 5 s → 焊盘翘起", await T("solder-msg").innerText());
await shot("solder");
await T("replace-BST1").click(); await T("solder-mode").uncheck(); await wait(100);
ok((await T("pad-BST1:IN").getAttribute("data-q")) === "", "换新板 → 焊点清空");
await T("auto-step").click(); await wait(200); ok(await done("solder"), "示范焊完其余焊点 → 第 4 步通过");
res.pads = await p.locator("[data-testid^='pad-']").count() - 1;
await T("next-step").click();
// ⑤ 仿真检查：没插电池不通过；插上通过
ok((await verdict()) === "未通过" && (await fails()).some((x) => /电池插上了/.test(x)), "电池没插 → 仿真检查不通过");
await T("bat-plug").click(); await wait(200);
res.rails = await T("rails").innerText();
ok((await verdict()) === "通过" && /5\.2 \/ 5\.2 V/.test(res.rails), "插上电池 → 网表 / 电源 / 固件全部通过", res.rails);
await T("sw-on").click(); await wait(200); ok((await verdict()) === "未通过", "开关 OFF → 升压不工作，检查不通过");
await T("sw-on").click(); await wait(200);
const mt = await T("meter-table").innerText(); ok(/OL/.test(mt) && /5\.2 V/.test(mt) && /估算/.test(mt), "万用表表格（通断 OL、5.2 V、估算标注）");
await shot("check");
const fwTxt = (await p.locator('[data-testid=check]').allInnerTexts()).join("\n"); ok(/kV10Pins \{18, 17, 9, 7, 6, 5, 16, 36\}/.test(fwTxt) && /编译通过/.test(fwTxt), "固件：引脚表和编译状态");
await T("next-step").click();
// ⑥ 装触手 + 制作单
await T("arms-on").click(); await wait(200);
ok(await done("finish"), "装上触手 → 6 步全部完成");
ok((await p.locator("[data-testid^=step-][data-done='1']").count()) === 6, "进度条 6/6");
ok(/按你完成的台面生成/.test(await T("sheet-status").innerText()), "制作单按完成的台面生成");
const [d1] = await Promise.all([p.waitForEvent("download"), T("sheet-md").click()]); const md = fs.readFileSync(await d1.path(), "utf8");
const [d2] = await Promise.all([p.waitForEvent("download"), T("sheet-html").click()]); const html = fs.readFileSync(await d2.path(), "utf8");
fs.writeFileSync(`${OUT}/logs/v25-sheet.md`, md); fs.writeFileSync(`${OUT}/logs/v25-sheet.html`, html);
ok(["零件清单", "接线表", "焊接顺序", "测试清单", "安全", "没有在实物上验证", "来源", "我的补充", "估算"].every((k) => md.includes(k) && html.includes(k)), `下载的 MD（${md.length} 字）和 HTML（${html.length} 字）章节齐全`);
ok(/A0（GPIO18）/.test(md) && /MIT/.test(md) && !/[$¥￥]\s*\d|\d\s*(元|美元|USD)/.test(md), "真实引脚名 + 许可证，无价格");
ok(/@media print/.test(html), "HTML 有打印样式");
const [pop] = await Promise.all([p.waitForEvent("popup"), T("sheet-print").click()]); await pop.waitForLoadState(); ok(/制作单/.test(await pop.title()), "打印版在新窗口打开"); await pop.close();
await T("sheet-preview").scrollIntoViewIfNeeded(); await wait(500); await shot("sheet", "sheet-preview");
// 刷新：进度还在
await p.reload(); await T("project-page").waitFor(); await wait(500);
ok((await p.locator("[data-testid^=step-][data-done='1']").count()) === 6, "刷新后进度还在（本机 localStorage）");
await T("step-solder").click(); ok((await T("pad-BST1:IN").getAttribute("data-q")) === "good", "刷新后焊点状态还在");
// 重置
await T("reset-project").click(); await wait(300);
ok((await p.locator("[data-testid^=step-][data-done='1']").count()) === 0, "重置项目 → 回到第 1 步");
await T("step-finish").click(); await wait(300);
ok(/参考设计/.test(await T("sheet-status").innerText()), "没做完时制作单注明按参考设计生成");
await shot("full");
// 手机 / 宽屏
for (const [w, h, tag] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) {
  const m = await b.newPage({ viewport: { width: w, height: h } }); const me = []; m.on("pageerror", (e) => me.push(String(e)));
  await m.goto(BASE + "/project"); await m.locator("[data-testid=project-page]").waitFor({ timeout: 60000 }); await m.waitForTimeout(600);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= w + 1 && !me.length, `${tag} ${w} 宽：不横向溢出（${sw}）`);
  await m.locator("[data-testid=auto-step]").click(); await m.waitForTimeout(200);
  ok((await m.locator("[data-testid=step-bom]").getAttribute("data-done")) === "1", `${tag}：示范按钮可点`);
  if (SHOT) await m.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${tag}.png`, fullPage: tag === "mobile" });
  await m.close();
}
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
fs.writeFileSync(`${OUT}/logs/v25-bench.json`, JSON.stringify({ pass, fail, res, errs }, null, 1));
await ctx.close(); await b.close();
if (SHOT) { const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm")); if (v) fs.copyFileSync(`${VID}/${v}`, `${OUT}/logs/v25-bench.webm`); }
console.log(`v25-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
