// v12：关节驱动预设。数字只用已经核对过的 datasheet 值（和 octopus/loco.js、octopus/v10.js 同一来源）；
// 其余（反射惯量、直线推杆、“自定义”）都标“估算”。单位：扭矩 kgf·cm，速度 °/s，力 N，直线速度 mm/s。
import { MG90S, stallKgfCm } from "../assembly/octopus/loco.js";
import { SG51R, sg51rStall } from "../assembly/octopus/v10.js";

export const DRIVES = {
  none: { zh: "无驱动（自由转动，只受限位）", kind: "any" },
  sg51r: {
    zh: "SG51R 微型舵机（5 g）", kind: "rot", src: SG51R.src, travel: 90,
    torque: (v) => sg51rStall(v), speed: () => SG51R.speed48, armI: 150, volts: [4.8],
    note: "4.8 V 以上不外推（页面只给了 4.8 V 的数）",
    est: ["转子反射惯量 0.15 kg·cm²（估算，和 v10 八爪鱼一致）"],
  },
  mg90s: {
    zh: "MG90S 金属齿舵机（13.4 g）", kind: "rot", src: MG90S.src, travel: 90,
    torque: (v) => stallKgfCm(v), speed: (v) => (v >= 6 ? 60 / 0.08 : v >= 4.8 ? 600 + ((v - 4.8) / 1.2) * 150 : 600 * (v / 4.8)),
    armI: 500, volts: [4.8, 6],
    note: "4.8–6 V 之间按两个 datasheet 点线性插值（我的补充）",
    est: ["转子反射惯量 0.5 kg·cm²（估算，和 v9 八爪鱼一致）", "4.8–6 V 之间的扭矩/速度是线性插值（估算）"],
  },
  custom: {
    zh: "自定义电机（自己填扭矩和速度，估算）", kind: "rot", travel: 180, src: "用户填写（估算）",
    torque: (v, d) => Math.max(0, +d.torque || 0), speed: (v, d) => Math.max(1, +d.speed || 1), armI: 300,
    est: ["扭矩、速度是用户填的（估算）", "转子反射惯量 0.3 kg·cm²（估算）"],
  },
  linear: {
    zh: "直线推杆（自己填推力和速度，估算）", kind: "lin", src: "用户填写（估算）",
    force: (d) => Math.max(0, +d.forceN || 0), speed: (d) => Math.max(0.1, +d.speedMm || 0.1),
    est: ["推力、速度是用户填的（估算）"],
  },
};
export const KGFCM = 981000; // 1 kgf·cm = 1000 g × 981 cm/s² × 1 cm（引擎单位 g·cm²/s²）
export const NEWTON = 1e5; // 1 N = 1000 g × 100 cm/s²

// 给一个关节算实际用的驱动参数（引擎单位）
export function driveParams(j) {
  const d = j.drive || {};
  const P = DRIVES[d.preset] || DRIVES.none;
  const v = +d.volt || 4.8;
  if (!d.preset || d.preset === "none" || j.type === "ball" || j.type === "fixed") return { on: false, P };
  if (j.type === "prismatic") {
    if (P.kind !== "lin") return { on: false, P, why: "滑动关节只能配“直线推杆”" };
    const F = P.force(d), sp = P.speed(d);
    return { on: true, P, lin: true, maxF: F * NEWTON, speed: sp / 10, label: `${F} N、${sp} mm/s（估算）` };
  }
  if (P.kind !== "rot") return { on: false, P, why: "转动关节要配舵机或电机" };
  const T = P.torque(v, d), sp = P.speed(v, d);
  return { on: true, P, maxF: T * KGFCM, speed: (sp * Math.PI) / 180, armI: P.armI, travel: P.travel, label: `${T.toFixed(2)} kgf·cm、${Math.round(sp)} °/s @ ${v} V` };
}
