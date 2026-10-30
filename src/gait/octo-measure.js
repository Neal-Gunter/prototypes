// v13：八爪鱼步态测量（浏览器和 node 共用）。在一个“看不见的”台面上，用固件 JS 孪生 + Rapier 物理跑一个步态并测量。
// gait = null → 固件默认步态；否则相当于把 octopus_gait_custom.h 编进固件（Body.SetCustomGait）。
// onProgress(frac) 返回 Promise 时，每跑 1 s 仿真让一次主线程（浏览器里不卡页面）。
import { OctoSim } from "../assembly/octopus/sim.js";
import { LocoPhys } from "../assembly/octopus/loco.js";
import { SimImu } from "./ctrl.js";
export async function runGait({ gait = null, sec = 15, mu = 0.5, variant = "v10", plan = "A", cmd = "GO", settle = 4, every = 0, dt = 1 / 240, pad = [0.15, 0.45], onProgress = null,
  massScale = 1, trimDeg = null, slope = null, ctrl = null, imu = null, load = null, startDelay = 0, caster = null, path = null } = {}) {
  // v14：massScale / trimDeg / slope = 鲁棒性和斜坡测试；ctrl = 闭环增益（null = 开环）；imu = IMU 噪声 / 延迟；
  // load = {g, x, z, t}：步态开始后 t 秒在机身上加负载；startDelay = 多等几秒再起步（随机种子用）
  const t = new OctoSim({ phase: 3, variant, plan });
  const lp = await LocoPhys.create(t, { mu, dt, pad, massScale, trimDeg, slope, caster }); t.attachPhys(lp);
  if (ctrl) t.attachImu(new SimImu(imu || {}));
  for (let i = 0; i < Math.round((settle + startDelay) * 20); i++) t.step(0.05);
  t.rt.body.SetCustomGait(gait);
  t.rt.body.SetController(ctrl);
  lp.reset();
  t.send(cmd);
  let col = 0; const trace = [];
  const n = Math.round(sec * 20);
  let loaded = false; const ctrlLog = [];
  for (let i = 0; i < n; i++) {
    if (load && !loaded && i * 0.05 >= (load.t ?? 2)) { lp.addLoad(load); loaded = true; }
    if (ctrl && (ctrl.kPath || ctrl.kiPath) && t.rt.body.ctrl_) t.rt.body.ctrl_.lateral = lp.snapshot().dx; // v15 路径保持：横向偏移用真值（简化，实机要外部定位）
    t.step(0.05);
    if (ctrl && i % 4 === 0 && t.rt.body.ctrlOut) { const o = t.rt.body.ctrlOut; ctrlLog.push([+(i * 0.05).toFixed(2), +o.u.toFixed(3), +o.eHdeg.toFixed(2), +o.roll.toFixed(2), +o.pitch.toFixed(2)]); }
    if (t.servos.some((x) => x.collide)) col++;
    if (every && i % every === 0) { const s = lp.snapshot(); trace.push([+s.t.toFixed(2), +s.fwd.toFixed(3), +s.dx.toFixed(3), +s.dh.toFixed(2)]); }
    if (onProgress && i % 20 === 19) await onProgress((i + 1) / n);
  }
  const r = lp.gaitReport();
  const out = { ...r, col, ctrlLog, checksOk: t.res.errCount === 0 && t.res.checks.every((c) => c.ok), trace, sim: t, lp };
  return out;
}
export const fmt = (r) => ({ fwd: +r.fwd.toFixed(2), speed: +r.speed.toFixed(3), dx: +r.dx.toFixed(2), dh: +r.dh.toFixed(1), slip: +r.slip.toFixed(2), contacts: +r.contactsAvg.toFixed(2), tiltMax: +r.tiltMax.toFixed(2), marginMin: r.marginMin == null ? null : +r.marginMin.toFixed(2), energyJ: +r.energyJ.toFixed(3), powerW: +r.powerW.toFixed(3), col: r.col });
