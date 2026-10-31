// v25：“从零做一只八爪鱼”引导项目（v10 紧凑无线版）。纯函数：浏览器页面和 node 测试共用。早期原型，简化仿真（我的补充）。
// 步骤：① 选零件（BOM）② 装配（摆放）③ 接线（引脚到引脚）④ 焊接（含返修）⑤ 仿真检查（网表 / 电源 / 固件）⑥ 装触手 → 生成制作单。
// 数据来源：接线和零件 = bench.js benchV10；引脚名 = parts.js OCTO_PINS / 程序零件引脚表（Adafruit 引脚图）；电压电流 = circuit.js evaluateV10（直流估算）；
// 焊点 = solderModel.js（和 3D 装配台同一套估算模型）；固件引脚 = 固件源码 octopus_body.h / octopus_batt.h 里 OCTO_V10 分支的常量。
import { benchSpec } from "../assembly/octopus/bench.js";
import { evaluateV10, pinTable } from "../assembly/octopus/circuit.js";
import { DECK_V10 } from "../assembly/octopus/layout-v10.js";
import { SERVO_PINS, BATT_PIN, LIPO, BOOST } from "../assembly/octopus/v10.js";
import { V10_FW } from "../assembly/octopus/guide-v10.js";
import { solderGrade, PAD_REWORK_MAX, DESOLDER_OVERHEAT_S, PART_HEAT_MAX_S } from "../assembly/solderModel.js";

export const PROJECT_KEY = "octo-project-v25";
export const STEPS = [
  { k: "bom", zh: "选零件", en: "Pick parts" },
  { k: "assemble", zh: "装配", en: "Assemble" },
  { k: "wire", zh: "接线", en: "Wire" },
  { k: "solder", zh: "焊接", en: "Solder" },
  { k: "check", zh: "仿真检查", en: "Simulation checks" },
  { k: "finish", zh: "装触手 · 制作单", en: "Arms · build sheet" },
];
export const REF = () => benchSpec({ variant: "v10", fault: "none" });
const ROLE_ZH = { QTPY: "主控 QT Py", BAT: "电池", CHG: "充电板", BST1: "升压 1", BST2: "升压 2", SW: "开关", DIV: "分压板", CAP1: "电容 1", CAP2: "电容 2" };
export const roleZh = (r) => ROLE_ZH[r] || (/^S\d$/.test(r) ? `舵机 ${r}` : r);

// —— ① BOM：从参考台面数出来（零件 id → 数量） ——
export function bomRequired() {
  const b = REF(); const req = {};
  for (const r of b.roles) { const id = b.defs[r]; req[id] = (req[id] || 0) + 1; }
  req["ada-2201"] = b.servos.length;
  req["p-octo-frame-v10"] = 1; req["p-octo-arm-v10"] = 8;
  return req;
}
export const BOM_WHY = {
  "ada-5426": "主控：8 路 LEDC PWM + BLE", "ada-2201": "SG51R 微型舵机，每条触手一个", "ada-258": "1S 1200 mAh LiPo（带保护板）", "ada-4410": "USB‑C 充电板（JST 电池座 + BAT/GND 焊盘）",
  "ada-4654": "MiniBoost 5 V 升压，每个带 4 个舵机", "ada-805": "拨动开关（只过 QT Py + EN 的小电流）", "p-octo-vdiv-1s": "100k/100k 分压，电池检测（我的补充）",
  "kc-cp_radial_d6.3mm_p2.50mm": "升压输出电容（容值估算）", "p-octo-frame-v10": "PLA 骨架（自制打印，我的补充）", "p-octo-arm-v10": "PLA 短触手（自制打印，我的补充）",
};
export function checkBom(state) {
  const req = bomRequired(), have = state.bom || {}; const out = [];
  for (const [id, n] of Object.entries(req)) { const h = have[id] || 0; out.push({ ok: h === n, zh: `${id} × ${n}${h !== n ? `（现在 ${h}）` : ""}`, hint: h < n ? `还差 ${n - h} 个：${BOM_WHY[id] || ""}。在零件库里搜 “${id}”` : h > n ? `多了 ${h - n} 个，减掉` : "" }); }
  const extra = Object.keys(have).filter((id) => have[id] > 0 && !req[id]);
  if (extra.length) out.push({ ok: false, level: "warn", zh: `清单外的零件：${extra.join("、")}`, hint: "v10 用不到，删掉（不影响后面的步骤）" });
  return out;
}

