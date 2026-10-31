// v25：焊点质量的简化模型（纯函数，从 engine.js 抽出来，3D 装配台和“从零做八爪鱼”项目共用同一套）。早期原型，简化仿真；时间阈值为估算（我的补充）。
//   need = 润湿所需时间（有助焊剂 0.6 s，没有 1.4 s）
//   松开时 t < 0.4·need：没焊上；< need：虚焊；≤ G：合格；再久：附近有焊盘就连锡，否则仍合格；≥ 3.5·need：焊盘烫坏（自动停止）
//   有助焊剂时 G = 2.5·need，没有时 G = 1.6·need（锡更容易拉尖、堆锡）
export const PAD_REWORK_MAX = 3, DESOLDER_OVERHEAT_S = 4, PART_HEAT_MAX_S = 30;
export function solderGrade(t, flux, hasNeighbor) {
  const need = flux ? 0.6 : 1.4;
  const G = (flux ? 2.5 : 1.6) * need;
  if (t < 0.4 * need) return null;
  if (t < need) return "cold";
  if (t <= G) return "good";
  if (t < 3.5 * need) return hasNeighbor ? "bridge" : "good";
  return "burnt";
}
export const GRADE_ZH = { good: "合格（光亮小锥形）", cold: "虚焊（发灰、不导通）", bridge: "连锡（和旁边焊盘短路）", burnt: "焊盘烫坏" };
export const GRADE_EN = { good: "good (shiny cone)", cold: "cold joint (dull, open)", bridge: "bridge (shorted to neighbour)", burnt: "pad burnt" };
