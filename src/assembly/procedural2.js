// v20（我的补充）：参数化标准件。尺寸来自公开标准（ISO 15 轴承、ISO 7380 螺钉、ISO 53/54 齿轮、
// NEMA ICS 16 法兰、IEC 60086 电池、IEC 60127 / ISO 8820-3 保险丝、GT2 节距 2 mm、LiPo 命名规则）。
// 标准里没有的（外壳细节、长度系列、质量、额定值）一律写进 est，界面显示“估算”。
// 坐标：y 朝上、底面 y=0、xz 居中；单位 cm；dims_mm 给人看。全部 CC0（本项目自制）。
const mm = (v) => v / 10;
const box = (x0, x1, y0, y1, z0, z1) => ({ c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2] });
const cylBox = (c, r, h, ax) => (ax === "x" ? { c, h: [h / 2, r * 0.89, r * 0.89] } : ax === "z" ? { c, h: [r * 0.89, r * 0.89, h / 2] } : { c, h: [r * 0.89, h / 2, r * 0.89] });
// 方环：四块不重叠的方块（外半宽 R、内半宽 r），y0–y1
const ring = (R, r, y0, y1) => [box(-R, R, y0, y1, r, R), box(-R, R, y0, y1, -R, -r), box(r, R, y0, y1, -r, r), box(-R, -r, y0, y1, -r, r)];
const ringX = (R, r, x0, x1, cy) => [box(x0, x1, cy - R, cy + R, r, R), box(x0, x1, cy - R, cy + R, -R, -r), box(x0, x1, cy + r, cy + R, -r, r), box(x0, x1, cy - R, cy - r, -r, r)];
const dimsOf = (cols) => {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const c of cols) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c.c[k] - c.h[k]); hi[k] = Math.max(hi[k], c.c[k] + c.h[k]); }
  return { x: +((hi[0] - lo[0]) * 10).toFixed(2), y: +((hi[1] - lo[1]) * 10).toFixed(2), z: +((hi[2] - lo[2]) * 10).toFixed(2) };
};
const D = { steel: 7.85, alum: 2.7, pla: 1.24, plastic: 1.2, mixed: 1.6, liion: 2.6, alk: 3.0, brass: 8.5, nylon: 1.15, copper: 8.9 };
const mk = (o) => ({ dims_mm: o.dims_mm || dimsOf(o.colliders), proc: { type: "prims", prims: o.prims }, est: [], ...o });

// ---------- 轴承（ISO 15 深沟球轴承外形尺寸 d×D×B，mm） ----------
export const BEARINGS = {
  MR63: [3, 6, 2.5], MR85: [5, 8, 2.5], MR105: [5, 10, 4], 623: [3, 10, 4], 624: [4, 13, 5], 625: [5, 16, 5], 626: [6, 19, 6], 683: [3, 7, 3], 693: [3, 8, 4],
  605: [5, 14, 5], 607: [7, 19, 6], 608: [8, 22, 7], 609: [9, 24, 7], 688: [8, 16, 5], 6000: [10, 26, 8], 6001: [12, 28, 8], 6002: [15, 32, 9], 6003: [17, 35, 10],
  6004: [20, 42, 12], 6200: [10, 30, 9], 6201: [12, 32, 10], 6202: [15, 35, 11], 6800: [10, 19, 5], 6801: [12, 21, 5],
};
function bearing(code) {
  const [d, Do, B] = BEARINGS[code];
  const R = mm(Do) / 2, r = mm(d) / 2, h = mm(B);
  return mk({
    id: `p-bearing-${String(code).toLowerCase()}`, name_zh: `深沟球轴承 ${code}（${d}×${Do}×${B} mm）`, name: `Deep groove ball bearing ${code} ${d}x${Do}x${B}`, cat: "mech",
    prims: [{ k: "tube", c: [0, h / 2, 0], r: R, ri: R * 0.82, h, m: "steel" }, { k: "tube", c: [0, h / 2, 0], r: R * 0.82, ri: r + (R - r) * 0.18, h: h * 0.92, m: "black" }, { k: "tube", c: [0, h / 2, 0], r: r + (R - r) * 0.18, ri: r, h, m: "steel" }],
    colliders: ring(R * 0.89, r + 0.005, 0, h), dims_mm: { x: Do, y: B, z: Do }, dims_src: "ISO 15（内径 d × 外径 D × 宽 B）",
    spec: `内径 ${d} mm，外径 ${Do} mm，宽 ${B} mm`, iface: ["shaft"], density: D.steel * 0.55, est: ["质量（按钢环体积 × 0.55 估算）", "额定载荷未给出（看厂家数据手册）"],
    anchors: [{ t: "bore", d, p: [0, h, 0] }],
  });
}
// 直线轴承 LM..UU（JIS B 1520 / 常见公开尺寸：内径 × 外径 × 长度）
const LMUU = { LM6UU: [6, 12, 19], LM8UU: [8, 15, 24], LM10UU: [10, 19, 29], LM12UU: [12, 21, 30] };
function lmuu(code) {
  const [d, Do, L] = LMUU[code];
  const R = mm(Do) / 2, r = mm(d) / 2, l = mm(L);
  return mk({
    id: `p-${code.toLowerCase()}`, name_zh: `直线轴承 ${code}（Φ${d} 轴）`, name: `Linear bearing ${code}`, cat: "mech",
    prims: [{ k: "tube", c: [0, R, 0], r: R, ri: r, h: l, ax: "x", m: "steel" }],
    colliders: ringX(R * 0.89, r + 0.005, -l / 2, l / 2, R), dims_mm: { x: L, y: Do, z: Do }, dims_src: "常见公开尺寸（内径 × 外径 × 长）",
    spec: `配 Φ${d} mm 光轴，外径 ${Do} mm，长 ${L} mm`, iface: ["shaft"], density: D.steel * 0.5, est: ["质量估算", "卡簧槽未建模"],
  });
}
// 光轴（直径 × 长度，长度系列是常见售卖规格）
function shaft(d, L) {
  const r = mm(d) / 2, l = mm(L);
  return mk({ id: `p-shaft-${d}x${L}`, name_zh: `光轴 Φ${d}×${L} mm`, name: `Linear shaft ${d}x${L} mm`, cat: "mech", prims: [{ k: "cyl", c: [0, r, 0], r, h: l, ax: "x", m: "steel" }],
    colliders: [cylBox([0, r, 0], r, l, "x")], dims_mm: { x: L, y: d, z: d }, dims_src: "名义直径 × 长度", spec: `Φ${d} mm 镀铬光轴（公差看厂家，常见 g6）`, iface: ["shaft"], density: D.steel, est: ["碰撞盒用方块近似圆柱"] });
}

