// 时域行为器件（v18）。全部是“简化行为模型”，参数凡是没写来源的都是估算（界面和 README 里标“估算”）。
// 每个器件在 expand(add) 里加原始元件（R/C/L/V/I/S），在 update(ctx) 里根据上一步的解改源的值或开关状态。
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 1S 锂聚合物电池：开路电压随电量（查表，估算的典型曲线）+ 欧姆内阻 r0 + 极化 RC（r1‖c1，时间常数 tau）→ “瞬间掉一截、再慢慢往下沉”。
// 稳态（极化电容充满）时总内阻 = r0 + r1 = rint，和稳态模型的内阻一致。
export const LIPO_OCV = [[0, 3.0], [0.05, 3.45], [0.1, 3.6], [0.2, 3.68], [0.4, 3.75], [0.6, 3.85], [0.8, 3.98], [1, 4.2]]; // 估算
export const ocvAt = (soc) => { const T = LIPO_OCV; if (soc <= 0) return T[0][1]; for (let i = 1; i < T.length; i++) if (soc <= T[i][0]) { const [s0, v0] = T[i - 1], [s1, v1] = T[i]; return v0 + ((v1 - v0) * (soc - s0)) / (s1 - s0); } return T[T.length - 1][1]; };
export const socFor = (v) => { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ocvAt(m) < v) lo = m; else hi = m; } return (lo + hi) / 2; };
export function lipo({ id, p, n, ocv, rint, split = 0.6, tau = 2, mAh = 1000, on = true }) {
  const d = { t: "X", kind: "lipo", id, soc: socFor(ocv) };
  const m = `${id}#cell`;
  d.expand = (add) => {
    d.src = add({ t: "V", p: m, n, v: ocv, r: rint * split, ref: id });
    const r1 = rint * (1 - split);
    add({ t: "R", a: m, b: p, r: r1 });
    add({ t: "C", a: m, b: p, c: tau / r1 });
    if (!on) d.src.v = 0;
  };
  d.update = (ctx) => { d.src.v = typeof on === "function" ? (on(ctx.t) ? ocvAt(d.soc) : 0) : on ? ocvAt(d.soc) : 0; };
  d.after = (ctx) => { const i = ctx.cur(d.src); d.soc = clamp(d.soc - (i * ctx.dt) / (mAh * 3.6), 0, 1); };
  return d;
}

// 线性稳压（LDO）：输出级 = 受控电压源（目标 vset + 积分校正 u）串 rLoop，等效“环路带宽有限”——负载突变时先掉一下，再在 tau 内拉回来；
// 输出电容负责顶住这一下（这就是为什么要去耦电容）。还有：压差 drop、限流 ilim、静态电流 iq、输入 < 1.2 V 时关断（输出高阻）。rLoop / tau 估算。
export function ldo({ id, vin, gnd, vout, vset, drop, iq = 0.005, ilim = 0.5, rLoop = 1, tau = 20e-6 }) {
  const d = { t: "X", kind: "ldo", id, u: 0, limit: false, on: true };
  const m = `${id}#pass`;
  d.expand = (add) => {
    d.src = add({ t: "V", p: m, n: gnd, v: vset, r: 1e-3 });
    d.sw = add({ t: "S", a: m, b: vout, ron: rLoop, roff: 1e9, on: () => d.on });
    d.iin = add({ t: "I", from: vin, to: gnd, i: iq });
  };
  const cmd = (ctx) => {
    const g = ctx.V(gnd), vi = ctx.V(vin) - g, vo = Math.max(-0.5, ctx.V(vout) - g);
    const ioPrev = d.on ? clamp((ctx.V(m) - ctx.V(vout)) / rLoop, 0, ilim * 1.05) : 0; // 上一步解出来的输出电流
    d.on = vi > 1.2;
    let v = vset + d.u;
    v = Math.min(v, vi - drop + ioPrev * rLoop); // 压差按输出端算：Vout ≤ Vin − drop
    d.limit = (v - vo) / rLoop > ilim;
    if (d.limit) v = vo + ilim * rLoop;
    d.src.v = Math.max(0, v) + g;
    d.iin.i = d.on ? ioPrev + iq : 0;
    return { vi, vo };
  };
  d.update = (ctx) => { cmd(ctx); };
  d.after = (ctx) => { const vo = ctx.V(vout) - ctx.V(gnd); if (!d.on) { d.u = 0; return; } const du = ((vset - vo) * ctx.dt) / tau; if (!(d.limit && du > 0)) d.u = clamp(d.u + du, -vset, 2); };
  d.dc = (ctx) => { if (d.on) d.u = clamp(ctx.V(m) - ctx.V(vout), 0, 2); cmd(ctx); }; // 直流：积分器已经把 rLoop 上的压降补上了
  d.dcAfter = () => 0;
  return d;
}

