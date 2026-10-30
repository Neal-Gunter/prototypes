// v19：把“台面上真的摆好、接好的零件和线”提取成网表，交给时域仿真（tboard.capture）。早期原型，简化仿真。
// 输出和维修板子同一种格式（零件 pins → 网络名、导线 awg / len、插头接触电阻），所以示波器、稳态求解、导通检查全部复用。
// 两种台面：
//   ① 八爪鱼 v10（3D 台面上的导线带 meta：{ a:[角色,引脚], b:[角色,引脚] }）：每个“角色:引脚”是一个网络，每根导线按线规 × 实际走线长度算电阻；
//   ② 通用台面（面包板 / 杜邦线 / Pico / Feather / LED / 电阻 / 按键 / 电位器 / 舵机）：沿用 netlist.js 的连通关系，杜邦线单独算线阻。
// 所有没有出处的参数都标“估算”；我自己定的建模取舍标“我的补充”。
import { AWG_OHM_M, conductors, pinNode } from "../repair/board.js";

// 线种 → 线规（AWG）和默认长度（cm，3D 台面上用实际走线长度覆盖）。全部估算（页面没写线规的按常见规格）。
export const WIRE_SPEC = {
  "octo-v10-wire": { awg: 26, len: 10, zh: "26AWG 硅胶线（估算）" },
  "octo-v10-power": { awg: 22, len: 10, zh: "22AWG 硅胶线（估算）" },
  "octo-jst": { awg: 22, len: 8, zh: "电池自带 JST 引线（按 22AWG 估算）" },
  "servo-lead-v10": { awg: 28, len: 15, zh: "SG51R 舵机引线（按 28AWG 估算）" },
  "octo-wire": { awg: 20, len: 15, zh: "20AWG 电源线（估算）" },
  dupont: { awg: 26, len: 20, zh: "杜邦线（按 26AWG 估算）" },
};
export const AWG_CHOICES = [20, 22, 24, 26, 28, 30];
export const CAP_DEFAULT = { c: 100e-6, esr: 0.3, zh: "D6.3 电解电容：容值 / ESR 估算 100 µF / 0.3 Ω（我的补充）" };
export const BATT_AGE = { fresh: { rint: 0.06, zh: "新电池（内阻 0.06 Ω，估算）" }, mid: { rint: 0.15, zh: "用了一阵（0.15 Ω，估算）" }, aged: { rint: 0.25, zh: "老化电池（0.25 Ω，估算）" } };
const wireR = (awg, lenCm) => (AWG_OHM_M[awg] ?? AWG_OHM_M[26]) * (lenCm / 100);

const mk = (ref, kind, zh, pins, props = {}, state = {}, extra = {}) => ({ ref, kind, zh, x: 0, y: 0, w: 4, h: 4, pins, props, state: { present: true, ...state }, joints: {}, offBoard: true, ...extra });

// —— ① 八爪鱼 v10 ——
// 台面数据（bench.js 的 benchV10）→ 和 3D 台面同一种“导线清单”（舵机引线拆成 PWM 一根 + 电源一根，和 build3d.js 一致）
export function octoWiresFromSpec(B) {
  const out = [];
  B.wires.forEach((w, i) => {
    if (w.kind === "octo-v10-servo") {
      out.push({ id: `w${i}p`, kind: "octo-v10-wire", a: w.a, b: w.b, lenCm: WIRE_SPEC["servo-lead-v10"].len });
      out.push({ id: `w${i}v`, kind: "octo-v10-servo", a: w.a, b: [w.rail, "OUT"], lenCm: WIRE_SPEC["servo-lead-v10"].len });
    } else out.push({ id: `w${i}`, kind: w.kind, a: w.a, b: w.b, lenCm: WIRE_SPEC[w.kind]?.len ?? 10 });
  });
  return { defs: { ...B.defs, ...Object.fromEntries(B.servos.map((s) => [s.role, "ada-2201"])) }, wires: out, swOn: B.swOn !== false, vbat: B.vbat, source: "spec" };
}
// 3D 台面（engine）→ 导线清单：只认带 meta 的八爪鱼导线；长度用实际走线长度
export function octoWiresFromEngine(engine) {
  const defs = {}, wires = [], roleUid = {};
  for (const c of engine.cables || []) {
    const m = c.meta;
    if (!m?.a || !m?.b) continue;
    const [ua, ub] = c.endUids || [];
    for (const [r, u] of [[m.a[0], ua], [m.b[0], ub]]) { const P = u && engine.parts.get(u); if (P) { defs[r] = P.def.id; roleUid[r] = u; } }
    wires.push({ id: c.id, kind: c.kind, a: m.a, b: m.b, lenCm: +(c.len || WIRE_SPEC[c.kind]?.len || 10), why: m.why });
  }
  // 台面上有电气引脚、但一根线都没接的零件（只报告，不进网表）
  const loose = [];
  const used = new Set(Object.values(roleUid));
  for (const P of engine.parts?.values?.() || []) if (!used.has(P.uid) && /^(ada-|p-octo-vdiv|kc-cp_)/.test(P.def.id) && !/^ada-2201$/.test(P.def.id) && P.def.id !== "p-octo-frame-v10") loose.push({ uid: P.uid, id: P.def.id, zh: P.label || P.def.name || P.def.id });
  return { defs, wires, roleUid, loose, source: "engine" };
}

