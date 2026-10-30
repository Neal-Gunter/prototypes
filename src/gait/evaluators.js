// v14：搜索用的“无头”评估器。八爪鱼 = 固件 JS 孪生 + Rapier（octo-measure.runGait）；评完立刻释放物理世界（WASM 内存）。
import { runGait } from "./octo-measure.js";
export function octoEvaluator({ sec = 10, settle = 4, variant = "v10", plan = "A" } = {}) {
  return async (gait, o = {}) => {
    const r = await runGait({ gait, sec, settle, variant, plan, mu: o.mu ?? 0.5, massScale: o.massScale ?? 1, trimDeg: o.trimDeg || null, startDelay: o.startDelay || 0, slope: o.slope || null, ctrl: o.ctrl || null, load: o.load || null });
    const out = { t: r.t, fwd: r.fwd, speed: r.speed, dx: r.dx, dh: r.dh, tiltMax: r.tiltMax, marginMin: r.marginMin, energyJ: r.energyJ, powerW: r.powerW, col: r.col, slip: r.slip, checksOk: r.checksOk };
    try { r.lp.world.free(); } catch {}
    return out;
  };
}
