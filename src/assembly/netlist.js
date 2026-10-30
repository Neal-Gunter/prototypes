// 装配台的电路模型：从台面上“真实插好 / 焊好 / 接好”的东西推出电路网络，再做直流求解。
// 唯一的数据来源是装配引擎（零件位姿 + 边 + 焊点 + 线缆），不另存一份接线表。
// 早期原型，简化仿真：只算稳态直流（节点电压法），数值标“估算”的没有查到对应型号的数据手册。
import { PICO_PINS } from "./catalog.js";
import { gauss, ohmsBetween, BEEP_OHM, fmtOhm, LED_VF, LED_RS, LED_OVER_MA, LED_BURN_MA, SERVO_MIN_V } from "./dcmath.js";
export { LED_VF, LED_RS, LED_OVER_MA, LED_BURN_MA, SERVO_MIN_V };
import { PART_TYPES } from "../workbench/parts.js";

const base = (id) => id.replace(/:flip$/, "");
const XZ = 0.09; // 两个特征在水平面上重合的容差（cm）

// ---------------- 板子引脚 ----------------
const FEATHER_PINS = PART_TYPES.esp32.pins();
export const BOARDS = {
  "ada-5323": { kind: "esp32s3", short: "Feather", label: "Adafruit Feather ESP32‑S3", vdd: 3.3, adcBits: 12, gpioMaxmA: 40, rOut: 30, rPull: 45000, analog: (g) => g >= 1 && g <= 20, core: "esp32:esp32（Arduino ESP32 板子包）", fqbn: "esp32:esp32:adafruit_feather_esp32s3" },
  "kc-raspberrypi_pico": { kind: "rp2040", short: "Pico", label: "Raspberry Pi Pico", vdd: 3.3, adcBits: 10, gpioMaxmA: 12, rOut: 40, rPull: 60000, analog: (g) => g >= 26 && g <= 28, core: "rp2040:rp2040（arduino-pico 板子包）", fqbn: "rp2040:rp2040:rpipico" },
};
BOARDS["kc-raspberrypi_pico_h"] = BOARDS["kc-raspberrypi_pico"];
BOARDS["kc-raspberrypi_pico_w"] = { ...BOARDS["kc-raspberrypi_pico"], label: "Raspberry Pi Pico W" };
const picoRole = (n) => (n === "GND" ? "gnd" : n === "3V3" ? "3v3" : n === "VBUS" ? "5v" : n === "VSYS" ? "vsys" : n === "RUN" ? "rst" : n === "3V3_EN" ? "en" : n === "ADC_VREF" ? "vref" : /^GP\d+$/.test(n) ? "gpio" : "nc");

export function boardOf(def) {
  return BOARDS[base(def.id)] || null;
}
// 板子第 i 个焊盘孔 → {name, label, role, gpio, phys}
const pinCache = new WeakMap();
export function boardPins(def) {
  if (pinCache.has(def)) return pinCache.get(def);
  const b = boardOf(def);
  const holes = (def.anchors || []).filter((a) => a.t === "pinhole");
  const out = [];
  if (b?.kind === "rp2040") {
    holes.forEach((h) => {
      const n = PICO_PINS[h.i];
      if (!n) return;
      out[h.i] = { name: n, label: n, role: picoRole(n), gpio: /^GP\d+$/.test(n) ? +n.slice(2) : null, phys: h.i + 1 };
    });
  } else if (b?.kind === "esp32s3") {
    // 按孔的位置对应丝印：z>0 一排 16 孔（从 USB 一端起 RST…DB），z<0 一排 12 孔（BAT…SDA）；板中间两个小孔不是排针
    const long = holes.filter((h) => h.p[2] > 0.9).sort((a, b) => a.p[0] - b.p[0]);
    const short = holes.filter((h) => h.p[2] < -0.9).sort((a, b) => a.p[0] - b.p[0]);
    const L = FEATHER_PINS.filter((p) => p.row === "long"), S = FEATHER_PINS.filter((p) => p.row === "short");
    long.forEach((h, k) => L[k] && (out[h.i] = { ...L[k], label: L[k].label, phys: k + 1 }));
    short.forEach((h, k) => S[k] && (out[h.i] = { ...S[k], label: S[k].label, phys: 17 + k }));
  }
  pinCache.set(def, out);
  return out;
}

// ---------------- 元件类型 ----------------
export function elemKind(def) {
  const id = base(def.id);
  if (BOARDS[id]) return "mcu";
  if (/^kc-led_d(3|5|10)\.0mm$/.test(id) || id === "kc-led_d5.0mm_irgrey") return "led";
  if (/^kc-r_axial/.test(id)) return "res";
  if (/^kc-sw_push_6mm/.test(id)) return "btn";
  if (/^kc-potentiometer/.test(id)) return "pot";
  if (/^p-jumper-/.test(id)) return "jumper";
  if (/^kc-pin(header|socket)_/.test(id)) return "header";
  if (/^p-breadboard/.test(id)) return "bb";
  if (/^p-dupont-/.test(id)) return "dupont";
  if (/^p-plug-/.test(id)) return "plug";
  if (def.servo) return "servo";
  return null;
}
const PREFIX = { mcu: "U", led: "D", res: "R", btn: "SW", pot: "RV", jumper: "W", header: "J", bb: "BB", servo: "M", dupont: "P", plug: "USB" };
export function ensureRefs(engine) {
  const used = new Set([...engine.parts.values()].map((p) => p.state.ref).filter(Boolean));
  for (const p of engine.parts.values()) {
    if (p.state.ref) continue;
    const k = elemKind(p.def);
    const pre = PREFIX[k] || "X";
    let n = 1;
    while (used.has(`${pre}${n}`)) n++;
    p.state.ref = `${pre}${n}`;
    used.add(p.state.ref);
  }
}
export const SHORT_A = 0.5;

