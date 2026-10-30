// v22：引脚物理位置（悬停标签 + 间距提示 + 表笔落到贴片焊盘）、新手导览（可跳过、记住）、命令面板 Ctrl/Cmd-K、指南 / 致谢
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v22 SHOTS=0 node e2e/v22-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v22", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv22";
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

// 1) 新手导览：?tour=1 强制打开；8 步；跳过后记住
await p.goto(BASE + "/assembly?tour=1"); await p.waitForFunction(() => window.__asm, null, { timeout: 60000 }); await wait(800);
ok(await T("tour").isVisible(), "装配台首次导览出现（?tour=1）");
const titles = [];
for (let i = 0; i < 8; i++) { titles.push(await T("tour-title").innerText()); if (i === 0 || i === 3) await shot(`tour-${i + 1}`); if (i < 7) { await T("tour-next").click(); await wait(250); } }
res.tour = titles; ok(titles.length === 8 && new Set(titles).size === 8, "导览 8 步，各不相同", titles.join(" / "));
for (const w of ["装配", "接线", "万用表", "示波器", "维修模式", "零件库", "上传模型", "连接实物"]) ok(titles.includes(w), `导览包含“${w}”`);
ok(await T("tour-ring").count() > 0, "最后一步高亮了“八爪鱼”页签");
await T("tour-next").click(); await wait(200);
ok(!(await T("tour").count()), "点“完成”后导览关闭");
ok(await p.evaluate(() => localStorage.getItem("asm-tour-v22-done")) === "1", "关闭记在本机 localStorage");
await p.goto(BASE + "/assembly"); await p.waitForFunction(() => window.__asm, null, { timeout: 60000 }); await wait(500);
ok(!(await T("tour").count()), "再次打开装配台不再自动弹导览");
await T("tour-btn").click(); await wait(300); ok(await T("tour").isVisible(), "“新手导览”按钮能重新打开");
await T("tour-skip").click(); await wait(200); ok(!(await T("tour").count()), "“跳过”能关掉");

// 2) 引脚悬停：CAD（Pico）、封装（UNO）、CAD 量出（L298N）、贴片焊盘（WROOM）、间距警告（HC-SR04）
const uids = await p.evaluate(async () => { const o = {}; for (const [id, x, z] of [["kc-raspberrypi_pico", -12, 0], ["p-fp-arduino-uno-r3", 8, 0], ["fc-l298n", 0, 12], ["kc-esp32-wroom-32e", -3, 3], ["fc-hc-sr04", 10, 12]]) o[id] = await window.__asm.addAt(id, x, z, 0.3); return o; });
await wait(4500);
const hover = async (id, k) => {
  const s = await p.evaluate(([u, k]) => window.__pinScreen(u, k), [uids[id], k]); if (!s) return "no-pin";
  for (let a = 0; a < 3; a++) { // 物理刚落定时可能还在微动：最多重试 3 次
    await p.mouse.move(s.x - 4, s.y); await p.mouse.move(s.x, s.y); await wait(400);
    const t = await T("pin-hover").innerText({ timeout: 500 }).catch(() => "none"); if (t !== "none") return t.replace(/\n/g, " | ");
    await p.mouse.move(5, 5); await wait(300);
  }
  return "none";
};
const hp = await hover("kc-raspberrypi_pico", "p0"); res.hoverPico = hp;
ok(/GPIO0/.test(hp) && /CAD 模型（已核对）/.test(hp) && /2\.54 mm/.test(hp) && /面包板/.test(hp), "Pico 1 脚悬停：GPIO0 · KiCad 封装 → CAD 模型 · 2.54 mm", hp);
await shot("pin-hover-pico");
const hu = await hover("p-fp-arduino-uno-r3", "p5"); res.hoverUno = hu; ok(/引脚/.test(hu) && /数据手册焊盘图/.test(hu), "UNO 悬停：来源 = KiCad 封装（数据手册焊盘图）", hu);
const hl = await hover("fc-l298n", "l100"); res.hoverL298 = hl; ok(/ENA/.test(hl) && /CAD 模型量出/.test(hl), "L298N 排针悬停：ENA · CAD 模型量出", hl);
const hw = await hover("kc-esp32-wroom-32e", "s0"); res.hoverWroom = hw; ok(/贴片焊盘/.test(hw) && /1\.27 mm/.test(hw), "WROOM 贴片焊盘悬停：间距 1.27 mm", hw);
await shot("pin-hover-wroom");
const hcKeys = await p.evaluate((u) => Object.keys(window.__asm.engine.parts.get(u).def.physPins || {}), uids["fc-hc-sr04"]);
let hh = "none"; for (const k of hcKeys) { hh = await hover("fc-hc-sr04", k); if (hh !== "none" && hh !== "no-pin") break; }
res.hcKeys = hcKeys; res.hoverHc = hh; ok(/2\.0 mm/.test(hh) && /2\.54/.test(hh), "HC-SR04：界面照实提示 CAD 模型间距 2.0 mm（实物 2.54 mm）", hh);
await shot("pin-hover-hcsr04");
// 表笔点到贴片焊盘：标签是“名（贴片焊盘 n）”
await T("tool-meter").click(); const s = await p.evaluate((u) => window.__pinScreen(u, "s0"), uids["kc-esp32-wroom-32e"]);
await p.mouse.click(s.x, s.y); await wait(500); await T("tab-elec").click(); await wait(400);
const red = await p.locator("text=红：").first().innerText().catch(() => ""); res.meterPad = red;
ok(/贴片焊盘/.test(red), "表笔点到 WROOM 焊盘：读数页显示“贴片焊盘 n”", red.slice(0, 80));
const pinCount = await p.evaluate(() => { let n = 0; for (const P of window.__asm.engine.parts.values()) n += Object.keys(P.def.physPins || {}).length; return n; }); res.pinsOnBench = pinCount;
ok(pinCount > 60, "台面上 5 块板的物理引脚都映射到了", String(pinCount));
ok(await p.evaluate(() => window.__asm.overlapTest().ok !== false), "放了 5 块板后没有穿模");

