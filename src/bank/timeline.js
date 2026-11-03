// 题库 firmware 题：用页面已有的 Arduino 风格解释器在虚拟时钟上跑代码，得到引脚 / 串口时间线，
// 再和 passCondition.behaviorTimeline 比较。早期原型，简化仿真：时间只在 delay() 时前进（每条语句耗时 0）。
import { createProgram } from "../workbench/firmware/interpreter.js";

export function runTimeline(src, { horizonMs = 3000, maxSteps = 200000, inputs = {} } = {}) {
  let now = 0;
  const events = [];
  const level = {};
  const io = {
    now: () => now,
    emit: (e) => {
      if (e.type === "pin" && e.value != null) {
        if (level[e.pin] !== e.value) events.push({ t: now, pin: e.pin, value: e.value });
        level[e.pin] = e.value;
      } else if (e.type === "serial") {
        const last = events[events.length - 1];
        if (last && last.serialOpen) { last.text += e.text; if (e.nl) delete last.serialOpen; }
        else events.push({ t: now, serial: true, text: e.text, ...(e.nl ? {} : { serialOpen: true }) });
      }
    },
    read: (kind, pin) => (inputs[`${kind}${pin}`] ?? null),
  };
  const prog = createProgram(src, io);
  const gen = prog.run();
  let steps = 0, idleLoops = 0;
  while (now <= horizonMs && steps++ < maxSteps) {
    const r = gen.next();
    if (r.done) break;
    const d = r.value?.delay || 0;
    if (d > 0) { now += d; idleLoops = 0; }
    else if (r.value?.loopEnd && ++idleLoops > 20000) now += 1; // loop() 里没有 delay：每 2 万次空转推进 1 ms
  }
  return events.filter((e) => e.t <= horizonMs).map(({ serialOpen, ...e }) => e);
}

const STATE = { HIGH: 1, LOW: 0, 1: 1, 0: 0 };
// expected: [{t, pin:"LED", state:"HIGH"} | {t, serial:"text"}]；pins: {LED: 48}
export function checkTimeline(actual, cond) {
  const tol = cond.toleranceMs ?? 50, pins = cond.pins || {};
  const want = cond.expected.map((e) => (e.serial != null ? { t: e.t, serial: true, text: e.serial } : { t: e.t, pin: pins[e.pin] ?? e.pin, value: STATE[e.state] }));
  const results = [];
  let cursor = 0, ok = true;
  for (const w of want) {
    let hit = -1;
    for (let k = cursor; k < actual.length; k++) {
      const a = actual[k];
      if (w.serial ? a.serial && a.text.trim() === w.text.trim() : a.pin === w.pin && a.value === w.value) { if (Math.abs(a.t - w.t) <= tol) { hit = k; break; } if (a.t > w.t + tol) break; }
    }
    results.push({ ...w, ok: hit >= 0, got: hit >= 0 ? actual[hit].t : null });
    if (hit < 0) ok = false; else cursor = hit + 1;
  }
  // 防止“乱翻转碰运气”：预期范围内，被检查引脚的实际跳变数不能多于预期
  const until = Math.max(...want.map((w) => w.t)) + tol;
  const extra = [];
  for (const pin of new Set(want.filter((w) => !w.serial).map((w) => w.pin))) {
    const got = actual.filter((a) => a.pin === pin && a.t <= until).length;
    const exp = want.filter((w) => w.pin === pin).length;
    if (got > exp) { ok = false; extra.push({ pin, got, exp }); }
  }
  return { pass: ok, results, extra };
}
