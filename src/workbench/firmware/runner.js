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

// 多块板子各跑一个 Worker（装配台用）
export function createFirmware(onEvent) {
  let w = null;
  return {
    start(code, opts = {}) {
      this.stop();
      w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      w.onmessage = (m) => onEvent(m.data);
      w.onerror = (e) => onEvent({ type: "error", msg: e.message || "Worker 出错", line: null, phase: "run" });
      w.postMessage({ type: "run", code, adcBits: opts.adcBits });
    },
    input(kind, pin, value) { w?.postMessage({ type: "input", kind, pin, value }); },
    stop() { if (w) { w.terminate(); w = null; } },
    get running() { return !!w; },
  };
}
