// 小智八爪鱼用到的零件：库里没有的按资料尺寸程序生成（不确定的标“估算”），库里有的只补“引脚表”。
// 单位 cm（1 = 10 mm）；零件局部坐标 y 向上。
const box = (x0, x1, y0, y1, z0, z1) => ({ c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2] });
const dimsOf = (cols) => {
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const c of cols) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c.c[k] - c.h[k]); hi[k] = Math.max(hi[k], c.c[k] + c.h[k]); }
  return { x: +((hi[0] - lo[0]) * 10).toFixed(2), y: +((hi[1] - lo[1]) * 10).toFixed(2), z: +((hi[2] - lo[2]) * 10).toFixed(2) };
};
const B = (b, m) => ({ k: "box", c: b.c, h: b.h, m });
const P = 0.254; // 排针间距 2.54 mm
const PIN_TOP = 0.16 + 0.85; // PCB 1.6 mm + 排针露出 8.5 mm（常见值）

// 一排朝上的排针：返回碰撞盒、画面、引脚表
function headerRow(names, x0, z, dir = "x", keyPrefix = "") {
  const n = names.length;
  const prims = [], pins = {};
  const L = n * P;
  const cx = dir === "x" ? x0 + (L - P) / 2 : 0;
  const plastic = dir === "x" ? box(x0 - P / 2, x0 - P / 2 + L, 0.16, 0.41, z - P / 2, z + P / 2) : box(z - P / 2, z + P / 2, 0.16, 0.41, x0 - P / 2, x0 - P / 2 + L);
  prims.push(B(plastic, "black"));
  names.forEach((nm, i) => {
    const a = x0 + i * P;
    const p = dir === "x" ? [a, PIN_TOP, z] : [z, PIN_TOP, a];
    prims.push({ k: "box", c: [p[0], (0.41 + PIN_TOP) / 2, p[2]], h: [0.032, (PIN_TOP - 0.41) / 2, 0.032], m: "brass" });
    pins[keyPrefix + (i + 1)] = { p, label: nm };
  });
  const col = dir === "x" ? box(x0 - P / 2, x0 - P / 2 + L, 0.16, PIN_TOP, z - P / 2, z + P / 2) : box(z - P / 2, z + P / 2, 0.16, PIN_TOP, x0 - P / 2, x0 - P / 2 + L);
  return { prims, pins, col, cx };
}
function base(id, zh, en, cat, cols, prims, extra) {
  return { id, name_zh: zh, name: en, cat, proc: { type: "prims", prims }, colliders: cols, dims_mm: dimsOf(cols), density: 1.6, anchors: [], est: [], octoPart: true, ...extra };
}

