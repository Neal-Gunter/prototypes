// 八爪鱼指南数据：物料（台面实际摆的零件，不含价格）、md 原价（标“来自你的 md”）、接线、引脚表、对照现实、出处表、md 问题清单、md 原文代码。
import INO from "./md/body_firmware_A.ino?raw";
import BUS from "./md/octopus_bus.h?raw";
import GAIT from "./md/octopus_gait.h?raw";
import BODY from "./md/octopus_body.h?raw";
import MCP from "./md/octopus_mcp.cpp?raw";
import { FAULTS, PHASES } from "./bench.js";
import { FIX_LIST } from "./firmware.js";
import { DEVKIT_J1, DEVKIT_J3 } from "./parts.js";

export const MD_SOURCES = { "body_firmware_A.ino": INO, "octopus_bus.h": BUS, "octopus_gait.h": GAIT, "octopus_body.h": BODY, "octopus_mcp.cpp": MCP };

// —— md 里的价格（原样抄，不改不补）——
export const MD_PRICES = {
  note: "价格全部来自你的 md（2026 年给的文档），台面物料表不写价格。md 没有单独的方案 A 物料表，README §2 只写了“舵机成本 ~60 元”。",
  readmeB: { src: "README §3 物料清单（方案 B）", rows: [
    ["主控", "ESP32-S3 N16R8 开发板", "1", "¥45"], ["麦克风", "INMP441 数字麦克风", "1", "¥5"], ["功放", "MAX98357A 模块", "1", "¥6"], ["喇叭", "8Ω 2W 小喇叭", "1", "¥4"],
    ["屏幕", "SSD1306 OLED 0.96\"（可选）", "1", "¥10"], ["舵机驱动", "PCA9685 16 路模块", "1", "¥12"], ["舵机", "MG90S 金属齿（别用 SG90）", "16", "¥12"], ["降压", "XL4015 DC-DC 5A", "1", "¥8"],
    ["电池", "2S 航模/21700 电池组 7.4V", "1", "¥35"], ["充电", "2S 平衡充 / TP4056×2", "1", "¥15"], ["被动件", "220µF 电解电容、端子、杜邦线", "若干", "¥15"], ["结构", "PLA 打印料 ~200g", "1", "¥20"],
  ], total: "md 写“合计约 ¥350”（按表逐项加：舵机按单价 ×16 是 ¥367；按 ¥12 总价是 ¥187——md 没说清 ¥12 是单价还是总价）" },
  servoCost: { src: "README §2 三档方案选型", rows: [["方案 A", "~60 元"], ["方案 B", "~150 元"], ["方案 C", "~250 元"]] },
  batches: { src: "采购清单-零基础", rows: [
    ["第一批", "立创·实战派 ESP32-S3 开发板 ×1", "¥148"], ["第二批", "PCA9685 ×1", "¥12~25"], ["第二批", "MG90S ×4", "¥5~8/个"], ["第二批", "5V 6A 电源适配器", "¥20~30"], ["第二批", "DC 母头转接线", "¥3"], ["第二批", "杜邦线一套", "¥6"], ["第二批", "小号十字螺丝刀", "¥5"],
    ["第三批", "MG90S 再买 12 个", "¥60~95"], ["第三批", "PLA 耗材 1kg", "¥50"], ["第三批", "220µF 电解电容 ×4", "¥3"], ["第三批", "扎带 / 双面胶 / 热熔胶枪", "¥20"],
    ["无线化", "最小 ESP32-S3 开发板（DevKitC-1 或兼容）", "¥25~35"], ["无线化", "2S 锂聚合物电池 7.4V 2000mAh（带保护板）", "¥35~50"], ["无线化", "XL4015 降压模块", "¥8"], ["无线化", "2S USB-C 平衡充", "¥15"], ["无线化", "电池低压检测", "¥5"],
  ] },
};

// —— 台面引脚表（ESP32‑S3‑DevKitC‑1 排针位置 ↔ GPIO ↔ 接到哪）——
export function pinMap(bench) {
  const rows = [];
  const hdr = (pin) => { const [h, n] = pin.split("."); const L = h === "J1" ? DEVKIT_J1 : DEVKIT_J3; return L?.[+n - 1] || pin; };
  for (const w of bench.wires) {
    for (const [me, other] of [[w.a, w.b], [w.b, w.a]]) if (me[0] === "ESP") rows.push({ pin: me[1], gpio: hdr(me[1]), to: `${other[0]} ${other[1]}`, why: w.why, md: w.md });
  }
  return rows.sort((a, b) => a.pin.localeCompare(b.pin, "en", { numeric: true }));
}

