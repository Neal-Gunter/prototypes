/**
 * FIRMWARE SEAM
 * createFirmwareRunner() is the only firmware entry the page should call.
 *
 * run(source) posts the text to a Web Worker and resolves:
 *   { events: FirmwareEvent[] }
 * FirmwareEvent:
 *   { t: number, type: "log", text: string }
 *   { t: number, type: "servo", name: string, pin: number, angle: number }
 *   { t: number, type: "done" }
 *
 * The worker runs src/workbench/firmware/engine.js, a JavaScript subset
 * interpreter. It is not an ESP32-S3, not a cycle model, and not a compiler.
 *
 * To swap in a real emulator later, replace worker.js so it still returns
 * that event list. Leave the React UI on this runner.
 */

export function createFirmwareRunner() {
  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  let sequence = 0;
  const pending = new Map();

  worker.addEventListener("message", (event) => {
    const { id, ok, events, error } = event.data || {};
    const settle = pending.get(id);
    if (!settle) return;
    pending.delete(id);
    if (ok) settle.resolve({ events });
    else settle.reject(new Error(error || "解释失败"));
  });

  worker.addEventListener("error", () => {
    for (const settle of pending.values()) {
      settle.reject(new Error("解释器 worker 出错"));
    }
    pending.clear();
  });

  return {
    run(source) {
      const id = sequence + 1;
      sequence = id;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, source });
      });
    },
    dispose() {
      worker.terminate();
      for (const settle of pending.values()) {
        settle.reject(new Error("解释器已关闭"));
      }
      pending.clear();
    },
  };
}
