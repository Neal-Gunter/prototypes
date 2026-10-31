// v26：实测对比（我的补充）。把万用表检查表变成可以填真实读数的清单：
// 每一项有求解器的估算值 + 容差（容差也是估算），填了实测就算偏差，标“仅估算 / 已在实物上验证 / 有偏差”。
// 有偏差时给出“该查哪个模型参数”的建议（电池内阻 / 导线电阻 / 接触电阻 / 电量 / QT Py 电流），
// 可以一键“应用到仿真”作为 用户校准（写进 state.measure.cal，可撤销；不应用就和 v25 完全一样）。
// 不会自己编实测值：只有用户填的值，或者明确标成“示例数据（不是实测）”的示例。早期原型，简化仿真。
import * as P from "./octoProject.js";
import { evaluateV10, v10PathR, I_QTPY } from "../assembly/octopus/circuit.js";
import { BATT_PIN } from "../assembly/octopus/v10.js";

export const MEASURE_V = 26;
export const PHOTO_KEY = "octo-measure-photos-v26";
export const LOAD_SERVO_A = 0.8; // ④ 8 个舵机一起摆动时 5 V 侧总电流（估算假设：平均 0.1 A/个，不是数据手册数字）
export const STATUS_ZH = { est: "仅估算", ok: "已在实物上验证", dev: "有偏差", cal: "已按这条实测校准" };
// 示例数据不能叫“已在实物上验证”：换成“示例数据：…”
export const EXAMPLE_ZH = { est: "仅估算", ok: "示例数据：吻合（不是实测）", dev: "示例数据：有偏差（不是实测）", cal: "示例数据：已按它校准（不是实测）" };
export const statusText = (status, example) => (example ? EXAMPLE_ZH : STATUS_ZH)[status];
export const PARAM_ZH = { vbat0: "电池开路电压（电量）", rint: "电池内阻", rWire: "导线电阻（电池线 + 主路）", rContact: "接触电阻（JST + 焊点）", iQt: "QT Py + BLE 平均电流" };
export const PARAM_UNIT = { vbat0: "V", rint: "Ω", rWire: "Ω", rContact: "Ω", iQt: "A" };

export const emptyMeasure = () => ({ v: MEASURE_V, items: {}, cal: {} });
const M = (state) => state?.measure || emptyMeasure();

// “OL” / “open” / “∞” = 万用表显示超量程（不导通）
export function parseReading(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/,/g, ".");
  if (!s) return null;
  if (/^(ol|o\.l\.?|open|inf|∞|不导通)$/i.test(s)) return Infinity;
  const n = Number(s.replace(/\s*(v|mv|ma|a|ω|ohm|Ω)$/i, ""));
  return Number.isFinite(n) ? n : NaN;
}
const f = (x, d = 2) => (x === Infinity ? "OL" : Number.isFinite(x) ? (+x.toFixed(d)).toString() : "—");

// 求解器在当前台面 + 当前用户校准下的估算
function solve(state) {
  const st = state && (state.wires || []).length ? state : P.autoStep(P.autoStep(P.autoStep(P.emptyState(), "wire"), "solder"), "check");
  const cal = P.calOf(state) || {};
  const cold = evaluateV10(P.userBench(st, { batPlugged: false, swOn: false }));
  const off = evaluateV10(P.userBench(st, { batPlugged: true, swOn: false }), { cal });
  const on = evaluateV10(P.userBench(st, { batPlugged: true, swOn: true }), { servoI: 0, cal });
  const load = evaluateV10(P.userBench(st, { batPlugged: true, swOn: true }), { servoI: LOAD_SERVO_A, cal });
  const R = v10PathR(cal.vbat0 ?? P.REF().vbat, cal);
  return { cold, off, on, load, R, cal };
}

