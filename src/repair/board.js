// 维修关卡的“电路板”模型：零件有物理状态（焊点、方向、阻值、烧没烧、插紧没有……），故障就是改这些状态。
// 每个零件的每个脚是一个独立节点（“零件脚”），通过焊点接到铜皮网络（“焊盘 / 铜皮”）。所以：
//   正面量零件脚、背面量焊盘，冷焊点两边会不通——和真板子查虚焊的方法一样。
// 早期原型，简化仿真：只算稳态直流；所有标“估算”的数值都没有查到具体型号的数据手册。
import { solveDC } from "./dc.js";
import { ohmsBetween, BEEP_OHM, fmtOhm, LED_VF, LED_RS, LED_OVER_MA, LED_BURN_MA, SERVO_MIN_V } from "../assembly/dcmath.js";

export const JOINT_R = 0.002; // 估算：好焊点
export const TRACE_R = 0.005; // 估算：一小段铜皮
export const BRIDGE_R = 0.005; // 估算：焊锡桥
export const CONTACT_R = { ok: 0.02, worn: 0.06 }; // 估算：插头接触电阻
export const GPIO_R = 25; // 估算：GPIO 输出等效内阻
export const GPIO_SINK_MAX = 0.04; // 估算：超过 40 mA 就算 GPIO 过载
export const DIODE_VF = 0.75, DIODE_RS = 0.15; // 估算：普通整流二极管
export const I2C_PULL = [1000, 10000]; // 1 kΩ 下限来自标准模式 3 mA 灌电流（(3.3−0.4)/3 mA≈1 kΩ）；10 kΩ 上限是常见经验值（估算）
export const HOT_W = 0.5; // 估算：小封装稳压器耗散超过 0.5 W 就明显烫手
export const RES_W = 0.25; // 常见 1/4 W 色环电阻

// 线规 → 每米电阻（Ω/m，20 °C 铜线，常见 AWG 表）
export const AWG_OHM_M = { 20: 0.0333, 22: 0.053, 24: 0.0842, 26: 0.134, 28: 0.213, 30: 0.339 };

export const clone = (o) => JSON.parse(JSON.stringify(o));
export const pinNode = (ref, pin) => `${ref}.${pin}`;
export const partOf = (b, ref) => b.parts.find((p) => p.ref === ref);

// ---------- 导体（通电求解和电阻档共用同一份） ----------
// phase: "idle"（静止）| "run"（运行 / 振动，接触不良的地方会断）| "wiggle"（镊子拨动那一下）
export function conductors(b, { power, phase = "idle" }) {
  const R = [];
  const open = (state) => state === "cold" && phase !== "wiggle"; // 冷焊点：平时不通，镊子一拨瞬间通
  for (const p of b.parts) {
    if (p.state?.present === false) continue;
    for (const [pin, net] of Object.entries(p.pins)) {
      const j = p.joints?.[pin] || "good";
      if (j === "good" || (j === "cold" && !open(j))) R.push({ a: pinNode(p.ref, pin), b: net, r: JOINT_R, why: "joint" });
    }
    if (p.kind === "conn") {
      const seat = p.state.seat || "ok";
      if (seat === "out" || (seat === "worn" && phase === "run")) continue; // 磨损的插头：一振动就断（估算）
      const n = p.props.pairs;
      for (let k = 1; k <= n; k++) { const kk = p.state.flip ? n + 1 - k : k; R.push({ a: pinNode(p.ref, "a" + k), b: pinNode(p.ref, "b" + kk), r: CONTACT_R[seat] || CONTACT_R.ok, why: "contact", ref: p.ref, seat }); }
    }
    if (p.kind === "res" && !p.state.burnt) R.push({ a: pinNode(p.ref, "1"), b: pinNode(p.ref, "2"), r: p.state.ohms, why: "res", ref: p.ref });
    if (p.kind === "sw" && power) R.push({ a: pinNode(p.ref, "a"), b: pinNode(p.ref, "b"), r: 0.03, why: "sw" });
  }
  for (const t of b.traces || []) if (!t.state?.cracked) R.push({ a: t.a, b: t.b, r: TRACE_R, why: "trace" });
  for (const w of b.wires || []) if (!w.state?.cut) R.push({ a: w.state?.swap ? w.b : w.a, b: w.state?.swap ? w.a : w.b, r: (AWG_OHM_M[w.state?.awg ?? w.awg] || 0.05) * (w.state?.len ?? w.len) + (w.state?.crimpR || 0), why: "wire", id: w.id }); // v18：crimpR = 端子压接不良的额外接触电阻（估算）
  for (const s of b.shorts || []) R.push({ a: s.a, b: s.b, r: s.r ?? BRIDGE_R, why: "short", id: s.id });
  return R;
}

