// v18 的“参考板”工作台电路（八爪鱼 v10 紧凑版维修板 + 可选 5VA 储能电容）。v19 起作为备用 / 对照。早期原型，简化仿真。
import { makeBoard } from "../repair/boards.js";
// 我的补充：电池两档。新电池内阻 0.06 Ω 与参考板一致；“老化”0.25 Ω 是估算（真实电池随循环次数、温度变化很大）。
export const BATT = { fresh: { zh: "新电池（内阻 0.06 Ω，估算）", rint: 0.06 }, aged: { zh: "老化电池（内阻 0.25 Ω，估算）", rint: 0.25 } };
export const CAPS = { 0: "不加", 100e-6: "100 µF", 470e-6: "470 µF", 1000e-6: "1000 µF" };

export function benchBoard({ batt = "fresh", cap = 0 } = {}) {
  const b = makeBoard("octo");
  const bt = b.parts.find((p) => p.ref === "BT1"); bt.state.rint = BATT[batt].rint; bt.props.r = BATT[batt].rint;
  if (cap) b.parts.push({ ref: "CX", kind: "cap", zh: `外加 ${CAPS[cap]} 储能电解电容（5VA ↔ GND，我的补充）`, x: 0, y: 0, w: 4, h: 4, pins: { "+": "5VA", "-": "GND" }, props: { c: +cap, esr: 0.05, polar: true }, state: {}, offBoard: true });
  return b;
}
