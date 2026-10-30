// v18：示波器 + 时域仿真走查。① 维修页：老 12 关还在、6 个示波器关卡、时域开关、示波器 / 压线钳工具
// ② 真点击玩“缺储能电容”关：夹探头、抓开机波形、看到欠压复位、焊上 1000 µF、复测、交付
// ③ 示波器功能：光标读数、数学差值、AC 耦合、单次触发等不到边沿、地夹提醒
// ④ 6 关全部在浏览器里：故障在示波器里看得到 → 预期修法 → 示波器恢复 → 验收通过；每关一个错误修法修不好
// ⑤ 装配台“通电”页的示波器：八爪鱼 v10 开机波形、舵机起步跌落、并电容、老化电池复位
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v18 SHOTS=0（不截图 / 不录像）node e2e/v18-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v18", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv18";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = { scenarios: {} };
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const L = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) { await p.locator(`[data-testid=${t}]`).scrollIntoViewIfNeeded(); await p.locator(`[data-testid=${t}]`).screenshot({ path: f, style: ".no-print.sticky { visibility: hidden !important; }" }); } else await p.screenshot({ path: f }); };
const click = (t) => p.click(`[data-testid=${t}]`);
const txt = (t) => p.locator(`[data-testid=${t}]`).innerText();
const capture = async (to = 30000) => { const n0 = await L(() => window.__repair.scope.n || 0); await click("scope-capture"); await p.waitForFunction((n) => (window.__repair.scope.n || 0) > n && !window.__repair.scope.busy, n0, { timeout: to }); };
const inR = (v, r) => Number.isFinite(v) && v >= r[0] - 1e-9 && v <= r[1] + 1e-9;

// ①
await p.goto(BASE + "/repair"); await p.waitForSelector("[data-testid=board-svg]");
await L(() => localStorage.clear()); await p.reload(); await p.waitForSelector("[data-testid=board-svg]");
ok(await p.locator("[data-testid^=sc-]").count() === 12, "原来 12 关还在");
ok(/早期原型，简化仿真/.test(await txt("banner")), "维修页顶栏标明“早期原型，简化仿真”");
const ss = await p.locator("[data-testid^=scope-sc-]").count(); ok(ss === 6, `示波器关卡 ${ss} 个`);
ok(await p.locator("[data-testid=tool-scope]").count() === 1 && await p.locator("[data-testid=tool-crimper]").count() === 1, "工具栏有示波器（7）和压线钳（8）");
await click("td-toggle"); ok(await p.locator("[data-testid=scope]").count() === 1, "老关卡也能打开时域模式（示波器）");
await click("td-toggle");

// ② 真点击
await click("scope-sc-rig-missing-bulk"); await wait(200);
ok(await p.locator("[data-testid=scope]").count() === 1 && await p.locator("[data-testid=zone-PWR]").count() === 1, "示波器关卡自动开时域模式；三块板分区画出来");
await p.keyboard.press("7"); ok(await L(() => window.__repair.game.tool) === "scope", "快捷键 7 = 示波器");
await click("scope-ch1-clip"); await p.locator("[data-testid=tp-TP5] circle").click(); await p.locator("[data-testid=tp-TP3] circle").click();
const sc0 = await L(() => window.__repair.scope.chans.map((c) => c.node));
ok(sc0[0] === "3V3_C" && sc0[1] === "5V", "点测试点把 CH1 / CH2 探头夹上去", sc0.join(","));
ok(await p.locator("[data-testid=scope-probe-1]").count() === 1, "板子上画出 CH1 探头");
await click("scope-exp-power"); await p.selectOption("[data-testid=scope-tdiv]", String(10e-3));
await capture();
const st0 = await txt("scope-stats"); const r0 = await L(() => window.__repair.scope.cap.dev.U3.resets);
ok(r0 >= 1, "抓开机：主控欠压复位（缺储能电容）", st0);
ok(await p.locator("[data-testid=scope-bo]").count() >= 1, "屏幕上画出主控欠压复位阈值线（估算）");
ok(/示波器/.test(await L(() => window.__repair.game.log.at(-1).kind)), "维修记录里写了示波器读数");
await shot("missing-bulk-faulty", "scope");
await shot("rig-board");
// 修：断电、拆电池、焊 1000 µF（方向对）、装电池
await click("power").catch(() => {}); if (await L(() => window.__repair.game.power)) await click("power");
await click("bat-remove");
await click("tool-iron"); await p.locator("[data-testid=empty-C5]").click();
await click("bin-cap-1000u"); ok(await p.locator("[data-testid=orient-rev]").count() === 1, "电解电容有方向选项");
await click("orient-ok"); await click("act-place");
ok(await L(() => window.__repair.game.board.parts.find((p) => p.ref === "C5").state.present !== false), "C5 焊上了");
await click("bat-insert");
await click("tool-scope"); await capture();
const r1 = await L(() => window.__repair.scope.cap.dev.U3.resets);
ok(r1 === 0, "复测：不再复位", await txt("scope-stats"));
await shot("missing-bulk-fixed", "scope");
await click("deliver"); await p.waitForSelector("[data-testid=report]");
ok(await L(() => window.__repair.game.solved), "交付验收通过", (await txt("report")).slice(0, 80));
await shot("missing-bulk-report", "report");