// ---------- 齿轮（ISO 53 基本齿廓：分度圆 = m·z，齿顶圆 = m(z+2)；齿宽、孔径为常见规格=估算） ----------
function gear(m, z) {
  const dp = m * z, da = m * (z + 2), df = m * (z - 2.5), b = Math.max(3, Math.round(m * 6)), bore = Math.min(Math.max(2, Math.round(df * 0.3)), 12);
  const Ra = mm(da) / 2, Rf = mm(df) / 2, h = mm(b), rb = mm(bore) / 2;
  return mk({
    id: `p-gear-m${m}-z${z}`, name_zh: `直齿轮 模数 ${m} × ${z} 齿（分度圆 Φ${dp}）`, name: `Spur gear m${m} z${z}`, cat: "mech",
    prims: [{ k: "tube", c: [0, h / 2, 0], r: Ra, ri: Rf, h, seg: z * 2, m: "brass" }, { k: "tube", c: [0, h / 2, 0], r: Rf, ri: rb, h, m: "brass" }],
    colliders: ring(Ra * 0.89, rb + 0.005, 0, h), dims_mm: { x: da, y: b, z: da }, dims_src: "ISO 53 齿廓公式（分度圆 m·z，齿顶圆 m(z+2)）",
    spec: `模数 ${m}，${z} 齿，分度圆 Φ${dp} mm，齿顶圆 Φ${da} mm，压力角 20°；中心距 = m(z1+z2)/2`, iface: ["gear"], density: D.brass * 0.8,
    est: [`齿宽 ${b} mm、孔径 ${bore} mm（常见规格，估算）`, "齿形用多边形示意，不做啮合仿真"], gear: { m, z },
  });
}
// GT2 同步带轮：节距 2 mm，节圆 = 2z/π，外径 = 节圆 − 0.508（GT2 节线偏移 0.254 mm）
function gt2(z, bore) {
  const pd = (2 * z) / Math.PI, od = pd - 0.508, R = mm(od) / 2, rh = mm(Math.max(od, 13)) / 2, w = mm(7), hub = mm(7), r = mm(bore) / 2, fl = mm(od + 3.5) / 2;
  return mk({
    id: `p-gt2-${z}t-${bore}mm`, name_zh: `GT2 同步带轮 ${z} 齿 孔 ${bore} mm（6 mm 带）`, name: `GT2 pulley ${z}T bore ${bore} mm`, cat: "mech",
    prims: [{ k: "tube", c: [0, hub / 2, 0], r: rh, ri: r, h: hub, m: "alum" }, { k: "tube", c: [0, hub + 0.05, 0], r: fl, ri: r, h: 0.1, m: "alum" }, { k: "tube", c: [0, hub + 0.1 + w / 2, 0], r: R, ri: r, h: w, seg: z, m: "alum" }, { k: "tube", c: [0, hub + 0.15 + w, 0], r: fl, ri: r, h: 0.1, m: "alum" }],
    colliders: [...ring(Math.max(rh, fl) * 0.89, r + 0.005, 0, hub + 0.2 + w)], dims_src: "GT2 节距 2 mm 公式（节圆 2z/π）", spec: `节圆 Φ${pd.toFixed(2)} mm，齿外径 Φ${od.toFixed(2)} mm，配 6 mm 宽 GT2 带`,
    iface: ["belt", "shaft"], density: D.alum * 0.6, est: ["轮毂直径和长度、挡边尺寸（常见规格，估算）"],
  });
}