// 升压模块（平均模型）：输入 → 储能电感 L（带直流电阻）→ 恒功率取电（Pout / 效率）；
// 输入端有模块自带的小电容 cIn；输出 = 受控电压源（软启动斜坡）串 rOut 再串“等效环路电感” lOut，模块自带一颗小输出电容 cOut（esrOut 0.2 Ω 当作“环路阻尼”的等效，估算）；
// 限流：输出电流到 ilim（随输入电压缩放）就不再往上给；持续限流超过 tHic 进入“打嗝”保护，关断 tOff 再软启动；
// 欠压锁定（UVLO，带回差）；时间步足够小（≤ 开关周期 / 16）时叠加开关纹波电流（按占空比 D = 1 − Vin/Vout 的脉冲电流）。
// 关断时输出断开（我的补充：按“带输出隔离”的模块处理）。所有参数估算，除非模板里写了来源。
export function boost({ id, vin, gnd, vout, en, v = 5.2, eff = 0.85, ilim35 = 1.1, uvlo = 2.5, hys = 0.2, L = 2.2e-6, dcr = 0.03, rOut = 0.05, lOut = 4.7e-6, cOut = 4.7e-6, esrOut = 0.2, cIn = 10e-6, esrIn = 0.01, tss = 1e-3, fsw = 4e5, tHic = 2e-3, tOff = 20e-3, ripple = true }) {
  const d = { t: "X", kind: "boost", id, on: false, ramp: 0, inLimit: 0, offUntil: -Infinity, limit: false, hiccups: 0 };
  const sw = `${id}#sw`, m = `${id}#ctl`, m2 = `${id}#lo`;
  d.expand = (add) => {
    d.lin = add({ t: "L", a: vin, b: sw, l: L, dcr });
    d.sink = add({ t: "I", from: sw, to: gnd, i: 0 });
    add({ t: "C", a: sw, b: gnd, c: cIn, esr: esrIn }); // 模块自带的输入电容（估算）
    d.src = add({ t: "V", p: m, n: gnd, v: 0, r: rOut });
    d.sw = add({ t: "S", a: m, b: m2, ron: 1e-4, roff: 1e9, on: () => d.on });
    d.lo = add({ t: "L", a: m2, b: vout, l: lOut });
    add({ t: "C", a: vout, b: gnd, c: cOut, esr: esrOut });
    d.rip = add({ t: "I", from: gnd, to: vout, i: 0 });
  };
  const state = (ctx) => {
    const vi = ctx.V(vin) - ctx.V(gnd);
    const enOk = en == null ? true : ctx.V(en) - ctx.V(gnd) > 1.2;
    const was = d.on;
    if (!enOk || ctx.t < d.offUntil) d.on = false;
    else if (d.on) d.on = vi > uvlo;
    else d.on = vi > uvlo + hys;
    if (d.on && !was) { d.ramp = 0; ctx.discontinuity = true; ctx.log?.({ dev: id, kind: "boost-on" }); }
    if (!d.on && was) { ctx.discontinuity = true; ctx.log?.({ dev: id, kind: vi <= uvlo ? "boost-uvlo" : "boost-off" }); }
    return vi;
  };
  d.update = (ctx) => {
    const vi = state(ctx);
    const vo = ctx.V(vout) - ctx.V(gnd);
    const il = ctx.cur(d.lo.ind || d.lo);
    const lim = ilim35 * clamp(vi / 3.5, 0.3, 1.3);
    const vref = v * (ctx.dc ? 1 : clamp(d.ramp, 0, 1));
    let vc = vref;
    d.limit = false;
    if (d.on) {
      const vmax = vo + lim * rOut + ((lim - il) * lOut) / (2 * ctx.dt || 1);
      if (vref > vmax && il > lim * 0.98) { vc = Math.max(0, Math.min(vref, vmax)); d.limit = true; }
    }
    d.src.v = (d.on ? vc : 0) + ctx.V(gnd);
    const pout = d.on ? Math.max(0, vo * il) : 0;
    const vsw = Math.max(0.3, ctx.V(sw) - ctx.V(gnd));
    d.sink.i = Math.min(15, pout / eff / vsw);
    // 开关纹波（零均值脉冲电流）
    if (ripple && d.on && !ctx.dc && ctx.dt <= 1 / (16 * fsw)) {
      const D = clamp(1 - vi / Math.max(vo, 0.1), 0, 0.9);
      const ph = (ctx.t * fsw) % 1;
      d.rip.i = ph < D ? -Math.max(0, il) : (Math.max(0, il) * D) / (1 - D);
    } else d.rip.i = 0;
  };
  d.dc = (ctx) => { d.update(ctx); };
  d.after = (ctx) => {
    if (!d.on) return;
    d.ramp = Math.min(1, d.ramp + ctx.dt / tss);
    if (d.limit) { d.inLimit += ctx.dt; if (d.inLimit > tHic) { d.offUntil = ctx.t + tOff; d.inLimit = 0; d.hiccups++; ctx.log({ dev: id, kind: "boost-hiccup" }); } } else d.inLimit = Math.max(0, d.inLimit - ctx.dt * 0.5);
  };
  d.start = () => { d.ramp = d.on ? 1 : 0; };
  return d;
}

