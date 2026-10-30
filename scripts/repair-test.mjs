// v17 维修关卡 headless 测试：每个关卡
//   1) 故障让万用表读数按文档变化（expect.faulty），修好后回到 expect.fixed
//   2) 预期修法能修好，修理顺序随机打乱（fuzz，穿插通电 / 测量 / 观察）也能修好
//   3) 错误修法单独做、或“预期修法少一步 + 错误修法”都修不好
//   4) 有序关卡：顺序错了（先给新件通电）会再烧一次、验收不过
import { SCENARIOS } from "../src/repair/scenarios.js";
import { Game, buildScenario, evaluate, BIN } from "../src/repair/game.js";
import { simulate, meter, AWG_OHM_M, clone } from "../src/repair/board.js";
import { makeBoard, TEMPLATES } from "../src/repair/boards.js";
import { faultOptions, applyFaults, colorBands } from "../src/repair/faults.js";
import { validateScenario, fromBench, exportPack, importPack } from "../src/repair/editor.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const results = [];
const ok = (name, c, info = "") => { results.push({ name, ok: !!c, info: String(info) }); if (c) pass++; else { fail++; console.log("FAIL", name, info); } };
let seed = 17;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const inRange = (v, r) => (r[0] === null ? v == null : r[0] === Infinity ? v === Infinity : v != null && v >= r[0] - 1e-9 && v <= r[1] + 1e-9);
const read = (b, e) => { const sim = simulate(b, { power: e.power, run: e.run }); return meter(b, sim, e.red, e.black, e.mode); };
const play = (sc, groups, { fuzz = false } = {}) => {
  const g = new Game(sc, { autoTool: true });
  for (const grp of groups) {
    for (const a of grp) g.act(a);
    if (fuzz) {
      const k = Math.floor(rnd() * 4);
      const ex = sc.expect[Math.floor(rnd() * sc.expect.length)];
      if (k === 0) { g.act({ a: "probe", red: ex.red, black: ex.black, mode: ex.mode }); }
      else if (k === 1) { const p = g.board.parts[Math.floor(rnd() * g.board.parts.length)]; g.act({ a: "inspect", ref: p.ref, mag: 2 }); g.act({ a: "wiggle", ref: p.ref }); }
      else if (k === 2 && sc.check?.type !== "ordered") { const bat = g.board.parts.find((p) => p.kind === "bat"); if (!bat || bat.state.present !== false) { g.act({ a: "power", on: true }); g.act({ a: "power", on: false }); } }
    }
  }
  const bat = g.board.parts.find((p) => p.kind === "bat");
  if (bat && bat.state.present === false) g.act({ a: "battery", op: "insert" });
  g.act({ a: "power", on: false });
  const r = g.act({ a: "deliver" });
  return { g, r };
};

ok("至少 8 个关卡", SCENARIOS.length >= 8, SCENARIOS.length);
ok("难度不下降", SCENARIOS.every((s, i) => i === 0 || s.stars >= SCENARIOS[i - 1].stars), SCENARIOS.map((s) => s.stars).join(""));
ok("覆盖四种板子", ["led", "psu", "sensor", "octo"].every((t) => SCENARIOS.some((s) => s.template === t)));
ok("关卡是纯 JSON（可存可导出）", SCENARIOS.every((s) => JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s)));
ok("AWG 表：30AWG 约是 22AWG 的 6.4 倍", Math.abs(AWG_OHM_M[30] / AWG_OHM_M[22] - 6.4) < 0.1, (AWG_OHM_M[30] / AWG_OHM_M[22]).toFixed(2));
ok("色环：150 Ω = 棕-绿-棕", colorBands(150) === "棕-绿-棕-金", colorBands(150));
ok("色环：4.7 kΩ = 黄-紫-红", colorBands(4700) === "黄-紫-红-金", colorBands(4700));
for (const t of Object.keys(TEMPLATES)) { const ev = evaluate(makeBoard(t)); ok(`模板 ${t}：没有故障时验收通过`, ev.ok, ev.checks.filter((c) => !c.ok).map((c) => c.zh + c.info).join("；")); }

