// 零件定义：全部是程序生成的简化外形，不是厂家精确 CAD。
// 坐标单位：1 = 1 cm。底板顶面在 y = 0。

export const PLATE = { w: 30, d: 20 };

const ESP_TOP = ["3V3", "EN", "GPIO4", "GPIO5", "GPIO6", "GPIO7", "GPIO15", "GPIO16", "GPIO17", "5V"];
const ESP_BOTTOM = ["GND", "GPIO43", "GPIO44", "GPIO1", "GPIO2", "GPIO42", "GPIO41", "GPIO40", "GPIO0", "GND2"];

// 简化规则：哪些脚不适合做舵机 PWM，以及原因。
const RESERVED = {
  EN: "EN 是复位脚，不是 GPIO",
  GPIO43: "GPIO43 是 UART0 的 TX，串口日志要用它",
  GPIO44: "GPIO44 是 UART0 的 RX，串口日志要用它",
  GPIO0: "GPIO0 是启动模式选择脚（strapping），接舵机可能影响烧录",
};

function espPinRole(name) {
  if (name === "3V3") return "3v3";
  if (name === "5V") return "5v";
  if (name.startsWith("GND")) return "gnd";
  if (name === "EN") return "en";
  return "gpio";
}

export const PART_TYPES = {
  esp32: {
    label: "ESP32‑S3 开发板",
    short: "ESP32",
    max: 1,
    size: [7.0, 0.16, 3.2],
    note: "简化外形，只画了 20 个常用引脚，间距和位置不是真实开发板的",
    pins() {
      const pins = [];
      const xs = (i) => -2.6 + i * 0.5;
      ESP_TOP.forEach((name, i) =>
        pins.push({ name, label: name, role: espPinRole(name), local: [xs(i), 0.32, -1.35], row: "top" }),
      );
      ESP_BOTTOM.forEach((name, i) =>
        pins.push({
          name,
          label: name === "GND2" ? "GND" : name,
          role: espPinRole(name),
          local: [xs(i), 0.32, 1.35],
          row: "bottom",
        }),
      );
      return pins.map((p) => ({
        ...p,
        pwm: p.role === "gpio" && !RESERVED[p.name],
        reserved: RESERVED[p.name] || null,
      }));
    },
  },
  servo: {
    label: "MG90S 类微型舵机",
    short: "舵机",
    max: 3,
    size: [2.28, 2.3, 1.22],
    note: "简化外形，尺寸接近 MG90S；工作电压按 4.8–6 V 处理",
    pins() {
      return [
        { name: "GND", label: "GND", role: "servo-gnd", local: [2.7, 0.62, -0.45], wire: "#6b3f22" },
        { name: "VCC", label: "VCC", role: "servo-vcc", local: [2.7, 0.62, 0], wire: "#c8322a" },
        { name: "SIG", label: "SIG", role: "servo-sig", local: [2.7, 0.62, 0.45], wire: "#e88a1a" },
      ];
    },
  },
  battery: {
    label: "4×AA 电池盒（约 6 V）",
    short: "电池盒",
    max: 1,
    size: [5.8, 1.6, 6.0],
    note: "简化：按恒定 6 V 处理，不模拟电量和内阻",
    pins() {
      return [
        { name: "+", label: "+", role: "bat+", local: [3.9, 0.5, -0.35], wire: "#c8322a" },
        { name: "-", label: "−", role: "bat-", local: [3.9, 0.5, 0.35], wire: "#222222" },
      ];
    },
  },
};

// 推荐摆放位置（点击零件盒里的零件时使用）
export const DEFAULT_SLOTS = {
  esp32: [{ x: 2, z: 3.5 }],
  servo: [
    { x: -9, z: -5.5 },
    { x: -2.5, z: -5.5 },
    { x: 4, z: -5.5 },
  ],
  battery: [{ x: -9.5, z: 4.5 }],
};

const pinCache = {};
export function pinsOfType(type) {
  if (!pinCache[type]) pinCache[type] = PART_TYPES[type].pins();
  return pinCache[type];
}

export function partDisplayName(part) {
  if (part.type === "servo") return `舵机 ${part.id.replace("servo", "")}`;
  if (part.type === "esp32") return "ESP32‑S3";
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
  return `${partDisplayName(part)} ${meta?.label ?? name}${extra}`;
}

export function wireColorFor(roleA, roleB) {
  const roles = [roleA, roleB];
  if (roles.some((r) => ["bat+", "5v", "3v3", "servo-vcc"].includes(r))) return "#c8322a";
  if (roles.some((r) => ["gnd", "bat-", "servo-gnd"].includes(r))) return "#2a2a2a";
  if (roles.some((r) => r === "servo-sig")) return "#e88a1a";
  return "#d9b52b";
}
