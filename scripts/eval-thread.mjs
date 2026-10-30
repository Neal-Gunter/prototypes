// v15：node 版评估线程（worker_threads），和浏览器 eval.worker.js 同一份 evalHost
import { parentPort } from "node:worker_threads";
import { evalHost } from "../src/gait/pool.js";
import { makeEvaluator } from "../src/gait/search-job.js";
const h = evalHost((x) => parentPort.postMessage(x), makeEvaluator);
parentPort.on("message", h);