for (const sc of SCENARIOS) {
  const T = `[${sc.id}]`;
  const b0 = buildScenario(sc);
  ok(`${T} 带故障时验收不过`, !evaluate(b0).ok);
  ok(`${T} 3 级提示 / 教训 / 安全须知齐全`, sc.hints.length === 3 && sc.lesson && sc.safety.length && sc.rootCause && sc.parMin > 0);
  for (const e of sc.expect) { const m = read(b0, e); ok(`${T} 故障读数：${e.zh}`, inRange(m.value, e.faulty), `${m.text} 期望 ${e.faulty}`); }
  // 预期修法（原顺序）
  const base = play(sc, sc.solution);
  ok(`${T} 预期修法能修好`, base.g.solved, base.g.log.filter((l) => l.bad).map((l) => l.text).join(" | "));
  for (const e of sc.expect) { const m = read(base.g.board, e); ok(`${T} 修好后读数：${e.zh}`, inRange(m.value, e.fixed), `${m.text} 期望 ${e.fixed}`); }
  ok(`${T} 完美修理 3 星`, base.g.score().stars === 3, JSON.stringify(base.g.score().items));
  // fuzz：随机顺序 + 穿插动作
  let fz = 0; const N = 24;
  for (let k = 0; k < N; k++) { const r = play(sc, shuffle(sc.solution), { fuzz: true }); if (r.g.solved) fz++; else console.log("  fuzz 失败", sc.id, r.g.log.filter((l) => l.bad).map((l) => l.text).join(" | ")); }
  ok(`${T} 打乱顺序 ${N} 次都能修好`, fz === N, `${fz}/${N}`);
  // 错误修法
  sc.wrong.forEach((w, i) => { const r = play(sc, [w]); ok(`${T} 错误修法 ${i + 1} 修不好`, !r.g.solved); });
  if (sc.solution.length > 1) sc.solution.forEach((_, i) => { const rest = sc.solution.filter((__, j) => j !== i); const r = play(sc, rest); ok(`${T} 少做第 ${i + 1} 组修不好`, !r.g.solved); });
  for (const bad of sc.orderBad || []) { const r = play(sc, [bad]); ok(`${T} 顺序错误（先给新件通电）修不好`, !r.g.solved && r.g.damageLog.length > 0, r.g.damageLog.map((d) => d.ref).join()); }
  if (sc.damageCase) { const g = new Game(sc, { autoTool: true }); for (const a of sc.damageCase.steps) g.act(a); ok(`${T} 用错零件的后果：${sc.damageCase.burnt} 烧了`, g.board.parts.find((p) => p.ref === sc.damageCase.burnt).state.burnt); }
  // 安全：带电动烙铁被拦下并扣分
  const g = new Game(sc, { autoTool: true });
  g.act({ a: "power", on: true });
  const hot = g.act({ a: "reflow", ref: g.board.parts.find((p) => !p.offBoard && !p.cover)?.ref });
  ok(`${T} 带电焊接被拦下并扣分`, hot.safety && g.score().items.some((x) => x.zh.startsWith("安全")));
  // 提示扣分
  const gh = new Game(sc, { autoTool: true }); for (let i = 0; i < 3; i++) gh.act({ a: "hint" });
  ok(`${T} 3 个提示扣 35 分`, gh.score().total === 65, gh.score().total);
}

// 编辑器
const custom = { id: "custom-1", title: "自定义", template: "led", stars: 2, parMin: 10, complaint: "灯不亮", faults: [{ type: "coldJoint", target: "D1", arg: { pin: "K" } }], hints: ["a", "b", "c"], lesson: "l", safety: ["s"], rootCause: "r" };
const v = validateScenario(custom);
ok("编辑器：自定义关卡校验通过且故障可观测", v.ok && v.observable, JSON.stringify(v));
const v2 = validateScenario({ ...custom, faults: [{ type: "wrongRes", target: "R1", arg: { ohms: 150 } }] });
ok("编辑器：没有可观测变化的故障会警告", !v2.observable, JSON.stringify(v2.warn));
ok("编辑器：故障列表按零件生成", faultOptions(makeBoard("octo")).some((f) => f.type === "thinWire") && faultOptions(makeBoard("led")).some((f) => f.type === "coldJoint"));
const pack = exportPack([custom]);
const back = importPack(JSON.parse(JSON.stringify(pack)));
ok("编辑器：导出 / 导入往返", back.length === 1 && back[0].faults[0].target === "D1");
let threw = false; try { importPack({ schema: "nope" }); } catch { threw = true; }
ok("编辑器：拒绝错误格式", threw);
// 从装配台电路导入（最小样例：USB 5 V → 220 Ω → LED → GND）
const benchCir = { boards: [{ id: "pico", zh: "Pico", sources: [{ node: "VBUS", v: 5.0, r: 0.2, zh: "VBUS" }], gnd: "GND1" }], els: [{ t: "R", a: "VBUS", b: "n1", r: 220, ref: "r1", zh: "电阻 220 Ω" }, { t: "LED", a: "n1", k: "GND1", ref: "led1", zh: "LED" }], nodes: ["VBUS", "n1", "GND1"], ground: "GND1" };
const imp = fromBench(benchCir);
const ev = evaluate(imp);
ok("编辑器：从装配台电路导入后能仿真（LED 亮）", Object.values(ev.idle.obs.leds)[0]?.state === "亮", JSON.stringify(ev.idle.obs.leds));
const vi = validateScenario({ ...custom, template: undefined, board: imp, faults: [{ type: "coldJoint", target: imp.parts.find((p) => p.kind === "led").ref, arg: { pin: "A" } }] });
ok("编辑器：导入的板子也能注入故障", vi.ok && vi.observable, JSON.stringify(vi));

const out = process.env.OUT || ".tmp";
fs.mkdirSync(out + "/logs", { recursive: true });
fs.writeFileSync(out + "/logs/repair-test-results.json", JSON.stringify({ pass, fail, results }, null, 1));
console.log(`repair-test: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
