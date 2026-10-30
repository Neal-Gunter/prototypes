// 程序生成的零件：紧固件、底板、支架、面包板、插头、线缆、工具。
// 尺寸能查到标准的按标准（ISO 7045 盘头螺钉、ISO 4032 六角螺母、ISO 261 粗牙螺距、ISO 273 过孔、
// USB Type‑C / Micro‑B 插头舌片、2.54 mm 排距）；查不到的统一标“估算”，写进 est 字段。
// 坐标：零件自身坐标系，y 朝上、底面 y = 0、xz 居中；单位 cm（与场景一致）；dims_mm 用 mm 给人看。

export const LIC_SELF = "本项目自制（程序生成，CC0）";

// ISO 7045 盘头十字螺钉：dk 头径、k 头高；ISO 261 粗牙螺距；ISO 273 中等过孔
export const THREAD = {
  M2: { d: 2, pitch: 0.4, dk: 4.0, k: 1.6, nutS: 4.0, nutM: 1.6, clear: 2.4 },
  "M2.5": { d: 2.5, pitch: 0.45, dk: 5.0, k: 2.1, nutS: 5.0, nutM: 2.0, clear: 2.9 },
  M3: { d: 3, pitch: 0.5, dk: 5.6, k: 2.4, nutS: 5.5, nutM: 2.4, clear: 3.4 },
  // 舵机附带的自攻螺丝：规格没查到可靠来源，全部估算
  "ST1.5": { d: 1.5, pitch: 0.5, dk: 3.2, k: 1.2, clear: 1.7, est: true },
};

// ISO 4762 内六角圆柱头螺钉：dk 头径、k 头高、s 内六角对边（= ISO 2936 扳手规格）
export const CAP = { M2: { dk: 3.8, k: 2, s: 1.5 }, "M2.5": { dk: 4.5, k: 2.5, s: 2 }, M3: { dk: 5.5, k: 3, s: 2.5 } };
// ISO 7089 平垫圈（标准系列）：d1 内径、d2 外径、h 厚
export const WASHER = { M2: { d1: 2.2, d2: 5, h: 0.3 }, "M2.5": { d1: 2.7, d2: 6, h: 0.5 }, M3: { d1: 3.2, d2: 7, h: 0.5 } };

// 材料密度（g/cm³，常见手册值）：用来从碰撞盒体积估算质量
export const DENSITY = { steel: 7.85, brass: 8.5, pcb: 1.85, acrylic: 1.19, pla: 1.24, abs: 1.05, plastic: 1.2, copper: 8.9, mixed: 1.6 };

const box = (x0, x1, y0, y1, z0, z1) => ({ c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2] });
const mm = (v) => v / 10;
const dimsOf = (cols) => {
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const c of cols) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c.c[k] - c.h[k]); hi[k] = Math.max(hi[k], c.c[k] + c.h[k]); }
  return { x: +((hi[0] - lo[0]) * 10).toFixed(2), y: +((hi[1] - lo[1]) * 10).toFixed(2), z: +((hi[2] - lo[2]) * 10).toFixed(2) };
};

