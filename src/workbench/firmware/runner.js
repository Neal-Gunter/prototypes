// 页面侧：启动 / 停止固件 Worker。
let worker = null;

export function startFirmware(code, onEvent) {
  stopFirmware();
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (m) => onEvent(m.data);
  worker.onerror = (e) => onEvent({ type: "error", msg: e.message || "Worker 出错", line: null, phase: "run" });
  worker.postMessage({ type: "run", code });
}

export function stopFirmware() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
