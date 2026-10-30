// 可注入的故障（关卡和编辑器共用）。每个故障只改零件 / 线 / 铜皮的“物理状态”，现象全部由仿真算出来。
// cue = 放大镜下能看到的外观线索（mag: 需要的放大倍数 1 = 肉眼，2 = 放大镜）
import { partOf } from "./board.js";

export const RES_COLORS = ["黑", "棕", "红", "橙", "黄", "绿", "蓝", "紫", "灰", "白"];
export function colorBands(ohms) {
  if (!(ohms > 0)) return "";
  let e = 0, v = ohms;
  while (v >= 100) { v /= 10; e++; }
  while (v < 10) { v *= 10; e--; }
  const d = Math.round(v);
  const m = e >= 0 ? RES_COLORS[e] : e === -1 ? "金" : "银";
  return `${RES_COLORS[Math.floor(d / 10)]}-${RES_COLORS[d % 10]}-${m}-金`;
}

export const FAULTS = {
  deadBattery: {
    zh: "电池没电", kinds: ["bat"],
    apply: (b, f) => { const p = partOf(b, f.target); p.state.ocv = f.arg?.ocv ?? (p.props.chem === "lipo1" ? 3.45 : 2.1); p.state.rint = (p.state.rint ?? p.props.r) * 3; },
    cue: (b, f) => ({ mag: 1, text: partOf(b, f.target).props.chem === "lipo1" ? "电池看起来正常（锂电没电从外观看不出来）" : "电池外观正常，但生产日期是很多年前" }),
  },
  wrongRes: {
    zh: "电阻装错阻值", kinds: ["res"], arg: "ohms",
    apply: (b, f) => { partOf(b, f.target).state.ohms = f.arg.ohms; },
    cue: (b, f) => ({ mag: 2, text: `色环读出来是 ${colorBands(f.arg.ohms)}（丝印要求 ${partOf(b, f.target).props.ohms} Ω）` }),
  },
  coldJoint: {
    zh: "冷焊 / 虚焊", kinds: ["res", "led", "diode", "ldo", "boost", "mcu", "sensor", "conn", "sw"], arg: "pin",
    apply: (b, f) => { const p = partOf(b, f.target); p.joints[f.arg.pin] = "cold"; },
    cue: (b, f) => ({ mag: 2, text: `${f.target} 的 ${f.arg.pin} 脚焊点发灰、表面粗糙、成球状，边缘没有润湿焊盘` }),
  },
  reversed: {
    zh: "装反 / 极性接反", kinds: ["led", "diode", "dcin", "bat", "conn"],
    apply: (b, f) => { const p = partOf(b, f.target); if (p.kind === "conn") p.state.flip = !p.state.flip; else p.state.orient = -(p.state.orient ?? 1); },
    cue: (b, f) => { const p = partOf(b, f.target); return { mag: 1, text: p.kind === "led" ? `${p.ref} 的平边（负极）对着丝印的正极一侧` : p.kind === "conn" ? `${p.ref} 插头的棕 / 黑线朝向信号脚那一边（插反了）` : p.kind === "dcin" ? "适配器的插头是改过的，外圈 / 内针的极性标签被涂掉了" : "电池方向和电池盒里的 +/− 标志不一致" }; },
  },
  burnt: {
    zh: "零件烧坏", kinds: ["ldo", "led", "res", "boost"],
    apply: (b, f) => { partOf(b, f.target).state.burnt = true; },
    cue: (b, f) => ({ mag: 1, text: `${f.target} 表面有一个小鼓包和一圈发黄的痕迹，靠近能闻到焦味` }),
  },
  bridge: {
    zh: "焊锡桥连", kinds: ["net"], arg: "nets",
    apply: (b, f) => { b.shorts.push({ id: f.arg.id || "BR1", a: f.arg.a, b: f.arg.b, kind: "bridge", at: f.arg.at || null, zh: `${f.arg.a} 和 ${f.arg.b} 之间的锡桥` }); },
    cue: (b, f) => ({ mag: 2, text: `${f.arg.near || ""}两个相邻焊盘之间有一坨亮锡连在一起（${f.arg.a} ↔ ${f.arg.b}）` }),
  },
  bypass: {
    zh: "防护元件被跨接短路", kinds: ["diode"],
    apply: (b, f) => { const p = partOf(b, f.target); b.shorts.push({ id: f.arg?.id || "BYP", a: p.pins.A, b: p.pins.K, kind: "wire", r: 0.02, zh: `跨在 ${p.ref} 两端的飞线` }); },
    cue: (b, f) => ({ mag: 1, text: `${f.target} 两端焊了一根细飞线，把它直接短接了（以前有人“临时修”过）` }),
  },
  crackedTrace: {
    zh: "铜皮走线断裂", kinds: ["trace"],
    apply: (b, f) => { b.traces.find((t) => t.id === f.target).state.cracked = true; },
    cue: (b, f) => ({ mag: 2, text: `${f.target} 走线上有一道发丝一样细的裂纹，板子有被弯过的痕迹` }),
  },
  thinWire: {
    zh: "电源线太细 / 太长", kinds: ["wire"], arg: "awg",
    apply: (b, f) => { const w = b.wires.find((x) => x.id === f.target); w.state.awg = f.arg.awg; w.state.len = f.arg.len ?? w.state.len; },
    cue: (b, f) => ({ mag: 2, text: `${f.target} 线皮上印着 ${f.arg.awg}AWG，而且被接长到约 ${Math.round((f.arg.len ?? 0.1) * 100)} cm（原来是 22AWG）` }),
  },
  looseConn: {
    zh: "插头松动 / 簧片疲劳", kinds: ["conn"],
    apply: (b, f) => { partOf(b, f.target).state.seat = f.arg?.seat || "worn"; },
    cue: (b, f) => ({ mag: 2, text: `${f.target} 插头的金属簧片张开了，插进去几乎没有阻力` }),
  },
  missingPart: {
    zh: "漏装零件", kinds: ["res", "led", "diode", "cap"],
    apply: (b, f) => { partOf(b, f.target).state.present = false; },
    cue: (b, f) => ({ mag: 1, text: `${f.target} 的焊盘是空的（丝印上有位置，但没焊零件）` }),
  },
  wrongLdo: {
    zh: "稳压芯片型号装错", kinds: ["ldo"], arg: "vout",
    apply: (b, f) => { partOf(b, f.target).state.vout = f.arg.vout; },
    cue: (b, f) => ({ mag: 2, text: `${f.target} 上的丝印是 “${f.arg.vout.toFixed(1)}V” 版本（这块板要 3.3 V）` }),
  },
  // ---- v18：需要示波器才看得清的故障（参数全部估算）----
  driedCap: {
    zh: "电解电容干涸（容量掉、ESR 变大）", kinds: ["cap"], arg: "c/esr",
    apply: (b, f) => { const p = partOf(b, f.target); p.state.c = f.arg?.c ?? p.props.c * 0.1; p.state.esr = f.arg?.esr ?? 3; p.state.dried = true; },
    cue: (b, f) => ({ mag: 2, text: `${f.target} 顶部的防爆纹微微鼓起，底部有一圈褐色干涸的电解液痕迹` }),
  },
  badCrimp: {
    zh: "线缆端子压接不良（接触电阻大）", kinds: ["wire"], arg: "r",
    apply: (b, f) => { const w = b.wires.find((x) => x.id === f.target); w.state.crimpR = f.arg?.r ?? 6; w.state.crimp = "bad"; },
    cue: (b, f) => ({ mag: 2, text: `${f.target} 的端子只压住了线皮，铜丝在端子里能来回抽动` }),
  },
  openCrimp: {
    zh: "线缆端子退针 / 断开", kinds: ["wire"],
    apply: (b, f) => { const w = b.wires.find((x) => x.id === f.target); w.state.cut = true; w.state.crimp = "open"; },
    cue: (b, f) => ({ mag: 2, text: `${f.target} 的端子从插头里退出来一截（倒刺压平了），线和插座没有接触` }),
  },
  stalledServo: {
    zh: "舵机卡死（齿轮打坏 / 机械卡住）", kinds: ["servo"],
    apply: (b, f) => { partOf(b, f.target).state.stalled = true; },
    cue: (b, f) => ({ mag: 1, text: `${f.target} 的舵盘用手拧不动，通电时发出“嗡嗡”声` }),
  },
};

