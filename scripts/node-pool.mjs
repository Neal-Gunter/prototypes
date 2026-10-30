// v15：node 里建评估池（worker_threads）
import { Worker } from "node:worker_threads";
import os from "node:os";
import { EvalPool } from "../src/gait/pool.js";
export function nodePool(job, n = os.availableParallelism?.() || os.cpus().length) {
  const file = new URL("./eval-thread.mjs", import.meta.url);
  return new EvalPool(() => { const w = new Worker(file); return { send: (m) => w.postMessage(m), on: (fn) => w.on("message", fn), kill: () => w.terminate() }; }, n, job);
}