// ---------- 铝型材（欧标 20/30/40 系列：外形尺寸为名义值，槽宽为常见值=估算） ----------
const PROFILES = { 2020: [20, 20, 6], 2040: [20, 40, 6], 2060: [20, 60, 6], 2080: [20, 80, 6], 3030: [30, 30, 8], 3060: [30, 60, 8], 4040: [40, 40, 8], 4080: [40, 80, 8] };
function extrusion(p, L) {
  const [a, b, slot] = PROFILES[p], w = mm(a), d = mm(b), l = mm(L);
  const prims = [{ k: "box", c: [0, w / 2, 0], h: [l / 2, w / 2, d / 2], m: "alum" }];
  // 槽：每 20/30/40 一条，画深色细条示意
  for (let i = 0; i < b / a; i++) {
    const z = -d / 2 + w / 2 + i * w;
    prims.push({ k: "box", c: [0, w + 0.001, z], h: [l / 2, 0.002, mm(slot) / 2], m: "grey" }, { k: "box", c: [0, -0.001 + 0.002, z], h: [l / 2, 0.002, mm(slot) / 2], m: "grey" });
  }
  return mk({
    id: `p-ext-${p}-${L}`, name_zh: `铝型材 ${p}（${a}×${b} mm）长 ${L} mm`, name: `Aluminium extrusion ${p} x ${L} mm`, cat: "mech", prims,
    colliders: [box(-l / 2, l / 2, 0, w, -d / 2, d / 2)], dims_mm: { x: L, y: a, z: b }, dims_src: "欧标型材名义截面 + 长度",
    spec: `${a}×${b} mm 截面，槽宽约 ${slot} mm（${a === 20 ? "6 号槽，配 M5/M4 T 型螺母" : "8 号槽，配 M6/M5 T 型螺母"}）`, iface: ["slot"], density: D.alum * 0.45,
    est: ["槽宽为常见值（各厂不同，估算）", "质量 = 外形体积 × 2.7 g/cm³ × 0.45 填充率（估算）"],
  });
}
function cornerBracket(p) {
  const a = mm(+String(p).slice(0, 2)), t = mm(p === 2020 ? 4 : 5);
  return mk({ id: `p-corner-${p}`, name_zh: `型材角码 ${p}`, name: `Corner bracket for ${p}`, cat: "mech",
    prims: [{ k: "box", c: [a / 2, t / 2, 0], h: [a / 2, t / 2, a / 2 * 0.9], m: "alum" }, { k: "box", c: [t / 2, a / 2 + t / 2, 0], h: [t / 2, a / 2 - t / 2, a / 2 * 0.9], m: "alum" }],
    colliders: [box(0, a, 0, t, -a * 0.45, a * 0.45), box(0, t, t, a, -a * 0.45, a * 0.45)], dims_src: "估算（各厂角码不同）", spec: `配 ${p} 型材的 L 形角码`, iface: ["slot"], density: D.alum, est: ["全部尺寸（估算）"] });
}
function tnut(size, slot) {
  const w = mm(slot === 6 ? 10 : 15), l = mm(slot === 6 ? 10 : 15), h = mm(slot === 6 ? 4 : 5.5);
  return mk({ id: `p-tnut-${slot}-${size}`, name_zh: `${slot} 号槽 T 型螺母 ${size}`, name: `T-nut slot ${slot} ${size}`, cat: "fastener", prims: [{ k: "box", c: [0, h / 2, 0], h: [l / 2, h / 2, w / 2], m: "steel" }],
    colliders: [box(-l / 2, l / 2, 0, h, -w / 2, w / 2)], dims_src: "估算（锤头 / 船形 T 螺母各厂不同）", spec: `${size} 螺纹，装进 ${slot} 号槽`, iface: ["slot"], density: D.steel, est: ["全部尺寸（估算）"] });
}
// ISO 7380 半圆头内六角螺钉：dk 头径、k 头高
const BUTTON = { M3: [5.7, 1.65], M4: [7.6, 2.2], M5: [9.5, 2.75], M6: [10.5, 3.3] };
function buttonScrew(s, L) {
  const [dk, k] = BUTTON[s], d = parseFloat(s.slice(1)), r = mm(dk) / 2, kk = mm(k), l = mm(L);
  return mk({ id: `p-button-${s}x${L}`, name_zh: `半圆头内六角螺丝 ${s}×${L}`, name: `Button head screw ${s}x${L} (ISO 7380)`, cat: "fastener",
    prims: [{ k: "cyl", c: [0, l / 2, 0], r: mm(d) / 2, h: l, seg: 12, m: "steel" }, { k: "cyl", c: [0, l + kk / 2, 0], r, r2: r * 0.75, h: kk, m: "steel" }],
    colliders: [box(-r * 0.86, r * 0.86, l, l + kk, -r * 0.86, r * 0.86), box(-mm(d) / 2 * 0.9, mm(d) / 2 * 0.9, 0, l, -mm(d) / 2 * 0.9, mm(d) / 2 * 0.9)],
    dims_mm: { x: dk, y: L + k, z: dk }, dims_src: "ISO 7380（头径 dk、头高 k）", spec: `ISO 7380 头径 ${dk} mm、头高 ${k} mm`, density: D.steel, est: ["碰撞盒按方块近似圆柱"],
    anchors: [{ t: "screw", size: s, len: l, p: [0, l, 0] }] });
}
// 热熔铜螺母（常见 M2/M2.5/M3 规格，外径和长度=估算）
function insert(s, od, L) {
  const R = mm(od) / 2, r = mm(parseFloat(s.slice(1))) / 2, h = mm(L);
  return mk({ id: `p-insert-${s}-${L}`, name_zh: `热熔铜螺母 ${s}×${L}（外径 ${od}）`, name: `Heat-set insert ${s} L${L}`, cat: "fastener", prims: [{ k: "tube", c: [0, h / 2, 0], r: R, ri: r, h, seg: 16, m: "brass" }],
    colliders: ring(R * 0.89, r + 0.005, 0, h), dims_src: "估算（各厂规格不同）", spec: `${s} 内螺纹，3D 打印件开 Φ${(od - 0.6).toFixed(1)} 左右的孔（估算）`, density: D.brass * 0.7, est: ["全部尺寸（估算）"] });
}