// 腿的语义：LED 腿 0 = 焊盘 1 = 阴极 K（KiCad 惯例），腿 1 = 阳极 A；电位器按 x 排序：两端 + 中间滑片
export function legNames(def) {
  const k = elemKind(def);
  const legs = def.legs || [];
  if (k === "led") return legs.map((l) => (l.p[0] < 0 ? "K" : "A"));
  if (k === "pot") { const xs = legs.map((l) => l.p[0]).sort((a, b) => a - b); return legs.map((l) => (l.p[0] === xs[0] ? "1" : l.p[0] === xs[2] ? "3" : "W")); }
  if (k === "btn") return legs.map((l) => (l.p[2] < 0 ? "1" : "2"));
  return legs.map((l, i) => String(i + 1));
}
const LEGZH = { K: "阴极 K（短脚）", A: "阳极 A（长脚）", W: "滑片", 1: "脚 1", 2: "脚 2", 3: "脚 3" };

// ---------------- 并查集 ----------------
class UF {
  constructor() { this.p = new Map(); }
  find(x) { let p = this.p.get(x); if (p === undefined) { this.p.set(x, x); return x; } while (p !== x) { const g = this.p.get(p); this.p.set(x, g); x = p; p = g; } return x; }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

// 焊点：{p:[x,y,z]（板子局部坐标）, q:'good'|'cold'|'bridge'|'burnt', bridge?: 相邻孔号}；旧格式 [x,y,z] = 好焊点
export const jointOf = (j) => (Array.isArray(j) ? { p: j, q: "good" } : j);
export const JOINT_ZH = { good: "合格", cold: "虚焊", bridge: "连锡", burnt: "焊盘烫坏" };
function jointAt(part, a) {
  for (const j0 of part.state.solder || []) {
    const j = jointOf(j0);
    if (Math.hypot(j.p[0] - a.p[0], j.p[2] - a.p[2]) < 0.06) return j;
  }
  return null;
}

// ---------------- 从台面推出电路 ----------------
export function buildCircuit(engine, opt = {}) {
  ensureRefs(engine);
  const uf = new UF();
  const T = (uid, k) => `${uid}|${k}`;
  const parts = engine.parts;
  const wf = new Map();
  for (const bid of engine.bodies.keys()) for (const f of engine.worldFeatures(bid)) { if (!wf.has(f.uid)) wf.set(f.uid, []); wf.get(f.uid).push(f); }
  const feats = (uid) => wf.get(uid) || [];
  const near = (a, b) => Math.hypot(a.wp.x - b.wp.x, a.wp.z - b.wp.z) < XZ;
  const thru = []; // 针脚穿过焊盘孔：{board, i, other, otherTerm, joint}
  const placements = []; // 物理位置：{uid, term, where:'面包板 c3' ...}
  const powered = new Map(); // board uid → 'USB'
  const plugs = [];
  const pairs = new Set();
  for (const e of engine.edges) {
    const key = e.a < e.b ? e.a + "~" + e.b : e.b + "~" + e.a;
    if (pairs.has(key)) continue;
    pairs.add(key);
    for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) {
      const X = parts.get(x), Y = parts.get(y);
      if (!X || !Y) continue;
      const kx = elemKind(X.def), ky = elemKind(Y.def);
      for (const f of feats(x)) {
        if (f.t === "leg") {
          const term = T(x, `l${f.i}`);
          for (const g of feats(y)) {
            if (g.t === "bbhole" && near(f, g)) { uf.union(term, T(y, `n:${g.net}`)); placements.push({ uid: x, term, at: y, hole: g.name }); }
            if (g.t === "pinhole" && near(f, g) && kx !== "mcu") thru.push({ board: y, i: g.i, term, other: x, a: Y.def.anchors.find((a) => a.t === "pinhole" && a.i === g.i) });
          }
        }
        if (f.t === "pin-up") {
          const term = T(x, `l${f.i}`);
          for (const g of feats(y)) if (g.t === "pinhole" && near(f, g)) thru.push({ board: y, i: g.i, term, other: x, a: Y.def.anchors.find((a) => a.t === "pinhole" && a.i === g.i) });
        }
        if (f.t === "dupont-m") for (const g of feats(y)) if (g.t === "bbhole" && near(f, g)) { uf.union(T(x, "c0"), T(y, `n:${g.net}`)); placements.push({ uid: x, term: T(x, "c0"), at: y, hole: g.name }); }
        if (f.t === "dupont-f") for (const g of feats(y)) if (g.t === "pin-up" && near(f, g)) { uf.union(T(x, `c${f.k || 0}`), T(y, `l${g.i}`)); placements.push({ uid: x, term: T(x, `c${f.k || 0}`), at: y, pin: g.i }); }
        if (f.t === "plug" && kx === "plug" && e.why === "plug") for (const g of feats(y)) if (g.t === "port" && g.kind === f.kind && Math.hypot(f.wp.x - g.wp.x, f.wp.z - g.wp.z) < 1.0) plugs.push({ plug: x, board: y, kind: f.kind });
      }
      void ky;
    }
  }
  // 焊点决定针脚和焊盘是否导通
  const joints = [];
  for (const t of thru) {
    const B = parts.get(t.board);
    const j = t.a && jointAt(B, t.a);
    t.joint = j;
    const term = T(t.board, `p${t.i}`);
    if (j && (j.q === "good" || j.q === "bridge")) uf.union(t.term, term);
    joints.push({ board: t.board, i: t.i, term, other: t.other, q: j ? j.q : "none" });
  }
  // 连锡：相邻焊盘被锡连在一起
  for (const P of parts.values()) for (const j0 of P.state.solder || []) { const j = jointOf(j0); if (j.q === "bridge" && j.bridge != null && j.i != null) uf.union(T(P.uid, `p${j.i}`), T(P.uid, `p${j.bridge}`)); }
  // 线缆两端：杜邦线 = 两个插头的触点相连；舵机线 = 舵机三根线接到母头三个触点
  const wires = [];
  for (const c of engine.cables) {
    if (c.kind === "servo-lead") {
      const [sv, hs] = c.endUids;
      if (parts.has(sv) && parts.has(hs)) ["GND", "VCC", "SIG"].forEach((n, k) => uf.union(T(sv, n), T(hs, `c${k}`)));
      continue;
    }
    // v19：opt.wireR = 杜邦线不并成一个节点，留给时域网表单独算线阻
    if (c.endUids[0] && c.endUids[1]) { if (!opt.wireR) uf.union(T(c.endUids[0], "c0"), T(c.endUids[1], "c0")); wires.push({ id: c.id, kind: c.kind, a: c.endUids[0], b: c.endUids[1], len: c.len }); }
  }
  // USB：插头插在板子的口上、线的另一头接电脑（线缆自由端）
  for (const pl of plugs) {
    const c = engine.cables.find((c) => c.endUids[0] === pl.plug && !c.endUids[1]);
    if (c) powered.set(pl.board, "USB");
  }
  // 元件
  const els = [];
  const items = [];
  for (const P of parts.values()) {
    const k = elemKind(P.def);
    const ln = legNames(P.def);
    const L = (name) => T(P.uid, `l${ln.indexOf(name)}`);
    if (k === "res") els.push({ t: "R", a: T(P.uid, "l0"), b: T(P.uid, "l1"), r: P.state.ohms || 220, uid: P.uid });
    if (k === "jumper") uf.union(T(P.uid, "l0"), T(P.uid, "l1"));
    if (k === "pot") {
      const R = P.state.ohms || 10000, pos = P.state.pos ?? 0.5;
      els.push({ t: "R", a: L("1"), b: L("W"), r: Math.max(1, R * pos), uid: P.uid }, { t: "R", a: L("W"), b: L("3"), r: Math.max(1, R * (1 - pos)), uid: P.uid });
    }
    if (k === "btn") {
      const g1 = ln.map((n, i) => (n === "1" ? i : -1)).filter((i) => i >= 0), g2 = ln.map((n, i) => (n === "2" ? i : -1)).filter((i) => i >= 0);
      for (const g of [g1, g2]) for (let i = 1; i < g.length; i++) uf.union(T(P.uid, `l${g[0]}`), T(P.uid, `l${g[i]}`));
      if (P.state.pressed) els.push({ t: "R", a: T(P.uid, `l${g1[0]}`), b: T(P.uid, `l${g2[0]}`), r: 0.05, uid: P.uid });
    }
    if (k === "led" && !P.state.burnt) els.push({ t: "LED", a: L("A"), k: L("K"), uid: P.uid });
    if (k) items.push({ uid: P.uid, kind: k, ref: P.state.ref, legs: ln });
  }
  return { engine, uf, T, els, joints, thru, placements, powered, plugs, wires, items, node: (term) => uf.find(term) };
}