// —— ② 装配：机身上的位置（DECK_V10）+ 8 个舵机槽 ——
export const SLOTS = ["FRAME", ...Array.from({ length: 8 }, (_, i) => `S${i}`), "BAT", "CHG", "QTPY", "BST1", "BST2", "CAP1", "CAP2", "DIV", "SW"];
export const SLOT_NEEDS = { CHG: ["BAT"], QTPY: ["BAT"] }; // 充电板和 QT Py 贴在电池上面
const ON_BAT = new Set(["CHG", "QTPY"]);
// dims：{ 零件 id: [x, z, y] mm }（index.json 的顺序：宽 × 深 × 高）
export function footprint(role, slot, dims) {
  const b = REF(); const id = b.defs[role]; const d = dims[id]; const s = DECK_V10[slot]; if (!d || !s) return null;
  const rot = Math.round((((s.yaw % 180) + 180) % 180) / 90) % 2 === 1; const w = (rot ? d[1] : d[0]) / 20, dd = (rot ? d[0] : d[1]) / 20; // 半宽 cm
  return { x0: s.p[0] - w, x1: s.p[0] + w, z0: s.p[2] - dd, z1: s.p[2] + dd, layer: ON_BAT.has(slot) ? 1 : 0 };
}
export const DECK_R = 4.0; // cm，上层板半径（parts.js FRAME_V10.deckR）
export function checkAssemble(state, dims) {
  const pl = state.placed || {}, order = state.order || []; const out = [];
  out.push({ ok: !!pl.FRAME, zh: "骨架放在桌上（第一件）", hint: "先放骨架：舵机槽和上层板都在骨架上" });
  if (pl.FRAME && order[0] !== "FRAME") out.push({ ok: false, zh: "骨架不是第一件", hint: "骨架之前放的零件没有地方固定：重置装配，从骨架开始" });
  const sv = Array.from({ length: 8 }, (_, i) => `S${i}`);
  const svOk = sv.filter((s) => pl[s] === s).length;
  out.push({ ok: svOk === 8, zh: `8 个舵机装进对应的槽（${svOk}/8）`, hint: "每个 SG51R 卡进底板上它自己的槽，舵机轴朝外（装配图）" });
  const deck = SLOTS.filter((s) => DECK_V10[s]);
  for (const r of deck) {
    const at = pl[r];
    if (!at) { out.push({ ok: false, zh: `${roleZh(r)} 还没放`, hint: DECK_V10[r].why }); continue; }
    if (at !== r) out.push({ ok: false, zh: `${roleZh(r)} 放在了 ${roleZh(at)} 的位置`, hint: `正确位置：${DECK_V10[r].why}` });
    for (const need of SLOT_NEEDS[r] || []) { const i = order.indexOf(r), j = order.indexOf(need); if (j < 0 || j > i) out.push({ ok: false, zh: `${roleZh(r)} 比电池先放`, hint: `${roleZh(r)} 贴在电池上面：先放电池，再拿掉 ${roleZh(r)} 重放` }); }
  }
  // 重叠 / 超出上层板（按库里零件的外形尺寸算，同一层两两比较）
  const fp = deck.filter((r) => pl[r]).map((r) => ({ r, f: footprint(r, pl[r], dims) })).filter((x) => x.f);
  for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++) {
    const a = fp[i].f, b = fp[j].f; if (a.layer !== b.layer) continue;
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
    if (ox > 0.01 && oz > 0.01) out.push({ ok: false, zh: `${roleZh(fp[i].r)} 和 ${roleZh(fp[j].r)} 重叠 ${(Math.min(ox, oz) * 10).toFixed(1)} mm`, hint: "按库里外形尺寸算的；换回各自的位置" });
  }
  for (const { r, f } of fp) { const R = Math.max(...[[f.x0, f.z0], [f.x0, f.z1], [f.x1, f.z0], [f.x1, f.z1]].map(([x, z]) => Math.hypot(x, z))); if (R > DECK_R + 0.01) out.push({ ok: false, zh: `${roleZh(r)} 超出上层板 ${((R - DECK_R) * 10).toFixed(1)} mm`, hint: "上层板 Ø8 cm；超出的部分会被触手扫到" }); }
  return out;
}

