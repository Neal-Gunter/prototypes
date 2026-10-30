// v14：一次“搜索任务”（Worker 里跑，node 测试也直接调它）。kind = octo（八爪鱼固件孪生）/ artic（模型实验室的任意带关节模型）
// 每评一个候选让一次事件循环（setTimeout 0），这样 Worker 能收到“取消”。完全确定：同一个种子 + 同一组设置 → 同一个结果。
import { runSearch, octoSpace, articSpace, robustCases, robustEval, trainConds, heldOutConds, OBJECTIVES, SERVO_RATE_MAX, summarize } from "./search.js";
import { octoEvaluator } from "./evaluators.js";
const tick = () => new Promise((ok) => setTimeout(ok, 0));
export async function makeEvaluator(job) {
  if (job.kind === "octo") return octoEvaluator({ sec: job.sec || 10, variant: job.variant || "v10", plan: job.plan || "A" });
  // v15：通用模型暂时只认 μ / 质量 / 零位误差 / 起步延迟（坡度在训练工况里会被忽略）
  const [{ default: R }, THREE, { measureArtic }] = await Promise.all([import("@dimforge/rapier3d-compat"), import("three"), import("./artic-gait.js")]);
  await R.init();
  const M = new THREE.Matrix4().fromArray(job.Me), an = new Map(job.an);
  return async (g, o = {}) => { const r = await measureArtic(R, job.project, an, M, g, { sec: job.sec || 6, mu: o.mu ?? null, massScale: o.massScale ?? 1, trimDeg: o.trimDeg || null, startDelay: o.startDelay || 0 }); return { ...r, ctrlLog: undefined }; };
}
// v15：pool = EvalPool（Worker 池）时一代的候选并行评；job.conds = "train" → 多工况训练集；job.heldOut → 搜完在留出工况上复评
export async function runJob(job, { post = () => {}, shouldStop = () => false, pool = null } = {}) {
  const parallel = !!pool;
  const ev0 = parallel ? null : await makeEvaluator(job);
  const ev = parallel ? (g, o) => (shouldStop() ? Promise.resolve(null) : pool.eval(g, o)) : async (g, o) => { await tick(); return ev0(g, o); };
  const space = job.kind === "octo" ? octoSpace({ symmetric: job.symmetric !== false }) : articSpace(job.project, job.gait0);
  const O = OBJECTIVES[job.objective] || {};
  const conds = (job.conds ?? O.conds) === "train" ? trainConds(space.joints) : Array.isArray(job.conds) ? job.conds : null;
  const hw = job.hw || null;
  const res = await runSearch({ evalFn: ev, space, x0: space.encode(job.gait0), weights: job.weights, seed: job.seed || 1, maxEvals: job.maxEvals || 120, maxSec: job.maxSec || 300, mus: job.mus || [0.5], sigma: job.sigma || 0.15, shouldStop,
    conds, agg: job.agg || O.agg || "mean", rateLimit: job.rateLimit || O.rateLimit || SERVO_RATE_MAX, hw, parallel,
    onGen: ({ gen, evals, best, hist, sec }) => post({ type: "gen", gen, evals, sec, hist, best: { score: best.score, r: best.r, g: best.g, maxRate: best.maxRate } }) });
  if (!res.best) return { type: "done", evals: res.evals, sec: res.sec, stopped: res.stopped, hist: res.hist, best: null, base: null, dims: space.n };
  const out = { type: "done", evals: res.evals, sec: res.sec, stopped: res.stopped, lambda: res.lambda, hist: res.hist, conds: res.conds || 1, pool: pool?.n || 1,
    best: { score: res.best.score, r: res.best.r, g: res.best.g, maxRate: res.best.maxRate }, base: { score: res.base.score, r: res.base.r, g: res.base.g, maxRate: res.base.maxRate }, dims: space.n };
  if (job.robust && !shouldStop()) {
    const cases = (job.heldOut ? heldOutConds(space.joints) : robustCases({ seed: job.seed || 1, joints: space.joints, seeds: job.robustSeeds ?? 5 })).map((c) => (hw ? { ...hw, ...c } : c));
    const total = 2 * cases.length; let done = 0;
    const cb = async () => { done++; post({ type: "robust", done, total }); };
    out.robust = { heldOut: !!job.heldOut, base: await robustEval(ev, job.gait0, cases, cb, { parallel }) };
    if (!shouldStop()) out.robust.best = await robustEval(ev, res.best.g, cases, cb, { parallel });
  }
  return out;
}