// 清单：kind = v（电压）/ ma（电流）/ ohm（电阻，导通）/ open（应该 OL）/ count（8 根里导通几根）
export function measureItems(state) {
  const { cold, off, on, load, R } = solve(state);
  const meas = M(state).items;
  const num = (id) => { const v = parseReading(meas[id]?.raw); return Number.isFinite(v) ? v : null; };
  const I = [];
  const add = (o) => I.push({ optional: false, ...o });
  const openOr = (closed, ohm) => (closed ? { kind: "ohm", est: ohm, tol: { abs: 1 } } : { kind: "open", est: Infinity, tol: null });
  // ① 不插电池（通断 / 电阻档；先把表笔短接看读数，减掉表笔电阻）
  add({ id: "c-bat-short", step: "solder", stage: "① 不插电池", where: "电池座 JST+ ↔ JST−（充电板 BAT ↔ GND）", mode: "电阻档", unit: "Ω", ...openOr(cold.same("CHG:BAT", "CHG:GND"), 0), basis: "网表（求解器）" });
  add({ id: "c-gnd", step: "solder", stage: "① 不插电池", where: "QT Py 背面 GND ↔ 充电板 GND", mode: "电阻档（200 Ω）", unit: "Ω", ...openOr(cold.same("QTPY:BGND", "CHG:GND"), R.rWire + 2 * R.rContact), basis: `网表 + 导线 ${f(R.rWire, 3)} Ω + 2 × 接触 ${f(R.rContact, 3)} Ω（估算；表笔电阻先减掉；容差 ±1 Ω 是表的分辨率估算）` });
  for (const b of ["BST1", "BST2"]) add({ id: `c-${b.toLowerCase()}-io`, step: "solder", stage: "① 不插电池", where: `${P.roleZh(b)} IN ↔ OUT`, mode: "电阻档", unit: "Ω", ...openOr(cold.same(`${b}:IN`, `${b}:OUT`), 0), basis: "网表（芯片内部不算）" });
  add({ id: "c-servo-gnd", step: "solder", stage: "① 不插电池", where: "舵机 S0–S7 棕线 ↔ 充电板 GND：导通的根数", mode: "通断档", unit: "根", kind: "count", est: Array.from({ length: 8 }, (_, i) => cold.same(`S${i}:GND`, "CHG:GND")).filter(Boolean).length, tol: { abs: 0 }, basis: "网表" });
  // ② 插电池、开关 OFF
  add({ id: "v-bat-off", step: "check", stage: "② 插电池、开关 OFF", where: "充电板 BAT ↔ GND（开路电压）", mode: "直流电压档", unit: "V", kind: "v", est: off.rails.vbat, tol: { abs: 0.3 }, basis: "估算：标称 3.85 V；实测随电量 3.0–4.2 V，容差 ±0.3 V（估算）" });
  add({ id: "v-bst1-off", step: "check", stage: "② 插电池、开关 OFF", where: "升压 1 OUT ↔ GND", mode: "直流电压档", unit: "V", kind: "v", est: off.rails.boost?.BST1?.v || 0, tol: { abs: 0.2 }, basis: "求解器 · Adafruit 4654 页面：EN 拉低真断开" });
  add({ id: "v-33-off", step: "check", stage: "② 插电池、开关 OFF", where: "QT Py 3V3 ↔ GND", mode: "直流电压档", unit: "V", kind: "v", est: off.rails.v33 || 0, tol: { abs: 0.2 }, basis: "求解器" });
  // ③ 开关 ON、舵机不动
  for (const b of ["BST1", "BST2"]) add({ id: `v-${b.toLowerCase()}-on`, step: "check", stage: "③ 开关 ON、舵机不动", where: `${P.roleZh(b)} OUT ↔ GND`, mode: "直流电压档", unit: "V", kind: "v", est: on.rails.boost?.[b]?.v || 0, tol: { abs: 0.15 }, basis: "页面数字（Adafruit 4654：5.2 V）；容差 ±0.15 V 是估算" });
  add({ id: "v-33-on", step: "check", stage: "③ 开关 ON、舵机不动", where: "QT Py 3V3 ↔ GND", mode: "直流电压档", unit: "V", kind: "v", est: on.rails.v33 || 0, tol: { abs: 0.1 }, basis: "页面数字（QT Py 3.3 V 稳压）；容差估算" });
  add({ id: "v-a3-on", step: "check", stage: "③ 开关 ON、舵机不动", where: "分压 OUT（QT Py A3）↔ GND", mode: "直流电压档", unit: "V", kind: "v", est: on.rails.vbat / BATT_PIN.ratio, tol: { abs: 0.1 }, basis: `= 电池 ÷ ${BATT_PIN.ratio}（100k/100k，估算；电阻 1% 误差 + 表的输入阻抗）` });
  add({ id: "i-idle", step: "check", stage: "③ 开关 ON、舵机不动", where: "电池总电流（电流档串在 JST 线上）", mode: "直流电流档（≥ 2 A 量程）", unit: "mA", kind: "ma", est: on.rails.iBat * 1000, tol: { rel: 0.4 }, basis: `估算：QT Py + BLE ${f((P.calOf(state)?.iQt ?? I_QTPY) * 1000, 0)} mA（WiFi/BLE 峰值会跳），容差 ±40%（估算）` });
  // ④ 负载（可选）：固件“全体摆动”时测；估算按实测电流和开路电压重算（测到的值越多，越能分清是哪一段电阻）
  const voc = num("v-bat-off") ?? off.rails.vbat;
  const iL = num("i-load") != null ? num("i-load") / 1000 : load.rails.iBat;
  add({ id: "i-load", step: "finish", optional: true, stage: "④ 舵机一起动（可选）", where: "电池总电流（固件全体摆动时，读稳定值）", mode: "直流电流档（10 A 孔）", unit: "mA", kind: "ma", est: load.rails.iBat * 1000, tol: { rel: 0.5 }, basis: `估算假设：5 V 侧 ${LOAD_SERVO_A} A（8 × 0.1 A，不是数据手册数字），容差 ±50%` });
  add({ id: "v-bat-load", step: "finish", optional: true, stage: "④ 舵机一起动（可选）", where: "电池插头处 BAT ↔ GND（同一时刻）", mode: "直流电压档", unit: "V", kind: "v", est: voc - iL * R.rint, tol: { abs: 0.05 }, basis: `= 开路电压 ${f(voc)} V − 电流 ${f(iL, 3)} A × 电池内阻 ${f(R.rint, 3)} Ω（估算）` });
  add({ id: "v-bin-load", step: "finish", optional: true, stage: "④ 舵机一起动（可选）", where: "升压 1 IN ↔ GND（同一时刻）", mode: "直流电压档", unit: "V", kind: "v", est: voc - iL * R.total, tol: { abs: 0.05 }, basis: `= 开路电压 − 电流 × (内阻 + 导线 ${f(R.rWire, 3)} + 接触 ${f(R.rContact, 3)} Ω)（估算）` });
  return I;
}