// ---------- 一次直流求解（给定接触状态和“舵机在不在动”） ----------
function solveOnce(b, { power, phase, moving, prev }) {
  const els = conductors(b, { power, phase }).map((r) => ({ t: "R", ...r }));
  const P = (p, pin) => pinNode(p.ref, pin);
  const info = {};
  for (const p of b.parts) {
    if (p.state?.present === false) continue;
    const st = p.state, pr = p.props;
    if (p.kind === "bat" || p.kind === "dcin") {
      if (p.kind === "dcin" && !power) continue; // 适配器只在“通电”时插上
      const [hi, lo] = (st.orient ?? 1) > 0 ? ["+", "-"] : ["-", "+"];
      els.push({ t: "V", p: P(p, hi), n: P(p, lo), v: st.ocv ?? pr.v, r: st.rint ?? pr.r, ref: p.ref });
    } else if (p.kind === "led" && !st.burnt) {
      const [a, k] = (st.orient ?? 1) > 0 ? ["A", "K"] : ["K", "A"];
      els.push({ t: "D", a: P(p, a), k: P(p, k), vf: LED_VF, rs: LED_RS, ref: p.ref });
    } else if (p.kind === "diode" && !st.burnt) {
      const [a, k] = (st.orient ?? 1) > 0 ? ["A", "K"] : ["K", "A"];
      els.push({ t: "D", a: P(p, a), k: P(p, k), vf: DIODE_VF, rs: DIODE_RS, ref: p.ref });
    }
    if (p.kind === "ldo" || p.kind === "boost") els.push({ t: "R", a: P(p, "IN"), b: P(p, "GND"), r: 1e6, ref: p.ref + "-leak" }); // 估算：芯片漏电 + 表的输入阻抗，免得断开的输入端读成“乱跳”
    if (p.kind === "ldo" && !st.burnt) {
      const g = prev?.[p.ref] || { mode: "reg", iout: 0, vin: pr.vout + 1 };
      const vset = st.vout ?? pr.vout;
      if (g.vin > 1.2) {
        if (g.mode === "limit") els.push({ t: "I", from: P(p, "GND"), to: P(p, "OUT"), i: pr.ilim, ref: p.ref });
        else els.push({ t: "V", p: P(p, "OUT"), n: P(p, "GND"), v: Math.max(0, Math.min(vset, g.vin - pr.drop)), r: 0.05, ref: p.ref });
        els.push({ t: "I", from: P(p, "IN"), to: P(p, "GND"), i: Math.max(0, g.iout) + pr.iq, ref: p.ref + "-in" });
      }
      info[p.ref] = g;
    } else if (p.kind === "boost" && !st.burnt) {
      const g = prev?.[p.ref] || { on: false, iout: 0, vin: 3.7, limit: false };
      if (g.on) {
        if (g.limit) els.push({ t: "I", from: P(p, "GND"), to: P(p, "OUT"), i: g.ilim, ref: p.ref });
        else els.push({ t: "V", p: P(p, "OUT"), n: P(p, "GND"), v: pr.vout, r: 0.05, ref: p.ref });
        const pout = Math.max(0, g.iout) * (g.vout ?? pr.vout);
        els.push({ t: "I", from: P(p, "IN"), to: P(p, "GND"), i: pout / (pr.eff * Math.max(g.vin, 0.5)), ref: p.ref + "-in" });
      }
      info[p.ref] = g;
    } else if (p.kind === "mcu") {
      els.push({ t: "R", a: P(p, "VCC"), b: P(p, "GND"), r: pr.vnom / pr.i, ref: p.ref + "-load" });
      const g = prev?.[p.ref] || { run: false };
      if (g.run) for (const [pin, lvl] of Object.entries(pr.drive || {})) els.push({ t: "V", p: P(p, pin), n: P(p, "GND"), v: lvl ? pr.vio : 0, r: GPIO_R, ref: p.ref + "-" + pin });
      info[p.ref] = g;
    } else if (p.kind === "sensor" && !st.damaged) {
      els.push({ t: "R", a: P(p, "VCC"), b: P(p, "GND"), r: 3.3 / pr.i, ref: p.ref + "-load" });
    } else if (p.kind === "servo") {
      const mv = moving?.has(p.ref);
      els.push({ t: "R", a: P(p, "V"), b: P(p, "G"), r: 5.0 / (mv ? (st.stalled ? pr.iStall ?? 0.9 : pr.iPeak) : pr.iIdle), ref: p.ref + "-load" }); // v18：卡死的舵机吃堵转电流（估算）
    } else if (p.kind === "asensor" && !st.damaged) { // v18：比例输出的模拟传感器（输出 = k·VCC）
      els.push({ t: "R", a: P(p, "VCC"), b: P(p, "GND"), r: 3.3 / pr.i, ref: p.ref + "-load" });
      const g = prev?.[p.ref] || { vcc: 0 };
      els.push({ t: "V", p: P(p, "OUT"), n: P(p, "GND"), v: Math.max(0, g.vcc) * (pr.k ?? 0.5), r: pr.rOut ?? 100, ref: p.ref + "-out" });
      info[p.ref] = g;
    } else if (p.kind === "load") {
      els.push({ t: "R", a: P(p, "1"), b: P(p, "2"), r: pr.ohms, ref: p.ref + "-load" });
    }
  }
  const sol = solveDC(els, b.ground || "GND");
  return { els, sol, info };
}

