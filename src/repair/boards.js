// 维修关卡用的四块板子（模板）。坐标单位是毫米，只用于画图和放表笔。
// 数值来源：标了“页面”的来自项目 v10 物料清单里引用的厂家产品页；其余全部是估算（我的补充）。
import { clone } from "./board.js";

const part = (ref, kind, zh, x, y, w, h, pins, props = {}, state = {}, extra = {}) => ({ ref, kind, zh, x, y, w, h, pins, props, state: { present: true, ...state }, joints: {}, ...extra });

// 夜灯小板：3×AA → 开关 → 限流电阻 → LED
function ledBoard() {
  return {
    template: "led", name: "LED 夜灯小板", w: 70, h: 44, ground: "GND",
    nets: { "BAT+": "电池正极", VSW: "开关后", LA: "LED 正极", GND: "地（电池负极）" },
    parts: [
      part("BT1", "bat", "3×AA 电池盒（碱性）", 4, 6, 22, 32, { "+": "BAT+", "-": "GND" }, { chem: "aa3", v: 4.65, r: 0.3, fp: "battery" }, { ocv: 4.65, rint: 0.3, orient: 1 }, { offBoard: true }),
      part("SW1", "sw", "拨动开关", 32, 6, 12, 7, { a: "BAT+", b: "VSW" }, { fp: "switch" }),
      part("R1", "res", "限流电阻（丝印 150 Ω）", 34, 22, 14, 4, { 1: "VSW", 2: "LA" }, { ohms: 150, fp: "res" }, { ohms: 150 }),
      part("D1", "led", "红色 5 mm LED", 56, 20, 8, 8, { A: "LA", K: "GND" }, { fp: "led" }, { orient: 1 }),
    ],
    traces: [], wires: [], shorts: [], covers: [],
    testpoints: [{ id: "TP1", net: "VSW", x: 50, y: 8 }, { id: "TP2", net: "GND", x: 50, y: 38 }],
    watch: { VSW: "VSW" },
    spec: [{ zh: "D1 正常亮（5–20 mA）", led: "D1", mA: [5, 20] }],
  };
}

// 9 V → 3.3 V 稳压小板（防反二极管 + LDO + 电源灯 + 被测设备）
function psuBoard() {
  return {
    template: "psu", name: "9 V → 3.3 V 稳压模块", w: 80, h: 48, ground: "GND",
    nets: { VIN_RAW: "输入（防反前）", VIN: "输入（防反后）", "3V3": "3.3 V 输出", LED2A: "电源灯正极", GND: "地" },
    parts: [
      part("J1", "dcin", "DC 圆口输入（接 9 V 适配器）", 2, 16, 12, 14, { "+": "VIN_RAW", "-": "GND" }, { v: 9.0, r: 0.5, fp: "jack" }, { orient: 1 }),
      part("D1", "diode", "防反二极管", 18, 10, 12, 5, { A: "VIN_RAW", K: "VIN" }, { fp: "diode" }, { orient: 1 }),
      part("U1", "ldo", "3.3 V 线性稳压（SOT-223）", 34, 14, 14, 12, { IN: "VIN", GND: "GND", OUT: "3V3" }, { vout: 3.3, drop: 1.1, iq: 0.005, ilim: 0.8, fp: "sot223" }, { vout: 3.3 }),
      part("R2", "res", "电源灯电阻（丝印 220 Ω）", 54, 6, 12, 4, { 1: "3V3", 2: "LED2A" }, { ohms: 220, fp: "res" }, { ohms: 220 }),
      part("D2", "led", "电源指示灯", 70, 4, 7, 7, { A: "LED2A", K: "GND" }, { fp: "led" }, { orient: 1 }),
      part("RL", "load", "被测设备（3.3 V，约 50 mA，估算 66 Ω）", 56, 30, 20, 12, { 1: "3V3", 2: "GND" }, { ohms: 66, fp: "load" }, {}, { offBoard: true }),
    ],
    traces: [], wires: [], shorts: [], covers: [],
    testpoints: [{ id: "TP1", net: "VIN", x: 30, y: 30 }, { id: "TP2", net: "3V3", x: 50, y: 32 }, { id: "TP3", net: "GND", x: 40, y: 42 }],
    watch: { VIN: "VIN", "3V3": "3V3" },
    spec: [{ zh: "输出 3.2–3.4 V（带被测设备）", net: "3V3", v: [3.2, 3.4] }, { zh: "电源灯亮", led: "D2", mA: [3, 20] }, { zh: "U1 不烫手", notHot: "U1" }],
  };
}

