// v14：步态搜索 Worker（不占主线程）。消息：{type: "start", job} / {type: "cancel"}；回：gen / robust / done / error
import { runJob } from "./search-job.js";
let stop = false;
self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === "cancel") { stop = true; return; }
  if (m.type !== "start") return;
  stop = false;
  try { const out = await runJob(m.job, { post: (x) => self.postMessage(x), shouldStop: () => stop }); self.postMessage(out); }
  catch (err) { self.postMessage({ type: "error", msg: String(err?.message || err) }); }
};