// ③ 示波器功能
const box = await p.locator("[data-testid=scope-screen]").boundingBox();
await p.mouse.click(box.x + box.width * 0.2, box.y + 40); await p.mouse.click(box.x + box.width * 0.8, box.y + 40);
const cur = await txt("scope-cursors"); ok(/Δt/.test(cur) && /CH1/.test(cur), "光标读数（t1 / t2 / Δt / 各通道电压）", cur.slice(0, 90));
await click("scope-math"); await capture();
ok(await p.locator("[data-testid=scope-trace-math]").count() === 1 && /A−B/.test(await txt("scope-readout")), "数学 CH1 − CH2 显示");
await click("scope-math");
await L(() => window.__repair.setScope({ exp: "steady", tdiv: 2e-6, chans: window.__repair.scope.chans.map((c, i) => (i === 0 ? { ...c, node: "5V", ac: true, off: 0, vdiv: 0.02 } : { ...c, on: false })) }));
await capture();
const pp = await L(() => window.__repair.scope.cap.meas[0].pp);
ok(pp > 0.002 && pp < 0.2, "AC 耦合 2 µs/div 看到升压开关纹波", (pp * 1000).toFixed(1) + " mV 峰峰");
await shot("ripple-ac", "scope");
await L(() => window.__repair.setScope({ trig: { src: 0, slope: "rise", level: 9, mode: "single" } }));
await capture().catch(() => {});
ok(await L(() => !!window.__repair.scope.cap?.waiting), "单次触发电平 9 V：等不到边沿");
await L(() => window.__repair.setScope({ trig: { src: 0, slope: "rise", level: 2.5, mode: "auto" } }));
ok(/地夹/.test(await txt("scope-ground-note")), "探头地夹提醒");
ok(/早期原型，简化仿真/.test(await txt("scope")), "示波器面板标明“早期原型，简化仿真”");

// ④ 6 关
const ids = await L(() => [...document.querySelectorAll("[data-testid^=scope-sc-]")].map((e) => e.dataset.testid.slice(9)));
for (const id of ids) {
  await click(`scope-sc-${id}`); await wait(150);
  const sc = await L(() => window.__repair.game.sc);
  const e = sc.scopeExpect[0];
  const capAt = async () => {
    await L((e) => { const c = e.cap; window.__repair.setScope({ exp: c.exp, tdiv: c.tdiv, pre: c.pre ?? 0.1, math: !!c.math, chans: [0, 1, 2, 3].map((i) => { const ac = c.chans[i]?.coupling === "AC"; return { on: !!c.chans[i], node: c.chans[i]?.node || "", vdiv: ac ? 0.02 : 1, off: ac ? 0 : -2, ac }; }), trig: c.trig ? { ...c.trig, mode: "auto" } : { src: "none", slope: "rise", level: 0, mode: "auto" }, cap: null }); }, e);
    if (e.cap.exp === "run" && !(await L(() => window.__repair.game.power))) await L(() => window.__repair.play({ a: "power", on: true }));
    if (e.cap.exp === "steady" && e.cap.run) { await L(() => window.__repair.play({ a: "power", on: true })); await L(() => window.__repair.play({ a: "run", on: true })); }
    await capture();
    return L((m) => window.__repair.metricOf(window.__repair.scope.cap, m), e.metric);
  };
  const vf = await capAt();
  ok(inR(vf, e.faulty), `[${id}] 示波器里看得到故障：${e.zh}`, vf.toFixed(3));
  await shot(`${id}-faulty`, "scope");
  for (const a of sc.solution.flat()) await L((a) => window.__repair.play(a), a);
  const vx = await capAt();
  ok(inR(vx, e.fixed), `[${id}] 修好后恢复`, vx.toFixed(3));
  await shot(`${id}-fixed`, "scope");
  await L(() => window.__repair.play({ a: "deliver" }));
  const solved = await L(() => window.__repair.game.solved); ok(solved, `[${id}] 预期修法验收通过`);
  res.scenarios[id] = { faulty: vf, fixed: vx, solved };
  await click("restart"); await wait(100);
  for (const a of sc.wrong[0]) await L((a) => window.__repair.play(a), a);
  await L(() => window.__repair.play({ a: "deliver" }));
  ok(!(await L(() => window.__repair.game.solved)), `[${id}] 错误修法修不好`);
}