export function applyFaults(b, faults) { for (const f of faults) FAULTS[f.type].apply(b, f); return b; }

// 编辑器用：给一块板列出可以注入的故障
export function faultOptions(b) {
  const out = [];
  for (const [type, F] of Object.entries(FAULTS)) {
    if (F.kinds.includes("net")) { const nets = Object.keys(b.nets); for (let i = 0; i < nets.length; i++) for (let j = i + 1; j < nets.length; j++) out.push({ type, zh: `${F.zh}：${nets[i]} ↔ ${nets[j]}`, target: null, arg: { a: nets[i], b: nets[j], id: "BR1" } }); continue; }
    if (F.kinds.includes("trace")) for (const t of b.traces || []) out.push({ type, zh: `${F.zh}：${t.id} ${t.zh}`, target: t.id });
    if (F.kinds.includes("wire")) for (const w of b.wires || []) out.push(type === "thinWire" ? { type, zh: `${F.zh}：${w.id} 换成 30AWG 30 cm`, target: w.id, arg: { awg: 30, len: 0.3 } } : { type, zh: `${F.zh}：${w.id}`, target: w.id });
    for (const p of b.parts) {
      if (!F.kinds.includes(p.kind)) continue;
      if (type === "reversed" && p.kind === "conn" && p.props.keyed) continue;
      if (type === "coldJoint") { for (const pin of Object.keys(p.pins)) out.push({ type, zh: `${F.zh}：${p.ref} 的 ${pin} 脚`, target: p.ref, arg: { pin } }); continue; }
      if (type === "wrongRes") { for (const o of [10, 1000, 22000, 1000000]) if (o !== p.props.ohms) out.push({ type, zh: `${F.zh}：${p.ref} 装成 ${o} Ω`, target: p.ref, arg: { ohms: o } }); continue; }
      if (type === "wrongLdo") { out.push({ type, zh: `${F.zh}：${p.ref} 装成 5.0 V 版`, target: p.ref, arg: { vout: 5.0 } }); continue; }
      out.push({ type, zh: `${F.zh}：${p.ref}`, target: p.ref });
    }
  }
  return out;
}
