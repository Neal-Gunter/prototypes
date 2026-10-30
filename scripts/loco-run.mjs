// v9 物理行走测量：node scripts/loco-run.mjs [plan] [variant] [mu] [cmd] [sec]
import { OctoSim } from "../src/assembly/octopus/sim.js";
import { fixesAll } from "../src/assembly/octopus/firmware.js";
import { LocoPhys } from "../src/assembly/octopus/loco.js";
export async function walk({ plan = "B", variant = "plus", mu = 0.5, cmd = "GO", sec = 8, log = false, gait = null } = {}) {
  const sim = variant === "plus" ? new OctoSim({ phase: 3, variant: "plus", plan }) : new OctoSim({ phase: 3, plan, F: fixesAll(true) });
  const lp = await LocoPhys.create(sim, { mu }); sim.attachPhys(lp);
  const st = (s) => { for (let i = 0; i < s * 20; i++) sim.step(0.05); };
  st(3); const settle = lp.snapshot(); lp.reset();
  if (gait) { sim.send(gait); st(0.2); lp.reset(); }
  sim.send(cmd);
  for (let k = 0; k < sec; k++) { st(1); if (log) { const s = lp.snapshot(); console.log(k + 1, "fwd", s.fwd.toFixed(2), "dx", s.dx.toFixed(2), "dh", s.dh.toFixed(1), "y", s.y.toFixed(2), "tilt", s.tilt.toFixed(1), "v", s.v.toFixed(2), "slip", s.slip.toFixed(2), "cont", s.contacts, "bodyLoad", s.bodyLoad.toFixed(3), "lag", s.lag.toFixed(1), "load", s.load.map((x) => x.toFixed(3)).join(",")); } }
  return { settle, end: lp.snapshot(), lp, sim };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [plan = "B", variant = "plus", mu = "0.5", cmd = "GO", sec = "8"] = process.argv.slice(2);
  const r = await walk({ plan, variant, mu: +mu, cmd, sec: +sec, log: true });
  const s = r.settle; console.log("settle y", s.y.toFixed(3), "tilt", s.tilt.toFixed(2), "bodyLoad", s.bodyLoad.toFixed(3), "legs", s.load.map((x) => x.toFixed(3)).join(","), "mass", s.mass.toFixed(3));
  const e = r.end; console.log("END fwd", e.fwd.toFixed(2), "perCycle", e.perCycle?.toFixed(2), "cycles", e.cycles, "slip", e.slip.toFixed(2));
}