export const vd = (sol, a, b) => { const x = sol.v(a), y = sol.v(b); return x == null || y == null ? null : x - y; };

// 迭代：稳压 / 升压的输入电流取决于输出电流，MCU 跑不跑取决于电压
function solvePhase(b, opt) {
  let prev = {};
  let r = null;
  for (let it = 0; it < 40; it++) {
    r = solveOnce(b, { ...opt, prev });
    const next = {};
    let changed = false;
    for (const p of b.parts) {
      if (p.state?.present === false) continue;
      const pr = p.props, P = (pin) => pinNode(p.ref, pin);
      if (p.kind === "ldo" && !p.state.burnt) {
        const vin = vd(r.sol, P("IN"), P("GND")) ?? 0;
        const e = r.els.find((x) => x.ref === p.ref);
        let iout = e ? r.sol.i(e) : 0;
        const g = prev[p.ref] || { mode: "reg" };
        let mode = g.mode;
        if (mode === "reg" && iout > pr.ilim) mode = "limit";
        if (mode === "limit") { const vo = vd(r.sol, P("OUT"), P("GND")) ?? 0; if (vo > Math.min(p.state.vout ?? pr.vout, vin - pr.drop) + 0.01) mode = "reg"; iout = pr.ilim; }
        next[p.ref] = { mode, iout, vin };
      } else if (p.kind === "boost" && !p.state.burnt) {
        const vin = vd(r.sol, P("IN"), P("GND")) ?? 0;
        const en = vd(r.sol, P("EN"), P("GND")) ?? 0;
        const on = vin > pr.uvlo && en > 1.2;
        const e = r.els.find((x) => x.ref === p.ref);
        const ilim = pr.ilim35 * Math.min(1.3, Math.max(0.3, vin / 3.5)); // 估算：按输入电压线性折算
        const g = prev[p.ref] || {};
        let iout = e ? r.sol.i(e) : 0;
        let limit = !!g.limit;
        if (!limit && iout > ilim) limit = true;
        const vout = vd(r.sol, P("OUT"), P("GND")) ?? 0;
        if (limit) { if (vout > pr.vout + 0.01) limit = false; iout = ilim; }
        next[p.ref] = { on, iout, vin, limit, ilim, vout: limit ? vout : pr.vout };
      } else if (p.kind === "mcu") {
        const vcc = vd(r.sol, P("VCC"), P("GND")) ?? 0;
        next[p.ref] = { run: vcc >= pr.bo, vcc };
      } else if (p.kind === "asensor" && !p.state.damaged) {
        next[p.ref] = { vcc: vd(r.sol, P("VCC"), P("GND")) ?? 0 };
      }
      const a = prev[p.ref], c = next[p.ref];
      if (c && (!a || Object.keys(c).some((k) => typeof c[k] === "number" ? Math.abs(c[k] - (a[k] ?? 0)) > 1e-5 : c[k] !== a[k]))) changed = true;
    }
    prev = { ...prev, ...next };
    if (!changed && it > 0) break;
  }
  r.state = prev;
  return r;
}