// 每种零件怎么进网表（不在表里的 = 不支持）
const OCTO_MODEL = {
  "ada-258": "bat", "ada-4410": "chg", "ada-805": "sw", "ada-4654": "boost", "ada-5426": "mcu", "p-octo-vdiv-1s": "div", "kc-cp_radial_d6.3mm_p2.50mm": "cap", "ada-2201": "servo",
};
// edits：{ rint, vbat, caps: { CAP1: c(F)|0 }, awg: { 线id: AWG }, removed: [线id], swOn }
export function octoBoard(W, edits = {}) {
  const N = (role, pin) => `${role}:${pin}`;
  const parts = [], wires = [], traces = [], issues = [], unsupported = [];
  const removed = new Set(edits.removed || []);
  const live = W.wires.filter((w) => !removed.has(w.id));
  const roles = Object.keys(W.defs);
  // 导线
  const pwmOf = {}; // 舵机角色 → QT Py 焊盘
  for (const w of live) {
    const awg = edits.awg?.[w.id] ?? (w.a[1] === "LEAD" ? WIRE_SPEC["servo-lead-v10"].awg : WIRE_SPEC[w.kind]?.awg ?? 26);
    const base = { awg, len: w.lenCm / 100, zh: w.why || `${w.a.join(" ")} → ${w.b.join(" ")}`, state: { awg, len: w.lenCm / 100 }, src: w.id };
    if (w.a[1] === "LEAD" && w.kind === "octo-v10-servo") { // 舵机红线 / 棕线（3D 里画成一根）
      wires.push({ ...base, id: w.id + "+", a: N(w.a[0], "V+"), b: N(w.b[0], "OUT"), zh: `${w.a[0]} 红线 → ${w.b[0]} OUT` });
      wires.push({ ...base, id: w.id + "-", a: N(w.a[0], "GND"), b: N(w.b[0], "GND"), zh: `${w.a[0]} 棕线 → ${w.b[0]} GND` });
    } else if (w.a[1] === "LEAD") { wires.push({ ...base, id: w.id, a: N(w.a[0], "PWM"), b: N(...w.b), zh: `${w.a[0]} 橙线 → ${w.b.join(" ")}` }); pwmOf[w.a[0]] = w.b[0] === "QTPY" ? w.b[1] : null; }
    else wires.push({ ...base, id: w.id, a: N(...w.a), b: N(...w.b) });
  }
  // 零件
  const swOn = edits.swOn ?? W.swOn ?? true;
  for (const role of roles) {
    const id = W.defs[role], m = OCTO_MODEL[id];
    if (!m) { unsupported.push({ role, id, zh: `${role}（${id}）没有电气模型，没进网表` }); continue; }
    if (m === "bat") { const r = edits.rint ?? BATT_AGE.fresh.rint, v = edits.vbat ?? W.vbat ?? 3.85; parts.push(mk(role, "bat", `1S LiPo（Adafruit 258，内阻 ${r} Ω 估算）`, { "+": N(role, "BAT+"), "-": N(role, "BAT-") }, { chem: "lipo1", v, r, mAh: 1200 }, { ocv: v, rint: r, orient: 1 })); }
    else if (m === "chg") parts.push(mk(role, "conn", "充电板 JST 座 → BAT / GND 焊盘（接触电阻）", { a1: N(role, "JST+"), a2: N(role, "JST-"), b1: N(role, "BAT"), b2: N(role, "GND") }, { pairs: 2, keyed: true }, { seat: edits.seat?.[role] || "ok" }));
    else if (m === "sw") { if (swOn) parts.push(mk(role, "sw", "拨动开关（1 ↔ COM）", { a: N(role, "1"), b: N(role, "COM") })); else traces.push({ id: role + "-off", a: N(role, "COM"), b: N(role, "3"), state: {} }); }
    else if (m === "boost") parts.push(mk(role, "boost", `MiniBoost 5.2 V（${role}）`, { IN: N(role, "IN"), GND: N(role, "GND"), OUT: N(role, "OUT"), EN: N(role, "EN") }, { vout: 5.2, eff: 0.85, ilim35: 1.1, uvlo: 2.5 }));
    else if (m === "div") { parts.push(mk(role + "_R1", "res", "分压上臂 100k", { 1: N(role, "IN"), 2: N(role, "OUT") }, { ohms: 1e5 }, { ohms: 1e5 })); parts.push(mk(role + "_R2", "res", "分压下臂 100k", { 1: N(role, "OUT"), 2: N(role, "GND") }, { ohms: 1e5 }, { ohms: 1e5 })); }
    else if (m === "cap") { const c = edits.caps?.[role] ?? CAP_DEFAULT.c; if (c > 0) parts.push(mk(role, "cap", `${role} 电解电容 ${(c * 1e6).toFixed(0)} µF（估算）`, { "+": N(role, "+"), "-": N(role, "-") }, { c, esr: edits.esr?.[role] ?? CAP_DEFAULT.esr, polar: true })); }
    else if (m === "servo") parts.push(mk(role, "servo", `${role} SG51R`, { S: N(role, "PWM"), V: N(role, "V+"), G: N(role, "GND") }, { iIdle: 0.01, iPeak: 0.1, sigPin: pwmOf[role] || null }));
    else if (m === "mcu") {
      const pads = ["A0", "A1", "A2", "A3", "SDA", "SCL", "TX", "RX", "SCK", "MI", "MO"];
      const pins = { VCC: N(role, "BAT"), GND: N(role, "BGND") };
      for (const p of pads) pins[p] = N(role, p);
      traces.push({ id: role + "-gnd", a: N(role, "GND"), b: N(role, "BGND"), state: {} }); // 板上 GND 和背面 GND 焊盘
      const drive = Object.fromEntries(Object.values(pwmOf).filter(Boolean).map((p) => [p, 1]));
      // 我的补充：固件通过 A3 读电池（分压 1/2），低于 3.55 V（A3 上 1.775 V）停运动；A3 没接 = 读到 0 V = 一上来就停
      parts.push(mk(role, "mcu", "QT Py ESP32‑S3（BAT 焊盘供电）", pins, { i: 0.08, bo: 3.4, vnom: 3.7, vio: 3.3, drive, fw: { vbatStop: 3.55 / 2, vbatNet: N(role, "A3"), stagger: 2e-3, bootRead: true } }));
    }
  }
  const bat = parts.find((p) => p.kind === "bat");
  // 我的补充：探头地夹夹在充电板 GND 焊盘（和参考板的 GND 网络同一位置）
  const b = { template: "bench-octo", name: "台面上的八爪鱼 v10（按实际接线提取）", ground: W.defs.CHG ? "CHG:GND" : bat ? bat.pins["-"] : "GND", parts, wires, traces, shorts: [], nets: {}, covers: [], testpoints: [], watch: {}, spec: [] };
  for (const p of parts) for (const n of Object.values(p.pins)) b.nets[n] = n;
  for (const w of wires) { b.nets[w.a] = w.a; b.nets[w.b] = w.b; }
  return finish(b, { unsupported, source: W.source, loose: W.loose || [], issues });
}

