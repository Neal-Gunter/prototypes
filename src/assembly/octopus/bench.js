// 台面接线表（纯数据，不依赖 3D）：同一份数据既用来摆 3D、拉线，也用来做电路检查和导出指南。
// 每根线：{ a: [角色, 引脚], b: [角色, 引脚], kind, color, why, md }。“md” 写出处；文档没写的标“文档未写”。
export const COLORS = { red: "#d23a2f", black: "#1e1f22", orange: "#e07a2b", yellow: "#e0b322", blue: "#2f6fd6", green: "#2f8f4e", white: "#f1efe9", purple: "#8a4fbf", brown: "#7a4a2a" };
export const FAULTS = [
  { k: "none", zh: "正常（按 md 接好）" },
  { k: "nognd", zh: "没有共地：ESP32 插电脑 USB 供电，没接 GND 到 PCA9685", md: "采购清单 · 故障表“舵机完全不动 / 抖动 → 没有共地”" },
  { k: "pwm200", zh: "PWM 频率不是 50 Hz（固件里漏了设预分频，PCA9685 上电默认约 200 Hz）", md: "采购清单 · 故障表“舵机完全不动 → PWM 频率不是 50Hz” / README §8" },
  { k: "vplus-esp", zh: "舵机 V+ 从 ESP32 的 5V 脚取电（ESP32 插 USB）", md: "采购清单 · 故障表“舵机一转板子就重启”" },
  { k: "servo360", zh: "买成了 360° 连续旋转舵机（3 号触手）", md: "采购清单 · 故障表“抖动、抽搐 → 买了 360° 舵机”" },
  { k: "mech", zh: "摆幅太大 + 转弯：超出机械极限、相邻触手打架", md: "采购清单 · 故障表“到位后一直咯咯响 → 超出机械极限”" },
  { k: "phase0", zh: "步态参数不对：phase = 0（八条同步，原地抽动）", md: "采购清单 · 故障表“八个不同步 → 步态参数问题” / octopus_gait.h 注释" },
  { k: "i2caddr", zh: "只有部分通道有反应：第二块 PCA9685 地址冲突（方案 C 才有两块，这里只说明）", md: "采购清单 · 故障表“只有部分通道有反应”", textOnly: true },
  { k: "u1unset", zh: "6 V 降压模块没先调压就接舵机（补充，md 没写）", md: "补充：XL4015 出厂输出电压不确定" },
  { k: "lowbat", zh: "电池快没电（md：6.3 V，低于 6.4 V 截止线；完善版：3S 9.4 V，低于 9.6 V）", md: "无线架构 §6 · 低于 6.4V 停运动；完善版阈值为我的补充（估算）" },
];
export const PHASES = [
  { k: 0, zh: "阶段 0：先只跑通小智语音（不接舵机）", md: "README §7 阶段 0（半天）", roles: ["ESP", "MIC", "AMP", "SPK", "OLED"] },
  { k: 1, zh: "阶段 1：1 个舵机 + 最小 MCP 工具", md: "README §7 阶段 1（半天）；舵机接哪个脚文档未写，这里接 PCA9685 通道 0", servos: 1 },
  { k: 2, zh: "阶段 2：PCA9685 + 独立电源，4 个舵机", md: "README §7 阶段 2（1 天）", servos: 4 },
  { k: 3, zh: "阶段 3：打印组装，整只八爪鱼上台", md: "README §7 阶段 3（2–3 天）", robot: true },
  { k: 4, zh: "阶段 4：调 CPG 步态（freq 0.6 / yaw 38 / duty 0.65 / phase 45 起步）", md: "README §7 阶段 4", robot: true, tune: true },
  { k: 5, zh: "阶段 5：升级（总线舵机 / IMU）——只有文字，台面不做", md: "README §7 阶段 5", robot: true, textOnly: true },
];
const W = (a, b, kind, color, why, md) => ({ a, b, kind, color: COLORS[color] || color, why, md });

