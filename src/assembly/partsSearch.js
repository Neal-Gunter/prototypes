// v20：零件库全文检索和筛选（纯函数，浏览器和 node 测试共用）。
// 中英文同义词（我的补充）：搜“舵机”也能找到 servo，搜 relay 也能找到“继电器”。
export const SYN = [
  ["舵机", "servo"], ["电机", "motor"], ["马达", "motor"], ["步进", "stepper", "nema"], ["无刷", "bldc", "brushless"], ["减速", "gear motor", "gearmotor", "tt"],
  ["排针", "pinheader", "header"], ["排母", "pinsocket", "socket"], ["继电器", "relay"], ["传感器", "sensor"], ["显示", "display", "oled", "lcd", "tft", "e-ink", "epaper", "segment"],
  ["屏", "display", "oled", "lcd", "tft"], ["墨水屏", "e-ink", "epaper", "eink"], ["数码管", "7segment", "segment"], ["电池", "battery", "cell", "lipo", "18650"], ["锂电", "lipo", "li-ion", "18650"],
  ["电池座", "battery holder", "holder"], ["轴承", "bearing"], ["直线轴承", "lm8uu", "lm"], ["齿轮", "gear"], ["带轮", "pulley", "gt2"], ["同步带", "gt2", "belt"], ["型材", "extrusion", "2020", "profile"],
  ["铝型材", "extrusion"], ["保险丝", "fuse"], ["开关", "switch"], ["按键", "button", "push", "tactile"], ["拨码", "dip"], ["连接器", "connector"], ["端子", "terminal", "terminalblock"],
  ["接线端子", "terminalblock"], ["螺丝", "screw"], ["螺钉", "screw"], ["内六角", "cap screw", "socket head", "iso 4762"], ["螺母", "nut"], ["垫圈", "washer"], ["铜柱", "standoff", "spacer"],
  ["热熔螺母", "insert", "heat-set"], ["摄像头", "camera", "ov2640", "ov5640"], ["麦克风", "microphone", "mic", "mems", "pdm"], ["超声波", "ultrasonic", "hc-sr04", "sr04"],
  ["陀螺仪", "imu", "gyro", "mpu", "bno", "lsm", "icm"], ["加速度", "accelerometer", "imu", "lis3dh", "adxl"], ["测距", "tof", "distance", "vl53", "lidar", "ultrasonic"], ["温度", "temperature", "temp", "bme", "sht", "dht"],
  ["湿度", "humidity", "sht", "dht", "bme"], ["气压", "pressure", "bmp", "bme", "lps"], ["光照", "light", "lux", "tsl", "veml"], ["电流", "current", "ina", "acs"], ["驱动", "driver", "drv", "tb6612", "a4988", "l298"],
  ["电机驱动", "motor driver", "drv8833", "tb6612", "l298", "a4988", "tmc"], ["开发板", "board", "feather", "arduino", "pico", "esp32", "dev"], ["主控", "mcu", "microcontroller", "esp32", "rp2040", "stm32", "atmega"],
  ["模组", "module", "wroom", "wrover"], ["无线", "wifi", "ble", "bluetooth", "lora", "rf"], ["蓝牙", "ble", "bluetooth", "nrf"], ["电感", "inductor"], ["电容", "capacitor", "cp_radial"], ["电阻", "resistor"],
  ["二极管", "diode"], ["发光二极管", "led"], ["灯", "led", "neopixel", "ws2812"], ["蜂鸣器", "buzzer"], ["喇叭", "speaker"], ["电位器", "potentiometer", "pot"], ["散热片", "heatsink"],
  ["降压", "buck", "step-down", "dcdc"], ["升压", "boost", "step-up"], ["电源", "power", "dcdc", "regulator", "barrel"], ["插座", "jack", "socket"], ["圆口", "barrel", "dc jack"], ["网口", "rj45", "rj"],
  ["卡座", "card", "sd", "sim"], ["光耦", "opto", "optocoupler"], ["面包板", "breadboard"], ["杜邦", "dupont"], ["香蕉", "xt30", "xt60", "xt90"], ["光轴", "shaft", "rod"], ["支架", "bracket"], ["角码", "corner bracket"],
];
const SYN_MAP = (() => {
  const m = new Map();
  for (const g of SYN) for (const w of g) { const k = w.toLowerCase(); m.set(k, [...new Set([...(m.get(k) || []), ...g.map((x) => x.toLowerCase())])]); }
  return m;
})();
export const norm = (s) => String(s || "").toLowerCase().replace(/[_\-‑]+/g, " ").replace(/\s+/g, " ");
// 从电压字符串或数组得到 [最小, 最大] V；没有就 null
export function voltRange(v) {
  if (v == null) return null;
  const nums = Array.isArray(v) ? v.map(Number) : [...String(v).matchAll(/(\d+(?:\.\d+)?)\s*(?:[–\-~]\s*(\d+(?:\.\d+)?))?\s*V/g)].flatMap((m) => [+m[1], m[2] ? +m[2] : +m[1]]);
  const f = nums.filter((x) => x > 0 && x < 1000);
  return f.length ? [Math.min(...f), Math.max(...f)] : null;
}
// 名称 / 编号 / 标签（不含分类名）：命中这里比只命中分类名排得靠前
export function makeNameHay(r) {
  return norm(`${r.id} ${r.name} ${r.name_zh} ${(r.iface || []).join(" ")} ${r.tags || ""}`);
}
export function makeHay(r) {
  return norm(`${r.id} ${r.name} ${r.name_zh} ${r.catLabel || ""} ${r.cat} ${(r.iface || []).join(" ")} ${r.tags || ""} ${r.src || ""}`);
}
// 每个词都要命中（与），词本身或任一同义词出现在文本里即算命中；返回分数（0 = 不匹配）
export function score(r, q) {
  const toks = norm(q).trim().split(" ").filter(Boolean);
  if (!toks.length) return 1;
  const hay = r.hay || (r.hay = makeHay(r));
  const nh = r.nhay || (r.nhay = makeNameHay(r));
  let s = 0;
  for (const t of toks) {
    const alts = [t, ...(SYN_MAP.get(t) || [])];
    // 中文连写（如“舵机驱动”）：也试试按词典拆开的子串
    for (const [k, v] of SYN_MAP) if (/[\u4e00-\u9fff]/.test(t) && t !== k && t.includes(k)) alts.push(...v, k);
    let hit = 0;
    for (const a of alts) {
      const i = hay.indexOf(a);
      if (i < 0) continue;
      // 只在分类名里出现（如搜“舵机”命中“电机 / 舵机 / 步进”分类里的直流电机）只给 1 分
      const h = nh.indexOf(a) < 0 ? 1 : (a === t ? 3 : 2) + (norm(r.name_zh).startsWith(a) || norm(r.name).startsWith(a) ? 2 : 0);
      hit = Math.max(hit, h);
    }
    if (!hit) return 0;
    s += hit;
  }
  return s;
}
export const maxDim = (d) => (d ? Math.max(d.x, d.y, d.z) : 0);
// f = { q, cat, kind, iface, volt, lic, src, minMm, maxMm, only: Set|null }
export function filterRows(rows, f) {
  const out = [];
  for (const r of rows) {
    if (f.cat && f.cat !== "all" && r.cat !== f.cat) continue;
    if (f.kind && f.kind !== "all" && (f.kind === "real") !== r.real) continue;
    if (f.iface && f.iface !== "all" && !(r.iface || []).includes(f.iface)) continue;
    if (f.lic && f.lic !== "all" && r.lic !== f.lic) continue;
    if (f.src && f.src !== "all" && r.src !== f.src) continue;
    if (f.volt && f.volt !== "all") { const v = +f.volt; if (!r.vr || v < r.vr[0] - 1e-6 || v > r.vr[1] + 1e-6) continue; }
    const md = maxDim(r.dims);
    if (f.minMm && md < +f.minMm) continue;
    if (f.maxMm && md > +f.maxMm) continue;
    if (f.only && !f.only.has(r.id)) continue;
    const s = score(r, f.q || "");
    if (!s) continue;
    out.push([s, r]);
  }
  if ((f.q || "").trim()) out.sort((a, b) => b[0] - a[0]);
  return out.map((x) => x[1]);
}
export const SRC_ZH = { ada: "Adafruit CAD Parts", kicad: "KiCad 3D 模型库", sfe: "SparkFun KiCad 库", esp: "Espressif KiCad 库", seeed: "Seeed OPL KiCad 库", freecad: "FreeCAD 零件库", proc: "本项目程序生成" };
export const LIC_ZH = { MIT: "MIT", "CC-BY-SA-4.0": "CC BY‑SA 4.0", "CC-BY-4.0": "CC BY 4.0", "CC-BY-3.0": "CC BY 3.0", CC0: "CC0（本项目程序生成）" };
export const IFACE_ZH = { i2c: "I²C", spi: "SPI", uart: "UART / 串口", usb: "USB", can: "CAN", i2s: "I²S", wifi: "Wi‑Fi", ble: "蓝牙 BLE", lora: "LoRa", pwm: "PWM / 舵机信号", jst: "JST 接口", header: "排针 2.54", power: "电源接口", battery: "电池", fuse: "保险丝", shaft: "轴", gear: "齿轮", belt: "同步带", slot: "型材槽", "4-wire": "四线（步进）", stepper: "步进", "3-phase": "三相", esc: "电调", "2-wire": "两线", "m3-grid": "M3 孔阵" };
