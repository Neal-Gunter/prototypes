// v24：拆焊返修（拆焊工具按住焊点、吸掉全部、拿下复用、翘起焊盘 + 飞线补救）+ 英文界面切换（导航 / 横幅 / 导览 / 命令面板 / 装配台标签，记在本机）
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v24 SHOTS=0 node e2e/v24-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v24", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv24";
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

// 1) 贴片预设里的 SOIC-8：用“拆焊”工具在一个焊盘上按住
await p.goto(BASE + "/assembly?scene=smd"); await p.waitForFunction(() => window.__asm, null, { timeout: 60000 });
await p.waitForFunction(() => window.__asm.engine.parts.size >= 9, null, { timeout: 90000 }); await wait(2500);
const ids = await p.evaluate(() => { const E = window.__asm.engine; const P = [...E.parts.values()]; const bo = P.find((q) => q.def.breakout === "soic-8"); const chip = P.find((q) => q.def.smdPkg === "soic-8"); return { bo: bo?.uid, chip: chip?.uid, j: chip ? E.jointsOf(chip.uid).length : -1 }; });
res.start = ids;
ok(ids.bo && ids.chip && ids.j > 0, `预设里有 SOIC-8 芯片，焊了 ${ids.j} 个脚`);
await T("tab-tools").click(); await wait(300); await T("tool-desolder").click();
ok(/拆焊/.test(await T("tool-desolder").innerText()) && (await T("tool-desolder").getAttribute("aria-pressed")) === "true", "工具栏有“拆焊”，选中");
await p.evaluate((u) => { const E = window.__asm.engine; const w = E.worldPose(u).p; window.__asmCam([w.x + 0.5, w.y + 7, w.z + 3], [w.x, w.y, w.z]); }, ids.bo); await wait(900);
let gone = 0;
for (const k of ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"]) {
  const s = await p.evaluate(([u, kk]) => window.__pinScreen?.(u, kk) || null, [ids.bo, k]); if (!s) continue;
  const before = await p.evaluate((u) => window.__asm.engine.jointsOf(u).length, ids.chip);
  await p.mouse.move(s.x, s.y); await p.mouse.down();
  // 软件渲染下物理时间比墙钟慢：按住直到吸锡进度满（约 1 s 模拟时间）再松开，最多 20 s
  await p.waitForFunction(() => { const o = window.__asm.engine.ops.find((x) => x.kind === "desolder"); return !o || o.progress >= 1; }, null, { timeout: 20000, polling: 50 }).catch(() => {});
  res.holdT = await p.evaluate(() => window.__asm.engine.ops.find((x) => x.kind === "desolder")?.t ?? null);
  await p.mouse.up(); await wait(400);
  const after = await p.evaluate((u) => window.__asm.engine.jointsOf(u).length, ids.chip);
  if (after < before) { gone = before - after; res.mouseKey = k; break; }
}
ok(gone >= 1, `鼠标按住焊盘 → 吸掉 ${gone} 个焊点（焊盘 ${res.mouseKey}，模拟时间 ${res.holdT?.toFixed?.(2)} s）`);
await shot("desolder-tool");
// 2) 选中芯片 → 拆焊返修面板
await T("tool-hand").click(); await p.evaluate((u) => window.__asm.select(u), ids.chip); await wait(500);
await T("rework-tools").waitFor({ timeout: 5000 });
const rt0 = await T("rework-tools").innerText();
ok(/拆焊返修/.test(rt0) && /估算/.test(rt0) && /第 3 次/.test(rt0), "拆焊返修面板：说明规则（估算）");
ok(await T("rework-lift").isDisabled(), "还有焊点时“拿下来复用”是灰的");
await T("rework-all").click(); await wait(600);
const m1 = await T("rework-msg").innerText();
const j1 = await p.evaluate((u) => window.__asm.engine.jointsOf(u).length, ids.chip);
ok(j1 === 0 && /吸掉/.test(m1), `“吸掉全部焊点”后：剩 ${j1} 个焊点`, m1);
await shot("rework-panel", "rework-tools");
await T("rework-lift").click(); await wait(400);
const m2 = await T("rework-msg").innerText();
const lifted = await p.evaluate((u) => !window.__asm.engine.edges.some((e) => (e.a === u || e.b === u) && e.why === "smd"), ids.chip);
ok(lifted && /已拿下/.test(m2), "“拿下来复用”：芯片和转接板脱开", m2);
await wait(1500);
const pen1 = await p.evaluate(() => window.__asm.overlapTest().maxPenetrationMm);
ok(pen1 < 0.1, `拿下后不穿模 ${(+pen1).toFixed(3)} mm`);
// 3) 再贴回去、焊三次拆三次 → 焊盘翘起 → 飞线补救
const re = await p.evaluate(([c, bo]) => {
  const E = window.__asm.engine; const m = E.mountSMD(c, bo); if (!m.ok) return { why: m.why };
  const P = E.parts.get(bo); const key = "t0"; const out = [];
  for (let r = 0; r < 3; r++) { const L = E.worldFeatures(P.body).filter((f) => f.uid === bo && f.t === "land"); for (const f of L) E.finishOpNow(E.holdSolder(f.wp, { flux: true, hold: 0.9 }), 0.9); for (let i = 0; i < 30; i++) E.update(1 / 120); const d = E.desolderAll(c); out.push(d.lifted); for (let i = 0; i < 60; i++) E.update(1 / 120); }
  return { out, lifted: [...(P.state.lifted || [])], key };
}, [ids.chip, ids.bo]);
res.rework3 = re;
ok(re.lifted?.length > 0, `同一块转接板拆焊 3 次：翘起焊盘 ${re.lifted?.length ?? 0} 个`, JSON.stringify(re.out || re.why));
await p.evaluate((u) => window.__asm.select(u), ids.bo); await wait(500);
await T("rework-lifted").waitFor({ timeout: 5000 }).catch(() => {});
const lt = await T("rework-lifted").innerText().catch(() => "");
ok(/翘起/.test(lt), "面板列出翘起的焊盘", lt.split("\n")[0]);
await shot("rework-lifted", "rework-tools");
const nfly = await T("rework-flywire").count();
await T("rework-flywire").first().click(); await wait(300);
ok((await T("rework-flywire").count()) === nfly - 1, `点“飞线补救”：翘起焊盘 ${nfly} → ${nfly - 1}`);

