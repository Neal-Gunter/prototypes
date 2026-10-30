// 八爪鱼台面的电路检查：按“角色:引脚”建网（并查集），再按 md 的接线规则逐条判断。
// 只做直流层面的连通 / 电压 / 电流估算，不做瞬态。
import { OCTO_PROCEDURAL, OCTO_PINS } from "./parts.js";
import { BOOST, boostLimitA, boostEff, SERVO_PINS, BATT_PIN } from "./v10.js";

export const ROLE_DEF = { ESP: "p-octo-devkitc1", PCA: "ada-815", MIC: "p-octo-inmp441", AMP: "ada-3006", SPK: "ada-3923", BAT: "p-octo-2s-lipo", U1: "p-octo-xl4015-6v", U2: "p-octo-xl4015-5v", OLED: "p-octo-oled096", DIV: "p-octo-vdiv" };
const PROC = Object.fromEntries(OCTO_PROCEDURAL.map((d) => [d.id, d]));
// bench.defs 可以按台面改某个角色用的零件（完善版 BAT = 3S 电池包；v10 全换）
export const pinTable = (role, bench) => { const id = bench?.defs?.[role] || ROLE_DEF[role]; return PROC[id]?.octo || OCTO_PINS[id] || { pins: {}, ties: [] }; };

class UF {
  constructor() { this.p = new Map(); }
  f(a) { if (!this.p.has(a)) this.p.set(a, a); let r = a; while (this.p.get(r) !== r) r = this.p.get(r); this.p.set(a, r); return r; }
  u(a, b) { this.p.set(this.f(a), this.f(b)); }
}
// 舵机引线展开成 3 根：棕 GND / 红 V+ / 橙 PWM
const expand = (w) => {
  if (w.kind === "octo-servo") {
    const [sr] = w.a, ch = w.b[1];
    return [[`${sr}:GND`, `PCA:${ch}.GND`], [`${sr}:V+`, `PCA:${ch}.V+`], [`${sr}:PWM`, `PCA:${ch}.PWM`]];
  }
  if (w.kind === "octo-v10-servo") { // v10：橙线 → QT Py 引脚；红 / 棕 → 所属升压的 OUT / GND
    const [sr] = w.a, pad = w.b[1], rail = w.rail;
    return [[`${sr}:GND`, `${rail}:GND`], [`${sr}:V+`, `${rail}:OUT`], [`${sr}:PWM`, `QTPY:${pad}`]];
  }
  return [[`${w.a[0]}:${w.a[1]}`, `${w.b[0]}:${w.b[1]}`]];
};

export function nets(bench) {
  if (bench._uf) return bench._uf;
  const uf = new UF();
  Object.defineProperty(bench, "_uf", { value: uf, enumerable: false });
  const roleList = bench.board === "v10" ? bench.roles : Object.keys(ROLE_DEF);
  if (bench.board === "v10") uf.u("SW:COM", bench.swOn ? "SW:1" : "SW:3"); // 拨动开关：COM 接 1（开）或 3（关）
  for (const role of roleList) for (const t of pinTable(role, bench).ties) for (let i = 1; i < t.length; i++) uf.u(`${role}:${t[0]}`, `${role}:${t[i]}`);
  for (const w of bench.wires) for (const [a, b] of expand(w)) uf.u(a, b);
  if (bench.usb) uf.u("USB:GND", "USB:GND");
  return uf;
}

