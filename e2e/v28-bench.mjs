// v28：碰撞体分级（LOD 状态可读）、3D 画布文字跟着 EN 开关、八爪鱼指南英文（正文剩余汉字 < 1%，代码块标中文不机翻）、
//      维修关卡 ≥ 28（7 个新关卡）且英文描述是手译、可读性抽样词典、手机 / 宽屏中英文。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v28 SHOTS=0 node e2e/v28-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v28", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv28";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ slowMo: SHOT ? 60 : 0, executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
await ctx.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); if (!sessionStorage.getItem("v28-init")) { localStorage.setItem("ui-lang", "zh"); sessionStorage.setItem("v28-init", "1"); } } catch {} });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e))); p.on("dialog", (d) => d.accept());
const wait = (ms) => p.waitForTimeout(ms);
const T = (t) => p.locator(`[data-testid="${t}"]`);
const shot = async (s) => { if (SHOT) await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${s}.png` }); };
const setLang = async (l) => { await p.evaluate((x) => localStorage.setItem("ui-lang", x), l); };
const mtReady = () => p.waitForFunction(() => window.__mtActive && window.__mtMeta, null, { timeout: 30000 }).catch(() => {});
const CJK = /[\u4e00-\u9fff]/;

// ① 装配台：LOD 状态 + 画布文字英文
await p.goto(BASE + "/assembly?scene=blink"); await p.waitForFunction(() => window.__asmBuilt && window.__engine, null, { timeout: 90000 }).catch(() => {}); await wait(2500);
const ls = await p.evaluate(() => window.__engine?.lodStats?.());
res.lod = ls;
ok(ls && ls.lod === true, "碰撞体分级默认开启", JSON.stringify(ls));
ok(ls && (ls.all || ls.fineOn <= ls.withFine), `细凸包启用 ${ls?.fineOn} / ${ls?.withFine}（有线缆时全部启用：${ls?.all}）`);
await shot("bench-zh");
// 3D 画布贴图文字（零件标签 / 工具标签 / 万用表屏 / 串口绘图图例）在工作台场景里画；用新的 context 直接以英文打开
{
  const c3 = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c3.addInitScript(() => { localStorage.setItem("ui-lang", "en"); localStorage.setItem("asm-tour-v22-done", "1"); });
  const q = await c3.newPage(); q.on("pageerror", (e) => errs.push(String(e)));
  await q.goto(BASE + "/workbench"); await q.waitForFunction(() => window.__mtActive && window.__ctLog?.size > 5, null, { timeout: 60000 }).catch(() => {}); await q.waitForTimeout(2500);
  const ctl = await q.evaluate(() => [...(window.__ctLog || new Map()).entries()]);
  const ctZh = ctl.filter(([zh]) => CJK.test(zh)), ctBad = ctZh.filter(([, en]) => CJK.test(en));
  const M = Object.fromEntries(ctl);
  const want = { "烙铁架": "Iron stand", "吸锡带": "Desoldering braid", "助焊剂笔": "Flux pen", "数字万用表（简化）": "Digital multimeter (simplified)" };
  const hit = Object.entries(want).filter(([k, v]) => M[k] === v).length;
  res.canvas = { total: ctl.length, zh: ctZh.length, leftZh: ctBad.length, sample: ctZh.slice(0, 16) };
  ok(ctZh.length >= 8, `英文模式：3D 画布 ${ctZh.length} 条中文标签走了翻译`, ctZh.slice(0, 4).map((x) => x[1]).join(" · "));
  ok(!ctBad.length, `画布标签里还剩汉字的 ${ctBad.length} 条`, ctBad.slice(0, 3).map((x) => x[0]).join(" · "));
  ok(hit === 4, `最显眼的工具标签用手写词典 ${hit} / 4`);
  if (SHOT) await q.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-workbench-canvas-en.png` });
  await c3.close();
}
// 装配台上点 EN 开关：页面切到英文，再点切回中文
await T("lang-toggle").click(); await mtReady(); await wait(2500); await shot("bench-en");
const l1 = await p.evaluate(() => localStorage.getItem("ui-lang"));
await T("lang-toggle").click(); await wait(1500);
const l2 = await p.evaluate(() => localStorage.getItem("ui-lang"));
ok(l1 === "en" && l2 === "zh", "装配台 EN 开关来回切换", `${l1} → ${l2}`);
// ② 八爪鱼指南
const G = "/assembly/octopus-guide";
await setLang("zh"); await p.goto(BASE + G); await wait(2500);
const gz = await p.evaluate(() => window.__cjkLeft());
await setLang("en"); await p.reload(); await mtReady(); await wait(4000);
const ge = await p.evaluate(() => window.__cjkLeft());
const proseLeft = ge.untagged / Math.max(1, gz.chars);
res.octo = { zhChars: gz.chars, enUntagged: ge.untagged, enTagged: ge.tagged, pct: Math.round(proseLeft * 1000) / 10, sample: (ge.sample || []).slice(0, 8) };
ok(gz.chars > 1000 && proseLeft < 0.01, `八爪鱼指南英文：正文剩余汉字 ${ge.untagged} / ${gz.chars}（${res.octo.pct}%，< 1%；代码块 ${ge.tagged} 字有意保留中文）`, (ge.sample || []).slice(0, 4).join(" · "));
const pre = await p.evaluate(() => { const ps = [...document.querySelectorAll("main pre, #main pre")]; return { n: ps.length, marked: ps.filter((x) => x.getAttribute("translate") === "no" && x.lang === "zh" && x.hasAttribute("data-no-mt")).length }; });
ok(pre.n > 0 && pre.marked === pre.n, `代码块 ${pre.marked} / ${pre.n} 标了 lang=zh + translate=no（不机翻代码）`);
const heads = await p.evaluate(() => [...document.querySelectorAll("#main h1, #main h2, #main h3, main h1, main h2, main h3")].map((h) => h.innerText.trim()).filter(Boolean));
const hZh = heads.filter((h) => CJK.test(h.replace(/立创实战派|小智八爪鱼-完善版\.md|中文/g, "")));
ok(heads.length > 3 && !hZh.length, `指南 ${heads.length} 个标题都是英文`, hZh.slice(0, 3).join(" · "));
await shot("octo-guide-en");
// ③ 维修关卡
await setLang("zh"); await p.goto(BASE + "/repair"); await T("scenario-list").waitFor({ timeout: 30000 }).catch(() => {}); await wait(1500);
const nSc = await p.locator("[data-testid^=sc-]").count(); res.repairLevels = nSc;
const NEW = ["led-switch-cold", "psu-missing-led-res", "sensor-led-cold", "psu-diode-reversed", "octo-plug-out", "octo-mcu-sig-cold", "octo-servo-plug-worn"];
ok(nSc >= 28, `维修关卡 ${nSc} 个（≥ 28）`);
let have = 0; for (const id of NEW) if ((await T(`sc-${id}`).count()) === 1) have++;
ok(have === NEW.length, `v28 新关卡 ${have} / ${NEW.length} 在列表里`);
await T("sc-octo-mcu-sig-cold").click(); await wait(600); await shot("repair-new-zh");
await T("lang-toggle").click(); await mtReady(); await wait(1800);
const cpl = await T("complaint").innerText();
ok(/replaced the servo/i.test(cpl) && !CJK.test(cpl), "英文模式：新关卡的客户描述是手译英文", cpl.slice(0, 100));
await shot("repair-new-en");
// ④ 可读性抽样：取 50 条译文做明显问题检查（同一份词典，浏览器里再抽一次）
const rd = await p.evaluate(async () => { const j = await (await fetch(location.pathname.replace(/\/repair\/?$/, "") + "/i18n/en-mt.json")).json().catch(() => null); if (!j) return null; const ks = Object.keys(j.dict); let s = 28; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); const out = []; for (let i = 0; i < 50; i++) { const k = ks[Math.floor(r() * ks.length)]; const v = j.dict[k]; out.push({ k, v, bad: !v || /[\u4e00-\u9fff]/.test(v) || /\b(\w{3,})\s+\1\b/i.test(v) || /^(I don't know|I'm sorry|Yeah|Okay)\b/.test(v) }); } return { n: ks.length, bad: out.filter((x) => x.bad) }; });
res.readability = rd && { entries: rd.n, bad: rd.bad.length, badSample: rd.bad.slice(0, 5) };
ok(rd && rd.n > 10000 && rd.bad.length <= 5, `线上词典 ${rd?.n} 条，抽 50 条明显问题 ${rd?.bad.length} 条（≤ 5）`, (rd?.bad || []).slice(0, 2).map((x) => x.k + "→" + x.v).join(" | "));
await setLang("zh");
// ⑤ 手机 / 宽屏 × 中英文（八爪鱼指南 + 维修页）
for (const [w, h, tag] of [[390, 844, "mobile"], [1920, 1080, "wide"]]) for (const lang of ["zh", "en"]) for (const u of [G, "/repair"]) {
  const c2 = await b.newContext({ viewport: { width: w, height: h } }); await c2.addInitScript((l) => { localStorage.setItem("ui-lang", l); localStorage.setItem("asm-tour-v22-done", "1"); }, lang);
  const m = await c2.newPage(); const me = []; m.on("pageerror", (e) => me.push(String(e)));
  await m.goto(BASE + u); await m.waitForTimeout(lang === "en" ? 4000 : 2000);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= w + 1 && !me.length, `${tag} ${w} 宽 ${lang} ${u}：不横向溢出（${sw}）、无报错`, me.slice(0, 1).join(""));
  if (SHOT) await m.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${u.split("/").pop()}-${tag}-${lang}.png` });
  await c2.close();
}
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
await ctx.close(); await b.close();
fs.writeFileSync(`${OUT}/logs/v28-bench.json`, JSON.stringify({ pass, fail, res, errs }, null, 1));
if (SHOT && fs.existsSync(VID)) { const v = fs.readdirSync(VID).filter((f) => f.endsWith(".webm")).sort((x, y) => fs.statSync(`${VID}/${y}`).size - fs.statSync(`${VID}/${x}`).size)[0]; if (v) fs.copyFileSync(`${VID}/${v}`, `${OUT}/logs/v28-demo.webm`); }
console.log(`v28-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
