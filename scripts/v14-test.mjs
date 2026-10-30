// v14：搜索出的预设 + 闭环 + MPU-6050 零件 + 导出头文件
import { runGait } from "../src/gait/octo-measure.js";
import { octoRowGait, octoV14Gait } from "../src/gait/octo-best.js";
import { toCtrlHeader, OCTO_CTRL } from "../src/gait/ctrl.js";
import { OCTO_PROCEDURAL } from "../src/assembly/octopus/parts.js";
import { IMU_V10 } from "../src/assembly/octopus/v10.js";
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "  ok " : "  FAIL ") + m); };
const R = async (g, ctrl) => { const r = await runGait({ gait: g, sec: 10, ...(ctrl ? { ctrl } : {}) }); r.lp?.world?.free?.(); return r; };
const row = await R(octoRowGait()), v14 = await R(octoV14Gait()), v14c = await R(octoV14Gait(), {});
console.log(`row v=${row.speed.toFixed(3)} dh=${row.dh.toFixed(1)} | v14 v=${v14.speed.toFixed(3)} dh=${v14.dh.toFixed(1)} | v14+闭环 v=${v14c.speed.toFixed(3)} dh=${v14c.dh.toFixed(1)}`);
ok(Math.abs(row.speed - 3.757) < 0.01, "v13 同步划桨基准 3.757 cm/s 不变");
ok(v14.speed > row.speed * 1.2, "v14 预设比划桨快 20% 以上");
ok(Math.abs(v14.speed - 4.733) < 0.02, "v14 预设复现搜索日志 4.733 cm/s");
ok(Math.abs(v14c.dh) < Math.abs(v14.dh) / 2, "闭环把 v14 航向偏差减半以上");
ok(v14c.speed > row.speed * 1.15, "v14 + 闭环仍比划桨快 15% 以上");
ok(v14.energyJ / v14.fwd < row.energyJ / row.fwd, "v14 每厘米能耗低于划桨");
const m = OCTO_PROCEDURAL.find((p) => p.id === "p-octo-mpu6050");
ok(m && m.dims_mm.x === 26 && m.dims_mm.y === 4.6 && m.dims_mm.z === 17.8, "MPU-6050 外形 26.0 × 4.6 × 17.8 mm（Adafruit 3886 页面）");
ok(m && m.mass === 0.0018 && IMU_V10.g === 1.8, "MPU-6050 质量 1.8 g");
ok(m && m.octo.pins.SDA && m.octo.pins.SCL && m.octo.pins.VIN, "MPU-6050 引脚表有 VIN / SDA / SCL");
const h = toCtrlHeader(OCTO_CTRL, { source: "test" });
ok(/kSlopeFlipDeg/.test(h) && /namespace ctrl_cfg/.test(h), "闭环头文件含 ctrl_cfg 常量");
// 舵机限速：v14 每条触手回程速度 < 300 °/s
const sp = octoV14Gait().joints.map((j) => { const T = 1 / j.freq; return Math.max(2 * Math.abs(j.amp) / (j.duty * T), 2 * Math.abs(j.amp) / ((1 - j.duty) * T)); });
ok(Math.max(...sp) < 300, `v14 最大角速度 ${Math.max(...sp).toFixed(0)} °/s < 固件限速 300 °/s`);
console.log(`v14-test: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
