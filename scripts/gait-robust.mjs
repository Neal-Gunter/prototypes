// v15：多工况鲁棒步态搜索 + 留出工况对比（node，Worker 池）。
// node scripts/gait-robust.mjs [seed=1] [maxEvals=400] [caster=wheel] [rateLimit=240] [out.json] [x0=row|v14]
// 训练：trainConds（6 个工况，½ 平均 + ½ 最差 − 最差漂移）；对比：heldOutConds（11 个工况，和训练不重叠）上评 同步划桨 / v14 / 搜索结果
import fs from "node:fs";
import { runSearch, octoSpace, OBJECTIVES, trainConds, heldOutConds, robustEval, gaitMaxRate, multiScore } from "../src/gait/search.js";
import { octoRowGait, octoV14Gait } from "../src/gait/octo-best.js";
import { nodePool } from "./node-pool.mjs";
const [seed = "1", maxEvals = "400", caster = "wheel", rateLimit = "240", out = "", x0n = "row"] = process.argv.slice(2);
const job = { kind: "octo", sec: 10 };
const pool = nodePool(job), ev = (g, o) => pool.eval(g, o), space = octoSpace({ symmetric: true });
const O = OBJECTIVES.robust, hw = caster === "ball" ? null : { caster };
const start = x0n === "v14" ? octoV14Gait() : octoRowGait();
const t0 = Date.now();
const res = await runSearch({ evalFn: ev, space, x0: space.encode(start), weights: O.w, seed: +seed, maxEvals: +maxEvals, maxSec: 3600, conds: trainConds(8), agg: O.agg, rateLimit: +rateLimit, hw, parallel: true,
  onGen: ({ gen, evals, best, sec }) => console.error(`gen ${gen} evals ${evals} best ${best.score.toFixed(3)} v=${best.r.speed.toFixed(3)} dx=${best.r.dx.toFixed(2)} maxRate=${best.maxRate.toFixed(0)} ${sec.toFixed(0)}s`) });
const searchSec = (Date.now() - t0) / 1000;
const f = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const gaits = { row: octoRowGait(), v14: octoV14Gait(), v15: res.best.g };
const summary = { seed: +seed, maxEvals: +maxEvals, caster, rateLimit: +rateLimit, x0: x0n, evals: res.evals, conds: res.conds, sec: f(searchSec), evalsPerSec: f((res.evals * res.conds) / searchSec), pool: pool.n, gait: res.best.g, trainScore: f(res.best.score), hist: res.hist, heldOut: {}, train: {} };
for (const cs of ["ball", "wheel"]) {
  const H = heldOutConds(8).map((c) => (cs === "ball" ? c : { ...c, caster: cs })), T = trainConds(8).map((c) => (cs === "ball" ? c : { ...c, caster: cs }));
  for (const [k, g] of Object.entries(gaits)) {
    const h = await robustEval(ev, g, H, null, { parallel: true }), tr = await robustEval(ev, g, T, null, { parallel: true });
    const pack = (x) => ({ speedMin: f(x.speedMin), speedMean: f(x.speedMean), driftMax: f(x.driftMax), driftMean: f(x.driftMean), dhMax: f(x.dhMax), score: f(multiScore(x.rows.map((r) => ({ ...r, t: 10 })), O.w, { agg: O.agg })), rows: x.rows.map((r) => ({ tag: r.tag, speed: f(r.speed), dx: f(r.dx), dh: f(r.dh) })) });
    (summary.heldOut[cs] ||= {})[k] = { ...pack(h), maxRate: f(gaitMaxRate(g)) };
    (summary.train[cs] ||= {})[k] = pack(tr);
    console.error(cs, k, "heldOut", JSON.stringify({ ...summary.heldOut[cs][k], rows: undefined }));
  }
}
pool.terminate();
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ caster, rateLimit, trainScore: summary.trainScore, sec: summary.sec, evalsPerSec: summary.evalsPerSec }));
process.exit(0);