// 单项对比
export function compare(item, entry, calSources = new Set()) {
  const v = parseReading(entry?.raw);
  if (v == null) return { status: "est", value: null, dev: null, txt: "还没填实测" };
  if (Number.isNaN(v)) return { status: "est", value: NaN, dev: null, txt: "读不懂这个数（填数字，或 OL）" };
  let ok, dev = null, txt;
  if (item.kind === "open") { ok = v === Infinity || v > 1e6; txt = ok ? "OL，和预期一样" : `读到 ${f(v)} Ω：应该不导通`; }
  else if (v === Infinity) { ok = false; txt = "OL：应该导通"; }
  else {
    dev = v - item.est;
    const lim = item.tol?.abs ?? Math.abs(item.est) * (item.tol?.rel ?? 0);
    ok = Math.abs(dev) <= lim + 1e-9;
    const pc = item.kind !== "count" && Math.abs(item.est) > 0.5 ? Math.round((dev / item.est) * 100) : null;
    const rel = pc != null ? ` / ${pc > 0 ? "+" : ""}${pc || 0}%` : "";
    txt = `偏差 ${dev >= 0 ? "+" : ""}${f(dev, item.unit === "mA" ? 0 : 3)} ${item.unit}${rel}（容差 ±${f(lim, item.unit === "mA" ? 0 : 3)} ${item.unit}）`;
  }
  const status = ok ? (calSources.has(item.id) ? "cal" : "ok") : "dev";
  return { status, value: v, dev, txt };
}

export function calSources(state) { return new Set(Object.values(M(state).cal).map((c) => c.from).filter(Boolean)); }