// ---------- 被动网络里的通断 / 阻值（芯片和负载当断开，和装配台一致） ----------
export function passiveOhms(b, a, c, { power = false, phase = "idle" } = {}) {
  return ohmsBetween(conductors(b, { power, phase }).map((r) => ({ na: r.a, nb: r.b, r: r.r })), a, c);
}

// 信号线是不是通到了指定的脚
export const linked = (b, a, c, phase = "idle", lim = 10) => passiveOhms(b, a, c, { power: true, phase }) < lim;

// ---------- 整板仿真（多相：静止 / 运行；接触不良会让运行分成“接着 / 断开”两相） ----------
export function simulate(b, { power = false, run = false, batt = null } = {}) {
  const B = batt ? withBattery(b, batt) : b;
  const phases = [];
  if (!power) {
    phases.push({ label: "断电", ...solvePhase(B, { power, phase: "idle", moving: new Set() }) });
  } else if (!run) {
    phases.push({ label: "静止", ...solvePhase(B, { power, phase: "idle", moving: new Set() }) });
  } else {
    const idle = solvePhase(B, { power, phase: "idle", moving: new Set() });
    const mv = movingServos(B, idle, power);
    const runA = solvePhase(B, { power, phase: "idle", moving: mv });
    phases.push({ label: "运行", moving: mv, ...runA });
    const hasLoose = B.parts.some((p) => (p.kind === "conn" && p.state.seat === "worn") || Object.values(p.joints || {}).includes("cold"));
    if (hasLoose) phases.push({ label: "振动时接触断开", moving: mv, ...solvePhase(B, { power, phase: "run", moving: mv }) });
    phases.push({ label: "动作间隙", moving: new Set(), ...idle });
  }
  return { board: B, power, run, phases, obs: observe(B, phases, { power, run }) };
}

function withBattery(b, batt) {
  const B = clone(b);
  for (const p of B.parts) if (p.kind === "bat" && p.state.present !== false) Object.assign(p.state, batt);
  return B;
}

// 哪些舵机会被固件驱动：MCU 跑着、固件允许、信号线通、地线通
function movingServos(b, idle, power) {
  const mcu = b.parts.find((p) => p.kind === "mcu" && p.state?.present !== false);
  const set = new Set();
  if (!power || !mcu || !idle.state[mcu.ref]?.run) return set;
  const fw = fwCheck(b, mcu, idle);
  if (!fw.motionOk) return set;
  for (const s of b.parts.filter((p) => p.kind === "servo" && p.state?.present !== false)) {
    const pin = s.props.sigPin;
    if (pin && linked(b, pinNode(s.ref, "S"), pinNode(mcu.ref, pin))) set.add(s.ref);
  }
  return set;
}

function fwCheck(b, mcu, ph) {
  const fw = mcu.props.fw || {};
  const out = { motionOk: true, msgs: [] };
  if (fw.vbatStop) {
    const v = vd(ph.sol, fw.vbatNet, b.ground || "GND");
    if (v == null || v < fw.vbatStop) { out.motionOk = false; out.msgs.push(`电量低（${v == null ? "?" : v.toFixed(2)} V < ${fw.vbatStop} V），固件不让动`); }
  }
  return out;
}

// ---------- 看现象 ----------
export function ledGlow(mA) { return mA >= 5 ? "亮" : mA >= 0.5 ? "很暗" : "不亮"; }

