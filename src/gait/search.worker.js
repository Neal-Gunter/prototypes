// v14：步态搜索 Worker（不占主线程）。消息：{type: "start", job} / {type: "cancel"}；回：gen / robust / done / error
// v15：job.pool > 1 → 在这个 Worker 里再开 job.pool 个评估 Worker（eval.worker.js），一代的候选 × 工况并行评；结果和单线程逐位相同
import { runJob } from "./search-job.js";
import { EvalPool } from "./pool.js";
let stop = false, pool = null;
const spawn = () => { const w = new Worker(new URL("./eval.worker.js", import.meta.url), { type: "module" }); return { send: (m) => w.postMessage(m), on: (fn) => { w.onmessage = (e) => fn(e.data); }, kill: () => w.terminate() }; };
self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === "cancel") { stop = true; pool?.terminate(); return; }
  if (m.type !== "start") return;
  stop = false;
  try {
    pool = m.job.pool > 1 ? new EvalPool(spawn, Math.min(32, m.job.pool), m.job) : null;
    const out = await runJob(m.job, { post: (x) => self.postMessage(x), shouldStop: () => stop, pool });
    pool?.terminate(); pool = null; self.postMessage(out);
  } catch (err) { pool?.terminate(); pool = null; self.postMessage({ type: "error", msg: String(err?.message || err) }); }
};