// —— ③ 接线：节点 = "角色:引脚" ——
export function nodeList() {
  const b = REF(); const L = [];
  for (const r of b.roles) for (const [p, d] of Object.entries(pinTable(r, b).pins)) L.push({ n: `${r}:${p}`, role: r, pin: p, label: d.label || p });
  for (const s of b.servos) for (const [p, c] of [["PWM", "橙"], ["V+", "红"], ["GND", "棕"]]) L.push({ n: `${s.role}:${p}`, role: s.role, pin: p, label: `${c}线 ${p}` });
  return L;
}
const GPIO_OF = Object.fromEntries([...SERVO_PINS, { pad: BATT_PIN.pad, gpio: BATT_PIN.gpio }].map((p) => [p.pad, p.gpio]));
export function nodeLabel(n) {
  const [r, p] = n.split(":"); const node = nodeList().find((x) => x.n === n); const g = r === "QTPY" && GPIO_OF[p] != null ? `（GPIO${GPIO_OF[p]}）` : "";
  return `${roleZh(r)} · ${node ? node.label : p}${g}`;
}
// 参考接线（展开成两两相连的节点对；JST 是插头，其余是焊接）
export function refConnections() {
  const b = REF(); const C = [];
  for (const w of b.wires) {
    if (w.kind === "octo-v10-servo") { const s = w.a[0]; C.push({ a: `${s}:PWM`, b: `QTPY:${w.b[1]}`, color: "orange", why: `${s} 橙线 PWM → QT Py ${w.b[1]}（GPIO${GPIO_OF[w.b[1]]}）` }, { a: `${s}:V+`, b: `${w.rail}:OUT`, color: "red", why: `${s} 红线 V+ → ${roleZh(w.rail)} OUT` }, { a: `${s}:GND`, b: `${w.rail}:GND`, color: "brown", why: `${s} 棕线 GND → ${roleZh(w.rail)} GND` }); continue; }
    C.push({ a: `${w.a[0]}:${w.a[1]}`, b: `${w.b[0]}:${w.b[1]}`, color: w.color, why: w.why, jst: w.kind === "octo-jst" });
  }
  return C;
}
export const keyOf = (a, b) => [a, b].sort().join("~");
// 焊点：板子上的焊盘（JST 插头和舵机线本身不算）
const NOSOLDER = new Set(["BAT:BAT+", "BAT:BAT-", "CHG:JST+", "CHG:JST-"]);
export const isPad = (n) => !NOSOLDER.has(n) && !/^S\d:/.test(n);
export const NEIGHBOR = { QTPY: [["A0", "A1", "A2", "A3", "SDA", "SCL", "TX"], ["5V", "GND", "3V3", "MO", "MI", "SCK", "RX"], ["BAT", "BGND"]], BST1: [["IN", "GND", "EN", "OUT"]], BST2: [["IN", "GND", "EN", "OUT"]], SW: [["1", "COM", "3"]], DIV: [["IN", "GND", "OUT"]], CAP1: [["+", "-"]], CAP2: [["+", "-"]], CHG: [["BAT"], ["GND"]] };
export function neighbors(n) { const [r, p] = n.split(":"); for (const row of NEIGHBOR[r] || []) { const i = row.indexOf(p); if (i >= 0) return [row[i - 1], row[i + 1]].filter(Boolean).map((q) => `${r}:${q}`); } return []; }
export function padsInUse(state) { const s = new Set(); for (const w of state.wires || []) for (const n of [w.a, w.b]) if (isPad(n)) s.add(n); return [...s].sort(); }