// —— 诊断：悬空网络 / 短路 / 缺地 / 不支持的零件 ——
class UF { constructor() { this.p = new Map(); } f(a) { if (!this.p.has(a)) this.p.set(a, a); let r = a; while (this.p.get(r) !== r) r = this.p.get(r); this.p.set(a, r); return r; } u(a, b) { this.p.set(this.f(a), this.f(b)); } }
const SRC_KINDS = new Set(["bat", "dcin"]);
export function diagnose(b, extra = {}) {
  const errors = [], warnings = [];
  const C = conductors(b, { power: true, phase: "idle" });
  const low = new UF(), any = new UF(); // low：< 1 Ω 的导体（找短路）；any：所有导体 + 器件内部通路（找悬空）
  for (const r of C) { if (r.r < 1) low.u(r.a, r.b); if (r.r < 1e5 + 1) any.u(r.a, r.b); }
  const P = (p, pin) => pinNode(p.ref, pin);
  // 只有“电源 / 转换器”把两边连起来（负载两端不算：负载一头没接 = 悬空）
  for (const p of b.parts) { if (p.state?.present === false || !["bat", "dcin", "boost", "ldo"].includes(p.kind)) continue; const ps = Object.keys(p.pins); for (let i = 1; i < ps.length; i++) any.u(P(p, ps[0]), P(p, ps[i])); }
  for (const p of b.parts) if (p.kind === "mcu") for (const g of Object.keys(p.props.drive || {})) if (p.pins[g]) any.u(P(p, "VCC"), P(p, g)); // 主控输出脚由主控驱动
  const srcs = b.parts.filter((p) => SRC_KINDS.has(p.kind) && p.state?.present !== false);
  if (!srcs.length) errors.push({ k: "nosource", fatal: true, zh: "台面上没有电源（电池 / 适配器 / USB）：没法仿真" });
  for (const s of srcs) if (low.f(P(s, "+")) === low.f(P(s, "-"))) errors.push({ k: "short", fatal: true, zh: `短路：${s.zh} 的 + 和 − 之间只有导线 / 焊锡（< 1 Ω）`, ref: s.ref });
  for (const p of b.parts) if (p.kind === "boost" && low.f(P(p, "OUT")) === low.f(P(p, "GND"))) errors.push({ k: "short", fatal: true, zh: `短路：${p.ref} 的 OUT 直接连到 GND`, ref: p.ref });
  // 缺地：用电器的地脚到“电源 −”没有低阻通路
  const gnd = (pin) => { const m = new UF(); for (const r of C) if (r.r < 10) m.u(r.a, r.b); return m.f(pin) === m.f(b.ground); };
  const gpin = { boost: "GND", mcu: "GND", servo: "G", ldo: "GND", cap: "-" };
  for (const p of b.parts) if (gpin[p.kind] && p.state?.present !== false && !gnd(P(p, gpin[p.kind]))) errors.push({ k: "noground", fatal: false, zh: `缺地：${p.zh} 的 ${gpin[p.kind]} 没接到电源 −（波形按“地悬空”算，读数没意义）`, ref: p.ref });
  // 悬空：接了线、但整片连通区域里没有电源
  const hasSrc = new Set(srcs.map((s) => any.f(P(s, "+"))));
  const float = new Set();
  for (const w of b.wires || []) for (const n of [w.a, w.b]) if (!hasSrc.has(any.f(n))) float.add(n);
  for (const p of b.parts) if (["boost", "mcu", "servo", "ldo"].includes(p.kind)) { const vin = p.kind === "servo" ? "V" : p.kind === "mcu" ? "VCC" : "IN"; if (!hasSrc.has(any.f(P(p, vin)))) float.add(p.pins[vin]); }
  if (float.size) errors.push({ k: "floating", fatal: false, zh: `悬空网络 ${float.size} 个（没有任何通路接到电源）：${[...float].slice(0, 8).join("、")}${float.size > 8 ? " …" : ""}`, nets: [...float] });
  for (const u of extra.unsupported || []) errors.push({ k: "unsupported", fatal: false, zh: `不支持的零件：${u.zh}` });
  for (const l of extra.loose || []) warnings.push({ k: "loose", zh: `${l.zh} 在台面上但一根线都没接（没进网表）` });
  for (const s of b.parts.filter((p) => p.kind === "servo" && !p.props.sigPin)) warnings.push({ k: "nosig", zh: `${s.ref} 的信号线没接到主控引脚：不会动` });
  return { errors, warnings, fatal: errors.some((e) => e.fatal) };
}
function finish(b, extra) {
  const d = diagnose(b, extra);
  return { ok: !d.fatal, board: b, ...d, probes: probesOf(b), source: extra.source, stats: { parts: b.parts.length, wires: b.wires.length, nets: Object.keys(b.nets).length } };
}
// 探头可以夹的地方：每个网络（= 零件脚）+ 每根导线两端
export function probesOf(b) {
  const out = Object.keys(b.nets).sort().map((n) => ({ node: n, zh: n, kind: "pin" }));
  for (const w of b.wires || []) { out.push({ node: w.a, zh: `线 ${w.id}（${w.zh}）A 端`, kind: "wire", wire: w.id }); out.push({ node: w.b, zh: `线 ${w.id}（${w.zh}）B 端`, kind: "wire", wire: w.id }); }
  return out;
}
