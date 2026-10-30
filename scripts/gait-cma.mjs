// v14：八爪鱼自动步态搜索（node 版，和台面 Worker 同一份代码）。node scripts/gait-cma.mjs [objective] [seed] [maxEvals] [mus,逗号] [out.json]
import fs from "node:fs";
import { runSearch, octoSpace, OBJECTIVES, robustCases, robustEval, scoreOf } from "../src/gait/search.js";
import { octoEvaluator } from "../src/gait/evaluators.js";
import { octoRowGait } from "../src/gait/octo-best.js";
const [obj = "speed", seed = "1", maxEvals = "200", musS = "0.5", out = ""] = process.argv.slice(2);
const ev = octoEvaluator({ sec: 10 }), space = octoSpace({ symmetric: true }), base = octoRowGait();
const w = OBJECTIVES[obj].w, mus = musS.split(",").map(Number);
const t0 = Date.now();
const res = await runSearch({ evalFn: ev, space, x0: space.encode(base), weights: w, seed: +seed, maxEvals: +maxEvals, maxSec: 3600, mus,
  onGen: ({ gen, evals, best, sec }) => console.error(`gen ${gen} evals ${evals} best ${best.score.toFixed(3)} v=${best.r.speed.toFixed(3)} dx=${best.r.dx.toFixed(2)} dh=${best.r.dh.toFixed(1)} ${sec.toFixed(0)}s`) });
const cases = robustCases({ seed: +seed });
const rb = await robustEval(ev, base, cases), rs = await robustEval(ev, res.best.g, cases);
const f = (x) => +x.toFixed(3);
const summary = { objective: obj, seed: +seed, mus, evals: res.evals, sec: f((Date.now() - t0) / 1000), stopped: res.stopped,
  base: { r: res.base.r, score: f(res.base.score) }, best: { r: res.best.r, score: f(res.best.score), gait: res.best.g },
  robust: { base: { speedMin: f(rb.speedMin), speedMean: f(rb.speedMean), driftMax: f(rb.driftMax), driftMean: f(rb.driftMean), rows: rb.rows }, best: { speedMin: f(rs.speedMin), speedMean: f(rs.speedMean), driftMax: f(rs.driftMax), driftMean: f(rs.driftMean), rows: rs.rows } }, hist: res.hist };
console.log(JSON.stringify({ obj, base: summary.robust.base.speedMean, best: summary.robust.best.speedMean, bmin: summary.robust.best.speedMin, bdrift: summary.robust.best.driftMax, basedrift: summary.robust.base.driftMax, v: res.best.r.speed, dx: res.best.r.dx }));
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 1));