function observe(b, phases, { power, run }) {
  const g = b.ground || "GND";
  const o = { leds: {}, mcu: null, serial: [], hot: [], servos: {}, nets: {}, warn: [], i2c: null, damage: [] };
  const all = (f) => phases.map(f);
  for (const p of b.parts) {
    if (p.state?.present === false) continue;
    if (p.kind === "led") {
      if (p.state.burnt) { o.leds[p.ref] = { state: "烧了", mA: 0 }; continue; }
      const mA = all((ph) => 1000 * ph.sol.i(ph.els.find((e) => e.ref === p.ref)));
      const lo = Math.min(...mA), hi = Math.max(...mA);
      o.leds[p.ref] = { state: hi - lo > 2 && run ? "一闪一闪" : ledGlow(hi), mA: hi, mAmin: lo };
      if (hi > LED_BURN_MA) o.damage.push({ ref: p.ref, kind: "burnt", why: `LED 电流 ${hi.toFixed(0)} mA > ${LED_BURN_MA} mA（估算阈值）` });
      else if (hi > LED_OVER_MA) o.warn.push(`${p.ref} 电流 ${hi.toFixed(0)} mA，超过常见额定 ${LED_OVER_MA} mA`);
    }
    if (p.kind === "res" && !p.state.burnt) {
      const w = Math.max(...all((ph) => { const e = ph.els.find((x) => x.ref === p.ref); if (!e) return 0; const i = ph.sol.i(e); return i * i * e.r; }));
      if (w > RES_W * 2) o.damage.push({ ref: p.ref, kind: "burnt", why: `电阻功耗 ${w.toFixed(2)} W，远超 ${RES_W} W` });
    }
    if (p.kind === "ldo" && !p.state.burnt) {
      const vin = Math.min(...all((ph) => vd(ph.sol, pinNode(p.ref, "IN"), pinNode(p.ref, "GND")) ?? 0));
      if (power && vin < -0.5) o.damage.push({ ref: p.ref, kind: "burnt", why: `输入反接 ${vin.toFixed(1)} V，稳压芯片没有反接保护` });
      const pw = Math.max(...all((ph) => { const s = ph.state[p.ref]; if (!s) return 0; const vo = vd(ph.sol, pinNode(p.ref, "OUT"), pinNode(p.ref, "GND")) ?? 0; return Math.max(0, (s.vin - vo) * s.iout); }));
      if (pw > HOT_W) o.hot.push({ ref: p.ref, w: pw, why: `耗散约 ${pw.toFixed(2)} W（估算）` });
      if (phases.some((ph) => ph.state[p.ref]?.mode === "limit")) o.serial.push(`${p.ref} 进入限流（输出被拉低）`);
    }
    if (p.kind === "boost" && !p.state.burnt && power) {
      if (phases.some((ph) => ph.state[p.ref]?.limit)) o.serial.push(`${p.ref} 升压到了电流上限，输出塌了`);
      if (phases.some((ph) => !ph.state[p.ref]?.on)) o.warn.push(`${p.ref} 没有在工作（EN 或输入电压不够）`);
    }
    if (p.kind === "sensor" && !p.state.damaged) {
      const v = Math.max(...all((ph) => vd(ph.sol, pinNode(p.ref, "VCC"), pinNode(p.ref, "GND")) ?? 0));
      if (v > p.props.vdmg) o.damage.push({ ref: p.ref, kind: "damaged", why: `传感器供电 ${v.toFixed(2)} V 超过约 ${p.props.vdmg} V（估算）` });
    }
    if (p.kind === "cap" && !p.state.burnt && p.props.polar && power) { // v18：电解电容反接
      const v = Math.min(...all((ph) => (p.state.orient ?? 1) * (vd(ph.sol, pinNode(p.ref, "+"), pinNode(p.ref, "-")) ?? 0))); // orient −1 = 电容本身装反
      if (v < -1) o.damage.push({ ref: p.ref, kind: "burnt", why: `电解电容反接 ${v.toFixed(1)} V，会发热鼓包（真机可能爆浆）` });
    }
    if (p.kind === "servo") {
      const v = all((ph) => vd(ph.sol, pinNode(p.ref, "V"), pinNode(p.ref, "G")) ?? 0);
      const mv = phases.filter((ph) => ph.moving?.has(p.ref));
      const vmv = mv.map((ph) => vd(ph.sol, pinNode(p.ref, "V"), pinNode(p.ref, "G")) ?? 0);
      o.servos[p.ref] = { v: Math.min(...v), moving: run && !p.state.stalled && mv.length > 0 && Math.min(...vmv) >= SERVO_MIN_V, stalled: !!p.state.stalled, commanded: mv.length > 0 };
      // 插反的舵机：舵机的地接到了 GPIO 上
      for (const ph of phases) for (const e of ph.els) if (e.t === "V" && /-/.test(e.ref) && e.ref.startsWith(b.parts.find((x) => x.kind === "mcu")?.ref + "-")) { const i = -ph.sol.i(e); if (Math.abs(i) > GPIO_SINK_MAX && !o.warn.some((w) => w.includes(e.ref))) o.warn.push(`${e.ref.replace("-", " 的 ")} 脚电流 ${(Math.abs(i) * 1000).toFixed(0)} mA，远超 GPIO 能力（估算 ${GPIO_SINK_MAX * 1000} mA），真机可能烧脚`); }
    }
  }
  // MCU / 固件
  const mcu = b.parts.find((p) => p.kind === "mcu" && p.state?.present !== false);
  if (mcu) {
    const runs = all((ph) => ph.state[mcu.ref]?.run);
    const vcc = all((ph) => ph.state[mcu.ref]?.vcc ?? 0);
    o.mcu = { state: runs.every(Boolean) ? "运行" : runs.some(Boolean) ? "反复重启" : "不工作", vmin: Math.min(...vcc), vmax: Math.max(...vcc) };
    if (o.mcu.state === "反复重启") o.serial.push(`brownout reset（供电跌到 ${o.mcu.vmin.toFixed(2)} V < ${mcu.props.bo} V）`);
    const idle = phases[phases.length - 1];
    if (runs[runs.length - 1]) {
      const fw = fwCheck(b, mcu, idle);
      o.serial.push(...fw.msgs);
      if (run && mcu.props.fw?.vbatStop && fw.motionOk) {
        const lowRun = phases.some((ph) => ph.moving?.size && (vd(ph.sol, mcu.props.fw.vbatNet, g) ?? 0) < mcu.props.fw.vbatStop);
        if (lowRun) { o.serial.push(`运动中电压跌破 ${mcu.props.fw.vbatStop} V，低压保护停了 PWM`); o.lowStop = true; }
      }
      if (mcu.props.i2c) o.i2c = i2cCheck(b, mcu, idle);
      if (o.i2c) o.serial.push(o.i2c.ok ? `I2C 找到传感器 0x${o.i2c.addr}` : `I2C 找不到传感器（${o.i2c.why}）`);
    }
    if (o.lowStop) for (const s of Object.values(o.servos)) s.moving = false;
  }
  for (const [k, n] of Object.entries(b.watch || {})) {
    const vs = all((ph) => vd(ph.sol, n, g));
    o.nets[k] = vs.some((v) => v == null) ? null : { min: Math.min(...vs), max: Math.max(...vs) };
  }
  return o;
}