// 全部结果 + 每一步的标记
export function measureReport(state) {
  const m = M(state); const items = measureItems(state); const src = calSources(state);
  const rows = items.map((it) => ({ ...it, entry: m.items[it.id] || null, ...compare(it, m.items[it.id], src), photo: !!m.items[it.id]?.photo, example: !!m.items[it.id]?.example }));
  const steps = {};
  for (const r of rows) {
    const s = (steps[r.step] ||= { n: 0, ok: 0, dev: 0, est: 0, need: 0, example: false });
    s.n++; if (r.example && r.status !== "est") s.example = true; s[r.status === "cal" ? "ok" : r.status]++; if (!r.optional) s.need++;
  }
  for (const s of Object.values(steps)) s.status = s.dev ? "dev" : s.ok && s.ok >= s.need ? "ok" : "est";
  const example = Object.values(m.items).some((e) => e.example);
  const counts = { ok: rows.filter((r) => r.status === "ok").length, cal: rows.filter((r) => r.status === "cal").length, dev: rows.filter((r) => r.status === "dev").length, est: rows.filter((r) => r.status === "est").length, n: rows.length };
  return { rows, steps, counts, example, suggestions: calibrationSuggestions(state, rows), cal: m.cal };
}

// 校准建议：有偏差时，该查哪个模型参数；能从实测反推的给出建议值（可应用到仿真，标“用户校准”）
export function calibrationSuggestions(state, rows = measureReport(state).rows) {
  const by = Object.fromEntries(rows.map((r) => [r.id, r])); const val = (id) => (Number.isFinite(by[id]?.value) ? by[id].value : null);
  const cal = P.calOf(state) || {}; const R = v10PathR(cal.vbat0 ?? P.REF().vbat, cal);
  const S = [];
  const sug = (o) => S.push({ apply: null, ...o });
  for (const r of rows.filter((x) => x.status === "dev")) {
    if (r.kind === "open") sug({ id: r.id, title: `${r.where}：应该不导通却读到 ${f(r.value)} Ω`, check: "短路 / 连锡：先别插电池。回到“焊接”步骤看相邻焊盘，或者接线里多连了一根。", param: null });
    else if (r.id === "c-gnd" && r.value === Infinity) sug({ id: r.id, title: "共地断了（OL）", check: "GND 线没焊上或虚焊：回到“接线 / 焊接”步骤。不是参数问题，不校准。", param: null });
    else if (r.id === "c-gnd") { const rc = Math.max(0, (r.value - R.rWire) / 2); sug({ id: r.id, title: `GND 路径 ${f(r.value)} Ω，比估算大`, check: "接触电阻：焊点虚焊、焊锡没吃进焊盘，或 JST 插头松。先把表笔短接看读数（表笔电阻要减掉）。", param: "rContact", value: +rc.toFixed(3), apply: { rContact: +rc.toFixed(3) }, how: `每个接触 ≈ (${f(r.value)} − 导线 ${f(R.rWire, 3)}) ÷ 2` }); }
    else if (r.id === "c-servo-gnd") sug({ id: r.id, title: `只有 ${f(r.value, 0)} / 8 根棕线导通`, check: "舵机地线没焊好：回到“焊接”步骤。不校准。", param: null });
    else if (r.id === "v-bat-off") sug({ id: r.id, title: `开路电压 ${f(r.value)} V，和标称 ${f(r.est)} V 不同`, check: r.value < 3.5 ? "电池快没电了（< 3.5 V）：先充电再测。" : "电量不同很正常（3.0–4.2 V）：把仿真改成你的实测电量，后面的估算更准。", param: "vbat0", value: +r.value.toFixed(3), apply: { vbat0: +r.value.toFixed(3) }, how: "直接用实测开路电压" });
    else if (r.id === "i-idle") { const other = r.est / 1000 - (cal.iQt ?? I_QTPY); const iq = Math.max(0, r.value / 1000 - other); sug({ id: r.id, title: `静态电流 ${f(r.value, 0)} mA，估算 ${f(r.est, 0)} mA`, check: r.value > r.est ? "舵机在用力保持（触手被压着）、WiFi 在扫描，或有漏电 / 半短路（摸一下哪个板子发热）。" : "QT Py 可能在省电模式，或者电流档接错（量程太大读数不准）。", param: "iQt", value: +iq.toFixed(3), apply: { iQt: +iq.toFixed(3) }, how: `QT Py + BLE ≈ ${f(r.value, 0)} mA − 其他 ${f(other * 1000, 0)} mA` }); }
    else if (r.id === "v-bat-load") {
      const voc = val("v-bat-off"), i = val("i-load");
      if (voc == null || i == null || !i) sug({ id: r.id, title: `负载时电池电压 ${f(r.value)} V，估算 ${f(r.est)} V`, check: "要反推电池内阻，还需要填 ② 开路电压和 ④ 同一时刻的电流。", param: "rint" });
      else { const ri = Math.max(0, (voc - r.value) / (i / 1000)); sug({ id: r.id, title: `负载时掉了 ${f(voc - r.value, 3)} V（估算 ${f(voc - r.est, 3)} V）`, check: ri > 0.3 ? "电池内阻偏大：电池老化、冷，或者电量低。小电池在大电流下压降大，QT Py 可能复位。" : "电池内阻和模型不同：把实测内阻写进仿真。", param: "rint", value: +ri.toFixed(3), apply: { rint: +ri.toFixed(3) }, how: `内阻 = (开路 ${f(voc)} − 负载 ${f(r.value)} V) ÷ ${f(i / 1000, 3)} A` }); }
    }
    else if (r.id === "v-bin-load") {
      const vt = val("v-bat-load"), i = val("i-load");
      if (vt == null || i == null || !i) sug({ id: r.id, title: `负载时升压 IN ${f(r.value)} V，估算 ${f(r.est)} V`, check: "要分清导线和接触电阻，还需要填同一时刻电池插头处的电压和电流。", param: "rWire" });
      else {
        const x = Math.max(0, (vt - r.value) / (i / 1000));
        const contact = x > 0.2; const p = contact ? "rContact" : "rWire"; const v = +Math.max(0, contact ? (x - R.rWire) / 2 : x - 2 * R.rContact).toFixed(3);
        sug({ id: r.id, title: `电池插头到升压 IN 之间掉了 ${f(vt - r.value, 3)} V（≈ ${f(x, 3)} Ω）`, check: contact ? "电阻偏大（> 0.2 Ω），多半是接触电阻：JST 插头松、焊点虚焊，或开关触点。" : "导线电阻和模型不同：线太细 / 太长时会这样。", param: p, value: v, apply: { [p]: v }, how: contact ? `每个接触 ≈ (${f(x, 3)} − 导线 ${f(R.rWire, 3)}) ÷ 2` : `导线 ≈ ${f(x, 3)} − 2 × 接触 ${f(R.rContact, 3)}` });
      }
    }
    else if (/^v-bst\d-on$/.test(r.id)) sug({ id: r.id, title: `${r.where} ${f(r.value)} V，估算 ${f(r.est)} V`, check: r.value < r.est ? "升压输出低：先量升压 IN（④）看是不是输入被拉低（电池内阻 / 导线 / 接触电阻），再看 EN 是否接好。升压输出本身是页面数字，不校准。" : "输出偏高：确认是 5 V 版本的升压板、表的档位对。", param: null });
    else if (r.id === "v-a3-on") sug({ id: r.id, title: `A3 ${f(r.value)} V，估算 ${f(r.est)} V`, check: "分压电阻的误差（1% / 5%）或者表的输入阻抗；同时量一下电池电压算比值。固件里可以按实测比值改 Battery 的系数（我的补充）。不校准。", param: null });
    else sug({ id: r.id, title: `${r.where}：${r.txt}`, check: "先确认档位和表笔位置；如果反复测都一样，回到对应步骤检查接线 / 焊点。", param: null });
  }
  return S;
}