function screw(size, len) {
  const T = THREAD[size];
  const r = mm(T.dk) / 2, k = mm(T.k), L = mm(len), d = mm(T.d);
  // 碰撞盒：头部一个方块（内切圆柱用方块近似，见“简化”）、杆一个细方块
  const cols = [box(-r * 0.86, r * 0.86, L, L + k, -r * 0.86, r * 0.86), box(-d / 2 * 0.9, d / 2 * 0.9, 0, L, -d / 2 * 0.9, d / 2 * 0.9)];
  return {
    id: `p-screw-${size}x${len}`,
    name_zh: T.est ? `舵机自攻螺丝 Ø1.5×${len}` : `盘头十字螺丝 ${size}×${len}`,
    name: T.est ? `Servo self-tapping screw ${len} mm` : `Pan head screw ${size}×${len} (ISO 7045)`,
    cat: "fastener",
    proc: { type: "screw", size, len, dk: T.dk, k: T.k },
    colliders: cols,
    dims_mm: { x: T.dk, y: len + T.k, z: T.dk },
    dims_src: T.est ? "估算（舵机附带件，没查到标准）" : "ISO 7045（头径 dk、头高 k）",
    spec: T.est ? "估算" : `ISO 7045 头径 ${T.dk} mm、头高 ${T.k} mm；ISO 261 螺距 ${T.pitch} mm`,
    density: DENSITY.steel,
    anchors: [{ t: "screw", size, len: L, p: [0, L, 0] }],
    est: T.est ? ["全部尺寸"] : ["碰撞盒按方块近似圆柱"],
  };
}
function capScrew(size, len) {
  const T = THREAD[size], C = CAP[size];
  const r = mm(C.dk) / 2, k = mm(C.k), L = mm(len), d = mm(T.d);
  return {
    id: `p-capscrew-${size}x${len}`,
    name_zh: `内六角圆柱头螺丝 ${size}×${len}`,
    name: `Socket head cap screw ${size}×${len} (ISO 4762)`,
    cat: "fastener",
    proc: { type: "screw", head: "cap", size, len, dk: C.dk, k: C.k, s: C.s },
    colliders: [box(-r * 0.86, r * 0.86, L, L + k, -r * 0.86, r * 0.86), box(-d / 2 * 0.9, d / 2 * 0.9, 0, L, -d / 2 * 0.9, d / 2 * 0.9)],
    dims_mm: { x: C.dk, y: len + C.k, z: C.dk },
    dims_src: "ISO 4762（头径 dk、头高 k、内六角 s）",
    spec: `ISO 4762 头径 ${C.dk} mm、头高 ${C.k} mm、内六角 ${C.s} mm（用 ${C.s} mm 内六角扳手，ISO 2936）；ISO 261 螺距 ${T.pitch} mm`,
    density: DENSITY.steel,
    anchors: [{ t: "screw", size, len: L, p: [0, L, 0] }],
    est: ["碰撞盒按方块近似圆柱"],
  };
}
function washer(size) {
  const W = WASHER[size];
  const R = mm(W.d2) / 2, r = mm(W.d1) / 2, h = mm(W.h);
  return {
    id: `p-washer-${size}`,
    name_zh: `平垫圈 ${size}`,
    name: `Plain washer ${size} (ISO 7089)`,
    cat: "fastener",
    proc: { type: "washer", size, d1: W.d1, d2: W.d2, h: W.h },
    colliders: ringBoxes(R * 0.89, r + 0.005, 0, h),
    dims_mm: { x: W.d2, y: W.h, z: W.d2 },
    dims_src: "ISO 7089（内径 d1、外径 d2、厚 h）",
    spec: `ISO 7089 内径 ${W.d1} mm、外径 ${W.d2} mm、厚 ${W.h} mm`,
    density: DENSITY.steel,
    anchors: [],
    est: ["碰撞盒按方环近似圆环", "拧螺丝时不计入夹紧厚度（简化）"],
  };
}
function nut(size) {
  const T = THREAD[size];
  const s = mm(T.nutS), m = mm(T.nutM);
  return {
    id: `p-nut-${size}`,
    name_zh: `六角螺母 ${size}`,
    name: `Hex nut ${size} (ISO 4032)`,
    cat: "fastener",
    proc: { type: "nut", size, s: T.nutS, m: T.nutM, d: T.d },
    // 中间留孔：四块方块围成一圈，保证能套在螺柱上而碰撞盒不重叠
    colliders: ringBoxes(s / 2, mm(T.d) / 2 + 0.005, 0, m),
    dims_mm: { x: +(T.nutS / Math.cos(Math.PI / 6)).toFixed(2), y: T.nutM, z: T.nutS },
    dims_src: "ISO 4032（对边 s、厚 m）",
    spec: `ISO 4032 对边 ${T.nutS} mm、厚 ${T.nutM} mm`,
    density: DENSITY.steel,
    anchors: [{ t: "nut", size, p: [0, 0, 0], m }],
    est: [],
  };
}
// 四个方块围成方环（外半宽 R、内半宽 r）
function ringBoxes(R, r, y0, y1) {
  return [box(-R, R, y0, y1, r, R), box(-R, R, y0, y1, -R, -r), box(r, R, y0, y1, -r, r), box(-R, -r, y0, y1, -r, r)];
}
const STANDOFF_HEX = { M2: 4.0, "M2.5": 5.0, M3: 5.0 }; // 估算：常见铜柱对边
function standoff(size, len, stud) {
  const T = THREAD[size];
  const s = mm(STANDOFF_HEX[size]), L = mm(len), S = mm(stud), d = mm(T.d);
  // 公头朝下：螺柱 y ∈ [0, S]，六角柱 y ∈ [S, S+L]；顶面是母螺纹
  return {
    id: `p-standoff-${size}x${len}`,
    name_zh: `铜柱 ${size}×${len}+${stud}（公‑母）`,
    name: `Brass standoff ${size}×${len}+${stud} M‑F`,
    cat: "fastener",
    proc: { type: "standoff", size, len, stud, s: STANDOFF_HEX[size], d: T.d },
    colliders: [box(-s / 2, s / 2, S, S + L, -s / 2, s / 2), box(-d / 2 * 0.9, d / 2 * 0.9, 0, S, -d / 2 * 0.9, d / 2 * 0.9)],
    dims_mm: { x: STANDOFF_HEX[size], y: len + stud, z: STANDOFF_HEX[size] },
    dims_src: `长度按常见规格 ${len}+${stud} mm；对边 ${STANDOFF_HEX[size]} mm 为估算`,
    spec: `${size} 公头 ${stud} mm、母螺纹深度按 ${Math.min(len, 6)} mm 估算`,
    density: DENSITY.brass,
    anchors: [
      { t: "thread-m", size, p: [0, 0, 0], len: S },
      { t: "thread-f", size, p: [0, S + L, 0], depth: mm(Math.min(len, 6)) },
    ],
    est: ["六角对边", "母螺纹深度"],
  };
}

