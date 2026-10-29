// 电路分析（简化）：
// 1) 拓扑网络：只看导线把哪些焊盘/线头连在一起。
// 2) 电气网络：只有“焊好”的焊点才导通；桥连会把相邻焊盘短在一起；没剥皮的线头不导通。
// 不做真实的电流/功耗仿真，电压只用理想电源模型（见 measure）。
import { allPins, neighborPins, partDisplayName, pinDisplayName } from "./parts";

const POS = ["bat+", "5v", "3v3", "vbat"];
const GND = ["gnd", "bat-"];
const ESP_SIG = ["gpio", "en", "rst", "dbg"];

function makeUF() {
  const parent = new Map();
  const find = (a) => {
    if (!parent.has(a)) parent.set(a, a);
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r);
    parent.set(a, r);
    return r;
  };
  const union = (a, b) => parent.set(find(a), find(b));
  return { find, union };
}

export const jointState = (joints, id) => joints[id]?.state || "none";

// 某个线头是不是真的接在焊盘上（电气意义上）
export function endConducts(w, end, joints) {
  if (w.loose === end) return false;
  if ((w.strip?.[end] || "ok") === "none") return false;
  return jointState(joints, w[end]) === "good";
}

export function buildNets(parts, wires, joints, electrical) {
  const pins = allPins(parts);
  const byId = new Map(pins.map((p) => [p.id, p]));
  const uf = makeUF();
  for (const p of pins) uf.find(p.id);
  for (const w of wires) {
    if (!byId.has(w.a) || !byId.has(w.b)) continue;
    if (w.loose) continue;
    if (electrical && !(endConducts(w, "a", joints) && endConducts(w, "b", joints))) continue;
    uf.union(w.a, w.b);
  }
  // 板上内部连接：两个 3V 脚是同一个网络
  for (const part of parts) if (part.type === "esp32") uf.union(`${part.id}.3V`, `${part.id}.3V_2`);
  if (electrical) {
    for (const [id, j] of Object.entries(joints)) if (j?.bridgeTo && byId.has(id) && byId.has(j.bridgeTo)) uf.union(id, j.bridgeTo);
  }
  const nets = new Map();
  for (const p of pins) {
    const r = uf.find(p.id);
    if (!nets.has(r)) nets.set(r, []);
    nets.get(r).push(p);
  }
  return { uf, nets, byId, netOf: (id) => nets.get(uf.find(id)) || [], same: (a, b) => uf.find(a) === uf.find(b) };
}

/**
 * @param opts.ignoreSolder 只看接线（引导模式“连线”一步）
 * @param opts.usb USB‑C 是否插着（Feather 靠 USB 供电）
 */
