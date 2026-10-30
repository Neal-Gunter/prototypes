// v18：把维修板子翻译成时域网表，并做“示波器抓波形”。早期原型，简化仿真。
// 和稳态模型（board.js）共用同一套导体（焊点 / 走线 / 插头 / 导线 / 短路）和零件参数，所以稳态下两边的结果能互相核对（见 scripts/transient-test.mjs）。
// 时域里多出来的：电容（容量 + ESR）、升压模块里的电感、LDO 的有限环路带宽、舵机起步冲击 / 堵转、主控射频发射脉冲、欠压复位的时间过程、
// 升压模块的软启动 / 限流打嗝 / 开关纹波、电池的极化压降。全部是简化行为模型，参数没写来源的都是估算。
import { transient, prepare } from "../sim/transient.js";
import { lipo, ldo, boost, mcu, servo, asensor } from "../sim/devices.js";
import { conductors, pinNode, linked, DIODE_VF, DIODE_RS, GPIO_R } from "./board.js";
import { LED_VF, LED_RS } from "../assembly/dcmath.js";

export const ADAPTER_RISE = 0.5e-3; // 估算：适配器 / USB 插上后电压升起来的时间
export const VIB = { period: 7e-3, open: 0.6e-3 }; // 估算：磨损插头在振动下“断一下”的节奏

const vibOpen = (t) => { const ph = ((t % VIB.period) + VIB.period) % VIB.period; const k = Math.floor(t / VIB.period); return ph < VIB.open * (0.6 + 0.8 * ((k * 7919) % 10) / 10); };

