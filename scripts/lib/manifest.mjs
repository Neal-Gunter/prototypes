// 生成零件清单（分类、来源、许可）。只用文件名/产品名做规则分类；不臆造任何参数。
// 用法：node scripts/lib/manifest.mjs  → ../libsrc/manifest.json
import fs from "node:fs";
import path from "node:path";
const LIB = path.resolve("../libsrc");

export const CATS = {
  mcu: "主控板 / MCU 模块",
  sensor: "传感器",
  display: "显示屏",
  motor: "电机 / 舵机 / 步进",
  driver: "驱动 / 扩展板",
  power: "电源 / 电池",
  passive: "无源器件",
  semi: "分立半导体 / 芯片封装",
  led: "LED / 灯",
  switch: "开关 / 按键 / 输入",
  connector: "连接器 / 排针",
  breadboard: "面包板 / 洞洞板",
  wire: "导线 / 线缆",
  module: "通信 / 音频 / 存储模块",
  fastener: "紧固件",
  enclosure: "外壳 / 结构件",
  tool: "工具",
};

function adaCat(n) {
  const t = n.toLowerCase();
  const has = (...k) => k.some((x) => t.includes(x.toLowerCase()));
  if (has("case", "box", "slide rail", "extrusion", "tripod", "mag feet", "pulley", "snowglobe", "fixer")) return "enclosure";
  if (has("cable")) return "wire";
  if (has("perma", "proto", "doubler", "tripler", "breadboard")) return "breadboard";
  if (has("servo driver", "servo pwm", "motor featherwing", "motor hat", "motorshield", "motor bonnet", "stepper motor bonnet", "drv", "a4988", "tmc2209", "stspin", "driver", "mosfet", "relay", "crickit", "level", "expander", "multiplexer", "pca95", "isolator", "extender", "booster", "shifter", "bonnet", "hat", "cowbell", "featherwing", "bff", "backpack", "gizmo", "pico hat", "adapter") && !has("tft featherwing", "oled", "eink", "e-ink", "tft wing", "display", "joy featherwing", "neokey featherwing", "lis3mdl", "gps", "adalogger", "airlift", "radio", "ethernet", "midi", "music", "speaker", "audio", "lora", "camera", "dvi", "rtc", "usb host", "can", "lipo charger", "neopixel grid", "iot button", "tft bonnet", "e-ink bonnet", "joy bonnet", "arcade bonnet", "braincraft", "cyberdeck", "triple led matrix", "matrix bonnet", "8x8", "7 segment", "7-segment", "alphanumeric"))
    return "driver";
  if (has("servo", "motor", "solenoid")) return "motor";
  if (has("battery", "batt", "lipo", "mah", "charger", "boost", "buck", "powerboost", "verter", "coin", "cr2032", "solar", "ideal diode", "max17048", "lc709203", "bq25185", "bq26185", "power switch", "tps61040", "tps65131", "husb238", "tps61169", "lipo charger bff")) return "power";
  if (has("tft", "oled", "display", "eink", "e-ink", "epaper", "matrix", "7 segment", "7-segment", "alphanum", "lcd", "sharp memory", "pitft", "ra8875", "hdmi backpack", "touchscreen")) return "display";
  if (has("neopixel", "led", "laser diode", "ir led", "pixel", "neodriver", "neoring", "neomatrix")) return "led";
  if (has("button", "switch", "joystick", "thumbstick", "joycon", "rotary", "encoder", "neokey", "keypad", "gamepad", "slider", "trellis", "pb86", "potentiometer", "neopot", "joy ")) return "switch";
  if (has("usb", "connector", "jack", "terminal", "hub", "stemma qt breakout", "nunchuck", "hstx", "trrs", "pal")) return "connector";
  if (has("speaker", "amp", "audio", "dac", "soundboard", "sfx", "fona", "rfm", "radio", "lora", "ethernet", "wiz5500", "airlift", "nfc", "rfid", "can bus", "rs-232", "micro sd", "adalogger", "rtc", "eeprom", "midi", "hdmi", "dvi", "music", "mcp2221", "ds3231", "pcf8523", "ir remote", "mic", "i2s", "camera", "usb host", "ds3502")) return "module";
  if (has("feather", "metro", "itsybitsy", "qt py", "qtpy", "trinket", "trinkey", "gemma", "teensy", "circuit playground", "kb2040", "pizero", "grand central", "pyportal", "pybadge", "pygamer", "magtag", "funhouse", "clue", "hallowing", "matrix portal", "qualia", "macropad", "sparkle motion", "edgebadge", "monster", "huzzah", "glasses nrf", "rp2350", "esp32")) return "mcu";
  return "sensor";
}

