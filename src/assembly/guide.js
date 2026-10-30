// 从“台面上真实装好的样子”生成照着做的装配指南：物料清单、针脚对针脚接线表、步骤、对照现实读数、固件。
// 早期原型，简化仿真：所有电气读数来自本模拟（标注“模拟读数”），不是实测。
import { CABLES } from "./procedural.js";
import { buildCircuit, solve, members, termLabel, elemKind, legNames, boardOf, boardPins, meter } from "./netlist.js";

// 通用规格（只写零件本身的规格，不写价格；没核实的标“估算”）
const SPEC = [
  [/^kc-raspberrypi_pico$/, (P) => ({ spec: "Raspberry Pi Pico（RP2040，无排针版；需要自己焊 2 条 1×20 排针）", doc: "https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html" })],
  [/^kc-r_axial_din0207/, (P) => ({ spec: `${fmtOhm(P.state.ohms || 220)} 色环电阻，直插 DIN0207 封装（常见 1/4 W），卧装脚距 10.16 mm` })],
  [/^kc-led_d5\.0mm$/, () => ({ spec: "5 mm 直插 LED（模拟按红色、正向压降约 2.0 V 估算）；长脚是阳极" })],
  [/^kc-sw_push_6mm/, () => ({ spec: "6×6 mm 直插轻触按键（4 脚，两两内部相通）" })],
  [/^kc-potentiometer_bourns_3386w/, (P) => ({ spec: `Bourns 3386W 卧式微调电位器 ${fmtOhm(P.state.ohms || 10000)}（3 脚）` })],
  [/^kc-pinheader_1x(\d+)_p2\.54mm/, (P, m) => ({ spec: `2.54 mm 单排直针排针 1×${+m[1]}（可以从 1×40 掰断）` })],
  [/^p-breadboard-half$/, () => ({ spec: "半尺寸免焊面包板 400 孔（30 列 × 10 行 + 两侧电源轨）" })],
  [/^ada-1143$/, () => ({ spec: "微型舵机（金属齿轮，3 线：棕 GND / 红 VCC / 橙 SIG）" })],
];
const CABLE_SPEC = {
  "dupont-mm": "杜邦线 公‑公 20 cm（2.54 mm 插针）",
  "dupont-ff": "杜邦线 母‑母 20 cm",
  "dupont-mf": "杜邦线 公‑母 20 cm",
  "micro-usb": "Micro‑USB 数据线（必须是能传数据的线，不是只能充电的线）",
  "usb-c": "USB‑C 数据线（能传数据）",
};
function fmtOhm(r) { return r >= 1000 ? `${+(r / 1000).toFixed(2)} kΩ` : `${r} Ω`; }
const mm = (d) => (d ? `${+d.x.toFixed(1)} × ${+d.z.toFixed(1)} × ${+d.y.toFixed(1)} mm` : "—");