// 3) 命令面板
await p.keyboard.press("Escape"); await p.mouse.click(700, 120);
await p.keyboard.press("Control+k"); await wait(400); ok(await T("palette").isVisible(), "Ctrl+K 打开命令面板");
await T("palette-input").fill("零件库"); await wait(200); await shot("palette-pages");
await T("palette-input").press("Enter"); await p.waitForURL(/\/parts/, { timeout: 15000 }); ok(/\/parts/.test(p.url()), "面板跳页面：零件库", p.url());
await p.keyboard.press("Control+k"); await wait(300); await T("palette-input").fill("wroom 32e"); await p.waitForFunction(() => document.querySelectorAll("[data-testid=palette-item]").length > 0, null, { timeout: 30000 }); await wait(200);
const it0 = await T("palette-item").first().innerText(); ok(/零件/.test(it0) && /wroom/i.test(it0), "面板搜零件：WROOM-32E", it0.replace(/\n/g, " "));
await shot("palette-parts");
await T("palette-input").press("Enter"); await p.waitForURL(/id=kc-esp32/, { timeout: 15000 }); ok(/id=kc-esp32/.test(p.url()), "回车跳到零件详情", p.url());
await p.keyboard.press("Meta+k"); await wait(300); ok(await T("palette").isVisible(), "Cmd+K 也能打开");
await T("palette-input").fill("夜灯不亮"); await wait(300); await T("palette-input").press("Enter"); await p.waitForURL(/\/repair\?s=/, { timeout: 15000 });
await wait(800); const rt = await p.locator("body").innerText(); ok(/夜灯不亮了/.test(rt), "面板跳场景：维修关卡“夜灯不亮了”", p.url());
await T("palette-btn").click(); await wait(300); await T("palette-input").fill("八爪鱼方案 B"); await wait(200); await T("palette-input").press("Enter"); await p.waitForURL(/scene=octoB/, { timeout: 15000 }); ok(/scene=octoB/.test(p.url()), "面板跳装配场景：八爪鱼方案 B", p.url());
await p.keyboard.press("Control+k"); await wait(300); await p.keyboard.press("Escape"); await wait(200); ok(!(await T("palette").count()), "Esc 关闭面板");

// 4) 指南 / 致谢 / README 关键字
await p.goto(BASE + "/assembly/guide"); await wait(800); const g = await p.locator("main").innerText();
ok(/v22/.test(g) && /引脚/.test(g) && /导览/.test(g) && /Ctrl/.test(g), "装配台说明有 v22 一节（引脚位置、导览、命令面板）");
await p.goto(BASE + "/credits"); await wait(600); const c = await p.locator("main").innerText();
ok(/a337146e/.test(c) && /8975715/.test(c) && /dd765618/.test(c), "致谢列出 KiCad 封装库 / 3D 库 / Espressif 封装的版本");
ok(errs.length === 0, "页面没有报错", errs.slice(0, 3).join(" | "));
fs.writeFileSync(`${OUT}/logs/v22-bench.json`, JSON.stringify({ pass, fail, res, errs }, null, 1));
await ctx.close(); await b.close();
if (SHOT) { const v = fs.readdirSync(VID).filter((f) => f.endsWith(".webm"))[0]; if (v) fs.copyFileSync(`${VID}/${v}`, `${OUT}/logs/v22-bench.webm`); }
console.log(`v22-bench：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
