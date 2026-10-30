// 维修关卡的玩法层：工具、动作、安全规则、提示、计分、报告。纯 JS，Node 里可以直接跑（测试用）。
// 早期原型，简化仿真。所有“分钟”都是估算的真实维修工时（我的补充），不是游戏里真实经过的时间。
import { simulate, meter, wiggle, applyDamage, partOf, pinNode, clone, AWG_OHM_M } from "./board.js";
import { makeBoard } from "./boards.js";
import { applyFaults, colorBands } from "./faults.js";
import { tdCheck, capture } from "./tboard.js";

export const TOOLS = {
  hand: { zh: "手", key: "1" },
  meter: { zh: "万用表", key: "2" },
  tweezers: { zh: "镊子", key: "3" },
  iron: { zh: "电烙铁 + 焊锡", key: "4" },
  braid: { zh: "吸锡带", key: "5" },
  magnifier: { zh: "放大镜", key: "6" },
  scope: { zh: "示波器", key: "7" }, // v18
  crimper: { zh: "压线钳 + 新端子", key: "8" }, // v18
};

// 零件箱：只写通用名称，不写价格（没有可核实的报价）
export const BIN = {
  "res-10": { zh: "电阻 10 Ω", kind: "res", ohms: 10 }, "res-100": { zh: "电阻 100 Ω", kind: "res", ohms: 100 }, "res-150": { zh: "电阻 150 Ω", kind: "res", ohms: 150 },
  "res-220": { zh: "电阻 220 Ω", kind: "res", ohms: 220 }, "res-470": { zh: "电阻 470 Ω", kind: "res", ohms: 470 }, "res-4k7": { zh: "电阻 4.7 kΩ", kind: "res", ohms: 4700 },
  "res-22k": { zh: "电阻 22 kΩ", kind: "res", ohms: 22000 }, "res-1M": { zh: "电阻 1 MΩ", kind: "res", ohms: 1e6 },
  "led-red": { zh: "红色 LED", kind: "led" }, diode: { zh: "整流二极管", kind: "diode" },
  "ldo-3v3": { zh: "3.3 V 线性稳压芯片", kind: "ldo", vout: 3.3 }, "ldo-5v0": { zh: "5.0 V 线性稳压芯片（同封装）", kind: "ldo", vout: 5.0 },
  "boost-5v": { zh: "5 V 升压小板", kind: "boost" },
  "bat-aa3-new": { zh: "3 节新 AA 碱性电池", kind: "bat", chem: "aa3", ocv: 4.65, rint: 0.3 }, "bat-aa3-old": { zh: "3 节旧 AA 电池（抽屉里翻出来的）", kind: "bat", chem: "aa3", ocv: 2.7, rint: 2.0 },
  "bat-lipo-full": { zh: "1S 锂电（充满）", kind: "bat", chem: "lipo1", ocv: 4.15, rint: 0.06 }, "bat-lipo-half": { zh: "1S 锂电（半电）", kind: "bat", chem: "lipo1", ocv: 3.85, rint: 0.06 },
  "wire-22": { zh: "22AWG 硅胶线", kind: "wire", awg: 22 }, "wire-30": { zh: "30AWG 飞线", kind: "wire", awg: 30 },
  "jst-ph2": { zh: "JST-PH 2 脚插座", kind: "conn" },
  // v18：电容（ESR 是同类常见值的估算，不是某个型号的规格书数值）和备用舵机
  "cap-100n": { zh: "陶瓷电容 100 nF", kind: "cap", c: 100e-9, esr: 0.02, polar: false }, "cap-10u": { zh: "陶瓷电容 10 µF", kind: "cap", c: 10e-6, esr: 0.005, polar: false },
  "cap-22u": { zh: "陶瓷电容 22 µF", kind: "cap", c: 22e-6, esr: 0.005, polar: false }, "cap-470u": { zh: "电解电容 470 µF / 10 V", kind: "cap", c: 470e-6, esr: 0.06, polar: true },
  "cap-1000u": { zh: "电解电容 1000 µF / 10 V", kind: "cap", c: 1000e-6, esr: 0.04, polar: true }, "cap-2200u": { zh: "电解电容 2200 µF / 10 V", kind: "cap", c: 2200e-6, esr: 0.03, polar: true },
  servo: { zh: "备用舵机（同型号）", kind: "servo" }, terminal: { zh: "压接端子（同型号）", kind: "terminal" },
};