// —— 对照现实：台面和真东西不一样的地方 ——
export const REALITY = [
  ["主控", "md 写“ESP32-S3 N16R8 开发板”（README）/“最小 ESP32-S3 板，如 DevKitC-1”（无线架构 §8）。台面摆的是 DevKitC-1 外形（程序生成，尺寸按乐鑫资料 63×25.4 mm 左右），上面的 WROOM-1 模组是库里的真实 CAD。", "估算"],
  ["INMP441 / OLED / XL4015 / 2S 电池", "库里没有这些模块的 CAD，按常见模块尺寸程序生成（INMP441 约 14×14 mm、0.96\" OLED 约 27×27 mm、XL4015 约 51×26 mm、2S 2000 mAh 约 70×34×18 mm）。", "估算"],
  ["PCA9685 / MAX98357A / 喇叭 / MG90S / 220µF", "用库里的真实 CAD：PCA9685 用 Adafruit 815、功放用 Adafruit 3006、喇叭用 Adafruit 3923（8 Ω 1 W 椭圆，md 写 8 Ω 2 W，最接近的真实件）、舵机用 Adafruit 1143（MG90S 同尺寸金属齿微型舵机）、电容用 KiCad Φ6.3 mm 电解。", "最接近的真实件"],
  ["降压模块", "md 写一块 XL4015 同时出 6 V 和 5 V——一块 XL4015 只有一路输出。台面放了两块（6 V 给舵机、5 V 给 ESP32）。另外 XL4015 标称输入 8–36 V，2S 电池满电 8.4 V、标称 7.4 V，大部分时间低于下限：现实里建议换低压差的降压（文档未写型号）。", "补充"],
  ["机身", "md 只写“躯干约 10 cm、触手 7–9 cm”，没有结构图。骨架（底板 + 立柱 + 上层板）和触手是本项目按这个尺寸设计的，全部估算。", "估算"],
  ["方案 B 结构", "md 只写“每条 2 个舵机（偏航 + 俯仰）”。台面把俯仰舵机侧躺装在偏航舵盘的支架上——这样 10 cm 躯干上相邻俯仰舵机只剩约 5° 的相对摆动空间（估算），按 md 默认 38° 摆幅会互相顶住。现实里需要更大的躯干或更小的摆幅。", "估算"],
  ["导线", "按引脚连接；长度按走线计（真实杜邦线 20/30 cm，多出来的要扎好）。舵机线 25 cm 盘在机身里。电容只摆在舵机旁，没画到每个舵机的导线（示意）。", "示意"],
  ["固件", "md 的 C++ 逐行移植成 JS，FreeRTOS 任务换成协程；I2C 写进一个寄存器级的 PCA9685 替身（MODE1 / PRESCALE / LEDn）。“全部原样”时行为和 md 代码一致（包括 bug），“修正”逐项可开关。", "仿真"],
  ["语音 / 大模型 / 无线", "小智的语音、云端大模型、WiFi、BLE / 蓝牙串口都是模拟：对话框用关键词规则把一句中文翻成 MCP 调用或串口指令。", "模拟"],
  ["运动", "舵机按脉宽→角度、限速、机械止位、堵转电流估算；桌面爬行用二维库仑摩擦估算，3D 机身不跟着走（看俯视轨迹）。", "估算"],
  ["电", "电池内阻、降压压差、ESP32 欠压复位门限（4.3 V）、舵机电流都是估算，不是 SPICE。", "估算"],
];