// 用户的台面 → evaluateV10 能吃的 bench。ideal = 只看接线意图（焊点全当合格、电池当插上）
export function userBench(state, { ideal = false, swOn, batPlugged } = {}) {
  const ref = REF(); const J = state.joints || {};
  const plugged = ideal || (batPlugged ?? !!state.batPlugged);
  const conducts = (n) => ideal || !isPad(n) || J[n]?.q === "good" || J[n]?.q === "bridge";
  const wires = [];
  for (const w of state.wires || []) {
    const jst = NOSOLDER.has(w.a) && NOSOLDER.has(w.b);
    if (jst && !plugged) continue;
    if (!conducts(w.a) || !conducts(w.b)) continue;
    wires.push({ a: w.a.split(":"), b: w.b.split(":"), kind: "user" });
  }
  if (!ideal) for (const [n, j] of Object.entries(J)) if (j.q === "bridge" && j.to) wires.push({ a: n.split(":"), b: j.to.split(":"), kind: "bridge" });
  return { ...ref, wires, swOn: swOn ?? state.swOn ?? true, _ideal: ideal };
}
// 网表对比：参考网（并查集）里应该连在一起的有没有断开；不该连的有没有短路
export function netDiff(state, opts = {}) {
  const ref = REF(); const refRes = evaluateV10({ ...ref, swOn: false }); const ub = userBench(state, { ...opts, swOn: false }); const ur = evaluateV10(ub);
  const nodes = nodeList().map((x) => x.n);
  const missing = [], shorts = [];
  for (const c of refConnections()) if (!ur.same(c.a, c.b)) missing.push(c);
  const seen = new Set();
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (ur.same(a, b) && !refRes.same(a, b)) { const k = [rootOf(refRes, a, nodes), rootOf(refRes, b, nodes)].sort().join("|"); if (!seen.has(k)) { seen.add(k); shorts.push({ a, b }); } }
  }
  return { missing, shorts, bench: ub, res: ur };
}
function rootOf(res, a, nodes) { return nodes.find((n) => res.same(n, a)); }
export function checkWire(state) {
  const d = netDiff(state, { ideal: true }); const out = [];
  out.push({ ok: d.missing.length === 0, zh: `参考接线全部接上（缺 ${d.missing.length} 根）`, hint: d.missing[0] ? `下一根：${nodeLabel(d.missing[0].a)} → ${nodeLabel(d.missing[0].b)}（${d.missing[0].why}）` : "" });
  out.push({ ok: d.shorts.length === 0, zh: `没有多余 / 接错的连接（${d.shorts.length} 处）`, hint: d.shorts[0] ? `${nodeLabel(d.shorts[0].a)} 和 ${nodeLabel(d.shorts[0].b)} 本来不该连在一起——删掉多出来的那根线` : "" });
  const gnd = d.res.same("BAT:BAT+", "BAT:BAT-"); if (gnd) out.push({ ok: false, zh: "电池 + 和 − 被接成同一个网：插上电池就是短路", hint: "立刻删掉把 BAT 和 GND 连在一起的线" });
  return out;
}