function i2cCheck(b, mcu, ph) {
  const c = mcu.props.i2c;
  const sen = partOf(b, c.dev);
  if (!sen || sen.state?.present === false || sen.state.damaged) return { ok: false, why: "传感器坏了或不在板上", addr: c.addr };
  const vs = vd(ph.sol, pinNode(sen.ref, "VCC"), pinNode(sen.ref, "GND"));
  if (vs == null || vs < sen.props.vmin) return { ok: false, why: `传感器供电 ${vs == null ? "悬空" : vs.toFixed(2) + " V"}`, addr: c.addr };
  for (const line of ["SDA", "SCL"]) {
    if (!linked(b, pinNode(mcu.ref, c[line.toLowerCase()]), pinNode(sen.ref, line))) return { ok: false, why: `${line} 线不通`, addr: c.addr };
    const pu = passiveOhms(b, pinNode(mcu.ref, c[line.toLowerCase()]), c.pullTo, { power: true });
    if (pu === Infinity) return { ok: false, why: `${line} 没有上拉电阻，线是悬空的`, addr: c.addr };
    if (pu < I2C_PULL[0]) return { ok: false, why: `${line} 上拉 ${fmtOhm(pu)} 太小，芯片拉不低`, addr: c.addr };
    if (pu > I2C_PULL[1]) return { ok: false, why: `${line} 上拉 ${fmtOhm(pu)} 太大，边沿太慢（估算阈值 10 kΩ）`, addr: c.addr };
  }
  if (passiveOhms(b, pinNode(mcu.ref, c.sda), pinNode(mcu.ref, c.scl), { power: true }) < 500) return { ok: false, why: "SDA 和 SCL 短在一起了", addr: c.addr };
  return { ok: true, addr: c.addr };
}

// ---------- 万用表 ----------
// 表笔位置：{ side: "front", ref, pin }（零件脚）| { side: "back", net }（焊盘 / 铜皮 / 测试点）
export const probeNode = (pr) => (!pr ? null : pr.net ? pr.net : pinNode(pr.ref, pr.pin));

