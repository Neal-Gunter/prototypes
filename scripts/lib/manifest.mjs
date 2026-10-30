// 生成零件清单（分类、来源、许可）。只用文件名/产品名做规则分类；不臆造任何参数。
// 用法：node scripts/lib/manifest.mjs  → ../libsrc/manifest.json
import fs from "node:fs";
import path from "node:path";
import { freecadEntries } from "./freecad.mjs";
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
  mech: "轴承 / 齿轮 / 带轮 / 型材",
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


// ---- v20：新增目录的通用规则（只从文件名取信息；名称里没有的不写） ----
const JST_RATING = { // JST 官方各系列数据手册的额定值（常见公开值）
  XH: "3 A / 250 V AC", PH: "2 A / 100 V AC", SH: "1 A / 50 V AC", GH: "1 A / 50 V AC", ZH: "1 A / 50 V AC", EH: "3 A / 250 V AC", VH: "10 A / 250 V AC",
};
export function kicadInfo2(file) {
  const b = path.basename(file).replace(/\.(step|stp)$/i, "");
  const dir = file.split("/")[0].replace(".3dshapes", "");
  const P = (b.match(/_P(\d+(?:\.\d+)?)mm/) || [])[1];
  const pitch_mm = P ? +P : null;
  const m = (re, i = 1) => (b.match(re) || [])[i] || "";
  const pinsN = m(/_(\d+)x(\d+)/) ? +m(/_(\d+)x(\d+)/, 1) * +m(/_(\d+)x(\d+)/, 2) : null;
  const pretty = b.replace(/_/g, " ");
  let cat = "passive", zh = pretty, rating = null, rating_src = null, iface = [];
  const D = (x) => dir.startsWith(x);
  if (D("Battery")) { cat = "power"; const k = m(/(18650|21700|14500|26650|CR\d{4}|LR44|2xAA|3xAA|4xAA|AAA|AA|9V|BR\d{4}|Coin)/i); zh = `电池座 ${k || ""}（${b.split("_").slice(1, 3).join(" ")}）`; }
  else if (D("Button_Switch_SMD")) { cat = "switch"; zh = /DIP/.test(b) ? `贴片拨码开关 ${m(/x(\d+)/)} 位` : /Slide|SPDT|DPDT/.test(b) ? "贴片拨动开关" : /Rotary|Encoder/i.test(b) ? "贴片旋转开关" : "贴片轻触按键"; zh += `（${pretty.replace(/^SW /, "")}）`; }
  else if (D("Button_Switch")) { cat = "switch"; zh = /Encoder|Rotary/i.test(b) ? "旋转编码器" : /DIP/.test(b) ? `拨码开关 ${m(/x(\d+)/)} 位` : /Toggle|SPDT|DPDT|Slide|CK_/.test(b) ? "拨动/钮子开关" : /Reed/.test(b) ? "干簧管" : /Tactile|PUSH|Push/i.test(b) ? "轻触按键" : /Micro|Omron_D2F|Lever/i.test(b) ? "微动开关" : "开关"; zh += `（${pretty.replace(/^SW /, "")}）`; }
  else if (D("Buzzer")) { cat = "module"; zh = `蜂鸣器（${pretty}）`; }
  else if (D("Connector_AMASS")) { cat = "connector"; zh = `AMASS ${m(/(XT\d+)/)} 电源插${/-M/.test(b) ? "头（公）" : "座（母）"}`; iface = ["power"]; }
  else if (D("Connector_Audio")) { cat = "connector"; zh = `3.5 mm 音频座（${pretty}）`; iface = ["audio"]; }
  else if (D("Connector_BarrelJack")) { cat = "connector"; zh = `DC 圆孔电源座（${pretty.replace("BarrelJack ", "")}）`; iface = ["power"]; }
  else if (D("Connector_JST")) { cat = "connector"; const s = m(/JST_(\w\w)_/); zh = `JST-${s} ${m(/1x(\d+)/) || m(/2x(\d+)/) * 2 || ""} 针${/_S\w*B-|Horizontal/.test(b) ? "（卧式）" : ""}`; if (JST_RATING[s]) { rating = JST_RATING[s]; rating_src = `JST ${s} 系列数据手册`; } iface = ["jst"]; }
  else if (D("Connector_USB")) { cat = "connector"; zh = /USB_A/.test(b) ? "USB-A 母座" : /USB_C/.test(b) ? "USB-C 座" : /Micro/.test(b) ? "Micro-USB 母座" : /Mini/.test(b) ? "Mini-USB 母座" : /USB_B/.test(b) ? "USB-B 母座" : "USB 座"; zh += `（${pretty.replace(/^USB /, "")}）`; iface = ["usb"]; }
  else if (D("Connector_IDC")) { cat = "connector"; zh = `IDC 牛角座 ${m(/(2x\d+)/)} ${pitch_mm ?? ""} mm${/Horizontal/.test(b) ? "（弯）" : ""}`; iface = ["header"]; }
  else if (D("Connector_Molex")) { cat = "connector"; const s = m(/Molex_([A-Za-z-]+(?:_\d\.\d+)?)/).replace(/_/g, " "); zh = `Molex ${s} ${pinsN ?? ""} 针`; }
  else if (D("Package_SO")) { cat = "semi"; zh = `贴片 IC 封装 ${b.split("_")[0]}（${b.split("_").slice(1).join(" ")}，KiCad 通用封装模型）`; } // v22：DRV8833PW / TB6612FNG 引脚映射用
  else if (D("Connector_PinHeader")) { cat = "connector"; zh = `排针 ${m(/(\dx\d+)/)} 2.54 mm${/Horizontal/.test(b) ? "（弯针）" : ""}`; iface = ["header"]; }
  else if (D("Connector_PinSocket")) { cat = "connector"; zh = `排母 ${m(/(\dx\d+)/)} 2.54 mm${/Horizontal/.test(b) ? "（弯）" : ""}`; iface = ["header"]; }
  else if (D("Connector_Card")) { cat = "connector"; zh = `存储卡座（${pretty}）`; iface = ["spi"]; }
  else if (D("Connector_RJ")) { cat = "connector"; zh = `RJ 网口（${pretty}）`; iface = ["ethernet"]; }
  else if (D("Connector")) { cat = "connector"; zh = `连接器（${pretty}）`; }
  else if (D("Display_7Segment")) { cat = "display"; zh = `七段数码管 ${b}`; }
  else if (D("Display")) { cat = "display"; zh = /OLED/i.test(b) ? `OLED 屏（${pretty}）` : /EA_|LCD|HD44780|NHD/i.test(b) ? `字符/点阵 LCD（${pretty}）` : `显示器件（${pretty}）`; }
  else if (D("Fuse")) { cat = "passive"; zh = /Holder|holder/.test(b) ? `保险丝座（${pretty}）` : /Blade|Littelfuse_Mini|Auto/i.test(b) ? `汽车插片保险丝（${pretty}）` : /PTC|Polyfuse/i.test(b) ? `自恢复保险丝 PTC（${pretty}）` : `保险丝（${pretty}）`; }
  else if (D("Module")) { cat = "mcu"; zh = pretty.replace("RaspberryPi", "Raspberry Pi"); }
  else if (D("Relay")) { cat = "driver"; zh = `继电器${/SMD/.test(dir) ? "（贴片）" : ""}（${pretty.replace(/^Relay /, "")}）`; }
  else if (D("RF_Module")) { cat = "module"; zh = `无线模组 ${pretty}`; iface = [/ESP|WROOM/.test(b) ? "wifi" : /nRF|BLE|BT/i.test(b) ? "ble" : /LoRa|RFM|SX12/.test(b) ? "lora" : "rf"]; }
  else if (D("Sensor_Audio")) { cat = "sensor"; zh = `麦克风（${pretty}）`; iface = ["audio"]; }
  else if (D("Sensor_Current")) { cat = "sensor"; zh = `电流传感器（${pretty}）`; }
  else if (D("Sensor_Distance")) { cat = "sensor"; zh = `测距传感器（${pretty}）`; }
  else if (D("Sensor_Humidity")) { cat = "sensor"; zh = `温湿度传感器（${pretty}）`; }
  else if (D("Sensor_Pressure")) { cat = "sensor"; zh = `气压传感器（${pretty}）`; }
  else if (D("Sensor")) { cat = "sensor"; zh = `传感器（${pretty}）`; }
  else if (D("Potentiometer")) { cat = "passive"; zh = /Trimmer|Bourns_3/.test(b) ? `微调电位器（${pretty}）` : `旋转电位器（${pretty}）`; }
  else if (D("TerminalBlock")) { cat = "connector"; zh = `接线端子 ${+m(/1x(\d+)/)} 位 ${pitch_mm ?? ""} mm（${b.split("_")[2] || "Phoenix"}）`; iface = ["power"]; }
  else if (D("Package_TO")) { cat = "semi"; zh = `${b.split("_")[0]} 封装${/Horizontal/.test(b) ? "（卧式）" : ""}`; }
  else if (D("Package_DIP")) { cat = "semi"; zh = `${m(/(DIP-\d+)/)} ${/Socket/.test(b) ? "IC 插座" : "芯片"}（${m(/W([\d.]+)mm/)} mm 宽）`; }
  else if (D("Converter_DCDC")) { cat = "power"; zh = `DC-DC 电源模块（${pretty.replace(/^Converter DCDC /, "")}）`; }
  else if (D("OptoDevice")) { cat = "sensor"; zh = /Opto|PC817|Optocoupler/i.test(b) ? `光耦（${pretty}）` : /IR|TSOP|Vishay_MOLD|Receiver/i.test(b) ? `红外接收/光电器件（${pretty}）` : `光电器件（${pretty}）`; }
  else if (D("Heatsink")) { cat = "enclosure"; zh = `散热片（${pretty}）`; }
  else if (D("MountingEquipment")) { cat = "fastener"; zh = `安装件（${pretty}）`; }
  else if (D("LED")) { cat = "led"; zh = /RGB/.test(b) ? `RGB LED（${pretty}）` : `直插 LED Φ${m(/D([\d.]+)mm/) || "?"} mm${/IR/.test(b) ? "（红外）" : ""}（${b.split("_").slice(1, 3).join(" ")}）`; }
  else if (D("Capacitor")) { cat = "passive"; zh = `电解电容 Φ${m(/D([\d.]+)mm/)} mm（脚距 ${pitch_mm ?? "?"} mm）`; }
  else if (D("Inductor")) { cat = "passive"; zh = /Toroid/.test(b) ? `磁环电感（${pretty}）` : `立式功率电感（${pretty}）`; }
  else if (D("Diode")) { cat = "semi"; zh = `二极管 ${m(/D_([\w-]+?)_/) || b}`; }
  return { cat, zh, pitch_mm, pins: pinsN, rating, rating_src, iface };
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

// ---- v20 新增来源（追加在后面，旧零件的顺序和 id 不变） ----
const V20 = path.join(LIB, "v20");
const readSel = (f) => (fs.existsSync(path.join(V20, f)) ? fs.readFileSync(path.join(V20, f), "utf8").split("\n").filter(Boolean) : []);
const slug = (s) => s.replace(/\.(step|stp)$/i, "").replace(/[^A-Za-z0-9.-]+/g, "_").toLowerCase();
for (const p of readSel("ada_sel_v20.txt")) {
  const dir = p.split("/")[0];
  const num = dir.match(/^\d+/)[0];
  if (seen.has(num)) continue;
  const file = `${dir}__${path.basename(p)}`;
  if (!fs.existsSync(path.join(LIB, "adafruit", file))) continue;
  seen.add(num);
  const name = dir.replace(/^\d+\s*/, "");
  out.push({ id: `ada-${num}`, src: `adafruit/${file}`, name, name_zh: name, cat: FIXMAP[num] || adaCat(name), product: num,
    source: "Adafruit CAD Parts", licence: "MIT", author: "Adafruit Industries",
    url: `https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/${encodeURIComponent(dir)}`, product_url: `https://www.adafruit.com/product/${num}` });
}
const ids = new Set(out.map((e) => e.id));
for (const p of readSel("kicad_sel_v20.txt")) {
  const b = path.basename(p);
  const id = "kc-" + slug(b);
  if (ids.has(id) || !fs.existsSync(path.join(LIB, "kicad", b))) continue;
  ids.add(id);
  const info = kicadInfo2(p);
  out.push({ id, src: `kicad/${b}`, name: b.replace(/\.step$/, ""), name_zh: info.zh, cat: info.cat, pitch_mm: info.pitch_mm, pins: info.pins ?? undefined,
    rating: info.rating ?? undefined, rating_src: info.rating_src ?? undefined, iface: info.iface,
    source: "KiCad packages3D", licence: "CC-BY-SA-4.0（含 KiCad 设计例外条款）", author: "KiCad Library Team 及贡献者",
    url: `https://gitlab.com/kicad/libraries/kicad-packages3D/-/blob/master/${p}` });
}
const SFE_CAT = { Board: "mcu", Camera: "sensor", Connector: "connector", Display: "display", Fuse: "passive", GNSS: "module", Hardware: "fastener", LED: "led", RF: "module", Sensor: "sensor", Switch: "switch", Battery: "power" };
const SFE_ZH = { Board: "主控板", Camera: "摄像头", Connector: "连接器", Display: "显示屏", Fuse: "保险丝", GNSS: "GNSS 定位模组", Hardware: "五金件", LED: "LED", RF: "射频器件", Sensor: "传感器", Switch: "开关", Battery: "电池座", Electromechanical: "机电件" };
for (const p of readSel("sfe_sel.txt")) {
  const d = p.split("/")[1].replace(".3dshapes", "");
  const file = path.basename(p).replace(/ /g, "_");
  const id = "sfe-" + slug(file);
  if (ids.has(id) || !fs.existsSync(path.join(LIB, "sparkfun", file))) continue;
  ids.add(id);
  const nm = path.basename(p).replace(/\.(step|stp)$/i, "");
  let cat = SFE_CAT[d] || "module";
  if (d === "Electromechanical") cat = /Relay/.test(nm) ? "driver" : /Encoder/.test(nm) ? "switch" : "module";
  const zh = `${d === "Electromechanical" ? (/Relay/.test(nm) ? "继电器" : /Encoder/.test(nm) ? "滚轮编码器" : "蜂鸣器") : SFE_ZH[d] || d}（${nm.replace(/_/g, " ")}）`;
  const P = (nm.match(/(\d+(?:\.\d+)?)mm/) || [])[1];
  out.push({ id, src: `sparkfun/${file}`, name: nm.replace(/_/g, " "), name_zh: zh, cat, pitch_mm: d === "Connector" && P ? +P : undefined,
    iface: /Qwiic/.test(nm) ? ["i2c"] : /USB/.test(nm) ? ["usb"] : /JST/.test(nm) ? ["jst"] : /microSD/.test(nm) ? ["spi"] : undefined,
    source: "SparkFun KiCad Libraries", licence: "CC-BY-4.0", author: "SparkFun Electronics",
    url: `https://github.com/sparkfun/SparkFun-KiCad-Libraries/blob/main/${p.split("/").map(encodeURIComponent).join("/")}` });
}
for (const p of readSel("esp_sel.txt")) {
  const file = path.basename(p);
  const id = "esp-" + slug(file);
  if (ids.has(id) || !fs.existsSync(path.join(LIB, "espressif", file))) continue;
  ids.add(id);
  const nm = file.replace(/\.(step|stp)$/i, "").toUpperCase();
  out.push({ id, src: `espressif/${file}`, name: nm, name_zh: `乐鑫 ${nm} 模组${/U(E|C)?$|-1U|-02U/.test(nm) ? "（外接天线 IPEX）" : ""}`, cat: "module", iface: ["wifi", "ble"],
    source: "Espressif KiCad Libraries", licence: "CC-BY-SA-4.0（含 KiCad 设计例外条款）", author: "Espressif Systems",
    url: `https://github.com/espressif/kicad-libraries/blob/main/${p}` });
}
for (const p of readSel("seeed_sel.txt")) {
  const file = path.basename(p).replace(/ /g, "_");
  const id = "seeed-" + slug(file);
  if (ids.has(id) || !fs.existsSync(path.join(LIB, "seeed", file))) continue;
  ids.add(id);
  const nm = p.split("/").slice(-2, -1)[0];
  out.push({ id, src: `seeed/${file}`, name: nm, name_zh: /himax/i.test(file) ? "Grove Vision AI V2 摄像头模组" : `Seeed ${nm} LoRa 模组`, cat: /himax/i.test(file) ? "sensor" : "module",
    iface: /himax/i.test(file) ? ["camera"] : ["lora"], source: "Seeed Studio OPL KiCad Library", licence: "CC-BY-SA-4.0", author: "Seeed Studio",
    url: `https://github.com/Seeed-Studio/OPL_Kicad_Library/tree/master/${p.split("/").slice(0, -1).map(encodeURIComponent).join("/")}` });
}
for (const e of freecadEntries(LIB)) if (!ids.has(e.id)) { ids.add(e.id); out.push(e); } // v21：FreeCAD-library（CC BY 3.0）
fs.writeFileSync(path.join(LIB, "manifest.json"), JSON.stringify(out, null, 1));
const c = {};
for (const e of out) c[e.cat] = (c[e.cat] || 0) + 1;
console.log(out.length, c);