// ---------- 底板（我们自己的设计：3 mm 亚克力，孔已攻丝；装支架处压铆了两根 M3 螺柱） ----------
// foot：四角的橡胶脚垫高度（估算）。螺纹孔是通孔，铜柱公头/螺丝尖可以从底板下面伸出来，脚垫给它们留空间
export const PLATE_MM = { w: 180, d: 120, t: 3, foot: 6 };
export const PLATE_LAYOUT = {
  // Feather ESP32-S3 的 4 个安装孔：取自 Adafruit 官方 CAD 模型（不是完全对称的矩形）
  feather: { c: [-45, -25], pts: [[-22.49, -8.89], [-22.49, 8.89], [23.23, 9.59], [23.23, -9.52]], size: "M2.5" },
  pico: { c: [-45, 30], dx: 47.0, dz: 11.4, size: "M2" }, // Pico 安装孔间距（树莓派数据手册），长边沿 x
  studs: { c: [45, -25], dx: 30, size: "M3", len: 8 },
  bb: { c: [42, 28], w: 85, d: 55 },
};
function plate() {
  const { w, d, t: th, foot } = PLATE_MM;
  const t = th + foot; // 板面高度（mm）
  const depth = mm(th + foot - 0.5); // 通孔：最多伸到脚垫高度以下 0.5 mm
  const anchors = [];
  const L = PLATE_LAYOUT;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    anchors.push({ t: "thread-f", size: L.pico.size, p: [mm(L.pico.c[0] + (sx * L.pico.dx) / 2), mm(t), mm(L.pico.c[1] + (sz * L.pico.dz) / 2)], depth, through: true });
  }
  for (const [x, z] of L.feather.pts) anchors.push({ t: "thread-f", size: L.feather.size, p: [mm(L.feather.c[0] + x), mm(t), mm(L.feather.c[1] + z)], depth, through: true });
  const studCols = [];
  for (const sx of [-1, 1]) {
    const x = mm(L.studs.c[0] + (sx * L.studs.dx) / 2), z = mm(L.studs.c[1]);
    anchors.push({ t: "stud-up", size: "M3", p: [x, mm(t), z], len: mm(L.studs.len) });
    const r = 0.135;
    studCols.push(box(x - r, x + r, mm(t), mm(t + L.studs.len), z - r, z + r));
  }
  anchors.push({ t: "bb-area", p: [mm(L.bb.c[0]), mm(t), mm(L.bb.c[1])], w: mm(L.bb.w), d: mm(L.bb.d) });
  return {
    id: "p-baseplate",
    name_zh: "底板 180×120（3 mm 亚克力 + 脚垫，自制）",
    name: "Base plate 180×120×3 acrylic (our design)",
    cat: "enclosure",
    proc: { type: "plate", w, d, t: th, foot },
    colliders: [
      box(-mm(w) / 2, mm(w) / 2, mm(foot), mm(t), -mm(d) / 2, mm(d) / 2),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box(sx * mm(w / 2 - 12) - 0.5, sx * mm(w / 2 - 12) + 0.5, 0, mm(foot), sz * mm(d / 2 - 12) - 0.5, sz * mm(d / 2 - 12) + 0.5)),
      ...studCols,
    ],
    dims_mm: { x: w, y: t, z: d },
    dims_src: "本项目设计尺寸",
    spec: "3 mm 亚克力 + 四角 6 mm 脚垫（估算）。孔位：Feather ESP32‑S3 的 4 个 M2.5 攻丝通孔（按官方 CAD）、Pico 47.0×11.4 的 4 个 M2 攻丝通孔、两根 M3×8 压铆螺柱、面包板贴胶区",
    density: DENSITY.acrylic,
    anchors,
    est: [],
    noDragHint: "底板很大：拖它会带着上面装好的东西一起走",
  };
}

// ---------- 舵机支架（自制 3D 打印件，按 Adafruit 1143 舵机 CAD 实测尺寸设计） ----------
export const BRACKET = { base: [40, 34, 3], pillarZ: [11.6, 15.65], tabSeat: 3 + 18.8, holeZ: 14.7 };
function bracket() {
  const [bx, bz, bt] = BRACKET.base;
  const [zi, zo] = BRACKET.pillarZ;
  const top = BRACKET.tabSeat;
  const cols = [
    box(-mm(bx) / 2, mm(bx) / 2, 0, mm(bt), -mm(bz) / 2, mm(bz) / 2),
    box(-0.6, 0.6, mm(bt), mm(top), mm(zi), mm(zo) + 0.13),
    box(-0.6, 0.6, mm(bt), mm(top), -mm(zo) - 0.13, -mm(zi)),
  ];
  return {
    id: "p-servo-bracket",
    name_zh: "舵机支架（自制 3D 打印件）",
    name: "Micro servo bracket (our design, PLA)",
    cat: "enclosure",
    proc: { type: "bracket" },
    colliders: cols,
    dims_mm: dimsOf(cols),
    dims_src: "本项目设计尺寸（按舵机 CAD 实测的机身 12×22.6 mm、耳朵高 18.8 mm）",
    spec: "两个 M3 过孔 Ø3.4（ISO 273）间距 30 mm；耳朵处两个自攻导孔",
    density: DENSITY.pla,
    anchors: [
      { t: "hole", d: THREAD.M3.clear, p: [-1.5, mm(bt), 0], th: mm(bt) },
      { t: "hole", d: THREAD.M3.clear, p: [1.5, mm(bt), 0], th: mm(bt) },
      { t: "servo-slot", p: [0, mm(bt), 0] },
      { t: "thread-f", size: "ST1.5", p: [0, mm(top), mm(BRACKET.holeZ)], depth: 0.6 },
      { t: "thread-f", size: "ST1.5", p: [0, mm(top), -mm(BRACKET.holeZ)], depth: 0.6 },
    ],
    est: [],
  };
}