// exp：power（t=0 合上开关 / 插上电源）· run（已通电，t=0 开始让舵机动）· steady（已通电、按 run 参数稳态运行）
export function buildTransient(b, { exp = "steady", run = false } = {}) {
  const G = b.ground || "GND";
  const P = (p, pin) => pinNode(p.ref, pin);
  const powered = (t) => exp !== "power" || t >= 0;
  const running = (t) => (exp === "run" ? t >= 0 : exp === "steady" ? !!run : !!run && t >= 0); // power + run：上电后固件一启动就让舵机动
  const els = [];
  const hasSw = b.parts.some((p) => p.kind === "sw" && p.state?.present !== false);
  const hasDc = b.parts.some((p) => p.kind === "dcin" && p.state?.present !== false);
  for (const r of conductors(b, { power: true, phase: "idle" })) {
    if (r.why === "sw") els.push({ t: "S", a: r.a, b: r.b, ron: r.r, roff: 1e9, on: (t) => powered(t), ref: "sw" });
    else if (r.why === "contact" && r.seat === "worn") els.push({ t: "S", a: r.a, b: r.b, ron: r.r, roff: 1e9, on: (t) => !(running(t) && vibOpen(t)), ref: r.ref });
    else els.push({ t: "R", ...r });
  }
  const devs = {};
  let theMcu = null;
  const mcuPart = b.parts.find((p) => p.kind === "mcu" && p.state?.present !== false);
  const stagger = mcuPart?.props.fw?.stagger || 0; // 固件让舵机错开启动（秒 / 个）
  let sIdx = 0;
  const runStart = exp === "steady" ? -Infinity : 0;
  for (const p of b.parts) {
    if (p.state?.present === false) continue;
    const st = p.state, pr = p.props;
    if (p.kind === "bat" || p.kind === "dcin") {
      const [hi, lo] = (st.orient ?? 1) > 0 ? ["+", "-"] : ["-", "+"];
      const v = st.ocv ?? pr.v, r = st.rint ?? pr.r;
      if (p.kind === "dcin") els.push({ t: "V", p: P(p, hi), n: P(p, lo), v: (t) => (exp !== "power" ? v : t < 0 ? 0 : v * Math.min(1, t / ADAPTER_RISE)), r, ref: p.ref });
      else if (/lipo/.test(pr.chem || "")) els.push((devs[p.ref] = lipo({ id: p.ref, p: P(p, hi), n: P(p, lo), ocv: v, rint: r, mAh: pr.mAh || 1000, on: hasSw || hasDc ? true : (t) => powered(t) })));
      else els.push({ t: "V", p: P(p, hi), n: P(p, lo), v: hasSw || hasDc ? v : (t) => (powered(t) ? v : 0), r, ref: p.ref });
    } else if ((p.kind === "led" || p.kind === "diode") && !st.burnt) {
      const [a, k] = (st.orient ?? 1) > 0 ? ["A", "K"] : ["K", "A"];
      els.push({ t: "D", a: P(p, a), k: P(p, k), vf: p.kind === "led" ? LED_VF : DIODE_VF, rs: p.kind === "led" ? LED_RS : DIODE_RS, ref: p.ref });
    } else if (p.kind === "cap" && !st.burnt) {
      els.push({ t: "C", a: P(p, "+"), b: P(p, "-"), c: st.c ?? pr.c, esr: st.esr ?? pr.esr ?? 0.01, ref: p.ref });
    }
    if (p.kind === "ldo" || p.kind === "boost") els.push({ t: "R", a: P(p, "IN"), b: P(p, "GND"), r: 1e6 });
    if (p.kind === "ldo" && !st.burnt) els.push((devs[p.ref] = ldo({ id: p.ref, vin: P(p, "IN"), gnd: P(p, "GND"), vout: P(p, "OUT"), vset: st.vout ?? pr.vout, drop: pr.drop, iq: pr.iq, ilim: pr.ilim, rLoop: pr.rLoop ?? 0.2, tau: pr.tauLoop ?? 20e-6 })));
    else if (p.kind === "boost" && !st.burnt) els.push((devs[p.ref] = boost({ id: p.ref, vin: P(p, "IN"), gnd: P(p, "GND"), vout: P(p, "OUT"), en: P(p, "EN"), v: pr.vout, eff: pr.eff, ilim35: pr.ilim35, uvlo: pr.uvlo, ...(pr.tr || {}) })));
    else if (p.kind === "mcu") {
      const gp = Object.entries(pr.drive || {}).map(([pin, lvl]) => ({ pin, lvl }));
      const d = mcu({ id: p.ref, vcc: P(p, "VCC"), gnd: P(p, "GND"), i: pr.i, vnom: pr.vnom, bo: pr.bo, hys: pr.boHys ?? 0.1, tBoot: pr.tBoot ?? 1e-3, burst: pr.burst || null, gpios: gp.map((g) => P(p, g.pin)), vio: pr.vio, rGpio: GPIO_R });
      const upd = d.update;
      d.update = (ctx) => { upd(ctx); d.gp.forEach((s, i) => { if (!gp[i].lvl) s.v = ctx.V(P(p, "GND")); }); };
      // 固件低压保护：VBAT（滤波后）跌破阈值就停 PWM（锁存到这次抓波形结束）
      const fw = pr.fw || {};
      d.motionOk = true; d.vbatF = null;
      const aft = d.after;
      d.after = (ctx) => { aft(ctx); if (!fw.vbatStop) return; const v = ctx.V(fw.vbatNet) - ctx.V(G); if (fw.bootRead) { if (d.running && !d._wasRun) { d.vbatF = v; d.motionOk = v >= fw.vbatStop; if (!d.motionOk) ctx.log({ dev: p.ref, kind: "lowStop", v }); } d._wasRun = d.running; } d.vbatF = d.vbatF == null ? v : d.vbatF + (v - d.vbatF) * Math.min(1, ctx.dt / 2e-3); if (d.motionOk && d.running && running(ctx.t) && d.vbatF < fw.vbatStop) { d.motionOk = false; ctx.log({ dev: p.ref, kind: "lowStop", v: d.vbatF }); } };
      const dc0 = d.dc;
      d.dc = (ctx) => { dc0(ctx); if (fw.vbatStop) { const v = ctx.V(fw.vbatNet) - ctx.V(G); d.vbatF = v; d.motionOk = v >= fw.vbatStop; } };
      els.push((devs[p.ref] = theMcu = d));
    } else if (p.kind === "sensor" && !st.damaged) els.push({ t: "R", a: P(p, "VCC"), b: P(p, "GND"), r: 3.3 / pr.i });
    else if (p.kind === "asensor" && !st.damaged) els.push((devs[p.ref] = asensor({ id: p.ref, vcc: P(p, "VCC"), gnd: P(p, "GND"), out: P(p, "OUT"), i: pr.i, k: pr.k ?? 0.5, rOut: pr.rOut ?? 100, pulse: pr.pulse })));
    else if (p.kind === "servo") {
      const pin = pr.sigPin;
      const ok = !!(mcuPart && pin && linked(b, pinNode(p.ref, "S"), pinNode(mcuPart.ref, pin)));
      const delay = stagger * sIdx++, bootDelay = mcuPart?.props.fw?.startDelay ?? 0; // v18：固件开机后等 startDelay 再动舵机（我的补充）
      const d = servo({ id: p.ref, v: P(p, "V"), gnd: P(p, "G"), iIdle: pr.iIdle, iRun: pr.iPeak, iInrush: pr.iInrush ?? 0.35, tau: pr.tauInrush ?? 1e-3, iStall: pr.iStall ?? 0.9, stalled: !!st.stalled, cmd: (ctx) => ok && running(ctx.t) && theMcu?.running && theMcu?.motionOk && ctx.t - Math.max(runStart, theMcu.lastBoot + bootDelay) >= delay });
      d.start = () => { if (d.moving) d.since = -Infinity; };
      els.push((devs[p.ref] = d));
    } else if (p.kind === "load") els.push({ t: "R", a: P(p, "1"), b: P(p, "2"), r: pr.ohms });
  }
  return { els, devs, ground: G, mcu: mcuPart };
}