// ---------- ESP32-S3-DevKitC-1 N16R8 ----------
// 引脚顺序按乐鑫 DevKitC-1 v1.1 用户指南的 J1 / J3 表；板子外形 63 × 25.4 mm 是估算（以实物为准）。
export const DEVKIT_J1 = ["3V3", "3V3", "RST", "IO4", "IO5", "IO6", "IO7", "IO15", "IO16", "IO17", "IO18", "IO8", "IO3", "IO46", "IO9", "IO10", "IO11", "IO12", "IO13", "IO14", "5V", "G"];
export const DEVKIT_J3 = ["G", "TX", "RX", "IO1", "IO2", "IO42", "IO41", "IO40", "IO39", "IO38", "IO37", "IO36", "IO35", "IO0", "IO45", "IO48", "IO47", "IO21", "IO20", "IO19", "G", "G"];
function devkit() {
  const hx = 3.15, hz = 1.27, rowZ = 1.143, x0 = -2.667;
  const j1 = headerRow(DEVKIT_J1, x0, rowZ, "x", "J1.");
  const j3 = headerRow(DEVKIT_J3, x0, -rowZ, "x", "J3.");
  const pcb = box(-hx, hx, 0, 0.16, -hz, hz);
  const cols = [pcb, j1.col, j3.col, box(2.45, 3.25, 0.16, 0.48, -0.85, -0.25), box(2.45, 3.25, 0.16, 0.48, 0.25, 0.85), box(-0.3, 0.3, 0.16, 0.4, -0.7, 0.7)];
  const prims = [B(pcb, "black"), ...j1.prims, ...j3.prims,
    B(box(2.45, 3.25, 0.16, 0.48, -0.85, -0.25), "steel"), B(box(2.45, 3.25, 0.16, 0.48, 0.25, 0.85), "steel"), // 两个 USB‑C（UART / USB）
    B(box(-0.3, 0.3, 0.16, 0.4, -0.7, 0.7), "grey")]; // 稳压器 / 按键一带（示意）
  const pins = { ...j1.pins, ...j3.pins };
  return base("p-octo-devkitc1", "ESP32‑S3‑DevKitC‑1 N16R8 开发板", "ESP32-S3-DevKitC-1 N16R8", "mcu", cols, prims, {
    dims_src: "引脚顺序：乐鑫 DevKitC‑1 v1.1 用户指南；板子长宽为估算；模组用 KiCad 的 ESP32‑S3‑WROOM‑1 模型（同一刚体）",
    spec: "排针间距 2.54 mm；两排 22 针。台面上排针朝上画（实物出厂朝下，通常插面包板）",
    est: ["板子外形 63 × 25.4 mm", "排针朝上"],
    octo: { pins, ties: [["J1.1", "J1.2"], ["J1.22", "J3.1", "J3.21", "J3.22"]], pinName: (k) => pins[k]?.label },
  });
}
// ---------- INMP441 麦克风模块（常见圆板） ----------
function inmp441() {
  const r = 0.7; // Φ14 mm（估算）
  const row = headerRow(["L/R", "WS", "SCK", "SD", "VDD", "GND"], -0.635, 0.45, "x", "");
  const pcb = box(-r, r, 0, 0.12, -r, r);
  const cols = [pcb, row.col];
  const prims = [{ k: "cyl", c: [0, 0.06, 0], r, h: 0.12, m: "blue" }, ...row.prims, B(box(-0.2, 0.2, 0.12, 0.22, -0.35, 0.05), "steel")];
  const pins = { "L/R": row.pins[1], WS: row.pins[2], SCK: row.pins[3], SD: row.pins[4], VDD: row.pins[5], GND: row.pins[6] };
  return base("p-octo-inmp441", "INMP441 全向麦克风模块", "INMP441 I2S MEMS mic module", "sensor", cols, prims, {
    dims_src: "INMP441 芯片 4.72 × 3.76 mm（TDK 数据手册）；模块 Φ14 mm 和引脚顺序为估算，以丝印为准",
    spec: "I2S 数字输出；VDD 1.62–3.63 V（数据手册）；L/R 接 GND = 左声道。拾音孔在板子背面",
    est: ["模块外形 Φ14 mm", "引脚顺序"],
    octo: { pins, ties: [] },
  });
}
// ---------- 0.96" SSD1306 OLED（4 针 I2C） ----------
function oled() {
  const hx = 1.365, hz = 1.39;
  const row = headerRow(["GND", "VCC", "SCL", "SDA"], -0.381, -1.15, "x", "");
  const pcb = box(-hx, hx, 0, 0.12, -hz, hz);
  const glass = box(-1.335, 1.335, 0.12, 0.27, -0.75, 1.18);
  const cols = [pcb, glass, row.col];
  const prims = [B(pcb, "blue"), B(glass, "black"), B(box(-1.1, 1.1, 0.271, 0.272, -0.5, 0.95), "grey"), ...row.prims];
  const pins = { GND: row.pins[1], VCC: row.pins[2], SCL: row.pins[3], SDA: row.pins[4] };
  return base("p-octo-oled096", "0.96 寸 OLED（SSD1306，I2C 4 针）", "0.96in SSD1306 OLED, I2C", "display", cols, prims, {
    dims_src: "常见模块约 27.3 × 27.8 mm（估算）；I2C 地址常见 0x3C",
    spec: "128 × 64；4 针 GND/VCC/SCL/SDA（有的批次 VCC 和 GND 对调，以丝印为准）",
    est: ["外形", "引脚顺序"],
    octo: { pins, ties: [] },
  });
}
// ---------- XL4015 降压模块（5 A） ----------
function xl4015(variant) {
  const hx = 2.55, hz = 1.3;
  const pcb = box(-hx, hx, 0, 0.16, -hz, hz);
  const tIn = box(-2.55, -1.75, 0.16, 1.0, -0.95, 0.95), tOut = box(1.75, 2.55, 0.16, 1.0, -0.95, 0.95);
  const ind = box(-0.6, 0.6, 0.16, 0.86, -1.1, 0.1);
  const cols = [pcb, tIn, tOut, ind, box(0.6, 1.5, 0.16, 1.16, 0.25, 1.15), box(-1.6, -0.7, 0.16, 1.16, 0.25, 1.15), box(0.1, 1.05, 0.16, 0.66, -1.25, -0.3)];
  const prims = [B(pcb, "blue"), B(tIn, "blue"), B(tOut, "blue"), B(ind, "black"),
    { k: "cyl", c: [1.05, 0.66, 0.7], r: 0.45, h: 1.0, m: "black" }, { k: "cyl", c: [-1.15, 0.66, 0.7], r: 0.45, h: 1.0, m: "black" },
    B(box(0.1, 1.05, 0.16, 0.66, -1.25, -0.3), "blue"), { k: "cyl", c: [0.32, 0.7, -0.5], r: 0.12, h: 0.1, m: "brass" }];
  const pins = { "IN+": { p: [-2.15, 1.0, -0.45], label: "IN+" }, "IN-": { p: [-2.15, 1.0, 0.45], label: "IN-" }, "OUT+": { p: [2.15, 1.0, -0.45], label: "OUT+" }, "OUT-": { p: [2.15, 1.0, 0.45], label: "OUT-" } };
  return base(`p-octo-xl4015-${variant}`, `XL4015 降压模块（${variant === "6v" ? "调到 6 V：舵机" : "调到 5 V：ESP32"}）`, `XL4015 buck module (${variant})`, "power", cols, prims, {
    dims_src: "XLSEMI XL4015 数据手册：输入 8–36 V、输出 1.25–32 V、最大 5 A；模块外形约 51 × 26 mm 为估算",
    spec: `螺丝端子：左 IN+/IN-，右 OUT+/OUT-；电位器调输出电压（出厂值不确定，先空载用万用表调到 ${variant === "6v" ? "6.0" : "5.0"} V）`,
    est: ["模块外形", "端子位置"],
    octo: { pins, ties: [["IN-", "OUT-"]], vset: variant === "6v" ? 6.0 : 5.0 },
  });
}
// ---------- 2S 7.4 V 2000 mAh 锂电池 ----------
function battery() {
  const c = box(-3.5, 3.5, 0, 1.8, -1.7, 1.7);
  const cols = [c];
  const prims = [B(c, "blue"), B(box(-3.4, 3.4, 1.8, 1.81, -1.5, 1.5), "white"), B(box(3.5, 3.7, 0.5, 1.3, -0.6, 0.6), "red")];
  const pins = { "BAT+": { p: [3.7, 1.0, -0.3], label: "红 +" }, "BAT-": { p: [3.7, 1.0, 0.3], label: "黑 −" } };
  return base("p-octo-2s-lipo", "2S 7.4 V 2000 mAh 锂电池", "2S 7.4V 2000mAh LiPo", "power", cols, prims, {
    dims_src: "约 70 × 34 × 18 mm（估算，各家不同）",
    spec: "2 节串联：满电 8.4 V、标称 7.4 V、放电截止约 6.0–6.4 V",
    est: ["外形", "出线位置"],
    density: 2.0,
    octo: { pins, ties: [], volts: 7.4 },
  });
}
// ---------- 自制躯干骨架（本项目按 md “躯干约 10 cm” 设计） ----------
export const FRAME = { R: 5, t: 0.3, postR: 2.6, postH: 4.5, deckY: 4.5, deckT: 0.3, hole: 2.2, deckOut: 3.6 };
function frame() {
  const F = FRAME;
  const cols = [box(-4.6, 4.6, 0, F.t, -1.9, 1.9), box(-1.9, 1.9, 0, F.t, -4.6, 4.6), box(-3.5, 3.5, 0, F.t, -3.5, 3.5)];
  const prims = [{ k: "cyl", c: [0, F.t / 2, 0], r: F.R, h: F.t, m: "white" }];
  for (let k = 0; k < 8; k++) {
    const a = ((22.5 + 45 * k) * Math.PI) / 180;
    const x = F.postR * Math.cos(a), z = F.postR * Math.sin(a);
    const b = box(x - 0.25, x + 0.25, F.t, F.deckY, z - 0.25, z + 0.25);
    cols.push(b);
    prims.push(B(b, "white"));
  }
  const y0 = F.deckY, y1 = F.deckY + F.deckT, O = F.deckOut, I = F.hole;
  for (const b of [box(-O, O, y0, y1, I, O), box(-O, O, y0, y1, -O, -I), box(I, O, y0, y1, -I, I), box(-O, -I, y0, y1, -I, I)]) { cols.push(b); prims.push(B(b, "white")); }
  // 驱动板用的 4 根 2 mm 高垫柱（PCA9685 安装孔位置为估算）
  for (const [x, z] of [[-2.8, -1.0], [2.8, -1.0], [-2.8, 1.0], [2.8, 1.0]]) prims.push({ k: "cyl", c: [x, y1 + 0.1, z], r: 0.25, h: 0.2, m: "brass" });
  return base("p-octo-frame", "八爪鱼躯干骨架（底板 Φ10 cm + 8 根立柱 + 上层板）", "Octopus torso frame (our design)", "enclosure", cols, prims, {
    dims_src: "本项目按 md“躯干约 10 cm”设计；厚度、立柱、上层板为估算",
    spec: "3D 打印（PLA）；8 个舵机竖着立在底板上、输出轴朝外；上层板中间留 4.4 × 4.4 cm 走线孔，驱动板架在孔上",
    est: ["全部结构尺寸"],
    density: 1.24,
  });
}
// ---------- 自制触手（舵盘 + 6 节锥形，一体打印） ----------
export const ARM = { len: 9.0, segs: 6, y: [0.15, -0.4, -1.1, -1.8, -2.5, -3.2], hh: [0.22, 0.2, 0.18, 0.17, 0.16, 0.15] };
function arm() {
  const cols = [], prims = [{ k: "cyl", c: [0, 0.12, 0], r: 0.55, h: 0.24, m: "orange" }];
  const step = 1.45;
  for (let k = 0; k < ARM.segs; k++) {
    const x0 = 0.3 + step * k, x1 = x0 + step + 0.05;
    const w = 0.5 - 0.06 * k;
    const b = box(x0, x1, ARM.y[k] - ARM.hh[k], ARM.y[k] + ARM.hh[k], -w, w);
    cols.push(b);
    prims.push(B(b, "orange"));
  }
  cols.push(box(-0.55, 0.55, 0, 0.24, -0.55, 0.55));
  return base("p-octo-arm", "八爪鱼触手（舵盘 + 6 节锥形，自制打印）", "Octopus tentacle (our design)", "enclosure", cols, prims, {
    dims_src: "md：触手 7–9 cm；这里取 9 cm、根部宽 1 cm 到末端 0.4 cm（估算）",
    spec: "套在舵机输出轴上（舵盘一体）；末端贴着桌面（方案 A 只有偏航，靠末端在桌面上蹭）",
    est: ["全部结构尺寸"],
    density: 1.24,
  });
}
// ---------- 方案 B：俯仰舵机支架 + 7 cm 触手（md 只写“每条 2 个舵机”，结构全部估算） ----------
function bracketB() {
  const plate = box(0, 2.6, 0, 0.25, -0.7, 0.7), hub = { k: "cyl", c: [0, 0.12, 0], r: 0.55, h: 0.24, m: "white" };
  return base("p-octo-bracket-b", "方案 B 俯仰舵机支架（自制打印）", "Pitch servo bracket (our design)", "enclosure", [plate], [hub, B(plate, "white")], {
    dims_src: "md 没写方案 B 的结构；这里按“偏航舵盘上架一个侧躺的俯仰舵机”设计，尺寸全部估算",
    spec: "套在偏航舵机输出轴上，上面用 2 颗 M2 螺丝固定侧躺的俯仰舵机",
    est: ["全部结构尺寸"],
    density: 1.24,
  });
}
function armB() {
  const cols = [], prims = [];
  const ys = [-0.3, -1.0, -1.75, -2.5, -3.25, -3.95], step = 1.1;
  const hubB = box(-0.4, 0.4, -0.4, 0.4, -0.25, 0.25);
  cols.push(hubB); prims.push(B(hubB, "orange"));
  for (let k = 0; k < 6; k++) {
    const x0 = 0.3 + step * k, x1 = x0 + step + 0.05, w = 0.45 - 0.05 * k, hh = 0.2 - 0.01 * k;
    const b = box(x0, x1, ys[k] - hh, ys[k] + hh, -w, w);
    cols.push(b); prims.push(B(b, "orange"));
  }
  return base("p-octo-arm-b", "方案 B 触手（7 cm，装在俯仰舵机轴上）", "Octopus tentacle B (our design)", "enclosure", cols, prims, {
    dims_src: "md：触手 7–9 cm；方案 B 取 7 cm，让展开尺寸接近 md 的 25–30 cm（估算）",
    spec: "俯仰舵机抬起 = 摆动相（离地），放下 = 支撑相（末端着地）",
    est: ["全部结构尺寸"],
    density: 1.24,
  });
}
export const OCTO_PROCEDURAL = [devkit(), inmp441(), oled(), xl4015("6v"), xl4015("5v"), battery(), frame(), arm(), bracketB(), armB()];