// ---------- 舵盘、触手（估算） ----------
function horn() {
  const cols = [box(-0.35, 0.35, 0, 0.4, -0.35, 0.35), box(-0.25, 1.8, 0.4, 0.56, -0.25, 0.25)];
  return {
    id: "p-servo-horn",
    name_zh: "单臂舵盘",
    name: "Single-arm servo horn",
    cat: "motor",
    proc: { type: "horn" },
    colliders: cols,
    dims_mm: dimsOf(cols),
    dims_src: "估算（舵机附带件）",
    spec: "估算",
    density: DENSITY.plastic,
    anchors: [{ t: "hub", p: [0, 0, 0] }, { t: "arm-tip", p: [1.55, 0.56, 0] }],
    est: ["全部尺寸"],
  };
}
function tentacle() {
  const cols = [box(-0.3, 6.0, 0, 0.5, -0.4, 0.4)];
  return {
    id: "p-tentacle",
    name_zh: "触手臂（自制 3D 打印件）",
    name: "Tentacle arm (our design)",
    cat: "enclosure",
    proc: { type: "tentacle", len: 6.3 },
    colliders: cols,
    dims_mm: dimsOf(cols),
    dims_src: "本项目设计尺寸",
    spec: "卡在舵盘臂末端",
    density: DENSITY.pla,
    anchors: [{ t: "arm-mount", p: [0, 0, 0] }],
    est: [],
  };
}

// ---------- 面包板（半尺寸 400 孔；外形取 Adafruit 64 的 CAD 包围盒，孔距 2.54 mm 标准） ----------
export const BB = { w: 85, d: 55, h: 9.7, cols: 30 };
// 面包板规格：cols 列 × a–j 两组 5 孔；rails 每条电源轨孔数（5 个一组，组间空一格）；外形尺寸除半尺寸外为估算
const BB_TYPES = {
  half: { id: "p-breadboard-half", zh: "半尺寸面包板 400 孔", en: "Half-size breadboard, 400 tie points", w: 85, d: 55, h: 9.7, cols: 30, rails: 25,
    src: "外形取 Adafruit 64 半尺寸面包板 CAD 包围盒；孔距 2.54 mm", spec: "30 列 × a–j；中间槽 7.62 mm；电源轨位置为估算", est: ["电源轨位置"], model: { glbId: "ada-64", note: "外观用程序画，尺寸对齐 Adafruit CAD" } },
  full: { id: "p-breadboard-830", zh: "全尺寸面包板 830 孔", en: "Full-size breadboard, 830 tie points", w: 165, d: 55, h: 9.7, cols: 63, rails: 50,
    src: "孔数 63×10 + 4×50 = 830；孔距 2.54 mm；外形长宽为估算", spec: "63 列 × a–j；中间槽 7.62 mm；四条 50 孔电源轨（各家有的在中间断开，这里按全通）", est: ["外形长宽高", "电源轨位置"] },
  mini: { id: "p-breadboard-170", zh: "迷你面包板 170 孔", en: "Mini breadboard, 170 tie points", w: 47, d: 35, h: 8.5, cols: 17, rails: 0,
    src: "孔数 17×10 = 170；孔距 2.54 mm；外形长宽高为估算", spec: "17 列 × a–j，没有电源轨；中间槽 7.62 mm", est: ["外形长宽高"] },
};
export function breadboardHoles(T = BB_TYPES.half) {
  const holes = [];
  const P = 2.54;
  const rowsZ = { a: -13.97, b: -11.43, c: -8.89, d: -6.35, e: -3.81, f: 3.81, g: 6.35, h: 8.89, i: 11.43, j: 13.97 };
  for (let c = 0; c < T.cols; c++) {
    const x = (c - (T.cols - 1) / 2) * P;
    for (const [r, z] of Object.entries(rowsZ)) holes.push({ name: `${r}${c + 1}`, x, z, net: `${r <= "e" ? "L" : "R"}${c + 1}` });
  }
  if (T.rails) {
    // 电源轨：每边两条，5 个一组（位置估算）
    const n = T.rails, span = n - 1 + Math.floor((n - 1) / 5);
    const rails = [["-1", -22.0], ["+1", -19.46], ["+2", 19.46], ["-2", 22.0]];
    for (const [rn, z] of rails)
      for (let k = 0; k < n; k++) {
        const x = (k + Math.floor(k / 5) - span / 2) * P;
        holes.push({ name: `${rn}.${k + 1}`, x, z, net: `rail${rn}`, rail: true });
      }
  }
  return holes;
}
function breadboard(kind = "half") {
  const T = BB_TYPES[kind];
  const cols = [box(-mm(T.w) / 2, mm(T.w) / 2, 0, mm(T.h), -mm(T.d) / 2, mm(T.d) / 2)];
  return {
    id: T.id,
    name_zh: T.zh,
    name: T.en,
    cat: "breadboard",
    proc: { type: "breadboard", kind },
    colliders: cols,
    dims_mm: { x: T.w, y: T.h, z: T.d },
    dims_src: T.src,
    spec: T.spec,
    density: DENSITY.abs,
    bbHoles: breadboardHoles(T).map((h) => ({ ...h, p: [mm(h.x), mm(T.h), mm(h.z)] })),
    anchors: [{ t: "bb-base", p: [0, 0, 0] }],
    est: T.est,
    ...(T.model ? { model: T.model } : {}),
  };
}