// 传感器小板：USB 5 V → LDO 3.3 V → 主控 + I2C 传感器（上拉 R3/R4）+ 状态灯
function sensorBoard() {
  return {
    template: "sensor", name: "I2C 温湿度传感器小板", w: 90, h: 56, ground: "GND",
    nets: { "5V": "USB 5 V", "3V3": "3.3 V", "3V3_S": "传感器供电", SDA: "I2C 数据", SCL: "I2C 时钟", IO2: "状态灯 GPIO", LA: "状态灯正极", GND: "地" },
    parts: [
      part("J1", "dcin", "USB 供电口", 2, 20, 10, 12, { "+": "5V", "-": "GND" }, { v: 5.0, r: 0.2, fp: "usb" }, { orient: 1 }),
      part("U1", "ldo", "3.3 V 低压差稳压", 16, 18, 12, 10, { IN: "5V", GND: "GND", OUT: "3V3" }, { vout: 3.3, drop: 0.25, iq: 0.001, ilim: 0.6, fp: "sot223" }, { vout: 3.3 }),
      part("U2", "mcu", "主控模块（3.3 V）", 34, 14, 22, 26, { VCC: "3V3", GND: "GND", SDA: "SDA", SCL: "SCL", IO2: "IO2" }, { i: 0.04, bo: 2.8, vnom: 3.3, vio: 3.3, drive: { IO2: 1 }, i2c: { sda: "SDA", scl: "SCL", dev: "U3", addr: "44", pullTo: "3V3" }, fp: "module" }),
      part("R3", "res", "SDA 上拉（丝印 4.7k）", 62, 8, 10, 4, { 1: "3V3", 2: "SDA" }, { ohms: 4700, fp: "res" }, { ohms: 4700 }),
      part("R4", "res", "SCL 上拉（丝印 4.7k）", 62, 16, 10, 4, { 1: "3V3", 2: "SCL" }, { ohms: 4700, fp: "res" }, { ohms: 4700 }),
      part("U3", "sensor", "I2C 温湿度传感器（3.3 V）", 70, 28, 14, 14, { VCC: "3V3_S", GND: "GND", SDA: "SDA", SCL: "SCL" }, { i: 0.002, vmin: 2.4, vdmg: 4.0, fp: "qfn" }, {}, { cover: "SH1" }),
      part("R5", "res", "状态灯电阻（丝印 100 Ω）", 36, 46, 12, 4, { 1: "IO2", 2: "LA" }, { ohms: 100, fp: "res" }, { ohms: 100 }),
      part("D1", "led", "状态灯", 54, 44, 7, 7, { A: "LA", K: "GND" }, { fp: "led" }, { orient: 1 }),
    ],
    traces: [{ id: "T1", a: "3V3", b: "3V3_S", zh: "传感器供电走线", pts: [[58, 32], [66, 32], [70, 35]], state: {} }],
    wires: [], shorts: [],
    covers: [{ id: "SH1", zh: "传感器防尘罩", x: 66, y: 24, w: 22, h: 22, on: true }],
    testpoints: [{ id: "TP1", net: "3V3", x: 30, y: 8 }, { id: "TP2", net: "GND", x: 30, y: 50 }, { id: "TP3", net: "3V3_S", x: 86, y: 50 }],
    watch: { "3V3": "3V3", SDA: "SDA" },
    spec: [{ zh: "主控正常运行", mcu: "运行" }, { zh: "I2C 找到传感器", i2c: true }, { zh: "状态灯亮", led: "D1", mA: [3, 20] }],
  };
}