export function analyze(parts, wires, joints, opts = {}) {
  const topo = buildNets(parts, wires, joints, false);
  const elec = buildNets(parts, wires, joints, true);
  const use = opts.ignoreSolder ? topo : elec;
  const name = (id) => pinDisplayName(parts, id);
  const names = (list) => list.map((p) => name(p.id)).join("、");
  const wired = new Set();
  for (const w of wires) {
    if (w.loose !== "a") wired.add(w.a);
    if (w.loose !== "b") wired.add(w.b);
  }
  const issues = [];
  const add = (level, msg, pinIds = []) => issues.push({ level, msg, pins: pinIds });

  const esp = parts.find((p) => p.type === "esp32");
  const bat = parts.find((p) => p.type === "battery");
  const servos = parts.filter((p) => p.type === "servo");
  if (!esp) add("info", "还没放 Feather ESP32‑S3 开发板");
  if (!servos.length) add("info", "还没放舵机");
  if (!bat) add("info", "还没放电池盒");

  // 接线规则（按拓扑判断，焊接问题单独报）
  let shorted = false;
  let railShort = false;
  const checkNet = (net, viaBridge) => {
    const roles = net.map((p) => p.role);
    const pos = net.filter((p) => POS.includes(p.role));
    const gnd = net.filter((p) => GND.includes(p.role));
    const ids = net.map((p) => p.id);
    const pre = viaBridge ? "焊锡桥连造成" : "";
    if (pos.length && gnd.length) {
      shorted = true;
      if (pos.some((p) => p.role === "3v3" || p.role === "5v") && gnd.some((p) => p.role === "gnd")) railShort = true;
      add("error", `${pre}短路：${names(pos)} 和 ${names(gnd)} 接在了一起`, ids);
    }
    const posKinds = new Set(pos.map((p) => p.role));
    if (posKinds.size > 1) add("error", `${pre}两个不同的电源接在一起：${names(pos)}`, ids);
    const espSig = net.filter((p) => ESP_SIG.includes(p.role));
    if (pos.length && espSig.length) add("error", `${pre}电源接到了开发板信号脚：${names(pos)} → ${names(espSig)}`, ids);
    if (gnd.length && roles.includes("servo-sig")) add("error", `舵机信号线接到了地：${names(net.filter((p) => p.role === "servo-sig"))}`, ids);
    if (!pos.length && roles.includes("servo-vcc") && gnd.length)
      add("error", `舵机 VCC 接到了地（反接）：${names(net.filter((p) => p.role === "servo-vcc"))}`, ids);
    if (pos.length && roles.includes("servo-gnd")) add("error", `舵机 GND 接到了电源正极（反接）：${names(net.filter((p) => p.role === "servo-gnd"))}`, ids);
    if (espSig.length > 1) add(viaBridge ? "error" : "warn", `${pre}两个开发板引脚连在了一起：${names(espSig)}`, ids);
    if (roles.includes("servo-sig")) for (const g of espSig) if (!g.pwm) add("error", `${name(g.id)} 不能接舵机信号：${g.reserved}`, ids);
    if (roles.includes("bat+") && roles.includes("vbat"))
      add("error", "电池盒 + 接到了 BAT 脚：BAT 是单节锂电池输入（约 3.7–4.2 V），6 V 会损坏充电电路（简化：只提示）", ids);
    if (roles.includes("bat+") && roles.includes("5v"))
      add("warn", "电池盒 6 V 接到了 USB 脚：比 USB 的 5 V 高（简化：只提示，不模拟损坏）", ids);
  };
  for (const net of topo.nets.values()) if (net.length > 1) checkNet(net, false);
  // 桥连造成的额外短路
  for (const net of elec.nets.values()) {
    if (net.length < 2) continue;
    const r = topo.uf.find(net[0].id);
    if (net.some((p) => topo.uf.find(p.id) !== r)) checkNet(net, true);
  }

  // 每个舵机能不能动
  const servoStatus = {};
  let missingCommonGround = false;
  for (const s of servos) {
    const label = partDisplayName(s);
    const sigNet = use.netOf(`${s.id}.SIG`);
    const vccNet = use.netOf(`${s.id}.VCC`);
    const gndNet = use.netOf(`${s.id}.GND`);
    const reasons = [];
    const sigGpios = sigNet.filter((p) => p.role === "gpio");
    let gpio = null;
    if (sigNet.length < 2) reasons.push(opts.ignoreSolder ? "信号线（SIG）没接" : "信号线（SIG）不通：没接，或者焊点没焊好");
    else if (sigNet.some((p) => POS.includes(p.role) || GND.includes(p.role))) reasons.push("信号线接到了电源或地");
    else if (sigGpios.length !== 1) reasons.push(sigGpios.length > 1 ? "信号线同时连到了几个 GPIO（可能桥连）" : "信号线没接到 GPIO");
    else gpio = sigGpios[0].gpio;

    let source = null;
    if (vccNet.length < 2) reasons.push(opts.ignoreSolder ? "电源线（VCC）没接" : "电源线（VCC）不通：没接，或者焊点没焊好");
    else if (vccNet.some((p) => GND.includes(p.role))) reasons.push("VCC 接到了地");
    else if (vccNet.some((p) => p.role === "bat+")) source = "battery";
    else if (vccNet.some((p) => p.role === "5v")) {
      source = "usb5v";
      if (!opts.ignoreSolder && !opts.usb) reasons.push("VCC 接在 USB 脚上，但 USB‑C 没插，没有 5 V");
    } else if (vccNet.some((p) => p.role === "3v3")) reasons.push("3.3 V 太低，这类舵机要 4.8–6 V");
    else reasons.push("VCC 没接到电源");

    if (gndNet.length < 2) reasons.push(opts.ignoreSolder ? "地线（GND）没接" : "地线（GND）不通：没接，或者焊点没焊好");
    else if (gndNet.some((p) => POS.includes(p.role))) reasons.push("GND 接到了电源正极");
    else if (source === "battery") {
      if (!gndNet.some((p) => p.role === "bat-")) reasons.push("舵机地没回到电池盒 −");
      else if (!gndNet.some((p) => p.role === "gnd")) {
        reasons.push("缺少共地：电池盒 − 要和 Feather GND 连在一起，否则舵机看不懂信号");
        missingCommonGround = true;
      }
    } else if (source === "usb5v" && !gndNet.some((p) => p.role === "gnd")) reasons.push("舵机地没接到 Feather GND");
    if (!opts.ignoreSolder && !opts.usb) reasons.push("Feather 没通电（USB‑C 没插），GPIO 没有信号");
    if (shorted && !opts.ignoreSolder) reasons.push("电路里有短路（简化：电源保护断开）");

    servoStatus[s.id] = { label, ok: reasons.length === 0, gpio, source, reasons };
    if (source === "usb5v") add("warn", `${label} 用 USB 5 V 供电：舵机堵转时电流可能不够（简化：允许）`, [`${s.id}.VCC`]);
  }
  if (missingCommonGround) add("error", "缺少共地：电池盒 − 必须和 Feather GND 连在一起");

  // 焊接 / 导线状态
  if (!opts.ignoreSolder) {
    for (const id of wired) {
      const st = jointState(joints, id);
      if (st === "cold") add("error", `虚焊：${name(id)}（焊锡没润湿焊盘，接触不可靠）`, [id]);
      else if (st === "bridge") add("error", `桥连：${name(id)} 锡太多，和旁边的焊盘粘在一起了`, [id, joints[id].bridgeTo]);
      else if (st === "burnt") add("error", `焊盘烧坏：${name(id)}（加热太久，铜箔翘起，这个焊盘不能再用）`, [id]);
      else if (st !== "good") add("warn", `还没焊接：${name(id)}`, [id]);
    }
    for (const [id, j] of Object.entries(joints)) {
      if (j?.state === "bridge" && !wired.has(id)) add("error", `桥连：${name(id)} 上有多余的锡`, [id]);
      if (j?.state === "burnt" && !wired.has(id)) add("warn", `焊盘烧坏：${name(id)}`, [id]);
    }
    for (const w of wires) {
      for (const end of ["a", "b"]) {
        const s = w.strip?.[end] || "ok";
        if (w.loose === end) add("warn", `导线一头已经拆下来了（${name(w[end])} 那头），用连线工具把它接到新焊盘，或删掉这根线`, [w[end]]);
        else if (s === "none") add("error", `线头没剥皮：${name(w[end])}，绝缘皮挡着焊不上（用剥线钳）`, [w[end]]);
        else if (s === "nick") add("warn", `剥线时伤到铜丝：${name(w[end])}（能导通，但容易断）`, [w[end]]);
      }
    }
  }

  const errors = issues.filter((i) => i.level === "error").length;
  const warns = issues.filter((i) => i.level === "warn").length;
  const anyServoOk = Object.values(servoStatus).some((s) => s.ok);
  return {
    issues,
    servoStatus,
    shorted,
    railShort,
    errors,
    warns,
    wiredPins: [...wired],
    netOf: use.netOf,
    topoNetOf: topo.netOf,
    elec,
    pass: errors === 0 && anyServoOk && !issues.some((i) => i.msg.startsWith("还没焊接")),
  };
}

