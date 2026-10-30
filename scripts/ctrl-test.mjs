// v14：闭环倾斜 / 航向反馈测试（node scripts/ctrl-test.mjs）。仿真 IMU、姿态滤波、八爪鱼航向闭环、四足倾斜闭环、固件头文件
import fs from "node:fs";
import R from "@dimforge/rapier3d-compat";
import { SimImu, Attitude, TiltCtrl, OCTO_CTRL, LAB_CTRL, toCtrlHeader } from "../src/gait/ctrl.js";
import { runGait } from "../src/gait/octo-measure.js";
import { octoRowGait } from "../src/gait/octo-best.js";
import { gaitForProject, measureArtic } from "../src/gait/artic-gait.js";
import { quadSetup } from "./quad-search.mjs";
let pass = 0, fail = 0; const out = { octo: {}, quad: {} };
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("FAIL", m); } };
const r3 = (r) => ({ speed: +r.speed.toFixed(3), dx: +r.dx.toFixed(2), dh: +r.dh.toFixed(1), tiltGMax: r.tiltGMax == null ? null : +r.tiltGMax.toFixed(2), tiltGAvg: r.tiltGAvg == null ? null : +r.tiltGAvg.toFixed(2) });
// 1. IMU：延迟 + 确定的噪声；姿态滤波收敛到真倾角
{ const a = new SimImu(), b = new SimImu(), k = Math.PI / 180, roll = 5 * k;
  const truth = { acc: [0, Math.sin(roll), Math.cos(roll)], gyro: [0, 0, 0] };
  for (let i = 0; i <= 200; i++) { a.feed(i * 0.005, truth); b.feed(i * 0.005, truth); }
  ok(JSON.stringify(a.read(1)) === JSON.stringify(b.read(1)), "IMU 噪声确定");
  ok(a.read(1).t <= 1 - 0.02 + 1e-9, "IMU 有 20 ms 延迟");
  const att = new Attitude(0.98); for (let i = 0; i < 300; i++) att.update(a.read(1), 0.01);
  ok(Math.abs(att.roll / k - 5) < 0.5, `姿态滤波横滚 ${(att.roll / k).toFixed(2)}°`);
  ok(new TiltCtrl(OCTO_CTRL).o.slopeFlipDeg === 1.5, "八爪鱼控制器带横坡换向"); }
// 2. 八爪鱼：航向闭环（15 s 同步划桨）
const G = octoRowGait(), O = async (o) => { const r = await runGait({ gait: G, sec: 15, ...o }); try { r.lp?.world?.free(); } catch {} return r; };
for (const [k, env] of [["flat", {}], ["flatLoad", { load: { g: 30, x: 3, z: 0, t: 2 } }], ["cross3", { slope: { deg: 3, dir: "cross" } }], ["crossL3", { slope: { deg: 3, dir: "crossL" } }], ["cross2Load", { slope: { deg: 2, dir: "cross" }, load: { g: 30, x: 3, z: 0, t: 2 } }]]) {
  const o = await O(env), c = await O({ ...env, ctrl: {} }); out.octo[k] = { open: r3(o), closed: r3(c) };
  ok(Math.abs(c.dh) <= Math.abs(o.dh) + 0.5, `八爪鱼 ${k}：闭环航向 ${c.dh.toFixed(1)}° 不比开环 ${o.dh.toFixed(1)}° 差`);
}
ok(Math.abs(out.octo.cross3.closed.dh) < 0.5 * Math.abs(out.octo.cross3.open.dh), "八爪鱼 3° 横坡：航向偏转减半以上");
ok(Math.abs(out.octo.flatLoad.closed.dh) < Math.abs(out.octo.flatLoad.open.dh), "八爪鱼 加负载：航向偏转变小");
// 3. 四足示例：倾斜闭环（6 s）
{ await R.init(); const S = await quadSetup(), g = gaitForProject(S.project), still = { ...g, joints: g.joints.map((J) => ({ ...J, amp: 0 })) };
  const M = (gg, o) => measureArtic(R, S.project, S.an, S.X.M, gg, { sec: 6, ...o });
  for (const [k, gg, env] of [["walkFlat", g, {}], ["walkDrop", g, { drop: { g: 60, t: 2, x: 3 } }], ["walkCross8", g, { slope: { deg: 8, dir: "cross" } }], ["walkDown8", g, { slope: { deg: 8, dir: "down" } }], ["stillCross8", still, { slope: { deg: 8, dir: "cross" } }], ["stillDown8", still, { slope: { deg: 8, dir: "down" } }]]) {
    const o = await M(gg, env), c = await M(gg, { ...env, ctrl: {} }), n = await M(gg, { ...env, ctrl: { kpT: -0.5 } });
    out.quad[k] = { open: r3(o), closed: r3(c), wrongSign: r3(n) };
    ok(c.tiltGAvg < o.tiltGAvg, `四足 ${k}：闭环平均倾角 ${c.tiltGAvg.toFixed(2)}° < 开环 ${o.tiltGAvg.toFixed(2)}°`);
    ok(n.tiltGAvg > c.tiltGAvg, `四足 ${k}：符号取反会更歪（验证符号）`);
  } }
// 4. 固件头文件
{ const h = toCtrlHeader({ ...OCTO_CTRL, kpH: 0.05 });
  ok(h.includes("#define OCTO_CTRL_CUSTOM") && h.includes("kSlopeFlipDeg") && /kKpH\s*=\s*0\.05/.test(h), "octopus_ctrl_custom.h 内容"); }
ok(LAB_CTRL.kpH === 0 && LAB_CTRL.kpT > 0, "实验室默认只开倾斜");
fs.mkdirSync("/workspace/proto-site/v14/logs", { recursive: true });
fs.writeFileSync("/workspace/proto-site/v14/logs/ctrl-test.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out)); console.log(`ctrl-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