// ---------- 插头（导线端）：Dupont、JST‑PH、USB ----------
function dupont(gender, n = 1) {
  const w = 2.54 * n - 0.1, h = 2.44, L = 14; // 外壳比 2.54 mm 排距窄 0.1 mm，挨着插不打架（估算，实物约 2.4–2.5 mm）
  const pinLen = gender === "m" ? 6 : 0;
  const cols = [box(-mm(w) / 2, mm(w) / 2, mm(pinLen), mm(pinLen + L), -mm(h) / 2, mm(h) / 2)];
  if (gender === "m") cols.push(box(-0.032, 0.032, 0, mm(pinLen), -0.032, 0.032));
  return {
    id: `p-dupont-${gender}${n}`,
    name_zh: gender === "m" ? `杜邦公头（${n} pin）` : `杜邦母头（${n} pin）`,
    name: `Dupont ${gender === "m" ? "male" : "female"} housing ${n}p`,
    cat: "connector",
    proc: { type: "dupont", gender, n, L, pinLen },
    colliders: cols,
    dims_mm: { x: w, y: L + pinLen, z: h },
    dims_src: "截面按 2.54 mm 排距减 0.1 mm；长度为估算",
    spec: gender === "m" ? "公针 0.64 mm 方针（常见规格）" : "套在 0.64 mm 方针上",
    density: DENSITY.plastic,
    // 母头每个触点一个特征（k = 触点号），多 pin 母头要所有触点同时对上排针才套得进去
    anchors: gender === "m" ? [{ t: "dupont-m", p: [0, 0, 0], depth: mm(pinLen), k: 0 }] : Array.from({ length: n }, (_, k) => ({ t: "dupont-f", n, k, p: [mm((k - (n - 1) / 2) * 2.54), 0, 0], depth: mm(6) })),
    est: ["壳体长度"],
    wireEnd: [0, mm(pinLen + L), 0],
  };
}
function plug(kind) {
  // 舌片截面按规范（Type‑C 8.25×2.4 mm，Micro‑B 6.85×1.8 mm）；包胶外壳估算
  const P = {
    "usb-c": { zh: "USB‑C 线插头", tw: 8.25, th: 2.4, tl: 6.6, bw: 12, bh: 6.5, bl: 20, src: "舌片 8.25×2.4 mm（USB Type‑C 规范）；外壳估算" },
    "micro-usb": { zh: "Micro‑USB 线插头", tw: 6.85, th: 1.8, tl: 5.5, bw: 10.5, bh: 6, bl: 18, src: "舌片 6.85×1.8 mm（USB Micro‑B 规范）；外壳估算" },
    "jst-ph2": { zh: "JST‑PH 2P 电池插头", tw: 6.0, th: 4.5, tl: 6.0, bw: 6.0, bh: 4.5, bl: 0.01, src: "估算（PHR‑2 外壳）" },
  }[kind];
  // 插头坐标：插入方向 = −x；插入端在 x=0，舌片 x∈[0,tl]、外壳 x∈[tl, tl+bl]；中心高度 y = bh/2
  const cy = mm(P.bh) / 2;
  const cols = [box(0, mm(P.tl), cy - mm(P.th) / 2, cy + mm(P.th) / 2, -mm(P.tw) / 2, mm(P.tw) / 2)];
  if (P.bl > 0.1) cols.push(box(mm(P.tl), mm(P.tl + P.bl), 0, mm(P.bh), -mm(P.bw) / 2, mm(P.bw) / 2));
  return {
    id: `p-plug-${kind}`,
    name_zh: P.zh,
    name: kind,
    cat: kind.startsWith("jst") ? "connector" : "wire",
    proc: { type: "plug", kind, ...P },
    colliders: cols,
    dims_mm: dimsOf(cols),
    dims_src: P.src,
    spec: P.src,
    density: DENSITY.plastic,
    anchors: [{ t: "plug", kind, p: [0, cy, 0], dir: [-1, 0, 0], depth: mm(P.tl) }],
    est: ["外壳"],
    wireEnd: [mm(P.tl + P.bl), cy, 0],
  };
}

// ---------- 面包板跳线（预先折好的 U 形单芯线）：两腿间距 = N × 2.54 mm ----------
const JUMPER_COLOR = { 1: "#c0392b", 2: "#c0392b", 3: "#e67e22", 4: "#f1c40f", 5: "#27ae60", 6: "#2f6fd6", 7: "#8e44ad", 8: "#7f8c8d", 10: "#ecf0f1", 12: "#a0522d", 15: "#222222" };
function jumper(N) {
  const span = 2.54 * N, legLen = 6, wd = 0.6, h = 1.2; // 估算：22 AWG 实心线芯 ≈0.64 mm，绝缘层外径 ≈1.2 mm，腿长 6 mm
  const x = mm(span) / 2;
  const cols = [
    box(-x - mm(h) / 2, x + mm(h) / 2, mm(legLen), mm(legLen + h), -mm(h) / 2, mm(h) / 2),
    box(-x - 0.032, -x + 0.032, 0, mm(legLen), -0.032, 0.032),
    box(x - 0.032, x + 0.032, 0, mm(legLen), -0.032, 0.032),
  ];
  return {
    id: `p-jumper-${N}`,
    name_zh: `面包板跳线 ${N} 格（${span.toFixed(2)} mm）`,
    name: `Breadboard jumper wire ${N}×2.54 mm`,
    cat: "wire",
    proc: { type: "jumper", N, color: JUMPER_COLOR[N] || "#2f6fd6", wd },
    colliders: cols,
    legs: [{ p: [-x, 0, 0], top: mm(legLen), w: mm(wd), i: 0 }, { p: [x, 0, 0], top: mm(legLen), w: mm(wd), i: 1 }],
    dims_mm: dimsOf(cols),
    dims_src: "腿距按 2.54 mm 栅格；线径与腿长为估算（22 AWG 实心线常见规格）",
    spec: "22 AWG 实心线（常见规格），两端剥线约 6 mm（估算）",
    density: DENSITY.mixed,
    anchors: [],
    est: ["线径", "腿长", "颜色（各家套装的颜色编码不同）"],
  };
}

