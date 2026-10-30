// v23：贴片转接板（预设 → 焊点 → 检查面板）、“贴到转接板上”按钮、L298N 直插说明、转接板焊盘悬停名字、零件库能搜到转接板
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v23 SHOTS=0 node e2e/v23-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v23", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv23";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
await ctx.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); } catch {} });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const wait = (ms) => p.waitForTimeout(ms);
const T = (t) => p.locator(`[data-testid=${t}]`);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) { await T(t).scrollIntoViewIfNeeded(); await T(t).screenshot({ path: f }); } else await p.screenshot({ path: f }); };

// 1) 预设“贴片转接板练习”
await p.goto(BASE + "/assembly?scene=smd"); await p.waitForFunction(() => window.__asm, null, { timeout: 60000 });
await p.waitForFunction(() => window.__asm.engine.parts.size >= 9, null, { timeout: 90000 }); await wait(2500);
const st = await p.evaluate(() => { const E = window.__asm.engine; const P = [...E.parts.values()]; return { n: P.length, bo: P.filter((q) => q.def.breakout).length, smd: P.filter((q) => q.def.smdPkg && E.edges.some((e) => (e.a === q.uid || e.b === q.uid) && E.parts.get(e.a === q.uid ? e.b : e.a)?.def.breakout)).length, joints: P.reduce((s, q) => s + (q.state.solder || []).filter((j) => j.k === "t").length, 0), pen: E.overlapTest().maxPenetrationMm }; });
res.preset = st;
ok(st.n === 9 && st.bo === 4, `预设搭好：${st.n} 个零件，其中 ${st.bo} 块转接板`);
ok(st.smd === 4, `4 颗贴片芯片都贴在转接板上（${st.smd} 条“贴片”连接）`);
ok(st.joints === 16 + 8 + 3 + 2, `转接板上焊了 ${st.joints} 个贴片焊点（16+8+3+2）`);
ok(st.pen < 0.1, `不穿模 ${st.pen.toFixed(3)} mm`);
await p.evaluate(() => { const E = window.__asm.engine; const bo = [...E.parts.values()].find((q) => q.def.breakout === "tssop-16"); const w = E.worldPose(bo.uid).p; window.__asmCam([w.x + 3, w.y + 6, w.z + 5], [w.x, w.y, w.z]); });
await wait(800); await shot("smd-preset");
await T("tab-elec").click(); await wait(800);
const chk = await T("checks").innerText().catch(() => "");
ok(/虚焊/.test(chk) && /连锡/.test(chk), "检查面板列出转接板上的虚焊 + 连锡", chk.split("\n").filter((l) => /转接板/.test(l)).slice(0, 2).join(" / "));
await shot("smd-checks", "checks");
// 2) 转接板焊盘悬停：名字是“转接板焊盘 n”
const bo = await p.evaluate(() => [...window.__asm.engine.parts.values()].find((q) => q.def.breakout === "tssop-16").uid);
const s = await p.evaluate((u) => window.__pinScreen?.(u, "t11") || null, bo);
let hv = "none";
if (s) for (let a = 0; a < 3 && hv === "none"; a++) { await p.mouse.move(s.x - 4, s.y); await p.mouse.move(s.x, s.y); await wait(400); hv = await T("pin-hover").innerText({ timeout: 500 }).catch(() => "none"); }
ok(/焊盘/.test(hv) && /0\.65 mm/.test(hv) && !/可插面包板/.test(hv), "悬停转接板焊盘：名字 + 0.65 mm 焊盘间距（不说“可插面包板”）", hv.replace(/\n/g, " | "));
// 3) 新放一颗 LQFP-48，点“贴到转接板上”
const chip = await p.evaluate(async () => window.__asm.addAt("p-smd-lqfp-48", -6, 12, 0.3)); await wait(1500);
await p.evaluate((u) => window.__asm.select(u), chip); await wait(300);
await T("tab-tools").click(); await wait(300);
ok(await T("smd-tools").isVisible(), "选中贴片芯片：出现“贴到转接板上”");
await T("smd-mount").click(); await wait(1500);
const m = await p.evaluate((u) => { const E = window.__asm.engine; const e = E.edges.find((x) => (x.a === u || x.b === u) && x.why === "smd"); return { ok: !!e, bo: e && E.parts.get(e.a === u ? e.b : e.a).def.id }; }, chip);
ok(m.ok && m.bo === "p-bo-lqfp-48", "点按钮后：桌上放了一块 LQFP-48 转接板，芯片贴上去", m.bo || "");
const msg = await T("smd-tools").innerText(); ok(/对位误差 0\.0\d mm/.test(msg), "按钮下方提示对位误差和下一步", msg.split("\n").pop());
await p.evaluate((u) => { const E = window.__asm.engine; const w = E.worldPose(u).p; window.__asmCam([w.x + 2, w.y + 5, w.z + 4], [w.x, w.y, w.z]); }, chip); await wait(800); await shot("lqfp48-on-breakout");
// 4) L298N 直插说明
const l = await p.evaluate(async () => window.__asm.addAt("p-fp-l298n-ic", 10, 12, 0.3)); await wait(800);
await p.evaluate((u) => window.__asm.select(u), l); await wait(300); await T("tab-tools").click(); await wait(200);
const note = await T("mount-note").innerText().catch(() => "");
ok(/Multiwatt15/.test(note) && /直插/.test(note), "选中 L298N 芯片：显示“直插 Multiwatt15，不能直接插面包板”", note.slice(0, 50));
await shot("l298n-note", "mount-note");
// 5) 零件库能搜到转接板
await p.goto(BASE + "/parts"); await T("parts-search").waitFor({ timeout: 60000 }); await T("parts-search").fill("转接板 TSSOP"); await wait(2500);
const cnt = await p.locator("[data-testid=parts-page] >> text=/转接板/").count();
ok(cnt >= 1, `零件库搜“转接板”有结果（${cnt} 处）`);
await shot("parts-breakout");
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
fs.writeFileSync(`${OUT}/logs/v23-bench.json`, JSON.stringify({ pass, fail, res, errs }, null, 1));
await ctx.close(); await b.close();
if (SHOT) { const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm")); if (v) fs.copyFileSync(`${VID}/${v}`, `${OUT}/logs/v23-bench.webm`); }
console.log(`v23-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