// —— 出处表：台面每一样东西 ← md 哪一节 ——
export const TRACE = [
  ["方案 A = 8 个舵机、每条只有偏航", "README §2 三档方案选型"],
  ["方案 B = 16 个舵机、偏航 + 俯仰", "README §2 / §3"],
  ["ESP32-S3 主控", "README §3；无线架构 §8（最小板 DevKitC-1）"],
  ["INMP441 / MAX98357A / 喇叭 / OLED", "README §3；采购清单 第一批（实战派板载）"],
  ["PCA9685 一块", "README §2（A/B 都是 1 块）、§3"],
  ["MG90S 金属齿", "README §3（别用 SG90）；采购清单 第二批 选购要点"],
  ["2S 7.4 V 电池 → XL4015 → 6 V 舵机 / 5 V ESP32", "README §4；无线架构 §6"],
  ["第二块降压（5 V）", "补充（md 只写一块）"],
  ["220µF 每个舵机旁一个", "README §4 电源三原则 3"],
  ["GPIO 8/9 = I2C SDA/SCL，PCA9685 + OLED 同一条总线", "README §4；body_firmware_A.ino I2C_SDA / I2C_SCL"],
  ["GPIO 5/4/6 → INMP441 SCK/WS/SD", "README §4"],
  ["GPIO 15/16/7 → MAX98357A BCLK/LRC/DIN", "README §4"],
  ["3V3 → PCA9685 VCC（只给逻辑）", "README §4"],
  ["舵机 V+ 只走 PCA9685 螺丝端子、全部共地", "README §4 电源三原则 1、2"],
  ["通道映射 kSingle8 = 第 n 条触手 → CHn；kDual16 = 2n / 2n+1", "octopus_body.h ChannelOf()"],
  ["0 号触手在正前方，顺时针排布（每 45°）", "octopus_gait.h MountAngle() 注释"],
  ["步态起点 0.6 Hz / 38° / duty 0.65 / phase 45°", "README §7；octopus_gait.h GaitParams"],
  ["串口指令 GO / LEFT / RIGHT / STOP / HOME / WAVE n / PULSE n / GAIT", "body_firmware_A.ino handleCommand()；手机控制指南 §4"],
  ["MCP 工具 self.octopus.move / set_gait", "octopus_mcp.cpp"],
  ["50 Hz PWM、SoftHome 分时上电", "README §8；octopus_bus.h / octopus_body.h"],
  ["低压截止 6.4 V", "无线架构 §6；采购清单 无线化追加清单"],
  ["15 s 没指令自动停（AUTO_REST）", "body_firmware_A.ino"],
  ["阶段 0–5", "README §7 推进顺序"],
  ["故障场景", "采购清单 故障表；README §8；补充项标“补充”"],
  ["麦克风和喇叭 ≥ 5 cm", "README §8"],
];

// —— 你的 md 里我觉得不对 / 不清楚的地方 ——
export const MD_ISSUES = [
  "“方案 A”有两个意思：README 里是 8 舵机入门版；手机控制指南 / 无线架构里是“手动蓝牙控制”。而 body_firmware_A.ino 写的是 kDual16（16 舵机）。台面：方案 A = 8 舵机，固件修正项“rig8”把它改成 kSingle8。",
  "README §1 / §5 对 xiaozhi-esp32-pet、MT3608 升压的说法前后不一致（§5 建议照抄它的 BSP，但本方案是降压供电）。",
  "采购清单第二批用 GPIO1/2 做 I2C、5 V 6 A 适配器供舵机；README / .ino 用 GPIO8/9、6 V 电池。台面按 README。",
  "无线版（手机大脑）去掉了板上音频，但 README 的接线仍然有麦克风 / 功放；.ino 完全没用麦克风、功放、OLED。台面阶段 0 单独跑语音（模拟），阶段 3 起这些件只是接着。",
  "一块 XL4015 只有一路输出，做不到同时 6 V 和 5 V；台面加了第二块（补充）。",
  "XL4015 标称输入 8–36 V，2S 电池 6.4–8.4 V 大部分时间低于下限（台面给出警告）。",
  "kSingle8 下 WaveOnce / Pulse 只写俯仰（lift），8 舵机版本挥手和脉冲收缩没有任何动作。",
  "MCP：home 实际调用 Rest；steps 参数被忽略；speed 300–3000 ms 换成频率最高 3.3 Hz，超过 md 自己写的 1.2 Hz 上限。",
  "ESP32-S3 没有经典蓝牙，BluetoothSerial 编译不过（要换 BLE UART，无线架构 §10 才是 BLE）。",
  "octopus_body.h 的 Pca9685 boards_[3] 需要默认构造函数，但 Pca9685 只有带参构造，编译不过。",
  "last_written_ 初值全是 0，SoftHome 第一轮 Tick 就把所有通道同时写出，“分时上电”没有生效；README 说峰值 2.3→1.3 A，无线架构又说“平均 3~5A 峰值”，两个数对不上。",
  "GAIT 指令先 toUpperCase() 再找小写的 f= / yaw= …，永远匹配不上，等于调不了参。",
  "Lateriality() 用 sin(安装角) 区分左右，实际区分的是前后，LEFT / RIGHT 转不了弯；转弯增益 1.85 × 38° ≈ 70°，超过相邻触手 45° 的间隔。",
  "脉宽范围 150–600（0.73–2.93 ms）：90° 对应 1.83 ms，MG90S 常见 1.5 ms 中位，中位会偏约 30°。",
  "HOME / Rest 在 loop 里直接动 bank_，和运动任务同时写，存在竞争。",
  "ReleaseHard() 在 loop 里连 Tick 20 次 = 瞬间跳回中位；Rest 也没有真正关 PWM（舵机仍然出力）。",
  "GPIO4 同时被写成麦克风 WS 和（无线架构里的）电池电压检测，冲突。",
  "“TP4056×2”给 2S 串联电池充电是危险的（TP4056 是单节充电芯片，串联充会过充）；采购清单后面也说了“别用普通单芯充”。",
  "MG90S 价格前后不一致：¥12（README）、¥5~8/个（采购清单）、12 个 ¥60~95。",
  "README 合计“约 ¥350”与逐项相加（¥367，按舵机单价算）不一致。",
  "方案 A 的电源示意也写“16 路舵机”。",
  "md 写“ESP32 的 VIN/5V 引脚”，DevKitC-1 丝印是“5V”，没有 VIN。",
  "PCA9685 从 SLEEP 唤醒后要等 ≥500 µs 才能开 RESTART，代码里没写等待（台面的固件替身照原样，不报错）。",
  "很多细节文档没写：麦克风 / 功放 / OLED 的供电脚、L/R 脚、PCA9685 的 OE 脚、电池接口、开关、保险丝、电容的具体接法。台面上这些都标“文档未写”。",
  "无线架构里“立创实战派”一处是乱码（“立��实战派”）。",
  "AUTO_REST：15 s 没有新指令就自动停，所以 GO 之后不发指令它只会爬 15 s（这是特性，不是 bug，但手机控制指南没提）。",
  "（台面模型推测，估算，需要实物验证）md 的 CPG 里八条触手往同一个方向摆、相位按安装角递增：在台面的摩擦模型里，方案 B 主要是原地转圈、方案 A 只是“蹭”，并不是向前爬。",
  "（估算）方案 B 按 10 cm 躯干装 16 个 MG90S，俯仰舵机侧躺时相邻两条之间只剩约 5° 的相对摆动空间，md 默认 38° 摆幅会互相顶住。",
];