// ⑤ 装配台
await p.goto(BASE + "/assembly?scene=electrics"); await p.waitForSelector("[data-testid=bench-scope-panel]", { state: "attached", timeout: 60000 });
await L(() => { document.querySelector("[data-testid=bench-scope-panel]").open = true; });
await p.locator("[data-testid=bench-scope-open]").scrollIntoViewIfNeeded(); await click("bench-scope-open"); await p.waitForSelector("[data-testid=bench-scope]"); await click("bscope-src-ref"); /* v19：默认是“我的电路”，参考板改成备用 */
const bcap = async () => { await L(() => { window.__benchScope = null; }); await click("bscope-capture"); await p.waitForFunction(() => window.__benchScope, null, { timeout: 30000 }); return L(() => window.__benchScope.cap); };
const pw = await bcap(); ok(pw.meas[1].max > 5 && pw.dev.U1.resets === 0, "工作台：八爪鱼 v10 开机波形（5VA 升到 5 V，主控不复位）", `5VA 最高 ${pw.meas[1].max.toFixed(2)} V`);
await shot("bench-power", "bench-scope");
await click("bscope-exp-run"); await p.selectOption("[data-testid=bscope-tdiv]", String(2e-3));
const a0 = await bcap(); await shot("bench-servo-dip-nocap", "bench-scope");
await click("bscope-cap-470"); const a1 = await bcap(); await shot("bench-servo-dip-470u", "bench-scope");
ok(a1.meas[1].pp < a0.meas[1].pp * 0.6, "并 470 µF：舵机起步时 5VA 跌落变小", `${(a0.meas[1].pp * 1000).toFixed(0)} → ${(a1.meas[1].pp * 1000).toFixed(0)} mV 峰峰`);
await click("bscope-batt-aged"); const a2 = await bcap(); await shot("bench-aged-battery", "bench-scope");
ok(a2.dev.U1.resets > 0, "老化电池：主控（接在电池上）欠压复位，电容救不了", `复位 ${a2.dev.U1.resets} 次，VBAT 最低 ${a2.meas[0].min.toFixed(2)} V`);
res.bench = { nocapPP: a0.meas[1].pp, cap470PP: a1.meas[1].pp, agedResets: a2.dev.U1.resets };

// ⑥ 指南 + 素材页
await p.goto(BASE + "/assembly/guide"); await p.waitForSelector("[data-testid=guide-scope]", { timeout: 60000 });
ok(/地夹/.test(await txt("guide-scope")) && /不替代真实安全培训/.test(await txt("guide-scope")), "装配指南有示波器 / 时域章节");
await p.goto(BASE + "/credits"); await p.waitForSelector("[data-testid=credits-scope]");
ok(/我的补充/.test(await txt("credits-scope")) && /估算/.test(await txt("credits-scope")), "素材页写明时域仿真为自写、参数为估算");
ok(errs.length === 0, "没有页面错误", errs.join(" | "));
await ctx.close(); await b.close();
if (SHOT) {
  const v = fs.readdirSync(VID).find((f) => f.endsWith(".webm"));
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "setpts=0.6*PTS,scale=1280:-2" -c:v libx264 -crf 32 -preset veryfast -an ${OUT}/demo.mp4`); const mb = fs.statSync(`${OUT}/demo.mp4`).size / 1e6; ok(mb < 20, "demo.mp4 < 20 MB", mb.toFixed(1) + " MB"); res.videoMB = mb; }
}
fs.writeFileSync(`${OUT}/logs/v18-bench.json`, JSON.stringify({ pass, fail, ...res }, null, 1));
console.log(`\nv18 e2e：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
