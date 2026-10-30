// v21：引脚表。从 KiCad 官方符号库（CC BY-SA 4.0 + 设计例外）解析 引脚号→名称/类型，
// 再并上逐板核对过的逻辑电平（来源：官方数据手册 / 厂家文档，见 levelSrc）。
// 用法：node scripts/build-pinouts.mjs [kicad-symbols 目录，默认 ../libsrc/kisym]
// 早期原型，简化仿真。
import fs from "node:fs";
import path from "node:path";
const KI = process.argv[2] || path.resolve("../libsrc/kisym");
const SHA = "45efbd93be87e365a21d743daf9b8a07e6414df6";
const RAW = (f) => `https://gitlab.com/kicad/libraries/kicad-symbols/-/blob/${SHA}/${f}`;
const LIC = "CC-BY-SA-4.0（KiCad 库，含设计例外）";
const AD = (s) => `https://docs.arduino.cc/hardware/${s}/`;
const ESP = (s) => `https://www.espressif.com/sites/default/files/documentation/${s}`;
// id, KiCad 文件, 中文名, 逻辑电平 V, 5V 容忍, 电平来源, 台面零件 id（有就关联）
const SEL = [
  ["rpi-pico", "MCU_Module.kicad_symdir/RaspberryPi_Pico.kicad_sym", "树莓派 Pico（RP2040）", 3.3, false, "https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf", ["kc-raspberrypi_pico", "kc-raspberrypi_pico_h"]],
  ["rpi-pico-w", "MCU_Module.kicad_symdir/RaspberryPi_Pico_W.kicad_sym", "树莓派 Pico W", 3.3, false, "https://datasheets.raspberrypi.com/picow/pico-w-datasheet.pdf", ["kc-raspberrypi_pico_w"]],
  ["arduino-uno-r3", "MCU_Module.kicad_symdir/Arduino_UNO_R3.kicad_sym", "Arduino UNO R3（ATmega328P）", 5, true, AD("uno-rev3"), []],
  ["arduino-nano-v3", "MCU_Module.kicad_symdir/Arduino_Nano_v3.x.kicad_sym", "Arduino Nano v3（ATmega328P）", 5, true, AD("nano"), []],
  ["arduino-nano-every", "MCU_Module.kicad_symdir/Arduino_Nano_Every.kicad_sym", "Arduino Nano Every（ATmega4809）", 5, true, AD("nano-every"), []],
  ["arduino-leonardo", "MCU_Module.kicad_symdir/Arduino_Leonardo.kicad_sym", "Arduino Leonardo（ATmega32U4）", 5, true, AD("leonardo"), []],
  ["arduino-nano-esp32", "MCU_Module.kicad_symdir/Arduino_Nano_ESP32.kicad_sym", "Arduino Nano ESP32（ESP32-S3）", 3.3, false, AD("nano-esp32"), []],
  ["arduino-nano-rp2040", "MCU_Module.kicad_symdir/Arduino_Nano_RP2040_Connect.kicad_sym", "Arduino Nano RP2040 Connect", 3.3, false, AD("nano-rp2040-connect"), []],
  ["feather-huzzah32", "MCU_Module.kicad_symdir/Adafruit_Feather_HUZZAH32_ESP32.kicad_sym", "Adafruit Feather HUZZAH32（ESP32）", 3.3, false, "https://learn.adafruit.com/adafruit-huzzah32-esp32-feather/pinouts", ["ada-3405"]],
  ["feather-huzzah8266", "MCU_Module.kicad_symdir/Adafruit_Feather_HUZZAH_ESP8266.kicad_sym", "Adafruit Feather HUZZAH（ESP8266）", 3.3, false, "https://learn.adafruit.com/adafruit-feather-huzzah-esp8266/pinouts", ["ada-2821"]],
  ["feather-m0-express", "MCU_Module.kicad_symdir/Adafruit_Feather_M0_Express.kicad_sym", "Adafruit Feather M0 Express（SAMD21）", 3.3, false, "https://learn.adafruit.com/adafruit-feather-m0-express-designed-for-circuit-python-circuitpython", ["ada-3403"]],
  ["esp32-wroom-32e", "RF_Module.kicad_symdir/ESP32-WROOM-32E.kicad_sym", "ESP32-WROOM-32E 模组", 3.3, false, ESP("esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf"), ["kc-esp32-wroom-32e"]],
  ["esp32-wroom-32", "RF_Module.kicad_symdir/ESP32-WROOM-32.kicad_sym", "ESP32-WROOM-32 模组", 3.3, false, ESP("esp32-wroom-32_datasheet_en.pdf"), ["kc-esp32-wroom-32"]],
  ["esp32-s3-wroom-1", "RF_Module.kicad_symdir/ESP32-S3-WROOM-1.kicad_sym", "ESP32-S3-WROOM-1 模组", 3.3, false, ESP("esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"), ["kc-esp32-s3-wroom-1", "esp-esp32-s3-wroom-1", "sfe-esp32-s3-wroom-1"]],
  ["esp32-s3-mini-1", "RF_Module.kicad_symdir/ESP32-S3-MINI-1.kicad_sym", "ESP32-S3-MINI-1 模组", 3.3, false, ESP("esp32-s3-mini-1_mini-1u_datasheet_en.pdf"), ["esp-esp32-s3-mini-1", "sfe-esp32-s3-mini"]],
  ["esp32-c3-wroom-02", "RF_Module.kicad_symdir/ESP32-C3-WROOM-02.kicad_sym", "ESP32-C3-WROOM-02 模组", 3.3, false, ESP("esp32-c3-wroom-02_datasheet_en.pdf"), ["kc-esp32-c3-wroom-02", "esp-esp32-c3-wroom-02"]],
  ["esp32-c3-devkitm-1", "RF_Module.kicad_symdir/ESP32-C3-DevKitM-1.kicad_sym", "ESP32-C3-DevKitM-1 开发板", 3.3, false, "https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/hw-reference/esp32c3/user-guide-devkitm-1.html", []],
  ["esp32-c6-mini-1", "RF_Module.kicad_symdir/ESP32-C6-MINI-1.kicad_sym", "ESP32-C6-MINI-1 模组", 3.3, false, ESP("esp32-c6-mini-1_mini-1u_datasheet_en.pdf"), ["esp-esp32-c6-mini-1", "sfe-esp32-c6-mini-1"]],
  ["esp-12f", "RF_Module.kicad_symdir/ESP-12F.kicad_sym", "ESP-12F（ESP8266）模组", 3.3, false, ESP("esp8266ex_datasheet_en.pdf"), []],
  ["esp-01", "RF_Module.kicad_symdir/ESP-01.kicad_sym", "ESP-01（ESP8266）模组", 3.3, false, ESP("esp8266ex_datasheet_en.pdf"), []],
  ["pololu-a4988", "Driver_Motor.kicad_symdir/Pololu_Breakout_A4988.kicad_sym", "Pololu A4988 步进驱动板", null, true, "https://www.pololu.com/product/1182", [], "逻辑电源 VDD 3–5.5 V（厂家页面）；3.3 V 和 5 V 主控都能直接接"],
  ["pololu-drv8825", "Driver_Motor.kicad_symdir/Pololu_Breakout_DRV8825.kicad_sym", "Pololu DRV8825 步进驱动板", null, true, "https://www.pololu.com/product/2133", [], "板载稳压，逻辑输入兼容 3.3 V / 5 V（厂家页面）"],
  ["l298n-ic", "Driver_Motor.kicad_symdir/L298N.kicad_sym", "L298N 芯片（Multiwatt15）", 5, true, "https://www.st.com/resource/en/datasheet/l298.pdf", [], "芯片本身的引脚；常见红色 L298N 模块的排针见 l298n-module（估算）"],
  ["tb6612fng", "Driver_Motor.kicad_symdir/TB6612FNG.kicad_sym", "TB6612FNG 芯片", null, true, "https://toshiba.semicon-storage.com/info/TB6612FNG_datasheet_en_20141001.pdf", [], "VCC 2.7–5.5 V，输入按 VCC 电平（数据手册）"],
  ["drv8833pw", "Driver_Motor.kicad_symdir/DRV8833PW.kicad_sym", "DRV8833 芯片（TSSOP）", null, true, "https://www.ti.com/lit/ds/symlink/drv8833.pdf", [], "逻辑输入兼容 3.3 V / 5 V（数据手册）"],
  ["vl53l0x", "Sensor_Distance.kicad_symdir/VL53L0CXV0DH1.kicad_sym", "VL53L0X 激光测距芯片", 2.8, false, "https://www.st.com/resource/en/datasheet/vl53l0x.pdf", [], "芯片 AVDD 2.6–3.5 V，不耐 5 V；带稳压/电平转换的模块另算"],
  ["vl53l1x", "Sensor_Distance.kicad_symdir/VL53L1CXV0FY1.kicad_sym", "VL53L1X 激光测距芯片", 2.8, false, "https://www.st.com/resource/en/datasheet/vl53l1x.pdf", ["kc-st_vl53l1x", "sfe-st_vl53l1x"], "芯片 AVDD 2.6–3.5 V，不耐 5 V"],
];
// 手写（我的补充）：数据手册给出的模块排针
const HAND = [
  { id: "hc-sr04", zh: "HC-SR04 超声波测距模块", logicV: 5, tol5v: true, levelSrc: "https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf", src: "https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf", lic: "数据手册事实（引脚名不受版权保护）", parts: ["fc-hc-sr04"], note: "工作电压 DC 5 V；Echo 输出 5 V 电平，接 3.3 V 主控要分压（我的补充）",
    pins: [["1", "VCC", "power_in"], ["2", "Trig", "input"], ["3", "Echo", "output"], ["4", "GND", "power_in"]] },
  { id: "l298n-module", zh: "L298N 双 H 桥模块（常见红板）", logicV: 5, tol5v: true, est: true, levelSrc: "https://www.st.com/resource/en/datasheet/l298.pdf", src: "", lic: "估算", parts: ["fc-l298n"], note: "估算：模块排针顺序没有开放许可的厂家文档，按丝印名称列出、不保证顺序；芯片引脚见 l298n-ic",
    pins: [["1", "+12V", "power_in"], ["2", "GND", "power_in"], ["3", "+5V", "power_out"], ["4", "ENA", "input"], ["5", "IN1", "input"], ["6", "IN2", "input"], ["7", "IN3", "input"], ["8", "IN4", "input"], ["9", "ENB", "input"], ["10", "OUT1", "output"], ["11", "OUT2", "output"], ["12", "OUT3", "output"], ["13", "OUT4", "output"]] },
];
export function role(name, type) {
  const n = name.toUpperCase().replace(/^[+~]/, "");
  if (/^(GND|VSS|AGND|DGND|PGND|EP)\b/.test(n) || n === "GND") return "gnd";
  if (/^(3V3|3\.3V|\+3V3|VDD3V3|3V)$/.test(n) || /^3V3/.test(n)) return "3v3";
  if (/^(5V|\+5V|VBUS|USB)$/.test(n)) return "5v";
  if (/^(VIN|VSYS|VBAT|BAT|VMOT|VS|VCC|VDD|IOVDD|AVDD|\+12V)$/.test(n) || /^VDD/.test(n)) return "power";
  if (/RESET|RST|^EN$|^CHIP_PU$|^RUN$/.test(n)) return "ctrl";
  if (/AREF|VREF/.test(n)) return "ref";
  if (/^NC$/.test(n) || type === "no_connect") return "nc";
  if (type === "power_in" || type === "power_out") return "power";
  return "io";
}
function parseSym(file) {
  const t = fs.readFileSync(path.join(KI, file), "utf8");
  const ext = (t.match(/\(extends "([^"]+)"\)/) || [])[1];
  const prop = (k) => (t.match(new RegExp(`\\(property "${k}" "([^"]*)"`)) || [])[1] || "";
  const pins = [];
  const re = /\(pin (\w+) \w+[\s\S]*?\(name "([^"]*)"[\s\S]*?\(number "([^"]*)"/g;
  let m; while ((m = re.exec(t))) pins.push([m[3], m[2], m[1]]);
  let base = null;
  if (ext && !pins.length) base = parseSym(path.join(path.dirname(file), ext + ".kicad_sym"));
  return { pins: pins.length ? pins : base?.pins || [], ds: prop("Datasheet") || base?.ds || "", desc: prop("Description") || base?.desc || "", ext, file, baseFile: base ? (base.baseFile || base.file) : null };
}
const natural = (a, b) => (+a[0] - +b[0]) || String(a[0]).localeCompare(String(b[0]), "en", { numeric: true });
const IDX = fs.existsSync("public/lib/index.json") ? new Set(JSON.parse(fs.readFileSync("public/lib/index.json", "utf8")).parts.map((r) => r[0])) : null;
const keep = (ps) => (ps || []).filter((x) => !IDX || IDX.has(x) || (console.warn("零件库里没有", x), false));
const out = [];
for (const [id, file, zh, logicV, tol5v, levelSrc, parts, note] of SEL) {
  if (!fs.existsSync(path.join(KI, file))) { console.warn("缺", file); continue; }
  const s = parseSym(file);
  const seen = new Set();
  const pins = s.pins.filter((p) => !seen.has(p[0] + p[1]) && seen.add(p[0] + p[1])).sort(natural)
    .map(([num, name, type]) => ({ num, name: name.replace(/~\{([^}]*)\}/g, "$1"), type, role: role(name.replace(/~\{([^}]*)\}/g, "$1"), type) }));
  out.push({ id, zh, logicV, tol5v, levelSrc, note: note || "", parts: keep(parts), src: RAW(file), srcBase: s.baseFile ? RAW(s.baseFile) : null, datasheet: s.ds, desc: s.desc, lic: LIC, pins });
}
for (const h of HAND) out.push({ ...h, parts: keep(h.parts), pins: h.pins.map(([num, name, type]) => ({ num, name, type, role: role(name, type) })) });
const dir = "public/pinouts"; fs.mkdirSync(dir, { recursive: true });
for (const b of out) fs.writeFileSync(`${dir}/${b.id}.json`, JSON.stringify(b));
const index = { generated: new Date().toISOString().slice(0, 10), kicadSha: SHA, boards: out.map((b) => ({ id: b.id, zh: b.zh, n: b.pins.length, logicV: b.logicV, tol5v: b.tol5v, est: !!b.est, parts: b.parts })) };
fs.writeFileSync(`${dir}/index.json`, JSON.stringify(index));
console.log(out.map((b) => `${b.id}:${b.pins.length}`).join(" "), "\n共", out.length, "块，", out.reduce((s, b) => s + b.pins.length, 0), "个引脚");
