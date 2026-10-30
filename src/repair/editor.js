// 关卡编辑器的纯逻辑：校验、从装配台电路导入、导出 / 导入关卡包（JSON，格式 "proto-repair/1"）
import { buildScenario, evaluate } from "./game.js";
import { makeBoard } from "./boards.js";
import { simulate } from "./board.js";
import { FAULTS } from "./faults.js";

export const PACK_SCHEMA = "proto-repair/1";
export const LS_KEY = "repair.custom.v1";

const snap = (b) => {
  const ev = evaluate(b);
  const o = ev.idle.obs;
  return JSON.stringify({ c: ev.checks.map((c) => [c.ok, c.info]), l: Object.entries(o.leds).map(([k, v]) => [k, v.state]), n: Object.entries(o.nets).map(([k, v]) => [k, v.min.toFixed(2)]), m: o.mcu?.state });
};

export function validateScenario(sc) {
  const errors = [], warn = [];
  for (const k of ["id", "title", "complaint"]) if (!sc[k]) errors.push(`缺少 ${k}`);
  if (!sc.template && !sc.board) errors.push("没有选板子");
  if (!sc.faults?.length) errors.push("至少要有一个故障");
  for (const f of sc.faults || []) if (!FAULTS[f.type]) errors.push(`未知故障类型 ${f.type}`);
  if ((sc.hints || []).length !== 3) warn.push("建议写满 3 级提示");
  if (errors.length) return { ok: false, observable: false, errors, warn };
  let healthy, faulty;
  try { healthy = sc.board ? JSON.parse(JSON.stringify(sc.board)) : makeBoard(sc.template); faulty = buildScenario(sc); } catch (e) { return { ok: false, observable: false, errors: ["故障注入失败：" + e.message], warn }; }
  const before = snap(healthy), after = snap(faulty);
  const observable = before !== after;
  if (!observable) warn.push("注入故障后，验收项、LED、关键电压都没有变化——玩家看不出问题，建议换一个故障");
  if (evaluate(faulty).ok) warn.push("带故障时验收仍然通过，这一关没法“修好”");
  return { ok: true, observable, errors, warn, healthyOk: evaluate(healthy).ok };
}

// 装配台电路 → 维修板子。输入是中性的描述（UI 从 window.__asm 的电路里整理出来）：
//   { name, ground, sources:[{node,v,r,zh}], els:[{t:"R",a,b,r,ref,zh} | {t:"LED",a,k,ref,zh}] }
// 只导入电阻、LED 和板子的电源脚；GPIO 输出、按钮、舵机等不导入（我的补充：保持简单，界面会说明）。
export function fromBench(d) {
  const names = new Map();
  const nn = (n) => { if (n === d.ground) return "GND"; if (!names.has(n)) names.set(n, "N" + (names.size + 1)); return names.get(n); };
  const parts = [];
  let x = 4, y = 6;
  const place = (w, h) => { const p = [x, y]; x += w + 8; if (x > 80) { x = 4; y += h + 10; } return p; };
  (d.boards || []).forEach((bd, bi) => bd.sources.forEach((s, si) => {
    const [px, py] = place(12, 12);
    parts.push({ ref: `J${parts.filter((p) => p.kind === "dcin").length + 1}`, kind: "dcin", zh: `${bd.zh} 的 ${s.zh}（${s.v} V，估算内阻 ${s.r} Ω）`, x: px, y: py, w: 12, h: 12, pins: { "+": nn(s.node), "-": nn(bd.gnd || d.ground) }, props: { v: s.v, r: s.r, fp: "usb" }, state: { present: true, orient: 1 }, joints: {} });
    void bi; void si;
  }));
  let nr = 0, nl = 0;
  for (const e of d.els) {
    if (e.t === "R") { const [px, py] = place(14, 4); nr++; parts.push({ ref: "R" + nr, kind: "res", zh: e.zh || `电阻 ${e.r} Ω`, x: px, y: py, w: 14, h: 4, pins: { 1: nn(e.a), 2: nn(e.b) }, props: { ohms: e.r, fp: "res" }, state: { present: true, ohms: e.r }, joints: {}, benchRef: e.ref }); }
    if (e.t === "LED") { const [px, py] = place(8, 8); nl++; parts.push({ ref: "D" + nl, kind: "led", zh: e.zh || "LED", x: px, y: py, w: 8, h: 8, pins: { A: nn(e.a), K: nn(e.k) }, props: { fp: "led" }, state: { present: true, orient: 1 }, joints: {}, benchRef: e.ref }); }
  }
  const nets = { GND: "地" };
  for (const [, v] of names) nets[v] = "节点 " + v;
  const b = { template: "bench", name: d.name || "从装配台导入的电路", w: 96, h: Math.max(44, y + 24), ground: "GND", nets, parts, traces: [], wires: [], shorts: [], covers: [], testpoints: [{ id: "TP1", net: "GND", x: 90, y: 4 }], watch: {}, spec: [] };
  const sim = simulate(b, { power: true, run: false });
  for (const p of parts.filter((p) => p.kind === "led")) { const l = sim.obs.leds[p.ref]; if (l && l.state === "亮") b.spec.push({ zh: `${p.ref} 正常亮`, led: p.ref, mA: [Math.max(1, l.mA * 0.6), 20] }); }
  for (const n of Object.values(nets).length ? Object.keys(nets) : []) if (n !== "GND") b.watch[n] = n;
  if (!b.spec.length) b.spec.push({ zh: "没有零件烧坏", cond: { all: [] } });
  return b;
}

export function exportPack(list) { return { schema: PACK_SCHEMA, saved: new Date().toISOString(), scenarios: JSON.parse(JSON.stringify(list)) }; }
export function importPack(obj) {
  if (!obj || obj.schema !== PACK_SCHEMA || !Array.isArray(obj.scenarios)) throw new Error("不是维修关卡包（需要 schema = proto-repair/1）");
  return obj.scenarios.filter((s) => s && s.id && (s.template || s.board) && Array.isArray(s.faults));
}
