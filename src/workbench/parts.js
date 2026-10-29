// 零件定义。外形来自 Adafruit CAD Parts（MIT，见 LICENSES.md），转换脚本 scripts/convert-models.mjs。
// 引脚名和 GPIO 号按 Adafruit Feather ESP32‑S3（产品 5323）的丝印和 arduino-esp32 的 pins_arduino.h。
// 坐标单位：1 = 1 cm。底板顶面在 y = 0。

export const PLATE = { w: 24, d: 16 };

// Feather 立在 5 mm 尼龙铜柱上；板厚 1.57 mm
export const FEATHER_STANDOFF = 0.5;
const PAD_Y = FEATHER_STANDOFF + 0.157;
const PITCH = 0.254;

// 长排 16 针（靠近 USB‑C 一端起）：RST 3V 3V GND A0…A5 SCK MO MI RX TX DB
const LONG = [
  ["RST", "RST", "rst"],
  ["3V", "3V", "3v3"],
  ["3V_2", "3V", "3v3"],
  ["GND", "GND", "gnd"],
  ["A0", "A0", "gpio", 18],
  ["A1", "A1", "gpio", 17],
  ["A2", "A2", "gpio", 16],
  ["A3", "A3", "gpio", 15],
  ["A4", "A4", "gpio", 14],
  ["A5", "A5", "gpio", 8],
  ["SCK", "SCK", "gpio", 36],
  ["MO", "MO", "gpio", 35],
  ["MI", "MI", "gpio", 37],
  ["RX", "RX", "gpio", 38],
  ["TX", "TX", "gpio", 39],
  ["DB", "DB", "dbg"],
];
// 短排 12 针：BAT EN USB 13 12 11 10 9 6 5 SCL SDA
const SHORT = [
  ["BAT", "BAT", "vbat"],
  ["EN", "EN", "en"],
  ["USB", "USB", "5v"],
  ["13", "13", "gpio", 13],
  ["12", "12", "gpio", 12],
  ["11", "11", "gpio", 11],
  ["10", "10", "gpio", 10],
  ["9", "9", "gpio", 9],
  ["6", "6", "gpio", 6],
  ["5", "5", "gpio", 5],
  ["SCL", "SCL", "gpio", 4],
  ["SDA", "SDA", "gpio", 3],
];

const NOTES = {
  "13": "13 号脚上接了板载红色 LED，接舵机也能用，LED 会跟着闪",
  SCL: "SCL/SDA 板上有 I2C 上拉电阻（STEMMA QT 接口），能用但最好留给 I2C",
  SDA: "SCL/SDA 板上有 I2C 上拉电阻（STEMMA QT 接口），能用但最好留给 I2C",
};
const RESERVED = {
  RST: "RST 是复位脚，不是 GPIO",
  EN: "EN 是 3.3V 稳压器的使能脚，不是 GPIO；接地会让整块板断电",
  DB: "DB 是调试串口输出，简化：这里不当 GPIO 用",
};
// 热容量倍数：接地/电源脚连着大面积铜，热得慢
const THERMAL = { gnd: 2.2, "3v3": 1.7, "5v": 1.6, vbat: 1.6 };

export const PART_TYPES = {
  esp32: {
    label: "Adafruit Feather ESP32‑S3",
    short: "Feather",
    max: 1,
    model: "/models/feather_esp32s3.glb",
    footprint: [5.4, 2.4],
    note: "外形来自 Adafruit 官方 CAD（MIT），引脚名和 GPIO 号按真实丝印；导线直接焊进排针孔",
    pins() {
      const pins = [];
      LONG.forEach(([name, label, role, gpio], i) =>
        pins.push({ name, label, role, gpio, kind: "tht", row: "long", idx: i, local: [-1.905 + i * PITCH, PAD_Y, 1.016] }),
      );
      SHORT.forEach(([name, label, role, gpio], i) =>
        pins.push({ name, label, role, gpio, kind: "tht", row: "short", idx: i, local: [-0.889 + i * PITCH, PAD_Y, -1.016] }),
      );
      return pins.map((p) => ({
        ...p,
        pwm: p.role === "gpio",
        reserved: RESERVED[p.name] || null,
        note: NOTES[p.name] || null,
        thermal: THERMAL[p.role] || 1,
      }));
    },
  },
  servo: {
    label: "微型金属齿舵机",
    short: "舵机",
    max: 3,
    model: "/models/micro_servo.glb",
    footprint: [1.3, 3.2],
    note: "外形来自 Adafruit 1143 的 CAD（MIT）；舵机线的插头已剪掉、线头剥好镀锡，直接和导线对焊",
    // 两个耳朵上的螺丝孔（局部坐标）
    screwHoles: [
      [0, 2.08, 1.498],
      [0, 2.08, -1.468],
    ],
    shaft: [0, 3.07, 0.53],
    pins() {
      return [
        { name: "GND", label: "GND", role: "servo-gnd", kind: "lead", wire: "#5a3a22", local: [-0.26, 0.1, 3.7] },
        { name: "VCC", label: "VCC", role: "servo-vcc", kind: "lead", wire: "#c8322a", local: [0, 0.1, 3.7] },
        { name: "SIG", label: "SIG", role: "servo-sig", kind: "lead", wire: "#e88a1a", local: [0.26, 0.1, 3.7] },
      ].map((p) => ({ ...p, thermal: 0.6 }));
    },
  },
  battery: {
    label: "4×AA 电池盒",
    short: "电池盒",
    max: 1,
    model: "/models/battery_4xaa.glb",
    footprint: [6.5, 7.0],
    note: "外形来自 Adafruit 830 的 CAD（MIT）；简化：按 4 节 1.5 V 共 6.0 V 的理想电源，不算电量和内阻",
    pins() {
      return [
        { name: "+", label: "+", role: "bat+", kind: "lead", wire: "#c8322a", local: [4.5, 0.1, -0.28] },
        { name: "-", label: "−", role: "bat-", kind: "lead", wire: "#222222", local: [4.5, 0.1, 0.28] },
      ].map((p) => ({ ...p, thermal: 0.7 }));
    },
  },
};