function kicadInfo(file) {
  const b = path.basename(file, ".step");
  const dir = file.split("/")[0];
  const P = (b.match(/_P(\d+(?:\.\d+)?)mm/) || [])[1];
  const pitch_mm = P ? +P : null;
  let cat = "passive", zh = b;
  const m = (re) => b.match(re);
  if (dir.startsWith("Resistor")) { cat = "passive"; zh = /SMD/.test(dir) ? `贴片电阻 ${b.split("_")[1]}` : `直插电阻 ${m(/DIN\d+/)[0]}${/Vertical/.test(b) ? "（立式）" : ""}`; }
  else if (dir.startsWith("Capacitor")) { cat = "passive"; zh = /^CP_Radial/.test(b) ? `电解电容 Φ${m(/D([\d.]+)mm/)[1]} mm` : /^C_Disc/.test(b) ? "瓷片电容" : /^C_Rect/.test(b) ? "薄膜电容" : /^CP_Elec/.test(b) ? "贴片电解电容 6.3×5.4" : `贴片电容 ${b.split("_")[1]}`; }
  else if (dir.startsWith("Inductor")) { cat = "passive"; zh = "色环电感（轴向）"; }
  else if (dir.startsWith("Crystal")) { cat = "passive"; zh = `晶振 ${b.replace("Crystal_", "").split("_")[0]}`; }
  else if (dir.startsWith("Fuse")) { cat = "passive"; zh = /holder/.test(b) ? "保险丝座 5×20 mm" : "贴片保险丝 1206"; }
  else if (dir.startsWith("Potentiometer")) { cat = "passive"; zh = `微调电位器 Bourns ${m(/_(\d{4}[A-Z])_/)[1]}`; }
  else if (dir.startsWith("LED")) { cat = "led"; zh = /WS2812/.test(b) ? "WS2812B 可寻址 LED" : /SK6812/.test(b) ? "SK6812MINI-E LED" : /RGB/.test(b) ? "5 mm RGB LED" : /0603/.test(b) ? "贴片 LED 0603" : `直插 LED Φ${m(/D([\d.]+)mm/)[1]} mm${/IR/.test(b) ? "（红外）" : ""}`; }
  else if (dir.startsWith("Diode")) { cat = "semi"; zh = `二极管 ${m(/D_(DO-[\w]+)/)[1]}`; }
  else if (dir.startsWith("Package_TO")) { cat = "semi"; zh = `${b.split("_")[0]} 封装${/SMD/.test(dir) ? "（贴片）" : ""}`; }
  else if (dir.startsWith("Package_DIP")) { cat = "semi"; zh = `${m(/DIP-\d+/)[0]} ${/Socket/.test(b) ? "IC 插座" : "芯片"}（${m(/W([\d.]+)mm/)[1]} mm 宽）`; }
  else if (dir.startsWith("Connector_PinHeader")) { cat = "connector"; zh = `排针 ${m(/\dx\d+/)[0]} 2.54 mm${/Horizontal/.test(b) ? "（弯针）" : ""}`; }
  else if (dir.startsWith("Connector_PinSocket")) { cat = "connector"; zh = `排母 ${m(/\dx\d+/)[0]} 2.54 mm`; }
  else if (dir.startsWith("Connector_JST")) { cat = "connector"; const s = m(/JST_(\w\w)_/)[1]; zh = `JST-${s} ${m(/1x(\d+)/)[1]} 针插座${/Horizontal/.test(b) ? "（卧式）" : ""}`; }
  else if (dir.startsWith("Connector_USB")) { cat = "connector"; zh = /USB_A/.test(b) ? "USB-A 母座" : /C_Plug/.test(b) ? "USB-C 公头" : /USB_C/.test(b) ? "USB-C 母座（16P）" : /Micro/.test(b) ? "Micro-USB 母座" : "Mini-USB 母座"; }
  else if (dir.startsWith("Connector_Barrel")) { cat = "connector"; zh = "DC 圆孔电源座"; }
  else if (dir.startsWith("TerminalBlock")) { cat = "connector"; zh = `接线端子 ${m(/1x(\d+)/)[1]} 位 5.08 mm`; }
  else if (dir.startsWith("Button_Switch")) { cat = "switch"; zh = /PUSH_6mm_H9/.test(b) ? "6 mm 轻触按键（高 9.5 mm）" : /PUSH_6mm/.test(b) ? "6 mm 轻触按键" : /PUSH-12/.test(b) ? "12 mm 轻触按键" : /DIP/.test(b) ? `拨码开关 ${m(/x(\d+)/)[1]} 位` : /Slide/.test(b) ? "拨动开关 SPDT" : "拨动开关（弯脚）"; }
  else if (dir.startsWith("Buzzer")) { cat = "module"; zh = /TDK/.test(b) ? "压电蜂鸣片 12 mm" : "蜂鸣器 12×9.5"; }
  else if (dir.startsWith("RF_Module")) { cat = "mcu"; zh = `${b.replace(/_/g, " ")} 模组`; }
  else if (dir.startsWith("Module")) { cat = "mcu"; zh = b.replace(/_/g, " ").replace("RaspberryPi", "Raspberry Pi"); }
  else if (dir.startsWith("Relay")) { cat = "driver"; zh = /SRD/.test(b) ? "继电器 SRD（SPDT）" : "继电器 G5LE（SPDT）"; }
  else if (dir.startsWith("Display_7Segment")) { cat = "display"; zh = `七段数码管 ${b}`; }
  else if (dir.startsWith("Battery")) { cat = "power"; zh = /18650/.test(b) ? "18650 电池座" : /2xAA/.test(b) ? "2×AA 电池座" : "纽扣电池座 20 mm"; }
  else if (dir.startsWith("Sensor")) { cat = "sensor"; zh = "DHT11 温湿度传感器"; }
  return { cat, zh, pitch_mm };
}