// 板子脚的电源 / GPIO 元素（依赖固件状态）
function boardSources(cir, fw) {
  const { engine, T, uf } = cir;
  const src = [];
  const boards = [];
  const pw = new Map(cir.powered);
  // 第二轮：没插 USB 的板子，如果它的 5V/VBUS/USB 脚和一块已供电板子的 5V 脚相连、GND 也相连，就算从排针供电
  for (let pass = 0; pass < 2; pass++) {
    for (const P of engine.parts.values()) {
      const B = boardOf(P.def);
      if (!B || pw.has(P.uid)) continue;
      const pins = boardPins(P.def);
      const myIn = pins.map((p, i) => p && (p.role === "5v" || p.role === "vsys") && uf.find(T(P.uid, `p${i}`))).filter(Boolean);
      const myG = pins.map((p, i) => p && p.role === "gnd" && uf.find(T(P.uid, `p${i}`))).filter(Boolean);
      for (const [o] of pw) {
        const op = boardPins(engine.parts.get(o).def);
        const o5 = op.map((p, i) => p && p.role === "5v" && uf.find(T(o, `p${i}`))).filter(Boolean);
        const oG = op.map((p, i) => p && p.role === "gnd" && uf.find(T(o, `p${i}`))).filter(Boolean);
        if (myIn.some((n) => o5.includes(n)) && myG.some((n) => oG.includes(n))) { pw.set(P.uid, `排针 5V（来自 ${engine.parts.get(o).state.ref}）`); break; }
      }
    }
  }
  for (const P of engine.parts.values()) {
    const B = boardOf(P.def);
    if (!B) continue;
    const pins = boardPins(P.def);
    const st = fw?.[P.uid] || {};
    const on = pw.has(P.uid) && !st.off;
    boards.push({ uid: P.uid, ref: P.state.ref, B, powered: on, via: pw.get(P.uid) || null, pins });
    if (!on) continue;
    const viaUsb = pw.get(P.uid) === "USB";
    pins.forEach((p, i) => {
      if (!p) return;
      const n = T(P.uid, `p${i}`);
      if (p.role === "gnd") src.push({ n, v: 0, r: 0.01, board: P.uid, pin: i, kind: "gnd" });
      else if (p.role === "3v3") src.push({ n, v: 3.3, r: 0.1, board: P.uid, pin: i, kind: "3v3" });
      else if (p.role === "5v" && viaUsb) src.push({ n, v: 5.0, r: 0.2, board: P.uid, pin: i, kind: "5v" });
      else if (p.role === "vsys" && viaUsb) src.push({ n, v: 4.7, r: 0.3, board: P.uid, pin: i, kind: "vsys" }); // 估算：VBUS 经肖特基二极管
      else if (p.role === "gpio" && p.gpio != null) {
        const mode = st.modes?.[p.gpio];
        if (mode === "OUTPUT" || st.servoPins?.has?.(p.gpio)) src.push({ n, v: st.vals?.[p.gpio] ? B.vdd : 0, r: B.rOut, board: P.uid, pin: i, gpio: p.gpio, kind: "gpio", servo: st.servoPins?.has?.(p.gpio) });
        else if (mode === "INPUT_PULLUP") src.push({ n, v: B.vdd, r: B.rPull, board: P.uid, pin: i, gpio: p.gpio, kind: "pullup" });
      }
    });
  }
  return { src, boards };
}


