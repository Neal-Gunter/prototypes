// v19：台面电路 → 时域示波器走查。① 通用台面（电路练习预设）：提取网表、探头点引脚 / 导线、实时改线规 / 拔线 + 前后对比 + 撤销、参考板备用
// ② 八爪鱼 v10：按 3D 台面接线提取、换电容 / 老化电池 / 撤销、和 v18 参考板对照、自适应步长、“如果……会怎样”面板
// ③ 指南 / 素材页 v19 章节
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v19 SHOTS=0（不截图 / 不录像）node e2e/v19-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v19", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv19";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const L = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) { await p.locator(`[data-testid=${t}]`).scrollIntoViewIfNeeded(); await p.locator(`[data-testid=${t}]`).screenshot({ path: f, style: ".no-print.sticky { visibility: hidden !important; }" }); } else await p.screenshot({ path: f }); };
const click = (t) => p.click(`[data-testid=${t}]`);
const txt = (t) => p.locator(`[data-testid=${t}]`).innerText();
const bs = () => L(() => window.__benchScope && { ...window.__benchScope, cap: window.__benchScope.cap && { meas: window.__benchScope.cap.meas, dev: window.__benchScope.cap.dev, stats: window.__benchScope.cap.stats, ms: window.__benchScope.cap.ms, events: window.__benchScope.cap.allEvents.length } });
const after = async (fn) => { await L(() => { window.__benchScope = null; }); await fn(); await p.waitForFunction(() => window.__benchScope?.cap, null, { timeout: 60000 }); await wait(150); return bs(); };
const openScope = async () => {
  await p.waitForSelector("[data-testid=bench-scope-panel]", { state: "attached", timeout: 60000 });
  await L(() => { document.querySelector("[data-testid=bench-scope-panel]").open = true; });
  await p.locator("[data-testid=bench-scope-open]").scrollIntoViewIfNeeded(); await click("bench-scope-open"); await p.waitForSelector("[data-testid=bscope-mine]");
};

// ① 通用台面
await p.goto(BASE + "/assembly?scene=electrics");
await p.waitForFunction(() => window.__asmBuilt, null, { timeout: 180000 });
await wait(800); await click("fw-auto"); await click("fw-upload"); await wait(1500);
await openScope();
ok(/通用台面/.test(await txt("bscope-kind")), "电路练习台面 → 通用台面提取", await txt("bscope-kind"));
ok(/网表检查通过/.test(await txt("bscope-diag")), "网表检查通过（无悬空 / 短路 / 缺地）", (await txt("bscope-diag")).slice(0, 120));
const g0 = await after(() => click("mscope-capture"));
ok(Math.abs(g0.cap.meas[0].max - 5) < 0.05 && Math.abs(g0.cap.meas[1].max - 3.3) < 0.05, "我的电路：USB 5 V、板载 3V3 稳到 3.3 V（开机波形）", `${g0.cap.meas[0].max.toFixed(3)} / ${g0.cap.meas[1].max.toFixed(3)} V，${g0.parts.length} 个零件，${g0.wires.length} 根线，探头点 ${g0.probes} 个`);
ok(g0.parts.some((q) => q.kind === "servo") && g0.parts.some((q) => q.kind === "led") && g0.parts.some((q) => q.kind === "mcu"), "网表里有主控 / LED / 舵机", g0.parts.map((q) => q.ref).join(","));
await shot("generic-power", "bench-scope");
// 探头放到导线端
const wopt = await L(() => [...document.querySelector("[data-testid=mscope-ch4-node]").options].findIndex((o) => /^线 /.test(o.textContent)));
await p.selectOption("[data-testid=mscope-ch4-node]", { index: wopt });
ok(wopt > 0, "探头可以夹在任意导线的端点上（通道 4）", await L(() => document.querySelector("[data-testid=mscope-ch4-node]").selectedOptions[0].textContent));
await click("mscope-exp-run");
const sv = g0.parts.find((q) => q.kind === "servo");
const vw = g0.wires.find((w) => w.a === sv.pins.V || w.b === sv.pins.V);
const g1 = await after(() => click("mscope-capture"));
await shot("generic-servo-run", "bench-scope");
await L(() => { document.querySelector("[data-testid=bscope-wires]").open = true; });
const g2 = await after(() => p.selectOption(`[data-testid=bscope-awg-${vw.id}]`, "30"));
ok(g2.ghost && (await p.locator("[data-testid^=mscope-trace-g]").count()) > 0, "改线规后自动重抓，改前波形画成灰色虚线", `${await p.locator("[data-testid^=mscope-trace-g]").count()} 条对比线`);
ok(g2.cap.meas[2].min < g1.cap.meas[2].min, "舵机 VCC 杜邦线 26 → 30AWG：舵机端最低电压更低", `${g1.cap.meas[2].min.toFixed(4)} → ${g2.cap.meas[2].min.toFixed(4)} V`);
await shot("generic-awg30-overlay", "bench-scope");
await L(() => { window.__benchScope = null; }); await click(`bscope-rm-${vw.id}`); await wait(800);
ok(/悬空/.test(await txt("bscope-diag")), "拔掉舵机 VCC 线 → 报悬空网络", (await txt("bscope-diag")).slice(0, 100));
await shot("generic-wire-removed", "bench-scope");
const g3 = await after(() => click("bscope-undo"));
ok(/网表检查通过/.test(await txt("bscope-diag")) && g3.edits.awg?.[vw.id] === 30 && !(g3.edits.removed || []).includes(vw.id), "撤销：线插回去、线规仍是 30AWG", JSON.stringify(g3.edits));
const g4 = await after(() => click("bscope-undo"));
ok(!g4.edits.awg?.[vw.id] && Math.abs(g4.cap.meas[2].min - g1.cap.meas[2].min) < 1e-6, "再撤销：回到原样，波形和改之前一样", `${g4.cap.meas[2].min.toFixed(4)} V`);
res.generic = { usb: g0.cap.meas[0].max, v33: g0.cap.meas[1].max, servoMin26: g1.cap.meas[2].min, servoMin30: g2.cap.meas[2].min, parts: g0.parts.length, wires: g0.wires.length, probes: g0.probes };
// 参考板备用
await click("bscope-src-ref"); await p.waitForSelector("[data-testid=bscope-ref]");
ok(/备用/.test(await txt("bscope-ref")) && /不是/.test(await txt("bscope-ref")), "参考板示波器保留为备用，并标明不是台面电路");
const r0 = await after(() => click("bscope-capture"));
ok(r0.src === "ref" && r0.cap.meas[1].max > 5, "备用参考板照常能抓波形", `5VA ${r0.cap.meas[1].max.toFixed(2)} V`);
await click("bench-scope-close");

