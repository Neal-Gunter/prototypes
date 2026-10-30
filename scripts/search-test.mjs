// v14：自动步态搜索测试（node scripts/search-test.mjs）。ES 收敛、确定性、编码往返、Worker 同一份 runJob（八爪鱼 + 四足示例）
import fs from "node:fs";
import { SepCMA } from "../src/gait/es.js";
import { mulberry32 } from "../src/gait/rng.js";
import { octoSpace, articSpace, scoreOf, OBJECTIVES } from "../src/gait/search.js";
import { runJob } from "../src/gait/search-job.js";
import { octoRowGait } from "../src/gait/octo-best.js";
import { gaitForProject } from "../src/gait/artic-gait.js";
import { quadSetup } from "./quad-search.mjs";
let pass = 0, fail = 0; const out = {};
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("FAIL", m); } };
// 1. ES：12 维（第 0 维是周期量）球函数收敛
{ const n = 12, t = Array.from({ length: n }, (_, i) => 0.2 + 0.05 * i);
  const f = (x) => -x.reduce((a, v, i) => { let d = v - t[i]; if (i === 0) d -= Math.round(d); return a + d * d; }, 0);
  const run = () => { const es = new SepCMA({ x0: new Array(n).fill(0.5), sigma: 0.2, seed: 3, periodic: [true] }); let b = -1e9; for (let g = 0; g < 150; g++) { const xs = es.ask(), fs = xs.map(f); es.tell(xs, fs); b = Math.max(b, ...fs); } return b; };
  const b1 = run(), b2 = run(); out.esToy = b1;
  ok(b1 > -1e-6, `ES 球函数收敛 ${b1}`); ok(b1 === b2, "ES 同种子结果完全相同");
  const a = new SepCMA({ x0: new Array(n).fill(0.5), seed: 4 }).ask(), b = new SepCMA({ x0: new Array(n).fill(0.5), seed: 5 }).ask();
  ok(JSON.stringify(a) !== JSON.stringify(b), "不同种子不同候选"); ok(a.flat().every((v) => v >= 0 && v <= 1), "候选在 [0,1] 内");
  const r1 = mulberry32(9), r2 = mulberry32(9); ok(r1() === r2() && r1() === r2(), "mulberry32 确定"); }
// 2. 编码往返
{ const sp = octoSpace({ symmetric: true }), g = octoRowGait(), x = sp.encode(g), g2 = sp.decode(x);
  ok(sp.n === 21, `对称 21 维（${sp.n}）`); ok(g2.joints.length === 8, "解码 8 条触手");
  const d = Math.max(...g.joints.map((J, i) => Math.abs(J.amp - g2.joints[i].amp) + Math.abs(((J.phase - g2.joints[i].phase + 540) % 360) - 180) / 10 + Math.abs((J.offset || 0) - (g2.joints[i].offset || 0))));
  ok(d < 0.2, `划桨步态编码往返误差 ${d.toFixed(3)}`);
  ok(Math.abs(g2.joints[7].amp + g2.joints[1].amp) < 1e-9, "7 号镜像 1 号（幅度取反）");
  ok(octoSpace({ symmetric: false }).n === 33, "非对称 33 维");
  const S = await quadSetup(), gq = gaitForProject(S.project), aq = articSpace(S.project, gq), gq2 = aq.decode(aq.encode(gq));
  ok(gq2.joints.length === gq.joints.length, "四足关节数");
  ok(gq.joints.every((J, i) => Math.abs(J.amp - gq2.joints[i].amp) < 0.1), "四足编码往返"); }
// 3. 打分：更快 → 分更高；漂得多 → 直线目标分更低
{ const r = { speed: 3, dx: 0, dh: 0, sec: 10, tiltMax: 2, marginMin: 1, energyJ: 1, fwd: 30, col: 0 };
  ok(scoreOf({ ...r, speed: 4 }, OBJECTIVES.speed.w).score > scoreOf(r, OBJECTIVES.speed.w).score, "速度目标单调");
  ok(scoreOf({ ...r, dx: 5 }, OBJECTIVES.straight.w).score < scoreOf(r, OBJECTIVES.straight.w).score, "直线目标惩罚侧漂"); }
// 4. Worker 同一份 runJob：四足（结构化克隆过的数据，和 Worker 收到的一样）
{ const S = await quadSetup(), an = [...S.an].map(([k, a]) => [k, { center: { ...a.center }, half: { ...a.half }, hull: a.hull ? Float32Array.from(a.hull) : null, massG: a.massG }]);
  const job = structuredClone({ kind: "artic", project: JSON.parse(JSON.stringify(S.project)), Me: S.X.M.toArray(), an, gait0: gaitForProject(S.project), sec: 4, weights: OBJECTIVES.speed.w, seed: 2, maxEvals: 18 });
  const t0 = Date.now(); let gens = 0;
  const a = await runJob(job, { post: (m) => { if (m.type === "gen") gens++; } }), b = await runJob(job);
  out.quad = { base: a.base.score, best: a.best.score, evals: a.evals, sec: (Date.now() - t0) / 2000 };
  ok(gens >= 2, `四足：有进度回调（${gens} 代）`); ok(a.best.score >= a.base.score, "四足：结果不比起点差");
  ok(a.best.score === b.best.score && JSON.stringify(a.best.g) === JSON.stringify(b.best.g), "四足：同种子同结果（确定性）");
  let n = 0; const c = await runJob({ ...job, maxEvals: 200 }, { shouldStop: () => ++n > 400 && false || n > 5 });
  ok(c.stopped && c.evals < 200, `四足：取消（${c.evals} 次后停，${c.stopped}）`); }
// 5. 八爪鱼（短）：确定性 + 鲁棒复评
{ const job = { kind: "octo", gait0: octoRowGait(), sec: 4, weights: OBJECTIVES.speed.w, seed: 1, maxEvals: 12, robust: true, robustSeeds: 1 };
  const a = await runJob(job), b = await runJob({ ...job, robust: false });
  out.octo = { base: a.base.r.speed, best: a.best.r.speed, robust: { base: a.robust.base.speedMin, best: a.robust.best.speedMin } };
  ok(a.best.score >= a.base.score, "八爪鱼：结果不比起点差"); ok(a.best.score === b.best.score, "八爪鱼：同种子同结果");
  ok(a.robust?.best?.rows?.length === 6, `八爪鱼：鲁棒复评 6 个工况（${a.robust?.best?.rows?.length}）`); }
fs.mkdirSync("/workspace/proto-site/v14/logs", { recursive: true });
try { fs.writeFileSync("/workspace/proto-site/v14/logs/search-test.json", JSON.stringify(out, null, 1)); } catch {}
console.log(JSON.stringify(out)); console.log(`search-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