// 直流求解：所有电源都是“对地的戴维南等效”（电压 + 内阻），所以只要节点导纳矩阵
export function solve(cir, fw = {}) {
  const { src, boards } = boardSources(cir, fw);
  const N = (t) => cir.uf.find(t);
  const R = cir.els.filter((e) => e.t === "R").map((e) => ({ ...e, na: N(e.a), nb: N(e.b) }));
  const D = cir.els.filter((e) => e.t === "LED").map((e) => ({ ...e, na: N(e.a), nk: N(e.k), on: false }));
  const S = src.map((s) => ({ ...s, nn: N(s.n) }));
  // 和电源相连（经过任何元件）的节点才有确定电压；其余是“悬空”
  const adj = new Map();
  const edge = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); };
  for (const r of R) edge(r.na, r.nb);
  for (const d of D) edge(d.na, d.nk);
  const fixed = new Set(S.map((s) => s.nn));
  const seen = new Set();
  const st = [...fixed];
  for (const x of st) seen.add(x);
  while (st.length) { const x = st.pop(); for (const y of adj.get(x) || []) if (!seen.has(y)) { seen.add(y); st.push(y); } }
  const nodes = [...seen];
  const idx = new Map(nodes.map((n, i) => [n, i]));
  let V = new Map();
  const run = () => {
    const n = nodes.length;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const b = new Array(n).fill(0);
    const G = (a, c, g) => { const i = idx.get(a), j = idx.get(c); if (i == null || j == null) return; A[i][i] += g; A[j][j] += g; A[i][j] -= g; A[j][i] -= g; };
    for (const r of R) G(r.na, r.nb, 1 / r.r);
    for (const d of D) {
      const g = d.on ? 1 / LED_RS : 1e-9;
      G(d.na, d.nk, g);
      if (d.on) { b[idx.get(d.na)] += g * LED_VF; b[idx.get(d.nk)] -= g * LED_VF; }
    }
    for (const s of S) { const i = idx.get(s.nn); A[i][i] += 1 / s.r; b[i] += s.v / s.r; }
    for (let i = 0; i < n; i++) A[i][i] += 1e-12;
    const x = gauss(A, b);
    V = new Map(nodes.map((nd, i) => [nd, x[i]]));
  };
  for (let it = 0; it < 24; it++) {
    run();
    let ch = false;
    for (const d of D) {
      const vd = V.get(d.na) - V.get(d.nk);
      const i = d.on ? (vd - LED_VF) / LED_RS : 0;
      if (!d.on && vd > LED_VF + 1e-4) { d.on = true; ch = true; }
      else if (d.on && i < 0) { d.on = false; ch = true; }
    }
    if (!ch) break;
  }
  const v = (term) => { const nd = N(term); return V.has(nd) ? V.get(nd) : null; };
  const leds = D.map((d) => {
    const va = V.get(d.na), vk = V.get(d.nk);
    const vd = va != null && vk != null ? va - vk : null;
    const mA = d.on && vd != null ? Math.max(0, ((vd - LED_VF) / LED_RS) * 1000) : 0;
    return { uid: d.uid, mA, vd, glow: Math.min(1, mA / LED_OVER_MA), reverse: vd != null && vd < -0.5, floating: vd == null };
  });
  const sources = S.map((s) => ({ ...s, v: s.v, vn: V.get(s.nn), mA: V.has(s.nn) ? ((s.v - V.get(s.nn)) / s.r) * 1000 : 0 }));
  return { V, v, leds, sources, boards, nodes: new Set(nodes), N, R, D, S };
}