// ② 八爪鱼 v10
await p.goto(BASE + "/assembly?scene=octo");
await p.waitForFunction(() => window.__octo?.build, null, { timeout: 120000 });
await L(() => window.__octo.build({ variant: "v10", plan: "A", phase: 3, mode: "ino", go: true }));
await p.waitForFunction(() => window.__octoBuilt, null, { timeout: 240000 });
await wait(800); await click("tab-elec");
await openScope();
ok(/八爪鱼 v10/.test(await txt("bscope-kind")), "八爪鱼台面 → 按 3D 接线提取", await txt("bscope-kind"));
const o0 = await after(() => click("mscope-capture"));
ok(o0.cap.dev.QTPY.resets === 0 && o0.cap.meas[1].min > 4.9, "我的八爪鱼：舵机起步，新电池 + 100 µF 不复位", `5V 最低 ${o0.cap.meas[1].min.toFixed(3)} V，${o0.parts.length} 个零件，${o0.wires.length} 根线`);
await shot("octo-run", "bench-scope");
await click("bscope-CAP1-0"); await wait(100);
const o1 = await after(() => click("bscope-CAP2-0"));
ok(o1.ghost && o1.cap.meas[1].min < o0.cap.meas[1].min, "去掉两个电容：5V 跌得更深（灰线 = 去之前）", `${o0.cap.meas[1].min.toFixed(3)} → ${o1.cap.meas[1].min.toFixed(3)} V`);
await shot("octo-nocap-overlay", "bench-scope");
const o2 = await after(() => click("bscope-age-aged"));
ok(o2.cap.dev.QTPY.resets > 0, "再换老化电池：主控欠压复位", `复位 ${o2.cap.dev.QTPY.resets} 次，电池最低 ${o2.cap.meas[0].min.toFixed(3)} V`);
await shot("octo-aged-nocap", "bench-scope");
// 和 v18 参考板对照（同为不加电容 + 老化电池）
res.octo = { run: { min5: o0.cap.meas[1].min, pp: o0.cap.meas[1].pp }, nocap: { min5: o1.cap.meas[1].min, pp: o1.cap.meas[1].pp }, agedNocap: { resets: o2.cap.dev.QTPY.resets, vbatMin: o2.cap.meas[0].min } };
const o3 = await after(() => click("bscope-undo"));
ok(o3.cap.dev.QTPY.resets === 0 && o3.edits.rint == null, "撤销老化电池：不再复位", JSON.stringify(o3.edits));
// 自适应步长
await click("bscope-adaptive");
const o4 = await after(() => click("mscope-capture"));
ok(o4.cap.stats?.adaptive && Math.abs(o4.cap.meas[1].min - o3.cap.meas[1].min) < 0.05, "自适应步长：结果和固定步长接近", `5V 最低 固定 ${o3.cap.meas[1].min.toFixed(3)} / 自适应 ${o4.cap.meas[1].min.toFixed(3)} V，${o4.cap.stats.steps} 步（固定 ${o3.cap.stats?.steps ?? "—"}），${o4.cap.ms.toFixed(0)} vs ${o3.cap.ms.toFixed(0)} ms`);
res.octo.adaptive = { fixedMin: o3.cap.meas[1].min, adMin: o4.cap.meas[1].min, steps: o4.cap.stats.steps, fixedMs: o3.cap.ms, adMs: o4.cap.ms };
await shot("octo-adaptive", "bench-scope");
await click("bscope-adaptive");
// what-if
const runWI = async (sel) => { const k = await L(() => (window.__whatIf || []).length); for (const t of sel) await click(t); await click("whatif-run"); await p.waitForFunction((k) => (window.__whatIf || []).length > k || (window.__whatIf || []).length === 8, k, { timeout: 60000 }); return L(() => window.__whatIf.at(-1)); };
await p.locator("[data-testid=whatif]").scrollIntoViewIfNeeded();
const w1 = await runWI(["whatif-cap-100", "whatif-batt-fresh", "whatif-awg-0"]);
const w2 = await runWI(["whatif-cap-0"]);
const w3 = await runWI(["whatif-cap-1000"]);
const w4 = await runWI(["whatif-cap-0", "whatif-batt-aged"]);
const w5 = await runWI(["whatif-cap-0", "whatif-batt-fresh", "whatif-awg-30"]);
ok((await p.locator("[data-testid^=whatif-row-]").count()) === 5, "what-if 表格 5 行");
ok(w2.servoDip > w1.servoDip && w1.servoDip > w3.servoDip, "what-if：电容 0 / 100 / 1000 µF → 起步跌落递减", [w2, w1, w3].map((w) => (w.servoDip * 1000).toFixed(0) + " mV").join(" / "));
ok(w1.resets === 0 && w4.resets > 0, "what-if：老化电池 + 不加电容会复位", `${w1.resets} → ${w4.resets} 次`);
ok([w1, w2, w3, w4, w5].every((w) => w.ipk > 0.5 && w.ipk < 6), "what-if：电池峰值电流 0.5–6 A（估算）", [w1, w2, w3, w4, w5].map((w) => w.ipk.toFixed(2)).join(" / ") + " A");
ok(/估算/.test(await txt("whatif")) && /早期原型，简化仿真/.test(await txt("whatif")), "what-if 面板标明估算 / 早期原型");
res.whatIf = [w1, w2, w3, w4, w5];
await shot("octo-whatif", "whatif");
await click("bench-scope-close");