export function octoGuide(sim, engine) {
  const B = sim.bench;
  const bom = [];
  if (engine) {
    const m = new Map();
    for (const p of engine.parts.values()) {
      const d = p.def, k = d.id;
      if (!m.has(k)) m.set(k, { id: k, zh: d.name_zh || d.name, n: 0, real: !/^p-/.test(k), dims: d.dims_mm, src: d.dims_src || "", licence: d.licence || "" });
      m.get(k).n++;
    }
    bom.push(...m.values());
    const c = new Map();
    for (const cb of engine.cables) c.set(cb.kind, (c.get(cb.kind) || 0) + 1);
    for (const [k, n] of c) bom.push({ id: k, zh: { "octo-dupont-20": "杜邦线 20 cm", "octo-dupont-30": "杜邦线 30 cm", "octo-wire": "电源线（估算 20 AWG）", "octo-servo": "舵机引线（MG90S 自带 25 cm，估算）" }[k] || k, n, real: false, cable: true });
  }
  else {
    const zh = { ESP: "ESP32‑S3‑DevKitC‑1（程序生成，估算）", PCA: "PCA9685 16 路（Adafruit 815 CAD）", MIC: "INMP441（程序生成，估算）", AMP: "MAX98357A（Adafruit 3006 CAD）", SPK: "喇叭（Adafruit 3923 CAD）", BAT: "2S 7.4 V 锂电池（程序生成，估算）", U1: "XL4015 降压 6 V（程序生成，估算）", U2: "XL4015 降压 5 V（补充，程序生成）", OLED: "0.96\" OLED（程序生成，估算）" };
    for (const r of B.roles) bom.push({ id: r, zh: zh[r] || r, n: 1, real: ["PCA", "AMP", "SPK"].includes(r) });
    if (B.servos.length) bom.push({ id: "ada-1143", zh: "MG90S 舵机（Adafruit 1143 CAD）", n: B.servos.length, real: true });
    if (B.caps) bom.push({ id: "cap", zh: "220µF 电解电容（KiCad CAD）", n: B.caps, real: true });
  }
  return {
    title: `小智八爪鱼 方案${B.plan}`, plan: B.plan, phase: B.phase, phaseZh: PHASES.find((p) => p.k === B.phase)?.zh, fault: FAULTS.find((f) => f.k === B.fault)?.zh,
    fixes: FIX_LIST.filter((f) => sim.o.F[f.k]).map((f) => f.zh), mode: sim.o.mode,
    created: new Date().toISOString(),
    bom, wires: B.wires.map((w) => ({ a: w.a.join(" "), b: w.b.join(" "), why: w.why, md: w.md, kind: w.kind })),
    pinmap: pinMap(B), servos: B.servos,
  };
}
