/** Simplified catalog. Shapes and pin roles are for this page, not a datasheet or CAD model. */

export const SLOTS = [
  { id: "mcu", x: -1.35, z: 0.4 },
  { id: "bat", x: -1.35, z: -0.75 },
  { id: "sv0", x: 0.2, z: 0.62 },
  { id: "sv1", x: 1.25, z: 0.5 },
  { id: "sv2", x: 1.2, z: -0.62 },
];

const ESP_Z = [0.4, 0.24, 0.08, -0.08, -0.24, -0.4];

function espPin(id, label, role, side, index) {
  const x = side === "L" ? -0.58 : 0.58;
  return { id, label, role, position: [x, 0.12, ESP_Z[index]] };
}

export const PARTS = [
  {
    id: "esp32",
    kind: "esp32",
    name: "ESP32-S3 开发板",
    summary: "简化外形，只留了这一页用到的引脚，不是精确 CAD。",
    slot: "mcu",
    size: [1.28, 0.08, 1.04],
    pins: [
      espPin("5V", "5V", "vin", "L", 0),
      espPin("GND", "GND", "gnd", "L", 1),
      espPin("GPIO4", "GPIO4", "pwm", "L", 2),
      espPin("GPIO5", "GPIO5", "pwm", "L", 3),
      espPin("GPIO6", "GPIO6", "pwm", "L", 4),
      espPin("GPIO7", "GPIO7", "pwm", "L", 5),
      espPin("3V3", "3V3", "3v3", "R", 0),
      espPin("GND2", "GND", "gnd", "R", 1),
      espPin("GPIO1", "GPIO1", "gpio", "R", 2),
      espPin("GPIO2", "GPIO2", "gpio", "R", 3),
      espPin("GPIO15", "GPIO15", "pwm", "R", 4),
      espPin("GPIO16", "GPIO16", "pwm", "R", 5),
    ],
  },
  {
    id: "servo-0",
    kind: "servo",
    name: "舵机 A",
    summary: "接近 MG90S 外形的简化块，不是数据手册模型。",
    slot: "sv0",
    tentacle: 0,
    size: [0.52, 0.3, 0.48],
    pins: [
      { id: "VCC", label: "VCC", role: "vcc", position: [-0.12, 0.16, 0.28] },
      { id: "GND", label: "GND", role: "gnd", position: [0, 0.16, 0.28] },
      { id: "SIG", label: "SIG", role: "sig", position: [0.12, 0.16, 0.28] },
    ],
  },
  {
    id: "servo-1",
    kind: "servo",
    name: "舵机 B",
    summary: "接近 MG90S 外形的简化块，不是数据手册模型。",
    slot: "sv1",
    tentacle: 1,
    size: [0.52, 0.3, 0.48],
    pins: [
      { id: "VCC", label: "VCC", role: "vcc", position: [-0.12, 0.16, 0.28] },
      { id: "GND", label: "GND", role: "gnd", position: [0, 0.16, 0.28] },
      { id: "SIG", label: "SIG", role: "sig", position: [0.12, 0.16, 0.28] },
    ],
  },
  {
    id: "servo-2",
    kind: "servo",
    name: "舵机 C",
    summary: "接近 MG90S 外形的简化块，不是数据手册模型。",
    slot: "sv2",
    tentacle: 2,
    size: [0.52, 0.3, 0.48],
    pins: [
      { id: "VCC", label: "VCC", role: "vcc", position: [-0.12, 0.16, 0.28] },
      { id: "GND", label: "GND", role: "gnd", position: [0, 0.16, 0.28] },
      { id: "SIG", label: "SIG", role: "sig", position: [0.12, 0.16, 0.28] },
    ],
  },
  {
    id: "battery",
    kind: "battery",
    name: "电池盒",
    summary: "简化电池，这一页把它当成舵机和开发板的电源。",
    slot: "bat",
    size: [0.78, 0.22, 0.42],
    pins: [
      { id: "BAT+", label: "BAT+", role: "bat+", position: [-0.18, 0.28, 0] },
      { id: "BAT-", label: "BAT−", role: "bat-", position: [0.18, 0.28, 0] },
    ],
  },
];

