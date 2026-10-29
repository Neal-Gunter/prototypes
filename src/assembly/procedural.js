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
export function breadboardHoles() {
  const holes = [];
  const P = 2.54;
  const rowsZ = { a: -13.97, b: -11.43, c: -8.89, d: -6.35, e: -3.81, f: 3.81, g: 6.35, h: 8.89, i: 11.43, j: 13.97 };
  for (let c = 0; c < BB.cols; c++) {
    const x = (c - (BB.cols - 1) / 2) * P;
    for (const [r, z] of Object.entries(rowsZ)) holes.push({ name: `${r}${c + 1}`, x, z, net: `${r <= "e" ? "L" : "R"}${c + 1}` });
  }
  // 电源轨：每边两条，每条 25 孔，5 个一组（位置估算）
  const rails = [["-1", -22.0], ["+1", -19.46], ["+2", 19.46], ["-2", 22.0]];
  for (const [rn, z] of rails)
    for (let k = 0; k < 25; k++) {
      const x = (k + Math.floor(k / 5) - 14) * P;
      holes.push({ name: `${rn}.${k + 1}`, x, z, net: `rail${rn}`, rail: true });
    }
  return holes;
}
function breadboard() {
  const cols = [box(-mm(BB.w) / 2, mm(BB.w) / 2, 0, mm(BB.h), -mm(BB.d) / 2, mm(BB.d) / 2)];
  return {
    id: "p-breadboard-half",
    name_zh: "半尺寸面包板 400 孔",
    name: "Half-size breadboard, 400 tie points",
    cat: "breadboard",
    proc: { type: "breadboard" },
    colliders: cols,
    dims_mm: { x: BB.w, y: BB.h, z: BB.d },
    dims_src: "外形取 Adafruit 64 半尺寸面包板 CAD 包围盒；孔距 2.54 mm",
    spec: "30 列 × a–j；中间槽 7.62 mm；电源轨位置为估算",
    density: DENSITY.abs,
    bbHoles: breadboardHoles().map((h) => ({ ...h, p: [mm(h.x), mm(BB.h), mm(h.z)] })),
    anchors: [{ t: "bb-base", p: [0, 0, 0] }],
    est: ["电源轨位置"],
    model: { glbId: "ada-64", note: "外观用程序画，尺寸对齐 Adafruit CAD" },
  };
}

// ---------- 插头（导线端）：Dupont、JST‑PH、USB ----------
function dupont(gender, n = 1) {
  const w = 2.54 * n, h = 2.54, L = 14;
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
    dims_src: "截面按 2.54 mm 排距；长度为估算",
    spec: gender === "m" ? "公针 0.64 mm 方针（常见规格）" : "套在 0.64 mm 方针上",
    density: DENSITY.plastic,
    anchors: gender === "m" ? [{ t: "dupont-m", p: [0, 0, 0], depth: mm(pinLen) }] : [{ t: "dupont-f", n, p: [0, 0, 0], depth: mm(6) }],
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
  breadboard(),
  ...["M2", "M2.5", "M3"].flatMap((s) => [nut(s)]),
  screw("M2", 4), screw("M2", 6), screw("M2.5", 5), screw("M2.5", 6), screw("M2.5", 20), screw("M3", 6), screw("M3", 10), screw("ST1.5", 6),
  standoff("M2", 8, 3), standoff("M2.5", 10, 6), standoff("M3", 10, 6),
  horn(), tentacle(),
  dupont("m"), dupont("f"), dupont("f", 3),
  plug("usb-c"), plug("micro-usb"), plug("jst-ph2"),
  tool("screwdriver"), tool("iron"),
].map((d) => ({ ...d, licence: LIC_SELF, kind: "proc", thumb: `/lib/thumbs/${d.id}.webp` }));

export const PROC_BY_ID = Object.fromEntries(PROCEDURAL.map((d) => [d.id, d]));

// 线缆：两端插头 + 中间绳子（Rapier 胶囊链）
export const CABLES = {
  "dupont-mm": { zh: "杜邦线 公‑公 20 cm", ends: ["p-dupont-m1", "p-dupont-m1"], len: 20 },
  "dupont-ff": { zh: "杜邦线 母‑母 20 cm", ends: ["p-dupont-f1", "p-dupont-f1"], len: 20 },
  "dupont-mf": { zh: "杜邦线 公‑母 20 cm", ends: ["p-dupont-m1", "p-dupont-f1"], len: 20 },
  "usb-c": { zh: "USB‑C 数据线（接电脑）", ends: ["p-plug-usb-c", null], len: 30 },
  "micro-usb": { zh: "Micro‑USB 数据线（接电脑）", ends: ["p-plug-micro-usb", null], len: 30 },
};