// —— ④ 焊接 / 返修（solderModel.js：和装配台同一套估算阈值） ——
export function solderOp(state, n, { t, flux = false, desolder = false }) {
  const s = structuredClone(state); s.joints ||= {}; s.heat ||= {}; s.log ||= [];
  const role = n.split(":")[0];
  if (s.batPlugged) { s.log.push({ n, msg: "电池还插着：先拔电池再焊（制作单第 4 步）", ok: false }); return { state: s, msg: "电池还插着：先拔电池再焊", ok: false }; }
  const j = (s.joints[n] ||= { q: null, wear: 0 });
  if (j.q === "lifted") return { state: s, msg: "这个焊盘已经翘起来了：真实中要飞线或换一块板（点“换新板”）", ok: false };
  s.heat[role] = +((s.heat[role] || 0) + t).toFixed(2);
  const hot = s.heat[role] > PART_HEAT_MAX_S ? `；${roleZh(role)} 累计受热 ${s.heat[role].toFixed(0)} s（估算上限 ${PART_HEAT_MAX_S} s），真实中可能已经受热损坏` : "";
  let msg, ok;
  if (desolder) {
    if (!j.q) return { state: s, msg: "这里没有焊点可拆", ok: false };
    if (t < 0.6) { msg = "加热太短，锡没化开，焊点还在"; ok = false; }
    else if (t > DESOLDER_OVERHEAT_S || j.wear + 1 > PAD_REWORK_MAX) { j.q = "lifted"; j.wear++; delete j.to; msg = t > DESOLDER_OVERHEAT_S ? `拆焊加热 ${t.toFixed(1)} s > ${DESOLDER_OVERHEAT_S} s：焊盘翘起（估算）` : `这个焊盘已返修 ${PAD_REWORK_MAX} 次，这次翘起来了（估算）`; ok = false; }
    else { j.q = null; j.wear++; delete j.to; msg = `拆掉了（第 ${j.wear} 次返修${j.wear === PAD_REWORK_MAX ? "，再拆一次会翘起" : ""}）`; ok = true; }
  } else {
    if (j.q === "good") return { state: s, msg: "已经是合格焊点了", ok: true };
    const nb = neighbors(n); const used = padsInUse(s);
    const g = solderGrade(t, flux, nb.length > 0);
    if (j.q === "bridge" && g !== "burnt") { // 补焊连锡：有助焊剂能拉开，没有就还是连着（和装配台同一规则）
      if (flux) { j.q = "good"; delete j.to; msg = "加助焊剂补焊：连锡拉开了"; ok = true; } else { msg = "补焊后仍是连锡：涂助焊剂再补焊，或者拆掉重焊"; ok = false; }
    } else if (g === null) { msg = `加热 ${t.toFixed(1)} s 太短，锡没上去`; ok = false; }
    else if (g === "burnt") { j.q = "lifted"; delete j.to; msg = `加热 ${t.toFixed(1)} s 太久：焊盘烫坏、翘起（估算阈值 ${(3.5 * (flux ? 0.6 : 1.4)).toFixed(1)} s）`; ok = false; }
    else { j.q = g; if (g === "bridge") j.to = nb.find((q) => used.includes(q)) || nb[0]; msg = g === "good" ? "合格：光亮的小锥形" : g === "cold" ? `虚焊：加热 ${t.toFixed(1)} s 不够（要 ≥ ${flux ? 0.6 : 1.4} s），不导通——拆掉或补焊` : `连锡：锡流到 ${nodeLabel(j.to)}，两个焊盘短路了——涂助焊剂补焊或拆掉重焊`; ok = g === "good"; }
    if (j.q === "cold" && g === "good") j.q = "good";
  }
  s.log.push({ n, t, flux, desolder, msg: msg + hot, ok });
  return { state: s, msg: msg + hot, ok };
}
export function replaceBoard(state, role) { const s = structuredClone(state); for (const n of Object.keys(s.joints || {})) if (n.startsWith(role + ":")) delete s.joints[n]; s.heat = { ...(s.heat || {}), [role]: 0 }; s.replaced = [...(s.replaced || []), role]; return s; }
export function checkSolder(state) {
  const pads = padsInUse(state); const J = state.joints || {}; const out = [];
  const by = (q) => pads.filter((n) => (J[n]?.q || null) === q);
  out.push({ ok: pads.length > 0 && by("good").length === pads.length, zh: `焊点合格 ${by("good").length}/${pads.length}`, hint: pads.find((n) => J[n]?.q !== "good") ? `下一个：${nodeLabel(pads.find((n) => J[n]?.q !== "good"))}` : "先完成接线" });
  if (by("cold").length) out.push({ ok: false, zh: `虚焊 ${by("cold").length} 个：${by("cold").map(nodeLabel).join("、")}`, hint: "加热时间不够：补焊（有助焊剂 ≥ 0.6 s，没有 ≥ 1.4 s，估算）" });
  if (by("bridge").length) out.push({ ok: false, zh: `连锡 ${by("bridge").length} 个`, hint: "涂助焊剂再补焊；或者切到拆焊，吸掉再焊" });
  if (by("lifted").length) out.push({ ok: false, zh: `焊盘翘起 ${by("lifted").length} 个：${by("lifted").map(nodeLabel).join("、")}`, hint: "点“换新板”（真实中也可以飞线）" });
  const hot = Object.entries(state.heat || {}).filter(([, v]) => v > PART_HEAT_MAX_S);
  if (hot.length) out.push({ ok: true, level: "warn", zh: `受热偏多：${hot.map(([r, v]) => `${roleZh(r)} ${v.toFixed(0)} s`).join("、")}（估算上限 ${PART_HEAT_MAX_S} s）`, hint: "仿真里不改电路，只提醒：真实中可能已经受热损坏" });
  if (by("good").length !== pads.length) out.push({ ok: !state.batPlugged, zh: "焊接时电池是拔掉的", hint: "先拔掉电池 JST 插头（插着电池不能焊）" });
  return out;
}
// 焊接顺序（我的补充）：先小板、再电源主路、最后信号线；电池最后插
export const SOLDER_ORDER = [
  { roles: ["DIV"], why: "分压小板先焊好（3 个焊盘，离别的零件远，练手）" },
  { roles: ["BST1", "BST2"], why: "两个升压：IN / GND / EN / OUT 四个焊盘挨得近（2.54 mm 间距，按库里模型估算），最容易连锡——加助焊剂、每点 1–1.5 s" },
  { roles: ["CAP1", "CAP2"], why: "电容腿焊到升压 OUT / GND（注意极性：长脚 +）" },
  { roles: ["SW"], why: "拨动开关 3 个脚：1 = 电池 +、COM = 去 EN / QT Py、3 = GND" },
  { roles: ["CHG"], why: "充电板 BAT / GND 焊盘：这里一个焊盘要并 3–4 根线，最后焊、多给点锡（不要超过 3 s）" },
  { roles: ["QTPY"], why: "QT Py：背面 BAT / GND 焊盘 + 正面 8 个舵机信号 + A3。QT Py 焊点最多、板子最小，放在最后，每点 ≤ 2 s" },
];
export function solderSequence(state) {
  const pads = padsInUse(state); const out = [];
  for (const g of SOLDER_ORDER) for (const r of g.roles) for (const n of pads.filter((p) => p.startsWith(r + ":"))) out.push({ n, why: g.why });
  return out;
}

