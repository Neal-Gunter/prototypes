// v13：八爪鱼步态测量（浏览器和 node 共用）。在一个“看不见的”台面上，用固件 JS 孪生 + Rapier 物理跑一个步态并测量。
// gait = null → 固件默认步态；否则相当于把 octopus_gait_custom.h 编进固件（Body.SetCustomGait）。
// onProgress(frac) 返回 Promise 时，每跑 1 s 仿真让一次主线程（浏览器里不卡页面）。
import { OctoSim } from "../assembly/octopus/sim.js";
import { LocoPhys } from "../assembly/octopus/loco.js";
export async function runGait({ gait = null, sec = 15, mu = 0.5, variant = "v10", plan = "A", cmd = "GO", settle = 4, every = 0, dt = 1 / 240, pad = [0.15, 0.45], onProgress = null } = {}) {
  const t = new OctoSim({ phase: 3, variant, plan });
  const lp = await LocoPhys.create(t, { mu, dt, pad }); t.attachPhys(lp);
  for (let i = 0; i < settle * 20; i++) t.step(0.05);
  t.rt.body.SetCustomGait(gait);
  lp.reset();
  t.send(cmd);
  let col = 0; const trace = [];
  const n = Math.round(sec * 20);
  for (let i = 0; i < n; i++) {
    t.step(0.05);
    if (t.servos.some((x) => x.collide)) col++;
    if (every && i % every === 0) { const s = lp.snapshot(); trace.push([+s.t.toFixed(2), +s.fwd.toFixed(3), +s.dx.toFixed(3), +s.dh.toFixed(2)]); }
    if (onProgress && i % 20 === 19) await onProgress((i + 1) / n);
  }
  const r = lp.gaitReport();
  const out = { ...r, col, checksOk: t.res.errCount === 0 && t.res.checks.every((c) => c.ok), trace, sim: t, lp };
  return out;
}
export const fmt = (r) => ({ fwd: +r.fwd.toFixed(2), speed: +r.speed.toFixed(3), dx: +r.dx.toFixed(2), dh: +r.dh.toFixed(1), slip: +r.slip.toFixed(2), contacts: +r.contactsAvg.toFixed(2), tiltMax: +r.tiltMax.toFixed(2), marginMin: r.marginMin == null ? null : +r.marginMin.toFixed(2), energyJ: +r.energyJ.toFixed(3), powerW: +r.powerW.toFixed(3), col: r.col });