// 动作 → 需要的工具、估算工时（分钟）、是否“动烙铁 / 动线”（必须先断电并拔掉电池）
export const ACTIONS = {
  power: { zh: "通电 / 断电", min: 0.2 }, run: { zh: "运行测试", min: 1 }, probe: { zh: "量", tool: "meter", min: 0.5 }, inspect: { zh: "看", min: 0.5 },
  wiggle: { zh: "镊子拨一拨", tool: "tweezers", min: 0.5 }, reflow: { zh: "补焊", tool: "iron", min: 2, hot: true }, wick: { zh: "吸锡带去锡桥", tool: "braid", min: 3, hot: true },
  desolder: { zh: "拆下零件", tool: "iron", min: 4, hot: true }, place: { zh: "焊上新零件", tool: "iron", min: 4, hot: true }, removeWire: { zh: "拆掉飞线", tool: "iron", min: 2, hot: true },
  jumper: { zh: "飞线跨过断线", tool: "iron", min: 6, hot: true }, rewire: { zh: "换线", tool: "iron", min: 8, hot: true }, replaceConn: { zh: "换插座", tool: "iron", min: 10, hot: true },
  battery: { zh: "装 / 拆电池", min: 1 }, reseat: { zh: "重新插紧", tool: "hand", min: 0.5 }, flipConn: { zh: "插头掉个头", tool: "hand", min: 1, live: true },
  fixPolarity: { zh: "改正输入线极性", min: 3, live: true },
  scope: { zh: "示波器抓波形", tool: "scope", min: 1 }, recrimp: { zh: "剪掉旧端子重新压接", tool: "crimper", min: 6, live: true }, swapServo: { zh: "换舵机", tool: "hand", min: 4, live: true }, cover: { zh: "拆 / 装外壳", min: 1 }, deliver: { zh: "交付验收", min: 2 }, hint: { zh: "看提示", min: 0 },
};
export const HINT_COST = [5, 10, 20];
export const SAFETY_COST = 15, WRONG_PART_COST = 5;

// ---------- 条件（有序检查用，JSON 可存） ----------
export function cond(b, c) {
  if (!c) return true;
  if (c.all) return c.all.every((x) => cond(b, x));
  if (c.any) return c.any.some((x) => cond(b, x));
  if (c.not) return !cond(b, c.not);
  if (c.noShort) return !b.shorts.some((s) => s.id === c.noShort);
  if (c.part) { const p = partOf(b, c.part); const v = c.path.split(".").reduce((o, k) => o?.[k], p); return c.eq !== undefined ? v === c.eq : !!v; }
  return false;
}

// ---------- 验收 ----------
export function evaluate(b, { testBatt } = {}) {
  // 验收：先用板上实际的电池 / 适配器测；模板规定了“验收电池”（例如半电）时再用它测一遍，两次都要过
  const tb = testBatt !== undefined ? testBatt : b.testBatt || null;
  const one = evalOnce(b, null);
  if (!tb) return one;
  const two = evalOnce(b, tb);
  const checks = one.checks.map((c, i) => ({ ...c, ok: c.ok && two.checks[i].ok, info: c.info + (two.checks[i].ok ? "" : `；半电 ${tb.ocv} V 时：${two.checks[i].info}`) }));
  return { ok: one.ok && two.ok, checks, damage: [...one.damage, ...two.damage], idle: one.idle, run: one.run, test: two };
}
function evalOnce(b, tb) {
  const spec = b.spec || [];
  const idle = simulate(b, { power: true, run: false, batt: tb });
  const run = spec.some((s) => s.run) ? simulate(b, { power: true, run: true, batt: tb }) : null;
  const checks = [];
  for (const s of spec) {
    const o = (s.run ? run : idle).obs;
    let ok = false, info = "";
    if (s.tr) { const r = tdCheck(tb ? withBatt(b, tb) : b, s); ok = r.ok; info = r.info; } // v18：示波器 / 时域验收
    else if (s.led) { const l = o.leds[s.led]; ok = !!l && l.state !== "烧了" && l.mA >= s.mA[0] && l.mA <= s.mA[1] && l.mAmin >= s.mA[0]; info = l ? `${l.state} ${l.mA.toFixed(1)} mA` : "不在板上"; }
    else if (s.net) { const n = o.nets[s.net]; ok = !!n && n.min >= s.v[0] && n.max <= s.v[1]; info = n ? `${n.min.toFixed(2)}–${n.max.toFixed(2)} V` : "悬空"; }
    else if (s.notHot) { ok = !o.hot.some((h) => h.ref === s.notHot); info = ok ? "温度正常" : "烫手"; }
    else if (s.mcu) { ok = o.mcu?.state === s.mcu; info = o.mcu?.state || "没有主控"; }
    else if (s.i2c) { ok = !!o.i2c?.ok; info = o.i2c ? (o.i2c.ok ? "找到了" : o.i2c.why) : "主控没跑"; }
    else if (s.servosMoving) { const n = Object.values(o.servos).filter((x) => x.moving).length; ok = n >= s.servosMoving; info = `${n} 个在动`; }
    else if (s.cond) { ok = cond(b, s.cond); info = ok ? "在位" : "缺失"; }
    else if (s.noLowStop) { ok = !o.lowStop; info = o.lowStop ? "低压保护触发" : "正常"; }
    checks.push({ zh: s.zh, ok, info });
  }
  const broken = b.parts.filter((p) => p.state?.present !== false && (p.state.burnt || p.state.damaged)).map((p) => p.ref);
  checks.push({ zh: "板上没有烧坏的零件", ok: broken.length === 0, info: broken.join("、") || "没有" });
  const damage = [...idle.obs.damage, ...(run?.obs.damage || [])];
  return { ok: checks.every((c) => c.ok) && damage.length === 0, checks, damage, idle, run };
}