// ---------- 电机 / 步进（程序生成；外形用“图元”画，碰撞用方块） ----------
// 图元：{ k: "cyl"|"box", c: 中心, r/h, ax: 圆柱轴向, m: 材质 }
const cylBox = (c, r, h, ax = "y") => { const q = r * 0.86; return ax === "y" ? { c, h: [q, h / 2, q] } : ax === "x" ? { c, h: [h / 2, r, q] } : { c, h: [q, r, h / 2] }; };
function motor(kind) {
  let o;
  if (kind === "28byj48") {
    // 输出轴朝上；耳朵在机身顶面
    const R = mm(28) / 2, H = mm(19), et = mm(0.8), sz = mm(8), sr = mm(5) / 2, sl = mm(10), br = mm(9) / 2, bh = mm(1.5);
    o = {
      id: "p-motor-28byj48", zh: "28BYJ‑48 五线减速步进电机（5 V）", en: "28BYJ-48 geared stepper motor 5 V",
      prims: [{ k: "cyl", c: [0, H / 2, 0], r: R, h: H, m: "alum" }, { k: "box", c: [0, H - et / 2, 0], h: [mm(42) / 2, et / 2, mm(7) / 2], m: "alum" }, { k: "cyl", c: [0, H + bh / 2, sz], r: br, h: bh, m: "alum" }, { k: "cyl", c: [0, H + bh + sl / 2, sz], r: sr, h: sl, m: "brass" }, { k: "box", c: [0, H * 0.45, -R - 0.25], h: [0.8, H * 0.4, 0.25], m: "blue" }],
      cols: [cylBox([0, H / 2, 0], R, H), box(-mm(21), mm(21), H - et, H, -mm(3.5), mm(3.5)), cylBox([0, H + bh / 2, sz], br, bh), cylBox([0, H + bh + sl / 2, sz], sr, sl)],
      holes: [[-17.5, 0], [17.5, 0]].map(([x, z]) => ({ t: "hole", d: 4.2, p: [mm(x), H, mm(z)], th: et })),
      src: "机身 Ø28×19 mm、安装孔距 35 mm、孔 Ø4.2、输出轴 Ø5（两侧削平到 3 mm）、轴偏心 8 mm（常见数据手册图）；耳朵厚度、轴长为估算",
      spec: "5 V 单极步进，减速比约 1/64（各家标的减速比略有出入）；常配 ULN2003 驱动板", est: ["耳朵厚度", "轴长", "接线盒尺寸", "质量"],
    };
  } else if (kind.startsWith("nema17")) {
    const L = +kind.split("-")[1], S = mm(42.3), H = mm(L), pr = mm(22) / 2, ph = mm(2), sr = mm(5) / 2, sl = mm(24);
    o = {
      id: `p-motor-${kind}`, zh: `NEMA 17 两相步进电机（机身 ${L} mm）`, en: `NEMA 17 stepper motor, ${L} mm body`,
      prims: [{ k: "box", c: [0, H / 2, 0], h: [S / 2, H / 2, S / 2], m: "black" }, { k: "box", c: [0, H - 0.4, 0], h: [S / 2 + 0.001, 0.4, S / 2 + 0.001], m: "alum" }, { k: "box", c: [0, 0.4, 0], h: [S / 2 + 0.001, 0.4, S / 2 + 0.001], m: "alum" }, { k: "cyl", c: [0, H + ph / 2, 0], r: pr, h: ph, m: "alum" }, { k: "cyl", c: [0, H + ph + sl / 2, 0], r: sr, h: sl, m: "steel" }],
      cols: [box(-S / 2, S / 2, 0, H, -S / 2, S / 2), cylBox([0, H + ph / 2, 0], pr, ph), cylBox([0, H + ph + sl / 2, 0], sr, sl)],
      holes: [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ t: "thread-f", size: "M3", p: [mm(15.5 * a), H, mm(15.5 * b)], depth: mm(4.5) })),
      src: `法兰 42.3 mm 方、安装孔距 31 mm（M3 螺纹孔）、定位凸台 Ø22 mm、轴 Ø5 mm（NEMA 17 常用尺寸）；机身长 ${L} mm 是常见规格之一；轴长 24 mm、孔深 4.5 mm 为估算`,
      spec: "两相四线混合式步进，常见 1.8°/步；需要 A4988 / TMC2209 一类驱动", est: ["轴长", "螺纹孔深", "质量"],
    };
  } else if (kind === "n20") {
    // 卧放，轴朝 +x
    const w = mm(12), h = mm(10), gl = mm(9), ml = mm(15), sr = mm(3) / 2, sl = mm(10);
    o = {
      id: "p-motor-n20", zh: "N20 微型减速电机（3–6 V）", en: "N20 micro gear motor",
      prims: [{ k: "box", c: [gl / 2, h / 2, 0], h: [gl / 2, h / 2, w / 2], m: "brass" }, { k: "box", c: [-ml / 2, h / 2, 0], h: [ml / 2, h / 2, w / 2], m: "steel" }, { k: "cyl", c: [gl + sl / 2, h / 2, 0], r: sr, h: sl, ax: "x", m: "steel" }],
      cols: [box(-ml, gl, 0, h, -w / 2, w / 2), cylBox([gl + sl / 2, h / 2, 0], sr, sl, "x")],
      holes: [], src: "截面 12×10 mm、轴 Ø3 mm D 型（N20 常见规格）；齿轮箱长度随减速比变化，这里按 9 mm 估算；电机长 15 mm、轴长 10 mm 估算",
      spec: "直流有刷减速电机；转速和扭矩取决于减速比（买的时候看标注）", est: ["齿轮箱长度", "电机长度", "轴长"],
    };
  } else if (kind === "130") {
    const w = mm(20.1), h = mm(15.1), l = mm(25.1), sr = mm(2) / 2, sl = mm(8);
    o = {
      id: "p-motor-130", zh: "130 型直流电机（3 V 玩具电机）", en: "130-size DC motor",
      prims: [{ k: "box", c: [0, h / 2, 0], h: [l / 2, h / 2, w / 2], m: "steel" }, { k: "cyl", c: [l / 2 + sl / 2, h / 2, 0], r: sr, h: sl, ax: "x", m: "steel" }, { k: "box", c: [-l / 2 - 0.1, h / 2, 0], h: [0.1, h * 0.4, w * 0.4], m: "white" }],
      cols: [box(-l / 2 - 0.2, l / 2, 0, h, -w / 2, w / 2), cylBox([l / 2 + sl / 2, h / 2, 0], sr, sl, "x")],
      holes: [], src: "机壳 20.1×15.1×25.1 mm、轴 Ø2 mm（130 型常见规格）；轴长为估算",
      spec: "直流有刷电机；电流比 GPIO 能给的大得多，必须用 MOSFET / 驱动芯片带", est: ["轴长", "端盖尺寸"],
    };
  } else if (kind === "coin") {
    const R = mm(10) / 2, H = mm(2.7);
    o = {
      id: "p-motor-coin", zh: "扁平振动马达 Ø10×2.7 mm", en: "Coin vibration motor 10×2.7 mm",
      prims: [{ k: "cyl", c: [0, H / 2, 0], r: R, h: H, m: "steel" }],
      cols: [cylBox([0, H / 2, 0], R, H)], holes: [], src: "Ø10×2.7 mm（常见规格）", spec: "背胶贴装；2–3.6 V 左右（估算，看具体型号）", est: ["工作电压"],
    };
  }
  return {
    id: o.id, name_zh: o.zh, name: o.en, cat: "motor",
    proc: { type: "prims", prims: o.prims },
    colliders: o.cols, dims_mm: dimsOf(o.cols), dims_src: o.src, spec: o.spec,
    density: DENSITY.mixed, anchors: o.holes, est: o.est,
  };
}