export function meter(b, sim, red, black, mode) {
  const a = probeNode(red), c = probeNode(black);
  if (!a || !c) return { text: "两支表笔都要放到金属上（零件脚、焊盘或测试点）" };
  if (mode === "V") {
    if (!sim.power && !sim.phases.some((ph) => ph.els.some((e) => e.t === "V"))) return { text: "0.00 V（没通电）", value: 0, values: [0] };
    const vs = sim.phases.map((ph) => (ph.sol.same(a, c) ? (ph.sol.v(a) ?? 0) - (ph.sol.v(c) ?? 0) : null));
    if (vs.some((v) => v == null)) return { text: "读数乱跳（至少一支表笔碰到的是悬空的线路）", value: null, values: vs };
    const lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi - lo > 0.05) return { text: `在 ${lo.toFixed(2)} 和 ${hi.toFixed(2)} V 之间跳`, value: lo, values: vs, jumpy: true };
    return { text: `${hi.toFixed(2)} V`, value: hi, values: vs };
  }
  const warn = sim.power ? "通电时量电阻 / 通断 / 二极管，真实万用表读数会不准，还可能损坏表——先断电" : null;
  if (mode === "diode") {
    // 表内约 3 V、限流约 1 mA 的源（估算，和常见万用表二极管档量级一样）
    const els = conductors(b, { power: false }).map((r) => ({ t: "R", ...r }));
    for (const p of b.parts) {
      if (p.state?.present === false || p.state?.burnt) continue;
      if (p.kind === "led" || p.kind === "diode") { const [x, y] = (p.state.orient ?? 1) > 0 ? ["A", "K"] : ["K", "A"]; els.push({ t: "D", a: pinNode(p.ref, x), k: pinNode(p.ref, y), vf: p.kind === "led" ? LED_VF : DIODE_VF * 0.75, rs: p.kind === "led" ? LED_RS : DIODE_RS }); }
    }
    els.push({ t: "V", p: "__meter+", n: "__meter-", v: 3.0, r: 2000 }, { t: "R", a: "__meter+", b: a, r: 1e-3 }, { t: "R", a: "__meter-", b: c, r: 1e-3 });
    const s = solveDC(els, "__meter-");
    const v = (s.v(a) ?? 0) - (s.v(c) ?? 0);
    if (v > 2.9) return { text: "OL（反向或开路）", value: Infinity, warn };
    return { text: `${v.toFixed(3)} V${v > 1.5 && v < 2.6 ? "（LED 微微亮了一下）" : ""}`, value: v, warn };
  }
  const ohm = passiveOhms(b, a, c, { power: sim.power });
  if (ohm === Infinity) return { text: mode === "beep" ? "不响（不通，OL）" : "OL（开路）", value: Infinity, warn };
  const txt = ohm < 10 ? `${ohm.toFixed(3)} Ω（理想表笔，不计表笔自身约 0.1–0.3 Ω）` : fmtOhm(ohm);
  if (mode === "beep") return { text: ohm < BEEP_OHM ? `嘀——（${txt}）` : `不响（${txt}）`, value: ohm, beep: ohm < BEEP_OHM, warn };
  return { text: txt, value: ohm, warn };
}

// 镊子拨一下（看接触是不是一碰就变）
export function wiggle(b, target) {
  const p = partOf(b, target.ref);
  if (!p) return { text: "这里没有零件" };
  if (p.kind === "conn") return p.state.seat === "worn" ? { text: "插头一拨就松动，拔出来看簧片已经张开了", flaky: true } : p.state.seat === "out" ? { text: "插头根本没插到底", flaky: true } : { text: "插得很紧，拨不动" };
  const pin = target.pin || Object.keys(p.joints || {}).find((k) => p.joints[k] === "cold");
  if (pin && p.joints?.[pin] === "cold") return { text: `${p.ref} 的 ${pin} 脚一拨就动，焊点和焊盘之间有缝`, flaky: true };
  return { text: `${p.ref} 焊得很牢` };
}

export function applyDamage(b, obs) {
  const out = [];
  for (const d of obs.damage) {
    const p = partOf(b, d.ref);
    if (!p) continue;
    if (d.kind === "burnt" && !p.state.burnt) { p.state.burnt = true; out.push(d); }
    if (d.kind === "damaged" && !p.state.damaged) { p.state.damaged = true; out.push(d); }
  }
  return out;
}