// ③ 指南 / 素材
await p.goto(BASE + "/assembly/guide"); await p.waitForSelector("[data-testid=guide-bench-netlist]", { timeout: 60000 });
ok(/悬空/.test(await txt("guide-bench-netlist")) && /估算/.test(await txt("guide-bench-netlist")), "装配指南有“示波器看我的电路”章节");
await p.goto(BASE + "/credits"); await p.waitForSelector("[data-testid=credits-netlist]");
ok(/我的补充/.test(await txt("credits-netlist")) && /估算/.test(await txt("credits-netlist")), "素材页写明台面网表 / 自适应步长为自写、参数为估算");
ok(errs.length === 0, "没有页面错误", errs.join(" | "));
await ctx.close(); await b.close();
if (SHOT) {
  const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm"));
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "setpts=0.6*PTS,scale=1280:-2" -c:v libx264 -crf 32 -preset veryfast -an ${OUT}/demo.mp4`); const mb = fs.statSync(`${OUT}/demo.mp4`).size / 1e6; ok(mb < 20, "demo.mp4 < 20 MB", mb.toFixed(1) + " MB"); res.videoMB = mb; }
}
fs.writeFileSync(`${OUT}/logs/v19-bench.json`, JSON.stringify({ pass, fail, ...res }, null, 1));
console.log(`\nv19 e2e：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