// ---------- 桌面上的手工具（可以拿起来放下，会和零件碰撞；尺寸都是估算） ----------
function handTool(kind) {
  const T = {
    tweezers: { zh: "防静电尖头镊子", prims: [{ k: "box", c: [0, 0.2, -0.25], h: [6, 0.08, 0.25], m: "steel" }, { k: "box", c: [0, 0.2, 0.25], h: [6, 0.08, 0.25], m: "steel" }], cols: [box(-6, 6, 0, 0.4, -0.5, 0.5)] },
    cutter: { zh: "斜口钳（水口钳）", prims: [{ k: "box", c: [-3.5, 0.5, 0], h: [3.5, 0.5, 1.2], m: "red" }, { k: "box", c: [2.5, 0.5, 0], h: [2.5, 0.5, 0.6], m: "steel" }], cols: [box(-7, 0, 0, 1, -1.2, 1.2), box(0, 5, 0, 1, -0.6, 0.6)] },
    stripper: { zh: "剥线钳", prims: [{ k: "box", c: [-4, 0.6, 0], h: [4, 0.6, 1.4], m: "yellow" }, { k: "box", c: [3, 0.6, 0], h: [3, 0.6, 0.9], m: "steel" }], cols: [box(-8, 0, 0, 1.2, -1.4, 1.4), box(0, 6, 0, 1.2, -0.9, 0.9)] },
    multimeter: { zh: "数字万用表", prims: [{ k: "box", c: [0, 1.75, 0], h: [3.75, 1.75, 7.5], m: "yellow" }, { k: "box", c: [0, 3.52, -3.5], h: [2.8, 0.03, 1.8], m: "grey" }, { k: "cyl", c: [0, 3.6, 1.5], r: 1.6, h: 0.4, m: "black" }], cols: [box(-3.75, 3.75, 0, 3.5, -7.5, 7.5)] },
    pump: { zh: "吸锡器", prims: [{ k: "cyl", c: [0, 1, 0], r: 1, h: 17, ax: "x", m: "alum" }, { k: "cyl", c: [9.5, 1, 0], r: 0.3, h: 2, ax: "x", m: "white" }], cols: [cylBox([0, 1, 0], 1, 17, "x"), cylBox([9.5, 1, 0], 0.3, 2, "x")] },
    solder: { zh: "焊锡丝卷", prims: [{ k: "cyl", c: [0, 2, 0], r: 3.2, h: 4, m: "steel" }, { k: "cyl", c: [0, 2, 0], r: 3.4, h: 0.3, m: "black" }], cols: [cylBox([0, 2, 0], 3.4, 4)] },
    ...Object.fromEntries([[1.5, 4.6, 1.55], [2, 5.0, 1.8], [2.5, 5.6, 2.0]].map(([s, L1, L2]) => [`hex${s}`, { zh: `内六角扳手 ${s} mm（配 ${{ 1.5: "M2", 2: "M2.5", 2.5: "M3" }[s]} 内六角螺丝）`, prims: [{ k: "box", c: [0, s / 20, 0], h: [L1 / 2, s / 20, s / 20], m: "black" }, { k: "box", c: [L1 / 2 - s / 20, s / 20, L2 / 2], h: [s / 20, s / 20, L2 / 2], m: "black" }], cols: [box(-L1 / 2, L1 / 2, 0, s / 10, -s / 20, s / 20), box(L1 / 2 - s / 10, L1 / 2, 0, s / 10, s / 20, L2)] }])),
  }[kind];
  return {
    id: `p-handtool-${kind}`,
    name_zh: T.zh,
    name: kind,
    cat: "tool",
    proc: { type: "prims", prims: T.prims },
    colliders: T.cols,
    dims_mm: dimsOf(T.cols),
    dims_src: kind.startsWith("hex") ? "对边按 ISO 2936；臂长为估算" : "估算（常见尺寸）",
    spec: kind.startsWith("hex") ? "ISO 2936 内六角扳手" : "估算",
    density: DENSITY.mixed,
    anchors: [],
    est: kind.startsWith("hex") ? ["臂长", "质量"] : ["全部尺寸", "质量"],
  };
}