function withBatt(b, tb) { const c = clone(b); const bat = c.parts.find((p) => p.kind === "bat"); if (bat) Object.assign(bat.state, { ocv: tb.ocv, rint: tb.rint }); return c; }

// ---------- 关卡 ----------
export function buildScenario(sc) {
  const b = sc.board ? clone(sc.board) : makeBoard(sc.template);
  if (sc.boardPatch) Object.assign(b, clone(sc.boardPatch));
  applyFaults(b, sc.faults || []);
  return b;
}

export class Game {
  constructor(sc, { autoTool = false } = {}) {
    this.sc = sc;
    this.board = buildScenario(sc);
    this.power = false; this.running = false;
    this.tool = "hand"; this.autoTool = autoTool;
    this.log = []; this.minutes = 0; this.hints = 0; this.safety = []; this.wrongParts = []; this.used = [];
    this.orderSeen = []; this.solved = false; this.done = false; this.damageLog = [];
    this.mode = "V"; this.red = null; this.black = null;
    this.sim = simulate(this.board, { power: false });
    this.note("开始", `客户说：${sc.complaint}`);
    this.trackOrder();
  }
  note(kind, text, extra = {}) { const e = { t: +this.minutes.toFixed(1), kind, text, ...extra }; this.log.push(e); return e; }
  resim() { this.sim = simulate(this.board, { power: this.power, run: this.running }); return this.sim; }
  // 通电状态下有电池或适配器时才会烧东西
  settle() {
    for (let k = 0; k < 4; k++) {
      this.resim();
      const d = applyDamage(this.board, this.sim.obs);
      if (!d.length) break;
      for (const x of d) { this.damageLog.push(x); this.note("损坏", `${x.ref} ${x.kind === "burnt" ? "烧了" : "坏了"}：${x.why}`, { bad: true }); }
    }
    return this.sim;
  }
  live() { // 板子上还有没有电：开着，或者电池还接着（开关只断一部分）
    if (this.power) return "电源还开着";
    const bat = this.board.parts.find((p) => p.kind === "bat" && p.state.present !== false);
    if (bat) return `${bat.ref} 电池还接着（关了开关也不等于没电）`;
    return null;
  }
  trackOrder() {
    const st = this.sc.check?.steps || [];
    st.forEach((s, i) => { if (!this.orderSeen.includes(i) && cond(this.board, s.cond)) this.orderSeen.push(i); });
  }
  orderOk() { const st = this.sc.check?.steps || []; if (this.sc.check?.type !== "ordered") return true; return this.orderSeen.length === st.length && this.orderSeen.every((v, i) => v === i); }

  // 统一入口：返回 { ok, text, ... }
  act(a) {
    if (this.done && a.a !== "inspect" && a.a !== "probe") return { ok: false, text: "这一关已经交付了" };
    const A = ACTIONS[a.a];
    if (!A) return { ok: false, text: "不认识的动作" };
    if (A.tool && a.a !== "probe") { if (this.autoTool) this.tool = A.tool; if (this.tool !== A.tool) return { ok: false, text: `要先拿起「${TOOLS[A.tool].zh}」` }; }
    if (a.a === "probe" && this.autoTool) this.tool = "meter";
    if (A.hot || A.live) {
      const why = this.live();
      if (why) {
        this.safety.push({ a: a.a, why });
        this.note("安全", `没有动手：${why}。带电${A.hot ? "焊接" : "改线"}可能短路、烧件或烫伤。（扣 ${SAFETY_COST} 分）`, { bad: true });
        return { ok: false, text: `先断电并拔掉电池：${why}`, safety: true };
      }
    }
    const covered = (ref) => { const p = partOf(this.board, ref); const c = p?.cover && this.board.covers.find((x) => x.id === p.cover); return c?.on ? c : null; };
    if (a.ref && covered(a.ref) && !["cover", "hint", "deliver", "power", "run"].includes(a.a)) return { ok: false, text: `${a.ref} 被「${covered(a.ref).zh}」挡住了，先拆外壳` };
    this.minutes += A.min;
    const r = this["do_" + a.a](a) || { ok: true };
    this.trackOrder();
    return r;
  }