// 万用表：DCV = 两表笔节点电压差；Ω = 只看无源元件（电阻、电位器、按键、导线）的等效电阻，LED 当断开
export function meter(cir, sol, red, black, mode) {
  if (!red || !black) return { text: "两支表笔都要碰到金属（针脚、焊盘、面包板孔）" };
  const N = cir.uf.find.bind(cir.uf);
  const a = N(red), b = N(black);
  if (mode === "V") {
    const va = sol.v(red), vb = sol.v(black);
    if (va == null || vb == null) return { text: "读数乱跳（至少一支表笔碰到的是悬空的线路）", value: null };
    return { text: `${(va - vb).toFixed(2)} V`, value: va - vb };
  }
  if (a === b) return { text: mode === "beep" ? "嘀——（导通，≈0 Ω）" : "0.0 Ω", value: 0, beep: true };
  // 无源网络：从 a 注入 1 A，b 接地（算法在 dcmath.js，维修关卡共用）
  const ohm = ohmsBetween(cir.els.filter((e) => e.t === "R").map((e) => ({ na: N(e.a), nb: N(e.b), r: e.r })), a, b);
  if (ohm === Infinity) return { text: mode === "beep" ? "不响（不通，OL）" : "OL（开路）", value: Infinity };
  const powered = sol.boards.some((b0) => b0.powered);
  const txt = fmtOhm(ohm);
  if (mode === "beep") return { text: ohm < BEEP_OHM ? `嘀——（${txt}）` : `不响（${txt}）`, value: ohm, beep: ohm < BEEP_OHM, warn: powered ? "通电时量电阻/通断，真实万用表读数会不准" : null };
  return { text: txt, value: ohm, warn: powered ? "通电时量电阻，真实万用表读数会不准（模拟里只算无源元件）" : null };
}

// ---------------- 文字描述 ----------------
export function termLabel(engine, term) {
  if (!term) return "—";
  const [uid, k] = term.split("|");
  const P = engine.parts.get(uid);
  if (!P) return term;
  const ref = P.state.ref || "";
  const kind = elemKind(P.def);
  if (k.startsWith("p")) {
    const pin = boardPins(P.def)[+k.slice(1)];
    if (pin) return `${ref} ${pin.label}${pin.gpio != null && !/^GP/.test(pin.label) ? `（GPIO${pin.gpio}）` : ""}`;
    return `${ref} 焊盘 ${+k.slice(1) + 1}`;
  }
  if (k.startsWith("n:")) return `面包板 ${k.slice(2).replace(/^L/, "左 ").replace(/^R/, "右 ").replace("rail", "电源轨 ")} 列`;
  if (k.startsWith("l")) {
    const i = +k.slice(1);
    const nm = legNames(P.def)[i];
    if (kind === "header") return `${ref} 第 ${i + 1} 针`;
    return `${ref} ${LEGZH[nm] || nm}`;
  }
  if (k.startsWith("c")) return `${ref} 杜邦触点 ${+k.slice(1) + 1}`;
  return `${ref} ${k}`;
}
// 鼠标/表笔碰到的位置 → 最近的金属端子
export function terminalAt(engine, wp, r = 0.25) {
  let best = null;
  for (const bid of engine.bodies.keys()) for (const f of engine.worldFeatures(bid)) {
    const d = Math.hypot(f.wp.x - wp.x, f.wp.z - wp.z);
    if (d > r || Math.abs(f.wp.y - wp.y) > 1.2) continue;
    let term = null;
    if (f.t === "pinhole") term = `${f.uid}|p${f.i}`;
    else if (f.t === "pin-up" || f.t === "leg") term = `${f.uid}|l${f.i}`;
    else if (f.t === "bbhole") term = `${f.uid}|n:${f.net}`;
    else if (f.t === "dupont-m" || f.t === "dupont-f") term = `${f.uid}|c${f.k || 0}`;
    if (term && (!best || d < best.d)) best = { d, term, f };
  }
  return best;
}

// ---------------- 节点成员、给固件的输入 ----------------
export function members(cir) {
  const m = new Map();
  for (const t of cir.uf.p.keys()) { const r = cir.uf.find(t); if (!m.has(r)) m.set(r, []); m.get(r).push(t); }
  return m;
}
export function boardTerm(cir, uid, pred) {
  const P = cir.engine.parts.get(uid);
  return boardPins(P.def).map((p, i) => (p && pred(p) ? cir.T(uid, `p${i}`) : null)).filter(Boolean);
}
export function firmwareInputs(cir, sol, uid) {
  const P = cir.engine.parts.get(uid);
  const B = boardOf(P.def);
  const d = {}, a = {};
  boardPins(P.def).forEach((p, i) => {
    if (!p || p.gpio == null) return;
    const v = sol.v(cir.T(uid, `p${i}`));
    d[p.gpio] = v == null ? null : v >= B.vdd * 0.5 ? 1 : 0;
    a[p.gpio] = v == null ? 0 : Math.max(0, Math.min(1, v / B.vdd));
  });
  return { d, a };
}

