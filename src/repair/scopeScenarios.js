// v18 示波器关卡：全部用三板台架 rig（电源板 + 控制板 + 舵机板，用排线 / 插头连起来）。
// 每关的 scopeExpect = 示波器上能看到的故障特征：cap 是抓波形的设置，metric 是从波形里取的量（min / max / pp / mean，或复位 / 打嗝次数），
// faulty / fixed 是故障时 / 修好后应落的区间（由 scripts/scope-test.mjs 验证）。所有零件参数是估算或同类常见值，见 boards.js。
// 早期原型，简化仿真：理想化元件，没有 EMI、热、寄生参数（只有写明的 ESR / 线阻 / 端子接触电阻）。
const BAT_OUT = [{ a: "power", on: false }, { a: "battery", op: "remove" }];
const BAT_IN = [{ a: "battery", op: "insert" }];
const S = (zh, cap, metric, faulty, fixed) => ({ zh, cap, metric, faulty, fixed });
const POWER = (chans, tdiv = 10e-3) => ({ exp: "power", run: true, tdiv, pre: 0.05, chans, trig: { src: 0, slope: "rise", level: 2.5, mode: "auto" } });
const RUN = (chans, tdiv = 2e-3) => ({ exp: "run", run: true, tdiv, pre: 0.1, chans });
const STEADY = (chans, tdiv) => ({ exp: "steady", run: true, tdiv, chans });