// 应用 / 撤销用户校准（纯函数，返回新 state）
export function applyCal(state, sug, now = Date.now()) {
  if (!sug?.apply) return state;
  const m = M(state); const cal = { ...m.cal };
  for (const [k, v] of Object.entries(sug.apply)) cal[k] = { value: v, from: sug.id, at: now, example: !!m.items[sug.id]?.example };
  return { ...state, measure: { ...m, cal } };
}
export function undoCal(state, key) {
  const m = M(state); const cal = { ...m.cal };
  if (key) delete cal[key]; else for (const k of Object.keys(cal)) delete cal[k];
  return { ...state, measure: { ...m, cal } };
}
export function setReading(state, id, raw, { example = false, now = Date.now() } = {}) {
  const m = M(state); const items = { ...m.items };
  if (raw == null || String(raw).trim() === "") { if (items[id]?.photo) items[id] = { ...items[id], raw: "", at: now }; else delete items[id]; }
  else items[id] = { ...items[id], raw: String(raw).trim(), at: now, example };
  return { ...state, measure: { ...m, items } };
}
export function setPhotoFlag(state, id, has) {
  const m = M(state); const items = { ...m.items }; items[id] = { ...(items[id] || { raw: "" }), photo: !!has };
  if (!has && !items[id].raw) delete items[id];
  return { ...state, measure: { ...m, items } };
}
export function clearMeasure(state) { return { ...state, measure: emptyMeasure() }; }