// 推荐摆放位置（点击零件盒里的零件时使用）
export const DEFAULT_SLOTS = {
  esp32: [{ x: 5, z: 3.5 }],
  servo: [
    { x: -1, z: -4.6 },
    { x: 3, z: -4.6 },
    { x: 7, z: -4.6 },
  ],
  battery: [{ x: -8, z: 3.2 }],
};

const pinCache = {};
export function pinsOfType(type) {
  if (!pinCache[type]) pinCache[type] = PART_TYPES[type].pins();
  return pinCache[type];
}

export function pinMeta(parts, id) {
  const [partId, name] = splitPinId(id);
  const part = parts.find((p) => p.id === partId);
  return part ? pinsOfType(part.type).find((p) => p.name === name) : null;
}

// 同一排相邻的焊盘（锡太多会桥连）
export function neighborPins(parts, id) {
  const [partId] = splitPinId(id);
  const part = parts.find((p) => p.id === partId);
  const m = pinMeta(parts, id);
  if (!part || !m || m.kind !== "tht") return [];
  return pinsOfType(part.type)
    .filter((p) => p.row === m.row && Math.abs(p.idx - m.idx) === 1)
    .map((p) => pinId(partId, p.name));
}

export function partDisplayName(part) {
  if (part.type === "servo") return `舵机 ${part.id.replace("servo", "")}`;
  if (part.type === "esp32") return "Feather";
  return "电池盒";
}

export function pinId(partId, pinName) {
  return `${partId}.${pinName}`;
}

export function splitPinId(id) {
  const i = id.indexOf(".");
  return [id.slice(0, i), id.slice(i + 1)];
}

// 绕 y 轴旋转（与 three.js rotation.y 一致）
export function localToWorld(part, local) {
  const t = part.rot || 0;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const [x, y, z] = local;
  return [part.x + x * c + z * s, y, part.z - x * s + z * c];
}

export function allPins(parts) {
  const out = [];
  for (const part of parts) {
    for (const p of pinsOfType(part.type)) {
      out.push({ ...p, id: pinId(part.id, p.name), partId: part.id, partType: part.type, part });
    }
  }
  return out;
}

export function pinDisplayName(parts, id) {
  const [partId, name] = splitPinId(id);
  const part = parts.find((p) => p.id === partId);
  if (!part) return id;
  const meta = pinsOfType(part.type).find((p) => p.name === name);
  const extra =
    meta?.role === "servo-sig" ? "（橙）" : meta?.role === "servo-vcc" ? "（红）" : meta?.role === "servo-gnd" ? "（棕）" : "";
  const gp = meta?.gpio != null && meta.label !== String(meta.gpio) ? `（GPIO${meta.gpio}）` : "";
  return `${partDisplayName(part)} ${meta?.label ?? name}${gp}${extra}`;
}

export function wireColorFor(roleA, roleB) {
  const roles = [roleA, roleB];
  if (roles.some((r) => ["bat+", "5v", "3v3", "servo-vcc", "vbat"].includes(r))) return "#c8322a";
  if (roles.some((r) => ["gnd", "bat-", "servo-gnd"].includes(r))) return "#2a2a2a";
  if (roles.some((r) => r === "servo-sig")) return "#e88a1a";
  return "#d9b52b";
}