export const SCOPE_SCENARIOS = [
  {
    id: "rig-missing-bulk", stars: 3, template: "rig", title: "舵机一起步，主控就重启", parMin: 15, scope: true,
    complaint: "机器人一开机，腿刚要动就“咔”地停住，主控灯闪一下重来，一直循环。电池是满的。",
    symptoms: ["开机后约 30 ms 舵机起步，主控随即复位，循环往复", "万用表看 5 V 一直是 5.2 V 左右（万用表太慢，看不到跌落）"],
    faults: [{ type: "missingPart", target: "C5" }],
    scopeExpect: [
      S("控制板 3.3 V 在舵机起步时的最低值", POWER([{ node: "3V3_C", label: "3V3" }, { node: "5V_S", label: "舵机 5V" }]), { type: "min", ch: 0, after: 0.025 }, [0, 2.85], [3.0, 3.4]),
      S("抓开机到起步这段，主控复位次数", POWER([{ node: "3V3_C" }]), { type: "events", dev: "U3", kind: "reset" }, [1, 99], [0, 0]),
    ],
    solution: [[...BAT_OUT, { a: "place", ref: "C5", item: "cap-1000u", orient: 1 }, ...BAT_IN]],
    wrong: [[...BAT_OUT, { a: "place", ref: "C5", item: "cap-100n" }, ...BAT_IN], [...BAT_OUT, { a: "battery", op: "insert", item: "bat-lipo-full" }]],
    hints: ["“一动就重启”是典型的电源跌落。万用表太慢看不到，要用示波器单次触发抓开机那一下。", "探头夹 3V3_C（TP5）和舵机板 5V_S（TP8），时基 10 ms/div，单次触发，看舵机起步那一刻掉到多少。", "舵机板上 C5 位置是空的：补一颗 1000 µF / 10 V 电解电容（负极条对着丝印的“−”）。"],
    rootCause: "舵机板的储能电容 C5 没装。4 个舵机同时起步的冲击电流（每个约 0.8 A，估算）远超升压模块的限流，5 V 被拉低，LDO 跟着掉到 2.8 V 以下，主控欠压复位。",
    lesson: "大电流负载旁边要有储能电容，靠它在几毫秒内顶住冲击电流；电源问题用示波器“单次触发”抓，万用表只看得到平均值。",
    safety: ["电解电容有极性，装反会鼓包甚至喷液，焊前看清负极条", "锂电池拆装时别让 + − 线碰在一起"],
  },
  {
    id: "rig-dried-cap", stars: 3, template: "rig", title: "放久了的机器人，电源嗡嗡响、偶尔重启", parMin: 18, scope: true,
    complaint: "这台在仓库放了两年，拿出来能用，但开机偶尔会重启，传感器读数也有点跳。",
    symptoms: ["5 V 平均值正常", "偶尔开机重启"],
    faults: [{ type: "driedCap", target: "C1", arg: { c: 47e-6, esr: 3 } }],
    scopeExpect: [
      S("5 V 上的开关纹波（AC 耦合，峰峰值）", STEADY([{ node: "5V", label: "5V", coupling: "AC" }], 5e-6), { type: "pp", ch: 0 }, [0.036, 0.2], [0, 0.034]),
      S("开机时升压模块打嗝次数", POWER([{ node: "5V" }]), { type: "events", dev: "U1", kind: "boost-hiccup" }, [1, 99], [0, 0]),
    ],
    solution: [[...BAT_OUT, { a: "desolder", ref: "C1" }, { a: "place", ref: "C1", item: "cap-470u", orient: 1 }, ...BAT_IN]],
    wrong: [[...BAT_OUT, { a: "desolder", ref: "C1" }, { a: "place", ref: "C1", item: "cap-100n" }, ...BAT_IN], [...BAT_OUT, { a: "desolder", ref: "C1" }, { a: "place", ref: "C1", item: "cap-470u", orient: -1 }, ...BAT_IN]],
    hints: ["平均电压正常不代表电源干净。用示波器 AC 耦合看 5 V 上的纹波。", "纹波比正常大一倍左右，说明输出电容不起作用了。用放大镜看电源板上的 C1。", "C1 顶部鼓起、底部有干涸的电解液：电解电容干了（容量掉、ESR 变大）。换一颗同规格 470 µF / 10 V，注意极性。"],
    rootCause: "电源板输出电解电容 C1 老化干涸，容量从 470 µF 掉到约 47 µF、ESR 升到约 3 Ω（估算），滤不掉开关纹波，也顶不住开机冲击。",
    lesson: "电解电容会老化（尤其是高温存放）。“平均值对、纹波大”是典型症状；示波器 AC 耦合 + 小 V/div 才看得出来。",
    safety: ["鼓包的电容可能漏出腐蚀性电解液，拆下后用酒精清理焊盘", "电解电容装反通电会发热甚至喷液"],
  },
  {
    id: "rig-stalled-servo", stars: 4, template: "rig", title: "升压模块一直在限流", parMin: 20, scope: true,
    complaint: "机器人摔了一跤以后就动不了了，电源模块那里有点烫，还有“嗡嗡”声。",
    symptoms: ["主控反复重启", "一个舵机发出嗡嗡声，舵盘拧不动"],
    faults: [{ type: "stalledServo", target: "M2" }],
    scopeExpect: [
      S("舵机起步 8 ms 后 5V_S 的平均值（升压在限流 / 打嗝）", RUN([{ node: "5V_S", label: "舵机 5V" }], 2e-3), { type: "mean", ch: 0, after: 0.008 }, [0, 4.5], [4.8, 5.3]),
      S("舵机起步后主控复位次数", RUN([{ node: "3V3_C" }], 5e-3), { type: "events", dev: "U3", kind: "reset" }, [1, 99], [0, 0]),
    ],
    solution: [[...BAT_OUT, { a: "swapServo", ref: "M2" }, ...BAT_IN]],
    wrong: [[...BAT_OUT, { a: "desolder", ref: "C5" }, { a: "place", ref: "C5", item: "cap-2200u", orient: 1 }, ...BAT_IN], [...BAT_OUT, { a: "battery", op: "insert", item: "bat-lipo-full" }]],
    hints: ["示波器看 5V_S：起步之后电压一直上不去，像是被“压住”了——升压模块在限流。", "是谁吃掉了这么多电流？逐个看舵机：用手拧舵盘、用放大镜看。", "M2 摔坏卡死（堵转，约 1.5 A，估算），把升压拖进限流。换一个同型号舵机。"],
    rootCause: "M2 齿轮卡死堵转，堵转电流加上其他 3 个舵机超过升压模块限流，5 V 被压到 3 V 左右，主控跟着复位。加电容、换满电电池都只是暂时顶一下。",
    lesson: "电源一直在限流时，先找“谁在吃电流”，而不是加大电源或加电容。堵转的电机是最常见的元凶。",
    safety: ["堵转的舵机很快会烫手，先断电再检查", "别用手硬掰通电中的舵机"],
  },
  {
    id: "rig-noisy-sensor", stars: 3, template: "rig", title: "传感器读数一直在跳", parMin: 15, scope: true,
    complaint: "姿态 / 距离读数一直在抖，换了传感器也一样。",
    symptoms: ["万用表量 AOUT 平均值正常", "读数抖动随无线发射变大"],
    faults: [{ type: "missingPart", target: "C4" }],
    scopeExpect: [
      S("传感器输出 AOUT 的噪声（AC 耦合峰峰值）", STEADY([{ node: "AOUT", label: "AOUT", coupling: "AC" }, { node: "AVCC", label: "AVCC", coupling: "AC" }], 50e-6), { type: "pp", ch: 0 }, [0.031, 1], [0, 0.03]),
      S("传感器电源 AVCC 的噪声（AC 耦合峰峰值）", STEADY([{ node: "AVCC", label: "AVCC", coupling: "AC" }], 50e-6), { type: "pp", ch: 0 }, [0.06, 2], [0, 0.03]),
    ],
    solution: [[...BAT_OUT, { a: "place", ref: "C4", item: "cap-10u" }, ...BAT_IN]],
    wrong: [[...BAT_OUT, { a: "place", ref: "C4", item: "cap-100n" }, ...BAT_IN], [...BAT_OUT, { a: "desolder", ref: "C3" }, { a: "place", ref: "C3", item: "cap-1000u", orient: 1 }, ...BAT_IN]],
    hints: ["示波器 AC 耦合同时看 AOUT 和 AVCC：两者的抖动是不是同步的？", "噪声来自传感器的电源。R6 后面应该有一颗去耦电容。", "C4 没装：补一颗 10 µF 陶瓷电容（100 nF 对这个频率不够大）。"],
    rootCause: "传感器电源 RC 滤波（R6 33 Ω + C4）里的 C4 没装，主控无线发射和传感器自身的脉冲电流直接在 AVCC 上产生波动，传进 AOUT。",
    lesson: "模拟信号抖动，先看它的电源干不干净。去耦电容要放在用电的芯片旁边，换别处的大电容没用。",
    safety: ["贴片电容很小，焊接时用镊子按住，别被烙铁烫到手"],
  },
  {
    id: "rig-cable-ground", stars: 4, template: "rig", title: "舵机一动，传感器就乱（三块板）", parMin: 22, scope: true,
    complaint: "三块板拆开重新装过一次之后，舵机一动，舵机的位置就乱跳，偶尔还抽一下。",
    symptoms: ["每块板单独看都正常", "舵机动作时信号乱"],
    faults: [{ type: "openCrimp", target: "CB2-" }],
    scopeExpect: [
      S("舵机板地 GND_S 相对控制板地 GND_C 的压差（数学 A−B）", { ...RUN([{ node: "GND_S", label: "舵机板地" }, { node: "GND_C", label: "控制板地" }]), math: { a: 0, b: 1 } }, { type: "mathMax", after: 0.008 }, [0.041, 1], [0, 0.04]),
    ],
    solution: [[...BAT_OUT, { a: "recrimp", id: "CB2-" }, ...BAT_IN]],
    wrong: [[...BAT_OUT, { a: "reseat", ref: "J2" }, { a: "reseat", ref: "J5" }, ...BAT_IN], [...BAT_OUT, { a: "desolder", ref: "C5" }, { a: "place", ref: "C5", item: "cap-2200u", orient: 1 }, ...BAT_IN]],
    hints: ["多块板之间，“地”也是一根导线。用两个通道分别夹两块板的地，数学功能看 A−B。", "舵机电流本该走电源线 CB2 回去，现在它从细的信号线地 CB3G 绕回去了。", "CB2 负极线的端子退出来了（倒刺压平）：剪掉旧端子，重新压一个。重新插拔没用。"],
    rootCause: "电源线 CB2 负极端子压接失效、从插头里退出，舵机的回流只能走 30AWG 信号排线的地线，舵机电流在这根细线上产生上百毫伏压差，信号参考地跟着跳。",
    lesson: "多板系统要检查每根线的两头。示波器探头的地夹只能夹一个点：要看两块板之间的地压差，用两个通道 + 数学差值，不要把地夹夹到另一块板的地上（那样会把地线短接、掩盖问题）。",
    safety: ["压线钳要用对应端子型号的槽位", "重新压接后轻拉一下确认不脱"],
  },
  {
    id: "rig-cable-crimp", stars: 5, template: "rig", title: "无线一发射，主控就重启（三块板）", parMin: 25, scope: true,
    complaint: "以前好好的，现在一连上手机遥控，主控就不停地重启。在电源板上量 5 V 是对的。",
    symptoms: ["电源板 5 V 正常，控制板 5 V 入口偏低", "无线发射时主控复位"],
    faults: [{ type: "badCrimp", target: "CB1+", arg: { r: 6 } }],
    scopeExpect: [
      S("控制板 5 V 入口（5V_C）运行中的最低值", STEADY([{ node: "5V_C", label: "控制板 5V" }, { node: "5V", label: "电源板 5V" }], 2e-3), { type: "min", ch: 0 }, [0, 4.5], [4.9, 5.3]),
      S("开机 + 无线发射期间主控复位次数", POWER([{ node: "3V3_C" }]), { type: "events", dev: "U3", kind: "reset" }, [1, 999], [0, 0]),
    ],
    expect: [{ red: { net: "5V_C", tp: "TP4" }, black: { net: "GND_C", tp: "TP6" }, mode: "V", power: true, run: true, faulty: [4.5, 4.74], fixed: [5.0, 5.3], zh: "控制板 5V 入口（运行中）" }],
    solution: [[...BAT_OUT, { a: "recrimp", id: "CB1+" }, ...BAT_IN]],
    wrong: [[...BAT_OUT, { a: "desolder", ref: "C2" }, { a: "place", ref: "C2", item: "cap-2200u", orient: 1 }, ...BAT_IN], [...BAT_OUT, { a: "reseat", ref: "J1" }, { a: "reseat", ref: "J3" }, ...BAT_IN]],
    hints: ["电源板上 5 V 对、控制板入口偏低，问题在两板之间的线上。", "示波器两通道分别夹电源板 5V 和控制板 5V_C：无线发射（每 5 ms 一次）时 5V_C 跳水。", "CB1 正极线的端子只压住了线皮，接触电阻约 6 Ω（估算）。重新压接端子；在控制板上加大电容只能掩盖一部分。"],
    rootCause: "电源排线 CB1 正极端子压接不良（只压住线皮），接触电阻约 6 Ω。主控无线发射的脉冲电流在上面产生压降，控制板电压跌破欠压阈值。",
    lesson: "两端电压不一样，问题就在中间的线上。端子压接要芯线、线皮两段都压住；加大电容是“治标”。",
    safety: ["压接不良的端子发热可能烫坏插头，发现后先断电", "别用焊锡去“补”压接端子（会变脆、裂开）"],
  },
];
export const scopeById = (id) => SCOPE_SCENARIOS.find((s) => s.id === id);

// 从一次抓到的波形里取 scopeExpect.metric 指定的量
export function metricOf(cap, m) {
  if (!cap?.ok || cap.waiting) return NaN;
  if (m.type === "events") return cap.dev?.[m.dev]?.[m.kind === "reset" ? "resets" : "hiccups"] ?? 0;
  const d = m.type === "mathMax" ? cap.math : cap.ch[m.ch];
  if (!d) return NaN;
  let mn = Infinity, mx = -Infinity, s = 0, n = 0;
  for (let i = 0; i < d.length; i++) { if (m.after != null && cap.t[i] < m.after) continue; const v = d[i]; if (v < mn) mn = v; if (v > mx) mx = v; s += v; n++; }
  return m.type === "min" ? mn : m.type === "max" || m.type === "mathMax" ? mx : m.type === "mean" ? s / n : mx - mn;
}