// 示例数据：只用于演示和测试，所有项都带 example:true，界面和制作单都会写“示例数据（不是实测）”
export const EXAMPLE_READINGS = { "c-bat-short": "OL", "c-gnd": "0.4", "c-bst1-io": "OL", "c-bst2-io": "OL", "c-servo-gnd": "8", "v-bat-off": "4.02", "v-bst1-off": "0.00", "v-33-off": "0.00", "v-bst1-on": "5.18", "v-bst2-on": "5.21", "v-33-on": "3.29", "v-a3-on": "1.99", "i-idle": "95", "i-load": "1400", "v-bat-load": "3.62", "v-bin-load": "3.48" };
export function loadExample(state, now = Date.now()) {
  let s = clearMeasure(state);
  for (const [id, raw] of Object.entries(EXAMPLE_READINGS)) s = setReading(s, id, raw, { example: true, now });
  return s;
}

// 导出 / 导入（JSON）。照片默认不导出（只在本机浏览器），勾选才带上
export function exportMeasure(state, { photos = null, now = new Date() } = {}) {
  const m = M(state);
  const out = { kind: "octo-measure", v: MEASURE_V, exported: new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace("T", " ") + "（北京时间）", note: "早期原型，简化仿真。example:true 的是示例数据（不是实测）。", items: m.items, cal: m.cal };
  if (photos) out.photos = photos;
  return JSON.stringify(out, null, 2);
}
export function importMeasure(state, text) {
  let j; try { j = JSON.parse(text); } catch { return { ok: false, msg: "不是 JSON 文件" }; }
  if (!j || j.kind !== "octo-measure" || typeof j.items !== "object") return { ok: false, msg: "不是实测对比导出的文件（kind 应为 octo-measure）" };
  const known = new Set(measureItems(state).map((i) => i.id)); const items = {}; const skipped = [];
  for (const [id, e] of Object.entries(j.items || {})) {
    if (!known.has(id) || !e || typeof e !== "object") { skipped.push(id); continue; }
    const raw = e.raw == null ? "" : String(e.raw).slice(0, 32);
    if (raw && Number.isNaN(parseReading(raw))) { skipped.push(id); continue; }
    items[id] = { raw, at: Number(e.at) || Date.now(), example: !!e.example, ...(e.photo ? { photo: true } : {}) };
  }
  const cal = {};
  for (const [k, c] of Object.entries(j.cal || {})) if (PARAM_ZH[k] && c && Number.isFinite(+c.value) && +c.value >= 0) cal[k] = { value: +c.value, from: String(c.from || ""), at: Number(c.at) || Date.now(), example: !!c.example };
  const photos = j.photos && typeof j.photos === "object" ? Object.fromEntries(Object.entries(j.photos).filter(([id, u]) => items[id] && typeof u === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(u))) : null;
  for (const id of Object.keys(items)) if (items[id].photo && !photos?.[id]) delete items[id].photo; // 照片没带过来就不标
  for (const id of Object.keys(photos || {})) items[id].photo = true;
  return { ok: true, state: { ...state, measure: { v: MEASURE_V, items, cal } }, photos, skipped, msg: `导入了 ${Object.keys(items).length} 项实测、${Object.keys(cal).length} 个校准${skipped.length ? `；跳过 ${skipped.length} 项（不认识或读不懂）` : ""}` };
}
export const fmt = f;