export const VARIANTS = [
  { k: "md", zh: "md 原样", tip: "完全按 md 的接线、代码和数值（错的也照搬，方便对照）" },
  { k: "plus", zh: "完善版（我的补充）", tip: "按数据手册和推理补齐 md 没写清楚 / 写错的地方，每一处都标“我的补充”" },
];
const PLUS = "我的补充";
export function benchSpec({ plan = "A", phase = 3, fault = "none", variant = "md" } = {}) {
  const plus = variant === "plus";
  const ph = PHASES.find((p) => p.k === phase) || PHASES[3];
  const nServo = ph.robot ? 8 : ph.servos || 0; // 方案 B 也是 8 条触手，每条 2 个舵机
  const roles = ph.roles ? [...ph.roles] : ["ESP", "MIC", "AMP", "SPK", "OLED", "PCA", "BAT", "U1", "U2", ...(plus ? ["DIV"] : [])];
  const wires = [];
  const usb = phase === 0 || fault === "nognd" || fault === "vplus-esp";
  // —— 音频（README §4 接线表）——
  wires.push(
    W(["ESP", "J1.5"], ["MIC", "SCK"], "octo-dupont-20", "yellow", "GPIO5 → INMP441 SCK", "README §4"),
    W(["ESP", "J1.4"], ["MIC", "WS"], "octo-dupont-20", "green", "GPIO4 → INMP441 WS", "README §4"),
    W(["ESP", "J1.6"], ["MIC", "SD"], "octo-dupont-20", "blue", "GPIO6 → INMP441 SD", "README §4"),
    W(["ESP", "J1.2"], ["MIC", "VDD"], "octo-dupont-20", "orange", "3V3 → INMP441 VDD", "文档未写（数据手册 1.62–3.63 V）"),
    W(["ESP", "J3.21"], ["MIC", "GND"], "octo-dupont-20", "black", "GND → INMP441 GND", "文档未写"),
    W(["ESP", "J3.22"], ["MIC", "L/R"], "octo-dupont-20", "black", "L/R 接 GND = 左声道", "文档未写（数据手册）"),
    W(["ESP", "J1.8"], ["AMP", "BCLK"], "octo-dupont-20", "yellow", "GPIO15 → MAX98357A BCLK", "README §4"),
    W(["ESP", "J1.9"], ["AMP", "LRC"], "octo-dupont-20", "green", "GPIO16 → MAX98357A LRC", "README §4"),
    W(["ESP", "J1.7"], ["AMP", "DIN"], "octo-dupont-20", "blue", "GPIO7 → MAX98357A DIN", "README §4"),
    W(["AMP", "SPK+"], ["SPK", "+"], "octo-dupont-20", "red", "功放 + → 喇叭 +", "README §3"),
    W(["AMP", "SPK-"], ["SPK", "-"], "octo-dupont-20", "black", "功放 − → 喇叭 −", "README §3"),
  );
  if (phase === 0) {
    wires.push(W(["ESP", "J1.21"], ["AMP", "Vin"], "octo-dupont-20", "red", "5V（USB）→ 功放 Vin", "文档未写"), W(["ESP", "J1.22"], ["AMP", "GND"], "octo-dupont-20", "black", "GND → 功放 GND", "文档未写"));
    wires.push(W(["ESP", "J1.1"], ["OLED", "VCC"], "octo-dupont-20", "orange", "3V3 → OLED VCC", "文档未写"), W(["ESP", "J3.1"], ["OLED", "GND"], "octo-dupont-20", "black", "GND → OLED GND", "文档未写"), W(["ESP", "J1.12"], ["OLED", "SDA"], "octo-dupont-20", "blue", "GPIO8 → OLED SDA", "README §4"), W(["ESP", "J1.15"], ["OLED", "SCL"], "octo-dupont-20", "yellow", "GPIO9 → OLED SCL", "README §4"));
  } else {
    wires.push(
      W(["U2", "OUT+"], ["AMP", "Vin"], "octo-dupont-20", "red", "5V → 功放 Vin", "文档未写"),
      W(["U2", "OUT-"], ["AMP", "GND"], "octo-dupont-20", "black", "GND → 功放 GND", "文档未写"),
      // I2C 和逻辑电源（README §4）
      W(["ESP", "J1.12"], ["PCA", "L.SDA"], "octo-dupont-30", "blue", "GPIO8 → PCA9685 SDA", "README §4 / .ino I2C_SDA 8"),
      W(["ESP", "J1.15"], ["PCA", "L.SCL"], "octo-dupont-30", "yellow", "GPIO9 → PCA9685 SCL", "README §4 / .ino I2C_SCL 9"),
      W(["ESP", "J1.1"], ["PCA", "L.VCC"], "octo-dupont-30", "orange", "3V3 → PCA9685 VCC（逻辑）", "README §4"),
      W(["PCA", "R.VCC"], ["OLED", "VCC"], "octo-dupont-20", "orange", "3V3（经 PCA 排针）→ OLED VCC", "文档未写"),
      W(["PCA", "R.GND"], ["OLED", "GND"], "octo-dupont-20", "black", "GND → OLED GND", "文档未写"),
      W(["PCA", "R.SDA"], ["OLED", "SDA"], "octo-dupont-20", "blue", "SDA 同一条 I2C → OLED", "README §4"),
      W(["PCA", "R.SCL"], ["OLED", "SCL"], "octo-dupont-20", "yellow", "SCL 同一条 I2C → OLED", "README §4"),
      // 供电（README §4 / 无线架构 §6）
      W(["BAT", "BAT+"], ["U1", "IN+"], "octo-wire", "red", "电池 + → 6 V 降压 IN+", "README §4"),
      W(["BAT", "BAT-"], ["U1", "IN-"], "octo-wire", "black", "电池 − → 6 V 降压 IN−", "README §4"),
      W(["BAT", "BAT+"], ["U2", "IN+"], "octo-wire", "red", "电池 + → 5 V 降压 IN+", "补充（md 只写一块 XL4015 同时出 6 V 和 5 V，单块做不到）"),
      W(["BAT", "BAT-"], ["U2", "IN-"], "octo-wire", "black", "电池 − → 5 V 降压 IN−", "补充"),
    );
    if (fault !== "vplus-esp") wires.push(W(["U1", "OUT+"], ["PCA", "T.V+"], "octo-wire", "red", "6 V → PCA9685 V+ 螺丝端子", "README §4"), W(["U1", "OUT-"], ["PCA", "T.GND"], "octo-wire", "black", "GND → PCA9685 GND 端子", "README §4"));
    else wires.push(W(["ESP", "J1.21"], ["PCA", "T.V+"], "octo-dupont-30", "red", "（故障）ESP32 5V → PCA9685 V+", "反例"), W(["ESP", "J1.22"], ["PCA", "T.GND"], "octo-dupont-30", "black", "（故障）ESP32 GND → PCA9685 GND 端子", "反例"));
    if (!usb) wires.push(W(["U2", "OUT+"], ["ESP", "J1.21"], "octo-wire", "red", "5 V → ESP32 5V 脚", "README §4（md 写 VIN/5V；DevKitC‑1 丝印是 5V）"), W(["U2", "OUT-"], ["ESP", "J1.22"], "octo-wire", "black", "GND → ESP32 GND（共地）", "README §4"));
    if (fault !== "nognd") wires.push(W(["ESP", "J3.1"], ["PCA", "L.GND"], "octo-dupont-30", "black", "GND → PCA9685 GND（逻辑地，共地）", "README §4"));
    if (plus) wires.push(
      W(["BAT", "BAT+"], ["DIV", "IN"], "octo-dupont-20", "red", "电池 + → 分压板 IN（100k 上臂）", `${PLUS} · 替代 md 的 GPIO4 电池检测`),
      W(["BAT", "BAT-"], ["DIV", "GND"], "octo-dupont-20", "black", "电池 − → 分压板 GND（22k 下臂）", PLUS),
      W(["DIV", "OUT"], ["ESP", "J1.16"], "octo-dupont-20", "purple", "分压 OUT → GPIO10（ADC1_CH9）", `${PLUS} · GPIO4 已给麦克风 WS，GPIO1/2 留给采购清单第二批 I2C`),
    );
  }
  const servos = [];
  const nSlots = plan === "B" && ph.robot ? 2 : 1;
  for (let a = 0; a < nServo; a++) {
    for (let s = 0; s < nSlots; s++) {
      const ch = nSlots === 2 ? a * 2 + s : a;
      const role = nSlots === 2 ? `S${a}${s ? "p" : "y"}` : `S${a}`;
      servos.push({ role, arm: a, slot: s, ch: `CH${ch}`, type: fault === "servo360" && a === 3 && s === 0 ? "360" : "180" });
      wires.push({ a: [role, "LEAD"], b: ["PCA", `CH${ch}`], kind: "octo-servo", color: COLORS.brown, why: `${role} 舵机引线 → PCA9685 通道 ${ch}`, md: nSlots === 2 ? "octopus_body.h · ChannelOf(kDual16) = arm×2+slot" : "octopus_body.h · ChannelOf(kSingle8) = arm" });
    }
  }
  const lowbat = fault === "lowbat";
  return {
    plan, phase, fault, variant, ph, roles, wires, servos, usb,
    defs: plus ? { BAT: "p-octo-3s-pack" } : {},
    plusHw: plus && plan === "A" && ph.robot ? { casters: true, pads: true, tipShare: 0.3 } : {},
    vbat: plus ? (lowbat ? 9.4 : 11.1) : lowbat ? 6.3 : 7.4,
    caps: ph.robot ? servos.length : 0,
    u1Unset: fault === "u1unset",
    robot: !!ph.robot,
  };
}
