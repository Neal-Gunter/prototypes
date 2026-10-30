// v15：评估 Worker（Worker 池里的一个）。只做“给一个步态 + 一个工况 → 跑一次仿真 → 回测量结果”
import { evalHost } from "./pool.js";
import { makeEvaluator } from "./search-job.js";
const h = evalHost((x) => self.postMessage(x), makeEvaluator);
self.onmessage = (e) => h(e.data);