// ---------- 步进电机（NEMA ICS 16 法兰：方身、安装孔距、定位凸台、轴径；机身长度是常见型号系列） ----------
const NEMA = { 8: [20.3, 16, 15, 4], 11: [28.2, 23, 22, 5], 14: [35.2, 26, 22, 5], 17: [42.3, 31, 22, 5], 23: [56.4, 47.14, 38.1, 6.35], 34: [86, 69.6, 73, 14] };
function stepper(n, len) {
  const [S, hole, boss, sd] = NEMA[n], s = mm(S), H = mm(len), br = mm(boss) / 2, bh = mm(2), sr = mm(sd) / 2, sl = mm(n >= 23 ? 21 : 20);
  return mk({
    id: `p-nema${n}-${len}`, name_zh: `步进电机 NEMA ${n}（${S} mm 方，机身 ${len} mm）`, name: `Stepper NEMA ${n} x ${len} mm`, cat: "motor",
    prims: [{ k: "box", c: [0, H / 2, 0], h: [s / 2, H / 2, s / 2], m: "black" }, { k: "box", c: [0, H - 0.4, 0], h: [s / 2 + 0.001, 0.4, s / 2 + 0.001], m: "alum" }, { k: "box", c: [0, 0.4, 0], h: [s / 2 + 0.001, 0.4, s / 2 + 0.001], m: "alum" }, { k: "cyl", c: [0, H + bh / 2, 0], r: br, h: bh, m: "alum" }, { k: "cyl", c: [0, H + bh + sl / 2, 0], r: sr, h: sl, m: "steel" }],
    colliders: [box(-s / 2, s / 2, 0, H, -s / 2, s / 2), cylBox([0, H + bh / 2, 0], br, bh), cylBox([0, H + bh + sl / 2, 0], sr, sl)],
    dims_src: "NEMA ICS 16（法兰方、孔距、凸台、轴径）", spec: `法兰 ${S} mm 方，安装孔距 ${hole} mm，凸台 Φ${boss} mm，轴 Φ${sd} mm；常见 1.8°/步（200 步/圈）`,
    iface: ["4-wire", "stepper"], volt: n <= 17 ? "常见 12–24 V（经驱动）" : "常见 24–48 V（经驱动）", density: 3.2,
    est: [`机身长 ${len} mm 是常见型号系列（以具体型号为准）`, "轴长、扭矩、电流、质量（估算）"],
  });
}
// 无刷外转子电机：型号 = 定子直径 × 定子高度（mm）；外径和总高=估算
const BLDC = { 1104: [11, 4], 1404: [14, 4], 2204: [22, 4], 2207: [22, 7], 2306: [23, 6], 2212: [22, 12], 2804: [28, 4], 2814: [28, 14], 3508: [35, 8], 4114: [41, 14], 5010: [50, 10] };
function bldc(code) {
  const [sd, sh] = BLDC[code], od = sd + 5.5, H = sh + 9, R = mm(od) / 2, h = mm(H), sr = mm(sd < 20 ? 1.5 : sd < 30 ? 2.5 : 3) ;
  return mk({ id: `p-bldc-${code}`, name_zh: `无刷电机 ${code}（定子 Φ${sd}×${sh} mm）`, name: `BLDC outrunner ${code}`, cat: "motor",
    prims: [{ k: "cyl", c: [0, mm(2) / 2, 0], r: R * 0.95, h: mm(2), m: "black" }, { k: "cyl", c: [0, mm(2) + (h - mm(2)) / 2, 0], r: R, h: h - mm(2), m: "red" }, { k: "cyl", c: [0, h + mm(5), 0], r: sr, h: mm(10), m: "steel" }],
    colliders: [cylBox([0, h / 2, 0], R, h), cylBox([0, h + mm(5), 0], sr, mm(10))], dims_src: "型号命名（定子尺寸）；外径 / 高度估算",
    spec: `定子 Φ${sd} mm × ${sh} mm；需要电调（ESC）驱动，三相`, iface: ["3-phase", "esc"], volt: "看 KV 和电池节数（估算）", density: 3.0,
    est: [`外径约 Φ${od} mm、总高约 ${H} mm（估算）`, "KV、电流、质量（估算）"] });
}
// 舵机尺寸档（行业常见外形，具体型号以数据手册为准 → 全部估算）
const SERVO = { "sub-micro": ["超微型舵机（3.7 g 级）", 20, 8.5, 18], micro: ["微型舵机（9 g 级）", 23, 12.2, 29], mini: ["迷你舵机（17 g 级）", 29, 13, 30], standard: ["标准舵机（40 g 级）", 40.7, 19.7, 42.9], "standard-low": ["低矮标准舵机", 40, 20, 26], "large-1-5": ["大扭力舵机（1/5 比例）", 66, 30, 58], "coreless-25kg": ["25 kg 数字舵机", 40, 20, 40.5] };
function servoClass(k) {
  const [zh, L, W, H] = SERVO[k], l = mm(L), w = mm(W), h = mm(H), ear = mm(L * 0.18), et = mm(2);
  return mk({ id: `p-servo-${k}`, name_zh: zh, name: `Servo size class ${k}`, cat: "motor",
    prims: [{ k: "box", c: [0, h / 2, 0], h: [l / 2, h / 2, w / 2], m: "blue" }, { k: "box", c: [0, h * 0.72, 0], h: [l / 2 + ear, et / 2, w / 2], m: "blue" }, { k: "cyl", c: [l / 2 - w / 2, h + mm(2), 0], r: mm(W * 0.25), h: mm(4), m: "white" }],
    colliders: [box(-l / 2, l / 2, 0, h, -w / 2, w / 2), box(-l / 2 - ear, -l / 2, h * 0.72 - et / 2, h * 0.72 + et / 2, -w / 2, w / 2), box(l / 2, l / 2 + ear, h * 0.72 - et / 2, h * 0.72 + et / 2, -w / 2, w / 2), cylBox([l / 2 - w / 2, h + mm(2), 0], mm(W * 0.25), mm(4))],
    dims_src: "行业常见外形（估算）", spec: "3 线：棕/黑 GND、红 V+、橙/黄 PWM（50 Hz，约 0.5–2.5 ms 脉宽，估算）", iface: ["pwm"], volt: "常见 4.8–6 V（高压版 7.4–8.4 V）", density: 1.5, est: ["全部尺寸、扭矩、电流（估算）"] });
}
// 直流有刷 / 减速电机（Φ×长：常见外形，估算）
const DCM = { "180": ["180 有刷电机", 20.4, 25, 2], "280": ["280 有刷电机", 24.4, 30.5, 2], "370": ["370 有刷电机", 24.4, 30.5, 2.3], "380": ["380 有刷电机", 27.7, 38, 2.3], "385": ["385 有刷电机", 27.7, 38, 2.3], "540": ["540 有刷电机", 35.8, 50, 3.17], "775": ["775 有刷电机", 42, 66.7, 5], "25ga370": ["25GA370 减速电机", 25, 52, 4], "37gb520": ["37GB520 减速电机（带编码器）", 37, 77, 6], "jga25": ["JGA25-371 减速电机", 25, 55, 4] };
function dcMotor(k) {
  const [zh, d, L, sd] = DCM[k], r = mm(d) / 2, l = mm(L), sr = mm(sd) / 2, sl = mm(k.includes("ga") || k.includes("gb") ? 14 : 10);
  return mk({ id: `p-dc-${k}`, name_zh: zh, name: `DC motor ${k}`, cat: "motor", prims: [{ k: "cyl", c: [0, r, 0], r, h: l, ax: "x", m: k.includes("g") ? "brass" : "steel" }, { k: "cyl", c: [l / 2 + sl / 2, r, 0], r: sr, h: sl, ax: "x", m: "steel" }],
    colliders: [cylBox([0, r, 0], r, l, "x"), cylBox([l / 2 + sl / 2, r, 0], sr, sl, "x")], dims_src: "常见外形（估算）", spec: "2 线；需要 H 桥驱动（如 DRV8833 / TB6612）", iface: ["2-wire"], volt: "常见 3–12 V（估算）", density: 3.0,
    est: ["直径 / 长度 / 轴径为常见值（估算）", "转速、电流、减速比（估算）"] });
}
// TT 黄色减速电机（双轴）
function ttMotor() {
  const l = mm(70), w = mm(22.5), h = mm(37);
  return mk({ id: "p-dc-tt", name_zh: "TT 黄色减速电机（双轴 1:48）", name: "TT gear motor 1:48", cat: "motor", prims: [{ k: "box", c: [0, h / 2, 0], h: [l / 2, h / 2, w / 2], m: "yellow" }, { k: "box", c: [mm(10), mm(18), 0], h: [mm(4) / 2, mm(5.4) / 2, mm(37) / 2], m: "white" }],
    colliders: [box(-l / 2, l / 2, 0, h, -w / 2, w / 2), box(mm(8), mm(12), mm(15.3), mm(20.7), -w / 2 - mm(7.25), -w / 2), box(mm(8), mm(12), mm(15.3), mm(20.7), w / 2, w / 2 + mm(7.25))], dims_src: "常见外形（估算）", spec: "2 线；3–6 V；D 形双出轴（估算）", iface: ["2-wire"], volt: "3–6 V（估算）", density: 1.3, est: ["全部尺寸（估算）"] });
}

