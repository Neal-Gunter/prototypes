// v41：装配台 / 示波器 / 示意图共用的工作台色板。
// 与 src/index.css 里的 @theme 扩展 token 保持同一组十六进制值。
// 这些数值是本项目自己定的，不是从某个 skill 原文抄来的。

// v44：浅色是工作台默认；line 从 #d2c7b4 加深到 #7a6e5c，让描边在纸色底上达到 3:1（原先只有 1.26）。
// 深色值见 DARK。themeVars() 按当前 data-theme 取一组，3D / 读数用。具名导出仍是浅色，给印刷和旧调用。
export const LIGHT = {
  paper: "#e7dfd0",
  paper2: "#f7f3ea",
  ink: "#1b1814",
  inkSoft: "#4a433a",
  copper: "#9e461d",
  copperDeep: "#7c3a12",
  mask: "#16352c",
  line: "#7a6e5c",
  mark: "#8e2f2a",
  bench: "#8a6844",
  benchSide: "#6f5538",
  pcb: "#2a4a34",
  scopeBg: "#0a120e",
  scopeGrid: "#1c3328",
  scopeMinor: "#14241d",
  caseBlue: "#3d5a72",
};
export const DARK = {
  paper: "#1c1915",
  paper2: "#2c2722",
  ink: "#f0e8da",
  inkSoft: "#c9bfb0",
  copper: "#e09868",
  copperDeep: "#f0b48a",
  mask: "#7eb8a4",
  line: "#a3988c",
  mark: "#e88880",
  bench: "#8a6844",
  benchSide: "#5a4530",
  pcb: "#3a5a44",
  scopeBg: "#0a120e",
  scopeGrid: "#1c3328",
  scopeMinor: "#14241d",
  caseBlue: "#8aa8b8",
};
export const paper = LIGHT.paper;
export const paper2 = LIGHT.paper2;
export const ink = LIGHT.ink;
export const inkSoft = LIGHT.inkSoft;
export const copper = LIGHT.copper;
export const copperDeep = LIGHT.copperDeep;
export const mask = LIGHT.mask;
export const line = LIGHT.line;
export const mark = LIGHT.mark;

export const bench = LIGHT.bench;
export const benchSide = LIGHT.benchSide;
export const pcb = LIGHT.pcb;
export const scopeBg = LIGHT.scopeBg;
export const scopeGrid = LIGHT.scopeGrid;
export const scopeMinor = LIGHT.scopeMinor;
export const caseBlue = LIGHT.caseBlue;

export function resolvedThemeName() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
export function themeVars(name = resolvedThemeName()) {
  return name === "dark" ? DARK : LIGHT;
}

// 偏 PVC 的导线色：还能分清红黑黄绿蓝橙紫白，但不那么霓虹。
export const WIRE = {
  red: "#b43c32",
  black: "#2a2927",
  yellow: "#c9a227",
  green: "#3d6b48",
  blue: "#355f9a",
  orange: "#c56a28",
  purple: "#6e4a8a",
  white: "#e8e4d8",
  brown: "#7a4a2a",
};
export const WIRE_COLORS = [WIRE.red, WIRE.black, WIRE.yellow, WIRE.green, WIRE.blue, WIRE.orange, WIRE.purple, WIRE.white];

// 示波器屏幕上的磷光色（深色底）；CH_INK 用在纸色底上的读数，对比度 ≥ 4.5:1。
export const CH_COLOR = ["#e6c84a", "#4ec8d6", "#d46bb8", "#5ad07a"];
export const CH_INK = ["#6b5a00", "#0a6270", "#9a2468", "#1b6b32"];
// 深色纸底上用磷光色做读数（已在深色屏上用过，对纸色深底同样 ≥ 4.5:1）。
export function channelInk(theme = resolvedThemeName()) {
  return theme === "dark" ? CH_COLOR : CH_INK;
}

// 步态图等 2D 曲线：能区分，并且图例文字在白 / 纸色底上过 AA。
export const CHART = ["#355f9a", "#b43c32", "#1b6b32", "#8a6a12", "#6e4a8a", "#c56a28", "#0a6270", "#8a3a58"];
export const CHART_INK = ["#1e3a68", "#8a2a22", "#146028", "#5c4d00", "#5a3870", "#8a4a14", "#0a5c68", "#6a2844"];
export const CHART_ON_DARK = ["#9bbcde", "#e8a098", "#8fd4a0", "#e0d08a", "#c8b0de", "#f0c090", "#8ad4dc", "#e8a8c0"];
export function chartInk(theme = resolvedThemeName()) {
  return theme === "dark" ? CHART_ON_DARK : CHART_INK;
}
export function chartStroke(theme = resolvedThemeName()) {
  return theme === "dark" ? CHART_ON_DARK : CHART;
}

export const JUMPER_COLOR = {
  1: WIRE.red, 2: WIRE.red, 3: WIRE.orange, 4: WIRE.yellow,
  5: WIRE.green, 6: WIRE.blue, 7: WIRE.purple, 8: "#6a6e70",
  10: WIRE.white, 12: WIRE.brown, 15: WIRE.black,
};

const LEGACY_WIRE = {
  "#d23a2f": WIRE.red, "#c0392b": WIRE.red, "#e11": WIRE.red, "#d42": WIRE.red,
  "#1e1f22": WIRE.black, "#222222": WIRE.black, "#2a2b2e": WIRE.black,
  "#e0b322": WIRE.yellow, "#f1c40f": WIRE.yellow, "#e0e050": WIRE.yellow, "#e8e050": WIRE.yellow,
  "#2f8f4e": WIRE.green, "#27ae60": WIRE.green, "#1f9d55": WIRE.green,
  "#2f6fd6": WIRE.blue,
  "#e07a2b": WIRE.orange, "#e67e22": WIRE.orange, "#e07a22": WIRE.orange,
  "#8a4fbf": WIRE.purple, "#8e44ad": WIRE.purple, "#7b4bd6": WIRE.purple,
  "#f1efe9": WIRE.white, "#ecf0f1": WIRE.white,
  "#7a4a2a": WIRE.brown, "#a0522d": WIRE.brown,
};
export function remapWire(col) {
  if (!col) return col;
  return LEGACY_WIRE[String(col).toLowerCase()] || col;
}