export const PWM_PERIOD_US = 20000;
export const pulseUs = (deg) => 500 + (Math.max(0, Math.min(180, deg)) / 180) * 2000;

/**
 * 虚拟万用表（简化）。
 * 通断档：两个表笔在同一个电气网络里就“嘀”。
 * 直流电压档：理想电源模型——电池盒 +/− 之间 6.00 V；USB 插着时 USB 脚 5.00 V、3V 脚 3.30 V（相对 GND）；
 * 正在输出舵机 PWM 的 GPIO 显示平均值 3.3 V × 脉宽 / 20 ms。电池和开发板没共地时，读数是浮动的。
 */
export function measure(ctx, red, black, mode) {
  const { parts, analysis, usb, pinCmd = {}, digital = {} } = ctx;
  if (!red || !black || mode === "off") return { kind: "none" };
  const { elec } = analysis;
  if (!elec.byId.has(red) || !elec.byId.has(black)) return { kind: "none" };
  const same = elec.same(red, black);
  if (mode === "cont") return { kind: "cont", beep: same, text: same ? "0.2" : "OL", unit: same ? "Ω" : "" };

  // 给每个网络算电位：{dom, v}
  const pot = new Map();
  const groupOf = { B: "B", E: "E" };
  const setPot = (id, dom, v) => {
    const r = elec.uf.find(id);
    const cur = pot.get(r);
    if (cur && (cur.dom !== dom || Math.abs(cur.v - v) > 0.01)) {
      if (cur.dom !== dom && Math.abs(cur.v - v) < 0.01 && v === 0) {
        groupOf.B = "BE";
        groupOf.E = "BE";
        return;
      }
      pot.set(r, { ...cur, conflict: true });
      return;
    }
    pot.set(r, { dom, v });
  };
  const railDown = analysis.railShort;
  for (const p of elec.byId.values()) {
    if (p.role === "bat+") setPot(p.id, "B", 6.0);
    if (p.role === "bat-") setPot(p.id, "B", 0);
    if (!usb) continue;
    if (p.role === "gnd") setPot(p.id, "E", 0);
    if (p.role === "5v") setPot(p.id, "E", 5.0);
    if (p.role === "3v3") setPot(p.id, "E", railDown ? 0 : 3.3);
    if (p.role === "gpio" && !railDown) {
      if (pinCmd[p.gpio] != null) setPot(p.id, "E", (3.3 * pulseUs(pinCmd[p.gpio])) / PWM_PERIOD_US);
      else if (digital[p.gpio] != null) setPot(p.id, "E", digital[p.gpio] ? 3.3 : 0);
    }
  }
  if (same) return { kind: "dcv", v: 0, text: "0.00", unit: "V" };
  const a = pot.get(elec.uf.find(red));
  const b = pot.get(elec.uf.find(black));
  if (a?.conflict || b?.conflict) return { kind: "dcv", v: 0, text: "0.00", unit: "V", note: "短路：这个网络被两个电源拉扯，读数没有意义" };
  if (a && b && groupOf[a.dom] === groupOf[b.dom]) {
    const v = a.v - b.v;
    const pwm = [red, black].some((id) => {
      const m = elec.byId.get(id);
      return m?.role === "gpio" && pinCmd[m.gpio] != null;
    });
    return { kind: "dcv", v, text: v.toFixed(2), unit: "V", note: pwm ? "PWM 平均值（简化）" : null };
  }
  return { kind: "dcv", floating: true, v: null, text: "0.0?", unit: "V", note: "读数在乱跳：两个表笔不在同一个参考地上，或者有一头悬空" };
}
