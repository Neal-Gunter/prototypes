// v14：一次“搜索任务”（Worker 里跑，node 测试也直接调它）。kind = octo（八爪鱼固件孪生）/ artic（模型实验室的任意带关节模型）
// 每评一个候选让一次事件循环（setTimeout 0），这样 Worker 能收到“取消”。完全确定：同一个种子 + 同一组设置 → 同一个结果。
import { runSearch, octoSpace, articSpace, robustCases, robustEval } from "./search.js";
import { octoEvaluator } from "./evaluators.js";
const tick = () => new Promise((ok) => setTimeout(ok, 0));
export async function makeEvaluator(job) {
  if (job.kind === "octo") return octoEvaluator({ sec: job.sec || 10, variant: job.variant || "v10", plan: job.plan || "A" });
  const [{ default: R }, THREE, { measureArtic }] = await Promise.all([import("@dimforge/rapier3d-compat"), import("three"), import("./artic-gait.js")]);
  await R.init();
  const M = new THREE.Matrix4().fromArray(job.Me), an = new Map(job.an);
  return async (g, o = {}) => { const r = await measureArtic(R, job.project, an, M, g, { sec: job.sec || 6, mu: o.mu ?? null, massScale: o.massScale ?? 1, trimDeg: o.trimDeg || null, startDelay: o.startDelay || 0 }); return { ...r, ctrlLog: undefined }; };
}
export async function runJob(job, { post = () => {}, shouldStop = () => false } = {}) {
  const ev0 = await makeEvaluator(job), ev = async (g, o) => { await tick(); return ev0(g, o); };
  const space = job.kind === "octo" ? octoSpace({ symmetric: job.symmetric !== false }) : articSpace(job.project, job.gait0);
  const res = await runSearch({ evalFn: ev, space, x0: space.encode(job.gait0), weights: job.weights, seed: job.seed || 1, maxEvals: job.maxEvals || 120, maxSec: job.maxSec || 300, mus: job.mus || [0.5], sigma: job.sigma || 0.15, shouldStop,
    onGen: ({ gen, evals, best, hist, sec }) => post({ type: "gen", gen, evals, sec, hist, best: { score: best.score, r: best.r, g: best.g } }) });
  const out = { type: "done", evals: res.evals, sec: res.sec, stopped: res.stopped, lambda: res.lambda, hist: res.hist, best: { score: res.best.score, r: res.best.r, g: res.best.g }, base: { score: res.base.score, r: res.base.r, g: res.base.g }, dims: space.n };
  if (job.robust && !shouldStop()) {
    const cases = robustCases({ seed: job.seed || 1, joints: space.joints, seeds: job.robustSeeds ?? 5 });
    const total = 2 * cases.length; let done = 0;
    const cb = async () => { done++; post({ type: "robust", done, total }); };
    out.robust = { base: await robustEval(ev, job.gait0, cases, cb) };
    if (!shouldStop()) out.robust.best = await robustEval(ev, res.best.g, cases, cb);
  }
  return out;
}
