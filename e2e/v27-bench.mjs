// v27：使用说明页（/help，中 / 英）、导航和命令面板入口、4 个新示例场景、≥ 21 个维修关卡、英文整页翻译层（手写词典 + 离线机翻，标“机器辅助翻译”）、切回中文还原、零件详情英文标签、手机 / 宽屏。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v27 SHOTS=0 node e2e/v27-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v27", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv27";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = { cover: {} };
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ slowMo: SHOT ? 80 : 0, executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
await ctx.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); if (!sessionStorage.getItem("v27-init")) { localStorage.setItem("ui-lang", "zh"); sessionStorage.setItem("v27-init", "1"); } } catch {} });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e))); p.on("dialog", (d) => d.accept());
const wait = (ms) => p.waitForTimeout(ms);
const T = (t) => p.locator(`[data-testid="${t}"]`);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) { await T(t).first().scrollIntoViewIfNeeded(); await T(t).first().screenshot({ path: f }); } else await p.screenshot({ path: f }); };
const cjk = () => p.evaluate(() => window.__cjkLeft());

// ① 使用说明（中文）
await p.goto(BASE + "/"); await T("nav-help").first().waitFor({ timeout: 60000 });
ok(await T("nav-help").first().isVisible() || (await T("nav-help").count()) > 0, "导航里有“使用说明”");
await T("nav-help").first().click(); await T("help-page").waitFor({ timeout: 30000 });
ok(p.url().endsWith("/help") && (await T("help-page").getAttribute("data-lang")) === "zh", "点导航 → /help（中文）");
const secs = ["help-toc", "help-quick", "help-scenes", "help-keys", "help-faq", "help-limits", ...["bench", "model", "joints", "link", "repair", "scope", "solder", "parts", "project"].map((k) => `help-mode-${k}`)];
const miss = []; for (const s of secs) if (!(await T(s).count())) miss.push(s);
ok(!miss.length, `使用说明 ${secs.length} 个部分都在（快速上手、9 个模式、示例场景、快捷键、常见问题、诚实的限制）`, miss.join(","));
const helpTxt = await T("help-page").innerText(); res.helpChars = helpTxt.length;
ok(/Ctrl/.test(await T("help-keys").innerText()) && /Esc/.test(await T("help-keys").innerText()), "快捷键表有 Ctrl / Esc");
ok(/早期原型|简化仿真/.test(helpTxt) && /不是实测|估算/.test(await T("help-limits").innerText()), "诚实的限制：写明简化仿真 / 估算");
await shot("help-zh");
// 命令面板 → 使用说明
await p.goto(BASE + "/"); await T("nav-help").first().waitFor();
await p.keyboard.press("Control+k"); await T("palette").waitFor(); await T("palette-input").fill("使用说明"); await wait(200);
const items = await T("palette-item").allInnerTexts();
ok(items.some((x) => /使用说明/.test(x)), "命令面板搜“使用说明”能找到", items.slice(0, 3).join(" | "));
await p.keyboard.press("Enter"); await T("help-page").waitFor({ timeout: 15000 });
ok(p.url().endsWith("/help"), "回车 → 打开 /help");
// ② 英文
await T("lang-toggle").click(); await wait(300);
ok((await T("help-page").getAttribute("data-lang")) === "en" && /Quick start/i.test(await T("help-quick").innerText()), "切英文 → 使用说明是手写英文（不是机翻）");
const hc = await cjk(); res.cover["/help"] = hc;
ok(await T("mt-banner").isVisible() && /machine-translated/i.test(await T("mt-banner").innerText()), "英文模式顶部写明“部分文字是机器翻译”");
await shot("help-en");
// ③ 英文整页覆盖率（先量中文，再量英文）
const PAGES = ["/", "/workbench", "/assembly", "/parts", "/assembly/guide", "/repair", "/project", "/credits", "/example"];
for (const u of PAGES) {
  await p.evaluate(() => localStorage.setItem("ui-lang", "zh")); await p.goto(BASE + u); await wait(u === "/" || u === "/credits" ? 1200 : 3500);
  const z = await cjk();
  await p.evaluate(() => localStorage.setItem("ui-lang", "en")); await p.reload(); await p.waitForFunction(() => window.__mtActive && window.__mtMeta, null, { timeout: 30000 }).catch(() => {}); await wait(u === "/" || u === "/credits" ? 1500 : 4000);
  const e = await cjk(); const left = e.chars / Math.max(1, z.chars);
  res.cover[u] = { zhCjk: z.chars, enCjk: e.chars, leftPct: Math.round(left * 1000) / 10, sample: e.sample.slice(0, 6) };
  ok(z.chars > 0 && left <= 0.1, `${u}：英文模式剩下的汉字 ${e.chars} / ${z.chars}（${res.cover[u].leftPct}%）≤ 10%`, e.sample.slice(0, 4).join(" · "));
}
res.mtMeta = await p.evaluate(() => window.__mtMeta);
ok(res.mtMeta && /Argos/.test(res.mtMeta.engine || "") && res.mtMeta.entries > 3000, `机翻词典：${res.mtMeta?.entries} 条（引擎 ${res.mtMeta?.engine}）`);
// 切回中文：还原
await p.goto(BASE + "/repair"); await p.waitForFunction(() => window.__mtActive, null, { timeout: 30000 }).catch(() => {}); await wait(3000);
const enTxt = await p.locator("#main").innerText();
await T("lang-toggle").click(); await wait(800);
const back = await cjk(); const zhTxt = await p.locator("#main").innerText();
ok(back.chars > 200 && zhTxt !== enTxt && /维修|关卡|故障/.test(zhTxt), `切回中文 → 页面还原成中文（${back.chars} 个汉字）`);
// ④ 维修关卡 ≥ 21
const nSc = await p.locator("[data-testid^=sc-]").count(); res.repairLevels = nSc;
ok(nSc >= 21, `维修关卡 ${nSc} 个（≥ 21）`);
for (const id of ["led-missing-resistor", "psu-wrong-ldo", "sensor-i2c-bridge", "octo-boost-cold-in"]) ok((await T(`sc-${id}`).count()) === 1, `新关卡 ${id} 在列表里`);
await T("sc-sensor-i2c-bridge").click(); await wait(500); await shot("repair-new-zh", "scenario-list");
// 英文维修页（模拟消息也翻）
await T("lang-toggle").click(); await wait(1500);
const cpl = await T("complaint").innerText();
ok(!/[\u4e00-\u9fff]{3,}/.test(cpl), "英文模式：故障描述已翻成英文", cpl.slice(0, 100));
await shot("repair-en");
await T("lang-toggle").click(); await wait(300);
// ⑤ 4 个示例场景
for (const sc of ["blink", "button", "potservo", "fault2"]) {
  await p.goto(BASE + "/assembly?scene=" + sc); await p.waitForFunction(() => window.__asmBuilt, null, { timeout: 90000 }).catch(() => {}); await wait(800);
  const r = await p.evaluate(() => window.__asmBuilt); res["scene_" + sc] = r;
  ok(r && r.parts >= 2 && !(r.fails || []).length, `示例场景 ${sc}：搭好 ${r?.parts} 个零件、${r?.cables} 根线，没有失败`, JSON.stringify(r?.fails || "").slice(0, 120));
  if (sc === "potservo") await shot("scene-potservo");
  await p.evaluate(() => { window.__asmBuilt = null; });
}
// ⑥ 零件详情（英文标签）
await p.evaluate(() => localStorage.setItem("ui-lang", "en")); await p.goto(BASE + "/parts?id=kc-raspberrypi_pico"); await T("part-detail").waitFor({ timeout: 30000 }); await wait(1500);
const pd = await T("part-detail").innerText();
ok(/Name/.test(pd) && /Size/.test(pd) && /Source/.test(pd), "零件详情英文标签（Name / Size / Source）", pd.slice(0, 120).replace(/\n/g, " "));
await shot("part-en", "part-detail");
await p.evaluate(() => localStorage.setItem("ui-lang", "zh"));
// ⑦ 手机 / 宽屏
for (const [w, h, tag] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) for (const lang of ["zh", "en"]) {
  const c2 = await b.newContext({ viewport: { width: w, height: h } }); await c2.addInitScript((l) => localStorage.setItem("ui-lang", l), lang);
  const m = await c2.newPage(); const me = []; m.on("pageerror", (e) => me.push(String(e)));
  await m.goto(BASE + "/help"); await m.locator("[data-testid=help-page]").waitFor({ timeout: 60000 }); await m.waitForTimeout(600);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= w + 1 && !me.length && (await m.locator("[data-testid=help-page]").getAttribute("data-lang")) === lang, `${tag} ${w} 宽 ${lang}：使用说明不横向溢出（${sw}）`);
  if (SHOT) await m.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-help-${tag}-${lang}.png` });
  await c2.close();
}
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
fs.writeFileSync(`${OUT}/logs/v27-bench.json`, JSON.stringify({ pass, fail, res, errs, note: "英文覆盖率 = 英文模式下页面可见汉字 / 中文模式下可见汉字；3D 画布里的文字不算" }, null, 1));
await ctx.close(); await b.close();
if (SHOT) { const v = fs.readdirSync(VID).filter((f) => f.endsWith(".webm")).sort((x, y) => fs.statSync(`${VID}/${y}`).size - fs.statSync(`${VID}/${x}`).size)[0]; if (v) fs.copyFileSync(`${VID}/${v}`, `${OUT}/logs/v27-demo.webm`); }
console.log(`v27-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