// 舵机：VCC−GND ≥ 4.5 V（估算）、地和板子共地、SIG 接在正在输出舵机信号的 GPIO 上才转
export function servoStates(cir, sol, fw) {
  const out = [];
  const mem = members(cir);
  for (const it of cir.items) {
    if (it.kind !== "servo") continue;
    const N = (k) => cir.uf.find(cir.T(it.uid, k));
    const vcc = sol.v(cir.T(it.uid, "VCC")), gnd = sol.v(cir.T(it.uid, "GND"));
    const sig = N("SIG");
    let drive = null;
    for (const s of sol.sources) if (s.kind === "gpio" && s.servo && cir.uf.find(s.n) === sig) drive = { board: s.board, gpio: s.gpio, angle: fw?.[s.board]?.servoAngle?.[s.gpio] ?? 90 };
    const supply = vcc != null && gnd != null ? vcc - gnd : null;
    const moving = supply != null && supply >= SERVO_MIN_V && drive && Math.abs(gnd) < 0.2;
    out.push({ uid: it.uid, ref: it.ref, supply, gndV: gnd, drive, moving: !!moving, angle: moving ? drive.angle : null, connected: [vcc, gnd].some((x) => x != null) || !!drive || ["GND", "VCC", "SIG"].some((k) => (mem.get(N(k)) || []).some((t) => !t.startsWith(it.uid + "|") && !/\|c\d$/.test(t))) });
  }
  return out;
}

