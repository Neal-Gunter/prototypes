// 电路检查：只按“哪些引脚连在一起”做简化规则判断，不做真实的电压/电流仿真。
import { allPins, partDisplayName, pinDisplayName } from "./parts";

const POS = ["bat+", "5v", "3v3"];
const GND = ["gnd", "bat-"];

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

/**
 * @param parts 已放上底板的零件
 * @param wires [{id,a,b}]
 * @param joints {pinId: 'none'|'cold'|'good'}
 * @param opts.ignoreSolder 只看接线是否正确（引导模式“连线”一步用）
 */
export function analyze(parts, wires, joints, opts = {}) {
  const pins = allPins(parts);
  const byId = new Map(pins.map((p) => [p.id, p]));
  const uf = makeUF();
  const wired = new Set();
  for (const w of wires) {
    if (!byId.has(w.a) || !byId.has(w.b)) continue;
    uf.union(w.a, w.b);
    wired.add(w.a);
    wired.add(w.b);
  }
  const nets = new Map();
  for (const p of pins) {
    const r = uf.find(p.id);
    if (!nets.has(r)) nets.set(r, []);
    nets.get(r).push(p);
  }
  const netOf = (id) => nets.get(uf.find(id)) || [];
  const name = (id) => pinDisplayName(parts, id);
  const names = (list) => list.map((p) => name(p.id)).join("、");

  const issues = [];
  const add = (level, msg, pinIds = []) => issues.push({ level, msg, pins: pinIds });

  // 1. 零件是否齐
  const esp = parts.find((p) => p.type === "esp32");
  const bat = parts.find((p) => p.type === "battery");
  const servos = parts.filter((p) => p.type === "servo");
  if (!esp) add("info", "还没放 ESP32‑S3 开发板");
  if (!servos.length) add("info", "还没放舵机");
  if (!bat) add("info", "还没放电池盒");

  // 2. 每个网络的规则
  let shorted = false;
  for (const net of nets.values()) {
    if (net.length < 2) continue;
    const roles = net.map((p) => p.role);
    const pos = net.filter((p) => POS.includes(p.role));
    const gnd = net.filter((p) => GND.includes(p.role));
    const sig = net.filter((p) => p.role === "servo-sig" || p.role === "gpio" || p.role === "en");
    const ids = net.map((p) => p.id);
    if (pos.length && gnd.length) {
      shorted = true;
      add("error", `短路：${names(pos)} 和 ${names(gnd)} 接在了一起`, ids);
    }
    const posKinds = new Set(pos.map((p) => p.role));
    if (posKinds.size > 1) add("error", `两个不同的电源接在一起：${names(pos)}`, ids);
    if (pos.length && sig.length) add("error", `电源接到了信号脚：${names(pos)} → ${names(sig)}`, ids);
    if (gnd.length && net.some((p) => p.role === "servo-sig"))
      add("error", `舵机信号线接到了地：${names(net.filter((p) => p.role === "servo-sig"))}`, ids);
    if (!pos.length && roles.includes("servo-vcc") && gnd.length)
      add("error", `舵机 VCC 接到了地（反接）：${names(net.filter((p) => p.role === "servo-vcc"))}`, ids);
    if (pos.length && roles.includes("servo-gnd"))
      add("error", `舵机 GND 接到了电源正极（反接）：${names(net.filter((p) => p.role === "servo-gnd"))}`, ids);
    const gpios = net.filter((p) => p.role === "gpio" || p.role === "en");
    if (gpios.length > 1) add("warn", `两个 ESP32 引脚连在了一起：${names(gpios)}`, ids);
    if (net.some((p) => p.role === "servo-sig")) {
      for (const g of gpios) {
        if (!g.pwm) add("error", `${name(g.id)} 不适合接舵机信号：${g.reserved}`, ids);
      }
    }
  }

  // 3. 每个舵机能不能动
  const servoStatus = {};
  let missingCommonGround = false;
  for (const s of servos) {
    const label = partDisplayName(s);
    const sigNet = netOf(`${s.id}.SIG`);
    const vccNet = netOf(`${s.id}.VCC`);
    const gndNet = netOf(`${s.id}.GND`);
    const reasons = [];
    const sigGpios = sigNet.filter((p) => p.role === "gpio" && p.pwm);
    let gpio = null;
    if (sigNet.length < 2) reasons.push("信号线（SIG）没接");
    else if (sigNet.some((p) => POS.includes(p.role) || GND.includes(p.role))) reasons.push("信号线接到了电源或地");
    else if (sigGpios.length !== 1) reasons.push("信号线没接到可用的 PWM 引脚");
    else gpio = sigGpios[0].name;

    let source = null;
    if (vccNet.length < 2) reasons.push("电源线（VCC）没接");
    else if (vccNet.some((p) => GND.includes(p.role))) reasons.push("VCC 接到了地");
    else if (vccNet.some((p) => p.role === "bat+")) source = "battery";
    else if (vccNet.some((p) => p.role === "5v")) source = "usb5v";
    else if (vccNet.some((p) => p.role === "3v3")) reasons.push("3.3 V 太低，MG90S 需要 4.8–6 V");
    else reasons.push("VCC 没接到电源");

    if (gndNet.length < 2) reasons.push("地线（GND）没接");
    else if (gndNet.some((p) => POS.includes(p.role))) reasons.push("GND 接到了电源正极");
    else if (source === "battery") {
      if (!gndNet.some((p) => p.role === "bat-")) reasons.push("舵机地没回到电池盒 −");
      else if (!gndNet.some((p) => p.role === "gnd")) {
        reasons.push("缺少共地：电池盒 − 要和 ESP32 GND 连在一起");
        missingCommonGround = true;
      }
    } else if (source === "usb5v") {
      if (!gndNet.some((p) => p.role === "gnd")) reasons.push("舵机地没接到 ESP32 GND");
    }

    if (!opts.ignoreSolder) {
      const related = [...sigNet, ...vccNet, ...gndNet].filter((p) => wired.has(p.id));
      const cold = related.filter((p) => joints[p.id] === "cold");
      const none = related.filter((p) => joints[p.id] !== "good" && joints[p.id] !== "cold");
      if (cold.length) reasons.push(`有虚焊：${names(cold)}`);
      if (none.length) reasons.push(`还没焊：${names(none)}`);
    }
    if (shorted) reasons.push("电路里有短路（简化：电源保护断开，什么都不工作）");

    servoStatus[s.id] = {
      label,
      ok: reasons.length === 0,
      gpio,
      source,
      reasons,
      usbWarn: source === "usb5v",
    };
    if (source === "usb5v")
      add("warn", `${label} 用 USB 5V 供电：多个舵机同时动时电流可能不够（简化：允许）`, [`${s.id}.VCC`]);
  }
  if (missingCommonGround) add("error", "缺少共地：电池盒 − 必须和 ESP32 GND 连在一起，否则舵机收不到正确的信号");

  // 4. 焊点
  if (!opts.ignoreSolder) {
    for (const id of wired) {
      const st = joints[id];
      if (st === "cold") add("error", `虚焊：${name(id)}（焊锡没充分熔化，接触不可靠）`, [id]);
      else if (st !== "good") add("warn", `还没焊接：${name(id)}`, [id]);
    }
  }

  // 5. 接了线但两头悬空的舵机
  for (const s of servos) {
    const st = servoStatus[s.id];
    const touched = ["SIG", "VCC", "GND"].some((n) => wired.has(`${s.id}.${n}`));
    if (touched && !st.ok) {
      for (const r of st.reasons) {
        if (r.startsWith("有虚焊") || r.startsWith("还没焊") || r.startsWith("电路里有短路") || r.startsWith("缺少共地")) continue;
        add("warn", `${st.label}：${r}`);
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
    errors,
    warns,
    wiredPins: [...wired],
    netOf,
    pass: errors === 0 && anyServoOk && !issues.some((i) => i.msg.startsWith("还没焊接")),
  };
}