// 八爪鱼 v10 紧凑版的电源 / 舵机部分（拓扑来自项目 v10 物料清单）
//   1S 锂电（Adafruit 258）→ JST-PH → VBAT → 两块 MiniBoost 5 V（Adafruit 4654，页面：5.2 V 输出、3.5 V 输入时 1.1 A）→ 各 4 个舵机
//   开关（Adafruit 805）只切升压板 EN 和 QT Py 的 BAT；QT Py 用 100k/100k 分压测电池。充电板在这里简化成直通。
function octoBoard() {
  const servos = [], plugs = [], nets = {};
  for (let k = 0; k < 8; k++) {
    const rail = k < 4 ? "5VA" : "5VB";
    const x = 6 + (k % 4) * 22, y = k < 4 ? 4 : 70;
    plugs.push(part("P" + k, "conn", `舵机 ${k} 插针（信号 / 5 V / 地）`, x, k < 4 ? 18 : 60, 10, 5, { a1: "S" + k, a2: rail, a3: "GND", b1: `M${k}S`, b2: `M${k}V`, b3: `M${k}G` }, { pairs: 3, keyed: false, fp: "header3" }, { seat: "ok", flip: false }));
    servos.push(part("M" + k, "servo", `舵机 ${k}（微型 9 g 级）`, x, y, 16, 10, { S: `M${k}S`, V: `M${k}V`, G: `M${k}G` }, { iIdle: 0.01, iPeak: 0.1, sigPin: "S" + k, fp: "servo" }, {}, { offBoard: true }));
    nets["S" + k] = `舵机 ${k} 信号`; nets[`M${k}S`] = `舵机 ${k} 线（信号）`; nets[`M${k}V`] = `舵机 ${k} 线（电源）`; nets[`M${k}G`] = `舵机 ${k} 线（地）`;
  }
  return {
    template: "octo", name: "八爪鱼 v10 紧凑版（电源 + 舵机）", w: 96, h: 84, ground: "GND",
    nets: { "BAT+": "电池线红", "BAT-": "电池线黑", "JB+": "插头（电池侧）+", "JB-": "插头（电池侧）−", VBAT: "VBAT", EN: "开关后（EN / QT Py BAT）", SENSE: "电池分压", "5VA": "升压 A 5 V", "5VB": "升压 B 5 V", GND: "地", ...nets },
    parts: [
      part("BT1", "bat", "1S 1200 mAh 锂聚合物电池（Adafruit 258）", 2, 34, 14, 16, { "+": "BAT+", "-": "BAT-" }, { chem: "lipo1", v: 3.85, r: 0.06, fp: "battery" }, { ocv: 3.85, rint: 0.06, orient: 1 }, { offBoard: true }),
      part("J1", "conn", "JST-PH 2 脚电池插座", 20, 38, 8, 8, { a1: "JB+", a2: "JB-", b1: "VBAT", b2: "GND" }, { pairs: 2, keyed: true, fp: "jst2" }, { seat: "ok" }),
      part("SW1", "sw", "电源开关（Adafruit 805）", 32, 30, 10, 6, { a: "VBAT", b: "EN" }, { fp: "switch" }),
      part("U1", "mcu", "QT Py ESP32-S3（BAT 供电）", 46, 30, 18, 22, { VCC: "EN", GND: "GND", S0: "S0", S1: "S1", S2: "S2", S3: "S3", S4: "S4", S5: "S5", S6: "S6", S7: "S7", A3: "SENSE" }, { i: 0.08, bo: 3.4, vnom: 3.7, vio: 3.3, drive: { S0: 1, S1: 1, S2: 1, S3: 1, S4: 1, S5: 1, S6: 1, S7: 1 }, fw: { vbatStop: 3.55, vbatNet: "VBAT", stagger: 2e-3 }, fp: "module" }, {}, { cover: "TOP" }), // v18 我的补充：固件让 8 个舵机每隔 2 ms 依次起步，避开同时冲击
      part("R1", "res", "电池分压上（100k）", 34, 54, 10, 3, { 1: "VBAT", 2: "SENSE" }, { ohms: 100000, fp: "res" }, { ohms: 100000 }),
      part("R2", "res", "电池分压下（100k）", 34, 49, 10, 3, { 1: "SENSE", 2: "GND" }, { ohms: 100000, fp: "res" }, { ohms: 100000 }),
      part("U2", "boost", "MiniBoost 5 V · A（Adafruit 4654）", 70, 26, 14, 10, { IN: "VBAT", GND: "GND", OUT: "5VA", EN: "EN" }, { vout: 5.2, eff: 0.85, ilim35: 1.1, uvlo: 2.5, fp: "module" }, {}, { cover: "TOP" }),
      part("U3", "boost", "MiniBoost 5 V · B（Adafruit 4654）", 70, 44, 14, 10, { IN: "VBAT", GND: "GND", OUT: "5VB", EN: "EN" }, { vout: 5.2, eff: 0.85, ilim35: 1.1, uvlo: 2.5, fp: "module" }, {}, { cover: "TOP" }),
      // v18 我的补充：VBAT 上预留一个 470 µF 电解电容的空焊盘（默认不装），示波器演示“加 / 去掉储能电容”的效果
      part("C1", "cap", "VBAT 储能电容位（470 µF 电解，默认空）", 20, 50, 8, 6, { "+": "VBAT", "-": "GND" }, { c: 470e-6, esr: 0.06, polar: true, rated: 10, fp: "ecap" }, { present: false }),
      ...plugs, ...servos,
    ],
    traces: [],
    wires: [
      { id: "W1", a: "BAT+", b: "JB+", awg: 22, len: 0.08, zh: "电池引线（红）", state: { awg: 22, len: 0.08 } },
      { id: "W2", a: "BAT-", b: "JB-", awg: 22, len: 0.08, zh: "电池引线（黑）", state: { awg: 22, len: 0.08 } },
    ],
    shorts: [],
    covers: [{ id: "TOP", zh: "上壳（盖住主控和升压板）", x: 44, y: 24, w: 48, h: 34, on: true }],
    testpoints: [{ id: "TP1", net: "VBAT", x: 30, y: 56 }, { id: "TP2", net: "GND", x: 22, y: 56 }, { id: "TP3", net: "5VA", x: 90, y: 22 }, { id: "TP4", net: "5VB", x: 90, y: 58 }],
    watch: { VBAT: "VBAT", "5VA": "5VA", "5VB": "5VB" },
    spec: [{ zh: "主控不重启", mcu: "运行", run: true }, { zh: "8 个舵机都在动", servosMoving: 8, run: true }, { zh: "没有触发低压保护", noLowStop: true, run: true }],
    // 验收用的电池状态：半电 3.85 V（估算），这样“换一块满电电池”掩盖不了线太细的问题
    testBatt: { ocv: 3.85, rint: 0.06 },
  };
}