  do_power({ on }) { this.power = !!on; if (!this.power) this.running = false; this.settle(); this.markPowered(); this.note("电源", this.power ? "通电" : "断电"); return { ok: true, obs: this.sim.obs }; }
  do_run({ on }) { if (on && !this.power) return { ok: false, text: "先通电" }; this.running = !!on; this.settle(); this.note("测试", on ? "开始运行测试（舵机动起来 / 振动）" : "停止运行"); return { ok: true, obs: this.sim.obs }; }
  markPowered() { if (this.power) for (const p of this.board.parts) if (p.state.newPart) p.state.poweredNew = !p.state.burnt; }
  do_probe({ red, black, mode }) {
    this.red = red ?? this.red; this.black = black ?? this.black; this.mode = mode || this.mode;
    for (const pr of [this.red, this.black]) if (pr?.ref) { const p = partOf(this.board, pr.ref); const c = p?.cover && this.board.covers.find((x) => x.id === p.cover); if (c?.on) return { ok: false, text: `${pr.ref} 被外壳挡住了` }; }
    const m = meter(this.board, this.sim, this.red, this.black, this.mode);
    if (m.warn && this.mode !== "V" && !this.safety.some((s) => s.a === "ohm-live")) { this.safety.push({ a: "ohm-live", why: m.warn, cost: 5 }); }
    this.note("测量", `${MODE_ZH[this.mode]} 红 ${label(this.red)} / 黑 ${label(this.black)} → ${m.text}${m.warn ? "（" + m.warn + "）" : ""}`);
    return { ok: true, ...m };
  }
  do_inspect({ ref, target, mag = 1 }) {
    const t = inspectText(this.board, ref || target, mag);
    this.note("观察", `${mag > 1 ? "放大镜看" : "看"} ${ref || target}：${t}`);
    return { ok: true, text: t };
  }
  do_wiggle({ ref, pin }) {
    const w = wiggle(this.board, { ref, pin });
    let extra = "";
    if (this.power && w.flaky) extra = "——拨动的瞬间现象变了（时好时坏）";
    this.note("拨动", w.text + extra);
    return { ok: true, text: w.text + extra, flaky: !!w.flaky };
  }
  do_reflow({ ref, pin }) {
    const p = partOf(this.board, ref);
    if (!p || p.state.present === false) return { ok: false, text: "这里没有零件" };
    const pins = pin ? [pin] : Object.keys(p.pins);
    for (const k of pins) p.joints[k] = "good";
    this.note("焊接", `补焊 ${ref}${pin ? " 的 " + pin + " 脚" : " 所有脚"}：加一点新锡（带助焊剂），焊点重新变亮、成小山形`);
    return { ok: true };
  }
  do_wick({ id }) {
    const s = this.board.shorts.find((x) => x.id === id);
    if (!s) return { ok: false, text: "这里没有锡桥" };
    if (s.kind !== "bridge") return { ok: false, text: "这是一根飞线，不是锡桥——用烙铁拆掉" };
    this.board.shorts = this.board.shorts.filter((x) => x !== s);
    this.note("焊接", `用吸锡带吸掉 ${s.zh}`);
    return { ok: true };
  }
  do_removeWire({ id }) {
    const s = this.board.shorts.find((x) => x.id === id && x.kind === "wire");
    if (!s) return { ok: false, text: "这里没有飞线" };
    this.board.shorts = this.board.shorts.filter((x) => x !== s);
    this.note("焊接", `拆掉 ${s.zh}`);
    return { ok: true };
  }
  do_desolder({ ref }) {
    const p = partOf(this.board, ref);
    if (!p || p.state.present === false) return { ok: false, text: "这里已经是空焊盘" };
    if (p.offBoard) return { ok: false, text: "这个不是焊在板上的" };
    p.state.present = false;
    this.note("焊接", `拆下 ${ref}（${p.zh}）`);
    return { ok: true };
  }
  do_place({ ref, item, orient = 1 }) {
    const p = partOf(this.board, ref), it = BIN[item];
    if (!p || !it) return { ok: false, text: "没有这个位置或零件" };
    if (p.state.present !== false) return { ok: false, text: `${ref} 上还有零件，先拆下来` };
    if (it.kind !== p.kind) { this.wrongParts.push({ ref, item, why: "封装不对" }); return { ok: false, text: `${it.zh} 装不到 ${ref} 的焊盘上（封装不对）` }; }
    const st = { present: true, newPart: true };
    if (it.kind === "res") st.ohms = it.ohms;
    if (it.kind === "led" || it.kind === "diode") st.orient = orient;
    if (it.kind === "ldo") st.vout = it.vout;
    if (it.kind === "conn") st.seat = "ok";
    if (it.kind === "cap") { st.c = it.c; st.esr = it.esr; if (p.props.polar && !it.polar) st.orient = 1; else if (it.polar) st.orient = orient; }
    p.state = st;
    p.joints = {};
    this.used.push(item);
    const capWrong = it.kind === "cap" && (Math.abs(it.c - p.props.c) / p.props.c > 0.25 || (it.polar && orient !== 1));
    if (capWrong) this.wrongParts.push({ ref, item, why: it.polar && orient !== 1 ? "电解电容装反了" : `丝印要求 ${fmtC(p.props.c)}` });
    const wrong = capWrong || (it.kind === "res" && it.ohms !== p.props.ohms) || (it.kind === "ldo" && it.vout !== p.props.vout) || ((it.kind === "led" || it.kind === "diode") && orient !== 1);
    if (wrong && !capWrong) this.wrongParts.push({ ref, item, why: it.kind === "res" ? `丝印要求 ${p.props.ohms} Ω` : it.kind === "ldo" ? `这块板要 ${p.props.vout} V` : "方向装反了" });
    this.note("焊接", `在 ${ref} 焊上 ${it.zh}${orient === -1 && (it.kind !== "cap" || it.polar) ? "（方向反着）" : ""}`);
    return { ok: true, wrong };
  }
  do_battery({ op, item, orient = 1 }) {
    const p = this.board.parts.find((x) => x.kind === "bat");
    if (!p) return { ok: false, text: "这块板不用电池" };
    if (op === "remove") { p.state.present = false; this.settle(); this.note("电池", "拆下电池"); return { ok: true }; }
    if (p.state.present !== false) return { ok: false, text: "电池还在，先拆下来" };
    let st = { ...p.state, present: true, orient };
    if (item) { const it = BIN[item]; if (!it || it.kind !== "bat" || it.chem !== p.props.chem) return { ok: false, text: "这块电池型号不对" }; st = { present: true, ocv: it.ocv, rint: it.rint, orient: p.props.chem === "lipo1" ? 1 : orient }; this.used.push(item); if (it.ocv < p.props.v - 0.1 && p.props.chem === "aa3") this.wrongParts.push({ ref: p.ref, item, why: "旧电池电量不够" }); }
    p.state = st;
    this.settle();
    this.note("电池", `装上${item ? " " + BIN[item].zh : "原来的电池"}${st.orient === -1 ? "（装反了）" : ""}`);
    return { ok: true };
  }
  do_reseat({ ref }) {
    const p = partOf(this.board, ref);
    if (p?.kind !== "conn") return { ok: false, text: "这不是插头" };
    if (p.state.seat === "out") p.state.seat = "ok";
    this.settle();
    const t = p.state.seat === "worn" ? `${ref} 插紧了，但手一松还是晃——簧片疲劳了，插紧解决不了` : `${ref} 插到底了`;
    this.note("插头", t);
    return { ok: true, text: t };
  }
  do_flipConn({ ref }) {
    const p = partOf(this.board, ref);
    if (p?.kind !== "conn" || p.props.keyed) return { ok: false, text: p?.props.keyed ? "这个插头有防呆，只能一个方向插" : "这不是插头" };
    p.state.flip = !p.state.flip;
    this.note("插头", `把 ${ref} 拔下来掉个头重新插`);
    return { ok: true };
  }
  do_replaceConn({ ref }) {
    const p = partOf(this.board, ref);
    if (p?.kind !== "conn") return { ok: false, text: "这不是插头" };
    p.state = { ...p.state, seat: "ok", newPart: true };
    p.joints = {};
    this.used.push("jst-ph2");
    this.note("焊接", `换上新的插座 ${ref}`);
    return { ok: true };
  }
  do_rewire({ id, item }) {
    const w = this.board.wires.find((x) => x.id === id), it = BIN[item];
    if (!w || it?.kind !== "wire") return { ok: false, text: "没有这根线或线不对" };
    w.state = { awg: it.awg, len: w.len };
    this.used.push(item);
    if (it.awg > w.awg) this.wrongParts.push({ ref: id, item, why: `原设计是 ${w.awg}AWG` });
    this.note("焊接", `把 ${w.zh} 换成 ${it.zh}，长度恢复到 ${Math.round(w.len * 100)} cm`);
    return { ok: true };
  }
  do_jumper({ trace, item = "wire-30" }) {
    const t = this.board.traces.find((x) => x.id === trace), it = BIN[item];
    if (!t || it?.kind !== "wire") return { ok: false, text: "没有这条走线" };
    const id = "JW-" + trace;
    if (!this.board.wires.some((w) => w.id === id)) this.board.wires.push({ id, a: t.a, b: t.b, awg: it.awg, len: 0.03, zh: `跨过 ${trace} 的飞线`, state: { awg: it.awg, len: 0.03 } });
    this.used.push(item);
    this.note("焊接", `刮开阻焊，用 ${it.zh} 跨过 ${trace} 的断点`);
    return { ok: true };
  }
  do_fixPolarity({ ref }) {
    const p = partOf(this.board, ref);
    if (p?.kind !== "dcin") return { ok: false, text: "这不是输入口" };
    p.state.orient = 1;
    this.note("接线", `${ref}：换成极性正确的适配器线（中心正）`);
    return { ok: true };
  }
  // v18：示波器。exp = steady（一直开着）/ power（抓开机那一下）/ run（抓舵机起步那一下）
  do_scope(opts = {}) {
    const exp = opts.exp || "steady";
    const bat = this.board.parts.find((p) => p.kind === "bat");
    if (bat && bat.state.present === false) return { ok: false, text: "电池没装，示波器上只有一条 0 V 的线" };
    if (exp === "power") { this.power = true; this.running = !!opts.run; }
    if (exp === "run") { if (!this.power) return { ok: false, text: "先通电" }; this.running = true; }
    const run = exp === "steady" ? this.running : !!(opts.run ?? exp === "run");
    const covered = (opts.chans || []).find((c) => { const p = c && c.ref && partOf(this.board, c.ref); const cv = p?.cover && this.board.covers.find((x) => x.id === p.cover); return cv?.on; });
    if (covered) return { ok: false, text: `${covered.ref} 被外壳挡住了，探头夹不上去` };
    const cap = capture(this.board, { ...opts, exp, run });
    this.settle(); this.markPowered();
    this.lastScope = cap;
    const sum = (cap.chans || opts.chans || []).map((c, i) => { const m = cap.meas?.[i]; return m ? `CH${i + 1} ${c.label || c.node} ${fmtV(m.min)}…${fmtV(m.max)}（峰峰 ${fmtV(m.pp)}）` : null; }).filter(Boolean).join("；");
    const ev = (cap.allEvents || []).filter((e) => e.kind === "reset" || e.kind === "boost-hiccup").length;
    this.note("示波器", `${EXP_ZH[exp]} ${fmtT(opts.tdiv || 1e-3)}/div → ${cap.triggered === false ? "没等到触发（自动模式下照样显示）" : sum || "没有通道"}${ev ? `；期间复位 / 打嗝 ${ev} 次` : ""}`);
    return { ok: true, cap };
  }
  do_recrimp({ id }) {
    const w = this.board.wires.find((x) => x.id === id);
    if (!w) return { ok: false, text: "没有这根线" };
    if (!w.cable) return { ok: false, text: "这根是焊上去的线，不是压接端子" };
    w.state = { ...w.state, crimpR: 0, cut: false, crimp: "new" };
    this.used.push("terminal");
    this.note("压接", `${w.zh}：剪掉旧端子，剥线 2–3 mm，用压线钳压上新端子（芯线和线皮两段都压住），插回去听到“咔”一声，拉一下不掉`);
    return { ok: true };
  }
  do_swapServo({ ref }) {
    const p = partOf(this.board, ref);
    if (p?.kind !== "servo") return { ok: false, text: "这不是舵机" };
    p.state = { ...p.state, stalled: false, newPart: true };
    this.used.push("servo");
    this.note("更换", `换上一个同型号的新舵机 ${ref}（旧的齿轮打坏了，留着拆齿轮）`);
    return { ok: true };
  }
  do_cover({ id, on }) {
    const c = this.board.covers.find((x) => x.id === id);
    if (!c) return { ok: false, text: "没有这个外壳" };
    c.on = on ?? !c.on;
    this.note("外壳", `${c.on ? "装回" : "拆下"}${c.zh}`);
    return { ok: true };
  }
  do_hint() {
    if (this.hints >= 3) return { ok: false, text: "提示已经用完了" };
    const h = this.sc.hints[this.hints];
    this.hints++;
    this.note("提示", `提示 ${this.hints}（扣 ${HINT_COST[this.hints - 1]} 分）：${h}`);
    return { ok: true, text: h, level: this.hints };
  }
  do_deliver() {
    // 交付验收：按客户的用法通电（必要时跑运动测试），会真的烧东西
    if (this.board.covers.some((c) => !c.on)) for (const c of this.board.covers) c.on = true;
    const bat = this.board.parts.find((p) => p.kind === "bat");
    if (bat && bat.state.present === false) return { ok: false, text: "电池还没装回去" };
    this.power = true; this.running = false;
    this.settle(); this.markPowered(); this.trackOrder();
    if ((this.board.spec || []).some((s) => s.run)) { this.running = true; this.settle(); }
    const ev = evaluate(this.board, {});
    const order = this.orderOk();
    this.solved = ev.ok && order;
    this.done = this.solved;
    this.lastEval = { ...ev, order };
    this.note("验收", this.solved ? "全部通过，交给客户" : `没通过：${ev.checks.filter((c) => !c.ok).map((c) => c.zh + "（" + c.info + "）").join("；")}${order ? "" : "；修理顺序不对：" + this.sc.check.why}`, { bad: !this.solved });
    this.power = false; this.running = false; this.resim();
    return { ok: this.solved, checks: ev.checks, order };
  }

