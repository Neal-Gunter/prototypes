import { OctoSim } from "../src/assembly/octopus/sim.js";
import { fixesAll, fixesPlus, Runtime, Pca9685Dev, Gait, AntiCollide, FIX_LIST } from "../src/assembly/octopus/firmware.js";
import { MD_ISSUES, PLUS_CHANGES } from "../src/assembly/octopus/issues.js";
import { readFileSync } from "node:fs";
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
const go = (o, cmd, sec = 10) => { const t = new OctoSim({ phase: 3, variant: "plus", ...o }); run(t, 4); const p0 = { ...t.pose }; t.send(cmd); let col = 0; for (let i = 0; i < sec * 20; i++) { t.step(0.05); if (t.servos.some((x) => x.collide)) col++; } return { t, dz: t.pose.z - p0.z, dx: t.pose.x - p0.x, dh: ((t.pose.h - p0.h) * 180) / Math.PI, col }; };
let r = go({ plan: "A" }, "GO"); ok(r.dz < -5 && Math.abs(r.dx) < 3 && r.col === 0, `plus A crawls forward dz=${r.dz.toFixed(1)} dx=${r.dx.toFixed(1)} col=${r.col}`);
ok(r.t.res.errCount === 0 && r.t.res.checks.every((c) => c.ok), "plus A all checks ok " + JSON.stringify(r.t.res.checks.filter((c) => !c.ok).map((c) => c.zh)));
r = go({ plan: "A" }, "LEFT"); ok(r.dh < -20 && r.dx < 0, `plus A LEFT turns left dh=${r.dh.toFixed(0)} dx=${r.dx.toFixed(1)}`);
r = go({ plan: "A" }, "RIGHT"); ok(r.dh > 20 && r.dx > 0, `plus A RIGHT turns right dh=${r.dh.toFixed(0)}`);
r = go({ plan: "B" }, "GO"); ok(r.dz < -1 && r.col === 0, `plus B crawls forward dz=${r.dz.toFixed(1)} col=${r.col}`);
r = go({ plan: "B" }, "LEFT"); ok(r.dh < -45 && Math.hypot(r.dx, r.dz) < 2 && r.col === 0, `plus B LEFT spins in place dh=${r.dh.toFixed(0)}`);
ok(r.t.peakI < 5, "plus B peak current < XL4015 5 A: " + r.t.peakI.toFixed(2));
r = go({ plan: "A" }, "GAIT F=0.8 YAW=25"); ok(Math.abs(r.t.rt.body.GaitParamsSnapshot().freq_hz - 0.8) < 1e-9 && r.t.rt.body.GaitParamsSnapshot().yaw_amp_deg === 25, "plus GAIT parse");
s = new OctoSim({ phase: 3, variant: "plus" }); run(s, 4); ok(Math.abs(s.dev.channel(0).us - 1500) < 6, "plus pulse centre 1.5 ms " + s.dev.channel(0).us.toFixed(0));
s = new OctoSim({ phase: 3, variant: "plus", mode: "mcp" }); run(s, 4); s.mcp("self.octopus.action", { action: "crawl", steps: 2, speed: 300 }); ok(s.rt.body.GaitParamsSnapshot().freq_hz <= 1.2, "plus speed clamp ≤1.2 Hz");
s = new OctoSim({ phase: 3, variant: "plus" }); run(s, 4); ok(Math.abs(s.rt.vbat - 11.1) < 0.2, "plus batt sense 11.1 V " + s.rt.vbat);
s = new OctoSim({ phase: 3, variant: "plus", fault: "lowbat" }); run(s, 4); s.send("GO"); sn = run(s, 2); ok(s.rt.lowBatt && sn.mode === "idle", "plus low-batt cutoff");
s = new OctoSim({ phase: 3, variant: "plus" }); run(s, 4); s.send("GO"); run(s, 2); s.send("REST"); run(s, 3); ok(s.servos.every((x) => x.us === 0), "plus relax FULL OFF"); s.send("WAVE 2"); run(s, 0.4); ok(s.servos[2].us > 0, "plus wakes after relax");
ok(new OctoSim({ phase: 3, variant: "md" }).bench.vbat === 7.4 && !new OctoSim({ phase: 3, variant: "md" }).bench.roles.includes("DIV"), "md variant untouched");
const y = AntiCollide([0, 30, -30, 0, 0, 0, 0, 0], 43); ok(y.every((v, a) => 45 - y[(a + 1) % 8] + v >= 42.9), "anti-collide gap");
ok(MD_ISSUES.length === 29 && MD_ISSUES.every((_, i) => PLUS_CHANGES.some((c) => c.issues.includes(i))), "every MD issue mapped in changelog");
ok(FIX_LIST.filter((f) => f.plus).every((f) => f.zh.includes("我的补充")), "plus fixes labelled");
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