export const TDIVS = [1e-6, 2e-6, 5e-6, 10e-6, 20e-6, 50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3];
export const VDIVS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
export const fmtT = (s) => { const a = Math.abs(s); return a >= 1 ? `${+s.toFixed(3)} s` : a >= 1e-3 ? `${+(s * 1e3).toFixed(3)} ms` : `${+(s * 1e6).toFixed(2)} µs`; };
export const fmtV = (v) => (Math.abs(v) >= 1 ? `${v.toFixed(3)} V` : `${(v * 1000).toFixed(1)} mV`);

function stats(arr, i0, i1) {
  let mn = Infinity, mx = -Infinity, s = 0, n = 0;
  for (let i = i0; i < i1; i++) { const v = arr[i]; if (!Number.isFinite(v)) continue; if (v < mn) mn = v; if (v > mx) mx = v; s += v; n++; }
  const mean = n ? s / n : NaN;
  let q = 0; for (let i = i0; i < i1; i++) { const v = arr[i]; if (Number.isFinite(v)) q += (v - mean) ** 2; }
  return { min: mn, max: mx, pp: mx - mn, mean, rmsAC: n ? Math.sqrt(q / n) : NaN };
}

// 抓一次波形。chans：[{ node, on }]（最多 4 路，探头地夹都在板子的地上）；math：{ a, b }（CHa − CHb）
// trig：{ src: 通道序号 0–3 或 "math", slope: "rise"|"fall", level, mode: "auto"|"normal"|"single" }
export function capture(b, { exp = "steady", run = false, tdiv = 1e-3, pre = 0.1, chans = [], math = null, trig = null, method = "trap", points = 2500, adaptive = null, dtOverride = null } = {}) {
  const W = 10 * tdiv;
  const dt = dtOverride || Math.min(2e-4, Math.max(2e-8, W / points));
  const tArm = exp === "steady" ? 0 : -pre * W;
  const tStart = tArm - (exp === "steady" ? 0 : 0.05 * W);
  const tStop = exp === "steady" ? 2.2 * W : (1 - pre) * W + 1.2 * W;
  const built = buildTransient(b, { exp, run });
  const net = prepare(built.els, built.ground);
  const nodes = chans.map((c) => (c && c.node ? c.node : null));
  const probes = nodes.map((nd, i) => ({ id: "ch" + i, node: nd }));
  const t0 = performance?.now?.() ?? Date.now();
  const r = transient(net, { tStart, tStop, dt, method, probes, init: "dc", ground: built.ground, adaptive });
  const ms = (performance?.now?.() ?? Date.now()) - t0;
  const T = r.t, N = T.length;
  const data = r.probes.map((p) => p.data);
  const notes = [];
  nodes.forEach((nd, i) => { if (nd && !net.isDriven(nd) && nd !== built.ground) notes.push(`CH${i + 1}：${nd} 现在是悬空的（读数没有意义）`); });
  let mathData = null;
  if (math && data[math.a] && data[math.b]) { mathData = new Float32Array(N); for (let i = 0; i < N; i++) mathData[i] = data[math.a][i] - data[math.b][i]; }
  // 触发
  let tc = null;
  const src = trig ? (trig.src === "math" ? mathData : data[trig.src]) : null;
  if (src) {
    const L = trig.level;
    for (let i = 1; i < N; i++) {
      if (T[i] < tArm + (exp === "steady" ? pre * W : 0)) continue;
      const a = src[i - 1], c = src[i];
      const hit = trig.slope === "fall" ? a > L && c <= L : a < L && c >= L;
      if (hit) { tc = T[i - 1] + ((L - a) / (c - a || 1)) * (T[i] - T[i - 1]); break; }
    }
  }
  const triggered = tc != null;
  if (!triggered && trig && trig.mode !== "auto") return { ok: true, triggered: false, waiting: true, exp, tdiv, W, notes: [...notes, "等待触发……这段时间里没有满足条件的边沿（换个电平 / 边沿，或者换“自动”）"], stats: r.stats, ms };
  const center = triggered ? tc : exp === "steady" ? pre * W : 0;
  const ta = center - pre * W, tb = ta + W;
  let i0 = 0; while (i0 < N - 1 && T[i0] < ta) i0++;
  let i1 = i0; while (i1 < N && T[i1] <= tb + 1e-12) i1++;
  const t = Array.from(T.subarray(i0, i1), (x) => x - center);
  const ch = data.map((d, i) => (nodes[i] ? Array.from(d.subarray(i0, i1)) : null));
  const m = mathData ? Array.from(mathData.subarray(i0, i1)) : null;
  const meas = ch.map((d) => (d ? stats(d, 0, d.length) : null));
  const mathMeas = m ? stats(m, 0, m.length) : null;
  const events = r.events.filter((e) => e.t >= ta && e.t <= tb).map((e) => ({ ...e, t: e.t - center }));
  const allEvents = r.events.map((e) => ({ ...e, t: e.t - center }));
  const thresholds = [];
  if (built.mcu) { const vn = pinNode(built.mcu.ref, "VCC"); const nets = new Set([vn, built.mcu.pins.VCC]); nodes.forEach((nd, i) => { if (nets.has(nd)) thresholds.push({ ch: i, v: built.mcu.props.bo, zh: `${built.mcu.ref} 欠压复位阈值 ${built.mcu.props.bo} V（估算）` }); }); }
  const dev = Object.fromEntries(Object.entries(built.devs).map(([k, d]) => [k, d.kind === "mcu" ? { kind: d.kind, resets: d.resets, boots: d.boots, vmin: d.vmin, running: d.running, motionOk: d.motionOk } : d.kind === "boost" ? { kind: d.kind, hiccups: d.hiccups, on: d.on } : d.kind === "servo" ? { kind: d.kind, iMax: d.iMax, moving: d.moving } : { kind: d.kind }]));
  if (dt > 1 / (16 * 4e5) && b.parts.some((p) => p.kind === "boost")) notes.push("时基比较慢：升压模块的开关纹波被平均掉了（真示波器上是一条变粗的线）。看纹波请调到 1–5 µs/div。");
  return { ok: true, triggered, exp, tdiv, W, pre, dt, t, ch, math: m, meas, mathMeas, events, allEvents, thresholds, dev, notes, stats: r.stats, ms, tc: center };
}