// ---------------- 自检：和真实操作中最常见的错误一一对应 ----------------
export function checks(cir, sol, fw = {}) {
  const E = cir.engine;
  const out = [];
  const seenText = new Set();
  const add = (level, text, uids = [], fix = null) => { if (seenText.has(text)) return; seenText.add(text); out.push({ level, text, uids, fix }); };
  const ref = (u) => E.parts.get(u)?.state.ref || u;
  const mem = members(cir);
  const elemTerms = new Set();
  for (const e of cir.els) for (const k of ["a", "b", "k"]) if (e[k]) elemTerms.add(cir.uf.find(e[k]));
  for (const it of cir.items) if (it.kind === "servo") for (const k of ["GND", "VCC", "SIG"]) elemTerms.add(cir.uf.find(cir.T(it.uid, k)));
  for (const it of cir.items) if (it.kind === "btn") it.legs.forEach((_, i) => elemTerms.add(cir.uf.find(cir.T(it.uid, `l${i}`))));
  // 焊点
  const byBoard = new Map();
  for (const j of cir.joints) { if (!byBoard.has(j.board)) byBoard.set(j.board, []); byBoard.get(j.board).push(j); }
  for (const [b, js] of byBoard) {
    const none = js.filter((j) => j.q === "none");
    const P = E.parts.get(b);
    const pins = boardPins(P.def);
    const nm = (i) => pins[i]?.label || `焊盘 ${i + 1}`;
    if (none.length) add("warn", `${ref(b)} 有 ${none.length} 个针脚只是穿在孔里、没焊（模拟里按不导通算；真实中接触时好时坏）`, [b], "选烙铁，涂助焊剂，在每个焊盘上按住约 1 秒");
    for (const j of js.filter((j) => j.q === "cold")) add("error", `${ref(b)} ${nm(j.i)} 虚焊：焊锡没润湿焊盘，不导通`, [b], "涂助焊剂后再用烙铁补焊这个点");
    for (const j0 of P.state.solder || []) { const j = jointOf(j0); if (j.q === "bridge" && j.i != null) add("error", `${ref(b)} ${nm(j.i)} 和 ${nm(j.bridge)} 连锡：两个脚被锡短路了`, [b], "涂助焊剂后补焊把锡拉开；或 Shift + 烙铁拆焊重焊"); }
    for (const j of js.filter((j) => j.q === "burnt")) add("error", `${ref(b)} ${nm(j.i)} 焊盘烫坏（加热过久），不导通`, [b], "真实中要用飞线补救；这里可 Shift + 烙铁拆掉，再从面包板另一侧接线");
  }
  // 供电
  for (const b of sol.boards) {
    if (!b.powered) add("info", `${b.ref}（${b.B.short}）没有供电：插上 USB 线（另一头接电脑）`, [b.uid], "左侧“线缆”里选 USB 数据线，把插头拖到板子的 USB 口");
    else {
      const en = boardTerm(cir, b.uid, (p) => p.role === "en" || p.role === "rst").map((t) => cir.uf.find(t));
      const g = boardTerm(cir, b.uid, (p) => p.role === "gnd").map((t) => cir.uf.find(t));
      if (en.some((n) => g.includes(n))) add("warn", `${b.ref} 的 EN/RUN 脚接到了 GND：芯片一直处于复位/关断，程序不会运行`, [b.uid]);
    }
  }
  // 两只脚插在同一条导通列里
  for (const it of cir.items) {
    if (!["res", "led", "pot", "btn"].includes(it.kind)) continue;
    const placed = cir.placements.filter((p) => p.uid === it.uid);
    if (placed.length < 2) continue;
    const nets = placed.map((p) => cir.uf.find(p.term));
    if (it.kind === "btn") {
      const n1 = it.legs.map((n, i) => (n === "1" ? cir.uf.find(cir.T(it.uid, `l${i}`)) : null)).filter(Boolean)[0];
      const n2 = it.legs.map((n, i) => (n === "2" ? cir.uf.find(cir.T(it.uid, `l${i}`)) : null)).filter(Boolean)[0];
      if (n1 === n2) add("warn", `${it.ref} 按键两组脚被面包板接通了：没按也一直导通。转 90° 跨在中间槽上`, [it.uid]);
    } else if (new Set(nets).size === 1) add("warn", `${it.ref} 的脚全插在同一列（面包板这一列 5 个孔是连通的），等于被短接`, [it.uid], "把元件转 90° 或挪开，让两只脚在不同列");
  }
  // LED
  for (const l of sol.leds) {
    const P = E.parts.get(l.uid);
    if (l.reverse) add("warn", `${ref(l.uid)} 接反了：长脚（阳极 A）要接高电位，短脚（阴极 K、灯壳上有切边）接 GND`, [l.uid], "把 LED 转 180° 重新插");
    if (l.mA > LED_OVER_MA) add(l.mA > LED_BURN_MA ? "error" : "warn", `${ref(l.uid)} 电流 ${l.mA.toFixed(0)} mA（常见 5 mm LED 额定 20 mA），${l.mA > LED_BURN_MA ? "会烧坏" : "偏大"}——串一个限流电阻（3.3 V 下常用 220 Ω–1 kΩ）`, [l.uid]);
    if (P?.state.burnt) add("error", `${ref(l.uid)} 已烧坏（模拟里不再导通）。删掉换一个新的`, [l.uid]);
  }
  for (const it of cir.items) if (it.kind === "led" && E.parts.get(it.uid).state.burnt && !sol.leds.some((l) => l.uid === it.uid)) add("error", `${it.ref} 已烧坏（模拟里不再导通）。删掉换一个新的`, [it.uid]);
  // 电源和 GPIO 电流
  const shorted = new Set();
  for (const s of sol.sources) {
    const B = E.parts.get(s.board);
    const b = boardOf(B.def);
    if ((s.kind === "3v3" || s.kind === "5v" || s.kind === "vsys") && Math.abs(s.mA) > SHORT_A * 1000 && !shorted.has(s.board + s.kind)) {
      shorted.add(s.board + s.kind);
      add("error", `${ref(s.board)} ${s.kind.toUpperCase()} 对 GND 短路（电流远超 ${SHORT_A} A，模拟里的具体数值没有意义）：真实中稳压器过热保护或 USB 口掉电`, [s.board], "立刻拔掉 USB，查找把电源轨和地轨连在一起的导线/连锡");
    }
    if (s.kind === "gpio" && Math.abs(s.mA) > b.gpioMaxmA) add("warn", `${ref(s.board)} GPIO${s.gpio} 输出电流 ${Math.abs(s.mA).toFixed(0)} mA，超过约 ${b.gpioMaxmA} mA（估算的单脚上限），可能损坏引脚`, [s.board]);
  }
  // 舵机
  for (const s of servoStates(cir, sol, fw)) {
    if (!s.connected) { add("info", `${s.ref} 舵机线没接：舵机引线母头套到 3 针排针上（棕 GND / 红 VCC / 橙 SIG）`, [s.uid]); continue; }
    if (s.supply != null && s.supply < SERVO_MIN_V && s.supply > 0.5) add("warn", `${s.ref} 舵机供电只有 ${s.supply.toFixed(1)} V：微型舵机通常要 4.8–6 V，接 5V（USB/VBUS 脚）`, [s.uid]);
    if (s.supply == null) add("warn", `${s.ref} 舵机电源或地没接上`, [s.uid]);
    if (s.gndV != null && Math.abs(s.gndV) > 0.2) add("warn", `${s.ref} 舵机地线和板子不共地，信号没有参考电平`, [s.uid]);
    if (!s.drive) add("info", `${s.ref} 信号线（橙）没接到正在输出舵机信号的 GPIO（固件里要 attach 这个脚）`, [s.uid]);
  }
  // 固件用到的脚
  for (const b of sol.boards) {
    const st = fw[b.uid];
    if (!st?.running) continue;
    for (const [g, mode] of Object.entries(st.modes || {})) {
      const t = boardTerm(cir, b.uid, (p) => p.gpio === +g)[0];
      if (!t) { add("warn", `${b.ref} 固件用了 ${g} 号脚，这块板上没有对应的 GPIO`, [b.uid]); continue; }
      const n = cir.uf.find(t);
      const others = (mem.get(n) || []).filter((x) => x !== t);
      const used = elemTerms.has(n) || others.some((x) => /\|p\d+$/.test(x) && !x.startsWith(b.uid + "|"));
      if (!used) add("info", `${b.ref} 固件把 GPIO${g} 设成 ${mode}，但台面上这个脚没接任何元件`, [b.uid]);
      else if (mode === "INPUT" && sol.v(t) == null) add("warn", `${b.ref} GPIO${g} 设成 INPUT 但悬空：读数不稳定。用 INPUT_PULLUP 或加下拉电阻`, [b.uid]);
    }
  }
  return out;
}

