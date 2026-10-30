// v13：用固件 JS 孪生 + Rapier 物理跑一个步态并测量（node scripts/gait-run.mjs [gait.json] [sec] [mu]）
// gait = null → 固件默认步态；否则相当于把 octopus_gait_custom.h 编进固件（Body.SetCustomGait）。
import { OctoSim } from "../src/assembly/octopus/sim.js";
import { LocoPhys } from "../src/assembly/octopus/loco.js";
import fs from "node:fs";
export async function runGait({ gait = null, sec = 15, mu = 0.5, variant = "v10", plan = "A", cmd = "GO", settle = 4, every = 0, dt = 1 / 240, pad = [0.15, 0.45] } = {}) {
  const t = new OctoSim({ phase: 3, variant, plan });
  const lp = await LocoPhys.create(t, { mu, dt, pad }); t.attachPhys(lp);
  for (let i = 0; i < settle * 20; i++) t.step(0.05);
  t.rt.body.SetCustomGait(gait);
  lp.reset();
  t.send(cmd);
  let col = 0; const trace = [];
  for (let i = 0; i < sec * 20; i++) { t.step(0.05); if (t.servos.some((x) => x.collide)) col++; if (every && i % every === 0) { const s = lp.snapshot(); trace.push([+s.t.toFixed(2), +s.fwd.toFixed(3), +s.dx.toFixed(3), +s.dh.toFixed(2)]); } }
  const r = lp.gaitReport();
  return { ...r, col, checksOk: t.res.errCount === 0 && t.res.checks.every((c) => c.ok), trace, sim: t, lp };
}
export const fmt = (r) => ({ fwd: +r.fwd.toFixed(2), speed: +r.speed.toFixed(3), dx: +r.dx.toFixed(2), dh: +r.dh.toFixed(1), slip: +r.slip.toFixed(2), contacts: +r.contactsAvg.toFixed(2), tiltMax: +r.tiltMax.toFixed(2), marginMin: r.marginMin == null ? null : +r.marginMin.toFixed(2), energyJ: +r.energyJ.toFixed(3), powerW: +r.powerW.toFixed(3), col: r.col });
if (import.meta.url === `file://${process.argv[1]}`) {
  const [f, sec = "15", mu = "0.5"] = process.argv.slice(2);
  const gait = f && f !== "-" ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  const t0 = Date.now(); const r = await runGait({ gait, sec: +sec, mu: +mu });
  console.log(JSON.stringify(fmt(r)), "wall", Date.now() - t0, "ms");
}