// v18：三块板用线缆连起来的“机器人底座”台架（我的补充）。电源板 → 控制板 / 舵机板。
// 元件参数除标注外都是估算：电解电容 ESR、线缆长度、压接电阻、舵机冲击电流都不是某个具体型号的规格书数值。
function rigBoard() {
  const servos = [];
  for (let k = 0; k < 4; k++) servos.push(part("M" + k, "servo", `舵机 ${k}（标准 9 g 级，估算）`, 114 + (k % 2) * 18, k < 2 ? 54 : 70, 14, 10, { S: `S${k}_S`, V: "5V_S", G: "GND_S" }, { iIdle: 0.01, iPeak: 0.12, iInrush: 0.8, tauInrush: 3e-3, iStall: 1.5, sigPin: "S" + k, fp: "servo" }, {}, { offBoard: true }));
  const hdr = (ref, zh, x, y, a, bPre, n) => { const pins = {}; a.forEach((net, i) => { pins["a" + (i + 1)] = net; pins["b" + (i + 1)] = `${bPre}${i + 1}`; }); return part(ref, "conn", zh, x, y, 4 + 4 * n, 6, pins, { pairs: n, keyed: true, fp: "jst" + n }, { seat: "ok" }); };
  const cable = (id, a, b, awg, len, zh, color) => ({ id, a, b, awg, len, zh, color, cable: true, state: { awg, len } });
  const nets = { VBAT: "电池", VSW: "开关后", "5V": "电源板 5 V", GND: "电源板地", "5V_C": "控制板 5 V 入口", GND_C: "控制板地", "3V3_C": "控制板 3.3 V", AVCC: "传感器供电（RC 滤波后）", AOUT: "传感器模拟输出", "5V_S": "舵机板 5 V", GND_S: "舵机板地" };
  for (let k = 0; k < 4; k++) { nets["S" + k] = `舵机 ${k} 信号（控制板）`; nets[`S${k}_S`] = `舵机 ${k} 信号（舵机板）`; }
  for (const [pre, n] of [["J1:", 2], ["J2:", 2], ["J3:", 2], ["J4:", 5], ["J5:", 2], ["J6:", 5]]) for (let i = 1; i <= n; i++) nets[pre + i] = `${pre.slice(0, 2)} 第 ${i} 脚（线缆侧）`;
  return {
    template: "rig", name: "三板台架：电源板 + 控制板 + 舵机板", w: 152, h: 88, ground: "GND",
    zones: [{ id: "PWR", zh: "电源板", x: 2, y: 8, w: 44, h: 76 }, { id: "CTL", zh: "控制板", x: 54, y: 8, w: 48, h: 76 }, { id: "SRV", zh: "舵机板", x: 108, y: 8, w: 42, h: 76 }],
    nets,
    parts: [
      part("BT1", "bat", "1S 锂聚合物电池（约 1200 mAh，估算）", 4, 12, 14, 16, { "+": "VBAT", "-": "GND" }, { chem: "lipo1", v: 3.85, r: 0.06, mAh: 1200, fp: "battery" }, { ocv: 3.85, rint: 0.06, orient: 1 }, { offBoard: true }),
      part("SW1", "sw", "电源开关", 24, 14, 10, 6, { a: "VBAT", b: "VSW" }, { fp: "switch" }),
      part("U1", "boost", "5 V 升压模块（1 A 级，估算）", 6, 36, 16, 12, { IN: "VSW", GND: "GND", OUT: "5V", EN: "VSW" }, { vout: 5.2, eff: 0.85, ilim35: 1.0, uvlo: 2.5, fp: "module" }),
      part("C1", "cap", "5 V 输出电解电容（470 µF / 10 V）", 28, 40, 8, 6, { "+": "5V", "-": "GND" }, { c: 470e-6, esr: 0.06, polar: true, rated: 10, fp: "ecap" }),
      hdr("J1", "到控制板的电源插座", 30, 60, ["5V", "GND"], "J1:", 2),
      hdr("J2", "到舵机板的电源插座", 30, 74, ["5V", "GND"], "J2:", 2),
      hdr("J3", "控制板电源入口", 56, 60, ["5V_C", "GND_C"], "J3:", 2),
      part("C2", "cap", "5 V 入口陶瓷电容（10 µF）", 58, 46, 8, 4, { "+": "5V_C", "-": "GND_C" }, { c: 10e-6, esr: 0.005, polar: false, rated: 16, fp: "0805" }),
      part("U2", "ldo", "3.3 V 低压差稳压", 70, 40, 12, 10, { IN: "5V_C", GND: "GND_C", OUT: "3V3_C" }, { vout: 3.3, drop: 0.25, iq: 0.001, ilim: 0.6, fp: "sot223" }, { vout: 3.3 }),
      part("C3", "cap", "3.3 V 陶瓷电容（22 µF）", 86, 42, 8, 4, { "+": "3V3_C", "-": "GND_C" }, { c: 22e-6, esr: 0.005, polar: false, rated: 10, fp: "0805" }),
      part("U3", "mcu", "主控模块（带无线，3.3 V）", 66, 14, 22, 20, { VCC: "3V3_C", GND: "GND_C", S0: "S0", S1: "S1", S2: "S2", S3: "S3" }, { i: 0.08, bo: 2.8, vnom: 3.3, vio: 3.3, drive: { S0: 1, S1: 1, S2: 1, S3: 1 }, burst: { i: 0.35, on: 0.5e-3, period: 5e-3 }, fw: { stagger: 0, startDelay: 30e-3 }, fp: "module" }), // 我的补充：开机 30 ms 后 4 个舵机同时起步（固件没有错开）
      part("R6", "res", "传感器供电滤波电阻（丝印 33 Ω）", 88, 54, 10, 3, { 1: "3V3_C", 2: "AVCC" }, { ohms: 33, fp: "res" }, { ohms: 33 }),
      part("C4", "cap", "传感器去耦电容（10 µF）", 88, 62, 8, 4, { "+": "AVCC", "-": "GND_C" }, { c: 10e-6, esr: 0.005, polar: false, rated: 10, fp: "0805" }),
      part("U4", "asensor", "模拟传感器（输出 = 0.5 × 供电，估算）", 70, 64, 12, 10, { VCC: "AVCC", GND: "GND_C", OUT: "AOUT" }, { i: 0.002, k: 0.5, rOut: 100, pulse: { i: 0.005, on: 20e-6, period: 200e-6 }, fp: "qfn" }),
      hdr("J4", "到舵机板的信号插座（4 信号 + 地）", 56, 76, ["S0", "S1", "S2", "S3", "GND_C"], "J4:", 5),
      hdr("J5", "舵机板电源入口", 110, 12, ["5V_S", "GND_S"], "J5:", 2),
      hdr("J6", "舵机板信号入口", 124, 12, ["S0_S", "S1_S", "S2_S", "S3_S", "GND_S"], "J6:", 5),
      part("C5", "cap", "舵机储能电解电容（1000 µF / 10 V）", 112, 34, 10, 8, { "+": "5V_S", "-": "GND_S" }, { c: 1000e-6, esr: 0.04, polar: true, rated: 10, fp: "ecap" }),
      ...servos,
    ],
    traces: [],
    wires: [
      cable("CB1+", "J1:1", "J3:1", 24, 0.2, "电源线缆 1 红（电源板 → 控制板）", "#d42"),
      cable("CB1-", "J1:2", "J3:2", 24, 0.2, "电源线缆 1 黑（电源板 → 控制板）", "#222"),
      cable("CB2+", "J2:1", "J5:1", 20, 0.2, "电源线缆 2 红（电源板 → 舵机板）", "#d42"),
      cable("CB2-", "J2:2", "J5:2", 20, 0.2, "电源线缆 2 黑（电源板 → 舵机板）", "#222"),
      ...[1, 2, 3, 4].map((i) => cable("CB3-" + i, "J4:" + i, "J6:" + i, 30, 0.3, `信号排线第 ${i} 根（舵机 ${i - 1} 信号）`, "#e8b04a")),
      cable("CB3G", "J4:5", "J6:5", 30, 0.3, "信号排线的地线（控制板地 ↔ 舵机板地）", "#555"),
    ],
    shorts: [], covers: [],
    testpoints: [{ id: "TP1", net: "VBAT", x: 38, y: 14 }, { id: "TP2", net: "GND", x: 38, y: 30 }, { id: "TP3", net: "5V", x: 40, y: 50 }, { id: "TP4", net: "5V_C", x: 62, y: 54 }, { id: "TP5", net: "3V3_C", x: 96, y: 36 }, { id: "TP6", net: "GND_C", x: 96, y: 76 }, { id: "TP7", net: "AOUT", x: 86, y: 80 }, { id: "TP8", net: "5V_S", x: 128, y: 32 }, { id: "TP9", net: "GND_S", x: 140, y: 32 }],
    watch: { "5V": "5V", "5V_C": "5V_C", "3V3_C": "3V3_C", "5V_S": "5V_S" },
    spec: [
      { zh: "主控运行", mcu: "运行", run: true },
      { zh: "4 个舵机都在动", servosMoving: 4, run: true },
      { zh: "控制板 5 V 入口 ≥ 4.75 V（运行中）", net: "5V_C", v: [4.75, 5.4], run: true },
      { zh: "上电 + 舵机起步：主控不复位、升压不打嗝", tr: { exp: "power", run: true, tdiv: 10e-3, pre: 0.05 }, noReset: "U3", noHiccup: "U1" },
      { zh: "运行中 5 V 纹波 ≤ 35 mV（示波器）", tr: { exp: "steady", run: true, tdiv: 5e-6 }, ripple: { node: "5V", max: 0.035 } },
      { zh: "传感器输出噪声 ≤ 30 mV（示波器）", tr: { exp: "steady", run: true, tdiv: 50e-6 }, ripple: { node: "AOUT", max: 0.03 } },
      { zh: "控制板地 ↔ 舵机板地压差 ≤ 40 mV（运行中）", tr: { exp: "run", run: true, tdiv: 2e-3, skip: 8e-3 }, diff: { a: "GND_S", b: "GND_C", max: 0.04 } },
    ],
  };
}