// ---------- 电池（IEC 60086 / 常见锂电命名：直径 × 长度） ----------
const CELLS = {
  "18650": ["18650 锂电池", 18.4, 65, "3.6–3.7 V（满电 4.2 V）", "liion"], "21700": ["21700 锂电池", 21, 70, "3.6–3.7 V（满电 4.2 V）", "liion"], "14500": ["14500 锂电池", 14, 50, "3.7 V", "liion"], "16340": ["16340 锂电池", 16, 34, "3.7 V", "liion"], "26650": ["26650 锂电池", 26, 65, "3.2–3.7 V", "liion"],
  AA: ["AA 碱性电池（5 号，LR6）", 14.5, 50.5, "1.5 V", "alk"], AAA: ["AAA 碱性电池（7 号，LR03）", 10.5, 44.5, "1.5 V", "alk"], C: ["C 碱性电池（2 号，LR14）", 26.2, 50, "1.5 V", "alk"], D: ["D 碱性电池（1 号，LR20）", 34.2, 61.5, "1.5 V", "alk"], CR123A: ["CR123A 锂电池", 17, 34.5, "3 V", "alk"],
};
function cell(k) {
  const [zh, d, L, v, mat] = CELLS[k], r = mm(d) / 2, l = mm(L);
  return mk({ id: `p-cell-${k.toLowerCase()}`, name_zh: `${zh} Φ${d}×${L}`, name: `Cell ${k}`, cat: "power", prims: [{ k: "cyl", c: [0, r, 0], r, h: l, ax: "x", m: mat === "liion" ? "blue" : "black" }, { k: "cyl", c: [l / 2 + mm(0.5), r, 0], r: r * 0.35, h: mm(1), ax: "x", m: "steel" }],
    colliders: [cylBox([0, r, 0], r, l + mm(1), "x")], dims_mm: { x: L, y: d, z: d }, dims_src: mat === "alk" ? "IEC 60086 最大外形" : "锂电命名规则（直径 × 长度，带保护板会更长）", spec: `标称 ${v}`, volt: v, iface: ["battery"], density: D[mat],
    est: ["容量、内阻、质量（估算）"] });
}
const COINS = { CR2032: [20, 3.2], CR2025: [20, 2.5], CR2016: [20, 1.6], CR1220: [12.5, 2.0], CR1632: [16, 3.2], CR2450: [24.5, 5.0], LR44: [11.6, 5.4] };
function coin(k) {
  const [d, t] = COINS[k], r = mm(d) / 2, h = mm(t);
  return mk({ id: `p-coin-${k.toLowerCase()}`, name_zh: `纽扣电池 ${k}（Φ${d}×${t}）`, name: `Coin cell ${k}`, cat: "power", prims: [{ k: "cyl", c: [0, h / 2, 0], r, h, m: "steel" }],
    colliders: [cylBox([0, h / 2, 0], r, h)], dims_mm: { x: d, y: t, z: d }, dims_src: "IEC 60086 型号命名（直径 × 厚度）", spec: k === "LR44" ? "1.5 V 碱性" : "3 V 锂锰", volt: k === "LR44" ? "1.5 V" : "3 V", iface: ["battery"], density: D.alk, est: ["容量、质量（估算）"] });
}
function battery9v() {
  const l = mm(48.5), w = mm(26.5), d = mm(17.5);
  return mk({ id: "p-cell-9v", name_zh: "9 V 方块电池（6LR61）", name: "9V battery 6LR61", cat: "power", prims: [{ k: "box", c: [0, l / 2, 0], h: [w / 2, l / 2, d / 2], m: "black" }, { k: "cyl", c: [-mm(6.35), l + mm(1.5), 0], r: mm(3), h: mm(3), seg: 6, m: "steel" }, { k: "cyl", c: [mm(6.35), l + mm(1.5), 0], r: mm(2.8), h: mm(3), m: "steel" }],
    colliders: [box(-w / 2, w / 2, 0, l, -d / 2, d / 2), box(-mm(9.35), mm(9.35), l, l + mm(3), -mm(3), mm(3))], dims_src: "IEC 60086（6LR61 外形）", spec: "9 V 碱性，扣式端子间距 12.7 mm", volt: "9 V", iface: ["battery"], density: D.alk, est: ["质量估算"] });
}
// 软包 LiPo：型号 TTWWLL = 厚 T/10 mm × 宽 WW × 长 LL；容量取常见标称（估算）
const LIPO = { "401230": 100, "402030": 200, "502030": 250, "502535": 400, "503035": 500, "603040": 600, "503450": 1000, "603450": 1200, "523450": 1000, "704050": 1800, "803860": 2000, "804050": 2000, "105060": 3500, "906090": 6000, "102050": 1000 };
function lipo(code) {
  const T = +code.slice(0, 2) / 10, W = +code.slice(2, 4), L = +code.slice(4, 6), t = mm(T), w = mm(W), l = mm(L);
  return mk({ id: `p-lipo-${code}`, name_zh: `软包锂电池 ${code}（${T}×${W}×${L} mm，约 ${LIPO[code]} mAh）`, name: `LiPo pouch ${code}`, cat: "power",
    prims: [{ k: "box", c: [0, t / 2, 0], h: [l / 2, t / 2, w / 2], m: "alum" }, { k: "box", c: [l / 2 + mm(4), t / 2, 0], h: [mm(4), t / 2 * 0.8, w / 2 * 0.6], m: "yellow" }],
    colliders: [box(-l / 2, l / 2 + mm(8), 0, t, -w / 2, w / 2)], dims_mm: { x: L + 8, y: T, z: W }, dims_src: "型号命名规则（厚×宽×长）+ 8 mm 保护板（估算）",
    spec: "单节 3.7 V 标称（满电 4.2 V），通常带保护板和 JST-PH 2.0 插头（估算）", volt: "3.7 V", iface: ["battery", "jst"], density: 2.0, est: [`容量约 ${LIPO[code]} mAh（常见标称，估算）`, "保护板尺寸、引线（估算）"] });
}

