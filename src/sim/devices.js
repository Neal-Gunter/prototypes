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
export function ldo({ id, vin, gnd, vout, vset, drop, iq = 0.005, ilim = 0.5, rLoop = 0.2, tau = 20e-6 }) {
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
    const vmax = vi - drop + ioPrev * rLoop; // 压差按输出端算：Vout ≤ Vin − drop
    d.sat = v > vmax; v = Math.min(v, vmax);
    d.limit = (v - vo) / rLoop > ilim;
    if (d.limit) v = vo + ilim * rLoop;
    d.src.v = Math.max(0, v) + g;
    d.iin.i = d.on ? ioPrev + iq : 0;
    return { vi, vo };
  };
  d.update = (ctx) => { cmd(ctx); };
  d.after = (ctx) => { const vo = ctx.V(vout) - ctx.V(gnd); if (!d.on) { d.u = 0; return; } const du = (vset - vo) * 0.7 * (1 - Math.exp(-ctx.dt / tau)); /* 步长比 tau 大时也不会过冲；限流 / 压差饱和时不再往上积分（防积分饱和过冲） */ if (!((d.limit || d.sat) && du > 0)) d.u = clamp(d.u + du, -vset, 2); };
  d.dc = (ctx) => { if (d.on) d.u = clamp(ctx.V(m) - ctx.V(vout), 0, 2); cmd(ctx); }; // 直流：积分器已经把 rLoop 上的压降补上了
  d.dcAfter = () => 0;
  return d;
}

// 升压模块（平均模型）：输入 → 储能电感 L（带直流电阻）→ 恒功率取电（Pout / 效率）；
// 输入端有模块自带的小电容 cIn；输出 = 受控电压源（软启动斜坡）串 rOut 再串“等效环路电感” lOut，模块自带一颗小陶瓷输出电容 cOut，另加一条 RC 阻尼支路代表环路补偿（估算）；
// 限流：输出电流到 ilim（随输入电压缩放）就不再往上给；启动宽限期（tss + tGrace）之后“限流且输出低于 70 %”持续超过 tHic 进入“打嗝”保护，关断 tOff 再软启动；
// 欠压锁定（UVLO，带回差）；时间步足够小（≤ 开关周期 / 16）时叠加开关纹波电流（按占空比 D = 1 − Vin/Vout 的脉冲电流）。
// 关断时输出断开（我的补充：按“带输出隔离”的模块处理）。所有参数估算，除非模板里写了来源。
export function boostLegacy({ id, vin, gnd, vout, en, v = 5.2, eff = 0.85, ilim35 = 1.1, uvlo = 2.5, hys = 0.2, L = 2.2e-6, dcr = 0.03, rOut = 0.05, lOut = 4.7e-6, cOut = 4.7e-6, esrOut = 0.005, rDamp = 1, cDamp = 22e-6, cIn = 10e-6, esrIn = 0.01, tss = 1e-3, fsw = 4e5, tHic = 2e-3, tOff = 20e-3, tGrace = 15e-3, ripple = true }) {
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
    add({ t: "C", a: vout, b: gnd, c: cDamp, esr: rDamp }); // 等效“环路补偿 / 阻尼”支路（估算），不影响直流
    d.rip = add({ t: "I", from: gnd, to: vout, i: 0 });
  };
  const state = (ctx) => {
    const vi = ctx.V(vin) - ctx.V(gnd);
    const enOk = en == null ? true : ctx.V(en) - ctx.V(gnd) > 1.2;
    const was = d.on;
    if (!enOk || ctx.t < d.offUntil) d.on = false;
    else if (d.on) d.on = vi > uvlo;
    else d.on = vi > uvlo + hys;
    if (d.on && !was) { d.ramp = 0; d.onAt = ctx.t; ctx.discontinuity = true; ctx.log?.({ dev: id, kind: "boost-on" }); }
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
    if (ripple && d.on && !ctx.dc && !ctx.noRipple && ctx.dt <= 1 / (16 * fsw)) {
      const D = clamp(1 - vi / Math.max(vo, 0.1), 0, 0.9);
      const ph = (ctx.t * fsw) % 1;
      d.rip.i = ph < D ? -Math.max(0, il) : (Math.max(0, il) * D) / (1 - D);
    } else d.rip.i = 0;
  };
  d.dc = (ctx) => { d.update(ctx); };
  d.after = (ctx) => {
    if (!d.on) return;
    const vo0 = ctx.V(vout) - ctx.V(gnd); // 只有“限流 + 输出被拉到 70 % 以下”（接近短路）才算过载
    d.ramp = Math.min(1, d.ramp + ctx.dt / tss);
    // 刚启动的 tss + tGrace 内给大电容充电不算过载（估算的“启动宽限期”），之后持续限流才打嗝
    if (d.limit && vo0 < 0.7 * v && ctx.t - (d.onAt ?? -Infinity) > tss + tGrace) { d.inLimit += ctx.dt; if (d.inLimit > tHic) { d.offUntil = ctx.t + tOff; d.inLimit = 0; d.hiccups++; ctx.log({ dev: id, kind: "boost-hiccup" }); } } else d.inLimit = Math.max(0, d.inLimit - ctx.dt * 0.5);
  };
  d.start = () => { d.ramp = d.on ? 1 : 0; };
  return d;
}