// —— ⑤ 仿真检查 ——
export function firmwarePins(bodyH, battH) {
  const v10 = (src) => { const i = src.indexOf("#if OCTO_V10"); return i >= 0 ? src.slice(i, src.indexOf("#else", i) > 0 ? src.indexOf("#else", i) : undefined) : src; };
  const m = /kV10Pins\[8\]\s*=\s*\{([^}]*)\}/.exec(bodyH || ""); const servo = m ? m[1].split(",").map((x) => +x.trim()) : null;
  const b = /kPin\s*=\s*(\d+)/.exec(v10(battH || "")); return { servo, batt: b ? +b[1] : null };
}
const PAD_OF_GPIO = Object.fromEntries(Object.entries(GPIO_OF).map(([p, g]) => [g, p]));
export function checkSim(state, fw) {
  const out = []; const d = netDiff(state);
  out.push({ group: "网表", ok: d.missing.length === 0, zh: `实际导通的网表 = 参考网表（断开 ${d.missing.length} 处）`, hint: d.missing[0] ? `${nodeLabel(d.missing[0].a)} ↔ ${nodeLabel(d.missing[0].b)} 不通：${isPad(d.missing[0].a) && state.joints?.[d.missing[0].a]?.q !== "good" ? "这一头的焊点不合格" : isPad(d.missing[0].b) && state.joints?.[d.missing[0].b]?.q !== "good" ? "这一头的焊点不合格" : d.missing[0].a.startsWith("BAT:") ? "电池没插" : "这根线没接"}` : "" });
  out.push({ group: "网表", ok: d.shorts.length === 0, zh: `没有短路（${d.shorts.length} 处）`, hint: d.shorts[0] ? `${nodeLabel(d.shorts[0].a)} 和 ${nodeLabel(d.shorts[0].b)} 连通了——多半是连锡` : "" });
  const ub = userBench(state); const idle = evaluateV10(ub, { servoI: 0 });
  out.push({ group: "电源", ok: !!state.batPlugged, zh: "电池插上了（JST）", hint: "焊完、万用表通断检查没问题以后再插电池" });
  for (const c of idle.checks.filter((c) => c.level !== "ok" && !/5\.2 V 高于|没写额定电流/.test(c.zh))) out.push({ group: "电源", ok: false, level: c.level, zh: c.zh, hint: c.md });
  const bo = idle.rails.boost || {};
  for (const b of ["BST1", "BST2"]) out.push({ group: "电源", ok: Math.abs((bo[b]?.v || 0) - BOOST.vout) < 0.05, zh: `${roleZh(b)} 输出 ${(bo[b]?.v || 0).toFixed(2)} V（应为 ${BOOST.vout} V，页面数字）`, hint: bo[b]?.on ? "" : "这个升压没工作：查 IN / GND / EN 三根线和焊点、开关是否 ON" });
  out.push({ group: "电源", ok: idle.rails.espOn, zh: `QT Py 上电：BAT 焊盘后 ${idle.rails.espIn} V（估算二极管压降 0.3 V）`, hint: "查开关 COM → QT Py BAT 焊盘、背面 GND 焊盘" });
  const stall = evaluateV10(ub, { servoI: 8 * 0.23 }); // 8 个同时堵转，估算（V10_LIMITS“电池线”一条）
  out.push({ group: "电源", ok: true, level: stall.warn.length ? "warn" : "ok", zh: `最坏情况（8 个同时堵转 1.84 A，估算）：${stall.warn.length ? stall.warn.join("；") : `电池 ${stall.rails.vbat} V、电流 ${stall.rails.iBat} A`}`, hint: "只是提醒：固件里有软件限位和低压停机" });
  const fp = fw || {};
  out.push({ group: "固件", ok: /编译通过/.test(V10_FW.result), zh: `编译状态：${V10_FW.result}`, hint: "命令见“固件”页；台面不在浏览器里编译" });
  if (fp.servo) for (let i = 0; i < 8; i++) {
    const want = PAD_OF_GPIO[fp.servo[i]]; const got = SERVO_PINS.find((p) => d.res.same(`S${i}:PWM`, `QTPY:${p.pad}`))?.pad;
    if (got !== want) out.push({ group: "固件", ok: false, zh: `固件里 S${i} 用 GPIO${fp.servo[i]}（QT Py ${want}），实际橙线接在 ${got ? `QT Py ${got}` : "（没接通）"}`, hint: `把 S${i} 的橙线改到 QT Py ${want}，或改 octopus_body.h 的 kV10Pins` });
  }
  out.push({ group: "固件", ok: !!fp.servo && SERVO_PINS.every((p, i) => d.res.same(`S${i}:PWM`, `QTPY:${PAD_OF_GPIO[fp.servo[i]]}`)), zh: `8 路 PWM 引脚 = 固件 kV10Pins {${(fp.servo || []).join(", ")}}`, hint: "" });
  out.push({ group: "固件", ok: fp.batt === BATT_PIN.gpio && d.res.same("DIV:OUT", `QTPY:${PAD_OF_GPIO[fp.batt]}`), zh: `电池检测：固件 Battery::kPin = GPIO${fp.batt}（QT Py ${PAD_OF_GPIO[fp.batt] || "?"}）接到分压 OUT`, hint: "分压 OUT 要接 A3" });
  return { checks: out, idle, stall, diff: d };
}
export const stepChecks = (state, ctx) => ({
  bom: checkBom(state), assemble: checkAssemble(state, ctx.dims), wire: checkWire(state), solder: checkSolder(state), check: checkSim(state, ctx.fw).checks,
  finish: [{ ok: !!state.armsOn, zh: "舵机回中后装上 8 条触手", hint: "先让固件把舵机回到 90°，再装舵盘和触手（制作单第 3 步）" }],
});
export const passed = (list) => list.every((c) => c.ok || c.level === "warn");
export function progress(state, ctx) { const c = stepChecks(state, ctx); const done = STEPS.map((s) => passed(c[s.k])); return { checks: c, done, all: done.every(Boolean), first: done.indexOf(false) }; }