// 主控（MCU）：平均负载电阻 + 可选的射频发射脉冲电流 + 欠压复位（低于 bo 立刻复位；回到 bo + hys 以上、持续 tBoot 才重新启动）。
// 运行时 GPIO 通过开关接到 vio（推挽输出的等效内阻 rGpio）。burst 参数估算。
export function mcu({ id, vcc, gnd, i, vnom, bo, hys = 0.1, tBoot = 1e-3, burst = null, gpios = [], vio = 3.3, rGpio = 25 }) {
  const iAvgBurst = burst ? (burst.i * burst.on) / burst.period : 0;
  const d = { t: "X", kind: "mcu", id, running: true, resets: 0, boots: 0, okFor: 0, vmin: Infinity, lastBoot: -Infinity };
  d.expand = (add) => {
    add({ t: "R", a: vcc, b: gnd, r: vnom / Math.max(1e-4, i - iAvgBurst) });
    if (burst) d.bi = add({ t: "I", from: vcc, to: gnd, i: 0 });
    d.gp = gpios.map((g) => { const m = `${id}#io${g}`; const src = add({ t: "V", p: m, n: gnd, v: vio, r: 1e-3 }); add({ t: "S", a: m, b: g, ron: rGpio, roff: 1e9, on: () => d.running }); return src; });
  };
  const v = (ctx) => ctx.V(vcc) - ctx.V(gnd);
  d.update = (ctx) => {
    const vc = v(ctx);
    if (burst) { const ph = ((ctx.t - (burst.t0 || 0)) % burst.period + burst.period) % burst.period; d.bi.i = d.running && ph < burst.on ? burst.i * clamp(vc / vnom, 0, 1.2) : 0; }
    for (const s of d.gp) s.v = Math.min(vio, Math.max(0, vc)) + ctx.V(gnd);
  };
  d.dc = (ctx) => { const vc = v(ctx); d.running = vc >= bo; d.update(ctx); };
  d.after = (ctx) => {
    const vc = v(ctx);
    d.vmin = Math.min(d.vmin, vc);
    if (d.running) { if (vc < bo) { d.running = false; d.resets++; d.okFor = 0; ctx.discontinuity = true; ctx.log({ dev: id, kind: "reset", v: vc }); } }
    else if (vc > bo + hys) { d.okFor += ctx.dt; if (d.okFor >= tBoot) { d.running = true; d.boots++; d.lastBoot = ctx.t; ctx.discontinuity = true; ctx.log({ dev: id, kind: "boot", v: vc }); } }
    else d.okFor = 0;
  };
  return d;
}

// 舵机：随时间变化的电流负载（和电源电压成正比，等效“电机像个电阻”）。
// 静止 iIdle；收到指令开始动：iRun + iInrush·e^(−t/tau)（起步冲击）；卡死：iStall。参数估算。
export function servo({ id, v, gnd, iIdle = 0.01, iRun = 0.1, iInrush = 0.35, tau = 1e-3, iStall = 0.9, stalled = false, vNom = 5, cmd }) {
  const d = { t: "X", kind: "servo", id, moving: false, since: 0, iMax: 0 };
  d.expand = (add) => { d.src = add({ t: "I", from: v, to: gnd, i: 0 }); };
  d.update = (ctx) => {
    const want = !!cmd(ctx);
    if (want && !d.moving) d.since = ctx.t;
    d.moving = want;
    const k = clamp((ctx.V(v) - ctx.V(gnd)) / vNom, 0, 1.3);
    const base = !d.moving ? iIdle : stalled ? iStall : iRun + (ctx.dc ? 0 : iInrush * Math.exp(-(ctx.t - d.since) / tau));
    d.src.i = base * k;
    d.iMax = Math.max(d.iMax, d.src.i);
  };
  return d;
}

// 比例输出的模拟传感器：输出 = k·VCC（经 rOut），自身耗电 i，加周期性“转换”脉冲电流（估算）。
export function asensor({ id, vcc, gnd, out, i = 0.002, k = 0.5, rOut = 100, pulse = { i: 0.005, on: 20e-6, period: 200e-6 } }) {
  const d = { t: "X", kind: "asensor", id };
  d.expand = (add) => {
    const avg = pulse ? (pulse.i * pulse.on) / pulse.period : 0;
    add({ t: "R", a: vcc, b: gnd, r: 3.3 / Math.max(1e-5, i - avg) }); // 平均电流和稳态模型一致
    d.pi = add({ t: "I", from: vcc, to: gnd, i: 0 });
    d.src = add({ t: "V", p: out, n: gnd, v: 0, r: rOut });
  };
  d.update = (ctx) => {
    const vc = Math.max(0, ctx.V(vcc) - ctx.V(gnd));
    d.src.v = k * vc + ctx.V(gnd);
    d.pi.i = pulse && !ctx.dc && (ctx.t % pulse.period + pulse.period) % pulse.period < pulse.on ? pulse.i * clamp(vc / 3.3, 0, 1.2) : 0;
  };
  return d;
}
