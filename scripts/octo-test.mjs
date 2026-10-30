import { OctoSim } from "../src/assembly/octopus/sim.js";
import { fixesAll, Runtime, Pca9685Dev, Gait } from "../src/assembly/octopus/firmware.js";
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
console.log(`octo tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