export function makeGuide(engine, { steps = [], title = "我的电路", listText = "", sketch = "", fw = {} } = {}) {
  const cir = buildCircuit(engine);
  const sol = solve(cir, fw);
  const cableEnds = new Set(engine.cables.flatMap((c) => c.endUids.filter((u) => u && /^p-(dupont|plug)/.test(engine.parts.get(u)?.def.id || ""))));
  // ---- 物料清单 ----
  const groups = new Map();
  for (const P of engine.parts.values()) {
    if (cableEnds.has(P.uid)) continue;
    const id = P.def.id.replace(/:flip$/, "");
    if (!groups.has(id)) groups.set(id, { id, name: P.def.name_zh || P.def.name || id, dims: mm(P.def.dims_mm), dims_src: P.def.dims_src || "", qty: 0, refs: [], links: [], licence: P.def.licence || P.def.license || "", spec: "" });
    const g = groups.get(id);
    g.qty++;
    if (P.state.ref) g.refs.push(P.state.ref);
    if (!g.spec) {
      for (const [re, f] of SPEC) { const m = id.match(re); if (m) { const s = f(P, m); g.spec = s.spec; if (s.doc) g.links.push({ zh: "官方资料", url: s.doc }); break; } }
      if (P.def.product_url) g.links.push({ zh: "商品 / 资料页", url: P.def.product_url });
      if (P.def.url) g.links.push({ zh: "3D 模型来源", url: P.def.url });
    }
  }
  for (const c of engine.cables) {
    const id = `cable:${c.kind}`;
    if (c.kind === "servo-lead") continue; // 舵机自带
    if (!groups.has(id)) groups.set(id, { id, name: CABLES[c.kind]?.zh || c.kind, dims: c.kind.startsWith("dupont") ? "长 20 cm，插针 2.54 mm" : `长约 ${CABLES[c.kind]?.len || "?"} cm（估算）`, qty: 0, refs: [], links: [], spec: CABLE_SPEC[c.kind] || "" });
    groups.get(id).qty++;
  }
  const bom = [...groups.values()].sort((a, b) => order(a.id) - order(b.id));
  // ---- 接线表：每个和开发板相连的节点 ----
  const mem = members(cir);
  const N = (t) => cir.uf.find(t);
  const nets = [];
  const boards = [...engine.parts.values()].filter((P) => boardOf(P.def));
  for (const B of boards) {
    boardPins(B.def).forEach((pin, i) => {
      if (!pin) return;
      const t = cir.T(B.uid, `p${i}`);
      const ms = mem.get(N(t)) || [];
      const others = [...new Set(ms.filter((x) => !x.startsWith(B.uid + "|") && isEnd(engine, x, cableEnds)).map((x) => termLabel(engine, x)))];
      if (!others.length) return;
      nets.push({ pin: `${B.state.ref} ${pin.label}`, phys: pin.phys ?? i + 1, role: pin.role || "", to: others, v: sol.v(t) });
    });
  }
  nets.sort((a, b) => a.phys - b.phys);
  // ---- 按清单的“针脚对孔”表 ----
  const holes = [];
  for (const s of steps) {
    if (s.k === "board") holes.push({ ref: s.ref, what: "开发板（带排针）", where: `${s.a[0]} 脚 → ${s.a[1]}，${s.b[0]} 脚 → ${s.b[1]}（其余脚依次排开）` });
    if (s.k === "part") {
      const P = [...engine.parts.values()].find((p) => p.state.ref === s.ref);
      const ln = P ? legNames(P.def) : [];
      const ord = P ? [...(P.def.legs || [])].map((l, k) => ({ i: l.i ?? k, p: l.p })).sort((a, b) => a.p[0] - b.p[0] || a.p[2] - b.p[2]).map((l) => l.i) : [];
      s.holes.forEach((h, k) => holes.push({ ref: s.ref, what: legZh(ln[ord[k]], elemKind(P?.def || {}), k), where: h }));
    }
    if (s.k === "wire") holes.push({ ref: s.ref, what: CABLES[s.kind]?.zh || s.kind, where: `${s.a} ↔ ${s.b}` });
    if (s.k === "jumper") holes.push({ ref: s.ref, what: "跳线", where: `${s.a} ↔ ${s.b}` });
    if (s.k === "servo") holes.push({ ref: s.ref, what: "舵机线（经 3 针排针）", where: `棕 GND → ${s.holes[0]}，红 VCC → ${s.holes[1]}，橙 SIG → ${s.holes[2]}` });
    if (s.k === "usb") holes.push({ ref: s.ref, what: "USB 数据线", where: "插到开发板 USB 口，另一头接电脑" });
  }
  // ---- 对照现实：模拟读数（用万用表在实物上量同样两点来对比） ----
  const real = [];
  for (const B of boards) {
    const pins = boardPins(B.def);
    const find = (re) => pins.findIndex((p) => p && re.test(p.label));
    const g = find(/^GND$/), v3 = find(/^3V3$/), vb = find(/^VBUS$/);
    if (g >= 0 && v3 >= 0) real.push({ what: `${B.state.ref} 3V3 对 GND（插着 USB）`, sim: meter(cir, sol, cir.T(B.uid, `p${v3}`), cir.T(B.uid, `p${g}`), "V").text, how: `红表笔 3V3（${pins[v3].phys} 脚），黑表笔 GND（${pins[g].phys} 脚）；读数应接近 3.3 V` });
    if (g >= 0 && vb >= 0) real.push({ what: `${B.state.ref} VBUS 对 GND`, sim: meter(cir, sol, cir.T(B.uid, `p${vb}`), cir.T(B.uid, `p${g}`), "V").text, how: `VBUS（${pins[vb].phys} 脚）是 USB 的 5 V；USB 规范允许 4.75–5.25 V，线和口的压降会让它略低` });
  }
  for (const P of engine.parts.values()) {
    const k = elemKind(P.def);
    if (k === "res") real.push({ what: `${P.state.ref} 两端电阻（断电量）`, sim: meter(cir, sol, cir.T(P.uid, "l0"), cir.T(P.uid, "l1"), "ohm").text.replace(/（.*/, ""), how: `拔掉 USB 再量；色环电阻有 ±1%–±5% 的误差，在电路里量会受并联支路影响` });
    if (k === "led") real.push({ what: `${P.state.ref} 亮的时候的电流`, sim: `${(sol.leds.find((l) => l.uid === P.uid)?.mA || 0).toFixed(2)} mA（按下按键时会变化）`, how: "量电阻两端电压 ÷ 电阻值 = 电流；不要把万用表电流档直接并在 LED 上" });
  }
  return {
    title,
    made: new Date().toISOString(),
    listText,
    sketch,
    bom,
    nets,
    holes,
    real,
    steps: assemblySteps(steps, engine),
    counts: { parts: engine.parts.size - cableEnds.size, cables: engine.cables.length },
  };
}
function order(id) {
  const o = [/breadboard/, /pico|feather|esp32|mcu/, /pinheader/, /r_axial/, /led/, /sw_/, /potentiometer/, /^ada-1143/, /cable:dupont/, /cable:/];
  const i = o.findIndex((re) => re.test(id));
  return i < 0 ? 99 : i;
}
function isEnd(engine, t, cableEnds) {
  const [uid, k] = t.split("|");
  if (k.startsWith("n:")) return false; // 面包板列本身不算终点
  if (cableEnds.has(uid)) return false; // 杜邦触点是中间导体
  const P = engine.parts.get(uid);
  if (!P) return false;
  const kind = elemKind(P.def);
  return kind && kind !== "header" && kind !== "jumper";
}
function legZh(n, kind, k) {
  const Z = { K: "阴极 K（短脚，壳上切边一侧）", A: "阳极 A（长脚）", W: "滑片（中间脚）", 1: "脚 1", 3: "脚 3" };
  if (kind === "btn") return ["左上脚", "左下脚", "右上脚", "右下脚"][k] || `脚 ${k + 1}`;
  if (kind === "res") return `第 ${k + 1} 脚（电阻不分方向）`;
  return Z[n] || `脚 ${k + 1}`;
}
function assemblySteps(steps, engine) {
  const out = [];
  const has = (k) => steps.some((s) => s.k === k);
  if (has("bb")) out.push({ t: "放好面包板", d: "放在平整、不导电的桌面上（不要放在金属、碎线头上）。中间的槽把两边隔开；a–e 一组、f–j 一组，同一列 5 个孔导通。" });
  for (const s of steps.filter((x) => x.k === "board")) {
    out.push({ t: `${s.ref}：给开发板焊排针`, d: "把两条 1×20 排针长脚朝下插进面包板，开发板放上去（面包板当夹具，保证排针垂直）。先焊对角两个脚固定，检查板子是平的，再焊其余的脚。", solder: true });
    out.push({ t: `${s.ref}：检查焊点`, d: "合格焊点光亮、呈小圆锥、包住针脚；发灰起球、针脚周围有缝的是虚焊（补焊：加一点助焊剂再加热）；相邻两点连在一起的是连锡（用吸锡带吸掉）。", solder: true });
    out.push({ t: `${s.ref}：插到面包板上`, d: `${s.a[0]} 脚对准 ${s.a[1]}、${s.b[0]} 脚对准 ${s.b[1]}，均匀用力按下，板子跨在中间槽上。USB 口朝面包板外侧。` });
  }
  const parts = steps.filter((x) => x.k === "part");
  if (parts.length) out.push({ t: "插元件", d: parts.map((s) => `${s.ref} → ${s.holes.join(" / ")}`).join("；") + "。LED 分正负：长脚（阳极）接电阻那一侧；电阻不分方向；按键 4 个脚两两相通，按清单方向插。" });
  const wires = steps.filter((x) => x.k === "wire" || x.k === "jumper");
  if (wires.length) out.push({ t: "接导线", d: wires.map((s) => `${s.ref}：${s.a} ↔ ${s.b}`).join("；") + "。导线不用绷紧，留一点余量；接一根核对一根。" });
  for (const s of steps.filter((x) => x.k === "servo")) out.push({ t: `${s.ref}：接舵机`, d: `在 ${s.holes.join(" / ")} 插一段 1×3 排针，把舵机线母头套上：棕 → ${s.holes[0]}，红 → ${s.holes[1]}，橙 → ${s.holes[2]}。舵机用 USB 的 5 V（VBUS）供电，地线要和开发板共地。` });
  if (has("usb")) out.push({ t: "通电前检查", d: "拔着 USB，用万用表通断档量 3V3 对 GND、VBUS 对 GND：都不应该“嘀”（不通）。确认 LED 方向、没有导线插错列。" });
  if (has("usb")) out.push({ t: "上传固件并测试", d: "按住 Pico 的 BOOTSEL 键插上 USB，用 Arduino IDE（安装 Raspberry Pi Pico/RP2040 板子包）打开下载的 .ino 上传。打开串口监视器（115200），按按键 LED 应该亮，转电位器舵机跟着转。" });
  return out;
}
export const SAFETY = [
  "通用安全提示（一般建议，不针对具体产品，以你手上零件和工具的说明书为准）：",
  "烙铁头温度很高，不用时放回烙铁架；焊接时戴护目镜，焊锡可能飞溅。",
  "在通风处焊接，不要直接吸入助焊剂烟雾；焊完洗手（尤其是含铅焊锡）。",
  "改接线前先拔掉 USB；通电时不要用手或金属工具同时碰两个针脚。",
  "闻到焦味、零件发烫或电脑提示 USB 过流：立刻拔掉 USB，再查短路。",
  "舵机转动时手指远离舵盘；不要用手硬掰通电的舵机。",
  "剪排针、剪元件脚时用手指挡住飞出的线头，或者在袋子里剪。",
  "LED 一定要串限流电阻；不要把 5 V（VBUS）接到 Pico 的 GPIO 上（GPIO 只能承受 3.3 V）。",
];