// 电流估算（A）：舵机由仿真给；ESP32 + 外设为估算值
const I_ESP = 0.12, I_OLED = 0.02, I_MIC = 0.0014, I_AMP_IDLE = 0.003;
export function evaluate(bench, live = {}) {
  if (bench.board === "v10") return evaluateV10(bench, live);
  const uf = nets(bench);
  const same = (a, b) => uf.f(a) === uf.f(b);
  const servoI = live.servoI || 0;
  const res = { checks: [], rails: {}, warn: [] };
  const vbat0 = bench.vbat ?? 7.4;
  // 电源
  const u1In = same("U1:IN+", "BAT:BAT+") && same("U1:IN-", "BAT:BAT-");
  const u2In = same("U2:IN+", "BAT:BAT+") && same("U2:IN-", "BAT:BAT-");
  const has = (r) => bench.roles.includes(r);
  const espUsb = !!bench.usb;
  const esp5vFromU2 = has("U2") && u2In && same("ESP:J1.21", "U2:OUT+");
  const espGndU2 = same("ESP:J1.22", "U2:OUT-");
  // 舵机 V+ 来自哪里
  const vpFromU1 = has("U1") && u1In && same("PCA:T.V+", "U1:OUT+");
  const vpFromEsp = has("PCA") && same("PCA:T.V+", "ESP:J1.21");
  // 电流 → 压降
  const plus = bench.variant === "plus";
  const Rint = plus ? (vbat0 < 9.8 ? 0.45 : 0.15) : bench.vbat < 6.6 ? 0.5 : 0.12; // 电池内阻（估算；快没电时内阻变大）
  const u1Out = bench.u1Unset ? null : 6.0;
  let espIn = 0, vservo = 0, iBat = 0;
  const pEsp = (I_ESP + (has("OLED") ? I_OLED : 0) + (has("MIC") ? I_MIC : 0)) * 5 + (has("AMP") ? I_AMP_IDLE * 5 : 0);
  if (vpFromU1) iBat += (servoI * 6) / 0.9;
  if (esp5vFromU2) iBat += pEsp / 0.88;
  iBat /= Math.max(5.5, vbat0);
  const vbat = vbat0 - iBat * Rint;
  const dropout = 0.8; // XL4015 最小压差（估算）
  if (vpFromU1) vservo = Math.min(u1Out ?? vbat - dropout, vbat - dropout - servoI * 0.05);
  if (esp5vFromU2) espIn = Math.min(5.0, vbat - dropout);
  if (espUsb) espIn = Math.max(espIn, 5.0 - (vpFromEsp ? servoI * 1.4 : 0) - 0.05); // USB 线 + 板上二极管/保险丝（估算 1.4 Ω）
  if (vpFromEsp) vservo = espIn - 0.3;
  const espOn = espIn >= 4.3;
  const gndEspPca = same("ESP:J3.1", "PCA:L.GND") || (same("ESP:J1.22", "BAT:BAT-") && same("PCA:T.GND", "BAT:BAT-"));
  const pcaVcc = same("PCA:L.VCC", "ESP:J1.1");
  const pcaLogic = espOn && pcaVcc && (gndEspPca || (vpFromEsp && espUsb));
  const i2c = { sda: same("PCA:L.SDA", "ESP:J1.12"), scl: same("PCA:L.SCL", "ESP:J1.15") };
  const battSense = has("DIV") && same("DIV:IN", "BAT:BAT+") && same("DIV:GND", "BAT:BAT-") && same("DIV:OUT", "ESP:J1.16") && same("BAT:BAT-", "ESP:J1.22");
  res.rails = { battSense, vbat: has("BAT") ? +vbat.toFixed(2) : null, vservo: +vservo.toFixed(2), espIn: +espIn.toFixed(2), v33: espOn ? 3.3 : 0, iBat: +iBat.toFixed(2), servoI: +servoI.toFixed(2), espOn, pcaLogic, gndCommon: gndEspPca, i2cWired: i2c.sda && i2c.scl, vpFromEsp, vpFromU1 };
  const C = (ok, zh, md, level = "err") => res.checks.push({ ok: !!ok, zh, md, level: ok ? "ok" : level });
  if (has("PCA")) {
    C(gndEspPca, "共地：ESP32 的 GND 和 PCA9685 / 电池 GND 连在一起", "README §4 三条铁律 · 共地");
    C(!vpFromEsp, "舵机 V+ 不从 ESP32 取电（走 PCA9685 的 V+ 螺丝端子）", "README §4 三条铁律 · V+ 绝不从 ESP32 取");
    C(pcaVcc, "PCA9685 VCC 接 ESP32 3V3（逻辑电源）", "README §4 接线表 · 3V3/GND → PCA VCC");
    C(i2c.sda && i2c.scl, "I2C：GPIO8 → SDA，GPIO9 → SCL", "README §4 接线表 / body_firmware_A.ino #define I2C_SDA 8");
    C(vpFromU1, "V+ 端子 ← XL4015 调到 6 V", "README §4 供电 · 7.4V → XL4015 → 6V");
  }
  if (has("MIC")) {
    C(same("MIC:SCK", "ESP:J1.5") && same("MIC:WS", "ESP:J1.4") && same("MIC:SD", "ESP:J1.6"), "麦克风 INMP441：SCK=GPIO5，WS=GPIO4，SD=GPIO6", "README §4 接线表");
    C(same("MIC:L/R", "ESP:J3.1"), "INMP441 L/R 接 GND（选左声道）", "文档未写（按 INMP441 数据手册补）", "warn");
    C(same("MIC:VDD", "ESP:J1.1"), "INMP441 VDD 接 3V3", "文档未写（数据手册 1.62–3.63 V）", "warn");
  }
  if (has("AMP")) {
    C(same("AMP:BCLK", "ESP:J1.8") && same("AMP:LRC", "ESP:J1.9") && same("AMP:DIN", "ESP:J1.7"), "功放 MAX98357A：BCLK=GPIO15，LRC=GPIO16，DIN=GPIO7", "README §4 接线表");
    C(same("AMP:SPK+", "SPK:+") && same("AMP:SPK-", "SPK:-"), "喇叭接功放输出", "README §3 物料（8Ω 2W 喇叭）");
  }
  if (has("SPK") && has("MIC") && live.micSpkCm != null) C(live.micSpkCm >= 5, `麦克风离喇叭 ${live.micSpkCm.toFixed(1)} cm（≥ 5 cm）`, "README §8 · 麦克风和喇叭至少隔 5 cm");
  if (has("OLED")) C(same("OLED:SDA", "PCA:L.SDA") && same("OLED:SCL", "PCA:L.SCL"), "OLED 和 PCA9685 共用 I2C（0x3C / 0x40 不冲突）", "README §4 · 屏幕同一条 I2C");
  if (has("BAT")) {
    if (plus) C(vbat0 >= 8, `XL4015 输入 ${vbat0.toFixed(1)} V（3S，截止 9.6 V 也高于数据手册下限 8 V）`, "我的补充 · XLSEMI XL4015 数据手册 8–36 V", "warn");
    else C(vbat0 >= 8, `XL4015 输入 ${vbat0.toFixed(1)} V：数据手册下限 8 V，2S 电池大部分时间低于它`, "md 没提；XLSEMI XL4015 数据手册", "warn");
    if (plus) C(battSense, "电池检测：分压板 IN ← 电池 +、OUT → GPIO10（ADC1_CH9），12.6 V 时 2.27 V < 2.9 V 量程", "我的补充 · 乐鑫 ESP32‑S3 ADC 文档（11 dB 校准量程 0–2900 mV）", "warn");
    C(!bench.u1Unset, "6 V 那块降压先空载调好再接舵机", "补充（md 没写调压步骤）", "warn");
    if (bench.u1Unset) res.warn.push(`U1 没调：输出接近输入（约 ${(vbat - dropout).toFixed(1)} V），超过 MG90S 标称 6.0 V`);
  }
  // 舵机
  (bench.servos || []).forEach((s, i) => {
    const ch = s.ch;
    if (ch == null) return;
    const exp = bench.plan === "B" ? null : i;
    if (exp != null && ch !== `CH${exp}`) C(false, `触手 ${i} 的舵机插在 ${ch}，md 约定 ${exp} 号触手 = 通道 ${exp}`, "octopus_body.h · ChannelOf(kSingle8)", "warn");
  });
  if (bench.caps != null && has("PCA")) C(bench.caps >= (bench.servos?.length || 0), `每个舵机旁一颗 220µF（${bench.caps} / ${bench.servos?.length || 0}）`, "README §4 三条铁律 · 每个舵机旁 220µF", "warn");
  if (servoI > 5) res.warn.push(`舵机电流 ${servoI.toFixed(1)} A 超过 XL4015 标称 5 A`);
  if (vservo > 0 && vservo < 4.6 && servoI > 0.3) res.warn.push(`舵机电压掉到 ${vservo.toFixed(2)} V`);
  res.errCount = res.checks.filter((c) => c.level === "err").length;
  res.warnCount = res.checks.filter((c) => c.level === "warn").length + res.warn.length;
  res.same = same;
  return res;
}