export const BOARD_GPIO = [
  { pin: 1, id: "GPIO1", pwm: false },
  { pin: 2, id: "GPIO2", pwm: false },
  { pin: 4, id: "GPIO4", pwm: true },
  { pin: 5, id: "GPIO5", pwm: true },
  { pin: 6, id: "GPIO6", pwm: true },
  { pin: 7, id: "GPIO7", pwm: true },
  { pin: 15, id: "GPIO15", pwm: true },
  { pin: 16, id: "GPIO16", pwm: true },
];

export const PWM_LABEL =
  "简化 PWM 脚：GPIO4、GPIO5、GPIO6、GPIO7、GPIO15、GPIO16。其余 GPIO 在这一页不当作 PWM。";

export function getPart(partId) {
  const part = PARTS.find((item) => item.id === partId);
  if (!part) throw new Error(`unknown part ${partId}`);
  return part;
}

export function pinKey(partId, pinId) {
  return `${partId}::${pinId}`;
}

export function endpointLabel(ref) {
  const part = getPart(ref.partId);
  const pin = part.pins.find((item) => item.id === ref.pinId);
  return `${part.name} ${pin ? pin.label : ref.pinId}`;
}

export function roleHint(role) {
  switch (role) {
    case "pwm":
      return "PWM";
    case "gpio":
      return "非 PWM";
    case "sig":
      return "信号";
    case "vcc":
      return "舵机电源";
    case "vin":
      return "开发板 5V";
    case "3v3":
      return "3V3";
    case "gnd":
      return "地";
    case "bat+":
      return "电池正极";
    case "bat-":
      return "电池负极";
    default:
      return "简化";
  }
}

export function pinTestId(partId, pinId) {
  return `pin-${partId}-${String(pinId).replaceAll("+", "plus")}`;
}

export function partPosition(partId, placements, dragPreview) {
  if (dragPreview && dragPreview.partId === partId) {
    return [dragPreview.x, 0, dragPreview.z];
  }
  const slot = SLOTS.find((item) => item.id === placements[partId]);
  if (!slot) return null;
  return [slot.x, 0, slot.z];
}

export function pinWorld(partId, pinId, origin) {
  const part = getPart(partId);
  const pin = part.pins.find((item) => item.id === pinId);
  if (!pin || !origin) return null;
  return [origin[0] + pin.position[0], pin.position[1], origin[2] + pin.position[2]];
}

export function nearestSlot(x, z, placements, selfId) {
  let best = null;
  let bestDistance = 0.62;
  for (const slot of SLOTS) {
    const taken = Object.entries(placements).some(
      ([id, slotId]) => id !== selfId && slotId === slot.id,
    );
    if (taken) continue;
    const distance = Math.hypot(slot.x - x, slot.z - z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  }
  return best;
}

export function firstOpenSlot(partId, placements) {
  const part = getPart(partId);
  const taken = (slot) =>
    Object.entries(placements).some(([id, slotId]) => id !== partId && slotId === slot.id);
  const preferred = SLOTS.find((slot) => slot.id === part.slot);
  if (preferred && !taken(preferred)) return preferred;
  return SLOTS.find((slot) => !taken(slot)) || null;
}

export function wireColor(fromRole, toRole) {
  const roles = [fromRole, toRole];
  if (roles.includes("sig") || roles.includes("pwm") || roles.includes("gpio")) return "#b45324";
  if (roles.includes("gnd") || roles.includes("bat-")) return "#1b1814";
  return "#8e2f2a";
}

export function samePin(a, b) {
  return a.partId === b.partId && a.pinId === b.pinId;
}