// —— 示范：一键完成某一步（页面按钮和测试用；会标在制作单里） ——
export function autoStep(state, k) {
  let s = structuredClone(state); s.auto = [...new Set([...(s.auto || []), k])];
  if (k === "bom") s.bom = bomRequired();
  if (k === "assemble") { s.placed = Object.fromEntries(SLOTS.map((x) => [x, x])); s.order = [...SLOTS]; }
  if (k === "wire") s.wires = refConnections().map((c) => ({ a: c.a, b: c.b, color: c.color }));
  if (k === "solder") { s.batPlugged = false; for (const x of solderSequence(s)) if (s.joints?.[x.n]?.q !== "good") { if (s.joints?.[x.n]?.q) s = solderOp(s, x.n, { t: 1.0, desolder: true }).state; s = solderOp(s, x.n, { t: 1.0, flux: true }).state; } }
  if (k === "check") { s.batPlugged = true; s.swOn = true; }
  if (k === "finish") s.armsOn = true;
  return s;
}
export const emptyState = () => ({ v: 25, bom: {}, placed: {}, order: [], wires: [], joints: {}, heat: {}, log: [], batPlugged: false, swOn: true, armsOn: false });

// —— 万用表检查表（从求解器算；电池电压是标称 3.85 V 估算，实测随电量 3.0–4.2 V） ——
export function meterTable(state) {
  const st = state && (state.wires || []).length ? state : autoStep(autoStep(autoStep(emptyState(), "wire"), "solder"), "check");
  const R = []; const add = (stage, where, mode, expect, basis) => R.push({ stage, where, mode, expect, basis });
  const cold = evaluateV10(userBench(st, { batPlugged: false, swOn: false }));
  add("① 不插电池", "电池座 JST+ ↔ JST−（充电板 BAT ↔ GND 焊盘）", "通断 / 电阻档", cold.same("CHG:BAT", "CHG:GND") ? "导通（短路！不能插电池）" : "不导通（OL）", "网表（求解器）");
  add("① 不插电池", "QT Py 背面 GND 焊盘 ↔ 充电板 GND", "通断档", cold.same("QTPY:BGND", "CHG:GND") ? "导通（≈ 0 Ω）" : "不导通（共地断了）", "网表");
  for (const b of ["BST1", "BST2"]) add("① 不插电池", `${roleZh(b)} IN ↔ OUT`, "通断档", cold.same(`${b}:IN`, `${b}:OUT`) ? "导通（错！）" : "不导通", "网表（芯片内部不算）");
  add("① 不插电池", "舵机 S0–S7 棕线 ↔ 充电板 GND", "通断档", Array.from({ length: 8 }, (_, i) => cold.same(`S${i}:GND`, "CHG:GND")).every(Boolean) ? "8 根都导通" : "有不导通的", "网表");
  add("① 不插电池", "相邻焊盘（QT Py A0–A1、升压 IN–GND–EN–OUT）", "通断档", "都不导通（导通 = 连锡）", "网表");
  const off = evaluateV10(userBench(st, { batPlugged: true, swOn: false }));
  add("② 插电池、开关 OFF", "充电板 BAT ↔ GND", "直流电压档", `≈ ${off.rails.vbat.toFixed(2)} V（估算：标称 ${REF().vbat} V；满电 4.2 V、保护板约 3.0 V 切断）`, "估算");
  add("② 插电池、开关 OFF", "升压 OUT ↔ GND（两个）", "直流电压档", `${(off.rails.boost?.BST1?.v || 0).toFixed(1)} V / ${(off.rails.boost?.BST2?.v || 0).toFixed(1)} V（EN 拉低 = 输出断开）`, "求解器 · Adafruit 4654 页面：EN 拉低真断开");
  add("② 插电池、开关 OFF", "QT Py 3V3 脚 ↔ GND", "直流电压档", `${off.rails.v33} V`, "求解器");
  const on = evaluateV10(userBench(st, { batPlugged: true, swOn: true }), { servoI: 0 });
  add("③ 开关 ON、舵机不动", "升压 OUT ↔ GND（两个）", "直流电压档", `≈ ${(on.rails.boost?.BST1?.v || 0).toFixed(1)} V / ${(on.rails.boost?.BST2?.v || 0).toFixed(1)} V`, "页面数字（Adafruit 4654：5.2 V）");
  add("③ 开关 ON、舵机不动", "QT Py 3V3 脚 ↔ GND", "直流电压档", `≈ ${on.rails.v33} V`, "页面数字（QT Py 3.3 V 稳压）");
  add("③ 开关 ON、舵机不动", "分压 OUT（QT Py A3）↔ GND", "直流电压档", `≈ ${(on.rails.vbat / BATT_PIN.ratio).toFixed(2)} V（= 电池 ÷ ${BATT_PIN.ratio}，估算）`, "估算（100k/100k）");
  add("③ 开关 ON、舵机不动", "电池总电流（电流档串在 JST 线上）", "直流电流档（≥ 2 A 量程）", `≈ ${(on.rails.iBat * 1000).toFixed(0)} mA（估算：QT Py + BLE ${0.08 * 1000} mA + 升压空载 + 舵机保持）`, "估算");
  return R;
}
export const SHEET_LIPO = LIPO;