// —— v10（我的补充）：1S LiPo → 2 个 MiniBoost 5.2 V → 舵机；开关管 EN 和 QT Py。全是直流估算 ——
export const I_QTPY = 0.08; // QT Py + BLE 平均电流 @3.7 V（估算）
export function evaluateV10(bench, live = {}) {
  const uf = nets(bench);
  const same = (a, b) => uf.f(a) === uf.f(b);
  const res = { checks: [], rails: {}, warn: [] };
  const C = (ok, zh, md, level = "err") => res.checks.push({ ok: !!ok, zh, md, level: ok ? "ok" : level });
  const servoI = live.servoI || 0, perRail = live.railI || null;
  const vbat0 = bench.vbat;
  const Rint = vbat0 < 3.6 ? 0.3 : 0.15; // 电池 + JST + 线的总内阻（估算；快没电时变大）
  const batOk = same("CHG:JST+", "BAT:BAT+") && same("CHG:JST-", "BAT:BAT-");
  const bstIn = (b) => batOk && same(`${b}:IN`, "BAT:BAT+") && same(`${b}:GND`, "BAT:BAT-");
  const swOn = same("SW:COM", "BAT:BAT+");
  const en = (b) => same(`${b}:EN`, "BAT:BAT+");
  const bsts = ["BST1", "BST2"].filter((b) => bench.roles.includes(b) && bstIn(b));
  // 每个升压带哪些舵机
  const servoRail = {};
  for (const s of bench.servos) servoRail[s.role] = ["BST1", "BST2"].find((b) => same(`${s.role}:V+`, `${b}:OUT`) && same(`${s.role}:GND`, "BAT:BAT-")) || null;
  const railI = { BST1: 0, BST2: 0 };
  if (perRail) for (const s of bench.servos) { const r = servoRail[s.role]; if (r) railI[r] += perRail[s.role] || 0; }
  else { const n = bench.servos.length; for (const s of bench.servos) { const r = servoRail[s.role]; if (r) railI[r] += servoI / n; } }
  // 先按标称电池电压算一轮电池电流，再算压降（一次迭代足够，估算）
  const espOnPre = swOn && batOk && same("QTPY:BAT", "BAT:BAT+");
  let vbat = vbat0, iBat = 0;
  const out = {};
  for (let it = 0; it < 3; it++) {
    iBat = espOnPre ? I_QTPY : 0;
    for (const b of ["BST1", "BST2"]) {
      const on = bsts.includes(b) && en(b);
      const lim = boostLimitA(vbat), I = on ? railI[b] : 0;
      // 超过限流：输出电压按“能给的电流 / 要的电流”往下掉（估算，TPS61023 实际是限流 + 打嗝）
      const v = on ? (I <= lim ? BOOST.vout : BOOST.vout * Math.max(0, lim / I)) : 0;
      const ia = I <= lim ? I : lim;
      out[b] = { on, v, I, lim, sat: on && I > lim };
      if (on) iBat += (v * ia) / boostEff(ia) / Math.max(2.5, vbat) + 0.0002;
    }
    vbat = vbat0 - iBat * Rint;
  }
  const vQt = espOnPre ? vbat - 0.3 : 0; // BAT 焊盘后面的二极管压降（估算 0.3 V）
  const espOn = vQt >= 3.1; // BAT 焊盘二极管后 < 3.1 V：3.3 V LDO 掉压、ESP32‑S3 掉电复位（估算阈值）
  const gndCommon = same("QTPY:BGND", "BAT:BAT-");
  const battSense = same("DIV:IN", "SW:COM") && same("DIV:GND", "BAT:BAT-") && same("DIV:OUT", `QTPY:${BATT_PIN.pad}`);
  const pwmGpio = {};
  for (const s of bench.servos) { const p = SERVO_PINS.find((q) => same(`${s.role}:PWM`, `QTPY:${q.pad}`)); pwmGpio[s.role] = p && gndCommon ? p.gpio : null; }
  const vservoOf = Object.fromEntries(bench.servos.map((s) => [s.role, servoRail[s.role] ? out[servoRail[s.role]].v : 0]));
  const vs = Object.values(vservoOf);
  const vservo = vs.length ? Math.min(...vs) : 0;
  res.rails = {
    battSense, vbat: +vbat.toFixed(3), vbatSw: swOn ? +vbat.toFixed(3) : 0, vservo: +vservo.toFixed(2), vservoOf, espIn: +vQt.toFixed(2), v33: espOn ? 3.3 : 0, iBat: +iBat.toFixed(3), servoI: +servoI.toFixed(3),
    espOn, pcaLogic: espOn, gndCommon, i2cWired: true, vpFromEsp: false, vpFromU1: false, boost: out, pwmGpio, swOn, usb: false, pBat: +(iBat * vbat).toFixed(3),
  };
  C(batOk, "LiPo JST 插进充电板电池座", "Adafruit 4410 / 258");
  C(swOn, "电源开关拨到 ON（COM 接电池 +，两个升压 EN 拉高、QT Py 上电）", "Adafruit 4654：EN 拉低 = 真断开", "warn");
  C(gndCommon, "共地：QT Py BAT 旁的 GND 焊盘接电池地（PWM 才有参考）", "舵机 PWM 是相对 GND 的信号");
  C(bench.servos.every((s) => servoRail[s.role]), "每个舵机红线 / 棕线接在升压 OUT / GND 上（不从 QT Py 取电）", "我的补充 · QT Py 3.3 V 稳压 600 mA 峰值，带不动舵机");
  C(bench.servos.every((s) => pwmGpio[s.role] != null), "8 根橙线接 QT Py 的 8 个焊盘（A0 A1 A2 SDA SCL TX RX SCK）", "ESP32‑S3 LEDC 8 个通道（乐鑫文档）");
  C(battSense, `电池检测：开关后的电池 + → 100k/100k → A3（GPIO8）；4.2 V → 2.1 V < 2.9 V 量程`, BATT_PIN.src, "warn");
  const n1 = bench.servos.filter((s) => servoRail[s.role] === "BST1").length, n2 = bench.servos.filter((s) => servoRail[s.role] === "BST2").length;
  C(n1 <= 4 && n2 <= 4, `两个升压各带 ≤ 4 个舵机（现在 ${n1} + ${n2}）`, "我的补充 · MiniBoost 3.7 V 输入时最大输出约 1.2 A（页面：1.1 A@3.5 V、1.4 A@4 V，插值）", "warn");
  C(true, "工作时不插 USB：USB‑C 只用来充电（充电板 100 mA 默认 / 500 mA 跳线）", "Adafruit 4410");
  C(false, "舵机电压 5.2 V 高于 SG51R 页面写的 4.8 V（页面没写最高电压；我没找到 5 V 以下的 1S 升压现成小板）", "Adafruit 2201 / 4654 · 我的补充", "warn");
  C(false, "拨动开关页面没写额定电流：这里只让它过 QT Py + EN 的小电流（< 0.2 A，估算），舵机电流不经过它", "Adafruit 805", "warn");
  for (const b of ["BST1", "BST2"]) if (out[b]?.sat) res.warn.push(`${b === "BST1" ? "升压 1" : "升压 2"} 要 ${out[b].I.toFixed(2)} A，超过 ${vbat.toFixed(2)} V 输入时的上限 ${out[b].lim.toFixed(2)} A → 输出掉到 ${out[b].v.toFixed(2)} V`);
  if (iBat > 2) res.warn.push(`电池电流 ${iBat.toFixed(2)} A 超过 LiPo 线材额定 2 A（Adafruit 258 页面）`);
  if (vbat0 < BATT_PIN.cut) res.warn.push(`电池 ${vbat0.toFixed(2)} V 低于 ${BATT_PIN.cut} V（估算阈值）：固件会停运动，请充电`);
  res.errCount = res.checks.filter((c) => c.level === "err").length;
  res.warnCount = res.checks.filter((c) => c.level === "warn").length + res.warn.length;
  res.same = same;
  return res;
}
