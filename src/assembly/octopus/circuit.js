// 八爪鱼台面的电路检查：按“角色:引脚”建网（并查集），再按 md 的接线规则逐条判断。
// 只做直流层面的连通 / 电压 / 电流估算，不做瞬态。
import { OCTO_PROCEDURAL, OCTO_PINS } from "./parts.js";

export const ROLE_DEF = { ESP: "p-octo-devkitc1", PCA: "ada-815", MIC: "p-octo-inmp441", AMP: "ada-3006", SPK: "ada-3923", BAT: "p-octo-2s-lipo", U1: "p-octo-xl4015-6v", U2: "p-octo-xl4015-5v", OLED: "p-octo-oled096", DIV: "p-octo-vdiv" };
const PROC = Object.fromEntries(OCTO_PROCEDURAL.map((d) => [d.id, d]));
export const pinTable = (role) => { const id = ROLE_DEF[role]; return PROC[id]?.octo || OCTO_PINS[id] || { pins: {}, ties: [] }; };

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
  return [[`${w.a[0]}:${w.a[1]}`, `${w.b[0]}:${w.b[1]}`]];
};

export function nets(bench) {
  if (bench._uf) return bench._uf;
  const uf = new UF();
  Object.defineProperty(bench, "_uf", { value: uf, enumerable: false });
  for (const role of Object.keys(ROLE_DEF)) for (const t of pinTable(role).ties) for (let i = 1; i < t.length; i++) uf.u(`${role}:${t[0]}`, `${role}:${t[i]}`);
  for (const w of bench.wires) for (const [a, b] of expand(w)) uf.u(a, b);
  if (bench.usb) uf.u("USB:GND", "USB:GND");
  return uf;
}

// 电流估算（A）：舵机由仿真给；ESP32 + 外设为估算值
const I_ESP = 0.12, I_OLED = 0.02, I_MIC = 0.0014, I_AMP_IDLE = 0.003;
export function evaluate(bench, live = {}) {
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