// 4) 英文界面切换
await p.goto(BASE + "/assembly"); await p.waitForFunction(() => window.__asm, null, { timeout: 60000 }); await wait(800);
ok((await T("lang-toggle").innerText()).trim() === "EN" && (await p.evaluate(() => document.documentElement.lang)) === "zh-CN", "默认中文（html lang = zh-CN），页头有 EN 按钮");
await T("lang-toggle").click(); await wait(400);
const nav = await T("main-nav").innerText();
ok(/Assembly bench/.test(nav) && /Parts library/.test(nav) && !/装配台/.test(nav), "切到英文：导航变英文", nav.replace(/\n/g, " · "));
ok((await p.evaluate(() => document.documentElement.lang)) === "en", "html lang = en");
const bn = await T("banner").innerText();
ok(/^Early prototype, simplified simulation/.test(bn), "横幅英文在前", bn);
ok((await T("tab-elec").innerText()) === "Power" && (await T("tool-desolder").innerText()) === "Desolder" && /Auto-assembly demo/.test(await T("demo-btn").innerText()), "装配台标签变英文（Power / Desolder / Auto-assembly demo）");
await shot("en-bench");
await p.reload(); await p.waitForFunction(() => window.__asm, null, { timeout: 60000 }); await wait(600);
ok(/Assembly bench/.test(await T("main-nav").innerText()) && (await p.evaluate(() => localStorage.getItem("ui-lang"))) === "en", "刷新后还是英文（记在 localStorage ui-lang）");
await p.goto(BASE + "/assembly?tour=1"); await T("tour").waitFor({ timeout: 30000 }); await wait(400);
const tt = await T("tour-title").innerText(), tn = await T("tour-next").innerText();
ok(tt === "Assemble" && tn === "Next", `导览英文：${tt} / ${tn}`);
await shot("en-tour");
await T("tour-skip").click();
await p.keyboard.press("Control+k"); await T("palette").waitFor({ timeout: 5000 });
const ph = await T("palette-input").getAttribute("placeholder");
await T("palette-input").fill("parts library"); await wait(300);
const it = await T("palette-item").first().innerText().catch(() => "");
ok(/^Jump to a page/.test(ph) && /Parts library/.test(it), "命令面板英文，能用英文搜到页面", it.replace(/\n/g, " "));
await T("palette-input").fill("零件库"); await wait(200);
ok(/Parts library/.test(await T("palette-item").first().innerText().catch(() => "")), "英文模式下中文关键词也能搜");
await shot("en-palette", "palette");
await p.keyboard.press("Escape");
await p.goto(BASE + "/assembly/guide"); await wait(1500);
const gh = await p.locator("h2").allInnerTexts();
ok(gh.some((h) => /Bill of materials/.test(h)) && gh.some((h) => /Safety notes/.test(h)), "指南的主要标题有英文", gh.slice(0, 3).join(" / "));
const ln = await T("lang-note").innerText();
ok(/中文为主/.test(ln) && /Chinese-first/.test(ln) && /still Chinese only/.test(ln), "页脚如实说明哪些地方还没翻译");
res.missing = await p.evaluate(() => [...(window.__i18nMissing || [])]);
console.log("  没翻译的界面字符串（走过的页面里遇到的）：", res.missing.length, res.missing.slice(0, 5).join(" | "));
await T("lang-toggle").click(); await wait(300);
ok(/装配台/.test(await T("main-nav").innerText()) && (await p.evaluate(() => localStorage.getItem("ui-lang"))) === "zh", "切回中文");
// 5) 手机宽度：语言按钮可点
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(BASE + "/"); await wait(800);
const bb = await m.locator("[data-testid=lang-toggle]").boundingBox();
ok(bb && bb.width >= 24 && bb.height >= 24 && bb.x + bb.width <= 390, `手机 390 宽：语言按钮 ${bb ? Math.round(bb.width) + "×" + Math.round(bb.height) : "无"}`);
await m.locator("[data-testid=lang-toggle]").click(); await wait(300);
ok(/Home/.test(await m.locator("[data-testid=main-nav]").innerText()), "手机上切英文");
if (SHOT) await m.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-en-mobile.png` });
await m.close();
ok(!errs.length, "页面无报错", errs.slice(0, 2).join(" | "));
fs.writeFileSync(`${OUT}/logs/v24-bench.json`, JSON.stringify({ pass, fail, res, errs }, null, 1));
await ctx.close(); await b.close();
if (SHOT) { const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm")); if (v) fs.copyFileSync(`${VID}/${v}`, `${OUT}/logs/v24-bench.webm`); }
console.log(`v24-bench：${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