// ---------- 工具（运动学刚体：会推开零件） ----------
function tool(kind) {
  const T = {
    screwdriver: { zh: "十字螺丝刀 PH0", cols: [box(-0.15, 0.15, 0, 6, -0.15, 0.15), box(-1, 1, 6, 15, -1, 1)], dims: { x: 20, y: 150, z: 20 } },
    iron: { zh: "电烙铁（尖头）", cols: [box(-0.1, 0.1, 0, 3, -0.1, 0.1), box(-0.45, 0.45, 3, 18, -0.45, 0.45)], dims: { x: 9, y: 180, z: 9 } },
  }[kind];
  return {
    id: `p-tool-${kind}`,
    name_zh: T.zh,
    name: kind,
    cat: "tool",
    proc: { type: "tool", kind },
    colliders: T.cols,
    dims_mm: T.dims,
    dims_src: "估算",
    spec: "估算",
    density: DENSITY.mixed,
    anchors: [],
    est: ["全部尺寸"],
    notPlaceable: true,
  };
}

export const PROCEDURAL = [
  plate(),
  bracket(),
  breadboard("half"), breadboard("full"), breadboard("mini"),
  ...["M2", "M2.5", "M3"].flatMap((s) => [nut(s), washer(s)]),
  screw("M2", 4), screw("M2", 6), screw("M2.5", 5), screw("M2.5", 6), screw("M2.5", 20), screw("M3", 6), screw("M3", 8), screw("M3", 10), screw("M3", 12), screw("M2", 10), screw("ST1.5", 6),
  ...[["M2", 6], ["M2", 10], ["M2.5", 6], ["M2.5", 10], ["M3", 6], ["M3", 8], ["M3", 12], ["M3", 16], ["M3", 20]].map(([a, b]) => capScrew(a, b)),
  standoff("M2", 8, 3), standoff("M2.5", 10, 6), standoff("M3", 10, 6), standoff("M2.5", 6, 6), standoff("M2.5", 15, 6), standoff("M3", 6, 6), standoff("M3", 20, 6),
  horn(), tentacle(),
  dupont("m"), dupont("f"), dupont("f", 3),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30].map(jumper),
  plug("usb-c"), plug("micro-usb"), plug("jst-ph2"),
  tool("screwdriver"), tool("iron"),
  motor("28byj48"), motor("nema17-34"), motor("nema17-40"), motor("nema17-48"), motor("n20"), motor("130"), motor("coin"),
  ...["tweezers", "cutter", "stripper", "multimeter", "pump", "solder", "hex1.5", "hex2", "hex2.5"].map(handTool),
].map((d) => ({ ...d, licence: LIC_SELF, kind: "proc", thumb: `/lib/thumbs/${d.id}.webp` }));

export const PROC_BY_ID = Object.fromEntries(PROCEDURAL.map((d) => [d.id, d]));

// 线缆：两端插头 + 中间绳子（Rapier 胶囊链）
export const CABLES = {
  "dupont-mm": { zh: "杜邦线 公‑公 20 cm", ends: ["p-dupont-m1", "p-dupont-m1"], len: 20, r: 0.08 },
  "dupont-ff": { zh: "杜邦线 母‑母 20 cm", ends: ["p-dupont-f1", "p-dupont-f1"], len: 20, r: 0.08 },
  "dupont-mf": { zh: "杜邦线 公‑母 20 cm", ends: ["p-dupont-m1", "p-dupont-f1"], len: 20, r: 0.08 },
  "dupont-mm-10": { zh: "杜邦线 公‑公 10 cm", ends: ["p-dupont-m1", "p-dupont-m1"], len: 10, r: 0.08 },
  "dupont-mm-30": { zh: "杜邦线 公‑公 30 cm", ends: ["p-dupont-m1", "p-dupont-m1"], len: 30, r: 0.08 },
  "dupont-mf-10": { zh: "杜邦线 公‑母 10 cm", ends: ["p-dupont-m1", "p-dupont-f1"], len: 10, r: 0.08 },
  "dupont-ff-10": { zh: "杜邦线 母‑母 10 cm", ends: ["p-dupont-f1", "p-dupont-f1"], len: 10, r: 0.08 },
  "servo-lead": { zh: "舵机引线（棕 GND / 红 VCC / 橙 SIG）", ends: [null, "p-dupont-f3"], len: 15, est: true, r: 0.12 },
  "usb-c": { zh: "USB‑C 数据线（接电脑）", ends: ["p-plug-usb-c", null], len: 30, r: 0.17, est: true },
  "micro-usb": { zh: "Micro‑USB 数据线（接电脑）", ends: ["p-plug-micro-usb", null], len: 30, r: 0.17, est: true },
};
