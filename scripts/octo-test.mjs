import { OctoSim } from "../src/assembly/octopus/sim.js";
import { fixesAll, fixesPlus, Runtime, Pca9685Dev, Gait, AntiCollide, FIX_LIST } from "../src/assembly/octopus/firmware.js";
import { MD_ISSUES, PLUS_CHANGES } from "../src/assembly/octopus/issues.js";
import { readFileSync } from "node:fs";
import { LocoPhys } from "../src/assembly/octopus/loco.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const run = (s, sec) => { for (let i = 0; i < sec * 20; i++) s.step(0.05); return s.snapshot(); };
// 1 正常 + 修正版
let s = new OctoSim({ F: fixesAll(true) });
let sn = run(s, 4);
ok(sn.espOn && !sn.halted, "fixed boots");
ok(Math.abs(sn.freq - 50) < 0.2, "50Hz " + sn.freq);
ok(s.dev.regs[0xfe] === 121, "prescale 121");
ok(sn.servos.every((x) => Math.abs(x.ang - 90) < 1.5), "home 90 " + sn.servos.map((x) => x.ang.toFixed(0)));
ok(sn.checks.filter((c) => c.level === "err").length === 0, "no err " + JSON.stringify(sn.checks.filter((c) => c.level === "err")));
s.send("GO"); sn = run(s, 3);
ok(sn.servos.some((x) => Math.abs(x.ang - 90) > 15), "gait moves");
console.log("fixed GO pose", sn.pose, "peakI", sn.peakI.toFixed(2));
// 2 原样（kDual16）
s = new OctoSim({ F: fixesAll(false) }); sn = run(s, 4);
ok(Math.abs(s.dev.channel(0).ticks - 375) < 1, "home 375 ticks");
console.log("orig home angles", sn.servos.map((x) => x.ang.toFixed(0)).join(","), "peak", sn.peakI.toFixed(2));
s.send("GAIT f=1.0 yaw=20"); sn = run(s, 0.5);
ok(sn.log.some((l) => l.includes("一个参数都没匹配上")), "gait noop");
// 3 故障
for (const f of ["nognd", "pwm200", "vplus-esp", "servo360", "mech", "phase0", "u1unset", "lowbat"]) {
  s = new OctoSim({ F: fixesAll(true), fault: f }); sn = run(s, 4); s.send("GO"); const sn2 = run(s, 4);
  console.log(f.padEnd(10), "esp", sn2.espOn, "boots", sn2.boots, "halt", sn2.halted, "errs", sn2.checks.filter((c) => c.level === "err").map((c) => c.zh.slice(0, 12)).join("|"), "buzz", sn2.servos.filter((x) => x.buzz).length, "peakI", sn2.peakI.toFixed(2), "vserv", sn2.rails.vservo, "ang", sn2.servos.map((x) => x.ang.toFixed(0)).join(","));
}
// 4 Lateriality
const g = new Gait({ lat: false }); ok(Math.abs(g.Lateriality(0)) > 0.99, "sin front=1");
const g2 = new Gait({ lat: true }); ok(Math.abs(g2.Lateriality(0)) < 0.01, "cos front=0");
// 5 Single8 wave no-op
s = new OctoSim({ F: { ...fixesAll(true), single8: false } }); run(s, 3); s.send("WAVE 2"); sn = run(s, 0.6);
ok(sn.servos.every((x) => Math.abs(x.ang - 90) < 1.5), "single8 wave noop");
s = new OctoSim({ F: fixesAll(true) }); run(s, 3); s.send("WAVE 2"); sn = run(s, 0.4);
ok(Math.abs(sn.servos[2].ang - 90) > 5, "wave fixed moves arm2");
// 6 MCP
s = new OctoSim({ F: fixesAll(true), mode: "mcp" }); run(s, 2);
ok(s.mcp("self.octopus.action", { action: "crawl", steps: 2, speed: 1000 }) === "开始爬行", "mcp crawl");
sn = run(s, 5); ok(sn.mode === "idle", "crawl steps end " + sn.mode);
// 7 B
s = new OctoSim({ F: fixesAll(true), plan: "B" }); run(s, 4); s.send("GO"); sn = run(s, 6);
ok(sn.servos.length === 16, "B 16"); console.log("B GO pose", sn.pose, "peak", sn.peakI.toFixed(2));
s = new OctoSim({ F: fixesAll(true), plan: "B" }); run(s, 4); s.send("LEFT"); sn = run(s, 6); console.log("B LEFT pose", sn.pose);
// MCP 模式：工具调用真的让舵机动起来；steps 修正后走够步数自动停；wave 只动一条
s = new OctoSim({ F: fixesAll(true), mode: "mcp" }); run(s, 4);
ok(s.mcp("self.octopus.action", { action: "crawl", steps: 2, speed: 1000 }) === "开始爬行", "mcp crawl ret");
sn = run(s, 1.5); ok(sn.servos.some((x) => Math.abs(x.ang - 90) > 10), "mcp crawl moves");
sn = run(s, 4); ok(s.rt.body.mode_ === "idle", "mcp steps stop " + s.rt.body.mode_);
ok(s.mcp("self.octopus.set_gait", { freq: 8, amplitude: 30, phase: 45 }) === "步态已更新" && Math.abs(s.rt.body.GaitParamsSnapshot().freq_hz - 0.8) < 1e-9, "mcp set_gait");
// ---- 完善版（我的补充）----
// v9：位移只来自物理（Rapier 刚体 + 触手接触摩擦）。go() 接上物理再走；fwd = 沿起始前方（−z）
const go = async (o, cmd, sec = 10, mu = 0.5, gait = null) => { const t = new OctoSim({ phase: 3, variant: "plus", ...o }); const lp = await LocoPhys.create(t, { mu }); t.attachPhys(lp); run(t, 4); if (gait) { t.send(gait); run(t, 0.2); } lp.reset(); const p0 = { ...t.pose }; t.send(cmd); let col = 0, bl = 0, n = 0; for (let i = 0; i < sec * 20; i++) { t.step(0.05); if (t.servos.some((x) => x.collide)) col++; if (i > 40) { bl += lp.meas.bodyLoad; n++; } } const L = lp.snapshot(); return { t, lp, L, dz: t.pose.z - p0.z, dx: t.pose.x - p0.x, dh: ((t.pose.h - p0.h) * 180) / Math.PI, fwd: L.fwd, col, bodyLoad: bl / Math.max(1, n) }; };
let r = await go({ plan: "A" }, "GO"); ok(r.fwd > 5 && Math.abs(r.dx) < 3 && r.col === 0, `plus A crawls forward (physics) fwd=${r.fwd.toFixed(1)} dz=${r.dz.toFixed(1)} dx=${r.dx.toFixed(1)} col=${r.col}`);
ok(r.t.res.errCount === 0 && r.t.res.checks.every((c) => c.ok), "plus A all checks ok " + JSON.stringify(r.t.res.checks.filter((c) => !c.ok).map((c) => c.zh)));
ok(r.L.pen < 0.1, `plus A tip sink < 1 mm: ${(r.L.pen * 10).toFixed(2)} mm`);
r = await go({ plan: "A" }, "LEFT"); ok(r.dh < -20 && r.dx < 0, `plus A LEFT turns left dh=${r.dh.toFixed(0)} dx=${r.dx.toFixed(1)}`);
r = await go({ plan: "A" }, "RIGHT"); ok(r.dh > 20 && r.dx > 0, `plus A RIGHT turns right dh=${r.dh.toFixed(0)}`);
r = await go({ plan: "B" }, "GO"); ok(r.fwd > 8 && Math.abs(r.dx) < 9 && r.col === 0, `plus B walks forward by foot contact fwd=${r.fwd.toFixed(1)} dx=${r.dx.toFixed(1)} col=${r.col}`);
ok(r.bodyLoad < 0.05 * r.L.mass && r.L.y > 0.8, `plus B legs carry the weight (plate ${(r.bodyLoad * 1000).toFixed(0)} g of ${(r.L.mass * 1000).toFixed(0)} g, body y ${r.L.y.toFixed(2)} cm)`);
// 尖球陷入桌面 ≈ 2.2 mm：Rapier 冲量关节 + 4 g 轻连杆托 449 g 机身时的求解器残差（与迭代数/步长/接触刚度无关，随连杆质量 1/m 变化），不是几何设计；如实报出，阈值 2.5 mm
ok(r.L.pen < 0.25, `plus B tip sink (solver residual) < 2.5 mm: ${(r.L.pen * 10).toFixed(2)} mm`);
ok(r.L.y - r.L.pen > 0.8, `plus B body plate stays clear of table`);
ok(r.L.slip > 0 && r.L.slip < 1 && r.L.perCycle > 1, `plus B per-cycle ${r.L.perCycle?.toFixed(2)} cm slip ${r.L.slip.toFixed(2)}`);
console.log("v9 plus B GO", { fwd: +r.fwd.toFixed(2), dx: +r.dx.toFixed(2), dh: +r.dh.toFixed(1), perCycle: +r.L.perCycle.toFixed(2), slip: +r.L.slip.toFixed(2), y: +r.L.y.toFixed(2), peakTorque: +r.L.peakTorque.toFixed(2) });
{ const z = await go({ plan: "B" }, "GO", 6, 0); ok(Math.abs(z.fwd) < 0.5 && Math.hypot(z.dx, z.dz) < 0.5, `μ=0 ⇒ plus B no advance fwd=${z.fwd.toFixed(2)}`); }
{ const z = await go({ plan: "A" }, "GO", 6, 0); ok(Math.abs(z.fwd) < 0.5 && Math.hypot(z.dx, z.dz) < 0.5, `μ=0 ⇒ plus A no advance fwd=${z.fwd.toFixed(2)}`); }
{ const z = await go({ plan: "B" }, "GO", 6, 0.5, "GAIT PHASE=0 PRESS=0"); ok(z.fwd < 1, `v8 B gait (phase 0, no press) does not walk fwd=${z.fwd.toFixed(2)}`); }
{ const z = await go({ plan: "A", variant: "md", F: fixesAll(true) }, "GO", 6); ok(Math.abs(z.fwd) < 1, `md A (yaw only, plate on table) does not walk fwd=${z.fwd.toFixed(2)}`); }
{ const z = await go({ plan: "B", variant: "md", F: fixesAll(true) }, "GO", 6); ok(Math.abs(z.fwd) < 1, `md B (stance lift 0) does not walk fwd=${z.fwd.toFixed(2)}`); }
{ const t = new OctoSim({ phase: 3, variant: "plus", plan: "B" }); run(t, 3); t.send("GO"); run(t, 4); ok(t.pose.x === 0 && t.pose.z === 0 && t.pose.h === 0, "no physics attached ⇒ body does not move (no kinematic shortcut)"); }
r = await go({ plan: "B" }, "LEFT"); ok(r.dh < -45 && Math.hypot(r.dx, r.dz) < 2 && r.col === 0, `plus B LEFT spins in place dh=${r.dh.toFixed(0)}`);
ok(r.t.peakI < 5, "plus B peak current < XL4015 5 A: " + r.t.peakI.toFixed(2));
r = await go({ plan: "A" }, "GAIT F=0.8 YAW=25", 2); ok(Math.abs(r.t.rt.body.GaitParamsSnapshot().freq_hz - 0.8) < 1e-9 && r.t.rt.body.GaitParamsSnapshot().yaw_amp_deg === 25, "plus GAIT parse");
s = new OctoSim({ phase: 3, variant: "plus" }); run(s, 4); ok(Math.abs(s.dev.channel(0).us - 1500) < 6, "plus pulse centre 1.5 ms " + s.dev.channel(0).us.toFixed(0));
s = new OctoSim({ phase: 3, variant: "plus", mode: "mcp" }); run(s, 4); s.mcp("self.octopus.action", { action: "crawl", steps: 2, speed: 300 }); ok(s.rt.body.GaitParamsSnapshot().freq_hz <= 1.2, "plus speed clamp ≤1.2 Hz");
s = new OctoSim({ phase: 3, variant: "plus" }); run(s, 4); ok(Math.abs(s.rt.vbat - 11.1) < 0.2, "plus batt sense 11.1 V " + s.rt.vbat);
s = new OctoSim({ phase: 3, variant: "plus", fault: "lowbat" }); run(s, 4); s.send("GO"); sn = run(s, 2); ok(s.rt.lowBatt && sn.mode === "idle", "plus low-batt cutoff");
s = new OctoSim({ phase: 3, variant: "plus" }); run(s, 4); s.send("GO"); run(s, 2); s.send("REST"); run(s, 3); ok(s.servos.every((x) => x.us === 0), "plus relax FULL OFF"); s.send("WAVE 2"); run(s, 0.4); ok(s.servos[2].us > 0, "plus wakes after relax");
ok(new OctoSim({ phase: 3, variant: "md" }).bench.vbat === 7.4 && !new OctoSim({ phase: 3, variant: "md" }).bench.roles.includes("DIV"), "md variant untouched");
const y = AntiCollide([0, 30, -30, 0, 0, 0, 0, 0], 43); ok(y.every((v, a) => 45 - y[(a + 1) % 8] + v >= 42.9), "anti-collide gap");
ok(MD_ISSUES.length === 29 && MD_ISSUES.every((_, i) => PLUS_CHANGES.some((c) => c.issues.includes(i))), "every MD issue mapped in changelog");
ok(FIX_LIST.filter((f) => f.plus).every((f) => f.zh.includes("我的补充")), "plus fixes labelled");
// v10 紧凑无线版（我的补充）：电池在机身上，没有 USB / 墙插
{
  const { massV10, LIPO, GEO_V10 } = await import("../src/assembly/octopus/v10.js");
  const { AntiCollide: AC } = await import("../src/assembly/octopus/firmware.js");
  let r = await go({ variant: "v10", plan: "A" }, "GO", 15);
  ok(r.fwd > 4 && Math.abs(r.dx) < 4 && r.col === 0, `v10 crawls forward from friction fwd=${r.fwd.toFixed(1)} dx=${r.dx.toFixed(1)} col=${r.col}`);
  ok(r.t.res.errCount === 0, "v10 no electrical errors " + JSON.stringify(r.t.res.checks.filter((c) => !c.ok).map((c) => c.zh)));
  ok(r.t.res.rails.espOn && !r.t.bench.usb && r.t.snapshot().log.filter((l) => l.includes("ESP-ROM")).length === 1, "v10 boots once on battery, no USB");
  ok(r.L.mass < 0.15 && Math.abs(r.L.mass - massV10()) < 1e-9, "v10 mass " + (r.L.mass * 1000).toFixed(1) + " g");
  ok(r.L.pen < 0.1, `v10 tip sink < 1 mm: ${(r.L.pen * 10).toFixed(2)} mm`);
  ok(r.t.peakI < 2, "v10 battery-side servo current under 2 A cable rating " + r.t.peakI.toFixed(2));
  const pb = r.t.snapshot().pBatAvg; ok(pb > 0.3 && pb < 4, "v10 avg battery power " + pb.toFixed(2) + " W ⇒ " + (LIPO.wh / pb).toFixed(1) + " h（估算）");
  const z = await go({ variant: "v10", plan: "A" }, "GO", 8, 0); ok(Math.abs(z.fwd) < 0.5 && Math.hypot(z.dx, z.dz) < 0.5, `μ=0 ⇒ v10 no advance fwd=${z.fwd.toFixed(2)}`);
  const L = await go({ variant: "v10", plan: "A" }, "LEFT", 10); ok(L.dh < -15, `v10 LEFT turns dh=${L.dh.toFixed(0)}`);
  let t = new OctoSim({ phase: 3, variant: "v10", fault: "lowbat" }); run(t, 4); t.send("GO"); run(t, 2); ok(t.rt.lowBatt && t.rt.body.mode_ === "idle", "v10 low-batt cutoff 3.55 V");
  t = new OctoSim({ phase: 3, variant: "v10", fault: "swoff" }); run(t, 3); ok(!t.res.rails.espOn && t.servos.every((x) => x.us === 0), "v10 switch off ⇒ nothing runs");
  t = new OctoSim({ phase: 3, variant: "v10", fault: "nognd" }); run(t, 3); ok(t.res.errCount > 0, "v10 missing GND flagged");
  t = new OctoSim({ phase: 3, variant: "v10" }); run(t, 4); ok(Math.abs(t.servos[0].us - 1500) < 6, "v10 LEDC pulse centre 1.5 ms " + t.servos[0].us);
  const y = AC([0, 40, -40, 0, 0, 0, 0, 0], -30); ok(y.every((v, a) => 45 - y[(a + 1) % 8] + v >= -30.1), "v10 anti-collide gap");
}
// v10 穿模检查（同一刚体内零件 Rapier 不报接触，用分离轴自己查）
{
  const { clipV10 } = await import("./v10-clip.mjs");
  const { DECK_V10 } = await import("../src/assembly/octopus/layout-v10.js");
  const c = clipV10();
  ok(c.worstMm <= 0.05 && c.list.length === 0, `v10 layout: no part overlaps (worst ${c.worstMm} mm ${c.list.slice(0, 3).join(", ")})`);
  ok(c.wireClearMm >= 0, `v10 servo cables clear of all parts (min ${c.wireClearMm} mm, ${c.wireWorst})`);
  ok(c.sweepMm <= 0.05, `v10 arms sweep ±55° without hitting anything (${c.sweepMm} mm ${JSON.stringify(c.sweep)})`);
  const save = DECK_V10.QTPY.p; DECK_V10.QTPY.p = [0, 3.7, 0];
  const bad = clipV10(); DECK_V10.QTPY.p = save;
  ok(bad.list.some((x) => x.includes("QTPY")), "v10 clip check catches a deliberately misplaced QT Py (control)");
}
// 完善版固件文件：静态检查（真正的编译检查用 arduino-cli，见 README）
{
  const R = (f) => readFileSync(new URL("../src/assembly/octopus/plus/" + f, import.meta.url), "utf8");
  const ino = R("octopus_plus/octopus_plus.ino"), bus = R("octopus_plus/octopus_bus.h"), body = R("octopus_plus/octopus_body.h"), gait = R("octopus_plus/octopus_gait.h"), batt = R("octopus_plus/octopus_batt.h"), mcp = R("xiaozhi/octopus_mcp.cpp"), md = R("小智八爪鱼-完善版.md");
  ok(!/#include\s*<BluetoothSerial/.test(ino) && ino.includes("6E400001-B5A3-F393-E0A9-E50E24DCCA9E"), "plus .ino uses BLE NUS, not BluetoothSerial");
  ok(/Pca9685\(\)\s*:/.test(bus) && /OCTO_DELAY_US\(500\)/.test(bus) && bus.includes("kPulseMin = 102") && bus.includes("0x1000"), "plus bus: default ctor, 500us wake, 102-512, FULL OFF");
  ok(body.includes("xQueueCreate") && body.includes("AntiCollide(") && body.includes("SetLimit("), "plus body: queue, anti-collide, limits");
  ok(batt.includes("kPin       = 10") && batt.includes("9.6f") && batt.includes("10.2f"), "plus batt: GPIO10 + 9.6/10.2 V");
  ok(gait.includes("Sweep(") && !/float Lateriality/.test(gait), "plus gait: mirrored sweep");
  ok(mcp.includes("b->Home()") && mcp.includes("834"), "plus mcp: home + speed clamp");
  ok([ino, bus, body, gait, batt, mcp, md].every((t) => t.includes("我的补充")), "every plus file labelled 我的补充");
  ok(md.includes("早期原型，简化仿真") && md.includes("立创实战派") && !md.includes("\ufffd"), "plus md: label + no mojibake");
}
console.log(`octo tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