// ---------- 保险丝 ----------
const BLADE_COLOR = { 5: "brown", 10: "red", 15: "blue", 20: "yellow", 30: "green" }; // ISO 8820-3 颜色约定（5 A 实际为棕褐色）
const BLADE = { mini: ["迷你插片保险丝（ATM）", 10.9, 3.6, 16.3], ato: ["标准插片保险丝（ATO/ATC）", 19.1, 5.1, 18.5] };
function blade(k, A) {
  const [zh, W, T, H] = BLADE[k], w = mm(W), t = mm(T), h = mm(H);
  return mk({ id: `p-fuse-${k}-${A}a`, name_zh: `${zh} ${A} A`, name: `Blade fuse ${k.toUpperCase()} ${A}A`, cat: "passive", prims: [{ k: "box", c: [0, h * 0.7, 0], h: [w / 2, h * 0.3, t / 2], m: BLADE_COLOR[A] }, { k: "box", c: [-w / 4, h * 0.2, 0], h: [w * 0.12, h * 0.2, t * 0.15], m: "steel" }, { k: "box", c: [w / 4, h * 0.2, 0], h: [w * 0.12, h * 0.2, t * 0.15], m: "steel" }],
    colliders: [box(-w / 2, w / 2, h * 0.4, h, -t / 2, t / 2), box(-w / 4 - w * 0.12, -w / 4 + w * 0.12, 0, h * 0.4, -t * 0.15, t * 0.15), box(w / 4 - w * 0.12, w / 4 + w * 0.12, 0, h * 0.4, -t * 0.15, t * 0.15)],
    dims_src: "ISO 8820-3 外形（常见公开尺寸，估算）", spec: `额定 ${A} A，32 V DC（汽车插片保险丝常见额定电压，估算）`, rating: `${A} A`, volt: "≤32 V DC（估算）", iface: ["fuse"], density: 1.5, est: ["外形尺寸为公开常见值（估算）"] });
}
function glassFuse(A, big) {
  const d = big ? 6.3 : 5, L = big ? 32 : 20, r = mm(d) / 2, l = mm(L);
  return mk({ id: `p-fuse-${big ? "6x32" : "5x20"}-${String(A).replace(".", "p")}a`, name_zh: `玻璃管保险丝 ${big ? "6.3×32" : "5×20"} mm ${A} A`, name: `Glass fuse ${big ? "6.3x32" : "5x20"} ${A}A`, cat: "passive",
    prims: [{ k: "cyl", c: [0, r, 0], r: r * 0.95, h: l * 0.7, ax: "x", m: "acrylic" }, { k: "cyl", c: [-l * 0.425, r, 0], r, h: l * 0.15, ax: "x", m: "steel" }, { k: "cyl", c: [l * 0.425, r, 0], r, h: l * 0.15, ax: "x", m: "steel" }],
    colliders: [cylBox([0, r, 0], r, l, "x")], dims_mm: { x: L, y: d, z: d }, dims_src: big ? "3AG 外形（6.3×32 mm）" : "IEC 60127 外形（5×20 mm）", spec: `额定 ${A} A（快熔 / 慢熔看标记）`, rating: `${A} A`, volt: "250 V AC（常见标记，估算）", iface: ["fuse"], density: 2.0, est: ["额定电压、分断能力看具体型号（估算）"] });
}
// ---------- 线束插头（外壳尺寸=估算；节距是标准） ----------
function dupontHousing(rows, n) {
  const p = mm(2.54), w = p * n, d = p * rows, h = mm(14);
  return mk({ id: `p-dupont-housing-${rows}x${n}`, name_zh: `杜邦线外壳 ${rows}×${n}P（2.54 mm）`, name: `Dupont housing ${rows}x${n} 2.54 mm`, cat: "connector", prims: [{ k: "box", c: [0, h / 2, 0], h: [w / 2, h / 2, d / 2], m: "black" }],
    colliders: [box(-w / 2, w / 2, 0, h, -d / 2, d / 2)], dims_mm: { x: +(2.54 * n).toFixed(2), y: 14, z: +(2.54 * rows).toFixed(2) }, dims_src: "节距 2.54 mm（标准）；长度 14 mm（估算）", spec: `${rows * n} 针，2.54 mm 节距`, pitch_mm: 2.54, pins: rows * n, iface: ["header"], density: 1.4, est: ["外壳长度（估算）", "额定电流各厂不同（常见约 1–3 A，估算）"] });
}
const JSTP = { XH: [2.5, 5.0, 9.8, 4.9], PH: [2.0, 3.9, 6.0, 4.5], SH: [1.0, 3.0, 4.25, 2.9], ZH: [1.5, 3.0, 6.0, 3.5] };
function jstPlug(s, n) {
  const [P, extra, H, T] = JSTP[s], w = mm(P * (n - 1) + extra), h = mm(H), t = mm(T);
  return mk({ id: `p-jst-${s.toLowerCase()}-plug-${n}p`, name_zh: `JST-${s} ${n}P 线端插头`, name: `JST ${s} ${n}-pin housing`, cat: "connector", prims: [{ k: "box", c: [0, h / 2, 0], h: [w / 2, h / 2, t / 2], m: "white" }],
    colliders: [box(-w / 2, w / 2, 0, h, -t / 2, t / 2)], dims_src: `节距 ${P} mm（JST 标准）；外壳宽 = 节距×(n−1)+${extra}（估算）`, spec: `${n} 针，${P} mm 节距`, pitch_mm: P, pins: n, iface: ["jst"], density: 1.4, est: ["外壳尺寸（估算）"] });
}
const XT = { XT30: [10.2, 5.2, 15, "15 A（AMASS 公开规格，估算）"], XT60: [15.8, 8.1, 16, "30 A（AMASS 公开规格，估算）"], XT90: [21, 10.5, 21, "45 A（AMASS 公开规格，估算）"] };
function xt(k, male) {
  const [W, T, H, A] = XT[k], w = mm(W), t = mm(T), h = mm(H);
  return mk({ id: `p-${k.toLowerCase()}-${male ? "m" : "f"}`, name_zh: `${k} 电源插头（${male ? "公" : "母"}，线端）`, name: `${k} connector ${male ? "male" : "female"}`, cat: "connector", prims: [{ k: "box", c: [0, h / 2, 0], h: [w / 2, h / 2, t / 2], m: "yellow" }],
    colliders: [box(-w / 2, w / 2, 0, h, -t / 2, t / 2)], dims_src: "估算（外形按常见公开图纸取整）", spec: `2 针电源插头，持续电流约 ${A}`, rating: A, iface: ["power"], density: 2.5, est: ["外形尺寸、额定电流（估算）"] });
}
// ---------- 3D 打印结构件（我的补充，尺寸是设计值，不是估算） ----------
function printedPlate(W, L, t = 3) {
  const w = mm(W), l = mm(L), h = mm(t);
  return mk({ id: `p-print-plate-${W}x${L}x${t}`, name_zh: `3D 打印底板 ${W}×${L}×${t} mm（M3 孔网格 10 mm）`, name: `Printed plate ${W}x${L}x${t}`, cat: "enclosure", prims: [{ k: "box", c: [0, h / 2, 0], h: [l / 2, h / 2, w / 2], m: "orange" }],
    colliders: [box(-l / 2, l / 2, 0, h, -w / 2, w / 2)], dims_src: "设计值（我的补充）", spec: `PLA，Φ3.4 mm 过孔，孔距 10 mm`, iface: ["m3-grid"], density: D.pla * 0.6, est: ["质量按 60% 填充估算"] });
}
function printedL(a, t = 3, w = 15) {
  const A = mm(a), T = mm(t), W = mm(w);
  return mk({ id: `p-print-l-${a}x${w}`, name_zh: `3D 打印 L 形支架 ${a}×${a}×${w} mm`, name: `Printed L bracket ${a}x${a}x${w}`, cat: "enclosure", prims: [{ k: "box", c: [A / 2, T / 2, 0], h: [A / 2, T / 2, W / 2], m: "orange" }, { k: "box", c: [T / 2, A / 2 + T / 2, 0], h: [T / 2, A / 2 - T / 2, W / 2], m: "orange" }],
    colliders: [box(0, A, 0, T, -W / 2, W / 2), box(0, T, T, A, -W / 2, W / 2)], dims_src: "设计值（我的补充）", spec: "PLA，每边一个 Φ3.4 mm 过孔", iface: ["m3-grid"], density: D.pla * 0.6, est: ["质量按 60% 填充估算"] });
}
function printedSpacer(od, id, L) {
  const R = mm(od) / 2, r = mm(id) / 2, h = mm(L);
  return mk({ id: `p-print-spacer-${od}-${id}-${L}`, name_zh: `3D 打印垫套 Φ${od}/Φ${id}×${L} mm`, name: `Printed spacer ${od}/${id}x${L}`, cat: "enclosure", prims: [{ k: "tube", c: [0, h / 2, 0], r: R, ri: r, h, m: "orange" }],
    colliders: ring(R * 0.89, r + 0.005, 0, h), dims_src: "设计值（我的补充）", spec: "PLA", density: D.pla, est: [] });
}
function printedBox(W, L, H) {
  const w = mm(W), l = mm(L), h = mm(H), t = mm(2);
  return mk({ id: `p-print-box-${W}x${L}x${H}`, name_zh: `3D 打印开口盒 ${W}×${L}×${H} mm（壁厚 2）`, name: `Printed open box ${W}x${L}x${H}`, cat: "enclosure",
    prims: [{ k: "box", c: [0, t / 2, 0], h: [l / 2, t / 2, w / 2], m: "white" }, { k: "box", c: [0, h / 2, w / 2 - t / 2], h: [l / 2, h / 2, t / 2], m: "white" }, { k: "box", c: [0, h / 2, -w / 2 + t / 2], h: [l / 2, h / 2, t / 2], m: "white" }, { k: "box", c: [l / 2 - t / 2, h / 2, 0], h: [t / 2, h / 2, w / 2 - t], m: "white" }, { k: "box", c: [-l / 2 + t / 2, h / 2, 0], h: [t / 2, h / 2, w / 2 - t], m: "white" }],
    colliders: [box(-l / 2, l / 2, 0, t, -w / 2, w / 2), box(-l / 2, l / 2, t, h, w / 2 - t, w / 2), box(-l / 2, l / 2, t, h, -w / 2, -w / 2 + t), box(l / 2 - t, l / 2, t, h, -w / 2 + t, w / 2 - t), box(-l / 2, -l / 2 + t, t, h, -w / 2 + t, w / 2 - t)],
    dims_src: "设计值（我的补充）", spec: "PLA，内腔可放模块（碰撞盒是空心的）", density: D.pla, est: [] });
}