// ---------- 库里真实零件的引脚表（零件局部坐标，cm） ----------
// PCA9685（ada-815）：两端各一排 6 针控制排针（GND OE SCL SDA VCC V+），16 路 × 3 排舵机排针，中间螺丝端子 V+ / GND。
// 排针坐标是按 CAD 碰撞盒推的估算位置。
function pcaPins() {
  const pins = {};
  const ctl = ["GND", "OE", "SCL", "SDA", "VCC", "V+"];
  ctl.forEach((n, i) => {
    pins[`L.${n}`] = { p: [-2.9, 1.2, -0.635 + i * P], label: `左排 ${n}` };
    pins[`R.${n}`] = { p: [2.9, 1.2, -0.635 + i * P], label: `右排 ${n}` };
  });
  for (let ch = 0; ch < 16; ch++) {
    const i = Math.floor(ch / 4) * 5 + (ch % 4);
    const x = -2.54 + P * (i + 0.5);
    pins[`CH${ch}.PWM`] = { p: [x, 1.2, 0.626], label: `通道 ${ch} PWM` };
    pins[`CH${ch}.V+`] = { p: [x, 1.2, 0.88], label: `通道 ${ch} V+` };
    pins[`CH${ch}.GND`] = { p: [x, 1.2, 1.134], label: `通道 ${ch} GND` };
  }
  pins["T.V+"] = { p: [-0.18, 1.2, -0.88], label: "端子 V+" };
  pins["T.GND"] = { p: [0.18, 1.2, -0.88], label: "端子 GND" };
  const gnd = ["L.GND", "R.GND", "T.GND", ...Array.from({ length: 16 }, (_, c) => `CH${c}.GND`)];
  const vp = ["L.V+", "R.V+", "T.V+", ...Array.from({ length: 16 }, (_, c) => `CH${c}.V+`)];
  return { pins, ties: [gnd, vp, ["L.VCC", "R.VCC"], ["L.SDA", "R.SDA"], ["L.SCL", "R.SCL"], ["L.OE", "R.OE"]] };
}
export const OCTO_PINS = {
  "ada-815": pcaPins(),
  // MAX98357A（ada-3006）：一排 7 孔，顺序按 Adafruit 丝印 LRC BCLK DIN GAIN SD GND Vin（位置取 CAD 孔位）
  "ada-3006": (() => {
    const names = ["LRC", "BCLK", "DIN", "GAIN", "SD", "GND", "Vin"];
    const pins = {};
    names.forEach((n, i) => { pins[n] = { p: [-0.762 + i * P, 0.2, 0.699], label: n }; });
    pins["SPK+"] = { p: [0.17, 0.3, -0.597], label: "喇叭 +" };
    pins["SPK-"] = { p: [-0.18, 0.3, -0.597], label: "喇叭 −" };
    return { pins, ties: [] };
  })(),
  "ada-3923": { pins: { "+": { p: [0.22, 0.6, -1.37], label: "+" }, "-": { p: [-0.22, 0.6, -1.37], label: "−" } }, ties: [] },
  "ada-1143": { pins: { LEAD: { p: [0, 0.45, -1.2], label: "引线（棕 GND / 红 V+ / 橙 PWM）" } }, ties: [] },
  "kc-cp_radial_d6.3mm_p2.50mm": { pins: {}, ties: [] },
};
export function pinsOf(def) {
  return def.octo || OCTO_PINS[def.id] || { pins: {}, ties: [] };
}