  score() {
    const items = [{ zh: "基础分", v: 100 }];
    let h = 0; for (let i = 0; i < this.hints; i++) h += HINT_COST[i];
    if (h) items.push({ zh: `用了 ${this.hints} 个提示`, v: -h });
    const saf = this.safety.reduce((s, x) => s + (x.cost ?? SAFETY_COST), 0);
    if (saf) items.push({ zh: `安全违规 ${this.safety.length} 次`, v: -saf });
    if (this.wrongParts.length) items.push({ zh: `用错零件 ${this.wrongParts.length} 次`, v: -WRONG_PART_COST * this.wrongParts.length });
    if (this.damageLog.length) items.push({ zh: `修理中烧坏 ${this.damageLog.length} 个零件`, v: -10 * this.damageLog.length });
    const over = Math.max(0, this.minutes - this.sc.parMin);
    if (over > 0) items.push({ zh: `超出标准工时 ${over.toFixed(0)} 分钟（估算）`, v: -Math.min(20, Math.round(over / 2)) });
    const total = Math.max(0, items.reduce((s, x) => s + x.v, 0));
    const stars = !this.solved ? 0 : total >= 90 ? 3 : total >= 70 ? 2 : 1;
    return { items, total, stars };
  }
  report() {
    const s = this.score();
    const counts = {}; for (const u of this.used) counts[u] = (counts[u] || 0) + 1;
    return {
      title: this.sc.title, solved: this.solved, ...s, minutes: +this.minutes.toFixed(1), parMin: this.sc.parMin,
      parts: Object.entries(counts).map(([k, n]) => `${BIN[k].zh} × ${n}`),
      cost: `用了 ${this.used.length} 个零件（不显示价格：没有可核实的报价）`,
      rootCause: this.sc.rootCause, lesson: this.sc.lesson, safety: this.sc.safety, log: this.log,
    };
  }
}