// 给验收和“时域模式”用的摘要：一次抓波形里主控复位了几次、某个节点的最小值 / 纹波
export function tdCheck(b, spec) {
  const tr = spec.tr;
  const nodes = [spec.minV?.node, spec.ripple?.node, spec.diff?.a, spec.diff?.b, spec.maxV?.node].filter(Boolean);
  const cap = capture(b, { exp: tr.exp, run: tr.run, tdiv: tr.tdiv, pre: tr.pre ?? 0.1, chans: nodes.map((n) => ({ node: n })) });
  const skip = tr.skip ?? 0; // 跳过开头一段（秒），比如上电后的软启动
  const idx = cap.t.findIndex((x) => x >= skip);
  const sub = (d) => (d ? d.slice(Math.max(0, idx)) : []);
  const mm = (d) => { const s = sub(d); return { min: Math.min(...s), max: Math.max(...s) }; };
  let ok = true; const info = [];
  if (spec.noReset) { const d = cap.dev[spec.noReset]; const n = cap.allEvents.filter((e) => e.dev === spec.noReset && e.kind === "reset").length; ok &&= n === 0 && d?.running; info.push(`${spec.noReset} 复位 ${n} 次，最低 ${d ? d.vmin.toFixed(2) : "?"} V`); }
  let k = 0;
  if (spec.minV) { const s = mm(cap.ch[k++]); ok &&= s.min >= spec.minV.v; info.push(`${spec.minV.node} 最低 ${fmtV(s.min)}`); }
  if (spec.ripple) { const s = mm(cap.ch[k++]); ok &&= s.max - s.min <= spec.ripple.max; info.push(`${spec.ripple.node} 峰峰值 ${fmtV(s.max - s.min)}`); }
  if (spec.diff) { const a = sub(cap.ch[k++]), c = sub(cap.ch[k++]); let mx = 0; for (let i = 0; i < a.length; i++) mx = Math.max(mx, Math.abs(a[i] - c[i])); ok &&= mx <= spec.diff.max; info.push(`${spec.diff.a} − ${spec.diff.b} 最大 ${fmtV(mx)}`); }
  if (spec.maxV) { const s = mm(cap.ch[k++]); ok &&= s.max <= spec.maxV.v; info.push(`${spec.maxV.node} 最高 ${fmtV(s.max)}`); }
  if (spec.noHiccup) { const n = cap.allEvents.filter((e) => e.dev === spec.noHiccup && e.kind === "boost-hiccup").length; ok &&= n === 0; info.push(`${spec.noHiccup} 打嗝 ${n} 次`); }
  return { ok, info: info.join("，"), cap };
}