export const TEMPLATES = { led: { zh: "LED 夜灯小板", make: ledBoard }, psu: { zh: "9 V → 3.3 V 稳压模块", make: psuBoard }, sensor: { zh: "I2C 传感器小板", make: sensorBoard }, octo: { zh: "八爪鱼 v10 紧凑版", make: octoBoard } };
// v18 新模板单独放，v17 的编辑器 / 测试按原来的 4 个模板计数
export const TEMPLATES_V18 = { rig: { zh: "三板台架（电源 / 控制 / 舵机）", make: rigBoard } };
export const ALL_TEMPLATES = { ...TEMPLATES, ...TEMPLATES_V18 };
export const makeBoard = (t) => clone(ALL_TEMPLATES[t].make());

// 焊盘位置：两脚零件放在左右两端，多脚零件沿下边一排
export function padsOf(p) {
  if (p.pinPos) return p.pinPos;
  const pins = Object.keys(p.pins);
  const out = {};
  if (pins.length === 2) { out[pins[0]] = [p.x + 1.5, p.y + p.h / 2]; out[pins[1]] = [p.x + p.w - 1.5, p.y + p.h / 2]; return out; }
  if (p.kind === "conn") {
    const n = p.props.pairs;
    for (let k = 1; k <= n; k++) { const x = p.x + (p.w * (k - 0.5)) / n; out["a" + k] = [x, p.y + 1]; out["b" + k] = [x, p.y + p.h - 1]; }
    return out;
  }
  pins.forEach((pin, i) => { out[pin] = [p.x + (p.w * (i + 0.5)) / pins.length, p.y + p.h - 1.5]; });
  return out;
}