const MODE_ZH = { V: "电压档", ohm: "电阻档", beep: "通断档", diode: "二极管档" };
const EXP_ZH = { steady: "一直开着抓", power: "抓开机那一下", run: "抓舵机起步那一下" };
export const fmtV = (v) => (!Number.isFinite(v) ? "—" : Math.abs(v) < 1 ? `${(v * 1000).toFixed(1)} mV` : `${v.toFixed(3)} V`);
export const fmtT = (t) => (t >= 1e-3 ? `${+(t * 1e3).toPrecision(3)} ms` : t >= 1e-6 ? `${+(t * 1e6).toPrecision(3)} µs` : `${+(t * 1e9).toPrecision(3)} ns`);
export const fmtC = (c) => (c >= 1e-6 ? `${+(c * 1e6).toPrecision(3)} µF` : `${+(c * 1e9).toPrecision(3)} nF`);
export { MODE_ZH };
export const label = (pr) => (!pr ? "—" : pr.net ? `背面 ${pr.tp || pr.net}` : `${pr.ref}.${pr.pin}`);

// 看 / 放大镜看：只根据零件“现在”的状态描述（修好之后线索也会消失）
export function inspectText(b, ref, mag = 1) {
  const out = [];
  const p = partOf(b, ref);
  if (p) {
    out.push(p.zh);
    if (p.state.present === false) { out.push("焊盘是空的，没有零件"); return out.join("；"); }
    if (p.state.burnt) out.push("表面有小鼓包和发黄的痕迹，闻起来有焦味");
    if (p.state.damaged) out.push("外观看不出来，但上电后不响应");
    if (p.kind === "res") out.push(mag > 1 ? `色环 ${colorBands(p.state.ohms)}（丝印要求 ${p.props.ohms} Ω）` : "色环太小，拿放大镜看");
    if ((p.kind === "led" || p.kind === "diode") && (p.state.orient ?? 1) < 0) out.push(p.kind === "led" ? "LED 的平边（负极）对着丝印的正极一侧——装反了" : "二极管的色环方向和丝印相反");
    if (p.kind === "ldo") out.push(mag > 1 ? `芯片丝印：${(p.state.vout ?? p.props.vout).toFixed(1)} V 版本` : "字太小，拿放大镜看");
    if (p.kind === "dcin" && (p.state.orient ?? 1) < 0) out.push("适配器插头是改过的，极性标签被涂掉了");
    if (p.kind === "conn") {
      if (p.state.flip) out.push("插头的棕 / 黑线朝向信号脚一侧——插反了");
      if (p.state.seat === "worn") out.push(mag > 1 ? "簧片张开，插进去几乎没阻力" : "插头看起来插着");
      if (p.state.seat === "out") out.push("插头没插到底，露出一截金属");
    }
    if (p.kind === "cap") {
      out.push(p.props.polar ? `电解电容，外壳印着 ${fmtC(p.state.c && !p.state.dried ? p.state.c : p.props.c)}` : mag > 1 ? "贴片陶瓷电容（本体没有丝印，容值只能看料号 / 用电容表量）" : "小贴片电容");
      if (p.state.dried) out.push(mag > 1 ? "顶部防爆纹微微鼓起，底部有一圈褐色干涸的电解液痕迹" : "顶部好像有点鼓（拿放大镜看）");
      if (p.props.polar && (p.state.orient ?? 1) < 0) out.push("外壳上的白色负极条对着丝印的 + 号——装反了");
    }
    if (p.kind === "servo" && p.state.stalled) out.push("舵盘用手拧不动，通电时发出“嗡嗡”声");
    if (p.kind === "bat") out.push(p.props.chem === "lipo1" ? "锂电外观正常（电量从外观看不出来，要量）" : "外观正常（电量要量）");
    const cold = Object.entries(p.joints || {}).filter(([, v]) => v === "cold").map(([k]) => k);
    if (cold.length) out.push(mag > 1 ? `${cold.join("、")} 脚焊点发灰、粗糙、成球状，边缘没润湿焊盘` : "有个焊点颜色好像不太一样（拿放大镜看）");
    const nets = new Set(Object.values(p.pins));
    for (const s of b.shorts) if (nets.has(s.a) || nets.has(s.b)) out.push(s.kind === "wire" ? `旁边有 ${s.zh}` : mag > 1 ? `相邻焊盘之间有一坨亮锡（${s.a} ↔ ${s.b}）` : "焊盘附近有点反光（拿放大镜看）");
    for (const t of b.traces) if ((nets.has(t.a) || nets.has(t.b)) && t.state.cracked) out.push(mag > 1 ? `${t.id} 走线上有一道发丝细的裂纹` : "附近板子有被弯过的痕迹");
    if (out.length === 1) out.push("看起来正常");
    return out.join("；");
  }
  const w = b.wires.find((x) => x.id === ref);
  if (w && w.cable) return `${w.zh}：${w.state.crimp === "open" ? (mag > 1 ? "一头的端子从插头里退出来一截（倒刺压平了）" : "插头看起来插着（拿放大镜看端子）") : w.state.crimp === "bad" ? (mag > 1 ? "一头的端子只压住了线皮，芯线在端子里能抽动" : "看起来正常（拿放大镜看端子）") : "端子压接正常"}；线皮印着 ${w.state.awg}AWG，长约 ${Math.round(w.state.len * 100)} cm`;
  if (w) return `${w.zh}：${mag > 1 ? `线皮印着 ${w.state.awg}AWG，长约 ${Math.round(w.state.len * 100)} cm（${(AWG_OHM_M[w.state.awg] * w.state.len * 1000).toFixed(0)} mΩ）` : "线皮上的字太小，拿放大镜看"}`;
  const t = b.traces.find((x) => x.id === ref);
  if (t) return `${t.id} ${t.zh}：${t.state.cracked ? (mag > 1 ? "有一道发丝细的裂纹" : "看不清，拿放大镜") : "完好"}`;
  const s = b.shorts.find((x) => x.id === ref);
  if (s) return s.zh;
  return "没找到";
}
export { pinNode };