export const STD_PROCEDURAL = [
  ...Object.keys(BEARINGS).map(bearing), ...Object.keys(LMUU).map(lmuu),
  ...[3, 4, 5, 6, 8, 10].flatMap((d) => [100, 200, 300].map((L) => shaft(d, L))),
  ...[0.5, 1].flatMap((m) => [10, 12, 15, 16, 20, 24, 25, 30, 32, 36, 40, 48, 50, 60].map((z) => gear(m, z))),
  ...[1.5, 2].flatMap((m) => [12, 15, 20, 25, 30, 40].map((z) => gear(m, z))),
  ...[[16, 5], [20, 5], [20, 8], [30, 5], [36, 5], [40, 5], [40, 8], [60, 5], [60, 8], [80, 8]].map(([z, b]) => gt2(z, b)),
  ...Object.keys(PROFILES).flatMap((p) => [50, 100, 150, 200, 250, 300, 400, 500, 600, 1000].map((L) => extrusion(+p, L))),
  ...[2020, 2040, 3030, 4040].map(cornerBracket), ...["M4", "M5"].map((s) => tnut(s, 6)), ...["M5", "M6"].map((s) => tnut(s, 8)),
  ...Object.keys(BUTTON).flatMap((s) => [6, 8, 10, 12, 16, 20].map((L) => buttonScrew(s, L))),
  insert("M2", 3.5, 3), insert("M2.5", 4, 4), insert("M3", 4.5, 4), insert("M3", 5, 5.7), insert("M4", 6, 6), insert("M5", 7, 7),
  stepper(8, 30), stepper(11, 32), stepper(11, 51), stepper(14, 28), stepper(14, 34), stepper(17, 20), stepper(17, 23), stepper(17, 60), stepper(23, 41), stepper(23, 56), stepper(23, 76), stepper(23, 112), stepper(34, 66), stepper(34, 98),
  ...Object.keys(BLDC).map(bldc), ...Object.keys(SERVO).map(servoClass), ...Object.keys(DCM).map(dcMotor), ttMotor(),
  ...Object.keys(CELLS).map(cell), ...Object.keys(COINS).map(coin), battery9v(), ...Object.keys(LIPO).map(lipo),
  ...["mini", "ato"].flatMap((k) => [5, 10, 15, 20, 30].map((A) => blade(k, A))), ...[0.5, 1, 2, 3, 5, 10].map((A) => glassFuse(A, false)), ...[1, 5, 10, 15].map((A) => glassFuse(A, true)),
  ...[1, 2, 3, 4, 5, 6, 8, 10].map((n) => dupontHousing(1, n)), ...[2, 3, 4, 5, 10, 20].map((n) => dupontHousing(2, n)),
  ...["XH", "PH", "SH", "ZH"].flatMap((s) => [2, 3, 4, 5, 6].map((n) => jstPlug(s, n))), ...["XT30", "XT60", "XT90"].flatMap((k) => [xt(k, true), xt(k, false)]),
  ...[[40, 60], [60, 80], [80, 120], [100, 100], [120, 180]].map(([w, l]) => printedPlate(w, l)), ...[15, 20, 30, 40].map((a) => printedL(a)),
  ...[[7, 3.4, 5], [7, 3.4, 10], [7, 3.4, 15], [10, 5.4, 10], [12, 8.2, 5]].map(([a, b, c]) => printedSpacer(a, b, c)), ...[[40, 60, 25], [60, 90, 30], [80, 120, 40]].map(([a, b, c]) => printedBox(a, b, c)),
];