// 少数按产品号手动修正分类
const FIX = {
  module: [3133, 1752, 2130, 3006, 4374, 6513, 987],
  sensor: [4565],
  driver: [4862, 4863, 3422],
  switch: [4918],
  led: [5201],
  power: [2124],
  display: [2232, 4367],
  connector: [4836, 3200, 2926],
  mcu: [5710, 5712, 5980, 2795, 3178, 3027, 5723, 5300, 5345, 5483, 5691, 4745, 5778, 5217, 5953, 4870],
};
const FIXMAP = {};
for (const [c, l] of Object.entries(FIX)) for (const n of l) FIXMAP[String(n)] = c;
const out = [];
const seen = new Set();
for (const p of fs.readFileSync(path.join(LIB, "ada_sel.txt"), "utf8").trim().split("\n")) {
  const dir = p.split("/")[0];
  const num = dir.match(/^\d+/)[0];
  if (seen.has(num)) continue;
  seen.add(num);
  const file = `${dir}__${path.basename(p)}`;
  if (!fs.existsSync(path.join(LIB, "adafruit", file))) continue;
  const name = dir.replace(/^\d+\s*/, "");
  out.push({
    id: `ada-${num}`, src: `adafruit/${file}`, name, name_zh: name, cat: FIXMAP[num] || adaCat(name), product: num,
    source: "Adafruit CAD Parts", licence: "MIT",
    url: `https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/${encodeURIComponent(dir)}`,
    product_url: `https://www.adafruit.com/product/${num}`,
  });
}
for (const p of fs.readFileSync(path.join(LIB, "kicad_sel.txt"), "utf8").trim().split("\n")) {
  const b = path.basename(p);
  if (!fs.existsSync(path.join(LIB, "kicad", b))) continue;
  const info = kicadInfo(p);
  out.push({
    id: "kc-" + b.replace(/\.step$/, "").replace(/[^A-Za-z0-9.-]+/g, "_").toLowerCase(), src: `kicad/${b}`,
    name: b.replace(/\.step$/, ""), name_zh: info.zh, cat: info.cat, pitch_mm: info.pitch_mm,
    source: "KiCad packages3D", licence: "CC-BY-SA-4.0（含 KiCad 设计例外条款）",
    url: `https://gitlab.com/kicad/libraries/kicad-packages3D/-/blob/master/${p}`,
  });
}
fs.writeFileSync(path.join(LIB, "manifest.json"), JSON.stringify(out, null, 1));
const c = {};
for (const e of out) c[e.cat] = (c[e.cat] || 0) + 1;
console.log(out.length, c);
