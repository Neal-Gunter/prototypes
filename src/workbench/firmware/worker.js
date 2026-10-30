// Web Worker：在独立线程里跑迷你解释器，页面可以随时 terminate() 停止它。
import { createProgram, FwError } from "./interpreter";

let timer = null;
const inputs = { d: {}, a: {} };

self.onmessage = (msg) => {
  const { type, code, speed = 1, adcBits } = msg.data;
  if (type === "input") {
    // 页面算好的输入电平：{kind:'d'|'a', pin, value}
    inputs[msg.data.kind || "d"][msg.data.pin] = msg.data.value;
    return;
  }
  if (type === "inputs") {
    // 一次发来整张输入表：{d:{pin:0|1|null}, a:{pin:0..1}}（装配台的电路求解每帧算一次）
    inputs.d = msg.data.d || {};
    inputs.a = msg.data.a || {};
    return;
  }
  if (type !== "run") return;
  let gen;
  const io = {
    emit: (ev) => self.postMessage(ev),
    now: () => performance.now(),
    read: (kind, pin) => inputs[kind][pin] ?? null,
    adcBits,
  };
  try {
    gen = createProgram(code, io).run();
  } catch (err) {
    self.postMessage({ type: "error", msg: err.message, line: err instanceof FwError ? err.line : null, phase: "compile" });
    return;
  }
  self.postMessage({ type: "compiled" });
  let loops = 0;
  let lastLoopWarn = 0;
  const pump = () => {
    const t0 = performance.now();
    let loopsNoDelay = 0;
    try {
      for (;;) {
        const r = gen.next();
        if (r.done) { self.postMessage({ type: "done" }); return; }
        const v = r.value;
        if (v.loopEnd) {
          loops++;
          loopsNoDelay++;
          if (loopsNoDelay > 2000 && performance.now() - lastLoopWarn > 3000) {
            lastLoopWarn = performance.now();
            self.postMessage({ type: "warn", msg: "loop() 里没有 delay()，跑得太快（简化解释器会自动让出时间）" });
          }
        }
        if (v.delay > 0) { timer = setTimeout(pump, v.delay / speed); return; }
        if (v.delay === 0 && !v.loopEnd) loopsNoDelay = 0;
        if (performance.now() - t0 > 12) { timer = setTimeout(pump, 0); return; }
      }
    } catch (err) {
      self.postMessage({ type: "error", msg: err.message, line: err instanceof FwError ? err.line : null, phase: "run" });
    }
  };
  pump();
};