// ---------------- 按接线自动生成固件 ----------------
export function detectIO(cir, uid) {
  const E = cir.engine;
  const P = E.parts.get(uid);
  const B = boardOf(P.def);
  const pins = boardPins(P.def);
  const N = (t) => cir.uf.find(t);
  const gnd = new Set(boardTerm(cir, uid, (p) => p.role === "gnd").map(N));
  const v33 = new Set(boardTerm(cir, uid, (p) => p.role === "3v3").map(N));
  const io = [];
  const R = cir.els.filter((e) => e.t === "R" && elemKind(E.parts.get(e.uid).def) === "res");
  const leds = cir.els.filter((e) => e.t === "LED");
  pins.forEach((p, i) => {
    if (!p || p.gpio == null) return;
    const n = N(cir.T(uid, `p${i}`));
    if (!cir.uf.p.has(cir.T(uid, `p${i}`))) return;
    for (const d of leds) {
      const a = N(d.a);
      const via = a === n ? null : R.find((r) => (N(r.a) === n && N(r.b) === a) || (N(r.b) === n && N(r.a) === a));
      if (a === n || via) io.push({ kind: "led", gpio: p.gpio, label: p.label, part: d.uid, via: via?.uid, desc: `${p.label} → ${via ? E.parts.get(via.uid).state.ref + " → " : ""}${E.parts.get(d.uid).state.ref} 阳极` });
    }
    for (const it of cir.items) {
      if (it.kind === "btn") {
        const g1 = N(cir.T(it.uid, `l${it.legs.indexOf("1")}`)), g2 = N(cir.T(it.uid, `l${it.legs.indexOf("2")}`));
        if ((g1 === n && gnd.has(g2)) || (g2 === n && gnd.has(g1))) io.push({ kind: "btn", gpio: p.gpio, label: p.label, part: it.uid, desc: `${p.label} ← ${it.ref}（另一端接 GND，用内部上拉）` });
      }
      if (it.kind === "pot" && B.analog(p.gpio)) {
        const w = N(cir.T(it.uid, `l${it.legs.indexOf("W")}`));
        const e1 = N(cir.T(it.uid, `l${it.legs.indexOf("1")}`)), e3 = N(cir.T(it.uid, `l${it.legs.indexOf("3")}`));
        if (w === n) io.push({ kind: "pot", gpio: p.gpio, label: p.label, part: it.uid, ok: (gnd.has(e1) && v33.has(e3)) || (gnd.has(e3) && v33.has(e1)), desc: `${p.label} ← ${it.ref} 滑片（两端 3V3 / GND）` });
      }
      if (it.kind === "servo" && N(cir.T(it.uid, "SIG")) === n) io.push({ kind: "servo", gpio: p.gpio, label: p.label, part: it.uid, desc: `${p.label} → ${it.ref} 信号线（橙）` });
    }
  });
  return { B, io };
}
export function generateSketch(cir, uid) {
  const E = cir.engine;
  const P = E.parts.get(uid);
  const { B, io } = detectIO(cir, uid);
  const first = (k) => io.find((x) => x.kind === k);
  const led = first("led"), btn = first("btn"), pot = first("pot"), sv = first("servo");
  const max = (1 << B.adcBits) - 1;
  const L = [];
  L.push(`// 由装配台按当前接线自动生成 —— 早期原型，简化仿真`);
  L.push(`// 板子：${B.label}（${P.state.ref}）  Arduino 板子包：${B.core}`);
  L.push(`// 接线：`);
  if (!io.length) L.push(`//   （还没检测到接在 GPIO 上的 LED / 按键 / 电位器 / 舵机）`);
  for (const x of io) L.push(`//   ${x.desc}`);
  if (sv) L.push(B.kind === "esp32s3" ? `#include <ESP32Servo.h>  // 真实编译需要安装 ESP32Servo 库` : `#include <Servo.h>`);
  L.push("");
  if (led) L.push(`const int LED_PIN = ${led.gpio};`);
  if (btn) L.push(`const int BTN_PIN = ${btn.gpio};`);
  if (pot) L.push(`const int POT_PIN = ${pot.gpio};`);
  if (sv) L.push(`const int SERVO_PIN = ${sv.gpio};`, `Servo servo1;`);
  if (sv && !pot) L.push(`int angle = 0;`, `int step = 10;`);
  if (led && !btn && !pot) L.push(`int ledOn = 0;`);
  L.push("", "void setup() {", "  Serial.begin(115200);");
  if (led) L.push("  pinMode(LED_PIN, OUTPUT);");
  if (btn) L.push("  pinMode(BTN_PIN, INPUT_PULLUP);");
  if (sv) L.push("  servo1.attach(SERVO_PIN);");
  L.push('  Serial.println("ready");', "}", "", "void loop() {");
  if (btn && led) L.push("  if (digitalRead(BTN_PIN) == LOW) {", "    digitalWrite(LED_PIN, HIGH);", "  } else {", "    digitalWrite(LED_PIN, LOW);", "  }");
  else if (btn) L.push("  if (digitalRead(BTN_PIN) == LOW) {", '    Serial.println("pressed");', "  }");
  if (pot) {
    L.push("  int raw = analogRead(POT_PIN);");
    if (sv) L.push(`  servo1.write(map(raw, 0, ${max}, 0, 180));`);
    if (led && !btn) L.push(`  if (raw > ${Math.round(max / 2)}) {`, "    digitalWrite(LED_PIN, HIGH);", "  } else {", "    digitalWrite(LED_PIN, LOW);", "  }");
    L.push('  Serial.print("pot=");', "  Serial.println(raw);");
  } else if (sv) L.push("  servo1.write(angle);", "  angle = angle + step;", "  if (angle >= 180 || angle <= 0) {", "    step = -step;", "  }");
  if (led && !btn && !pot) L.push("  ledOn = 1 - ledOn;", "  digitalWrite(LED_PIN, ledOn);");
  L.push(`  delay(${led && !btn && !pot && !sv ? 500 : sv && !pot ? 60 : 50});`, "}");
  return L.join("\n");
}
export function jointGrades(engine, uid) {
  const o = { good: 0, cold: 0, bridge: 0, burnt: 0 };
  for (const j0 of engine.parts.get(uid)?.state.solder || []) o[jointOf(j0).q] = (o[jointOf(j0).q] || 0) + 1;
  return o;
}