// v20：升压模块平均值模型（默认）。和旧模型（boostLegacy，v19 及以前）的区别：
//   · 调压 + 限流不再是“按上一步电感电流显式算”，而是一个分段线性的隐式结构，和二极管一样在同一步里迭代求解：
//       恒流源 ilim 注入节点 m，理想“钳位二极管”（rs = rOut）把多余电流送回电压 vclamp = vref − rOut·ilim。
//       负载 < ilim：二极管导通 → 输出 = vref − rOut·Io（和旧模型的戴维南等效一样）；负载 > ilim：二极管截止 → 输出电流正好 = ilim。
//     这样稳压 / 限流的切换在当步就定下来，结果不再依赖时间步长（只剩积分误差，梯形法二阶）。
//   · 软启动斜坡按“开机后经过的时间”算（不是每步累加）。
//   · 输入端：功率平衡显式写出损耗：Vsw·Iin = Pout + Io·vd（整流压降）+ D·rds·Iin²（开关管导通）+ kSw·Pout（开关损耗，估算）+ Vin·iq；
//     电感直流电阻 dcr 的损耗由电路里的 L+DCR 元件自己算。kSw 按“在 3.7 V 输入、0.5 A 输出时效率 = eff”反推（eff 来自模块参数，估算）。
//   · 压差：输入高于设定值时直通（输出 ≈ Vin − vd），只在软启动结束后生效。
//   · 用开关级参考电路（scripts/boost-avg-test.mjs：真实 PWM 开关 + 二极管 + 电感 + 电容）在几个工作点校验了稳态输出和输入电流。
//   已知简化（我的补充）：输入电流仍用上一步的输出电流（显式，影响很小）；没有环路带宽和 PWM 纹波细节（纹波仍按旧办法在很小步长时叠加）。
export const BOOST_MODEL = { mode: "avg" };
export function boostLossK({ v = 5.2, eff = 0.85, vd = 0.3, rds = 0.06, dcr = 0.03, iq = 2e-3 } = {}) {
  const vi = 3.7, io = 0.5, po = v * io, pin = po / eff, iin = pin / vi, D = 1 - vi / v;
  return Math.max(0, (pin - po - io * vd - D * rds * iin * iin - dcr * iin * iin - vi * iq) / po);
}
export function boostAvg({ id, vin, gnd, vout, en, v = 5.2, eff = 0.85, ilim35 = 1.1, uvlo = 2.5, hys = 0.2, L = 2.2e-6, dcr = 0.03, rOut = 0.05, lOut = 4.7e-6, cOut = 4.7e-6, esrOut = 0.005, rDamp = 1, cDamp = 22e-6, cIn = 10e-6, esrIn = 0.01, tss = 1e-3, fsw = 4e5, tHic = 2e-3, tOff = 20e-3, tGrace = 15e-3, ripple = true, vd = 0.3, rds = 0.06, iq = 2e-3, kSw = null, rLp = 1, tauIn = 60e-6 }) {
  const d = { t: "X", kind: "boost", model: "avg", id, ifl: 0, iNow: 0, on: false, ramp: 0, inLimit: 0, offUntil: -Infinity, limit: false, hiccups: 0, onAt: -Infinity, lim: 0 };
  const k = kSw ?? boostLossK({ v, eff, vd, rds, dcr, iq });
  d.kSw = k;
  const sw = `${id}#sw`, m = `${id}#ctl`, m2 = `${id}#lo`, c = `${id}#clamp`;
  let vclamp = 0;
  d.expand = (add) => {
    d.lin = add({ t: "L", a: vin, b: sw, l: L, dcr });
    d.sink = add({ t: "I", from: sw, to: gnd, i: 0 });
    add({ t: "C", a: sw, b: gnd, c: cIn, esr: esrIn });
    d.isrc = add({ t: "I", from: gnd, to: m, i: 0 }); // 限流恒流源
    d.cl = add({ t: "V", p: c, n: gnd, v: 0, r: 1e-4 }); // 钳位电压
    d.dio = add({ t: "D", a: m, k: c, vf: 0, rs: rOut }); // 钳位“二极管”：导通 = 稳压，截止 = 限流
    d.sw = add({ t: "S", a: m, b: m2, ron: 1e-4, roff: 1e9, on: () => d.on });
    d.lo = add({ t: "L", a: m2, b: vout, l: lOut });
    add({ t: "R", a: m2, b: vout, r: rLp }); // 并联阻尼：恒流源串电感本身是病态的（限流时电感电流被强行规定），并一个电阻让限流 / 稳压切换不抖
    add({ t: "C", a: vout, b: gnd, c: cOut, esr: esrOut });
    add({ t: "C", a: vout, b: gnd, c: cDamp, esr: rDamp });
    d.rip = add({ t: "I", from: gnd, to: vout, i: 0 });
  };
  const state = (ctx) => {
    const vi = ctx.V(vin) - ctx.V(gnd);
    const enOk = en == null ? true : ctx.V(en) - ctx.V(gnd) > 1.2;
    const was = d.on;
    if (!enOk || ctx.t < d.offUntil) d.on = false;
    else if (d.on) d.on = vi > uvlo;
    else d.on = vi > uvlo + hys;
    if (d.on && !was) { d.onAt = ctx.t; ctx.discontinuity = true; ctx.log?.({ dev: id, kind: "boost-on" }); }
    if (!d.on && was) { ctx.discontinuity = true; ctx.log?.({ dev: id, kind: vi <= uvlo ? "boost-uvlo" : "boost-off" }); }
    return vi;
  };
  d.update = (ctx) => {
    const vi = state(ctx);
    const vo = ctx.V(vout) - ctx.V(gnd);
    const il = Math.max(0, ctx.cur(d.lo.ind || d.lo));
    const lim = ilim35 * clamp(vi / 3.5, 0.3, 1.3);
    d.lim = lim;
    d.ramp = ctx.dc ? 1 : clamp((ctx.t - d.onAt) / tss, 0, 1);
    const vref = v * d.ramp;
    const pass = d.ramp >= 1 ? vi - vd : 0; // 压差：输入比设定值高时直通
    vclamp = Math.max(vref, pass) - rOut * lim;
    d.isrc.i = d.on ? lim : 0;
    d.cl.v = (d.on ? vclamp : 0) + ctx.V(gnd);
    // 输入：功率平衡（显式写出损耗）
    const po = d.on ? Math.max(0, vo * il) : 0;
    const vsw = Math.max(0.3, ctx.V(sw) - ctx.V(gnd));
    const D = clamp(1 - vi / Math.max(vo, 0.1), 0, 0.9);
    const Pn = po * (1 + k) + il * vd + (d.on ? vi * iq : 0);
    const rD = D * rds, disc = vsw * vsw - 4 * rD * Pn;
    d.iNow = Math.min(15, rD > 1e-9 && disc > 0 ? (vsw - Math.sqrt(disc)) / (2 * rD) : Pn / vsw);
    // 输入电流（= 电感平均电流）一阶滞后跟随需求（≈ 控制环带宽，tauIn 估算 60 µs）：瞬时“恒功率”负载会让输入 LC 自激，真实模块的电感电流跟不了这么快。按指数离散，和步长无关。
    d.sink.i = ctx.dc ? d.iNow : d.ifl + (d.iNow - d.ifl) * (1 - Math.exp(-ctx.dt / tauIn));
    if (ripple && d.on && !ctx.dc && !ctx.noRipple && ctx.dt <= 1 / (16 * fsw)) {
      const ph = (ctx.t * fsw) % 1;
      d.rip.i = ph < D ? -il : (il * D) / (1 - D);
    } else d.rip.i = 0;
  };
  d.dc = (ctx) => { d.update(ctx); d.ifl = d.iNow; };
  d.after = (ctx) => {
    d.ifl = d.ifl + (d.iNow - d.ifl) * (1 - Math.exp(-ctx.dt / tauIn));
    if (!d.on) { d.limit = false; return; }
    d.limit = !d.dio.on; // 钳位二极管截止 = 正在限流
    const vo0 = ctx.V(vout) - ctx.V(gnd);
    if (d.limit && vo0 < 0.7 * v && ctx.t - d.onAt > tss + tGrace) { d.inLimit += ctx.dt; if (d.inLimit > tHic) { d.offUntil = ctx.t + tOff; d.inLimit = 0; d.hiccups++; ctx.log({ dev: id, kind: "boost-hiccup" }); } } else d.inLimit = Math.max(0, d.inLimit - ctx.dt * 0.5);
  };
  d.start = (ctx) => { if (d.on) d.onAt = -Infinity; };
  return d;
}
export function boost(o) { return BOOST_MODEL.mode === "legacy" ? boostLegacy(o) : boostAvg(o); }

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
    if (burst) { const ph = ((ctx.t - (burst.t0 ?? burst.period / 2)) % burst.period + burst.period) % burst.period; d.bi.i = !ctx.dc && d.running && ph < burst.on ? burst.i * clamp(vc / vnom, 0, 1.2) : 0; }
    for (const s of d.gp) s.v = Math.min(vio, Math.max(0, vc)) + ctx.V(gnd);
  };
  d.dc = (ctx) => { const vc = v(ctx); d.running = vc >= bo; d.update(ctx); };
  d.after = (ctx) => {
    const vc = v(ctx);
    if (d.running || d.boots || d.resets) d.vmin = Math.min(d.vmin, vc); // 只统计“开过机之后”的最低电压
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
