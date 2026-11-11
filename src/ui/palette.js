// v41：装配台 / 示波器 / 示意图共用的工作台色板。
// 与 src/index.css 里的 @theme 扩展 token 保持同一组十六进制值。
// 这些数值是本项目自己定的，不是从某个 skill 原文抄来的。

export const paper = "#e7dfd0";
export const paper2 = "#f7f3ea";
export const ink = "#1b1814";
export const inkSoft = "#4a433a";
export const copper = "#9e461d";
export const copperDeep = "#7c3a12";
export const mask = "#16352c";
export const line = "#d2c7b4";
export const mark = "#8e2f2a";

export const bench = "#8a6844";
export const benchSide = "#6f5538";
export const pcb = "#2a4a34";
export const scopeBg = "#0a120e";
export const scopeGrid = "#1c3328";
export const scopeMinor = "#14241d";
export const caseBlue = "#3d5a72";

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

// 步态图等 2D 曲线：能区分，并且图例文字在白 / 纸色底上过 AA。
export const CHART = ["#355f9a", "#b43c32", "#1b6b32", "#8a6a12", "#6e4a8a", "#c56a28", "#0a6270", "#8a3a58"];
export const CHART_INK = ["#1e3a68", "#8a2a22", "#146028", "#5c4d00", "#5a3870", "#8a4a14", "#0a5c68", "#6a2844"];

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
