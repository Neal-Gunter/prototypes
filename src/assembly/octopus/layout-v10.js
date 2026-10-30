// v10 紧凑无线版（我的补充）：机身上的零件摆放 + 舵机线走线。纯函数，3D（build3d.js）和穿模测试（scripts/octo-test.mjs）共用同一份。
// 单位 cm，坐标相对机身中心（底板底面中心）。所有尺寸来自库里 CAD 的碰撞盒或 parts.js 的程序零件；摆放位置是我的设计（估算）。
import { FRAME_V10, SG51R_GEO } from "./parts.js";
export const DECK_TOP = FRAME_V10.deckY + FRAME_V10.deckT; // 3.7
const BAT_TOP = DECK_TOP + 0.5; // ada-258 碰撞盒：主体高 5 mm（保护板那头 6 mm）
// yaw：绕竖直轴（度，three.js 约定：局部 x → (cos, 0, −sin)）
export const DECK_V10 = {
  BAT: { p: [-0.15, DECK_TOP, 0], yaw: 90, why: "电池平躺在上层板中间，长边沿 x（34 × 62 mm 的对角半径 3.5 cm < 上层板 4.0 cm）；双面胶 + 扎带固定（估算）" },
  CHG: { p: [-1.0, BAT_TOP, 0], yaw: 180, why: "充电板贴在电池上面，JST 座朝电池出线那头；USB‑C 朝外，只在充电时插" },
  QTPY: { p: [1.5, BAT_TOP, 0], yaw: 0, why: "QT Py 贴在电池上面（泡棉双面胶垫高约 1 mm，背面 BAT/GND 焊盘的线从侧边引出）" },
  BST1: { p: [-0.7, DECK_TOP, 2.8], yaw: 0, why: "升压 1（0–3 号舵机）在上层板 +z 边" },
  BST2: { p: [0.7, DECK_TOP, 2.8], yaw: 0, why: "升压 2（4–7 号舵机）在上层板 +z 边" },
  CAP1: { p: [-1.75, DECK_TOP, 2.6], yaw: 0, why: "电容紧挨升压 1 输出" },
  CAP2: { p: [1.75, DECK_TOP, 2.6], yaw: 0, why: "电容紧挨升压 2 输出" },
  DIV: { p: [-1.4, DECK_TOP, -2.6], yaw: 0, why: "分压板在 −z 边" },
  SW: { p: [0.9, DECK_TOP, -3.2], yaw: 0, why: "拨动开关在上层板 −z 边缘，手指够得到" },
};
export const mountDeg = (a) => -90 + a * 45; // = Gait.MountAngle
export const dirOf = (a) => { const t = (mountDeg(a) * Math.PI) / 180; return [Math.cos(t), 0, Math.sin(t)]; };
export const servoPoseV10 = (a) => { const d = dirOf(a); return { p: [d[0] * FRAME_V10.servoR, FRAME_V10.t, d[2] * FRAME_V10.servoR], yaw: -mountDeg(a) }; };
export const armPoseV10 = (a) => { const d = dirOf(a); return { p: [d[0] * FRAME_V10.yawR, FRAME_V10.t + SG51R_GEO.shaftTop, d[2] * FRAME_V10.yawR], yaw: -mountDeg(a) }; };
// 舵机线：引线出口（舵机内端）→ 往中心 → 中心空当竖直上去 → 在舵机顶和上层板之间（y≈3.3）沿径向出去 → 上层板外缘外竖直上去 → 越过板上零件（y=5.0）→ 落到焊盘
export const ROUTE_Y = { under: 3.28 /* 触手根部最高 3.06 cm 与上层板底面 3.5 cm 的中间 */, over: 5.0, outR: FRAME_V10.deckR + 0.25 };
export function servoRouteV10(a, end, k = 0) {
  const d = dirOf(a), at = (r, y) => [d[0] * r, y, d[2] * r];
  const spread = 0.06 * (k % 2 ? 1 : -1); // 两根线并排
  const t = [-d[2] * spread, 0, d[0] * spread], add = (p) => [p[0] + t[0], p[1], p[2] + t[2]];
  return [add(at(1.3, 0.8)), add(at(0.6, 1.2)), add(at(0.6, ROUTE_Y.under)), add(at(ROUTE_Y.outR, ROUTE_Y.under)), add(at(ROUTE_Y.outR, ROUTE_Y.over)), [end[0] * 0.6 + t[0], ROUTE_Y.over, end[2] * 0.6 + t[2]], [end[0], end[1] + 0.45, end[2]]];
}
